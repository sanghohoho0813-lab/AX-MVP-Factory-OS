# QA_REPORT — MIRAE AI LAB OS · 2026-09-03

브랜치 `claude/mirae-ai-lab-os-v1` (base `0c2d2c8`) · Production(ax-mvp-factory-os.vercel.app) **미변경**.

## 1. 정적 검사
| 항목 | 결과 |
|---|---|
| TypeScript (`tsc -b --noEmit`, strict · erasableSyntaxOnly) | 0 errors |
| oxlint | 신규 오류 0 (기존 경고 6건 유지: fast-refresh export, this-alias, exhaustive-deps) |
| Production build (`tsc -b && vite build`) | OK · route-level lazy 유지 · OCR/PDF 청크 분리 유지 |
| 사용자 노출 "Factory" 문자열 | 0 (grep: src/index.html/public) |
| Tailwind 임의 색 계열(sky/violet/rose/amber/emerald/indigo…) 직접 사용 | 0 — 테마/중립/의미/분류/메뉴/요일 토큰으로 분류 완료 |

## 2. 단위·계약 테스트 (`npm run test:all`, 12 스위트)
| 스위트 | 결과 |
|---|---|
| contract(mock repository) 16 · client-ops 13 · client-operations 9 · progress 32 · persistence 14 · onboarding 37 · client-ops-alerts 94 · doc-parser 53 · client-ops-stage2 44 · datamode 12 · auth-errors 16 | 전부 PASS (기존) |
| **mirae-os 70** — 브랜드 설정 · 모듈/서비스 레지스트리 · 업무 일기 필터 · Top 3 규칙과 이유 · 하루 정리 · 돈/자금 신호 · 고객 투영 allowlist | PASS (신규) |
| **bridge_contract.sql** — dedupe · 라우팅 · 고객 격리 · 투영 allowlist(내부 메모/수임료/ID 부재) · storage 경로 · 워크스페이스 격리 · anon 거부 · 내부 미리보기 = 고객 투영 | PASS (로컬 PostgreSQL 16, 기존 5개 마이그레이션 + 공개 사이트 schema 위에 적용, 2회 적용 멱등) |

## 3. 브라우저 E2E (Playwright · Chromium · local 모드 · `vite preview`)
**85/85 PASS** (기능 25 · 테마 9 · 반응형 48 · 큰 글자 2 · 모바일 메뉴 1) · 페이지 JS 오류 0. 스크린샷 23장 → `docs/qa/2026-09-03/internal/` (고객 플랫폼 Mock E2E 10장 → `docs/qa/2026-09-03/public/`).

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | `/` = Command Center — 시간대 인사 h1 + 신호 5칸 | PASS |
| 2 | 브랜드: 사이드바 "Factory" 0, 로고 이미지 렌더 | PASS |
| 3 | 헤더 "고객 플랫폼" 버튼(새 탭) | PASS |
| 4 | 빠른 기록: 메모 저장 | PASS |
| 5 | 빠른 기록: 후속조치(오늘 기한) → Top 3 등장 | PASS |
| 6 | 이벤트함: 샘플 이벤트 만들기 → DEMO 표기 3건 | PASS |
| 7 | 이벤트 → "새 고객사로 만들기" → 연결됨 + 업체 링크 | PASS |
| 8 | 이벤트 처리 완료 → 열린 목록에서 제외 | PASS |
| 9 | 업체 상세: 탭 8개 + 개요 "지금" 블록 | PASS |
| 10 | 업무 탭: 벤처인증 상태 변경 → 활동 기록 생성 | PASS |
| 11 | 고객 플랫폼 탭: 계정 연결(DEMO) | PASS |
| 12 | 서류 요청 → 고객 업로드 흉내 → 확인 완료 (requested→uploaded→verified) | PASS |
| 13 | 샘플 고객 요청 → 답변 | PASS |
| 14 | 고객에게 업데이트: 미리보기 → 공개 | PASS |
| 15 | 고객 화면 보기 = 고객 투영(내부 메모·수임료 없음) | PASS |
| 16 | 업무 일기 탭: 고객 연결 기록 | PASS |
| 17 | 파일 탭 렌더 | PASS |
| 18 | `/journal` 전체: 3건 이상 + 고객 필터 | PASS |
| 19–21 | 고객 운영 현황표 · 일정 · 자금 렌더 | PASS |
| 22 | AX STUDIO 라우트 보존 (`/diagnosis`) | PASS |
| 23 | `/today` → `/` 리다이렉트 | PASS |
| 24 | 설정: 화면 색 9종 선택기 | PASS |
| 25 | 홈 "이 화면 따라 해보기" 시작·종료 후 dialog 0 · body 정상 | PASS |

## 4. 9 Theme 전수 (홈 화면)
| 테마 | 셸 배경 | 본문 글자색 | 결과 |
|---|---|---|---|
| navy-blue | #0b1830 | oklch(0.279 …) | PASS |
| navy-gold | #111a2d | oklch(0.279 …) | PASS |
| emerald-gold | #11332b | oklch(0.279 …) | PASS |
| forest-sage | #17352c | oklch(0.279 …) | PASS |
| deep-teal (기본) | #08323a | oklch(0.279 …) | PASS |
| onyx-gold | #15171c | oklch(0.279 …) | PASS |
| burgundy | #3a1724 | oklch(0.279 …) | PASS |
| plum-indigo | #291a3d | oklch(0.279 …) | PASS |
| steel | #24303b | oklch(0.279 …) | PASS |
본문 글자색은 모든 테마에서 slate 중립(oklch 0.279 …)으로 고정 — 테마에 물들지 않음. 새로고침 후 유지.

## 5. 반응형 (가로 넘침 0 검사)
폭 360 / 390 / 430 / 768 / 1024 / 1280 / 1440 / 1920 × 라우트 `/` `/ops/inbox` `/journal` 업체 상세 `/ops/clients` `/settings`
48/48 PASS (넘침 0). 1차 실행에서 발견한 2건을 수정: `/ops/clients` 1024px 4px(PageHeader 액션 줄바꿈), `/` 360px 8px·큰 글자 87px(홈 그리드 섹션 `min-w-0` + 이벤트 카드 긴 토큰 `overflow-wrap:anywhere` + 돈 3칸 480px 미만 세로 배치).
큰 글자(extra_large 1.30) 390px: `/`, 업체 상세 — PASS (2/2)

## 6. 상호작용 무결성
- 모달·드로어·투어 종료 후 `[role=dialog]` 0, body pointer-events/overflow 정상 — PASS
- 모바일 메뉴 열고 닫기 → backdrop 0 — PASS
- `window.confirm/alert` 사용처: 0 (백업 복원·로컬 이관은 공통 Modal/Toast)

## 7. 기존 기능 회귀
고객 운영 현황표 · 업체 생성/수정 · 서류·OCR · 수금 · 자금 신청 건 · 일정 · 백업/복원 · 보관 · 검색 · 설정 · AX STUDIO 전 라우트(/diagnosis /selection /mvp-design /website-studio /validation /deliverables /funding /cases) — 라우트 보존, 빌드 통과, 기존 테스트 11 스위트 전부 PASS. `/today` → `/` 리다이렉트, 구 화면은 `/today/legacy`.

## 8. 보안 (프론트)
- `sb_secret_`/service_role: 앱이 거부(dataMode 검증) · 번들 내 0
- 고객 투영은 SQL 함수 allowlist — DATA_DICTIONARY §투영 필드
- 고객 인증 우회 없음: 내부 "고객 화면 보기"는 워크스페이스 멤버 RPC

## 9. Known Issues
- 브릿지(이벤트·일기·포털)는 Production Supabase 미적용 → supabase 모드에서 READY 안내(LIVE 아님). 적용 절차 SETUP.md.
- local 모드 헤더의 워크스페이스/사용자 표시는 데모 상수(P2).
- Vercel Preview READY 여부는 이 실행 환경에서 API 접근이 막혀(403) 확인하지 못함 — 사용자가 Vercel 대시보드에서 확인.

## 10. Red Team (1회)
P0 0 · P1 2건 수정(PostgrestError 판정, QA 포트 오류) · 반응형 3건 수정(위 §5) · E2E 스크립트 오류 1건 수정(투어 "다음" 버튼이 오버레이 아래 페이지의 "완료" 버튼과 먼저 매칭 — 앱 결함 아님) · P2 → RECOMMENDATIONS.md

## 11. 점수(자가)
- STRATEGY 92 / 100 — 제약·핵심가치·왕복·증거 구조 확정, Money KPI baseline 미측정(-5), Proof 실적 없음(-3)
- INTERNAL PRODUCT 91 / 100 — 셸·홈·일기·이벤트함·상세 V2·9테마·반응형·온보딩 완료, 브릿지 READY(-5), 데모 상수 잔존(-2), 서버 동기화 설정 없음(-2)
- CLOSED LOOP 85 / 100 — local·mock·SQL 계약에서 끝까지 닫힘, Production LIVE 미검증(-15)
- PORTABILITY 90 / 100 — brand/service/module 레지스트리·tenant 경계·문서, domain/adapters 물리 분리 미완(-10)
- P0 = 0
