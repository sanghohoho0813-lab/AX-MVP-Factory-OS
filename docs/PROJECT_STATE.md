# PROJECT_STATE — MIRAE AI LAB OS × Customer Platform (2026-09-03)

브랜치: 내부 `claude/mirae-ai-lab-os-v1` (base `0c2d2c8`) · 고객 `claude/mirae-customer-platform-v1` (base `8036aff`, `origin/main 222a65b` 병합)
Production: **변경 없음** (main 미병합, Vercel Production 미배포).

## STRATEGIC GATES

| Gate | 상태 | 근거 |
|---|---|---|
| AX VERDICT | GO | 실제 고객 3~4곳 운영 중, 자금 없이도 운영비용 절감 |
| Capital Independence | PASS | 정책자금·투자 전제 없음 |
| PRIMARY CONSTRAINT 잠금 | DONE | "오늘 무엇부터"를 매일 재조합하는 시간 누수 (PROJECT_SPEC) |
| CORE VALUE 3 | DONE | 놓치지 않기 · 맥락 한 곳 · 고객 왕복 |
| MONEY KPI | **BASELINE UNKNOWN** | 목표치 발명하지 않음 — 첫 2주 실측 후 기입 |
| Strategic P0 | 0 | Demo=Live 위장 없음(READY 표기), Future 는 NEXT 표기, 가짜 AI 없음 |

## PRIMARY CONSTRAINT STATUS
- `/`(오늘) 이 Top 3·5신호·빠른 기록·이벤트·챙길 업체·돈·자금·하루 정리를 한 화면에 — LIVE(local) / LIVE(supabase, 브릿지 제외)
- 후속조치 기한 → Top 3 반영 — LIVE

## MONEY KPI / BASELINE STATUS
- COST KPI(앱 열고 첫 행동까지 시간): 미측정 · REVENUE KPI(연체 건수/금액): 화면에 표시(측정 시작 가능) · SCALE KPI(동시 고객사 수): 표시 가능
- 목표치: DO NOT INVENT — 기입 안 함

## DATA FOUNDATION
- SSOT 정의: `docs/DATA_DICTIONARY.md` (19 엔티티, SoR·쓰기·읽기·고객 노출·민감도)
- 브릿지 스키마: 7 테이블 · 6 트리거 · 10 함수 · storage 정책 2 — SQL 작성 완료, 로컬 PG16 검증 완료
- Data Moat Score(자가): 축적(2) · 결과 데이터(1, 활동/이벤트) · 고객 왕복(2) · 시간축(2) · 판단 기록(2, 일기) · 교차 표면(1) = **10/12**

## AI / LOGIC STATUS
- RULE: 경고 11종 · Top 3 점수·이유 · 하루 정리 · 이벤트 우선순위 · 고객 단계 추천 — LIVE
- OCR: 기존(pdf.js→tesseract) LIVE
- LLM: NEXT (Adapter 자리만, 어디에도 "AI 요약"이라 표시하지 않음)

## PROOF STATUS
- Adoption 증거원: 활동 기록·일기 건수(데이터 존재) · Efficiency: 연체/마감 누락 추이(화면) · Demand: 고객 Portal 이벤트 수 — 모두 **측정 구조만 존재, 실적 없음**

## ADOPTION READINESS
- AX Owner: 대표 본인 · 직원 부담 증가 없음(1인) · 튜토리얼/화면 도움말 갱신 완료

## RISK / GOVERNANCE
- 고객 투영 allowlist·RLS·storage 경로 — 계약 테스트 녹색(로컬 PG)
- 남은 위험: Production 적용 전까지 브릿지는 READY. 공개 사이트 `profiles` 스키마(name/role)와 내부 정의(display_name)가 다른 상태로 공존 — 브릿지는 `id/email` 만 사용해 무관.

## PLATFORM READINESS
- Customer Portal(My MIRAE): 화면·계약·Mock E2E 완료 — **READY** (마이그레이션 적용 후 LIVE)
- 다중 조직 SaaS UI: NOT BUILDING (구조만 tenant-safe)

## EVIDENCE STATUS
- 활동 기록(200건/업체) · 고객 이벤트(provenance 포함) · 업무 일기 — LIVE(local), supabase 는 일기/이벤트 테이블 적용 후

## CAPABILITY STATUS

| 기능 | 상태 |
|---|---|
| 브랜드/셸/9테마/레지스트리 내비 | LIVE |
| 오늘 Command Center · 업무 일기 · 이벤트함(UI) · 업체 상세 V2 · 발행 모달 | LIVE(local) · supabase: 일기/이벤트/포털은 **READY** |
| 고객 운영·경고·일정·자금·서류·OCR·백업·AX STUDIO 전체 | LIVE (회귀 없음) |
| 브릿지 DB(테이블·RLS·RPC·트리거·storage) | **READY** — SQL 커밋 + 로컬 검증, Production 미적용 (SETUP.md) |
| 고객 플랫폼 /my-projects · 상세 · 업로드 · 요청 · 조치 완료 | **READY** — Mock Contract E2E 20/20 |
| 진단/주문/상담 → 이벤트 트리거 | READY |
| 고객 알림 발송 · LLM 요약 · Team Journal · SaaS 분리 | NEXT |

## RED TEAM FINDINGS (1회, P0/P1 만 수정)
- P0 후보 → 0 (내부 payload 고객 노출 경로 없음, 가짜 Live 없음, 404 Future 메뉴 없음)
- P1 수정: `isPortalNotReady` 가 PostgrestError 객체를 못 읽던 문제(고객 앱·내부 이벤트함/포털 탭) → 수정
- P1 수정: 내부 E2E 가 잘못된 포트를 보던 QA 절차 오류 → 재실행
- P2 → RECOMMENDATIONS.md

## BLOCKED FOR COMPLETION?
- 아니오. 단, "LIVE 고객 왕복"은 Production Supabase 마이그레이션 적용(사람 작업, SETUP.md §3) 이후에 성립한다. 그 전까지 완료 보고는 "READY 포함 70~80% High-Fidelity Build" 로 한다.

## 사용자가 Preview 에서 직접 확인할 10개 화면
1. `/` 오늘 — 인사·5신호·Top 3(이유)·빠른 기록
2. `/ops/inbox` — 샘플 이벤트 만들기 → 새 고객사로 만들기 → 처리 완료
3. `/ops/clients/:id` 개요 탭 — 지금·진행 업무·막힘·돈·고객
4. 같은 화면 고객 플랫폼 탭 — 계정 연결(DEMO) → 서류 요청 → 업로드 흉내 → 확인 완료 → 고객에게 업데이트 → 고객 화면 보기
5. `/journal` — 종류·고객 필터, 후속조치 완료
6. `/ops/calendar`, `/funding`
7. `/settings` 화면 색 9종 · 움직임 줄이기
8. 사이드바 AX STUDIO 접힘/펼침, 헤더 "고객 플랫폼" 새 탭
9. 고객 플랫폼 Preview `/mypage` → 내 프로젝트 (연결 전에는 안내 문구)
10. 고객 플랫폼 `/my-projects/:linkId` 6탭 (마이그레이션 적용 후 실데이터)
