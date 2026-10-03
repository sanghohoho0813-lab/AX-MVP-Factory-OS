-- D-150 보안 SQL(0016) 시험 — 로컬 시험 DB(axqa)에서만. scripts/db-local/run.sh 가 부른다.
\set QUIET 1
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated; grant all on all sequences in schema public to authenticated;
\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set V '''bbbbbbbb-0000-0000-0000-000000000002'''
\set M '''cccccccc-0000-0000-0000-000000000003'''
\set C '''dddddddd-0000-0000-0000-000000000004'''
insert into auth.users (id, email) values (:A,'a@x.kr'),(:V,'v@x.kr'),(:M,'m@x.kr'),(:C,'c@x.kr');
insert into public.profiles (id) values (:A),(:V),(:M),(:C) on conflict do nothing;

create schema if not exists qa;
create or replace function qa.ok(label text, q text) returns void language plpgsql as $$
begin execute q; raise notice 'PASS  % (허용됨)', label;
exception when others then raise notice 'FAIL  % — 허용돼야 하는데 막힘: %', label, sqlerrm; end $$;
create or replace function qa.no(label text, q text) returns void language plpgsql as $$
begin execute q; raise notice 'FAIL  % — 막혀야 하는데 통과', label;
exception when others then raise notice 'PASS  % (막힘: %)', label, sqlerrm; end $$;
create or replace function qa.eq(label text, got text, want text) returns void language plpgsql as $$
begin if got is not distinct from want then raise notice 'PASS  % = %', label, got; else raise notice 'FAIL  % = % (기대 %)', label, got, want; end if; end $$;
grant usage on schema qa to authenticated; grant execute on all functions in schema qa to authenticated;

-- 1. 워크스페이스 만들기는 그대로 된다
select set_config('request.jwt.claim.sub', :A, false); set role authenticated;
select qa.ok('A 워크스페이스 만들기', $q$select public.create_workspace('WA')$q$);
reset role;
select set_config('request.jwt.claim.sub', :V, false); set role authenticated;
select qa.ok('V 워크스페이스 만들기', $q$select public.create_workspace('WV')$q$);
select qa.ok('V 워크스페이스 하나 더', $q$select public.create_workspace('WV2')$q$);
reset role;
select id as wa from public.workspaces where name='WA' \gset
select id as wv from public.workspaces where name='WV' \gset
select id as wv2 from public.workspaces where name='WV2' \gset

-- 2. 멤버 권한
select set_config('request.jwt.claim.sub', :V, false); set role authenticated;
select qa.ok('주인 V 가 M 을 관리자로', format($q$insert into public.workspace_members (workspace_id,user_id,role) values (%L,%L,'admin')$q$, :'wv', :M));
select qa.ok('주인 V 가 M 을 WV2 관리자로', format($q$insert into public.workspace_members (workspace_id,user_id,role) values (%L,%L,'admin')$q$, :'wv2', :M));
reset role;
select set_config('request.jwt.claim.sub', :M, false); set role authenticated;
select qa.no('관리자 M 이 자기를 소유자로', format($q$update public.workspace_members set role='owner' where workspace_id=%L and user_id=%L$q$, :'wv', :M));
select qa.no('관리자 M 이 A 를 소유자로 넣기', format($q$insert into public.workspace_members (workspace_id,user_id,role) values (%L,%L,'owner')$q$, :'wv', :A));
select qa.no('관리자 M 이 주인 V 를 관리자로 낮추기', format($q$update public.workspace_members set role='admin' where workspace_id=%L and user_id=%L$q$, :'wv', :V));
select qa.no('관리자 M 이 주인 V 를 내보내기', format($q$delete from public.workspace_members where workspace_id=%L and user_id=%L$q$, :'wv', :V));
select qa.ok('관리자 M 이 A 를 멤버로 넣기', format($q$insert into public.workspace_members (workspace_id,user_id,role) values (%L,%L,'editor')$q$, :'wv', :A));
select qa.ok('관리자 M 이 A 를 내보내기', format($q$delete from public.workspace_members where workspace_id=%L and user_id=%L$q$, :'wv', :A));
reset role;
select set_config('request.jwt.claim.sub', :V, false); set role authenticated;
select qa.ok('주인 V 가 M 을 소유자로', format($q$update public.workspace_members set role='owner' where workspace_id=%L and user_id=%L$q$, :'wv', :M));
reset role;
select set_config('request.jwt.claim.sub', :M, false); set role authenticated;
select qa.no('소유자 M 도 워크스페이스 주인 V 는 못 낮춤', format($q$update public.workspace_members set role='admin' where workspace_id=%L and user_id=%L$q$, :'wv', :V));
reset role;
select set_config('request.jwt.claim.sub', :V, false); set role authenticated;
select qa.ok('주인 V 가 M 을 다시 관리자로', format($q$update public.workspace_members set role='admin' where workspace_id=%L and user_id=%L$q$, :'wv', :M));
reset role;
select set_config('request.jwt.claim.sub', :M, false); set role authenticated;
select qa.ok('관리자 M 이 스스로 나가기(WV2)', format($q$delete from public.workspace_members where workspace_id=%L and user_id=%L$q$, :'wv2', :M));
reset role;

-- 3. 초대 받기 — 소유자는 그대로
insert into public.workspace_invites (workspace_id, email, role, token_hash, expires_at)
values (:'wv', 'v@x.kr', 'editor', encode(extensions.digest('tok-v','sha256'),'hex'), now() + interval '1 day'),
       (:'wv', 'c@x.kr', 'editor', encode(extensions.digest('tok-c','sha256'),'hex'), now() + interval '1 day');
select set_config('request.jwt.claim.sub', :V, false); set role authenticated;
select qa.ok('주인 V 가 멤버 초대 받기', $q$select public.accept_workspace_invite('tok-v')$q$);
reset role;
select qa.eq('초대 받은 뒤 V 권한', (select role::text from public.workspace_members where workspace_id=:'wv' and user_id=:V), 'owner');
select set_config('request.jwt.claim.sub', :C, false); set role authenticated;
select qa.ok('새 사람 C 가 멤버 초대 받기', $q$select public.accept_workspace_invite('tok-c')$q$);
reset role;
select qa.eq('C 권한', (select role::text from public.workspace_members where workspace_id=:'wv' and user_id=:C), 'editor');
delete from public.workspace_members where workspace_id=:'wv' and user_id=:C;

-- 4. portal 표 — 같은 워크스페이스만
select set_config('request.jwt.claim.sub', :V, false); set role authenticated;
select qa.ok('V 업체 만들기', format($q$insert into public.operations_clients (id,workspace_id,company_name) values ('11111111-0000-0000-0000-00000000000f',%L,'피해 업체')$q$, :'wv'));
select qa.ok('V 고객 연결 만들기', format($q$insert into public.portal_client_links (id,workspace_id,operations_client_id,profile_id) values ('22222222-0000-0000-0000-00000000000f',%L,'11111111-0000-0000-0000-00000000000f',%L)$q$, :'wv', :C));
select qa.ok('V 서류(자기 폴더)', format($q$insert into public.portal_documents (workspace_id,portal_client_link_id,operations_client_id,document_type,title,storage_path,visibility) values (%L,'22222222-0000-0000-0000-00000000000f','11111111-0000-0000-0000-00000000000f','etc','계약서',%L,'shared_with_customer')$q$, :'wv', :'wv' || '/clients/x/secret.pdf'));
reset role;
select set_config('request.jwt.claim.sub', :A, false); set role authenticated;
select qa.ok('A 업체 만들기', format($q$insert into public.operations_clients (id,workspace_id,company_name) values ('11111111-0000-0000-0000-00000000000a',%L,'공격자 업체')$q$, :'wa'));
select qa.no('A 가 V 업체로 고객 연결', format($q$insert into public.portal_client_links (workspace_id,operations_client_id,profile_id) values (%L,'11111111-0000-0000-0000-00000000000f',%L)$q$, :'wa', :A));
select qa.ok('A 자기 고객 연결(자기 계정)', format($q$insert into public.portal_client_links (id,workspace_id,operations_client_id,profile_id) values ('22222222-0000-0000-0000-00000000000a',%L,'11111111-0000-0000-0000-00000000000a',%L)$q$, :'wa', :A));
select qa.no('A 가 V 고객 연결에 소식', format($q$insert into public.portal_updates (workspace_id,portal_client_link_id,title) values (%L,'22222222-0000-0000-0000-00000000000f','가짜 소식')$q$, :'wa'));
select qa.no('A 가 V 고객 연결에 요청', format($q$insert into public.portal_requests (workspace_id,portal_client_link_id,title) values (%L,'22222222-0000-0000-0000-00000000000f','가짜 요청')$q$, :'wa'));
select qa.no('A 서류 줄에 V 폴더 경로', format($q$insert into public.portal_documents (workspace_id,portal_client_link_id,operations_client_id,document_type,title,storage_path,visibility) values (%L,'22222222-0000-0000-0000-00000000000a','11111111-0000-0000-0000-00000000000a','etc','훔치기',%L,'shared_with_customer')$q$, :'wa', :'wv' || '/clients/x/secret.pdf'));
select qa.no('A 서류 줄에 V 업체', format($q$insert into public.portal_documents (workspace_id,portal_client_link_id,operations_client_id,document_type,title) values (%L,'22222222-0000-0000-0000-00000000000a','11111111-0000-0000-0000-00000000000f','etc','x')$q$, :'wa'));
select qa.ok('A 자기 소식', format($q$insert into public.portal_updates (workspace_id,portal_client_link_id,title) values (%L,'22222222-0000-0000-0000-00000000000a','소식')$q$, :'wa'));
select qa.ok('A 자기 서류(자기 폴더)', format($q$insert into public.portal_documents (workspace_id,portal_client_link_id,operations_client_id,document_type,title,storage_path,visibility) values (%L,'22222222-0000-0000-0000-00000000000a','11111111-0000-0000-0000-00000000000a','etc','ok',%L,'shared_with_customer')$q$, :'wa', :'wa' || '/clients/a/ok.pdf'));
select qa.ok('A 서류(경로 없음)', format($q$insert into public.portal_documents (workspace_id,portal_client_link_id,operations_client_id,document_type,title) values (%L,'22222222-0000-0000-0000-00000000000a','11111111-0000-0000-0000-00000000000a','etc','no path')$q$, :'wa'));
select qa.ok('A 서류(demo 경로)', format($q$insert into public.portal_documents (workspace_id,portal_client_link_id,operations_client_id,document_type,title,storage_path) values (%L,'22222222-0000-0000-0000-00000000000a','11111111-0000-0000-0000-00000000000a','etc','demo','demo/sample.pdf')$q$, :'wa'));
select qa.no('A 가 자기 서류 경로를 V 폴더로 고치기', format($q$update public.portal_documents set storage_path=%L where title='ok'$q$, :'wv' || '/clients/x/secret.pdf'));
reset role;

-- 5. 보관함 공유 — 예전에 들어간 나쁜 줄이 있어도 남의 폴더는 안 열린다
set session_replication_role = replica;  -- 트리거를 건너뛰어 '예전에 들어간 줄' 을 흉내
insert into public.portal_documents (workspace_id,portal_client_link_id,operations_client_id,document_type,title,storage_path,visibility)
values (:'wa','22222222-0000-0000-0000-00000000000a','11111111-0000-0000-0000-00000000000a','etc','legacy bad', :'wv' || '/clients/x/secret.pdf','shared_with_customer');
set session_replication_role = origin;
select set_config('request.jwt.claim.sub', :A, false); set role authenticated;
select qa.eq('A 가 V 파일 열기', public.portal_storage_shared(:'wv' || '/clients/x/secret.pdf')::text, 'false');
select qa.eq('A 가 자기 공유 파일 열기', public.portal_storage_shared(:'wa' || '/clients/a/ok.pdf')::text, 'true');
reset role;
select set_config('request.jwt.claim.sub', :C, false); set role authenticated;
select qa.eq('고객 C 가 공유받은 V 파일 열기', public.portal_storage_shared(:'wv' || '/clients/x/secret.pdf')::text, 'true');
reset role;

-- 6. 워크스페이스 지우기(멤버 줄이 따라 지워짐)는 막지 않는다
select set_config('request.jwt.claim.sub', :V, false);
select qa.ok('V 가 WV2 지우기', format($q$delete from public.workspaces where id=%L$q$, :'wv2'));
select set_config('request.jwt.claim.sub', '', false);
