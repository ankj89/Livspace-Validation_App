const CACHE_PREFIX = "validator-";

async function getVersion(){
    try{
        let res = await fetch("version.txt?ts=" + Date.now());
        let v = await res.text();
        return v.trim();
    }catch(e){
        return "v1"; // fallback
    }
}

/* INSTALL */
self.addEventListener("install", event => {

    event.waitUntil(
        (async ()=>{
            let version = await getVersion();
            let CACHE_NAME = CACHE_PREFIX + version;

            let cache = await caches.open(CACHE_NAME);

            await cache.addAll([
                "./",
                "./index.html",
                "./manifest.json",
                "./version.txt",
                "./xlsx.full.min.js",
                "./jszip.min.js"
            ]);

            self.skipWaiting();
        })()
    );
});

/* ACTIVATE — CLEAN OLD CACHE */
self.addEventListener("activate", event => {

    event.waitUntil(
        (async ()=>{
            let version = await getVersion()
            let currentCache = CACHE_PREFIX + version

            let keys = await caches.keys()

            await Promise.all(
                keys.map(k=>{
                    if(
                        k.startsWith(CACHE_PREFIX) &&
                        k !== currentCache &&
                        k !== CACHE_PREFIX + "dynamic"
                    ){
                        return caches.delete(k)
                    }
                })
            )

            await self.clients.claim()

            // 🔥 FORCE RELOAD ALL CLIENTS (ONLY ONCE)
            let clientsList = await self.clients.matchAll({ type: "window" })

            clientsList.forEach(client => {
                client.postMessage({ type: "FORCE_RELOAD" })
            })

        })()
    )
});

/* FETCH */
self.addEventListener("fetch", event => {

    const url = new URL(event.request.url)

    // 🔥 ALWAYS FETCH FRESH HTML (prevents stale app)
    if (url.pathname.endsWith(".html") || url.pathname === "/") {
        event.respondWith(
            fetch(event.request).catch(() => caches.match("/index.html"))
        )
        return
    }

    // 🔥 CACHE-FIRST FOR STATIC ASSETS
    if (
        url.pathname.endsWith(".js") ||
        url.pathname.endsWith(".css") ||
        url.pathname.endsWith(".json")
    ) {
        event.respondWith(
            caches.match(event.request).then(res => {
                return res || fetch(event.request).then(networkRes => {
                    return caches.open(CACHE_PREFIX + "dynamic").then(cache => {
                        cache.put(event.request, networkRes.clone())
                        return networkRes
                    })
                })
            })
        )
        return
    }

    // 🔥 DEFAULT NETWORK-FIRST
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    )
})
