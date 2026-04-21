/**
 * KV-backed stale cache for Cloudflare Workers.
 *
 * Two keys per cache entry:
 *   f:{key}  - fresh, expires at the configured TTL
 *   s:{key}  - stale backup, expires after 7 days
 *
 * On a fresh miss the fetcher is called, and both keys are written.
 * If the fetcher fails (e.g. rate-limited), the stale key is served
 * so an error SVG is never shown to an end-user.
 *
 * Because KV is eventually consistent and globally distributed, this
 * cache is shared across all Worker isolates worldwide - a key property
 * missing from the previous in-process Map approach.
 */

import type { Env } from "../types/env.js";

export interface CacheResult<T> {
  value: T;
  isStale: boolean;
}

const STALE_TTL_SEC = 7 * 24 * 3600; // 7 days

export async function getOrFetch<T>(
  env: Env,
  key: string,
  ttlSec: number,
  fetcher: () => Promise<T>,
): Promise<CacheResult<T>> {
  const fresh = await env.CACHE_KV.get<T>(`f:${key}`, "json");
  if (fresh !== null) return { value: fresh, isStale: false };

  try {
    const value = await fetcher();
    await Promise.all([
      env.CACHE_KV.put(`f:${key}`, JSON.stringify(value), { expirationTtl: ttlSec }),
      env.CACHE_KV.put(`s:${key}`, JSON.stringify(value), { expirationTtl: STALE_TTL_SEC }),
    ]);
    return { value, isStale: false };
  } catch (err) {
    const stale = await env.CACHE_KV.get<T>(`s:${key}`, "json");
    if (stale !== null) return { value: stale, isStale: true };
    throw err;
  }
}

