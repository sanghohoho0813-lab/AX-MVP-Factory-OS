# PASS 0 — 컨설팅 작업실(특허 × 벤처 × MVP) 착수 감사

날짜 2026-09-08 · 기준 커밋 `4ca1856` (main) · 작업 브랜치 `claude/patent-venture-mvp-studio-v1`
Master 원본: `(특허+벤처+MVP전용)미래AI랩_…_통합Master_v2.0_260904.md` (5,874줄) — 사람용 SoT.
이 문서는 코드를 쓰기 전에 "지금 무엇이 있고, 어디에 붙이면 되는가" 만 적는다.

## 1. 저장소 · 빌드 · 배포

| 항목 | 현재 |
|---|---|
| 스택 | Vite 8 (rolldown) · React 19 · TS strict · Tailwind 4 `@theme` 토큰 · React Router 7 · oxlint |
| 모드 | `VITE_DATA_MODE=local`(localStorage, 로그인 없음) / `supabase`(RLS, 워크스페이스) — `src/data/dataMode.ts` |
| 라우터 | `src/app/appRouteChildren.tsx` 하나를 두 모드가 공유. 페이지는 전부 lazy |
| 셸 | `AppShell` = Sidebar(모듈 레지스트리) + Header(검색·알림·워크스페이스) + `MobileNav`(5칸 고정) + `main` |
| 테스트 | `vite.<name>.config.mjs` 로 node 번들 → `npm run test:all` 12묶음. Playwright e2e 는 `e2e/*.mjs` |
| 배포 | Vercel (`vercel.json` SPA rewrite). Production = main 직행(D-16) — **이 작업은 예외: feature 브랜치 + Preview 만** |

## 2. 고객(CLIENT) — 재사용 대상

- SoR: `public.operations_clients` (`id text pk`, `workspace_id`, `company_name`, `status`, `next_action*`, `payload jsonb`).
  RLS = `is_workspace_member` / `can_write_workspace`. 삭제는 cascade 없이 행 삭제.
- 앱 모델: `ClientOpsRecord` (`src/types/clientOps.ts`) — 회사 기본(대표자·설립일·주소·사업자/법인번호·업태·종목·직원수·주주),
  업무 6종+커스텀, 서류 10종, 수금, 자금 신청, 활동 기록. 저장은 `src/services/clientOpsService.ts` (local/supabase 동일 API).
- 상세 화면 `OperationsClientDetailPage` 탭 8개(`?tab=`): 개요·업무·서류·수금·자금·고객 플랫폼·업무 일기·파일.
  → **여기에 '컨설팅' 탭을 하나 더 붙인다.** 탭 정의는 `DETAIL_TABS` 배열 하나.
- 결론: 두 번째 CRM 을 만들지 않는다. 프로젝트는 `clientId` 로 이 표에 매달린다.

## 3. 기존 프로젝트/활동 구조 (AX STUDIO)

- `organizations`/`projects`/`activities` (local repository + supabase). 진단·선별·MVP 설계·검증·결과자료가 이 `projectId` 를 쓴다.
- 성격이 다르다: AX STUDIO 의 프로젝트는 "설문·진단 → 자동화 후보" 파이프라인이고, 이번 것은 "특허·MVP·벤처 서류" 단계 엔진이다.
  강제로 합치면 두 쪽 화면이 모두 어색해진다. → 별도 `consulting_projects` 로 두되 `clientId` 로 고객과 잇는다. (WORKFLOW_SPEC §7)

## 4. 일기 · 이벤트 · 서류 · 저장소

- 업무 일기 `ops_journal_entries` (owner RLS) — 오늘/일정/업체 상세가 공유. `follow_up`= 할 일. → 결정 기록·다음 행동을 여기로 흘려보낼 수 있다.
- 고객 이벤트 `customer_events`, 발행 `portal_updates` — 고객 플랫폼 왕복. 컨설팅 내부 자료는 고객에게 **절대** 흘리지 않는다(기존 allowlist RPC 만 노출).
- 서류: `client-documents` 버킷(비공개, RLS 경로 = `{workspace}/{client}/…`). OCR 은 브라우저(tesseract) — 사람이 확인 후 저장.
- 파일 업로드는 이미 있으므로 증빙 파일은 P1 에서 같은 버킷 하위 경로를 쓸 수 있다. 이번 P0 은 증빙 **메타(슬롯·주장·출처)** 만.

## 5. 디자인 언어 (그대로 쓴다)

- 부품: `Surface/Badge/Dot/ScreenTitle/SectionTitle/Section/ListRow/ListSurface/MetricTile/Disclosure/BottomSheet/Blank` (`primitives.tsx`), `Button`, `Modal`.
- 글자 6단계 `t-page/t-section/t-card/t-body/t-sub/t-meta/t-num`. 색은 danger/warning/success/brand + 무채색. 종류는 색으로 칠하지 않는다.
- 메뉴 아이콘 색 8종 `nav-*` (D-25). 클래스 이름 이어 붙이기 금지(D-26).
- 짜부라짐 금지 규칙(§9): 글자+고정폭 컨트롤 한 줄 금지 → `w-full sm:w-auto sm:flex-1`.
- 모바일: 하단 내비 5칸 고정, 상세 탭은 가로 스크롤 `role=tablist`, 입력 많으면 `BottomSheet`.

## 6. 보안 경계 (유지)

- service_role / `sb_secret_` 브라우저·저장소 0 (dataMode 가 거부). 주민번호·인증서 비밀번호 미저장(타입·테스트로 고정).
- 새 표는 전부 workspace RLS. anon revoke. 고객용 RPC 는 새 표를 읽지 않는다.

## 7. 붙일 자리 요약

| 무엇 | 어디에 |
|---|---|
| 새 최상위 화면 '컨설팅 작업실' | `moduleRegistry` 새 그룹 `consulting` (고객 다음) + 라우트 `/studio`, `/studio/:projectId` |
| 고객 상세 탭 | `DETAIL_TABS` 에 `consulting` 추가 → 그 고객의 프로젝트 목록 + 새로 만들기 |
| 오늘 화면 | 활성 프로젝트의 다음 행동 1개씩 (P1) |
| 일기 | 결정 기록 시 `decision` 항목으로도 남김 (P1) |
| 검색 | '컨설팅 프로젝트' 그룹 (P1) |
| 저장 | local: `STORAGE_KEYS.consulting*` / supabase: `consulting_*` 5표 (마이그레이션은 브랜치에만, 적용 안 함) |
| 표 없음 | 마이그레이션 미적용 환경에서는 화면이 "READY — SQL 적용 후 사용" 안내를 보이고 아무것도 깨지지 않는다 |

## 8. 확인된 위험

- Vercel Preview 는 Production 과 같은 Supabase 를 보므로 **새 표가 없다**. Preview 에서는 안내 상태만 보이고, 기능 QA 는 local 모드(e2e)로 한다. 이 사실을 최종 보고에 그대로 적는다.
- `moduleRegistry` 그룹을 늘리면 `ModuleGroupKey` 유니온·사이드바 접힘 저장키·테스트(`miraeOs.test.ts` 그룹 순서)가 영향받는다 → 테스트로 잠근다.
- Master 5,874줄을 화면·프롬프트에 그대로 넣지 않는다(SCOPED ACTIVATION). 프롬프트 꾸러미는 단계별로 필요한 규칙 20~40줄만 싣는다.
