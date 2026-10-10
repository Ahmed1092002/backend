import { env } from "../config/env.js";

const redisUrl = new URL(env.redisUrl);

export const queueConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
};
