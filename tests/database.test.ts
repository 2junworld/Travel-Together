import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDraft } from "../lib/travel/create";
import { PGlite } from "@electric-sql/pglite";
test("database enforces isolation, roles, versions, invitations and atomic approval", async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema extensions;create table auth.users(id uuid primary key);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt()returns jsonb language sql stable as $$select jsonb_build_object('email',current_setting('request.jwt.claim.email',true))$$;create function extensions.digest(text,text)returns bytea language sql immutable as $$select decode(md5($1),'hex')$$;create function extensions.gen_random_bytes(integer)returns bytea language sql volatile as $$select decode(replace(gen_random_uuid()::text,'-',''),'hex')$$;`,
  );
  const sql = (
    await readFile("supabase/migrations/001_travel.sql", "utf8")
  ).replace("create extension if not exists pgcrypto with schema extensions;", "");
  await db.exec(sql);
  await db.exec(
    await readFile("supabase/migrations/002_production_validation.sql", "utf8"),
  );
  await db.exec(await readFile("supabase/migrations/003_packing_bag.sql", "utf8"));
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  await db.query("insert into auth.users values($1),($2),($3)", [A, B, C]);
  const session = async (id: string, email: string) => {
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.email',$2,false)",
      [id, email],
    );
  };
  const call = async (action: string, payload: any = {}) =>
    (
      await db.query<{ r: any }>(
        "select public.travel_command($1,$2::jsonb) r",
        [action, JSON.stringify(payload)],
      )
    ).rows[0].r;
  await session(A, "a@test.com");
  const { trip_id: t } = await call("create_trip", {
    title: "Test",
    start_date: "2026-11-27",
    end_date: "2026-12-01",
  });
  let data = await call("get_data", { tripId: t });
  const f = data.families[0].id;
  const { id: f2 } = await call("add_family", { tripId: t, name: "Other" });
  const { token } = await call("invite", {
    tripId: t,
    email: "b@test.com",
    familyId: f2,
  });
  await session(C, "c@test.com");
  await assert.rejects(() => call("accept_invite", { token }), /초대/);
  await session(B, "b@test.com");
  await call("accept_invite", { token });
  assert.equal((await call("accept_invite", { token })).trip_id, t);
  await session(A, "a@test.com");
  const item = (id: string, scope: string, kind = "itinerary") => ({
    id,
    kind,
    title: "Private A",
    scope,
    family_id: scope === "family" ? f : null,
    owner_id: scope === "personal" ? A : null,
    data:
      kind === "checklist"
        ? { quantity: 1, assignees: [A, B] }
        : {
            date: "2026-11-27",
            endDate: "2026-11-27",
            type: "항공",
            status: "확정",
            start: "11:45",
            end: "13:55",
            startZone: "Asia/Seoul",
            endZone: "Asia/Taipei",
          },
  });
  const i1 = "11111111-1111-4111-8111-111111111111",
    i2 = "22222222-2222-4222-8222-222222222222",
    i3 = "33333333-3333-4333-8333-333333333333",
    i4 = "44444444-4444-4444-8444-444444444444";
  for (const x of [
    item(i1, "family"),
    item(i2, "personal"),
    item(i3, "trip"),
    item(i4, "trip", "checklist"),
  ])
    await call("save_item", { tripId: t, item: x, expectedVersion: 0 });
  await assert.rejects(
    () =>
      call("members", {
        tripId: t,
        userId: A,
        familyId: f,
        role: "member",
        active: true,
      }),
    /마지막 관리자/,
  );
  await session(B, "b@test.com");
  data = await call("get_data", { tripId: t });
  assert.equal(data.items.length, 2);
  assert.equal(
    data.items.some((x: any) => x.id === i1),
    false,
  );
  await assert.rejects(
    () => call("delete_item", { tripId: t, itemId: i1, expectedVersion: 1 }),
    /찾을/,
  );
  await assert.rejects(
    () =>
      call("save_item", {
        tripId: t,
        item: { ...item(i3, "trip"), title: "Hack" },
        expectedVersion: 1,
      }),
    /편집 권한/,
  );
  // Direct SQL uses RLS even for list/detail access.
  await db.exec("set role authenticated");
  const direct = await db.query("select id from public.travel_items");
  assert.equal(direct.rows.length, 2);
  await assert.rejects(
    () => db.query("update public.travel_items set title='hack'"),
    /permission/,
  );
  await db.exec("reset role");
  await call("check_item", {
    tripId: t,
    itemId: i4,
    expectedVersion: 1,
    checked: true,
  });
  await assert.rejects(
    () =>
      call("check_item", {
        tripId: t,
        itemId: i4,
        expectedVersion: 1,
        checked: true,
      }),
    /먼저 변경/,
  );
  await call("propose", {
    tripId: t,
    itemId: i3,
    expectedVersion: 1,
    patch: { title: "Updated", data: item(i3, "trip").data },
  });
  await session(A, "a@test.com");
  data = await call("get_data", { tripId: t });
  const r = data.requests[0];
  await call("review", { tripId: t, requestId: r.id, status: "approved" });
  await assert.rejects(
    () => call("review", { tripId: t, requestId: r.id, status: "approved" }),
    /이미 처리/,
  );
  await call("check_item", {
    tripId: t,
    itemId: i4,
    expectedVersion: 2,
    checked: true,
  });
  data = await call("get_data", { tripId: t });
  assert.equal(data.items.find((x: any) => x.id === i4).data.checked.length, 2);
  await call("check_item", {
    tripId: t,
    itemId: i4,
    expectedVersion: 3,
    checked: false,
  });
  data = await call("get_data", { tripId: t });
  assert.equal(data.items.find((x: any) => x.id === i4).data.checked.length, 1);
  await call("delete_item", { tripId: t, itemId: i1, expectedVersion: 1 });
  await call("restore_item", { tripId: t, itemId: i1, expectedVersion: 2 });
  await call("private_save", { tripId: t, itemId: i3, value: "secret" });
  await assert.rejects(
    () =>
      call("private_save", {
        tripId: t,
        itemId: i3,
        value: "stale",
        expectedVersion: 0,
      }),
    /변경/,
  );
  await session(B, "b@test.com");
  assert.deepEqual(await call("private_get", { tripId: t, itemId: i3 }), {});
  // A submitted publication includes only fields the owner selected, even for a different admin.
  await session(B, "b@test.com");
  const pubId = "77777777-7777-4777-8777-777777777777";
  const pub = {
    ...item(pubId, "personal"),
    owner_id: B,
    title: "Publish me",
    data: { ...item(pubId, "personal").data, note: "not shared" },
  };
  await call("save_item", { tripId: t, item: pub, expectedVersion: 0 });
  await call("propose_publication", {
    tripId: t,
    itemId: pubId,
    expectedVersion: 1,
    patch: { title: "Submitted copy", data: item(pubId, "personal").data },
  });
  await session(A, "a@test.com");
  data = await call("get_data", { tripId: t });
  assert.equal(
    data.items.some((x: any) => x.id === pubId),
    false,
  );
  const publication = data.requests.find(
    (x: any) => x.request_type === "publication",
  );
  assert.deepEqual(publication.before, {});
  assert.equal(publication.patch.data.note, undefined);
  await call("review", {
    tripId: t,
    requestId: publication.id,
    status: "approved",
  });
  data = await call("get_data", { tripId: t });
  assert.equal(
    data.items.some(
      (x: any) => x.title === "Submitted copy" && x.scope === "trip",
    ),
    true,
  );
  await assert.rejects(
    () => call("check_item", { tripId: t, itemId: i4, checked: true }),
    /먼저 변경/,
  );
  // Cross-trip links are rejected in the database, including direct RPC calls.
  const { trip_id: otherTrip } = await call("create_trip", {
    title: "Other",
    start_date: "2026-11-27",
    end_date: "2026-12-01",
  });
  const otherPlace = {
    id: "88888888-8888-4888-8888-888888888888",
    kind: "places",
    title: "Other place",
    scope: "trip",
    data: { address: "test" },
  };
  await call("save_item", {
    tripId: otherTrip,
    item: otherPlace,
    expectedVersion: 0,
  });
  await assert.rejects(
    () =>
      call("save_item", {
        tripId: t,
        item: {
          ...item(i3, "trip"),
          data: { ...item(i3, "trip").data, place_id: otherPlace.id },
        },
        expectedVersion: 2,
      }),
    /장소/,
  );
  await session(A, "a@test.com");
  await call("members", {
    tripId: t,
    userId: B,
    familyId: f2,
    role: "member",
    active: false,
  });
  await session(B, "b@test.com");
  await assert.rejects(() => call("get_data", { tripId: t }), /旅行|여행/);
  await session(A, "a@test.com");
  const context = await call("get_data", { tripId: otherTrip });
  for (const kind of ["itinerary", "places", "checklist", "tasks"] as const) {
    const draft = createDraft(kind, context, "family", "2026-11-29");
    if (kind === "checklist") draft.data.bag = "  캐리어  ";
    draft.title = kind === "itinerary" ? "호텔 체크인" : kind;
    await call("save_item", {
      tripId: otherTrip,
      item: draft,
      expectedVersion: 0,
    });
    const stored = (await call("get_data", { tripId: otherTrip })).items.find(
      (x: any) => x.id === draft.id,
    );
    assert.equal(stored.data.type, null);
    assert.deepEqual(stored.data.assignees, []);
    if (kind === "itinerary") {
      assert.equal(stored.data.date, "2026-11-29");
      assert.equal(stored.data.start, undefined);
    }
    if (kind === "checklist") {
      assert.equal(stored.data.quantity, 1);
      assert.equal(stored.data.bag, "캐리어");
      await call("save_item", { tripId: otherTrip, item: {...stored, data: {...stored.data, bag: ""}}, expectedVersion: stored.version });
      const cleared = (await call("get_data", {tripId: otherTrip})).items.find((x: any) => x.id === stored.id);
      assert.equal(cleared.data.bag, undefined);
    }
    if (kind === "tasks") {
      assert.equal(stored.data.status, "예정");
      assert.equal(stored.data.deadline, undefined);
    }
  }
  const missingStatus = createDraft(
    "itinerary",
    context,
    "family",
    "2026-11-29",
  );
  missingStatus.title = "Missing status";
  delete missingStatus.data.status;
  await assert.rejects(
    () =>
      call("save_item", {
        tripId: otherTrip,
        item: missingStatus,
        expectedVersion: 0,
      }),
    /상태/,
  );
  const invalidTask = createDraft("tasks", context, "family", "2026-11-29");
  invalidTask.title = "Missing priority";
  delete invalidTask.data.priority;
  await assert.rejects(
    () =>
      call("save_item", {
        tripId: otherTrip,
        item: invalidTask,
        expectedVersion: 0,
      }),
    /우선순위/,
  );
  await db.close();
});
