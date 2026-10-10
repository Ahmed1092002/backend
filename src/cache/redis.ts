import { createClient } from "redis";
import { env } from "../config/env.js";

const redis = createClient({ url: env.redisUrl });
redis.on("error", (error) => console.error("Redis error", error));

async function getClient() {
  if (!redis.isOpen) await redis.connect();
  return redis;
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const value = await (await getClient()).get(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch (error) {
    console.warn("Redis cache read failed", { key, error });
    return null;
  }
}

export async function setCache(key: string, value: unknown, seconds: number) {
  try { await (await getClient()).setEx(key, seconds, JSON.stringify(value)); } catch (error) { console.warn("Redis cache write failed", { key, error }); }
}
export async function deleteCache(key: string) {
  try { await (await getClient()).del(key); } catch (error) { console.warn("Redis cache delete failed", { key, error }); }
}

export async function clearCache() {
  try { await (await getClient()).flushDb(); } catch (error) { console.warn("Redis cache clear failed", { error }); }
}

export async function clearProductCache() {
  try {
    const client = await getClient();
    for await (const key of client.scanIterator({ MATCH: "products:*" })) await client.del(key);
  } catch (error) {
    console.warn("Redis product-cache clear failed", { error });
  }
}
