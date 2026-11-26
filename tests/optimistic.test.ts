import { test } from "node:test";
import assert from "node:assert/strict";
import { applyWrite, reconcileItems, type ItemWrite } from "../lib/travel/optimistic";
import { createDraft } from "../lib/travel/create";
import { seed } from "../lib/travel/seed";

for (const kind of ["itinerary", "places", "checklist", "tasks"] as const) {
  test(kind + " supports overlapping creates, edits and deletion without duplicate rows", () => {
    const b = seed();
    const item = createDraft(kind, b, "family", b.trip.start_date);
    const op: ItemWrite = { action: "save_item", item, expectedVersion: 0, userId: b.userId, at: new Date().toISOString() };
    const created = applyWrite([], op);
    assert.equal(applyWrite(created, op).length, 1);
    const edit = { ...op, item: { ...item, title: "수정" }, expectedVersion: 1 };
    const edited = applyWrite(created, edit);
    assert.equal(edited[0].title, "수정");
    assert.deepEqual(applyWrite(edited, edit), edited);
    assert.deepEqual(reconcileItems(created, edited, []), edited);
    assert.deepEqual(reconcileItems([], edited, []), edited);
    assert.deepEqual(reconcileItems([], edited, edited), []);
    assert.equal(applyWrite(edited, {...edit, action: "delete_item", expectedVersion: 2})[0].deleted_at, op.at);
  });
}
