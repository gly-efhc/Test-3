import type { QueryClient, QueryKey } from "@tanstack/react-query";

const KEY = "EFHC_USER_DATA_CACHE_V1";
const MAX_BYTES = 3_000_000;
// Only display data. Never persist credentials, handoff tokens, permissions or mutations.
const RESOURCES = new Set(["syncSnapshot", "panels", "referrals", "ranks", "exchangePreview", "tasksMy", "tasksEarnings", "profile", "withdrawals"]);
type Entry = {key: QueryKey; data: unknown; updatedAt: number};
type Cache = {owner: string | null; entries: Entry[]};
const controllers = new WeakMap<QueryClient, Cache>();
let settingsOwner: string | null = null;
const validId = (value: unknown): value is string => typeof value === "string" && /^\d{10}$/.test(value);
const userKey = (key: QueryKey) => RESOURCES.has(String(key[0])) && validId(key[1]);

function read(): Cache {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) || "null");
    if (validId(value?.owner) && Array.isArray(value.entries)) return {
      owner: value.owner,
      entries: value.entries.filter((e: Entry) => Array.isArray(e?.key) && userKey(e.key) && e.key[1] === value.owner && e.data !== undefined && Number.isFinite(e.updatedAt)),
    };
  } catch { /* Storage is optional; it never gates rendering. */ }
  return {owner: null, entries: []};
}
function persist(cache: Cache) {
  try {
    const entries: Entry[] = [];
    for (const entry of cache.entries) {
      if (new Blob([JSON.stringify([...entries, entry])]).size <= MAX_BYTES) entries.push(entry);
    }
    window.localStorage.setItem(KEY, JSON.stringify({owner: cache.owner, entries}));
  } catch { /* Keep the current in-memory model if disk storage is unavailable. */ }
}
export function currentUserDataOwner(): string | null {
  return settingsOwner ?? (typeof window === "undefined" ? null : read().owner);
}
export function startUserDataPersistence(client: QueryClient) {
  const cache = read();
  controllers.set(client, cache);
  client.getQueryCache().subscribe(event => {
    const query = event.query;
    if (!query || !userKey(query.queryKey) || query.queryKey[1] !== cache.owner) return;
    // A rejected refetch still contains the last confirmed data.
    if (query.state.data === undefined) return;
    const key = JSON.stringify(query.queryKey);
    cache.entries = [{key: query.queryKey, data: query.state.data, updatedAt: query.state.dataUpdatedAt}, ...cache.entries.filter(e => JSON.stringify(e.key) !== key)];
    persist(cache);
  });
}
export function activateUserCache(client: QueryClient, owner: string | null, admin: boolean): boolean {
  if (admin || !validId(owner)) return false;
  const cache = controllers.get(client);
  if (!cache) return false;
  const changed = cache.owner !== null && cache.owner !== owner;
  if (changed) {
    cache.entries = [];
    cache.owner = owner;
    settingsOwner = owner;
    persist(cache);
    // Removing cancels the old queries, including their fetch AbortSignal.
    client.removeQueries({predicate: q => userKey(q.queryKey)});
  } else {
    cache.owner = owner;
    settingsOwner = owner;
    const entries = [...cache.entries];
    for (const entry of entries) {
      if (client.getQueryData(entry.key) === undefined) client.setQueryData(entry.key, entry.data, {updatedAt: entry.updatedAt});
    }
    persist(cache);
  }
  return changed;
}
