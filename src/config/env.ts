import "dotenv/config";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET is required");
}

export const env = {
  jwtSecret,
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  isProduction: process.env.NODE_ENV === "production",
  mailHost: process.env.MAIL_HOST ?? "localhost",
  mailPort: Number(process.env.MAIL_PORT ?? 1025),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  lowStockThreshold: Number(process.env.LOW_STOCK_THRESHOLD ?? 5),
  // A display label used only to make load-balancing visible in this lab.
  instanceName: process.env.INSTANCE_NAME ?? "local",
};
