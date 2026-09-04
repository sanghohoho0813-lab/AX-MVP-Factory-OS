# PROJECT_SPEC — MIRAE AI LAB OS × Customer Platform Unified Rebuild v1.0

> 이 파일은 두 저장소(내부 OS · 고객 플랫폼)를 하나의 운영 생태계로 묶는 설계도다.
> 우선순위: 이 SPEC → Unified Design & Development System v3.0 → Production 데이터·보안 계약 → 최신 main → 자율판단.

## STRATEGY LOCK

```
PRODUCT            MIRAE AI LAB OS (미래AI랩 OS) — Consulting Operations & AX Studio
PRIMARY USER       미래AI랩 대표 1인 (향후 법인컨설팅 SaaS로 이식 가능해야 함)
CUSTOMER SURFACE   MIRAE AI LAB (miraeailab.com) · 로그인 영역 "My MIRAE"

AX VERDICT         GO — 이미 실제 고객 3~4곳을 이 시스템으로 운영 중. 정책자금·투자 없이도 대표의 하루 운영비용을 줄이는 경제적 이유가 있다(Capital Independence Test 통과).

PRIMARY CONSTRAINT (TIME LEAK)
  여러 고객사의 법인·인증·특허·AX·자금·서류·수금·일정을 머리·카톡·파일·여러 화면에 흩어 관리하면서
  오늘 무엇을 해야 하고 어떤 고객에게 무엇을 요청해야 하는지 매일 다시 조합해야 하는 운영비용.
  SECONDARY (REVENUE LEAK): 계약금·성공보수 수금 누락, 정책자금 신청 마감 누락.

CORE VALUE 1       오늘 해야 할 일을 놓치지 않는다.
CORE VALUE 2       고객·업무·서류·돈·자금·메모의 맥락이 한 곳에서 이어진다.
CORE VALUE 3       miraeailab.com의 고객 행동이 자동으로 내부 업무 Event가 되고, 내가 처리한 결과가 고객에게 안전하게 되돌아간다.

MONEY KPI (BASELINE STATUS: UNKNOWN — 실측 전 목표치 발명 금지)
  COST KPI     하루 중 "오늘 뭐부터" 조합에 쓰는 시간(분/일) — 앱 열고 첫 행동까지 시간으로 대체 측정
  REVENUE KPI  예정일 지난 미수금 건수·금액(주간) / 자금 신청 마감 누락 건수
  SCALE KPI    대표 1인이 동시에 운영 가능한 고객사 수

CUSTOMER PRIMARY CONVERSION
  My MIRAE → 내 프로젝트 → 요청받은 서류 업로드 / 요청 제출 → 내부 이벤트 → 처리 → 고객 화면에 업데이트

PROCESS REDESIGN (ELIMINATE → STANDARDIZE → DIGITIZE → AUTOMATE → AI)
  ELIMINATE   카톡에서 진행상태 되묻기, 서류 재요청 반복
  STANDARDIZE 업무 6종 × 서류 10종 × 고객 공개 단계 6종
  DIGITIZE    업무일기(통화·결정·후속조치), 고객 이벤트함
  AUTOMATE    마감·유효기간·수금 경고, 고객 행동 → 이벤트, 활동 기록
  AI          (이번 단계 없음) — 일일 요약은 규칙 기반. LLM은 Adapter 자리만 설계

SHARED DATA ASSET / SSOT
  같은 Supabase project(mirae-ai-lab). 내부 SoR = operations_clients + workspace 테이블. 고객 SoR = profiles + 주문/진단.
  둘 사이는 portal_client_links가 잇고, 왕복은 customer_events(고객→내부) / portal_updates(내부→고객)로만 흐른다.

CUSTOMER EVENT → AX MAP
  diagnosis_completed      → 이벤트함 → 고객사 연결/생성 → (추천) 진단 리드 필드 매핑
  service_order_created    → 이벤트함 → 연결 → (추천) 서비스 업무 시작
  document_uploaded        → 이벤트함 + 업체 서류함 (업로드됨 ≠ 검토완료)
  customer_request_created → 이벤트함 + 업체 고객 플랫폼 탭
  customer_action_completed→ 이벤트함 (고객이 요청 조치 완료)

AI METHOD MATRIX
  일정/마감/미수금/우선순위/이벤트 우선순위  RULE (설명 가능)
  하루 정리(End of Day)                     RULE (deterministic; "AI 요약"이라 부르지 않음)
  문서 OCR/파싱                             RULE + 기존 OCR (확인 후 반영)
  향후 LLM 자연어 정리                      NEXT (Adapter 자리만)

PROOF PLAN
  Adoption: 대표가 매일 `/`에서 시작하는가(활동 기록·일기 건수)
  Efficiency: 미수금 연체·마감 누락 건수 추이 (baseline 미정)
  Demand: 고객 Portal 로그인·서류 업로드·요청 건수

PORTAL / PLATFORM READINESS
  단일 고객 Portal(My MIRAE). 다중 조직 SaaS UI는 NOT BUILDING. 구조만 tenant-safe(workspace_id + portal_client_link).

FUTURE EXPANSION (NEXT 표기, 현재 기능처럼 보이지 않게)
  1. 법인컨설팅 SaaS 분리(brand.config·serviceCatalog·moduleRegistry 교체)
  2. 워크스페이스 멤버별 Team Journal
  3. LLM 일일 요약 Adapter
  4. 고객 알림(이메일/카카오) 발송
  5. 결과자료 고객 공유 자동화

MOAT CANDIDATE
  고객별 업무·서류·수금·자금·판단 이력이 시간축으로 쌓인 운영 데이터 + 고객 왕복 기록(Evidence)

RISK LEVEL
  보안 High: 내부 payload(메모·수임료·자금판단) 고객 노출 금지 — allowlist RPC로만 투영
  운영 Medium: 마이그레이션 미적용 시 브릿지는 READY 상태 (LIVE 표기 금지)

NOT BUILDING THIS PHASE
  Native App · 실시간 채팅 · 내부 메모 자동공개 · 수임료/원가/심사판단 공개 · 새 결제수단 · AI 기능 남발 · Industry SaaS 완제품
  다중 조직 Billing UI · monorepo · Vercel project rename · 도메인 변경 · Marketing Automation · L4 자동의사결정

STRATEGIC ACCEPTANCE
  "내일 아침 이 화면을 열었을 때 오늘 할 일을 바로 알고, 고객과 무슨 일이 있었는지 기록하고,
   miraeailab.com에서 고객이 한 행동이 여기 들어오고, 내가 처리한 결과가 고객 화면에 돌아가며,
   이 소스가 다른 컨설팅 SaaS의 시작점이 될 수 있는가?" — 전부 YES여야 완료.
```

## PRIMARY JOURNEYS

```
INTERNAL   / (오늘) → Top 3 Action → 업체 상세 → 업무/서류/수금 갱신 → 활동 기록·업무 일기 → 다음 행동
CUSTOMER   My MIRAE → 내 프로젝트 → 지금 할 일 → 서류 업로드 / 요청 제출 → (내부 처리) → 업데이트 확인
CLOSED LOOP  고객 행동 → customer_events → 이벤트함 → 처리 → portal_updates 발행 → 고객 화면 → 고객 조치 → customer_events
```

## INFORMATION ARCHITECTURE — INTERNAL

```
[오늘]         /                오늘의 Command Center
[고객]         /ops/clients     고객 운영 (업체별 현황표)
               /ops/inbox       고객 이벤트함
               /ops/clients/:id 업체 상세 V2 (개요·업무·서류·수금·자금·고객 플랫폼·업무 일기·파일)
[일정]         /ops/calendar
[자금·지원]    /funding
[업무 일기]    /journal (오늘·이번 주·전체·고객별·유형별)
[AX STUDIO]    접힘 — /diagnosis /selection /mvp-design /website-studio /validation /deliverables /funding /cases /clients
[도구함]       /tools
[설정]         /settings
호환           /today → /   ·  /guide → /getting-started  ·  모든 기존 라우트 유지
```

## INFORMATION ARCHITECTURE — CUSTOMER

```
공개(색인)     / /consultants /business-services/** /ax-industries/* /business-diagnosis /terms …
로그인(noindex) /mypage (My MIRAE 허브) · /my-projects · /my-projects/:linkId (탭: 할 일·진행·서류·업데이트·요청·결과)
               /my-tools /my-orders /saved /admin/**
```

## PROJECT SIGNATURE (Generic Drift 방지, 5+)

1. **MIRAE Daily Command Strip** — 날짜·요일·시각 + 오늘 반드시/이번 주/고객 대기/받을 돈/새 이벤트 5칸 + Top 3 Action(규칙 근거 표시)
2. **Customer Event Inbox** — 누가·무엇을·언제·연결 고객·다음 행동, 연결/신규/확인/처리/보류
3. **Client Work Matrix** — 업체 × 업무 6종 셀(완료/진행/대기/막힘/임박)
4. **Work Journal Timeline** — 통화·결정·후속조치·막힘·성과·아이디어 7유형, 고객·업무 연결, 후속 완료
5. **Customer↔Internal Round-trip Status** — 업체 상세 "고객 플랫폼" 탭: 연결 계정·이벤트·요청·공유 서류·발행 업데이트·고객 화면 미리보기
6. **Funding / Money signals** — 예정 수금·연체·금액 미정 분리, 공고 마감
7. **My MIRAE project timeline** — 고객 공개 6단계(준비 중→자료 확인 중→진행 중→기관 접수→결과 대기→완료) + 업데이트 타임라인

## DATA CONTRACT (요약 — 상세는 DATA_DICTIONARY.md · CUSTOMER_AX_BRIDGE.md)

신규 테이블(additive): `portal_client_links` · `customer_events` · `portal_updates` · `portal_requests` · `portal_documents` · `ops_journal_entries` · `customer_intake_routing`
고객 접근: 기본 테이블 RLS **없음** → `portal_*` SECURITY DEFINER RPC(명시 컬럼 allowlist)만.
내부 접근: `workspace_id` RLS(`is_workspace_member` / `can_write_workspace`).
Storage: `client-documents` 보존, 고객 업로드 경로 `{workspaceId}/portal/{linkId}/{file}`.

## THEME / TYPOGRAPHY

- Canonical 9 Theme. **기본 = 05 Deep Teal** (로고의 짙은 청록 M + 공개 사이트의 웜 액센트 `#D47A4A`와 가장 가까움).
- 고객 플랫폼은 Theme Picker 미노출, 브랜드 기본색 사용.
- UiTextScale default 1.0 / 1.15 / 1.30. 본문 15.5~17px, 페이지 제목 28~32px, 메타 12~13px는 진짜 보조 정보에만.

## CAPABILITY STATUS (2026-09-03 시점)

| 기능 | 상태 |
|---|---|
| 고객 운영·경고·일정·자금·서류·OCR·백업·테마 | LIVE |
| Daily Command Center · Work Journal · Event Inbox UI · Client Detail V2 · Publish Modal | LIVE(local) / **READY**(supabase — 마이그레이션 적용 전) |
| Customer Portal(/my-projects) · 서류 업로드 · 요청 | **READY** (마이그레이션 적용 전) |
| 진단/주문 → customer_events 트리거 | **READY** (SQL 커밋, 적용 절차 SETUP.md) |
| LLM 요약 · 고객 알림 발송 · SaaS 분리 | NEXT |
