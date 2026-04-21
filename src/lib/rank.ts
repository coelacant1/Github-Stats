/** Weighted-percentile rank calculation, matching the original algorithm. */

interface RankParams {
  allCommits: boolean;
  commits: number;
  prs: number;
  issues: number;
  reviews: number;
  stars: number;
  followers: number;
}

interface Rank {
  level: string;
  percentile: number;
}

const LEVELS = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C"] as const;
const THRESHOLDS = [1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100] as const;

function expCdf(x: number): number {
  return 1 - Math.pow(2, -x);
}

function logNormCdf(x: number): number {
  // approximation - matches upstream calculateRank.js
  return x / (1 + x);
}

export function calculateRank({
  allCommits,
  commits,
  prs,
  issues,
  reviews,
  stars,
  followers,
}: RankParams): Rank {
  const COMMITS_MEDIAN = allCommits ? 1000 : 250;
  const weights = {
    commits: 2,
    prs: 3,
    issues: 1,
    reviews: 1,
    stars: 4,
    followers: 1,
  };

  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  const score =
    1 -
    (weights.commits * expCdf(commits / COMMITS_MEDIAN) +
      weights.prs * expCdf(prs / 50) +
      weights.issues * expCdf(issues / 25) +
      weights.reviews * expCdf(reviews / 2) +
      weights.stars * logNormCdf(stars / 50) +
      weights.followers * logNormCdf(followers / 10)) /
      total;

  const percentile = score * 100;
  const idx = THRESHOLDS.findIndex((t) => percentile <= t);
  const level = LEVELS[idx < 0 ? LEVELS.length - 1 : idx] ?? "C";

  return { level, percentile };
}
