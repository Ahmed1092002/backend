type HttpMetric = {
  count: number;
  durationSecondsSum: number;
};

const httpMetrics = new Map<string, HttpMetric>();

function metricKey(method: string, route: string, statusCode: number) {
  return `${method}\u0000${route}\u0000${statusCode}`;
}

function escapeLabel(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationMs: number,
) {
  // Do not track the scraper itself, otherwise every Prometheus scrape changes
  // the metric it is reading.
  if (route === "/metrics") return;

  const key = metricKey(method, route, statusCode);
  const metric = httpMetrics.get(key) ?? { count: 0, durationSecondsSum: 0 };
  metric.count += 1;
  metric.durationSecondsSum += durationMs / 1_000;
  httpMetrics.set(key, metric);
}

export function getMetricRoute(baseUrl: string, routePath: unknown) {
  // Use Express's route pattern (for example /orders/:id), not a real ID or
  // query string. Dynamic values would create unlimited metric labels.
  return typeof routePath === "string" ? `${baseUrl}${routePath}` : "unmatched";
}

export function renderPrometheusMetrics() {
  const lines = [
    "# HELP http_requests_total Total completed HTTP requests.",
    "# TYPE http_requests_total counter",
    "# HELP http_request_duration_seconds HTTP request duration in seconds.",
    "# TYPE http_request_duration_seconds summary",
  ];

  for (const [key, metric] of httpMetrics) {
    const [method, route, statusCode] = key.split("\u0000");
    const labels = `method="${escapeLabel(method ?? "")}",route="${escapeLabel(route ?? "")}",status_code="${escapeLabel(statusCode ?? "")}"`;
    lines.push(`http_requests_total{${labels}} ${metric.count}`);
    lines.push(
      `http_request_duration_seconds_sum{${labels}} ${metric.durationSecondsSum}`,
    );
    lines.push(`http_request_duration_seconds_count{${labels}} ${metric.count}`);
  }

  return `${lines.join("\n")}\n`;
}
