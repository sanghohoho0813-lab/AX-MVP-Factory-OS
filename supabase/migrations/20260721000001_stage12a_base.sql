-- =====================================================================
-- Stage 12A · Base schema
-- ---------------------------------------------------------------------
-- 목적: Stage 1~11 의 localStorage 도메인을 워크스페이스 단위 클라우드
--       저장 구조로 옮기기 위한 기본 테이블 정의.
--
-- 원칙:
--   * 모든 객체는 재실행 가능(IF NOT EXISTS / OR REPLACE)하게 작성.
--   * 기존 Production 객체를 무조건 DROP 하지 않는다. DROP SCHEMA 금지.
--   * 하이브리드 저장: 조회·RLS·정렬에 필요한 관계 컬럼은 별도 컬럼으로 두고,
--     엔티티 전체 필드는 payload jsonb 로 보존한다(camelCase 그대로).
--   * 토큰 원문은 저장하지 않는다. 공개 접근 토큰은 access_token_hash(sha256)만 저장.
--   * 이 마이그레이션은 테이블/인덱스/트리거만 만든다. RLS 는 별도 파일에서 활성화한다.
-- =====================================================================

create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------
-- 공통 트리거 함수: updated_at 자동 갱신
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 역할(enum) — 워크스페이스 멤버 권한 등급
--   owner  : 워크스페이스 소유자(설정/삭제/멤버관리 전권)
--   admin  : 멤버·초대 관리 + 데이터 편집
--   editor : 데이터 생성·수정·삭제
--   viewer : 읽기 전용
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'workspace_role') then
    create type public.workspace_role as enum ('owner', 'admin', 'editor', 'viewer');
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'invite_status') then
    create type public.invite_status as enum ('pending', 'accepted', 'revoked', 'expired');
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'import_job_status') then
    create type public.import_job_status as enum ('pending', 'running', 'completed', 'failed', 'partial');
  end if;
end;
$$;

-- =====================================================================
-- 계정·워크스페이스 핵심 테이블
-- =====================================================================

-- 사용자 프로필 (auth.users 와 1:1)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 워크스페이스
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 워크스페이스 멤버십 (사용자 × 워크스페이스 × 역할)
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on public.workspace_members (user_id);

-- 초대 (토큰 원문 저장 금지 → token_hash 만 저장)
create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'viewer',
  token_hash text not null unique,
  status public.invite_status not null default 'pending',
  invited_by uuid references auth.users (id) on delete set null,
  accepted_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workspace_invites_ws_idx on public.workspace_invites (workspace_id);
create index if not exists workspace_invites_email_idx on public.workspace_invites (lower(email));

-- 사용자 UI 환경설정 (글자 크기 등). 서버 우선, 로컬 캐시 fallback.
-- text_scale: 1.5(기본) / 1.8(큼) / 2.1(더 큼). 기존 설정 보존.
create table if not exists public.ui_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  text_scale numeric(3, 2) not null default 1.5,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

-- 핵심 테이블 updated_at 트리거
do $$
declare t text;
begin
  foreach t in array array['profiles','workspaces','workspace_members','workspace_invites','ui_preferences']
  loop
    if not exists (
      select 1 from pg_trigger where tgname = format('touch_%s_updated_at', t)
    ) then
      execute format(
        'create trigger touch_%1$s_updated_at before update on public.%1$s
           for each row execute function public.touch_updated_at()', t);
    end if;
  end loop;
end;
$$;

-- =====================================================================
-- 도메인 테이블 (Stage 1~11)
-- ---------------------------------------------------------------------
-- 공통 컬럼 규약:
--   id           uuid PK (로컬 UUID 그대로 가져오기 위해 default 있으나 명시 삽입 허용)
--   workspace_id uuid NOT NULL  → 모든 격리·RLS 기준
--   payload      jsonb NOT NULL → 엔티티 전체(카멜케이스)
--   created_at / updated_at
-- 관계·정렬·검색·토큰에 필요한 값만 별도 컬럼으로 승격한다.
-- =====================================================================

-- 고객사
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text,
  status text not null default 'active',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code)
);
create index if not exists organizations_ws_idx on public.organizations (workspace_id);

-- 프로젝트
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  project_code text,
  status text not null default 'active',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, project_code)
);
create index if not exists projects_ws_idx on public.projects (workspace_id);
create index if not exists projects_org_idx on public.projects (organization_id);

-- 활동 로그 (append 위주)
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activities_ws_idx on public.activities (workspace_id);
create index if not exists activities_org_idx on public.activities (organization_id);
create index if not exists activities_project_idx on public.activities (project_id);

-- 질문 은행
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text,
  active boolean not null default true,
  status text not null default 'active',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code)
);
create index if not exists questions_ws_idx on public.questions (workspace_id);

-- 설문 모듈
create table if not exists public.survey_modules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  status text not null default 'active',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists survey_modules_ws_idx on public.survey_modules (workspace_id);

-- 설문 템플릿
create table if not exists public.survey_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  status text not null default 'draft',
  version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists survey_templates_ws_idx on public.survey_templates (workspace_id);

-- 프로젝트 설문 초안
create table if not exists public.survey_blueprints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  status text not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists survey_blueprints_ws_idx on public.survey_blueprints (workspace_id);
create index if not exists survey_blueprints_project_idx on public.survey_blueprints (project_id);

-- 설문 배포 (공개 링크) — 토큰 원문 저장 금지, access_token_hash 만 저장
create table if not exists public.survey_distributions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  access_token_hash text unique,
  status text not null default 'active',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists survey_distributions_ws_idx on public.survey_distributions (workspace_id);
create index if not exists survey_distributions_project_idx on public.survey_distributions (project_id);

-- 설문 응답
create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  distribution_id uuid references public.survey_distributions (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists survey_responses_ws_idx on public.survey_responses (workspace_id);
create unique index if not exists survey_responses_distribution_uidx on public.survey_responses (distribution_id);

-- 진단 분석 결과
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assessments_ws_idx on public.assessments (workspace_id);
create index if not exists assessments_project_idx on public.assessments (project_id);

-- 분석 이슈
create table if not exists public.analysis_issues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists analysis_issues_ws_idx on public.analysis_issues (workspace_id);
create index if not exists analysis_issues_project_idx on public.analysis_issues (project_id);

-- 인터뷰 질문
create table if not exists public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists interview_questions_ws_idx on public.interview_questions (workspace_id);
create index if not exists interview_questions_project_idx on public.interview_questions (project_id);

-- 자동화 후보
create table if not exists public.automation_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  assessment_id uuid references public.assessments (id) on delete set null,
  status text not null default 'active',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists automation_candidates_ws_idx on public.automation_candidates (workspace_id);
create index if not exists automation_candidates_project_idx on public.automation_candidates (project_id);

-- 선정 결정
create table if not exists public.selection_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists selection_decisions_ws_idx on public.selection_decisions (workspace_id);
create index if not exists selection_decisions_project_idx on public.selection_decisions (project_id);

-- 선정 인계 스냅샷 (결정 1:1)
create table if not exists public.selection_handoffs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  selection_decision_id uuid references public.selection_decisions (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists selection_handoffs_ws_idx on public.selection_handoffs (workspace_id);
create unique index if not exists selection_handoffs_decision_uidx on public.selection_handoffs (selection_decision_id);

-- MVP 설계
create table if not exists public.mvp_designs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mvp_designs_ws_idx on public.mvp_designs (workspace_id);
create index if not exists mvp_designs_project_idx on public.mvp_designs (project_id);

-- MVP 설계 인계 스냅샷 (설계 1:1)
create table if not exists public.mvp_design_handoffs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  mvp_design_id uuid references public.mvp_designs (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mvp_design_handoffs_ws_idx on public.mvp_design_handoffs (workspace_id);
create unique index if not exists mvp_design_handoffs_design_uidx on public.mvp_design_handoffs (mvp_design_id);

-- 홈페이지 설계
create table if not exists public.website_designs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists website_designs_ws_idx on public.website_designs (workspace_id);
create index if not exists website_designs_project_idx on public.website_designs (project_id);

-- 홈페이지 설계 인계 스냅샷 (설계 1:1)
create table if not exists public.website_design_handoffs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  website_design_id uuid references public.website_designs (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists website_design_handoffs_ws_idx on public.website_design_handoffs (workspace_id);
create unique index if not exists website_design_handoffs_design_uidx on public.website_design_handoffs (website_design_id);

-- 검증 워크스페이스
create table if not exists public.validation_workspaces (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  track_type text,
  version integer not null default 1,
  status text not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists validation_workspaces_ws_idx on public.validation_workspaces (workspace_id);
create index if not exists validation_workspaces_project_idx on public.validation_workspaces (project_id);

-- 검증 인계 스냅샷 (검증 워크스페이스 1:1)
create table if not exists public.validation_handoffs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  validation_workspace_id uuid references public.validation_workspaces (id) on delete cascade,
  track_type text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists validation_handoffs_ws_idx on public.validation_handoffs (workspace_id);
create unique index if not exists validation_handoffs_vws_uidx on public.validation_handoffs (validation_workspace_id);

-- 로컬 테스트 세션 (공개 링크) — 토큰 원문 저장 금지
create table if not exists public.validation_test_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  validation_workspace_id uuid references public.validation_workspaces (id) on delete cascade,
  access_token_hash text unique,
  status text not null default 'active',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists validation_test_sessions_ws_idx on public.validation_test_sessions (workspace_id);
create index if not exists validation_test_sessions_vws_idx on public.validation_test_sessions (validation_workspace_id);

-- 제출자료 패키지
create table if not exists public.deliverable_packages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deliverable_packages_ws_idx on public.deliverable_packages (workspace_id);
create index if not exists deliverable_packages_project_idx on public.deliverable_packages (project_id);

-- 제출자료 스냅샷 (패키지 1:1)
create table if not exists public.deliverable_package_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  package_id uuid references public.deliverable_packages (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deliverable_package_snapshots_ws_idx on public.deliverable_package_snapshots (workspace_id);
create unique index if not exists deliverable_package_snapshots_pkg_uidx on public.deliverable_package_snapshots (package_id);

-- 제출자료 내보내기 기록
create table if not exists public.deliverable_export_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  package_id uuid references public.deliverable_packages (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists deliverable_export_records_ws_idx on public.deliverable_export_records (workspace_id);
create index if not exists deliverable_export_records_pkg_idx on public.deliverable_export_records (package_id);

-- 기관
create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  status text not null default 'active',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists institutions_ws_idx on public.institutions (workspace_id);

-- 지원 프로그램
create table if not exists public.support_programs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  institution_id uuid references public.institutions (id) on delete cascade,
  status text not null default 'active',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_programs_ws_idx on public.support_programs (workspace_id);
create index if not exists support_programs_institution_idx on public.support_programs (institution_id);

-- 자금 연계 전략
create table if not exists public.funding_strategies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists funding_strategies_ws_idx on public.funding_strategies (workspace_id);
create index if not exists funding_strategies_project_idx on public.funding_strategies (project_id);

-- 자금 연계 전략 스냅샷 (전략 1:1)
create table if not exists public.funding_strategy_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  strategy_id uuid references public.funding_strategies (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists funding_strategy_snapshots_ws_idx on public.funding_strategy_snapshots (workspace_id);
create unique index if not exists funding_strategy_snapshots_strategy_uidx on public.funding_strategy_snapshots (strategy_id);

-- 사례
create table if not exists public.case_studies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  status text not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists case_studies_ws_idx on public.case_studies (workspace_id);
create index if not exists case_studies_project_idx on public.case_studies (project_id);

-- 도메인 테이블 updated_at 트리거 일괄 등록 (activities/export_records 는 append-only 라 제외)
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','projects','questions','survey_modules','survey_templates',
    'survey_blueprints','survey_distributions','survey_responses','assessments',
    'analysis_issues','interview_questions','automation_candidates','selection_decisions',
    'selection_handoffs','mvp_designs','mvp_design_handoffs','website_designs',
    'website_design_handoffs','validation_workspaces','validation_handoffs',
    'validation_test_sessions','deliverable_packages','deliverable_package_snapshots',
    'institutions','support_programs','funding_strategies','funding_strategy_snapshots',
    'case_studies'
  ]
  loop
    if not exists (
      select 1 from pg_trigger where tgname = format('touch_%s_updated_at', t)
    ) then
      execute format(
        'create trigger touch_%1$s_updated_at before update on public.%1$s
           for each row execute function public.touch_updated_at()', t);
    end if;
  end loop;
end;
$$;
