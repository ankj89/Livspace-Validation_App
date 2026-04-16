const CACHE_PREFIX = "validator-";
const CORE_FILES = [
    "./",
    "./index.html",
    "./manifest.json",
    "./version.txt",
    "./xlsx.full.min.js",
    "./jszip.min.js"
];

// 🔥 GET VERSION (SAFE)
async function getVersion(){
    try{
        let res = await fetch("./version.txt?ts=" + Date.now());
        let v = await res.text();
        return v.trim();
    }catch(e){
        return "v1"; // fallback (offline safe)
    }
}

/* =========================
   INSTALL
========================= */
self.addEventListener("install", event => {

    event.waitUntil(
        (async ()=>{
            let version = await getVersion();
            let CACHE_NAME = CACHE_PREFIX + version;

            let cache = await caches.open(CACHE_NAME);

            // 🔥 SAFE CACHING (no crash if one fails)
            for (let file of CORE_FILES){
                try{
                    await cache.add(file);
                }catch(e){
                    console.warn("Cache failed:", file);
                }
            }

            self.skipWaiting();
        })()
    );
});

/* =========================
   ACTIVATE
========================= */
self.addEventListener("activate", event => {

    event.waitUntil(
        (async ()=>{
            let version = await getVersion();
            let currentCache = CACHE_PREFIX + version;

            let keys = await caches.keys();

            // 🔥 DELETE OLD CACHE
            await Promise.all(
                keys.map(k=>{
                    if(
                        k.startsWith(CACHE_PREFIX) &&
                        k !== currentCache &&
                        k !== CACHE_PREFIX + "dynamic"
                    ){
                        return caches.delete(k);
                    }
                })
            );

            await self.clients.claim();

            // 🔥 FORCE RELOAD (APP UPDATE)
            let clientsList = await self.clients.matchAll({ type: "window" });

            clientsList.forEach(client => {
                client.postMessage({ type: "FORCE_RELOAD" });
            });

        })()
    );
});

/* =========================
   FETCH
========================= */
self.addEventListener("fetch", event => {

    const url = new URL(event.request.url);

    // 🔥 HTML → NETWORK FIRST (ALWAYS LATEST)
    if (url.pathname.endsWith(".html") || url.pathname === "/" || url.pathname === "") {
        event.respondWith(
            fetch(event.request)
                .then(res => res)
                .catch(() => caches.match("./index.html"))
        );
        return;
    }

    // 🔥 STATIC FILES → CACHE FIRST
    if (
        url.pathname.endsWith(".js") ||
        url.pathname.endsWith(".css") ||
        url.pathname.endsWith(".json")
    ) {
        event.respondWith(
            caches.match(event.request).then(res => {
                return res || fetch(event.request).then(networkRes => {
                    return caches.open(CACHE_PREFIX + "dynamic").then(cache => {
                        cache.put(event.request, networkRes.clone());
                        return networkRes;
                    });
                });
            })
        );
        return;
    }

    // 🔥 DEFAULT → NETWORK FIRST + FALLBACK
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request)
                || caches.match("./index.html"); // 🔥 NEVER FAIL
        })
    );
});
