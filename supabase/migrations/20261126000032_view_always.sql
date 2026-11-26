-- =====================================================================
-- L-27 보완 · D-675 대표가 '늘 보기' 로 정해 둔 내부 팀장 작업공간은 허락 없이도 보인다
--
-- 대표 지시(2026-11-26 · 0026 을 운영에 넣은 날): "허락하는 동안만 보는 것은 좋은데, 최은혜 팀장 화면은 내가 계속 확인해야 해서
--   그 아이디로 왔다 갔다 해도 제약이 없게 — 그것만큼은 당분간은."
--
-- 0026: 대표(full) 가 팀장(pilot) 작업공간을 볼 때 고객 자료는 팀장이 허락한 기간에만 보인다.
-- 0032 뒤:
--   - 대표는 **내부 팀장** 작업공간마다 [늘 보기] 를 켤 수 있다 — 켜 둔 동안 그 작업공간은 허락 · 기한 · [지금 닫기] 와 상관없이 0026 전처럼 보인다.
--   - 켜고 끄는 것은 그 대표 본인만(팀장 · 다른 구성원 · 외부 구독 고객은 못 한다). 켠 때 · 끈 때는 기록으로 남는다(지우지 않음).
--   - 팀장은 자기 설정에서 '대표가 늘 보기로 정해 두었다' 는 것을 본다(몰래 보는 길이 아니다).
--   - 켜지 않은 팀장 작업공간은 0026 그대로(허락 동안만). 외부 구독 고객 작업공간은 0024 그대로(대표가 구성원이 될 수 없다 — 늘 보기도 켤 수 없다).
--   - 이 파일을 넣는 것만으로는 아무것도 켜지지 않는다 — 대표가 앱에서 그 팀장 화면의 [늘 보기로 켜기] 를 눌러야 켜진다.
--
-- 방법(추가만): 기록 표 1 · 함수 1 을 더하고, 0026 의 함수 둘(닫힌 작업공간 목록 · 상태)에 '늘 보기' 한 줄씩을 더해 다시 쓴다.
--   정책 · 표 · 열 삭제/변경 없음. 여러 번 실행해도 같다.
-- 선행: 0024(내부/외부 구분) · 0026(허락 문).
-- 되돌리기: supabase/manual/rollback_0032.sql — 켜 둔 늘 보기를 모두 끄고 켜는 함수 권한을 거둔다(기록은 남김 → 0026 상태).
-- =====================================================================
begin;

do $$
begin
  if to_regprocedure('public.view_consent_blocked_workspaces()') is null or to_regclass('public.workspace_view_grants') is null then
    raise exception '0026 을 먼저 실행하세요. 0032 는 아무것도 바꾸지 않았습니다.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'os_access' and column_name = 'audience') then
    raise exception '0024 를 먼저 실행하세요. 0032 는 아무것도 바꾸지 않았습니다.';
  end if;
end $$;

-- 1) 늘 보기 기록 — 어느 작업공간 · 누구(대표)에게 · 켠 때 · 끈 때. 켜져 있는 줄은 (작업공간, 대표)마다 하나.
create table if not exists public.workspace_view_always (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  viewer_id    uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  ended_at     timestamptz,
  ended_by     uuid,
  check (ended_at is null or ended_at >= created_at)
);
comment on table public.workspace_view_always is
  'L-27 보완(0032) 대표가 내부 팀장 작업공간을 허락 없이 보도록 켜 둔 기록. 앱은 함수(view_always_set)로만 쓴다 — 표에 직접 쓰기 0. 지우지 않고 끈 때만 적는다.';
create unique index if not exists workspace_view_always_open_idx
  on public.workspace_view_always (workspace_id, viewer_id) where ended_at is null;
create index if not exists workspace_view_always_ws_idx
  on public.workspace_view_always (workspace_id, created_at desc);
alter table public.workspace_view_always enable row level security;
revoke all on public.workspace_view_always from public, anon, authenticated;
grant select on public.workspace_view_always to authenticated;
drop policy if exists "View always: workspace owner or viewer can read" on public.workspace_view_always;
create policy "View always: workspace owner or viewer can read"
  on public.workspace_view_always for select to authenticated
  using (viewer_id = auth.uid() or exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

-- 2) 닫힌 작업공간 목록 — 0026 본문 그대로 + '늘 보기' 로 켜 둔 내부 팀장 작업공간은 뺀다
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
    )
    and not (
      o.audience = 'internal'
      and exists (
        select 1 from public.workspace_view_always a
        where a.workspace_id = w.id and a.viewer_id = auth.uid() and a.ended_at is null
      )
    );
$$;
revoke all on function public.view_consent_blocked_workspaces() from public, anon;
grant execute on function public.view_consent_blocked_workspaces() to authenticated;

-- 3) 상태 — 0026 본문 그대로 + 늘 보기(팀장: 누가 · 언제부터 · 지난 기록 / 대표: 켜 둔 때 · 켤 수 있는 곳인지)
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
  v_internal boolean;
begin
  if v_uid is null or p_ws is null then
    return jsonb_build_object('role', 'none');
  end if;
  select w.owner_id, o.audience = 'internal' into v_owner, v_internal
  from public.workspaces w
  join public.os_access o on o.user_id = w.owner_id and o.tier = 'pilot'
  where w.id = p_ws;
  if v_owner is null then
    return jsonb_build_object('role', 'none');
  end if;

  if v_owner = v_uid then
    -- 팀장 본인: 대표 계정이 구성원인지 · 지금 허락 · 열린 요청 · 지난 기록 10개 · (0032) 대표가 켜 둔 늘 보기
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
        ) x),
      'always', (
        select jsonb_build_object('since', a.created_at, 'by', public.view_consent_person(a.viewer_id))
        from public.workspace_view_always a
        join public.workspace_members m on m.workspace_id = a.workspace_id and m.user_id = a.viewer_id
        join public.os_access f on f.user_id = a.viewer_id and f.tier = 'full'
        where a.workspace_id = p_ws and a.ended_at is null and v_internal
        order by a.created_at desc limit 1),
      'alwaysHistory', (
        select coalesce(jsonb_agg(y.j order by y.at desc), '[]'::jsonb)
        from (
          select a.created_at as at,
                 jsonb_build_object('since', a.created_at, 'endedAt', a.ended_at, 'by', public.view_consent_person(a.viewer_id)) as j
          from public.workspace_view_always a where a.workspace_id = p_ws
          order by 1 desc
          limit 10
        ) y)
    );
  end if;

  -- 대표(full · 구성원): 지금 허락 · 내 열린 요청 · 마지막 거절/허락 · (0032) 내가 켜 둔 늘 보기 · 켤 수 있는 곳인지
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
      order by r.closed_at desc limit 1),
    'canAlways', coalesce(v_internal, false),
    'always', (
      select jsonb_build_object('since', a.created_at)
      from public.workspace_view_always a
      where a.workspace_id = p_ws and a.viewer_id = v_uid and a.ended_at is null and v_internal
      order by a.created_at desc limit 1)
  );
end;
$$;
revoke all on function public.view_consent_state(uuid) from public, anon;
grant execute on function public.view_consent_state(uuid) to authenticated;

-- 4) 대표(full · 구성원 · 주인 아님)만: 내부 팀장 작업공간의 늘 보기 켜기 · 끄기. 두 번 눌러도 한 줄 · 꺼져 있을 때 끄기는 아무것도 안 함.
create or replace function public.view_always_set(p_ws uuid, p_on boolean)
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
       select 1 from public.workspaces w
       join public.os_access o on o.user_id = w.owner_id and o.tier = 'pilot' and o.audience = 'internal'
       where w.id = p_ws and w.owner_id <> v_uid) then
    raise exception '늘 보기로 바꿀 수 없는 작업공간입니다.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('view_always:' || p_ws::text, 0));
  if coalesce(p_on, false) then
    insert into public.workspace_view_always (workspace_id, viewer_id)
    select p_ws, v_uid
    where not exists (
      select 1 from public.workspace_view_always a
      where a.workspace_id = p_ws and a.viewer_id = v_uid and a.ended_at is null);
  else
    update public.workspace_view_always set ended_at = now(), ended_by = v_uid
    where workspace_id = p_ws and viewer_id = v_uid and ended_at is null;
  end if;
  return public.view_consent_state(p_ws);
end;
$$;
revoke all on function public.view_always_set(uuid, boolean) from public, anon;
grant execute on function public.view_always_set(uuid, boolean) to authenticated;

commit;

-- 확인(바꾸지 않음): 표 · 함수 · 지금 켜져 있는 늘 보기 수(넣은 직후에는 0 — 앱에서 켠다)
select (to_regclass('public.workspace_view_always') is not null) as always_table,
       (to_regprocedure('public.view_always_set(uuid, boolean)') is not null) as always_fn,
       (select count(*) from public.workspace_view_always where ended_at is null) as always_on_now;
