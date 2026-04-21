# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-04-21

### Added
- Attribution note in the README crediting [anuraghazra/github-readme-stats](https://github.com/anuraghazra/github-readme-stats) as the project this is modernized from.
- `User-Agent: github-stats-worker` header on all GitHub API requests.
- GraphQL retry loop now surfaces the last HTTP status and response body snippet in the "Max retries reached" error, making upstream failures diagnosable from the rendered error card.
- Animated rendering for the stats card: header fade-in, rank-ring stroke animation, and per-row stagger - matching the look of the upstream cards.
- Animated rendering for the top-langs card: per-slice / per-bar stagger plus slide-in and grow-width transitions.
- `includeAllCommits` and `hideRank` options threaded through the worker into the renderer.

### Changed
- `calculateRank` now uses `logNormCdf(x) = x / (1 + x)`, exactly matching the upstream `calculateRank.js` formula. Rank output is now byte-identical to upstream for the same inputs.
- When `include_all_commits=true`, the REST `search/commits` count is now authoritative - failures are no longer silently swallowed and replaced with the much smaller "last year contributions" number, which previously dropped ranks by a tier or two.
- Stats card layout rewritten to a single-column upstream-style layout (width 467, dynamic height, rank ring on the right, label/value column alignment, octicons matching upstream, `96.00 %` percentage formatting, `Contributed to (last year)` label).
- KV cache key for stats bumped to `stats:v2:…` so previously cached incorrect ranks are invalidated on deploy.

### Removed
- `/debug` endpoint (was used to verify runtime secret bindings during deployment debugging; no longer needed).

## [0.1.0] - Initial release

### Added
- Cloudflare Workers–native reimplementation of GitHub readme stats and top-languages cards.
- KV-backed stale cache: serves the last-known-good SVG when GitHub rate-limits or errors, instead of an error card.
- Automatic token rotation across a pool of GitHub PATs (`PAT_1`, `PAT_2`, `PAT_3`, …).
- Stats card endpoint (`/api`) with parameters: `username`, `show_icons`, `include_all_commits`, `hide`, `show`, `icon_color`, `title_color`, `text_color`, `bg_color`, `hide_border`, `number_format`, `hide_rank`.
- Top-languages card endpoint (`/api/top-langs`) with layouts: default (bars), `compact`, `donut`, `donut-vertical`, `pie`. Parameters include `langs_count`, `size_weight`, `count_weight`, `custom_title`, `exclude_repo`, theming colors.
- TypeScript build with zero runtime dependencies (uses native Workers `fetch` + KV).
