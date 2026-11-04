-- =====================================================================
-- D-530 SAFE-2 업무 표의 '어느 작업공간 자료인가(workspace_id)' 는 앱에서 바꿀 수 없다
--
-- 왜: 업무 표의 고치기 정책은 '고치기 전 작업공간에 쓸 수 있나'(USING) 와 '고친 뒤 작업공간에 쓸 수 있나'(WITH CHECK) 만 본다.
--     두 작업공간에 모두 쓸 수 있는 사람(지금은 대표 — 0020 으로 팀장 작업공간 편집자)이 같은 id 로 upsert 하면
--     그 줄이 다른 작업공간으로 **옮겨졌다**(로컬 DB 재현 · 백업 불러오기 사고 D-530). 앱은 D-530 에서 막았지만,
--     화면을 거치지 않은 직접 호출(REST)도 DB 가 막도록 이 장치를 둔다.
-- 원칙: 추가만(함수 1 · 트리거). 표 · 정책 · 열 · 자료는 바꾸지 않는다. 여러 번 실행해도 같다.
--   - 앱이 쓰는 길(같은 작업공간 안에서 고치기 · 새로 넣기 · 지우기)은 그대로.
--   - SQL Editor · 서버 작업(로그인한 사람이 없다 — auth.uid() 가 null)은 막지 않는다 — 대표가 직접 옮겨야 할 때를 위해.
--   - 이미 같은 장치가 있는 표(workspace_members 0020 · company_cases · ai_runs 0021)는 건드리지 않는다.
-- 선행: 없음(표가 없으면 그 표는 건너뛴다). 운영 적용은 대표 승인 뒤 SQL Editor 에서.
-- 되돌리기(필요할 때만): drop trigger zz_workspace_id_lock on public.<표>;  — 함수는 남겨도 무해
-- =====================================================================
begin;

create or replace function public.workspace_id_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- SQL Editor · 서버 작업(로그인한 사람이 없다)은 막지 않는다
  if auth.uid() is null then
    return new;
  end if;
  if new.workspace_id is distinct from old.workspace_id then
    raise exception '자료의 작업공간은 바꿀 수 없습니다(다른 작업공간 자료가 섞이지 않게).' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.workspace_id_lock() from public, anon, authenticated;

-- 앱이 쓰는 업무 표 — 있고 workspace_id 칸이 있는 것만
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
    if to_regclass('public.' || t) is not null
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'workspace_id') then
      execute format('drop trigger if exists zz_workspace_id_lock on public.%I', t);
      execute format('create trigger zz_workspace_id_lock before update of workspace_id on public.%I for each row execute function public.workspace_id_lock()', t);
    end if;
  end loop;
end $$;

commit;

-- 확인(바꾸지 않음): 장치가 붙은 표
select c.relname as table_name
from pg_trigger g join pg_class c on c.oid = g.tgrelid
where g.tgname = 'zz_workspace_id_lock' and not g.tgisinternal
order by 1;
