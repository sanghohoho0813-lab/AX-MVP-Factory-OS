-- ============================================================
-- AX MVP Factory OS — S1 기반 마이그레이션 (001)
-- 실행 순서: 이 파일이 첫 번째입니다. Supabase SQL Editor 에서 전체 실행하세요.
-- 재실행 안전(idempotent). 이후 마이그레이션은 002, 003… 순서로 추가됩니다.
--
-- 포함: profiles / industries / companies / projects / project_stages / stage_logs
--       + 신규 가입자 프로필 자동 생성(첫 사용자 = owner)
--       + 프로젝트 생성 시 Stage 0~7 자동 시드
--       + RLS (내부 사용자 owner/staff 만 접근)
-- 제외(향후): 설문·판정·산출물·자금 테이블 (S2~S6), org 관리 기능
-- ============================================================

-- ── 0) 공통: updated_at 자동 갱신 ─────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 1) profiles — 내부 사용자 (owner / staff 예약) ─────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'staff' check (role in ('owner', 'staff')),
  name       text,
  email      text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- 첫 번째 가입자는 자동으로 owner (이후 가입자는 staff — 2차에서 초대 흐름 예정)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, email, name)
  values (
    new.id,
    case when (select count(*) from public.profiles) = 0 then 'owner' else 'staff' end,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 2) 헬퍼: 내부 사용자 여부 (RLS 재귀 방지용 security definer) ──
create or replace function public.is_internal()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'staff')
  );
$$;

create or replace function public.is_owner()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- ── 3) industries — 업종 마스터 (parent_code 로 세부 업종 확장 구조) ──
create table if not exists public.industries (
  code        text primary key,
  name        text not null,
  parent_code text references public.industries(code),
  sort        integer not null default 0,
  active      boolean not null default true,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- 1차 업종 3종 + 전문서비스 세부 분류(구조 예약 — 질문 콘텐츠는 S2)
insert into public.industries (code, name, parent_code, sort) values
  ('manufacturing',      '제조업',            null, 10),
  ('distribution',       '유통·물류업',        null, 20),
  ('professional',       '전문서비스업',       null, 30),
  ('prof_consulting',    '경영컨설팅',         'professional', 31),
  ('prof_hr',            '노무·인사 지원',     'professional', 32),
  ('prof_tax',           '세무·회계 지원',     'professional', 33),
  ('prof_sales',         '법인영업',           'professional', 34),
  ('prof_cert_funding',  '기업인증·정책자금 지원', 'professional', 35)
on conflict (code) do nothing;

-- ── 4) companies — 고객사 ─────────────────────────────────────
create table if not exists public.companies (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid, -- 멀티테넌트 확장 예약 (현재 미사용, null)
  name           text not null,
  industry_code  text references public.industries(code),
  sub_industry   text,             -- 세부 업태 (자유 입력)
  employee_band  text,             -- 예: '1~4', '5~9', '10~29', '30~99', '100+'
  revenue_band   text,             -- 예: '5억 미만', '5~20억', '20~50억', '50억+'
  region         text,
  contact_name   text,
  contact_phone  text,
  contact_email  text,
  memo           text,
  status         text not null default 'active' check (status in ('active', 'archived')),
  metadata       jsonb not null default '{}'::jsonb,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists companies_status_idx on public.companies (status, created_at desc);

drop trigger if exists trg_companies_touch on public.companies;
create trigger trg_companies_touch before update on public.companies
  for each row execute function public.touch_updated_at();

-- ── 5) projects — AX 프로젝트 ─────────────────────────────────
-- Stage(진행 단계 0~7)와 Level(MVP 수준 0~5)은 서로 다른 축이므로 별도 컬럼.
create table if not exists public.projects (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid, -- 멀티테넌트 확장 예약
  company_id      uuid not null references public.companies(id) on delete cascade,
  name            text not null,
  industry_code   text references public.industries(code),
  current_stage   integer not null default 0 check (current_stage between 0 and 7),
  current_level   integer not null default 0 check (current_level between 0 and 5),
  target_level    integer not null default 2 check (target_level between 0 and 5),
  status          text not null default 'active'
                  check (status in ('active', 'waiting_customer', 'hold', 'dropped', 'completed')),
  contract_status text not null default 'pre'
                  check (contract_status in ('pre', 'reviewing', 'contracted', 'maintenance')),
  summary         text,            -- 한 줄 개요 (무엇을 만드는 프로젝트인가)
  metadata        jsonb not null default '{}'::jsonb,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists projects_status_idx on public.projects (status, updated_at desc);
create index if not exists projects_company_idx on public.projects (company_id);

drop trigger if exists trg_projects_touch on public.projects;
create trigger trg_projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- ── 6) project_stages — 프로젝트 × 단계(0~7) ──────────────────
-- 상태 12종: not_started(시작 전) materials_requested(자료 요청) collecting(자료 수집 중)
--   analyzing(분석 중) prototyping(시제품 제작 중) customer_review(고객 검토 중)
--   revising(수정 중) testing(테스트 중) passed(통과) hold(보류) stopped(중단) completed(완료)
create table if not exists public.project_stages (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  stage_no            integer not null check (stage_no between 0 and 7),
  title               text not null,
  purpose             text,
  status              text not null default 'not_started'
                      check (status in ('not_started','materials_requested','collecting','analyzing',
                                        'prototyping','customer_review','revising','testing',
                                        'passed','hold','stopped','completed')),
  started_at          date,
  target_end_at       date,
  completed_at        date,
  owner_name          text,             -- 내부 담당자
  customer_contact    text,             -- 고객 측 담당자
  required_materials  text,             -- 필요한 자료
  completion_criteria text,             -- 완료 조건
  checklist           jsonb not null default '[]'::jsonb, -- [{label, done}]
  risks               text,             -- 위험요소
  hold_reason         text,             -- 보류 사유
  next_action         text,             -- 다음 액션
  memo                text,             -- 내부 메모
  customer_confirmed  boolean not null default false,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (project_id, stage_no)
);

create index if not exists project_stages_project_idx on public.project_stages (project_id, stage_no);

drop trigger if exists trg_project_stages_touch on public.project_stages;
create trigger trg_project_stages_touch before update on public.project_stages
  for each row execute function public.touch_updated_at();

-- 프로젝트 생성 시 Stage 0~7 자동 시드
create or replace function public.seed_project_stages()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_stages (project_id, stage_no, title, purpose) values
    (new.id, 0, '상담 접수 및 기본 적합성',        '문의 내용을 정리하고 AX 프로젝트로 진행할 기본 요건을 확인합니다.'),
    (new.id, 1, '업종 맞춤 현장 설문·데이터 수집',  '대표자·현장 담당자 설문과 기초 자료를 수집합니다.'),
    (new.id, 2, 'AX 적합성 진단 및 과제 선정',      '설문·자료를 바탕으로 적합성을 판정하고 개선 과제를 선정합니다.'),
    (new.id, 3, '클릭형 프로토타입 / MVP-lite',     '화면 흐름 중심의 시제품으로 방향과 도입 의지를 확인합니다.'),
    (new.id, 4, '정식 계약 및 핵심 MVP 개발',       '범위를 확정해 계약하고 핵심 MVP 를 개발합니다.'),
    (new.id, 5, '현장 적용·사용자 테스트',          '실제 현장에서 사용하며 테스트와 수정을 진행합니다.'),
    (new.id, 6, '성과 측정·기관 제출자료 생성',      'KPI 를 측정하고 기관 제출용 자료를 만듭니다.'),
    (new.id, 7, '운영 고도화·유지관리·업셀링',       '운영을 안정화하고 다음 단계 확장을 검토합니다.')
  on conflict (project_id, stage_no) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_projects_seed_stages on public.projects;
create trigger trg_projects_seed_stages
  after insert on public.projects
  for each row execute function public.seed_project_stages();

-- ── 7) stage_logs — 단계 이력·커뮤니케이션 기록 ────────────────
create table if not exists public.stage_logs (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  stage_no   integer not null check (stage_no between 0 and 7),
  type       text not null default 'note'
             check (type in ('note', 'status_change', 'stage_advance', 'customer', 'risk')),
  content    text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists stage_logs_project_idx on public.stage_logs (project_id, created_at desc);

-- ── 8) RLS — 내부 사용자(owner/staff)만 접근 ──────────────────
alter table public.profiles       enable row level security;
alter table public.industries     enable row level security;
alter table public.companies      enable row level security;
alter table public.projects       enable row level security;
alter table public.project_stages enable row level security;
alter table public.stage_logs     enable row level security;

-- profiles: 본인 조회·수정 + 내부 사용자 전체 조회. 역할(role) 변경은 owner 만.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_internal());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_owner())
  with check (id = auth.uid() or public.is_owner());

-- industries: 내부 조회, 편집은 owner
drop policy if exists industries_select on public.industries;
create policy industries_select on public.industries
  for select to authenticated using (public.is_internal());

drop policy if exists industries_write on public.industries;
create policy industries_write on public.industries
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- companies / projects / project_stages / stage_logs: 내부 사용자 전체 권한
drop policy if exists companies_internal on public.companies;
create policy companies_internal on public.companies
  for all to authenticated using (public.is_internal()) with check (public.is_internal());

drop policy if exists projects_internal on public.projects;
create policy projects_internal on public.projects
  for all to authenticated using (public.is_internal()) with check (public.is_internal());

drop policy if exists project_stages_internal on public.project_stages;
create policy project_stages_internal on public.project_stages
  for all to authenticated using (public.is_internal()) with check (public.is_internal());

drop policy if exists stage_logs_internal on public.stage_logs;
create policy stage_logs_internal on public.stage_logs
  for all to authenticated using (public.is_internal()) with check (public.is_internal());

-- anon(비로그인) 접근 정책 없음 = 전면 차단.
-- (향후 respondent 설문 응답은 S2에서 서버 API + 토큰 검증으로만 허용 예정)
