-- =====================================================================
-- 0023 · 0024 되돌리기 — **준비만 해 둔 파일**. 대표가 '되돌려' 라고 승인했을 때만 SQL Editor 에서 실행한다.
--
-- 언제: 0023 · 0024 적용 뒤 앱이 평소 하던 저장이 막히거나(오류 글 '자료의 작업공간은 바꿀 수 없습니다' 가 반복),
--       대표 ↔ 팀장 화면 전환이 사라졌는데 원인을 바로 못 찾을 때.
-- 무엇을: 이번에 **더한 장치만** 뗀다(트리거 · 함수 본문). 표 · 칸 · 자료 · 정책은 그대로.
--   - 0023: 19개 업무 표의 zz_workspace_id_lock 트리거를 뗀다(workspace_id_lock 함수는 남겨도 무해).
--   - 0024: 고객 보호 트리거 셋을 떼고, 대표 연결 · 팀장 화면 목록 함수를 0020 본문으로 되돌린다.
--           os_access.audience 칸은 **남긴다**(칸 지우기 금지 규칙 · 기본값 internal 이라 무해).
-- 멈춤: 외부 고객(audience = customer) 계정이 하나라도 있으면 0024 는 되돌리지 않는다 —
--       되돌리면 다음 팀장 준비 때 대표가 그 고객 작업공간 편집자로 들어갈 수 있기 때문이다(고객 자료 보호가 먼저).
-- 한 거래로 묶었다 — 중간에 하나라도 실패하면 아무것도 바뀌지 않는다. 여러 번 실행해도 같다.
-- 실행 뒤 check_applied_0016_0024.sql 로 0023 · 0024 줄이 '없음' 으로 바뀌었는지, precheck_0023_0024.sql 7 · 8번이 '0020 그대로' 인지 본다.
-- (로컬 연습: scripts/db-local/run-0024-customer.sh 3) — 되돌린 함수 본문 지문이 0020 과 같고 대표 팀장 화면 전환 그대로)
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.os_access') is not null
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'os_access' and column_name = 'audience')
     and exists (select 1 from public.os_access where audience = 'customer') then
    raise exception '외부 고객 계정이 있어 되돌리지 않습니다(고객 작업공간에 대표가 들어갈 수 있게 됨). 아무것도 바꾸지 않았습니다.';
  end if;
end $$;

-- 0023 장치 떼기
do $$
declare
  t text;
begin
  foreach t in array array[
    'operations_clients', 'module_data', 'ops_journal_entries', 'ops_custom_services',
    'consulting_projects', 'consulting_artifacts', 'consulting_decisions', 'consulting_evidence', 'consulting_prompt_packages',
    'customer_events', 'portal_client_links', 'portal_documents', 'portal_requests', 'portal_updates', 'portal_grant_notices',
    'data_import_jobs', 'data_import_items', 'ui_preferences', 'workspace_invites'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists zz_workspace_id_lock on public.%I', t);
    end if;
  end loop;
end $$;

-- 0024 장치 떼기
drop trigger if exists zz_os_access_customer_member on public.workspace_members;
do $$
begin
  if to_regclass('public.os_access') is not null then
    execute 'drop trigger if exists zz_os_access_audience on public.os_access';
  end if;
  if to_regclass('public.ai_entitlements') is not null then
    execute 'drop trigger if exists zz_ai_entitlements_customer on public.ai_entitlements';
  end if;
end $$;

-- 0024 가 바꾼 함수 두 개를 0020 본문으로(0020 파일과 한 글자도 다르지 않게)
create or replace function public.os_access_link_owner_to_pilots()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  n integer;
begin
  select w.owner_id into v_owner from public.workspaces w where w.id = public.default_intake_workspace();
  if v_owner is null or not exists (select 1 from public.os_access a where a.user_id = v_owner and a.tier = 'full') then
    return 0;
  end if;
  insert into public.workspace_members (workspace_id, user_id, role)
  select w.id, v_owner, 'editor'
  from public.workspaces w
  join public.os_access p on p.user_id = w.owner_id and p.tier = 'pilot'
  on conflict (workspace_id, user_id) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.os_access_link_owner_to_pilots() from public, anon, authenticated;

create or replace function public.my_pilot_views()
returns table (workspace_id uuid, workspace_name text, person_name text, person_title text)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, w.name,
         coalesce(nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''), 'Pilot'),
         coalesce(nullif(btrim(u.raw_user_meta_data ->> 'title'), ''), '')
  from public.workspaces w
  join public.os_access p on p.user_id = w.owner_id and p.tier = 'pilot'
  join public.workspace_members m on m.workspace_id = w.id and m.user_id = auth.uid()
  left join auth.users u on u.id = w.owner_id
  where exists (select 1 from public.os_access a where a.user_id = auth.uid() and a.tier = 'full')
  order by w.created_at;
$$;
revoke all on function public.my_pilot_views() from public, anon;
grant execute on function public.my_pilot_views() to authenticated;

commit;

-- 확인(바꾸지 않음): 남은 장치 수 — 둘 다 0 이어야 한다
select
  (select count(*) from pg_trigger where tgname = 'zz_workspace_id_lock' and not tgisinternal) as "0023 장치",
  (select count(*) from pg_trigger where tgname in ('zz_os_access_customer_member', 'zz_os_access_audience', 'zz_ai_entitlements_customer') and not tgisinternal) as "0024 장치";
