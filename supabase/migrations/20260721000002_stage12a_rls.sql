-- =====================================================================
-- Stage 12A · Row Level Security
-- ---------------------------------------------------------------------
-- 원칙:
--   * 모든 테이블에 RLS 를 켜고, 워크스페이스 멤버십으로만 접근을 허용한다.
--   * RLS 를 클라이언트 필터로 대체하지 않는다(서버에서 강제).
--   * "모든 authenticated 사용자 전체 SELECT" 정책을 만들지 않는다.
--   * 헬퍼 함수는 SECURITY DEFINER + set search_path=public 로 만들어
--     workspace_members 조회 시 RLS 재귀를 피한다.
--   * service_role 에 의존하는 프런트엔드 기능을 만들지 않는다(모두 anon+RLS).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 멤버십 헬퍼 (SECURITY DEFINER — RLS 재귀 방지)
-- ---------------------------------------------------------------------
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create or replace function public.current_workspace_role(ws uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = public
as $$
  select m.role from public.workspace_members m
  where m.workspace_id = ws and m.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.has_workspace_role(ws uuid, roles public.workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and m.role = any(roles)
  );
$$;

-- 편집 권한(생성·수정·삭제) 여부: owner/admin/editor
create or replace function public.can_write_workspace(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_workspace_role(ws, array['owner','admin','editor']::public.workspace_role[]);
$$;

-- ---------------------------------------------------------------------
-- 신규 가입 시 프로필 자동 생성 (워크스페이스는 자동 생성하지 않음)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 워크스페이스 생성 RPC (생성자 = owner 를 원자적으로 등록)
--   멤버십 insert 정책은 기존 owner/admin 을 요구하므로, 최초 멤버 등록은
--   SECURITY DEFINER RPC 로 처리한다.
-- ---------------------------------------------------------------------
create or replace function public.create_workspace(workspace_name text, workspace_slug text default null)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  new_ws public.workspaces;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if coalesce(btrim(workspace_name), '') = '' then
    raise exception '워크스페이스 이름을 입력하세요.' using errcode = '22023';
  end if;

  insert into public.workspaces (name, slug, owner_id)
  values (btrim(workspace_name), nullif(btrim(coalesce(workspace_slug, '')), ''), uid)
  returning * into new_ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_ws.id, uid, 'owner');

  return new_ws;
end;
$$;

-- ---------------------------------------------------------------------
-- 초대 수락 RPC (토큰 원문 → 해시 비교, DB 에는 해시만 저장돼 있음)
-- ---------------------------------------------------------------------
create or replace function public.accept_workspace_invite(invite_token text)
returns public.workspace_members
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.workspace_invites;
  uid uuid := auth.uid();
  hashed text;
  member public.workspace_members;
begin
  if uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  hashed := encode(extensions.digest(coalesce(invite_token, ''), 'sha256'), 'hex');

  select * into inv from public.workspace_invites
  where token_hash = hashed
  limit 1;

  if inv.id is null then
    raise exception '유효하지 않은 초대입니다.' using errcode = 'P0002';
  end if;
  if inv.status <> 'pending' then
    raise exception '이미 처리되었거나 취소된 초대입니다.' using errcode = 'P0001';
  end if;
  if inv.expires_at < now() then
    update public.workspace_invites set status = 'expired' where id = inv.id;
    raise exception '만료된 초대입니다.' using errcode = 'P0001';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, uid, inv.role)
  on conflict (workspace_id, user_id)
    do update set role = excluded.role, updated_at = now()
  returning * into member;

  update public.workspace_invites
  set status = 'accepted', accepted_by = uid, updated_at = now()
  where id = inv.id;

  return member;
end;
$$;

-- =====================================================================
-- RLS 활성화 + 정책
-- =====================================================================

-- 헬퍼: 도메인 테이블 표준 정책(멤버 SELECT + 편집자 이상 쓰기)을 일괄 부여
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','projects','activities','questions','survey_modules','survey_templates',
    'survey_blueprints','survey_distributions','survey_responses','assessments',
    'analysis_issues','interview_questions','automation_candidates','selection_decisions',
    'selection_handoffs','mvp_designs','mvp_design_handoffs','website_designs',
    'website_design_handoffs','validation_workspaces','validation_handoffs',
    'validation_test_sessions','deliverable_packages','deliverable_package_snapshots',
    'deliverable_export_records','institutions','support_programs','funding_strategies',
    'funding_strategy_snapshots','case_studies'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    execute format($f$drop policy if exists %1$s_select on public.%1$s$f$, t);
    execute format($f$create policy %1$s_select on public.%1$s
        for select using (public.is_workspace_member(workspace_id))$f$, t);

    execute format($f$drop policy if exists %1$s_insert on public.%1$s$f$, t);
    execute format($f$create policy %1$s_insert on public.%1$s
        for insert with check (public.can_write_workspace(workspace_id))$f$, t);

    execute format($f$drop policy if exists %1$s_update on public.%1$s$f$, t);
    execute format($f$create policy %1$s_update on public.%1$s
        for update using (public.can_write_workspace(workspace_id))
        with check (public.can_write_workspace(workspace_id))$f$, t);

    execute format($f$drop policy if exists %1$s_delete on public.%1$s$f$, t);
    execute format($f$create policy %1$s_delete on public.%1$s
        for delete using (public.can_write_workspace(workspace_id))$f$, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.workspace_members me
      join public.workspace_members other
        on other.workspace_id = me.workspace_id
      where me.user_id = auth.uid() and other.user_id = profiles.id
    )
  );

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;

drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
  for select using (public.is_workspace_member(id));

drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces
  for insert with check (owner_id = auth.uid());

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces
  for update using (public.has_workspace_role(id, array['owner','admin']::public.workspace_role[]))
  with check (public.has_workspace_role(id, array['owner','admin']::public.workspace_role[]));

drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces
  for delete using (public.has_workspace_role(id, array['owner']::public.workspace_role[]));

-- ---------------------------------------------------------------------
-- workspace_members
-- ---------------------------------------------------------------------
alter table public.workspace_members enable row level security;
alter table public.workspace_members force row level security;

drop policy if exists workspace_members_select on public.workspace_members;
create policy workspace_members_select on public.workspace_members
  for select using (
    user_id = auth.uid() or public.is_workspace_member(workspace_id)
  );

drop policy if exists workspace_members_insert on public.workspace_members;
create policy workspace_members_insert on public.workspace_members
  for insert with check (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  );

drop policy if exists workspace_members_update on public.workspace_members;
create policy workspace_members_update on public.workspace_members
  for update using (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  ) with check (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  );

drop policy if exists workspace_members_delete on public.workspace_members;
create policy workspace_members_delete on public.workspace_members
  for delete using (
    user_id = auth.uid()
    or public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  );

-- ---------------------------------------------------------------------
-- workspace_invites (토큰 원문 없음. 관리자만 조회/생성/취소)
-- ---------------------------------------------------------------------
alter table public.workspace_invites enable row level security;
alter table public.workspace_invites force row level security;

drop policy if exists workspace_invites_select on public.workspace_invites;
create policy workspace_invites_select on public.workspace_invites
  for select using (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  );

drop policy if exists workspace_invites_insert on public.workspace_invites;
create policy workspace_invites_insert on public.workspace_invites
  for insert with check (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
    and invited_by = auth.uid()
  );

drop policy if exists workspace_invites_update on public.workspace_invites;
create policy workspace_invites_update on public.workspace_invites
  for update using (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  ) with check (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  );

drop policy if exists workspace_invites_delete on public.workspace_invites;
create policy workspace_invites_delete on public.workspace_invites
  for delete using (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  );

-- ---------------------------------------------------------------------
-- ui_preferences (본인 것만)
-- ---------------------------------------------------------------------
alter table public.ui_preferences enable row level security;
alter table public.ui_preferences force row level security;

drop policy if exists ui_preferences_all on public.ui_preferences;
create policy ui_preferences_all on public.ui_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
