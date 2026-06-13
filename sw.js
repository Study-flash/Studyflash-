
const CACHE="studyflash-ai-v28-dashboard-pulsanti";
const ASSETS=["./","index.html","style.css","app.js","manifest.webmanifest","icon.svg"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
