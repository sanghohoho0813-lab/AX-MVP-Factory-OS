-- =====================================================================
-- 20261001000015_grant_finder.sql  (D-141 지원사업 매칭 알림)
-- ---------------------------------------------------------------------
-- 가망고객이 로그인 없이 자기 회사 조건으로 지원사업을 찾고(/grants/find),
-- '새 공고 알림 받기' 를 남기면 내부 '잠재고객 상담신청' 함으로 들어오게 한다.
--
-- 원칙
--   * additive only — 새 표 하나 · 새 함수 둘. DROP / TRUNCATE / rename / PK 변경 / RLS 해제 없음
--   * idempotent    — if not exists / create or replace / drop policy if exists
--   * 고객(가망고객)은 내부 표를 읽지 않는다 — portal_grant_notices() 함수(공개해도 되는 칸)만
--   * 공고 원본은 내부 module_data(grants/notices)에 있다. 이 표는 '찾기 화면에 보이기' 한 것의 공개 사본이다
--     (내부 메모 · 출처 · 누가 넣었는지는 앱이 빼고 복사한다 — grantStore.publicPayload)
--   * 알림 신청은 기존 고객 이벤트 종류 'consultation_requested' (출처 grant_finder)로 — 이벤트 종류 제약을 바꾸지 않는다
--   * 주민등록번호 · 비밀번호 · 계좌 칸은 없다
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. portal_grant_notices — 공개해도 되는 공고 사본
-- ---------------------------------------------------------------------
create table if not exists public.portal_grant_notices (
  id           text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  payload      jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.portal_grant_notices is
  '지원사업 찾기(가망고객 공개 화면)에 보이는 공고 사본. 내부가 "찾기 화면에 보이기" 한 것만 is_published. 가망고객은 portal_grant_notices() 로만 읽는다.';

create index if not exists portal_grant_notices_ws_idx
  on public.portal_grant_notices (workspace_id, is_published, updated_at desc);

drop trigger if exists trg_portal_grant_notices_updated on public.portal_grant_notices;
create trigger trg_portal_grant_notices_updated
  before update on public.portal_grant_notices
  for each row execute function public.bridge_touch_updated_at();

alter table public.portal_grant_notices enable row level security;
revoke all on public.portal_grant_notices from anon;

drop policy if exists "Workspace members can read grant notices" on public.portal_grant_notices;
create policy "Workspace members can read grant notices"
  on public.portal_grant_notices for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace writers can manage grant notices" on public.portal_grant_notices;
create policy "Workspace writers can manage grant notices"
  on public.portal_grant_notices for all to authenticated
  using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

-- ---------------------------------------------------------------------
-- 2. portal_grant_notices() — 가망고객이 읽는 유일한 길
--    받는 워크스페이스(default_intake_workspace)의 공개 공고 중 아직 안 끝난 것(어제 마감까지)
-- ---------------------------------------------------------------------
create or replace function public.portal_grant_notices()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x.payload order by x.sort_end nulls last, x.updated_at desc), '[]'::jsonb)
  from (
    select
      -- 공개 칸만 다시 고른다(사본에 다른 칸이 섞여 들어와도 밖으로 나가지 않게)
      jsonb_build_object(
        'id', g.id,
        'title', left(coalesce(g.payload->>'title', ''), 200),
        'agency', left(coalesce(g.payload->>'agency', ''), 80),
        'operator', left(coalesce(g.payload->>'operator', ''), 80),
        'category', coalesce(g.payload->>'category', 'etc'),
        'applyStart', coalesce(g.payload->>'applyStart', ''),
        'applyEnd', coalesce(g.payload->>'applyEnd', ''),
        'deadlineKind', coalesce(g.payload->>'deadlineKind', 'date'),
        'amountText', left(coalesce(g.payload->>'amountText', ''), 80),
        'target', left(coalesce(g.payload->>'target', ''), 600),
        'summary', left(coalesce(g.payload->>'summary', ''), 600),
        'url', case when coalesce(g.payload->>'url', '') ~ '^https?://' then left(g.payload->>'url', 500) else '' end,
        'rules', case when jsonb_typeof(g.payload->'rules') = 'object' then g.payload->'rules' else '{}'::jsonb end
      ) as payload,
      case when coalesce(g.payload->>'applyEnd', '') ~ '^\d{4}-\d{2}-\d{2}$' then (g.payload->>'applyEnd')::date end as sort_end,
      g.updated_at
    from public.portal_grant_notices g
    where g.workspace_id = public.default_intake_workspace()
      and g.is_published
      and (
        coalesce(g.payload->>'applyEnd', '') !~ '^\d{4}-\d{2}-\d{2}$'
        or (g.payload->>'applyEnd')::date >= ((now() at time zone 'Asia/Seoul')::date - 1)
      )
    order by g.updated_at desc
    limit 300
  ) x;
$$;

revoke all on function public.portal_grant_notices() from public;
grant execute on function public.portal_grant_notices() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. portal_grant_alert_request(payload) — '새 공고 알림 받기'
--    정해진 칸만 받아 고객 이벤트(상담 신청, 출처 grant_finder)로 남긴다.
--    너무 많이 들어오면(10분에 30건) 막는다.
-- ---------------------------------------------------------------------
create or replace function public.portal_grant_alert_request(p_payload jsonb)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_company text;
  v_phone   text;
  v_email   text;
  v_titles  jsonb;
  v_safe    jsonb;
  v_ws      uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or length(p_payload::text) > 8000 then
    raise exception 'invalid payload' using errcode = '22023';
  end if;
  if coalesce(p_payload->>'consent', 'false') <> 'true' then
    raise exception 'consent required' using errcode = '22023';
  end if;

  v_company := left(btrim(coalesce(p_payload->>'company_name', '')), 60);
  v_phone   := left(btrim(coalesce(p_payload->>'phone', '')), 30);
  v_email   := left(btrim(coalesce(p_payload->>'email', '')), 80);
  if v_company = '' then
    raise exception 'company required' using errcode = '22023';
  end if;
  if v_phone = '' and v_email = '' then
    raise exception 'contact required' using errcode = '22023';
  end if;
  if v_phone <> '' and v_phone !~ '^[0-9+() -]{8,20}$' then
    raise exception 'invalid phone' using errcode = '22023';
  end if;

  v_ws := public.default_intake_workspace();
  if v_ws is null then
    return false; -- 받을 워크스페이스가 없는 환경(설정 전)
  end if;
  if (select count(*) from public.customer_events e
       where e.workspace_id = v_ws and e.source_type = 'grant_finder'
         and e.received_at > now() - interval '10 minutes') >= 30 then
    raise exception 'too many requests' using errcode = '54000';
  end if;

  v_titles := case
    when jsonb_typeof(p_payload->'grant_titles') = 'array'
      then (select coalesce(jsonb_agg(left(t, 80)), '[]'::jsonb)
              from (select jsonb_array_elements_text(p_payload->'grant_titles') as t limit 5) s)
    else '[]'::jsonb
  end;

  v_safe := jsonb_build_object(
    'company_name', v_company,
    'representative_name', left(btrim(coalesce(p_payload->>'representative_name', '')), 30),
    'phone', v_phone,
    'email', v_email,
    'industry', left(btrim(coalesce(p_payload->>'industry', '')), 40),
    'program', '지원사업 알림',
    'message', left(coalesce(p_payload->>'message', ''), 300),
    'grant_query', left(coalesce(p_payload->>'grant_query', ''), 500),
    'grant_titles', v_titles,
    'grant_fit_count', case when coalesce(p_payload->>'grant_fit_count', '') ~ '^\d{1,4}$' then (p_payload->>'grant_fit_count')::int else 0 end,
    'referrer_code', left(coalesce(p_payload->>'referrer_code', ''), 40),
    'consent', true
  );

  perform public.bridge_emit_customer_event(
    'consultation_requested',
    'grant_finder',
    gen_random_uuid()::text,
    v_safe,
    'high',
    (select p.id from public.profiles p where p.id = auth.uid()), -- 로그인한 고객이면 그 계정, 아니면 비움
    null,
    now()
  );
  return true;
end;
$$;

revoke all on function public.portal_grant_alert_request(jsonb) from public;
grant execute on function public.portal_grant_alert_request(jsonb) to anon, authenticated;

commit;

-- 확인용
--   select public.portal_grant_notices();                       -- 공개 공고 배열
--   select public.portal_grant_alert_request('{"company_name":"시험","phone":"010-0000-0000","consent":true}');
--   select event_type, source_type, customer_safe_payload from public.customer_events where source_type = 'grant_finder' order by received_at desc limit 1;
