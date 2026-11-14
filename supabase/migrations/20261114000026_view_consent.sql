-- =====================================================================
-- L-27 · D-608 대표가 팀장(컨설턴트) 화면을 볼 때 — 고객 자료는 팀장 본인이 허락한 동안만
--
-- 대표 지시(2026-11-12): "내 아이디에서 왔다갔다 해도 보이게 — 고객 정보 같은 것만 나중에 출시 전에
--   컨설턴트 본인 동의를 구해야만(승인해 줘야만) 볼 수 있게."
--
-- 지금(0020): 대표는 팀장 작업공간의 편집자라 업체 · 서류 · 계약 · 모듈 기록을 그대로 본다.
-- 0026 뒤:
--   - 대표(full) 가 팀장(pilot) 작업공간을 볼 때 **고객 자료**는 팀장이 허락한 기간(1 · 7 · 30일)에만 보인다(읽기 · 쓰기 둘 다).
--     고객 자료 = workspace_id 가 있는 표 전부(아래 '고객 자료가 아닌 표' 만 빼고) + 업체에 걸린 모듈 기록 + 업체 서류 파일.
--   - 허락 없이도 보이는 것: 마케팅 · 브랜딩 · 쉬는 날 · 화면 설정 · 피드백 · AI 기준 · 상품표(업체와 상관없는 모듈 기록) · 구성원.
--   - 팀장은 언제든 [지금 닫기] — 그 순간부터 다시 안 보인다. 허락 · 닫기 · 요청 · 거절은 모두 기록으로 남는다(지우지 않음).
--   - 대표는 [허락 요청 보내기] 만 할 수 있다(스스로 허락 0 · 표에 직접 쓰기 0).
--   - 팀장 자신 · 팀장이 초대한 동료 · 대표 자기 작업공간은 아무것도 바뀌지 않는다.
--   - 외부 구독 고객 작업공간은 0024 그대로(대표가 구성원이 될 수 없다).
--
-- 방법: 기존 정책은 그대로 두고 **RESTRICTIVE 정책**(AND 로 더해지는 문)을 더한다 — 추가만.
--   표 2 · 함수 7 · 정책(표마다 하나) · portal_preview_project 에 같은 문 한 줄. 표 · 열 · 정책 삭제/변경 없음. 여러 번 실행해도 같다.
-- 선행: 0019 · 0020(대표가 팀장 작업공간 편집자).
-- 되돌리기(대표가 다시 바로 보게): 아래 '되돌리기' 줄 — 정책만 지우면 0020 상태(기록 표는 남김).
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.os_access') is null or to_regprocedure('public.my_pilot_views()') is null then
    raise exception '0019 · 0020 을 먼저 실행하세요. 0026 은 아무것도 바꾸지 않았습니다.';
  end if;
end $$;

-- 1) 허락 기록 — 누가(팀장) · 누구에게(대표) · 언제부터 · 언제까지 · 닫은 때
create table if not exists public.workspace_view_grants (
  id          uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  grantee_id  uuid not null references auth.users (id) on delete cascade,
  granted_by  uuid not null,
  scope       text not null default 'clients' check (scope in ('clients')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  revoked_by  uuid,
  check (expires_at >= created_at)
);
comment on table public.workspace_view_grants is
  'L-27 팀장(작업공간 주인)이 대표에게 고객 자료 보기를 허락한 기록. 앱은 함수(view_consent_*)로만 쓴다 — 표에 직접 쓰기 0. 지우지 않고 닫은 때만 적는다.';
create index if not exists workspace_view_grants_ws_idx
  on public.workspace_view_grants (workspace_id, grantee_id, expires_at desc);
alter table public.workspace_view_grants enable row level security;
revoke all on public.workspace_view_grants from public, anon, authenticated;
grant select on public.workspace_view_grants to authenticated;
drop policy if exists "View grants: workspace owner or grantee can read" on public.workspace_view_grants;
create policy "View grants: workspace owner or grantee can read"
  on public.workspace_view_grants for select to authenticated
  using (grantee_id = auth.uid() or exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

-- 2) 허락 요청 기록 — 대표가 보낸 요청 · 팀장이 허락/거절한 때
create table if not exists public.workspace_view_requests (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  requester_id  uuid not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  closed_at     timestamptz,
  closed_reason text check (closed_reason in ('granted', 'declined'))
);
comment on table public.workspace_view_requests is
  'L-27 대표가 팀장에게 보낸 고객 자료 보기 허락 요청. 열린 요청은 작업공간마다 하나. 앱은 함수로만 쓴다.';
create index if not exists workspace_view_requests_ws_idx
  on public.workspace_view_requests (workspace_id, created_at desc);
alter table public.workspace_view_requests enable row level security;
revoke all on public.workspace_view_requests from public, anon, authenticated;
grant select on public.workspace_view_requests to authenticated;
drop policy if exists "View requests: workspace owner or requester can read" on public.workspace_view_requests;
create policy "View requests: workspace owner or requester can read"
  on public.workspace_view_requests for select to authenticated
  using (requester_id = auth.uid() or exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

-- 3) 지금 이 사람에게 닫힌 작업공간 — 대표(full) 가 구성원인 팀장(pilot) 작업공간 중 지금 허락이 없는 곳
--    정책에서 (select …) 로 불러 한 번의 요청에 한 번만 계산된다. 대표가 아니면 늘 빈 목록.
create or replace function public.view_consent_blocked_workspaces()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(w.id), '{}'::uuid[])
  from public.workspaces w
  join public.os_access o on o.user_id = w.owner_id and o.tier = 'pilot'
  where auth.uid() is not null
    and w.owner_id <> auth.uid()
    and exists (select 1 from public.os_access me where me.user_id = auth.uid() and me.tier = 'full')
    and exists (select 1 from public.workspace_members m where m.workspace_id = w.id and m.user_id = auth.uid())
    and not exists (
      select 1 from public.workspace_view_grants g
      where g.workspace_id = w.id and g.grantee_id = auth.uid() and g.revoked_at is null and g.expires_at > now()
    );
$$;
revoke all on function public.view_consent_blocked_workspaces() from public, anon;
grant execute on function public.view_consent_blocked_workspaces() to authenticated;

create or replace function public.view_consent_ok(p_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not (p_ws = any (public.view_consent_blocked_workspaces()));
$$;
revoke all on function public.view_consent_ok(uuid) from public, anon;
grant execute on function public.view_consent_ok(uuid) to authenticated;

-- 4) 문 — 고객 자료 표마다 RESTRICTIVE 정책 하나(기존 허용 정책과 AND)
--    고객 자료가 아닌 표(허락 없이도 그대로): 구성원 · 초대 · 화면 설정 · AI 사용량 · 상품표 · 업무 일기(사람마다 따로 — 0001 규칙 그대로)
--    · 공개 지원사업 공고 · 상담신청 받는 곳 설정 · 고객 문의 · 허락 기록 표 자신. module_data 는 아래 5) 에서 따로.
do $$
declare t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'workspace_id'
      and c.table_name not in (
        'workspace_members', 'workspace_invites', 'ui_preferences', 'ai_usage_ledger', 'ai_usage_config', 'ai_entitlements',
        'ai_runs', 'ai_output_revisions', 'ops_custom_services', 'ops_journal_entries', 'portal_grant_notices',
        'customer_intake_routing', 'support_messages', 'os_access', 'module_data',
        'workspace_view_grants', 'workspace_view_requests')
    order by 1
  loop
    execute format('drop policy if exists %I on public.%I', 'zz View consent gate', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      'using (not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[]))) '
      'with check (not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[])))',
      'zz View consent gate', t);
  end loop;
end $$;

-- 5) 모듈 기록 — 업체에 걸린 줄 · 업체 자료 모듈은 닫고, 업체와 상관없는 마케팅 · 브랜딩 · 쉬는 날 · 화면 설정 · 피드백 · AI 기준 · 상품표는 연다(D-601 그대로)
drop policy if exists "zz View consent gate" on public.module_data;
create policy "zz View consent gate"
  on public.module_data as restrictive for all to authenticated
  using (
    not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[]))
    or (client_id is null and module_key in ('marketing', 'brand', 'calendar', 'system', 'feedback', 'ai', 'sales-os'))
  )
  with check (
    not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[]))
    or (client_id is null and module_key in ('marketing', 'brand', 'calendar', 'system', 'feedback', 'ai', 'sales-os'))
  );

-- 6) 업체 서류 파일 — client-documents 의 첫 폴더 = 작업공간 id(글자 비교라 uuid 가 아닌 이름에도 오류 없음)
drop policy if exists "zz View consent gate client documents" on storage.objects;
create policy "zz View consent gate client documents"
  on storage.objects as restrictive for all to authenticated
  using (
    bucket_id <> 'client-documents'
    or not (coalesce((storage.foldername(name))[1], '') = any ((select public.view_consent_blocked_workspaces())::text[]))
  )
  with check (
    bucket_id <> 'client-documents'
    or not (coalesce((storage.foldername(name))[1], '') = any ((select public.view_consent_blocked_workspaces())::text[]))
  );

-- 7) 고객 화면 미리 보기(security definer — RLS 를 건너뛴다)에도 같은 문 한 줄. 나머지 본문은 0016 그대로.
create or replace function public.portal_preview_project(p_link_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.portal_client_links where id = p_link_id;
  if v_ws is null or not public.is_workspace_member(v_ws) or not public.view_consent_ok(v_ws) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  return public.portal_project_projection(p_link_id);
end;
$$;

-- 8) 화면이 쓰는 함수 — 상태 · 허락 · 닫기 · 요청 · 거절
--    이름은 auth.users 의 display_name(0020 my_pilot_views 와 같은 곳) — 공개 사이트 모양 profiles(name) 와 상관없다(D-599).
create or replace function public.view_consent_person(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''), '대표')
  from auth.users u where u.id = p_user;
$$;
revoke all on function public.view_consent_person(uuid) from public, anon, authenticated;

create or replace function public.view_consent_state(p_ws uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null or p_ws is null then
    return jsonb_build_object('role', 'none');
  end if;
  select w.owner_id into v_owner
  from public.workspaces w
  join public.os_access o on o.user_id = w.owner_id and o.tier = 'pilot'
  where w.id = p_ws;
  if v_owner is null then
    return jsonb_build_object('role', 'none');
  end if;

  if v_owner = v_uid then
    -- 팀장 본인: 대표 계정이 구성원인지 · 지금 허락 · 열린 요청 · 지난 기록 10개
    return jsonb_build_object(
      'role', 'owner',
      'viewers', (
        select count(*) from public.workspace_members m
        join public.os_access a on a.user_id = m.user_id and a.tier = 'full'
        where m.workspace_id = p_ws and m.user_id <> v_uid),
      'active', (
        select jsonb_build_object('createdAt', g.created_at, 'expiresAt', g.expires_at)
        from public.workspace_view_grants g
        where g.workspace_id = p_ws and g.revoked_at is null and g.expires_at > now()
        order by g.expires_at desc limit 1),
      'request', (
        select jsonb_build_object('createdAt', r.created_at, 'by', public.view_consent_person(r.requester_id))
        from public.workspace_view_requests r
        where r.workspace_id = p_ws and r.closed_at is null
        order by r.created_at desc limit 1),
      'history', (
        select coalesce(jsonb_agg(x.j order by x.at desc), '[]'::jsonb)
        from (
          select g.created_at as at,
                 jsonb_build_object('kind', 'grant', 'createdAt', g.created_at, 'expiresAt', g.expires_at, 'revokedAt', g.revoked_at,
                                    'to', public.view_consent_person(g.grantee_id)) as j
          from public.workspace_view_grants g where g.workspace_id = p_ws
          union all
          select r.created_at,
                 jsonb_build_object('kind', 'request', 'createdAt', r.created_at, 'closedAt', r.closed_at, 'closedReason', r.closed_reason,
                                    'by', public.view_consent_person(r.requester_id))
          from public.workspace_view_requests r where r.workspace_id = p_ws
          order by 1 desc
          limit 10
        ) x)
    );
  end if;

  -- 대표(full · 구성원): 지금 허락 · 내 열린 요청 · 마지막 거절/허락
  if not exists (select 1 from public.os_access a where a.user_id = v_uid and a.tier = 'full')
     or not exists (select 1 from public.workspace_members m where m.workspace_id = p_ws and m.user_id = v_uid) then
    return jsonb_build_object('role', 'none');
  end if;
  return jsonb_build_object(
    'role', 'viewer',
    'active', (
      select jsonb_build_object('createdAt', g.created_at, 'expiresAt', g.expires_at)
      from public.workspace_view_grants g
      where g.workspace_id = p_ws and g.grantee_id = v_uid and g.revoked_at is null and g.expires_at > now()
      order by g.expires_at desc limit 1),
    'request', (
      select jsonb_build_object('createdAt', r.created_at)
      from public.workspace_view_requests r
      where r.workspace_id = p_ws and r.requester_id = v_uid and r.closed_at is null
      order by r.created_at desc limit 1),
    'lastClosed', (
      select jsonb_build_object('closedAt', r.closed_at, 'closedReason', r.closed_reason)
      from public.workspace_view_requests r
      where r.workspace_id = p_ws and r.requester_id = v_uid and r.closed_at is not null
      order by r.closed_at desc limit 1)
  );
end;
$$;
revoke all on function public.view_consent_state(uuid) from public, anon;
grant execute on function public.view_consent_state(uuid) to authenticated;

-- 팀장(작업공간 주인)만: 대표 계정(full 구성원)에게 1 · 7 · 30일 허락. 지금 허락이 있으면 닫고 새로(기간 바꾸기). 열린 요청은 '허락함'.
create or replace function public.view_consent_grant(p_ws uuid, p_days integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  n integer;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if p_days is null or p_days not in (1, 7, 30) then
    raise exception '허락 기간은 1일 · 7일 · 30일 중에서 고릅니다.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.workspaces w join public.os_access o on o.user_id = w.owner_id and o.tier = 'pilot'
    where w.id = p_ws and w.owner_id = v_uid) then
    raise exception '이 작업공간 주인만 허락할 수 있습니다.' using errcode = '42501';
  end if;
  update public.workspace_view_grants set revoked_at = now(), revoked_by = v_uid
  where workspace_id = p_ws and revoked_at is null and expires_at > now();
  insert into public.workspace_view_grants (workspace_id, grantee_id, granted_by, expires_at)
  select p_ws, m.user_id, v_uid, now() + make_interval(days => p_days)
  from public.workspace_members m
  join public.os_access a on a.user_id = m.user_id and a.tier = 'full'
  where m.workspace_id = p_ws and m.user_id <> v_uid;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception '이 작업공간에 허락할 대표 계정이 없습니다.' using errcode = 'P0002';
  end if;
  update public.workspace_view_requests set closed_at = now(), closed_reason = 'granted'
  where workspace_id = p_ws and closed_at is null;
  return public.view_consent_state(p_ws);
end;
$$;
revoke all on function public.view_consent_grant(uuid, integer) from public, anon;
grant execute on function public.view_consent_grant(uuid, integer) to authenticated;

-- 팀장만: 지금 닫기(남은 기간과 상관없이 바로)
create or replace function public.view_consent_revoke(p_ws uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public.workspaces w where w.id = p_ws and w.owner_id = v_uid) then
    raise exception '이 작업공간 주인만 닫을 수 있습니다.' using errcode = '42501';
  end if;
  update public.workspace_view_grants set revoked_at = now(), revoked_by = v_uid
  where workspace_id = p_ws and revoked_at is null and expires_at > now();
  return public.view_consent_state(p_ws);
end;
$$;
revoke all on function public.view_consent_revoke(uuid) from public, anon;
grant execute on function public.view_consent_revoke(uuid) to authenticated;

-- 대표(full · 구성원 · 주인 아님)만: 허락 요청 보내기 — 열린 요청은 하나(두 번 눌러도 한 줄) · 이미 허락돼 있으면 아무것도 안 함
create or replace function public.view_consent_request(p_ws uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null
     or not exists (select 1 from public.os_access a where a.user_id = v_uid and a.tier = 'full')
     or not exists (select 1 from public.workspace_members m where m.workspace_id = p_ws and m.user_id = v_uid)
     or not exists (
       select 1 from public.workspaces w join public.os_access o on o.user_id = w.owner_id and o.tier = 'pilot'
       where w.id = p_ws and w.owner_id <> v_uid) then
    raise exception '허락 요청을 보낼 수 없는 작업공간입니다.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('view_consent_request:' || p_ws::text, 0));
  if public.view_consent_ok(p_ws) then
    return public.view_consent_state(p_ws);
  end if;
  if not exists (select 1 from public.workspace_view_requests r where r.workspace_id = p_ws and r.closed_at is null) then
    insert into public.workspace_view_requests (workspace_id, requester_id) values (p_ws, v_uid);
  end if;
  return public.view_consent_state(p_ws);
end;
$$;
revoke all on function public.view_consent_request(uuid) from public, anon;
grant execute on function public.view_consent_request(uuid) to authenticated;

-- 팀장만: 요청 거절(허락하지 않음 — 기록은 남는다)
create or replace function public.view_consent_decline(p_ws uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public.workspaces w where w.id = p_ws and w.owner_id = v_uid) then
    raise exception '이 작업공간 주인만 거절할 수 있습니다.' using errcode = '42501';
  end if;
  update public.workspace_view_requests set closed_at = now(), closed_reason = 'declined'
  where workspace_id = p_ws and closed_at is null;
  return public.view_consent_state(p_ws);
end;
$$;
revoke all on function public.view_consent_decline(uuid) from public, anon;
grant execute on function public.view_consent_decline(uuid) to authenticated;

commit;

-- 확인(바꾸지 않음): 문이 달린 표 수 · 모듈 기록 · 파일 문
select count(*) filter (where tablename <> 'module_data') as gated_tables,
       count(*) filter (where tablename = 'module_data') as module_data_gate
from pg_policies where schemaname = 'public' and policyname = 'zz View consent gate';
select count(*) as storage_gate from pg_policies where schemaname = 'storage' and policyname = 'zz View consent gate client documents';

-- 되돌리기(대표가 다시 허락 없이 보게 — 0020 상태 · 기록 표는 남긴다):
--   do $$ declare t text; begin
--     for t in select tablename from pg_policies where schemaname = 'public' and policyname = 'zz View consent gate' loop
--       execute format('drop policy %I on public.%I', 'zz View consent gate', t); end loop;
--     drop policy if exists "zz View consent gate client documents" on storage.objects;
--   end $$;
