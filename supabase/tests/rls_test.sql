-- =====================================================================
-- Stage 12A · RLS 회귀 테스트 (pgTAP)
-- ---------------------------------------------------------------------
-- 실행: supabase test db   (supabase/tests/*.sql 자동 인식)
-- 검증 목표:
--   1. 헬퍼 함수/공개 함수/핵심 테이블이 존재한다.
--   2. 모든 도메인 테이블에 RLS 가 켜져 있다.
--   3. 워크스페이스 A 멤버는 워크스페이스 B 데이터를 볼 수 없다(격리).
--   4. viewer 는 쓰기 불가, editor 는 쓰기 가능.
--   5. 공개 설문 토큰으로 내부/타 워크스페이스 데이터를 열람할 수 없다.
-- =====================================================================
begin;
select plan(19);

-- 1. 구조 존재 확인 -----------------------------------------------------
select has_table('public', 'workspaces', 'workspaces 테이블 존재');
select has_table('public', 'workspace_members', 'workspace_members 테이블 존재');
select has_function('public', 'is_workspace_member', array['uuid'], 'is_workspace_member 존재');
select has_function('public', 'can_write_workspace', array['uuid'], 'can_write_workspace 존재');
select has_function('public', 'get_public_survey', array['text'], 'get_public_survey 존재');

-- 2. RLS 활성화 확인 (대표 도메인 테이블) --------------------------------
select is(
  (select relrowsecurity from pg_class where oid = 'public.organizations'::regclass),
  true, 'organizations RLS on');
select is(
  (select relrowsecurity from pg_class where oid = 'public.projects'::regclass),
  true, 'projects RLS on');
select is(
  (select relrowsecurity from pg_class where oid = 'public.survey_distributions'::regclass),
  true, 'survey_distributions RLS on');

-- 테스트용 사용자/워크스페이스 구성 (auth.users 직접 삽입은 테스트 트랜잭션 안에서만) --
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com')
on conflict do nothing;

insert into public.workspaces (id, name, owner_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'WS-A', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'WS-B', '22222222-2222-2222-2222-222222222222');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');

-- WS-A / WS-B 각각 고객사 1건
insert into public.organizations (id, workspace_id, code, payload) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A-ORG', '{"name":"A사"}'),
  ('b0000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B-ORG', '{"name":"B사"}');

-- 3. 워크스페이스 격리: 사용자 A 는 자기 것만 본다 -----------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.organizations),
  1, 'A 사용자는 자기 워크스페이스 고객사 1건만 조회');
select is(
  (select count(*)::int from public.organizations where workspace_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0, 'A 사용자는 WS-B 고객사 조회 불가');

-- 4a. viewer 는 쓰기 불가 ----------------------------------------------
reset role;
insert into public.workspace_members (workspace_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'viewer')
on conflict (workspace_id, user_id) do update set role = 'viewer';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.organizations (workspace_id, code, payload)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'X', '{}')$$,
  '42501', null,
  'viewer 는 WS-A 에 고객사 생성 불가');

-- viewer 는 읽기는 가능
select is(
  (select count(*)::int from public.organizations where workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1, 'viewer 는 WS-A 고객사 조회 가능');

-- 4b. editor 로 승격하면 쓰기 가능 -------------------------------------
reset role;
update public.workspace_members set role = 'editor'
where workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  and user_id = '22222222-2222-2222-2222-222222222222';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.organizations (workspace_id, code, payload)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'EDIT-OK', '{}')$$,
  'editor 는 WS-A 에 고객사 생성 가능');

-- 5. 공개 설문 토큰: 해시 저장, 렌더 필드만 반환, 내부 열람 불가 ----------
reset role;
insert into public.projects (id, workspace_id, organization_id, project_code, payload) values
  ('a0000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'a0000000-0000-0000-0000-000000000001', 'A-PRJ', '{"name":"A프로젝트"}');

insert into public.survey_distributions (id, workspace_id, project_id, access_token_hash, status, payload) values
  ('a0000000-0000-0000-0000-0000000000d1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'a0000000-0000-0000-0000-0000000000a1',
   public.hash_access_token('secret-token-xyz'), 'issued',
   '{"surveyTitle":"진단설문","status":"issued","blueprintSnapshot":[],"introMessage":"안내"}');

-- anon 컨텍스트에서 공개 함수 호출
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (public.get_public_survey('secret-token-xyz') ->> 'available'),
  'true', '유효 토큰으로 공개 설문 조회 성공');
select is(
  (public.get_public_survey('secret-token-xyz') ->> 'surveyTitle'),
  '진단설문', '공개 설문은 렌더 필드(surveyTitle) 반환');
select ok(
  not (public.get_public_survey('secret-token-xyz') ? 'organizationId'),
  '공개 설문 응답에 내부 organizationId 미포함');
select is(
  public.get_public_survey('wrong-token'),
  null, '잘못된 토큰은 null (열람 불가)');

-- anon 은 테이블 직접 조회 불가 (RLS)
select is(
  (select count(*)::int from public.survey_distributions),
  0, 'anon 은 survey_distributions 직접 조회 0건');
select is(
  (select count(*)::int from public.organizations),
  0, 'anon 은 organizations 직접 조회 0건');

select * from finish();
rollback;
