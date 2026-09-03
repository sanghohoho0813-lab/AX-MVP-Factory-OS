-- =====================================================================
-- Customer ↔ Internal Bridge · 계약 테스트 (순수 SQL, pgTAP 불필요)
-- ---------------------------------------------------------------------
-- 실행: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/bridge_contract.sql
--       (마이그레이션이 모두 적용된 DB. 트랜잭션 안에서 돌고 마지막에 ROLLBACK 하므로 데이터가 남지 않는다.)
-- 검증:
--   1. 고객 행동(진단·주문·요청·서류·조치완료)이 customer_events 로 한 번만 들어온다 (dedupe)
--   2. 고객은 기본 테이블(연결·이벤트·일기·운영고객·수임료)을 한 줄도 읽지 못한다
--   3. 고객은 자기 프로젝트만 portal_* 함수로 보고, 남의 것은 not found
--   4. 투영에는 내부 전용 필드(internal_note, handling_note, payload, 수임료)가 없다
--   5. 스토리지 경로 계약 — 자기 링크 폴더만 쓰고, 공유된 파일만 읽는다
--   6. 워크스페이스 격리 — 다른 워크스페이스 멤버는 이벤트를 못 본다
--   7. anon 은 아무것도 못 한다
-- =====================================================================
begin;

-- ---------- 픽스처 ----------
create temp table fx (k text primary key, v uuid);
grant select, update on fx to anon, authenticated;
insert into fx values
  ('owner1', gen_random_uuid()), ('owner2', gen_random_uuid()),
  ('custA', gen_random_uuid()), ('custB', gen_random_uuid()),
  ('ws1', gen_random_uuid()), ('ws2', gen_random_uuid()),
  ('link1', null);

-- 계정 픽스처 — 환경마다 profiles 컬럼(name/display_name/role)이 달라 동적으로 넣는다.
-- auth.users 의 프로필 자동생성 트리거는 여기서는 방해만 되므로 가능하면 잠시 끈다(권한 없으면 그대로 진행).
create or replace function pg_temp.make_user(u uuid, mail text) returns void language plpgsql as $$
declare cols text := 'id, email'; vals text := quote_literal(u::text) || '::uuid, ' || quote_literal(mail);
begin
  begin
    execute 'set local session_replication_role = replica';
  exception when others then null; end;
  insert into auth.users (id, email) values (u, mail) on conflict (id) do nothing;
  begin
    execute 'set local session_replication_role = origin';
  exception when others then null; end;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='name') then
    cols := cols || ', name'; vals := vals || ', ' || quote_literal(split_part(mail, '@', 1));
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='display_name') then
    cols := cols || ', display_name'; vals := vals || ', ' || quote_literal(split_part(mail, '@', 1));
  end if;
  execute format('insert into public.profiles (%s) values (%s) on conflict (id) do update set email = excluded.email', cols, vals);
end $$;
select pg_temp.make_user(v, k || '@example.com') from fx where k in ('owner1','owner2','custA','custB');

insert into public.workspaces (id, name, owner_id) values
  ((select v from fx where k='ws1'), 'WS1', (select v from fx where k='owner1')),
  ((select v from fx where k='ws2'), 'WS2', (select v from fx where k='owner2'));
insert into public.workspace_members (workspace_id, user_id, role) values
  ((select v from fx where k='ws1'), (select v from fx where k='owner1'), 'owner'),
  ((select v from fx where k='ws2'), (select v from fx where k='owner2'), 'owner');

-- ws2 가 먼저 만들어졌더라도 라우팅 테이블이 우선한다
insert into public.customer_intake_routing (workspace_id, is_default) values ((select v from fx where k='ws1'), true);

insert into public.operations_clients (id, workspace_id, company_name, payload)
values ('cli_1', (select v from fx where k='ws1'), '한빛정밀',
        '{"fees":[{"amount":5000000,"label":"계약금"}],"notes":"내부 메모 — 수임료 협상 중"}'::jsonb);

-- 도우미: 역할 전환
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

-- ---------- 1. 라우팅 · 진단 리드 → 이벤트 · dedupe ----------
do $$
declare v_ws uuid; n int;
begin
  select public.default_intake_workspace() into v_ws;
  assert v_ws = (select v from fx where k='ws1'), '기본 유입 워크스페이스는 라우팅 테이블 값이어야 한다';

  insert into public.business_diagnosis_leads (id, company_name, representative_name, phone, email, industry, lead_grade)
  values ('11111111-1111-1111-1111-111111111111', '한빛정밀', '김대표', '010-1111-2222', 'custA@example.com', '제조업', 'A');

  select count(*) into n from public.customer_events where source_type='business_diagnosis_lead' and source_id='11111111-1111-1111-1111-111111111111';
  assert n = 1, '진단 리드 1건 → 이벤트 1건';
  assert (select priority from public.customer_events where source_id='11111111-1111-1111-1111-111111111111') = 'high', 'A등급은 high';
  assert (select profile_id from public.customer_events where source_id='11111111-1111-1111-1111-111111111111') = (select v from fx where k='custA'), '이메일로 계정을 찾아 붙인다';
  assert (select workspace_id from public.customer_events where source_id='11111111-1111-1111-1111-111111111111') = v_ws, '연결 전 이벤트는 유입 워크스페이스로';
  assert (select customer_safe_payload ? 'memo' from public.customer_events where source_id='11111111-1111-1111-1111-111111111111') = false, '리드의 내부 memo 는 payload 에 없다';

  -- 같은 소스로 다시 emit 해도 한 건
  perform public.bridge_emit_customer_event('diagnosis_completed','business_diagnosis_lead','11111111-1111-1111-1111-111111111111','{}'::jsonb,'high',null,null,now());
  select count(*) into n from public.customer_events where source_id='11111111-1111-1111-1111-111111111111';
  assert n = 1, 'dedupe: 같은 source 는 두 번 만들지 않는다';
end $$;

-- ---------- 2. 주문 → 이벤트 (결제 계정으로 연결) ----------
do $$
declare v_pay uuid := gen_random_uuid(); n int;
begin
  insert into public.product_payments (id, payment_id, merchant_order_id, product_slug, product_name, amount, user_id, status)
  values (v_pay, 'pay_1', 'MO-1', 'venture-certification', '벤처인증 컨설팅', 990000, (select v from fx where k='custA'), 'paid');
  insert into public.service_orders (payment_id, order_number, product_slug, company_name, buyer_name, buyer_email, internal_memo)
  values (v_pay, 'SO-1', 'venture-certification', '한빛정밀', '김대표', 'custA@example.com', '내부 메모: 할인 적용');
  select count(*) into n from public.customer_events where event_type='service_order_created';
  assert n = 1, '주문 1건 → 이벤트 1건';
  assert (select customer_safe_payload ? 'internal_memo' from public.customer_events where event_type='service_order_created') = false, '주문의 internal_memo 는 payload 에 없다';
  assert (select profile_id from public.customer_events where event_type='service_order_created') = (select v from fx where k='custA'), '결제 계정으로 연결';
end $$;

-- ---------- 3. 내부 멤버가 연결을 만든다 ----------
select pg_temp.as_user((select v from fx where k='owner1'));
insert into public.portal_client_links (workspace_id, operations_client_id, profile_id, display_name, consultant_name)
values ((select v from fx where k='ws1'), 'cli_1', (select v from fx where k='custA'), '한빛정밀 벤처인증', '김팀장');
select pg_temp.as_admin();
update fx set v = (select id from public.portal_client_links where operations_client_id='cli_1') where k='link1';

-- 내부 멤버가 일기와 공개 업데이트, 서류 요청을 만든다
select pg_temp.as_user((select v from fx where k='owner1'));
insert into public.ops_journal_entries (workspace_id, owner_id, entry_type, content, client_id)
values ((select v from fx where k='ws1'), (select v from fx where k='owner1'), 'decision', '비밀 판단: 성공보수 10%', 'cli_1');
insert into public.portal_updates (workspace_id, portal_client_link_id, category, title, body, status, customer_action_required, customer_action_label, published_at, published_by)
values ((select v from fx where k='ws1'), (select v from fx where k='link1'), 'document_request', '사업자등록증을 올려 주세요', '최근 발급본', 'published', true, '서류 올리기', now(), auth.uid());
insert into public.portal_updates (workspace_id, portal_client_link_id, category, title, body, status)
values ((select v from fx where k='ws1'), (select v from fx where k='link1'), 'progress', '초안 (미공개)', '아직 고객에게 보이면 안 됨', 'draft');
insert into public.portal_documents (workspace_id, portal_client_link_id, operations_client_id, document_type, title, status, customer_note, internal_note, requested_at)
values ((select v from fx where k='ws1'), (select v from fx where k='link1'), 'cli_1', 'businessRegistration', '사업자등록증', 'requested', '3개월 이내 발급', '내부: 지난번 것은 만료', now());
insert into public.portal_documents (workspace_id, portal_client_link_id, operations_client_id, document_type, title, status, source, visibility, storage_path, file_name, internal_note)
values ((select v from fx where k='ws1'), (select v from fx where k='link1'), 'cli_1', 'result', '벤처인증 결과보고서', 'verified', 'internal', 'shared_with_customer',
        (select v::text from fx where k='ws1') || '/cli_1/report.pdf', 'report.pdf', '내부: 원본은 드라이브');
insert into public.portal_documents (workspace_id, portal_client_link_id, operations_client_id, document_type, title, status, source, visibility, storage_path, file_name)
values ((select v from fx where k='ws1'), (select v from fx where k='link1'), 'cli_1', 'internal', '내부 검토 메모', 'verified', 'internal', 'internal_only',
        (select v::text from fx where k='ws1') || '/cli_1/secret.pdf', 'secret.pdf');
select pg_temp.as_admin();

-- ---------- 4. 고객 A 는 기본 테이블을 한 줄도 못 읽는다 ----------
select pg_temp.as_user((select v from fx where k='custA'));
do $$
declare n int;
begin
  select count(*) into n from public.portal_client_links; assert n = 0, '고객은 portal_client_links 를 못 읽는다';
  select count(*) into n from public.customer_events;     assert n = 0, '고객은 customer_events 를 못 읽는다';
  select count(*) into n from public.ops_journal_entries; assert n = 0, '고객은 업무 일기를 못 읽는다';
  select count(*) into n from public.operations_clients;  assert n = 0, '고객은 operations_clients(수임료·메모 포함)를 못 읽는다';
  select count(*) into n from public.portal_updates;      assert n = 0, '고객은 portal_updates 기본 테이블을 못 읽는다';
  select count(*) into n from public.portal_documents;    assert n = 0, '고객은 portal_documents 기본 테이블을 못 읽는다';
end $$;

-- ---------- 5. 고객 A 는 자기 프로젝트만, 투영에 내부 필드 없음 ----------
do $$
declare n int; proj jsonb; txt text;
begin
  select count(*) into n from public.portal_my_projects(); assert n = 1, '고객 A 는 프로젝트 1개';
  assert (select name from public.portal_my_projects()) = '한빛정밀 벤처인증', 'display_name 우선';
  assert (select pending_actions from public.portal_my_projects()) = 1, '해야 할 조치 1건';
  assert (select requested_documents from public.portal_my_projects()) = 1, '요청받은 서류 1건';

  select public.portal_project((select v from fx where k='link1')) into proj;
  txt := proj::text;
  assert jsonb_array_length(proj->'updates') = 1, '공개된 업데이트만 보인다(초안 제외)';
  assert jsonb_array_length(proj->'documents') = 2, '요청받은 서류 + 공유된 서류만 (internal_only 제외)';
  assert position('internal_note' in txt) = 0, '투영에 internal_note 없음';
  assert position('internal_memo' in txt) = 0, '투영에 internal_memo 없음';
  assert position('secret.pdf' in txt) = 0, '내부 전용 파일은 투영에 없음';
  assert position('성공보수' in txt) = 0, '일기 내용이 투영에 없음';
  assert position('5000000' in txt) = 0, '수임료가 투영에 없음';
  assert position('workspace_id' in txt) = 0, '내부 워크스페이스 id 노출 없음';
  assert position('operations_client_id' in txt) = 0, '내부 고객 id 노출 없음';
  assert (proj->'documents'->0->>'status') = 'requested', '요청받은 서류가 먼저';
end $$;

-- 고객이 조치 완료 → 이벤트 (linked 상태로)
do $$
declare ok boolean; n int; v_upd uuid;
begin
  select (public.portal_project((select v from fx where k='link1'))->'updates'->0->>'id')::uuid into v_upd;
  select public.portal_complete_action(v_upd) into ok;
  assert ok, '조치 완료 표시';
  select count(*) into n from public.portal_my_projects() where pending_actions = 0; assert n = 1, '조치 후 대기 0';
end $$;

-- 고객이 요청을 만든다
do $$
declare v_req uuid; proj jsonb;
begin
  select public.portal_create_request((select v from fx where k='link1'), 'status', '진행 상황이 궁금합니다', '다음 단계는?') into v_req;
  select public.portal_project((select v from fx where k='link1')) into proj;
  assert jsonb_array_length(proj->'requests') = 1, '내 요청이 보인다';
end $$;

-- 고객이 서류를 올린다 — 경로 계약
do $$
declare v_doc uuid; v_link uuid := (select v from fx where k='link1'); v_ws uuid := (select v from fx where k='ws1'); r uuid; failed boolean := false;
begin
  select (public.portal_project(v_link)->'documents'->0->>'id')::uuid into v_doc;
  begin
    perform public.portal_register_document(v_link, v_doc, 'businessRegistration', '사업자등록증', 'somewhere/else.pdf', 'x.pdf');
  exception when others then failed := true; end;
  assert failed, '다른 경로로는 등록할 수 없다';
  -- 서버가 발급한 경로는 규칙을 만족하고 파일명이 정리된다
  assert position(v_ws::text || '/portal/' || v_link::text || '/' in public.portal_upload_path(v_link, '사업자 등록증(최신).pdf')) = 1, '업로드 경로 접두 규칙';
  assert public.portal_upload_path(v_link, '사업자 등록증(최신).pdf') like '%.pdf', '확장자 보존';
  assert public.portal_upload_path(v_link, 'a b.pdf') !~ ' ', '공백 등은 치환';
  select public.portal_register_document(v_link, v_doc, 'businessRegistration', '사업자등록증', v_ws::text || '/portal/' || v_link::text || '/biz.pdf', 'biz.pdf', 1234, 'application/pdf', null) into r;
  assert r = v_doc, '요청받은 서류를 채운다';
  assert (select public.portal_project(v_link)->'documents'->0->>'status') = 'uploaded', '업로드됨(검토완료 아님)';
  -- 스토리지 경로 함수
  assert public.portal_storage_path_allowed(v_ws::text || '/portal/' || v_link::text || '/biz.pdf'), '자기 폴더는 허용';
  assert not public.portal_storage_path_allowed(v_ws::text || '/cli_1/secret.pdf'), '내부 폴더는 불가';
  assert public.portal_storage_shared(v_ws::text || '/cli_1/report.pdf'), '공유된 파일은 읽기 허용';
  assert not public.portal_storage_shared(v_ws::text || '/cli_1/secret.pdf'), '내부 전용 파일은 불가';
end $$;
select pg_temp.as_admin();

-- 이벤트가 쌓였는지 (조치완료 · 요청 · 서류 업로드) — 모두 link1 에 연결되어 linked 상태
do $$
declare n int;
begin
  select count(*) into n from public.customer_events where portal_client_link_id = (select v from fx where k='link1') and status = 'linked'
    and event_type in ('customer_action_completed','customer_request_created','document_uploaded');
  assert n = 3, '고객 행동 3건이 연결된 이벤트로 들어왔다 (실제 ' || n || ')';
end $$;

-- ---------- 6. 고객 B 는 남의 것을 볼 수 없다 ----------
select pg_temp.as_user((select v from fx where k='custB'));
do $$
declare n int; failed boolean := false;
begin
  select count(*) into n from public.portal_my_projects(); assert n = 0, '고객 B 는 프로젝트 0';
  begin
    perform public.portal_project((select v from fx where k='link1'));
  exception when others then failed := true; end;
  assert failed, '남의 프로젝트는 not found';
  assert not public.portal_storage_path_allowed((select v::text from fx where k='ws1') || '/portal/' || (select v::text from fx where k='link1') || '/biz.pdf'), '남의 폴더 불가';
  assert not public.portal_storage_shared((select v::text from fx where k='ws1') || '/cli_1/report.pdf'), '남에게 공유된 파일 불가';
end $$;
select pg_temp.as_admin();

-- ---------- 7. 워크스페이스 격리 · 내부 멤버 ----------
select pg_temp.as_user((select v from fx where k='owner2'));
do $$
declare n int; failed boolean := false;
begin
  select count(*) into n from public.customer_events; assert n = 0, 'ws2 멤버는 ws1 이벤트를 못 본다';
  select count(*) into n from public.portal_client_links; assert n = 0, 'ws2 멤버는 ws1 연결을 못 본다';
  select count(*) into n from public.ops_journal_entries; assert n = 0, 'ws2 멤버는 ws1 일기를 못 본다';
  begin
    perform public.portal_preview_project((select v from fx where k='link1'));
  exception when others then failed := true; end;
  assert failed, 'ws2 멤버는 ws1 미리보기 불가';
end $$;
select pg_temp.as_admin();

create temp table px (who text primary key, proj jsonb);
grant all on px to anon, authenticated;
select pg_temp.as_user((select v from fx where k='custA'));
insert into px values ('customer', public.portal_project((select v from fx where k='link1')));
select pg_temp.as_admin();
select pg_temp.as_user((select v from fx where k='owner1'));
do $$
declare n int; proj jsonb;
begin
  select count(*) into n from public.customer_events; assert n >= 5, 'ws1 멤버는 이벤트를 본다 (' || n || ')';
  select count(*) into n from public.ops_journal_entries; assert n = 1, '본인 일기 1건';
  select public.portal_preview_project((select v from fx where k='link1')) into proj;
  assert proj = (select p.proj from px p where who='customer'), '내부 미리보기 = 고객이 실제로 보는 투영';
end $$;
select pg_temp.as_admin();

-- 다른 워크스페이스 소유자는 남의 일기를 못 읽는다 (owner_id 가 달라도 workspace 가 같으면? — 같은 ws 의 다른 멤버도 못 읽어야 한다)
select pg_temp.make_user('99999999-9999-9999-9999-999999999999', 'member2@example.com');
insert into public.workspace_members (workspace_id, user_id, role) values ((select v from fx where k='ws1'), '99999999-9999-9999-9999-999999999999', 'editor');
select pg_temp.as_user('99999999-9999-9999-9999-999999999999');
do $$
declare n int;
begin
  select count(*) into n from public.ops_journal_entries; assert n = 0, '같은 워크스페이스라도 남의 일기는 못 읽는다';
end $$;
select pg_temp.as_admin();

-- ---------- 8. anon ----------
select pg_temp.as_anon();
do $$
declare failed boolean := false;
begin
  begin
    perform count(*) from public.portal_client_links;
  exception when insufficient_privilege then failed := true; end;
  assert failed, 'anon 은 portal_client_links 권한 없음';
  failed := false;
  begin
    perform * from public.portal_my_projects();
  exception when insufficient_privilege then failed := true; end;
  assert failed, 'anon 은 portal_my_projects 실행 불가';
end $$;
select pg_temp.as_admin();

select 'BRIDGE CONTRACT: ALL ASSERTIONS PASSED' as result;
rollback;
