#!/bin/bash
# SAAS-2 0022 '실행 계정이 슈퍼유저 · RLS 우회 권한이 아닐 때' 시험 — 운영 SQL Editor 계정 권한이 달라도 장부가 동작하는지.
#   0001~0021 은 슈퍼유저로, 0022 는 qa_admin(NOSUPERUSER · NOBYPASSRLS)으로 실행해 표 · 함수의 주인이 qa_admin 이 되게 한다.
#   새 표는 RLS 를 켜되 FORCE 를 걸지 않았으므로, 같은 주인의 SECURITY DEFINER 함수는 줄을 읽고 쓴다(앱 역할은 못 쓴다).
# 사용: sudo bash scripts/db-local/run-0022-owner.sh   (pg_ctlcluster 16 main start 먼저 · 운영 DB 와 상관없다)
set -u
cd "$(dirname "$0")/../.."
DB=axqa22own
q() { su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB"; }
su postgres -c "dropdb --if-exists $DB; createdb $DB" || exit 1
q < scripts/db-local/supabase-shim.sql > /dev/null || exit 1
for f in $(ls supabase/migrations/*.sql | grep -v '_ai_usage.sql'); do q < "$f" > /dev/null 2>/tmp/s22own || { echo "적용 실패 $f"; cat /tmp/s22own; exit 1; }; done
q > /dev/null <<'SQL' || { echo "역할 준비 실패"; exit 1; }
do $$ begin if not exists (select 1 from pg_roles where rolname = 'qa_admin') then create role qa_admin nologin nosuperuser nobypassrls; end if; end $$;
alter role qa_admin nosuperuser nobypassrls;
grant usage, create on schema public to qa_admin;
grant usage on schema auth to qa_admin;
grant references on auth.users to qa_admin;
grant references on public.workspaces to qa_admin;
grant execute on function public.is_workspace_member(uuid) to qa_admin;
grant select on public.os_access to qa_admin;
grant anon, authenticated to qa_admin;
insert into auth.users (id, email) values ('22000000-0000-0000-0000-0000000000b1', 'own-pilot@x.kr'), ('22000000-0000-0000-0000-0000000000c1', 'own-cust@x.kr') on conflict do nothing;
SQL
out=$( (echo "set role qa_admin;"; cat supabase/migrations/20261025000022_ai_usage.sql) | su postgres -c "psql -v ON_ERROR_STOP=1 -d $DB" 2>&1) || { echo "0022 실행 실패(qa_admin)"; echo "$out"; exit 1; }
BAD=0
check() { if [ "$2" = "$3" ]; then echo "PASS  $1 = $2"; else echo "FAIL  $1 = $2 (기대 $3)"; BAD=1; fi; }
v() { su postgres -c "psql -At -d $DB" <<<"$1"; }
check "주인: 새 표 · 함수 주인 = qa_admin(우회 권한 없음)" "$(v "select string_agg(distinct pg_get_userbyid(relowner), ',') from pg_class where relname in ('ai_usage_config','ai_entitlements','ai_usage_ledger')")" "qa_admin"
check "주인: qa_admin 은 슈퍼유저 · RLS 우회 아님" "$(v "select rolsuper || ' ' || rolbypassrls from pg_roles where rolname = 'qa_admin'")" "false false"
# SQL Editor 가 하는 일(설정 · 권한 줄) — 운영처럼 표 주인 계정으로
v "set role qa_admin; insert into public.ai_usage_config (id, secret_hash, default_monthly_units) values (1, sha256(convert_to('own-secret-0123456789abcdefghij', 'UTF8')), 3) on conflict (id) do update set secret_hash = excluded.secret_hash, default_monthly_units = excluded.default_monthly_units; insert into public.ai_entitlements (user_id, kind, plan, active_until) values ('22000000-0000-0000-0000-0000000000c1', 'customer', 'basic', now() + interval '30 days'), ('22000000-0000-0000-0000-0000000000b1', 'internal', 'internal', null) on conflict (user_id) do nothing;" > /dev/null
as_user() { su postgres -c "psql -At -d $DB" <<<"select set_config('request.jwt.claim.sub', '$1', false); set role authenticated; $2" | tail -1; }
check "고객: 내 권한 읽힘(customer basic true 3)" "$(as_user 22000000-0000-0000-0000-0000000000c1 "select (a->>'kind') || ' ' || (a->>'plan') || ' ' || (a->>'active') || ' ' || (a->>'limit') from (select public.my_ai_access() a) x;")" "customer basic true 3"
check "고객: 예약(설정 표 읽기 · 장부 쓰기) new 2/3" "$(as_user 22000000-0000-0000-0000-0000000000c1 "select r->>'state' || ' ' || (r->>'used') || '/' || (r->>'limit') from (select public.ai_usage_reserve('own-secret-0123456789abcdefghij', 'req-own-000001', 'today.top3', 'cheap', 2, null, 'general') r) x;")" "new 2/3"
check "고객: 정산 1줄" "$(as_user 22000000-0000-0000-0000-0000000000c1 "select public.ai_usage_settle('own-secret-0123456789abcdefghij', 'req-own-000001', 10, 2, 0) ->> 'settled';")" "1"
check "고객: 한도 넘음 quota" "$(as_user 22000000-0000-0000-0000-0000000000c1 "select public.ai_usage_reserve('own-secret-0123456789abcdefghij', 'req-own-000002', 'today.top3', 'cheap', 2, null, 'general') ->> 'state';")" "quota"
check "고객: 내 장부 1줄만 보임" "$(as_user 22000000-0000-0000-0000-0000000000c1 "select count(*) from public.ai_usage_ledger;")" "1"
check "고객: 장부 직접 쓰기 막힘(권한 없음)" "$(su postgres -c "psql -At -d $DB" 2>&1 <<<"select set_config('request.jwt.claim.sub', '22000000-0000-0000-0000-0000000000c1', false); set role authenticated; do \$\$ begin insert into public.ai_usage_ledger (user_id, request_id, assist_id, tier, units, status) values (auth.uid(), 'req-own-hack01', 'x', 'cheap', 1, 'settled'); raise notice 'BAD'; exception when others then raise notice 'BLOCKED'; end \$\$;" | grep -c BLOCKED)" "1"
check "고객: 장부 직접 쓰기 결과 0줄" "$(v "select count(*) from public.ai_usage_ledger where request_id = 'req-own-hack01'")" "0"
check "내부 팀장: 한도 없이 예약 new · 다른 사람 장부 안 보임" "$(as_user 22000000-0000-0000-0000-0000000000b1 "select (public.ai_usage_reserve('own-secret-0123456789abcdefghij', 'req-own-int001', 'today.top3', 'deep', 50, null, 'general') ->> 'state') || ' ' || (select count(*) from public.ai_usage_ledger where request_id like 'req-own-0%');")" "new 0"
[ "$BAD" -eq 0 ]
