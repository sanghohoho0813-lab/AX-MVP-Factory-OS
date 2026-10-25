-- =====================================================================
-- SAAS-2 고객별 AI 사용량 장부 + 이용 권한 — 대표가 아닌 계정(내부 팀장 · 구독 고객)의 AI 사용을 서버가 센다 · 한도를 지킨다
--
-- 왜: 사용량 제한이 서버 메모리에만 있었다(서버가 여러 대로 나뉘거나 다시 켜지면 0). 유료 고객의 월 한도 · 비용을 지킬 수 없었다.
--
--   ai_usage_config   (한 줄) 서버 비밀값의 해시 · 기본 월 한도 — 앱에서는 읽지도 쓰지도 못한다(권한 없음 · 정책 없음)
--   ai_entitlements   사람마다 이용 권한 — kind(internal 내부 팀장 / customer 구독 고객) · 요금제 · 마케팅 포함 여부 · 월 한도 · 이용 기한.
--                     앱은 내 줄만 읽는다. 쓰기는 SQL Editor(지금) → 3단계 이후 결제 확인 서버(그때 추가).
--   ai_usage_ledger   요청 한 번 = 한 줄(예약 → 정산 · 실패면 되돌림) — 앱은 내 줄만 읽는다. 쓰기는 아래 함수로만
--
-- 지키는 것
--   - 고객(customer)은 기본이 '쓸 수 없음' — 이용 기한(active_until)이 남은 줄이 있어야 AI 를 쓴다(줄이 없으면 막힘).
--     마케팅은 marketing = true 인 줄만. 서버와 이 함수가 두 번 막는다.
--   - 내부 팀장(internal)은 한도 없이 기록만(예전처럼 쓴다). 지금 pilot 등급 계정은 이 파일을 실행할 때 내부 팀장으로 자동 등록된다.
--   - 같은 요청 번호는 한 번만 센다(사람 + 요청 번호 하나) · 실패해서 되돌린 요청은 같은 번호로 다시 해도 한 번만
--   - 동시에 여러 번 눌러도 한도를 넘지 않는다(사람마다 잠금 — 한 줄씩 차례로 센다)
--   - '예약' 줄은 그 자체로 센다 — AI 는 답했는데 정산이 실패해도 장부에서 빠지지 않는다(예전: 10분 뒤 빠짐 → 고침).
--     서버가 중간에 멈춰 남은 예약은 3분 뒤 같은 요청 번호로 이어받고(다시 세지 않음), 15분 뒤에는 '자동 정산' 으로 닫는다.
--   - 장부를 쓰는 함수(예약 · 정산 · 되돌림)는 서버 비밀값을 아는 쪽(우리 서버 함수)만 부를 수 있다 —
--     고객이 자기 로그인으로 직접 불러 '공짜로 정산 · 되돌리기' 를 하지 못하게. 비밀값 원문은 DB 에 두지 않는다(sha256 해시만).
--   - 대표 계정은 세지 않는다(서버 함수가 대표에게는 이 함수를 부르지 않는다 — 대표 AI 는 예전 그대로).
--
-- 원칙: 추가만(표 3 · 함수 8 · 정책 2). 기존 표 · 열 · 정책 · 함수는 건드리지 않는다. RLS 를 켜고 끄지 않는다. 여러 번 실행해도 같다.
--   새 표는 RLS 를 켜되 FORCE 는 걸지 않는다 — 표 주인(이 파일을 실행한 계정)과 같은 주인의 SECURITY DEFINER 함수만 줄을 쓴다.
--   앱 역할(anon · authenticated)은 표 권한이 없거나(설정) 읽기만(내 줄) — 쓰기 권한 자체가 없다.
-- 선행: 0001(workspaces) · 0002(is_workspace_member). 0019(os_access)가 있으면 지금 pilot 계정을 내부 팀장으로 등록한다(없어도 멈추지 않음).
--
-- 적용(대표 — 검토 뒤에) — 순서 · 확인 방법은 docs/DECISIONS.md D-293 에 한 장으로:
--   1) Supabase SQL Editor 에 이 파일 전체를 붙여 실행
--   2) 서버 비밀값 정하기 — 32자 이상 무작위 글. 아래 한 줄의 <비밀값> 을 바꿔 SQL Editor 에서 실행:
--        insert into public.ai_usage_config (id, secret_hash, default_monthly_units)
--        values (1, sha256(convert_to('<비밀값>', 'UTF8')), 300)
--        on conflict (id) do update set secret_hash = excluded.secret_hash, default_monthly_units = excluded.default_monthly_units, updated_at = now();
--   3) Vercel › 이 프로젝트 › Settings › Environment Variables 에 AI_USAGE_SECRET = <같은 비밀값> (Production · 앞에 VITE_ 붙이지 않기) 넣고 다시 배포
--
-- 운영 SQL(SQL Editor 에서만 — 앱에서는 못 함)
--   내부 팀장 지정:  insert into public.ai_entitlements (user_id, kind, plan, note) values ('<user id>', 'internal', 'internal', '내부 팀장') on conflict (user_id) do update set kind = 'internal', plan = 'internal', updated_at = now();
--   마케팅 켜기/끄기: update public.ai_entitlements set marketing = true, updated_at = now() where user_id = '<user id>';
--   구독 고객(3단계 이후 결제가 대신 씀): insert into public.ai_entitlements (user_id, kind, plan, marketing, monthly_units, active_until, note)
--                    values ('<user id>', 'customer', 'growth', true, 600, now() + interval '1 month', '그로스') on conflict (user_id) do update set kind = excluded.kind, plan = excluded.plan, marketing = excluded.marketing, monthly_units = excluded.monthly_units, active_until = excluded.active_until, note = excluded.note, updated_at = now();
--   잘못 센 줄 돌려주기: update public.ai_usage_ledger set status = 'released', closed_by = 'admin', note = '<사유>', updated_at = now() where user_id = '<user id>' and request_id = '<요청 번호>';
--   정산 못 한 예약 점검(AI 는 답했는데 정산이 끝내 실패 — 이미 센 양에 들어가 있다):
--                    select user_id, request_id, assist_id, units, updated_at from public.ai_usage_ledger where status = 'reserved' and updated_at < now() - interval '15 minutes' order by updated_at;
--   그 줄 한 번에 닫기(센 양은 그대로 · 그 사람이 다음에 쓰면 저절로 닫히므로 꼭 할 필요는 없다):
--                    update public.ai_usage_ledger set status = 'settled', closed_by = 'admin', note = '정산 못 한 예약 닫음', updated_at = now() where status = 'reserved' and updated_at < now() - interval '15 minutes';
-- 끄기(되돌리기): Vercel 에서 AI_USAGE_SECRET 를 지우면 — 마케팅은 대표만 · 구독 고객 AI 는 멈춤 · 내부 팀장은 예전처럼(기록 없이). 표는 남는다(지우지 않는다).
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
revoke all on public.ai_usage_config from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) 이용 권한 — 사람마다 한 줄. 앱은 내 줄만 읽는다(쓰기는 SQL Editor · 3단계 이후 결제 확인 서버)
-- ---------------------------------------------------------------------
create table if not exists public.ai_entitlements (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  kind          text not null default 'customer' check (kind in ('internal', 'customer')),
  plan          text not null default 'none' check (plan ~ '^[a-z0-9_-]{1,40}$'),
  marketing     boolean not null default false,
  monthly_units int check (monthly_units is null or monthly_units between 0 and 1000000),
  active_until  timestamptz,
  note          text not null default '' check (char_length(note) <= 200),
  updated_at    timestamptz not null default now()
);
comment on table public.ai_entitlements is 'SAAS-2 AI 이용 권한(internal 내부 팀장 = 한도 없이 기록 / customer 구독 고객 = active_until 이 남아야 사용 · marketing 포함 여부 · 월 한도). 앱은 자기 줄만 읽음.';
alter table public.ai_entitlements enable row level security;
drop policy if exists ai_entitlements_select_self on public.ai_entitlements;
create policy ai_entitlements_select_self on public.ai_entitlements for select to authenticated using (user_id = auth.uid());
revoke all on public.ai_entitlements from public, anon, authenticated;
grant select on public.ai_entitlements to authenticated;

-- ---------------------------------------------------------------------
-- 3) 장부 — 요청 한 번 = 한 줄. 앱은 내 줄만 읽는다(쓰기는 아래 함수로만)
-- ---------------------------------------------------------------------
create table if not exists public.ai_usage_ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  request_id   text not null check (request_id ~ '^[A-Za-z0-9_-]{8,80}$'),
  assist_id    text not null check (assist_id ~ '^[A-Za-z0-9._-]{1,80}$'),
  feature      text not null default 'general' check (feature in ('general', 'marketing')),
  kind         text not null default 'customer' check (kind in ('internal', 'customer')),
  tier         text not null check (tier in ('cheap', 'standard', 'deep')),
  units        int not null check (units between 1 and 100),
  status       text not null check (status in ('reserved', 'settled', 'released')),
  closed_by    text check (closed_by is null or closed_by in ('server', 'auto', 'admin')),
  tokens_in    int check (tokens_in is null or tokens_in >= 0),
  tokens_out   int check (tokens_out is null or tokens_out >= 0),
  cost_usd     numeric(12, 6) check (cost_usd is null or cost_usd >= 0),
  note         text not null default '' check (char_length(note) <= 200),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, request_id)
);
comment on table public.ai_usage_ledger is 'SAAS-2 AI 사용량 장부(요청 한 번 = 한 줄 · 예약도 센다 · 정산/되돌림/자동 정산). 쓰기는 서버 비밀값을 아는 함수로만. 앱은 자기 줄만 읽음.';
create index if not exists ai_usage_ledger_user_month on public.ai_usage_ledger (user_id, created_at);
alter table public.ai_usage_ledger enable row level security;
drop policy if exists ai_usage_ledger_select_self on public.ai_usage_ledger;
create policy ai_usage_ledger_select_self on public.ai_usage_ledger for select to authenticated using (user_id = auth.uid());
revoke all on public.ai_usage_ledger from public, anon, authenticated;
grant select on public.ai_usage_ledger to authenticated;

-- ---------------------------------------------------------------------
-- 4) 안쪽 함수 — 이번 달(한국 시간) 시작 · 비밀값 확인 · 이번 달 센 양 · 이 사람 권한. 앱에서는 부를 수 없다
-- ---------------------------------------------------------------------
create or replace function public.ai_usage_month_start()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select (date_trunc('month', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
$$;
revoke all on function public.ai_usage_month_start() from public, anon, authenticated;

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

-- 이번 달 센 양 — 정산 + 예약(예약도 센다: AI 가 답했는데 정산이 실패해도 빠지지 않게). 되돌린 것만 뺀다
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
    and l.status in ('reserved', 'settled');
$$;
revoke all on function public.ai_usage_used(uuid) from public, anon, authenticated;

-- 이 사람 권한 — 줄이 없으면 고객 · 요금제 없음 · 쓸 수 없음(막힌 쪽이 기본). 내부 팀장은 한도 없음(limit = null)
create or replace function public.ai_usage_account(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  e public.ai_entitlements%rowtype;
  v_kind text;
  v_default int;
begin
  select * into e from public.ai_entitlements x where x.user_id = p_user;
  v_kind := coalesce(e.kind, 'customer');
  select c.default_monthly_units into v_default from public.ai_usage_config c where c.id = 1;
  return jsonb_build_object(
    'kind', v_kind,
    'plan', coalesce(e.plan, 'none'),
    'marketing', coalesce(e.marketing, false),
    'active', case when v_kind = 'internal' then true else coalesce(e.active_until > now(), false) end,
    'active_until', e.active_until,
    'limit', case when v_kind = 'internal' then null else coalesce(e.monthly_units, v_default, 0) end
  );
end;
$$;
revoke all on function public.ai_usage_account(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) 예약 — AI 를 부르기 전에. 같은 요청 번호는 한 번만 · 권한 · 한도 · 사람마다 차례로(잠금)
--    돌려주는 state: new(새로 셈) · retry(되돌린 요청을 다시 · 멈춘 예약을 이어받음) · inflight(같은 번호가 지금 도는 중) ·
--                   done(이미 끝난 번호) · conflict(같은 번호 · 다른 단추) · quota(한도 넘음) ·
--                   inactive(고객인데 이용 기한 없음) · not_entitled(마케팅이 포함되지 않음)
-- ---------------------------------------------------------------------
create or replace function public.ai_usage_reserve(p_secret text, p_request_id text, p_assist_id text, p_tier text, p_units int, p_workspace uuid default null, p_feature text default 'general')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.ai_usage_ledger%rowtype;
  acc jsonb;
  v_kind text;
  v_used int;
  v_limit int;
  v_ws uuid;
  v_exists boolean;
begin
  if uid is null then
    raise exception 'login_required';
  end if;
  perform public.ai_usage_check_secret(p_secret);
  if p_tier not in ('cheap', 'standard', 'deep') or p_units is null or p_units < 1 or p_units > 100
     or p_request_id is null or p_request_id !~ '^[A-Za-z0-9_-]{8,80}$'
     or p_assist_id is null or p_assist_id !~ '^[A-Za-z0-9._-]{1,80}$'
     or p_feature is null or p_feature not in ('general', 'marketing') then
    raise exception 'bad_usage_request';
  end if;
  -- 남의 작업공간 이름표는 붙이지 않는다(기록용 — 권한 판단에 쓰지 않음)
  v_ws := case when p_workspace is not null and public.is_workspace_member(p_workspace) then p_workspace else null end;
  -- 이 사람 줄을 셀 때는 한 번에 하나씩(동시에 눌러도 한도를 넘지 않게)
  perform pg_advisory_xact_lock(hashtextextended('ai_usage:' || uid::text, 0));
  -- 15분 넘게 남은 예약(서버가 멈춤) → 자동 정산(이미 센 것 — 상태만 닫는다)
  update public.ai_usage_ledger
     set status = 'settled', closed_by = 'auto', updated_at = now()
   where user_id = uid and status = 'reserved' and updated_at < now() - interval '15 minutes';
  acc := public.ai_usage_account(uid);
  v_kind := acc ->> 'kind';
  v_limit := (acc ->> 'limit')::int;
  select * into r from public.ai_usage_ledger l where l.user_id = uid and l.request_id = p_request_id for update;
  v_exists := found;
  if v_exists then
    if r.assist_id <> p_assist_id then
      return jsonb_build_object('state', 'conflict');
    end if;
    if r.status = 'settled' then
      return jsonb_build_object('state', 'done', 'used', public.ai_usage_used(uid), 'limit', v_limit);
    end if;
    if r.status = 'reserved' then
      if r.updated_at > now() - interval '3 minutes' then
        return jsonb_build_object('state', 'inflight', 'used', public.ai_usage_used(uid), 'limit', v_limit);
      end if;
      -- 3분 넘게 멈춘 예약(서버 함수 최대 60초) — 같은 번호로 이어받는다(이미 센 것이라 다시 세지 않음)
      update public.ai_usage_ledger set updated_at = now() where id = r.id;
      return jsonb_build_object('state', 'retry', 'used', public.ai_usage_used(uid), 'limit', v_limit);
    end if;
  end if;
  -- 새 요청 · 되돌린 요청을 다시 — 권한 · 한도
  if v_kind = 'customer' and not (acc ->> 'active')::boolean then
    return jsonb_build_object('state', 'inactive');
  end if;
  if p_feature = 'marketing' and not (acc ->> 'marketing')::boolean then
    return jsonb_build_object('state', 'not_entitled');
  end if;
  v_used := public.ai_usage_used(uid);
  if v_kind = 'customer' and v_used + p_units > v_limit then
    return jsonb_build_object('state', 'quota', 'used', v_used, 'limit', v_limit);
  end if;
  if v_exists then
    update public.ai_usage_ledger
       set status = 'reserved', tier = p_tier, units = p_units, feature = p_feature, kind = v_kind, closed_by = null,
           workspace_id = coalesce(v_ws, workspace_id), tokens_in = null, tokens_out = null, cost_usd = null,
           created_at = now(), updated_at = now()
     where id = r.id;
    return jsonb_build_object('state', 'retry', 'used', v_used + p_units, 'limit', v_limit);
  end if;
  insert into public.ai_usage_ledger (user_id, workspace_id, request_id, assist_id, feature, kind, tier, units, status)
  values (uid, v_ws, p_request_id, p_assist_id, p_feature, v_kind, p_tier, p_units, 'reserved');
  return jsonb_build_object('state', 'new', 'used', v_used + p_units, 'limit', v_limit);
end;
$$;
revoke all on function public.ai_usage_reserve(text, text, text, text, int, uuid, text) from public, anon;
grant execute on function public.ai_usage_reserve(text, text, text, text, int, uuid, text) to authenticated;

-- 정산 — AI 가 답했을 때(토큰 · 비용 기록). 예약 줄 · 서버가 중간에 되돌린 줄(답은 나갔으니 다시 센다) · 자동 정산된 줄(토큰만 채움).
--   대표가 SQL 로 돌려준 줄(closed_by = 'admin')은 건드리지 않는다 — 환불이 늦은 정산에 덮이지 않게
--   (security definer 안에서 부르는 ai_usage_check_secret · ai_usage_used · ai_usage_account 는 함수 주인 권한으로 돈다 — 앱 역할에는 실행 권한이 없다)
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
     set status = 'settled', closed_by = 'server',
         tokens_in = greatest(coalesce(p_tokens_in, 0), 0),
         tokens_out = greatest(coalesce(p_tokens_out, 0), 0),
         cost_usd = greatest(coalesce(p_cost_usd, 0), 0),
         updated_at = now()
   where user_id = uid and request_id = p_request_id
     and (status = 'reserved'
          or (status = 'released' and closed_by is distinct from 'admin')
          or (status = 'settled' and closed_by = 'auto'));
  get diagnostics n = row_count;
  return jsonb_build_object('settled', n, 'used', public.ai_usage_used(uid), 'limit', (public.ai_usage_account(uid) ->> 'limit')::int);
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
  update public.ai_usage_ledger set status = 'released', closed_by = 'server', updated_at = now()
   where user_id = uid and request_id = p_request_id and status = 'reserved';
  get diagnostics n = row_count;
  return jsonb_build_object('released', n, 'used', public.ai_usage_used(uid), 'limit', (public.ai_usage_account(uid) ->> 'limit')::int);
end;
$$;
revoke all on function public.ai_usage_release(text, text) from public, anon;
grant execute on function public.ai_usage_release(text, text) to authenticated;

-- 내 이용 권한 · 이번 달 사용량 — 화면 · 서버 판단용(비밀값 필요 없음 · 내 것만). 설정이 없으면 configured=false
create or replace function public.my_ai_access()
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
  return public.ai_usage_account(uid) || jsonb_build_object(
    'configured', exists (select 1 from public.ai_usage_config c where c.id = 1),
    'used', public.ai_usage_used(uid),
    'month', to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM')
  );
end;
$$;
revoke all on function public.my_ai_access() from public, anon;
grant execute on function public.my_ai_access() to authenticated;

-- ---------------------------------------------------------------------
-- 6) 지금 pilot 등급 계정(내부 팀장)은 내부 팀장으로 — 이 파일을 실행한 순간부터 예전처럼 쓰게(마케팅은 따로 켠다)
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.os_access') is not null then
    insert into public.ai_entitlements (user_id, kind, plan, note)
    select a.user_id, 'internal', 'internal', '0022 적용 때 pilot 계정 — 내부 팀장'
    from public.os_access a
    where a.tier = 'pilot'
    on conflict (user_id) do nothing;
  end if;
end $$;

commit;

-- 확인(실행 뒤 — 결과 3줄):
-- select to_regclass('public.ai_usage_config'), to_regclass('public.ai_entitlements'), to_regclass('public.ai_usage_ledger');
-- select a.tier, e.kind, e.plan, e.marketing from public.os_access a left join public.ai_entitlements e on e.user_id = a.user_id order by a.tier;
--   → full(대표) 줄은 kind 빈칸(대표는 세지 않음) · pilot(팀장) 줄은 internal
