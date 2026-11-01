const CACHE = "paperly-v2";
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg", "/icon-maskable.svg", "/icon-192.png", "/icon-512.png"];
async function putAsset(cache, url) {
  try {
    const response = await fetch(url);
    if (response.ok) await cache.put(url, response.clone());
    return response;
  } catch { return null; }
}
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // Cache the HTML's initial JS/CSS as well as self-hosted font assets.
    // Tool-specific processing modules are cached when first used.
    const shell = await cache.match("/");
    const html = shell ? await shell.text() : "";
    const assets = [...new Set([...html.matchAll(/(?:src|href)="([^\"]+)"/g)].map((match) => match[1].replace(/&amp;/g, "&")).filter((url) => url.startsWith("/_next/static/")))];
    await Promise.all(assets.map(async (url) => {
      const response = await putAsset(cache, url);
      if (response?.ok && url.includes(".css")) {
        const css = await response.text();
        const fonts = [...new Set([...css.matchAll(/url\(["']?([^\)"']+)["']?\)/g)].map((match) => new URL(match[1], new URL(url, self.location.origin)).href))].filter((url) => url.startsWith(self.location.origin + "/_next/static/"));
        await Promise.all(fonts.map((font) => putAsset(cache, font)));
      }
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("paperly-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put("/", copy)); }
      return response;
    }).catch(() => caches.match("/").then((response) => response || Response.error())));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pdf-assets/") || url.pathname.startsWith("/icon")) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); }
      return response;
    })));
  }
});
