import type { Env } from "./types/env.js";
import { fetchStats } from "./fetchers/stats.js";
import { fetchTopLanguages } from "./fetchers/topLangs.js";
import { renderStatsCard, type ShowField } from "./renderers/statsCard.js";
import { renderTopLangsCard, type LangLayout } from "./renderers/topLangsCard.js";
import { renderErrorCard } from "./renderers/errorCard.js";
import { parseTheme } from "./renderers/theme.js";
import { getOrFetch } from "./lib/staleCache.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function svgResponse(svg: string, maxAge: number): Response {
  return new Response(svg, {
    headers: {
      ...CORS,
      "Content-Type": "image/svg+xml",
      "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 6}`,
    },
  });
}

function errorResponse(message: string): Response {
  return new Response(renderErrorCard(message), {
    status: 200, // GitHub Camo requires 200 to render <img> tags
    headers: {
      ...CORS,
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}

async function handleStats(env: Env, q: Record<string, string>): Promise<Response> {
  const username = q["username"] ?? "";
  if (!username) return errorResponse("Missing ?username= parameter");

  const theme = parseTheme(q);
  const showFields = (q["show"] ?? "").split(",").map((s) => s.trim()).filter(Boolean) as ShowField[];
  const includeAllCommits = q["include_all_commits"] === "true";
  const numberFormat = (q["number_format"] as "short" | "long") ?? "short";
  const customTitle = q["custom_title"];

  const cacheKey = `stats:v2:${username}:${includeAllCommits}`;
  const { value: data, isStale } = await getOrFetch(env, cacheKey, 4 * 3600, () =>
    fetchStats(env, username, {
      includeAllCommits,
      includeMergedPRs: showFields.includes("prs_merged") || showFields.includes("prs_merged_percentage"),
      includeDiscussions: showFields.includes("discussions_started"),
      includeDiscussionAnswers: showFields.includes("discussions_answered"),
    }),
  );

  const svg = renderStatsCard(data, theme, {
    showIcons: q["show_icons"] !== "false",
    showFields,
    numberFormat,
    customTitle,
    isStale,
    includeAllCommits,
    hideRank: q["hide_rank"] === "true",
  });

  return svgResponse(svg, 4 * 3600);
}

async function handleTopLangs(env: Env, q: Record<string, string>): Promise<Response> {
  const username = q["username"] ?? "";
  if (!username) return errorResponse("Missing ?username= parameter");

  const theme = parseTheme(q);
  const layout = (q["layout"] as LangLayout) ?? "default";
  const langsCount = Math.min(20, Math.max(1, parseInt(q["langs_count"] ?? "5", 10)));
  const sizeWeight = parseFloat(q["size_weight"] ?? "1");
  const countWeight = parseFloat(q["count_weight"] ?? "0");
  const customTitle = q["custom_title"];
  const excludeRepos = (q["exclude_repo"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const cacheKey = `top-langs:${username}:${sizeWeight.toFixed(2)}:${countWeight.toFixed(2)}`;
  const { value: langMap, isStale } = await getOrFetch(env, cacheKey, 24 * 3600, () =>
    fetchTopLanguages(env, username, { sizeWeight, countWeight, excludeRepos }),
  );

  const svg = renderTopLangsCard(langMap, theme, { layout, langsCount, customTitle, isStale });
  return svgResponse(svg, 24 * 3600);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const q = Object.fromEntries(url.searchParams) as Record<string, string>;

    try {
      const p = url.pathname.replace(/\/$/, "");
      if (p === "/api") return await handleStats(env, q);
      if (p === "/api/top-langs") return await handleTopLangs(env, q);
      return new Response("Not found", { status: 404 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return errorResponse(msg);
    }
  },
};
