-- =====================================================================
-- 왕복 확인용 테스트 데이터 시드 (사람이 화면에서 ①② 만 보면 되도록)
-- ---------------------------------------------------------------------
-- Supabase Dashboard → SQL Editor 에 붙여 넣고, 맨 위 두 줄만 고쳐서 실행한다.
--
--   실행 후 확인할 것
--     ① 내부 OS `/ops/inbox` — 고객 요청 1건 + 서류 업로드 1건이 뜬다
--        (고객사 이름이 보이고 "처리 완료" 버튼이 있어야 한다.
--         "새 고객사로 만들기" 가 보이면 …0008 마이그레이션이 아직 적용되지 않은 것이다)
--     ② 테스트 고객으로 로그인 → `/my-projects` → 업데이트 탭에
--        "서류 확인했습니다" 가 보이고, "초안" 은 보이지 않는다
--
-- 되돌리기: 맨 아래 CLEANUP 블록을 실행하면 이 시드가 만든 것만 지운다.
-- 실제 고객 데이터는 건드리지 않는다.
-- =====================================================================

do $$
declare
  -- ▼▼▼ 여기 두 줄만 고친다 ▼▼▼
  v_customer_email text := 'portal-test@miraeailab.com';  -- 테스트 고객 계정 이메일
  v_company        text := '왕복테스트(주)';               -- 화면에 보일 테스트 업체명
  -- ▲▲▲ 여기까지 ▲▲▲

  v_ws     uuid;
  v_cust   uuid;
  v_client text := 'cli_roundtrip_check';
  v_link   uuid;
  v_doc    uuid;
  v_owner  uuid;
begin
  -- 1. 워크스페이스 — 유입 라우팅에 지정된 곳(없으면 가장 오래된 곳)
  v_ws := public.default_intake_workspace();
  if v_ws is null then
    raise exception '워크스페이스가 없습니다. 내부 OS 에 먼저 로그인해 워크스페이스를 만드세요.';
  end if;

  select owner_id into v_owner from public.workspaces where id = v_ws;

  -- 2. 테스트 고객 계정
  select id into v_cust from public.profiles where email = v_customer_email;
  if v_cust is null then
    raise exception '고객 계정을 찾을 수 없습니다: %  → Dashboard → Authentication → Users → Add user (Auto Confirm) 로 먼저 만드세요.', v_customer_email;
  end if;

  -- 3. 테스트 업체 (있으면 그대로 씀)
  insert into public.operations_clients (id, workspace_id, company_name, payload)
  values (v_client, v_ws, v_company,
          jsonb_build_object(
            'fees', jsonb_build_array(jsonb_build_object('amount', 5500000, 'label', '착수금(테스트)')),
            'notes', '내부 메모(테스트) — 고객 화면에 보이면 안 된다'))
  on conflict (id) do update set company_name = excluded.company_name;

  -- 4. 고객 플랫폼 계정 연결
  select id into v_link from public.portal_client_links
   where operations_client_id = v_client and profile_id = v_cust;
  if v_link is null then
    insert into public.portal_client_links (workspace_id, operations_client_id, profile_id, display_name, consultant_name)
    values (v_ws, v_client, v_cust, v_company || ' 벤처인증(테스트)', '김상호')
    returning id into v_link;
  end if;

  -- 5. 내부가 서류를 요청한다
  select id into v_doc from public.portal_documents
   where portal_client_link_id = v_link and document_type = 'businessRegistration';
  if v_doc is null then
    insert into public.portal_documents (workspace_id, portal_client_link_id, operations_client_id,
                                         document_type, title, status, customer_note, internal_note, requested_at)
    values (v_ws, v_link, v_client, 'businessRegistration', '사업자등록증(테스트)', 'requested',
            '3개월 이내 발급본으로 부탁드립니다', '내부 메모(테스트) — 고객에게 보이면 안 된다', now())
    returning id into v_doc;
  end if;

  -- 6. 고객이 한 행동을 흉내낸다 → 트리거가 이벤트를 만든다 (확인 ①)
  if not exists (select 1 from public.portal_requests where portal_client_link_id = v_link) then
    insert into public.portal_requests (workspace_id, portal_client_link_id,
                                        request_type, title, body, created_by)
    values (v_ws, v_link, 'status', '진행 상황이 궁금합니다(테스트)', '접수까지 얼마나 걸릴까요?', v_cust);
  end if;

  update public.portal_documents
     set status = 'uploaded', source = 'customer', visibility = 'customer_uploaded',
         storage_path = v_ws::text || '/portal/' || v_link::text || '/test-biz.pdf',
         file_name = '사업자등록증(테스트).pdf', uploaded_at = now()
   where id = v_doc and status <> 'uploaded';

  -- 7. 내부가 업데이트를 발행한다 + 초안 하나 (확인 ②)
  if not exists (select 1 from public.portal_updates where portal_client_link_id = v_link and status = 'published') then
    insert into public.portal_updates (workspace_id, portal_client_link_id, category, title, body,
                                       status, published_at, published_by)
    values (v_ws, v_link, 'progress', '서류 확인했습니다 — 다음 주 접수합니다(테스트)',
            '보내주신 사업자등록증 확인했습니다. 다음 주 화요일에 접수하겠습니다.', 'published', now(), v_owner);
  end if;
  if not exists (select 1 from public.portal_updates where portal_client_link_id = v_link and status = 'draft') then
    insert into public.portal_updates (workspace_id, portal_client_link_id, category, title, body, status)
    values (v_ws, v_link, 'progress', '초안(테스트) — 고객에게 보이면 안 됨', '내부 검토 중', 'draft');
  end if;

  raise notice '시드 완료 · workspace=% · client=% · link=%', v_ws, v_client, v_link;
end $$;

-- ---------------------------------------------------------------------
-- 결과 확인 — 이 표가 전부 OK 여야 화면에서도 제대로 보인다
-- ---------------------------------------------------------------------
select 항목, 실제, 기대, case when 실제 = 기대 then '✅ OK' else '❌ 확인 필요' end as 결과
from (
  select '① 이벤트함에 뜰 고객 행동' as 항목,
         (select count(*)::int from public.customer_events e
           join public.portal_client_links l on l.id = e.portal_client_link_id
          where l.operations_client_id = 'cli_roundtrip_check'
            and e.event_type in ('customer_request_created', 'document_uploaded')) as 실제,
         2 as 기대
  union all
  select '① 이벤트에 고객사 id 가 채워짐 (…0008)',
         (select count(*)::int from public.customer_events e
           join public.portal_client_links l on l.id = e.portal_client_link_id
          where l.operations_client_id = 'cli_roundtrip_check'
            and e.operations_client_id is not null), 2
  union all
  select '② 고객에게 보일 발행 업데이트',
         (select count(*)::int from public.portal_updates u
           join public.portal_client_links l on l.id = u.portal_client_link_id
          where l.operations_client_id = 'cli_roundtrip_check' and u.status = 'published'), 1
  union all
  select '② 고객에게 숨겨야 할 초안',
         (select count(*)::int from public.portal_updates u
           join public.portal_client_links l on l.id = u.portal_client_link_id
          where l.operations_client_id = 'cli_roundtrip_check' and u.status = 'draft'), 1
) t order by 항목;

-- =====================================================================
-- CLEANUP — 확인이 끝나면 이 블록만 따로 실행한다 (테스트 데이터만 지운다)
-- =====================================================================
-- do $$
-- declare v_link uuid;
-- begin
--   select id into v_link from public.portal_client_links where operations_client_id = 'cli_roundtrip_check';
--   if v_link is not null then
--     delete from public.customer_events   where portal_client_link_id = v_link;
--     delete from public.portal_updates    where portal_client_link_id = v_link;
--     delete from public.portal_requests   where portal_client_link_id = v_link;
--     delete from public.portal_documents  where portal_client_link_id = v_link;
--     delete from public.portal_client_links where id = v_link;
--   end if;
--   delete from public.operations_clients where id = 'cli_roundtrip_check';
--   raise notice '테스트 데이터 삭제 완료';
-- end $$;
