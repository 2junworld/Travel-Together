import type { Item } from "./types";

export type ItemWrite = {
  action: "save_item" | "delete_item" | "restore_item" | "check_item";
  item: Item;
  expectedVersion: number;
  userId: string;
  checked?: boolean;
  at: string;
};

export function applyWrite(items: Item[], op: ItemWrite): Item[] {
  const old = items.find(x => x.id === op.item.id);
  // A refresh or acknowledgement may already include this change.
  if ((old?.version ?? 0) !== op.expectedVersion) return items;
  const next = { ...(op.action === "save_item" ? op.item : old!), version: op.expectedVersion + 1 };
  if (op.action === "delete_item" || op.action === "restore_item")
    next.deleted_at = op.action === "delete_item" ? op.at : null;
  if (op.action === "check_item") {
    const data = { ...next.data };
    if (data.assignees?.length) {
      const checked = new Set<string>(data.checked);
      if (op.checked) checked.add(op.userId);
      else checked.delete(op.userId);
      data.checked = [...checked];
    } else data.complete = op.checked;
    next.data = data;
  }
  if (!old) return [...items, next];
  const field = next.kind === "places" ? "place_id" : next.kind === "itinerary" ? "itinerary_id" : null;
  return items.map(x => {
    if (x.id === next.id) return next;
    if (op.action !== "delete_item" || !field || x.data[field] !== next.id) return x;
    const data = { ...x.data };
    delete data[field];
    return { ...x, data, version: x.version + 1 };
  });
}

// A response may have started before a local acknowledgement.
export function reconcileItems(remote: Item[], current: Item[], atStart: Item[]) {
  const before = new Map(atStart.map(x => [x.id, x]));
  const merged = new Map(remote.map(x => [x.id, x]));
  for (const x of current) {
    const fetched = merged.get(x.id);
    if (fetched ? x.version > fetched.version : before.get(x.id) !== x)
      merged.set(x.id, x);
  }
  return [...merged.values()];
}
