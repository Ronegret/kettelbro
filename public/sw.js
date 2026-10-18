/* kettellbro · service worker mínimo.
 * - Cache de los archivos estáticos (JS/CSS/fuentes/íconos): la app abre al instante y sin red.
 * - Navegación: red primero, con la última versión en caché como respaldo.
 * - NUNCA toca otros orígenes (Google, Firebase) ni /__/auth: el login y la sincronización van directo a la red. */
const CACHE = "kb-v3";

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/"])).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/__/") || url.pathname.startsWith("/api/")) return;

  // Modelos 3D (/models/*.glb): primero la caché. La versión viaja en la URL (?v=, MODELS_VERSION de figure3d/types.ts) y en el
  // nombre de la caché (kb-vN): al reexportar un GLB se sube ?v= y nunca se sirve uno viejo. Solo se guardan respuestas 200.
  if (url.pathname.startsWith("/models/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || /\.(?:woff2?|png|svg|ico|webp)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
    );
  }
});
