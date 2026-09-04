-- =====================================================================
-- Bridge Hardening · 권한 감사 + 왕복 회귀 테스트 (순수 SQL)
-- ---------------------------------------------------------------------
-- 실행: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/bridge_hardening.sql
--       (마이그레이션 …0006, …0007 이 모두 적용된 DB.
--        트랜잭션 안에서 돌고 마지막에 ROLLBACK 하므로 데이터가 남지 않는다.)
--
-- 검증 내용
--   H1. 트리거 전용 함수에 anon/authenticated EXECUTE 가 남아 있지 않다
--   H2. 내부 헬퍼 portal_link_owned 에 anon/authenticated EXECUTE 가 없다
--   H3. 고객·내부 앱이 실제로 호출하는 RPC 권한은 그대로 살아 있다
--   H4. bridge_*/portal_* 전 함수의 search_path 가 고정돼 있다
--   H5. 권한을 회수해도 트리거는 계속 발화한다  ← 하드닝의 최대 리스크
--   H6. authenticated/anon 은 트리거 함수를 직접 호출할 수 없다
--   R1. 왕복 ① 고객 요청·서류 → 내부 이벤트함에 뜬다
--   R2. 왕복 ② 내부 발행 업데이트 → 고객 My MIRAE 투영에 보인다 (초안은 안 보인다)
-- =====================================================================
begin;

-- ---------- 픽스처 ----------
create temp table hfx (k text primary key, v uuid);
grant select, update on hfx to anon, authenticated;
insert into hfx values
  ('owner', gen_random_uuid()), ('cust', gen_random_uuid()),
  ('ws', gen_random_uuid()), ('link', null);

create or replace function pg_temp.make_user(u uuid, mail text) returns void language plpgsql as $$
declare cols text := 'id, email'; vals text := quote_literal(u::text) || '::uuid, ' || quote_literal(mail);
begin
  begin execute 'set local session_replication_role = replica'; exception when others then null; end;
  insert into auth.users (id, email) values (u, mail) on conflict (id) do nothing;
  begin execute 'set local session_replication_role = origin'; exception when others then null; end;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='name') then
    cols := cols || ', name'; vals := vals || ', ' || quote_literal(split_part(mail, '@', 1));
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='display_name') then
    cols := cols || ', display_name'; vals := vals || ', ' || quote_literal(split_part(mail, '@', 1));
  end if;
  execute format('insert into public.profiles (%s) values (%s) on conflict (id) do update set email = excluded.email', cols, vals);
end $$;
select pg_temp.make_user(v, 'hard_' || k || '@example.com') from hfx where k in ('owner','cust');

insert into public.workspaces (id, name, owner_id)
values ((select v from hfx where k='ws'), 'HARDEN WS', (select v from hfx where k='owner'));
insert into public.workspace_members (workspace_id, user_id, role)
values ((select v from hfx where k='ws'), (select v from hfx where k='owner'), 'owner');
insert into public.operations_clients (id, workspace_id, company_name, payload)
values ('cli_h', (select v from hfx where k='ws'), '하드닝테스트상사',
        '{"fees":[{"amount":7700000,"label":"착수금"}],"notes":"내부 메모 — 절대 고객에게 보이면 안 됨"}'::jsonb);

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end $$;
create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- =====================================================================
-- H1 · 트리거 전용 함수에 실행 권한이 남아 있지 않다
-- =====================================================================
do $$
declare fn text; leaked text := '';
  trigger_fns text[] := array[
    'public.bridge_touch_updated_at()', 'public.bridge_on_diagnosis_lead()',
    'public.bridge_on_service_order()', 'public.bridge_on_consult_lead()',
    'public.bridge_on_portal_request()', 'public.bridge_on_portal_document()',
    'public.bridge_on_portal_update_completed()', 'public.bridge_emit_customer_event(text,text,text,jsonb,text,uuid,uuid,timestamptz)'];
begin
  foreach fn in array trigger_fns loop
    if to_regprocedure(fn) is not null then
      if has_function_privilege('anon', to_regprocedure(fn)::oid, 'execute')
         or has_function_privilege('authenticated', to_regprocedure(fn)::oid, 'execute') then
        leaked := leaked || fn || ' ';
      end if;
    end if;
  end loop;
  assert leaked = '', 'H1 트리거 전용 함수에 실행 권한이 남아 있다: ' || leaked;
end $$;

-- =====================================================================
-- H2 · 내부 전용 헬퍼는 닫혀 있다
-- =====================================================================
do $$
begin
  assert not has_function_privilege('authenticated', to_regprocedure('public.portal_link_owned(uuid)')::oid, 'execute'),
         'H2 portal_link_owned 는 authenticated 에게 열려 있으면 안 된다';
  assert not has_function_privilege('anon', to_regprocedure('public.portal_project_projection(uuid)')::oid, 'execute'),
         'H2 portal_project_projection 은 anon 에게 닫혀 있어야 한다';
  assert not has_function_privilege('authenticated', to_regprocedure('public.portal_project_projection(uuid)')::oid, 'execute'),
         'H2 portal_project_projection 은 authenticated 에게도 닫혀 있어야 한다';
  assert not has_function_privilege('authenticated', to_regprocedure('public.default_intake_workspace()')::oid, 'execute'),
         'H2 default_intake_workspace 는 닫혀 있어야 한다';
end $$;

-- =====================================================================
-- H3 · 앱이 실제로 쓰는 RPC 권한은 살아 있어야 한다 (과도한 하드닝 방지)
-- =====================================================================
do $$
declare fn text; missing text := '';
  app_fns text[] := array[
    'public.portal_my_projects()', 'public.portal_project(uuid)',
    'public.portal_create_request(uuid,text,text,text)', 'public.portal_upload_path(uuid,text)',
    'public.portal_register_document(uuid,uuid,text,text,text,text,bigint,text,text)',
    'public.portal_complete_action(uuid)', 'public.portal_preview_project(uuid)',
    'public.portal_storage_path_allowed(text)', 'public.portal_storage_shared(text)'];
begin
  foreach fn in array app_fns loop
    if to_regprocedure(fn) is null then
      missing := missing || fn || '(없음) ';
    elsif not has_function_privilege('authenticated', to_regprocedure(fn)::oid, 'execute') then
      missing := missing || fn || ' ';
    end if;
  end loop;
  assert missing = '', 'H3 앱이 호출하는 RPC 권한이 사라졌다: ' || missing;
  -- 고객 RPC 는 anon 에게는 열리면 안 된다
  assert not has_function_privilege('anon', to_regprocedure('public.portal_my_projects()')::oid, 'execute'),
         'H3 portal_my_projects 가 anon 에게 열려 있다';
end $$;

-- =====================================================================
-- H4 · search_path 고정 (Advisor: function_search_path_mutable)
-- =====================================================================
do $$
declare mutable text;
begin
  select coalesce(string_agg(p.proname, ', '), '') into mutable
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (p.proname like 'bridge%' or p.proname like 'portal%')
     and (p.proconfig is null or not (p.proconfig::text like '%search_path%'));
  assert mutable = '', 'H4 search_path 가 고정되지 않은 함수: ' || mutable;
end $$;

-- =====================================================================
-- H5 · 권한을 회수해도 트리거는 계속 발화한다  ← 하드닝 최대 리스크
-- =====================================================================
select pg_temp.as_user((select v from hfx where k='owner'));
insert into public.portal_client_links (workspace_id, operations_client_id, profile_id, display_name, consultant_name)
values ((select v from hfx where k='ws'), 'cli_h', (select v from hfx where k='cust'), '하드닝테스트 프로젝트', '김팀장');
select pg_temp.as_admin();
update hfx set v = (select id from public.portal_client_links where operations_client_id='cli_h') where k='link';

select pg_temp.as_user((select v from hfx where k='owner'));
do $$
declare n int; t_before timestamptz; t_after timestamptz; v_doc uuid;
begin
  -- bridge_on_portal_document 가 발화해야 한다 (authenticated 에게 EXECUTE 없음에도)
  insert into public.portal_documents (workspace_id, portal_client_link_id, operations_client_id, document_type, title, status, source, visibility, storage_path, file_name, internal_note)
  values ((select v from hfx where k='ws'), (select v from hfx where k='link'), 'cli_h', 'other', '고객이 올린 파일', 'uploaded', 'customer', 'customer_uploaded',
          (select v::text from hfx where k='ws') || '/portal/' || (select v::text from hfx where k='link') || '/h.pdf', 'h.pdf', '내부 메모 — 노출 금지')
  returning id into v_doc;

  select count(*) into n from public.customer_events
   where event_type = 'document_uploaded' and portal_client_link_id = (select v from hfx where k='link');
  assert n = 1, 'H5 EXECUTE 회수 후에도 서류 트리거가 발화해야 한다 (실제 ' || n || ')';

  -- bridge_touch_updated_at 도 발화해야 한다.
  -- now() 는 트랜잭션 시작 시각으로 고정이므로 "시간이 흐르는지"로는 관측할 수 없다.
  -- updated_at 을 과거로 밀어 둔 뒤, UPDATE 때 트리거가 now() 로 되돌리는지를 본다.
  update public.portal_documents set updated_at = timestamptz '2000-01-01' where id = v_doc;
  select updated_at into t_before from public.portal_documents where id = v_doc;
  update public.portal_documents set title = '고객이 올린 파일(수정)' where id = v_doc;
  select updated_at into t_after from public.portal_documents where id = v_doc;
  assert t_before = timestamptz '2000-01-01' or t_before = now(),
         'H5 사전조건: updated_at 을 과거로 밀 수 있어야 한다';
  assert t_after = now(), 'H5 updated_at 트리거가 발화해 now() 로 갱신해야 한다 (실제 ' || t_after || ')';
end $$;

-- =====================================================================
-- H6 · 트리거 함수를 직접 호출할 수 없다
-- =====================================================================
do $$
declare denied boolean := false;
begin
  begin
    perform public.bridge_on_portal_document();
  exception when others then denied := true; end;
  assert denied, 'H6 authenticated 가 트리거 함수를 직접 호출할 수 있으면 안 된다';

  denied := false;
  begin
    perform public.portal_link_owned((select v from hfx where k='link'));
  exception when insufficient_privilege then denied := true; end;
  assert denied, 'H6 authenticated 가 portal_link_owned 를 직접 호출할 수 있으면 안 된다';
end $$;
select pg_temp.as_admin();

select pg_temp.as_anon();
do $$
declare denied boolean := false;
begin
  begin
    perform public.bridge_on_portal_request();
  exception when others then denied := true; end;
  assert denied, 'H6 anon 이 트리거 함수를 직접 호출할 수 있으면 안 된다';
end $$;
select pg_temp.as_admin();

-- =====================================================================
-- R1 · 왕복 ① 고객 요청·서류 → 내부 이벤트함
-- =====================================================================
-- 고객이 요청을 보내고 서류를 올린다
select pg_temp.as_user((select v from hfx where k='cust'));
do $$
declare v_link uuid := (select v from hfx where k='link'); v_ws uuid := (select v from hfx where k='ws');
        v_req uuid; v_reqdoc uuid; v_path text;
begin
  -- 내부 멤버가 요청해 둔 서류가 아직 없으므로, 고객이 자발적으로 올리는 경로를 쓴다
  select public.portal_create_request(v_link, 'status', '진행 상황 문의', '지금 어디까지 진행됐나요?') into v_req;
  assert v_req is not null, 'R1 고객이 요청을 만들 수 있어야 한다';

  select public.portal_upload_path(v_link, '사업자등록증.pdf') into v_path;
  assert position(v_ws::text || '/portal/' || v_link::text || '/' in v_path) = 1, 'R1 업로드 경로 접두 규칙';
  select public.portal_register_document(v_link, null, 'businessRegistration', '사업자등록증', v_path, 'biz.pdf', 2048, 'application/pdf', null) into v_reqdoc;
  assert v_reqdoc is not null, 'R1 고객이 서류를 등록할 수 있어야 한다';
end $$;
select pg_temp.as_admin();

-- 내부 멤버가 이벤트함에서 본다  ← 대표님이 화면에서 확인할 ①
select pg_temp.as_user((select v from hfx where k='owner'));
do $$
declare n_req int; n_doc int; n_bad int; sample text;
begin
  select count(*) into n_req from public.customer_events
   where event_type = 'customer_request_created' and portal_client_link_id = (select v from hfx where k='link');
  assert n_req = 1, 'R1① 고객 요청이 내부 이벤트함에 떠야 한다 (실제 ' || n_req || ')';

  select count(*) into n_doc from public.customer_events
   where event_type = 'document_uploaded' and portal_client_link_id = (select v from hfx where k='link');
  assert n_doc >= 1, 'R1① 고객 서류 업로드가 내부 이벤트함에 떠야 한다 (실제 ' || n_doc || ')';

  -- 이벤트는 연결된 상태여야 담당자가 바로 업체로 갈 수 있다
  select string_agg(distinct status, ',') into sample from public.customer_events
   where portal_client_link_id = (select v from hfx where k='link');
  assert sample = 'linked', 'R1① 고객 행동 이벤트는 linked 상태여야 한다 (실제 ' || sample || ')';

  -- 연결된 이벤트는 고객사 id 를 들고 있어야 한다.
  -- 비어 있으면 이벤트함이 "아직 고객사와 연결되지 않음" 으로 보여 담당자가
  -- "새 고객사로 만들기" 를 누르게 되고 고객사가 중복 생성된다. (…0008 에서 수정)
  select count(*) into n_bad from public.customer_events
   where portal_client_link_id is not null and operations_client_id is null;
  assert n_bad = 0, 'R1① 연결된 이벤트에 operations_client_id 가 비어 있다 (' || n_bad || '건)';

  select count(*) into n_bad from public.customer_events
   where portal_client_link_id = (select v from hfx where k='link')
     and operations_client_id is distinct from 'cli_h';
  assert n_bad = 0, 'R1① 이벤트의 고객사 id 가 연결의 고객사와 달라서는 안 된다 (' || n_bad || '건)';
end $$;

-- =====================================================================
-- R2 · 왕복 ② 내부 발행 업데이트 → 고객 My MIRAE
-- =====================================================================
-- 내부에서 하나는 발행, 하나는 초안으로 둔다
insert into public.portal_updates (workspace_id, portal_client_link_id, category, title, body, status, customer_action_required, customer_action_label, published_at, published_by)
values ((select v from hfx where k='ws'), (select v from hfx where k='link'), 'progress', '1차 서류 검토를 마쳤습니다', '다음 주에 접수 예정입니다', 'published', true, '확인했어요', now(), auth.uid());
insert into public.portal_updates (workspace_id, portal_client_link_id, category, title, body, status)
values ((select v from hfx where k='ws'), (select v from hfx where k='link'), 'progress', '초안 — 고객에게 보이면 안 됨', '내부 검토 중', 'draft');
select pg_temp.as_admin();

-- 고객이 자기 화면에서 본다  ← 대표님이 화면에서 확인할 ②
select pg_temp.as_user((select v from hfx where k='cust'));
do $$
declare proj jsonb; txt text; n int;
begin
  select public.portal_project((select v from hfx where k='link')) into proj;
  txt := proj::text;

  assert jsonb_array_length(proj->'updates') = 1, 'R2② 발행된 업데이트 1건만 보여야 한다 (실제 ' || jsonb_array_length(proj->'updates') || ')';
  assert (proj->'updates'->0->>'title') = '1차 서류 검토를 마쳤습니다', 'R2② 발행한 제목이 고객 화면에 보여야 한다';
  assert position('초안' in txt) = 0, 'R2② 초안은 고객에게 보이면 안 된다';

  -- 내부 정보가 함께 새지 않는지 (같은 왕복에서 반드시 확인)
  assert position('7700000' in txt) = 0, 'R2② 수임료가 새면 안 된다';
  assert position('내부 메모' in txt) = 0, 'R2② 내부 메모가 새면 안 된다';
  assert position('internal_note' in txt) = 0, 'R2② internal_note 키가 새면 안 된다';
  assert position('workspace_id' in txt) = 0, 'R2② 워크스페이스 id 가 새면 안 된다';
  assert position('operations_client_id' in txt) = 0, 'R2② 내부 고객 id 가 새면 안 된다';

  -- 목록 화면에서도 보인다
  select pending_actions into n from public.portal_my_projects();
  assert n = 1, 'R2② 해야 할 일 1건이 목록에 집계돼야 한다 (실제 ' || n || ')';
end $$;
select pg_temp.as_admin();

select 'BRIDGE HARDENING: ALL ASSERTIONS PASSED' as result;
rollback;
