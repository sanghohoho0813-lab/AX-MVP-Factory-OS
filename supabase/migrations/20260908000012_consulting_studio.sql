-- 20260908000012_consulting_studio.sql
--
-- 컨설팅 작업실 — 특허 × 벤처기업확인 × AX/플랫폼 MVP 워크플로 엔진.
--
-- 고객(CLIENT)은 새로 만들지 않는다. 프로젝트는 operations_clients(id) 에 매달린다.
-- 단계 상태·사실표·핵심 줄기·참고자료 선택·특허/MVP/벤처/실사 작업공간은 프로젝트 한 행의
-- payload 에 함께 둔다(프로젝트와 1:1, 한 화면에서 함께 자동저장). 계속 늘어나는 것
-- (산출물·프롬프트 꾸러미·결정·증빙)만 각자 표를 갖는다.
--
-- 이 파일은 feature 브랜치에만 있다. Production 에 적용하지 않았다.
-- 적용 전까지 앱은 "READY — SQL 적용 후 사용" 안내만 보이고 아무것도 깨지지 않는다.
--
-- 원칙: additive only · 멱등 · workspace RLS · anon revoke · 고객용 RPC 는 이 표들을 읽지 않는다.
-- 주민등록번호·계좌번호·비밀번호·인증서·API 키를 넣는 컬럼은 없다.

begin;

-- ---------------------------------------------------------------------
-- 1. consulting_projects
-- ---------------------------------------------------------------------
create table if not exists public.consulting_projects (
  id            text primary key,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  client_id     text not null references public.operations_clients (id) on delete cascade,
  module_key    text not null default 'patent_venture_mvp'
                check (module_key in ('patent_venture_mvp')),
  title         text not null default '',
  status        text not null default 'active'
                check (status in ('active', 'on_hold', 'done', 'archived')),
  current_stage text not null default 'S0'
                check (current_stage ~ '^S([0-9]|1[0-6])$'),
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.consulting_projects is
  '컨설팅 워크플로 프로젝트(특허·벤처·MVP). payload = 단계 상태·사실표·핵심 줄기·작업공간. 고객은 operations_clients 를 재사용.';

create index if not exists consulting_projects_ws_idx
  on public.consulting_projects (workspace_id, updated_at desc);
create index if not exists consulting_projects_client_idx
  on public.consulting_projects (client_id);

drop trigger if exists trg_consulting_projects_updated on public.consulting_projects;
create trigger trg_consulting_projects_updated
  before update on public.consulting_projects
  for each row execute function public.bridge_touch_updated_at();

alter table public.consulting_projects enable row level security;
revoke all on public.consulting_projects from anon;

drop policy if exists "Workspace members can read consulting projects" on public.consulting_projects;
create policy "Workspace members can read consulting projects"
  on public.consulting_projects for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace writers can manage consulting projects" on public.consulting_projects;
create policy "Workspace writers can manage consulting projects"
  on public.consulting_projects for all
  using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

-- ---------------------------------------------------------------------
-- 2. consulting_artifacts — 산출물 (버전 이력)
-- ---------------------------------------------------------------------
create table if not exists public.consulting_artifacts (
  id                text primary key,
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  project_id        text not null references public.consulting_projects (id) on delete cascade,
  type              text not null,
  title             text not null default '',
  stage_key         text not null default 'S0' check (stage_key ~ '^S([0-9]|1[0-6])$'),
  version           integer not null default 1 check (version >= 1),
  status            text not null default 'draft'
                    check (status in ('draft', 'in_review', 'approved', 'superseded')),
  content           text not null default '',
  source            text not null default 'manual'
                    check (source in ('manual', 'llm_paste', 'llm_file', 'system')),
  prompt_package_id text,
  file_name         text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.consulting_artifacts is
  '컨설팅 산출물. 수동 LLM 왕복 결과(llm_paste/llm_file)와 직접 작성(manual)을 버전으로 보관.';

create index if not exists consulting_artifacts_project_idx
  on public.consulting_artifacts (project_id, type, version desc);

drop trigger if exists trg_consulting_artifacts_updated on public.consulting_artifacts;
create trigger trg_consulting_artifacts_updated
  before update on public.consulting_artifacts
  for each row execute function public.bridge_touch_updated_at();

alter table public.consulting_artifacts enable row level security;
revoke all on public.consulting_artifacts from anon;

drop policy if exists "Workspace members can read consulting artifacts" on public.consulting_artifacts;
create policy "Workspace members can read consulting artifacts"
  on public.consulting_artifacts for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace writers can manage consulting artifacts" on public.consulting_artifacts;
create policy "Workspace writers can manage consulting artifacts"
  on public.consulting_artifacts for all
  using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

-- ---------------------------------------------------------------------
-- 3. consulting_prompt_packages — 밖으로 들고 나간 프롬프트 (필터 통과본만 저장)
-- ---------------------------------------------------------------------
create table if not exists public.consulting_prompt_packages (
  id           text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id   text not null references public.consulting_projects (id) on delete cascade,
  type         text not null,
  target       text not null default 'general'
               check (target in ('general', 'chatgpt', 'claude', 'claude_code')),
  stage_key    text not null default 'S0' check (stage_key ~ '^S([0-9]|1[0-6])$'),
  title        text not null default '',
  prompt       text not null default '',
  context      text not null default '',
  privacy      jsonb not null default '{}'::jsonb,
  section      integer,
  created_at   timestamptz not null default now()
);
comment on table public.consulting_prompt_packages is
  '수동 LLM 왕복용 프롬프트 꾸러미. 개인정보 필터를 통과한 본문만 저장. 외부 API 호출 없음.';

create index if not exists consulting_prompt_packages_project_idx
  on public.consulting_prompt_packages (project_id, created_at desc);

alter table public.consulting_prompt_packages enable row level security;
revoke all on public.consulting_prompt_packages from anon;

drop policy if exists "Workspace members can read consulting prompts" on public.consulting_prompt_packages;
create policy "Workspace members can read consulting prompts"
  on public.consulting_prompt_packages for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace writers can manage consulting prompts" on public.consulting_prompt_packages;
create policy "Workspace writers can manage consulting prompts"
  on public.consulting_prompt_packages for all
  using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

-- ---------------------------------------------------------------------
-- 4. consulting_decisions — 결정 로그
-- ---------------------------------------------------------------------
create table if not exists public.consulting_decisions (
  id           text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id   text not null references public.consulting_projects (id) on delete cascade,
  stage_key    text not null default 'S0' check (stage_key ~ '^S([0-9]|1[0-6])$'),
  kind         text not null default 'other'
               check (kind in ('gate', 'stage', 'scope', 'fact', 'artifact', 'reference', 'policy', 'other')),
  summary      text not null check (char_length(trim(summary)) > 0),
  reason       text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists consulting_decisions_project_idx
  on public.consulting_decisions (project_id, created_at desc);

alter table public.consulting_decisions enable row level security;
revoke all on public.consulting_decisions from anon;

drop policy if exists "Workspace members can read consulting decisions" on public.consulting_decisions;
create policy "Workspace members can read consulting decisions"
  on public.consulting_decisions for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace writers can manage consulting decisions" on public.consulting_decisions;
create policy "Workspace writers can manage consulting decisions"
  on public.consulting_decisions for all
  using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

-- ---------------------------------------------------------------------
-- 5. consulting_evidence — 10개 첨부 슬롯 · Claim–Evidence
-- ---------------------------------------------------------------------
create table if not exists public.consulting_evidence (
  id           text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id   text not null references public.consulting_projects (id) on delete cascade,
  slot         integer not null check (slot between 1 and 10),
  claim        text not null default '',
  claim_status text not null default 'live'
               check (claim_status in ('live', 'demo', 'future', 'market', 'target')),
  title        text not null default '',
  source       text not null default '',
  links_patent boolean not null default false,
  links_mvp    boolean not null default false,
  ready        boolean not null default false,
  note         text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists consulting_evidence_project_idx
  on public.consulting_evidence (project_id, slot);

drop trigger if exists trg_consulting_evidence_updated on public.consulting_evidence;
create trigger trg_consulting_evidence_updated
  before update on public.consulting_evidence
  for each row execute function public.bridge_touch_updated_at();

alter table public.consulting_evidence enable row level security;
revoke all on public.consulting_evidence from anon;

drop policy if exists "Workspace members can read consulting evidence" on public.consulting_evidence;
create policy "Workspace members can read consulting evidence"
  on public.consulting_evidence for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace writers can manage consulting evidence" on public.consulting_evidence;
create policy "Workspace writers can manage consulting evidence"
  on public.consulting_evidence for all
  using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

commit;

-- ------------------------------------------------------------------
-- 확인용
-- ------------------------------------------------------------------
--   select count(*) from public.consulting_projects;        -- 0 (오류 없이 조회되면 OK)
--   select tablename, count(*) from pg_policies
--    where tablename like 'consulting_%' group by tablename; -- 표 5개 × 정책 2개
