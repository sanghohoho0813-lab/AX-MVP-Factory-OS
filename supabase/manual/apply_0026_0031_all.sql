-- =====================================================================
-- 🚨 운영 DB — 0026 ~ 0031 여섯 개를 한 번에 넣는 묶음(D-662 · 실행은 대표)
--
-- 이 파일은 `node scripts/make-ops-bundle.mjs` 가 만든다. 손으로 고치지 않는다(여섯 마이그레이션 원문 그대로 · 차례대로).
-- 사용: Supabase SQL Editor 에 이 파일을 **통째로** 붙여 넣고 실행 → 맨 아래 결과 표 여섯 줄이 모두 `들어감`.
-- 전부 또는 전무: 한 거래다. 중간에 하나라도 멈추면 여섯 개 모두 들어가지 않는다(잠금이 5초 넘게 걸려도 멈춘다 — 조금 뒤 다시).
-- 여러 번 실행해도 결과는 같다. 이미 몇 개를 따로 넣었어도 된다(있는 것은 그대로 두고 없는 것만 더한다).
-- 더하기만 한다 — 기존 표 · 열 · 자료는 지우거나 바꾸지 않는다.
-- 먼저 있어야 하는 것: 0016 ~ 0025(2026-11-12 운영에서 확인 — D-600). 없으면 그 자리에서 멈추고 아무것도 바뀌지 않는다.
--
-- 넣으면 바로 달라지는 것
--   0026 대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만 — 대표님이 [대표 | 팀장] 으로 팀장 화면을 볼 때 업체 · 서류 · 계약이 비어 보인다 — 팀장님이 설정에서 허락하면 다시 보인다(팀장님께 먼저 알려 둔다). 팀장님 화면 · 대표님 자기 화면은 그대로.
--   0027 고객(컨설턴트)마다 상담 신청 링크 — 마케팅 › 고객 모으기 기초 7가지 아래에 '내 상담 신청 링크' 한 줄이 생긴다(만들기 전에는 링크 없음).
--   0028 가입하면 바로 쓰기(꺼진 채로 들어간다) — 달라지는 것 없음 — 꺼진 채. 켜기 전에 Authentication 의 Confirm email · Site URL 을 먼저(안내서 §12).
--   0029 가입 신청 → 대표가 앱에서 승인 · 거절 — 새로 가입한 사람이 대표님 종(알림)에 '가입 신청 n명' 으로 뜨고, 설정 › 작업공간에서 [승인] · [거절] 한다.
--   0030 AI 답 보관(끊겨도 이어 받기) — AI 단추를 누른 뒤 다른 화면 · 다른 앱에 다녀와도 답을 이어 받는다(다시 세지 않음).
--   0031 서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로) — 업체 서류함에 [링크로 받기] 가 생긴다. 고객이 올리면 오늘 화면 '받은 서류 n개' 에 뜬다.
--
-- 넣기 전 · 넣은 뒤 보기(읽기만): supabase/manual/check_applied_0026_0031.sql
-- 자세한 확인(읽기만): verify_after_0026 · 0027 · 0028 · 0029 · 0031.sql · 안내서 docs/OPS_0023_0024_RUNBOOK.md §17
-- 되돌리기: rollback_0026 ~ 0031.sql 각각(기록 · 자료는 남는다) — 대표가 '되돌려' 라고 할 때만.
-- =====================================================================
begin;
set local lock_timeout = '5s';

-- ───────────────────────────── 0026 대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만 ─────────────────────────────
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
-- (묶음: 거래는 맨 위 begin 하나)

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

-- (묶음: 맨 아래에서 한 번에 commit)

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

-- ───────────────────────────── 0027 고객(컨설턴트)마다 상담 신청 링크 ─────────────────────────────
-- =====================================================================
-- L-9 · D-609 고객(컨설턴트)마다 상담 신청 링크 — 글 끝에 붙이는 한 줄 주소
--
-- 지금: 로그인 없이 받는 상담 신청(지원사업 알림 등)은 대표 작업공간(default_intake_workspace)으로만 들어간다.
--       팀장 · 구독 고객은 자기 글을 보고 온 사람을 받을 주소가 없다(손으로 영업 관리에 적어야 했다).
-- 0027 뒤:
--   - 작업공간 주인은 [내 상담 신청 링크 만들기] 한 번 → https://…/ask/<12자리> 주소가 생긴다(작업공간마다 하나).
--   - 그 주소에서 누가 이름 · 연락처 · 하고 싶은 말을 적고 동의하면 → **그 작업공간의 잠재고객**(업체 기록 · 계약 전)으로 바로 들어간다.
--     유입 경로 = 고른 경로(스레드 · 인스타 · 유튜브 · 블로그) 또는 '상담 링크' · 다음 할 일 = '상담 신청 — 연락드리기'(오늘).
--   - 주인은 언제든 [주소 새로 만들기](예전 주소는 그 순간부터 안 받음) · [받지 않기].
--   - 공개 화면이 읽는 것은 제목 · 한 줄 소개뿐 — 작업공간 · 주인 이메일 · 업체 목록은 나가지 않는다.
--   - 막는 것: 동의 없음 · 연락처 없음 · 이상한 번호 · 한 곳(접속 주소)에서 10분 5번 · 같은 연락처는 링크마다 하루 한 번(다시 눌러도 '접수됨')
--     · 링크 하나에 10분 20번 · 하루 200번 · 전체 10분 300번 · 사용 승인이 없는(또는 끊긴) 주인의 링크 · 로봇이 채우는 숨은 칸.
--
-- 방법: 더하기만 — 표 1(public_intake_links) · 함수 6. 기존 표 · 열 · 정책 · 함수는 그대로. 여러 번 실행해도 같다.
--   앱은 표에 직접 쓰지 못한다(읽기도 작업공간 주인만) — 함수로만.
-- 선행: 0017(public_intake_log · hash_access_token) · 0019(os_access).
-- 되돌리기: supabase/manual/rollback_0027.sql — 함수 실행 권한만 거둔다(링크 · 이미 들어온 잠재고객은 그대로 · 공개 주소는 '지금 받지 않아요').
-- =====================================================================
-- (묶음: 거래는 맨 위 begin 하나)

do $$
begin
  if to_regclass('public.public_intake_log') is null or to_regprocedure('public.hash_access_token(text)') is null
     or to_regclass('public.os_access') is null then
    raise exception '0017 · 0019 를 먼저 실행하세요. 0027 은 아무것도 바꾸지 않았습니다.';
  end if;
end $$;

-- 1) 상담 신청 링크 — 작업공간마다 열린 링크는 하나(닫은 링크는 기록으로 남김)
create table if not exists public.public_intake_links (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  slug             text not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  title            text not null default '',
  intro            text not null default '',
  created_by       uuid,
  created_at       timestamptz not null default now(),
  revoked_at       timestamptz,
  received_count   integer not null default 0,
  last_received_at timestamptz
);
comment on table public.public_intake_links is
  'L-9 작업공간마다 상담 신청 링크(/ask/<slug>). 앱은 함수(intake_link_*)로만 쓴다 — 표에 직접 쓰기 0. 읽기는 작업공간 주인만. 닫은 링크는 지우지 않고 revoked_at 만 적는다.';
create unique index if not exists public_intake_links_slug_idx on public.public_intake_links (slug);
create unique index if not exists public_intake_links_one_open_idx on public.public_intake_links (workspace_id) where revoked_at is null;
alter table public.public_intake_links enable row level security;
revoke all on public.public_intake_links from public, anon, authenticated;
grant select on public.public_intake_links to authenticated;
drop policy if exists "Intake links: workspace owner can read" on public.public_intake_links;
create policy "Intake links: workspace owner can read"
  on public.public_intake_links for select to authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

-- workspace_id 는 한 번 정하면 못 바꾼다(0023 이 있으면 같은 장치)
do $$
begin
  if to_regprocedure('public.workspace_id_lock()') is not null then
    execute 'drop trigger if exists zz_workspace_id_lock on public.public_intake_links';
    execute 'create trigger zz_workspace_id_lock before update of workspace_id on public.public_intake_links for each row execute function public.workspace_id_lock()';
  end if;
end $$;

-- 2) 주인 화면 상태 — 주인이 아니면 {role:none}(앱은 아무것도 안 그림)
create or replace function public.intake_link_state(p_ws uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l public.public_intake_links%rowtype;
begin
  if auth.uid() is null or p_ws is null
     or not exists (select 1 from public.workspaces w where w.id = p_ws and w.owner_id = auth.uid())
     or public.my_os_access() is null then
    return jsonb_build_object('role', 'none');
  end if;
  select * into l from public.public_intake_links where workspace_id = p_ws and revoked_at is null;
  return jsonb_build_object(
    'role', 'owner',
    'link', case when l.id is null then null else jsonb_build_object(
      'slug', l.slug, 'title', l.title, 'intro', l.intro,
      'createdAt', l.created_at, 'received', l.received_count, 'lastAt', l.last_received_at) end,
    'closed', (select count(*) from public.public_intake_links where workspace_id = p_ws and revoked_at is not null)
  );
end;
$$;

-- 주인 확인(함수 안에서만 씀)
create or replace function public.intake_link_owner_check(p_ws uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_ws is null
     or not exists (select 1 from public.workspaces w where w.id = p_ws and w.owner_id = auth.uid()) then
    raise exception '내 작업공간에서만 상담 신청 링크를 만들 수 있어요.' using errcode = '42501';
  end if;
  if public.my_os_access() is null then
    raise exception '사용 승인 뒤에 만들 수 있어요.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.intake_link_owner_check(uuid) from public, anon, authenticated;

-- 3) 만들기 · 제목 고치기(열린 링크가 있으면 제목 · 소개만 고친다)
create or replace function public.intake_link_save(p_ws uuid, p_title text, p_intro text default '')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_title text := left(btrim(regexp_replace(coalesce(p_title, ''), '[\r\n\t]+', ' ', 'g')), 40);
  v_intro text := left(btrim(regexp_replace(coalesce(p_intro, ''), '[\r\n\t]+', ' ', 'g')), 80);
begin
  perform public.intake_link_owner_check(p_ws);
  if v_title = '' then v_title := '상담 신청'; end if;
  perform pg_advisory_xact_lock(hashtext('intake_link:' || p_ws::text));
  update public.public_intake_links set title = v_title, intro = v_intro
   where workspace_id = p_ws and revoked_at is null;
  if not found then
    insert into public.public_intake_links (workspace_id, title, intro, created_by)
    values (p_ws, v_title, v_intro, auth.uid());
  end if;
  return public.intake_link_state(p_ws);
end;
$$;

-- 4) 주소 새로 만들기 — 예전 주소는 그 순간부터 안 받는다(제목 · 소개는 그대로)
create or replace function public.intake_link_rotate(p_ws uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l public.public_intake_links%rowtype;
begin
  perform public.intake_link_owner_check(p_ws);
  perform pg_advisory_xact_lock(hashtext('intake_link:' || p_ws::text));
  select * into l from public.public_intake_links where workspace_id = p_ws and revoked_at is null;
  if l.id is null then
    raise exception '아직 만든 링크가 없어요.' using errcode = '22023';
  end if;
  update public.public_intake_links set revoked_at = now() where id = l.id;
  insert into public.public_intake_links (workspace_id, title, intro, created_by)
  values (p_ws, l.title, l.intro, auth.uid());
  return public.intake_link_state(p_ws);
end;
$$;

-- 5) 받지 않기 — 다시 받으려면 [만들기](새 주소)
create or replace function public.intake_link_off(p_ws uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.intake_link_owner_check(p_ws);
  update public.public_intake_links set revoked_at = now() where workspace_id = p_ws and revoked_at is null;
  return public.intake_link_state(p_ws);
end;
$$;

-- 6) 공개 화면 — 제목 · 한 줄 소개만. 없거나 닫힌 주소 · 승인이 끊긴 주인이면 null
create or replace function public.public_intake_form(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('title', l.title, 'intro', l.intro)
    from public.public_intake_links l
    join public.workspaces w on w.id = l.workspace_id
    join public.os_access a on a.user_id = w.owner_id
   where l.slug = lower(btrim(coalesce(p_slug, ''))) and l.revoked_at is null
   limit 1;
$$;

-- 7) 공개 신청 — 그 작업공간의 잠재고객으로. 'ok' | 'closed'(없거나 닫힌 주소)
create or replace function public.public_intake_submit(p_slug text, p_payload jsonb)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l         public.public_intake_links%rowtype;
  v_name    text;
  v_company text;
  v_phone   text;
  v_email   text;
  v_message text;
  v_source  text;
  v_ip      text;
  v_contact text;
  v_at      timestamptz := now();
  v_iso     text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or length(p_payload::text) > 4000 then
    raise exception 'invalid payload' using errcode = '22023';
  end if;
  select li.* into l
    from public.public_intake_links li
    join public.workspaces w on w.id = li.workspace_id
    join public.os_access a on a.user_id = w.owner_id
   where li.slug = lower(btrim(coalesce(p_slug, ''))) and li.revoked_at is null
   limit 1;
  if l.id is null then
    return 'closed';
  end if;
  if coalesce(p_payload->>'consent', 'false') <> 'true' then
    raise exception 'consent required' using errcode = '22023';
  end if;
  -- 사람 눈에 안 보이는 칸 — 채워져 있으면 로봇. 접수된 것처럼 답하고 아무것도 안 넣는다
  if btrim(coalesce(p_payload->>'website', '')) <> '' then
    return 'ok';
  end if;

  v_name    := left(btrim(regexp_replace(coalesce(p_payload->>'name', ''), '[\r\n\t]+', ' ', 'g')), 30);
  v_company := left(btrim(regexp_replace(coalesce(p_payload->>'company_name', ''), '[\r\n\t]+', ' ', 'g')), 60);
  v_phone   := left(btrim(coalesce(p_payload->>'phone', '')), 30);
  v_email   := left(btrim(coalesce(p_payload->>'email', '')), 80);
  v_message := left(btrim(coalesce(p_payload->>'message', '')), 500);
  v_source  := btrim(coalesce(p_payload->>'source', ''));
  if v_name = '' and v_company = '' then
    raise exception 'name required' using errcode = '22023';
  end if;
  if v_phone = '' and v_email = '' then
    raise exception 'contact required' using errcode = '22023';
  end if;
  if v_phone <> '' and v_phone !~ '^[0-9+() -]{8,20}$' then
    raise exception 'invalid phone' using errcode = '22023';
  end if;
  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if v_source not in ('스레드', '인스타', '유튜브', '블로그') then
    v_source := '상담 링크';
  end if;

  -- 전체 둑(10분 300번) — 넘쳐도 서버가 버티게
  if (select count(*) from public.public_intake_log g
       where g.kind = 'intake_link' and g.at > now() - interval '10 minutes') >= 300 then
    raise exception 'too many requests' using errcode = '54000';
  end if;
  -- 한 곳(접속 주소)에서 10분 5번 — 앞단(Cloudflare)이 넣는 cf-connecting-ip 먼저. 원문은 남기지 않고 해시만
  v_ip := btrim(split_part(coalesce(
            nullif(current_setting('request.headers', true), '')::jsonb ->> 'cf-connecting-ip',
            nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for',
            nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-real-ip', ''), ',', 1));
  if v_ip <> '' then
    if (select count(*) from public.public_intake_log g
         where g.kind = 'intake_link_ip' and g.key_hash = public.hash_access_token(v_ip)
           and g.at > now() - interval '10 minutes') >= 5 then
      raise exception 'too many requests' using errcode = '54000';
    end if;
    insert into public.public_intake_log (kind, key_hash) values ('intake_link_ip', public.hash_access_token(v_ip));
  end if;
  -- 링크 하나에 10분 20번 · 하루 200번 — 주소가 퍼져 장난이 와도 그 사람 고객 목록이 넘치지 않게
  if (select count(*) from public.public_intake_log g
       where g.kind = 'intake_link' and g.key_hash = public.hash_access_token(l.id::text)
         and g.at > now() - interval '10 minutes') >= 20
     or (select count(*) from public.public_intake_log g
       where g.kind = 'intake_link' and g.key_hash = public.hash_access_token(l.id::text)
         and g.at > now() - interval '1 day') >= 200 then
    raise exception 'too many requests' using errcode = '54000';
  end if;
  -- 같은 연락처는 링크마다 하루 한 번 — 다시 눌러도 '접수됨'(두 줄 안 생김)
  v_contact := l.id::text || '|' || lower(coalesce(nullif(regexp_replace(v_phone, '[^0-9]', '', 'g'), ''), v_email));
  if exists (select 1 from public.public_intake_log g
              where g.kind = 'intake_link_contact' and g.key_hash = public.hash_access_token(v_contact)
                and g.at > now() - interval '1 day') then
    return 'ok';
  end if;
  insert into public.public_intake_log (kind, key_hash) values ('intake_link_contact', public.hash_access_token(v_contact));
  insert into public.public_intake_log (kind, key_hash) values ('intake_link', public.hash_access_token(l.id::text));

  -- 잠재고객(업체 기록 · 계약 전) — 앱이 영업 관리에서 손으로 등록할 때와 같은 모양(status waiting · sales.stage lead)
  insert into public.operations_clients (id, workspace_id, company_name, status, next_action, next_action_due_date, payload)
  values (
    gen_random_uuid()::text,
    l.workspace_id,
    coalesce(nullif(v_company, ''), v_name),
    'waiting',
    '상담 신청 — 연락드리기',
    (v_at at time zone 'Asia/Seoul')::date,
    jsonb_build_object(
      'contactName', v_name,
      'contactPhone', v_phone,
      'contactEmail', v_email,
      'sales', jsonb_build_object(
        'stage', 'lead', 'source', v_source, 'referrer', '', 'interests', '[]'::jsonb,
        'concern', v_message, 'expectedFee', null,
        'history', jsonb_build_array(jsonb_build_object('at', v_iso, 'from', null, 'to', 'lead')),
        'movedAt', v_iso),
      'activity', jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid()::text, 'kind', 'sales',
        'text', '상담 신청 링크로 직접 신청 — 잠재고객 등록 · ' || v_source,
        'serviceKey', null, 'at', v_iso))
    )
  );
  update public.public_intake_links set received_count = received_count + 1, last_received_at = v_at where id = l.id;
  return 'ok';
end;
$$;

-- 권한: 주인 함수는 로그인한 사람만 · 공개 함수는 누구나(함수 안에서 막는다)
revoke all on function public.intake_link_state(uuid) from public, anon;
revoke all on function public.intake_link_save(uuid, text, text) from public, anon;
revoke all on function public.intake_link_rotate(uuid) from public, anon;
revoke all on function public.intake_link_off(uuid) from public, anon;
grant execute on function public.intake_link_state(uuid) to authenticated;
grant execute on function public.intake_link_save(uuid, text, text) to authenticated;
grant execute on function public.intake_link_rotate(uuid) to authenticated;
grant execute on function public.intake_link_off(uuid) to authenticated;
revoke all on function public.public_intake_form(text) from public;
revoke all on function public.public_intake_submit(text, jsonb) from public;
grant execute on function public.public_intake_form(text) to anon, authenticated;
grant execute on function public.public_intake_submit(text, jsonb) to anon, authenticated;

-- (묶음: 맨 아래에서 한 번에 commit)

-- ───────────────────────────── 0028 가입하면 바로 쓰기(꺼진 채로 들어간다) ─────────────────────────────
-- =====================================================================
-- L-7 · D-610 가입하면 바로 쓰기 — **꺼 둔 채로** 들어간다(대표가 켜기 전에는 지금과 똑같다)
--
-- 지금: 로그인 화면에서 스스로 가입한 사람은 '이 계정은 아직 사용 승인 전이에요'(D-579)에서 멈추고,
--       대표가 SQL Editor 에서 supabase/manual/customer_provision.sql 로 한 사람씩 열어 준다.
-- 0028 뒤:
--   - 대표가 설정 › 작업공간 › '가입하면 바로 쓰기' 를 켜면(기본 꺼짐), 이메일 확인을 마친 새 가입자가
--     그 화면에서 [바로 시작하기] 한 번 → customer_provision.sql 과 같은 계정이 생긴다:
--     외부 구독 고객(pilot · customer) · 그 사람만 구성원인 빈 작업공간 하나 · 대표 자료 0 · 대표 자동 연결 없음.
--   - 받을 사람 수(기본 3명) · AI 시험 기간(기본 14일) · 월 AI 한도(기본 100) · 마케팅 AI 포함 여부는 대표가 정한다.
--     시험 기간이 끝나면 AI 단추만 멈춘다(자료 · 화면은 그대로) — 끝난 뒤 계정을 어떻게 할지는 가격(A3)과 함께 대표가 정한다.
--   - 자리가 다 차면 저절로 닫힌다(그다음 가입자는 다시 '승인 전' 화면 · 대표가 customer_provision.sql 로 열 수 있다).
--   - 막는 것: 이메일 확인 전 · 이미 등급이 있는 계정(대표 · 팀장 · 고객) · 다른 작업공간 구성원(팀장이 초대한 사람 등)
--     · 이미 작업공간이 있는 계정 · AI 권한 줄이 이미 있는 계정 · 예전에 이 길로 열렸던 계정(대표가 닫았으면 다시 못 엶)
--     · 한 시간에 10명 넘게 · 동시에 눌러 자리 수를 넘기기.
--
-- 방법: 더하기만 — 표 2(self_signup_policy · self_signup_accounts) · 함수 8. 기존 표 · 열 · 정책 · 함수는 그대로. 여러 번 실행해도 같다.
--   앱은 두 표에 쓰지 못하고 읽어도 0줄(정책 없음) — 함수로만. 대표 = 상담신청을 받는 작업공간 주인 + full(0025 support_is_operator 그대로).
-- 선행: 0019(os_access) · 0022(ai_entitlements) · 0024(audience) · 0025(support_is_operator).
-- 되돌리기: supabase/manual/rollback_0028.sql — 함수 실행 권한만 거둔다(이미 열린 계정 · 작업공간 · 기록은 그대로 · 새 가입자는 다시 '승인 전' 화면).
-- =====================================================================
-- (묶음: 거래는 맨 위 begin 하나)

do $$
begin
  if to_regclass('public.os_access') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'os_access' and column_name = 'audience')
     or to_regclass('public.ai_entitlements') is null
     or to_regprocedure('public.support_is_operator()') is null then
    raise exception '0019 · 0022 · 0024 · 0025 를 먼저 실행하세요. 0028 은 아무것도 바꾸지 않았습니다.';
  end if;
end $$;

-- 1) 가입 열기 설정 — 한 줄(id = 1) · 기본 꺼짐
create table if not exists public.self_signup_policy (
  id            integer primary key default 1 check (id = 1),
  open          boolean not null default false,
  seat_limit    integer not null default 3 check (seat_limit between 0 and 1000),
  trial_days    integer not null default 14 check (trial_days between 1 and 365),
  monthly_units integer not null default 100 check (monthly_units between 0 and 100000),
  marketing     boolean not null default true,
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
comment on table public.self_signup_policy is
  'L-7 가입하면 바로 쓰기 설정(한 줄). 기본 꺼짐. 앱은 함수(self_signup_admin*)로만 — 대표만 바꾼다.';
insert into public.self_signup_policy (id) values (1) on conflict (id) do nothing;
alter table public.self_signup_policy enable row level security;
revoke all on public.self_signup_policy from public, anon, authenticated;
grant select on public.self_signup_policy to authenticated; -- 읽기 정책이 없어 0줄(다른 표와 같은 모양 · 쓰기 권한 0)

-- 2) 이 길로 열린 계정 — 지우지 않는다(대표가 계정을 닫아도 다시 이 길로 열지 못하게 · 자리 수도 이것으로 센다)
create table if not exists public.self_signup_accounts (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  created_at   timestamptz not null default now()
);
comment on table public.self_signup_accounts is
  'L-7 가입하면 바로 쓰기로 열린 계정 기록. 앱은 읽기 · 쓰기 0(함수로만). 대표가 계정을 닫아도 줄은 남는다.';
create index if not exists self_signup_accounts_created_idx on public.self_signup_accounts (created_at);
alter table public.self_signup_accounts enable row level security;
revoke all on public.self_signup_accounts from public, anon, authenticated;
grant select on public.self_signup_accounts to authenticated; -- 읽기 정책이 없어 0줄(다른 표와 같은 모양 · 쓰기 권한 0)

-- 3) 남은 자리(설정 줄 기준) — 앱에서 직접 부르지 않는다
create or replace function public.self_signup_seats_left()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, p.seat_limit - (select count(*)::integer from public.self_signup_accounts))
  from public.self_signup_policy p where p.id = 1;
$$;
revoke all on function public.self_signup_seats_left() from public, anon, authenticated;

-- 4) 이 계정이 이 길로 시작할 수 있나(설정과 상관없는 조건만) — 'open' | 'unconfirmed' | 'not_eligible'. 앱에서 직접 부르지 않는다
create or replace function public.self_signup_check(p_uid uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
  v_confirmed timestamptz;
begin
  if p_uid is null then
    return 'not_eligible';
  end if;
  if exists (select 1 from public.self_signup_accounts s where s.user_id = p_uid)
     or exists (select 1 from public.workspace_members m where m.user_id = p_uid)
     or exists (select 1 from public.workspaces w where w.owner_id = p_uid)
     or exists (select 1 from public.ai_entitlements e where e.user_id = p_uid) then
    return 'not_eligible';
  end if;
  select u.email, u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = p_uid;
  if coalesce(btrim(v_email), '') = '' then
    return 'not_eligible';
  end if;
  if v_confirmed is null then
    return 'unconfirmed';
  end if;
  return 'open';
end;
$$;
revoke all on function public.self_signup_check(uuid) from public, anon, authenticated;

-- 5) 공개 — 지금 가입하면 바로 쓸 수 있나(가입 화면의 한 줄). 열림 여부만 — 사람 수 · 설정 값은 나가지 않는다
create or replace function public.signup_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.open from public.self_signup_policy p where p.id = 1), false)
     and coalesce(public.self_signup_seats_left(), 0) > 0;
$$;
revoke all on function public.signup_open() from public, anon, authenticated;
grant execute on function public.signup_open() to anon, authenticated;

-- 6) 로그인한 사람 — 나는 바로 시작할 수 있나: 'open' | 'closed' | 'has_access' | 'unconfirmed' | 'not_eligible'
create or replace function public.self_signup_state()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return 'closed';
  end if;
  if exists (select 1 from public.os_access a where a.user_id = uid) then
    return 'has_access';
  end if;
  if not public.signup_open() then
    return 'closed';
  end if;
  return public.self_signup_check(uid);
end;
$$;
revoke all on function public.self_signup_state() from public, anon, authenticated;
grant execute on function public.self_signup_state() to authenticated;

-- 7) [바로 시작하기] — customer_provision.sql 과 같은 계정을 그 사람 스스로(대표 연결 없음 · 업체 0)
--    결과: {status:'ok', workspace} | {status:'closed' | 'has_access' | 'unconfirmed' | 'not_eligible' | 'busy'}
create or replace function public.self_signup_start(p_name text default '')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.self_signup_policy;
  v_state text;
  v_name text;
  v_who text;
  v_ws uuid;
begin
  if uid is null then
    raise exception 'login required' using errcode = '42501';
  end if;
  -- 동시에 눌러도 자리 수를 넘지 않게 한 줄로 세운다
  perform pg_advisory_xact_lock(hashtext('public.self_signup_start'));
  if exists (select 1 from public.os_access a where a.user_id = uid) then
    return jsonb_build_object('status', 'has_access');
  end if;
  select * into p from public.self_signup_policy where id = 1;
  if p.id is null or not p.open or coalesce(public.self_signup_seats_left(), 0) <= 0 then
    return jsonb_build_object('status', 'closed');
  end if;
  v_state := public.self_signup_check(uid);
  if v_state <> 'open' then
    return jsonb_build_object('status', v_state);
  end if;
  if (select count(*) from public.self_signup_accounts s where s.created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('status', 'busy');
  end if;

  -- 작업공간 이름: 적은 이름(40자) → '<이름> 작업공간' → '내 작업공간'
  v_name := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 40);
  if v_name = '' then
    select left(btrim(regexp_replace(coalesce(u.raw_user_meta_data ->> 'display_name', ''), '\s+', ' ', 'g')), 34)
      into v_who from auth.users u where u.id = uid;
    v_name := case when coalesce(v_who, '') = '' then '내 작업공간' else v_who || ' 작업공간' end;
  end if;

  -- customer_provision.sql 과 같은 순서: AI 권한(customer · 시험) → 등급(pilot · customer) → 작업공간 · 주인 구성원
  insert into public.ai_entitlements (user_id, kind, plan, marketing, monthly_units, active_until, note)
  values (uid, 'customer', 'trial', p.marketing, p.monthly_units, now() + make_interval(days => p.trial_days), '가입하면 바로 쓰기(시험 기간)');
  insert into public.os_access (user_id, tier, note, audience) values (uid, 'pilot', '가입하면 바로 쓰기', 'customer');
  insert into public.workspaces (name, owner_id) values (v_name, uid) returning id into v_ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (v_ws, uid, 'owner');
  insert into public.self_signup_accounts (user_id, workspace_id) values (uid, v_ws);
  return jsonb_build_object('status', 'ok', 'workspace', v_ws);
end;
$$;
revoke all on function public.self_signup_start(text) from public, anon, authenticated;
grant execute on function public.self_signup_start(text) to authenticated;

-- 8) 대표 — 설정 읽기: {role:'owner', policy:{…}, used, seatsLeft} | {role:'none'}
create or replace function public.self_signup_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.self_signup_policy;
begin
  if not public.support_is_operator() then
    return jsonb_build_object('role', 'none');
  end if;
  select * into p from public.self_signup_policy where id = 1;
  return jsonb_build_object(
    'role', 'owner',
    'policy', jsonb_build_object('open', p.open, 'seatLimit', p.seat_limit, 'trialDays', p.trial_days,
                                 'monthlyUnits', p.monthly_units, 'marketing', p.marketing, 'updatedAt', p.updated_at),
    'used', (select count(*) from public.self_signup_accounts),
    'seatsLeft', coalesce(public.self_signup_seats_left(), 0)
  );
end;
$$;
revoke all on function public.self_signup_admin() from public, anon, authenticated;
grant execute on function public.self_signup_admin() to authenticated;

-- 9) 대표 — 설정 바꾸기(대표가 아니면 막힘 · 범위 밖 값은 막힘)
create or replace function public.self_signup_admin_save(p_open boolean, p_seat_limit integer, p_trial_days integer, p_monthly_units integer, p_marketing boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.support_is_operator() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_open is null or p_marketing is null
     or p_seat_limit is null or p_seat_limit not between 0 and 1000
     or p_trial_days is null or p_trial_days not between 1 and 365
     or p_monthly_units is null or p_monthly_units not between 0 and 100000 then
    raise exception 'invalid value' using errcode = '22023';
  end if;
  update public.self_signup_policy
     set open = p_open, seat_limit = p_seat_limit, trial_days = p_trial_days, monthly_units = p_monthly_units,
         marketing = p_marketing, updated_at = now(), updated_by = auth.uid()
   where id = 1;
  return public.self_signup_admin();
end;
$$;
revoke all on function public.self_signup_admin_save(boolean, integer, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.self_signup_admin_save(boolean, integer, integer, integer, boolean) to authenticated;

-- 10) 대표 — 이 길로 열린 계정(이메일 · 이름 · 작업공간 이름 · 연 때 · AI 시험 끝 · 지금 열려 있나). 업체 · 서류 · 기록은 나가지 않는다
create or replace function public.self_signup_admin_list(p_limit integer default 100)
returns table (email text, person_name text, workspace_name text, joined_at timestamptz, ai_until timestamptz, active boolean)
language sql
stable
security definer
set search_path = public
as $$
  select u.email::text,
         coalesce(nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''), '')::text,
         coalesce(w.name, '')::text,
         s.created_at,
         e.active_until,
         exists (select 1 from public.os_access a where a.user_id = s.user_id)
  from public.self_signup_accounts s
  left join auth.users u on u.id = s.user_id
  left join public.workspaces w on w.id = s.workspace_id
  left join public.ai_entitlements e on e.user_id = s.user_id
  where public.support_is_operator()
  order by s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;
revoke all on function public.self_signup_admin_list(integer) from public, anon, authenticated;
grant execute on function public.self_signup_admin_list(integer) to authenticated;

-- (묶음: 맨 아래에서 한 번에 commit)

-- 확인(바꾸지 않음): 설정 한 줄 — open = false 여야 한다(대표가 켜기 전)
select open, seat_limit, trial_days, monthly_units, marketing from public.self_signup_policy;

-- ───────────────────────────── 0029 가입 신청 → 대표가 앱에서 승인 · 거절 ─────────────────────────────
-- =====================================================================
-- D-635 가입 신청 → 대표가 앱에서 승인 · 거절
--
-- 지금: 로그인 화면에서 스스로 가입한 사람은 '이 계정은 아직 사용 승인 전이에요'(D-579)에서 멈추고,
--       대표가 SQL Editor 에서 supabase/manual/customer_provision.sql 로 한 사람씩 열어 준다.
--       (0028 '가입하면 바로 쓰기' 는 꺼 둔 채 — 대표: "승인이 있어야 회원가입이 되고 써 볼 수 있게 · 당분간은 내가 권한을 준다")
-- 0029 뒤:
--   - 대표 설정 › 작업공간 '가입 신청' 에 기다리는 사람이 뜬다(이메일 · 이름 · 소속 · 한 줄 소개 · 가입한 날 · 메일 확인 여부).
--   - [승인] 한 번 → 0028 [바로 시작하기] · customer_provision.sql 과 같은 계정:
--     외부 구독 고객(pilot · customer) · 그 사람만 구성원인 빈 작업공간 하나 · AI 권한 customer · 시험 기간(0028 설정 값) · 대표 자료 0 · 대표 자동 연결 없음.
--   - [거절] → 아무것도 지우지 않는다. 결정만 남긴다(누가 · 언제 · 메모). 그 사람은 '가입이 승인되지 않았어요' 화면.
--     거절한 사람도 나중에 [승인] 할 수 있다.
--   - 막는 것: 대표가 아닌 사람(목록 0줄 · 승인/거절 막힘) · 이메일 확인 전 승인 · 이미 등급이 있는 계정 · 다른 작업공간 구성원 ·
--     기다리는 초대가 있는 사람(팀장이 초대한 사람) · 이미 작업공간 · AI 권한이 있는 계정 · 홈페이지(고객 플랫폼)에서만 가입한 사람(목록에 안 뜸).
--   - 두 번 눌러도 한 번(같은 줄 · 같은 작업공간).
--
-- 방법: 더하기만 — 표 1(signup_decisions) · 함수 6. 기존 표 · 열 · 정책 · 함수는 그대로. 여러 번 실행해도 같다.
--   앱은 표에 쓰지 못하고 읽어도 0줄(정책 없음) — 함수로만. 대표 = 0025 support_is_operator() 그대로.
-- 선행: 0019(os_access) · 0022(ai_entitlements) · 0024(audience) · 0025(support_is_operator) · 0028(self_signup_policy · self_signup_check).
-- 되돌리기: supabase/manual/rollback_0029.sql — 함수 실행 권한만 거둔다(이미 연 계정 · 결정 기록은 그대로 · 화면은 예전 '승인 전' 으로).
-- =====================================================================
-- (묶음: 거래는 맨 위 begin 하나)

do $$
begin
  if to_regclass('public.os_access') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'os_access' and column_name = 'audience')
     or to_regclass('public.ai_entitlements') is null
     or to_regprocedure('public.support_is_operator()') is null
     or to_regclass('public.self_signup_policy') is null
     or to_regprocedure('public.self_signup_check(uuid)') is null then
    raise exception '0019 · 0022 · 0024 · 0025 · 0028 을 먼저 실행하세요. 0029 는 아무것도 바꾸지 않았습니다.';
  end if;
end $$;

-- 1) 대표의 결정 — 사람마다 한 줄(마지막 결정). 지우지 않는다(거절했다가 승인해도 거절한 때는 남는다)
create table if not exists public.signup_decisions (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  decision     text not null check (decision in ('approved', 'rejected')),
  note         text not null default '' check (char_length(note) <= 200),
  workspace_id uuid references public.workspaces (id) on delete set null,
  rejected_at  timestamptz,
  decided_at   timestamptz not null default now(),
  decided_by   uuid
);
comment on table public.signup_decisions is
  'D-635 가입 신청에 대한 대표의 결정(승인 · 거절). 앱은 읽기 · 쓰기 0(함수로만). 거절해도 계정 · 자료는 지우지 않는다.';
alter table public.signup_decisions enable row level security;
revoke all on public.signup_decisions from public, anon, authenticated;
grant select on public.signup_decisions to authenticated; -- 읽기 정책이 없어 0줄(다른 표와 같은 모양 · 쓰기 권한 0)

-- 2) 이 사람이 '가입 신청' 인가(내부 OS 가입 화면으로 가입 · 등급 · 작업공간 · AI 권한 · 기다리는 초대 없음) — 앱에서 직접 부르지 않는다
--    결과: 'pending' | 'unconfirmed' | 'has_access' | 'outside'(홈페이지에서만 가입) | 'not_eligible' | 'not_found'
create or replace function public.signup_request_check(p_uid uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
  v_meta jsonb;
  v_state text;
begin
  if p_uid is null then
    return 'not_found';
  end if;
  select u.email, coalesce(u.raw_user_meta_data, '{}'::jsonb) into v_email, v_meta from auth.users u where u.id = p_uid;
  if not found then
    return 'not_found';
  end if;
  if exists (select 1 from public.os_access a where a.user_id = p_uid) then
    return 'has_access';
  end if;
  -- 0014 와 같은 기준: 내부 OS 가입 화면으로 만든 계정(가입 정보 signup_app = internal_os 또는 display_name)
  --   (없는 칸은 null — null 이 '내부' 로 새지 않게 coalesce)
  if not (coalesce(v_meta ->> 'signup_app', '') = 'internal_os' or v_meta ? 'display_name') then
    return 'outside';
  end if;
  if exists (select 1 from public.workspace_invites i
             where lower(i.email) = lower(btrim(coalesce(v_email, ''))) and i.status = 'pending' and i.expires_at > now()) then
    return 'not_eligible';
  end if;
  -- 0028 과 같은 조건(구성원 · 작업공간 주인 · AI 권한 · 이 길로 열렸던 계정 · 이메일 없음 → not_eligible · 확인 전 → unconfirmed)
  v_state := public.self_signup_check(p_uid);
  if v_state = 'open' then
    return 'pending';
  end if;
  return v_state;
end;
$$;
revoke all on function public.signup_request_check(uuid) from public, anon, authenticated;

-- 3) 로그인한 사람 — 내 가입 신청은 어떻게 됐나: {status:'pending' | 'unconfirmed' | 'rejected' | 'has_access' | 'outside' | 'not_eligible'}
--    거절 메모는 나가지 않는다(대표 기록용)
create or replace function public.my_signup_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_state text;
begin
  if uid is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  v_state := public.signup_request_check(uid);
  if v_state in ('pending', 'unconfirmed')
     and exists (select 1 from public.signup_decisions d where d.user_id = uid and d.decision = 'rejected') then
    return jsonb_build_object('status', 'rejected');
  end if;
  return jsonb_build_object('status', v_state);
end;
$$;
revoke all on function public.my_signup_status() from public, anon, authenticated;
grant execute on function public.my_signup_status() to authenticated;

-- 4) 대표 — 가입 신청 목록(기다림 먼저 · 거절한 사람도). 대표가 아니면 0줄. 업체 · 서류 · 기록은 나가지 않는다
create or replace function public.signup_requests(p_limit integer default 100)
returns table (user_id uuid, email text, person_name text, company text, intro text, signed_up_at timestamptz,
               email_confirmed boolean, status text, decided_at timestamptz, note text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id,
         u.email::text,
         left(btrim(regexp_replace(coalesce(u.raw_user_meta_data ->> 'display_name', ''), '\s+', ' ', 'g')), 40)::text,
         left(btrim(regexp_replace(coalesce(u.raw_user_meta_data ->> 'company', ''), '\s+', ' ', 'g')), 60)::text,
         left(btrim(regexp_replace(coalesce(u.raw_user_meta_data ->> 'intro', ''), '\s+', ' ', 'g')), 120)::text,
         u.created_at,
         u.email_confirmed_at is not null,
         case when d.decision = 'rejected' then 'rejected' else 'pending' end,
         d.decided_at,
         case when d.decision = 'rejected' then coalesce(d.note, '') else '' end
  from auth.users u
  left join public.signup_decisions d on d.user_id = u.id
  where public.support_is_operator()
    and u.id <> auth.uid()
    -- 내부 OS 가입 화면으로 가입한 사람만 먼저 거른다(홈페이지 회원이 많아도 빠르게) — 자세한 조건은 아래 함수가 본다
    and (coalesce(u.raw_user_meta_data ->> 'signup_app', '') = 'internal_os' or coalesce(u.raw_user_meta_data, '{}'::jsonb) ? 'display_name')
    and public.signup_request_check(u.id) in ('pending', 'unconfirmed')
  order by (d.decision = 'rejected') nulls first, u.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;
revoke all on function public.signup_requests(integer) from public, anon, authenticated;
grant execute on function public.signup_requests(integer) to authenticated;

-- 5) 대표 — 기다리는 가입 신청 수(종 · 설정 메뉴 숫자). 거절한 사람은 세지 않는다. 대표가 아니면 0
create or replace function public.signup_requests_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when not public.support_is_operator() then 0 else (
    select count(*)::integer
    from auth.users u
    where u.id <> auth.uid()
      and not exists (select 1 from public.signup_decisions d where d.user_id = u.id and d.decision = 'rejected')
      and (coalesce(u.raw_user_meta_data ->> 'signup_app', '') = 'internal_os' or coalesce(u.raw_user_meta_data, '{}'::jsonb) ? 'display_name')
      and public.signup_request_check(u.id) in ('pending', 'unconfirmed')
  ) end;
$$;
revoke all on function public.signup_requests_count() from public, anon, authenticated;
grant execute on function public.signup_requests_count() to authenticated;

-- 6) 대표 — [승인]: 0028 [바로 시작하기] 와 같은 계정을 그 사람에게(대표 연결 없음 · 업체 0)
--    결과: {status:'ok', workspace} | {status:'has_access' | 'unconfirmed' | 'not_eligible' | 'outside' | 'not_found'}
create or replace function public.signup_approve(p_uid uuid, p_name text default '')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p public.self_signup_policy;
  v_state text;
  v_meta jsonb;
  v_name text;
  v_who text;
  v_ws uuid;
  v_op uuid;
  v_sub text;
  v_claims text;
begin
  if not public.support_is_operator() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- 두 번 눌러도 · 0028 [바로 시작하기] 와 겹쳐도 한 줄로 세운다(같은 잠금)
  perform pg_advisory_xact_lock(hashtext('public.self_signup_start'));
  v_state := public.signup_request_check(p_uid);
  if v_state <> 'pending' then
    return jsonb_build_object('status', v_state);
  end if;
  select * into p from public.self_signup_policy where id = 1;
  select coalesce(u.raw_user_meta_data, '{}'::jsonb) into v_meta from auth.users u where u.id = p_uid;

  -- 작업공간 이름: 대표가 적은 이름(40자) → 소속 → '<이름> 작업공간' → '내 작업공간'
  v_name := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 40);
  if v_name = '' then
    v_name := left(btrim(regexp_replace(coalesce(v_meta ->> 'company', ''), '\s+', ' ', 'g')), 40);
  end if;
  if v_name = '' then
    v_who := left(btrim(regexp_replace(coalesce(v_meta ->> 'display_name', ''), '\s+', ' ', 'g')), 34);
    v_name := case when coalesce(v_who, '') = '' then '내 작업공간' else v_who || ' 작업공간' end;
  end if;

  -- 이 아래 네 줄은 customer_provision.sql(SQL Editor)과 같은 '서버 작업' 으로 넣는다 — 구성원 · 작업공간 지킴이(0019)는
  -- 로그인한 사람이 다른 사람을 넣는 것을 막고, 서버 작업(로그인한 사람 없음)은 막지 않는다. 대표 확인은 맨 위에서 끝났다.
  -- 이 거래 안에서만 로그인 정보를 비웠다가 바로 되돌린다(set_config … true = 이 거래 안에서만).
  v_op := auth.uid();
  v_sub := current_setting('request.jwt.claim.sub', true);
  v_claims := current_setting('request.jwt.claims', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  -- 0028 · customer_provision.sql 과 같은 순서: AI 권한(customer · 시험) → 등급(pilot · customer) → 작업공간 · 주인 구성원
  insert into public.ai_entitlements (user_id, kind, plan, marketing, monthly_units, active_until, note)
  values (p_uid, 'customer', 'trial', coalesce(p.marketing, true), coalesce(p.monthly_units, 100),
          now() + make_interval(days => coalesce(p.trial_days, 14)), '가입 신청 승인(시험 기간)');
  insert into public.os_access (user_id, tier, note, audience) values (p_uid, 'pilot', '가입 신청 승인', 'customer');
  insert into public.workspaces (name, owner_id) values (v_name, p_uid) returning id into v_ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (v_ws, p_uid, 'owner');

  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  insert into public.signup_decisions (user_id, decision, workspace_id, decided_at, decided_by)
  values (p_uid, 'approved', v_ws, now(), v_op)
  on conflict (user_id) do update set decision = 'approved', workspace_id = excluded.workspace_id,
    decided_at = excluded.decided_at, decided_by = excluded.decided_by;
  return jsonb_build_object('status', 'ok', 'workspace', v_ws);
end;
$$;
revoke all on function public.signup_approve(uuid, text) from public, anon, authenticated;
grant execute on function public.signup_approve(uuid, text) to authenticated;

-- 7) 대표 — [거절]: 결정만 남긴다(계정 · 자료는 그대로 · 나중에 승인할 수 있다). 메모는 대표만 본다
--    결과: {status:'ok'} | {status:'has_access' | 'not_eligible' | 'outside' | 'not_found'}
create or replace function public.signup_reject(p_uid uuid, p_note text default '')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_state text;
begin
  if not public.support_is_operator() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('public.self_signup_start'));
  v_state := public.signup_request_check(p_uid);
  if v_state not in ('pending', 'unconfirmed') then
    return jsonb_build_object('status', v_state);
  end if;
  insert into public.signup_decisions (user_id, decision, note, rejected_at, decided_at, decided_by)
  values (p_uid, 'rejected', left(btrim(coalesce(p_note, '')), 200), now(), now(), auth.uid())
  on conflict (user_id) do update set decision = 'rejected', note = excluded.note, rejected_at = excluded.rejected_at,
    decided_at = excluded.decided_at, decided_by = excluded.decided_by;
  return jsonb_build_object('status', 'ok');
end;
$$;
revoke all on function public.signup_reject(uuid, text) from public, anon, authenticated;
grant execute on function public.signup_reject(uuid, text) to authenticated;

-- (묶음: 맨 아래에서 한 번에 commit)

-- 확인(바꾸지 않음): 결정 기록 표 · 함수 6
select (select count(*) from pg_tables where schemaname = 'public' and tablename = 'signup_decisions') as decisions_table,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
          and p.proname in ('signup_request_check', 'my_signup_status', 'signup_requests', 'signup_requests_count', 'signup_approve', 'signup_reject')) as functions;

-- ───────────────────────────── 0030 AI 답 보관(끊겨도 이어 받기) ─────────────────────────────
-- =====================================================================
-- D-638 AI 답 보관 — 한 번 누른 AI 요청은 화면을 떠나도 · 휴대폰이 다른 앱으로 가도 답을 다시 받는다(두 번 세지 않게)
--   운영 미적용(대표 승인 뒤 SQL Editor 에서)
--
-- 왜: 대표(2026-11-19) "한 번 누르면 중간에 이탈 · 이동 · 멈춤 · 코인이 갑자기 … 토큰을 팔 거니까 백그라운드에서 돌아가도 전혀 문제없게".
--   지금은 휴대폰이 다른 앱으로 가 연결이 끊기면, 서버는 AI 답을 다 만들고(사용량도 세고) 화면은 답을 못 받는다.
--   다시 누르면 새 요청 = 한 번 더 센다. 서버 기억(같은 서버 15분)에만 기대고 있어 서버가 바뀌면 답이 사라진다.
--
-- 방법(추가만 — 표 1 · 정책 2 · 색인 1):
--   - ai_assist_results: 누가(user_id) · 요청 번호(request_id) · 단추(assist_id) · 답(run) · 만든 때.
--   - 서버 함수(/api/ai-assist)가 답을 만든 직후 그 사람 로그인으로 한 줄 넣는다(service_role 키 없음).
--   - 화면이 같은 요청 번호로 다시 물으면 서버가 이 줄을 먼저 본다 — 있으면 AI 를 다시 부르지 않고 그대로 돌려준다(사용량도 안 셈).
--   - 읽기 · 넣기는 자기 줄만(RLS). 고치기 · 지우기 권한 없음(답은 한 번 쓰면 그대로).
--     자기 줄에 가짜 답을 넣어도 자기 화면에만 보인다 — AI 를 공짜로 부르는 길은 없다(서버는 보관된 답을 돌려줄 뿐).
--   - 요청 번호 모양 · 답 크기(256KB)는 표가 막는다.
-- 기존 표 · 열 · 정책 · 자료는 건드리지 않는다. 여러 번 실행해도 같다. 선행 없음(auth.users 만).
-- 되돌리기(필요할 때만): revoke select, insert on public.ai_assist_results from authenticated — 서버는 보관 없이 예전처럼 돈다.
-- =====================================================================
-- (묶음: 거래는 맨 위 begin 하나)

create table if not exists public.ai_assist_results (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  request_id text not null check (request_id ~ '^[A-Za-z0-9_-]{8,80}$'),
  assist_id text not null check (assist_id ~ '^[a-z0-9_.-]{1,60}$'),
  run jsonb not null check (jsonb_typeof(run) = 'object' and pg_column_size(run) <= 262144),
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

alter table public.ai_assist_results enable row level security;

revoke all on public.ai_assist_results from public, anon, authenticated;
grant select, insert on public.ai_assist_results to authenticated;

drop policy if exists ai_assist_results_select_own on public.ai_assist_results;
create policy ai_assist_results_select_own on public.ai_assist_results
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists ai_assist_results_insert_own on public.ai_assist_results;
create policy ai_assist_results_insert_own on public.ai_assist_results
  for insert to authenticated
  with check (user_id = auth.uid());

create index if not exists ai_assist_results_created_idx on public.ai_assist_results (created_at);

-- (묶음: 맨 아래에서 한 번에 commit)

-- 확인(바꾸지 않음): 표 1 · 정책 2 · 앱 계정 권한 INSERT,SELECT
select (select count(*) from pg_tables where schemaname = 'public' and tablename = 'ai_assist_results') as results_table,
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'ai_assist_results') as policies,
       (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
          where table_schema = 'public' and table_name = 'ai_assist_results' and grantee = 'authenticated') as app_grants;

-- ───────────────────────────── 0031 서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로) ─────────────────────────────
-- =====================================================================
-- L-41 · D-652 서류 올리기 링크 — 업체 대표가 로그인 없이 링크 하나로 서류를 올린다
--
-- 지금: 업체 대표에게 서류를 받으려면 카톡 · 메일로 파일을 받아 컨설턴트가 내려받고 → 서류함에 다시 올렸다(두 번 일 · 파일이 흩어짐).
-- 0031 뒤:
--   - 업체 서류함에서 [올리기 링크 만들기] → 받을 서류를 고르고 → https://…/up/<20자리> 주소가 생긴다(업체마다 열린 링크는 하나).
--   - 업체 대표는 휴대폰으로 열어 서류마다 [올리기] → 파일이 그 업체 보관함 폴더로 바로 들어간다(로그인 0 · 앱 설치 0).
--   - 컨설턴트 서류함에 '고객이 올린 서류 n' → [이 칸에 넣기] 한 번이면 그 칸이 '받음'(넣기 전에는 기록이 바뀌지 않는다).
--   - 막는 것: 기한(1~30일 · 기본 14일) · 닫은 링크 · 사용 승인이 끊긴 주인 · 고른 서류 밖 칸 · 형식(PDF · 사진 · 한글 · 워드 · 엑셀 · 파워포인트 · 글)
--     · 한 파일 20MB · 링크 하나에 80개 · 링크 하나 10분 40번 · 하루 150번 · 한 곳(접속 주소)에서 10분 40번 · 전체 10분 600번
--     · 보관함에는 서버가 정해 준 경로(예약 30분 안)에만 넣을 수 있다 — 다른 폴더 · 다른 업체 · 덮어쓰기 0.
--   - 공개 화면이 읽는 것: 업체 이름 · 받을 서류 이름 · 한 줄 안내 · 기한 · 서류마다 올린 개수뿐(작업공간 · 주인 · 다른 서류 · 파일 이름 0).
--
-- 방법: 더하기만 — 표 2(client_upload_links · client_upload_files) · 함수 13(앱이 부르는 9 · 안쪽 4) · 보관함 넣기 정책 1. 기존 표 · 열 · 정책 · 함수는 그대로. 여러 번 실행해도 같다.
--   앱은 표에 직접 쓰지 못한다(읽기도 그 작업공간에 쓸 수 있는 사람만) — 함수로만.
-- 선행: 0017(public_intake_log · hash_access_token) · 0019(os_access) · 0026(view_consent_ok).
-- 되돌리기: supabase/manual/rollback_0031.sql — 함수 실행 권한 · 보관함 넣기 정책만 거둔다(링크 · 받은 파일 기록 · 파일은 그대로 · 공개 주소는 '닫힘').
-- =====================================================================
-- (묶음: 거래는 맨 위 begin 하나)

do $$
begin
  if to_regclass('public.public_intake_log') is null or to_regprocedure('public.hash_access_token(text)') is null
     or to_regclass('public.os_access') is null or to_regprocedure('public.view_consent_ok(uuid)') is null then
    raise exception '0017 · 0019 · 0026 을 먼저 실행하세요. 0031 은 아무것도 바꾸지 않았습니다.';
  end if;
end $$;

-- 1) 올리기 링크 — 업체마다 열린 링크는 하나(닫은 링크는 기록으로 남김)
create table if not exists public.client_upload_links (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  client_id        text not null,
  slug             text not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 20),
  title            text not null default '',
  note             text not null default '',
  docs             jsonb not null default '[]'::jsonb,
  expires_at       timestamptz not null default now() + interval '14 days',
  created_by       uuid,
  created_at       timestamptz not null default now(),
  revoked_at       timestamptz,
  uploaded_count   integer not null default 0,
  last_uploaded_at timestamptz
);
comment on table public.client_upload_links is
  'L-41 업체마다 서류 올리기 링크(/up/<slug>). 앱은 함수(upload_link_*)로만 쓴다 — 표에 직접 쓰기 0. 닫은 링크는 지우지 않고 revoked_at 만 적는다.';
create unique index if not exists client_upload_links_slug_idx on public.client_upload_links (slug);
create unique index if not exists client_upload_links_one_open_idx on public.client_upload_links (workspace_id, client_id) where revoked_at is null;

-- 2) 링크로 받은 파일 — 예약(reserved) → 올림(uploaded) → 넣음(accepted) / 안 씀(dismissed)
create table if not exists public.client_upload_files (
  id           uuid primary key default gen_random_uuid(),
  link_id      uuid not null references public.client_upload_links (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id    text not null,
  doc_key      text not null default '',
  doc_label    text not null default '',
  file_name    text not null,
  file_size    bigint not null default 0,
  content_type text not null default '',
  storage_path text not null,
  status       text not null default 'reserved' check (status in ('reserved', 'uploaded', 'accepted', 'dismissed')),
  created_at   timestamptz not null default now(),
  uploaded_at  timestamptz,
  decided_at   timestamptz,
  decided_by   uuid
);
comment on table public.client_upload_files is
  'L-41 올리기 링크로 받은 파일. 공개 함수가 경로를 정해 예약하고, 올린 뒤 uploaded · 컨설턴트가 칸에 넣으면 accepted. 앱 쓰기는 함수로만.';
create unique index if not exists client_upload_files_path_idx on public.client_upload_files (storage_path);
create index if not exists client_upload_files_client_idx on public.client_upload_files (workspace_id, client_id, status);
create index if not exists client_upload_files_link_idx on public.client_upload_files (link_id, created_at desc);

-- 3) 읽기 — 그 작업공간에 쓸 수 있는 사람만(대표가 팀장 작업공간을 볼 때는 허락 동안만 — 0026). 쓰기는 함수로만.
alter table public.client_upload_links enable row level security;
alter table public.client_upload_files enable row level security;
revoke all on public.client_upload_links from public, anon, authenticated;
revoke all on public.client_upload_files from public, anon, authenticated;
grant select on public.client_upload_links to authenticated;
grant select on public.client_upload_files to authenticated;
drop policy if exists "Upload links: workspace writers can read" on public.client_upload_links;
create policy "Upload links: workspace writers can read"
  on public.client_upload_links for select to authenticated
  using (public.can_write_workspace(workspace_id) and public.view_consent_ok(workspace_id));
drop policy if exists "Upload files: workspace writers can read" on public.client_upload_files;
create policy "Upload files: workspace writers can read"
  on public.client_upload_files for select to authenticated
  using (public.can_write_workspace(workspace_id) and public.view_consent_ok(workspace_id));
-- 0026 과 같은 문(고객 자료 표마다 하나) — 새 표에도
drop policy if exists "zz View consent gate" on public.client_upload_links;
create policy "zz View consent gate" on public.client_upload_links as restrictive for all to authenticated
  using (not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[])))
  with check (not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[])));
drop policy if exists "zz View consent gate" on public.client_upload_files;
create policy "zz View consent gate" on public.client_upload_files as restrictive for all to authenticated
  using (not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[])))
  with check (not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[])));

-- workspace_id 는 한 번 정하면 못 바꾼다(0023 이 있으면 같은 장치)
do $$
begin
  if to_regprocedure('public.workspace_id_lock()') is not null then
    execute 'drop trigger if exists zz_workspace_id_lock on public.client_upload_links';
    execute 'create trigger zz_workspace_id_lock before update of workspace_id on public.client_upload_links for each row execute function public.workspace_id_lock()';
    execute 'drop trigger if exists zz_workspace_id_lock on public.client_upload_files';
    execute 'create trigger zz_workspace_id_lock before update of workspace_id on public.client_upload_files for each row execute function public.workspace_id_lock()';
  end if;
end $$;

-- 4) 쓸 수 있는 사람 확인(함수 안에서만 씀) — 그 작업공간에 쓸 수 있고 · 사용 승인 · 허락(0026) · 그 작업공간의 업체
create or replace function public.upload_link_access_check(p_ws uuid, p_client text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_ws is null or coalesce(p_client, '') = ''
     or not public.can_write_workspace(p_ws) or not public.view_consent_ok(p_ws) then
    raise exception '이 업체 서류함에 쓸 수 있는 사람만 올리기 링크를 다룰 수 있어요.' using errcode = '42501';
  end if;
  if public.my_os_access() is null then
    raise exception '사용 승인 뒤에 쓸 수 있어요.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.operations_clients c where c.id = p_client and c.workspace_id = p_ws) then
    raise exception '이 작업공간에 없는 업체예요.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.upload_link_access_check(uuid, text) from public, anon, authenticated;

-- 5) 업체 서류함 상태 — 쓸 수 없는 사람이면 {role:none}(앱은 아무것도 안 그림)
create or replace function public.upload_link_state(p_ws uuid, p_client text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l public.client_upload_links%rowtype;
begin
  if auth.uid() is null or p_ws is null or coalesce(p_client, '') = ''
     or not public.can_write_workspace(p_ws) or not public.view_consent_ok(p_ws) or public.my_os_access() is null
     or not exists (select 1 from public.operations_clients c where c.id = p_client and c.workspace_id = p_ws) then
    return jsonb_build_object('role', 'none');
  end if;
  select * into l from public.client_upload_links where workspace_id = p_ws and client_id = p_client and revoked_at is null;
  return jsonb_build_object(
    'role', 'writer',
    'link', case when l.id is null then null else jsonb_build_object(
      'slug', l.slug, 'title', l.title, 'note', l.note, 'docs', l.docs,
      'expiresAt', l.expires_at, 'expired', l.expires_at <= now(),
      'createdAt', l.created_at, 'uploaded', l.uploaded_count, 'lastAt', l.last_uploaded_at) end,
    'files', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id, 'docKey', f.doc_key, 'docLabel', f.doc_label, 'fileName', f.file_name,
               'fileSize', f.file_size, 'contentType', f.content_type, 'storagePath', f.storage_path,
               'uploadedAt', f.uploaded_at) order by f.uploaded_at desc)
        from (select * from public.client_upload_files
               where workspace_id = p_ws and client_id = p_client and status = 'uploaded'
               order by uploaded_at desc limit 100) f), '[]'::jsonb),
    'accepted', (select count(*) from public.client_upload_files where workspace_id = p_ws and client_id = p_client and status = 'accepted'),
    'closed', (select count(*) from public.client_upload_links where workspace_id = p_ws and client_id = p_client and revoked_at is not null)
  );
end;
$$;

-- 받을 서류 목록 다듬기(함수 안에서만 씀) — [{key,label}] · 키는 영문 · 숫자 · _ - 60자 · 이름 40자 · 30개 · 같은 키 한 번
create or replace function public.upload_link_clean_docs(p_docs jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', k, 'label', lb) order by n), '[]'::jsonb)
    from (
      select k, lb, n
        from (
          select distinct on (k) k, lb, n
            from (
              select btrim(d->>'key') as k,
                     left(btrim(regexp_replace(coalesce(d->>'label', ''), '[\r\n\t]+', ' ', 'g')), 40) as lb,
                     n
                from jsonb_array_elements(case when jsonb_typeof(p_docs) = 'array' then p_docs else '[]'::jsonb end) with ordinality as e(d, n)
               where jsonb_typeof(d) = 'object'
            ) x
           where k ~ '^[A-Za-z0-9_-]{1,60}$' and lb <> ''
           order by k, n
        ) d
       order by n
       limit 30
    ) y;
$$;
revoke all on function public.upload_link_clean_docs(jsonb) from public, anon, authenticated;

-- 6) 만들기 · 고치기(열린 링크가 있으면 받을 서류 · 안내 · 기한만 고친다 — 주소 그대로)
create or replace function public.upload_link_save(p_ws uuid, p_client text, p_docs jsonb, p_days integer default 14, p_note text default '')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_docs  jsonb := public.upload_link_clean_docs(p_docs);
  v_days  integer := least(greatest(coalesce(p_days, 14), 1), 30);
  v_note  text := left(btrim(regexp_replace(coalesce(p_note, ''), '[\r\n\t]+', ' ', 'g')), 120);
  v_title text;
begin
  perform public.upload_link_access_check(p_ws, p_client);
  if p_docs is not null and length(p_docs::text) > 20000 then
    raise exception 'docs too large' using errcode = '22023';
  end if;
  select left(btrim(regexp_replace(coalesce(c.company_name, ''), '[\r\n\t]+', ' ', 'g')), 60) into v_title
    from public.operations_clients c where c.id = p_client and c.workspace_id = p_ws;
  if coalesce(v_title, '') = '' then v_title := '서류 올리기'; end if;
  perform pg_advisory_xact_lock(hashtext('upload_link:' || p_ws::text || ':' || p_client));
  update public.client_upload_links
     set docs = v_docs, note = v_note, title = v_title, expires_at = now() + make_interval(days => v_days)
   where workspace_id = p_ws and client_id = p_client and revoked_at is null;
  if not found then
    insert into public.client_upload_links (workspace_id, client_id, title, note, docs, expires_at, created_by)
    values (p_ws, p_client, v_title, v_note, v_docs, now() + make_interval(days => v_days), auth.uid());
  end if;
  return public.upload_link_state(p_ws, p_client);
end;
$$;

-- 7) 주소 새로 만들기 — 예전 주소는 그 순간부터 안 받는다(받을 서류 · 안내 · 기한은 그대로)
create or replace function public.upload_link_rotate(p_ws uuid, p_client text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l public.client_upload_links%rowtype;
begin
  perform public.upload_link_access_check(p_ws, p_client);
  perform pg_advisory_xact_lock(hashtext('upload_link:' || p_ws::text || ':' || p_client));
  select * into l from public.client_upload_links where workspace_id = p_ws and client_id = p_client and revoked_at is null;
  if l.id is null then
    raise exception '아직 만든 링크가 없어요.' using errcode = '22023';
  end if;
  update public.client_upload_links set revoked_at = now() where id = l.id;
  insert into public.client_upload_links (workspace_id, client_id, title, note, docs, expires_at, created_by)
  values (p_ws, p_client, l.title, l.note, l.docs, greatest(l.expires_at, now() + interval '1 day'), auth.uid());
  return public.upload_link_state(p_ws, p_client);
end;
$$;

-- 8) 닫기 — 다시 받으려면 [만들기](새 주소)
create or replace function public.upload_link_off(p_ws uuid, p_client text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.upload_link_access_check(p_ws, p_client);
  update public.client_upload_links set revoked_at = now()
   where workspace_id = p_ws and client_id = p_client and revoked_at is null;
  return public.upload_link_state(p_ws, p_client);
end;
$$;

-- 9) 받은 파일 정하기 — accepted(칸에 넣음) · dismissed(안 씀) · uploaded(되돌리기). changed = 이번 부름이 바꿨는지(두 번 눌러도 한 번)
create or replace function public.upload_link_decide(p_file uuid, p_decision text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  f public.client_upload_files%rowtype;
  v_to text := btrim(coalesce(p_decision, ''));
  v_n integer;
begin
  if v_to not in ('accepted', 'dismissed', 'uploaded') then
    raise exception 'invalid decision' using errcode = '22023';
  end if;
  select * into f from public.client_upload_files where id = p_file;
  if f.id is null then
    raise exception '이 업체 서류함에 쓸 수 있는 사람만 올리기 링크를 다룰 수 있어요.' using errcode = '42501';
  end if;
  perform public.upload_link_access_check(f.workspace_id, f.client_id);
  if f.status = 'reserved' then
    raise exception '아직 다 올라오지 않은 파일이에요.' using errcode = '22023';
  end if;
  update public.client_upload_files
     set status = v_to,
         decided_at = case when v_to = 'uploaded' then null else now() end,
         decided_by = case when v_to = 'uploaded' then null else auth.uid() end
   where id = f.id and status <> v_to
     and (v_to <> 'uploaded' and status = 'uploaded' or v_to = 'uploaded' and status in ('accepted', 'dismissed'));
  get diagnostics v_n = row_count;
  return jsonb_build_object('changed', v_n > 0,
    'status', (select status from public.client_upload_files where id = f.id));
end;
$$;

-- 10) 작업공간 전체 — 업체마다 '고객이 올리고 아직 칸에 안 넣은 파일' 수(고객 관리 카드 · 오늘)
create or replace function public.upload_link_inbox(p_ws uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_ws is null or not public.can_write_workspace(p_ws) or not public.view_consent_ok(p_ws)
     or public.my_os_access() is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('clientId', client_id, 'waiting', n, 'lastAt', last_at) order by last_at desc)
      from (select f.client_id, count(*) as n, max(f.uploaded_at) as last_at
              from public.client_upload_files f
             where f.workspace_id = p_ws and f.status = 'uploaded'
             group by f.client_id) x), '[]'::jsonb);
end;
$$;

-- 열린 링크 찾기(함수 안에서만 씀) — 닫힘 · 기한 지남 · 사용 승인이 끊긴 주인 · 지운 업체면 없음
create or replace function public.upload_link_open(p_slug text)
returns public.client_upload_links
language sql
stable
security definer
set search_path = public
as $$
  select li.*
    from public.client_upload_links li
    join public.workspaces w on w.id = li.workspace_id
    join public.os_access a on a.user_id = w.owner_id
    join public.operations_clients c on c.id = li.client_id and c.workspace_id = li.workspace_id
   where li.slug = lower(btrim(coalesce(p_slug, ''))) and li.revoked_at is null and li.expires_at > now()
   limit 1;
$$;
revoke all on function public.upload_link_open(text) from public, anon, authenticated;

-- 11) 공개 화면 — 업체 이름 · 안내 · 받을 서류 · 기한 · 서류마다 올린 개수. 없거나 닫힌 주소면 null
create or replace function public.public_upload_form(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l public.client_upload_links%rowtype;
begin
  l := public.upload_link_open(p_slug);
  if l.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'title', l.title, 'note', l.note, 'docs', l.docs, 'expiresAt', l.expires_at,
    'sent', coalesce((
      select jsonb_agg(jsonb_build_object('key', doc_key, 'n', n, 'lastAt', last_at) order by last_at desc)
        from (select f.doc_key, count(*) as n, max(f.uploaded_at) as last_at
                from public.client_upload_files f
               where f.link_id = l.id and f.status in ('uploaded', 'accepted')
               group by f.doc_key) x), '[]'::jsonb));
end;
$$;

-- 12) 공개 예약 — 서버가 경로를 정한다(올리는 사람이 폴더 · 이름을 고르지 못한다). {status:'ok', id, path} | {status:'closed'}
create or replace function public.public_upload_reserve(p_slug text, p_doc_key text, p_file_name text, p_size bigint, p_type text default '')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l       public.client_upload_links%rowtype;
  v_key   text := btrim(coalesce(p_doc_key, ''));
  v_label text := '';
  v_name  text := left(btrim(regexp_replace(coalesce(p_file_name, ''), '[\r\n\t/\\]+', '_', 'g')), 120);
  v_ext   text;
  v_type  text := left(btrim(coalesce(p_type, '')), 100);
  v_id    uuid := gen_random_uuid();
  v_path  text;
  v_ip    text;
begin
  l := public.upload_link_open(p_slug);
  if l.id is null then
    return jsonb_build_object('status', 'closed');
  end if;
  if v_name = '' then
    raise exception 'name required' using errcode = '22023';
  end if;
  v_ext := lower(substring(v_name from '\.([A-Za-z0-9]{1,5})$'));
  if v_ext is null or v_ext not in ('pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'tif', 'tiff',
                                   'hwp', 'hwpx', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt') then
    raise exception 'file type not allowed' using errcode = '22023';
  end if;
  if p_size is null or p_size <= 0 or p_size > 20971520 then
    raise exception 'file size' using errcode = '22023';
  end if;
  if v_key <> '' then
    select left(coalesce(d->>'label', ''), 40) into v_label
      from jsonb_array_elements(l.docs) d where d->>'key' = v_key limit 1;
    if v_label is null or v_label = '' then
      raise exception 'unknown document' using errcode = '22023';
    end if;
  end if;
  if v_type !~ '^[A-Za-z0-9.+/-]*$' then v_type := ''; end if;

  -- 전체 둑(10분 600번)
  if (select count(*) from public.public_intake_log g
       where g.kind = 'upload_link' and g.at > now() - interval '10 minutes') >= 600 then
    raise exception 'too many requests' using errcode = '54000';
  end if;
  -- 한 곳(접속 주소)에서 10분 40번 — 원문은 남기지 않고 해시만
  v_ip := btrim(split_part(coalesce(
            nullif(current_setting('request.headers', true), '')::jsonb ->> 'cf-connecting-ip',
            nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for',
            nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-real-ip', ''), ',', 1));
  if v_ip <> '' then
    if (select count(*) from public.public_intake_log g
         where g.kind = 'upload_link_ip' and g.key_hash = public.hash_access_token(v_ip)
           and g.at > now() - interval '10 minutes') >= 40 then
      raise exception 'too many requests' using errcode = '54000';
    end if;
  end if;
  -- 링크 하나에 10분 40번 · 하루 150번 · 모두 80개
  if (select count(*) from public.public_intake_log g
       where g.kind = 'upload_link' and g.key_hash = public.hash_access_token(l.id::text)
         and g.at > now() - interval '10 minutes') >= 40
     or (select count(*) from public.public_intake_log g
       where g.kind = 'upload_link' and g.key_hash = public.hash_access_token(l.id::text)
         and g.at > now() - interval '1 day') >= 150 then
    raise exception 'too many requests' using errcode = '54000';
  end if;
  if (select count(*) from public.client_upload_files f where f.link_id = l.id) >= 80 then
    raise exception 'too many files' using errcode = '54000';
  end if;
  if v_ip <> '' then
    insert into public.public_intake_log (kind, key_hash) values ('upload_link_ip', public.hash_access_token(v_ip));
  end if;
  insert into public.public_intake_log (kind, key_hash) values ('upload_link', public.hash_access_token(l.id::text));

  -- 경로: <작업공간>/<업체>/upload-link/<링크>/<파일 id>.<형식> — 첫 폴더가 작업공간이라 컨설턴트는 기존 보관함 규칙 그대로 읽는다
  v_path := l.workspace_id::text || '/' || l.client_id || '/upload-link/' || l.id::text || '/' || v_id::text || '.' || v_ext;
  insert into public.client_upload_files (id, link_id, workspace_id, client_id, doc_key, doc_label, file_name, file_size, content_type, storage_path)
  values (v_id, l.id, l.workspace_id, l.client_id, v_key, v_label, v_name, p_size, v_type, v_path);
  return jsonb_build_object('status', 'ok', 'id', v_id, 'path', v_path);
end;
$$;

-- 보관함 넣기 허락(정책이 부름) — 방금 예약한(30분 안) 경로 · 열린 링크만
create or replace function public.upload_link_path_ok(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.client_upload_files f
      join public.client_upload_links l on l.id = f.link_id
      join public.workspaces w on w.id = l.workspace_id
      join public.os_access a on a.user_id = w.owner_id
      join public.operations_clients c on c.id = l.client_id and c.workspace_id = l.workspace_id
     where f.storage_path = p_name and f.status = 'reserved'
       and f.created_at > now() - interval '30 minutes'
       and l.revoked_at is null and l.expires_at > now()
  );
$$;

-- 13) 공개 다 올림 — 'ok' | 'closed' | 'missing'(보관함에 없음) | 'too_big'. 같은 파일을 두 번 알려도 한 번만 센다
create or replace function public.public_upload_done(p_slug text, p_path text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l      public.client_upload_links%rowtype;
  f      public.client_upload_files%rowtype;
  v_obj  jsonb;
  v_size bigint;
  v_seen boolean := true;
begin
  l := public.upload_link_open(p_slug);
  if l.id is null then
    return 'closed';
  end if;
  select * into f from public.client_upload_files
   where link_id = l.id and storage_path = coalesce(p_path, '') for update;
  if f.id is null then
    raise exception 'unknown file' using errcode = '22023';
  end if;
  if f.status <> 'reserved' then
    return case when f.status = 'dismissed' and f.decided_by is null then 'too_big' else 'ok' end;
  end if;
  -- 보관함에 정말 들어왔는지(읽을 수 없는 환경이면 건너뛴다 — 정책이 이미 예약 경로만 받는다)
  begin
    select to_jsonb(o) into v_obj from storage.objects o where o.bucket_id = 'client-documents' and o.name = f.storage_path;
    v_seen := v_obj is not null;
  exception when others then
    v_obj := null;
    v_seen := true;
  end;
  if not v_seen then
    return 'missing';
  end if;
  v_size := case when coalesce(v_obj->'metadata'->>'size', '') ~ '^[0-9]{1,15}$' then (v_obj->'metadata'->>'size')::bigint end;
  if v_size is not null and v_size > 20971520 then
    update public.client_upload_files set status = 'dismissed', decided_at = now(), file_size = v_size where id = f.id;
    return 'too_big';
  end if;
  update public.client_upload_files
     set status = 'uploaded', uploaded_at = now(), file_size = coalesce(v_size, file_size)
   where id = f.id;
  update public.client_upload_links set uploaded_count = uploaded_count + 1, last_uploaded_at = now() where id = l.id;
  return 'ok';
end;
$$;

-- 14) 보관함 — 로그인 안 한 사람도 '예약한 경로' 에만 넣을 수 있다(읽기 · 고치기 · 지우기 0). 기존 정책은 그대로.
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "Upload links: reserved path insert" on storage.objects';
    execute 'create policy "Upload links: reserved path insert"
      on storage.objects for insert to anon, authenticated
      with check (bucket_id = ''client-documents'' and public.upload_link_path_ok(name))';
  end if;
end $$;

-- 권한: 업체 함수는 로그인한 사람만 · 공개 함수는 누구나(함수 안에서 막는다)
revoke all on function public.upload_link_state(uuid, text) from public, anon;
revoke all on function public.upload_link_save(uuid, text, jsonb, integer, text) from public, anon;
revoke all on function public.upload_link_rotate(uuid, text) from public, anon;
revoke all on function public.upload_link_off(uuid, text) from public, anon;
revoke all on function public.upload_link_decide(uuid, text) from public, anon;
revoke all on function public.upload_link_inbox(uuid) from public, anon;
grant execute on function public.upload_link_state(uuid, text) to authenticated;
grant execute on function public.upload_link_save(uuid, text, jsonb, integer, text) to authenticated;
grant execute on function public.upload_link_rotate(uuid, text) to authenticated;
grant execute on function public.upload_link_off(uuid, text) to authenticated;
grant execute on function public.upload_link_decide(uuid, text) to authenticated;
grant execute on function public.upload_link_inbox(uuid) to authenticated;
revoke all on function public.public_upload_form(text) from public;
revoke all on function public.public_upload_reserve(text, text, text, bigint, text) from public;
revoke all on function public.public_upload_done(text, text) from public;
revoke all on function public.upload_link_path_ok(text) from public;
grant execute on function public.public_upload_form(text) to anon, authenticated;
grant execute on function public.public_upload_reserve(text, text, text, bigint, text) to anon, authenticated;
grant execute on function public.public_upload_done(text, text) to anon, authenticated;
grant execute on function public.upload_link_path_ok(text) to anon, authenticated;

-- (묶음: 맨 아래에서 한 번에 commit)

commit;

-- 결과(바꾸지 않음) — 여섯 줄 모두 들어감 이면 끝
with fn(name) as (
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
), part(no, what, ok) as (
  values
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', to_regclass('public.workspace_view_grants') is not null),
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', to_regclass('public.workspace_view_requests') is not null),
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', exists (select 1 from fn where name = 'view_consent_blocked_workspaces')),
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', exists (select 1 from fn where name = 'view_consent_ok')),
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', exists (select 1 from fn where name = 'view_consent_person')),
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', exists (select 1 from fn where name = 'view_consent_state')),
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', exists (select 1 from fn where name = 'view_consent_grant')),
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', exists (select 1 from fn where name = 'view_consent_revoke')),
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', exists (select 1 from fn where name = 'view_consent_request')),
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', exists (select 1 from fn where name = 'view_consent_decline')),
  ('0027', '고객(컨설턴트)마다 상담 신청 링크', to_regclass('public.public_intake_links') is not null),
  ('0027', '고객(컨설턴트)마다 상담 신청 링크', exists (select 1 from fn where name = 'intake_link_state')),
  ('0027', '고객(컨설턴트)마다 상담 신청 링크', exists (select 1 from fn where name = 'intake_link_owner_check')),
  ('0027', '고객(컨설턴트)마다 상담 신청 링크', exists (select 1 from fn where name = 'intake_link_save')),
  ('0027', '고객(컨설턴트)마다 상담 신청 링크', exists (select 1 from fn where name = 'intake_link_rotate')),
  ('0027', '고객(컨설턴트)마다 상담 신청 링크', exists (select 1 from fn where name = 'intake_link_off')),
  ('0027', '고객(컨설턴트)마다 상담 신청 링크', exists (select 1 from fn where name = 'public_intake_form')),
  ('0027', '고객(컨설턴트)마다 상담 신청 링크', exists (select 1 from fn where name = 'public_intake_submit')),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', to_regclass('public.self_signup_policy') is not null),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', to_regclass('public.self_signup_accounts') is not null),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', exists (select 1 from fn where name = 'self_signup_seats_left')),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', exists (select 1 from fn where name = 'self_signup_check')),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', exists (select 1 from fn where name = 'signup_open')),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', exists (select 1 from fn where name = 'self_signup_state')),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', exists (select 1 from fn where name = 'self_signup_start')),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', exists (select 1 from fn where name = 'self_signup_admin')),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', exists (select 1 from fn where name = 'self_signup_admin_save')),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', exists (select 1 from fn where name = 'self_signup_admin_list')),
  ('0029', '가입 신청 → 대표가 앱에서 승인 · 거절', to_regclass('public.signup_decisions') is not null),
  ('0029', '가입 신청 → 대표가 앱에서 승인 · 거절', exists (select 1 from fn where name = 'signup_request_check')),
  ('0029', '가입 신청 → 대표가 앱에서 승인 · 거절', exists (select 1 from fn where name = 'my_signup_status')),
  ('0029', '가입 신청 → 대표가 앱에서 승인 · 거절', exists (select 1 from fn where name = 'signup_requests')),
  ('0029', '가입 신청 → 대표가 앱에서 승인 · 거절', exists (select 1 from fn where name = 'signup_requests_count')),
  ('0029', '가입 신청 → 대표가 앱에서 승인 · 거절', exists (select 1 from fn where name = 'signup_approve')),
  ('0029', '가입 신청 → 대표가 앱에서 승인 · 거절', exists (select 1 from fn where name = 'signup_reject')),
  ('0030', 'AI 답 보관(끊겨도 이어 받기)', to_regclass('public.ai_assist_results') is not null),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', to_regclass('public.client_upload_links') is not null),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', to_regclass('public.client_upload_files') is not null),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_access_check')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_state')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_clean_docs')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_save')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_rotate')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_off')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_decide')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_inbox')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_open')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'public_upload_form')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'public_upload_reserve')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_path_ok')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'public_upload_done'))
)
select no as 번호, what as 무엇, count(*) filter (where ok) || '/' || count(*) as 있는_것,
       case when bool_and(ok) then '들어감' when bool_or(ok) then '일부만' else '없음' end as 결과
from part group by no, what order by no;
