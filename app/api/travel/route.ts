import { createClient } from "@supabase/supabase-js";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer "))
      return Response.json(
        { error: "로그인이 필요합니다." },
        { status: 401, headers },
      );
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key)
      return Response.json(
        { error: "서버 연결 설정이 필요합니다." },
        { status: 503, headers },
      );
    const body = await request.json();
    const allowed = [
      "import_items",
      "list_trips",
      "create_trip",
      "get_data",
      "save_item",
      "delete_item",
      "restore_item",
      "check_item",
      "save_trip",
      "add_family",
      "invite",
      "invite_info",
      "accept_invite",
      "members",
      "propose",
      "propose_publication",
      "review",
      "scope_preview",
      "scope_change",
      "private_get",
      "private_save",
    ];
    if (!allowed.includes(body.action))
      return Response.json(
        { error: "지원하지 않는 요청입니다." },
        { status: 422, headers },
      );
    const db = createClient(url, key, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // PostgREST validates the bearer JWT; travel_command checks auth.uid() and membership.
    const { data, error } = await db.rpc("travel_command", {
      action: body.action,
      payload: body.payload || {},
    });
    if (error) {
      const status =
        (
          {
            PGRST301: 401,
            PGRST303: 401,
            PT401: 401,
            PT403: 403,
            PT404: 404,
            PT409: 409,
            PT422: 422,
          } as Record<string, number>
        )[error.code] || 422;
      return Response.json(
        { error: status === 404 ? "항목을 찾을 수 없습니다." : error.message },
        { status, headers },
      );
    }
    if (["save_item", "check_item", "delete_item", "restore_item"].includes(body.action)) {
      const { data: row } = await db.from("travel_items")
        .select("id,trip_id,kind,title,scope,family_id,owner_id,version,created_at,deleted_at,data")
        .eq("trip_id", body.payload.tripId)
        .eq("id", body.payload.itemId ?? body.payload.item.id).maybeSingle();
      return Response.json({ data: { ...data, row } }, { headers });
    }
    return Response.json({ data }, { headers });
  } catch {
    return Response.json(
      { error: "잘못된 요청입니다." },
      { status: 422, headers },
    );
  }
}
