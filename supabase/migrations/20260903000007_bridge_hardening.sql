-- 20260903000007_bridge_hardening.sql
--
-- 20260903000006_customer_bridge.sql 의 후속 하드닝.
-- Supabase Security Advisor 기준으로 불필요하게 열려 있던 실행 권한을 닫고,
-- search_path 가 고정되지 않은 함수 한 개를 고정한다.
--
-- 원칙
--   * additive/권한 축소만 — DROP TABLE/COLUMN, TRUNCATE, rename, RLS 해제 없음
--   * 멱등 — 몇 번 실행해도 같은 결과
--   * 고객 앱·내부 앱이 실제로 호출하는 RPC 권한은 건드리지 않는다
--
-- 무엇을 왜 닫는가
--
--   1) bridge_on_* (6개) — 트리거 전용 SECURITY DEFINER 함수
--      PostgreSQL 은 새 함수에 EXECUTE 를 PUBLIC 으로 기본 부여한다. 그래서
--      anon/authenticated 까지 실행 권한이 열려 있었다. 반환형이 trigger 라
--      직접 호출은 서버가 거부하지만("trigger functions can only be called as
--      triggers"), 권한 자체가 불필요하므로 회수한다.
--      트리거 실행에는 영향이 없다 — EXECUTE 권한은 CREATE TRIGGER 시점에
--      확인하고, 발화 시점에는 확인하지 않는다.
--
--   2) bridge_touch_updated_at — updated_at 만 채우는 트리거 함수
--      search_path 가 고정돼 있지 않아 Advisor 의 function_search_path_mutable
--      경고에 걸린다. SECURITY INVOKER 라 위험도는 낮지만 고정한다.
--      DEFINER 로 승격하지 않는다 — invoker 가 더 보수적이다.
--
--   3) portal_link_owned — 다른 SECURITY DEFINER 함수 안에서만 쓰는 헬퍼
--      중첩 호출은 함수 소유자 권한으로 실행되므로 authenticated 에게
--      EXECUTE 가 필요 없다. 프론트엔드도 호출하지 않는다.
--      (portal_storage_path_allowed / portal_storage_shared 는 storage RLS
--       정책 안에서 호출자 권한으로 평가되므로 authenticated 권한을 유지한다.)
--
-- 유지되는 고객/내부 RPC 권한 (건드리지 않음)
--   portal_my_projects, portal_project, portal_create_request,
--   portal_upload_path, portal_register_document, portal_complete_action,
--   portal_preview_project, portal_storage_path_allowed, portal_storage_shared

begin;

-- ------------------------------------------------------------------
-- 1. 트리거 전용 함수의 EXECUTE 회수
-- ------------------------------------------------------------------
do $$
declare
  fn text;
  trigger_fns text[] := array[
    'public.bridge_touch_updated_at()',
    'public.bridge_on_diagnosis_lead()',
    'public.bridge_on_service_order()',
    'public.bridge_on_consult_lead()',
    'public.bridge_on_portal_request()',
    'public.bridge_on_portal_document()',
    'public.bridge_on_portal_update_completed()'
  ];
begin
  foreach fn in array trigger_fns loop
    if to_regprocedure(fn) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', fn);
    end if;
  end loop;
end
$$;

-- ------------------------------------------------------------------
-- 2. search_path 고정 (Advisor: function_search_path_mutable)
-- ------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.bridge_touch_updated_at()') is not null then
    execute 'alter function public.bridge_touch_updated_at() set search_path = public';
  end if;
end
$$;

-- ------------------------------------------------------------------
-- 3. 내부 전용 헬퍼의 EXECUTE 회수
-- ------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.portal_link_owned(uuid)') is not null then
    execute 'revoke all on function public.portal_link_owned(uuid) from public, anon, authenticated';
  end if;
end
$$;

commit;

-- ------------------------------------------------------------------
-- 확인용 (실행하면 남는 권한을 보여준다 — 남아야 하는 것만 남아야 한다)
-- ------------------------------------------------------------------
--   select p.proname,
--          has_function_privilege('anon', p.oid, 'execute')          as anon,
--          has_function_privilege('authenticated', p.oid, 'execute') as auth
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and (p.proname like 'bridge%' or p.proname like 'portal%')
--    order by p.proname;
