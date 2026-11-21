import type { Item, Member, Scope } from "./types";
export function canRead(item: Item, member: Member) {
  return (
    member.active &&
    (item.scope === "trip" ||
      (item.scope === "family" && item.family_id === member.family_id) ||
      (item.scope === "personal" && item.owner_id === member.user_id))
  );
}
export function canEdit(item: Item, member: Member) {
  return (
    canRead(item, member) &&
    (item.scope !== "trip" ||
      !["itinerary", "places"].includes(item.kind) ||
      member.role === "admin")
  );
}
export function complete(item: Item) {
  const a: string[] = item.data.assignees || [];
  return item.kind === "tasks"
    ? item.data.status === "완료"
    : a.length > 0
      ? a.every((id) => (item.data.checked || []).includes(id))
      : !!item.data.complete;
}
export function localDate(zone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function dates(start: string, end: string) {
  const a = [];
  for (
    let d = new Date(start + "T12:00:00Z");
    d <= new Date(end + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    a.push(d.toISOString().slice(0, 10));
    if (a.length > 365) break;
  }
  return a;
}
export function onDate(item: Item, date: string) {
  return (
    item.data.date <= date && (item.data.endDate || item.data.date) >= date
  );
}
export function mapUrl(item: Item) {
  const d = item.data;
  const destination =
    d.lat != null && d.lng != null ? `${d.lat},${d.lng}` : d.address;
  return destination
    ? "https://www.google.com/maps/dir/?" +
        new URLSearchParams({ api: "1", destination })
    : null;
}
export function scopeLabel(scope: Scope) {
  return { trip: "공동", family: "우리 가족", personal: "나만" }[scope];
}
export function validate(item: Item) {
  if (!item.title.trim()) throw new Error("제목을 입력해 주세요.");
  if (item.kind === "checklist" && !(Number(item.data.quantity) > 0))
    throw new Error("수량은 1 이상이어야 합니다.");
  const { lat, lng } = item.data;
  if (
    (lat == null) !== (lng == null) ||
    (lat != null && (Math.abs(lat) > 90 || Math.abs(lng) > 180))
  )
    throw new Error("위도와 경도를 올바르게 입력해 주세요.");
  if (item.data.start && item.data.end && item.data.date && item.data.endDate) {
    const s = new Date(
      `${item.data.date}T${item.data.start}${item.data.startZone === "Asia/Seoul" ? "+09:00" : "+08:00"}`,
    );
    const e = new Date(
      `${item.data.endDate}T${item.data.end}${item.data.endZone === "Asia/Seoul" ? "+09:00" : "+08:00"}`,
    );
    if (e < s) throw new Error("종료 시간이 시작 시간보다 빠릅니다.");
  }
}
export function zonedInstant(date: string, time: string, zone: string) {
  let guess = Date.parse(`${date}T${time}:00Z`);
  const target = guess;
  for (let i = 0; i < 3; i++) {
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const get = (t: string) => p.find((x) => x.type === t)!.value;
    const observed = Date.parse(
      `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`,
    );
    guess += target - observed;
  }
  return guess;
}
export function dueSoon(item: Item, zone: string, now = Date.now()) {
  if (complete(item) || !item.data.deadline) return false;
  return (
    zonedInstant(item.data.deadline, item.data.dueTime || "23:59", zone) <=
    now + 48 * 3600000
  );
}
