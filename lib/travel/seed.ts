import type { Bundle, Item, Kind, Scope } from "./types";
const trip = "11111111-1111-4111-8111-111111111111",
  family = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333",
  user = "44444444-4444-4444-8444-444444444444";
function row(
  n: number,
  kind: Kind,
  title: string,
  scope: Scope,
  data: Record<string, any>,
): Item {
  return {
    id: `55555555-5555-4555-8555-${String(n).padStart(12, "0")}`,
    trip_id: trip,
    kind,
    title,
    scope,
    family_id: scope === "family" ? family : null,
    owner_id: scope === "personal" ? user : null,
    version: 1,
    created_at: "2026-11-21T00:00:00Z",
    deleted_at: null,
    data,
  };
}
export function seed(): Bundle {
  return {
    trip: {
      id: trip,
      title: "가오슝, 함께 떠나요",
      start_date: "2026-11-27",
      end_date: "2026-12-01",
      timezone: "Asia/Taipei",
      archived_at: null,
      version: 1,
    },
    userId: user,
    serverTime: new Date().toISOString(),
    families: [
      { id: family, name: "준세님 가족", participation_end: null },
      { id: other, name: "동행 가족", participation_end: "2026-11-29" },
    ],
    members: [
      {
        user_id: user,
        family_id: family,
        display_name: "준세",
        role: "admin",
        active: true,
      },
      {
        user_id: "66666666-6666-4666-8666-666666666666",
        family_id: family,
        display_name: "가족 구성원",
        role: "member",
        active: true,
      },
    ],
    requests: [],
    items: [
      row(1, "itinerary", "인천에서 가오슝으로", "family", {
        date: "2026-11-27",
        endDate: "2026-11-27",
        start: "11:45",
        end: "13:55",
        startZone: "Asia/Seoul",
        endZone: "Asia/Taipei",
        type: "항공",
        status: "확인 필요",
        note: "BR145 · 에바항공 / 인천 T1 출발. 문서 기준이며 출발 전 항공사 재확인이 필요합니다.",
      }),
      row(2, "itinerary", "공항에서 E-DA로 함께 이동", "trip", {
        date: "2026-11-27",
        type: "이동",
        status: "확인 필요",
        note: "어른 4명 + 아기 2명. 픽업 차량 카시트 포함 여부 확인 필요.",
        place_id: "55555555-5555-4555-8555-000000000010",
        families: [family, other],
      }),
      row(3, "itinerary", "E-DA 로얄 호텔 · 2박", "family", {
        date: "2026-11-27",
        endDate: "2026-11-29",
        type: "숙박",
        status: "확정",
        place_id: "55555555-5555-4555-8555-000000000010",
        note: "마운틴 뷰. 체크인·체크아웃 시간은 등록 전 확인해 주세요.",
      }),
      row(4, "itinerary", "PAPO’A HARBOR · 2박", "family", {
        date: "2026-11-29",
        endDate: "2026-12-01",
        type: "숙박",
        status: "확정",
        place_id: "55555555-5555-4555-8555-000000000011",
        note: "11월 29일 오후부터 우리 가족 일정. 로프트 계단과 문턱 주의.",
      }),
      row(5, "itinerary", "가오슝에서 인천으로", "family", {
        date: "2026-12-01",
        endDate: "2026-12-01",
        start: "17:00",
        end: "20:45",
        startZone: "Asia/Taipei",
        endZone: "Asia/Seoul",
        type: "항공",
        status: "확정",
        note: "TW672 · 티웨이항공. 유아 동반 카운터 수속.",
      }),
      row(10, "places", "E-DA 로얄 호텔", "trip", {
        type: "숙소",
        address: "",
        note: "문서에 기재된 숙소. 공식 주소·좌표는 확인 후 입력해 주세요.",
      }),
      row(11, "places", "PAPO’A HARBOR HOTEL", "family", {
        type: "숙소",
        address: "",
        note: "가오슝 보얼 지역 · 공식 주소·좌표 확인 필요",
      }),
      ...[
        "여권 · 아기 여권",
        "상온 이유식 · 아기 간식",
        "빨대컵 · 식기",
        "기저귀 · 물티슈",
        "수영복 · 수영모 · 방수기저귀",
        "유모차 · 아기띠",
      ].map((t, i) =>
        row(20 + i, "checklist", t, "family", {
          category: i === 0 ? "여행 서류" : i < 3 ? "아기 식사" : "아기 용품",
          quantity: 1,
          complete: false,
          assignees: [],
          checked: [],
        }),
      ),
      ...[
        "픽업 차량 카시트 포함 여부 확인",
        "아기 여권 유효기간 실물 대조",
        "출국 항공 온라인 체크인 · 좌석 선택",
        "여행자 보험 가입 확인",
        "eSIM 설치 및 개통 방법 확인",
      ].map((t, i) =>
        row(40 + i, "tasks", t, "family", {
          status: "예정",
          priority: i < 2 ? "높음" : "보통",
          assignees: [],
          note: "여행 정리 문서의 확인 필요 항목입니다. 담당자와 마감일은 미배정입니다.",
        }),
      ),
    ],
  };
}
