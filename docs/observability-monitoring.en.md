# Metrics, Monitoring, Logging, and Alerts

This document explains the observability work added to the project: from application metrics to a complete local monitoring stack. The purpose is to answer: Is the API alive? Is it slow? Is it returning errors? What should happen when a problem appears?

## Before starting: what was actually added?

### Inside the API code

| File | What was added | Responsibility |
| --- | --- | --- |
| `src/observability/logger.ts` | `logger.info/warn/error` | Writes structured JSON logs |
| `src/observability/metrics.ts` | Prometheus Registry and HTTP Histogram | Turns each request duration into a metric |
| `src/middleware/request-logger.ts` | Request ID, log, and `recordHttpRequest` | Records each request after it completes |
| `src/middleware/error-handler.ts` | Structured error log | Logs unexpected errors with the request ID |
| `src/app.ts` | `GET /metrics` | Exposes metrics in Prometheus format |

The `@prometheus-io/client` package was also added to `package.json`. It creates metrics in Prometheus format; it is not a server or a dashboard.

### Next to the API code

| Location | Responsibility |
| --- | --- |
| `prometheus/prometheus.yml` | Tells Prometheus where and when to scrape `/metrics` |
| `prometheus/rules/mini-erp-alerts.yml` | Defines API-down, latency, and 5xx-rate alerts |
| `alertmanager/alertmanager.yml` | Receives alerts and sends them to local Mailpit |
| `grafana/provisioning/` | Automatically connects Grafana to Prometheus |
| `grafana/dashboards/mini-erp-overview.json` | Provides the API dashboard |
| `docker-compose.yml` | Starts Prometheus, Grafana, Alertmanager, and Mailpit services |

## How it was added and how it works, step by step

### Step 1: the application records a metric

When a request finishes, `request-logger` knows the route, status code, and duration. It calls:

```ts
recordHttpRequest(req.method, route, res.statusCode, durationMs);
```

This adds an observation to the histogram. It does not send anything to Prometheus yet; the value is stored in the API process memory.

### Step 2: the application exposes its numbers

When `GET /metrics` is requested, Express reads the in-memory registry and returns Prometheus text format. First, try:

```powershell
curl http://localhost:3000/metrics
```

You should see metric names beginning with `mini_erp_`.

### Step 3: Prometheus pulls `/metrics`

`prometheus.yml` defines an `api:3000` target:

```yaml
scrape_configs:
  - job_name: mini-erp-api
    metrics_path: /metrics
    static_configs:
      - targets: ["api:3000"]
```

Every 15 seconds Prometheus requests `http://api:3000/metrics` **inside the Docker network** and stores the result. It must not use `localhost` there, because localhost inside a container refers to that same container, not the API.

### Step 4: Grafana reads Prometheus

Grafana has a datasource provisioning file, so no manual Prometheus setup is required in its UI after starting the container. Grafana asks Prometheus for request-rate, p95, and other data, then shows it in the dashboard.

### Step 5: Prometheus evaluates rules

Prometheus evaluates rule files periodically. If an alert condition stays true for the duration in `for`, it sends the alert to Alertmanager. For example, `MiniErpApiDown` becomes firing only when the API is unreachable for a full minute.

### Step 6: Alertmanager sends a notification

Alertmanager receives the alert, groups similar alerts, and sends email to Mailpit through `mailpit:1025`. Mailpit displays that email at `http://localhost:8025`.

## Run and verify everything from scratch

1. Confirm Docker Desktop is running.
2. From the project root, run:

   ```powershell
   docker compose up -d --build
   ```

3. Confirm services are up:

   ```powershell
   docker compose ps
   ```

   Look for `api`, `prometheus`, `grafana`, and `alertmanager`.

4. Generate API traffic: open Swagger at `http://localhost:3000/api-docs` and call any GET endpoint a few times.
5. Verify the source metrics at `http://localhost:3000/metrics`.
6. Open Prometheus at `http://localhost:9090`. In **Status → Targets**, confirm that `mini-erp-api` is **UP**.
7. Run a query such as:

   ```promql
   sum(rate(mini_erp_http_request_duration_seconds_count[5m]))
   ```

8. Open Grafana at `http://localhost:3001`, sign in locally, and open **Mini ERP / Mini ERP API Overview**.
9. Open Alertmanager at `http://localhost:9093` and Mailpit at `http://localhost:8025` when you want to inspect alerts and local email.

### When you change configuration later

- Changed TypeScript, a dependency, or the Dockerfile: `docker compose up -d --build`.
- Changed only `docker-compose.yml`: `docker compose up -d`.
- Changed `prometheus.yml` or alert rules: restart Prometheus:

  ```powershell
  docker compose restart prometheus
  ```

- Changed Grafana provisioning/dashboard files: restart Grafana:

  ```powershell
  docker compose restart grafana
  ```

## How it was written: file-by-file implementation guide

This section is a recipe for rebuilding the same observability setup from scratch, not only a description of the result.

### A. Install the metrics client

First, add the Prometheus client:

```powershell
npm install @prometheus-io/client
```

It gives TypeScript objects such as `Registry` and `Histogram`, and turns them into the text format Prometheus understands. Prometheus itself is not an npm package in this project; it is a separate Docker service.

### B. Create the registry and HTTP histogram

Create `src/observability/metrics.ts`:

```ts
import { Histogram, Registry, collectDefaultMetrics } from "@prometheus-io/client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({
  register: metricsRegistry,
  prefix: "mini_erp_",
});
```

- `Registry` is the container for this application's metrics.
- `collectDefaultMetrics` adds useful Node.js metrics: memory, CPU, event-loop lag, and garbage collection.
- `prefix` prevents name collisions if Prometheus collects several applications.

Then define the HTTP-duration metric:

```ts
const httpRequestDuration = new Histogram({
  name: "mini_erp_http_request_duration_seconds",
  help: "HTTP request duration in seconds.",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});
```

- The name must stay stable after deployment; `_seconds` declares its unit.
- `help` is documentation shown in `/metrics`.
- Labels split one metric by method, route, and status. For example, `GET products 200` is different from `POST orders 500`.
- Buckets are latency boundaries. A 120ms request falls into the 250ms bucket and all larger buckets; those buckets make p95 calculation possible.
- `registers` attaches the histogram to the registry that `/metrics` exposes.

Then add one narrow function for middleware to call:

```ts
export function recordHttpRequest(method, route, statusCode, durationMs) {
  if (route === "/metrics") return;

  httpRequestDuration.observe(
    { method, route, status_code: String(statusCode) },
    durationMs / 1_000,
  );
}
```

Milliseconds are converted because the metric unit is seconds. `/metrics` is excluded because each Prometheus scrape would otherwise change the metric being read, making monitoring traffic misleadingly part of application traffic.

### C. Prevent high-cardinality labels

In Express, `/api/products/uuid-1` and `/api/products/uuid-2` are different URLs. Recording full URLs would create one time series per product.

Write:

```ts
export function getMetricRoute(baseUrl: string, routePath: unknown) {
  return typeof routePath === "string" ? `${baseUrl}${routePath}` : "unmatched";
}
```

`req.route?.path` provides a template such as `/:id`, not the real UUID. The final label becomes `/api/products/:id`. If Express did not match a route, record `unmatched` rather than an arbitrary path.

### D. Write the request middleware

In `src/middleware/request-logger.ts`, add middleware before routes:

```ts
const startedAt = performance.now();
const requestId = randomUUID();

res.locals.requestId = requestId;
res.setHeader("X-Request-Id", requestId);
```

- `performance.now()` is used to measure duration by subtracting start from end.
- `randomUUID()` creates one ID per request.
- `res.locals` is request-local storage that the error handler can read later.
- The header lets a client report the exact request ID when something goes wrong.

Record data when the response finishes, not before it starts:

```ts
res.on("finish", () => {
  const durationMs = Math.round(performance.now() - startedAt);
  const route = getMetricRoute(req.baseUrl, req.route?.path);

  recordHttpRequest(req.method, route, res.statusCode, durationMs);
  logger.info("http_request_completed", {
    requestId, method: req.method, path: route,
    statusCode: res.statusCode, durationMs,
  });
});
```

`finish` means Express has written the response. At that point the real status code and full duration are known. The same location writes the metric and log, so controllers do not need duplicate code.

### E. Build the structured logger

In `src/observability/logger.ts`, a small wrapper was enough:

```ts
function write(level, message, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...normalizedFields,
  };

  console[level](JSON.stringify(entry));
}
```

`normalize` converts a JavaScript `Error` to `name`, `message`, and `stack`. Without this, JSON often serializes an Error as an empty object. One JSON object per line is easy to search locally and to collect with Docker or a cloud log platform.

The central error handler logs unexpected errors:

```ts
logger.error("unhandled_request_error", { requestId, error });
```

`AppError` and validation failures are expected input errors, so the application returns an appropriate response without exposing a stack trace to the user.

### F. Add `/metrics` to Express

In `src/app.ts`, import `metricsRegistry` and add this route **before** `app.use("/api", router)`:

```ts
app.get("/metrics", async (_req, res) => {
  res.setHeader("Content-Type", metricsRegistry.contentType);
  res.status(200).send(await metricsRegistry.metrics());
});
```

`contentType` sets the Prometheus exposition format. `metrics()` collects text from every metric in the registry. The route is public as a practical local choice because the Prometheus service must read it; production commonly restricts it to an internal network or reverse proxy instead of exposing it publicly.

### G. Add Prometheus to Docker Compose

Add this service to `docker-compose.yml`:

```yaml
prometheus:
  image: prom/prometheus:v3.15.0
  ports:
    - "9090:9090"
  volumes:
    - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    - ./prometheus/rules:/etc/prometheus/rules:ro
    - prometheus_data:/prometheus
```

- `image`: the ready-to-run Prometheus program.
- `ports`: exposes its UI on Windows port 9090.
- First bind mount: configuration that declares scrape targets.
- Second bind mount: alert rules kept outside the image.
- `prometheus_data`: a named volume, so history survives container recreation.
- `:ro`: read-only; Prometheus must not modify project source files.

Then write `prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

rule_files:
  - /etc/prometheus/rules/*.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]

scrape_configs:
  - job_name: mini-erp-api
    metrics_path: /metrics
    static_configs:
      - targets: ["api:3000"]
```

`api` and `alertmanager` are Docker Compose service names. Compose provides internal DNS for those names on its default network.

### H. Write alert rules

In `prometheus/rules/mini-erp-alerts.yml`, write rules. For example:

```yaml
- alert: MiniErpApiDown
  expr: up{job="mini-erp-api"} == 0
  for: 1m
  labels:
    severity: critical
```

Prometheus creates `up` for every scrape target: it is 1 when scraping succeeds and 0 when it fails. `for: 1m` avoids alerting because of a short restart.

The error-rate rule uses:

```promql
sum(rate(mini_erp_http_request_duration_seconds_count{status_code=~"5.."}[5m]))
/ clamp_min(sum(rate(mini_erp_http_request_duration_seconds_count[5m])), 0.001)
> 0.05
```

The numerator is 5xx requests and the denominator is all requests, so the result is a ratio. `clamp_min` prevents division by zero when there is no traffic.

### I. Add Alertmanager and Mailpit

Add Alertmanager as a Compose service, mount its config file and volume, then write:

```yaml
global:
  smtp_smarthost: mailpit:1025
  smtp_from: alerts@mini-erp.local
  smtp_require_tls: false

receivers:
  - name: local-email
    email_configs:
      - to: developer@mini-erp.local
```

`mailpit:1025` works only inside Docker Compose. The Mailpit service captures SMTP and does not send public internet mail, so alerts can be tested safely. In production, replace it with a real SMTP provider or a Slack/PagerDuty receiver.

### J. Provision Grafana automatically

Instead of clicking through the UI and manually saving configuration, add a datasource provisioning file:

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    uid: prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

Then configure a dashboard provider to load JSON from `/var/lib/grafana/dashboards`. This means deleting and recreating a container still restores the datasource and dashboard from Git.

## 1. Why `console.log` is not enough

`console.log("server started")` is useful while learning, but it cannot answer operational questions:

- How many requests arrive per minute?
- What is the response time for the slowest 5% of requests?
- Is the API returning 500 errors?
- Is Redis or PostgreSQL unavailable?
- Did the problem begin one minute ago or one hour ago?

We need three related but different things:

| Tool | Main question | Example |
| --- | --- | --- |
| Logs | What happened in this specific request? | An error with a request ID and stack trace |
| Metrics | How is the system behaving over time? | p95 latency or request rate |
| Alerts | When should someone be notified? | API is down for more than one minute |

## 2. Structured logging

`src/observability/logger.ts` produces structured JSON logs rather than only free-form text:

```ts
logger.info("http_request_completed", {
  requestId,
  method: req.method,
  path: route,
  statusCode: res.statusCode,
  durationMs,
});
```

Example output:

```json
{
  "timestamp": "2026-10-14T12:00:00.000Z",
  "level": "info",
  "message": "http_request_completed",
  "requestId": "...",
  "method": "GET",
  "path": "/api/products",
  "statusCode": 200,
  "durationMs": 14
}
```

The `requestId` connects logs from the same request. The central error handler logs unexpected errors with that same ID and error details.

## 3. What is a metric?

A metric is a number that changes over time. Prometheus periodically pulls those numbers from `/metrics`; the application does not push them to Prometheus.

The project uses `@prometheus-io/client` in `src/observability/metrics.ts`.

### The HTTP histogram

```ts
new Histogram({
  name: "mini_erp_http_request_duration_seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});
```

It records every HTTP request duration in seconds. A histogram is more useful than a simple average because it records how many requests fall below timing boundaries. That lets us calculate p95 latency.

Labels let us ask questions such as: “How long do successful `GET /api/products` requests take?”

### Why not use a product ID as a metric label?

Recording `/api/products/123` and `/api/products/456` as distinct labels creates a new time series for every ID. This is high cardinality and can consume Prometheus resources quickly.

The middleware therefore records route templates such as `/api/products/:id`, not real UUIDs or query strings. `/metrics` is excluded so Prometheus does not measure its own scrape traffic.

## 4. The `/metrics` endpoint

`src/app.ts` exposes the registry:

```ts
app.get("/metrics", async (_req, res) => {
  res.setHeader("Content-Type", metricsRegistry.contentType);
  res.status(200).send(await metricsRegistry.metrics());
});
```

Open `http://localhost:3000/metrics`. It returns Prometheus text format with the HTTP histogram and default Node.js metrics such as memory and event-loop lag.

This endpoint is not a UI for users. It is a contract between this application and Prometheus.

## 5. Health and readiness are not metrics

- `GET /health`: the API process is alive.
- `GET /health/ready`: the API can also reach dependencies such as PostgreSQL and Redis.
- `GET /metrics`: numbers that can be queried, graphed, and alerted on.

For example, the process may be alive (`/health` returns 200) while PostgreSQL is unavailable. Readiness should fail in that case; metrics then help explain the effect on latency and errors.

## 6. Prometheus: who collects the numbers?

`prometheus/prometheus.yml` configures Prometheus to scrape the API:

```yaml
scrape_configs:
  - job_name: mini-erp-api
    metrics_path: /metrics
    static_configs:
      - targets: ["api:3000"]
```

Inside Docker Compose, `api` is the service name. Prometheus uses that name over the Compose network; it must not use `localhost:3000`, because localhost inside a container means that same container.

Prometheus scrapes every 15 seconds and stores collected data in the `prometheus_data` volume.

Try this query in the Prometheus UI at `http://localhost:9090`:

```promql
sum(rate(mini_erp_http_request_duration_seconds_count[5m]))
```

It shows requests per second during the last five minutes.

## 7. Grafana: who draws the data?

Grafana does not collect metrics from the API. It queries Prometheus and draws dashboards.

Provisioning files make the local setup repeatable:

- `grafana/provisioning/datasources/prometheus.yml` connects Grafana to `http://prometheus:9090`.
- `grafana/provisioning/dashboards/dashboards.yml` loads dashboards from files.
- `grafana/dashboards/mini-erp-overview.json` defines the project dashboard.

The dashboard shows:

- Request rate.
- p95 latency.
- Process resident memory.
- Node.js event-loop lag.

### What does p95 mean?

If p95 is 0.8 seconds, then 95% of requests completed in 0.8 seconds or less; only 5% were slower. It is often more valuable than an average, because averages can look healthy while some users experience long waits.

The query is:

```promql
histogram_quantile(
  0.95,
  sum by (le) (rate(mini_erp_http_request_duration_seconds_bucket[5m]))
)
```

## 8. Alert rules: when does an observation become an alert?

`prometheus/rules/mini-erp-alerts.yml` defines three rules:

| Alert | Condition | Duration | Meaning |
| --- | --- | --- | --- |
| `MiniErpApiDown` | `up == 0` | 1 minute | Prometheus cannot scrape the API |
| `MiniErpHighP95Latency` | p95 is over 1 second | 5 minutes | Slowness is sustained, not a short spike |
| `MiniErpHighServerErrorRate` | 5xx rate is over 5% | 5 minutes | Server-error percentage is high |

`for: 5m` matters: before five minutes, an alert is **pending**. It becomes **firing** only if the condition remains true. This avoids noisy alerts for short spikes.

## 9. Alertmanager: where do alerts go?

Prometheus decides that an alert is firing, then sends it to Alertmanager. `alertmanager/alertmanager.yml` groups similar alerts and sends local email to Mailpit.

Mailpit is a safe SMTP substitute for learning:

```text
API metrics -> Prometheus rules -> Alertmanager -> Mailpit inbox
```

Open `http://localhost:8025` to view email. Nothing is sent to the public internet.

## 10. Full flow

```text
Browser / API client
        |
        v
Express request middleware
  |                     |
  | JSON log            | histogram observation
  v                     v
stdout logs          /metrics endpoint
                            |
                            v
                      Prometheus (every 15s)
                       |              |
                       v              v
                   Grafana UI      alert rules
                                        |
                                        v
                                  Alertmanager
                                        |
                                        v
                                  Mailpit email
```

## 11. Safe local experiment

After `docker compose up -d --build`:

1. Send several requests from Swagger.
2. Open Grafana and inspect the dashboard.
3. Open Prometheus and run the request-rate query.
4. To demonstrate the API-down alert, temporarily run `docker compose stop api`.
5. Wait a little more than one minute, then check Alertmanager or Mailpit.
6. Restore the API with `docker compose start api`.

Do not perform this experiment on production. It exists only to understand the local flow.

## 12. What should be measured later?

Do not add one hundred random metrics. Add a metric when you have a real operational question, for example:

- BullMQ queue length and failed-job count.
- Delayed outbox events and dead-letter count.
- Slow Prisma-query timing, carefully, without user IDs as labels.
- Business metrics: confirmed orders or low-stock products.

The useful rule is: **logs explain an incident, metrics reveal a trend, and alerts call attention when the trend needs action.**
