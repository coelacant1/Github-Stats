import type { LangData } from "../fetchers/topLangs.js";
import { type CardTheme, escXml } from "./theme.js";

export type LangLayout = "default" | "compact" | "donut" | "donut-vertical" | "pie";

function toPercent(langs: LangData[]): (LangData & { pct: number })[] {
  const total = langs.reduce((s, l) => s + l.size, 0);
  return langs.map((l) => ({ ...l, pct: total ? (l.size / total) * 100 : 0 }));
}

// ------------------------------------------------------------------
// Pie / Donut helpers
// ------------------------------------------------------------------

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number, innerR = 0): string {
  const s = polarToCartesian(cx, cy, r, start);
  const e = polarToCartesian(cx, cy, r, end);
  const largeArc = end - start > 180 ? 1 : 0;

  if (innerR === 0) {
    return [
      `M ${cx} ${cy}`,
      `L ${s.x} ${s.y}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`,
      "Z",
    ].join(" ");
  }

  const si = polarToCartesian(cx, cy, innerR, end);
  const ei = polarToCartesian(cx, cy, innerR, start);
  return [
    `M ${s.x} ${s.y}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`,
    `L ${si.x} ${si.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ei.x} ${ei.y}`,
    "Z",
  ].join(" ");
}

// ------------------------------------------------------------------
// Layout renderers
// ------------------------------------------------------------------

function renderPie(langs: (LangData & { pct: number })[], theme: CardTheme, title: string, compact = false): string {
  const CX = compact ? 100 : 130;
  const CY = compact ? 100 : 130;
  const R = compact ? 80 : 110;
  const INNER_R = compact ? 0 : 0; // full pie for "pie" layout
  const W = compact ? 350 : 430;
  const LEG_X = compact ? 195 : 255;
  const LEG_Y = 25;
  const LEG_SPACING = compact ? 20 : 22;
  const H = Math.max(
    50 + CY + R + 15,
    50 + LEG_Y + langs.length * LEG_SPACING + 20,
  );

  let slices = "";
  let angle = 0;
  for (const lang of langs) {
    const sweep = (lang.pct / 100) * 360;
    if (sweep < 0.5) continue;
    const endAngle = angle + sweep;
    slices += `<path d="${arcPath(CX, CY, R, angle, endAngle, INNER_R)}" fill="${escXml(lang.color)}" aria-label="${escXml(lang.name)} ${lang.pct.toFixed(1)}%"/>`;
    angle = endAngle;
  }

  const legend = langs
    .map((l, i) => {
      const y = LEG_Y + i * LEG_SPACING;
      return `<rect x="${LEG_X}" y="${y}" width="12" height="12" rx="2" fill="${escXml(l.color)}"/>
<text x="${LEG_X + 16}" y="${y + 10}" font-size="11" fill="${escXml(theme.textColor)}" font-family="'Segoe UI',sans-serif">${escXml(l.name)} <tspan font-weight="bold">${l.pct.toFixed(1)}%</tspan></text>`;
    })
    .join("\n");

  const border = theme.hideBorder
    ? ""
    : `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${theme.borderRadius}" stroke="${escXml(theme.borderColor)}" fill="none" stroke-width="1"/>`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escXml(title)}">
  <title>${escXml(title)}</title>
  <rect width="${W}" height="${H}" rx="${theme.borderRadius}" fill="${escXml(theme.bgColor)}"/>
  ${border}
  <text x="20" y="35" font-size="16" font-weight="bold" fill="${escXml(theme.titleColor)}" font-family="'Segoe UI',sans-serif">${escXml(title)}</text>
  <g transform="translate(0, 50)">${slices}</g>
  <g transform="translate(0, 50)">${legend}</g>
</svg>`;
}

function renderDonut(langs: (LangData & { pct: number })[], theme: CardTheme, title: string, vertical = false): string {
  const CX = 120, CY = 120, R = 90, INNER_R = 55;
  const W = vertical ? 280 : 460;
  const legendX = vertical ? 20 : 255;
  const legendStartY = vertical ? 260 : 60;
  const spacing = 22;
  const legendH = legendStartY + langs.length * spacing + 20;
  const circleH = 50 + CY + R + 15;
  const H = vertical ? Math.max(legendH, circleH) : Math.max(280, legendH);

  let slices = "";
  let angle = 0;
  for (const lang of langs) {
    const sweep = (lang.pct / 100) * 360;
    if (sweep < 0.5) continue;
    const endAngle = angle + sweep;
    slices += `<path d="${arcPath(CX, CY + 50, R, angle, endAngle, INNER_R)}" fill="${escXml(lang.color)}" aria-label="${escXml(lang.name)} ${lang.pct.toFixed(1)}%"/>`;
    angle = endAngle;
  }

  const legend = langs
    .map((l, i) => {
      const lx = legendX;
      const ly = legendStartY + i * spacing;
      return `<rect x="${lx}" y="${ly}" width="12" height="12" rx="2" fill="${escXml(l.color)}"/>
<text x="${lx + 16}" y="${ly + 10}" font-size="11" fill="${escXml(theme.textColor)}" font-family="'Segoe UI',sans-serif">${escXml(l.name)} <tspan font-weight="bold">${l.pct.toFixed(1)}%</tspan></text>`;
    })
    .join("\n");

  const border = theme.hideBorder
    ? ""
    : `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${theme.borderRadius}" stroke="${escXml(theme.borderColor)}" fill="none" stroke-width="1"/>`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escXml(title)}">
  <title>${escXml(title)}</title>
  <rect width="${W}" height="${H}" rx="${theme.borderRadius}" fill="${escXml(theme.bgColor)}"/>
  ${border}
  <text x="20" y="30" font-size="16" font-weight="bold" fill="${escXml(theme.titleColor)}" font-family="'Segoe UI',sans-serif">${escXml(title)}</text>
  ${slices}
  ${legend}
</svg>`;
}

function renderBars(langs: (LangData & { pct: number })[], theme: CardTheme, title: string, compact = false): string {
  const W = 300;
  const ROW_H = compact ? 34 : 40;
  const H = 50 + langs.length * ROW_H;
  const BAR_W = W - 40;
  const PADDING = 20;

  const rows = langs
    .map((l, i) => {
      const y = 50 + i * ROW_H;
      const barWidth = Math.max(1, (l.pct / 100) * BAR_W);
      return `<text x="${PADDING}" y="${y + 12}" font-size="11" fill="${escXml(theme.textColor)}" font-family="'Segoe UI',sans-serif">${escXml(l.name)}</text>
<text x="${W - PADDING}" y="${y + 12}" text-anchor="end" font-size="11" fill="${escXml(theme.textColor)}" font-family="'Segoe UI',sans-serif">${l.pct.toFixed(1)}%</text>
<rect x="${PADDING}" y="${y + 16}" width="${BAR_W}" height="8" rx="4" fill="${escXml(theme.textColor)}" opacity="0.1"/>
<rect x="${PADDING}" y="${y + 16}" width="${barWidth}" height="8" rx="4" fill="${escXml(l.color)}"/>`;
    })
    .join("\n");

  const border = theme.hideBorder
    ? ""
    : `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${theme.borderRadius}" stroke="${escXml(theme.borderColor)}" fill="none" stroke-width="1"/>`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escXml(title)}">
  <title>${escXml(title)}</title>
  <rect width="${W}" height="${H}" rx="${theme.borderRadius}" fill="${escXml(theme.bgColor)}"/>
  ${border}
  <text x="${PADDING}" y="30" font-size="16" font-weight="bold" fill="${escXml(theme.titleColor)}" font-family="'Segoe UI',sans-serif">${escXml(title)}</text>
  ${rows}
</svg>`;
}

// ------------------------------------------------------------------
// Public entry point
// ------------------------------------------------------------------

export function renderTopLangsCard(
  langMap: Record<string, LangData>,
  theme: CardTheme,
  options: {
    layout?: LangLayout;
    langsCount?: number;
    customTitle?: string;
    isStale?: boolean;
  } = {},
): string {
  const {
    layout = "default",
    langsCount = 5,
    customTitle,
    isStale = false,
  } = options;

  const title = customTitle ?? "Most Used Languages";
  const langs = toPercent(
    Object.values(langMap).slice(0, Math.max(1, Math.min(langsCount, 20))),
  );

  let svg: string;
  if (layout === "pie") {
    svg = renderPie(langs, theme, title);
  } else if (layout === "donut") {
    svg = renderDonut(langs, theme, title);
  } else if (layout === "donut-vertical") {
    svg = renderDonut(langs, theme, title, true);
  } else if (layout === "compact") {
    svg = renderBars(langs, theme, title, true);
  } else {
    svg = renderBars(langs, theme, title, false);
  }

  // Inject stale note into the SVG before closing tag
  if (isStale) {
    svg = svg.replace(
      "</svg>",
      `<text x="10" y="99%" font-size="8" fill="${escXml(theme.textColor)}" opacity="0.4" font-family="'Segoe UI',sans-serif">stats may be slightly outdated</text></svg>`,
    );
  }

  return svg;
}
