# 변경 기록

## 2026-11-22 · 수정 후 스크롤 잠금 해제

- 원인: 상세창 위에 수정창이 열려 각 창이 body overflow 값을 개별 보관했습니다. 상세창이 먼저 해제되고 수정창이 나중에 해제되면 hidden이 복원되어 페이지 스크롤이 막혔습니다.
- 수정: 열린 창 수를 함께 관리하고 마지막 창이 닫힐 때 최초 overflow 값을 복원합니다. 각 해제 함수는 중복 호출에도 안전합니다.
- 소스 커밋: d20a61713dbe6688b8cd805f5da2d2778738412b.
- 검증: TypeScript 검사, 전체 테스트 23개 통과, 샘플 정적 빌드 성공. 중첩 창의 닫힘 순서 3가지, 기존 overflow 값 2가지, StrictMode, 반복 열기/닫기를 검사했습니다.
- 브라우저 검증: 샘플 앱에서 상세 → 편집 → 저장 후 dialog 0개, body overflow 빈 값, 실제 페이지 스크롤 이동을 확인했습니다. 실제 운영 가족 데이터는 테스트 목적으로 수정하지 않았습니다.
- 운영 배포: dpl_8TWMGdfYBUq6TnfXNfsfjvxEiGMw, Vercel READY, https://travel-together-theta.vercel.app 별칭 연결 확인.
- GitHub 관리 대상으로 2junworld/Travel-Together를 지정했습니다. 최초 업로드는 미완료입니다. GitHub 연결의 쓰기 권한 오류(403)와 브라우저 파일 전송 시간 초과가 발생했습니다. 브라우저 로그인과 기기 승인은 완료됐으나, 연결의 쓰기 권한을 해결하지는 않습니다.

## 기존 개발 자료

- 전체 Next.js/TypeScript 앱, Supabase 스키마·RLS·트랜잭션 마이그레이션 2개, 오프라인 저장/PWA, 테스트, README와 실사용 연결 문서를 소스에서 관리합니다.
- 이전 개발 커밋은 로컬 Git 이력에 보존되어 있습니다: 2bdeab9 → 357e3e8 → cdeaef8 → f822523 → ac61b34 → 72b39f6 → acc98d9 → d20a617.
- 전체 기존 커밋 그래프를 보존한 Git bundle을 준비했습니다. 최초 push에는 force 옵션을 사용하지 않습니다.
