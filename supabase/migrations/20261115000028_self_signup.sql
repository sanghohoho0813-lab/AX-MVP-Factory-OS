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
begin;

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

commit;

-- 확인(바꾸지 않음): 설정 한 줄 — open = false 여야 한다(대표가 켜기 전)
select open, seat_limit, trial_days, monthly_units, marketing from public.self_signup_policy;
