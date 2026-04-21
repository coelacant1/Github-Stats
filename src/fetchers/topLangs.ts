import type { Env } from "../types/env.js";
import { graphql } from "../lib/githubClient.js";

const TOP_LANGS_QUERY = `
  query topLangs($login: String!) {
    user(login: $login) {
      repositories(ownerAffiliations: OWNER, isFork: false, first: 100) {
        nodes {
          name
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node { color name }
            }
          }
        }
      }
    }
  }
`;

export interface LangData {
  name: string;
  color: string;
  size: number;   // weighted
  count: number;
}

interface TopLangsQueryResult {
  user: {
    repositories: {
      nodes: {
        name: string;
        languages: {
          edges: { size: number; node: { color: string | null; name: string } }[];
        };
      }[];
    };
  };
}

export async function fetchTopLanguages(
  env: Env,
  username: string,
  options: {
    excludeRepos?: string[];
    sizeWeight?: number;
    countWeight?: number;
  } = {},
): Promise<Record<string, LangData>> {
  const { excludeRepos = [], sizeWeight = 1, countWeight = 0 } = options;

  const res = await graphql<TopLangsQueryResult>(env, TOP_LANGS_QUERY, { login: username });

  if (res.errors?.length) {
    const first = res.errors[0]!;
    if (first.type === "NOT_FOUND") {
      throw new Error(`User not found: ${username}`);
    }
    throw new Error(first.message);
  }

  const excludeEnv = typeof env.EXCLUDE_REPO === "string"
    ? env.EXCLUDE_REPO.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const excludeSet = new Set([...excludeRepos, ...excludeEnv]);

  const repos = res.data.user.repositories.nodes.filter(
    (r) => !excludeSet.has(r.name),
  );

  const langMap: Record<string, LangData> = {};

  for (const repo of repos) {
    for (const edge of repo.languages.edges) {
      const name = edge.node.name;
      const existing = langMap[name];
      if (existing) {
        existing.size += edge.size;
        existing.count += 1;
      } else {
        langMap[name] = {
          name,
          color: edge.node.color ?? "#858585",
          size: edge.size,
          count: 1,
        };
      }
    }
  }

  // Apply weights
  for (const lang of Object.values(langMap)) {
    lang.size =
      Math.pow(lang.size, sizeWeight) * Math.pow(lang.count, countWeight);
  }

  return Object.fromEntries(
    Object.entries(langMap).sort(([, a], [, b]) => b.size - a.size),
  );
}
