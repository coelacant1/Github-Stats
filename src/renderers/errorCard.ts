import { escXml } from "./theme.js";

export function renderErrorCard(message: string, bgColor = "#fffefe"): string {
  const W = 495;
  const H = 120;
  const safeMsg = escXml(message.slice(0, 120));

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Error">
  <title>Error</title>
  <rect width="${W}" height="${H}" rx="4.5" fill="${escXml(bgColor)}"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="4.5" stroke="#e4e2e2" fill="none" stroke-width="1"/>
  <text x="25" y="35" font-size="17" font-weight="bold" fill="#434d58" font-family="'Segoe UI',sans-serif">Something went wrong!</text>
  <text x="25" y="60" font-size="13" fill="#434d58" font-family="'Segoe UI',sans-serif">${safeMsg}</text>
  <text x="25" y="85" font-size="11" fill="#858585" font-family="'Segoe UI',sans-serif">Check your username and that your tokens have the required scopes.</text>
</svg>`;
}
