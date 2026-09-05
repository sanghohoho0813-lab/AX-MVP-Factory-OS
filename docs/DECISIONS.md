# DECISIONS — MIRAE AI LAB OS × Customer Platform

기록 형식: DECISION / WHY / WHY NOT ALTERNATIVE / REVISIT WHEN. 중요한 결정만 남긴다.

---

## D-01 두 저장소를 유지한다 (monorepo 전환 안 함)

- **DECISION** 내부 OS(`AX-MVP-Factory-OS`)와 고객 플랫폼(`mirae-ai-lab-homepage`)을 별도 저장소로 두고, 같은 Supabase project 의 명시적 계약(RPC·테이블)으로만 연결한다.
- **WHY** 두 앱은 배포 주기·보안 경계·빌드 도구(Vite 8 vs Vite 6)·공개 범위가 다르다. 공개 사이트의 SEO·결제·도구 접근 통제는 지금 그대로 살아 있어야 한다.
- **WHY NOT** monorepo 는 공유 코드가 생기면 좋지만, 지금 공유되는 것은 "타입 몇 개와 단계 이름"뿐이다. 그 정도는 문서(CUSTOMER_DATA_CONTRACT)와 SQL 이 SSOT 가 되는 편이 안전하다.
- **REVISIT WHEN** 세 번째 표면(파트너/기관 포털)이 생기거나, 두 앱이 같은 컴포넌트 라이브러리를 쓰기 시작할 때.

## D-02 새 Supabase project 를 만들지 않고 같은 DB 안에 명시적 브릿지를 둔다

- **DECISION** `portal_client_links` · `customer_events` · `portal_updates` · `portal_requests` · `portal_documents` 로만 왕복한다. DB-to-DB 동기화 없음.
- **WHY** 고객 계정(profiles)·주문·진단 리드가 이미 이 project 에 있다. 동기화를 만들면 두 곳의 진실이 어긋나는 순간 고객에게 잘못된 상태가 보인다.
- **WHY NOT** 별도 project + webhook 동기화는 장애 지점이 하나 더 생기고, RLS 를 두 번 검증해야 한다.
- **REVISIT WHEN** 고객 데이터를 법적으로 분리 보관해야 하는 요구가 생길 때.

## D-03 고객은 내부 payload 를 절대 직접 읽지 않는다 (allowlist RPC 만)

- **DECISION** 고객용 정책을 기본 테이블에 두지 않는다. `portal_*` SECURITY DEFINER 함수가 컬럼을 골라 준 투영만 고객에게 간다. 내부 미리보기(`portal_preview_project`)도 같은 함수를 쓴다.
- **WHY** `operations_clients.payload` 에는 메모·수임료·미수금·자금 판단이 있다. RLS 는 행을 막지 컬럼을 막지 못한다.
- **WHY NOT** 컬럼 권한(GRANT SELECT (col))은 PostgREST 임베드와 섞이면 실수하기 쉽고, 뷰는 RLS 우회가 잦다.
- **REVISIT WHEN** 고객에게 보여줄 필드가 늘어 함수 하나가 너무 커질 때 — 그때도 "함수 = allowlist" 원칙은 유지.

## D-04 사용자 노출 브랜드만 바꾸고 저장소·Vercel·도메인은 바꾸지 않는다

- **DECISION** 화면·문서·파비콘·제목은 MIRAE AI LAB OS. GitHub 저장소명, Vercel project(`ax-mvp-factory-os`), Production URL 은 그대로.
- **WHY** 인프라 이름 변경은 배포 파이프라인·환경변수·북마크를 한꺼번에 깨뜨릴 수 있고 사용자에게 보이지도 않는다.
- **WHY NOT** 전부 rename 하면 깔끔하지만 이번 단계의 목적(매일 쓰는 제품)과 무관한 위험이다.
- **REVISIT WHEN** 별도 도메인(예: os.miraeailab.com)을 붙일 때 — 그때 Vercel project 는 그대로 두고 도메인만 추가.

## D-05 브랜드 문자열은 brand.config 한 곳에만 둔다

- **DECISION** `src/brand/brand.config.ts` 가 이름·로고·고객 플랫폼 URL·기본 테마의 SSOT. 컴포넌트는 "미래AI랩"을 직접 쓰지 않는다.
- **WHY** 같은 소스를 다른 컨설팅 SaaS 로 옮길 때 첫 번째로 바꿀 파일이 하나여야 한다.
- **REVISIT WHEN** 다국어가 필요할 때 — 그때는 config 가 locale 별 값을 갖는다.

## D-06 고객 채팅을 만들지 않는다

- **DECISION** 고객→내부는 구조화 요청(`portal_requests` 6종), 내부→고객은 명시 발행(`portal_updates`)만. 실시간 채팅 없음.
- **WHY** 채팅은 "확인해야 할 것"을 다시 대화 속에 묻어 버린다 — 이 프로젝트의 제약(흩어진 정보 조합 비용)을 도로 만든다. 구조화 요청은 이벤트함에 종류·상태와 함께 들어와 놓치지 않는다.
- **WHY NOT** 채팅이 편해 보이지만 대표 1인이 실시간 응대 SLA 를 감당할 수 없다.
- **REVISIT WHEN** 담당자가 2명 이상이고 응대 시간대가 정해질 때.

## D-07 workspace_id 를 모든 신규 내부 테이블의 tenant 경계로 유지한다

- **DECISION** 1인 사용이라도 `workspace_id not null` + `is_workspace_member/can_write_workspace` RLS 를 모든 신규 테이블에 건다. 고객 쪽은 `portal_client_link` 가 별도 경계.
- **WHY** 나중에 SaaS 로 옮길 때 "owner check 생략" 코드를 찾아 고치는 일이 가장 위험하고 지루하다.
- **REVISIT WHEN** 없음 — 원칙.

## D-08 업무 일기는 owner 본인만 읽는다 (같은 워크스페이스 멤버도 못 봄)

- **DECISION** `ops_journal_entries` RLS = `owner_id = auth.uid() and is_workspace_member(workspace_id)`.
- **WHY** 일기에는 "왜 그렇게 판단했는지", 고객에 대한 솔직한 메모가 들어간다. 팀 공유는 명시적 기능으로 따로 만들어야 한다.
- **REVISIT WHEN** Team Journal 요구 — 그때 `visibility` 컬럼을 추가하고 정책을 덧붙인다(additive).

## D-09 고객 공개는 자동이 아니라 "명시 발행"이다

- **DECISION** 내부 업무 상태·활동 기록·메모는 고객에게 자동 전송되지 않는다. `PublishUpdateModal` 에서 쓴 제목·내용·조치·단계만 `published` 가 된다. 고객 단계(6종)도 사람이 고른다(내부 상태로 추천만).
- **WHY** 내부 8단계 중에는 고객이 오해할 단계(대기·보류)가 있고, 활동 기록에는 "입금 확인 500만원" 같은 내부 문장이 있다.
- **WHY NOT** 자동 동기화는 편하지만 한 번의 실수가 신뢰를 깎는다.
- **REVISIT WHEN** 특정 이벤트(예: 기관 접수 완료)를 자동 공개해도 안전하다는 합의가 생길 때 — 그때도 템플릿 발행 형태로.

## D-10 자동 연결은 "후보 제안"까지만

- **DECISION** 이메일·전화·사업자번호가 같아도 `portal_client_links` 를 자동 생성하지 않는다. 이벤트 트리거는 `profile_id` 를 찾아 붙이고, 활성 연결이 정확히 1개일 때만 이벤트에 link 를 붙인다(2개 이상이면 사람이 고른다). 고객사 연결은 `LinkCustomerModal` 에서 사람이 확정한다.
- **WHY** 동명 회사·대표 개인 이메일 공유 같은 경우 잘못 연결되면 남의 프로젝트가 보인다.
- **REVISIT WHEN** 없음.

## D-11 브릿지가 적용되지 않은 환경은 READY 로 표시한다

- **DECISION** supabase 모드에서 브릿지 테이블/함수가 없으면 화면은 "준비 중(READY)" 안내를 내고 나머지 기능은 그대로 동작한다. LIVE 라고 표시하지 않는다.
- **WHY** Claude 실행 환경에서 Production Supabase 에 apply 할 수 없었다(CLI·자격증명 없음). 미적용 상태를 숨기면 Demo 를 Live 로 위장하는 것이다.
- **REVISIT WHEN** SETUP.md 절차로 마이그레이션을 적용한 뒤 — PROJECT_STATE 의 상태를 LIVE 로 바꾼다.

## D-12 하루 정리·Top 3 는 규칙 기반이며 AI 라고 부르지 않는다

- **DECISION** `dailyBriefService` 의 점수와 이유 문장은 코드에 적힌 규칙이다. LLM 은 Adapter 자리만 남긴다(NEXT).
- **WHY** 마감·미수금·주문은 IF 로 충분하다. 설명 가능해야 대표가 순서를 믿는다.
- **REVISIT WHEN** 자연어 정리(예: 통화 메모 요약)에 실제 가치가 확인될 때.

## D-13 첫 화면(/)은 Command Center, /today 는 리다이렉트

- **DECISION** `/` 가 "오늘"이 되고, 기존 `/today` 는 `/` 로 보낸다(구 화면은 `/today/legacy` 로 보존).
- **WHY** 앱을 켠 뒤 5초 안에 오늘 할 일을 알아야 한다. 리다이렉트로 시작하는 홈은 그 질문에 답하지 않았다.
- **REVISIT WHEN** 없음.

## D-14 사이드바 색은 테마와 분리된 고정 분류색이다

- **DECISION** 메뉴 아이콘·분류 배지 색은 `--color-nav-*` / `--color-cat-*` 고정 토큰. 화면 테마(9종)는 shell·primary·accent 만 바꾼다.
- **WHY** "지원사업은 초록, 서류는 노랑" 같은 인지 방식이 테마를 바꿀 때 흔들리면 안 된다. 반대로 일반 강조·버튼·선택 상태는 테마 색이어야 브랜드가 한 몸으로 보인다.
- **REVISIT WHEN** 없음.

## D-15 SaaS 분리는 "복붙"이 아니라 portable core 재사용으로 설계한다

- **DECISION** brand.config · serviceCatalog · moduleRegistry · workspace 경계 · 브릿지 어댑터를 교체 지점으로 두고, SAAS_EXTRACTION_PLAN.md 에 단계별 절차를 남긴다. 이번 단계에서 실제 분리는 하지 않는다.
- **WHY** 파일 복사는 두 코드베이스가 즉시 갈라져 버그를 두 번 고치게 만든다.
- **REVISIT WHEN** 두 번째 고객사(다른 컨설팅 법인)가 확정될 때.

## D-16 기본은 main 직행 배포다. Preview 는 요청이 있을 때만 만든다

- **DECISION** 대표가 요청한 변경은 검증(빌드·린트·테스트·모바일 여정)을 통과하면 곧바로
  `main` 에 병합해 실제 주소(https://ax-mvp-factory-os.vercel.app)에 반영한다.
  "미리 보고 싶다 / 다른 데 먼저 올려서 URL 달라" 는 말이 있을 때만 별도 브랜치 + Vercel Preview 를 만든다.
- **WHY** 대표가 매일 쓰는 주소는 하나뿐이다. 고친 것이 그 주소에 바로 없으면 고친 의미가 없다.
  Preview 는 환경변수가 따로 붙지 않아 로컬 데모 모드(빈 화면)로 뜨는 일이 잦아, 기본 경로로 쓰면
  "데이터가 사라졌다" 는 오해만 만든다.
- **REVISIT WHEN** 여러 명이 동시에 이 저장소를 고치게 될 때 (그때는 PR 검토가 필요하다).

## D-17 처음 사용 가이드는 저절로 뜨지 않는다

- **DECISION** 접속할 때 자동으로 안내창을 띄우지 않는다. '처음 사용 가이드' 버튼을 눌렀을 때만 연다.
  자동 노출 판단 로직과 설정 스위치도 함께 제거했다(가이드 내용 자체는 그대로 유지).
- **WHY** 매일 일하러 들어오는 화면에서 창부터 닫아야 하는 것은 비용이다. 안내는 필요할 때 찾는 것이지
  들이미는 것이 아니다.
- **REVISIT WHEN** 대표 외에 새 사용자가 이 OS 를 쓰기 시작할 때 (첫 로그인 1회 한정 노출은 재검토 가능).
