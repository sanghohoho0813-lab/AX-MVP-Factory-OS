-- D-162 접근 허용 목록 · Pilot(0019) 시험 — 로컬 시험 DB(axqa)에서만. scripts/db-local/run.sh 가 부른다. 운영 DB 에는 절대 실행하지 않는다.
\set QUIET 1
\set ON_ERROR_STOP 1
create schema if not exists qa;
create or replace function qa.eq(label text, got text, want text) returns void language plpgsql as $$
begin if got is not distinct from want then raise notice 'PASS  % = %', label, got; else raise notice 'FAIL  % = % (기대 %)', label, got, want; end if; end $$;
create or replace function qa.ok(label text, q text) returns void language plpgsql as $$
begin execute q; raise notice 'PASS  % (허용됨)', label;
exception when others then raise notice 'FAIL  % — 허용돼야 하는데 막힘: %', label, sqlerrm; end $$;
create or replace function qa.no(label text, q text) returns void language plpgsql as $$
begin execute q; raise notice 'FAIL  % — 막혀야 하는데 통과', label;
exception when others then raise notice 'PASS  % (막힘: %)', label, sqlerrm; end $$;
grant usage on schema qa to anon, authenticated; grant execute on all functions in schema qa to anon, authenticated;

-- O = 대표(full) · P = Pilot · R = 공개 사이트 가입자(목록 없음) · N = Pilot 이 초대한 사람 · S = 대표가 초대한 직원
insert into auth.users (id, email) values
  ('19000000-0000-0000-0000-0000000000a1', 'o19@x.kr'),
  ('19000000-0000-0000-0000-0000000000b1', 'p19@x.kr'),
  ('19000000-0000-0000-0000-0000000000c1', 'r19@x.kr'),
  ('19000000-0000-0000-0000-0000000000d1', 'n19@x.kr'),
  ('19000000-0000-0000-0000-0000000000e1', 's19@x.kr') on conflict do nothing;
insert into public.profiles (id, email) values
  ('19000000-0000-0000-0000-0000000000a1', 'o19@x.kr'),
  ('19000000-0000-0000-0000-0000000000b1', 'p19@x.kr'),
  ('19000000-0000-0000-0000-0000000000c1', 'r19@x.kr'),
  ('19000000-0000-0000-0000-0000000000d1', 'n19@x.kr'),
  ('19000000-0000-0000-0000-0000000000e1', 's19@x.kr') on conflict (id) do update set email = excluded.email;
-- SQL Editor 에서 대표가 하는 일(로그인한 사람 없음): 등급 넣기
insert into public.os_access (user_id, tier) values
  ('19000000-0000-0000-0000-0000000000a1', 'full'),
  ('19000000-0000-0000-0000-0000000000b1', 'pilot') on conflict (user_id) do update set tier = excluded.tier;

create table if not exists qa.ids (k text primary key, v uuid);
grant all on qa.ids to authenticated;

-- ---------- 공개 사이트 가입자 R ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
select qa.eq('R: 내 등급 = 없음', public.my_os_access(), null);
select qa.no('R: 작업공간 만들기(RPC)', $q$select public.create_workspace('R 회사')$q$);
select qa.no('R: 작업공간 바로 넣기', $q$insert into public.workspaces (name, owner_id) values ('R2', '19000000-0000-0000-0000-0000000000c1')$q$);
select qa.no('R: 접근 목록에 자기 넣기', $q$insert into public.os_access (user_id, tier) values ('19000000-0000-0000-0000-0000000000c1', 'full')$q$);
select qa.no('R: 고객 계정 찾기', $q$select 1/(select count(*) from public.staff_find_customer_profile('o19@x.kr'))::int$q$);
reset role;

-- ---------- 대표 O ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O: 내 등급 = full', public.my_os_access(), 'full');
select qa.ok('O: 작업공간 만들기', $q$insert into qa.ids select 'O', (public.create_workspace('대표 회사')).id$q$);
select qa.ok('O: 고객 이벤트 받는 곳 정하기(옛 시각을 적어도)', $q$insert into public.customer_intake_routing (workspace_id, is_default, created_at) select v, true, '2000-01-01' from qa.ids where k = 'O'$q$);
select qa.eq('O: 받는 곳 만든 시각은 서버 시각(2000년 아님)', (select (r.created_at > now() - interval '1 hour')::text from public.customer_intake_routing r join qa.ids i on i.v = r.workspace_id and i.k = 'O'), 'true');
select qa.eq('O: 고객 계정 찾기 됨', (select email from public.staff_find_customer_profile('P19@x.kr')), 'p19@x.kr');
reset role;

-- ---------- Pilot P ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P: 내 등급 = pilot', public.my_os_access(), 'pilot');
select qa.ok('P: 자기 작업공간 하나 만들기', $q$insert into qa.ids select 'P', (public.create_workspace('Pilot 작업공간')).id$q$);
select qa.no('P: 작업공간 하나 더', $q$select public.create_workspace('하나 더')$q$);
select qa.no('P: 받는 곳을 자기 작업공간으로', $q$insert into public.customer_intake_routing (workspace_id, is_default, created_at) select v, true, '-infinity' from qa.ids where k = 'P'$q$);
select qa.no('P: 대표 계정을 자기 작업공간 멤버로 바로 넣기', $q$insert into public.workspace_members (workspace_id, user_id, role) select v, '19000000-0000-0000-0000-0000000000a1', 'viewer' from qa.ids where k = 'P'$q$);
select qa.eq('P: 대표 프로필 안 보임', (select count(*)::text from public.profiles where email = 'o19@x.kr'), '0');
select qa.no('P: 작업공간 만든 시각 앞당기기', $q$update public.workspaces set created_at = '1990-01-01' where id = (select v from qa.ids where k = 'P')$q$);
select qa.no('P: 작업공간 주인 바꾸기', $q$update public.workspaces set owner_id = '19000000-0000-0000-0000-0000000000a1' where id = (select v from qa.ids where k = 'P')$q$);
select qa.ok('P: 작업공간 이름 바꾸기', $q$update public.workspaces set name = '최 팀장 작업공간' where id = (select v from qa.ids where k = 'P')$q$);
select qa.no('P: 프로필 이메일을 남의 고객 이메일로', $q$update public.profiles set email = 'o19@x.kr' where id = '19000000-0000-0000-0000-0000000000b1'$q$);
select qa.ok('P: 프로필 이름 바꾸기(이메일 그대로)', $q$update public.profiles set email = email where id = '19000000-0000-0000-0000-0000000000b1'$q$);
select qa.eq('P: 고객 계정 찾기 = 없음', (select count(*)::text from public.staff_find_customer_profile('o19@x.kr')), '0');
select qa.ok('P: 자기 업체 만들기', $q$insert into public.operations_clients (id, workspace_id, company_name, payload) select 'p19-client', v, 'P 고객사', '{}' from qa.ids where k = 'P'$q$);
select qa.no('P: 고객 플랫폼 연결 만들기', $q$insert into public.portal_client_links (workspace_id, operations_client_id, profile_id) select v, 'p19-client', '19000000-0000-0000-0000-0000000000c1' from qa.ids where k = 'P'$q$);
do $$ begin update public.os_access set tier = 'full' where user_id = '19000000-0000-0000-0000-0000000000b1'; exception when others then null; end $$;
select qa.eq('P: 접근 목록을 full 로 고치려 해도 그대로 pilot', public.my_os_access(), 'pilot');
select qa.eq('P: 접근 목록에서 보이는 것 = 자기 줄만', (select string_agg(tier, ',') from public.os_access), 'pilot');
-- Pilot 은 초대를 만들 수 없다(사람을 들여 계정을 늘리지 못한다)
select qa.no('P: 초대 만들기 막힘', $q$insert into public.workspace_invites (workspace_id, email, role, token_hash, invited_by, expires_at) select v, 'n19@x.kr', 'editor', encode(extensions.digest('tok-p19', 'sha256'), 'hex'), '19000000-0000-0000-0000-0000000000b1', now() + interval '1 day' from qa.ids where k = 'P'$q$);
reset role;

-- 대표가 직원 S 를 초대 · 대표가 실수로 Pilot 이메일도 초대
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.ok('O: 직원 초대 만들기', $q$insert into public.workspace_invites (workspace_id, email, role, token_hash, invited_by, expires_at) select v, 'S19@x.kr', 'editor', encode(extensions.digest('tok-o19', 'sha256'), 'hex'), '19000000-0000-0000-0000-0000000000a1', now() + interval '1 day' from qa.ids where k = 'O'$q$);
select qa.ok('O: (실수로) Pilot 이메일 초대 만들기', $q$insert into public.workspace_invites (workspace_id, email, role, token_hash, invited_by, expires_at) select v, 'p19@x.kr', 'viewer', encode(extensions.digest('tok-o19-p', 'sha256'), 'hex'), '19000000-0000-0000-0000-0000000000a1', now() + interval '1 day' from qa.ids where k = 'O'$q$);
reset role;

-- 새어 나간 직원 초대 링크 — 다른 이메일로 로그인한 사람은 못 받는다
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.no('P: 새어 나간 직원 초대 링크로 대표 작업공간 들어가기', $q$select public.accept_workspace_invite('tok-o19')$q$);
select qa.no('P: 대표가 실수로 보낸 Pilot 이메일 초대로도 대표 작업공간 못 들어감', $q$select public.accept_workspace_invite('tok-o19-p')$q$);
select qa.eq('P: 대표 작업공간 업체 보임', (select count(*)::text from public.operations_clients c join qa.ids i on i.v = c.workspace_id and i.k = 'O'), '0');
reset role;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
select qa.no('R: 새어 나간 직원 초대 링크로 들어가기', $q$select public.accept_workspace_invite('tok-o19')$q$);
select qa.eq('R: 여전히 등급 없음', public.my_os_access(), null);
reset role;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000d1', false);
set role authenticated;
select qa.no('N: 초대가 없으면 Pilot 작업공간에도 못 들어감', $q$select public.accept_workspace_invite('tok-p19')$q$);
select qa.eq('N: 등급 없음', public.my_os_access(), null);
reset role;

-- 초대받은 이메일로 로그인한 직원 S 는 들어오고 full(대문자 · 소문자 상관없이)
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000e1', false);
set role authenticated;
select qa.ok('S: 대표 초대 받기', $q$select public.accept_workspace_invite('tok-o19')$q$);
select qa.eq('S: 등급 = full', public.my_os_access(), 'full');
reset role;

-- 접근 목록 표는 아무도 비우거나 고칠 수 없다(표 권한)
set role authenticated;
select qa.no('authenticated: 접근 목록 비우기(truncate)', $q$truncate public.os_access$q$);
reset role;

-- 받는 곳: 누가 Pilot 작업공간으로 옛 줄을 심어 두어도(서버 작업으로) 대표 작업공간이 받는다
insert into public.customer_intake_routing (workspace_id, is_default, created_at) select v, true, '1990-01-01' from qa.ids where k = 'P' on conflict do nothing;
select qa.eq('받는 곳: Pilot 작업공간 줄이 앞에 있어도 무시 → 대표 작업공간', (select (public.default_intake_workspace() = (select v from qa.ids where k = 'O'))::text), 'true');
delete from public.customer_intake_routing where workspace_id = (select v from qa.ids where k = 'P');

-- 로그인 안 한 사람
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select qa.no('로그인 안 한 사람: 내 등급 묻기', $q$select public.my_os_access()$q$);
reset role;
