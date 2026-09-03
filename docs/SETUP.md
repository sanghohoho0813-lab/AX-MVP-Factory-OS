# SETUP — 환경 준비와 브릿지 마이그레이션 적용

## 1. 내부 OS (이 저장소)

```
npm install
npm run dev            # local 모드 (localStorage) — 로그인 없음
npm run build          # tsc -b && vite build
npm run lint           # oxlint
npm run test:all       # 모든 계약 테스트 (아래 test:* 전부)
```

Vercel 환경변수(supabase 모드): `VITE_DATA_MODE=supabase`, `VITE_SUPABASE_URL=https://<ref>.supabase.co`, `VITE_SUPABASE_ANON_KEY=<anon 또는 sb_publishable_…>`. `sb_secret_`/service_role 키는 절대 넣지 않는다(앱이 거부한다).

## 2. 고객 플랫폼 (`../mirae-ai-lab-homepage`)

```
npm install && npm run build
```
서버리스(`api/*`)만 `SUPABASE_SERVICE_ROLE_KEY` 를 쓴다. 프론트는 anon 키.

## 3. 브릿지 마이그레이션 적용 (Production Supabase `mirae-ai-lab`)

이번 브랜치에서는 **적용하지 않았다**. Claude 실행 환경에 Supabase CLI 연결·자격증명이 없어 대상 project 를 증명할 수 없었고, 그 상태에서 임의 apply 는 규칙 위반이다. 아래 절차를 사람이 실행한다.

### 3.1 사전 확인 (destructive 0)
```
grep -nEi "drop table|drop column|truncate|alter table .* rename|disable row level security" supabase/migrations/20260903000006_customer_bridge.sql
# → 결과 없음이어야 한다 (drop policy if exists / drop trigger if exists 는 재생성용이라 허용)
```

### 3.2 그림자 DB 리허설 (권장)
```
# Supabase CLI 가 있으면
supabase link --project-ref <mirae-ai-lab ref>
supabase db push --dry-run
# 또는 로컬 Postgres 에 기존 마이그레이션 → 공개 사이트 schema → 이 마이그레이션 순으로 적용 후
psql "$SHADOW_URL" -v ON_ERROR_STOP=1 -f supabase/tests/bridge_contract.sql
# → "BRIDGE CONTRACT: ALL ASSERTIONS PASSED"
```

### 3.3 적용
Supabase Dashboard → SQL Editor 에 `supabase/migrations/20260903000006_customer_bridge.sql` 전체를 붙여 실행한다(멱등 — 두 번 실행해도 안전). 또는 `supabase db push`.

### 3.4 적용 후 확인
```
select count(*) from public.portal_client_links;           -- 0 (오류 없이 조회되면 OK)
select public.default_intake_workspace();                   -- 내 워크스페이스 uuid
select proname from pg_proc where proname like 'portal_%';  -- 9개 함수
select policyname from pg_policies where tablename='objects' and policyname like 'Customers%'; -- 2개
```
그리고 `psql "$PROD_URL" -f supabase/tests/bridge_contract.sql` 을 돌리면 트랜잭션 안에서 검증 후 ROLLBACK 된다(데이터 남지 않음).

### 3.5 유입 워크스페이스 지정 (선택)
워크스페이스가 여러 개면 연결 전 이벤트를 받을 곳을 정한다:
```
insert into public.customer_intake_routing (workspace_id) values ('<내 workspace uuid>');
```
없으면 가장 오래된 워크스페이스로 간다.

### 3.6 앱 상태 전환
적용이 끝나면 내부 OS 의 고객 이벤트함·고객 플랫폼 탭이 자동으로 READY 안내를 내리고 동작한다. `docs/PROJECT_STATE.md` 의 Capability 표에서 브릿지를 LIVE 로 바꾼다.

## 4. 기존 데이터에 대한 영향
- 기존 테이블·행·정책은 바뀌지 않는다(additive).
- 기존 storage 정책 4개는 그대로 두고 고객용 2개를 추가한다. 고객 경로는 워크스페이스 uuid 로 시작하므로 기존 정책의 `::uuid` 캐스트가 깨지지 않는다.
- 공개 사이트의 `profiles.handle_new_user` 등 기존 트리거는 건드리지 않는다.

## 5. 롤백
새 객체만 제거하면 된다(기존 테이블 무영향):
```
drop trigger if exists trg_bridge_diagnosis_lead on public.business_diagnosis_leads;
drop trigger if exists trg_bridge_service_order on public.service_orders;
drop trigger if exists trg_bridge_consult_lead on public.consult_leads;
drop policy if exists "Customers can upload portal documents" on storage.objects;
drop policy if exists "Customers can read their portal documents" on storage.objects;
-- 테이블은 데이터 보존을 위해 남겨 두는 것을 권장. 완전 제거가 필요하면 portal_*·customer_events·ops_journal_entries·customer_intake_routing 순으로 drop.
```
