-- =====================================================================
-- Customer ↔ Internal Bridge  (MIRAE AI LAB OS × Customer Platform)
-- ---------------------------------------------------------------------
-- 같은 Supabase project 안에서 고객 플랫폼(miraeailab.com) 계정과 내부 운영 고객
-- (operations_clients)을 "명시적으로" 잇고, 고객 행동은 customer_events 로,
-- 내부 처리 결과는 portal_updates 로만 왕복하게 하는 계약이다.
--
-- 원칙
--   * additive only — DROP TABLE/COLUMN, TRUNCATE, rename, PK 변경, RLS 해제 없음
--   * idempotent    — 모든 객체는 if not exists / create or replace / drop policy if exists
--   * 고객은 기본 테이블을 직접 읽지 않는다 — portal_* SECURITY DEFINER 함수(명시 컬럼)만
--   * 내부는 workspace_id RLS (is_workspace_member / can_write_workspace)
--   * 고객 플랫폼 테이블(business_diagnosis_leads, service_orders, consult_leads)이
--     없는 환경에서도 실패하지 않도록 트리거는 존재 확인 후에만 건다
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. 공통 — updated_at 갱신 (내부 touch_updated_at / 공개 set_updated_at 에 의존하지 않는다)
-- ---------------------------------------------------------------------
create or replace function public.bridge_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. customer_intake_routing — 연결 전 고객 이벤트를 받을 워크스페이스
-- ---------------------------------------------------------------------
create table if not exists public.customer_intake_routing (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  is_default   boolean not null default true,
  created_at   timestamptz not null default now()
);
comment on table public.customer_intake_routing is
  '고객 플랫폼에서 들어온 이벤트가 아직 어느 고객사와도 연결되지 않았을 때 받아 둘 워크스페이스. 없으면 가장 오래된 워크스페이스.';

alter table public.customer_intake_routing enable row level security;

drop policy if exists "Workspace members can read intake routing" on public.customer_intake_routing;
create policy "Workspace members can read intake routing"
  on public.customer_intake_routing for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace writers can manage intake routing" on public.customer_intake_routing;
create policy "Workspace writers can manage intake routing"
  on public.customer_intake_routing for all to authenticated
  using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

create or replace function public.default_intake_workspace()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select workspace_id from public.customer_intake_routing where is_default order by created_at limit 1),
    (select id from public.workspaces order by created_at asc limit 1)
  );
$$;
revoke all on function public.default_intake_workspace() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. portal_client_links — 고객 계정(profiles) ↔ 운영 고객(operations_clients)
-- ---------------------------------------------------------------------
create table if not exists public.portal_client_links (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  operations_client_id text not null references public.operations_clients (id) on delete cascade,
  profile_id           uuid not null references public.profiles (id) on delete cascade,
  organization_id      uuid references public.organizations (id) on delete set null,
  primary_project_id   uuid references public.projects (id) on delete set null,
  status               text not null default 'active'
                       check (status in ('active', 'paused', 'revoked')),
  -- 고객에게 보이는 단계 (내부 8단계를 그대로 내보내지 않는다)
  customer_stage       text not null default 'preparing'
                       check (customer_stage in ('preparing', 'reviewing_docs', 'in_progress', 'submitted', 'awaiting_result', 'completed')),
  -- 고객에게 보이는 프로젝트명 (비우면 회사명)
  display_name         text,
  -- 고객에게 보이는 담당자 표시명
  consultant_name      text,
  linked_by            uuid references auth.users (id) on delete set null,
  linked_at            timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (operations_client_id, profile_id)
);
comment on table public.portal_client_links is
  '내부 운영 고객과 고객 플랫폼 계정의 명시적 연결. 이메일·전화가 같다는 이유로 자동 연결하지 않는다 — 사람이 확인해 만든다.';
create index if not exists portal_client_links_profile_idx on public.portal_client_links (profile_id, status);
create index if not exists portal_client_links_workspace_idx on public.portal_client_links (workspace_id, updated_at desc);

drop trigger if exists trg_portal_client_links_updated on public.portal_client_links;
create trigger trg_portal_client_links_updated
  before update on public.portal_client_links
  for each row execute function public.bridge_touch_updated_at();

alter table public.portal_client_links enable row level security;
revoke all on public.portal_client_links from anon;

drop policy if exists "Workspace members can read portal links" on public.portal_client_links;
create policy "Workspace members can read portal links"
  on public.portal_client_links for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace writers can create portal links" on public.portal_client_links;
create policy "Workspace writers can create portal links"
  on public.portal_client_links for insert to authenticated
  with check (public.can_write_workspace(workspace_id));

drop policy if exists "Workspace writers can update portal links" on public.portal_client_links;
create policy "Workspace writers can update portal links"
  on public.portal_client_links for update to authenticated
  using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

drop policy if exists "Workspace writers can delete portal links" on public.portal_client_links;
create policy "Workspace writers can delete portal links"
  on public.portal_client_links for delete to authenticated
  using (public.can_write_workspace(workspace_id));

-- 고객용 정책은 일부러 두지 않는다. 고객은 portal_* 함수로만 자기 행을 본다.

-- ---------------------------------------------------------------------
-- 3. customer_events — 고객 행동이 내부 업무로 들어오는 받은편지함
-- ---------------------------------------------------------------------
create table if not exists public.customer_events (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  portal_client_link_id uuid references public.portal_client_links (id) on delete set null,
  -- 계정 연결 없이도 "어느 고객사 건인지"만 먼저 정할 수 있게 한다
  operations_client_id  text references public.operations_clients (id) on delete set null,
  profile_id            uuid references public.profiles (id) on delete set null,
  event_type            text not null
                        check (event_type in (
                          'diagnosis_completed', 'consultation_requested', 'service_order_created',
                          'document_uploaded', 'customer_request_created', 'customer_action_completed',
                          'customer_reply', 'profile_updated')),
  source_type           text not null,
  source_id             text not null,
  dedupe_key            text not null unique,
  payload_version       integer not null default 1,
  -- 고객이 직접 제출한 값만 담는다(내부 판단·메모 금지). 내부 화면 표시용.
  customer_safe_payload jsonb not null default '{}'::jsonb,
  priority              text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status                text not null default 'new'
                        check (status in ('new', 'linked', 'in_progress', 'resolved', 'ignored')),
  occurred_at           timestamptz not null default now(),
  received_at           timestamptz not null default now(),
  handled_at            timestamptz,
  handled_by            uuid references auth.users (id) on delete set null,
  handling_note         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
comment on table public.customer_events is
  '고객 플랫폼에서 일어난 일(진단 완료·주문·서류 업로드·요청)을 내부가 처리할 수 있게 받아 두는 곳. dedupe_key 로 중복 생성을 막는다.';
create index if not exists customer_events_workspace_status_idx on public.customer_events (workspace_id, status, occurred_at desc);
create index if not exists customer_events_link_idx on public.customer_events (portal_client_link_id, occurred_at desc);

drop trigger if exists trg_customer_events_updated on public.customer_events;
create trigger trg_customer_events_updated
  before update on public.customer_events
  for each row execute function public.bridge_touch_updated_at();

alter table public.customer_events enable row level security;
revoke all on public.customer_events from anon;

drop policy if exists "Workspace members can read customer events" on public.customer_events;
create policy "Workspace members can read customer events"
  on public.customer_events for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace writers can update customer events" on public.customer_events;
create policy "Workspace writers can update customer events"
  on public.customer_events for update to authenticated
  using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

-- insert 는 트리거(security definer)만 한다. 사람이 직접 만들 필요가 있으면 내부 쓰기 권한으로 허용.
drop policy if exists "Workspace writers can insert customer events" on public.customer_events;
create policy "Workspace writers can insert customer events"
  on public.customer_events for insert to authenticated
  with check (public.can_write_workspace(workspace_id));

-- ---------------------------------------------------------------------
-- 4. portal_updates — 내부가 고객에게 "명시적으로 공개"한 상태
-- ---------------------------------------------------------------------
create table if not exists public.portal_updates (
  id                       uuid primary key default gen_random_uuid(),
  workspace_id             uuid not null references public.workspaces (id) on delete cascade,
  portal_client_link_id    uuid not null references public.portal_client_links (id) on delete cascade,
  project_id               uuid references public.projects (id) on delete set null,
  category                 text not null default 'progress'
                           check (category in ('progress', 'document_request', 'result', 'notice', 'question')),
  title                    text not null check (char_length(trim(title)) > 0),
  body                     text not null default '',
  status                   text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  customer_action_required boolean not null default false,
  customer_action_label    text,
  due_date                 date,
  customer_completed_at    timestamptz,
  published_at             timestamptz,
  published_by             uuid references auth.users (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
comment on table public.portal_updates is
  '고객에게 보이는 진행 업데이트. 내부 메모를 자동 복사하지 않는다 — "고객에게 공개" 동작으로만 published 가 된다.';
create index if not exists portal_updates_link_idx on public.portal_updates (portal_client_link_id, status, published_at desc);

drop trigger if exists trg_portal_updates_updated on public.portal_updates;
create trigger trg_portal_updates_updated
  before update on public.portal_updates
  for each row execute function public.bridge_touch_updated_at();

alter table public.portal_updates enable row level security;
revoke all on public.portal_updates from anon;

drop policy if exists "Workspace members can read portal updates" on public.portal_updates;
create policy "Workspace members can read portal updates"
  on public.portal_updates for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace writers can manage portal updates" on public.portal_updates;
create policy "Workspace writers can manage portal updates"
  on public.portal_updates for all to authenticated
  using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

-- ---------------------------------------------------------------------
-- 5. portal_requests — 고객이 내부로 보내는 구조화 요청
-- ---------------------------------------------------------------------
create table if not exists public.portal_requests (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  portal_client_link_id uuid not null references public.portal_client_links (id) on delete cascade,
  project_id            uuid references public.projects (id) on delete set null,
  request_type          text not null default 'other'
                        check (request_type in ('document', 'schedule', 'status', 'consultation', 'info_change', 'other')),
  title                 text not null check (char_length(trim(title)) > 0),
  body                  text not null default '',
  status                text not null default 'open' check (status in ('open', 'answered', 'resolved', 'closed')),
  -- 고객에게 보이는 답변 (내부 메모가 아니다)
  answer                text,
  created_by            uuid references public.profiles (id) on delete set null,
  answered_at           timestamptz,
  resolved_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists portal_requests_link_idx on public.portal_requests (portal_client_link_id, status, created_at desc);

drop trigger if exists trg_portal_requests_updated on public.portal_requests;
create trigger trg_portal_requests_updated
  before update on public.portal_requests
  for each row execute function public.bridge_touch_updated_at();

alter table public.portal_requests enable row level security;
revoke all on public.portal_requests from anon;

drop policy if exists "Workspace members can read portal requests" on public.portal_requests;
create policy "Workspace members can read portal requests"
  on public.portal_requests for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace writers can manage portal requests" on public.portal_requests;
create policy "Workspace writers can manage portal requests"
  on public.portal_requests for all to authenticated
  using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

-- ---------------------------------------------------------------------
-- 6. portal_documents — 고객과 내부가 공유하기로 명시한 문서 메타데이터
-- ---------------------------------------------------------------------
create table if not exists public.portal_documents (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  portal_client_link_id uuid not null references public.portal_client_links (id) on delete cascade,
  project_id            uuid references public.projects (id) on delete set null,
  operations_client_id  text not null references public.operations_clients (id) on delete cascade,
  -- 내부 서류함 키(businessRegistration 등) 또는 자유 문자열
  document_type         text not null,
  title                 text not null check (char_length(trim(title)) > 0),
  storage_path          text,
  file_name             text,
  file_size             bigint,
  mime_type             text,
  source                text not null default 'internal' check (source in ('customer', 'internal')),
  visibility            text not null default 'internal_only'
                        check (visibility in ('internal_only', 'customer_uploaded', 'shared_with_customer')),
  status                text not null default 'requested'
                        check (status in ('requested', 'uploaded', 'verified', 'rejected')),
  -- 고객에게 보이는 안내 (예: "최근 3개월 이내 발급분")
  customer_note         text,
  -- 내부 메모 — 고객에게 보이지 않는다
  internal_note         text,
  requested_at          timestamptz,
  uploaded_at           timestamptz,
  verified_at           timestamptz,
  verified_by           uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
comment on column public.portal_documents.visibility is
  'internal_only(기본) | customer_uploaded(고객이 올림) | shared_with_customer(내부가 고객에게 공유). 실제 파일 권한은 storage 정책이 이 값을 참조한다.';
create index if not exists portal_documents_link_idx on public.portal_documents (portal_client_link_id, status, created_at desc);
create index if not exists portal_documents_path_idx on public.portal_documents (storage_path);

drop trigger if exists trg_portal_documents_updated on public.portal_documents;
create trigger trg_portal_documents_updated
  before update on public.portal_documents
  for each row execute function public.bridge_touch_updated_at();

alter table public.portal_documents enable row level security;
revoke all on public.portal_documents from anon;

drop policy if exists "Workspace members can read portal documents" on public.portal_documents;
create policy "Workspace members can read portal documents"
  on public.portal_documents for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace writers can manage portal documents" on public.portal_documents;
create policy "Workspace writers can manage portal documents"
  on public.portal_documents for all to authenticated
  using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

-- ---------------------------------------------------------------------
-- 7. ops_journal_entries — 대표 개인 업무일기 (고객에게 절대 노출되지 않는다)
-- ---------------------------------------------------------------------
create table if not exists public.ops_journal_entries (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id     uuid not null references auth.users (id) on delete cascade,
  entry_date   date not null default current_date,
  entry_type   text not null default 'note'
               check (entry_type in ('note', 'call', 'decision', 'follow_up', 'blocker', 'win', 'idea')),
  content      text not null check (char_length(trim(content)) > 0),
  client_id    text references public.operations_clients (id) on delete set null,
  project_id   uuid references public.projects (id) on delete set null,
  service_key  text,
  due_date     date,
  pinned       boolean not null default false,
  completed    boolean not null default false,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.ops_journal_entries is
  '통화·결정·후속조치·막힘·성과·아이디어를 시간축으로 남기는 개인 업무기억. owner 본인만 읽고 쓴다.';
create index if not exists ops_journal_entries_owner_date_idx on public.ops_journal_entries (owner_id, entry_date desc, created_at desc);
create index if not exists ops_journal_entries_client_idx on public.ops_journal_entries (client_id, entry_date desc);

drop trigger if exists trg_ops_journal_entries_updated on public.ops_journal_entries;
create trigger trg_ops_journal_entries_updated
  before update on public.ops_journal_entries
  for each row execute function public.bridge_touch_updated_at();

alter table public.ops_journal_entries enable row level security;
revoke all on public.ops_journal_entries from anon;

-- 워크스페이스 멤버이면서 본인 것만. (향후 Team Journal 은 별도 정책으로 확장)
drop policy if exists "Owners can read their journal" on public.ops_journal_entries;
create policy "Owners can read their journal"
  on public.ops_journal_entries for select to authenticated
  using (owner_id = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists "Owners can write their journal" on public.ops_journal_entries;
create policy "Owners can write their journal"
  on public.ops_journal_entries for all to authenticated
  using (owner_id = auth.uid() and public.can_write_workspace(workspace_id))
  with check (owner_id = auth.uid() and public.can_write_workspace(workspace_id));

-- ---------------------------------------------------------------------
-- 8. 이벤트 생성 도우미 — 중복 없이 한 건만 만든다
-- ---------------------------------------------------------------------
create or replace function public.bridge_emit_customer_event(
  p_event_type text,
  p_source_type text,
  p_source_id text,
  p_payload jsonb,
  p_priority text default 'medium',
  p_profile_id uuid default null,
  p_link_id uuid default null,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws   uuid;
  v_link uuid := p_link_id;
  v_id   uuid;
begin
  -- 연결이 없고 프로필만 알면 그 프로필의 활성 연결 하나를 찾아 본다(고객사가 하나뿐일 때만 확정)
  if v_link is null and p_profile_id is not null then
    select l.id into v_link
    from public.portal_client_links l
    where l.profile_id = p_profile_id and l.status = 'active'
    order by l.updated_at desc
    limit 1;
    if (select count(*) from public.portal_client_links l where l.profile_id = p_profile_id and l.status = 'active') > 1 then
      v_link := null; -- 여러 고객사에 연결된 계정은 사람이 고른다
    end if;
  end if;

  if v_link is not null then
    select workspace_id into v_ws from public.portal_client_links where id = v_link;
  end if;
  if v_ws is null then
    v_ws := public.default_intake_workspace();
  end if;
  if v_ws is null then
    return null; -- 받을 워크스페이스가 없으면 조용히 건너뛴다(설정 전 환경)
  end if;

  insert into public.customer_events (
    workspace_id, portal_client_link_id, profile_id, event_type, source_type, source_id,
    dedupe_key, customer_safe_payload, priority, status, occurred_at
  ) values (
    v_ws, v_link, p_profile_id, p_event_type, p_source_type, p_source_id,
    p_source_type || ':' || p_source_id || ':' || p_event_type,
    coalesce(p_payload, '{}'::jsonb),
    case when p_priority in ('high', 'medium', 'low') then p_priority else 'medium' end,
    case when v_link is null then 'new' else 'linked' end,
    coalesce(p_occurred_at, now())
  )
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.bridge_emit_customer_event(text, text, text, jsonb, text, uuid, uuid, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. 고객 플랫폼 테이블에 거는 트리거 — 테이블이 있을 때만
-- ---------------------------------------------------------------------

-- 9a. 사업 진단 완료 (business_diagnosis_leads insert)
create or replace function public.bridge_on_diagnosis_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid;
begin
  if new.email is not null and new.email <> '' then
    select id into v_profile from public.profiles where lower(email) = lower(new.email) limit 1;
  end if;
  perform public.bridge_emit_customer_event(
    'diagnosis_completed',
    'business_diagnosis_lead',
    new.id::text,
    jsonb_build_object(
      'company_name', new.company_name,
      'representative_name', new.representative_name,
      'phone', new.phone,
      'email', new.email,
      'business_type', new.business_type,
      'industry', new.industry,
      'contact_method', new.contact_method,
      'preferred_contact_time', new.preferred_contact_time,
      'lead_grade', new.lead_grade
    ),
    case when new.lead_grade = 'A' then 'high' else 'medium' end,
    v_profile,
    null,
    new.created_at
  );
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.business_diagnosis_leads') is not null then
    execute 'drop trigger if exists trg_bridge_diagnosis_lead on public.business_diagnosis_leads';
    execute 'create trigger trg_bridge_diagnosis_lead after insert on public.business_diagnosis_leads
             for each row execute function public.bridge_on_diagnosis_lead()';
  end if;
end $$;

-- 9b. 서비스 주문 생성 (service_orders insert)
create or replace function public.bridge_on_service_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid;
begin
  -- 결제한 계정을 우선, 없으면 구매자 이메일로
  select pp.user_id into v_profile from public.product_payments pp where pp.id = new.payment_id;
  if v_profile is null and new.buyer_email is not null and new.buyer_email <> '' then
    select id into v_profile from public.profiles where lower(email) = lower(new.buyer_email) limit 1;
  end if;
  perform public.bridge_emit_customer_event(
    'service_order_created',
    'service_order',
    new.id::text,
    jsonb_build_object(
      'order_number', new.order_number,
      'product_slug', new.product_slug,
      'option_id', new.option_id,
      'company_name', new.company_name,
      'buyer_name', new.buyer_name,
      'buyer_phone', new.buyer_phone,
      'buyer_email', new.buyer_email,
      'status', new.status,
      'intake', new.intake
    ),
    'high',
    v_profile,
    null,
    new.created_at
  );
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.service_orders') is not null and to_regclass('public.product_payments') is not null then
    execute 'drop trigger if exists trg_bridge_service_order on public.service_orders';
    execute 'create trigger trg_bridge_service_order after insert on public.service_orders
             for each row execute function public.bridge_on_service_order()';
  end if;
end $$;

-- 9c. 상담 신청 (consult_leads insert)
create or replace function public.bridge_on_consult_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bridge_emit_customer_event(
    'consultation_requested',
    'consult_lead',
    new.id::text,
    jsonb_build_object(
      'name', new.name,
      'contact', new.contact,
      'company', new.company,
      'program', new.program,
      'message', new.message,
      'source', new.source
    ),
    'high',
    null,
    null,
    new.created_at
  );
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.consult_leads') is not null then
    execute 'drop trigger if exists trg_bridge_consult_lead on public.consult_leads';
    execute 'create trigger trg_bridge_consult_lead after insert on public.consult_leads
             for each row execute function public.bridge_on_consult_lead()';
  end if;
end $$;

-- 9d. 고객 요청 (portal_requests insert) — 항상 존재
create or replace function public.bridge_on_portal_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bridge_emit_customer_event(
    'customer_request_created',
    'portal_request',
    new.id::text,
    jsonb_build_object('request_type', new.request_type, 'title', new.title, 'body', new.body),
    case when new.request_type in ('consultation', 'schedule') then 'high' else 'medium' end,
    new.created_by,
    new.portal_client_link_id,
    new.created_at
  );
  return new;
end;
$$;
drop trigger if exists trg_bridge_portal_request on public.portal_requests;
create trigger trg_bridge_portal_request after insert on public.portal_requests
  for each row execute function public.bridge_on_portal_request();

-- 9e. 고객 서류 업로드 (portal_documents: 고객이 올려 status 가 uploaded 가 되는 순간)
create or replace function public.bridge_on_portal_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid;
begin
  if new.source = 'customer' and new.status = 'uploaded'
     and (tg_op = 'INSERT' or old.status is distinct from 'uploaded') then
    select profile_id into v_profile from public.portal_client_links where id = new.portal_client_link_id;
    perform public.bridge_emit_customer_event(
      'document_uploaded',
      'portal_document',
      new.id::text || ':' || coalesce(new.uploaded_at::text, now()::text),
      jsonb_build_object('document_type', new.document_type, 'title', new.title, 'file_name', new.file_name),
      'high',
      v_profile,
      new.portal_client_link_id,
      coalesce(new.uploaded_at, now())
    );
  end if;
  return new;
end;
$$;
drop trigger if exists trg_bridge_portal_document on public.portal_documents;
create trigger trg_bridge_portal_document after insert or update on public.portal_documents
  for each row execute function public.bridge_on_portal_document();

-- 9f. 고객이 요청 조치를 완료 (portal_updates.customer_completed_at 설정)
create or replace function public.bridge_on_portal_update_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid;
begin
  if new.customer_completed_at is not null and old.customer_completed_at is null then
    select profile_id into v_profile from public.portal_client_links where id = new.portal_client_link_id;
    perform public.bridge_emit_customer_event(
      'customer_action_completed',
      'portal_update',
      new.id::text,
      jsonb_build_object('title', new.title, 'category', new.category, 'action_label', new.customer_action_label),
      'medium',
      v_profile,
      new.portal_client_link_id,
      new.customer_completed_at
    );
  end if;
  return new;
end;
$$;
drop trigger if exists trg_bridge_portal_update_completed on public.portal_updates;
create trigger trg_bridge_portal_update_completed after update on public.portal_updates
  for each row execute function public.bridge_on_portal_update_completed();

-- ---------------------------------------------------------------------
-- 10. 고객용 투영 — 명시 컬럼만. 내부 ID·메모·수임료는 절대 포함하지 않는다.
-- ---------------------------------------------------------------------

-- 이 연결이 지금 로그인한 고객의 것인지
create or replace function public.portal_link_owned(p_link_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.portal_client_links l
    where l.id = p_link_id and l.profile_id = auth.uid() and l.status = 'active'
  );
$$;
revoke all on function public.portal_link_owned(uuid) from public, anon;
grant execute on function public.portal_link_owned(uuid) to authenticated;

-- 고객 화면 한 장에 필요한 모든 것. 내부 미리보기도 같은 함수를 쓰므로 두 화면이 어긋나지 않는다.
create or replace function public.portal_project_projection(p_link_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'project', (
      select jsonb_build_object(
        'link_id', l.id,
        'name', coalesce(nullif(trim(l.display_name), ''), oc.company_name),
        'company_name', oc.company_name,
        'stage', l.customer_stage,
        'status', l.status,
        'consultant_name', l.consultant_name,
        'updated_at', greatest(
          l.updated_at,
          coalesce((select max(u.published_at) from public.portal_updates u where u.portal_client_link_id = l.id and u.status = 'published'), l.updated_at)
        )
      )
      from public.portal_client_links l
      join public.operations_clients oc on oc.id = l.operations_client_id
      where l.id = p_link_id
    ),
    'updates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id, 'category', u.category, 'title', u.title, 'body', u.body,
        'action_required', u.customer_action_required, 'action_label', u.customer_action_label,
        'due_date', u.due_date, 'completed_at', u.customer_completed_at, 'published_at', u.published_at
      ) order by u.published_at desc)
      from public.portal_updates u
      where u.portal_client_link_id = p_link_id and u.status = 'published'
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'document_type', d.document_type, 'title', d.title, 'status', d.status,
        'visibility', d.visibility, 'file_name', d.file_name, 'storage_path',
          case when d.visibility in ('customer_uploaded', 'shared_with_customer') then d.storage_path else null end,
        'customer_note', d.customer_note, 'requested_at', d.requested_at, 'uploaded_at', d.uploaded_at, 'verified_at', d.verified_at
      ) order by (d.status = 'requested') desc, coalesce(d.uploaded_at, d.requested_at, d.created_at) desc)
      from public.portal_documents d
      where d.portal_client_link_id = p_link_id
        and (d.status = 'requested' or d.visibility in ('customer_uploaded', 'shared_with_customer'))
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'request_type', r.request_type, 'title', r.title, 'body', r.body,
        'status', r.status, 'answer', r.answer, 'created_at', r.created_at, 'answered_at', r.answered_at
      ) order by r.created_at desc)
      from public.portal_requests r
      where r.portal_client_link_id = p_link_id
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.portal_project_projection(uuid) from public, anon, authenticated;

-- 고객: 내 프로젝트 목록
create or replace function public.portal_my_projects()
returns table (
  link_id uuid,
  name text,
  company_name text,
  stage text,
  consultant_name text,
  updated_at timestamptz,
  pending_actions integer,
  requested_documents integer,
  open_requests integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    coalesce(nullif(trim(l.display_name), ''), oc.company_name),
    oc.company_name,
    l.customer_stage,
    l.consultant_name,
    l.updated_at,
    (select count(*)::int from public.portal_updates u
       where u.portal_client_link_id = l.id and u.status = 'published'
         and u.customer_action_required and u.customer_completed_at is null),
    (select count(*)::int from public.portal_documents d
       where d.portal_client_link_id = l.id and d.status = 'requested'),
    (select count(*)::int from public.portal_requests r
       where r.portal_client_link_id = l.id and r.status in ('open', 'answered'))
  from public.portal_client_links l
  join public.operations_clients oc on oc.id = l.operations_client_id
  where l.profile_id = auth.uid() and l.status = 'active'
  order by l.updated_at desc;
$$;
revoke all on function public.portal_my_projects() from public, anon;
grant execute on function public.portal_my_projects() to authenticated;

-- 고객: 프로젝트 상세
create or replace function public.portal_project(p_link_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.portal_link_owned(p_link_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  return public.portal_project_projection(p_link_id);
end;
$$;
revoke all on function public.portal_project(uuid) from public, anon;
grant execute on function public.portal_project(uuid) to authenticated;

-- 내부: 고객이 보는 것과 똑같은 미리보기 (워크스페이스 멤버만). 고객 인증을 우회하지 않는다.
create or replace function public.portal_preview_project(p_link_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.portal_client_links where id = p_link_id;
  if v_ws is null or not public.is_workspace_member(v_ws) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  return public.portal_project_projection(p_link_id);
end;
$$;
revoke all on function public.portal_preview_project(uuid) from public, anon;
grant execute on function public.portal_preview_project(uuid) to authenticated;

-- 고객: 요청 만들기
create or replace function public.portal_create_request(
  p_link_id uuid,
  p_request_type text,
  p_title text,
  p_body text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
  v_id uuid;
begin
  if not public.portal_link_owned(p_link_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  select workspace_id into v_ws from public.portal_client_links where id = p_link_id;
  insert into public.portal_requests (workspace_id, portal_client_link_id, request_type, title, body, created_by)
  values (
    v_ws, p_link_id,
    case when p_request_type in ('document', 'schedule', 'status', 'consultation', 'info_change', 'other') then p_request_type else 'other' end,
    left(trim(p_title), 200), left(coalesce(p_body, ''), 4000), auth.uid()
  )
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.portal_create_request(uuid, text, text, text) from public, anon;
grant execute on function public.portal_create_request(uuid, text, text, text) to authenticated;

-- 고객: 업로드 경로 발급 — 경로 규칙({workspaceId}/portal/{linkId}/…)을 고객 앱이 알 필요 없게 서버가 만들어 준다
create or replace function public.portal_upload_path(p_link_id uuid, p_file_name text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ws   uuid;
  v_safe text;
begin
  if not public.portal_link_owned(p_link_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  select workspace_id into v_ws from public.portal_client_links where id = p_link_id;
  -- 파일명은 확장자만 남기고 무해한 문자로 정리한다
  v_safe := regexp_replace(coalesce(p_file_name, 'file'), '[^A-Za-z0-9._-]', '_', 'g');
  v_safe := left(v_safe, 120);
  return v_ws::text || '/portal/' || p_link_id::text || '/' || gen_random_uuid()::text || '-' || v_safe;
end;
$$;
revoke all on function public.portal_upload_path(uuid, text) from public, anon;
grant execute on function public.portal_upload_path(uuid, text) to authenticated;

-- 고객: 서류 등록 (요청받은 항목을 채우거나 새로 올린다). 파일 자체는 storage 정책이 통제한다.
create or replace function public.portal_register_document(
  p_link_id uuid,
  p_document_id uuid,
  p_document_type text,
  p_title text,
  p_storage_path text,
  p_file_name text,
  p_file_size bigint default null,
  p_mime_type text default null,
  p_customer_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws     uuid;
  v_client text;
  v_id     uuid;
begin
  if not public.portal_link_owned(p_link_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  -- 경로는 반드시 이 연결의 고객 업로드 폴더 안이어야 한다
  select workspace_id, operations_client_id into v_ws, v_client from public.portal_client_links where id = p_link_id;
  if p_storage_path is null or position(v_ws::text || '/portal/' || p_link_id::text || '/' in p_storage_path) <> 1 then
    raise exception 'invalid storage path' using errcode = '22023';
  end if;

  if p_document_id is not null then
    update public.portal_documents
       set storage_path = p_storage_path, file_name = p_file_name, file_size = p_file_size, mime_type = p_mime_type,
           source = 'customer', visibility = 'customer_uploaded', status = 'uploaded',
           customer_note = coalesce(p_customer_note, customer_note), uploaded_at = now()
     where id = p_document_id and portal_client_link_id = p_link_id and status in ('requested', 'rejected', 'uploaded')
    returning id into v_id;
    if v_id is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;
    return v_id;
  end if;

  insert into public.portal_documents (
    workspace_id, portal_client_link_id, operations_client_id, document_type, title,
    storage_path, file_name, file_size, mime_type, source, visibility, status, customer_note, uploaded_at
  ) values (
    v_ws, p_link_id, v_client, left(coalesce(p_document_type, 'other'), 80), left(trim(p_title), 200),
    p_storage_path, p_file_name, p_file_size, p_mime_type, 'customer', 'customer_uploaded', 'uploaded', p_customer_note, now()
  )
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.portal_register_document(uuid, uuid, text, text, text, text, bigint, text, text) from public, anon;
grant execute on function public.portal_register_document(uuid, uuid, text, text, text, text, bigint, text, text) to authenticated;

-- 고객: 요청받은 조치 완료 표시
create or replace function public.portal_complete_action(p_update_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link uuid;
begin
  select portal_client_link_id into v_link from public.portal_updates where id = p_update_id and status = 'published';
  if v_link is null or not public.portal_link_owned(v_link) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  update public.portal_updates
     set customer_completed_at = coalesce(customer_completed_at, now())
   where id = p_update_id and customer_action_required;
  return found;
end;
$$;
revoke all on function public.portal_complete_action(uuid) from public, anon;
grant execute on function public.portal_complete_action(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 11. Storage — client-documents 버킷에 고객 경로 정책을 "추가"한다
--     경로 계약: {workspaceId}/portal/{linkId}/{fileName}
--     첫 폴더가 workspace uuid 이므로 기존 내부 정책의 ::uuid 캐스트가 깨지지 않는다.
-- ---------------------------------------------------------------------
create or replace function public.portal_storage_path_allowed(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.portal_client_links l
    where l.profile_id = auth.uid() and l.status = 'active'
      and (storage.foldername(object_name))[1] = l.workspace_id::text
      and (storage.foldername(object_name))[2] = 'portal'
      and (storage.foldername(object_name))[3] = l.id::text
  );
$$;
revoke all on function public.portal_storage_path_allowed(text) from public, anon;
grant execute on function public.portal_storage_path_allowed(text) to authenticated;

create or replace function public.portal_storage_shared(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.portal_documents d
    join public.portal_client_links l on l.id = d.portal_client_link_id
    where d.storage_path = object_name
      and d.visibility = 'shared_with_customer'
      and l.profile_id = auth.uid() and l.status = 'active'
  );
$$;
revoke all on function public.portal_storage_shared(text) from public, anon;
grant execute on function public.portal_storage_shared(text) to authenticated;

do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "Customers can upload portal documents" on storage.objects';
    execute 'create policy "Customers can upload portal documents"
      on storage.objects for insert to authenticated
      with check (bucket_id = ''client-documents'' and public.portal_storage_path_allowed(name))';

    execute 'drop policy if exists "Customers can read their portal documents" on storage.objects';
    execute 'create policy "Customers can read their portal documents"
      on storage.objects for select to authenticated
      using (bucket_id = ''client-documents''
             and (public.portal_storage_path_allowed(name) or public.portal_storage_shared(name)))';
  end if;
end $$;
