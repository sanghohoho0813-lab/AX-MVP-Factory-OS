-- =====================================================================
-- D-162 1인 Pilot — 내부 OS 접근 허용 목록 · 전용 작업공간을 위한 서버 쪽 막음
--
-- 이 Supabase 프로젝트는 공개 사이트(miraeailab.com) 회원가입과 같이 쓴다. 그래서 '로그인한 사람' 은 누구나 될 수 있다.
-- 데이터는 이미 작업공간 멤버십 RLS 로 나뉘어 있다(로컬 시험: workspace_id 가 있는 51개 표 + 보관함 모두 막힘).
-- 이 파일은 그 위에 '누가 내부 OS 를 쓰는가' 를 서버에서 정한다.
--
--   os_access(user_id, tier)  full = 대표 · 기존 구성원(지금과 똑같이) / pilot = 1인 Pilot(자기 작업공간 하나만)
--   - 지금 어느 작업공간이든 멤버인 사람은 모두 full 로 자동 등록 — 오늘 쓰는 사람은 아무것도 달라지지 않는다.
--   - 목록은 앱에서 고칠 수 없다(쓰기 정책 없음). Supabase SQL Editor 에서만.
--
-- 서버에서 막는 것(트리거 — 기존 함수 · 정책은 그대로)
--   1. 작업공간 만들기: 목록에 없는 계정은 못 만든다 · pilot 은 하나만(공개 사이트 가입자가 내부 OS 작업공간을 만들 수 없다)
--   2. 고객 이벤트 받는 곳(customer_intake_routing): full 만 바꿀 수 있다 · 만든 시각은 서버 시각
--      (예전: 누구나 자기 작업공간을 만들고 '받는 곳' 으로 넣어 공개 사이트 상담신청 · 가입 알림을 가로챌 수 있었다)
--   3. 고객 플랫폼 연결(portal_client_links) 새로 만들기: full 만
--   4. 고객 계정 찾기(staff_find_customer_profile, 0018): full 만 — 남의 고객 이메일로 계정이 있는지 알아낼 수 없게
--   5. 대표 쪽(full) 작업공간에 초대받아 들어온 사람만 full 을 물려받는다 · 초대 만들기는 full 만(Pilot 이 사람을 늘리지 못한다)
--   6. 남을 작업공간에 바로 넣기 금지 · 초대는 초대받은 이메일로 로그인한 사람만 받는다(새어 나간 초대 링크로 못 들어온다)
--      · Pilot 은 대표 쪽 작업공간에 들어갈 수 없다 · 작업공간 만든 시각 · 주인 바꾸기 금지 · 프로필 이메일은 로그인 이메일과 같게
--   7. 고객 이벤트 받는 곳은 full 계정이 주인인 작업공간만(누가 심어 둔 줄은 무시)
--
-- 원칙: 추가만(표 1 · 새 함수 · 트리거 8 · 함수 2개 다시 만들기: default_intake_workspace · staff_find_customer_profile). 표 · 열 · 정책 삭제 · 이름 바꾸기 없음. RLS 끄지 않음. 여러 번 실행해도 같다.
-- 선행: 0016 · 0017 · 0018 을 먼저 실행해야 한다(아래에서 확인하고, 없으면 아무것도 바꾸지 않고 멈춘다).
-- 되돌리기: drop trigger zz_os_access_workspace_create on public.workspaces;
--           drop trigger zz_os_access_intake_routing on public.customer_intake_routing;
--           drop trigger zz_os_access_portal_link on public.portal_client_links;
--           drop trigger zz_os_access_member_tier on public.workspace_members;
--           drop trigger zz_os_access_member_self on public.workspace_members;
--           drop trigger zz_os_access_workspace_update on public.workspaces;
--           drop trigger zz_os_access_profile_email on public.profiles;
--           drop trigger zz_os_access_invite on public.workspace_invites;
--           (default_intake_workspace 는 0006 의 정의를 다시 실행하면 예전으로)
--           (0018 의 staff_find_customer_profile 을 다시 실행하면 찾기 제한도 풀린다)
-- =====================================================================

begin;

-- 0) 선행 확인 — 0016(보관함 공유 경로 · portal 같은 작업공간) · 0017(공개 링크) · 0018(고객 계정 찾기)
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'portal_same_workspace_guard') then
    raise exception '0016(20261004000016_security_hardening.sql)을 먼저 실행하세요. 0019 는 아무것도 바꾸지 않았습니다.';
  end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'public_intake_log') then
    raise exception '0017(20261005000017_public_links_hardening.sql)을 먼저 실행하세요. 0019 는 아무것도 바꾸지 않았습니다.';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'staff_find_customer_profile') then
    raise exception '0018(20261006000018_staff_customer_lookup.sql)을 먼저 실행하세요. 0019 는 아무것도 바꾸지 않았습니다.';
  end if;
end $$;

-- 1) 접근 허용 목록
create table if not exists public.os_access (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  tier       text not null check (tier in ('full', 'pilot')),
  note       text not null default '',
  created_at timestamptz not null default now()
);
comment on table public.os_access is '내부 OS 를 쓸 수 있는 계정(D-162). full = 대표 · 기존 구성원, pilot = 1인 Pilot. 앱에서는 읽기만(자기 줄) — 바꾸기는 SQL Editor 에서.';

alter table public.os_access enable row level security;
alter table public.os_access force row level security;
drop policy if exists os_access_select_self on public.os_access;
create policy os_access_select_self on public.os_access for select to authenticated using (user_id = auth.uid());
revoke all on public.os_access from anon, authenticated;
grant select on public.os_access to authenticated;

-- 대표 작업공간 찾기 — 두 신호가 같은 곳을 가리킬 때만 정한다(다르면 아무것도 바꾸지 않고 멈춘다)
--   ① 업체가 가장 많은 작업공간  ② 가장 먼저 가입한 계정(auth.users — 앱에서 바꿀 수 없다)이 주인인 작업공간 중 업체가 가장 많은 곳
--   받는 곳 표 · 작업공간 만든 시각 · 업체 수는 이 파일 전에는 공개 가입자도 늘리거나 바꿀 수 있었으므로 하나만 믿지 않는다.
--   둘이 다르면: 실행 맨 위에  select set_config('app.os_owner_workspace', '<대표 작업공간 id>', false);  한 줄을 넣고 다시 실행.
-- 그 계정이 주인인 작업공간들의 구성원(직원)을 모두 full 로. 받는 곳이 비어 있으면 대표 작업공간으로 적어 둔다.
do $$
declare
  v_set text := nullif(btrim(coalesce(current_setting('app.os_owner_workspace', true), '')), '');
  v_ws uuid;
  v_auto uuid;
  v_old uuid;
  v_owner uuid;
  v_name text;
  v_email text;
  v_n bigint;
  v_list text;
begin
  if v_set is not null then
    select w.id into v_ws from public.workspaces w where w.id::text = v_set;
    if v_ws is null then
      raise exception 'app.os_owner_workspace 에 적은 작업공간(%)이 없습니다. 0019 는 아무것도 바꾸지 않았습니다.', v_set;
    end if;
  else
    select w.id into v_auto from public.workspaces w
     order by (select count(*) from public.operations_clients c where c.workspace_id = w.id) desc, w.created_at asc limit 1;
    if v_auto is null then
      raise notice '작업공간이 아직 없습니다 — 접근 목록을 비워 둡니다.';
      return;
    end if;
    select w.id into v_old from public.workspaces w join auth.users u on u.id = w.owner_id
     order by u.created_at asc, (select count(*) from public.operations_clients c where c.workspace_id = w.id) desc, w.created_at asc limit 1;
    if v_old is distinct from v_auto then
      select string_agg(format('%s · %s · 업체 %s곳 · 주인 %s', w.id, w.name, (select count(*) from public.operations_clients c where c.workspace_id = w.id), coalesce(u.email, '?')), E'\n' order by w.created_at)
        into v_list from public.workspaces w left join auth.users u on u.id = w.owner_id where w.id in (v_auto, v_old);
      raise exception E'대표 작업공간을 하나로 정하지 못했습니다(업체가 가장 많은 곳과 가장 오래된 계정의 작업공간이 다릅니다):\n%\n대표 작업공간 id 로  select set_config(''app.os_owner_workspace'', ''<id>'', false);  를 먼저 실행하고 이 파일을 다시 실행하세요. 0019 는 아무것도 바꾸지 않았습니다.', v_list;
    end if;
    v_ws := v_auto;
  end if;
  select w.owner_id, w.name, (select count(*) from public.operations_clients c where c.workspace_id = w.id), u.email
    into v_owner, v_name, v_n, v_email
  from public.workspaces w left join auth.users u on u.id = w.owner_id where w.id = v_ws;
  raise notice '대표 작업공간: % (업체 %곳 · 주인 %) — 이 계정이 주인인 작업공간 구성원을 full 로 넣습니다.', v_name, v_n, coalesce(v_email, '?');
  insert into public.os_access (user_id, tier, note)
  select distinct m.user_id, 'full', 'D-162 자동: 대표 작업공간 구성원'
  from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
  where w.owner_id = v_owner
  on conflict (user_id) do nothing;
  insert into public.customer_intake_routing (workspace_id, is_default)
  select v_ws, true where not exists (select 1 from public.customer_intake_routing)
  on conflict (workspace_id) do nothing;
  if exists (select 1 from public.customer_intake_routing r join public.workspaces w on w.id = r.workspace_id where w.owner_id is distinct from v_owner) then
    raise notice '고객 이벤트 받는 곳에 대표 계정 것이 아닌 작업공간 줄이 있습니다 — 이제 무시됩니다(아래 확인 3).';
  end if;
end $$;

-- 2) 내 등급 — 앱이 로그인 직후 한 번 묻는다(없으면 null = 내부 OS 를 쓸 수 없는 계정)
create or replace function public.my_os_access()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select a.tier from public.os_access a where a.user_id = auth.uid();
$$;
revoke all on function public.my_os_access() from public, anon;
grant execute on function public.my_os_access() to authenticated;

-- full 인가 — 서버 작업(SQL Editor · 로그인한 사람 없음)은 막지 않는다
create or replace function public.os_access_is_full()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is null or exists (select 1 from public.os_access a where a.user_id = auth.uid() and a.tier = 'full');
$$;
revoke all on function public.os_access_is_full() from public, anon;
grant execute on function public.os_access_is_full() to authenticated;

-- 3) 작업공간 만들기 — 목록에 없는 계정은 못 만들고, pilot 은 하나만
create or replace function public.os_access_workspace_create_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t text;
begin
  if uid is null then
    return new;
  end if;
  select a.tier into t from public.os_access a where a.user_id = uid;
  if t is null then
    raise exception '이 계정은 MIRAE AI LAB OS 작업공간을 만들 수 없습니다. 관리자에게 문의하세요.' using errcode = '42501';
  end if;
  if t = 'pilot' and exists (select 1 from public.workspaces w where w.owner_id = uid) then
    raise exception 'Pilot 계정은 작업공간을 하나만 쓸 수 있습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.os_access_workspace_create_guard() from public, anon, authenticated;
drop trigger if exists zz_os_access_workspace_create on public.workspaces;
create trigger zz_os_access_workspace_create
  before insert on public.workspaces
  for each row execute function public.os_access_workspace_create_guard();

-- 4) 고객 이벤트 받는 곳 — full 만 · 만든 시각은 서버 시각(오래된 시각을 적어 '맨 앞' 을 차지하지 못하게)
create or replace function public.os_access_intake_routing_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.os_access_is_full() then
    raise exception '고객 이벤트 받는 곳은 관리자만 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and auth.uid() is not null then
    new.created_at := now();
  end if;
  if tg_op = 'UPDATE' and auth.uid() is not null then
    new.created_at := old.created_at;
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function public.os_access_intake_routing_guard() from public, anon, authenticated;
drop trigger if exists zz_os_access_intake_routing on public.customer_intake_routing;
create trigger zz_os_access_intake_routing
  before insert or update or delete on public.customer_intake_routing
  for each row execute function public.os_access_intake_routing_guard();

-- 5) 고객 플랫폼 연결 새로 만들기 — full 만(Pilot 기간에는 고객 플랫폼을 쓰지 않는다)
create or replace function public.os_access_portal_link_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.os_access_is_full() then
    raise exception '고객 플랫폼 연결은 이 계정에서 만들 수 없습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.os_access_portal_link_guard() from public, anon, authenticated;
drop trigger if exists zz_os_access_portal_link on public.portal_client_links;
create trigger zz_os_access_portal_link
  before insert on public.portal_client_links
  for each row execute function public.os_access_portal_link_guard();

-- 6) 대표 쪽(full) 작업공간에 들어온 사람은 full(이미 등급이 있으면 그대로)
create or replace function public.os_access_member_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- full 만 물려준다 — Pilot 작업공간에 들어온 사람은 등급이 생기지 않는다(내부 OS 를 못 연다 · 작업공간도 못 만든다)
  insert into public.os_access (user_id, tier, note)
  select new.user_id, 'full', 'D-162 자동: 대표 쪽 작업공간 구성원'
  from public.workspaces w join public.os_access a on a.user_id = w.owner_id and a.tier = 'full'
  where w.id = new.workspace_id
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.os_access_member_tier() from public, anon, authenticated;
drop trigger if exists zz_os_access_member_tier on public.workspace_members;
create trigger zz_os_access_member_tier
  after insert on public.workspace_members
  for each row execute function public.os_access_member_tier();

-- 6-1) 남을 작업공간에 바로 넣지 못한다 — 들어오는 길은 초대 받기 · 작업공간 만들기(둘 다 자기 자신)뿐
--      (예전: 주인이 아무 계정 id 나 멤버로 넣어 그 사람 프로필(이름 · 연락처)을 읽을 수 있었다)
--      초대 받기는 초대받은 이메일로 로그인한 사람만 · Pilot 은 대표 쪽 작업공간에 못 들어간다
create or replace function public.os_access_member_self_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_owner uuid;
begin
  if uid is null then
    return new;
  end if;
  if new.user_id <> uid then
    raise exception '다른 사람은 초대로만 작업공간에 들어올 수 있습니다.' using errcode = '42501';
  end if;
  select w.owner_id into v_owner from public.workspaces w where w.id = new.workspace_id;
  if v_owner = uid then
    return new; -- 작업공간 만들기(자기 작업공간)
  end if;
  -- 초대 받기 — 초대받은 이메일로 로그인한 사람만(새어 나간 초대 링크로는 못 들어온다)
  if not exists (
    select 1 from public.workspace_invites i join auth.users u on u.id = uid
     where i.workspace_id = new.workspace_id and i.status = 'pending' and i.expires_at > now()
       and lower(btrim(i.email)) = lower(btrim(coalesce(u.email, '')))
  ) then
    raise exception '초대받은 이메일로 로그인해서 초대를 받아 주세요.' using errcode = '42501';
  end if;
  -- Pilot 은 대표 쪽 작업공간에 들어갈 수 없다
  if exists (select 1 from public.os_access a where a.user_id = uid and a.tier = 'pilot')
     and exists (select 1 from public.os_access a where a.user_id = v_owner and a.tier = 'full') then
    raise exception 'Pilot 계정은 이 작업공간에 들어올 수 없습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.os_access_member_self_guard() from public, anon, authenticated;
drop trigger if exists zz_os_access_member_self on public.workspace_members;
create trigger zz_os_access_member_self
  before insert on public.workspace_members
  for each row execute function public.os_access_member_self_guard();

-- 6-1b) 초대 만들기 — full 만(Pilot 이 사람을 들여 계정을 늘리지 못한다)
create or replace function public.os_access_invite_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.os_access_is_full() then
    raise exception '이 계정은 초대를 만들 수 없습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.os_access_invite_guard() from public, anon, authenticated;
drop trigger if exists zz_os_access_invite on public.workspace_invites;
create trigger zz_os_access_invite
  before insert on public.workspace_invites
  for each row execute function public.os_access_invite_guard();

-- 6-2) 작업공간 만든 시각 · 주인은 앱에서 바꿀 수 없다(시각을 앞당겨 '가장 오래된 작업공간' 이 되거나 주인을 바꾸지 못하게)
create or replace function public.os_access_workspace_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and (new.created_at is distinct from old.created_at or new.owner_id is distinct from old.owner_id) then
    raise exception '작업공간 만든 시각 · 주인은 바꿀 수 없습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.os_access_workspace_update_guard() from public, anon, authenticated;
drop trigger if exists zz_os_access_workspace_update on public.workspaces;
create trigger zz_os_access_workspace_update
  before update on public.workspaces
  for each row execute function public.os_access_workspace_update_guard();

-- 6-3) 프로필 이메일은 로그인 이메일과 같아야 한다(남의 고객 이메일로 바꿔 직원 찾기 · 상담 기록에 끼어들지 못하게)
create or replace function public.os_access_profile_email_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.email is distinct from old.email
     and new.email is distinct from (select u.email from auth.users u where u.id = new.id) then
    raise exception '프로필 이메일은 로그인 이메일과 같아야 합니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.os_access_profile_email_guard() from public, anon, authenticated;
drop trigger if exists zz_os_access_profile_email on public.profiles;
create trigger zz_os_access_profile_email
  before update on public.profiles
  for each row execute function public.os_access_profile_email_guard();

-- 6-4) 고객 이벤트 받는 곳은 full 계정이 주인인 작업공간만 — 예전에 누가 심어 둔 줄이 있어도 무시한다
create or replace function public.default_intake_workspace()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select r.workspace_id from public.customer_intake_routing r
       join public.workspaces w on w.id = r.workspace_id
       join public.os_access a on a.user_id = w.owner_id and a.tier = 'full'
      where r.is_default order by r.created_at limit 1),
    (select w.id from public.workspaces w
       join public.os_access a on a.user_id = w.owner_id and a.tier = 'full'
      order by w.created_at asc limit 1)
  );
$$;
revoke all on function public.default_intake_workspace() from public, anon, authenticated;

-- 7) 고객 계정 찾기(0018) — full 만
create or replace function public.staff_find_customer_profile(p_email text)
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email
  from public.profiles p
  where lower(p.email) = lower(btrim(coalesce(p_email, '')))
    and btrim(coalesce(p_email, '')) <> ''
    and exists (
      select 1 from public.workspace_members m
      where m.user_id = auth.uid() and m.role in ('owner', 'admin', 'editor')
    )
    and exists (select 1 from public.os_access a where a.user_id = auth.uid() and a.tier = 'full')
  limit 1;
$$;
revoke all on function public.staff_find_customer_profile(text) from public, anon;
grant execute on function public.staff_find_customer_profile(text) to authenticated;

commit;

-- 확인용(바꾸지 않음) — 실행 뒤 아래 결과를 눈으로 본다
--   1) 접근 목록: 대표 · 직원만 full 인지
select a.tier, p.email, a.note, a.created_at from public.os_access a left join public.profiles p on p.id = a.user_id order by a.tier, p.email;
--   2) 작업공간 멤버인데 접근 목록에 없는 계정(내부 OS 를 못 연다 — 직원이면 SQL 로 full 을 더한다)
select w.name as workspace, p.email, m.role from public.workspace_members m join public.workspaces w on w.id = m.workspace_id left join public.profiles p on p.id = m.user_id
 where not exists (select 1 from public.os_access a where a.user_id = m.user_id) order by w.name;
--   3) 고객 이벤트 받는 곳 — 대표 작업공간 하나여야 한다
select r.workspace_id, w.name, r.is_default, r.created_at, public.default_intake_workspace() = r.workspace_id as now_used from public.customer_intake_routing r left join public.workspaces w on w.id = r.workspace_id order by r.created_at;
--   4) 0016 이전에 심어졌을 수 있는 다른 작업공간 줄 — 모두 0 이어야 한다
select 'links→다른 작업공간 업체' as what, count(*) from public.portal_client_links l join public.operations_clients c on c.id = l.operations_client_id where c.workspace_id <> l.workspace_id
union all select 'updates→다른 작업공간 연결', count(*) from public.portal_updates u join public.portal_client_links l on l.id = u.portal_client_link_id where l.workspace_id <> u.workspace_id
union all select 'requests→다른 작업공간 연결', count(*) from public.portal_requests r join public.portal_client_links l on l.id = r.portal_client_link_id where l.workspace_id <> r.workspace_id
union all select 'documents→다른 작업공간 연결', count(*) from public.portal_documents d join public.portal_client_links l on l.id = d.portal_client_link_id where l.workspace_id <> d.workspace_id
union all select 'documents 경로가 자기 작업공간 폴더 밖', count(*) from public.portal_documents d where d.storage_path is not null and d.storage_path <> '' and d.storage_path not like d.workspace_id::text || '/%' and d.storage_path not like 'demo/%';
