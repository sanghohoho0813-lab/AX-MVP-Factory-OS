-- 실제 왕복을 shadow DB 에서 돌리면서, 각 단계에서 앱이 실제로 받게 될 JSON 을 뽑는다.
-- 출력: 단 한 줄의 JSON (Playwright 가 그대로 mock 응답으로 쓴다)
begin;

create temp table gfx (k text primary key, v uuid);
grant select, update on gfx to anon, authenticated;
insert into gfx values ('owner', gen_random_uuid()), ('cust', gen_random_uuid()),
                       ('ws', gen_random_uuid()), ('link', null);

create or replace function pg_temp.make_user(u uuid, mail text) returns void language plpgsql as $$
declare cols text := 'id, email'; vals text := quote_literal(u::text) || '::uuid, ' || quote_literal(mail);
begin
  begin execute 'set local session_replication_role = replica'; exception when others then null; end;
  insert into auth.users (id, email) values (u, mail) on conflict (id) do nothing;
  begin execute 'set local session_replication_role = origin'; exception when others then null; end;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='name') then
    cols := cols || ', name'; vals := vals || ', ' || quote_literal(split_part(mail,'@',1)); end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='display_name') then
    cols := cols || ', display_name'; vals := vals || ', ' || quote_literal(split_part(mail,'@',1)); end if;
  execute format('insert into public.profiles (%s) values (%s) on conflict (id) do update set email = excluded.email', cols, vals);
end $$;
select pg_temp.make_user(v, case k when 'cust' then 'portal-test@miraeailab.com' else 'owner-test@miraeailab.com' end) from gfx where k in ('owner','cust');

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claim.sub','',true); end $$;

insert into public.workspaces (id, name, owner_id) values ((select v from gfx where k='ws'), '미래AI랩', (select v from gfx where k='owner'));
insert into public.workspace_members (workspace_id, user_id, role) values ((select v from gfx where k='ws'), (select v from gfx where k='owner'), 'owner');
insert into public.operations_clients (id, workspace_id, company_name, payload)
values ('cli_e2e', (select v from gfx where k='ws'), '한빛정밀',
        '{"fees":[{"amount":7700000,"label":"착수금"}],"notes":"내부 메모 — 수임료 협상 중, 고객 노출 금지"}'::jsonb);

-- 내부: 연결 + 서류 요청 + 조치 필요 업데이트
select pg_temp.as_user((select v from gfx where k='owner'));
insert into public.portal_client_links (workspace_id, operations_client_id, profile_id, display_name, consultant_name)
values ((select v from gfx where k='ws'), 'cli_e2e', (select v from gfx where k='cust'), '한빛정밀 벤처인증', '김팀장');
select pg_temp.as_admin();
update gfx set v = (select id from public.portal_client_links where operations_client_id='cli_e2e') where k='link';

select pg_temp.as_user((select v from gfx where k='owner'));
insert into public.portal_documents (workspace_id, portal_client_link_id, operations_client_id, document_type, title, status, customer_note, internal_note, requested_at)
values ((select v from gfx where k='ws'), (select v from gfx where k='link'), 'cli_e2e', 'businessRegistration', '사업자등록증', 'requested', '3개월 이내 발급본으로 부탁드립니다', '내부: 지난번 것은 만료됨', now());
insert into public.portal_updates (workspace_id, portal_client_link_id, category, title, body, status, customer_action_required, customer_action_label, published_at, published_by)
values ((select v from gfx where k='ws'), (select v from gfx where k='link'), 'document_request', '사업자등록증을 올려 주세요', '벤처인증 접수에 필요합니다.', 'published', true, '올렸어요', now(), auth.uid());
insert into public.portal_updates (workspace_id, portal_client_link_id, category, title, body, status)
values ((select v from gfx where k='ws'), (select v from gfx where k='link'), 'progress', '초안 — 고객에게 보이면 안 됨', '내부 검토 중입니다', 'draft');
select pg_temp.as_admin();

-- STAGE 1: 고객이 처음 들어왔을 때
create temp table out1 (k text primary key, j jsonb);
grant all on out1 to authenticated;
select pg_temp.as_user((select v from gfx where k='cust'));
insert into out1 values ('stage1_projects', (select jsonb_agg(to_jsonb(p)) from public.portal_my_projects() p));
insert into out1 values ('stage1_project', public.portal_project((select v from gfx where k='link')));

-- 고객 행동을 한 단계씩 진행하며 그때마다 실제 응답을 뽑는다.
-- (한 번에 몰아서 뽑으면 "고객이 아직 올리지 않았는데 이미 올라간" 상태가 되어
--  UI 테스트가 실제 사용 순서를 재현하지 못한다.)
do $$
declare v_link uuid := (select v from gfx where k='link'); v_upd uuid;
begin
  select (public.portal_project(v_link)->'updates'->0->>'id')::uuid into v_upd;
  perform public.portal_complete_action(v_upd);
end $$;
insert into out1 values ('after_action_projects', (select jsonb_agg(to_jsonb(p)) from public.portal_my_projects() p));
insert into out1 values ('after_action_project', public.portal_project((select v from gfx where k='link')));

do $$
begin
  perform public.portal_create_request((select v from gfx where k='link'), 'status', '진행 상황이 궁금합니다', '접수까지 얼마나 걸릴까요?');
end $$;
insert into out1 values ('after_request_projects', (select jsonb_agg(to_jsonb(p)) from public.portal_my_projects() p));
insert into out1 values ('after_request_project', public.portal_project((select v from gfx where k='link')));

do $$
declare v_link uuid := (select v from gfx where k='link'); v_doc uuid; v_path text;
begin
  select (public.portal_project(v_link)->'documents'->0->>'id')::uuid into v_doc;
  select public.portal_upload_path(v_link, '사업자등록증.pdf') into v_path;
  perform public.portal_register_document(v_link, v_doc, 'businessRegistration', '사업자등록증', v_path, '사업자등록증.pdf', 84213, 'application/pdf', null);
end $$;

insert into out1 values ('stage2_projects', (select jsonb_agg(to_jsonb(p)) from public.portal_my_projects() p));
insert into out1 values ('stage2_project', public.portal_project((select v from gfx where k='link')));
select pg_temp.as_admin();

-- STAGE 3: 내부 이벤트함이 보는 것
select pg_temp.as_user((select v from gfx where k='owner'));
insert into out1 values ('inbox_events', (
  select jsonb_agg(to_jsonb(e) order by e.occurred_at desc) from public.customer_events e));

-- 내부가 업데이트를 발행한다
insert into public.portal_updates (workspace_id, portal_client_link_id, category, title, body, status, published_at, published_by)
values ((select v from gfx where k='ws'), (select v from gfx where k='link'), 'progress', '서류 확인했습니다 — 다음 주 접수합니다',
        '보내주신 사업자등록증 확인했습니다. 다음 주 화요일에 접수하겠습니다.', 'published', now(), auth.uid());
insert into out1 values ('preview_after_publish', public.portal_preview_project((select v from gfx where k='link')));
select pg_temp.as_admin();

-- STAGE 4: 고객이 발행된 업데이트를 본다
select pg_temp.as_user((select v from gfx where k='cust'));
insert into out1 values ('stage3_projects', (select jsonb_agg(to_jsonb(p)) from public.portal_my_projects() p));
insert into out1 values ('stage3_project', public.portal_project((select v from gfx where k='link')));
select pg_temp.as_admin();

select jsonb_pretty(jsonb_object_agg(k, j) || jsonb_build_object(
  'link_id', (select v from gfx where k='link'),
  'workspace_id', (select v from gfx where k='ws'),
  'customer_id', (select v from gfx where k='cust')
)) from out1;

rollback;
