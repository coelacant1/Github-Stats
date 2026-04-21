import type { StatsData } from "../fetchers/stats.js";
import { type CardTheme, type NumberFormat, escXml, formatNumber } from "./theme.js";

// Which optional stat fields can be shown
export type ShowField =
  | "reviews"
  | "discussions_started"
  | "discussions_answered"
  | "prs_merged"
  | "prs_merged_percentage";

const ICONS: Record<string, string> = {
  star: `<path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/>`,
  commit: `<path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/>`,
  pr: `<path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"/>`,
  issue: `<path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0A6.5 6.5 0 0 0 1.5 8Z"/>`,
  contrib: `<path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8V1.5Z"/>`,
  review: `<path d="M1.5 2.75C1.5 1.784 2.284 1 3.25 1h9.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 12.75 12h-9.5A1.75 1.75 0 0 1 1.5 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25ZM5 12.5h6V14H5Zm2.5 1.5h1v.75a.75.75 0 0 1-1.5 0V14Z"/>`,
  discussion: `<path d="M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 10.25 10H7.061l-2.574 2.573A1.458 1.458 0 0 1 2 11.543V10h-.25A1.75 1.75 0 0 1 0 8.25v-5.5C0 1.784.784 1 1.75 1ZM1.5 2.75v5.5c0 .138.112.25.25.25h1a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h3.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Z"/>`,
  merge: `<path d="M5.45 5.154A4.25 4.25 0 0 0 9.25 9.5v2.311l-.713-.713a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l2-2a.75.75 0 0 0-1.06-1.06l-.477.477V9.5a5.75 5.75 0 0 1-5.607-4.61 3.5 3.5 0 0 1-.928-3.891.75.75 0 0 0-1.376-.594A5.001 5.001 0 0 0 5.45 5.154ZM4.25 5.5a3 3 0 0 0 3 3h.25V5.811a.75.75 0 0 1 .75-.75H9.5a.75.75 0 0 1 .53.22l.72.72V4.25a3 3 0 0 0-6 0v1.25Z"/>`,
};

function icon(name: string, color: string, x: number, y: number): string {
  const path = ICONS[name] ?? "";
  return `<svg viewBox="0 0 16 16" width="16" height="16" fill="${escXml(color)}" x="${x}" y="${y}">${path}</svg>`;
}

interface StatItem {
  label: string;
  value: string;
  iconName: string;
}

function buildItems(data: StatsData, showFields: Set<ShowField>, fmt: NumberFormat): StatItem[] {
  const items: StatItem[] = [
    { label: "Total Stars Earned", value: formatNumber(data.totalStars, fmt), iconName: "star" },
    { label: "Total Commits", value: formatNumber(data.totalCommits, fmt), iconName: "commit" },
    { label: "Total PRs", value: formatNumber(data.totalPRs, fmt), iconName: "pr" },
    { label: "Total Issues", value: formatNumber(data.totalIssues, fmt), iconName: "issue" },
    { label: "Contributed to", value: formatNumber(data.contributedTo, fmt), iconName: "contrib" },
  ];

  if (showFields.has("reviews")) {
    items.push({ label: "Total Reviews", value: formatNumber(data.totalReviews, fmt), iconName: "review" });
  }
  if (showFields.has("discussions_started")) {
    items.push({ label: "Discussions Started", value: formatNumber(data.totalDiscussionsStarted, fmt), iconName: "discussion" });
  }
  if (showFields.has("discussions_answered")) {
    items.push({ label: "Discussions Answered", value: formatNumber(data.totalDiscussionsAnswered, fmt), iconName: "discussion" });
  }
  if (showFields.has("prs_merged")) {
    items.push({ label: "PRs Merged", value: formatNumber(data.totalPRsMerged, fmt), iconName: "merge" });
  }
  if (showFields.has("prs_merged_percentage")) {
    items.push({
      label: "PR Merge Rate",
      value: `${data.mergedPRsPercentage.toFixed(1)}%`,
      iconName: "merge",
    });
  }

  return items;
}

export function renderStatsCard(
  data: StatsData,
  theme: CardTheme,
  options: {
    showIcons?: boolean;
    showFields?: ShowField[];
    numberFormat?: NumberFormat;
    customTitle?: string;
    isStale?: boolean;
  } = {},
): string {
  const {
    showIcons = true,
    showFields = [],
    numberFormat = "short",
    customTitle,
    isStale = false,
  } = options;

  const showSet = new Set<ShowField>(showFields as ShowField[]);
  const items = buildItems(data, showSet, numberFormat);

  const WIDTH = 495;
  const HEADER_H = 75;
  const ROW_H = 25;
  const PADDING = 20;
  const COL_W = (WIDTH - PADDING * 2) / 2;
  const rows = Math.ceil(items.length / 2);
  const HEIGHT = HEADER_H + rows * ROW_H + PADDING + 10;

  const RING_R = 28;
  const rankRing = renderRankRing(data.rank.level, theme.iconColor, WIDTH - RING_R - 12, Math.floor(HEADER_H / 2), RING_R);

  const itemsSvg = items
    .map((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = PADDING + col * COL_W;
      const y = HEADER_H + row * ROW_H + PADDING;
      const icn = showIcons ? icon(item.iconName, theme.iconColor, x, y - 13) : "";
      const textX = x + (showIcons ? 22 : 0);
      return `${icn}<text x="${textX}" y="${y}" fill="${escXml(theme.textColor)}" font-size="13" font-family="'Segoe UI',sans-serif">
        <tspan fill="${escXml(theme.textColor)}">${escXml(item.label)}: </tspan>
        <tspan font-weight="bold" fill="${escXml(theme.textColor)}">${escXml(item.value)}</tspan>
      </text>`;
    })
    .join("\n");

  const title = customTitle ?? `${escXml(data.name)}'s GitHub Stats`;
  const staleNote = isStale
    ? `<text x="${WIDTH / 2}" y="${HEIGHT - 6}" text-anchor="middle" font-size="9" fill="${escXml(theme.textColor)}" opacity="0.5" font-family="'Segoe UI',sans-serif">stats may be slightly outdated</text>`
    : "";

  const border = theme.hideBorder
    ? ""
    : `<rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="${theme.borderRadius}" stroke="${escXml(theme.borderColor)}" fill="none" stroke-width="1"/>`;

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escXml(title)}">
  <title>${escXml(title)}</title>
  <rect width="${WIDTH}" height="${HEIGHT}" rx="${theme.borderRadius}" fill="${escXml(theme.bgColor)}"/>
  ${border}
  <text x="${PADDING}" y="35" font-size="17" font-weight="bold" fill="${escXml(theme.titleColor)}" font-family="'Segoe UI',sans-serif">${escXml(title)}</text>
  ${rankRing}
  ${itemsSvg}
  ${staleNote}
</svg>`;
}

function renderRankRing(level: string, color: string, cx: number, cy: number, r = 34): string {
  const circumference = 2 * Math.PI * r;
  const fontSize = r < 32 ? 15 : 17;
  const strokeW = r < 32 ? 5 : 6;
  return `
  <g transform="translate(${cx}, ${cy})">
    <circle r="${r}" fill="none" stroke="${escXml(color)}" stroke-opacity="0.2" stroke-width="${strokeW}"/>
    <circle r="${r}" fill="none" stroke="${escXml(color)}" stroke-width="${strokeW}"
      stroke-dasharray="${circumference}"
      stroke-dashoffset="${circumference * 0.25}"
      stroke-linecap="round"
      transform="rotate(-90)"/>
    <text text-anchor="middle" dominant-baseline="central" fill="${escXml(color)}" font-size="${fontSize}" font-weight="bold" font-family="'Segoe UI',sans-serif">${escXml(level)}</text>
  </g>`;
}
