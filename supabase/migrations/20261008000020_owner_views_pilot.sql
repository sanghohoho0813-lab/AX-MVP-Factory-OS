-- =====================================================================
-- D-164 대표가 Pilot(최은혜 팀장) 화면을 바로 오가며 보기
--
-- 대표 지시: "당분간 내 아이디로 들어갔을 때 팀장 화면을 인증 없이 우측 상단에서 클릭 몇 번으로 왔다 갔다".
-- 방법: 대표를 Pilot 작업공간의 **편집자(구성원)** 로 넣는다 — 대표 → 팀장 방향만 열린다.
--   - 팀장은 여전히 대표 작업공간의 구성원이 아니다 → 대표 업체 · 서류 · 계약 · 수금은 팀장에게 0(RLS 그대로).
--   - 팀장 화면에서 팀장도 대표의 이름 · 이메일(프로필)은 볼 수 있다(같은 작업공간 구성원 규칙).
--   - 업무 일기는 사람마다 따로라 대표가 팀장 화면을 볼 때도 팀장의 업무 일기는 보이지 않는다(규칙 그대로).
-- 원칙: 추가만(함수 3 · 트리거 1 · 구성원 줄 추가). 표 · 정책 · 열 삭제/변경 없음. 여러 번 실행해도 같다.
-- 선행: 0019. 되돌리기: delete from workspace_members where (workspace_id, user_id) in (아래 확인 결과의 줄) ;
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.os_access') is null then
    raise exception '0019(20261007000019_os_access_pilot.sql)를 먼저 실행하세요. 0020 은 아무것도 바꾸지 않았습니다.';
  end if;
end $$;

-- 1) 대표(고객 이벤트 받는 작업공간의 주인)를 모든 Pilot 작업공간의 편집자로 — 서버 작업에서만 부른다
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

-- 2) 내가 볼 수 있는 Pilot 화면(대표 쪽 full 만) — 머리줄 '대표 | 최은혜 팀장' 단추가 쓴다
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

-- 3) 구성원 줄의 '누구 · 어느 작업공간' 은 앱에서 바꿀 수 없다(역할만 바뀐다)
--    대표 줄이 팀장 작업공간에 생기므로, 팀장(그 작업공간 주인)이 그 줄의 user_id 를 다른 사람으로 바꿔
--    초대 없이 사람을 들이는 길(0019 6-1 이 INSERT 에서 막은 것)을 UPDATE 에서도 막는다. 앱은 역할만 바꾼다.
create or replace function public.workspace_member_identity_guard()
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
  if new.user_id is distinct from old.user_id or new.workspace_id is distinct from old.workspace_id then
    raise exception '구성원 줄의 사람 · 작업공간은 바꿀 수 없습니다(역할만 바꿀 수 있습니다).' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.workspace_member_identity_guard() from public, anon, authenticated;
drop trigger if exists zz_member_identity_guard on public.workspace_members;
create trigger zz_member_identity_guard
  before update on public.workspace_members
  for each row execute function public.workspace_member_identity_guard();

select public.os_access_link_owner_to_pilots();

commit;

-- 확인(바꾸지 않음): Pilot 작업공간 구성원 — Pilot(owner) + 대표(editor) 두 줄이어야 한다
select w.name as workspace, u.email, m.role
from public.workspaces w
join public.os_access p on p.user_id = w.owner_id and p.tier = 'pilot'
join public.workspace_members m on m.workspace_id = w.id
left join auth.users u on u.id = m.user_id
order by w.name, m.role;
