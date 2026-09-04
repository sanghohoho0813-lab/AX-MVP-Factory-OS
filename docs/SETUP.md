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

### 3.0 백업 (먼저)
Supabase Dashboard → Database → Backups 에서 최신 백업 시점을 확인한다. Pro 플랜이 아니면 적용 직전에 수동 덤프를 남긴다:
```
pg_dump "$PROD_URL" --schema-only -f before_bridge_schema.sql
pg_dump "$PROD_URL" --data-only --schema=public -f before_bridge_data.sql
```

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
Supabase Dashboard → SQL Editor 에서 **두 파일을 순서대로** 붙여 실행한다(둘 다 멱등 — 두 번 실행해도 안전). 또는 `supabase db push`.

1. `supabase/migrations/20260903000006_customer_bridge.sql` — 브릿지 본체
2. `supabase/migrations/20260903000007_bridge_hardening.sql` — 권한 하드닝
3. `supabase/migrations/20260903000008_event_client_link.sql` — 이벤트에 고객사 id 채우기(결함 수정 + 기존 행 backfill)

2번은 Supabase Security Advisor 가 지적하는 항목을 닫는다: 트리거 전용 `bridge_on_*` SECURITY DEFINER 함수 6개와 `bridge_touch_updated_at` 에 PostgreSQL 이 기본으로 부여하는 PUBLIC EXECUTE 를 회수하고, `bridge_touch_updated_at` 의 `search_path` 를 고정하며, 내부 전용 헬퍼 `portal_link_owned` 를 authenticated 에서 닫는다. 앱이 실제로 호출하는 RPC 권한은 건드리지 않는다.

> 트리거 실행 권한은 CREATE TRIGGER 시점에만 확인하고 발화 시점에는 확인하지 않으므로, EXECUTE 회수 후에도 트리거는 정상 발화한다. `supabase/tests/bridge_hardening.sql` 의 H5 가 이것을 회귀 테스트로 고정한다.

3번은 `bridge_emit_customer_event` 가 연결(`portal_client_link`)에서 `operations_client_id` 를 복사하지 않던 결함을 고친다. 이 값이 비어 있으면 이벤트함이 이미 연결된 고객사인데도 "아직 고객사와 연결되지 않음 · 새 고객사로 만들기" 를 보여 고객사가 중복 생성된다. 이미 쌓인 행도 함께 backfill 한다(멱등).

> **…0006 을 이미 적용했다면** 2번과 3번만 실행하면 된다. 셋 다 멱등이라 전부 다시 실행해도 안전하다.

### 3.4 적용 후 확인
```sql
-- 테이블 7개
select count(*) from pg_tables
 where schemaname = 'public'
   and (tablename like 'portal\_%' or tablename in ('customer_events','ops_journal_entries','customer_intake_routing'));
-- → 7

-- RLS 가 7개 테이블 전부에 켜져 있어야 한다
select count(*) from pg_tables
 where schemaname = 'public' and rowsecurity
   and (tablename like 'portal\_%' or tablename in ('customer_events','ops_journal_entries','customer_intake_routing'));
-- → 7

-- 함수: portal_* 11개, bridge_* 8개
select count(*) filter (where proname like 'portal\_%') as portal_fn,
       count(*) filter (where proname like 'bridge\_%') as bridge_fn
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public';
-- → 11 / 8

-- 내부 정책 17개
select count(*) from pg_policies
 where schemaname = 'public'
   and (tablename like 'portal\_%' or tablename in ('customer_events','ops_journal_entries','customer_intake_routing'));
-- → 17

-- 고객용 storage 정책 2개 (기존 4개는 그대로 남아 있어야 한다)
select policyname from pg_policies
 where tablename = 'objects' and policyname like 'Customers%';
-- → "Customers can upload portal documents", "Customers can read their portal documents"

-- 유입 트리거 3개 (원본 테이블이 있는 것만 생성된다)
select tgname from pg_trigger where tgname like 'trg_bridge_%' order by 1;

-- 조회가 오류 없이 되면 RLS·권한이 정상
select count(*) from public.portal_client_links;   -- 0
select public.default_intake_workspace();          -- 내 워크스페이스 uuid
```
그리고 `DATABASE_URL=... npm run test:sql` (계약 + 하드닝 테스트)을 돌리면 트랜잭션 안에서 검증 후 ROLLBACK 된다(데이터 남지 않음). 다만 Production 에서 직접 돌리기보다 3.2 의 그림자 DB 에서 돌리는 것을 권장한다.

### 3.5 유입 워크스페이스 지정 (선택)
워크스페이스가 여러 개면 연결 전 이벤트를 받을 곳을 정한다:
```sql
insert into public.customer_intake_routing (workspace_id) values ('<내 workspace uuid>');
```
없으면 가장 오래된 워크스페이스로 간다.

### 3.6 앱 상태 전환
적용이 끝나면 내부 OS 의 고객 이벤트함·고객 플랫폼 탭이 자동으로 READY 안내를 내리고 동작한다(배포 불필요 — 앱이 RPC 존재를 런타임에 판정한다). `docs/PROJECT_STATE.md` 의 Capability 표에서 브릿지를 LIVE 로 바꾼다.

### 3.7 왕복 확인 — SQL 3단계

Dashboard → SQL Editor 에서 순서대로 실행한다. 사람이 화면에서 할 일은 두 가지뿐이다.

| 단계 | 파일 | 하는 일 |
|---|---|---|
| 사전 | — | 마이그레이션 …0007, …0008 적용 (§3.3) |
| 사전 | — | Authentication → Users → **Add user** (Auto Confirm User 체크) |
| 1 | `supabase/tests/roundtrip_1_setup.sql` | 프로필 온보딩 통과 + 업체 "왕복테스트(주)" + 계정 연결 + 사업자등록증 요청 |
| — | (사람) | 고객 플랫폼 로그인 → ① 요청 보내기 ② PDF 업로드 |
| 2 | `supabase/tests/roundtrip_2_verify.sql` | 두 건이 이벤트함에 들어왔는지 8개 항목 판정 + 투영 누출 검사 |
| 3 | `supabase/tests/roundtrip_3_cleanup.sql` | 이 확인이 만든 것만 삭제 |

1번은 고객 행동을 흉내내지 않는다 — 그건 사람이 실제 화면에서 해야 검증에 의미가 있다.
1번은 실행 즉시 …0007/…0008 적용 여부까지 함께 확인해 준다.
2번은 읽기만 한다. 손대는 행은 전부 `operations_clients.id = 'cli_roundtrip_check'` 에 매달린 것뿐이다.

세 단계 모두 실제 스키마·트리거가 도는 로컬 PostgreSQL 16 에서 검증했다: setup 4/4 → (고객 행동 전) verify 0/8 → 고객 권한으로 실제 portal RPC 호출 → verify 8/8 + 누출 검사 4/4 → cleanup 이 테스트 행만 삭제.

`service_role` 키를 셸에 줄 수 있으면 `scripts/roundtrip-live.mjs` 로 같은 흐름을 자동화할 수도 있다(계정 생성까지 포함). 키를 공유하지 않는 경우 위 SQL 3단계를 쓴다.

### 3.9 고객 업로드 제약 (기존 버킷 설정)
`client-documents` 버킷은 `20260827000005_operations_hub.sql` 이 만든 것으로 **10MB · pdf/jpeg/png/webp** 만 허용한다. 이번 마이그레이션은 이 설정을 바꾸지 않는다. 고객이 다른 형식을 올려야 하면 버킷 설정을 별도로 조정한다.

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
