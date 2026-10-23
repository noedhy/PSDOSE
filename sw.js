const C="psd-v7",A=["./","index.html","styles.css","app.js","config.js","manifest.webmanifest","icon.svg","data/drugs.json"];
self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=C).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(e.request.method!="GET"||u.origin!=location.origin||u.pathname.includes("admin"))return;
e.respondWith(caches.match(e.request).then(m=>{const n=fetch(e.request).then(r=>{if(r.ok){const k=r.clone();caches.open(C).then(c=>c.put(e.request,k))}return r}).catch(()=>m);return m||n}))});
