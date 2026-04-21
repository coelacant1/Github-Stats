# GitHub Stats for Profiles

A self-hosted GitHub profile stats service deployed on **Cloudflare Workers** with **KV-backed stale caching** (globally shared across all edge nodes - never shows an error card when rate-limited, serves last-known-good SVGs instead) and **automatic token rotation** across a pool of GitHub PATs.

Built in TypeScript with no dependencies at runtime - uses native Workers `fetch` + KV APIs.

> **Note:** This is a modernized, Cloudflare Workers–native version of [anuraghazra/github-readme-stats](https://github.com/anuraghazra/github-readme-stats). Rank calculation and card output stay close to the original, while the runtime, caching, and token-rotation strategy are rebuilt from scratch to avoid the rate-limiting issues with the upstream public instance.

---

## Example Gallery

### Stats card

#### Default

<img src="https://github-stats.coela.workers.dev/api?username=coelacant1&show_icons=true" alt="Stats card default" width="495"/>

```
/api?username=coelacant1&show_icons=true
```

---

#### With extra fields + dark theme

<img src="https://github-stats.coela.workers.dev/api?username=coelacant1&show_icons=true&include_all_commits=true&title_color=e59bba&icon_color=e59bba&text_color=ffffff&bg_color=161b22&hide_border=true&show=reviews,prs_merged,prs_merged_percentage&number_format=long" alt="Stats card dark" width="495"/>

```
/api?username=coelacant1&show_icons=true&include_all_commits=true
  &title_color=e59bba&icon_color=e59bba&text_color=ffffff&bg_color=161b22
  &hide_border=true&show=reviews,prs_merged,prs_merged_percentage&number_format=long
```

---

### Top languages - all layouts

#### `layout=default`

<img src="https://github-stats.coela.workers.dev/api/top-langs/?username=coelacant1&layout=default&langs_count=6" alt="Top langs default" width="300"/>

```
/api/top-langs/?username=coelacant1&layout=default&langs_count=6
```

---

#### `layout=compact`

<img src="https://github-stats.coela.workers.dev/api/top-langs/?username=coelacant1&layout=compact&langs_count=8&title_color=e59bba&icon_color=e59bba&text_color=ffffff&bg_color=161b22&hide_border=true" alt="Top langs compact dark" width="300"/>

```
/api/top-langs/?username=coelacant1&layout=compact&langs_count=8
  &title_color=e59bba&text_color=ffffff&bg_color=161b22&hide_border=true
```

---

#### `layout=donut`

<img src="https://github-stats.coela.workers.dev/api/top-langs/?username=coelacant1&layout=donut&langs_count=8" alt="Top langs donut" width="460"/>

```
/api/top-langs/?username=coelacant1&layout=donut&langs_count=8
```

---

#### `layout=donut-vertical`

<img src="https://github-stats.coela.workers.dev/api/top-langs/?username=coelacant1&layout=donut-vertical&langs_count=8&title_color=e59bba&icon_color=e59bba&text_color=ffffff&bg_color=161b22&hide_border=true" alt="Top langs donut-vertical dark" width="280"/>

```
/api/top-langs/?username=coelacant1&layout=donut-vertical&langs_count=8
  &title_color=e59bba&text_color=ffffff&bg_color=161b22&hide_border=true
```

---

#### `layout=pie`

<img src="https://github-stats.coela.workers.dev/api/top-langs/?username=coelacant1&layout=pie&langs_count=8&size_weight=0.5&count_weight=0.5&custom_title=Language%20Distribution" alt="Top langs pie" width="430"/>

```
/api/top-langs/?username=coelacant1&layout=pie&langs_count=8
  &size_weight=0.5&count_weight=0.5&custom_title=Language%20Distribution
```

---

## API reference

### `GET /api`

| Parameter | Default | Description |
|---|---|---|
| `username` | *(required)* | GitHub username |
| `show_icons` | `true` | Show icons next to each stat |
| `include_all_commits` | `false` | Count all-time commits via search API |
| `number_format` | `short` | `short` (1.2k) or `long` (1,234) |
| `show` | *(empty)* | Comma-separated extra fields: `reviews`, `discussions_started`, `discussions_answered`, `prs_merged`, `prs_merged_percentage` |
| `custom_title` | auto | Override card title |
| `title_color` | `2f80ed` | Hex (no `#`) |
| `text_color` | `333` | Hex |
| `icon_color` | `4c71f2` | Hex |
| `bg_color` | `fffefe` | Hex or `00000000` for transparent |
| `hide_border` | `false` | Hide card border |

### `GET /api/top-langs`

All styling params above, plus:

| Parameter | Default | Description |
|---|---|---|
| `layout` | `default` | `default`, `compact`, `donut`, `donut-vertical`, `pie` |
| `langs_count` | `5` | 1–20 |
| `size_weight` | `1` | Byte-size weighting (0–1) |
| `count_weight` | `0` | Repo-count weighting (0–1) |
| `exclude_repo` | *(empty)* | Comma-separated repo names to exclude |

---

## Deploy Your Own via Cloudflare Workers Builds

Everything is done in the browser. Cloudflare's Git integration watches your repo and redeploys automatically on every push to `main`.

---

### Step 1 - Connect your repo

In the Cloudflare dashboard:

1. Go to **Workers & Pages** -> **Create application** -> **Import a repository**
2. Select your GitHub account and choose this repo
3. Click **Save and Deploy**

If you already created a Worker: go to the Worker -> **Settings** -> **Builds** -> **Connect**.

---

### Step 2 - Configure the build settings

In your Worker -> **Settings** -> **Builds**, set:

| Setting | Value |
|---|---|
| **Build command** | `npm ci` |
| **Deploy command** | `npx wrangler deploy` *(default)* |
| **Git branch** | `main` |

Save. The build command ensures wrangler is installed before the deploy runs.

---

### Step 3 - Create a KV namespace

1. In the Cloudflare dashboard sidebar, go to **Workers & Pages** -> **KV**
2. Click **Create namespace**, name it `CACHE_KV`, click **Add**
3. Copy the **Namespace ID** from the list

---

### Step 4 - Edit `wrangler.toml` on GitHub

Open `wrangler.toml` in the GitHub web editor and replace the placeholder with your real namespace ID:

```toml
[[kv_namespaces]]
binding = "CACHE_KV"
id = "YOUR_NAMESPACE_ID_HERE"
preview_id = "YOUR_NAMESPACE_ID_HERE"  # same ID is fine
```

Commit the change - this triggers a build and deploys automatically.

---

### Step 5 - Add your GitHub PAT(s) as runtime secrets

Secrets live in **Cloudflare**, not GitHub.

1. Go to your Worker -> **Settings** -> **Variables & Secrets**
2. Scroll to the **Secrets** section -> click **Add**
3. Add each token (Name / Value):
   - `PAT_1` -> a GitHub Personal Access Token with **no scopes selected** (the token is needed to access the GraphQL API and for the 5,000 req/hr rate limit vs 60/hr unauthenticated)
   - `PAT_2`, `PAT_3`, ... *(optional - more tokens = higher rate limit quota)*
4. Click **Deploy** after saving - this re-deploys the Worker with the secrets applied

Your Worker URL will be:
```
https://github-stats.YOUR-SUBDOMAIN.workers.dev
```

---

## Local development *(optional)*

```bash
npm install
cp dev.vars.example .dev.vars
# Edit .dev.vars and add your PAT_1 token
npm run dev
# -> http://localhost:8787
```

---

## Architecture

```
Request -> Cloudflare Worker (edge)
                v
            KV cache lookup (fresh key, global edge cache)
                v miss
            GitHub API (token pool rotation)
                v
            KV write (fresh TTL + 7-day stale backup)
                v
            SVG renderer -> Response
```

**Token pool**: add `PAT_1` ... `PAT_N` secrets. The worker always picks the token with the most remaining quota. When a token is exhausted it is deprioritised until its reset window passes.

**Stale cache**: if GitHub is unreachable or all tokens are rate-limited, the last-known-good SVG is served from KV (up to 7 days old) instead of an error card. Cache-Control headers let Cloudflare's CDN serve the SVG from edge nodes with zero origin hits for cached entries.
