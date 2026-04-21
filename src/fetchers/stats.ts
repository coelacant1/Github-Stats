import type { Env } from "../types/env.js";
import { graphql, restGet } from "../lib/githubClient.js";
import { calculateRank } from "../lib/rank.js";

const STATS_QUERY = `
  query userStats(
    $login: String!
    $includeMerged: Boolean!
    $includeDiscussions: Boolean!
    $includeDiscussionAnswers: Boolean!
    $startTime: DateTime
  ) {
    user(login: $login) {
      name
      login
      commits: contributionsCollection(from: $startTime) {
        totalCommitContributions
      }
      reviews: contributionsCollection {
        totalPullRequestReviewContributions
      }
      repositoriesContributedTo(
        first: 1
        contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]
      ) {
        totalCount
      }
      pullRequests(first: 1) {
        totalCount
      }
      mergedPullRequests: pullRequests(states: MERGED) @include(if: $includeMerged) {
        totalCount
      }
      openIssues: issues(states: OPEN) {
        totalCount
      }
      closedIssues: issues(states: CLOSED) {
        totalCount
      }
      followers {
        totalCount
      }
      repositoryDiscussions @include(if: $includeDiscussions) {
        totalCount
      }
      repositoryDiscussionComments(onlyAnswers: true) @include(if: $includeDiscussionAnswers) {
        totalCount
      }
      repositories(
        first: 100
        ownerAffiliations: OWNER
        orderBy: { direction: DESC, field: STARGAZERS }
      ) {
        totalCount
        nodes {
          name
          stargazers { totalCount }
        }
      }
    }
  }
`;

export interface StatsData {
  name: string;
  login: string;
  totalCommits: number;
  totalPRs: number;
  totalPRsMerged: number;
  mergedPRsPercentage: number;
  totalReviews: number;
  totalIssues: number;
  totalStars: number;
  totalDiscussionsStarted: number;
  totalDiscussionsAnswered: number;
  contributedTo: number;
  rank: { level: string; percentile: number };
}

interface StatsQueryResult {
  user: {
    name: string | null;
    login: string;
    commits: { totalCommitContributions: number };
    reviews: { totalPullRequestReviewContributions: number };
    repositoriesContributedTo: { totalCount: number };
    pullRequests: { totalCount: number };
    mergedPullRequests?: { totalCount: number };
    openIssues: { totalCount: number };
    closedIssues: { totalCount: number };
    followers: { totalCount: number };
    repositoryDiscussions?: { totalCount: number };
    repositoryDiscussionComments?: { totalCount: number };
    repositories: {
      totalCount: number;
      nodes: { name: string; stargazers: { totalCount: number } }[];
    };
  };
}

interface SearchCommitsResult {
  total_count: number;
}

export async function fetchStats(
  env: Env,
  username: string,
  options: {
    includeAllCommits?: boolean;
    excludeRepos?: string[];
    includeMergedPRs?: boolean;
    includeDiscussions?: boolean;
    includeDiscussionAnswers?: boolean;
    commitsYear?: number;
  } = {},
): Promise<StatsData> {
  const {
    includeAllCommits = false,
    excludeRepos = [],
    includeMergedPRs = false,
    includeDiscussions = false,
    includeDiscussionAnswers = false,
    commitsYear,
  } = options;

  const startTime = commitsYear ? `${commitsYear}-01-01T00:00:00Z` : undefined;

  const res = await graphql<StatsQueryResult>(env, STATS_QUERY, {
    login: username,
    includeMerged: includeMergedPRs,
    includeDiscussions,
    includeDiscussionAnswers,
    startTime: startTime ?? null,
  });

  if (res.errors?.length) {
    const first = res.errors[0]!;
    if (first.type === "NOT_FOUND") {
      throw new Error(`User not found: ${username}`);
    }
    throw new Error(first.message);
  }

  const user = res.data.user;

  let totalCommits = user.commits.totalCommitContributions;
  if (includeAllCommits) {
    // The REST search/commits count is authoritative when include_all_commits=true,
    // but search has a strict 30/min rate limit. Cache the result independently
    // (it changes slowly) and fall back to the cached value on rate-limit failure.
    const restCacheKey = `commits:rest:${username}`;
    let restCount: number | null = null;
    try {
      const result = await restGet<SearchCommitsResult>(
        env,
        `/search/commits?q=author:${encodeURIComponent(username)}`,
      );
      restCount = result.total_count;
      // Cache for 7 days; commit history changes slowly enough.
      try {
        await env.CACHE_KV.put(restCacheKey, String(restCount), {
          expirationTtl: 7 * 24 * 3600,
        });
      } catch {
        // KV write failure is non-fatal.
      }
    } catch {
      const cached = await env.CACHE_KV.get(restCacheKey);
      if (cached !== null) {
        restCount = parseInt(cached, 10);
      }
    }
    if (restCount !== null && Number.isFinite(restCount) && restCount > 0) {
      totalCommits = restCount;
    }
    // Otherwise: silently keep the GraphQL last-year count rather than 500-ing.
  }

  const excludeEnv = typeof env.EXCLUDE_REPO === "string"
    ? env.EXCLUDE_REPO.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const excludeSet = new Set([...excludeRepos, ...excludeEnv]);

  const totalStars = user.repositories.nodes
    .filter((r) => !excludeSet.has(r.name))
    .reduce((sum, r) => sum + r.stargazers.totalCount, 0);

  const totalPRsMerged = user.mergedPullRequests?.totalCount ?? 0;
  const totalPRs = user.pullRequests.totalCount;

  return {
    name: user.name ?? user.login,
    login: user.login,
    totalCommits,
    totalPRs,
    totalPRsMerged,
    mergedPRsPercentage: totalPRs > 0 ? (totalPRsMerged / totalPRs) * 100 : 0,
    totalReviews: user.reviews.totalPullRequestReviewContributions,
    totalIssues: user.openIssues.totalCount + user.closedIssues.totalCount,
    totalStars,
    totalDiscussionsStarted: user.repositoryDiscussions?.totalCount ?? 0,
    totalDiscussionsAnswered: user.repositoryDiscussionComments?.totalCount ?? 0,
    contributedTo: user.repositoriesContributedTo.totalCount,
    rank: calculateRank({
      allCommits: includeAllCommits,
      commits: totalCommits,
      prs: totalPRs,
      issues: user.openIssues.totalCount + user.closedIssues.totalCount,
      reviews: user.reviews.totalPullRequestReviewContributions,
      stars: totalStars,
      followers: user.followers.totalCount,
    }),
  };
}
