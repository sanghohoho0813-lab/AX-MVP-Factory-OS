# PROJECT_STATE — MIRAE AI LAB OS × Customer Platform (2026-09-05)

브랜치: `main` (Production 직행 — DECISIONS D-16). Production: https://ax-mvp-factory-os.vercel.app (supabase 모드)
고객 플랫폼: https://miraeailab.com (`main` 직행)

## STRATEGIC GATES

| Gate | 상태 | 근거 |
|---|---|---|
| AX VERDICT | GO | 실제 고객 3~4곳을 이 시스템으로 운영 중 |
| Capital Independence | PASS | 자금·투자 없이도 대표의 하루 비용을 줄인다 (SPEC "WHY MONEY") |
| PRIMARY CONSTRAINT 잠금 | DONE | "오늘 뭐부터" 를 매일 재조합하는 시간 누수 |
| CORE VALUE 3 | DONE | 놓치지 않기 · 맥락 한 곳 · 고객 왕복 |
| MONEY KPI | **측정 시작** | `/kpi` — 10개 지표, 기존 기록에서 계산. 목표치 없음. 기준선은 5건 이상부터 |
| Strategic P0 | 0 | 아래 "Strategic P0 점검" |

## PRIMARY CONSTRAINT STATUS
- `/`(오늘): 반드시 처리할 것 N건 → 지금 이것부터 3건(이유 표기) → 숫자 4칸 → 빠른 기록 — LIVE
- 휴대폰 첫 화면에서 2초 안에 "무슨 화면 / 무엇이 중요 / 무엇을 할지" 가 읽힌다 — 390px 실측 (docs/UI_AUDIT_MOBILE.md)

## MONEY KPI / BASELINE STATUS
`src/services/kpiService.ts` · 화면 `/kpi`

| 그룹 | 지표 | 상태 |
|---|---|---|
| 비용·시간 | 앱 열고 첫 행동까지 시간 | 측정 방법만 정함 (측정 지점: 오늘 화면 진입 → 첫 클릭) |
| 비용·시간 | 마감을 넘긴 진행 업무 | 측정 중 |
| 매출·돈 | 예정일 지난 미수금 · 수금 지연 일수 · 놓친 자금 신청 | 기준선 만드는 중 (근거 5건 미만) |
| 규모 | 동시에 관리 중인 업체 · 업체당 진행 업무 | 측정 중 |
| 실제 사용 | 30일 중 기록한 날 · 7일 일기 · 고객 이벤트 처리율 | 기준선 만드는 중 |

목표치: DO NOT INVENT — 어디에도 없음. 개선율: 12주 실증 후에만.

## DATA FOUNDATION
- SSOT: `docs/DATA_DICTIONARY.md` (19 엔티티). 내부 SoR `operations_clients`, 고객 SoR `profiles`, 연결 `portal_client_links`, 왕복 `customer_events` / `portal_updates`.
- 브릿지 0006~0009 Production 적용 완료. 0010(업무 항목 직접 추가) **미적용** — 적용 전까지 클라우드에서는 READY.
- Data Moat Score(자가): 독점성 2 · 시간축 2 · Outcome 연결 1 · 반복성 2 · 권리/품질 2 · AI/사업 활용 1 = **10/12**

## AI / LOGIC STATUS
- RULE: 경고 11종 · Top 3 점수·이유 · 하루 정리 · 이벤트 우선순위 · 고객 단계 추천 · 성과 지표 — LIVE, 전부 설명 가능
- OCR: LIVE (사람이 확인 후 저장)
- LLM: NEXT — `/roadmap` 에 "하루 정리를 글로 풀어 주는 AI" 로만 존재. 화면 어디에서도 "AI" 라 부르지 않는다.
- 자동화 수준: L1(정리) · L2(추천) 까지. L3/L4 없음.

## PROOF STATUS
- Adoption: `/kpi` 실제 사용 그룹 (기록한 날 · 일기 건수 · 이벤트 처리율) — 측정 중
- Efficiency: 마감 넘긴 업무 · 미수금 · 수금 지연 — 기준선 만드는 중
- Demand: 고객 플랫폼 이벤트 수 — 2026-09-04 실제 왕복 2건 확인 (요청 1 · 서류 1)
- Evidence 구조: 활동 기록(업체별) · 고객 이벤트(provenance) · 업무 일기 · 발행 이력 — 12주 뒤 Evidence Pack 을 만들 재료는 쌓이는 중

## ADOPTION READINESS
- AX Owner: 대표 본인. 사용자 1인 — 직원 부담 항목 해당 없음.
- 첫 접속 안내창 제거(D-17). 휴대폰 하단 내비로 한 손 조작. 매일 쓰는지는 `/kpi` "30일 중 기록한 날" 로 본다.

## RISK / GOVERNANCE
- 고객 투영 allowlist RPC · RLS · storage 경로 — 계약 테스트 녹색, Production 하드닝(0007) 적용
- service_role 키 브라우저·저장소 0 (dataMode 가 거부)
- 주민등록번호·공동인증서 비밀번호 미저장
- 남은 위험: 0010 미적용 상태에서 "업무 항목 추가" 를 누르면 빨간 오류 문구 (기능은 정지, 데이터 손상 없음)

## PLATFORM READINESS
- Customer Portal(My MIRAE): LIVE. Explore/Home · 서비스 카탈로그 · 상세 · 전환(주문·진단·요청·서류) · 완료/상태 · My/History · 리뷰/FAQ · 내부 연결 — 있음. 재주문 경로는 서비스 특성상(단발 인증) 해당 없음, 재진입은 My MIRAE.
- Industry SaaS: NOT BUILDING (구조만 tenant-safe). PLATFORM READINESS: MID.

## EVIDENCE STATUS
- 활동 기록(업체별 200건 상한) · 고객 이벤트 · 업무 일기 · 발행 이력 — LIVE
- Evidence Pack 자동 생성 — NEXT (재료는 쌓임)

## RED TEAM FINDINGS (2026-09-05, 1회)
- P0: 0
- P1 수정: 메타 글자 대비 2.56:1(AA 미달) → 4.76:1 · 1440px 검색칸 'Ctr' 잘림 · 첫 접속 안내창(매일 창부터 닫아야 함)
- P1 수정: Why AX / 향후 확장 / 성과 지표가 **존재하지 않음** → 세 화면 신설(사이드바 '이 시스템')
- P2 → RECOMMENDATIONS.md

## Strategic P0 점검 (v3.0 §19)
| 항목 | 상태 |
|---|---|
| Primary Constraint 없음 | 없음(잠김) |
| 핵심 기능이 Constraint 와 미연결 | 오늘·현황표·상세·일기·이벤트함·발행 전부 연결 (SPEC §핵심 기능) |
| Cost/Revenue/Scale KPI 설계 없음 | 10개 정의 + 측정 중 |
| Demo Data 를 Live 처럼 표현 | local 모드 헤더 "로컬 데모 · 이 브라우저에만 저장", 샘플 이벤트 "샘플" 배지 |
| Baseline 없는 개선율 | 화면·문서 어디에도 없음 |
| 고객행동이 내부 Workflow 와 단절 | 실왕복 확인 |
| 억지 AI 포장 | AI 0개, 전부 규칙이라 표기 |
| High Risk AI 무감독 | 해당 없음 |
| Data Provenance 불명확 | 이벤트에 source/occurredAt/receivedAt, 활동 기록에 시각 |
| Future 를 현재처럼 표현 | NEXT 배지 + `/roadmap` 시트, 미래 기능 버튼 0 |
| 정책자금 "보장" 표현 | 없음 |
| Capital Independence 실패 | PASS |

## BLOCKED FOR COMPLETION?
- 아니오. 사람 작업 1건 남음: Supabase SQL Editor 에서 `20260904000010_custom_services.sql` 실행 (업무 항목 직접 추가를 클라우드에서 LIVE 로).
