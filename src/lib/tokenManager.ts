/**
 * Token pool manager for Cloudflare Workers.
 *
 * Reads PAT_1 ... PAT_N from the Workers env, tracks each token's
 * remaining GitHub API quota, and picks the healthiest token for the
 * next request.  Module-level state persists across warm requests
 * within the same isolate.
 */

import type { Env } from "../types/env.js";

export interface TokenHealth {
  token: string;
  remaining: number;
  resetAt: number; // unix timestamp (ms)
  bad: boolean;    // flagged due to bad credentials / suspension
}

const MIN_REMAINING = 5;

// Keyed by token string - persists across warm isolate requests.
const pool = new Map<string, TokenHealth>();

function ensureTokens(env: Env): void {
  for (let i = 1; i <= 20; i++) {
    const val = (env as Record<string, unknown>)[`PAT_${i}`];
    if (typeof val !== "string" || !val) break;
    if (!pool.has(val)) {
      pool.set(val, { token: val, remaining: 5000, resetAt: 0, bad: false });
    }
  }
}

export function pickToken(env: Env): TokenHealth {
  ensureTokens(env);

  const now = Date.now();

  for (const t of pool.values()) {
    if (!t.bad && t.remaining <= MIN_REMAINING && now >= t.resetAt) {
      t.remaining = 5000;
    }
  }

  const usable = [...pool.values()]
    .filter((t) => !t.bad && t.remaining > MIN_REMAINING)
    .sort((a, b) => b.remaining - a.remaining);

  if (usable.length === 0) {
    const soonest = [...pool.values()]
      .filter((t) => !t.bad)
      .sort((a, b) => a.resetAt - b.resetAt)[0];
    if (!soonest) {
      throw new Error("No GitHub API tokens configured (set PAT_1 ... PAT_N as secrets).");
    }
    throw new RateLimitError(
      `All tokens exhausted. Next reset in ${Math.ceil((soonest.resetAt - now) / 1000)}s.`,
      soonest.resetAt,
    );
  }

  return usable[0]!;
}

export function recordResponse(tokenValue: string, headers: Headers): void {
  const t = pool.get(tokenValue);
  if (!t) return;

  const remaining = parseInt(headers.get("x-ratelimit-remaining") ?? "", 10);
  const reset = parseInt(headers.get("x-ratelimit-reset") ?? "", 10);

  if (!isNaN(remaining)) t.remaining = remaining;
  if (!isNaN(reset)) t.resetAt = reset * 1000;
}

export function markBad(tokenValue: string): void {
  const t = pool.get(tokenValue);
  if (t) t.bad = true;
}

export function tokenCount(): number {
  return pool.size;
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly nextResetAt: number,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

