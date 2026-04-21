export interface Env {
  CACHE_KV: KVNamespace;
  /** Optional comma-separated repo names to exclude from star/language counts */
  EXCLUDE_REPO?: string;
  /** PAT_1 ... PAT_N - GitHub personal access tokens for API rotation */
  [key: string]: unknown;
}
