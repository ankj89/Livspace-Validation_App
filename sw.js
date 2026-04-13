self.addEventListener("install", (e) => {
  console.log("Service Worker Installed")
})

self.addEventListener("fetch", (e) => {
  // pass-through (no caching yet)
})
