import type { Bundle, Item, Kind, Scope } from "./types";
export function createDraft(
  kind: Kind,
  bundle: Bundle,
  scope: string,
  date: string,
): Item {
  const user = bundle.members.find((m) => m.user_id === bundle.userId)!;
  const selected = scope === "all" ? "family" : (scope as Scope);
  return {
    id: crypto.randomUUID(),
    trip_id: bundle.trip.id,
    kind,
    title: "",
    scope: selected,
    family_id: selected === "family" ? user.family_id : null,
    owner_id: selected === "personal" ? user.user_id : null,
    version: 1,
    created_at: new Date().toISOString(),
    deleted_at: null,
    data: {
      ...(kind === "itinerary"
        ? { date, endDate: date, status: "미정" }
        : kind === "tasks"
          ? { status: "예정" }
          : {}),
      type: null,
      quantity: 1,
      listName: "여행 준비물",
      category: "기본",
      assignees: [],
      checked: [],
      priority: "보통",
    },
  };
}
