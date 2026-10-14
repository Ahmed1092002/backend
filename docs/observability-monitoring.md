# Metrics, Monitoring, Logging, and Alerts

هذا المستند يشرح ما أضفناه من لحظة إضافة **metrics** إلى تشغيل monitoring stack كامل. الهدف أن تعرف: هل الـAPI شغال؟ هل بطيء؟ هل فيه errors؟ وماذا نفعل عندما تظهر المشكلة؟

## قبل البدء: ما الذي أضفناه فعلياً؟

### داخل كود الـAPI

| الملف | ما أضفناه فيه | وظيفته |
| --- | --- | --- |
| `src/observability/logger.ts` | `logger.info/warn/error` | يطبع JSON logs منظمة |
| `src/observability/metrics.ts` | Prometheus Registry وHTTP Histogram | يحوّل زمن كل request إلى metric |
| `src/middleware/request-logger.ts` | request ID، log، و`recordHttpRequest` | يسجل كل request بعد انتهائه |
| `src/middleware/error-handler.ts` | structured error log | يسجل الأخطاء غير المتوقعة مع request ID |
| `src/app.ts` | `GET /metrics` | يعرّض metrics بصيغة يفهمها Prometheus |

أضفنا أيضاً package اسمها `@prometheus-io/client` في `package.json`. هي التي تنشئ الـmetrics بصيغة Prometheus؛ لا يوجد فيها server ولا dashboard.

### بجانب كود الـAPI

| المكان | دوره |
| --- | --- |
| `prometheus/prometheus.yml` | يقول لـPrometheus أين يقرأ `/metrics` ومتى |
| `prometheus/rules/mini-erp-alerts.yml` | شروط الـalerts: API down، latency، و5xx rate |
| `alertmanager/alertmanager.yml` | يستقبل alerts ويرسلها إلى Mailpit محلياً |
| `grafana/provisioning/` | يربط Grafana بـPrometheus تلقائياً |
| `grafana/dashboards/mini-erp-overview.json` | dashboard جاهز للـAPI |
| `docker-compose.yml` | يشغّل Prometheus وGrafana وAlertmanager وMailpit كخدمات |

## خطوات الإضافة والتشغيل، بالترتيب

### الخطوة 1: التطبيق يسجل metric

بعد انتهاء أي request، `request-logger` يعرف الـroute والـstatus code والمدة، ثم ينادي `recordHttpRequest`:

```ts
recordHttpRequest(req.method, route, res.statusCode, durationMs);
```

الدالة تضيف observation للـHistogram. هذا لا يرسل أي شيء إلى Prometheus الآن؛ هو فقط يحتفظ بالرقم داخل ذاكرة الـAPI process.

### الخطوة 2: التطبيق يعرض الأرقام

عند طلب `GET /metrics`، Express يقرأ الـregistry في الذاكرة ويرجع النص. لذلك جرّب أولاً:

```powershell
curl http://localhost:3000/metrics
```

أو افتح الرابط في المتصفح. يجب أن ترى أسماء تبدأ بـ`mini_erp_`.

### الخطوة 3: Prometheus يسحب `/metrics`

في `prometheus.yml` أضفنا target اسمه `api:3000`:

```yaml
scrape_configs:
  - job_name: mini-erp-api
    metrics_path: /metrics
    static_configs:
      - targets: ["api:3000"]
```

كل 15 ثانية Prometheus يطلب `http://api:3000/metrics` **من داخل شبكة Docker** ويخزن النتائج. لا نستعمل `localhost` هنا، لأن `localhost` داخل container يعني نفس الـcontainer وليس الـAPI.

### الخطوة 4: Grafana تقرأ من Prometheus

Grafana datasource موجود في provisioning file، لذلك عند تشغيل container لا تحتاج أن تضيف Prometheus يدوياً من الـUI. Grafana تسأل Prometheus عن أرقام request rate وp95 وغيرها، ثم تعرضها في dashboard.

### الخطوة 5: Prometheus يقيّم rules

Prometheus يقرأ ملفات rules كل فترة. إذا ظل شرط alert صحيحاً للمدة الموجودة في `for`، يرسل alert إلى Alertmanager. مثال: `MiniErpApiDown` لا يعمل firing إلا لو الـAPI غير قابل للوصول لمدة دقيقة كاملة.

### الخطوة 6: Alertmanager يرسل notification

Alertmanager يستقبل alert، يجمع alerts المتشابهة، ثم يرسل email إلى Mailpit عبر `mailpit:1025`. Mailpit يعرض هذا البريد في `http://localhost:8025`.

## تشغيل وتجربة كل شيء من الصفر

1. تأكد أن Docker Desktop يعمل.
2. من root المشروع شغّل:

   ```powershell
   docker compose up -d --build
   ```

3. تأكد أن الخدمات تعمل:

   ```powershell
   docker compose ps
   ```

   ابحث عن `api` و`prometheus` و`grafana` و`alertmanager`.

4. ولّد traffic للـAPI: افتح Swagger على `http://localhost:3000/api-docs` ونفّذ أي GET endpoint عدة مرات.
5. تحقق من metric المصدر: `http://localhost:3000/metrics`.
6. افتح Prometheus على `http://localhost:9090`، ومن صفحة **Status → Targets** تأكد أن `mini-erp-api` حالته **UP**.
7. جرّب query مثل:

   ```promql
   sum(rate(mini_erp_http_request_duration_seconds_count[5m]))
   ```

8. افتح Grafana على `http://localhost:3001`، سجّل الدخول محلياً، ثم افتح dashboard **Mini ERP / Mini ERP API Overview**.
9. افتح Alertmanager على `http://localhost:9093` وMailpit على `http://localhost:8025` عندما تريد رؤية alerts والبريد المحلي.

### لو عدّلت الإعدادات لاحقاً

- غيّرت TypeScript أو dependency أو Dockerfile: `docker compose up -d --build`.
- غيّرت فقط `docker-compose.yml`: `docker compose up -d`.
- غيّرت `prometheus.yml` أو alert rules: أعد تشغيل Prometheus:

  ```powershell
  docker compose restart prometheus
  ```

- غيّرت Grafana provisioning/dashboard files: أعد تشغيل Grafana:

  ```powershell
  docker compose restart grafana
  ```

## كيف كتبناها فعلياً: ملفاً بملف

هذا القسم هو recipe إعادة بناء نفس الـobservability من الصفر، وليس مجرد وصف للنتيجة.

### A. تثبيت مكتبة metrics

أولاً أضفنا client Prometheus:

```powershell
npm install @prometheus-io/client
```

اخترناها لأنها تعطي TypeScript objects مثل `Registry` و`Histogram` وتحوّلها للنص الذي يفهمه Prometheus. لم نضف Prometheus كـnpm package؛ Prometheus نفسه service مستقل في Docker.

### B. إنشاء Registry والـHTTP Histogram

أنشأنا `src/observability/metrics.ts`:

```ts
import { Histogram, Registry, collectDefaultMetrics } from "@prometheus-io/client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({
  register: metricsRegistry,
  prefix: "mini_erp_",
});
```

- `Registry` هو container لكل metrics الخاصة بتطبيقنا.
- `collectDefaultMetrics` يضيف metrics جاهزة عن Node.js: memory وCPU وevent-loop lag وgarbage collection.
- `prefix` يمنع تضارب أسماء metrics لو Prometheus يجمع أكثر من application.

بعدها عرّفنا metric للـHTTP time:

```ts
const httpRequestDuration = new Histogram({
  name: "mini_erp_http_request_duration_seconds",
  help: "HTTP request duration in seconds.",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});
```

- الاسم يجب أن يكون ثابتاً ولا يتغير بعد النشر؛ لهذا سميناه بوحدة القياس `_seconds`.
- `help` شرح يظهر في `/metrics`.
- `labels` تقسّم نفس metric حسب method وroute وstatus. مثلاً GET products 200 غير POST orders 500.
- `buckets` حدود زمنية. request استغرق 120ms يدخل في حدود 250ms وما فوق؛ من هذه الحدود نحسب p95.
- `registers` يربط الـHistogram بالـregistry الذي سيظهر في `/metrics`.

ثم كتبنا function صغيرة هي فقط التي يستدعيها middleware:

```ts
export function recordHttpRequest(method, route, statusCode, durationMs) {
  if (route === "/metrics") return;

  httpRequestDuration.observe(
    { method, route, status_code: String(statusCode) },
    durationMs / 1_000,
  );
}
```

نحوّل milliseconds إلى seconds لأن اسم metric ووحدته seconds. واستبعدنا `/metrics`: كل scrape من Prometheus كان سيزيد metric الذي يحاول قراءته، فيصبح traffic المراقبة جزءاً مضللاً من traffic التطبيق.

### C. منع high-cardinality labels

المشكلة التالية: في Express، `/api/products/uuid-1` و`/api/products/uuid-2` URLs مختلفة. لو سجلنا الـURL كاملاً، أنشأنا series جديدة لكل product.

لذلك كتبنا:

```ts
export function getMetricRoute(baseUrl: string, routePath: unknown) {
  return typeof routePath === "string" ? `${baseUrl}${routePath}` : "unmatched";
}
```

`req.route?.path` يعطينا template مثل `/:id` وليس قيمة UUID الحقيقية. النتيجة تصبح `/api/products/:id`. ولو لم يجد Express route، نسجل `unmatched` بدلاً من path عشوائي.

### D. كتابة request middleware

في `src/middleware/request-logger.ts` كتبنا middleware قبل الـroutes:

```ts
const startedAt = performance.now();
const requestId = randomUUID();

res.locals.requestId = requestId;
res.setHeader("X-Request-Id", requestId);
```

- `performance.now()` مناسب لقياس duration؛ نطرح البداية من النهاية.
- `randomUUID()` ينشئ ID لكل request.
- `res.locals` storage مؤقت للـrequest الحالي، حتى يقرأه error handler لاحقاً.
- header يجعل الـclient يستطيع إرسال الـrequest ID عند إبلاغك بمشكلة.

بعدها سجلنا عند نهاية response، وليس قبلها:

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

`finish` يعني أن Express انتهى من كتابة response؛ عند هذه اللحظة نعرف الـstatus الحقيقي والـduration الحقيقي. نفس المكان يصنع metric ويكتب log، لذلك لا يوجد كود متكرر داخل كل controller.

### E. بناء structured logger

في `src/observability/logger.ts` لم نستعمل library كبيرة؛ كتبنا wrapper صغيراً:

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

الـ`normalize` يحوّل JavaScript `Error` إلى `name` و`message` و`stack`. بدون ذلك غالباً JSON يخرج Error فارغاً. استخدام JSON line واحدة يجعل Docker logs وcloud logging systems تستطيع search/filter بالحقول.

ثم في `error-handler` نسجل فقط الأخطاء غير المتوقعة كـerror:

```ts
logger.error("unhandled_request_error", { requestId, error });
```

أما `AppError` وvalidation errors فهي أخطاء متوقعة من input، لذلك نرجع response مناسباً من دون stack trace للمستخدم.

### F. إضافة `/metrics` إلى Express

في `src/app.ts` استوردنا `metricsRegistry` وكتبنا route **قبل** `app.use("/api", router)`:

```ts
app.get("/metrics", async (_req, res) => {
  res.setHeader("Content-Type", metricsRegistry.contentType);
  res.status(200).send(await metricsRegistry.metrics());
});
```

`contentType` يضبط Prometheus exposition format الصحيح. و`metrics()` يجمع النص من كل metric في registry. وضعه route عام بدون authentication قرار عملي لأن Prometheus service داخل الشبكة يحتاج أن يقرأه؛ في production يمكن تقييده بشبكة داخلية أو reverse proxy بدلاً من كشفه للإنترنت.

### G. إضافة Prometheus إلى Docker Compose

في `docker-compose.yml` أضفنا service:

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

- `image`: برنامج Prometheus الجاهز.
- `ports`: للوصول للـUI من Windows على port 9090.
- أول bind mount: config الذي يحدد targets.
- ثاني bind mount: alert rules بدون وضعها داخل image.
- `prometheus_data`: named volume، حتى لا تضيع history عندما نعيد إنشاء container.
- `:ro` يعني read-only؛ Prometheus لا يجب أن يعدّل ملفات source عندنا.

ثم كتبنا `prometheus/prometheus.yml`:

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

`api` و`alertmanager` هما service names؛ Docker Compose يوفّر DNS داخلياً لهما تلقائياً على الشبكة الافتراضية.

### H. كتابة alert rules

في `prometheus/rules/mini-erp-alerts.yml` كتبنا rules. مثال API down:

```yaml
- alert: MiniErpApiDown
  expr: up{job="mini-erp-api"} == 0
  for: 1m
  labels:
    severity: critical
```

metric `up` ينشئها Prometheus لكل target؛ قيمتها 1 لو scrape نجح و0 لو فشل. `for: 1m` يمنع alert بسبب restart قصير.

قاعدة error rate تستخدم:

```promql
sum(rate(mini_erp_http_request_duration_seconds_count{status_code=~"5.."}[5m]))
/ clamp_min(sum(rate(mini_erp_http_request_duration_seconds_count[5m])), 0.001)
> 0.05
```

البسط requests التي انتهت بـ5xx، والمقام كل requests، لذلك الناتج نسبة. `clamp_min` يمنع القسمة على صفر عندما لا يوجد traffic.

### I. إضافة Alertmanager وMailpit

أضفنا Alertmanager كـservice، وربطناه بـconfig file وvolume للبيانات. ثم كتبنا:

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

`mailpit:1025` يعمل فقط داخل Docker Compose. Mailpit service يلتقط SMTP ولا يرسل رسالة إلى الإنترنت؛ لهذا نستطيع تجربة alerts بأمان. في production نستبدل هذه البيانات بـSMTP provider حقيقي أو Slack/PagerDuty receiver.

### J. إعداد Grafana تلقائياً

بدلاً من الضغط في UI وحفظ settings يدوياً، أضفنا datasource provisioning:

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

وبعدها dashboard provider يقرأ JSON من `/var/lib/grafana/dashboards`. لهذا عندما يحذف شخص container ثم يشغله ثانية، datasource والdashboard يعودان من Git تلقائياً.

## 1. لماذا لا تكفي `console.log`؟

`console.log("server started")` مفيد أثناء التعلم، لكنه لا يجيب عن أسئلة تشغيل حقيقية:

- كم request يدخل في الدقيقة؟
- ما زمن الاستجابة في الـ95% الأبطأ من الطلبات؟
- هل الـAPI بدأ يرجّع 500؟
- هل Redis أو PostgreSQL غير متاحين؟
- هل المشكلة حدثت قبل دقيقة أم منذ ساعة؟

نحتاج ثلاثة أشياء مختلفة، وليست بدائل لبعضها:

| الشيء | يجيب عن | مثال |
| --- | --- | --- |
| Logs | ماذا حدث في request معيّن؟ | error ومعه request ID وstack trace |
| Metrics | هل النظام جيد بصورة رقمية مع الزمن؟ | p95 latency أو request rate |
| Alerts | متى يجب أن أنتبه؟ | API down لأكثر من دقيقة |

## 2. Structured logging

أضفنا `src/observability/logger.ts`. بدلاً من كتابة جملة نصية فقط، كل log يخرج JSON منظماً:

```ts
logger.info("http_request_completed", {
  requestId,
  method: req.method,
  path: route,
  statusCode: res.statusCode,
  durationMs,
});
```

مثال ناتج تقريبي:

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

الـ`requestId` يربط logs الخاصة بنفس request. لو حدث unhandled error، `error-handler` يطبع نفس الـID مع تفاصيل الخطأ.

## 3. ما هي metric؟

Metric رقم يتغير مع الزمن. Prometheus يأتي كل فترة ويسحب هذه الأرقام من `/metrics`، بدلاً من أن يرسل التطبيق البيانات إليه.

أضفنا الحزمة `@prometheus-io/client` في `src/observability/metrics.ts`.

### الـHistogram الذي أضفناه

```ts
new Histogram({
  name: "mini_erp_http_request_duration_seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});
```

هذا يسجل مدة كل HTTP request بالثواني. الـHistogram ليس مجرد average؛ يحتفظ بعدد الطلبات التي وقعت تحت حدود زمنية معينة. لهذا نستطيع حساب p95 لاحقاً.

الـlabels تجعلنا نسأل أسئلة مثل: “كم مدة `GET /api/products` التي انتهت بـ200؟”

### لماذا لا نضع product ID في `route`؟

لو سجّلنا `/api/products/123` ثم `/api/products/456`، سننشئ metric time series لكل ID. هذا اسمه **high cardinality** ويمكن أن يستهلك Prometheus بسرعة.

لذلك middleware يسجل الـroute template مثل `/api/products/:id`، ولا يسجل query string أو UUID فعلي. `/metrics` نفسه مستثنى حتى لا يصنع Prometheus traffic خاصاً به داخل metric.

## 4. Endpoint `/metrics`

في `src/app.ts` أضفنا:

```ts
app.get("/metrics", async (_req, res) => {
  res.setHeader("Content-Type", metricsRegistry.contentType);
  res.status(200).send(await metricsRegistry.metrics());
});
```

افتح `http://localhost:3000/metrics`. ستجد نص Prometheus، مثل counters وhistogram buckets، ومعها default Node.js metrics مثل الذاكرة وevent-loop lag.

هذا endpoint ليس صفحة UI للمستخدم؛ هو عقد بين تطبيقنا وPrometheus.

## 5. Health وReadiness ليسا Metrics

- `GET /health`: يجيب أن عملية الـAPI حية.
- `GET /health/ready`: يتحقق أيضاً من dependencies مثل PostgreSQL وRedis.
- `GET /metrics`: أرقام قابلة للقياس والرسم والتنبيه.

مثال: الـprocess قد يكون حيًا (`/health` = 200) لكن PostgreSQL متوقف؛ هنا readiness يجب أن يفشل، بينما metrics تساعدك في فهم أثر المشكلة على latency/errors.

## 6. Prometheus: من يجمع الأرقام؟

الملف `prometheus/prometheus.yml` يطلب من Prometheus أن يسحب:

```yaml
scrape_configs:
  - job_name: mini-erp-api
    metrics_path: /metrics
    static_configs:
      - targets: ["api:3000"]
```

داخل Docker Compose، `api` هو اسم service، لذلك Prometheus يصل له عبر شبكة Docker الافتراضية. لا نكتب `localhost:3000` لأن `localhost` داخل container يعني الـcontainer نفسه.

Prometheus يسحب كل 15 ثانية، ويخزن النتائج في volume اسمه `prometheus_data`.

جرّب من واجهة Prometheus `http://localhost:9090` هذا الاستعلام:

```promql
sum(rate(mini_erp_http_request_duration_seconds_count[5m]))
```

يعرض عدد requests في الثانية خلال آخر 5 دقائق.

## 7. Grafana: من يرسم الأرقام؟

Grafana لا يجمع metrics من الـAPI. هو يسأل Prometheus ثم يرسم dashboard.

جهزنا provisioning files حتى لا نضبط datasource والdashboard يدوياً كل مرة:

- `grafana/provisioning/datasources/prometheus.yml`: يربط Grafana بـ`http://prometheus:9090`.
- `grafana/provisioning/dashboards/dashboards.yml`: يقرأ dashboards من الملفات.
- `grafana/dashboards/mini-erp-overview.json`: dashboard المشروع.

الـdashboard يعرض:

- Request rate.
- p95 latency.
- Process resident memory.
- Node.js event-loop lag.

### ما معنى p95؟

لو p95 = 0.8 ثانية، فهذا يعني أن 95% من requests انتهت في 0.8 ثانية أو أقل، و5% فقط أبطأ. هذا غالباً أهم من average؛ لأن average قد يبدو جيداً رغم أن بعض المستخدمين ينتظرون كثيراً.

الاستعلام المستخدم هو:

```promql
histogram_quantile(
  0.95,
  sum by (le) (rate(mini_erp_http_request_duration_seconds_bucket[5m]))
)
```

## 8. Alert rules: متى تتحول الملاحظة إلى إنذار؟

الملف `prometheus/rules/mini-erp-alerts.yml` فيه 3 rules:

| Alert | الشرط | المدة | المعنى |
| --- | --- | --- | --- |
| `MiniErpApiDown` | `up == 0` | دقيقة | Prometheus لا يستطيع scrape الـAPI |
| `MiniErpHighP95Latency` | p95 أكبر من ثانية | 5 دقائق | البطء مستمر، وليس spike عابر |
| `MiniErpHighServerErrorRate` | 5xx أكبر من 5% | 5 دقائق | نسبة أخطاء السيرفر مرتفعة |

`for: 5m` مهم: قبل خمس دقائق يكون alert في حالة **pending**؛ لو بقي الشرط صحيحاً يصير **firing**. هذا يمنع إشعاراً مزعجاً بسبب مشكلة لثوانٍ فقط.

## 9. Alertmanager: أين يذهب الإنذار؟

Prometheus يقرر أن alert firing، ثم يرسله إلى Alertmanager. ملف `alertmanager/alertmanager.yml` يجمّع alerts المتشابهة ويرسل email محلياً إلى Mailpit.

في هذا المشروع، Mailpit بديل SMTP آمن للتعلم:

```text
API metrics -> Prometheus rules -> Alertmanager -> Mailpit inbox
```

افتح `http://localhost:8025` لرؤية البريد، وليس بريداً حقيقياً على الإنترنت.

## 10. Flow كامل

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

## 11. تجربة عملية آمنة محلياً

بعد `docker compose up -d --build`:

1. افتح Swagger وأرسل عدة requests.
2. افتح Grafana وانظر للdashboard.
3. افتح Prometheus واستعلم عن request rate.
4. لإثبات API-down alert، أوقف الـAPI مؤقتاً: `docker compose stop api`.
5. انتظر أكثر قليلاً من دقيقة، ثم راقب Alertmanager أو Mailpit.
6. أعده: `docker compose start api`.

لا تعمل هذه التجربة على production بهذه الطريقة؛ هي فقط لفهم الـflow محلياً.

## 12. ما الذي نراقبه لاحقاً؟

الخطوة التالية المنطقية ليست إضافة 100 metric عشوائياً. أضف metrics عندما يكون لديك سؤال تشغيلي حقيقي، مثلاً:

- طول BullMQ queues وعدد jobs الفاشلة.
- عدد outbox events المتأخرة أو الموجودة في dead letter.
- زمن Prisma queries البطيئة بحذر ومن دون وضع user IDs كـlabels.
- business metrics: عدد orders المؤكدة أو عدد المنتجات low stock.

قاعدة مهمة: **Logs تشرح حادثة، metrics تكشف الاتجاه، alerts تناديك عندما يحتاج الاتجاه انتباهاً.**
