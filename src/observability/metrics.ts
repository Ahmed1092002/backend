import {
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "@prometheus-io/client";

export const metricsRegistry = new Registry();

// Node.js process metrics: memory, CPU, event-loop lag, garbage collection,
// active handles, and more. Prometheus collects them whenever it scrapes.
collectDefaultMetrics({
  register: metricsRegistry,
  prefix: "mini_erp_",
});

const httpRequestDuration = new Histogram<
  "method" | "route" | "status_code"
>({
  name: "mini_erp_http_request_duration_seconds",
  help: "HTTP request duration in seconds.",
  labelNames: ["method", "route", "status_code"],
  // Useful API latency thresholds: 50 ms through 5 seconds.
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationMs: number,
) {
  // Do not track the scraper itself, otherwise every Prometheus scrape changes
  // the metric it is reading.
  if (route === "/metrics") return;

  httpRequestDuration.observe(
    { method, route, status_code: String(statusCode) },
    durationMs / 1_000,
  );
}

export function getMetricRoute(baseUrl: string, routePath: unknown) {
  // Use Express's route pattern (for example /orders/:id), not a real ID or
  // query string. Dynamic values would create unlimited metric labels.
  return typeof routePath === "string" ? `${baseUrl}${routePath}` : "unmatched";
}

