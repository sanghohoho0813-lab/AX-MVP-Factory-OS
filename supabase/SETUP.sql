-- ============================================================
-- AX Factory OS — Supabase 설치 SQL (한 번에 실행)
--
-- 사용법
--   1. Supabase 대시보드 → 왼쪽 메뉴 "SQL Editor" → "New query"
--   2. 이 파일 내용을 전부 복사해서 붙여넣기
--   3. 오른쪽 아래 "Run" 클릭
--
-- 여러 번 실행해도 안전합니다(이미 만들어진 것은 건너뜁니다).
-- 기존 데이터는 지워지지 않습니다.
-- ============================================================


-- ============================================================
-- 20260721000001_stage12a_base.sql
-- ============================================================
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


-- ============================================================
-- 20260721000002_stage12a_rls.sql
-- ============================================================
-- =====================================================================
-- Stage 12A · Row Level Security
-- ---------------------------------------------------------------------
-- 원칙:
--   * 모든 테이블에 RLS 를 켜고, 워크스페이스 멤버십으로만 접근을 허용한다.
--   * RLS 를 클라이언트 필터로 대체하지 않는다(서버에서 강제).
--   * "모든 authenticated 사용자 전체 SELECT" 정책을 만들지 않는다.
--   * 헬퍼 함수는 SECURITY DEFINER + set search_path=public 로 만들어
--     workspace_members 조회 시 RLS 재귀를 피한다.
--   * service_role 에 의존하는 프런트엔드 기능을 만들지 않는다(모두 anon+RLS).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 멤버십 헬퍼 (SECURITY DEFINER — RLS 재귀 방지)
-- ---------------------------------------------------------------------
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create or replace function public.current_workspace_role(ws uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = public
as $$
  select m.role from public.workspace_members m
  where m.workspace_id = ws and m.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.has_workspace_role(ws uuid, roles public.workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and m.role = any(roles)
  );
$$;

-- 편집 권한(생성·수정·삭제) 여부: owner/admin/editor
create or replace function public.can_write_workspace(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_workspace_role(ws, array['owner','admin','editor']::public.workspace_role[]);
$$;

-- ---------------------------------------------------------------------
-- 신규 가입 시 프로필 자동 생성 (워크스페이스는 자동 생성하지 않음)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 워크스페이스 생성 RPC (생성자 = owner 를 원자적으로 등록)
--   멤버십 insert 정책은 기존 owner/admin 을 요구하므로, 최초 멤버 등록은
--   SECURITY DEFINER RPC 로 처리한다.
-- ---------------------------------------------------------------------
create or replace function public.create_workspace(workspace_name text, workspace_slug text default null)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  new_ws public.workspaces;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if coalesce(btrim(workspace_name), '') = '' then
    raise exception '워크스페이스 이름을 입력하세요.' using errcode = '22023';
  end if;

  insert into public.workspaces (name, slug, owner_id)
  values (btrim(workspace_name), nullif(btrim(coalesce(workspace_slug, '')), ''), uid)
  returning * into new_ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_ws.id, uid, 'owner');

  return new_ws;
end;
$$;

-- ---------------------------------------------------------------------
-- 초대 수락 RPC (토큰 원문 → 해시 비교, DB 에는 해시만 저장돼 있음)
-- ---------------------------------------------------------------------
create or replace function public.accept_workspace_invite(invite_token text)
returns public.workspace_members
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.workspace_invites;
  uid uuid := auth.uid();
  hashed text;
  member public.workspace_members;
begin
  if uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  hashed := encode(extensions.digest(coalesce(invite_token, ''), 'sha256'), 'hex');

  select * into inv from public.workspace_invites
  where token_hash = hashed
  limit 1;

  if inv.id is null then
    raise exception '유효하지 않은 초대입니다.' using errcode = 'P0002';
  end if;
  if inv.status <> 'pending' then
    raise exception '이미 처리되었거나 취소된 초대입니다.' using errcode = 'P0001';
  end if;
  if inv.expires_at < now() then
    update public.workspace_invites set status = 'expired' where id = inv.id;
    raise exception '만료된 초대입니다.' using errcode = 'P0001';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, uid, inv.role)
  on conflict (workspace_id, user_id)
    do update set role = excluded.role, updated_at = now()
  returning * into member;

  update public.workspace_invites
  set status = 'accepted', accepted_by = uid, updated_at = now()
  where id = inv.id;

  return member;
end;
$$;

-- =====================================================================
-- RLS 활성화 + 정책
-- =====================================================================

-- 헬퍼: 도메인 테이블 표준 정책(멤버 SELECT + 편집자 이상 쓰기)을 일괄 부여
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','projects','activities','questions','survey_modules','survey_templates',
    'survey_blueprints','survey_distributions','survey_responses','assessments',
    'analysis_issues','interview_questions','automation_candidates','selection_decisions',
    'selection_handoffs','mvp_designs','mvp_design_handoffs','website_designs',
    'website_design_handoffs','validation_workspaces','validation_handoffs',
    'validation_test_sessions','deliverable_packages','deliverable_package_snapshots',
    'deliverable_export_records','institutions','support_programs','funding_strategies',
    'funding_strategy_snapshots','case_studies'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    execute format($f$drop policy if exists %1$s_select on public.%1$s$f$, t);
    execute format($f$create policy %1$s_select on public.%1$s
        for select using (public.is_workspace_member(workspace_id))$f$, t);

    execute format($f$drop policy if exists %1$s_insert on public.%1$s$f$, t);
    execute format($f$create policy %1$s_insert on public.%1$s
        for insert with check (public.can_write_workspace(workspace_id))$f$, t);

    execute format($f$drop policy if exists %1$s_update on public.%1$s$f$, t);
    execute format($f$create policy %1$s_update on public.%1$s
        for update using (public.can_write_workspace(workspace_id))
        with check (public.can_write_workspace(workspace_id))$f$, t);

    execute format($f$drop policy if exists %1$s_delete on public.%1$s$f$, t);
    execute format($f$create policy %1$s_delete on public.%1$s
        for delete using (public.can_write_workspace(workspace_id))$f$, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.workspace_members me
      join public.workspace_members other
        on other.workspace_id = me.workspace_id
      where me.user_id = auth.uid() and other.user_id = profiles.id
    )
  );

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;

drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
  for select using (public.is_workspace_member(id));

drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces
  for insert with check (owner_id = auth.uid());

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces
  for update using (public.has_workspace_role(id, array['owner','admin']::public.workspace_role[]))
  with check (public.has_workspace_role(id, array['owner','admin']::public.workspace_role[]));

drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces
  for delete using (public.has_workspace_role(id, array['owner']::public.workspace_role[]));

-- ---------------------------------------------------------------------
-- workspace_members
-- ---------------------------------------------------------------------
alter table public.workspace_members enable row level security;
alter table public.workspace_members force row level security;

drop policy if exists workspace_members_select on public.workspace_members;
create policy workspace_members_select on public.workspace_members
  for select using (
    user_id = auth.uid() or public.is_workspace_member(workspace_id)
  );

drop policy if exists workspace_members_insert on public.workspace_members;
create policy workspace_members_insert on public.workspace_members
  for insert with check (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  );

drop policy if exists workspace_members_update on public.workspace_members;
create policy workspace_members_update on public.workspace_members
  for update using (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  ) with check (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  );

drop policy if exists workspace_members_delete on public.workspace_members;
create policy workspace_members_delete on public.workspace_members
  for delete using (
    user_id = auth.uid()
    or public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  );

-- ---------------------------------------------------------------------
-- workspace_invites (토큰 원문 없음. 관리자만 조회/생성/취소)
-- ---------------------------------------------------------------------
alter table public.workspace_invites enable row level security;
alter table public.workspace_invites force row level security;

drop policy if exists workspace_invites_select on public.workspace_invites;
create policy workspace_invites_select on public.workspace_invites
  for select using (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  );

drop policy if exists workspace_invites_insert on public.workspace_invites;
create policy workspace_invites_insert on public.workspace_invites
  for insert with check (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
    and invited_by = auth.uid()
  );

drop policy if exists workspace_invites_update on public.workspace_invites;
create policy workspace_invites_update on public.workspace_invites
  for update using (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  ) with check (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  );

drop policy if exists workspace_invites_delete on public.workspace_invites;
create policy workspace_invites_delete on public.workspace_invites
  for delete using (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  );

-- ---------------------------------------------------------------------
-- ui_preferences (본인 것만)
-- ---------------------------------------------------------------------
alter table public.ui_preferences enable row level security;
alter table public.ui_preferences force row level security;

drop policy if exists ui_preferences_all on public.ui_preferences;
create policy ui_preferences_all on public.ui_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ============================================================
-- 20260721000003_stage12a_public_rpc.sql
-- ============================================================
-- =====================================================================
-- Stage 12A · 공개 토큰 RPC (설문 응답 / 로컬 테스트 피드백)
-- ---------------------------------------------------------------------
-- 보안 원칙:
--   * 토큰 원문은 DB 에 저장하지 않는다. 조회는 sha256 해시 비교로만 한다.
--   * 함수는 SECURITY DEFINER 로 RLS 를 우회하되, 반드시 토큰이 가리키는
--     "그 한 행" 과 그 워크스페이스 범위 안에서만 동작한다.
--   * 호출자가 workspace_id / 내부 id 를 임의로 넘길 수 없다.
--   * 공개 토큰으로 내부 데이터·다른 워크스페이스 데이터를 열람할 수 없다.
--   * 응답에 내부 분석 데이터를 포함하지 않는다(설문 렌더링에 필요한 필드만).
-- =====================================================================

-- 토큰 → 해시 (클라이언트도 동일하게 계산해 저장 시 hash 만 넣는다)
create or replace function public.hash_access_token(token text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(extensions.digest(coalesce(token, ''), 'sha256'), 'hex');
$$;

-- ---------------------------------------------------------------------
-- 공개 설문 조회: 렌더링에 필요한 필드만 반환
-- ---------------------------------------------------------------------
create or replace function public.get_public_survey(survey_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  dist public.survey_distributions;
  p jsonb;
begin
  select * into dist
  from public.survey_distributions
  where access_token_hash = public.hash_access_token(survey_token)
  limit 1;

  if dist.id is null then
    return null;
  end if;

  p := dist.payload;

  -- 만료/취소 상태는 그대로 알려주되 내용은 제한
  if dist.status in ('revoked', 'expired') or coalesce(p ->> 'status', dist.status) in ('revoked', 'expired') then
    return jsonb_build_object(
      'distributionId', dist.id,
      'status', coalesce(p ->> 'status', dist.status),
      'available', false
    );
  end if;

  -- 첫 열람 시각 기록 (공개 함수지만 자기 행만 갱신)
  update public.survey_distributions
  set payload = jsonb_set(
        jsonb_set(payload, '{status}',
          to_jsonb(case when coalesce(payload ->> 'status', 'issued') in ('draft','issued') then 'opened' else payload ->> 'status' end)),
        '{firstOpenedAt}',
        coalesce(payload -> 'firstOpenedAt', to_jsonb(now())))
  where id = dist.id;

  -- 렌더링에 필요한 화이트리스트 필드만 반환 (내부 분석/타 도메인 미포함)
  return jsonb_build_object(
    'distributionId', dist.id,
    'available', true,
    'status', coalesce(p ->> 'status', dist.status),
    'surveyTitle', p -> 'surveyTitle',
    'respondentRole', p -> 'respondentRole',
    'blueprintSnapshot', p -> 'blueprintSnapshot',
    'introMessage', p -> 'introMessage',
    'privacyNotice', p -> 'privacyNotice',
    'consentRequired', p -> 'consentRequired',
    'recipientName', p -> 'recipientName',
    'recipientPosition', p -> 'recipientPosition',
    'expiresAt', p -> 'expiresAt'
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 공개 설문 응답 제출/저장 (distribution 당 1건, upsert)
-- ---------------------------------------------------------------------
create or replace function public.submit_public_survey_response(
  survey_token text,
  response_payload jsonb,
  is_final boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  dist public.survey_distributions;
  existing public.survey_responses;
  new_id uuid;
  merged jsonb;
begin
  select * into dist
  from public.survey_distributions
  where access_token_hash = public.hash_access_token(survey_token)
  limit 1;

  if dist.id is null then
    raise exception '설문을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  if dist.status in ('revoked', 'expired')
     or coalesce(dist.payload ->> 'status', dist.status) in ('revoked', 'expired') then
    raise exception '만료되었거나 취소된 설문입니다.' using errcode = 'P0001';
  end if;

  -- 호출자가 넘긴 payload 에서 내부 식별자를 신뢰하지 않고 서버가 강제로 채운다.
  merged := coalesce(response_payload, '{}'::jsonb)
    || jsonb_build_object(
      'distributionId', dist.id,
      'projectId', dist.project_id,
      'status', case when is_final then 'submitted' else 'in_progress' end
    );

  select * into existing from public.survey_responses
  where distribution_id = dist.id limit 1;

  if existing.id is null then
    insert into public.survey_responses (workspace_id, distribution_id, project_id, payload)
    values (dist.workspace_id, dist.id, dist.project_id, merged)
    returning id into new_id;
  else
    update public.survey_responses
    set payload = merged
    where id = existing.id
    returning id into new_id;
  end if;

  if is_final then
    update public.survey_distributions
    set payload = jsonb_set(
          jsonb_set(payload, '{status}', '"submitted"'),
          '{submittedAt}', to_jsonb(now()))
    where id = dist.id;
  end if;

  return jsonb_build_object('responseId', new_id, 'status', merged ->> 'status');
end;
$$;

-- ---------------------------------------------------------------------
-- 공개 로컬 테스트 세션 조회
-- ---------------------------------------------------------------------
create or replace function public.get_public_test_session(test_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sess public.validation_test_sessions;
  p jsonb;
begin
  select * into sess
  from public.validation_test_sessions
  where access_token_hash = public.hash_access_token(test_token)
  limit 1;

  if sess.id is null then
    return null;
  end if;

  p := sess.payload;

  if sess.status in ('revoked', 'completed', 'expired')
     or coalesce(p ->> 'status', sess.status) in ('revoked', 'expired') then
    return jsonb_build_object('sessionId', sess.id, 'status', coalesce(p ->> 'status', sess.status), 'available', false);
  end if;

  return jsonb_build_object(
    'sessionId', sess.id,
    'available', true,
    'status', coalesce(p ->> 'status', sess.status),
    'title', p -> 'title',
    'instructions', p -> 'instructions',
    'scenario', p -> 'scenario',
    'tasks', p -> 'tasks',
    'questions', p -> 'questions',
    'expiresAt', p -> 'expiresAt'
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 공개 로컬 테스트 피드백 제출
-- ---------------------------------------------------------------------
create or replace function public.submit_public_test_feedback(
  test_token text,
  feedback_payload jsonb,
  is_final boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sess public.validation_test_sessions;
  merged jsonb;
begin
  select * into sess
  from public.validation_test_sessions
  where access_token_hash = public.hash_access_token(test_token)
  limit 1;

  if sess.id is null then
    raise exception '테스트 세션을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  if sess.status in ('revoked', 'expired')
     or coalesce(sess.payload ->> 'status', sess.status) in ('revoked', 'expired') then
    raise exception '만료되었거나 취소된 테스트입니다.' using errcode = 'P0001';
  end if;

  merged := coalesce(sess.payload, '{}'::jsonb)
    || jsonb_build_object('feedback', coalesce(feedback_payload, '{}'::jsonb));
  if is_final then
    merged := jsonb_set(merged, '{status}', '"completed"');
  end if;

  update public.validation_test_sessions
  set payload = merged,
      status = case when is_final then 'completed' else status end
  where id = sess.id;

  return jsonb_build_object('sessionId', sess.id, 'status', merged ->> 'status');
end;
$$;

-- ---------------------------------------------------------------------
-- 권한: 공개 함수만 anon 에 노출. 나머지 테이블/함수는 anon 접근 불가.
-- ---------------------------------------------------------------------
revoke execute on function public.get_public_survey(text) from public;
revoke execute on function public.submit_public_survey_response(text, jsonb, boolean) from public;
revoke execute on function public.get_public_test_session(text) from public;
revoke execute on function public.submit_public_test_feedback(text, jsonb, boolean) from public;
revoke execute on function public.hash_access_token(text) from public;

grant execute on function public.get_public_survey(text) to anon, authenticated;
grant execute on function public.submit_public_survey_response(text, jsonb, boolean) to anon, authenticated;
grant execute on function public.get_public_test_session(text) to anon, authenticated;
grant execute on function public.submit_public_test_feedback(text, jsonb, boolean) to anon, authenticated;

-- 인증 사용자 전용 워크스페이스 부트스트랩 RPC
revoke execute on function public.create_workspace(text, text) from public;
revoke execute on function public.accept_workspace_invite(text) from public;
grant execute on function public.create_workspace(text, text) to authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;


-- ============================================================
-- 20260721000004_stage12a_audit.sql
-- ============================================================
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


-- ============================================================
-- 20260827000005_operations_hub.sql
-- ============================================================
-- AX 컨설팅 실운영 고객 허브: 고객별 업무, 자료 수령, 수금, 지원사업 진행을 한 레코드로 저장한다.
create table if not exists public.operations_clients (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_name text not null check (char_length(trim(company_name)) > 0),
  status text not null default 'active' check (status in ('active', 'waiting', 'paused', 'completed')),
  next_action text not null default '',
  next_action_due_date date,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operations_clients_workspace_updated_idx
  on public.operations_clients (workspace_id, updated_at desc);

alter table public.operations_clients enable row level security;

drop policy if exists "Workspace members can read operations clients" on public.operations_clients;
create policy "Workspace members can read operations clients"
  on public.operations_clients for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create operations clients" on public.operations_clients;
create policy "Workspace members can create operations clients"
  on public.operations_clients for insert to authenticated
  with check (public.can_write_workspace(workspace_id));

drop policy if exists "Workspace members can update operations clients" on public.operations_clients;
create policy "Workspace members can update operations clients"
  on public.operations_clients for update to authenticated
  using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

drop policy if exists "Workspace members can delete operations clients" on public.operations_clients;
create policy "Workspace members can delete operations clients"
  on public.operations_clients for delete to authenticated
  using (public.can_write_workspace(workspace_id));

drop trigger if exists set_operations_clients_updated_at on public.operations_clients;
create trigger set_operations_clients_updated_at
  before update on public.operations_clients
  for each row execute function public.touch_updated_at();

-- 민감한 증빙은 public URL 없이 Storage RLS로만 제공한다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-documents', 'client-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "Workspace members can list client documents" on storage.objects;
create policy "Workspace members can list client documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'client-documents' and public.is_workspace_member((storage.foldername(name))[1]::uuid));

drop policy if exists "Workspace members can upload client documents" on storage.objects;
create policy "Workspace members can upload client documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'client-documents' and public.can_write_workspace((storage.foldername(name))[1]::uuid));

drop policy if exists "Workspace members can update client documents" on storage.objects;
create policy "Workspace members can update client documents"
  on storage.objects for update to authenticated
  using (bucket_id = 'client-documents' and public.can_write_workspace((storage.foldername(name))[1]::uuid))
  with check (bucket_id = 'client-documents' and public.can_write_workspace((storage.foldername(name))[1]::uuid));

drop policy if exists "Workspace members can remove client documents" on storage.objects;
create policy "Workspace members can remove client documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'client-documents' and public.can_write_workspace((storage.foldername(name))[1]::uuid));

