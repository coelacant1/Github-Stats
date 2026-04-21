/**
 * GitHub GraphQL + REST client using native fetch with automatic token rotation.
 *
 * Token health is tracked via the tokenManager pool.  On rate-limit or
 * credential errors the request is retried with the next available token
 * (up to MAX_RETRIES).
 */

import type { Env } from "../types/env.js";
import {
  pickToken,
  recordResponse,
  markBad,
  RateLimitError,
} from "./tokenManager.js";

const GRAPHQL_URL = "https://api.github.com/graphql";
const REST_BASE = "https://api.github.com";
const MAX_RETRIES = 10;

export interface GraphQLResponse<T> {
  data: T;
  errors?: { type?: string; message: string }[];
}

async function graphql<T>(
  env: Env,
  query: string,
  variables: Record<string, unknown>,
  attempt = 0,
  lastStatus = 0,
  lastBody = "",
): Promise<GraphQLResponse<T>> {
  if (attempt >= MAX_RETRIES) {
    throw new Error(
      `Max retries reached for GitHub GraphQL request (last status ${lastStatus}: ${lastBody.slice(0, 160)}).`,
    );
  }

  const tokenHealth = pickToken(env);

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `bearer ${tokenHealth.token}`,
      "Content-Type": "application/json",
      "User-Agent": "github-stats-worker",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 401) {
    const body = await res.text();
    let msg = "";
    try { msg = (JSON.parse(body) as { message?: string }).message ?? ""; } catch { msg = body; }
    if (msg === "Bad credentials" || msg.startsWith("Sorry. Your account was suspended")) {
      markBad(tokenHealth.token);
      return graphql<T>(env, query, variables, attempt + 1, 401, msg);
    }
    return graphql<T>(env, query, variables, attempt + 1, 401, msg);
  }

  if (res.status === 403 || res.status === 429) {
    const body = await res.text();
    recordResponse(tokenHealth.token, res.headers);
    return graphql<T>(env, query, variables, attempt + 1, res.status, body);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub GraphQL HTTP error: ${res.status} ${res.statusText} - ${body.slice(0, 160)}`);
  }

  recordResponse(tokenHealth.token, res.headers);
  const body = await res.json() as GraphQLResponse<T>;

  const isRateLimited = (body.errors ?? []).some(
    (e) => e.type === "RATE_LIMITED" || /rate limit/i.test(e.message),
  );
  if (isRateLimited) {
    recordResponse(tokenHealth.token, new Headers({ "x-ratelimit-remaining": "0" }));
    return graphql<T>(env, query, variables, attempt + 1, 200, "RATE_LIMITED");
  }

  return body;
}

async function restGet<T>(
  env: Env,
  path: string,
  attempt = 0,
): Promise<T> {
  if (attempt >= MAX_RETRIES) {
    throw new Error("Max retries reached for GitHub REST request.");
  }

  const tokenHealth = pickToken(env);

  const res = await fetch(`${REST_BASE}${path}`, {
    headers: {
      Authorization: `token ${tokenHealth.token}`,
      Accept: "application/vnd.github.cloak-preview",
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 401) {
    const body = await res.json() as { message?: string };
    const msg = body.message ?? "";
    if (msg === "Bad credentials" || msg.startsWith("Sorry. Your account was suspended")) {
      markBad(tokenHealth.token);
      return restGet<T>(env, path, attempt + 1);
    }
  }

  if (res.status === 403 || res.status === 429) {
    recordResponse(tokenHealth.token, res.headers);
    return restGet<T>(env, path, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`GitHub REST HTTP error: ${res.status} ${res.statusText}`);
  }

  recordResponse(tokenHealth.token, res.headers);
  return res.json() as Promise<T>;
}

export { graphql, restGet, RateLimitError };

