-- 20260904000010_custom_services.sql
--
-- 컨설팅 항목(업무)을 대표가 직접 추가할 수 있게 한다.
--
-- 기본 6종(법인설립·업종추가·특허·벤처인증·AX·정책자금)은 코드에 있다. 업체마다
-- 하는 일이 조금씩 달라 그 목록만으로는 부족해서, 워크스페이스 단위로 항목을 더
-- 만들 수 있게 표를 하나 추가한다.
--
-- 워크스페이스 단위인 이유: 업체별로 항목이 다르면 현황표의 열이 업체마다 달라져
-- 한눈에 비교할 수 없다. 특정 업체에 해당하지 않는 항목은 그 업체에서 상태를
-- '보류' 로 두면 경고·챙길 목록에서 빠진다.
--
-- 원칙: additive only — 기존 표·열·정책을 건드리지 않는다. 멱등.

begin;

create table if not exists public.ops_custom_services (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- 앱이 만드는 'custom_...' 키. 업체 데이터가 이 키로 상태를 들고 있으므로 바꾸지 않는다.
  key          text not null check (key ~ '^custom_[a-z0-9]+$'),
  label        text not null check (char_length(trim(label)) > 0),
  short_label  text not null default '',
  description  text not null default '',
  accent       text not null default 'neutral'
               check (accent in ('neutral', 'plan', 'doc', 'money', 'client', 'fund')),
  sort_order   integer not null default 100,
  -- 지우지 않고 내린다. 이미 이 항목으로 기록을 남긴 업체의 이력을 지우지 않기 위함이다.
  archived     boolean not null default false,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, key)
);

create index if not exists ops_custom_services_ws_idx
  on public.ops_custom_services (workspace_id, archived, sort_order);

-- 같은 워크스페이스 안에서 살아 있는 항목 이름은 겹치지 않게 한다
create unique index if not exists ops_custom_services_label_idx
  on public.ops_custom_services (workspace_id, label)
  where not archived;

drop trigger if exists trg_ops_custom_services_updated on public.ops_custom_services;
create trigger trg_ops_custom_services_updated
  before update on public.ops_custom_services
  for each row execute function public.bridge_touch_updated_at();

alter table public.ops_custom_services enable row level security;
revoke all on public.ops_custom_services from anon;

drop policy if exists "Workspace members can read custom services" on public.ops_custom_services;
create policy "Workspace members can read custom services"
  on public.ops_custom_services for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace writers can manage custom services" on public.ops_custom_services;
create policy "Workspace writers can manage custom services"
  on public.ops_custom_services for all
  using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

commit;

-- ------------------------------------------------------------------
-- 확인용
-- ------------------------------------------------------------------
--   select count(*) from public.ops_custom_services;                    -- 0 (오류 없이 조회되면 OK)
--   select policyname from pg_policies
--    where tablename = 'ops_custom_services';                           -- 2개
