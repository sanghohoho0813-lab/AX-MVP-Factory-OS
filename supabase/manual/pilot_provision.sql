-- =====================================================================
-- D-162 1인 Pilot 계정 준비 — Supabase SQL Editor 에서 대표가 한 번 실행한다. (마이그레이션 아님)
--
-- 순서
--   0. 0016 → 0017 → 0018 → 0019 를 먼저 실행해 둔다(0019 가 없으면 아래가 멈춘다).
--   1. Authentication → Users → Add user 로 Pilot 계정(이메일 · 비밀번호)을 만든다. ('Auto Confirm User' 체크)
--   2. 아래 v_email · v_ws_name 두 줄만 바꿔 실행한다.
--
-- 하는 일: 그 계정을 pilot 으로 등록하고, 그 사람만 멤버인 빈 작업공간 하나를 만든다.
--   - 대표는 그 작업공간 멤버가 아니다 → 대표 화면에 Pilot 업체가 섞이지 않고, Pilot 화면에 대표 업체가 보이지 않는다.
--   - 업체 · 기록 · 일정 · 수금은 0개로 시작한다(아무것도 복사 · 예시로 넣지 않는다).
-- 여러 번 실행해도 같다(이미 있으면 그대로 둔다).
-- =====================================================================
do $$
declare
  v_email   text := '여기에_Pilot_이메일@example.com';
  v_ws_name text := 'Pilot 작업공간';
  v_uid uuid;
  v_ws  uuid;
begin
  if to_regclass('public.os_access') is null then
    raise exception '0019(20261007000019_os_access_pilot.sql)를 먼저 실행하세요.';
  end if;
  select id into v_uid from auth.users where lower(email) = lower(btrim(v_email));
  if v_uid is null then
    raise exception '계정이 없습니다: % — Authentication → Users → Add user 로 먼저 만드세요.', v_email;
  end if;
  if exists (select 1 from public.os_access where user_id = v_uid and tier = 'full') then
    raise exception '이 계정은 이미 대표 쪽(full) 계정입니다 — Pilot 으로 바꾸지 않습니다.';
  end if;
  if exists (select 1 from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
             join public.os_access a on a.user_id = w.owner_id and a.tier = 'full' where m.user_id = v_uid) then
    raise exception '이 계정은 대표 작업공간 멤버입니다 — Pilot 으로 쓰려면 먼저 그 작업공간에서 내보내세요.';
  end if;

  insert into public.os_access (user_id, tier, note) values (v_uid, 'pilot', '1인 Pilot')
  on conflict (user_id) do update set tier = 'pilot', note = '1인 Pilot';

  select w.id into v_ws from public.workspaces w where w.owner_id = v_uid order by w.created_at limit 1;
  if v_ws is null then
    insert into public.workspaces (name, owner_id) values (v_ws_name, v_uid) returning id into v_ws;
    insert into public.workspace_members (workspace_id, user_id, role) values (v_ws, v_uid, 'owner');
    raise notice 'Pilot 작업공간을 만들었습니다: % (%)', v_ws_name, v_ws;
  else
    raise notice '이미 Pilot 작업공간이 있습니다: %', v_ws;
  end if;
  -- D-164: 0020 이 있으면 대표도 이 작업공간 편집자로 — 대표 화면 오른쪽 위에서 팀장 화면을 바로 본다(대표 → 팀장 방향만)
  if to_regprocedure('public.os_access_link_owner_to_pilots()') is not null then
    perform public.os_access_link_owner_to_pilots();
  end if;
end $$;

-- 확인: Pilot 작업공간의 멤버는 Pilot(owner) — 0020 뒤에는 대표(editor)도 · 업체 0
select w.name, p.email, m.role, (select count(*) from public.operations_clients c where c.workspace_id = w.id) as clients
from public.workspaces w join public.workspace_members m on m.workspace_id = w.id left join public.profiles p on p.id = m.user_id
where w.owner_id in (select user_id from public.os_access where tier = 'pilot');
