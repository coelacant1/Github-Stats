/** Shared SVG theming helpers. */

export interface CardTheme {
  titleColor: string;
  iconColor: string;
  textColor: string;
  bgColor: string;
  hideBorder: boolean;
  borderColor: string;
  borderRadius: number;
}

export type NumberFormat = "short" | "long";

export function parseTheme(q: Record<string, string | undefined>): CardTheme {
  return {
    titleColor: sanitizeColor(q["title_color"] ?? "2f80ed"),
    iconColor: sanitizeColor(q["icon_color"] ?? "4c71f2"),
    textColor: sanitizeColor(q["text_color"] ?? "434d58"),
    bgColor: sanitizeColor(q["bg_color"] ?? "fffefe"),
    hideBorder: q["hide_border"] === "true",
    borderColor: sanitizeColor(q["border_color"] ?? "e4e2e2"),
    borderRadius: clamp(parseInt(q["border_radius"] ?? "4.5"), 0, 50),
  };
}

function sanitizeColor(raw: string): string {
  // Allow hex (3/4/6/8 chars), rgba(), transparent, 00000000 style
  const stripped = raw.replace(/^#/, "");
  if (/^[0-9a-fA-F]{3,8}$/.test(stripped)) return `#${stripped}`;
  if (/^rgba?\(/.test(raw)) return raw;
  if (raw === "00000000") return "transparent";
  return "#fffefe";
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, isNaN(n) ? min : n));
}

export function formatNumber(n: number, format: NumberFormat): string {
  if (format === "long") {
    return n.toLocaleString("en-US");
  }
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
