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
};
