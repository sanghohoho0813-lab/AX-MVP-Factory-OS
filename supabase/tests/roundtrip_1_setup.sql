-- =====================================================================
-- 왕복 확인 [1/3] 준비
-- ---------------------------------------------------------------------
-- Supabase Dashboard → SQL Editor 에 붙여 넣고, 맨 위 한 줄만 고쳐서 Run.
--
-- 먼저 해둘 것
--   1) 마이그레이션 …0007, …0008, …0009 적용
--   2) Dashboard → Authentication → Users → Add user
--      (Auto Confirm User 체크 — 이메일 인증을 건너뛴다)
--      ※ …0009 를 먼저 적용해야 계정이 만들어진다
--
-- 이 스크립트가 하는 일
--   · 그 계정의 프로필을 온보딩 통과 상태로 맞춘다 (member_type 이 비면 /auth/onboarding 에 갇힌다)
--   · 업체 "왕복테스트(주)" 를 만들고 그 계정과 연결한다
--   · "사업자등록증(테스트)" 를 요청 상태로 걸어 둔다
--
-- 고객 행동(요청 보내기·서류 업로드)은 흉내내지 않는다.
-- 그건 사람이 고객 플랫폼 화면에서 직접 해야 검증에 의미가 있다.
--
-- 멱등 — 여러 번 실행해도 같은 상태가 된다.
-- =====================================================================

do $$
declare
  -- ▼▼▼ 여기 한 줄만 고친다 ▼▼▼
  v_customer_email text := 'portal-test@miraeailab.com';
  -- ▲▲▲

  v_company text := '왕복테스트(주)';
  v_client  text := 'cli_roundtrip_check';
  v_ws      uuid;
  v_cust    uuid;
  v_link    uuid;
  v_doc     uuid;
begin
  v_ws := public.default_intake_workspace();
  if v_ws is null then
    raise exception '워크스페이스가 없습니다. 내부 OS 에 먼저 로그인해 워크스페이스를 만드세요.';
  end if;

  select id into v_cust from public.profiles where lower(email) = lower(v_customer_email);
  if v_cust is null then
    raise exception
      '고객 계정을 찾을 수 없습니다: %. Dashboard → Authentication → Users → Add user (Auto Confirm User 체크) 로 먼저 만드세요.',
      v_customer_email;
  end if;

  -- 공개 사이트 온보딩 게이트 통과 (휴대폰 본인인증이 "준비 중" 이라 이 계정만 통과시킨다)
  update public.profiles
     set member_type = 'business', phone_verified = true
   where id = v_cust;

  insert into public.operations_clients (id, workspace_id, company_name, payload)
  values (v_client, v_ws, v_company,
          jsonb_build_object(
            'fees',  jsonb_build_array(jsonb_build_object('amount', 5500000, 'label', '착수금(테스트)')),
            'notes', '내부 메모(테스트) — 고객 화면에 보이면 안 된다'))
  on conflict (id) do update set company_name = excluded.company_name;

  select id into v_link from public.portal_client_links
   where operations_client_id = v_client and profile_id = v_cust;
  if v_link is null then
    insert into public.portal_client_links
      (workspace_id, operations_client_id, profile_id, display_name, consultant_name)
    values (v_ws, v_client, v_cust, v_company || ' 벤처인증(테스트)', '김상호')
    returning id into v_link;
  end if;

  select id into v_doc from public.portal_documents
   where portal_client_link_id = v_link and document_type = 'businessRegistration';
  if v_doc is null then
    insert into public.portal_documents
      (workspace_id, portal_client_link_id, operations_client_id,
       document_type, title, status, customer_note, internal_note, requested_at)
    values (v_ws, v_link, v_client, 'businessRegistration', '사업자등록증(테스트)', 'requested',
            '3개월 이내 발급본으로 부탁드립니다',
            '내부 메모(테스트) — 고객에게 보이면 안 된다', now());
  end if;

  raise notice '준비 완료 · workspace=% · link=%', v_ws, v_link;
end $$;

-- ---------------------------------------------------------------------
-- 준비 상태 확인 — 5줄 모두 OK 여야 다음 단계로 간다
-- ---------------------------------------------------------------------
select 항목, 실제, 기대, case when 실제 = 기대 then '✅ OK' else '❌ 확인 필요' end as 결과
from (
  select '1. 마이그레이션 …0008 적용됨' as 항목,
         (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'bridge_emit_customer_event'
             and pg_get_functiondef(p.oid) like '%operations_client_id%') as 실제, 1 as 기대
  union all
  select '2. 마이그레이션 …0007 적용됨 (트리거 함수 권한 닫힘)',
         (case when has_function_privilege('authenticated',
                 to_regprocedure('public.bridge_on_portal_request()')::oid, 'execute')
               then 0 else 1 end), 1
  union all
  select '3. 가입 트리거 정상 (…0009)',
         (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'handle_new_user'
             and pg_get_functiondef(p.oid) like '%information_schema.columns%'), 1
  union all
  select '4. 테스트 업체와 고객 계정이 연결됨',
         (select count(*)::int from public.portal_client_links
           where operations_client_id = 'cli_roundtrip_check'), 1
  union all
  select '5. 사업자등록증(테스트)이 요청 상태',
         (select count(*)::int from public.portal_documents d
           join public.portal_client_links l on l.id = d.portal_client_link_id
          where l.operations_client_id = 'cli_roundtrip_check' and d.status = 'requested'), 1
) t order by 항목;

-- ---------------------------------------------------------------------
-- 다음 — 고객 플랫폼 Preview 에 테스트 계정으로 로그인해서 두 가지만 한다
--
--   ① /my-projects → "왕복테스트(주) 벤처인증(테스트)" → 내 요청 탭
--      제목: 벤처인증 진행 상황이 궁금합니다
--   ② 같은 화면 서류 탭 → 요청받은 사업자등록증에 PDF 아무거나 업로드
--
-- 그다음 roundtrip_2_verify.sql 을 실행한다.
-- ---------------------------------------------------------------------
