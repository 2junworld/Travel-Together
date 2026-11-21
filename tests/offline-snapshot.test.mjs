import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => memory.get(k) || null,
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
};
const { saveSnapshot, loadSnapshot, clearSnapshots } = await import(
  "../lib/offline/snapshot.ts"
);
const { seed } = await import("../lib/travel/seed.ts");
test("offline snapshots never return the previous account; secrets and free notes stay excluded", async () => {
  await clearSnapshots();
  const b = seed();
  b.trip.end_date = "2099-12-01";
  b.items[0].data.note = "free note";
  b.items[0].data.reservation = "private reservation";
  b.items[0].data.attachments = ["private"];
  await saveSnapshot(b);
  const own = await loadSnapshot(b.userId, b.trip.id);
  assert.ok(own);
  for (const key of ["note", "reservation", "attachments"])
    assert.equal(own.bundle.items[0].data[key], undefined);
  assert.deepEqual(own.bundle.requests, []);
  assert.equal(await loadSnapshot("different-user", b.trip.id), null);
  const other = structuredClone(b);
  other.userId = "different-user";
  await saveSnapshot(other);
  assert.equal(await loadSnapshot(b.userId, b.trip.id), null);
  localStorage.setItem("tt-cache-locked", "1");
  assert.equal(await loadSnapshot(), null);
  await clearSnapshots();
  localStorage.removeItem("tt-cache-locked");
  assert.equal(await loadSnapshot(), null);
});
