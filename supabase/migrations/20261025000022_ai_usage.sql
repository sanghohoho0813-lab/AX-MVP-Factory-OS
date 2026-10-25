-- =====================================================================
-- SAAS-2 고객별 AI 사용량 장부 — 대표가 아닌 계정(팀장 · 구독 고객)의 AI 사용을 서버가 센다 · 한도를 지킨다
--
-- 왜: 사용량 제한이 서버 메모리에만 있었다(서버가 여러 대로 나뉘거나 다시 켜지면 0). 유료 고객의 월 한도 · 비용을 지킬 수 없었다.
--
--   ai_usage_config  (한 줄) 서버 비밀값의 해시 · 기본 월 한도 — 앱에서는 읽지도 쓰지도 못한다(정책 없음 · 권한 없음)
--   ai_usage_limits  사람마다 월 한도(요금제가 붙기 전에는 SQL Editor 에서 줄을 넣는다) — 앱은 내 줄만 읽는다
--   ai_usage_ledger  요청 한 번 = 한 줄(예약 → 정산 · 실패면 되돌림) — 앱은 내 줄만 읽는다. 쓰기는 아래 함수로만
--
-- 지키는 것
--   - 같은 요청 번호는 한 번만 센다(사람 + 요청 번호 하나) · 실패해서 되돌린 요청은 같은 번호로 다시 해도 한 번만
--   - 동시에 여러 번 눌러도 한도를 넘지 않는다(사람마다 잠금 — 한 줄씩 차례로 센다)
--   - 장부를 쓰는 함수(예약 · 정산 · 되돌림)는 서버 비밀값을 아는 쪽(우리 서버 함수)만 부를 수 있다 —
--     고객이 자기 로그인으로 직접 불러 '공짜로 정산 · 되돌리기' 를 하지 못하게. 비밀값 원문은 DB 에 두지 않는다(sha256 해시만).
--   - 서버 함수가 중간에 죽어 '예약' 으로 남은 줄은 10분 뒤 센 데서 빠진다(고객이 손해 보지 않게)
--   - 대표 계정은 세지 않는다(서버 함수가 대표에게는 이 함수를 부르지 않는다 — 대표 AI 는 예전 그대로)
--
-- 원칙: 추가만(표 3 · 함수 6 · 정책 2). 기존 표 · 열 · 정책 · 함수는 건드리지 않는다. RLS 를 끄지 않는다. 여러 번 실행해도 같다.
-- 선행: 0001(workspaces) · 0002(is_workspace_member) — 0019 와 순서 상관없이 적용된다(누가 대표인지는 서버 함수가 0019 등급으로 판단해 대표에게는 부르지 않는다).
--
-- 적용(대표 — 검토 뒤에):
--   1) Supabase SQL Editor 에 이 파일 전체를 붙여 실행
--   2) 서버 비밀값 정하기 — 32자 이상 아무 글(예: 비밀번호 관리자에서 만든 무작위 글). 아래 한 줄의 <비밀값> 을 바꿔 SQL Editor 에서 실행:
--        insert into public.ai_usage_config (id, secret_hash, default_monthly_units)
--        values (1, sha256(convert_to('<비밀값>', 'UTF8')), 300)
--        on conflict (id) do update set secret_hash = excluded.secret_hash, default_monthly_units = excluded.default_monthly_units, updated_at = now();
--   3) Vercel › 이 프로젝트 › Settings › Environment Variables 에 AI_USAGE_SECRET = <같은 비밀값> (Production) 넣고 다시 배포
--   → 그때부터 팀장 · 고객 AI 가 장부로 세지고, 마케팅 · 브랜딩이 고객에게 열린다. 1)만 하고 2) · 3) 을 안 하면 아무것도 바뀌지 않는다.
--
-- 한도 바꾸기(사람마다): insert into public.ai_usage_limits (user_id, monthly_units, note) values ('<user id>', 600, '프로') on conflict (user_id) do update set monthly_units = excluded.monthly_units, note = excluded.note, updated_at = now();
-- 끄기(되돌리기): Vercel 에서 AI_USAGE_SECRET 를 지우면 서버가 장부를 쓰지 않는다(마케팅은 다시 대표만). 표는 남는다(지우지 않는다).
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1) 설정(한 줄) — 앱에서는 보이지도 않는다
-- ---------------------------------------------------------------------
create table if not exists public.ai_usage_config (
  id                    int primary key default 1 check (id = 1),
  secret_hash           bytea not null check (octet_length(secret_hash) = 32),
  default_monthly_units int not null default 300 check (default_monthly_units between 0 and 1000000),
  updated_at            timestamptz not null default now()
);
comment on table public.ai_usage_config is 'SAAS-2 AI 사용량 장부 설정(서버 비밀값 sha256 · 기본 월 한도). 앱에서는 읽기 · 쓰기 모두 불가 — SQL Editor 에서만.';
alter table public.ai_usage_config enable row level security;
alter table public.ai_usage_config force row level security;
revoke all on public.ai_usage_config from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) 사람마다 월 한도 — 앱은 내 줄만 읽는다(쓰기는 SQL Editor)
-- ---------------------------------------------------------------------
create table if not exists public.ai_usage_limits (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  monthly_units int not null check (monthly_units between 0 and 1000000),
  note          text not null default '' check (char_length(note) <= 200),
  updated_at    timestamptz not null default now()
);
comment on table public.ai_usage_limits is 'SAAS-2 사람마다 AI 월 한도(단위). 없으면 ai_usage_config 기본값. 앱은 자기 줄만 읽음.';
alter table public.ai_usage_limits enable row level security;
alter table public.ai_usage_limits force row level security;
drop policy if exists ai_usage_limits_select_self on public.ai_usage_limits;
create policy ai_usage_limits_select_self on public.ai_usage_limits for select to authenticated using (user_id = auth.uid());
revoke all on public.ai_usage_limits from anon, authenticated;
grant select on public.ai_usage_limits to authenticated;

-- ---------------------------------------------------------------------
-- 3) 장부 — 요청 한 번 = 한 줄. 앱은 내 줄만 읽는다(쓰기는 아래 함수로만)
-- ---------------------------------------------------------------------
create table if not exists public.ai_usage_ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  request_id   text not null check (request_id ~ '^[A-Za-z0-9_-]{8,80}$'),
  assist_id    text not null check (assist_id ~ '^[A-Za-z0-9._-]{1,80}$'),
  tier         text not null check (tier in ('cheap', 'standard', 'deep')),
  units        int not null check (units between 1 and 100),
  status       text not null check (status in ('reserved', 'settled', 'released')),
  tokens_in    int check (tokens_in is null or tokens_in >= 0),
  tokens_out   int check (tokens_out is null or tokens_out >= 0),
  cost_usd     numeric(12, 6) check (cost_usd is null or cost_usd >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, request_id)
);
comment on table public.ai_usage_ledger is 'SAAS-2 AI 사용량 장부(요청 한 번 = 한 줄 · 예약 → 정산/되돌림). 쓰기는 서버 비밀값을 아는 함수로만. 앱은 자기 줄만 읽음.';
create index if not exists ai_usage_ledger_user_month on public.ai_usage_ledger (user_id, created_at);
alter table public.ai_usage_ledger enable row level security;
alter table public.ai_usage_ledger force row level security;
drop policy if exists ai_usage_ledger_select_self on public.ai_usage_ledger;
create policy ai_usage_ledger_select_self on public.ai_usage_ledger for select to authenticated using (user_id = auth.uid());
revoke all on public.ai_usage_ledger from anon, authenticated;
grant select on public.ai_usage_ledger to authenticated;

-- ---------------------------------------------------------------------
-- 4) 함수 — 이번 달(한국 시간) 시작 · 비밀값 확인 · 이번 달 쓴 양
-- ---------------------------------------------------------------------
create or replace function public.ai_usage_month_start()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select (date_trunc('month', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
$$;

-- 비밀값이 맞지 않으면 멈춘다(설정이 없으면 'ai_usage_not_configured')
create or replace function public.ai_usage_check_secret(p_secret text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v bytea;
begin
  select c.secret_hash into v from public.ai_usage_config c where c.id = 1;
  if v is null then
    raise exception 'ai_usage_not_configured';
  end if;
  if p_secret is null or char_length(p_secret) < 24 or sha256(convert_to(p_secret, 'UTF8')) <> v then
    raise exception 'ai_usage_bad_secret';
  end if;
end;
$$;
revoke all on function public.ai_usage_check_secret(text) from public, anon, authenticated;

-- 이번 달 센 양 — 정산된 것 + 10분 안의 예약(서버가 죽어 남은 오래된 예약은 빼고)
create or replace function public.ai_usage_used(p_user uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(l.units), 0)::int
  from public.ai_usage_ledger l
  where l.user_id = p_user
    and l.created_at >= public.ai_usage_month_start()
    and (l.status = 'settled' or (l.status = 'reserved' and l.updated_at > now() - interval '10 minutes'));
$$;
revoke all on function public.ai_usage_used(uuid) from public, anon, authenticated;

create or replace function public.ai_usage_limit_of(p_user uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select l.monthly_units from public.ai_usage_limits l where l.user_id = p_user),
    (select c.default_monthly_units from public.ai_usage_config c where c.id = 1),
    0
  );
$$;
revoke all on function public.ai_usage_limit_of(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) 예약 — AI 를 부르기 전에. 같은 요청 번호는 한 번만 · 한도를 넘으면 거절 · 사람마다 차례로(잠금)
--    돌려주는 state: new(새로 셈) · retry(되돌린 요청을 다시 — 다시 셈) · inflight(같은 번호가 지금 도는 중) ·
--                   done(이미 끝난 번호) · conflict(같은 번호 · 다른 단추) · quota(한도 넘음)
-- ---------------------------------------------------------------------
create or replace function public.ai_usage_reserve(p_secret text, p_request_id text, p_assist_id text, p_tier text, p_units int, p_workspace uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.ai_usage_ledger%rowtype;
  v_used int;
  v_limit int;
  v_ws uuid;
begin
  if uid is null then
    raise exception 'login_required';
  end if;
  perform public.ai_usage_check_secret(p_secret);
  if p_tier not in ('cheap', 'standard', 'deep') or p_units is null or p_units < 1 or p_units > 100
     or p_request_id is null or p_request_id !~ '^[A-Za-z0-9_-]{8,80}$'
     or p_assist_id is null or p_assist_id !~ '^[A-Za-z0-9._-]{1,80}$' then
    raise exception 'bad_usage_request';
  end if;
  -- 남의 작업공간 이름표는 붙이지 않는다(기록용 — 권한 판단에 쓰지 않음)
  v_ws := case when p_workspace is not null and public.is_workspace_member(p_workspace) then p_workspace else null end;
  -- 이 사람 줄을 셀 때는 한 번에 하나씩(동시에 눌러도 한도를 넘지 않게)
  perform pg_advisory_xact_lock(hashtextextended('ai_usage:' || uid::text, 0));
  v_limit := public.ai_usage_limit_of(uid);
  select * into r from public.ai_usage_ledger l where l.user_id = uid and l.request_id = p_request_id for update;
  if found then
    if r.assist_id <> p_assist_id then
      return jsonb_build_object('state', 'conflict');
    end if;
    if r.status = 'settled' then
      return jsonb_build_object('state', 'done', 'used', public.ai_usage_used(uid), 'limit', v_limit);
    end if;
    if r.status = 'reserved' and r.updated_at > now() - interval '10 minutes' then
      return jsonb_build_object('state', 'inflight', 'used', public.ai_usage_used(uid), 'limit', v_limit);
    end if;
    -- 되돌린 요청(또는 10분 넘게 남은 예약)을 다시 — 한도 안이면 다시 예약
    v_used := public.ai_usage_used(uid);
    if v_used + p_units > v_limit then
      return jsonb_build_object('state', 'quota', 'used', v_used, 'limit', v_limit);
    end if;
    update public.ai_usage_ledger
       set status = 'reserved', tier = p_tier, units = p_units, workspace_id = coalesce(v_ws, workspace_id),
           tokens_in = null, tokens_out = null, cost_usd = null, created_at = now(), updated_at = now()
     where id = r.id;
    return jsonb_build_object('state', 'retry', 'used', v_used + p_units, 'limit', v_limit);
  end if;
  v_used := public.ai_usage_used(uid);
  if v_used + p_units > v_limit then
    return jsonb_build_object('state', 'quota', 'used', v_used, 'limit', v_limit);
  end if;
  insert into public.ai_usage_ledger (user_id, workspace_id, request_id, assist_id, tier, units, status)
  values (uid, v_ws, p_request_id, p_assist_id, p_tier, p_units, 'reserved');
  return jsonb_build_object('state', 'new', 'used', v_used + p_units, 'limit', v_limit);
end;
$$;
revoke all on function public.ai_usage_reserve(text, text, text, text, int, uuid) from public, anon;
grant execute on function public.ai_usage_reserve(text, text, text, text, int, uuid) to authenticated;

-- 정산 — AI 가 답했을 때(토큰 · 비용 기록). 예약된 줄만
create or replace function public.ai_usage_settle(p_secret text, p_request_id text, p_tokens_in int default null, p_tokens_out int default null, p_cost_usd numeric default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then
    raise exception 'login_required';
  end if;
  perform public.ai_usage_check_secret(p_secret);
  update public.ai_usage_ledger
     set status = 'settled',
         tokens_in = greatest(coalesce(p_tokens_in, 0), 0),
         tokens_out = greatest(coalesce(p_tokens_out, 0), 0),
         cost_usd = greatest(coalesce(p_cost_usd, 0), 0),
         updated_at = now()
   where user_id = uid and request_id = p_request_id and status = 'reserved';
  get diagnostics n = row_count;
  return jsonb_build_object('settled', n, 'used', public.ai_usage_used(uid), 'limit', public.ai_usage_limit_of(uid));
end;
$$;
revoke all on function public.ai_usage_settle(text, text, int, int, numeric) from public, anon;
grant execute on function public.ai_usage_settle(text, text, int, int, numeric) to authenticated;

-- 되돌림 — AI 가 실패했을 때(센 것을 돌려준다). 예약된 줄만
create or replace function public.ai_usage_release(p_secret text, p_request_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then
    raise exception 'login_required';
  end if;
  perform public.ai_usage_check_secret(p_secret);
  update public.ai_usage_ledger set status = 'released', updated_at = now()
   where user_id = uid and request_id = p_request_id and status = 'reserved';
  get diagnostics n = row_count;
  return jsonb_build_object('released', n, 'used', public.ai_usage_used(uid), 'limit', public.ai_usage_limit_of(uid));
end;
$$;
revoke all on function public.ai_usage_release(text, text) from public, anon;
grant execute on function public.ai_usage_release(text, text) to authenticated;

-- 내 이번 달 사용량 — 화면 표시용(비밀값 필요 없음 · 내 것만). 설정이 없으면 configured=false
create or replace function public.my_ai_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return null;
  end if;
  return jsonb_build_object(
    'configured', exists (select 1 from public.ai_usage_config c where c.id = 1),
    'used', public.ai_usage_used(uid),
    'limit', public.ai_usage_limit_of(uid),
    'month', to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM')
  );
end;
$$;
revoke all on function public.my_ai_usage() from public, anon;
grant execute on function public.my_ai_usage() to authenticated;

commit;

-- 확인(실행 뒤): 표 3개가 보이면 된다
-- select to_regclass('public.ai_usage_config'), to_regclass('public.ai_usage_limits'), to_regclass('public.ai_usage_ledger');
