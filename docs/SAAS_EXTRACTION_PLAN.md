# SAAS_EXTRACTION_PLAN — MIRAE AI LAB OS 를 법인컨설팅 SaaS 로 분리할 때

이번 단계에서는 실행하지 않는다. "복붙"이 아니라 portable core 재사용 절차다. 각 단계는 앞 단계가 끝나야 시작한다.

## STEP 1 — 새 private 저장소 생성
- 예: `<org>/consulting-os`. GitHub 저장소·Vercel 프로젝트는 새로 만든다(기존 것 rename 금지).
- 완료 기준: 빈 저장소 + Vercel project 연결.

## STEP 2 — 현재 내부 소스 fork/clone
- `AX-MVP-Factory-OS` 의 `main` 을 fork(또는 `git clone --mirror`). 히스토리를 유지해야 나중에 core 개선을 cherry-pick 할 수 있다.
- 완료 기준: `npm run build && npm run test:all` 녹색.

## STEP 3 — 브랜드 교체
- `src/brand/brand.config.ts` 값 전부, `public/brand/*` 로고, `public/favicon.svg`, `index.html` title/description.
- `grep -rn "미래AI랩\|MIRAE\|miraeailab" src index.html public` 이 brand.config 외에 나오지 않아야 한다.
- 기본 테마는 새 브랜드에 가장 가까운 팔레트로 재선정(9종 중).

## STEP 4 — 서비스 카탈로그를 법인컨설팅용으로 확장
- `serviceCatalog.ts` 에 새 업무 정의 추가(예: 법인 전환, 인증 갱신, 세무 대행). 기존 6종은 `enabled:false` 로 끌 수 있다.
- 새 업무가 저장 스키마(`ServiceKey`)를 넘어서면 payload 의 `services` 를 registry key 기반 map 으로 읽는 정규화만 확장한다 — generic EAV 로 갈아엎지 않는다.
- 서류 카탈로그(`DOCUMENTS`)도 같은 방식.

## STEP 5 — MIRAE 전용 브릿지 어댑터 분리
- 트리거 9a~9c(진단 리드·주문·상담)는 miraeailab.com 의 테이블에 묶여 있다. 새 회사의 고객 앱(또는 없음)에 맞춰 트리거만 교체한다.
- `customer_events` 계약, `portal_*` 테이블·RPC, storage 계약은 그대로.
- 고객 앱이 없으면 브릿지는 READY 로 두고 내부 OS 만 사용한다.

## STEP 6 — 멀티테넌트 워크스페이스/RLS 검증
- 회사 = 워크스페이스. `supabase/tests/rls_test.sql` + `bridge_contract.sql` 을 새 project 에서 실행.
- 워크스페이스 초대(`workspace_invites`)로 멤버 온보딩.

## STEP 7 — billing / seat / role 확장
- 현재 없음. `workspaces` 에 plan/seat 컬럼(additive), 역할은 기존 `workspace_role`(owner/admin/editor/viewer) 재사용.
- 결제는 공개 사이트의 PortOne 계층을 참고하되 내부 OS 에 직접 넣지 않는다(별도 billing 서비스).

## STEP 8 — 마이그레이션
- 새 Supabase project 에 `supabase/migrations/*` 순서대로 적용. 기존 미래AI랩 데이터는 옮기지 않는다(고객 데이터 분리).
- 로컬 모드 백업(JSON)을 새 워크스페이스로 가져오는 기능은 이미 있다(설정 > 데이터).

## STEP 9 — QA
- `npm run test:all` · 계약 테스트 2종 · 9테마 · 반응형 8폭 · Whole-App Acceptance Run(오늘 → 고객 → 상세 → 일기 → 설정).
- P0 = 0 이어야 출시.

## core 개선을 양쪽에 반영하는 법
- core 파일(§PORTABILITY 2)만 바꾼 커밋은 두 저장소에 cherry-pick 한다. 교체 지점 파일을 건드린 커밋은 cherry-pick 하지 않는다.
- 두 저장소가 갈라지는 것을 막으려면 core 를 npm 패키지로 빼는 것이 다음 단계 — 두 번째 SaaS 가 확정될 때 결정한다(DECISIONS D-15).
