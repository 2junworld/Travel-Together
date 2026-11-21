import { createClient, SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | undefined;
export const demoMode =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export function supabase() {
  if (!client) {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
      throw Error("Supabase 연결 설정이 필요합니다.");
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }
  return client;
}
export async function api(
  action: string,
  payload: Record<string, unknown> = {},
) {
  const {
    data: { session },
  } = await supabase().auth.getSession();
  if (!session) throw Error("로그인이 필요합니다.");
  const response = await fetch("/api/travel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, payload }),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(Error(result.error || "요청을 완료하지 못했습니다."), {
      status: response.status,
    });
  return result.data;
}
