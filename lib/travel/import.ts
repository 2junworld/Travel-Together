import type { Bundle } from "./types";
import { seed } from "./seed";
export async function kaohsiungImport(bundle: Bundle) {
  const member = bundle.members.find((m) => m.user_id === bundle.userId)!;
  const template = seed();
  const ids = new Map<string, string>();
  for (const x of template.items) {
    const hash = new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`${bundle.trip.id}:kaohsiung-v1:${x.id}`),
      ),
    );
    hash[6] = (hash[6] & 15) | 64;
    hash[8] = (hash[8] & 63) | 128;
    const h = [...hash.slice(0, 16)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    ids.set(
      x.id,
      `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`,
    );
  }
  return [...template.items]
    .sort(
      (a, b) => (a.kind === "places" ? 0 : 1) - (b.kind === "places" ? 0 : 1),
    )
    .map((x) => ({
      ...x,
      id: ids.get(x.id)!,
      trip_id: bundle.trip.id,
      family_id: x.scope === "family" ? member.family_id : null,
      owner_id: x.scope === "personal" ? member.user_id : null,
      data: {
        ...x.data,
        ...(x.data.place_id ? { place_id: ids.get(x.data.place_id) } : {}),
        ...(x.data.families
          ? { families: bundle.families.map((f) => f.id) }
          : {}),
        source_key: `kaohsiung-v1:${x.id}`,
      },
    }));
}
