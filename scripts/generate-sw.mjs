import { readdir, writeFile } from "node:fs/promises";
const files = [];
async function walk(path) {
  for (const x of await readdir(path, { withFileTypes: true })) {
    const p = path + "/" + x.name;
    if (x.isDirectory()) await walk(p);
    else if (/\.(js|css|woff2)$/.test(p))
      files.push(p.replace(".next/static", "/_next/static"));
  }
}
await walk(".next/static");
const shell = ["/travel/", "/icon.svg", "/manifest.webmanifest", ...files];
await writeFile(
  "public/sw.js",
  `const CACHE='tt-shell-${Date.now()}';const SHELL=${JSON.stringify(shell)};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('tt-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;if(e.request.mode==='navigate'&&['/','/travel/','/trips/'].includes(u.pathname)){e.respondWith(fetch(e.request).catch(()=>caches.match('/travel/')));return}if(!u.search&&SHELL.includes(u.pathname))e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});`,
);
