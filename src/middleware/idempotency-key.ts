import type { NextFunction, Request, Response } from "express";

export function requireIdempotencyKey(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const key = req.header("Idempotency-Key")?.trim();

  if (!key || key.length > 255) {
    res.status(400).json({
      error: "Idempotency-Key header is required and must be 255 characters or fewer",
    });
    return;
  }

  res.locals.idempotencyKey = key;
  next();
}
