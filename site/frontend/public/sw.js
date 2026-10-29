const BUILD_CONFIG_URL = "/pwa-build.json";
const OFFLINE_URL = "/offline.html";
const CACHE_PREFIX = "efhc-pwa-";
const CACHED_AT = "x-efhc-cached-at";
let configPromise = null;
let runtimeCachePolicy = null;

async function loadConfig() {
  if (!configPromise) {
    configPromise = fetch(BUILD_CONFIG_URL, { cache: "no-store" })
      .then((response) => response.json())
      .catch(() => ({
        build_id: "efhc-fallback",
        precache: [OFFLINE_URL, "/manifest.webmanifest"],
        cache_limits: {
          static: {
            max_entries: 240,
            max_age_seconds: 2592000,
            max_bytes: 83886080,
          },
          content: {
            max_entries: 120,
            max_age_seconds: 604800,
            max_bytes: 41943040,
          },
        },
      }));
  }
  return configPromise;
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function normalizeCachePolicy(policy, defaults) {
  const source = policy || {};
  const staticSource = source.static || {};
  const contentSource = source.content || {};
  return {
    tier: ["conservative", "standard", "expanded"].includes(source.tier)
      ? source.tier
      : "standard",
    static: {
      max_entries: boundedInteger(
        staticSource.max_entries,
        defaults.static.max_entries,
        80,
        800,
      ),
      max_age_seconds: boundedInteger(
        staticSource.max_age_seconds,
        defaults.static.max_age_seconds,
        86_400,
        5_184_000,
      ),
      max_bytes: boundedInteger(
        staticSource.max_bytes,
        defaults.static.max_bytes || 83886080,
        10485760,
        536870912,
      ),
    },
    content: {
      max_entries: boundedInteger(
        contentSource.max_entries,
        defaults.content.max_entries,
        40,
        400,
      ),
      max_age_seconds: boundedInteger(
        contentSource.max_age_seconds,
        defaults.content.max_age_seconds,
        86_400,
        1_209_600,
      ),
      max_bytes: boundedInteger(
        contentSource.max_bytes,
        defaults.content.max_bytes || 41943040,
        5242880,
        268435456,
      ),
    },
  };
}

function cachePolicy(config) {
  const defaults = config.cache_limits;
  return runtimeCachePolicy || normalizeCachePolicy(null, defaults);
}

async function cacheNames() {
  const config = await loadConfig();
  return {
    config,
    staticName: `${CACHE_PREFIX}${config.build_id}-static`,
    contentName: `${CACHE_PREFIX}${config.build_id}-content`,
  };
}

function isApiRequest(pathname) {
  return pathname.startsWith("/api/");
}

function isProtectedPath(pathname) {
  return (
    isApiRequest(pathname) ||
    pathname.startsWith("/admin/") ||
    pathname === "/admin" ||
    pathname === "/health" ||
    pathname.startsWith("/meta/") ||
    pathname === "/openapi.json"
  );
}

function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/skins/") ||
    /\.(?:woff2?|png|jpe?g|webp|avif|svg|ico)$/.test(url.pathname)
  );
}

function isContentAsset(url) {
  return (
    url.pathname.startsWith("/locale/") ||
    url.pathname.startsWith("/faq/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/locale-manifest.json" ||
    url.pathname === BUILD_CONFIG_URL
  );
}

function isSafeCacheUrl(value) {
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin) return false;
    if (isProtectedPath(url.pathname)) return false;
    return isImmutableAsset(url) || isContentAsset(url);
  } catch {
    return false;
  }
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({
    includeUncontrolled: true,
    type: "window",
  });
  for (const client of clients) client.postMessage(message);
}

async function stampedResponse(response) {
  const headers = new Headers(response.headers);
  headers.set(CACHED_AT, String(Date.now()));
  const body = await response.clone().blob();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function putSafe(cache, request, response) {
  if (!response || !response.ok) return;
  await cache.put(request, await stampedResponse(response));
}

async function responseBytes(response) {
  const header = Number(response?.headers.get("content-length") || 0);
  if (Number.isFinite(header) && header > 0) return header;
  try {
    return (await response.clone().blob()).size;
  } catch {
    return 0;
  }
}

async function pruneCache(cacheName, limits) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const now = Date.now();
  const maxAgeMs = Number(limits.max_age_seconds || 0) * 1000;
  const maxEntries = Number(limits.max_entries || 0);
  const maxBytes = Number(limits.max_bytes || 0);
  const entries = [];
  for (const request of keys) {
    const response = await cache.match(request);
    const cachedAt = Number(response?.headers.get(CACHED_AT) || 0);
    if (maxAgeMs && cachedAt && now - cachedAt > maxAgeMs) {
      await cache.delete(request);
      continue;
    }
    entries.push({
      request,
      cachedAt,
      bytes: response ? await responseBytes(response) : 0,
    });
  }
  entries.sort((left, right) => right.cachedAt - left.cachedAt);
  let keptEntries = 0;
  let keptBytes = 0;
  for (const entry of entries) {
    const entryAllowed = !maxEntries || keptEntries < maxEntries;
    const byteAllowed = !maxBytes || keptBytes + entry.bytes <= maxBytes;
    if (!entryAllowed || !byteAllowed) {
      await cache.delete(entry.request);
      continue;
    }
    keptEntries += 1;
    keptBytes += entry.bytes;
  }
  return { bytes: keptBytes, entries: keptEntries };
}

async function cacheUrls(urls, reason = "runtime") {
  const names = await cacheNames();
  const unique = [...new Set(urls)].filter(isSafeCacheUrl);
  const total = unique.length;
  let completed = 0;
  let completedBytes = 0;
  await notifyClients({
    type: "CACHE_PROGRESS",
    reason,
    completed,
    total,
    percent: total ? 0 : 100,
  });
  const cache = await caches.open(names.staticName);
  for (const url of unique) {
    try {
      const request = new Request(url, { credentials: "same-origin" });
      const cached = await cache.match(request);
      if (!cached) {
        const response = await fetch(request);
        await putSafe(cache, request, response);
        completedBytes += await responseBytes(response);
      } else {
        completedBytes += await responseBytes(cached);
      }
    } catch {
      // One optional asset must not abort the whole cache pass.
    }
    completed += 1;
    await notifyClients({
      type: "CACHE_PROGRESS",
      reason,
      completed,
      completedBytes,
      total,
      percent: total ? Math.round((completed / total) * 100) : 100,
    });
  }
  await pruneCache(names.staticName, cachePolicy(names.config).static);
  await notifyClients({
    type: "CACHE_COMPLETE",
    reason,
    completed,
    completedBytes,
    total,
    percent: 100,
  });
}

async function cacheFirst(request) {
  const names = await cacheNames();
  const cache = await caches.open(names.staticName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  await putSafe(cache, request, response);
  void pruneCache(names.staticName, cachePolicy(names.config).static);
  return response;
}

async function staleWhileRevalidate(request) {
  const names = await cacheNames();
  const cache = await caches.open(names.contentName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      await putSafe(cache, request, response);
      await pruneCache(names.contentName, cachePolicy(names.config).content);
      return response;
    })
    .catch(() => undefined);
  return cached || (await network) || Response.error();
}

function isReadOnlyOfflineRoute(url) {
  if (url.pathname === "/faq") return true;
  if (url.pathname === "/hub") return true;
  if (url.pathname !== "/web-profile") return false;
  const legal = url.searchParams.get("legal");
  return legal === "privacy" || legal === "terms";
}

async function navigationFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const url = new URL(request.url);
    const fallback = isReadOnlyOfflineRoute(url)
      ? "/offline-readonly.html"
      : OFFLINE_URL;
    return (
      (await caches.match(fallback)) ||
      new Response("EFHC is offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const config = await loadConfig();
      await cacheUrls(config.precache || [], "install");
      if (self.registration.active) {
        await notifyClients({
          type: "UPDATE_AVAILABLE",
          buildId: config.build_id,
        });
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await cacheNames();
      const keep = new Set([names.staticName, names.contentName]);
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && !keep.has(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
      await notifyClients({
        type: "UPDATE_ACTIVATED",
        buildId: names.config.build_id,
      });
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") {
    void self.skipWaiting();
    return;
  }
  if (data.type === "CACHE_URLS" && Array.isArray(data.urls)) {
    event.waitUntil(cacheUrls(data.urls, data.reason || "runtime"));
    return;
  }
  if (data.type === "SET_CACHE_POLICY") {
    event.waitUntil(
      (async () => {
        const names = await cacheNames();
        runtimeCachePolicy = normalizeCachePolicy(
          data.policy,
          names.config.cache_limits,
        );
        await Promise.all([
          pruneCache(names.staticName, runtimeCachePolicy.static),
          pruneCache(names.contentName, runtimeCachePolicy.content),
        ]);
        await notifyClients({
          type: "CACHE_POLICY_APPLIED",
          policy: runtimeCachePolicy,
        });
      })(),
    );
    return;
  }
  if (data.type === "GET_CACHE_STATUS") {
    event.waitUntil(
      (async () => {
        const names = await cacheNames();
        const staticCache = await caches.open(names.staticName);
        const contentCache = await caches.open(names.contentName);
        const staticState = await pruneCache(
          names.staticName,
          cachePolicy(names.config).static,
        );
        const contentState = await pruneCache(
          names.contentName,
          cachePolicy(names.config).content,
        );
        await notifyClients({
          type: "CACHE_STATUS",
          buildId: names.config.build_id,
          staticEntries: (await staticCache.keys()).length,
          contentEntries: (await contentCache.keys()).length,
          staticBytes: staticState.bytes,
          contentBytes: contentState.bytes,
          policy: cachePolicy(names.config),
        });
      })(),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isProtectedPath(url.pathname)) return;
  if (request.mode === "navigate") {
    event.respondWith(navigationFallback(request));
    return;
  }
  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (isContentAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
