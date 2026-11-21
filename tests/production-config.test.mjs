import { test } from "node:test";
import assert from "node:assert/strict";
import { checkProductionConfig } from "../scripts/check-production.mjs";
const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SITE_URL: "https://example.vercel.app",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_example_public_key_for_test",
  NEXT_PUBLIC_DEMO_MODE: "false",
};
test("production requires explicit connected configuration instead of silently using samples", () => {
  assert.deepEqual(checkProductionConfig(valid), []);
  assert.equal(checkProductionConfig({}).length, 4);
  assert.ok(
    checkProductionConfig({ ...valid, NEXT_PUBLIC_DEMO_MODE: "true" }).length,
  );
});
test("production rejects public service_role/secret keys and non-HTTPS origins", () => {
  const jwt = (role) =>
    "e30." +
    Buffer.from(JSON.stringify({ role })).toString("base64url") +
    ".signature";
  assert.deepEqual(
    checkProductionConfig({
      ...valid,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon"),
    }),
    [],
  );
  for (const key of [jwt("service_role"), "sb_secret_do_not_expose_to_browser"])
    assert.ok(
      checkProductionConfig({ ...valid, NEXT_PUBLIC_SUPABASE_ANON_KEY: key })
        .length,
    );
  for (const url of [
    "http://example.com",
    "https://example.com/path",
    "https://user:pass@example.com",
    "https://example.com?secret=x",
  ])
    assert.ok(
      checkProductionConfig({ ...valid, NEXT_PUBLIC_SITE_URL: url }).length,
    );
});
