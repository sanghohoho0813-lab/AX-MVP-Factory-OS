# PROJECT_STATE — MIRAE AI LAB OS × Customer Platform (2026-09-08)

브랜치: `main` (Production 직행 — DECISIONS D-16). Production: https://ax-mvp-factory-os.vercel.app (supabase 모드)
고객 플랫폼: https://miraeailab.com (`main` 직행)

## 컨설팅 작업실 (특허 × 벤처 × MVP) — feature 브랜치 (2026-09-08)
- **main 병합·배포 완료** (`5268519`, 2026-09-08 대표 지시 — D-44). 브랜치 `claude/patent-venture-mvp-studio-v1` 도 그대로 남아 있다.
- **마이그레이션 `20260908000012` 는 Production 미적용** — 적용 전까지 클라우드에서는 '컨설팅 작업실' 이 READY 안내만 보인다(기존 기능 영향 0).
- 엔진: S0~S16 · 사실표 45항목 · One Core Thread 규칙 경고 · 게이트 6종 · 다음 행동 resolver · 프롬프트 13종×4대상 · 개인정보 필터 · 결과 들여오기(버전) · KIPO 118종
- 화면: `/studio`, `/studio/:id` 12탭 · 고객 상세 '컨설팅' 탭 · 오늘 '컨설팅 다음 행동' · 전역 검색 그룹
- LLM API 호출 0. 규칙 계산을 AI 라 부르지 않는다.
- 마이그레이션 3건은 2026-09-08 대표가 Supabase SQL Editor 에서 실행 완료(표 5개 × 정책 2 확인).

## 간단 모드(운영자 UX) — main 병합·배포 완료 (2026-09-08)
- 원 지시는 "Preview 까지" 였으나, 대표가 결과를 보고 **main 병합을 지시**했다. 브랜치 `claude/simple-operator-ux-v1` 도 그대로 남아 있다.
- `/studio/:id` 기본이 3탭(진행하기·결과물·기록)으로 바뀌었다. 기존 12탭은 `?adv=1` 로 그대로 살아 있다 — 지운 것 없음.
- 화면은 `CurrentTask` 하나만 그린다(`src/domain/consulting/currentTask.ts` · `applyTask.ts`). 행동 7종.
  프롬프트 종류·산출물 종류·버전·단계를 사용자가 고르지 않는다.
- 결과는 `--- MIRAE_OS_RETURN ---` 블록으로 돌아오고, 못 알아봐도 원문은 그대로 저장된다.
- 회사 기본정보는 **사업자등록증·법인등기부등본을 올리면 자동으로 채워진다**(한 장만 올려도, 두 장을 함께 올려도 된다).
  판독기·파서는 고객 운영의 '서류에서 불러오기' 를 그대로 재사용. 읽은 값은 체크한 것만 들어가고 출처가 서류 이름으로 남는다.
- 실측: 새 프로젝트 → 첫 프롬프트 **7클릭**, 결과 저장 → 다음 프롬프트 **1클릭**. E2E 74 + 단위 81 녹색.
- 사람이 할 일: Production 에서 프로젝트 하나를 끝까지 밀어 저장·재조회가 되는지 한 번 확인한다(supabase 모드 미검증 구간).

## 마찰 제거(처음 쓰는 50대 기준) — main 병합·배포 완료 (2026-09-08)
- 원 지시는 "Preview 까지" 였으나, 대표가 결과를 보고 **main 병합을 지시**했다. 브랜치 `claude/zero-friction-ux-v2` 도 그대로 남아 있다.
- 모르면 [잘 모르겠어요 · 나중에] 로 넘어간다. 미룬 것은 시스템이 들고 있다가 출원·숫자·제출·신청 단계에서 다시 묻는다.
- 시스템이 먼저 문장 초안을 쓰고(핵심기술·MVP 흐름 등 5곳), 판단이 필요한 자리는 먼저 추천한다(진행 판단·참고자료).
  규칙 계산이고 AI 가 아니다. 근거가 없으면 만들지 않는다. NO-GO 는 추천하지 않는다.
- 조사·어미를 자모 계산으로 맞춘다(`koreanText.ts`). 업무 용어는 고급 보기에만 — 간단 모드는 쉬운 한국어.
- 실측: 첫 프롬프트까지 **7클릭 · 타이핑 0회(100% 무타이핑)**. 단위 120 + E2E 88 녹색.
- 사람이 할 일: Production 에서 한 번 써 보고 어디서 멈추는지 알려 주면 그 자리만 고친다(실제 초보 관찰이 아직 없는 구간).

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

## FILE STORAGE
- 버킷 `client-documents` — 비공개. 열람은 5분짜리 서명 URL 로만.
- 형식·크기 제한 없음(D-22, `20260906000011_storage_open_types.sql`). 한글·워드·엑셀·압축파일·큰 스캔본 모두 올라간다.
- 실제 상한은 Supabase 전역 설정 한 곳(Dashboard → Storage → Settings → Upload file size limit) — 기본 50MB.
- 예외: '서류에서 불러오기'(OCR)만 PDF·이미지. 보관이 아니라 판독이라서.

## BLOCKED FOR COMPLETION?
- 아니오. 사람 작업 2건 남음 (둘 다 Supabase SQL Editor 에서 붙여넣기 실행):
  1. `20260906000011_storage_open_types.sql` — 파일 형식·크기 제한 해제. 실행 전까지 한글·워드·ZIP·10MB 초과는 계속 거부된다.
  2. `20260904000010_custom_services.sql` — 업무 항목 직접 추가를 클라우드에서 LIVE 로.
