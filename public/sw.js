const CACHE="senzilytics-static-v1";
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(["/manifest.webmanifest"]))));
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("fetch",event=>{const request=event.request;if(request.method!=="GET"||request.url.includes("/api/")||request.mode==="navigate")return;event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok&&new URL(request.url).origin===self.location.origin){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}return response}))) });
