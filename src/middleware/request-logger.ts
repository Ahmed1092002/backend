import type { NextFunction, Request, Response } from "express";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startedAt = performance.now();
  const url = req.originalUrl;

  res.on("finish", () => {
    const durationMs = Math.round(performance.now() - startedAt);
    console.log(`${req.method} ${url} -> ${res.statusCode} (${durationMs} ms)`);
  });

  next();
}
