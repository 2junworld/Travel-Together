import { spawnSync } from "node:child_process";
const preview =
  process.env.SITES_MANAGED_LINUX_CONTAINER === "1" ||
  process.env.STATIC_PREVIEW === "1";
const commands = preview
  ? [["scripts/build-preview.mjs"]]
  : [["node_modules/next/dist/bin/next", "build"], ["scripts/generate-sw.mjs"]];
for (const args of commands) {
  const r = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
  });
  if (r.status) process.exit(r.status);
}
