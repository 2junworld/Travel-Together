"use client";
import { applyWrite, reconcileItems, type ItemWrite } from "@/lib/travel/optimistic";
import { createDraft } from "@/lib/travel/create";
import React, { useEffect, useRef, useState } from "react";
import { lockBodyScroll } from "@/lib/travel/scroll-lock";
import {
  Anchor,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  Download,
  ExternalLink,
  Flag,
  Home,
  ListTodo,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  MoreHorizontal,
  Navigation,
  Plane,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  X,
  Baby,
  Building2,
  Car,
  Palmtree,
  Utensils,
  Lock,
  Mail,
  Copy,
  Archive,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type {
  Bundle,
  Trip,
  Item,
  Kind,
  Scope,
  Request as ChangeRequest,
} from "@/lib/travel/types";
import { kaohsiungImport } from "@/lib/travel/import";
import { seed } from "@/lib/travel/seed";
import {
  canRead,
  canEdit,
  complete,
  dates,
  onDate,
  mapUrl,
  scopeLabel,
  validate,
  localDate,
  dueSoon,
  zonedInstant,
} from "@/lib/travel/rules";
import { api, demoMode, supabase } from "@/lib/travel/api";
import {
  saveSnapshot,
  loadSnapshot,
  clearSnapshots,
} from "@/lib/offline/snapshot";
const tabs = [
  ["home", "여행 홈", Home],
  ["itinerary", "일정", CalendarDays],
  ["places", "장소 · 지도", MapPin],
  ["checklist", "준비물", ShoppingBag],
  ["tasks", "TODO", CheckSquare],
  ["settings", "설정", Settings],
] as const;
const types: Record<Kind, string[]> = {
  itinerary: ["항공", "숙박", "식사", "관광", "이동", "휴식"],
  places: ["숙소", "식당", "관광", "공항", "쇼핑", "기타"],
  checklist: [],
  tasks: [],
};
const icons: Record<string, any> = {
  항공: Plane,
  숙박: Building2,
  숙소: Building2,
  이동: Car,
  식사: Utensils,
  관광: Palmtree,
  휴식: Sun,
};
const shortDate = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  });
const timeText = (s: string) =>
  new Date(s).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
function Harbor() {
  return (
    <svg
      className="harbor"
      viewBox="0 0 480 225"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="376" cy="59" r="34" fill="#f8cd8a" />
      <path
        d="M0 172c70-18 135 17 210-1 100-20 175 18 270-4v58H0Z"
        fill="#a9d8d1"
      />
      <path
        d="M32 197c70-11 131 9 193 0m60 10 125-2"
        stroke="#e9f8f5"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M282 164h38V81h-38zM291 80V54m18 26V44m-28 34h43"
        stroke="#368e86"
        strokeWidth="3"
        fill="#d5ebe6"
      />
      <path d="M331 165h43v-46h-43z" fill="#73b1a6" />
      <path
        d="M350 119V73m0 5h59l-21 42M367 78v39"
        stroke="#297d76"
        strokeWidth="4"
      />
      <path d="M103 161h126l-18 26h-88z" fill="#167e75" />
      <path d="M155 160V74l-40 75h40Z" fill="#fff" />
      <path d="M161 80v69h52Z" fill="#f3b876" />
      <path d="M38 167V115h25v52m4 0v-33h33v33m135-1V98h31v68" fill="#99c6bc" />
      <path d="M46 111V95m196 3V83m11 15V68" stroke="#99c6bc" strokeWidth="3" />
      <path d="m402 154 11-11m-6 0 6 0 0 6" stroke="#438d84" strokeWidth="2" />
      <path
        d="M68 51q10-9 20 0 10-9 20 0m82-20q8-7 15 0 8-7 16 0"
        stroke="#78aaa1"
        strokeWidth="2"
      />
      <path
        d="M437 173c-7-25-3-56 13-82m-13 36-22-15m27 3 19-4m-25 35-23-10"
        stroke="#378f80"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
export default function TravelApp() {
  const [base, setBundle] = useState<Bundle | null>(null),
    [view, setView] = useState("home"),
    [date, setDate] = useState("2026-11-27"),
    [scope, setScope] = useState("all"),
    [online, setOnline] = useState(true),
    [verified, setVerified] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [saved, setSaved] = useState(""),
    [modal, setModal] = useState<"item" | "trip" | "invite" | "request" | null>(
      null,
    ),
    [edit, setEdit] = useState<Item | null>(null),
    [selected, setSelected] = useState<Item | null>(null),
    [proposal, setProposal] = useState(false),
    [publication, setPublication] = useState(false),
    [requestId, setRequestId] = useState(""),
    [trips, setTrips] = useState<Trip[]>([]),
    [screen, setScreen] = useState("travel"),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState("deadline"),
    [assignee, setAssignee] = useState("all"),
    [trash, setTrash] = useState(false),
    [menu, setMenu] = useState(false),
    [email, setEmail] = useState(""),
    [session, setSession] = useState(false),
    [inviteInfo, setInviteInfo] = useState<any>(null),
    [inviteUrl, setInviteUrl] = useState("");
  const [pending, setPending] = useState<ItemWrite[]>([]);
  const [failed, setFailed] = useState<{op: ItemWrite; reason: string}[]>([]);
  const tail = useRef(Promise.resolve());
  const invalidatedWrites = useRef(new Set<ItemWrite>());
  const queued = useRef(new Set<ItemWrite>());
  const activeWrites = useRef(new Set<string>());
  const channel = useRef<ReturnType<ReturnType<typeof supabase>["channel"]> | null>(null);
  const bundle = React.useMemo(() => {
    if (!base) return null;
    const items = pending.reduce((rows, op) => op.userId === base.userId && op.item.trip_id === base.trip.id
      ? applyWrite(rows, op) : rows, base.items);
    return items === base.items ? base : { ...base, items };
  }, [base, pending]);
  const confirmed = useRef(base);
  confirmed.current = base;
  const current = useRef<Bundle | null>(null),
    epoch = useRef(0);
  current.current = bundle;
  const user = bundle?.members.find((m) => m.user_id === bundle.userId),
    writable = online && verified && !bundle?.trip.archived_at;
  function notify(s: string) {
    setToast(s);
    window.setTimeout(() => setToast(""), 4000);
  }
  async function refresh(tripId?: string) {
    if (demoMode) return;
    const n = ++epoch.current;
    setVerified(false);
    let requestedUserId: string | undefined;
    try {
      const {
        data: { session: activeSession },
      } = await supabase().auth.getSession();
      if (!activeSession)
        throw Object.assign(Error("다시 로그인해 주세요."), { status: 401 });
      requestedUserId = activeSession.user.id;
      if (current.current?.userId !== requestedUserId) {
        setBundle(null);
        setSaved("");
        setSelected(null);
        setModal(null);
      }
      const list = await api("list_trips");
      if (n !== epoch.current) return;
      setTrips(list);
      const id =
        tripId ||
        current.current?.trip.id ||
        new URLSearchParams(location.search).get("trip") ||
        list.find((t: Trip) => !t.archived_at)?.id;
      if (!id) {
        setScreen("trips");
        setBundle(null);
        setVerified(true);
        return;
      }
      const atStart = confirmed.current;
      const data: Bundle = await api("get_data", { tripId: id });
      if (n !== epoch.current) return;
      setBundle(b => b && atStart && b.userId === data.userId && b.trip.id === id && atStart.trip.id === id
        ? { ...data, items: reconcileItems(data.items, b.items, atStart.items) } : data);
      if (!new URLSearchParams(location.search).get("date")) {
        const today = localDate(data.trip.timezone);
        setDate(
          today >= data.trip.start_date && today <= data.trip.end_date
            ? today
            : data.trip.start_date,
        );
      }
      setSession(true);
      setVerified(true);
      setScreen("travel");
      const prior = await loadSnapshot(data.userId, data.trip.id);
      if (n === epoch.current) setSaved(prior?.savedAt || "");
    } catch (e: any) {
      if (n !== epoch.current) return;
      setError(e.message);
      if (e.status === 401 || e.status === 404) {
        await clearSnapshots();
        setBundle(null);
        setSession(false);
        setScreen("login");
      } else {
        const snap = requestedUserId
          ? await loadSnapshot(
              requestedUserId,
              tripId || current.current?.trip.id,
            )
          : null;
        if (snap) {
          setBundle(snap.bundle);
          setSaved(snap.savedAt);
        } else {
          setBundle(null);
          setSaved("");
        }
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setView(q.get("view") || "home");
    setScope(q.get("scope") || "all");
    if (q.get("date")) setDate(q.get("date")!);
    const init = async () => {
      setOnline(navigator.onLine);
      if ("serviceWorker" in navigator)
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      if (!navigator.onLine) {
        const snap = await loadSnapshot();
        if (snap) {
          setBundle(snap.bundle);
          setSaved(snap.savedAt);
          setScreen("travel");
        } else
          setError(
            "이 기기에 저장된 여행이 없습니다. 온라인에서 여행을 저장해 주세요.",
          );
        setLoading(false);
        return;
      }
      if (demoMode) {
        try {
          const records = JSON.parse(
            localStorage.getItem("tt-demo-trips") || "null",
          ) as Bundle[] | null;
          const initial =
            records?.find((x) => x.trip.id === q.get("trip")) ||
            records?.[0] ||
            seed();
          setBundle(initial);
          if (!q.get("date")) {
            const today = localDate(initial.trip.timezone);
            setDate(
              today >= initial.trip.start_date && today <= initial.trip.end_date
                ? today
                : initial.trip.start_date,
            );
          }
          setTrips((records || [initial]).map((x) => x.trip));
          setSession(true);
          setVerified(true);
          const snap = await loadSnapshot(initial.userId, initial.trip.id);
          if (snap) setSaved(snap.savedAt);
        } catch {
          setBundle(seed());
          setVerified(true);
        }
        setLoading(false);
        return;
      }
      const {
        data: { session: s },
      } = await supabase().auth.getSession();
      setSession(!!s);
      if (!s) {
        setScreen("login");
        setLoading(false);
        return;
      }
      if (q.get("token")) {
        try {
          const info = await api("invite_info", { token: q.get("token") });
          if (info.trip_id) {
            history.replaceState(null, "", "/travel/");
            await refresh(info.trip_id);
            return;
          }
          setInviteInfo(info);
          setScreen("invite");
          setLoading(false);
        } catch (e: any) {
          setError(e.message);
          setLoading(false);
        }
        return;
      }
      await refresh();
    };
    let authSubscription: { unsubscribe: () => void } | undefined;
    if (
      !demoMode &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      authSubscription = supabase().auth.onAuthStateChange((event, next) => {
        const changedAccount =
          event === "SIGNED_IN" &&
          next &&
          current.current &&
          current.current.userId !== next.user.id;
        if (event === "SIGNED_OUT" || changedAccount) {
          epoch.current++;
          localStorage.setItem("tt-cache-locked", "1");
          setBundle(null);
          setVerified(false);
          setSaved("");
          setSelected(null);
          setModal(null);
          setSession(false);
          setScreen("login");
          void clearSnapshots().catch(() => {});
          if (changedAccount) window.setTimeout(() => location.reload(), 0);
        }
      }).data.subscription;
    }
    void init().catch((e) => {
      setError(e.message || "기기 저장소를 열 수 없습니다.");
      setLoading(false);
    });
    const off = async () => {
      const generation = ++epoch.current;
      setOnline(false);
      setVerified(false);
      setModal(null);
      setSelected(null);
      const b = current.current;
      const s = await loadSnapshot(b?.userId, b?.trip.id);
      if (generation !== epoch.current) return;
      setBundle(s?.bundle || null);
      setSaved(s?.savedAt || "");
      if (!s) setError("이 여행은 오프라인에 저장되지 않았습니다.");
    };
    const on = () => {
      epoch.current++;
      setOnline(true);
      if (demoMode) {
        const records = JSON.parse(
          localStorage.getItem("tt-demo-trips") || "[]",
        );
        const b =
          records.find((x: Bundle) => x.trip.id === current.current?.trip.id) ||
          seed();
        setBundle(b);
        setVerified(true);
      } else void refresh();
    };
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    const channel = new BroadcastChannel("tt-session");
    channel.onmessage = async (e) => {
      if (e.data === "logout") {
        epoch.current++;
        await clearSnapshots();
        setBundle(null);
        setVerified(false);
        setScreen("login");
      }
    };
    const focus = () => {
      if (!demoMode && navigator.onLine && current.current) void refresh();
    };
    window.addEventListener("focus", focus);
    return () => {
      channel.close();
      authSubscription?.unsubscribe();
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
      window.removeEventListener("focus", focus);
    };
  }, []);
  useEffect(() => {
    if (!bundle) return;
    const u = new URL(location.href);
    u.pathname = "/travel/";
    u.searchParams.set("trip", bundle.trip.id);
    u.searchParams.set("view", view);
    u.searchParams.set("date", date);
    u.searchParams.set("scope", scope);
    history.replaceState(null, "", u);
    setSearch("");
    setStatus("all");
    setAssignee("all");
  }, [view, date, scope, bundle?.trip.id]);
  function commit(b: Bundle) {
    setBundle(b);
    const records: Bundle[] = JSON.parse(
      localStorage.getItem("tt-demo-trips") || "[]",
    );
    const next = [b, ...records.filter((x) => x.trip.id !== b.trip.id)];
    localStorage.setItem("tt-demo-trips", JSON.stringify(next));
    setTrips(next.map((x) => x.trip));
  }
  async function command(
    action: string,
    payload: any,
    local?: (b: Bundle) => Bundle,
  ) {
    if (!writable && action !== "save_trip")
      throw Error(
        "현재 읽기 전용입니다. 온라인 연결과 여행 상태를 확인해 주세요.",
      );
    if (!navigator.onLine || !verified)
      throw Error("연결을 확인한 후 다시 시도해 주세요.");
    setBusy(true);
    setError("");
    try {
      if (demoMode) {
        if (local && bundle) {
          const b = local(structuredClone(bundle));
          b.serverTime = new Date().toISOString();
          commit(b);
          if (saved) setSaved(await saveSnapshot(b));
        }
        return null;
      }
      const result = await api(action, payload);
      await refresh(payload.tripId);
      return result;
    } catch (e: any) {
      setError(
        e.status === 409
          ? "다른 사용자가 먼저 변경했습니다. 입력 내용은 유지됩니다. 최신 내용을 불러와 비교해 주세요."
          : e.message,
      );
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const visible = (kind: Kind) =>
    bundle?.items.filter(
      (x) =>
        x.kind === kind &&
        user &&
        canRead(x, user) &&
        (scope === "all" || x.scope === scope) &&
        !!x.deleted_at === trash,
    ) || [];
  const itinerary = visible("itinerary")
    .filter((x) => onDate(x, date) && x.data.status !== "취소")
    .sort((a, b) => (a.data.start || "99").localeCompare(b.data.start || "99"));
  const checks = visible("checklist"),
    tasks = visible("tasks"),
    done = checks.filter(complete).length,
    percent = checks.length ? Math.round((done / checks.length) * 100) : 0;
  // Home always follows the current family's readable schedule, regardless of tab filters.
  const nextPlaceItem = bundle?.items
    .filter(
      (x) =>
        x.kind === "itinerary" &&
        !x.deleted_at &&
        x.data.status !== "취소" &&
        x.data.place_id &&
        user &&
        canRead(x, user),
    )
    .filter(
      (x) =>
        zonedInstant(
          x.data.date,
          x.data.start || "23:59",
          x.data.startZone || bundle.trip.timezone,
        ) >= (localDate(bundle.trip.timezone) < bundle.trip.start_date ? zonedInstant(bundle.trip.start_date, "00:00", bundle.trip.timezone) : Date.now()),
    )
    .sort(
      (a, b) =>
        zonedInstant(
          a.data.date,
          a.data.start || "23:59",
          a.data.startZone || bundle!.trip.timezone,
        ) -
        zonedInstant(
          b.data.date,
          b.data.start || "23:59",
          b.data.startZone || bundle!.trip.timezone,
        ),
    )[0];
  const stays = itinerary.filter((x) => x.data.type === "숙박");
  // On a hotel changeover day, the new check-in takes precedence.
  const currentStay = stays.sort((a, b) => b.data.date.localeCompare(a.data.date))[0];
  const nextPlace = bundle?.items.find(
    (x) =>
      x.id === nextPlaceItem?.data.place_id &&
      user &&
      canRead(x, user) &&
      !x.deleted_at,
  );
  const urgent = tasks.filter((x) =>
    dueSoon(x, bundle?.trip.timezone || "Asia/Taipei"),
  );
  const title = tabs.find((x) => x[0] === view)?.[1] || "여행 홈";
  useEffect(() => {
    if (!pending.length && !failed.length) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending.length, failed.length]);

  const hasSnapshot = Boolean(saved);
  useEffect(() => {
    if (!base || demoMode || !verified || !hasSnapshot) return;
    let live = true;
    const timer = setTimeout(() => {
      void saveSnapshot(base).then(time => { if (live) setSaved(time); })
        .catch(() => { if (live) setError("오프라인 저장본을 갱신하지 못했습니다."); });
    }, 200);
    return () => { live = false; clearTimeout(timer); };
  }, [base, verified, hasSnapshot]);
  // Only an invalidation travels over the channel. RLS determines the rows each reader receives.
  useEffect(() => {
    if (demoMode || !base || !verified || !online) return;
    const { userId, trip } = base;
    let live = true, generation = 0;
    let timer: ReturnType<typeof setTimeout>;
    const sync = async () => {
      const n = ++generation;
      const start = confirmed.current;
      if (!start) return;
      const rows: Item[] = [];
      const pageSize = 500;
      for (let offset = 0; live && n === generation; offset += pageSize) {
        const { data, error } = await supabase().from("travel_items")
          .select("id,trip_id,kind,title,scope,family_id,owner_id,version,created_at,deleted_at,data")
          .eq("trip_id", trip.id).order("id").range(offset, offset + pageSize - 1);
        if (error || !data) return;
        rows.push(...data as Item[]);
        if (data.length < pageSize) break;
      }
      if (!live || n !== generation) return;
      setBundle(b => b?.userId === userId && b.trip.id === trip.id
        ? { ...b, items: reconcileItems(rows, b.items, start.items) } : b);
    };
    const ch = supabase().channel("travel-items-" + trip.id)
      .on("broadcast", { event: "changed" }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => void sync(), 120);
      }).subscribe();
    channel.current = ch;
    return () => { live = false; clearTimeout(timer); channel.current = null; void supabase().removeChannel(ch); };
  }, [base?.userId, base?.trip.id, online, verified]);

  function queueWrite(op: ItemWrite) {
    if (!writable || !navigator.onLine) throw Error("온라인 연결과 편집 권한을 확인해 주세요.");
    const key = [op.userId, op.item.trip_id, op.item.id, op.expectedVersion].join("/");
    if (activeWrites.current.has(key)) return;
    activeWrites.current.add(key);
    queued.current.add(op);
    setPending(rows => [...rows, op]);
    tail.current = tail.current.then(async () => {
      const same = (b: Bundle | null) => b?.userId === op.userId && b.trip.id === op.item.trip_id;
      try {
        if (invalidatedWrites.current.has(op))
          throw Error("앞선 변경을 저장하지 못했습니다. 입력 내용을 확인해 주세요.");
        const payload = { tripId: op.item.trip_id, expectedVersion: op.expectedVersion,
          ...(op.action === "save_item" ? { item: op.item } : { itemId: op.item.id, checked: op.checked }) };
        const result = await api(op.action, payload, op.userId);
        setBundle(b => {
          if (!b || !same(b)) return b;
          let items = applyWrite(b.items, op);
          const row: Item | undefined = result?.row;
          if (row) items = items.map(x => x.id === row.id && x.version <= row.version ? row : x);
          return { ...b, items };
        });
        if (same(current.current)) void channel.current?.send({ type: "broadcast", event: "changed", payload: {} }).catch(() => {});
      } catch (err) {
        for (const later of queued.current) {
          if (later !== op && later.item.id === op.item.id && later.userId === op.userId)
            invalidatedWrites.current.add(later);
        }
        setFailed(rows => [...rows, {op, reason: err instanceof Error ? err.message : "연결 오류"}]);
        if (same(current.current) && navigator.onLine) {
          const { data, error } = await supabase().from("travel_items").select("*")
            .eq("trip_id", op.item.trip_id).eq("id", op.item.id).maybeSingle();
          if (!error) setBundle(b => {
            if (!b || !same(b)) return b;
            const items = b.items.filter(x => x.id !== op.item.id);
            const old = b.items.find(x => x.id === op.item.id);
            if (data) items.push(old && old.version > data.version ? old : data as Item);
            return { ...b, items };
          });
        }
      } finally {
        queued.current.delete(op);
        invalidatedWrites.current.delete(op);
        activeWrites.current.delete(key);
        setPending(rows => rows.filter(x => x !== op));
      }
    }).catch(() => {});
  }
  async function saveItem(item: Item, forceEdit = false) {
    validate(item);
    if (!bundle || !user) return;
    const exists = bundle.items.find((x) => x.id === item.id);
    if (exists && !canEdit(exists, user) && !proposal && !publication)
      throw Error("이 항목의 편집 권한이 없습니다.");
    if (publication && !forceEdit) {
      await command(
        "propose_publication",
        {
          tripId: bundle.trip.id,
          itemId: item.id,
          expectedVersion: exists?.version,
          patch: { title: item.title, data: item.data },
        },
        (b) => {
          b.requests.push({
            id: crypto.randomUUID(),
            item_id: item.id,
            base_version: exists!.version,
            before: {},
            patch: { title: item.title, data: item.data },
            status: "pending",
            proposed_by: b.userId,
            request_type: "publication",
          });
          return b;
        },
      );
      notify("선택한 내용을 공동 게시 제안으로 제출했습니다.");
    } else if (proposal && !forceEdit) {
      await command(
        "propose",
        {
          tripId: bundle.trip.id,
          itemId: item.id,
          expectedVersion: exists?.version,
          patch: { title: item.title, data: item.data },
        },
        (b) => {
          b.requests.push({
            id: crypto.randomUUID(),
            item_id: item.id,
            base_version: exists!.version,
            before: exists!,
            patch: { title: item.title, data: item.data },
            status: "pending",
            proposed_by: b.userId,
          });
          return b;
        },
      );
      notify("변경 제안을 제출했습니다.");
    } else if (!demoMode) {
      queueWrite({ action: "save_item", item, expectedVersion: exists ? item.version : 0,
        userId: bundle.userId, at: new Date().toISOString() });
    } else {
      await command(
        "save_item",
        { tripId: bundle.trip.id, item, expectedVersion: exists?.version || 0 },
        (b) => {
          const i = b.items.findIndex((x) => x.id === item.id);
          if (i >= 0) {
            if (b.items[i].version !== exists?.version)
              throw Error("버전이 변경되었습니다.");
            b.items[i] = { ...item, version: item.version + 1 };
          } else b.items.push(item);
          return b;
        },
      );
      notify(exists ? "변경 내용을 저장했습니다." : "새 항목을 추가했습니다.");
    }
    setModal(null);
    setSelected(null);
  }
  async function remove(item: Item, restore = false) {
    if (!bundle) return;
    if (!demoMode) {
      queueWrite({action: restore ? "restore_item" : "delete_item", item, expectedVersion: item.version, userId: bundle.userId, at: new Date().toISOString()});
      setSelected(null);
      return;
    }
    await command(
      restore ? "restore_item" : "delete_item",
      {
        tripId: bundle.trip.id,
        itemId: item.id,
        expectedVersion: item.version,
      },
      (b) => {
        const x = b.items.find((x) => x.id === item.id)!;
        x.deleted_at = restore ? null : new Date().toISOString();
        x.version++;
        if (!restore && ["places", "itinerary"].includes(x.kind))
          b.items = b.items.map((y) => ({
            ...y,
            data: {
              ...y.data,
              ...(y.data.place_id === x.id ? { place_id: null } : {}),
              ...(y.data.itinerary_id === x.id ? { itinerary_id: null } : {}),
            },
          }));
        return b;
      },
    );
    setSelected(null);
    notify(restore ? "복구했습니다." : "휴지통으로 이동했습니다.");
  }
  async function toggle(item: Item) {
    if (!bundle || !user) return;
    const a = item.data.assignees || [];
    if (a.length && !a.includes(user.user_id)) {
      notify("지정된 담당자만 자신의 준비 상태를 체크할 수 있습니다.");
      return;
    }
    const checked = a.length
      ? !(item.data.checked || []).includes(user.user_id)
      : !complete(item);
    if (!demoMode) {
      queueWrite({action: "check_item", item, expectedVersion: item.version, userId: bundle.userId, checked, at: new Date().toISOString()});
      return;
    }
    await command(
      "check_item",
      {
        tripId: bundle.trip.id,
        itemId: item.id,
        expectedVersion: item.version,
        checked,
      },
      (b) => {
        const x = b.items.find((x) => x.id === item.id)!;
        if (a.length)
          x.data.checked = checked
            ? [...new Set([...(x.data.checked || []), b.userId])]
            : (x.data.checked || []).filter((id: string) => id !== b.userId);
        else x.data.complete = checked;
        x.version++;
        return b;
      },
    );
  }
  function newItem(kind: Kind) {
    if (!bundle || !user) return;
    setProposal(false);
    setPublication(false);
    setEdit(createDraft(kind, bundle, scope, date));
    setModal("item");
  }
  function openEdit(item: Item, asProposal = false) {
    setProposal(asProposal);
    setPublication(false);
    setEdit(structuredClone(item));
    setModal("item");
  }
  async function offlineSave() {
    if (!bundle || !verified) return;
    setBusy(true);
    try {
      if (!("serviceWorker" in navigator))
        throw Error("이 브라우저에서 앱 셸 저장을 지원하지 않습니다.");
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg?.active || !(await caches.match("/travel/")))
        throw Error(
          "앱 셸 설치가 완료되지 않았습니다. 잠시 후 다시 저장해 주세요.",
        );
      const s = await saveSnapshot(bundle);
      const check = await loadSnapshot(bundle.userId, bundle.trip.id);
      if (!check) throw Error("저장 확인에 실패했습니다.");
      setSaved(s);
      notify("오프라인 준비 완료 · 비행기 모드에서 다시 열어 확인해 주세요.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    epoch.current++;
    setVerified(false);
    localStorage.setItem("tt-cache-locked", "1");
    try {
      await clearSnapshots();
    } catch {
      setError(
        "기기 저장본 삭제에 실패하여 저장본을 잠갔습니다. 브라우저 저장소를 정리해 주세요.",
      );
    }
    if (!demoMode) await supabase().auth.signOut();
    localStorage.removeItem("tt-demo-trips");
    const ch = new BroadcastChannel("tt-session");
    ch.postMessage("logout");
    ch.close();
    setBundle(null);
    setSession(false);
    setScreen("login");
    setSaved("");
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase().auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: (() => {
            const url = new URL("/invite/", location.origin);
            const token = new URLSearchParams(location.search).get("token");
            if (token) url.searchParams.set("token", token);
            return url.toString();
          })(),
        },
      });
      if (error) throw error;
      notify("로그인 링크를 이메일로 보냈습니다.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function goto(v: string) {
    setView(v);
    setTrash(false);
    setMenu(false);
    setSelected(null);
    window.scrollTo({ top: 0 });
  }
  if (loading)
    return (
      <div className="center-screen">
        <div className="brand-icon">
          <Anchor size={30} />
        </div>
        <h2>여행을 불러오고 있어요</h2>
        <Loader2 className="spin" />
      </div>
    );
  if (screen === "login")
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="brand-icon">
            <Anchor />
          </div>
          <h1>함께 준비하는 여행</h1>
          <p>Travel Together에서 우리 가족의 다음 여행을 만나보세요.</p>
          {demoMode ? (
            <>
              <div className="notice">
                현재 샘플 체험 버전입니다. 로그인과 기기 간 공유는 Supabase 연결
                후 사용할 수 있습니다.
              </div>
              <button
                className="primary"
                onClick={() => {
                  commit(seed());
                  setVerified(true);
                  setSession(true);
                  setScreen("travel");
                }}
              >
                샘플 여행 열기
              </button>
            </>
          ) : (
            <form onSubmit={login}>
              <label>
                이메일
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </label>
              <button className="primary" disabled={busy}>
                <Mail size={18} />
                로그인 링크 받기
              </button>
            </form>
          )}
          {error && <p className="error">{error}</p>}
        </div>
        {toast && (
          <div role="status" className="toast">
            {toast}
          </div>
        )}
      </main>
    );
  if (screen === "invite")
    return (
      <main className="auth-page">
        <div className="auth-card">
          <Users />
          <h1>가족여행에 초대받으셨어요</h1>
          <h2>{inviteInfo?.title}</h2>
          <p>{inviteInfo?.family_name} · 참여자</p>
          <button
            className="primary"
            onClick={async () => {
              try {
                const result = await api("accept_invite", {
                  token: new URLSearchParams(location.search).get("token"),
                });
                history.replaceState(null, "", "/travel/");
                await refresh(result.trip_id);
              } catch (e: any) {
                setError(e.message);
              }
            }}
          >
            초대 수락
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      </main>
    );
  if (!bundle && screen !== "trips")
    return (
      <div className="center-screen">
        <WifiOff />
        <h1>여행을 열 수 없습니다</h1>
        <p>{error || "온라인 연결 후 다시 시도해 주세요."}</p>
        <button className="primary" onClick={() => location.reload()}>
          다시 확인
        </button>
      </div>
    );
  const DateTabs = () => (
    <div className="date-tabs">
      {bundle &&
        dates(bundle.trip.start_date, bundle.trip.end_date).map((d, i) => (
          <button
            key={d}
            aria-label={shortDate(d)}
            aria-pressed={date === d}
            className={date === d ? "active" : ""}
            onClick={() => setDate(d)}
          >
            <span>DAY {i + 1}</span>
            <strong>
              {d.slice(5).replace("-", ".")}
              <small>
                {new Date(d + "T12:00:00Z").toLocaleDateString("ko-KR", {
                  weekday: "short",
                  timeZone: "UTC",
                })}
              </small>
            </strong>
          </button>
        ))}
    </div>
  );
  const ScopeBadge = ({ item }: { item: Item }) => (
    <span className={"scope-badge " + item.scope}>
      {item.scope === "personal" ? <Lock size={11} /> : <Users size={11} />}{" "}
      {scopeLabel(item.scope)}
    </span>
  );
  const StatusBadge = ({ value }: { value: string }) => (
    <span
      className={
        "status-badge " +
        (value === "확정" || value === "완료"
          ? "confirmed"
          : value === "확인 필요" || value === "진행"
            ? "pending"
            : "neutral")
      }
    >
      {value}
    </span>
  );
  const ItineraryCard = ({
    item,
    compact = false,
  }: {
    item: Item;
    compact?: boolean;
  }) => {
    const Icon = icons[item.data.type] || CalendarDays;
    const place = bundle?.items.find(
      (x) =>
        x.id === item.data.place_id &&
        user &&
        canRead(x, user) &&
        !x.deleted_at,
    );
    return (
      <div className={"timeline-row " + (compact ? "compact" : "")}>
        <div className="timeline-time">
          <strong>{item.data.start || "미정"}</strong>
          <span>
            {item.data.start
              ? item.data.startZone === "Asia/Seoul"
                ? "한국 시각"
                : "대만 시각"
              : null}
          </span>
        </div>
        <div
          className={
            "timeline-icon " + (item.data.type === "항공" ? "blue" : "")
          }
        >
          <Icon size={20} />
        </div>
        <button className="itinerary-card" onClick={() => setSelected(item)}>
          <div className="item-top">
            <span className="eyebrow">{item.data.type}</span>
            <StatusBadge value={item.data.status} />
          </div>
          <h3>{item.title}</h3>
          {place && (
            <p className="place-line">
              <MapPin size={14} />
              {place.title}
            </p>
          )}
          {item.data.start && item.data.end && (
            <p className="flight-time">
              {item.data.start}{" "}
              {item.data.startZone === "Asia/Seoul" ? "ICN" : "KHH"}{" "}
              <span>—</span> {item.data.end}{" "}
              {item.data.endZone === "Asia/Seoul" ? "ICN" : "KHH"}
            </p>
          )}
          <div className="item-bottom">
            <ScopeBadge item={item} />
            {item.data.endDate && item.data.endDate !== item.data.date && (
              <span>
                {item.data.date.slice(5)} ~ {item.data.endDate.slice(5)}
              </span>
            )}
            <ChevronRight size={16} />
          </div>
        </button>
      </div>
    );
  };
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <a className="brand" href="/travel/">
          <span className="brand-icon">
            <Anchor size={24} />
          </span>
          <span>
            travel<span className="brand-light">together</span>
          </span>
        </a>
        <button className="trip-switch" onClick={() => setScreen("trips")}>
          <span className="trip-emoji">🏝️</span>
          <span>
            <small>지금 준비하는 여행</small>
            <strong>{bundle?.trip.title || "내 여행"}</strong>
          </span>
          <ChevronDown size={16} />
        </button>
        <div className="nav-label">OUR JOURNEY</div>
        <nav>
          {tabs.map(([key, label, Icon]) => (
            <button
              key={key}
              className={view === key && screen === "travel" ? "active" : ""}
              onClick={() => {
                setScreen("travel");
                goto(key);
              }}
            >
              <Icon size={20} />
              <span>{label}</span>
              {key === "tasks" &&
                tasks.filter((x) => !complete(x)).length > 0 && (
                  <small>{tasks.filter((x) => !complete(x)).length}</small>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="travel-tip">
            <Palmtree size={23} />
            <strong>서두르지 않아도 괜찮아요</strong>
            <p>
              아기와 함께, 우리 가족의
              <br />
              속도로 여행해요.
            </p>
          </div>
          <div className="profile">
            <div className="avatar">준</div>
            <div>
              <strong>
                {user?.display_name || "여행자"}
                <small>
                  {user?.role === "admin" ? "여행 관리자" : "여행 참여자"}
                </small>
              </strong>
            </div>
            <button
              className="icon-button"
              aria-label="로그아웃"
              onClick={logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="메뉴"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            우리의 여행 <span>/</span>{" "}
            <strong>{screen === "trips" ? "여행 목록" : title}</strong>
          </div>
          <div className="top-actions">
            <span
              className={
                "connection " + (!online || !verified ? "offline" : "")
              }
            >
              {online && verified ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
              {online && verified ? "온라인" : "읽기 전용"}
            </span>
            <button
              className="icon-button"
              title="새로고침"
              aria-label="새로고침"
              onClick={() =>
                demoMode ? notify("샘플 데이터가 최신 상태입니다.") : refresh()
              }
              disabled={!online || busy}
            >
              <RefreshCw size={18} className={busy ? "spin" : ""} />
            </button>
            <div className="avatar small">준</div>
          </div>
        </header>
        {demoMode && (
          <div className="demo-banner">
            <span>
              <span className="demo-dot" />
              샘플 체험 버전
            </span>
            <span>
              변경 내용은 이 브라우저에만 저장됩니다. 로그인·공동 저장은 연결 후
              제공됩니다.
            </span>
          </div>
        )}
        {(!online || !verified) && (
          <div className="offline-banner">
            <WifiOff size={18} />
            <div>
              <strong>저장된 여행을 읽고 있습니다</strong>
              <span>
                {saved
                  ? `${timeText(saved)} 저장본 · 변경 기능은 사용할 수 없습니다.`
                  : "서버 확인 전까지 변경할 수 없습니다."}
              </span>
            </div>
          </div>
        )}
        {error && (
          <div role="alert" className="error-banner">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label="오류 닫기"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {failed.filter(({op}) => op.userId === bundle?.userId && op.item.trip_id === bundle.trip.id).map(f => (
          <div className="error-banner" role="alert" key={f.op.item.id + f.op.at}>
            <span>{f.op.item.title} 저장 확인 실패 · {f.reason}</span>
            <button disabled={!writable} onClick={() => {
              const old = bundle!.items.find(x => x.id === f.op.item.id);
              if (f.op.action === "save_item") openEdit({ ...f.op.item, version: old?.version ?? 1 });
              else if (old) queueWrite({ ...f.op, item: old, expectedVersion: old.version, at: new Date().toISOString() });
              setFailed(rows => rows.filter(x => x !== f));
            }}>{f.op.action === "save_item" ? "입력 내용 복구" : "다시 시도"}</button>
          </div>
        ))}
        <main className="main-content">
          {screen === "trips" ? (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">OUR TRIPS</p>
                  <h1>우리의 다음 여행</h1>
                  <p>함께한 순간도, 앞으로의 설렘도 한곳에.</p>
                </div>
                <button
                  className="primary"
                  disabled={!online}
                  onClick={() => setModal("trip")}
                >
                  <Plus size={18} />새 여행
                </button>
              </div>
              <div className="trip-grid">
                {trips.map((t) => (
                  <button
                    className="trip-card"
                    key={t.id}
                    onClick={async () => {
                      if (demoMode) {
                        const records = JSON.parse(
                          localStorage.getItem("tt-demo-trips") || "[]",
                        );
                        const b =
                          records.find((x: Bundle) => x.trip.id === t.id) ||
                          (t.id === seed().trip.id ? seed() : null);
                        if (b) {
                          setBundle(b);
                          setDate(b.trip.start_date);
                          setScreen("travel");
                          goto("home");
                        }
                      } else {
                        await refresh(t.id);
                        setDate(t.start_date);
                      }
                    }}
                  >
                    <div className="trip-art">
                      <Harbor />
                    </div>
                    <div>
                      <span className="eyebrow">
                        {t.archived_at ? "보관된 여행" : "FAMILY TRIP"}
                      </span>
                      <h2>{t.title}</h2>
                      <p>
                        {t.start_date} — {t.end_date}
                      </p>
                      <span className="text-link">
                        여행 열기 <ChevronRight size={16} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            bundle && (
              <>
                {view === "home" && (
                  <>
                    <div className="page-heading">
                      <div>
                        <p className="eyebrow">
                          A LITTLE PLANNING, A LOT OF MEMORIES
                        </p>
                        <h1>
                          {bundle.trip.title}
                          <span className="heading-dot">.</span>
                        </h1>
                        <p>일정과 남은 할 일을 먼저 확인해 주세요.</p>
                      </div>
                      <button
                        className="secondary"
                        onClick={() => goto("settings")}
                      >
                        <Users size={17} />
                        여행 멤버
                      </button>
                    </div>
                    <div className="filter-bar home-scope">
                      <div className="segmented">
                        {[
                          ["all", "전체"],
                          ["trip", "공동"],
                          ["family", "우리 가족"],
                          ["personal", "나만"],
                        ].map(([key, label]) => (
                          <button
                            key={key}
                            className={scope === key ? "active" : ""}
                            onClick={() => setScope(key)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="overview-cards">
                      <button
                        onClick={() => goto("checklist")}
                        className="stat-card stat-checklist"
                      >
                        <div className="stat-icon mint">
                          <ShoppingBag />
                        </div>
                        <div>
                          <p>준비물 완료율</p>
                          <strong>
                            {percent}
                            <small>%</small>
                            <span>
                              {done} / {checks.length}개 완료
                            </span>
                          </strong>
                          <div className="progress">
                            <i style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                        <ChevronRight size={17} />
                      </button>
                      <button
                        onClick={() => goto("tasks")}
                        className="stat-card stat-tasks"
                      >
                        <div className="stat-icon peach">
                          <Flag />
                        </div>
                        <div>
                          <p>남은 할 일</p>
                          <strong>
                            {tasks.filter((x) => !complete(x)).length}
                            <small>개</small>
                            <span>아직 남아 있어요</span>
                          </strong>
                        </div>
                        <ChevronRight size={17} />
                      </button>
                      <button
                        onClick={() => void offlineSave()}
                        disabled={busy || !verified || !online}
                        className="stat-card stat-offline"
                      >
                        <div className="stat-icon lavender">
                          <Cloud />
                        </div>
                        <div>
                          <p>오프라인 준비</p>
                          <strong className="text-stat">
                            {busy ? "저장 중…" : saved ? "저장 완료 · 다시 저장" : "지금 저장"}
                          </strong>
                          <span className="stat-sub">
                            {saved
                              ? timeText(saved) + " 기준"
                              : "출발 전 저장해 주세요"}
                          </span>
                        </div>
                        <ChevronRight size={17} />
                      </button>
                    </div>
                    {nextPlace && (
                      <button
                        className="next-place-bar"
                        onClick={() => setSelected(nextPlace)}
                      >
                        <span className="stat-icon mint">
                          <Navigation size={19} />
                        </span>
                        <span>
                          <small>다음으로 향할 장소</small>
                          <strong>{nextPlace.title}</strong>
                        </span>
                        <span>
                          {nextPlaceItem?.data.date} {nextPlaceItem?.data.start || "시간 미정"}
                        </span>
                        <ChevronRight size={18} />
                      </button>
                    )}
                    <div className="content-grid">
                      <section className="panel schedule-panel">
                        <div className="section-title">
                          <div>
                            <h2>
                              <CalendarDays size={20} />
                              선택한 날짜의 일정
                            </h2>
                            <p>
                              {date === localDate(bundle.trip.timezone)
                                ? "여행지의 오늘 일정이에요."
                                : "선택한 날짜의 여행 계획이에요."}
                            </p>
                          </div>
                          <button
                            className="text-link"
                            onClick={() => goto("itinerary")}
                          >
                            전체 보기 <ChevronRight size={15} />
                          </button>
                        </div>
                        <DateTabs />
                        <div className="timeline">
                          {itinerary.length ? (
                            itinerary.map((x) => (
                              <ItineraryCard key={x.id} item={x} compact />
                            ))
                          ) : (
                            <Empty
                              text="아직 정해진 일정이 없어요"
                              sub="여유로운 하루를 계획해 보세요."
                            />
                          )}
                        </div>
                      </section>
                      <div className="right-column">
                        <section className="panel">
                          <div className="section-title">
                            <h2>
                              <Flag size={19} />
                              먼저 확인할 일
                            </h2>
                            <button
                              className="text-link"
                              onClick={() => goto("tasks")}
                            >
                              모두 보기
                            </button>
                          </div>
                          <p className="section-description">
                            {urgent.length
                              ? "연체 또는 48시간 안에 마감되는 할 일이에요."
                              : "마감 임박 항목이 없어, 남은 할 일을 보여드려요."}
                          </p>
                          <div className="mini-tasks">
                            {(urgent.length
                              ? urgent
                              : tasks.filter((x) => !complete(x))
                            )
                              .slice(0, 3)
                              .map((x) => (
                                <button
                                  key={x.id}
                                  onClick={() => setSelected(x)}
                                >
                                  <span className="task-box" />
                                  <div>
                                    <strong>{x.title}</strong>
                                    <span>
                                      {x.data.deadline
                                        ? shortDate(x.data.deadline)
                                        : "마감일 미정"}{" "}
                                      <i>·</i> {scopeLabel(x.scope)}
                                    </span>
                                  </div>
                                  {x.data.priority === "높음" && (
                                    <span
                                      className="priority-dot"
                                      title="높은 우선순위"
                                    />
                                  )}
                                </button>
                              ))}
                          </div>
                        </section>
                        <section className="family-note">
                          <span className="family-note-icon">
                            <Baby size={26} />
                          </span>
                          <div>
                            <p className="eyebrow">LITTLE TRAVELERS</p>
                            <h3>작은 여행자의 큰 하루</h3>
                            <p>
                              낮잠과 식사 사이, 여유를 남겨 주세요. 즐거운 여행은 아기 컨디션부터.
                            </p>
                          </div>
                        </section>
                        <div className="sync-caption">
                          <Cloud size={14} />
                          {demoMode
                            ? "이 브라우저의 샘플 데이터"
                            : `마지막 조회 ${timeText(bundle.serverTime)}`}
                        </div>
                      </div>
                    </div>
                    <section className="trip-hero">
                      <div className="hero-copy">
                        <span className="hero-tag">
                          <Palmtree size={14} />{" "}
                          {bundle.trip.id === seed().trip.id
                            ? "TAIWAN · FAMILY TRIP"
                            : "OUR FAMILY TRIP"}
                        </span>
                        <h2>{bundle.trip.title}</h2>
                        <p>
                          {bundle.trip.start_date.replaceAll("-", ".")} —{" "}
                          {bundle.trip.end_date.replaceAll("-", ".")}{" "}
                          <span>
                            {dates(bundle.trip.start_date, bundle.trip.end_date)
                              .length - 1}
                            박{" "}
                            {
                              dates(
                                bundle.trip.start_date,
                                bundle.trip.end_date,
                              ).length
                            }
                            일
                          </span>
                        </p>
                        <div className="hero-meta">
                          <span>
                            <Users size={15} />
                            {bundle.families.length}가족
                          </span>
                          <span>
                            <Clock size={15} />
                            {bundle.trip.timezone}
                          </span>
                        </div>
                      </div>
                      <Harbor />
                      <div className="hero-bottom">
                        <span>
                          <Baby size={16} />
                          {bundle.trip.id === seed().trip.id
                            ? "11/29 오후부터 우리 가족 일정"
                            : "우리 가족의 속도로, 여유롭게 여행해요"}
                        </span>
                        <button onClick={() => goto("itinerary")}>
                          전체 일정 보기 <ChevronRight size={16} />
                        </button>
                      </div>
                    </section>
                  </>
                )}
                {view !== "home" && (
                  <>
                    <div className="page-heading">
                      <div>
                        <p className="eyebrow">
                          {view === "settings"
                            ? "TRAVEL SETTINGS"
                            : "TOGETHER, WELL PREPARED"}
                        </p>
                        <h1>
                          {
                            {
                              itinerary: "우리의 여행 일정",
                              places: "가고 싶은 곳, 머무를 곳",
                              checklist: "하나씩 챙기는 설렘",
                              tasks: "출발 전, 잊지 않도록",
                              settings: "우리 여행 설정",
                            }[view]
                          }
                        </h1>
                        <p>
                          {
                            {
                              itinerary:
                                "빼곡한 계획보다, 함께할 시간을 담아요.",
                              places:
                                "일정에 연결하고, 길찾기로 편하게 이동해요.",
                              checklist: "함께 챙기고 각자의 준비도 확인해요.",
                              tasks: "작은 할 일부터 차근차근 준비해요.",
                              settings:
                                "여행 정보와 멤버, 기기 저장 상태를 관리해요.",
                            }[view]
                          }
                        </p>
                      </div>
                      {view !== "settings" && (
                        <button
                          className="primary"
                          disabled={!writable || busy}
                          onClick={() => newItem(view as Kind)}
                        >
                          <Plus size={18} />
                          {
                            {
                              itinerary: "일정",
                              places: "장소",
                              checklist: "준비물",
                              tasks: "할 일",
                            }[view]
                          }{" "}
                          추가
                        </button>
                      )}
                    </div>
                    {view !== "settings" && (
                      <div className="filter-bar">
                        <div className="segmented">
                          {[
                            ["all", "전체"],
                            ["trip", "공동"],
                            ["family", "우리 가족"],
                            ["personal", "나만"],
                          ].map(([key, label]) => (
                            <button
                              key={key}
                              className={scope === key ? "active" : ""}
                              onClick={() => setScope(key)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <div className="filter-actions">
                          <label className="search-field">
                            <Search size={16} />
                            <input
                              placeholder="검색"
                              aria-label="항목 검색"
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                            />
                          </label>
                          {["tasks", "checklist"].includes(view) && (
                            <button
                              className={
                                "icon-button " + (trash ? "is-active" : "")
                              }
                              onClick={() => setTrash(!trash)}
                              aria-label="휴지통"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {view === "itinerary" && (
                      <>
                        <DateTabs />
                        <section className="itinerary-layout">
                          <div className="panel wide-timeline">
                            <div className="section-title">
                              <h2>{shortDate(date)}</h2>
                              <span className="muted">
                                {itinerary.length}개의 일정
                              </span>
                            </div>
                            {currentStay && (
                              <button className="itinerary-card" onClick={() => setSelected(currentStay)}>
                                <strong>오늘의 숙소 · {currentStay.data.date === date ? "체크인" : currentStay.data.endDate === date ? "체크아웃" : "숙박"}</strong>
                                <span> {bundle.items.find((p) => p.id === currentStay.data.place_id)?.title || currentStay.title}</span>
                              </button>
                            )}
                            <div className="timeline">
                              {itinerary
                                .filter((x) => x.data.type !== "숙박")
                                .filter((x) => x.title.includes(search))
                                .map((x) => (
                                  <ItineraryCard key={x.id} item={x} />
                                ))}
                              {!itinerary.length && (
                                <Empty
                                  text="이날은 아직 빈 페이지예요"
                                  sub="우리 가족의 속도로 일정을 더해 보세요."
                                />
                              )}
                            </div>
                          </div>
                          <aside className="itinerary-aside">
                            <div className="panel">
                              <h3>여행의 리듬</h3>
                              <p>
                                대만은 한국보다 1시간 느려요. 항공편은 출발지와
                                도착지의 현지 시각을 각각 표시합니다.
                              </p>
                              <div className="zone-row">
                                <span>한국</span>
                                <strong>UTC +09:00</strong>
                              </div>
                              <div className="zone-row">
                                <span>대만</span>
                                <strong>UTC +08:00</strong>
                              </div>
                            </div>
                            <div className="panel">
                              <h3>공동 일정 변경 제안</h3>
                              <p>
                                참여자는 공동 일정 상세에서 변경을 제안할 수
                                있어요.
                              </p>
                              {bundle.requests.length === 0 ? (
                                <span className="muted">
                                  검토할 제안이 없습니다.
                                </span>
                              ) : (
                                bundle.requests.map((r) => (
                                  <div key={r.id} className="request-row">
                                    <strong>
                                      {r.patch.title || "일정 변경"}
                                    </strong>
                                    <StatusBadge value={r.status} />
                                    <button
                                      className="text-link"
                                      onClick={() => {
                                        setRequestId(r.id);
                                        setEdit(
                                          bundle.items.find(
                                            (x) => x.id === r.item_id,
                                          ) || null,
                                        );
                                        setModal("request");
                                      }}
                                    >
                                      전후 비교
                                    </button>
                                    {user?.role === "admin" &&
                                      r.status === "pending" && (
                                        <div className="button-row">
                                          {["approved", "rejected"].map((s) => (
                                            <button
                                              key={s}
                                              className="secondary small-button"
                                              disabled={!writable || busy}
                                              onClick={async () => {
                                                try {
                                                  await command(
                                                    "review",
                                                    {
                                                      tripId: bundle.trip.id,
                                                      requestId: r.id,
                                                      status: s,
                                                    },
                                                    (b) => {
                                                      const req =
                                                        b.requests.find(
                                                          (x) => x.id === r.id,
                                                        )!;
                                                      const x = b.items.find(
                                                        (x) =>
                                                          x.id === req.item_id,
                                                      )!;
                                                      if (
                                                        req.status !==
                                                          "pending" ||
                                                        (req.request_type !==
                                                          "publication" &&
                                                          x.version !==
                                                            req.base_version)
                                                      )
                                                        throw Error(
                                                          "원본이 변경되어 재제안이 필요합니다.",
                                                        );
                                                      if (s === "approved") {
                                                        if (
                                                          req.request_type ===
                                                          "publication"
                                                        ) {
                                                          b.items.push({
                                                            ...structuredClone(
                                                              x,
                                                            ),
                                                            id: crypto.randomUUID(),
                                                            scope: "trip",
                                                            family_id: null,
                                                            owner_id: null,
                                                            title:
                                                              req.patch.title!,
                                                            data: req.patch
                                                              .data!,
                                                            version: 1,
                                                          });
                                                        } else {
                                                          x.title =
                                                            req.patch.title ||
                                                            x.title;
                                                          x.data = {
                                                            ...x.data,
                                                            ...req.patch.data,
                                                          };
                                                          x.version++;
                                                        }
                                                      }
                                                      req.status = s;
                                                      req.processed_by =
                                                        b.userId;
                                                      return b;
                                                    },
                                                  );
                                                  notify(
                                                    s === "approved"
                                                      ? "제안을 승인했습니다."
                                                      : "제안을 반려했습니다.",
                                                  );
                                                } catch {}
                                              }}
                                            >
                                              {s === "approved"
                                                ? "승인"
                                                : "반려"}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                  </div>
                                ))
                              )}
                            </div>
                          </aside>
                        </section>
                      </>
                    )}
                    {view === "places" && (
                      <Places
                        items={visible("places").filter((x) =>
                          x.title.includes(search),
                        )}
                        itinerary={visible("itinerary")}
                        date={date}
                        online={online}
                        onSelect={setSelected}
                        onDateChange={setDate}
                      />
                    )}
                    {(view === "checklist" || view === "tasks") && (
                      <>
                        <div className="list-summary">
                          <span>
                            {trash
                              ? "휴지통"
                              : view === "checklist"
                                ? `${checks.filter(complete).length} / ${checks.length}개 준비 완료`
                                : `${tasks.filter((x) => x.data.status === "완료").length} / ${tasks.length}개 완료`}
                          </span>
                          <div className="filter-actions">
                            {view === "tasks" && (
                              <>
                                <select
                                  aria-label="담당자 필터"
                                  value={assignee}
                                  onChange={(e) => setAssignee(e.target.value)}
                                >
                                  <option value="all">모든 담당자</option>
                                  <option value="none">미배정</option>
                                  {bundle.members
                                    .filter((m) => m.active)
                                    .map((m) => (
                                      <option key={m.user_id} value={m.user_id}>
                                        {m.display_name}
                                      </option>
                                    ))}
                                </select>
                                <select
                                  aria-label="상태 필터"
                                  value={status}
                                  onChange={(e) => setStatus(e.target.value)}
                                >
                                  <option value="all">모든 상태</option>
                                  {["예정", "진행", "완료"].map((s) => (
                                    <option key={s}>{s}</option>
                                  ))}
                                </select>
                                <select
                                  aria-label="정렬"
                                  value={sort}
                                  onChange={(e) => setSort(e.target.value)}
                                >
                                  <option value="deadline">마감일순</option>
                                  <option value="assignee">담당자순</option>
                                  <option value="priority">우선순위순</option>
                                </select>
                              </>
                            )}
                          </div>
                        </div>
                        {view === "checklist" && !trash && (
                          <div className="progress large">
                            <i style={{ width: `${percent}%` }} />
                          </div>
                        )}
                        {Object.entries(
                          (view === "checklist" ? checks : tasks)
                            .filter(
                              (x) =>
                                x.title.includes(search) &&
                                (status === "all" ||
                                  x.data.status === status) &&
                                (assignee === "all" ||
                                  (assignee === "none" &&
                                    !(x.data.assignees || []).length) ||
                                  (x.data.assignees || []).includes(assignee)),
                            )
                            .sort((a, b) => {
                              if (sort === "priority")
                                return (
                                  ["높음", "보통", "낮음"].indexOf(
                                    a.data.priority,
                                  ) -
                                  ["높음", "보통", "낮음"].indexOf(
                                    b.data.priority,
                                  )
                                );
                              if (sort === "assignee") {
                                const names = (x: Item) =>
                                  (x.data.assignees || [])
                                    .map(
                                      (id: string) =>
                                        bundle.members.find(
                                          (m) => m.user_id === id,
                                        )?.display_name || "",
                                    )
                                    .sort()[0] || "힣";
                                return names(a).localeCompare(names(b), "ko");
                              }
                              return (a.data.deadline || "9999").localeCompare(
                                b.data.deadline || "9999",
                              );
                            })
                            .reduce((acc: Record<string, Item[]>, x) => {
                              const key =
                                view === "checklist"
                                  ? x.data.category || "기본"
                                  : "할 일 목록";
                              (acc[key] ??= []).push(x);
                              return acc;
                            }, {}),
                        ).map(([category, items]) => (
                          <section
                            className={
                              "panel checklist-panel" +
                              (view === "checklist" ? " packing-list" : "")
                            }
                            key={category}
                          >
                            <div className="section-title">
                              <h2>
                                {view === "checklist" ? (
                                  <ShoppingBag size={18} />
                                ) : (
                                  <ListTodo size={18} />
                                )}{" "}
                                {category}
                              </h2>
                              <span className="count-pill">{items.length}</span>
                            </div>
                            {items.map((x) => (
                              <div
                                className={
                                  "list-row " + (complete(x) ? "completed" : "")
                                }
                                key={x.id}
                              >
                                {view === "checklist" && !trash && (
                                  <button
                                    className={
                                      "checkbox " +
                                      (complete(x) ? "checked" : "")
                                    }
                                    disabled={!writable || busy}
                                    aria-label={`${x.title} ${complete(x) ? "완료 해제" : "준비 완료"}`}
                                    onClick={() => toggle(x).catch(() => {})}
                                  >
                                    {complete(x) && <Check size={18} />}
                                  </button>
                                )}
                                <button
                                  className="list-item-main"
                                  onClick={() => setSelected(x)}
                                >
                                  <strong>
                                    {x.title}
                                    {view === "checklist" && (
                                      <span className="quantity">
                                        × {x.data.quantity}
                                      </span>
                                    )}
                                  </strong>
                                  <div className="row-meta">
                                    <ScopeBadge item={x} />
                                    {(view !== "checklist" ||
                                      x.data.deadline) && (
                                      <span>
                                        {x.data.deadline
                                          ? shortDate(x.data.deadline)
                                          : "마감일 미정"}
                                      </span>
                                    )}
                                    {(view !== "checklist" ||
                                      (x.data.assignees || []).length > 0) && (
                                      <span>
                                        {(x.data.assignees || []).length
                                          ? (x.data.assignees || [])
                                              .map(
                                                (id: string) =>
                                                  bundle.members.find(
                                                    (m) => m.user_id === id,
                                                  )?.display_name || "담당자",
                                              )
                                              .join(", ")
                                          : "담당 미정"}
                                      </span>
                                    )}
                                    {view === "checklist" &&
                                      (x.data.assignees || []).length > 0 && (
                                        <span>
                                          {(x.data.checked || []).length}/
                                          {x.data.assignees.length}명 완료
                                        </span>
                                      )}
                                  </div>
                                </button>
                                {trash ? (
                                  <button
                                    className="secondary small-button"
                                    disabled={!writable || busy}
                                    onClick={() =>
                                      remove(x, true).catch(() => {})
                                    }
                                  >
                                    복구
                                  </button>
                                ) : view === "tasks" ? (
                                  <select
                                    aria-label={`${x.title} 상태`}
                                    disabled={!writable || busy}
                                    value={x.data.status}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      saveItem(
                                        {
                                          ...x,
                                          data: { ...x.data, status: value },
                                        },
                                        true,
                                      ).catch(() => {});
                                    }}
                                  >
                                    {["예정", "진행", "완료"].map((s) => (
                                      <option key={s}>{s}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <ChevronRight size={17} />
                                )}
                              </div>
                            ))}
                          </section>
                        ))}
                        {!(view === "checklist" ? checks : tasks).length && (
                          <Empty
                            text={
                              trash
                                ? "휴지통이 비어 있어요"
                                : "아직 등록된 항목이 없어요"
                            }
                            sub="필요한 항목을 추가해 보세요."
                          />
                        )}
                      </>
                    )}
                    {view === "settings" && (
                      <div className="settings-grid">
                        <section className="panel">
                          <h2>
                            <Settings size={19} />
                            여행 기본 정보
                          </h2>
                          <TripSettings
                            bundle={bundle}
                            disabled={
                              !writable || user?.role !== "admin" || busy
                            }
                            onSave={async (patch) => {
                              await command(
                                "save_trip",
                                {
                                  tripId: bundle.trip.id,
                                  expectedVersion: bundle.trip.version,
                                  patch,
                                },
                                (b) => {
                                  b.trip = {
                                    ...b.trip,
                                    ...patch,
                                    version: b.trip.version + 1,
                                  };
                                  return b;
                                },
                              );
                              notify("여행 정보를 저장했습니다.");
                            }}
                          />
                          <div className="setting-footer">
                            <span>
                              {bundle.trip.archived_at
                                ? "보관 중 · 읽기 전용"
                                : "진행 중인 여행"}
                            </span>
                            <button
                              className="secondary"
                              disabled={
                                !online ||
                                !verified ||
                                user?.role !== "admin" ||
                                busy
                              }
                              onClick={async () => {
                                try {
                                  await command(
                                    "save_trip",
                                    {
                                      tripId: bundle.trip.id,
                                      expectedVersion: bundle.trip.version,
                                      patch: {
                                        archived_at: bundle.trip.archived_at
                                          ? null
                                          : new Date().toISOString(),
                                      },
                                    },
                                    (b) => {
                                      b.trip.archived_at = b.trip.archived_at
                                        ? null
                                        : new Date().toISOString();
                                      b.trip.version++;
                                      return b;
                                    },
                                  );
                                } catch {}
                              }}
                            >
                              <Archive size={16} />
                              {bundle.trip.archived_at
                                ? "보관 해제"
                                : "여행 보관"}
                            </button>
                          </div>
                        </section>
                        <section className="panel">
                          <h2>
                            <Users size={19} />
                            함께하는 가족
                          </h2>
                          {bundle.families.map((f) => (
                            <div className="family-setting" key={f.id}>
                              <strong>{f.name}</strong>
                              {f.participation_end && (
                                <small>
                                  {shortDate(f.participation_end)} 오후부터 개별
                                  행동
                                </small>
                              )}
                              {bundle.members
                                .filter((m) => m.active && m.family_id === f.id)
                                .map((m) => (
                                  <div className="member-row" key={m.user_id}>
                                    <div className="avatar small">
                                      {m.display_name.slice(0, 1)}
                                    </div>
                                    <span>{m.display_name}</span>
                                    <span className="muted">
                                      {m.role === "admin" ? "관리자" : "참여자"}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          ))}
                          <button
                            className="secondary"
                            disabled={
                              !writable || user?.role !== "admin" || busy
                            }
                            onClick={() => setModal("invite")}
                          >
                            <Plus size={16} />
                            가족 · 멤버 관리
                          </button>
                        </section>
                        <section className="panel offline-settings">
                          <h2>
                            <Download size={20} />이 기기에 여행 저장
                          </h2>
                          <p>
                            일정 · 장소명 · 주소 · 좌표 · 준비물 · TODO를
                            저장합니다. 자유 메모, 예약 상세, 첨부는 제외합니다.
                          </p>
                          <div
                            className={
                              "storage-state " + (saved ? "ready" : "")
                            }
                          >
                            <Cloud size={23} />
                            <div>
                              <strong>
                                {saved
                                  ? "오프라인 준비 완료"
                                  : "아직 저장하지 않았어요"}
                              </strong>
                              <span>
                                {saved
                                  ? `${timeText(saved)} 저장`
                                  : "출발 전에 온라인에서 저장해 주세요."}
                              </span>
                            </div>
                          </div>
                          <p className="small-note">
                            여행 종료 7일 후 다음 실행 시 삭제됩니다. 오프라인
                            동안 권한 변경을 즉시 반영할 수 없으므로 개인
                            기기에만 저장해 주세요.
                          </p>
                          <div className="button-row">
                            <button
                              className="primary"
                              disabled={!online || !verified || busy}
                              onClick={offlineSave}
                            >
                              <Download size={17} />
                              {saved ? "저장본 갱신" : "오프라인 저장"}
                            </button>
                            <button
                              className="secondary"
                              onClick={async () => {
                                await clearSnapshots();
                                setSaved("");
                                notify("기기 저장본을 삭제했습니다.");
                              }}
                            >
                              <Trash2 size={16} />
                              저장본 삭제
                            </button>
                          </div>
                        </section>
                        <section className="panel">
                          <h2>
                            <CalendarDays size={19} />
                            가오슝 문서의 초기 데이터
                          </h2>
                          <p className="small-note">
                            2026.11.27~12.01 여행에 문서의 항공·숙박·픽업,
                            준비물과 확인할 일을 가져옵니다.
                            예약번호·결제액·주소·좌표는 포함하지 않습니다. 가족
                            일정은 현재 사용자의 가족에 배정합니다.
                          </p>
                          <button
                            className="secondary"
                            disabled={
                              !writable ||
                              user?.role !== "admin" ||
                              busy ||
                              bundle.trip.start_date !== "2026-11-27" ||
                              bundle.trip.end_date !== "2026-12-01"
                            }
                            onClick={async () => {
                              if (
                                !confirm(
                                  "공동 픽업과 현재 가족의 항공·숙박, 확인할 일을 가져올까요? 공동 참석 가족은 설정에 등록된 가족 전체입니다. 기존 데이터는 덮어쓰지 않습니다.",
                                )
                              )
                                return;
                              try {
                                const imported = await kaohsiungImport(bundle);
                                await command(
                                  "import_items",
                                  { tripId: bundle.trip.id, items: imported },
                                  (b) => {
                                    for (const x of imported)
                                      if (
                                        !b.items.some(
                                          (y) =>
                                            y.id === x.id ||
                                            y.data.source_key ===
                                              x.data.source_key,
                                        )
                                      )
                                        b.items.push(x);
                                    return b;
                                  },
                                );
                                notify("문서 기반 초기 데이터를 가져왔습니다.");
                              } catch {}
                            }}
                          >
                            <Download size={17} />
                            문서의 초기 데이터 가져오기
                          </button>
                        </section>
                        <section className="panel">
                          <h2>
                            <ShieldCheck size={19} />
                            공개 범위 안내
                          </h2>
                          <div className="scope-guide">
                            <p>
                              <span className="scope-badge trip">공동</span>여행
                              참여자 전체가 볼 수 있어요.
                            </p>
                            <p>
                              <span className="scope-badge family">
                                우리 가족
                              </span>
                              같은 가족 구성원만 볼 수 있어요.
                            </p>
                            <p>
                              <span className="scope-badge personal">나만</span>
                              작성자 본인만 볼 수 있어요.
                            </p>
                          </div>
                          <p className="small-note">
                            관리자에게도 다른 사람의 개인 항목 열람권은
                            없습니다.
                          </p>
                          <button className="secondary" onClick={logout}>
                            <LogOut size={16} />
                            로그아웃 · 기기 저장 삭제
                          </button>
                        </section>
                      </div>
                    )}
                  </>
                )}
              </>
            )
          )}
          <footer className="footer">
            <Anchor size={13} />
            Travel Together <span>계획은 함께, 추억은 오래.</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav">
        {tabs.slice(0, 5).map(([key, label, Icon]) => (
          <button
            key={key}
            className={view === key ? "active" : ""}
            onClick={() => {
              setScreen("travel");
              goto(key);
            }}
          >
            <Icon size={21} />
            <span>
              {key === "home" ? "홈" : key === "places" ? "장소" : label}
            </span>
          </button>
        ))}
      </nav>
      {selected && bundle && (
        <Detail
          key={selected.id}
          item={selected}
          bundle={bundle}
          writable={writable && !busy}
          onClose={() => setSelected(null)}
          onEdit={() => openEdit(selected)}
          onPropose={() => openEdit(selected, true)}
          onDelete={() => remove(selected).catch(() => {})}
          onSelect={setSelected}
          onScope={async (target) => {
            if (!user) return;
            try {
              if (target === selected.scope) return;
              if (
                selected.scope === "personal" &&
                target === "trip" &&
                selected.kind === "itinerary"
              ) {
                setEdit(structuredClone(selected));
                setPublication(true);
                setProposal(false);
                setSelected(null);
                setModal("item");
                return;
              }
              const preview = demoMode
                ? {
                    message: `${scopeLabel(target)} 범위의 독자에게 공개됩니다. 자유 메모를 포함한 본문을 확인해 주세요. 비공개 상세는 포함하지 않습니다.`,
                  }
                : await api("scope_preview", {
                    tripId: bundle.trip.id,
                    itemId: selected.id,
                    target,
                  });
              if (
                !window.confirm(
                  `${preview.message}\n\n이전 독자의 오프라인 저장본은 즉시 회수되지 않을 수 있습니다. 계속할까요?`,
                )
              )
                return;
              await command(
                "scope_change",
                {
                  tripId: bundle.trip.id,
                  itemId: selected.id,
                  expectedVersion: selected.version,
                  target,
                },
                (b) => {
                  const original = b.items.find((x) => x.id === selected.id)!;
                  const x =
                    original.scope === "family" && target === "personal"
                      ? {
                          ...structuredClone(original),
                          id: crypto.randomUUID(),
                        }
                      : original;
                  x.scope = target;
                  x.family_id = target === "family" ? user.family_id : null;
                  x.owner_id = target === "personal" ? b.userId : null;
                  x.data.assignees = (x.data.assignees || []).filter(
                    (id: string) =>
                      target === "trip" ||
                      (target === "personal" && id === b.userId) ||
                      (target === "family" &&
                        b.members.find((m) => m.user_id === id)?.family_id ===
                          user.family_id),
                  );
                  x.data.checked = [];
                  x.data.complete = false;
                  x.version++;
                  if (x.id !== original.id) b.items.push(x);
                  return b;
                },
              );
              setSelected(null);
              notify("공개 범위를 처리했습니다.");
            } catch (e: any) {
              setError(e.message);
            }
          }}
        />
      )}
      {modal === "item" && edit && bundle && (
        <ItemForm
          item={edit}
          bundle={bundle}
          proposal={proposal}
          publication={publication}
          busy={busy}
          onSave={saveItem}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "trip" && (
        <Modal title="새로운 여행 시작" onClose={() => setModal(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const title = String(f.get("title")),
                start = String(f.get("start")),
                end = String(f.get("end"));
              if (start > end) {
                setError("여행 종료일을 확인해 주세요.");
                return;
              }
              try {
                if (demoMode) {
                  const b = seed();
                  b.trip = {
                    ...b.trip,
                    id: crypto.randomUUID(),
                    title,
                    start_date: start,
                    end_date: end,
                  };
                  b.items = [];
                  b.requests = [];
                  commit(b);
                  setDate(start);
                  setScreen("travel");
                  goto("home");
                } else {
                  const r = await api("create_trip", {
                    title,
                    start_date: start,
                    end_date: end,
                    timezone: "Asia/Taipei",
                    family_name: "우리 가족",
                  });
                  await refresh(r.trip_id);
                  setDate(start);
                }
                setModal(null);
              } catch (e: any) {
                setError(e.message);
              }
            }}
          >
            <label>
              여행 이름
              <input
                name="title"
                required
                placeholder="우리 가족의 다음 여행"
                maxLength={100}
              />
            </label>
            <div className="form-grid">
              <label>
                출발일
                <input type="date" name="start" required />
              </label>
              <label>
                종료일
                <input type="date" name="end" required />
              </label>
            </div>
            <p className="small-note">
              이전 여행 데이터와 예약정보가 포함되지 않은 빈 여행으로
              시작합니다.
            </p>
            <button className="primary">여행 만들기</button>
          </form>
        </Modal>
      )}
      {modal === "invite" && bundle && (
        <Modal title="가족 · 멤버 관리" onClose={() => setModal(null)}>
          {demoMode ? (
            <div className="notice">
              계정 초대와 역할 변경은 Supabase 연결 후 사용할 수 있습니다. 샘플
              화면에서는 실제 초대를 보내지 않습니다.
            </div>
          ) : (
            <>
              <h3>가족 추가</h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  try {
                    await command("add_family", {
                      tripId: bundle.trip.id,
                      name: f.get("name"),
                    });
                    form.reset();
                    notify("가족을 추가했습니다.");
                  } catch {}
                }}
              >
                <div className="inline-form">
                  <input required name="name" placeholder="새 가족 이름" />
                  <button className="secondary">추가</button>
                </div>
              </form>
              <h3>이메일로 초대</h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  try {
                    const result = await command("invite", {
                      tripId: bundle.trip.id,
                      email: f.get("email"),
                      familyId: f.get("family"),
                    });
                    setInviteUrl(
                      location.origin + "/invite/?token=" + result.token,
                    );
                  } catch {}
                }}
              >
                <label>
                  이메일
                  <input name="email" type="email" required />
                </label>
                <label>
                  배정 가족
                  <select name="family">
                    {bundle.families.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="primary">
                  <Mail size={17} />
                  초대 링크 만들기
                </button>
              </form>
              <p className="small-note">
                링크를 복사해 초대 대상에게 전달해 주세요. 로그인 이메일이
                일치하는 사람만 수락할 수 있습니다.
              </p>
              {inviteUrl && (
                <div className="invite-result">
                  <input readOnly value={inviteUrl} />
                  <button
                    className="secondary"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(inviteUrl)
                        .then(() => notify("복사했습니다."))
                    }
                  >
                    <Copy size={16} />
                    복사
                  </button>
                </div>
              )}
              <h3>멤버 권한과 소속</h3>
              {bundle.members
                .filter((m) => m.active)
                .map((m) => (
                  <div className="manage-member" key={m.user_id}>
                    <strong>{m.display_name}</strong>
                    <select
                      value={m.family_id}
                      aria-label="가족 배정"
                      onChange={async (e) => {
                        try {
                          await command("members", {
                            tripId: bundle.trip.id,
                            userId: m.user_id,
                            familyId: e.target.value,
                            role: m.role,
                            active: true,
                          });
                        } catch {}
                      }}
                    >
                      {bundle.families.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="역할"
                      value={m.role}
                      onChange={async (e) => {
                        try {
                          await command("members", {
                            tripId: bundle.trip.id,
                            userId: m.user_id,
                            familyId: m.family_id,
                            role: e.target.value,
                            active: true,
                          });
                        } catch {}
                      }}
                    >
                      <option value="admin">관리자</option>
                      <option value="member">참여자</option>
                    </select>
                    <button
                      className="icon-button danger"
                      aria-label={`${m.display_name} 제외`}
                      onClick={async () => {
                        if (!confirm("이 멤버의 여행 접근을 종료할까요?"))
                          return;
                        try {
                          await command("members", {
                            tripId: bundle.trip.id,
                            userId: m.user_id,
                            familyId: m.family_id,
                            role: m.role,
                            active: false,
                          });
                        } catch {}
                      }}
                    >
                      <X size={17} />
                    </button>
                  </div>
                ))}
            </>
          )}
        </Modal>
      )}
      {modal === "request" && bundle && (
        <Modal title="변경 제안 비교" onClose={() => setModal(null)}>
          {bundle.requests
            .filter((r) => r.id === requestId)
            .map((r) => (
              <div key={r.id}>
                <h3>{r.status}</h3>
                <div className="compare-grid">
                  <div>
                    <span>제출 당시</span>
                    <h4>{r.before.title}</h4>
                    <pre>{JSON.stringify(r.before.data, null, 2)}</pre>
                  </div>
                  <div>
                    <span>제안 내용</span>
                    <h4>{r.patch.title}</h4>
                    <pre>{JSON.stringify(r.patch.data, null, 2)}</pre>
                  </div>
                </div>
                <p>
                  현재 원본: {edit?.title} · 버전 {edit?.version} / 제출 기준{" "}
                  {r.base_version}
                </p>
              </div>
            ))}
        </Modal>
      )}
      {toast && (
        <div role="status" className="toast">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
function Empty({ text, sub }: { text: string; sub: string }) {
  return (
    <div className="empty">
      <Palmtree size={34} />
      <h3>{text}</h3>
      <p>{sub}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  compact = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  compact?: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!compact) return;
    const viewport = window.visualViewport;
    const sync = () =>
      root.current?.style.setProperty(
        "--quick-create-viewport",
        `${viewport?.height || window.innerHeight}px`,
      );
    sync();
    viewport?.addEventListener("resize", sync);
    return () => viewport?.removeEventListener("resize", sync);
  }, [compact]);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = root.current;
    const first = el?.querySelector<HTMLElement>(
      compact ? "input" : "button,input,select,textarea",
    );
    first?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab" && el) {
        const fields = [
          ...el.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
          ),
        ];
        const first = fields[0],
          last = fields[fields.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const unlockScroll = lockBodyScroll(document.body);
    return () => {
      document.removeEventListener("keydown", key);
      unlockScroll();
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={root}
        className={"modal" + (compact ? " quick-create-modal" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" aria-label="닫기" onClick={onClose}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function TripSettings({
  bundle,
  disabled,
  onSave,
}: {
  bundle: Bundle;
  disabled: boolean;
  onSave: (p: Partial<Trip>) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  return (
    <form
      key={bundle.trip.id}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (String(f.get("start_date")) > String(f.get("end_date"))) {
          setMessage("종료일을 확인해 주세요.");
          return;
        }
        try {
          await onSave(Object.fromEntries(f) as Partial<Trip>);
          setMessage("");
        } catch (e: any) {
          setMessage(e.message);
        }
      }}
    >
      <fieldset disabled={disabled}>
        <label>
          여행 이름
          <input
            name="title"
            defaultValue={bundle.trip.title}
            required
            maxLength={100}
          />
        </label>
        <div className="form-grid">
          <label>
            출발일
            <input
              name="start_date"
              type="date"
              defaultValue={bundle.trip.start_date}
              required
            />
          </label>
          <label>
            종료일
            <input
              name="end_date"
              type="date"
              defaultValue={bundle.trip.end_date}
              required
            />
          </label>
        </div>
        <label>
          기준 시간대
          <select name="timezone" defaultValue={bundle.trip.timezone}>
            {[
              "Asia/Taipei",
              "Asia/Seoul",
              "Asia/Tokyo",
              "Asia/Ho_Chi_Minh",
              "Pacific/Guam",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <button className="secondary" type="submit">
          변경 저장
        </button>
      </fieldset>
      {message && <p className="error">{message}</p>}
    </form>
  );
}
export function ItemForm({
  item,
  bundle,
  proposal,
  publication = false,
  busy,
  onSave,
  onClose,
}: {
  item: Item;
  bundle: Bundle;
  proposal: boolean;
  publication?: boolean;
  busy: boolean;
  onSave: (x: Item) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(structuredClone(item)),
    [err, setErr] = useState(""),
    [shareFields, setShareFields] = useState<string[]>([]);
  const data = (k: string, v: any) =>
    setDraft({ ...draft, data: { ...draft.data, [k]: v } });
  const me = bundle.members.find((m) => m.user_id === bundle.userId)!;
  const isNew = !bundle.items.some((x) => x.id === item.id);
  const quickCreate = isNew && !proposal && !publication;
  const names = {
    itinerary: "일정명",
    places: "장소명",
    checklist: "준비물명",
    tasks: "할 일 이름",
  };
  const candidates = bundle.members.filter(
    (m) =>
      m.active &&
      (draft.scope === "trip" ||
        (draft.scope === "family" && m.family_id === me.family_id) ||
        (draft.scope === "personal" && m.user_id === me.user_id)),
  );
  const places = bundle.items.filter(
    (x) =>
      (!publication || x.scope === "trip") &&
      x.kind === "places" &&
      !x.deleted_at &&
      (x.scope === "trip" ||
        (draft.scope === "family" &&
          x.scope === "family" &&
          x.family_id === me.family_id) ||
        (draft.scope === "personal" && canRead(x, me))),
  );
  return (
    <Modal
      title={
        publication
          ? "공동 게시할 내용 선택"
          : proposal
            ? "공동 일정 변경 제안"
            : quickCreate
              ? `${{ itinerary: "일정", places: "장소", checklist: "준비물", tasks: "할 일" }[draft.kind]} 추가`
              : `${isNew ? "새 항목 추가" : "상세 편집"}`
      }
      onClose={onClose}
      compact={quickCreate}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErr("");
          try {
            await onSave(
              publication
                ? {
                    ...draft,
                    data: Object.fromEntries(
                      Object.entries(draft.data).filter(
                        ([key]) =>
                          ["date", "endDate", "type", "status"].includes(key) ||
                          shareFields.includes(key),
                      ),
                    ),
                  }
                : draft,
            );
          } catch (e: any) {
            setErr(e.message);
          }
        }}
      >
        <fieldset disabled={busy}>
          {publication && (
            <div className="notice">
              제목·날짜·유형·상태는 공동 게시에 포함됩니다. 아래에서 추가로
              공유할 필드를 선택해 주세요. 원본 개인 일정은 유지되고 관리자 승인
              후 공동 사본이 생성됩니다.
              <div className="assignee-options">
                {[
                  ["note", "공개 메모"],
                  ["start", "시작 시간"],
                  ["end", "종료 시간"],
                  ["place_id", "장소"],
                ].map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={shareFields.includes(key)}
                      onChange={(e) =>
                        setShareFields(
                          e.target.checked
                            ? [
                                ...shareFields,
                                key,
                                ...(key === "start"
                                  ? ["startZone"]
                                  : key === "end"
                                    ? ["endZone"]
                                    : []),
                              ]
                            : shareFields.filter((x) => x !== key),
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}
          <label>
            {quickCreate ? names[draft.kind] : "제목"}
            <input
              autoFocus
              required
              value={draft.title}
              maxLength={200}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          {quickCreate && draft.kind === "itinerary" && (
            <>
              <label className="quick-create-date">
                날짜
                <input
                  type="date"
                  required
                  value={draft.data.date || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      data: {
                        ...draft.data,
                        date: e.target.value,
                        endDate:
                          draft.data.endDate === draft.data.date ||
                          draft.data.endDate < e.target.value
                            ? e.target.value
                            : draft.data.endDate,
                      },
                    })
                  }
                />
              </label>
            </>
          )}
          <CreateOptions enabled={quickCreate}>
            <div className="form-grid">
              {types[draft.kind].length > 0 && (
                <label>
                  유형
                  <select
                    value={draft.data.type ?? ""}
                    onChange={(e) => data("type", e.target.value || null)}
                  >
                    {(quickCreate || draft.data.type == null) && (
                      <option value="">유형 미지정</option>
                    )}
                    {types[draft.kind].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {draft.kind === "itinerary" && (
              <>
                <div className="form-grid">
                  {!quickCreate && (
                    <>
                      <label>
                        시작 날짜
                        <input
                          type="date"
                          required
                          value={draft.data.date || ""}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              data: {
                                ...draft.data,
                                date: e.target.value,
                                endDate:
                                  draft.data.endDate < e.target.value
                                    ? e.target.value
                                    : draft.data.endDate,
                              },
                            })
                          }
                        />
                      </label>
                    </>
                  )}
                  <label>
                    종료 날짜
                    <input
                      type="date"
                      min={draft.data.date}
                      value={draft.data.endDate || draft.data.date || ""}
                      onChange={(e) => data("endDate", e.target.value)}
                    />
                  </label>
                  <label>
                    시작 시간 · 미정 가능
                    <input
                      type="time"
                      value={draft.data.start || ""}
                      onChange={(e) => data("start", e.target.value || null)}
                    />
                  </label>
                  <label>
                    종료 시간 · 미정 가능
                    <input
                      type="time"
                      value={draft.data.end || ""}
                      onChange={(e) => data("end", e.target.value || null)}
                    />
                  </label>
                  <label>
                    출발지 시간대
                    <select
                      value={draft.data.startZone || "Asia/Taipei"}
                      onChange={(e) => data("startZone", e.target.value)}
                    >
                      <option>Asia/Taipei</option>
                      <option>Asia/Seoul</option>
                    </select>
                  </label>
                  <label>
                    도착지 시간대
                    <select
                      value={draft.data.endZone || "Asia/Taipei"}
                      onChange={(e) => data("endZone", e.target.value)}
                    >
                      <option>Asia/Taipei</option>
                      <option>Asia/Seoul</option>
                    </select>
                  </label>
                  <label>
                    확정 상태
                    <select
                      value={draft.data.status}
                      onChange={(e) => data("status", e.target.value)}
                    >
                      {["확정", "확인 필요", "미정", "취소"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    장소
                    <select
                      value={draft.data.place_id || ""}
                      onChange={(e) => data("place_id", e.target.value || null)}
                    >
                      <option value="">연결 없음</option>
                      {places.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>참여 가족</label>
                <div className="assignee-options">
                  {bundle.families.map((f) => (
                    <label key={f.id}>
                      <input
                        type="checkbox"
                        checked={(draft.data.families || []).includes(f.id)}
                        onChange={(e) =>
                          data(
                            "families",
                            e.target.checked
                              ? [...(draft.data.families || []), f.id]
                              : (draft.data.families || []).filter(
                                  (id: string) => id !== f.id,
                                ),
                          )
                        }
                      />
                      {f.name}
                    </label>
                  ))}
                </div>
              </>
            )}
            {draft.kind === "places" && (
              <>
                <label>
                  주소
                  <input
                    value={draft.data.address || ""}
                    onChange={(e) => data("address", e.target.value)}
                    placeholder="확인된 주소를 입력해 주세요"
                  />
                </label>
                <div className="form-grid">
                  <label>
                    위도
                    <input
                      type="number"
                      min="-90"
                      max="90"
                      step="any"
                      value={draft.data.lat ?? ""}
                      onChange={(e) =>
                        data(
                          "lat",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    />
                  </label>
                  <label>
                    경도
                    <input
                      type="number"
                      min="-180"
                      max="180"
                      step="any"
                      value={draft.data.lng ?? ""}
                      onChange={(e) =>
                        data(
                          "lng",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    />
                  </label>
                </div>
                <p className="small-note">
                  직접 확인한 주소·좌표를 등록해 주세요. 지도 없이도 장소 목록을
                  사용할 수 있습니다.
                </p>
              </>
            )}
            {draft.kind === "checklist" && (
              <div className="form-grid">
                <label>
                  목록 이름
                  <input
                    required
                    value={draft.data.listName || "여행 준비물"}
                    onChange={(e) => data("listName", e.target.value)}
                  />
                </label>
                <label>
                  카테고리
                  <input
                    required
                    value={draft.data.category || "기본"}
                    onChange={(e) => data("category", e.target.value)}
                  />
                </label>
                <label>
                  수량
                  <input
                    type="number"
                    min="1"
                    required
                    value={draft.data.quantity}
                    onChange={(e) => data("quantity", Number(e.target.value))}
                  />
                </label>
              </div>
            )}
            {["checklist", "tasks"].includes(draft.kind) && (
              <>
                <div className="form-grid">
                  <label>
                    마감일 · 미정 가능
                    <input
                      type="date"
                      value={draft.data.deadline || ""}
                      onChange={(e) => data("deadline", e.target.value || null)}
                    />
                  </label>
                  {draft.kind === "tasks" && (
                    <>
                      <label>
                        마감 시간
                        <input
                          type="time"
                          value={draft.data.dueTime || ""}
                          onChange={(e) =>
                            data("dueTime", e.target.value || null)
                          }
                        />
                      </label>
                      <label>
                        우선순위
                        <select
                          value={draft.data.priority}
                          onChange={(e) => data("priority", e.target.value)}
                        >
                          {["높음", "보통", "낮음"].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        상태
                        <select
                          value={draft.data.status}
                          onChange={(e) => data("status", e.target.value)}
                        >
                          {["예정", "진행", "완료"].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                </div>
                <label>
                  관련 일정
                  <select
                    value={draft.data.itinerary_id || ""}
                    onChange={(e) =>
                      data("itinerary_id", e.target.value || null)
                    }
                  >
                    <option value="">연결 없음</option>
                    {bundle.items
                      .filter(
                        (x) =>
                          x.kind === "itinerary" &&
                          !x.deleted_at &&
                          canRead(x, me),
                      )
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label>담당자 · 여러 명 선택 가능</label>
                <div className="assignee-options">
                  {candidates.map((m) => (
                    <label key={m.user_id}>
                      <input
                        type="checkbox"
                        checked={(draft.data.assignees || []).includes(
                          m.user_id,
                        )}
                        onChange={(e) =>
                          data(
                            "assignees",
                            e.target.checked
                              ? [...(draft.data.assignees || []), m.user_id]
                              : (draft.data.assignees || []).filter(
                                  (id: string) => id !== m.user_id,
                                ),
                          )
                        }
                      />
                      {m.display_name}
                    </label>
                  ))}
                </div>
              </>
            )}
            <label>
              {draft.kind === "tasks" ? "설명" : "공개 메모"}
              <textarea
                rows={3}
                value={draft.data.note || ""}
                onChange={(e) => data("note", e.target.value)}
                placeholder="이 항목의 독자에게 함께 보이는 내용입니다. 예약번호는 입력하지 마세요."
              />
            </label>
          </CreateOptions>
          {isNew && (
            <label className="quick-create-scope">
              <span className="sr-only">공개 범위</span>
              <select
                value={draft.scope}
                onChange={(e) => {
                  const s = e.target.value as Scope;
                  setDraft({
                    ...draft,
                    scope: s,
                    family_id: s === "family" ? me.family_id : null,
                    owner_id: s === "personal" ? me.user_id : null,
                    data: {
                      ...draft.data,
                      assignees: [],
                      checked: [],
                      place_id: null,
                    },
                  });
                }}
              >
                {(["trip", "family", "personal"] as Scope[])
                  .filter(
                    (s) =>
                      s !== "trip" ||
                      !["itinerary", "places"].includes(draft.kind) ||
                      me.role === "admin",
                  )
                  .map((s) => (
                    <option key={s} value={s}>
                      {
                        {
                          trip: "여행 멤버 모두에게 공개",
                          family: "우리 가족에게 공개",
                          personal: "나만 보기",
                        }[s]
                      }
                    </option>
                  ))}
              </select>
            </label>
          )}
          {!isNew && (
            <p className="small-note">
              공개 범위는 상세 화면에서 새 독자를 확인한 후 변경할 수 있습니다.
            </p>
          )}
          {err && (
            <p className="error" role="alert">
              {err}
            </p>
          )}
          <div className="form-footer">
            <button className="secondary" type="button" onClick={onClose}>
              취소
            </button>
            <button className="primary" disabled={busy} type="submit">
              {busy ? (
                <Loader2 size={17} className="spin" />
              ) : (
                <Check size={17} />
              )}{" "}
              {proposal || publication ? "제안 제출" : "저장하기"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
function Detail({
  item,
  bundle,
  writable,
  onClose,
  onEdit,
  onPropose,
  onDelete,
  onSelect,
  onScope,
}: {
  item: Item;
  bundle: Bundle;
  writable: boolean;
  onClose: () => void;
  onEdit: () => void;
  onPropose: () => void;
  onDelete: () => void;
  onSelect: (x: Item) => void;
  onScope: (s: Scope) => void;
}) {
  const me = bundle.members.find((x) => x.user_id === bundle.userId)!;
  const edit = canEdit(item, me);
  const place = bundle.items.find(
    (x) => x.id === item.data.place_id && !x.deleted_at && canRead(x, me),
  );
  const linked = bundle.items.filter(
    (x) =>
      !x.deleted_at &&
      canRead(x, me) &&
      (item.kind === "places"
        ? x.data.place_id === item.id
        : x.data.itinerary_id === item.id),
  );
  const [privateText, setPrivateText] = useState(""),
    [privateLoaded, setPrivateLoaded] = useState(false),
    [privateVersion, setPrivateVersion] = useState(0),
    [detailScope, setDetailScope] = useState("personal"),
    [err, setErr] = useState("");
  return (
    <Modal title="여행 상세" onClose={onClose}>
      <div className="detail-tags">
        <span className={"scope-badge " + item.scope}>
          {scopeLabel(item.scope)}
        </span>
        {item.data.status && (
          <span className="status-badge neutral">{item.data.status}</span>
        )}
      </div>
      <h1 className="detail-title">{item.title}</h1>
      {item.data.date && (
        <p>
          {shortDate(item.data.date)}{" "}
          {item.data.endDate && item.data.endDate !== item.data.date
            ? "~ " + shortDate(item.data.endDate)
            : ""}
        </p>
      )}
      {item.data.start && (
        <div className="detail-time">
          <Clock size={18} />
          {item.data.start} ({item.data.startZone || "Asia/Taipei"}){" "}
          {item.data.end &&
            `— ${item.data.end} (${item.data.endZone || "Asia/Taipei"})`}
        </div>
      )}
      {item.data.note && <p className="detail-note">{item.data.note}</p>}
      {place && (
        <button className="linked-item" onClick={() => onSelect(place)}>
          <MapPin size={18} />
          {place.title}
          <ChevronRight size={16} />
        </button>
      )}
      {item.kind === "places" && (
        <>
          <p>{item.data.address || "주소 미등록 · 확인 필요"}</p>
          {item.data.lat != null && (
            <p>
              좌표 {item.data.lat}, {item.data.lng}
            </p>
          )}
          {mapUrl(item) ? (
            <a
              className="primary inline-button"
              href={mapUrl(item)!}
              target="_blank"
              rel="noreferrer"
            >
              <Navigation size={17} />
              Google Maps 길찾기
            </a>
          ) : (
            <p className="small-note">
              주소 또는 좌표를 등록하면 길찾기를 사용할 수 있습니다.
            </p>
          )}
        </>
      )}
      {linked.length > 0 && (
        <>
          <h3>연결된 항목</h3>
          {linked.map((x) => (
            <button
              className="linked-item"
              key={x.id}
              onClick={() => onSelect(x)}
            >
              {x.title}
              <ChevronRight size={16} />
            </button>
          ))}
        </>
      )}
      {item.kind === "itinerary" && !demoMode && (
        <section className="private-details">
          <h3>
            <Lock size={15} />
            비공개 상세
          </h3>
          <label>
            상세 공개 범위
            <select
              value={detailScope}
              onChange={(e) => {
                setDetailScope(e.target.value);
                setPrivateLoaded(false);
                setPrivateText("");
                setPrivateVersion(0);
              }}
            >
              <option value="personal">나만</option>
              <option value="family">우리 가족</option>
            </select>
          </label>
          <p className="small-note">
            오프라인 저장과 공개 범위 전환에 포함되지 않습니다.
          </p>
          {!privateLoaded ? (
            <button
              className="secondary"
              disabled={!writable}
              onClick={async () => {
                try {
                  const r = await api("private_get", {
                    tripId: bundle.trip.id,
                    itemId: item.id,
                    detailScope,
                  });
                  setPrivateText(r?.value || "");
                  setPrivateVersion(r?.version || 0);
                  setPrivateLoaded(true);
                } catch (e: any) {
                  setErr(e.message);
                }
              }}
            >
              비공개 상세 열기
            </button>
          ) : (
            <>
              <textarea
                aria-label="나만 보는 비공개 상세"
                rows={3}
                value={privateText}
                onChange={(e) => setPrivateText(e.target.value)}
              />
              <button
                className="secondary"
                disabled={!writable}
                onClick={async () => {
                  try {
                    const result = await api("private_save", {
                      tripId: bundle.trip.id,
                      itemId: item.id,
                      value: privateText,
                      detailScope,
                      expectedVersion: privateVersion,
                    });
                    setPrivateVersion(result.version);
                    setErr("저장했습니다.");
                  } catch (e: any) {
                    setErr(e.message);
                  }
                }}
              >
                비공개 상세 저장
              </button>
            </>
          )}
          {err && <p>{err}</p>}
        </section>
      )}
      {edit && (
        <label className="scope-change-label">
          공개 범위 전환
          <select
            disabled={!writable}
            value={item.scope}
            onChange={(e) => onScope(e.target.value as Scope)}
          >
            {(["trip", "family", "personal"] as Scope[]).map((x) => (
              <option key={x} value={x}>
                {scopeLabel(x)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="form-footer">
        {edit ? (
          <>
            <button
              className="danger text-button"
              disabled={!writable}
              onClick={onDelete}
            >
              <Trash2 size={16} />
              삭제
            </button>
            <button className="primary" disabled={!writable} onClick={onEdit}>
              편집하기
            </button>
          </>
        ) : (
          item.kind === "itinerary" &&
          item.scope === "trip" && (
            <button
              className="primary"
              disabled={!writable}
              onClick={onPropose}
            >
              변경 제안
            </button>
          )
        )}
      </div>
      <p className="small-note">버전 {item.version}</p>
    </Modal>
  );
}
function Places({
  items,
  itinerary,
  date,
  online,
  onSelect,
  onDateChange,
}: {
  items: Item[];
  itinerary: Item[];
  date: string;
  online: boolean;
  onSelect: (x: Item) => void;
  onDateChange: (date: string) => void;
}) {
  const [type, setType] = useState("all"),
    [dateOnly, setDateOnly] = useState(false),
    [mapError, setMapError] = useState(""),
    [mapLoaded, setMapLoaded] = useState(false);
  const container = useRef<HTMLDivElement>(null),
    map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const filtered = items.filter(
    (x) =>
      (type === "all" || x.data.type === type) &&
      (!dateOnly ||
        itinerary.some((y) => onDate(y, date) && y.data.place_id === x.id)),
  );
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  useEffect(() => {
    if (!online || !key || !container.current) return;
    let cancelled = false;
    async function load() {
      try {
        if (!(window as any).google?.maps) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key!)}&v=weekly`;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        if (cancelled) return;
        map.current = new (window as any).google.maps.Map(container.current, {
          center: { lat: 22.62, lng: 120.3 },
          zoom: 12,
          gestureHandling: "cooperative",
          mapTypeControl: false,
          streetViewControl: false,
        });
        setMapLoaded(true);
      } catch {
        setMapError(
          "지도를 불러오지 못했습니다. 장소 목록과 길찾기를 사용해 주세요.",
        );
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [online, key]);
  useEffect(() => {
    if (!mapLoaded || !map.current) return;
    for (const m of markers.current) m.setMap(null);
    markers.current = filtered
      .filter((x) => x.data.lat != null)
      .map((x) => {
        const m = new (window as any).google.maps.Marker({
          map: map.current,
          position: { lat: x.data.lat, lng: x.data.lng },
          title: x.title,
        });
        m.addListener("click", () => onSelect(x));
        return m;
      });
  }, [mapLoaded, JSON.stringify(filtered)]);
  return (
    <>
      <div className="places-controls">
        <input
          aria-label="장소 필터 날짜"
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          style={{ width: 165 }}
        />
        <select
          aria-label="장소 유형"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">모든 장소</option>
          {types.places.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={dateOnly}
            onChange={(e) => setDateOnly(e.target.checked)}
          />
          {shortDate(date)} 일정의 장소만
        </label>
      </div>
      <div className="places-layout">
        <section className="map-panel">
          <div ref={container} className="map-canvas" />
          {(!key || !online || mapError) && (
            <div className="map-placeholder">
              <MapPin size={40} />
              <h2>
                {!online
                  ? "오프라인에서는 장소 목록으로"
                  : "우리 여행의 장소들"}
              </h2>
              <p>
                {mapError ||
                  (!key
                    ? "지도 미리보기 대신 각 장소의 길찾기 버튼으로 Google 지도를 바로 열 수 있어요."
                    : "온라인 연결 후 지도를 이용할 수 있습니다.")}
              </p>
              <div className="map-place-tags">
                {filtered.map((x) => (
                  <button key={x.id} onClick={() => onSelect(x)}>
                    <MapPin size={14} />
                    {x.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
        <div className="place-list">
          {filtered.map((x) => (
            <article className="panel place-card" key={x.id}>
              <span className="eyebrow">{x.data.type}</span>
              <button onClick={() => onSelect(x)}>
                <h3>{x.title}</h3>
                <p>{x.data.address || "주소 확인 필요"}</p>
                <span className={"scope-badge " + x.scope}>
                  {scopeLabel(x.scope)}
                </span>
              </button>
              {mapUrl(x) ? (
                <a
                  className="text-link"
                  href={mapUrl(x)!}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation size={15} />
                  길찾기
                </a>
              ) : (
                <span className="small-note">
                  주소·좌표 등록 후 길찾기 가능
                </span>
              )}
            </article>
          ))}
          {!filtered.length && (
            <Empty
              text="해당하는 장소가 없어요"
              sub="필터를 바꾸거나 장소를 추가해 주세요."
            />
          )}
        </div>
      </div>
    </>
  );
}

function CreateOptions({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return enabled ? (
    <details
      className="quick-create-options"
      onInvalidCapture={(e) => {
        e.currentTarget.open = true;
      }}
    >
      <summary>
        상세 옵션
        <ChevronDown size={18} />
      </summary>
      <div className="quick-create-options-body">{children}</div>
    </details>
  ) : (
    <>{children}</>
  );
}
