-- D-689 고객 화면 '담당자가 추천해요'(0036) 시험 — 로컬 시험 DB(axqa)에서만. test-0035 다음에 돈다. 운영 DB 에는 절대 실행하지 않는다.
--   대표 O(19…a1 · 업체 X · Y) · My MIRAE 고객: X1 · X2(같은 업체 X 의 두 계정) · Y1(업체 Y) · 내부 팀장 P(19…b1 · 업체 PX)
--   · 연결 없는 가입자 R(19…c1) · 외부 구독 고객 C(24…d1) · 로그인 안 한 사람(anon)
\set QUIET 1
\set ON_ERROR_STOP 1
create table if not exists qa.g36 (k text primary key, v text);
truncate qa.g36;
grant all on qa.g36 to anon, authenticated;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email) values
  ('36000000-0000-0000-0000-0000000000a1', 'x1@cust36.kr'),
  ('36000000-0000-0000-0000-0000000000a2', 'x2@cust36.kr'),
  ('36000000-0000-0000-0000-0000000000b1', 'y1@cust36.kr') on conflict do nothing;
insert into public.profiles (id, email) values
  ('36000000-0000-0000-0000-0000000000a1', 'x1@cust36.kr'),
  ('36000000-0000-0000-0000-0000000000a2', 'x2@cust36.kr'),
  ('36000000-0000-0000-0000-0000000000b1', 'y1@cust36.kr') on conflict (id) do update set email = excluded.email;
do $$ begin
  set local session_replication_role = replica;
  delete from public.portal_recommendation_interest where operations_client_id in ('o36-x', 'o36-y', 'p36-x');
  delete from public.portal_recommendations where operations_client_id in ('o36-x', 'o36-y', 'p36-x');
  delete from public.portal_client_links where operations_client_id in ('o36-x', 'o36-y', 'p36-x');
end $$;
insert into public.operations_clients (id, workspace_id, company_name, payload) select 'o36-x', v, '(주)추천정밀', '{}' from qa.ids where k = 'O' on conflict (id) do nothing;
insert into public.operations_clients (id, workspace_id, company_name, payload) select 'o36-y', v, '와이추천', '{}' from qa.ids where k = 'O' on conflict (id) do nothing;
insert into public.operations_clients (id, workspace_id, company_name, payload) select 'p36-x', v, '팀장 추천 고객사', '{}' from qa.ids where k = 'P' on conflict (id) do nothing;

select qa.eq('준비(0036): 두 표에 허락 문(0026) 2 · 작업공간 고정(0023) + 같은 작업공간 지킴 4 · RLS 2',
  (select count(*)::text from pg_policies where policyname = 'zz View consent gate' and tablename in ('portal_recommendations', 'portal_recommendation_interest')) || ' ' ||
  (select count(*)::text from pg_trigger g join pg_class c on c.oid = g.tgrelid where c.relname in ('portal_recommendations', 'portal_recommendation_interest') and g.tgname in ('zz_workspace_id_lock', 'zz_portal_recommendations_same_workspace', 'zz_portal_reco_interest_same_workspace')) || ' ' ||
  (select count(*) filter (where relrowsecurity)::text from pg_class where relnamespace = 'public'::regnamespace and relname in ('portal_recommendations', 'portal_recommendation_interest')),
  '2 4 2');
select qa.eq('준비(0036): 함수 넷은 anon · PUBLIC 이 부를 수 없음 · 지킴 함수는 앱 계정도 못 부름',
  (select count(*)::text from information_schema.routine_privileges where routine_schema = 'public'
     and routine_name in ('portal_recommendations', 'portal_recommendation_interest', 'portal_show_recommendation', 'portal_withdraw_recommendation', 'portal_reco_guard') and grantee in ('anon', 'PUBLIC'))
  || ' ' || has_function_privilege('authenticated', 'public.portal_reco_guard()', 'execute')::text, '0 false');

-- ---------- 대표 O — 연결 · 올리기 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
with x as (insert into public.portal_client_links (workspace_id, operations_client_id, profile_id) select v, 'o36-x', '36000000-0000-0000-0000-0000000000a1' from qa.ids where k = 'O' returning id) insert into qa.g36 select 'linkX1', id::text from x;
with x as (insert into public.portal_client_links (workspace_id, operations_client_id, profile_id) select v, 'o36-x', '36000000-0000-0000-0000-0000000000a2' from qa.ids where k = 'O' returning id) insert into qa.g36 select 'linkX2', id::text from x;
with x as (insert into public.portal_client_links (workspace_id, operations_client_id, profile_id) select v, 'o36-y', '36000000-0000-0000-0000-0000000000b1' from qa.ids where k = 'O' returning id) insert into qa.g36 select 'linkY1', id::text from x;

insert into qa.g36 select 'recG', (public.portal_show_recommendation(v, 'o36-x', 'reco-x-grant-0001', 'grant', '  2027 스마트공장 지원  ', '지역 · 업종 · 업력 조건이 맞아요', '2027-01-15', 'https://www.bizinfo.go.kr/notice/1', '{"type":"grant","id":"n-1","secret":"내부 메모"}'))->>'id' from qa.ids where k = 'O';
select qa.eq('O1 올리기 — 앞뒤 빈칸 다듬음 · 출처는 type · id 두 칸만(모르는 칸 버림) · 올린 사람 남음',
  (select title || '|' || source_ref::text || '|' || (shown_by = '19000000-0000-0000-0000-0000000000a1')::text from public.portal_recommendations where id = (select v from qa.g36 where k = 'recG')::uuid),
  '2027 스마트공장 지원|{"id": "n-1", "type": "grant"}|true');
select qa.eq('O2 같은 올리기 번호로 두 번 — 한 건(created false · 같은 id)',
  (select (r ->> 'created') || ' ' || ((r ->> 'id') = (select v from qa.g36 where k = 'recG'))::text from (select public.portal_show_recommendation(v, 'o36-x', 'reco-x-grant-0001', 'grant', '다른 제목', '', null, null, '{}') as r from qa.ids where k = 'O') s),
  'false true');
select qa.eq('O3 같은 출처(같은 공고)를 다른 번호로 또 — 겹쳐 올리지 않고 그것을 돌려줌',
  (select (r ->> 'created') || ' ' || ((r ->> 'id') = (select v from qa.g36 where k = 'recG'))::text from (select public.portal_show_recommendation(v, 'o36-x', 'reco-x-grant-0002', 'grant', '2027 스마트공장 지원', '', null, null, '{"type":"grant","id":"n-1"}') as r from qa.ids where k = 'O') s),
  'false true');
insert into qa.g36 select 'recT', (public.portal_show_recommendation(v, 'o36-x', 'reco-x-task-00001', 'task', '기업부설연구소 설립', '연구 인력 2명이면 함께 검토해 볼 만해요', null, null, '{"type":"insight","id":"labcare"}'))->>'id' from qa.ids where k = 'O';
insert into qa.g36 select 'recM', (public.portal_show_recommendation(v, 'o36-x', 'reco-x-manual-001', 'task', '직원 교육 계획', '', null, null, '{}'))->>'id' from qa.ids where k = 'O';
select qa.no('O4 한 업체 넷째 추천 막힘(3개까지)', $q$select public.portal_show_recommendation((select v from qa.ids where k = 'O'), 'o36-x', 'reco-x-fourth-001', 'task', '넷째', '', null, null, '{}')$q$);
select qa.no('O5 javascript: 주소 막힘', $q$select public.portal_show_recommendation((select v from qa.ids where k = 'O'), 'o36-y', 'reco-y-bad-url-01', 'grant', '공고', '', null, 'javascript:alert(1)', '{}')$q$);
select qa.no('O6 빈칸 섞인 주소 막힘', $q$select public.portal_show_recommendation((select v from qa.ids where k = 'O'), 'o36-y', 'reco-y-bad-url-02', 'grant', '공고', '', null, 'https://a.kr/x y', '{}')$q$);
select qa.no('O7 빈 제목 막힘', $q$select public.portal_show_recommendation((select v from qa.ids where k = 'O'), 'o36-y', 'reco-y-empty-0001', 'grant', '   ', '', null, null, '{}')$q$);
select qa.no('O8 제목 81자 막힘', $q$select public.portal_show_recommendation((select v from qa.ids where k = 'O'), 'o36-y', 'reco-y-long-00001', 'grant', repeat('가', 81), '', null, null, '{}')$q$);
select qa.no('O9 근거 161자 막힘', $q$select public.portal_show_recommendation((select v from qa.ids where k = 'O'), 'o36-y', 'reco-y-long-00002', 'grant', '공고', repeat('가', 161), null, null, '{}')$q$);
select qa.no('O10 모르는 종류 막힘', $q$select public.portal_show_recommendation((select v from qa.ids where k = 'O'), 'o36-y', 'reco-y-kind-00001', 'invoice', '청구', '', null, null, '{}')$q$);
select qa.no('O11 짧은 올리기 번호 막힘', $q$select public.portal_show_recommendation((select v from qa.ids where k = 'O'), 'o36-y', 'short', 'grant', '공고', '', null, null, '{}')$q$);
select qa.no('O12 다른 작업공간 id + 내 업체 막힘', $q$select public.portal_show_recommendation((select v from qa.ids where k = 'C'), 'o36-y', 'reco-y-otherws-01', 'grant', '공고', '', null, null, '{}')$q$);
select qa.no('O13 표에 직접 넣기 막힘', $q$insert into public.portal_recommendations (workspace_id, operations_client_id, kind, title, client_key) select v, 'o36-y', 'grant', '직접', 'reco-direct-0001' from qa.ids where k = 'O'$q$);
select qa.no('O14 표 직접 상태 바꾸기 막힘', $q$update public.portal_recommendations set status = 'withdrawn' where id = (select v from qa.g36 where k = 'recM')::uuid$q$);
select qa.no('O15 직원이 [관심 있어요] 직접 만들기 막힘', $q$insert into public.portal_recommendation_interest (workspace_id, operations_client_id, portal_client_link_id, profile_id, recommendation_id) select v, 'o36-x', (select v from qa.g36 where k = 'linkX1')::uuid, '36000000-0000-0000-0000-0000000000a1', (select v from qa.g36 where k = 'recG')::uuid from qa.ids where k = 'O'$q$);
select qa.no('O16 직원이 고객 함수로 [관심 있어요](그 연결의 고객 아님) 막힘', $q$select public.portal_recommendation_interest((select v from qa.g36 where k = 'linkX1')::uuid, (select v from qa.g36 where k = 'recG')::uuid)$q$);
select qa.no('O17 직원이 고객 목록 함수 부르기(그 연결의 고객 아님) 막힘', $q$select public.portal_recommendations((select v from qa.g36 where k = 'linkX1')::uuid)$q$);
select qa.eq('O18 직원은 표를 읽음(같은 작업공간) — X 업체 올라온 3', (select count(*)::text from public.portal_recommendations where operations_client_id = 'o36-x' and status = 'shown'), '3');
reset role;

-- ---------- 고객 X1 ----------
select set_config('request.jwt.claim.sub', '36000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('X1-1 내 업체 추천 3 · 돌려주는 칸은 8개(내부 출처 · 올린 사람 · 올리기 번호 0)',
  (select jsonb_array_length(public.portal_recommendations((select v from qa.g36 where k = 'linkX1')::uuid))::text) || ' ' ||
  (select string_agg(distinct k, ',' order by k) from jsonb_array_elements(public.portal_recommendations((select v from qa.g36 where k = 'linkX1')::uuid)) x, jsonb_object_keys(x) k),
  '3 deadline,id,interested_at,kind,link_url,reason,shown_at,title');
select qa.eq('X1-2 공고 추천 — 제목 · 근거 · 마감 · 주소 · 아직 관심 없음',
  (select (x ->> 'title') || '|' || (x ->> 'reason') || '|' || (x ->> 'deadline') || '|' || (x ->> 'link_url') || '|' || coalesce(x ->> 'interested_at', '-') from jsonb_array_elements(public.portal_recommendations((select v from qa.g36 where k = 'linkX1')::uuid)) x where x ->> 'kind' = 'grant'),
  '2027 스마트공장 지원|지역 · 업종 · 업력 조건이 맞아요|2027-01-15|https://www.bizinfo.go.kr/notice/1|-');
select qa.eq('X1-3 [관심 있어요] → 때가 생김', (select (public.portal_recommendation_interest((select v from qa.g36 where k = 'linkX1')::uuid, (select v from qa.g36 where k = 'recG')::uuid) ->> 'interested_at') is not null)::text, 'true');
insert into qa.g36 select 'firstAt', (public.portal_recommendation_interest((select v from qa.g36 where k = 'linkX1')::uuid, (select v from qa.g36 where k = 'recG')::uuid) ->> 'interested_at');
select qa.eq('X1-4 다시 눌러도 처음 때 그대로 · 목록에도 그 때',
  ((select (x ->> 'interested_at') from jsonb_array_elements(public.portal_recommendations((select v from qa.g36 where k = 'linkX1')::uuid)) x where x ->> 'kind' = 'grant') = (select v from qa.g36 where k = 'firstAt'))::text,
  'true');
select qa.no('X1-5 남의 연결(X2)로 목록 막힘', $q$select public.portal_recommendations((select v from qa.g36 where k = 'linkX2')::uuid)$q$);
select qa.no('X1-6 남의 연결(X2)로 [관심 있어요] 위조 막힘', $q$select public.portal_recommendation_interest((select v from qa.g36 where k = 'linkX2')::uuid, (select v from qa.g36 where k = 'recG')::uuid)$q$);
select qa.no('X1-7 다른 회사(Y1) 연결 막힘', $q$select public.portal_recommendations((select v from qa.g36 where k = 'linkY1')::uuid)$q$);
select qa.no('X1-8 고객이 표 직접 읽기 — 0줄이거나 막힘', $q$select 1/(select count(*) from public.portal_recommendations)$q$);
select qa.no('X1-9 고객이 올리기 막힘', $q$select public.portal_show_recommendation((select v from qa.ids where k = 'O'), 'o36-x', 'reco-cust-000001', 'task', 'x', '', null, null, '{}')$q$);
select qa.no('X1-10 고객이 내리기 막힘', $q$select public.portal_withdraw_recommendation((select v from qa.g36 where k = 'recT')::uuid)$q$);
select qa.no('X1-11 관심 기록 직접 고치기 막힘', $q$update public.portal_recommendation_interest set interested_at = now() - interval '9 days'$q$);
reset role;
select qa.eq('X1-12 서버 기록 — X1 관심 1줄(두 번 눌러도)', (select count(*)::text from public.portal_recommendation_interest where operations_client_id = 'o36-x' and profile_id = '36000000-0000-0000-0000-0000000000a1'), '1');

-- ---------- 같은 회사 X2 — 같은 추천 · 관심은 계정마다 ----------
select set_config('request.jwt.claim.sub', '36000000-0000-0000-0000-0000000000a2', false);
set role authenticated;
select qa.eq('X2-1 같은 추천 3 · 나는 아직 관심 없음(X1 과 따로)',
  (select count(*)::text || ' ' || count(*) filter (where x ->> 'interested_at' is not null)::text from jsonb_array_elements(public.portal_recommendations((select v from qa.g36 where k = 'linkX2')::uuid)) x), '3 0');
reset role;

-- ---------- 다른 회사 Y1 — X 추천 0 ----------
select set_config('request.jwt.claim.sub', '36000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('Y1-1 내 업체(Y) 추천 0', public.portal_recommendations((select v from qa.g36 where k = 'linkY1')::uuid)::text, '[]');
select qa.no('Y1-2 X 추천 id 를 알아도 내 연결로 [관심 있어요] 막힘', $q$select public.portal_recommendation_interest((select v from qa.g36 where k = 'linkY1')::uuid, (select v from qa.g36 where k = 'recG')::uuid)$q$);
reset role;

-- ---------- 대표 O — 내리기 · 관심 기록은 남음 · 내린 뒤 자리 생김 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O20 직원이 보는 관심 기록 — X1 · 공고 추천 한 줄',
  (select string_agg((i.portal_client_link_id = (select v from qa.g36 where k = 'linkX1')::uuid)::text || ':' || (i.recommendation_id = (select v from qa.g36 where k = 'recG')::uuid)::text, ',') from public.portal_recommendation_interest i where i.operations_client_id = 'o36-x'),
  'true:true');
select qa.eq('O21 내리기 → withdrawn · 내린 때 · 내린 사람', (select (public.portal_withdraw_recommendation((select v from qa.g36 where k = 'recG')::uuid) ->> 'status')), 'withdrawn');
select qa.no('O22 두 번 내리기 막힘(이미 내림)', $q$select public.portal_withdraw_recommendation((select v from qa.g36 where k = 'recG')::uuid)$q$);
select qa.eq('O23 내린 뒤 자리 생김 — 넷째가 셋째로 올라감',
  (select (public.portal_show_recommendation(v, 'o36-x', 'reco-x-fourth-002', 'task', '넷째 과제', '', null, null, '{}') ->> 'created') from qa.ids where k = 'O'), 'true');
select qa.eq('O24 하나 더 내리고 · 내린 공고를 다시 올리면 새 줄(내린 것은 겹침으로 안 셈)',
  (select (public.portal_withdraw_recommendation((select v from qa.g36 where k = 'recM')::uuid) ->> 'status')) || ' ' ||
  (select (public.portal_show_recommendation(v, 'o36-x', 'reco-x-grant-0003', 'grant', '2027 스마트공장 지원', '다시', null, null, '{"type":"grant","id":"n-1"}') ->> 'created') from qa.ids where k = 'O'),
  'withdrawn true');
select qa.eq('O25 관심 기록은 내려도 그대로(지우지 않음) · 추천 줄도 그대로(withdrawn)',
  (select count(*)::text from public.portal_recommendation_interest where recommendation_id = (select v from qa.g36 where k = 'recG')::uuid) || ' ' ||
  (select status from public.portal_recommendations where id = (select v from qa.g36 where k = 'recG')::uuid), '1 withdrawn');
reset role;

select set_config('request.jwt.claim.sub', '36000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('X1-20 내린 추천은 고객 목록에서 빠짐 · 새로 올린 공고 줄은 관심 없음(새 줄)',
  (select string_agg((x ->> 'title') || ':' || coalesce(x ->> 'interested_at', '-'), ',' order by x ->> 'title') from jsonb_array_elements(public.portal_recommendations((select v from qa.g36 where k = 'linkX1')::uuid)) x),
  '2027 스마트공장 지원:-,기업부설연구소 설립:-,넷째 과제:-');
select qa.no('X1-21 내린 추천에 [관심 있어요] 막힘', $q$select public.portal_recommendation_interest((select v from qa.g36 where k = 'linkX1')::uuid, (select v from qa.g36 where k = 'recM')::uuid)$q$);
reset role;

-- ---------- 멈춘 연결 — 바로 막힘 ----------
update public.portal_client_links set status = 'paused' where id = (select v from qa.g36 where k = 'linkX2')::uuid;
select set_config('request.jwt.claim.sub', '36000000-0000-0000-0000-0000000000a2', false);
set role authenticated;
select qa.no('X2-2 멈춘 연결 — 목록 막힘', $q$select public.portal_recommendations((select v from qa.g36 where k = 'linkX2')::uuid)$q$);
select qa.no('X2-3 멈춘 연결 — [관심 있어요] 막힘', $q$select public.portal_recommendation_interest((select v from qa.g36 where k = 'linkX2')::uuid, (select v from qa.g36 where k = 'recT')::uuid)$q$);
reset role;

-- ---------- 내부 팀장 P — 대표 자료 0 · 대표 업체 올리기 막힘 · 자기 업체는 됨 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P1 대표 추천 · 관심 기록 0줄', (select count(*)::text from public.portal_recommendations) || ' ' || (select count(*)::text from public.portal_recommendation_interest), '0 0');
select qa.no('P2 대표 업체에 올리기 막힘', $q$select public.portal_show_recommendation((select v from qa.ids where k = 'O'), 'o36-x', 'reco-p-000000001', 'task', 'x', '', null, null, '{}')$q$);
select qa.no('P3 대표 추천 내리기 막힘', $q$select public.portal_withdraw_recommendation((select v from qa.g36 where k = 'recT')::uuid)$q$);
insert into qa.g36 select 'recP', (public.portal_show_recommendation(v, 'p36-x', 'reco-p-own-00001', 'task', '팀장 업체 과제', '', null, null, '{}'))->>'id' from qa.ids where k = 'P';
select qa.eq('P4 내 작업공간 업체에는 올리기 가능', (select count(*)::text from public.portal_recommendations where id = (select v from qa.g36 where k = 'recP')::uuid), '1');
reset role;

-- ---------- 대표 O — 팀장 작업공간은 허락(0026) 없이 못 봄 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O30 허락 없음: 팀장 작업공간 추천 0줄', (select count(*)::text from public.portal_recommendations where operations_client_id = 'p36-x'), '0');
select qa.no('O31 허락 없음: 팀장 업체에 올리기 막힘', $q$select public.portal_show_recommendation((select v from qa.ids where k = 'P'), 'p36-x', 'reco-o-on-p-0001', 'task', 'x', '', null, null, '{}')$q$);
select qa.no('O32 허락 없음: 팀장 업체 추천 내리기 막힘', $q$select public.portal_withdraw_recommendation((select v from qa.g36 where k = 'recP')::uuid)$q$);
reset role;

-- ---------- 연결 없는 가입자 R · 외부 구독 고객 C · 로그인 안 한 사람 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
select qa.no('R1 연결 없는 가입자 — X 연결로 목록 막힘', $q$select public.portal_recommendations((select v from qa.g36 where k = 'linkX1')::uuid)$q$);
reset role;
select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-0000000000d1', false);
set role authenticated;
select qa.eq('C1 외부 구독 고객 — 대표 추천 표 0줄', (select count(*)::text from public.portal_recommendations), '0');
select qa.no('C2 외부 구독 고객이 대표 업체에 올리기 막힘', $q$select public.portal_show_recommendation((select v from qa.ids where k = 'O'), 'o36-x', 'reco-c-000000001', 'task', 'x', '', null, null, '{}')$q$);
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select qa.no('N1 로그인 안 한 사람 — 목록 막힘', $q$select public.portal_recommendations((select v from qa.g36 where k = 'linkX1')::uuid)$q$);
select qa.no('N2 로그인 안 한 사람 — [관심 있어요] 막힘', $q$select public.portal_recommendation_interest((select v from qa.g36 where k = 'linkX1')::uuid, (select v from qa.g36 where k = 'recT')::uuid)$q$);
select qa.no('N3 로그인 안 한 사람 — 표 읽기 막힘', $q$select count(*) from public.portal_recommendations$q$);
select qa.no('N4 로그인 안 한 사람 — 올리기 막힘', $q$select public.portal_show_recommendation((select v from qa.ids where k = 'O'), 'o36-x', 'reco-n-000000001', 'task', 'x', '', null, null, '{}')$q$);
reset role;
select set_config('request.jwt.claim.sub', '', false);
