import { rateLimit } from "express-rate-limit";

type RateLimitOptions = {
  windowMs: number;
  limit: number;
  message: string;
};

export function createRateLimiter(options: RateLimitOptions) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: options.message },
  });
}
