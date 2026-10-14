-- =====================================================================
-- 대표 AI 작업실 V1 (Company Case Intelligence) — 권한 · 업체 Case · 기억 버전 · AI 실행 기록 · 수정 이력
--
-- 대표 지시(2026-10-14): 김상호 대표만 쓰는 기능. 은혜 팀장(Pilot) · 다른 구성원은 화면도, 데이터도, 서버 함수도 열리지 않는다.
--   - 이름으로 판별하지 않는다 → 기능 권한(capability) 'can_use_owner_ai_workspace'. 나중에 다른 사람에게 팔 때 줄 하나만 더 넣으면 된다.
--   - 처음 권한은 '상담신청을 받는 작업공간(default_intake_workspace)의 주인 + 등급 full' 한 사람에게만(= 대표).
--   - 권한이 있어도 등급이 full 이 아니면 false(Pilot 에게 실수로 줘도 열리지 않는다).
--   - 표 4개는 '내 것 + 권한 + 그 작업공간 구성원' 일 때만 읽고 쓴다. 기억 버전 · 실행 기록 · 수정 이력은 **덧붙이기만**(고치기 · 지우기 정책 없음).
--
-- 원칙: 추가만(표 5 · 함수 5 · 트리거 4 · 정책). 기존 표 · 열 · 정책은 건드리지 않는다. 여러 번 실행해도 같다.
-- 선행: 0019(os_access) · 0006(default_intake_workspace) · 0002(is_workspace_member).
-- 적용: Supabase SQL Editor 에 이 파일 전체를 붙여 실행 → 맨 아래 '확인' 쿼리 결과가 1 이면 대표 권한이 들어간 것.
-- 되돌리기(권한만 끄기): delete from public.user_capabilities where capability = 'can_use_owner_ai_workspace';
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.os_access') is null then
    raise exception '0019(20261007000019_os_access_pilot.sql)를 먼저 실행하세요. 0021 은 아무것도 바꾸지 않았습니다.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1) 기능 권한(capability) — 줄은 SQL Editor(서버)에서만 넣고 뺀다. 앱은 내 줄만 읽는다.
-- ---------------------------------------------------------------------
create table if not exists public.user_capabilities (
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null check (capability ~ '^[a-z][a-z0-9_]{2,63}$'),
  note text not null default '' check (char_length(note) <= 200),
  granted_at timestamptz not null default now(),
  primary key (user_id, capability)
);
alter table public.user_capabilities enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_capabilities' and policyname = 'user_capabilities_select_own') then
    create policy user_capabilities_select_own on public.user_capabilities for select to authenticated using (user_id = auth.uid());
  end if;
end $$;
revoke insert, update, delete on public.user_capabilities from anon, authenticated;

-- 이 기능을 쓸 수 있는가 — 로그인 · 권한 줄 · 등급 full 셋 다
create or replace function public.has_capability(p_cap text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (select 1 from public.user_capabilities c where c.user_id = auth.uid() and c.capability = p_cap)
    and exists (select 1 from public.os_access a where a.user_id = auth.uid() and a.tier = 'full');
$$;
revoke all on function public.has_capability(text) from public, anon;
grant execute on function public.has_capability(text) to authenticated;

-- 내 권한 목록(화면이 메뉴를 그릴 때) — 등급 full 이 아니면 빈 목록
create or replace function public.my_capabilities()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(c.capability order by c.capability), '{}'::text[])
  from public.user_capabilities c
  where c.user_id = auth.uid()
    and exists (select 1 from public.os_access a where a.user_id = auth.uid() and a.tier = 'full');
$$;
revoke all on function public.my_capabilities() from public, anon;
grant execute on function public.my_capabilities() to authenticated;

-- AI 작업실 표를 이 작업공간에서 쓸 수 있는가
create or replace function public.owner_ai_can(p_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_capability('can_use_owner_ai_workspace') and public.is_workspace_member(p_ws);
$$;
revoke all on function public.owner_ai_can(uuid) from public, anon;
grant execute on function public.owner_ai_can(uuid) to authenticated;

-- 처음 권한: 상담신청을 받는 작업공간의 주인 + 등급 full(= 대표). 이름 · 이메일로 고르지 않는다.
-- 서버(SQL Editor)에서만 부른다 — 대표 등급(0019)을 나중에 넣었으면 이 함수를 한 번 더 부르면 된다.
create or replace function public.owner_ai_seed_owner()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.user_capabilities (user_id, capability, note)
  select w.owner_id, 'can_use_owner_ai_workspace', '0021: 상담신청 받는 작업공간의 주인(대표)'
  from public.workspaces w
  where w.id = public.default_intake_workspace()
    and exists (select 1 from public.os_access a where a.user_id = w.owner_id and a.tier = 'full')
  on conflict (user_id, capability) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.owner_ai_seed_owner() from public, anon, authenticated;
select public.owner_ai_seed_owner();

-- ---------------------------------------------------------------------
-- 2) 업체 Case — 한 번이라도 검토한 회사(고객이 아니어도). 기존 고객(operations_clients)과 이어 둘 수 있다.
-- ---------------------------------------------------------------------
create table if not exists public.company_cases (
  id text primary key check (id ~ '^case_[A-Za-z0-9_-]{6,64}$'),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  -- 기본값 없음 — 앱이 늘 내 아이디를 보내고, 정책이 '본인' 인지 확인한다
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null check (char_length(btrim(company_name)) between 1 and 200),
  relation text not null default 'reviewed'
    check (relation in ('reviewed', 'peer_request', 'meeting', 'prospect', 'proposing', 'contracted', 'on_hold', 'closed')),
  client_id text null check (client_id is null or char_length(client_id) between 1 and 120),
  biz_no text not null default '' check (biz_no = '' or biz_no ~ '^[0-9]{10}$'),
  homepage_url text not null default '' check (char_length(homepage_url) <= 500),
  payload jsonb not null default '{}'::jsonb,
  context_version integer not null default 0 check (context_version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null
);
create index if not exists company_cases_owner_idx on public.company_cases (workspace_id, owner_id, updated_at desc);
-- 같은 고객에 Case 둘 · 같은 사업자번호 둘을 만들지 않는다(보관한 것은 빼고)
create unique index if not exists company_cases_client_uniq on public.company_cases (owner_id, client_id) where client_id is not null and archived_at is null;
create unique index if not exists company_cases_bizno_uniq on public.company_cases (owner_id, biz_no) where biz_no <> '' and archived_at is null;
alter table public.company_cases enable row level security;

-- 바꿀 수 없는 칸(작업공간 · 주인 · 만든 때) · 이어 둔 고객은 같은 작업공간이어야
create or replace function public.company_cases_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.workspace_id <> old.workspace_id or new.owner_id <> old.owner_id or new.created_at <> old.created_at then
      raise exception '업체 Case 의 작업공간 · 주인은 바꿀 수 없습니다';
    end if;
  end if;
  if new.client_id is not null and not exists (
    select 1 from public.operations_clients c where c.id = new.client_id and c.workspace_id = new.workspace_id
  ) then
    raise exception '같은 작업공간의 고객만 이어 둘 수 있습니다';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'company_cases_guard_trg') then
    create trigger company_cases_guard_trg before insert or update on public.company_cases
      for each row execute function public.company_cases_guard();
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'company_cases' and policyname = 'company_cases_select') then
    create policy company_cases_select on public.company_cases for select to authenticated
      using (owner_id = auth.uid() and public.owner_ai_can(workspace_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'company_cases' and policyname = 'company_cases_insert') then
    create policy company_cases_insert on public.company_cases for insert to authenticated
      with check (owner_id = auth.uid() and public.owner_ai_can(workspace_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'company_cases' and policyname = 'company_cases_update') then
    create policy company_cases_update on public.company_cases for update to authenticated
      using (owner_id = auth.uid() and public.owner_ai_can(workspace_id))
      with check (owner_id = auth.uid() and public.owner_ai_can(workspace_id));
  end if;
end $$;
-- 지우기 정책 없음 — 보관(archived_at)만. 판단 기록이 사라지지 않게.
revoke delete, truncate on public.company_cases from anon, authenticated;

-- 이 Case 를 내가 볼 수 있는가(아래 표들이 쓴다)
create or replace function public.owner_ai_case_visible(p_case text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_cases c
    where c.id = p_case and c.owner_id = auth.uid() and public.owner_ai_can(c.workspace_id)
  );
$$;
revoke all on function public.owner_ai_case_visible(text) from public, anon;
grant execute on function public.owner_ai_case_visible(text) to authenticated;

-- ---------------------------------------------------------------------
-- 3) 지금까지의 핵심 기억(Current Context) — 버전마다 한 줄. 고치면 새 버전, 예전 버전은 그대로.
-- ---------------------------------------------------------------------
create table if not exists public.company_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  case_id text not null references public.company_cases(id) on delete cascade,
  version integer not null check (version >= 1),
  content jsonb not null,
  source text not null default 'manual' check (char_length(source) between 1 and 120),
  note text not null default '' check (char_length(note) <= 500),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (case_id, version)
);
alter table public.company_context_snapshots enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'company_context_snapshots' and policyname = 'context_snapshots_select') then
    create policy context_snapshots_select on public.company_context_snapshots for select to authenticated
      using (public.owner_ai_case_visible(case_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'company_context_snapshots' and policyname = 'context_snapshots_insert') then
    create policy context_snapshots_insert on public.company_context_snapshots for insert to authenticated
      with check (created_by = auth.uid() and public.owner_ai_case_visible(case_id));
  end if;
end $$;
revoke update, delete, truncate on public.company_context_snapshots from anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) AI 실행 기록 — 어떤 스킬 · 판 · 모델 · 업체 기억 버전 · 입력 · 결과 · 토큰 · 비용 · 평가
--    결과는 고치지 않는다(고친 글은 ai_output_revisions). 평가(채택 · 일부 채택 · 폐기)만 바뀐다.
-- ---------------------------------------------------------------------
create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  company_case_id text not null references public.company_cases(id) on delete cascade,
  skill_id text not null check (skill_id ~ '^[A-Z][A-Z0-9_]{1,40}$'),
  skill_version integer not null check (skill_version >= 0),
  input jsonb not null default '{}'::jsonb,
  structured_output jsonb null,
  rendered_output text not null default '',
  context_snapshot_id uuid null references public.company_context_snapshots(id),
  context_version integer null,
  provider text not null check (char_length(provider) between 1 and 40),
  model text not null default '' check (char_length(model) <= 120),
  tier text not null default 'standard' check (tier in ('cheap', 'standard', 'deep', 'manual')),
  status text not null check (status in ('succeeded', 'parse_fallback', 'failed', 'pasted')),
  evaluation text not null default 'draft' check (evaluation in ('draft', 'adopted', 'partially_adopted', 'rejected')),
  evaluation_note text not null default '' check (char_length(evaluation_note) <= 2000),
  adopted_part jsonb null,
  evaluated_at timestamptz null,
  token_usage jsonb not null default '{}'::jsonb,
  estimated_cost numeric(14, 6) null,
  request_id text null check (request_id is null or char_length(request_id) between 8 and 80),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (created_by, request_id)
);
create index if not exists ai_runs_case_idx on public.ai_runs (company_case_id, created_at desc);
create index if not exists ai_runs_month_idx on public.ai_runs (created_by, created_at desc);
alter table public.ai_runs enable row level security;

-- 평가만 바뀐다 — 스킬 · 입력 · 결과 · 모델 · 토큰 · 비용 · 만든 사람 · 때는 그대로
create or replace function public.ai_runs_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id <> old.id or new.company_case_id <> old.company_case_id or new.skill_id <> old.skill_id
     or new.skill_version <> old.skill_version or new.input <> old.input
     or new.structured_output is distinct from old.structured_output or new.rendered_output <> old.rendered_output
     or new.context_snapshot_id is distinct from old.context_snapshot_id or new.context_version is distinct from old.context_version
     or new.provider <> old.provider or new.model <> old.model or new.tier <> old.tier or new.status <> old.status
     or new.token_usage <> old.token_usage or new.estimated_cost is distinct from old.estimated_cost
     or new.request_id is distinct from old.request_id or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'AI 실행 결과는 고칠 수 없습니다 — 고친 글은 수정 이력(ai_output_revisions)으로 남깁니다';
  end if;
  return new;
end;
$$;
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'ai_runs_guard_trg') then
    create trigger ai_runs_guard_trg before update on public.ai_runs for each row execute function public.ai_runs_guard();
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_runs' and policyname = 'ai_runs_select') then
    create policy ai_runs_select on public.ai_runs for select to authenticated
      using (created_by = auth.uid() and public.owner_ai_case_visible(company_case_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_runs' and policyname = 'ai_runs_insert') then
    create policy ai_runs_insert on public.ai_runs for insert to authenticated
      with check (created_by = auth.uid() and public.owner_ai_case_visible(company_case_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_runs' and policyname = 'ai_runs_update_eval') then
    create policy ai_runs_update_eval on public.ai_runs for update to authenticated
      using (created_by = auth.uid() and public.owner_ai_case_visible(company_case_id))
      with check (created_by = auth.uid() and public.owner_ai_case_visible(company_case_id));
  end if;
end $$;
revoke delete, truncate on public.ai_runs from anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) 사람이 고친 글 — 고칠 때마다 새 번호(예전 글은 그대로)
-- ---------------------------------------------------------------------
create table if not exists public.ai_output_revisions (
  original_run_id uuid not null references public.ai_runs(id) on delete cascade,
  revision_no integer not null check (revision_no >= 1),
  content jsonb not null,
  note text not null default '' check (char_length(note) <= 500),
  edited_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (original_run_id, revision_no)
);
alter table public.ai_output_revisions enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_output_revisions' and policyname = 'ai_revisions_select') then
    create policy ai_revisions_select on public.ai_output_revisions for select to authenticated
      using (exists (select 1 from public.ai_runs r where r.id = original_run_id and r.created_by = auth.uid() and public.owner_ai_case_visible(r.company_case_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_output_revisions' and policyname = 'ai_revisions_insert') then
    create policy ai_revisions_insert on public.ai_output_revisions for insert to authenticated
      with check (edited_by = auth.uid() and exists (select 1 from public.ai_runs r where r.id = original_run_id and r.created_by = auth.uid() and public.owner_ai_case_visible(r.company_case_id)));
  end if;
end $$;
revoke update, delete, truncate on public.ai_output_revisions from anon, authenticated;

-- 로그인 안 한 사람(anon)은 표 자체를 못 연다(정책으로 0줄이 아니라 권한 없음)
revoke all on public.user_capabilities, public.company_cases, public.company_context_snapshots, public.ai_runs, public.ai_output_revisions from anon;
grant select, insert, update on public.company_cases to authenticated;
grant select, insert on public.company_context_snapshots to authenticated;
grant select, insert, update on public.ai_runs to authenticated;
grant select, insert on public.ai_output_revisions to authenticated;
grant select on public.user_capabilities to authenticated;

commit;

-- 확인(SQL Editor): 대표 권한이 들어갔는가 — 1 이면 됨, 0 이면 docs/OWNER_AI_WORKSPACE_V1.md '수동 설정' 을 보세요
select count(*) as owner_ai_granted from public.user_capabilities where capability = 'can_use_owner_ai_workspace';
