-- D-686 고객 화면 '새 결과 자료'(0035) 시험 — 로컬 시험 DB(axqa)에서만. test-0034 다음에 돈다. 운영 DB 에는 절대 실행하지 않는다.
--   대표 O(19…a1 · 업체 X) · My MIRAE 고객: X1 · X2(같은 업체 X 의 두 계정) · Y1(업체 Y) · 내부 팀장 P · 로그인 안 한 사람(anon)
\set QUIET 1
\set ON_ERROR_STOP 1
create table if not exists qa.g35 (k text primary key, v text);
truncate qa.g35;
grant all on qa.g35 to anon, authenticated;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email) values
  ('35000000-0000-0000-0000-0000000000a1', 'x1@cust35.kr'),
  ('35000000-0000-0000-0000-0000000000a2', 'x2@cust35.kr'),
  ('35000000-0000-0000-0000-0000000000b1', 'y1@cust35.kr') on conflict do nothing;
insert into public.profiles (id, email) values
  ('35000000-0000-0000-0000-0000000000a1', 'x1@cust35.kr'),
  ('35000000-0000-0000-0000-0000000000a2', 'x2@cust35.kr'),
  ('35000000-0000-0000-0000-0000000000b1', 'y1@cust35.kr') on conflict (id) do update set email = excluded.email;
do $$ begin
  set local session_replication_role = replica;
  delete from public.portal_receipts where operations_client_id in ('o35-x', 'o35-y');
  delete from public.portal_documents where operations_client_id in ('o35-x', 'o35-y');
  delete from public.portal_updates where portal_client_link_id in (select id from public.portal_client_links where operations_client_id in ('o35-x', 'o35-y'));
  delete from public.portal_client_links where operations_client_id in ('o35-x', 'o35-y');
end $$;
insert into public.operations_clients (id, workspace_id, company_name, payload) select 'o35-x', v, '(주)새결과', '{}' from qa.ids where k = 'O' on conflict (id) do nothing;
insert into public.operations_clients (id, workspace_id, company_name, payload) select 'o35-y', v, '와이상사', '{}' from qa.ids where k = 'O' on conflict (id) do nothing;

select qa.eq('준비(0035): 읽기 함수 둘은 anon · PUBLIC 이 부를 수 없음', (select count(*)::text from information_schema.routine_privileges where routine_schema = 'public' and routine_name in ('portal_results_state', 'portal_result_summary') and grantee in ('anon', 'PUBLIC')), '0');

-- ---------- 대표 O — 연결 · 자료(기록 시작 전 공유 하나 · 뒤 공유 셋) ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
with x as (insert into public.portal_client_links (workspace_id, operations_client_id, profile_id) select v, 'o35-x', '35000000-0000-0000-0000-0000000000a1' from qa.ids where k = 'O' returning id) insert into qa.g35 select 'linkX1', id::text from x;
with x as (insert into public.portal_client_links (workspace_id, operations_client_id, profile_id) select v, 'o35-x', '35000000-0000-0000-0000-0000000000a2' from qa.ids where k = 'O' returning id) insert into qa.g35 select 'linkX2', id::text from x;
with x as (insert into public.portal_client_links (workspace_id, operations_client_id, profile_id) select v, 'o35-y', '35000000-0000-0000-0000-0000000000b1' from qa.ids where k = 'O' returning id) insert into qa.g35 select 'linkY1', id::text from x;
with x as (insert into public.portal_documents (workspace_id, portal_client_link_id, operations_client_id, document_type, title, storage_path, source, visibility, status, created_at)
  select v, (select v from qa.g35 where k = 'linkX1')::uuid, 'o35-x', 'etc', '예전 공유', v || '/clients/o35-x/old.pdf', 'internal', 'shared_with_customer', 'verified', public.portal_result_receipts_since() - interval '1 day' from qa.ids where k = 'O' returning id) insert into qa.g35 select 'docOld', id::text from x;
with x as (insert into public.portal_documents (workspace_id, portal_client_link_id, operations_client_id, document_type, title, storage_path, source, visibility, status)
  select v, (select v from qa.g35 where k = 'linkX1')::uuid, 'o35-x', 'etc', '새 결과 서류', v || '/clients/o35-x/new.pdf', 'internal', 'shared_with_customer', 'verified' from qa.ids where k = 'O' returning id) insert into qa.g35 select 'docNew', id::text from x;
with x as (insert into public.portal_documents (workspace_id, portal_client_link_id, operations_client_id, document_type, title, storage_path, source, visibility, status)
  select v, (select v from qa.g35 where k = 'linkX1')::uuid, 'o35-x', 'etc', '내부만', v || '/clients/o35-x/internal.pdf', 'internal', 'internal_only', 'verified' from qa.ids where k = 'O' returning id) insert into qa.g35 select 'docInternal', id::text from x;
with x as (insert into public.portal_updates (workspace_id, portal_client_link_id, category, title, status, published_at)
  select v, (select v from qa.g35 where k = 'linkX1')::uuid, 'result', '결과 안내', 'published', now() from qa.ids where k = 'O' returning id) insert into qa.g35 select 'resNew', id::text from x;
with x as (insert into public.portal_updates (workspace_id, portal_client_link_id, category, title, status)
  select v, (select v from qa.g35 where k = 'linkX1')::uuid, 'result', '초안', 'draft' from qa.ids where k = 'O' returning id) insert into qa.g35 select 'resDraft', id::text from x;
with x as (insert into public.portal_documents (workspace_id, portal_client_link_id, operations_client_id, document_type, title, storage_path, source, visibility, status)
  select v, (select v from qa.g35 where k = 'linkX2')::uuid, 'o35-x', 'etc', 'X2 에게', v || '/clients/o35-x/x2.pdf', 'internal', 'shared_with_customer', 'verified' from qa.ids where k = 'O' returning id) insert into qa.g35 select 'docX2', id::text from x;
select qa.no('O1 대표가 고객 함수로 새 자료 보기 막힘(그 연결의 고객 아님)', $q$select public.portal_results_state((select v from qa.g35 where k = 'linkX1')::uuid)$q$);
select qa.eq('O2 대표가 부르는 요약 = 빈 목록(대표의 연결 없음)', public.portal_result_summary()::text, '[]');
reset role;

-- ---------- 고객 X1 ----------
select set_config('request.jwt.claim.sub', '35000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('X1-1 요약 — 내 연결 하나 · 새 결과 자료 2(새 서류 · 결과 글 — 예전 공유 · 내부만 · 초안 · 남의 연결 빼고)',
  (select string_agg((x ->> 'link_id' = (select v from qa.g35 where k = 'linkX1'))::text || ':' || (x ->> 'results_new'), ',') from jsonb_array_elements(public.portal_result_summary()) x), 'true:2');
select qa.eq('X1-2 자료마다 — 셋(예전 서류 · 새 서류 · 결과 글) · 새 2 · 예전 공유는 새 아님 · 연 때 없음',
  (select count(*)::text || ' ' || count(*) filter (where (x ->> 'is_new')::boolean)::text || ' ' || bool_and(x ->> 'seen_at' is null)::text from jsonb_array_elements(public.portal_results_state((select v from qa.g35 where k = 'linkX1')::uuid)) x)
  || ' ' || (select (x ->> 'is_new') from jsonb_array_elements(public.portal_results_state((select v from qa.g35 where k = 'linkX1')::uuid)) x where x ->> 'id' = (select v from qa.g35 where k = 'docOld')),
  '3 2 true false');
select qa.eq('X1-3 돌려주는 칸은 kind · id · seen_at · is_new 넷뿐(제목 · 경로 · 내부 칸 0)',
  (select string_agg(distinct k, ',' order by k) from jsonb_array_elements(public.portal_results_state((select v from qa.g35 where k = 'linkX1')::uuid)) x, jsonb_object_keys(x) k), 'id,is_new,kind,seen_at');
select public.portal_mark_item_seen((select v from qa.g35 where k = 'linkX1')::uuid, 'document', (select v from qa.g35 where k = 'docNew')::uuid);
select qa.eq('X1-4 새 서류를 열면 — 요약 1 · 그 서류 is_new false · 연 때 있음',
  (select (x ->> 'results_new') from jsonb_array_elements(public.portal_result_summary()) x) || ' ' ||
  (select (x ->> 'is_new') || ':' || (x ->> 'seen_at' is not null) from jsonb_array_elements(public.portal_results_state((select v from qa.g35 where k = 'linkX1')::uuid)) x where x ->> 'id' = (select v from qa.g35 where k = 'docNew')), '1 false:true');
select public.portal_mark_item_seen((select v from qa.g35 where k = 'linkX1')::uuid, 'result', (select v from qa.g35 where k = 'resNew')::uuid);
select qa.eq('X1-5 결과 글도 보면 — 요약 0', (select (x ->> 'results_new') from jsonb_array_elements(public.portal_result_summary()) x), '0');
select qa.no('X1-6 남의 연결(X2)로 새 자료 보기 막힘', $q$select public.portal_results_state((select v from qa.g35 where k = 'linkX2')::uuid)$q$);
select qa.no('X1-7 다른 회사(Y1) 연결 막힘', $q$select public.portal_results_state((select v from qa.g35 where k = 'linkY1')::uuid)$q$);
select qa.eq('X1-8 읽기만 — 부르기만 해서는 열람 기록이 늘지 않음(X1 기록 2 그대로)', (select count(*)::text from jsonb_array_elements(public.portal_results_state((select v from qa.g35 where k = 'linkX1')::uuid)) x where x ->> 'seen_at' is not null), '2');
reset role;
select qa.eq('X1-9 서버 기록 수 — X1 의 열람 2줄(부른 횟수와 상관없이)', (select count(*)::text from public.portal_receipts where operations_client_id = 'o35-x' and profile_id = '35000000-0000-0000-0000-0000000000a1'), '2');

-- ---------- 같은 회사 다른 계정 X2 — 자기 연결만 · 계정마다 따로 ----------
select set_config('request.jwt.claim.sub', '35000000-0000-0000-0000-0000000000a2', false);
set role authenticated;
select qa.eq('X2-1 요약 — 내 연결의 새 자료 1(X1 이 연 것과 상관없이 · X1 연결 자료는 안 셈)',
  (select string_agg((x ->> 'link_id' = (select v from qa.g35 where k = 'linkX2'))::text || ':' || (x ->> 'results_new'), ',') from jsonb_array_elements(public.portal_result_summary()) x), 'true:1');
reset role;
update public.portal_client_links set status = 'paused' where id = (select v from qa.g35 where k = 'linkX2')::uuid;
select set_config('request.jwt.claim.sub', '35000000-0000-0000-0000-0000000000a2', false);
set role authenticated;
select qa.eq('X2-2 멈춘 연결 — 요약에서 빠짐 · 자료 보기 막힘', public.portal_result_summary()::text, '[]');
select qa.no('X2-3 멈춘 연결 자료 보기 막힘', $q$select public.portal_results_state((select v from qa.g35 where k = 'linkX2')::uuid)$q$);
reset role;

-- ---------- 다른 회사 Y1 · 팀장 · anon ----------
select set_config('request.jwt.claim.sub', '35000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('Y1-1 요약 — 내 연결 하나 · 새 0(공유한 것 없음)', (select string_agg(x ->> 'results_new', ',') from jsonb_array_elements(public.portal_result_summary()) x), '0');
reset role;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.no('P1 내부 팀장 막힘', $q$select public.portal_results_state((select v from qa.g35 where k = 'linkX1')::uuid)$q$);
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select qa.no('N1 로그인 안 한 사람 — 요약 막힘', $q$select public.portal_result_summary()$q$);
select qa.no('N2 로그인 안 한 사람 — 자료 막힘', $q$select public.portal_results_state((select v from qa.g35 where k = 'linkX1')::uuid)$q$);
reset role;
select set_config('request.jwt.claim.sub', '', false);
