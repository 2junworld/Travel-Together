import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
export function checkProductionConfig(env) {
  const errors = [];
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SITE_URL"]) {
    try {
      const u = new URL(env[key] || "");
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        u.search ||
        u.hash ||
        u.pathname !== "/"
      )
        throw Error();
    } catch {
      errors.push(`${key}: HTTPS 원점 주소가 필요합니다.`);
    }
  }
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  let publicKey = key.startsWith("sb_publishable_") && key.length > 20;
  if (!publicKey && key.split(".").length === 3) {
    try {
      publicKey =
        JSON.parse(Buffer.from(key.split(".")[1], "base64url")).role === "anon";
    } catch {}
  }
  if (!publicKey)
    errors.push(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY: publishable 또는 anon 공개 키가 필요합니다.",
    );
  if (env.NEXT_PUBLIC_DEMO_MODE !== "false")
    errors.push("NEXT_PUBLIC_DEMO_MODE: 운영에서는 false로 명시해야 합니다.");
  return errors;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const require = createRequire(import.meta.url);
  const { loadEnvConfig } = require("@next/env");
  loadEnvConfig(process.cwd());
  const errors = checkProductionConfig(process.env);
  if (errors.length) {
    process.stderr.write(
      "운영 빌드를 중단했습니다.\n" +
        errors.map((x) => "- " + x).join("\n") +
        "\n",
    );
    process.exitCode = 1;
  } else
    process.stdout.write(
      "운영 환경 변수 형식 확인 완료. 실제 Auth·DB 연결 검수는 별도로 필요합니다.\n",
    );
}
