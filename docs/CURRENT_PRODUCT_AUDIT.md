# CURRENT PRODUCT AUDIT — INTERNAL (AX-MVP-Factory-OS → MIRAE AI LAB OS)

기준 커밋: `0c2d2c8` (origin/main, 2026-09-03) · 작업 브랜치: `claude/mirae-ai-lab-os-v1`
감사 범위: 라우트 전수 · 데이터 소스 · 실제 동작 · 중복 · 레거시 · 새 IA 위치 · P0/P1

## 0. 한 줄 판정

이미 "고객사 운영 + AX 스튜디오"가 모두 들어 있는 성숙한 내부 앱이다. 문제는 기능 부족이 아니라
**(1) 첫 화면이 "오늘 무엇부터"를 답하지 않고, (2) 미래AI랩 고객(miraeailab.com)의 행동이 이 앱에 전혀 들어오지 않으며,
(3) 제품 정체성이 "AX MVP Factory"라는 도구 이름에 묶여 있다**는 세 가지다.

## 1. 기술 기반

| 항목 | 현재 | 판정 |
|---|---|---|
| 스택 | Vite 8(rolldown) · React 19 · TS strict · Tailwind 4 · React Router 7 (createBrowserRouter, route-level lazy) | KEEP |
| 데이터 모드 | `getDataModeConfig()` 1회 해석 → `local`(localStorage) / `supabase`(RLS) | KEEP |
| 인증 | `src/auth/*` — 세션·워크스페이스 부트스트랩, `workspace_members` RLS | KEEP (tenant boundary = `workspace_id`) |
| 저장소 | `src/repositories/*` 동기(local) + `repositories/async`(supabase) 팩토리 | KEEP |
| 테마 | 9종 Canonical Theme 토큰 시스템(`scripts/gen-theme-css.mjs`, `html[data-theme]`) — 이번 브랜치에서 반입 | KEEP · 기본값을 브랜드에 맞춰 재선정 |
| 글자 크기 | `UiTextScale` default 1.0 / large 1.15 / extra_large 1.30 | KEEP (사용자 명시 요구) |
| 테스트 | `vite.<name>.config.mjs` lib-build → node 실행, 11개 스위트 | KEEP · 신규 스위트 추가 |
| 배포 | Vercel `ax-mvp-factory-os` (main 자동) | 이번 단계 Production 변경 금지 |

## 2. 라우트 인벤토리 (appRouteChildren.tsx)

범례: **KEEP** 유지 · **MOVE** 위치 이동 · **CONSOLIDATE** 통합 · **HIDE** 기본 내비에서 숨김(직접 URL 유지) · **DEPRECATE-LATER** 미사용, 나중 정리

### 2.1 운영(일일 사용)

| Route | 화면 | 데이터 소스 | 실제 동작 | 판정 · 새 IA 위치 |
|---|---|---|---|---|
| `/` | `Navigate → /ops/clients` | — | 리다이렉트만 | **CONSOLIDATE → 새 Daily Command Center** |
| `/today` | TodayOpsPage | operations_clients → alerts/schedule | 마감 지남·오늘·이번주 | **CONSOLIDATE → `/`** (리다이렉트 유지) |
| `/ops/clients` | OperationsHubPage | operations_clients | 지금 챙길 것 + 현황표 + 백업/복원 + 로컬→클라우드 이관 | **KEEP** [고객] 고객 운영 |
| `/ops/clients/:clientId` | OperationsClientDetailPage | operations_clients(payload) + Storage | 프로필·업무·서류·수금·자금·메모·활동기록·OCR | **KEEP → V2(탭·고객 플랫폼 탭)** |
| `/ops/calendar` | OpsCalendarPage | operations_clients | 월 달력·종류 필터 | **KEEP** [일정] |
| `/clients`, `/clients/:id`, `/clients/new`, `/clients/:id/edit` | ClientsListPage 등 | organizations/projects | AX 스튜디오용 고객사·프로젝트 | **HIDE → AX STUDIO 내부** (직접 URL 유지) |
| `/projects/*` | ProjectDetail/Form | projects | AX 프로젝트 | **HIDE → AX STUDIO** |
| `/settings` | SettingsPage / SupabaseSettingsView | ui_preferences(local) | 화면 색·글자·고급기능·데이터·시스템 | **KEEP** |
| `/getting-started`, `/guide` | GettingStartedPage | onboarding content | 가이드 | **KEEP · 콘텐츠 갱신** |
| `/tools` | ToolsHubPage | — | 전체 기능 링크 허브 | **KEEP** [도구함] |
| `/funding`, `/funding/*`, `/cases/*` | Funding*/Cases* | funding_strategies/institutions/case_studies | 기관·자금 전략 | **KEEP** [자금·지원]에 대표 진입 · 세부는 AX STUDIO |
| `/reports` | ReportsRedirectPage | — | 결과자료 안내 | KEEP (호환) |

### 2.2 AX 스튜디오(전문 워크플로)

| Route 군 | 화면 수 | 판정 |
|---|---|---|
| `/diagnosis/**` (질문·모듈·템플릿·설문·응답·분석 12종) | 19 | **KEEP · HIDE → AX STUDIO > 진단** |
| `/selection/**` | 7 | KEEP · AX STUDIO > 업무 선택 |
| `/mvp-design/**` | 11 | KEEP · AX STUDIO > AX 설계 |
| `/website-studio/**` | 10 | KEEP · AX STUDIO > 홈페이지 설계 |
| `/validation/**` | 13 | KEEP · AX STUDIO > 검증 |
| `/deliverables/**` | 13 | KEEP · AX STUDIO > 결과자료 |
| `/survey/:token`, `/test/:token` | 공개 설문·테스트 | KEEP (공개 라우트 보존) |
| `MODULE_PAGES` 빈 모듈 | EmptyModulePage | KEEP (레거시 안내) |

### 2.3 라우트에 연결되지 않은 페이지(현재 이미 죽은 코드)

| 파일 | 내용 | 판정 |
|---|---|---|
| `pages/DashboardPage.tsx` (271줄) | 프로젝트 Journey 대시보드(hero/continue/attention/metrics/portfolio) | **DEPRECATE-LATER** — 유효한 Journey/Portfolio 계산은 `services/dashboardService`·`journeyService`에 남아 AX STUDIO 홈에서 재사용 가능 |
| `pages/ClientOperationsWorkspacePage.tsx` (160줄) | 옛 고객 운영 워크스페이스 | **DEPRECATE-LATER** (OperationsHub로 대체 완료) |
| `pages/ClientOpsLedgerPage.tsx` (431줄) | 옛 레저 | **DEPRECATE-LATER** |

이번 단계에서는 삭제하지 않는다(규격: 삭제 대신 redirect/consolidation). 세 파일은 import되지 않아 번들에도 포함되지 않는다.

## 3. 데이터 소스 · SSOT

| 엔티티 | 테이블 / 키 | 쓰기 | 읽기 | 고객 노출 |
|---|---|---|---|---|
| 고객사(운영) | `operations_clients` (id, workspace_id, company_name, status, next_action, next_action_due_date, **payload jsonb**) / local `axmvp.data.operations_clients` | 내부 | 내부 | **금지** — payload에 메모·수임료·미수금·자금판단 포함 |
| 서류 파일 | Storage `client-documents` (private) 경로 `{workspaceId}/...` | 내부 | 내부(5분 서명 URL) | 명시 공유분만(신규 portal_documents 경유) |
| AX 스튜디오 | organizations/projects/questions/…/case_studies | 내부 | 내부 | 금지 |
| UI 설정 | `ui_preferences` + `axmvp.ui.preferences` | 본인 | 본인 | — |
| 워크스페이스 | workspaces/workspace_members/workspace_invites | 소유자 | 멤버 | — |

## 4. 핵심 로직 상태

| 영역 | 파일 | 상태 |
|---|---|---|
| 경고 엔진 | `services/clientOpsAlerts.ts` | LIVE · 11종 · 순수함수 · 94 테스트 |
| 일정 | `services/clientOpsSchedule.ts` | LIVE |
| 자금 신청 건 | `FundingSection` + `withFunding` | LIVE |
| OCR/문서 파싱 | `koreanDocParser.ts` + `docTextExtract.ts`(pdf.js→tesseract) | LIVE · 53 테스트 · lazy chunk |
| 백업/복원 | `clientOpsBackup.ts` | LIVE · 파일명 ASCII |
| 활동 기록 | `clientOpsActivity.ts` | LIVE(이번 브랜치) |
| 고객 메시지 | `clientOpsMessages.ts` | LIVE(복사용 문구) |
| Supabase 어댑터 | `clientOpsService.ts` (5 승격 컬럼 + payload) | LIVE |
| RLS | `is_workspace_member` / `can_write_workspace` | LIVE |

## 5. 중복 · 레거시

| 중복 | 판단 |
|---|---|
| `/today` vs `/ops/clients` 상단 "지금 챙길 것" | 같은 경고 엔진을 두 화면이 표시 → `/`(Command Center)가 "오늘", `/ops/clients`는 "업체별 현황표"로 목적 분리. `/today`는 `/`로 리다이렉트 |
| DashboardPage(Journey) vs OperationsHub | 대상 엔티티가 다름(projects vs operations_clients). Journey는 AX STUDIO 홈(도구함)에서 접근 |
| `data/demo.ts` 헤더(WORKSPACES/NOTIFICATIONS/CURRENT_USER) | local 모드 데모 값. 알림 메뉴는 실제 데이터와 무관 → **P1**: 알림을 실제 경고·고객 이벤트 수로 교체 |
| `services/consultingOpsService`·`clientOperations*` | 구 운영 계층. DashboardPage 전용. DEPRECATE-LATER |

## 6. 사용자 노출 브랜드 문자열 ("Factory") 위치

`index.html`(title/description) · `Sidebar.tsx`("Factory OS", "AX" 사각 로고) · `auth/ui/AuthLayout.tsx` · `settings/parts.tsx`(앱 이름). 나머지 grep 결과는 `sectionFactory`/`surveyFactory`/`RepositoryFactory` 같은 코드 식별자로 사용자에게 보이지 않는다.

## 7. 사용 빈도 예상 (대표 1인 기준)

| 매일 | 주 1~3회 | 프로젝트당 1회 |
|---|---|---|
| 오늘 할 일 · 고객 운영 현황표 · 업체 상세(업무/서류/수금) · 일정 · 업무 일기(신규) · 고객 이벤트함(신규) | 자금·지원사업 · 백업 · 설정 | AX 진단·선택·설계·검증·결과자료·홈페이지 설계 |

→ 내비게이션은 "매일"을 1차, "주간"을 2차, "프로젝트당"을 AX STUDIO(접힘)로 배치한다.

## 8. P0 / P1

### P0 (완료 보고 금지 조건)
1. **고객 행동 유입 0** — miraeailab.com 진단/주문/요청이 내부에 들어오지 않는다. → 이번 단계의 Customer Bridge.
2. **첫 화면이 리다이렉트** — `/`가 "오늘 무엇부터"를 답하지 않는다. → Daily Command Center.
3. **브랜드 불일치** — 사용자 노출명 "AX MVP Factory OS". → brand.config + 로고.
4. **판단 기록 부재** — 통화·결정·후속조치가 남을 곳이 없다(메모는 업체 단위 자유 텍스트뿐). → Work Journal.

### P1
1. 헤더 알림(`NOTIFICATIONS`)이 데모 상수 — 실제 경고 수로 교체.
2. `OperationsHubPage` 복원 흐름의 `window.confirm/alert` — 공통 ConfirmModal/Toast로 교체.
3. 업체 상세가 긴 단일 스크롤(8개 섹션) — 탭 + 위계(NOW→WORK→BLOCKER→MONEY→CUSTOMER→ACTIVITY).
4. 사이드바 그룹 색이 화면 테마와 무관하게 sky/violet/rose 하드코딩 — 이번 브랜치에서 `--color-nav-*` 고정 분류 토큰으로 정리 완료.
5. 로컬 모드 사용자 메뉴 "내 프로필은 다음 단계" 토스트 — 자리표시자 → 설정으로 연결.

### P2 (RECOMMENDATIONS.md로)
- DashboardPage/Ledger/Workspace 3개 파일 물리 삭제
- 서버 동기화되는 UI 설정(테마·글자)
- 일정 ICS 내보내기
