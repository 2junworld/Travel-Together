import { test } from "node:test";
import assert from "node:assert/strict";
import { seed } from "../lib/travel/seed";
import {
  canRead,
  canEdit,
  complete,
  onDate,
  mapUrl,
  validate,
  zonedInstant,
  dueSoon,
} from "../lib/travel/rules";
const b = seed(),
  admin = b.members[0],
  partner = b.members[1],
  item = b.items[0];
test("admin cannot read another family or another person private data", () => {
  assert.equal(
    canRead({ ...item, scope: "family", family_id: "other" }, admin),
    false,
  );
  assert.equal(
    canRead({ ...item, scope: "personal", owner_id: partner.user_id }, admin),
    false,
  );
});
test("member can propose but not edit shared itinerary", () => {
  assert.equal(
    canEdit({ ...item, scope: "trip", family_id: null }, partner),
    false,
  );
  assert.equal(
    canRead({ ...item, scope: "trip", family_id: null }, partner),
    true,
  );
});
test("all assigned adults must check; removing check reverses completion", () => {
  const x = {
    ...item,
    kind: "checklist" as const,
    data: { assignees: ["a", "b"], checked: ["a"] },
  };
  assert.equal(complete(x), false);
  x.data.checked.push("b");
  assert.equal(complete(x), true);
  x.data.checked = ["b"];
  assert.equal(complete(x), false);
});
test("multi-day hotel appears on each date; unknown time remains unknown", () => {
  assert.equal(onDate(b.items[2], "2026-11-28"), true);
  assert.equal(onDate(b.items[2], "2026-11-30"), false);
  assert.equal(b.items[2].data.start, undefined);
});
test("directions encode address and preserve absent address state", () => {
  assert.equal(mapUrl(b.items.find((x) => x.kind === "places")!), null);
  assert.ok(
    mapUrl({ ...item, data: { address: "高雄 A&B" } })?.includes(
      "destination=",
    ),
  );
});
test("invalid coordinates and reverse cross-zone times are rejected", () => {
  assert.throws(() => validate({ ...item, data: { lat: 100, lng: 20 } }));
  assert.doesNotThrow(() => validate(item));
  assert.throws(() =>
    validate({
      ...item,
      data: {
        date: "2026-11-27",
        endDate: "2026-11-27",
        start: "12:00",
        end: "10:00",
        startZone: "Asia/Seoul",
        endZone: "Asia/Taipei",
      },
    }),
  );
});

test("deadlines use the trip timezone; overdue tasks remain urgent", () => {
  assert.equal(
    new Date(zonedInstant("2026-11-27", "11:45", "Asia/Seoul")).toISOString(),
    "2026-11-27T02:45:00.000Z",
  );
  assert.equal(
    new Date(zonedInstant("2026-11-27", "13:55", "Asia/Taipei")).toISOString(),
    "2026-11-27T05:55:00.000Z",
  );
  assert.equal(
    dueSoon(
      {
        ...item,
        kind: "tasks",
        data: { status: "예정", deadline: "2026-11-26" },
      },
      "Asia/Taipei",
      Date.parse("2026-11-27T00:00Z"),
    ),
    true,
  );
});
