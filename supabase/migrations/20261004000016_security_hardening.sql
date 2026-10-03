-- =====================================================================
-- D-150 보안 단단히 — 검토에서 찾은 서버 쪽 빈틈을 막는다
--
-- 원칙: 추가만. 표 · 열 · 정책을 지우거나 이름을 바꾸지 않는다. RLS 를 끄지 않는다.
--   - 함수는 같은 이름으로 다시 만든다(create or replace)
--   - 새 막음은 트리거로 더한다(기존 정책은 그대로)
-- 여러 번 실행해도 같은 결과(멱등).
--
-- 막는 것
--   1. 보관함 '고객에게 공유' — 공유 서류의 경로가 그 서류의 워크스페이스 폴더 밖이면 열리지 않는다.
--      (예전: 아무 워크스페이스나 만든 사람이 자기 서류 줄에 남의 경로를 적어 그 파일을 열 수 있었다)
--   2. portal 표 — 연결(portal_client_links) · 업체(operations_clients) · 서류 경로가 같은 워크스페이스여야 한다.
--      (예전: 다른 워크스페이스의 고객 연결에 소식 · 서류를 넣을 수 있었다)
--   3. 워크스페이스 멤버 — 소유자 권한은 소유자만 준다. 워크스페이스 주인 줄은 앱에서 지우거나 낮추지 못한다.
--      (예전: 관리자가 자기를 소유자로 올리거나 주인을 내보낼 수 있었다)
--   4. 초대 받기 — 이미 소유자인 사람이 낮은 권한 초대를 받아도 소유자 그대로.
-- 운영 DB 에는 대표가 Supabase SQL Editor 에서 이 파일을 한 번 실행해야 켜진다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 보관함 공유 경로는 그 서류의 워크스페이스 폴더 안이어야 한다
-- ---------------------------------------------------------------------
create or replace function public.portal_storage_shared(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.portal_documents d
    join public.portal_client_links l on l.id = d.portal_client_link_id
    where d.storage_path = object_name
      and d.visibility = 'shared_with_customer'
      and l.profile_id = auth.uid() and l.status = 'active'
      -- D-150: 서류 · 연결 · 경로 첫 폴더가 모두 같은 워크스페이스
      and l.workspace_id = d.workspace_id
      and split_part(object_name, '/', 1) = d.workspace_id::text
  );
$$;
revoke all on function public.portal_storage_shared(text) from public, anon;
grant execute on function public.portal_storage_shared(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. portal 표: 같은 워크스페이스의 연결 · 업체 · 경로만
-- ---------------------------------------------------------------------
create or replace function public.portal_same_workspace_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'portal_client_links' then
    if not exists (select 1 from public.operations_clients c where c.id = new.operations_client_id and c.workspace_id = new.workspace_id) then
      raise exception '다른 워크스페이스의 업체에는 고객 연결을 만들 수 없습니다.' using errcode = '42501';
    end if;
    return new;
  end if;

  if not exists (select 1 from public.portal_client_links l where l.id = new.portal_client_link_id and l.workspace_id = new.workspace_id) then
    raise exception '다른 워크스페이스의 고객 연결에는 넣을 수 없습니다.' using errcode = '42501';
  end if;

  if tg_table_name = 'portal_documents' then
    if not exists (select 1 from public.operations_clients c where c.id = new.operations_client_id and c.workspace_id = new.workspace_id) then
      raise exception '다른 워크스페이스의 업체 서류는 넣을 수 없습니다.' using errcode = '42501';
    end if;
    if coalesce(new.storage_path, '') <> '' and new.storage_path not like 'demo/%'
       and split_part(new.storage_path, '/', 1) <> new.workspace_id::text then
      raise exception '서류 경로가 이 워크스페이스 폴더 밖입니다.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.portal_same_workspace_guard() from public, anon, authenticated;

drop trigger if exists zz_portal_links_same_workspace on public.portal_client_links;
create trigger zz_portal_links_same_workspace
  before insert or update of workspace_id, operations_client_id on public.portal_client_links
  for each row execute function public.portal_same_workspace_guard();

drop trigger if exists zz_portal_updates_same_workspace on public.portal_updates;
create trigger zz_portal_updates_same_workspace
  before insert or update of workspace_id, portal_client_link_id on public.portal_updates
  for each row execute function public.portal_same_workspace_guard();

drop trigger if exists zz_portal_requests_same_workspace on public.portal_requests;
create trigger zz_portal_requests_same_workspace
  before insert or update of workspace_id, portal_client_link_id on public.portal_requests
  for each row execute function public.portal_same_workspace_guard();

drop trigger if exists zz_portal_documents_same_workspace on public.portal_documents;
create trigger zz_portal_documents_same_workspace
  before insert or update of workspace_id, portal_client_link_id, operations_client_id, storage_path on public.portal_documents
  for each row execute function public.portal_same_workspace_guard();

-- ---------------------------------------------------------------------
-- 3. 워크스페이스 멤버: 소유자 권한은 소유자만 · 주인 줄은 앱에서 못 바꾼다
-- ---------------------------------------------------------------------
create or replace function public.workspace_member_role_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ws uuid := coalesce(new.workspace_id, old.workspace_id);
  ws_owner uuid;
  caller_is_owner boolean;
begin
  -- SQL Editor · 서버 작업(로그인한 사람이 없다)은 막지 않는다 — 주인 바꾸기는 여기서 한다
  if uid is null then
    return coalesce(new, old);
  end if;
  select w.owner_id into ws_owner from public.workspaces w where w.id = ws;
  -- 워크스페이스를 지우는 중(이미 없음) — 따라 지워지는 멤버 줄은 막지 않는다
  if ws_owner is null then
    return coalesce(new, old);
  end if;
  caller_is_owner := ws_owner = uid
    or exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = uid and m.role = 'owner');

  if tg_op in ('INSERT', 'UPDATE') and new.role = 'owner' and not caller_is_owner then
    raise exception '소유자 권한은 소유자만 줄 수 있습니다.' using errcode = '42501';
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.user_id = ws_owner
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.user_id <> old.user_id) then
    raise exception '워크스페이스 주인은 앱에서 바꾸거나 내보낼 수 없습니다.' using errcode = '42501';
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' and not caller_is_owner then
    raise exception '소유자는 소유자만 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function public.workspace_member_role_guard() from public, anon, authenticated;

drop trigger if exists zz_workspace_member_role_guard on public.workspace_members;
create trigger zz_workspace_member_role_guard
  before insert or update or delete on public.workspace_members
  for each row execute function public.workspace_member_role_guard();

-- ---------------------------------------------------------------------
-- 4. 초대 받기 — 이미 소유자면 낮은 권한 초대로 낮아지지 않는다
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
    -- D-150: 소유자는 그대로(낮은 권한 초대로 낮아지지 않는다)
    do update set role = case when public.workspace_members.role = 'owner' then public.workspace_members.role else excluded.role end,
                  updated_at = now()
  returning * into member;

  update public.workspace_invites
  set status = 'accepted', accepted_by = uid, updated_at = now()
  where id = inv.id;

  return member;
end;
$$;
