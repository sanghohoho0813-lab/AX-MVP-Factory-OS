-- =====================================================================
-- D-533 외부 구독 고객 계정 준비 — Supabase SQL Editor 에서 대표가 한 번 실행한다. (마이그레이션 아님 · 운영 미적용)
--
-- 내부 팀장은 supabase/manual/pilot_provision.sql(대표가 팀장 화면을 볼 수 있음).
-- 외부 구독 고객은 **이 파일** — 대표가 자동으로 그 작업공간에 들어가지 않는다(0024 가 DB 에서도 막는다).
--
-- 순서
--   0. 0019 → 0020 → 0022 → 0023 → 0024 를 먼저 실행해 둔다(0024 가 없으면 아래가 멈춘다).
--   1. 고객 계정 준비 — 둘 중 하나
--      a) 고객이 로그인 화면에서 직접 가입했다면 건너뛴다(D-579). 고객 화면 '이 계정은 아직 사용 승인 전이에요' 에 뜬 이메일을 받아 v_email 에 넣는다.
--      b) 대표가 만들어 줄 때는 Authentication → Users → Add user 로 계정(이메일 · 비밀번호)을 만든다. ('Auto Confirm User' 체크)
--   2. 아래 여섯 줄(v_email · v_ws_name · v_plan · v_units · v_months · v_marketing)만 바꿔 실행한다.
--   3. 고객은 그 화면에서 [승인됐는지 다시 확인] 만 누르면 열린다(다시 가입 · 다시 로그인할 필요 없음).
--
-- 하는 일: 그 계정을 pilot 등급(자기 작업공간 하나 · 대표 자료 0) + audience = customer 로 등록하고,
--          그 사람만 구성원인 빈 작업공간을 만들고, AI 권한을 customer 요금제(한도 · 기한)로 넣는다.
--   - 대표 연결 함수(os_access_link_owner_to_pilots)를 **부르지 않는다** — 불러도 customer 는 건너뛴다(0024).
--   - 업체 · 기록 · 일정 · 수금은 0개로 시작한다(아무것도 복사하지 않는다).
-- 여러 번 실행해도 같다(이미 있으면 그대로 · 요금제는 새 값으로).
-- =====================================================================
do $$
declare
  v_email     text := '여기에_고객_이메일@example.com';
  v_ws_name   text := '고객 작업공간';
  v_plan      text := 'growth';      -- 요금제 이름(영문 소문자 · 숫자 · _ -)
  v_units     int  := 600;           -- 월 AI 한도(장부 단위)
  v_months    int  := 1;             -- 이용 기한(개월)
  v_marketing boolean := true;       -- 마케팅 AI 단추 포함 여부(D-564 기본 포함 — 마케팅 화면은 요금제와 상관없이 보이고, 이 값은 그 안의 AI 단추)
  v_uid uuid;
  v_ws  uuid;
begin
  if to_regclass('public.os_access') is null or not exists (
    select 1 from information_schema.columns where table_schema = 'public' and table_name = 'os_access' and column_name = 'audience'
  ) then
    raise exception '0024(20261104000024_customer_audience.sql)를 먼저 실행하세요. 아무것도 바꾸지 않았습니다.';
  end if;
  select id into v_uid from auth.users where lower(email) = lower(btrim(v_email));
  if v_uid is null then
    raise exception '계정이 없습니다: % — Authentication → Users → Add user 로 먼저 만드세요.', v_email;
  end if;
  if exists (select 1 from public.os_access where user_id = v_uid and tier = 'full') then
    raise exception '이 계정은 대표 쪽(full) 계정입니다 — 고객으로 바꾸지 않습니다.';
  end if;
  if exists (select 1 from public.os_access where user_id = v_uid and audience = 'internal') then
    raise exception '이 계정은 내부 팀장(internal)입니다 — 고객으로 바꾸려면 대표 확인 뒤 따로 진행하세요(대표 구성원 줄 · AI 권한 정리 필요).';
  end if;
  if exists (select 1 from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
             join public.os_access a on a.user_id = w.owner_id and a.tier = 'full' where m.user_id = v_uid) then
    raise exception '이 계정은 대표 작업공간 구성원입니다 — 고객으로 쓰려면 먼저 그 작업공간에서 내보내세요.';
  end if;

  -- AI 권한 먼저(customer) — 0024 는 customer 계정에 internal AI 를 막는다
  if to_regclass('public.ai_entitlements') is not null then
    insert into public.ai_entitlements (user_id, kind, plan, marketing, monthly_units, active_until, note)
    values (v_uid, 'customer', v_plan, v_marketing, v_units, now() + make_interval(months => v_months), '외부 구독 고객(customer_provision)')
    on conflict (user_id) do update set kind = 'customer', plan = excluded.plan, marketing = excluded.marketing,
      monthly_units = excluded.monthly_units, active_until = excluded.active_until, note = excluded.note, updated_at = now();
  end if;

  insert into public.os_access (user_id, tier, note, audience) values (v_uid, 'pilot', '외부 구독 고객', 'customer')
  on conflict (user_id) do update set tier = 'pilot', note = '외부 구독 고객', audience = 'customer';

  select w.id into v_ws from public.workspaces w where w.owner_id = v_uid order by w.created_at limit 1;
  if v_ws is null then
    insert into public.workspaces (name, owner_id) values (v_ws_name, v_uid) returning id into v_ws;
    insert into public.workspace_members (workspace_id, user_id, role) values (v_ws, v_uid, 'owner');
    raise notice '고객 작업공간을 만들었습니다: % (%)', v_ws_name, v_ws;
  else
    raise notice '이미 고객 작업공간이 있습니다: %', v_ws;
  end if;
  -- 대표 연결은 하지 않는다(내부 팀장 전용 · D-533)
end $$;

-- 확인: 고객 작업공간의 구성원은 고객 한 사람(owner)뿐 · 대표 없음 · 업체 0
select w.name, p.email, m.role, (select count(*) from public.operations_clients c where c.workspace_id = w.id) as clients
from public.workspaces w join public.workspace_members m on m.workspace_id = w.id left join public.profiles p on p.id = m.user_id
where w.owner_id in (select user_id from public.os_access where audience = 'customer');
