-- =====================================================================
-- Stage 12A · 감사 로그 + 로컬 데이터 가져오기 작업
-- ---------------------------------------------------------------------
--   * audit_events        : 주요 변경 이력(append-only)
--   * data_import_jobs     : localStorage → Supabase 가져오기 작업 단위
--   * data_import_items    : 작업 내 도메인·항목별 진행 상태(재실행/이어받기용)
--   원문 토큰·비밀값은 감사 로그에 남기지 않는다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 감사 이벤트
-- ---------------------------------------------------------------------
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_ws_idx on public.audit_events (workspace_id, created_at desc);

alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

drop policy if exists audit_events_select on public.audit_events;
create policy audit_events_select on public.audit_events
  for select using (public.is_workspace_member(workspace_id));

-- 자신의 행위만, 멤버인 워크스페이스에 대해 기록 (append-only)
drop policy if exists audit_events_insert on public.audit_events;
create policy audit_events_insert on public.audit_events
  for insert with check (
    public.is_workspace_member(workspace_id)
    and (actor_id = auth.uid() or actor_id is null)
  );
-- update/delete 정책 없음 → 수정·삭제 불가(append-only)

-- ---------------------------------------------------------------------
-- 가져오기 작업 (job)
-- ---------------------------------------------------------------------
create table if not exists public.data_import_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  status public.import_job_status not null default 'pending',
  source_schema_version integer,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists data_import_jobs_ws_idx on public.data_import_jobs (workspace_id, created_at desc);

alter table public.data_import_jobs enable row level security;
alter table public.data_import_jobs force row level security;

drop policy if exists data_import_jobs_select on public.data_import_jobs;
create policy data_import_jobs_select on public.data_import_jobs
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists data_import_jobs_insert on public.data_import_jobs;
create policy data_import_jobs_insert on public.data_import_jobs
  for insert with check (
    public.can_write_workspace(workspace_id) and actor_id = auth.uid()
  );

drop policy if exists data_import_jobs_update on public.data_import_jobs;
create policy data_import_jobs_update on public.data_import_jobs
  for update using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

drop policy if exists data_import_jobs_delete on public.data_import_jobs;
create policy data_import_jobs_delete on public.data_import_jobs
  for delete using (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  );

-- ---------------------------------------------------------------------
-- 가져오기 항목 (item) — 도메인·원본 id 단위 멱등 처리
-- ---------------------------------------------------------------------
create table if not exists public.data_import_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.data_import_jobs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  domain text not null,
  source_id text not null,
  target_id uuid,
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  unique (job_id, domain, source_id)
);
create index if not exists data_import_items_job_idx on public.data_import_items (job_id);
create index if not exists data_import_items_ws_idx on public.data_import_items (workspace_id);

alter table public.data_import_items enable row level security;
alter table public.data_import_items force row level security;

drop policy if exists data_import_items_select on public.data_import_items;
create policy data_import_items_select on public.data_import_items
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists data_import_items_insert on public.data_import_items;
create policy data_import_items_insert on public.data_import_items
  for insert with check (public.can_write_workspace(workspace_id));

drop policy if exists data_import_items_update on public.data_import_items;
create policy data_import_items_update on public.data_import_items
  for update using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

drop policy if exists data_import_items_delete on public.data_import_items;
create policy data_import_items_delete on public.data_import_items
  for delete using (public.can_write_workspace(workspace_id));

-- job updated_at 트리거
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'touch_data_import_jobs_updated_at') then
    create trigger touch_data_import_jobs_updated_at before update on public.data_import_jobs
      for each row execute function public.touch_updated_at();
  end if;
end;
$$;
