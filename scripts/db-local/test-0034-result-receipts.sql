-- D-685 공유 서류 · 결과 글 열람 기록(0034) 시험 — 로컬 시험 DB(axqa)에서만. test-0033 다음에 돈다. 운영 DB 에는 절대 실행하지 않는다.
--   대표 O(19…a1 · 업체 A · B) · 내부 팀장 P(19…b1) · My MIRAE 고객: A1 · A2(같은 업체 A 의 두 계정) · B1(업체 B) · 로그인 안 한 사람(anon)
\set QUIET 1
\set ON_ERROR_STOP 1
create table if not exists qa.g34 (k text primary key, v text);
truncate qa.g34;
grant all on qa.g34 to anon, authenticated;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email) values
  ('34000000-0000-0000-0000-0000000000a1', 'a1@cust34.kr'),
  ('34000000-0000-0000-0000-0000000000a2', 'a2@cust34.kr'),
  ('34000000-0000-0000-0000-0000000000b1', 'b1@cust34.kr') on conflict do nothing;
insert into public.profiles (id, email) values
  ('34000000-0000-0000-0000-0000000000a1', 'a1@cust34.kr'),
  ('34000000-0000-0000-0000-0000000000a2', 'a2@cust34.kr'),
  ('34000000-0000-0000-0000-0000000000b1', 'b1@cust34.kr') on conflict (id) do update set email = excluded.email;
do $$ begin
  set local session_replication_role = replica;
  delete from public.portal_receipts where operations_client_id in ('o34-a', 'o34-b');
  delete from public.portal_documents where operations_client_id in ('o34-a', 'o34-b');
  delete from public.portal_updates where portal_client_link_id in (select id from public.portal_client_links where operations_client_id in ('o34-a', 'o34-b'));
  delete from public.portal_client_links where operations_client_id in ('o34-a', 'o34-b');
end $$;
insert into public.operations_clients (id, workspace_id, company_name, payload) select 'o34-a', v, '(주)결과정밀', '{}' from qa.ids where k = 'O' on conflict (id) do nothing;
insert into public.operations_clients (id, workspace_id, company_name, payload) select 'o34-b', v, '다른상사', '{}' from qa.ids where k = 'O' on conflict (id) do nothing;

select qa.eq('준비: 열람 종류 = home · report · document · result', (select pg_get_constraintdef(oid) from pg_constraint where conname = 'portal_receipts_item_kind_check' and conrelid = 'public.portal_receipts'::regclass),
  'CHECK ((item_kind = ANY (ARRAY[''home''::text, ''report''::text, ''document''::text, ''result''::text])))');
select qa.eq('준비: 새 함수 둘은 anon · PUBLIC 이 부를 수 없음', (select count(*)::text from information_schema.routine_privileges where routine_schema = 'public' and routine_name in ('portal_mark_item_seen', 'portal_result_receipts_since') and grantee in ('anon', 'PUBLIC')), '0');
select qa.eq('준비: 넣은 때가 있음 · 지금보다 앞', (public.portal_result_receipts_since() <= now())::text, 'true');
select qa.eq('준비: 앱 계정 표 권한은 그대로 SELECT 하나', (select string_agg(distinct privilege_type || '/' || grantee, ',') from information_schema.role_table_grants where table_schema = 'public' and table_name = 'portal_receipts' and grantee in ('anon', 'authenticated')), 'SELECT/authenticated');

-- ---------- 대표 O — 연결 · 공유 서류 · 결과 글 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
with x as (insert into public.portal_client_links (workspace_id, operations_client_id, profile_id) select v, 'o34-a', '34000000-0000-0000-0000-0000000000a1' from qa.ids where k = 'O' returning id) insert into qa.g34 select 'linkA1', id::text from x;
with x as (insert into public.portal_client_links (workspace_id, operations_client_id, profile_id) select v, 'o34-a', '34000000-0000-0000-0000-0000000000a2' from qa.ids where k = 'O' returning id) insert into qa.g34 select 'linkA2', id::text from x;
with x as (insert into public.portal_client_links (workspace_id, operations_client_id, profile_id) select v, 'o34-b', '34000000-0000-0000-0000-0000000000b1' from qa.ids where k = 'O' returning id) insert into qa.g34 select 'linkB1', id::text from x;
-- 공유 서류(A1 연결) · 내부만 · 요청만 · 파일 없는 공유 · A2 연결의 공유
with x as (insert into public.portal_documents (workspace_id, portal_client_link_id, operations_client_id, document_type, title, storage_path, file_name, source, visibility, status)
  select v, (select v from qa.g34 where k = 'linkA1')::uuid, 'o34-a', 'etc', '벤처인증 결과', v || '/clients/o34-a/result.pdf', 'result.pdf', 'internal', 'shared_with_customer', 'verified' from qa.ids where k = 'O' returning id) insert into qa.g34 select 'docShared', id::text from x;
with x as (insert into public.portal_documents (workspace_id, portal_client_link_id, operations_client_id, document_type, title, storage_path, source, visibility, status)
  select v, (select v from qa.g34 where k = 'linkA1')::uuid, 'o34-a', 'etc', '내부 검토본', v || '/clients/o34-a/internal.pdf', 'internal', 'internal_only', 'verified' from qa.ids where k = 'O' returning id) insert into qa.g34 select 'docInternal', id::text from x;
with x as (insert into public.portal_documents (workspace_id, portal_client_link_id, operations_client_id, document_type, title, status)
  select v, (select v from qa.g34 where k = 'linkA1')::uuid, 'o34-a', 'businessRegistration', '사업자등록증', 'requested' from qa.ids where k = 'O' returning id) insert into qa.g34 select 'docRequested', id::text from x;
with x as (insert into public.portal_documents (workspace_id, portal_client_link_id, operations_client_id, document_type, title, source, visibility, status)
  select v, (select v from qa.g34 where k = 'linkA1')::uuid, 'o34-a', 'etc', '파일 없는 공유', 'internal', 'shared_with_customer', 'verified' from qa.ids where k = 'O' returning id) insert into qa.g34 select 'docNoFile', id::text from x;
with x as (insert into public.portal_documents (workspace_id, portal_client_link_id, operations_client_id, document_type, title, storage_path, source, visibility, status)
  select v, (select v from qa.g34 where k = 'linkA2')::uuid, 'o34-a', 'etc', 'A2 에게 공유', v || '/clients/o34-a/a2.pdf', 'internal', 'shared_with_customer', 'verified' from qa.ids where k = 'O' returning id) insert into qa.g34 select 'docA2', id::text from x;
-- 결과 글(A1 · 발행) · 초안 · 진행 소식 · B 의 결과 글
with x as (insert into public.portal_updates (workspace_id, portal_client_link_id, category, title, body, status, published_at)
  select v, (select v from qa.g34 where k = 'linkA1')::uuid, 'result', '벤처인증 받으셨어요', '확인서를 올렸습니다.', 'published', now() from qa.ids where k = 'O' returning id) insert into qa.g34 select 'resPub', id::text from x;
with x as (insert into public.portal_updates (workspace_id, portal_client_link_id, category, title, status)
  select v, (select v from qa.g34 where k = 'linkA1')::uuid, 'result', '초안 결과', 'draft' from qa.ids where k = 'O' returning id) insert into qa.g34 select 'resDraft', id::text from x;
with x as (insert into public.portal_updates (workspace_id, portal_client_link_id, category, title, status, published_at)
  select v, (select v from qa.g34 where k = 'linkA1')::uuid, 'progress', '진행 소식', 'published', now() from qa.ids where k = 'O' returning id) insert into qa.g34 select 'updProgress', id::text from x;
with x as (insert into public.portal_updates (workspace_id, portal_client_link_id, category, title, status, published_at)
  select v, (select v from qa.g34 where k = 'linkB1')::uuid, 'result', 'B 결과', 'published', now() from qa.ids where k = 'O' returning id) insert into qa.g34 select 'resB', id::text from x;
select qa.eq('O0 준비 — 연결 셋 · 서류 다섯 · 소식 넷', (select count(*)::text from qa.g34), '12');
select qa.no('O1 대표(그 연결의 고객 아님)가 열람 남기기 막힘', $q$select public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA1')::uuid, 'document', (select v from qa.g34 where k = 'docShared')::uuid)$q$);
select qa.no('O2 대표가 표에 직접 열람 넣기 막힘', $q$insert into public.portal_receipts (workspace_id, operations_client_id, portal_client_link_id, profile_id, item_kind, item_id) select v, 'o34-a', (select v from qa.g34 where k = 'linkA1')::uuid, '34000000-0000-0000-0000-0000000000a1', 'document', (select v from qa.g34 where k = 'docShared')::uuid from qa.ids where k = 'O'$q$);
reset role;

-- ---------- 고객 A1 ----------
select set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('A1-1 공유 서류를 열었다 → 기록 · 열어 본 때', ((public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA1')::uuid, 'document', (select v from qa.g34 where k = 'docShared')::uuid)) ->> 'seen_at' is not null)::text, 'true');
select qa.eq('A1-2 1분 안에 다시 열어도 한 줄 · 횟수 그대로(함수 답은 같은 때)', ((public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA1')::uuid, 'document', (select v from qa.g34 where k = 'docShared')::uuid)) ->> 'seen_at' is not null)::text, 'true');
select qa.eq('A1-3 결과 글이 보였다 → 기록', ((public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA1')::uuid, 'result', (select v from qa.g34 where k = 'resPub')::uuid)) ->> 'seen_at' is not null)::text, 'true');
select qa.no('A1-4 내부만 서류 막힘(고객에게 안 보이는 것)', $q$select public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA1')::uuid, 'document', (select v from qa.g34 where k = 'docInternal')::uuid)$q$);
select qa.no('A1-5 요청만 한 서류(결과 아님) 막힘', $q$select public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA1')::uuid, 'document', (select v from qa.g34 where k = 'docRequested')::uuid)$q$);
select qa.no('A1-6 파일 없는 공유 막힘', $q$select public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA1')::uuid, 'document', (select v from qa.g34 where k = 'docNoFile')::uuid)$q$);
select qa.no('A1-7 초안 결과 글 막힘', $q$select public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA1')::uuid, 'result', (select v from qa.g34 where k = 'resDraft')::uuid)$q$);
select qa.no('A1-8 결과가 아닌 진행 소식 막힘', $q$select public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA1')::uuid, 'result', (select v from qa.g34 where k = 'updProgress')::uuid)$q$);
select qa.no('A1-9 같은 회사 다른 계정(A2) 연결의 서류 — 내 연결로 막힘', $q$select public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA1')::uuid, 'document', (select v from qa.g34 where k = 'docA2')::uuid)$q$);
select qa.no('A1-10 A2 의 연결로 남기기 막힘', $q$select public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA2')::uuid, 'document', (select v from qa.g34 where k = 'docA2')::uuid)$q$);
select qa.no('A1-11 다른 회사(B) 결과 글 막힘', $q$select public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA1')::uuid, 'result', (select v from qa.g34 where k = 'resB')::uuid)$q$);
select qa.no('A1-12 종류를 서류인데 결과로(엇갈림) 막힘', $q$select public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA1')::uuid, 'result', (select v from qa.g34 where k = 'docShared')::uuid)$q$);
select qa.no('A1-13 모르는 종류(report · 빈 값) 막힘 — 보고서 열람은 0033 함수로만', $q$select public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA1')::uuid, 'report', (select v from qa.g34 where k = 'docShared')::uuid)$q$);
select qa.no('A1-14 종류 null 막힘', $q$select public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA1')::uuid, null, (select v from qa.g34 where k = 'docShared')::uuid)$q$);
select qa.eq('A1-15 고객은 열람 표를 직접 못 읽음(0줄)', (select count(*)::text from public.portal_receipts), '0');
select qa.no('A1-16 고객이 표에 직접 넣기 막힘', $q$insert into public.portal_receipts (workspace_id, operations_client_id, portal_client_link_id, profile_id, item_kind, item_id) select w.id, 'o34-a', (select v from qa.g34 where k = 'linkA1')::uuid, '34000000-0000-0000-0000-0000000000a1', 'result', (select v from qa.g34 where k = 'resPub')::uuid from public.workspaces w limit 1$q$);
reset role;

-- 1분이 지난 뒤 다시 열면 횟수 + 1 (시험 DB 에서 때를 2분 앞으로 돌려 흉내)
update public.portal_receipts set last_seen_at = now() - interval '2 minutes' where item_id = (select v from qa.g34 where k = 'docShared')::uuid;
select set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA1')::uuid, 'document', (select v from qa.g34 where k = 'docShared')::uuid);
reset role;
select qa.eq('A1-17 1분 넘어 다시 열면 횟수 2 · 처음 연 때 그대로', (select seen_count || ' ' || (first_seen_at < last_seen_at or first_seen_at = last_seen_at)::text from public.portal_receipts where item_id = (select v from qa.g34 where k = 'docShared')::uuid), '2 true');

-- ---------- 고객 B1 · A2(멈춤) · 팀장 · anon ----------
select set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.no('B1-1 남의 연결(A1)로 남기기 막힘', $q$select public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA1')::uuid, 'document', (select v from qa.g34 where k = 'docShared')::uuid)$q$);
select qa.eq('B1-2 자기 결과 글은 기록', ((public.portal_mark_item_seen((select v from qa.g34 where k = 'linkB1')::uuid, 'result', (select v from qa.g34 where k = 'resB')::uuid)) ->> 'seen_at' is not null)::text, 'true');
reset role;
update public.portal_client_links set status = 'paused' where id = (select v from qa.g34 where k = 'linkA2')::uuid;
select set_config('request.jwt.claim.sub', '34000000-0000-0000-0000-0000000000a2', false);
set role authenticated;
select qa.no('A2-1 멈춘 연결은 그 순간부터 막힘', $q$select public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA2')::uuid, 'document', (select v from qa.g34 where k = 'docA2')::uuid)$q$);
reset role;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.no('P1 내부 팀장(남의 작업공간 고객) 막힘', $q$select public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA1')::uuid, 'result', (select v from qa.g34 where k = 'resPub')::uuid)$q$);
select qa.eq('P2 팀장은 대표 업체 열람 기록을 못 읽음(0줄)', (select count(*)::text from public.portal_receipts where operations_client_id = 'o34-a'), '0');
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select qa.no('N1 로그인 안 한 사람 막힘', $q$select public.portal_mark_item_seen((select v from qa.g34 where k = 'linkA1')::uuid, 'document', (select v from qa.g34 where k = 'docShared')::uuid)$q$);
select qa.no('N2 로그인 안 한 사람은 넣은 때도 못 봄', $q$select public.portal_result_receipts_since()$q$);
reset role;

-- ---------- 대표 O — 내부에서 계정별로 읽힌다 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O3 대표가 읽는 열람 — A1 의 공유 서류 · 결과 글 각 한 줄(A2 · 막힌 것 0)',
  (select string_agg(case when rc.profile_id = '34000000-0000-0000-0000-0000000000a1' then 'A1' when rc.profile_id = '34000000-0000-0000-0000-0000000000b1' then 'B1' else '?' end || ':' || rc.item_kind, ',' order by rc.operations_client_id, rc.item_kind)
     from public.portal_receipts rc where rc.operations_client_id in ('o34-a', 'o34-b')),
  'A1:document,A1:result,B1:result');
select qa.eq('O4 넣은 때는 직원도 읽음', (public.portal_result_receipts_since() is not null)::text, 'true');
reset role;
select set_config('request.jwt.claim.sub', '', false);
