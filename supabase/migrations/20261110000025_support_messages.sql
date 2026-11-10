-- =====================================================================
-- D-568 출시 목록 L-4 — 고객 문의 · 화면 오류를 대표(운영자)가 받는 길 — 운영 미적용(대표 승인 뒤 SQL Editor 에서)
--
-- 왜: 외부 구독 고객의 작업공간에는 대표가 들어가지 않는다(0024). 그래서 고객 화면에서 난 오류 · 고객이 묻고 싶은 것이
--   대표에게 닿을 길이 없었다(팀장용 설문은 '대표가 팀장 작업공간 편집자' 라서 읽히는 것 — 고객에게는 안 통한다).
--
-- 방법(추가만 — 표 1 · 함수 6 · 정책 1):
--   - support_messages: 보낸 사람 · 종류(question 문의 / error 화면 오류) · 글 · 화면 정보 · 읽음 · 답장 · 답장 본 때.
--   - 쓰기는 전부 함수로만(표에 직접 넣기 · 고치기 · 지우기 권한 없음):
--       support_send        로그인 + 등급(os_access)이 있는 계정만 · 하루 문의 20 · 오류 30 · 같은 오류는 하루 한 줄
--       support_mark_read   운영자만 — 읽음 표시
--       support_reply       운영자만 — 답장(답장 · 읽음 · 답장 때만 바뀐다)
--       support_seen        보낸 사람만 — 답장을 봤다는 표시
--   - 읽기: 내가 보낸 것만(RLS). 운영자는 전부 — support_inbox() 가 보낸 사람 이름 · 이메일을 붙여 준다.
--   - 운영자 = 상담신청을 받는 작업공간(default_intake_workspace)의 주인 + 등급 full(= 대표). 이름 · 이메일로 고르지 않는다.
--     로그인한 사람이 없으면(서버 작업) 운영자가 아니다 — 함수로는 아무것도 못 한다(SQL Editor 는 표를 직접 본다).
--   - 고객사 자료(업체 · 서류 · 일기)는 이 표에 들어오지 않는다 — 앱이 글 · 화면 주소 · 오류 글만 보낸다(숫자 6자리 이상 · 이메일은 가려서).
-- 기존 표 · 열 · 정책 · 자료는 건드리지 않는다. 여러 번 실행해도 같다.
-- 선행: 0019(os_access · default_intake_workspace). 0024 가 없어도 된다(고객 · 내부 구분 칸은 있으면 붙인다).
-- 되돌리기(필요할 때만): 함수 6개 execute 권한 revoke — 표는 남겨도 무해(앱은 함수가 막히면 단추를 숨긴다).
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.os_access') is null or to_regprocedure('public.default_intake_workspace()') is null then
    raise exception '0019(20261007000019_os_access_pilot.sql)를 먼저 실행하세요. 0025 는 아무것도 바꾸지 않았습니다.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1) 표 — 덧붙이기만. 앱 계정은 읽기만(쓰기는 아래 함수로)
-- ---------------------------------------------------------------------
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('question', 'error')),
  body text not null check (char_length(body) between 1 and 2000),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object' and pg_column_size(context) <= 4096),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  reply text check (reply is null or char_length(reply) between 1 and 2000),
  replied_at timestamptz,
  seen_at timestamptz
);
comment on table public.support_messages is 'D-568 고객 문의 · 화면 오류 — 보낸 사람은 자기 것만, 운영자(대표)는 전부 읽는다. 쓰기는 support_* 함수로만.';
create index if not exists support_messages_user_idx on public.support_messages (user_id, created_at desc);
create index if not exists support_messages_created_idx on public.support_messages (created_at desc);

alter table public.support_messages enable row level security;
revoke all on table public.support_messages from public, anon, authenticated;
grant select on table public.support_messages to authenticated;

-- 운영자인가 — 상담신청 받는 작업공간의 주인 + 등급 full. 로그인한 사람이 없으면 false.
create or replace function public.support_is_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.workspaces w
    join public.os_access a on a.user_id = w.owner_id and a.tier = 'full'
    where w.id = public.default_intake_workspace() and w.owner_id = auth.uid()
  );
$$;
revoke all on function public.support_is_operator() from public, anon;
grant execute on function public.support_is_operator() to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'support_messages' and policyname = 'support_messages_select_own_or_operator') then
    create policy support_messages_select_own_or_operator on public.support_messages
      for select to authenticated
      using (user_id = auth.uid() or public.support_is_operator());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) 보내기 — 로그인 + 등급이 있는 계정만. 하루 한도 · 같은 오류는 하루 한 줄
-- ---------------------------------------------------------------------
create or replace function public.support_send(p_kind text, p_body text, p_context jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := left(btrim(coalesce(p_body, '')), 2000);
  v_ctx jsonb := coalesce(p_context, '{}'::jsonb);
  v_id uuid;
  v_n integer;
begin
  if v_uid is null then
    raise exception 'support_login_required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.os_access a where a.user_id = v_uid) then
    raise exception 'support_not_allowed' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('question', 'error') then
    raise exception 'support_bad_kind' using errcode = '22023';
  end if;
  if char_length(v_body) = 0 then
    raise exception 'support_empty' using errcode = '22023';
  end if;
  if jsonb_typeof(v_ctx) <> 'object' or pg_column_size(v_ctx) > 4096 then
    v_ctx := '{}'::jsonb;
  end if;
  -- 같은 오류가 하루 안에 또 나면 새 줄을 만들지 않는다(받은함이 같은 줄로 차지 않게)
  if p_kind = 'error' then
    select m.id into v_id
    from public.support_messages m
    where m.user_id = v_uid and m.kind = 'error' and m.body = v_body and m.created_at > now() - interval '24 hours'
    order by m.created_at desc
    limit 1;
    if v_id is not null then
      return v_id;
    end if;
  end if;
  select count(*) into v_n
  from public.support_messages m
  where m.user_id = v_uid and m.kind = p_kind and m.created_at > now() - interval '24 hours';
  if v_n >= (case when p_kind = 'error' then 30 else 20 end) then
    raise exception 'support_rate_limited' using errcode = 'P0001';
  end if;
  insert into public.support_messages (user_id, kind, body, context)
  values (v_uid, p_kind, v_body, v_ctx)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.support_send(text, text, jsonb) from public, anon;
grant execute on function public.support_send(text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 3) 운영자 받은함 — 보낸 사람 이름 · 이메일 · 고객/내부 구분을 붙여서. 운영자가 아니면 0줄
-- ---------------------------------------------------------------------
create or replace function public.support_inbox(p_limit integer default 200)
returns table (
  id uuid,
  user_id uuid,
  kind text,
  body text,
  context jsonb,
  created_at timestamptz,
  read_at timestamptz,
  reply text,
  replied_at timestamptz,
  seen_at timestamptz,
  author_name text,
  author_email text,
  author_audience text
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.user_id, m.kind, m.body, m.context, m.created_at, m.read_at, m.reply, m.replied_at, m.seen_at,
         coalesce(nullif(btrim(p.display_name), ''), '') as author_name,
         coalesce(p.email, '') as author_email,
         -- audience 칸(0024)이 아직 없어도 돈다
         coalesce(to_jsonb(a) ->> 'audience', 'internal') as author_audience
  from public.support_messages m
  left join public.profiles p on p.id = m.user_id
  left join public.os_access a on a.user_id = m.user_id
  where public.support_is_operator()
  order by m.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;
revoke all on function public.support_inbox(integer) from public, anon;
grant execute on function public.support_inbox(integer) to authenticated;

-- 읽음 표시 — 운영자만
create or replace function public.support_mark_read(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.support_is_operator() then
    raise exception 'support_operator_only' using errcode = '42501';
  end if;
  update public.support_messages m set read_at = now()
  where m.id = any (coalesce(p_ids, '{}'::uuid[])) and m.read_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.support_mark_read(uuid[]) from public, anon;
grant execute on function public.support_mark_read(uuid[]) to authenticated;

-- 답장 — 운영자만. 답장 · 답장 때 · 읽음만 바뀐다(보낸 글은 그대로). 다시 답하면 '답장 본 때' 를 비운다.
create or replace function public.support_reply(p_id uuid, p_reply text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reply text := left(btrim(coalesce(p_reply, '')), 2000);
begin
  if not public.support_is_operator() then
    raise exception 'support_operator_only' using errcode = '42501';
  end if;
  if char_length(v_reply) = 0 then
    raise exception 'support_empty' using errcode = '22023';
  end if;
  update public.support_messages m
  set reply = v_reply, replied_at = now(), read_at = coalesce(m.read_at, now()), seen_at = null
  where m.id = p_id;
  return found;
end;
$$;
revoke all on function public.support_reply(uuid, text) from public, anon;
grant execute on function public.support_reply(uuid, text) to authenticated;

-- 답장을 봤다 — 보낸 사람만, 자기 글만
create or replace function public.support_seen(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'support_login_required' using errcode = '42501';
  end if;
  update public.support_messages m set seen_at = now()
  where m.id = any (coalesce(p_ids, '{}'::uuid[])) and m.user_id = auth.uid() and m.reply is not null and m.seen_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.support_seen(uuid[]) from public, anon;
grant execute on function public.support_seen(uuid[]) to authenticated;

commit;

-- 확인(읽기만): 표 1 · 정책 1 · 함수 6 · 앱 계정의 표 권한은 SELECT 하나
select
  (select count(*) from pg_tables where schemaname = 'public' and tablename = 'support_messages') as table_count,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'support_messages') as policy_count,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'support\_%') as function_count,
  (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'support_messages' and grantee = 'authenticated') as authenticated_grants;
