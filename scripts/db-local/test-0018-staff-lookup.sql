-- D-153 직원의 고객 계정 찾기(0018) 시험 — 로컬 시험 DB(axqa)에서만. scripts/db-local/run.sh 가 부른다.
\set QUIET 1
\set ON_ERROR_STOP 1
create schema if not exists qa;
create or replace function qa.eq(label text, got text, want text) returns void language plpgsql as $$
begin if got is not distinct from want then raise notice 'PASS  % = %', label, got; else raise notice 'FAIL  % = % (기대 %)', label, got, want; end if; end $$;
create or replace function qa.no(label text, q text) returns void language plpgsql as $$
begin execute q; raise notice 'FAIL  % — 막혀야 하는데 통과', label;
exception when others then raise notice 'PASS  % (막힘: %)', label, sqlerrm; end $$;
grant usage on schema qa to anon, authenticated; grant execute on all functions in schema qa to anon, authenticated;

insert into auth.users (id, email) values
  ('f1000000-0000-0000-0000-000000000001', 'staff@x.kr'),
  ('f2000000-0000-0000-0000-000000000002', 'kim.a@x.kr'),
  ('f3000000-0000-0000-0000-000000000003', 'nobody@x.kr') on conflict do nothing;
insert into public.profiles (id, email) values
  ('f1000000-0000-0000-0000-000000000001', 'staff@x.kr'),
  ('f2000000-0000-0000-0000-000000000002', 'kim.a@x.kr'),
  ('f3000000-0000-0000-0000-000000000003', 'nobody@x.kr') on conflict (id) do update set email = excluded.email;
insert into public.workspaces (id, name, owner_id) values ('f9000000-0000-0000-0000-0000000000aa', 'W18', 'f1000000-0000-0000-0000-000000000001') on conflict do nothing;
insert into public.workspace_members (workspace_id, user_id, role) values ('f9000000-0000-0000-0000-0000000000aa', 'f1000000-0000-0000-0000-000000000001', 'owner') on conflict do nothing;

select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000001', false);
set role authenticated;
select qa.eq('직원: 같은 이메일(대문자 · 공백) 찾음', (select email from public.staff_find_customer_profile('  KIM.A@x.kr ')), 'kim.a@x.kr');
select qa.eq('직원: kim_a@ 는 kim.a@ 와 안 이어짐', (select count(*)::text from public.staff_find_customer_profile('kim_a@x.kr')), '0');
select qa.eq('직원: % 로 아무나 못 찾음', (select count(*)::text from public.staff_find_customer_profile('%')), '0');
select qa.eq('직원: 빈 이메일은 없음', (select count(*)::text from public.staff_find_customer_profile('')), '0');
reset role;
select set_config('request.jwt.claim.sub', 'f3000000-0000-0000-0000-000000000003', false);
set role authenticated;
select qa.eq('직원 아닌 사람: 못 찾음', (select count(*)::text from public.staff_find_customer_profile('kim.a@x.kr')), '0');
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select qa.no('로그인 안 한 사람: 부를 수 없음', $q$select * from public.staff_find_customer_profile('kim.a@x.kr')$q$);
reset role;
