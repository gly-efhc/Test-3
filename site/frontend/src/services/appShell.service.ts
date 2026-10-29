export type HttpsUrl = `${string}://${string}`;

export function buildTonConnectManifestUrl(origin: string): HttpsUrl {
  const url = new URL("/api/tonconnect-manifest", origin);
  return url.toString() as HttpsUrl;
}
