import { openDB } from "idb";
import { zonedInstant } from "../travel/rules";
import type { Bundle } from "../travel/types";
const name = "travel-together-v1";
async function db() {
  return openDB(name, 1, {
    upgrade(d) {
      d.createObjectStore("snapshots");
      d.createObjectStore("meta");
    },
  });
}
function key(user: string, trip: string) {
  return `${user}:${trip}:1`;
}
export async function saveSnapshot(bundle: Bundle) {
  const d = await db();
  localStorage.removeItem("tt-cache-locked");
  const safe: Bundle = {
    ...bundle,
    items: bundle.items
      .filter((x) => !x.deleted_at)
      .map((x) => ({
        ...x,
        data: Object.fromEntries(
          Object.entries(x.data).filter(
            ([k]) =>
              !["note", "private", "reservation", "attachments"].includes(k),
          ),
        ),
      })),
    requests: [],
  };
  const value = {
    bundle: safe,
    savedAt: new Date().toISOString(),
    expires: new Date(
      zonedInstant(bundle.trip.end_date, "23:59", bundle.trip.timezone) +
        7 * 86400000,
    ).toISOString(),
  };
  const tx = d.transaction(["snapshots", "meta"], "readwrite");
  await tx
    .objectStore("snapshots")
    .put(value, key(bundle.userId, bundle.trip.id));
  await tx
    .objectStore("meta")
    .put({ userId: bundle.userId, tripId: bundle.trip.id }, "last");
  await tx.done;
  const verify = await d.get("snapshots", key(bundle.userId, bundle.trip.id));
  if (!verify) throw Error("저장본을 확인할 수 없습니다.");
  return value.savedAt;
}
export async function loadSnapshot(userId?: string, tripId?: string) {
  if (localStorage.getItem("tt-cache-locked")) return null;
  const d = await db();
  const expired = d.transaction("snapshots", "readwrite");
  let cursor = await expired.store.openCursor();
  while (cursor) {
    if (new Date(cursor.value.expires) < new Date()) await cursor.delete();
    cursor = await cursor.continue();
  }
  await expired.done;
  const last = await d.get("meta", "last");
  if (!last) return null;
  const user = userId || last.userId,
    trip = tripId || last.tripId;
  if (user !== last.userId) return null;
  const value = await d.get("snapshots", key(user, trip));
  if (value && new Date(value.expires) < new Date()) {
    await d.delete("snapshots", key(user, trip));
    return null;
  }
  return value || null;
}
export async function clearSnapshots() {
  const d = await db();
  const tx = d.transaction(["snapshots", "meta"], "readwrite");
  await tx.objectStore("snapshots").clear();
  await tx.objectStore("meta").clear();
  await tx.done;
}
