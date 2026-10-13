import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { logger } from "../observability/logger.js";
import { getMetricRoute, recordHttpRequest } from "../observability/metrics.js";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startedAt = performance.now();
  const requestId = randomUUID();

  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const durationMs = Math.round(performance.now() - startedAt);
    const route = getMetricRoute(req.baseUrl, req.route?.path);
    recordHttpRequest(req.method, route, res.statusCode, durationMs);
    logger.info("http_request_completed", {
      requestId,
      method: req.method,
      path: route,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
}
