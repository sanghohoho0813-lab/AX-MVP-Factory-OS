-- =====================================================================
-- 0023 · 0024 적용 **뒤** 확인 ② — 막혀야 하는 일을 '대표로서' 직접 시도해 보고 **모두 되돌린다**(마이그레이션 아님)
--
-- 사용: verify_after_0023_0024.sql 이 모두 '좋음' 인 다음, Supabase SQL Editor 에 통째로 붙여 넣고 실행.
-- 결과는 **빨간 오류 글처럼** 나온다 — 정상이다. 마지막에 일부러 오류를 내어 이 안에서 한 일을 전부 되돌리기 때문이다.
--   오류 글 안의 '통과 n · 실패 0' 과 ✓ 줄을 본다. ✗ 가 있으면 대표에게 보이고 되돌리기를 검토한다.
-- 무엇을 시도하나(모두 이 거래 안에서만 · 끝에 되돌림):
--   ① 대표 업체 한 곳을 팀장 작업공간으로 옮기기       → 막혀야 한다(0023)
--   ② 같은 업체를 같은 작업공간 그대로 저장하기          → 되어야 한다(앱이 평소 쓰는 길)
--   ③ 내부 팀장 계정을 외부 고객(customer)으로 바꾸기   → 막혀야 한다(대표가 그 작업공간 구성원 — 0024)
--   ④ 대표로 본 팀장 화면 목록                         → 적용 전과 같은 수(0024 뒤에도 대표 ↔ 팀장 전환 그대로)
-- 개인 정보(이름 · 이메일 · 업체 내용)는 결과에 쓰지 않는다 — 수와 ✓/✗ 만.
-- 이 파일은 표 · 함수 · 정책을 만들거나 바꾸지 않는다. 시도한 고치기는 마지막 오류로 전부 되돌아간다.
-- =====================================================================
do $$
declare
  v_owner uuid;
  v_ow uuid;
  v_pw uuid;
  v_pilot uuid;
  v_cid text;
  v_views int;
  v_expect int;
  r text := '';
  ok int := 0;
  bad int := 0;
begin
  select w.owner_id, w.id into v_owner, v_ow from public.workspaces w where w.id = public.default_intake_workspace();
  if v_owner is null or not exists (select 1 from public.os_access a where a.user_id = v_owner and a.tier = 'full') then
    raise exception '[점검 멈춤] 대표(full) 계정을 찾지 못했습니다 — 아무것도 바꾸지 않았습니다.';
  end if;
  select w.id, w.owner_id into v_pw, v_pilot
  from public.workspaces w
  join public.os_access p on p.user_id = w.owner_id and p.tier = 'pilot' and p.audience = 'internal'
  join public.workspace_members m on m.workspace_id = w.id and m.user_id = v_owner
  order by w.created_at limit 1;
  select c.id into v_cid from public.operations_clients c where c.workspace_id = v_ow order by c.created_at limit 1;

  -- 이 거래 안에서만 '대표로 로그인했다' 고 둔다(앱에서 대표가 하는 것과 같은 조건)
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  if auth.uid() is distinct from v_owner then
    raise exception '[점검 멈춤] 이 DB 의 로그인 확인 방식이 달라 대표로 시도할 수 없습니다 — 아무것도 바꾸지 않았습니다.';
  end if;

  -- ① 다른 작업공간으로 옮기기 → 막혀야
  if v_cid is null or v_pw is null then
    r := r || E'\n- ① 건너뜀(대표 업체 또는 대표가 들어간 팀장 작업공간이 없음)';
  else
    begin
      update public.operations_clients set workspace_id = v_pw where id = v_cid;
      r := r || E'\n✗ ① 대표 업체를 팀장 작업공간으로 옮기기 — 막히지 않음(0023 장치 확인)';
      bad := bad + 1;
    exception when insufficient_privilege then
      r := r || E'\n✓ ① 대표 업체를 팀장 작업공간으로 옮기기 — 막힘';
      ok := ok + 1;
    end;
    -- ② 같은 작업공간 그대로 저장 → 되어야
    begin
      update public.operations_clients set workspace_id = workspace_id where id = v_cid;
      r := r || E'\n✓ ② 같은 작업공간 그대로 저장 — 됨(앱 길 그대로)';
      ok := ok + 1;
    exception when others then
      r := r || E'\n✗ ② 같은 작업공간 그대로 저장 — 막힘: ' || sqlerrm;
      bad := bad + 1;
    end;
  end if;

  -- ③ 내부 팀장을 고객으로 바꾸기 → 막혀야(대표가 구성원)
  if v_pilot is null then
    r := r || E'\n- ③ 건너뜀(대표가 들어간 내부 팀장이 없음)';
  else
    begin
      update public.os_access set audience = 'customer' where user_id = v_pilot;
      r := r || E'\n✗ ③ 내부 팀장을 외부 고객으로 바꾸기 — 막히지 않음(0024 장치 확인)';
      bad := bad + 1;
    exception when insufficient_privilege then
      r := r || E'\n✓ ③ 내부 팀장을 외부 고객으로 바꾸기 — 막힘(대표 ↔ 팀장 연결 보호)';
      ok := ok + 1;
    end;
  end if;

  -- ④ 대표로 본 팀장 화면 목록
  select count(*) into v_views from public.my_pilot_views();
  select count(*) into v_expect from public.workspaces w
    join public.os_access p on p.user_id = w.owner_id and p.tier = 'pilot' and p.audience = 'internal'
    join public.workspace_members m on m.workspace_id = w.id and m.user_id = v_owner;
  if v_views = v_expect then
    r := r || E'\n✓ ④ 대표 팀장 화면 목록 ' || v_views || '곳 — 대표가 구성원인 내부 팀장 작업공간 수와 같음';
    ok := ok + 1;
  else
    r := r || E'\n✗ ④ 대표 팀장 화면 목록 ' || v_views || '곳 — 기대 ' || v_expect || '곳';
    bad := bad + 1;
  end if;

  raise exception using
    errcode = 'P0001',
    message = '[점검 끝 · 정상] 통과 ' || ok || ' · 실패 ' || bad || ' — 시도한 것은 이 오류로 전부 되돌렸습니다(자료 변경 0).' || r;
end $$;
