# PORTABILITY — 이 소스를 다른 컨설팅 SaaS 의 시작점으로 쓰기 위한 경계

"파일 복사"가 아니라 **portable product core 를 그대로 두고 교체 지점만 바꾸는** 구조를 목표로 한다.

## 1. 교체 지점 (회사마다 바뀌는 것)

| 지점 | 파일 | 바꾸는 내용 |
|---|---|---|
| 브랜드 | `src/brand/brand.config.ts` · `public/brand/*` · `public/favicon.svg` | 이름·부제·로고·고객 플랫폼 URL·문의 이메일·기본 테마 |
| 업무 종류 | `src/config/serviceCatalog.ts` (+ `src/content/clientOpsCatalog.ts` 의 SERVICES/DOCUMENTS) | 파는 업무·필요 서류·고객 노출·자금 연관·주문 상품 매핑 |
| 화면 조립 | `src/config/moduleRegistry.ts` | 어떤 그룹/모듈을 켤지, 순서, 접힘 |
| 고객 플랫폼 어댑터 | `src/services/customerBridgeService.ts`(supabase 분기) · `supabase/migrations/…customer_bridge.sql` 의 9a~9c 트리거 | 고객 앱의 테이블(리드·주문)이 다르면 트리거만 다시 쓴다. 이벤트 계약(`customer_events`)은 그대로 |
| 테넌트 | `workspaces` / `workspace_members` / RLS 헬퍼 | 그대로 재사용 — 회사 = 워크스페이스 |
| 문구 | 화면 문자열은 한국어 하드코딩 | (NEXT) 다국어가 필요하면 config 화 |

## 2. 그대로 재사용되는 core

- 도메인: `src/types/clientOps.ts`, `src/types/bridge.ts`
- 규칙 엔진: `clientOpsAlerts` · `clientOpsSchedule` · `dailyBriefService` · `clientOpsActivity` · `journalService`
- 저장소 어댑터: `clientOpsService` · `customerBridgeService` · `journalService` (local/supabase 이중 어댑터)
- 셸: `AppShell` · `Sidebar`(레지스트리 기반) · `Header` · 테마 시스템(9종) · 온보딩
- 화면: 오늘 Command Center · 고객 운영 · 업체 상세 V2 · 이벤트함 · 업무 일기 · 일정 · 설정
- 보안 계약: 브릿지 RPC allowlist · storage 경로 계약 · 계약 테스트

## 3. 하지 말아야 할 것 (이식성을 깨는 패턴)

- 컴포넌트 안에 회사 이름·URL 하드코딩 → `brand` 사용
- `ServiceKey` union 에 값을 추가하고 switch 를 늘리기 → 레지스트리에 정의 추가 후 화면은 레지스트리를 순회
- "사용자가 한 명이니까" owner/workspace 검사 생략
- 고객 앱에서 내부 테이블 직접 읽기
- 브랜드별 마케팅 콘텐츠를 core 컴포넌트에 섞기 (공개 사이트의 마케팅은 그 저장소에 둔다)

## 4. 디렉터리 경계

```
src/brand/        브랜드 (교체)
src/config/       serviceCatalog · moduleRegistry (교체)
src/domain/       (예약) 순수 도메인 규칙 — 현재는 src/services/* 의 순수 함수가 이 역할
src/services/     저장소 어댑터 + 규칙 엔진
src/adapters/     (예약) 외부 시스템 어댑터 — 현재 supabase 분기는 각 service 내부
src/components/   셸·UI
supabase/         마이그레이션 · 계약 테스트
```
`src/domain` / `src/adapters` 는 다음 정리 단계에서 순수 함수와 supabase 분기를 옮겨 넣을 자리로 만들어 두었다(빈 디렉터리는 git 에 없으므로 문서로만 남긴다).

## 5. 검증 방법

- `npm run test:mirae-os` — 브랜드/레지스트리/투영 allowlist 계약
- `supabase/tests/bridge_contract.sql` — 브릿지 보안 계약
- 브랜드를 바꿔 본 뒤 `grep -rn "미래AI랩\|MIRAE" src --include=*.tsx` 가 `brand.config` 외에 나오지 않아야 한다
