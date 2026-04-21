import type { LangData } from "../fetchers/topLangs.js";
import { type CardTheme, escXml } from "./theme.js";

export type LangLayout = "default" | "compact" | "donut" | "donut-vertical" | "pie";

function toPercent(langs: LangData[]): (LangData & { pct: number })[] {
  const total = langs.reduce((s, l) => s + l.size, 0);
  return langs.map((l) => ({ ...l, pct: total ? (l.size / total) * 100 : 0 }));
}

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

interface RenderArgs {
  langs: (LangData & { pct: number })[];
  theme: CardTheme;
  title: string;
}

function commonStyle(theme: CardTheme): string {
  return `
.header {
  font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif;
  fill: ${theme.titleColor};
  animation: fadeInAnimation 0.8s ease-in-out forwards;
}
@supports(-moz-appearance: auto) { .header { font-size: 15.5px; } }
.lang-name {
  font: 400 11px "Segoe UI", Ubuntu, Sans-Serif;
  fill: ${theme.textColor};
}
.bold { font-weight: 700; fill: ${theme.textColor}; }
.stagger {
  opacity: 0;
  animation: fadeInAnimation 0.3s ease-in-out forwards;
}
.lang-progress {
  animation: growWidthAnimation 0.6s ease-in-out forwards;
}
@keyframes slideInAnimation {
  from { width: 0; }
  to   { width: 100%; }
}
@keyframes growWidthAnimation {
  from { width: 0; }
  to   { width: 100%; }
}
@keyframes fadeInAnimation {
  from { opacity: 0; }
  to   { opacity: 1; }
}
`.trim();
}

function legendItem(lang: LangData & { pct: number }, x: number, y: number, delayMs: number, theme: CardTheme): string {
  return `<g transform="translate(${x}, ${y})" class="stagger" style="animation-delay: ${delayMs}ms">
  <circle cx="5" cy="6" r="5" fill="${escXml(lang.color)}"/>
  <text data-testid="lang-name" x="15" y="10" class="lang-name" fill="${escXml(theme.textColor)}">${escXml(lang.name)} ${lang.pct.toFixed(2)}%</text>
</g>`;
}

// ---------- Pie ----------
function renderPie({ langs, theme, title }: RenderArgs): string {
  const W = 300;
  const CX = 150, CY = 100, R = 90;
  const cols = Math.ceil(langs.length / 5);
  const legendCols: string[] = [];
  for (let c = 0; c < cols; c++) {
    const items = langs.slice(c * 5, c * 5 + 5);
    legendCols.push(items.map((l, i) => legendItem(l, c * 150, i * 25, 450 + i * 150, theme)).join(""));
  }
  const legendH = 220 + Math.min(langs.length, 5) * 25 + 30;
  const H = Math.max(220 + 30, legendH);

  let slices = "";
  let angle = 0;
  langs.forEach((lang, i) => {
    const sweep = (lang.pct / 100) * 360;
    if (sweep < 0.5) { angle += sweep; return; }
    const endAngle = angle + sweep;
    const delay = 100 + i * 100;
    slices += `<g class="stagger" style="animation-delay: ${delay}ms">
  <path data-testid="lang-pie" d="${arcPath(CX, CY, R, angle, endAngle, 0)}" fill="${escXml(lang.color)}" aria-label="${escXml(lang.name)} ${lang.pct.toFixed(2)}%"/>
</g>`;
    angle = endAngle;
  });

  return wrapCard(W, H, theme, title, `
  <g data-testid="main-card-body" transform="translate(0, 55)">
    <svg data-testid="lang-items">
      <g transform="translate(0, 0)">
        <svg data-testid="pie">${slices}</svg>
      </g>
      <g transform="translate(0, 220)">
        <svg data-testid="lang-names" x="25">
          ${legendCols.map((c, i) => `<g transform="translate(${i * 150}, 0)">${c}</g>`).join("")}
        </svg>
      </g>
    </svg>
  </g>`);
}

// ---------- Donut ----------
function renderDonut({ langs, theme, title }: RenderArgs, vertical = false): string {
  const CX = 150, CY = 100, R = 90, INNER_R = 55;
  const W = vertical ? 280 : 460;
  let slices = "";
  let angle = 0;
  langs.forEach((lang, i) => {
    const sweep = (lang.pct / 100) * 360;
    if (sweep < 0.5) { angle += sweep; return; }
    const endAngle = angle + sweep;
    const delay = 100 + i * 100;
    slices += `<g class="stagger" style="animation-delay: ${delay}ms">
  <path d="${arcPath(CX, CY, R, angle, endAngle, INNER_R)}" fill="${escXml(lang.color)}" aria-label="${escXml(lang.name)} ${lang.pct.toFixed(2)}%"/>
</g>`;
    angle = endAngle;
  });

  let body: string;
  let H: number;
  if (vertical) {
    const legend = langs.map((l, i) => legendItem(l, 0, i * 25, 450 + i * 150, theme)).join("");
    H = 230 + langs.length * 25 + 25;
    body = `
    <g transform="translate(0, 0)"><svg>${slices}</svg></g>
    <g transform="translate(25, 230)"><svg>${legend}</svg></g>`;
  } else {
    const legend = langs.map((l, i) => legendItem(l, 0, i * 25, 450 + i * 150, theme)).join("");
    H = Math.max(220, 30 + langs.length * 25 + 30);
    body = `
    <g transform="translate(0, 0)"><svg>${slices}</svg></g>
    <g transform="translate(280, 30)"><svg>${legend}</svg></g>`;
  }

  return wrapCard(W, H, theme, title, `
  <g data-testid="main-card-body" transform="translate(0, 55)">
    <svg data-testid="lang-items">${body}</svg>
  </g>`);
}

// ---------- Bars (default + compact) ----------
function renderBars({ langs, theme, title }: RenderArgs, compact: boolean): string {
  const W = 300;
  const PADDING = 25;
  const BAR_W = W - PADDING * 2;
  const ROW_H = compact ? 30 : 38;
  const headerH = 30;
  const H = 55 + langs.length * ROW_H + 25;

  const rows = langs.map((l, i) => {
    const y = headerH + i * ROW_H;
    const barWidth = Math.max(1, (l.pct / 100) * BAR_W);
    const delay = 450 + i * 150;
    return `<g class="stagger" style="animation-delay: ${delay}ms" transform="translate(0, ${y})">
  <text x="${PADDING}" y="12" class="lang-name">${escXml(l.name)}</text>
  <text x="${W - PADDING}" y="12" text-anchor="end" class="lang-name bold">${l.pct.toFixed(2)}%</text>
  <svg width="${BAR_W}" x="${PADDING}" y="16">
    <rect width="100%" height="8" rx="4" fill="${escXml(theme.textColor)}" opacity="0.1"/>
    <rect class="lang-progress" width="${barWidth}" height="8" rx="4" fill="${escXml(l.color)}"/>
  </svg>
</g>`;
  }).join("");

  return wrapCard(W, H, theme, title, `
  <g data-testid="main-card-body" transform="translate(0, 55)">
    ${rows}
  </g>`);
}

function wrapCard(W: number, H: number, theme: CardTheme, title: string, body: string): string {
  const border = theme.hideBorder
    ? ""
    : `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${theme.borderRadius}" stroke="${escXml(theme.borderColor)}" fill="none" stroke-width="1"/>`;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escXml(title)}">
  <title>${escXml(title)}</title>
  <style>${commonStyle(theme)}</style>
  <rect data-testid="card-bg" x="0.5" y="0.5" rx="${theme.borderRadius}" height="99%" width="${W - 1}" fill="${escXml(theme.bgColor)}" stroke-opacity="0"/>
  ${border}
  <g data-testid="card-title" transform="translate(25, 35)">
    <text x="0" y="0" class="header" data-testid="header">${escXml(title)}</text>
  </g>
  ${body}
</svg>`;
}

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
    svg = renderPie({ langs, theme, title });
  } else if (layout === "donut") {
    svg = renderDonut({ langs, theme, title }, false);
  } else if (layout === "donut-vertical") {
    svg = renderDonut({ langs, theme, title }, true);
  } else if (layout === "compact") {
    svg = renderBars({ langs, theme, title }, true);
  } else {
    svg = renderBars({ langs, theme, title }, false);
  }

  if (isStale) {
    svg = svg.replace(
      "</svg>",
      `<text x="10" y="99%" font-size="8" fill="${escXml(theme.textColor)}" opacity="0.4" font-family="'Segoe UI',sans-serif">stats may be slightly outdated</text></svg>`,
    );
  }

  return svg;
}
