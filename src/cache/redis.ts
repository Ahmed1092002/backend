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
  } catch {
    return null;
  }
}

export async function setCache(key: string, value: unknown, seconds: number) {
  try { await (await getClient()).setEx(key, seconds, JSON.stringify(value)); } catch {}
}
export async function deleteCache(key: string) {
  try { await (await getClient()).del(key); } catch {}
}

export async function clearCache() {
  try { await (await getClient()).flushDb(); } catch {}
}

export async function clearProductCache() {
  try {
    const client = await getClient();
    for await (const key of client.scanIterator({ MATCH: "products:*" })) await client.del(key);
  } catch {} 
}
