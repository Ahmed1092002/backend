import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startedAt = performance.now();
  const url = req.originalUrl;
  const requestId = randomUUID();

  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const durationMs = Math.round(performance.now() - startedAt);
    console.log(
      `[${requestId}] ${req.method} ${url} -> ${res.statusCode} (${durationMs} ms)`,
    );
  });

  next();
}
