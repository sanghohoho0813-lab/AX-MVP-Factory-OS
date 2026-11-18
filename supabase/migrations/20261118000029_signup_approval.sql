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
begin;

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

commit;

-- 확인(바꾸지 않음): 결정 기록 표 · 함수 6
select (select count(*) from pg_tables where schemaname = 'public' and tablename = 'signup_decisions') as decisions_table,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
          and p.proname in ('signup_request_check', 'my_signup_status', 'signup_requests', 'signup_requests_count', 'signup_approve', 'signup_reject')) as functions;
