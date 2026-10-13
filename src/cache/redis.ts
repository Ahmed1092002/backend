import { createClient } from "redis";
import { env } from "../config/env.js";
import { logger } from "../observability/logger.js";

const redis = createClient({ url: env.redisUrl });
redis.on("error", (error) => logger.error("redis_client_error", { error }));

async function getClient() {
  if (!redis.isOpen) await redis.connect();
  return redis;
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const value = await (await getClient()).get(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch (error) {
    logger.warn("redis_cache_read_failed", { key, error });
    return null;
  }
}

export async function setCache(key: string, value: unknown, seconds: number) {
  try { await (await getClient()).setEx(key, seconds, JSON.stringify(value)); } catch (error) { logger.warn("redis_cache_write_failed", { key, error }); }
}
export async function deleteCache(key: string) {
  try { await (await getClient()).del(key); } catch (error) { logger.warn("redis_cache_delete_failed", { key, error }); }
}

export async function clearCache() {
  try { await (await getClient()).flushDb(); } catch (error) { logger.warn("redis_cache_clear_failed", { error }); }
}

export async function clearProductCache() {
  try {
    const client = await getClient();
    for await (const key of client.scanIterator({ MATCH: "products:*" })) await client.del(key);
  } catch (error) {
    logger.warn("redis_product_cache_clear_failed", { error });
  }
}
