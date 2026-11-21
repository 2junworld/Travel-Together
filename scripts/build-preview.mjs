import { rename, cp, mkdir, rm, readdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await rename("app/api", "api-preview-excluded");
try {
  const result = spawnSync(
    "node",
    ["node_modules/next/dist/bin/next", "build"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        STATIC_PREVIEW: "1",
        NEXT_PUBLIC_DEMO_MODE: "true",
      },
    },
  );
  if (result.status) process.exitCode = result.status;
  else {
    await rm("dist", { recursive: true, force: true });
    await mkdir("dist", { recursive: true });
    await cp("out", "dist", { recursive: true });
    const files = [];
    async function walk(path) {
      for (const x of await readdir(path, { withFileTypes: true })) {
        const p = path + "/" + x.name;
        if (x.isDirectory()) await walk(p);
        else if (/\.(js|css|svg|png|woff2)$/.test(p))
          files.push(p.replace("out", ""));
      }
    }
    await walk("out");
    const shell = ["/travel/", "/icon.svg", "/manifest.webmanifest", ...files];
    await writeFile(
      "out/sw.js",
      `const CACHE='tt-shell-${Date.now()}';const SHELL=${JSON.stringify([...new Set(shell)])};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('tt-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;if(e.request.mode==='navigate'&&['/','/travel/','/trips/'].includes(u.pathname)){e.respondWith(fetch(e.request).catch(()=>caches.match('/travel/')));return}if(SHELL.includes(u.pathname))e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});`,
    );
  }
} finally {
  await rename("api-preview-excluded", "app/api");
}
