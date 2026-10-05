-- D-151 공개 링크 SQL(0017) 시험 — 로컬 시험 DB(axqa)에서만. scripts/db-local/run.sh 가 부른다.
\set QUIET 1
\set ON_ERROR_STOP 1
create schema if not exists qa;
create or replace function qa.ok(label text, q text) returns void language plpgsql as $$
begin execute q; raise notice 'PASS  % (허용됨)', label;
exception when others then raise notice 'FAIL  % — 허용돼야 하는데 막힘: %', label, sqlerrm; end $$;
create or replace function qa.no(label text, q text) returns void language plpgsql as $$
begin execute q; raise notice 'FAIL  % — 막혀야 하는데 통과', label;
exception when others then raise notice 'PASS  % (막힘: %)', label, sqlerrm; end $$;
create or replace function qa.eq(label text, got text, want text) returns void language plpgsql as $$
begin if got is not distinct from want then raise notice 'PASS  % = %', label, got; else raise notice 'FAIL  % = % (기대 %)', label, got, want; end if; end $$;
-- 읽으면 막히거나(권한 없음) 0줄이어야 통과(RLS 정책 없음)
create or replace function qa.none(label text, q text) returns void language plpgsql as $$
declare n bigint;
begin execute q into n;
  if n = 0 then raise notice 'PASS  % (0줄)', label; else raise notice 'FAIL  % — %줄 보임', label, n; end if;
exception when others then raise notice 'PASS  % (막힘: %)', label, sqlerrm; end $$;
grant usage on schema qa to anon, authenticated; grant execute on all functions in schema qa to anon, authenticated;

-- 준비: 워크스페이스 하나 · 설문 링크 넷 · 시험 링크 둘
insert into auth.users (id, email) values ('eeeeeeee-0000-0000-0000-000000000005', 'o@x.kr') on conflict do nothing;
insert into public.workspaces (id, name, owner_id) values ('eeeeeeee-0000-0000-0000-0000000000aa', 'W17', 'eeeeeeee-0000-0000-0000-000000000005') on conflict do nothing;
insert into public.survey_distributions (workspace_id, access_token_hash, payload) values
  ('eeeeeeee-0000-0000-0000-0000000000aa', public.hash_access_token('sv-ok'),  '{"status":"issued","surveyTitle":"진단"}'),
  ('eeeeeeee-0000-0000-0000-0000000000aa', public.hash_access_token('sv-old'), jsonb_build_object('status','issued','expiresAt', (now() - interval '1 day')::text)),
  ('eeeeeeee-0000-0000-0000-0000000000aa', public.hash_access_token('sv-bad'), '{"status":"issued","expiresAt":"언젠가"}'),
  ('eeeeeeee-0000-0000-0000-0000000000aa', public.hash_access_token('sv-new'), jsonb_build_object('status','issued','expiresAt', (now() + interval '1 day')::text));
insert into public.validation_test_sessions (workspace_id, access_token_hash, payload) values
  ('eeeeeeee-0000-0000-0000-0000000000aa', public.hash_access_token('ts-ok'),  '{"status":"active","title":"시험"}'),
  ('eeeeeeee-0000-0000-0000-0000000000aa', public.hash_access_token('ts-old'), jsonb_build_object('status','active','expiresAt', (now() - interval '1 hour')::text));
select count(*) as before_events from public.customer_events where source_type = 'grant_finder' \gset

-- 1. 설문 링크(로그인 없는 사람)
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select qa.eq('설문: 새 링크 열림', (public.get_public_survey('sv-ok') ->> 'available'), 'true');
select qa.ok('설문: 쓰는 중 저장', $q$select public.submit_public_survey_response('sv-ok', '{"answers":{"a":1}}', false)$q$);
select qa.ok('설문: 제출', $q$select public.submit_public_survey_response('sv-ok', '{"answers":{"a":2}}', true)$q$);
select qa.eq('설문: 낸 뒤 다시 열면', (public.get_public_survey('sv-ok') ->> 'status') || '/' || (public.get_public_survey('sv-ok') ->> 'available'), 'submitted/false');
select qa.no('설문: 낸 뒤 다시 내기', $q$select public.submit_public_survey_response('sv-ok', '{"answers":{"a":3}}', true)$q$);
select qa.no('설문: 낸 뒤 쓰는 중 저장으로 덮기', $q$select public.submit_public_survey_response('sv-ok', '{"answers":{"a":4}}', false)$q$);
select qa.eq('설문: 만료 시각 지난 링크', (public.get_public_survey('sv-old') ->> 'status') || '/' || (public.get_public_survey('sv-old') ->> 'available'), 'expired/false');
select qa.no('설문: 만료 시각 지난 링크에 내기', $q$select public.submit_public_survey_response('sv-old', '{}', true)$q$);
select qa.eq('설문: 만료 시각을 못 읽으면 열림', (public.get_public_survey('sv-bad') ->> 'available'), 'true');
select qa.eq('설문: 만료 전 링크 열림', (public.get_public_survey('sv-new') ->> 'available'), 'true');
select qa.ok('설문: 만료 전 링크에 내기', $q$select public.submit_public_survey_response('sv-new', '{}', true)$q$);
reset role;
select qa.eq('설문: 처음 낸 답이 남음', (select (r.payload -> 'answers' ->> 'a') from public.survey_responses r join public.survey_distributions d on d.id = r.distribution_id where d.access_token_hash = public.hash_access_token('sv-ok')), '2');

-- 2. 시험 링크
set role anon;
select qa.eq('시험: 새 링크 열림', (public.get_public_test_session('ts-ok') ->> 'available'), 'true');
select qa.ok('시험: 쓰는 중 저장', $q$select public.submit_public_test_feedback('ts-ok', '{"note":"1"}', false)$q$);
select qa.ok('시험: 마침', $q$select public.submit_public_test_feedback('ts-ok', '{"note":"2"}', true)$q$);
select qa.eq('시험: 마친 뒤 다시 열면', (public.get_public_test_session('ts-ok') ->> 'available'), 'false');
select qa.no('시험: 마친 뒤 다시 내기', $q$select public.submit_public_test_feedback('ts-ok', '{"note":"3"}', true)$q$);
select qa.eq('시험: 만료 시각 지난 링크', (public.get_public_test_session('ts-old') ->> 'status') || '/' || (public.get_public_test_session('ts-old') ->> 'available'), 'expired/false');
select qa.no('시험: 만료 시각 지난 링크에 내기', $q$select public.submit_public_test_feedback('ts-old', '{}', false)$q$);
reset role;
select qa.eq('시험: 마칠 때 낸 피드백이 남음', (select payload -> 'feedback' ->> 'note' from public.validation_test_sessions where access_token_hash = public.hash_access_token('ts-ok')), '2');

-- 3. 지원사업 알림 신청
set role anon;
select set_config('request.headers', '{"x-forwarded-for":"1.1.1.1, 10.0.0.1"}', false);
select qa.ok('알림: 같은 곳 1번째', $q$select public.portal_grant_alert_request('{"consent":true,"company_name":"가","phone":"010-1111-0001"}')$q$);
select qa.ok('알림: 같은 곳 2번째', $q$select public.portal_grant_alert_request('{"consent":true,"company_name":"가","phone":"010-1111-0002"}')$q$);
select qa.ok('알림: 같은 곳 3번째', $q$select public.portal_grant_alert_request('{"consent":true,"company_name":"가","phone":"010-1111-0003"}')$q$);
select qa.ok('알림: 같은 곳 4번째', $q$select public.portal_grant_alert_request('{"consent":true,"company_name":"가","phone":"010-1111-0004"}')$q$);
select qa.ok('알림: 같은 곳 5번째', $q$select public.portal_grant_alert_request('{"consent":true,"company_name":"가","phone":"010-1111-0005"}')$q$);
select qa.no('알림: 같은 곳 6번째(10분에 5번까지)', $q$select public.portal_grant_alert_request('{"consent":true,"company_name":"가","phone":"010-1111-0006"}')$q$);
select set_config('request.headers', '{"x-forwarded-for":"2.2.2.2"}', false);
select qa.ok('알림: 다른 곳은 그대로 됨', $q$select public.portal_grant_alert_request('{"consent":true,"company_name":"나","phone":"010-2222-0001"}')$q$);
select qa.eq('알림: 같은 연락처 · 같은 회사 다시 신청(하루) → 접수됨', public.portal_grant_alert_request('{"consent":true,"company_name":"나","phone":"01022220001"}')::text, 'true');
select qa.ok('알림: 같은 연락처라도 다른 회사는 따로 받음', $q$select public.portal_grant_alert_request('{"consent":true,"company_name":"나 두번째 회사","phone":"010-2222-0001"}')$q$);
select set_config('request.headers', '{"x-forwarded-for":"9.9.9.9","cf-connecting-ip":"1.1.1.1"}', false);
select qa.no('알림: 앞단 주소(cf)로 셈 — 꾸민 x-forwarded-for 로 못 피함', $q$select public.portal_grant_alert_request('{"consent":true,"company_name":"꾸밈","phone":"010-3333-0001"}')$q$);
select set_config('request.headers', '', false);
select qa.ok('알림: 주소를 모를 때(로컬)도 됨', $q$select public.portal_grant_alert_request('{"consent":true,"company_name":"다","email":"d@x.kr"}')$q$);
select qa.no('알림: 동의 없으면 막힘', $q$select public.portal_grant_alert_request('{"consent":false,"company_name":"다","email":"e@x.kr"}')$q$);
reset role;
select qa.eq('알림: 상담신청함에 들어간 건수(5 + 1 + 1 + 1)', ((select count(*) from public.customer_events where source_type = 'grant_finder') - :before_events)::text, '8');
select qa.eq('알림: 기록 표에는 원문이 없음', (select count(*)::text from public.public_intake_log where key_hash like '%010%' or key_hash like '%1.1.1.1%'), '0');
set role anon;
select qa.none('알림: 기록 표는 공개 계정이 못 읽음', $q$select count(*) from public.public_intake_log$q$);
reset role;
set role authenticated;
select qa.none('알림: 기록 표는 로그인 계정도 못 읽음', $q$select count(*) from public.public_intake_log$q$);
reset role;
select set_config('request.headers', '', false);
