#!/bin/bash
# D-162 Owner/Pilot 교차 e2e 용 로컬 DB(axe2e) — e2e/pilot.mjs 가 부른다. 운영 DB 와 상관없다.
#
#   1. 0001~0018 적용 → 대표(Owner) 작업공간에 업체 · 업무 일기 · 모듈 기록 · 고객 이벤트를 넣는다(몇 달 쓴 것처럼)
#   2. 0019 적용 — 운영에 처음 적용하는 것과 같은 순서(대표 작업공간을 'full' 로 씨앗)
#   3. supabase/manual/pilot_provision.sql 을 그대로(이메일만 바꿔) 실행 — 대표가 SQL Editor 에서 할 일과 같다
#   4. PostgREST 가 붙을 authenticator 역할
# 사용: bash scripts/db-local/e2e-pilot-db.sh   (pg_ctlcluster 16 main start 먼저 · root)
set -eu
cd "$(dirname "$0")/../.."
DIR=scripts/db-local
DB=${AXE2E_DB:-axe2e}
psqlq() { su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB"; }
su postgres -c "dropdb --if-exists $DB; createdb $DB"
psqlq < $DIR/supabase-shim.sql > /dev/null
for f in supabase/migrations/*.sql; do
  case "$f" in *_os_access_pilot.sql|*_owner_views_pilot.sql) continue ;; esac
  psqlq < "$f" > /dev/null
done

psqlq > /dev/null <<'SQL'
-- 사람: 대표 · Pilot · 공개 사이트에서 가입만 한 사람
insert into auth.users (id, email) values
  ('0e000000-0000-4000-8000-0000000000a1', 'owner@e2e.kr'),
  ('0e000000-0000-4000-8000-0000000000b1', 'pilot@e2e.kr'),
  ('0e000000-0000-4000-8000-0000000000c1', 'outsider@e2e.kr') on conflict do nothing;
insert into public.profiles (id, email, display_name) values
  ('0e000000-0000-4000-8000-0000000000a1', 'owner@e2e.kr', '대표'),
  ('0e000000-0000-4000-8000-0000000000b1', 'pilot@e2e.kr', '최은혜'),
  ('0e000000-0000-4000-8000-0000000000c1', 'outsider@e2e.kr', '방문자') on conflict (id) do update set email = excluded.email, display_name = excluded.display_name;
-- 대표 작업공간 — 몇 달 쓴 것처럼
insert into public.workspaces (id, name, owner_id, created_at) values
  ('0e0000aa-0000-4000-8000-00000000000a', '미래AI랩', '0e000000-0000-4000-8000-0000000000a1', '2026-01-02');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('0e0000aa-0000-4000-8000-00000000000a', '0e000000-0000-4000-8000-0000000000a1', 'owner') on conflict do nothing;
insert into public.operations_clients (id, workspace_id, company_name, status, next_action, next_action_due_date, payload, created_at, updated_at) values
  ('owner-secret-1', '0e0000aa-0000-4000-8000-00000000000a', '대표비밀정밀(주)', 'active', '대표비밀 다음 약속', current_date + 2,
   jsonb_build_object('businessNumber', '111-22-33333', 'representativeName', '김비밀', 'contactPhone', '010-1111-2222',
     'documents', jsonb_build_object('businessRegistration', jsonb_build_object('received', true, 'issuedAt', '2026-09-01', 'fileName', '대표비밀_사업자등록증.pdf', 'fileSize', 1200,
       'storagePath', '0e0000aa-0000-4000-8000-00000000000a/owner-secret-1/businessRegistration/a.pdf')),
     'fees', jsonb_build_array(jsonb_build_object('id', 'f1', 'label', '대표비밀 착수금', 'amount', 33000000, 'dueDate', (current_date + 3)::text, 'paidAt', ''))),
   '2026-03-01', now()),
  ('owner-secret-2', '0e0000aa-0000-4000-8000-00000000000a', '대표비밀상사', 'waiting', '', null, '{}'::jsonb, '2026-04-01', now());
insert into public.ops_journal_entries (workspace_id, owner_id, entry_date, entry_type, content, client_id, due_date) values
  ('0e0000aa-0000-4000-8000-00000000000a', '0e000000-0000-4000-8000-0000000000a1', current_date, 'follow_up', '대표비밀 할 일 — 김비밀 대표 통화', 'owner-secret-1', current_date),
  ('0e0000aa-0000-4000-8000-00000000000a', '0e000000-0000-4000-8000-0000000000a1', current_date, 'note', '대표비밀 업무 일기', null, null);
insert into public.module_data (id, workspace_id, module_key, bucket, client_id, payload) values
  ('md-owner-1', '0e0000aa-0000-4000-8000-00000000000a', 'policy-funding', 'notes', 'owner-secret-1', '{"text":"대표비밀 정책자금 메모"}');
insert into public.customer_events (workspace_id, operations_client_id, event_type, source_type, source_id, dedupe_key, customer_safe_payload) values
  ('0e0000aa-0000-4000-8000-00000000000a', 'owner-secret-1', 'consultation_requested', 'qa', 'q1', 'qa-owner-ev-1', '{"companyName":"대표비밀정밀(주)","message":"대표비밀 상담 내용"}');
SQL

# 0019 — 처음 적용(대표 작업공간을 full 로 씨앗)
psqlq < supabase/migrations/20261007000019_os_access_pilot.sql > /dev/null

# 대표가 SQL Editor 에서 하는 일 그대로 — 이메일 한 줄만 바꿔서
sed "s/여기에_Pilot_이메일@example.com/pilot@e2e.kr/; s/'Pilot 작업공간'/'최은혜 Pilot'/" supabase/manual/pilot_provision.sql | psqlq > /dev/null

# 0020 — 대표가 팀장 화면을 바로 본다(대표를 Pilot 작업공간 편집자로)
psqlq < supabase/migrations/20261008000020_owner_views_pilot.sql > /dev/null

# PostgREST 가 붙을 역할(로컬 시험용 비밀번호)
psqlq > /dev/null <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login password 'e2e-local' noinherit; end if;
end $$;
grant anon, authenticated to authenticator;
SQL
su postgres -c "psql -At -d $DB -c \"select tier || ':' || (select email from auth.users u where u.id = a.user_id) from public.os_access a order by 1\""
