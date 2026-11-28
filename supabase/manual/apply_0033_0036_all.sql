-- =====================================================================
-- 🚨 운영 DB — 0033 ~ 0036 네 개를 한 번에 넣는 묶음(D-689 · 실행은 대표)
--
-- 이 파일은 `node scripts/make-ops-bundle.mjs` 가 만든다. 손으로 고치지 않는다(네 마이그레이션 원문 그대로 · 차례대로).
-- 사용: Supabase SQL Editor 에 이 파일을 **통째로** 붙여 넣고 실행 → 맨 아래 결과 표 네 줄이 모두 `들어감`.
-- 전부 또는 전무: 한 거래다. 중간에 하나라도 멈추면 네 개 모두 들어가지 않는다(잠금이 5초 넘게 걸려도 멈춘다 — 조금 뒤 다시).
-- 여러 번 실행해도 결과는 같다. 이미 몇 개를 따로 넣었어도 된다(있는 것은 그대로 두고 없는 것만 더한다).
-- 더하기만 한다 — 기존 표 · 열 · 자료는 지우거나 바꾸지 않는다.
-- 먼저 있어야 하는 것: 0006 · 0016 · 0023 · 0026(운영에는 2026-11-26 0032 까지 들어가 있음 — D-674 · D-675). 없으면 그 자리에서 멈추고 아무것도 바뀌지 않는다.
--
-- 넣으면 바로 달라지는 것
--   0033 고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681) — 업체 › 고객 플랫폼 탭에 '고객에게 보낸 보고서' 칸이 생기고, 홈페이지 내 프로젝트에 성장 홈 · '보고서' 탭이 생긴다(보고서를 내기 전에는 비어 있음).
--   0034 공유 서류 · 결과 글 열람 기록(D-685) — 고객이 공유 서류를 열거나 결과 글을 보면 업체 탭에 '열어 보심' — 넣은 때 전에 공유한 것은 '열람 기록 전 공유'(한꺼번에 빨간 줄이 뜨지 않음).
--   0035 고객 화면 '새 결과 자료'(D-686) — 고객 홈 '지금 할 일' · 카드 · '결과' 탭에 '새 결과 자료' — 넣은 때 뒤에 공유한 것만.
--   0036 고객 화면 '담당자가 추천해요'(D-689) — 업체 › 고객 플랫폼 탭에 '고객에게 추천' 칸이 생긴다 — 담당자가 고른 것만(3개까지) 고객 홈에 보이고, 고객이 [관심 있어요] 를 누르면 오늘 화면에 '연락드리기' 한 줄(올리기 전에는 아무것도 안 보임).
--
-- 넣기 전 · 넣은 뒤 보기(읽기만): supabase/manual/check_applied_0033_0036.sql
-- 자세한 확인(읽기만): verify_after_0033 · 0034 · 0035 · 0036.sql · 안내서 docs/CUSTOMER_GROWTH_RELEASE.md §2
-- 되돌리기: rollback_0036 → 0035 → 0034 → 0033.sql 차례로(기록 · 자료는 남는다) — 대표가 '되돌려' 라고 할 때만.
-- =====================================================================
begin;
set local lock_timeout = '5s';

-- ───────────────────────────── 0033 고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681) ─────────────────────────────
-- 20261127000033_customer_growth.sql
--
-- 고객성장관리 P0(D-681) — 내부에서 한 번 기록한 경과 · 중간 · 최종 보고를 승인해 고객 화면(My MIRAE)에 '발행' 하고,
-- 고객이 실제로 열어 본 것 · 명시로 확인한 것을 계정마다 서버에 남긴다. 내부 OS 는 그 기록으로 후속 업무를 띄운다.
--
-- 원칙(0006 브릿지 계약 그대로 — 고치지 않고 더하기만)
--   · 고객은 표를 직접 읽지 못한다(고객용 정책 0). 아래 portal_* 함수(서버가 칸을 고른 투영)로만 본다.
--   · 보고서는 업체(operations_client) 단위 — 같은 업체에 연결된 계정이 여럿이면 모두 본다. 열람 · 확인은 계정(연결)마다 따로.
--   · 발행은 한 번에 끝난다(한 함수 · 한 거래). 같은 발행 번호(client_key)로 두 번 눌러도 한 건.
--   · 고친 보고서는 덮어쓰지 않고 새 판(version + 1)으로 — 예전 판은 'superseded', 내린 것은 'withdrawn'(지우지 않는다).
--   · 열람(seen)은 고객 화면이 보고서를 다 그린 뒤에만 · 확인(acknowledged)은 고객이 따로 누른 것 — 계약 검수 · 대금 승인이 아니다.
--   · 직원은 열람 · 확인 기록을 만들 수도 고칠 수도 없다(쓰기 정책 0 · 함수는 auth.uid() 가 그 연결의 고객일 때만).
--   · 내부 미리보기는 같은 투영 함수를 부르지만 아무것도 기록하지 않는다.
--   · 내부 출처(source_refs) · 내린 까닭 · 발행한 사람 id 는 고객 투영에 없다.
--   · 0023(작업공간 고정) · 0026(허락 동안만 보기 — 대표가 팀장 작업공간을 볼 때) 장치를 새 표에도 똑같이 단다.
--
-- 표 2 · 함수 13 · 정책(표마다 읽기 1 + 허락 문 1) · 트리거(같은 작업공간 지킴 · 작업공간 고정). 표 · 열 · 정책 삭제/변경 없음.
-- 여러 번 실행해도 같다(create if not exists · create or replace · drop policy if exists).
-- 먼저 있어야 하는 것: 0006 · 0016 · 0023 · 0026 (없으면 멈춘다).
-- 되돌리기: supabase/manual/rollback_0033.sql · 확인: supabase/manual/verify_after_0033.sql

-- (묶음: 거래는 맨 위 begin 하나)

do $$
begin
  if to_regproc('public.portal_link_owned') is null
     or to_regproc('public.can_write_workspace') is null
     or to_regproc('public.workspace_id_lock') is null
     or to_regproc('public.view_consent_ok') is null
     or to_regproc('public.view_consent_blocked_workspaces') is null then
    raise exception '0033 은 0006 · 0016 · 0023 · 0026 을 넣은 뒤에 넣습니다(먼저 넣을 것이 빠졌습니다).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. portal_reports — 고객에게 발행한 보고서(판마다 한 줄 · 덮어쓰지 않는다)
-- ---------------------------------------------------------------------
create table if not exists public.portal_reports (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  operations_client_id text not null references public.operations_clients (id) on delete cascade,
  -- 같은 보고서의 판들을 묶는 번호(정정하면 같은 묶음에 version + 1)
  report_group         uuid not null,
  version              integer not null default 1 check (version between 1 and 1000),
  kind                 text not null check (kind in ('consult_summary', 'progress', 'interim', 'final', 'monthly', 'annual')),
  title                text not null check (char_length(btrim(title)) between 1 and 120),
  period_start         date,
  period_end           date,
  -- 고객에게 보이는 글(서버가 모양을 다시 만든 것만 들어간다 — portal_growth_clean_sections)
  summary              text not null default '' check (char_length(summary) <= 1000),
  sections             jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  staff_note           text not null default '' check (char_length(staff_note) <= 1000),
  correction_note      text not null default '' check (char_length(correction_note) <= 300),
  status               text not null default 'published' check (status in ('published', 'superseded', 'withdrawn')),
  supersedes           uuid references public.portal_reports (id) on delete set null,
  superseded_by        uuid references public.portal_reports (id) on delete set null,
  -- 내부 감사용 — 어느 업무 · 서류 · 신청 건에서 나온 줄인지(고객 투영에 없다)
  source_refs          jsonb not null default '[]'::jsonb check (jsonb_typeof(source_refs) = 'array'),
  -- 발행 번호(화면이 초안마다 만든다) — 두 번 눌러도 · 다시 보내도 한 건
  client_key           text not null check (char_length(client_key) between 8 and 80),
  published_by         uuid references auth.users (id) on delete set null,
  published_at         timestamptz not null default now(),
  withdrawn_at         timestamptz,
  withdrawn_by         uuid references auth.users (id) on delete set null,
  withdrawn_reason     text check (withdrawn_reason is null or char_length(withdrawn_reason) <= 300),
  created_at           timestamptz not null default now(),
  unique (report_group, version),
  unique (workspace_id, client_key),
  check (period_start is null or period_end is null or period_start <= period_end)
);
comment on table public.portal_reports is
  '고객 화면에 발행한 보고서(경과 · 중간 · 최종 · 상담 요약 · 월간 · 연간). 업체 단위 · 판마다 한 줄 · 덮어쓰지 않는다. 고객은 portal_* 함수로만 본다.';
create index if not exists portal_reports_client_idx on public.portal_reports (workspace_id, operations_client_id, status, published_at desc);
create index if not exists portal_reports_group_idx on public.portal_reports (report_group, version desc);

-- ---------------------------------------------------------------------
-- 2. portal_receipts — 고객 계정마다 열어 본 때 · 확인한 때(직원은 쓸 수 없다)
--    item_kind: home(고객 화면 첫 방문 · 최근 방문 — item_id = 연결 id) · report(보고서 — item_id = 그 판의 id)
-- ---------------------------------------------------------------------
create table if not exists public.portal_receipts (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  operations_client_id  text not null references public.operations_clients (id) on delete cascade,
  portal_client_link_id uuid not null references public.portal_client_links (id) on delete cascade,
  profile_id            uuid not null references public.profiles (id) on delete cascade,
  item_kind             text not null check (item_kind in ('home', 'report')),
  item_id               uuid not null,
  item_version          integer not null default 1,
  first_seen_at         timestamptz not null default now(),
  last_seen_at          timestamptz not null default now(),
  seen_count            integer not null default 1 check (seen_count >= 1),
  acknowledged_at       timestamptz,
  unique (portal_client_link_id, profile_id, item_kind, item_id, item_version)
);
comment on table public.portal_receipts is
  '고객 계정이 고객 화면을 처음 · 최근에 연 때와 보고서를 열어 본 때 · 확인한 때. 서버 함수만 쓴다(직원 · 고객 모두 표에 직접 쓰지 못한다). 확인은 계약 검수가 아니다.';
create index if not exists portal_receipts_client_idx on public.portal_receipts (workspace_id, operations_client_id, item_kind, last_seen_at desc);
create index if not exists portal_receipts_item_idx on public.portal_receipts (item_kind, item_id);

-- ---------------------------------------------------------------------
-- 3. 같은 작업공간 지킴 — 업체 · 연결이 그 작업공간 것이어야 한다(0016 과 같은 뜻 · 이 표에 맞춘 판)
-- ---------------------------------------------------------------------
create or replace function public.portal_growth_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.operations_clients c where c.id = new.operations_client_id and c.workspace_id = new.workspace_id) then
    raise exception '다른 워크스페이스의 업체에는 넣을 수 없습니다.' using errcode = '42501';
  end if;
  if tg_table_name = 'portal_receipts' then
    if not exists (
      select 1 from public.portal_client_links l
      where l.id = new.portal_client_link_id and l.workspace_id = new.workspace_id
        and l.operations_client_id = new.operations_client_id and l.profile_id = new.profile_id
    ) then
      raise exception '그 연결의 고객 기록이 아닙니다.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.portal_growth_guard() from public, anon, authenticated;

drop trigger if exists zz_portal_reports_same_workspace on public.portal_reports;
create trigger zz_portal_reports_same_workspace
  before insert or update of workspace_id, operations_client_id on public.portal_reports
  for each row execute function public.portal_growth_guard();

drop trigger if exists zz_portal_receipts_same_workspace on public.portal_receipts;
create trigger zz_portal_receipts_same_workspace
  before insert or update of workspace_id, operations_client_id, portal_client_link_id, profile_id on public.portal_receipts
  for each row execute function public.portal_growth_guard();

-- 0023 작업공간 고정
drop trigger if exists zz_workspace_id_lock on public.portal_reports;
create trigger zz_workspace_id_lock before update of workspace_id on public.portal_reports
  for each row execute function public.workspace_id_lock();
drop trigger if exists zz_workspace_id_lock on public.portal_receipts;
create trigger zz_workspace_id_lock before update of workspace_id on public.portal_receipts
  for each row execute function public.workspace_id_lock();

-- ---------------------------------------------------------------------
-- 4. 권한 — 앱 계정은 읽기(작업공간 구성원)만 · 쓰기는 아래 함수만 · anon 0
-- ---------------------------------------------------------------------
alter table public.portal_reports enable row level security;
alter table public.portal_receipts enable row level security;
revoke all on public.portal_reports from anon, authenticated;
revoke all on public.portal_receipts from anon, authenticated;
grant select on public.portal_reports to authenticated;
grant select on public.portal_receipts to authenticated;

drop policy if exists "Workspace members can read portal reports" on public.portal_reports;
create policy "Workspace members can read portal reports"
  on public.portal_reports for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can read portal receipts" on public.portal_receipts;
create policy "Workspace members can read portal receipts"
  on public.portal_receipts for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- 0026 허락 문(대표가 팀장 작업공간을 볼 때) — 다른 고객 자료 표와 같은 문
drop policy if exists "zz View consent gate" on public.portal_reports;
create policy "zz View consent gate"
  on public.portal_reports as restrictive for all to authenticated
  using (not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[])))
  with check (not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[])));
drop policy if exists "zz View consent gate" on public.portal_receipts;
create policy "zz View consent gate"
  on public.portal_receipts as restrictive for all to authenticated
  using (not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[])))
  with check (not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[])));

-- ---------------------------------------------------------------------
-- 5. 안쪽 함수 — 글 다듬기 · 칸 모양 다시 만들기 · 고객 투영(앱 계정은 부를 수 없다)
-- ---------------------------------------------------------------------

-- 글 다듬기 — 보이지 않는 제어 문자 빼기(줄바꿈은 여러 줄 칸만 남긴다) · 앞뒤 빈칸 · 길이
create or replace function public.portal_growth_text(p text, p_max integer, p_multiline boolean default false)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := coalesce(p, '');
begin
  if p_multiline then
    v := regexp_replace(v, E'[\\x01-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', '', 'g');
    v := regexp_replace(v, E'\\r\\n?', E'\n', 'g');
  else
    v := regexp_replace(v, E'[\\x01-\\x1F\\x7F]', ' ', 'g');
  end if;
  v := btrim(v);
  if char_length(v) > p_max then
    raise exception '글이 너무 깁니다(%자까지).', p_max using errcode = '22023';
  end if;
  return v;
end;
$$;
revoke all on function public.portal_growth_text(text, integer, boolean) from public, anon, authenticated;

-- 보고서 칸 — 받은 모양을 믿지 않고 허용된 칸만 골라 다시 만든다(모르는 칸 · 내부 칸은 버린다)
--   [{ key, title, items: [{ text, date?, tag? }] }] · 칸 8개 · 줄 40개 · 한 줄 300자
create or replace function public.portal_growth_clean_sections(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  s     jsonb;
  it    jsonb;
  outv  jsonb := '[]'::jsonb;
  items jsonb;
  t     text;
  d     text;
begin
  if p is null or jsonb_typeof(p) <> 'array' then
    return '[]'::jsonb;
  end if;
  if jsonb_array_length(p) > 8 then
    raise exception '보고서 칸은 8개까지입니다.' using errcode = '22023';
  end if;
  for s in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(s) <> 'object' then
      raise exception '보고서 칸 모양이 틀렸습니다.' using errcode = '22023';
    end if;
    items := '[]'::jsonb;
    if jsonb_typeof(s -> 'items') = 'array' then
      if jsonb_array_length(s -> 'items') > 40 then
        raise exception '한 칸의 줄은 40개까지입니다.' using errcode = '22023';
      end if;
      for it in select value from jsonb_array_elements(s -> 'items') loop
        if jsonb_typeof(it) <> 'object' or jsonb_typeof(it -> 'text') <> 'string' then
          continue;
        end if;
        t := public.portal_growth_text(it ->> 'text', 300, false);
        if t = '' then
          continue;
        end if;
        d := case when jsonb_typeof(it -> 'date') = 'string' and (it ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$' then it ->> 'date' end;
        items := items || jsonb_build_array(jsonb_build_object(
          'text', t,
          'date', d,
          'tag', nullif(left(public.portal_growth_text(case when jsonb_typeof(it -> 'tag') = 'string' then it ->> 'tag' end, 400, false), 20), '')
        ));
      end loop;
    end if;
    t := left(public.portal_growth_text(case when jsonb_typeof(s -> 'title') = 'string' then s ->> 'title' end, 400, false), 60);
    if t = '' then
      raise exception '보고서 칸 이름이 비었습니다.' using errcode = '22023';
    end if;
    outv := outv || jsonb_build_array(jsonb_build_object(
      'key', left(regexp_replace(coalesce(case when jsonb_typeof(s -> 'key') = 'string' then s ->> 'key' end, ''), '[^a-z_]', '', 'g'), 20),
      'title', t,
      'items', items
    ));
  end loop;
  return outv;
end;
$$;
revoke all on function public.portal_growth_clean_sections(jsonb) from public, anon, authenticated;

-- 내부 출처 — [{ type, id, at? }] 만 · 200개까지(고객 투영에 없다)
create or replace function public.portal_growth_clean_refs(p jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'type', left(x ->> 'type', 40),
           'id', left(x ->> 'id', 120),
           'at', left(x ->> 'at', 40)
         )), '[]'::jsonb)
  from (
    select value as x from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end)
    where jsonb_typeof(value) = 'object' and jsonb_typeof(value -> 'type') = 'string' and jsonb_typeof(value -> 'id') = 'string'
    limit 200
  ) s;
$$;
revoke all on function public.portal_growth_clean_refs(jsonb) from public, anon, authenticated;

-- 고객 투영 한 줄 — 고객 화면 · 내부 미리보기가 같은 함수를 쓴다(두 화면이 어긋나지 않게).
--   p_viewer · p_link 가 null 이면(미리보기) 열람 칸은 비운다. 내부 칸(workspace · 업체 id · 출처 · 발행한 사람 · 내린 까닭)은 없다.
create or replace function public.portal_report_item(p_report_id uuid, p_link uuid, p_viewer uuid, p_full boolean)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id,
    'version', r.version,
    'kind', r.kind,
    'title', r.title,
    'period_start', r.period_start,
    'period_end', r.period_end,
    'summary', r.summary,
    'status', r.status,
    'published_at', r.published_at,
    'corrected', r.version > 1,
    'correction_note', nullif(r.correction_note, ''),
    'sections', case when p_full then r.sections else null end,
    'staff_note', case when p_full then nullif(r.staff_note, '') else null end,
    'seen_at', rc.first_seen_at,
    'acknowledged_at', rc.acknowledged_at
  )
  from public.portal_reports r
  left join public.portal_receipts rc
    on p_viewer is not null and p_link is not null
   and rc.portal_client_link_id = p_link and rc.profile_id = p_viewer
   and rc.item_kind = 'report' and rc.item_id = r.id
  where r.id = p_report_id;
$$;
revoke all on function public.portal_report_item(uuid, uuid, uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. 고객 함수 — auth.uid() 가 가진 활성 연결에서만 · 남의 것은 'not found'
-- ---------------------------------------------------------------------

-- 고객: 이 연결(업체)의 발행된 보고서 목록(최신 판만 · 내린 것 빼고) + 내가 열어 본 때 · 확인한 때
create or replace function public.portal_reports(p_link_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ws     uuid;
  v_client text;
begin
  if not public.portal_link_owned(p_link_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  select workspace_id, operations_client_id into v_ws, v_client from public.portal_client_links where id = p_link_id;
  return coalesce((
    select jsonb_agg(public.portal_report_item(r.id, p_link_id, auth.uid(), false) order by r.published_at desc)
    from public.portal_reports r
    where r.workspace_id = v_ws and r.operations_client_id = v_client and r.status = 'published'
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.portal_reports(uuid) from public, anon;
grant execute on function public.portal_reports(uuid) to authenticated;

-- 고객: 보고서 한 편. 정정된 예전 판은 '새 판 있음' 안내만 · 내린 것은 제목만(본문 없음)
create or replace function public.portal_report(p_link_id uuid, p_report_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ws     uuid;
  v_client text;
  r        public.portal_reports;
begin
  if not public.portal_link_owned(p_link_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  select workspace_id, operations_client_id into v_ws, v_client from public.portal_client_links where id = p_link_id;
  select * into r from public.portal_reports where id = p_report_id and workspace_id = v_ws and operations_client_id = v_client;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if r.status = 'published' then
    return public.portal_report_item(r.id, p_link_id, auth.uid(), true) || jsonb_build_object(
      'company_name', (select c.company_name from public.operations_clients c where c.id = v_client),
      'consultant_name', (select l.consultant_name from public.portal_client_links l where l.id = p_link_id)
    );
  end if;
  return jsonb_build_object(
    'id', r.id,
    'status', r.status,
    'title', r.title,
    'version', r.version,
    'kind', r.kind,
    'published_at', r.published_at,
    'withdrawn_at', r.withdrawn_at,
    'latest_id', (
      select x.id from public.portal_reports x
      where x.report_group = r.report_group and x.status = 'published'
      order by x.version desc limit 1
    )
  );
end;
$$;
revoke all on function public.portal_report(uuid, uuid) from public, anon;
grant execute on function public.portal_report(uuid, uuid) to authenticated;

-- 고객: 보고서를 열어 봤다(화면이 다 그린 뒤에 부른다). 1분 안에 다시 불러도 횟수는 그대로.
create or replace function public.portal_mark_report_seen(p_link_id uuid, p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws     uuid;
  v_client text;
  v_ver    integer;
  v_out    jsonb;
begin
  if not public.portal_link_owned(p_link_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  select workspace_id, operations_client_id into v_ws, v_client from public.portal_client_links where id = p_link_id;
  select version into v_ver from public.portal_reports
   where id = p_report_id and workspace_id = v_ws and operations_client_id = v_client and status = 'published';
  if v_ver is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.portal_receipts (workspace_id, operations_client_id, portal_client_link_id, profile_id, item_kind, item_id, item_version)
  values (v_ws, v_client, p_link_id, auth.uid(), 'report', p_report_id, v_ver)
  on conflict (portal_client_link_id, profile_id, item_kind, item_id, item_version) do update
    set last_seen_at = now(), seen_count = public.portal_receipts.seen_count + 1
    where public.portal_receipts.last_seen_at < now() - interval '1 minute';
  select jsonb_build_object('seen_at', first_seen_at, 'acknowledged_at', acknowledged_at) into v_out
    from public.portal_receipts
   where portal_client_link_id = p_link_id and profile_id = auth.uid() and item_kind = 'report' and item_id = p_report_id and item_version = v_ver;
  return v_out;
end;
$$;
revoke all on function public.portal_mark_report_seen(uuid, uuid) from public, anon;
grant execute on function public.portal_mark_report_seen(uuid, uuid) to authenticated;

-- 고객: [확인했어요] — 보고서를 읽었다는 표시(계약 검수 · 대금 승인이 아니다). 다시 눌러도 처음 때 그대로.
create or replace function public.portal_acknowledge_report(p_link_id uuid, p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws     uuid;
  v_client text;
  v_ver    integer;
  v_out    jsonb;
begin
  if not public.portal_link_owned(p_link_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  select workspace_id, operations_client_id into v_ws, v_client from public.portal_client_links where id = p_link_id;
  select version into v_ver from public.portal_reports
   where id = p_report_id and workspace_id = v_ws and operations_client_id = v_client and status = 'published';
  if v_ver is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.portal_receipts (workspace_id, operations_client_id, portal_client_link_id, profile_id, item_kind, item_id, item_version, acknowledged_at)
  values (v_ws, v_client, p_link_id, auth.uid(), 'report', p_report_id, v_ver, now())
  on conflict (portal_client_link_id, profile_id, item_kind, item_id, item_version) do update
    set acknowledged_at = coalesce(public.portal_receipts.acknowledged_at, now());
  select jsonb_build_object('seen_at', first_seen_at, 'acknowledged_at', acknowledged_at) into v_out
    from public.portal_receipts
   where portal_client_link_id = p_link_id and profile_id = auth.uid() and item_kind = 'report' and item_id = p_report_id and item_version = v_ver;
  return v_out;
end;
$$;
revoke all on function public.portal_acknowledge_report(uuid, uuid) from public, anon;
grant execute on function public.portal_acknowledge_report(uuid, uuid) to authenticated;

-- 고객: 고객 화면에 들어왔다 — 내 활성 연결마다 첫 방문 · 최근 방문(1분 안에 다시 불러도 그대로). 연결 수를 돌려준다.
create or replace function public.portal_mark_home()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.portal_receipts (workspace_id, operations_client_id, portal_client_link_id, profile_id, item_kind, item_id, item_version)
  select l.workspace_id, l.operations_client_id, l.id, auth.uid(), 'home', l.id, 1
    from public.portal_client_links l
   where l.profile_id = auth.uid() and l.status = 'active'
  on conflict (portal_client_link_id, profile_id, item_kind, item_id, item_version) do update
    set last_seen_at = now(), seen_count = public.portal_receipts.seen_count + 1
    where public.portal_receipts.last_seen_at < now() - interval '1 minute';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.portal_mark_home() from public, anon;
grant execute on function public.portal_mark_home() to authenticated;

-- 고객: 성장 홈 요약 — 내 활성 연결마다 보고서 수 · 안 열어 본 수 · 확인 안 한 수 · 가장 최근 보고서 · 처음 온 때
create or replace function public.portal_growth_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x ->> 'link_id'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'link_id', l.id,
      'reports_total', (
        select count(*) from public.portal_reports r
        where r.workspace_id = l.workspace_id and r.operations_client_id = l.operations_client_id and r.status = 'published'),
      'reports_unseen', (
        select count(*) from public.portal_reports r
        where r.workspace_id = l.workspace_id and r.operations_client_id = l.operations_client_id and r.status = 'published'
          and not exists (
            select 1 from public.portal_receipts rc
            where rc.portal_client_link_id = l.id and rc.profile_id = l.profile_id and rc.item_kind = 'report' and rc.item_id = r.id)),
      'reports_unacked', (
        select count(*) from public.portal_reports r
        where r.workspace_id = l.workspace_id and r.operations_client_id = l.operations_client_id and r.status = 'published'
          and not exists (
            select 1 from public.portal_receipts rc
            where rc.portal_client_link_id = l.id and rc.profile_id = l.profile_id and rc.item_kind = 'report' and rc.item_id = r.id
              and rc.acknowledged_at is not null)),
      'latest_report', (
        select public.portal_report_item(r.id, l.id, l.profile_id, false)
        from public.portal_reports r
        where r.workspace_id = l.workspace_id and r.operations_client_id = l.operations_client_id and r.status = 'published'
        order by r.published_at desc limit 1),
      'first_visit_at', (
        select rc.first_seen_at from public.portal_receipts rc
        where rc.portal_client_link_id = l.id and rc.profile_id = l.profile_id and rc.item_kind = 'home' and rc.item_id = l.id)
    ) as x
    from public.portal_client_links l
    where l.profile_id = auth.uid() and l.status = 'active'
  ) s;
$$;
revoke all on function public.portal_growth_summary() from public, anon;
grant execute on function public.portal_growth_summary() to authenticated;

-- ---------------------------------------------------------------------
-- 7. 내부 함수 — 그 작업공간에 쓸 수 있는 사람만 · 0026 허락 문 그대로
-- ---------------------------------------------------------------------

-- 내부: 보고서 발행(새 보고서 또는 정정 판). 한 거래 — 발행 번호가 같으면 처음 것을 그대로 돌려준다.
create or replace function public.portal_publish_report(
  p_workspace_id    uuid,
  p_client_id       text,
  p_client_key      text,
  p_kind            text,
  p_title           text,
  p_period_start    date default null,
  p_period_end      date default null,
  p_summary         text default '',
  p_sections        jsonb default '[]'::jsonb,
  p_staff_note      text default '',
  p_source_refs     jsonb default '[]'::jsonb,
  p_supersedes      uuid default null,
  p_correction_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old      public.portal_reports;
  v_existing public.portal_reports;
  v_id       uuid;
  v_group    uuid := gen_random_uuid();
  v_ver      integer := 1;
  v_title    text;
  v_summary  text;
  v_note     text;
  v_corr     text;
  v_sections jsonb;
begin
  if auth.uid() is null or p_workspace_id is null
     or not public.can_write_workspace(p_workspace_id) or not public.view_consent_ok(p_workspace_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.operations_clients c where c.id = p_client_id and c.workspace_id = p_workspace_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if p_client_key is null or char_length(p_client_key) not between 8 and 80 then
    raise exception '발행 번호가 틀렸습니다.' using errcode = '22023';
  end if;

  -- 같은 발행 번호 = 이미 한 발행(두 번 눌림 · 다시 보냄)
  select * into v_existing from public.portal_reports where workspace_id = p_workspace_id and client_key = p_client_key;
  if found then
    if v_existing.operations_client_id <> p_client_id then
      raise exception '발행 번호가 다른 업체 것과 겹칩니다.' using errcode = '22023';
    end if;
    return jsonb_build_object('id', v_existing.id, 'version', v_existing.version, 'report_group', v_existing.report_group,
                              'status', v_existing.status, 'created', false);
  end if;

  if p_kind is null or p_kind not in ('consult_summary', 'progress', 'interim', 'final', 'monthly', 'annual') then
    raise exception '보고서 종류가 틀렸습니다.' using errcode = '22023';
  end if;
  v_title := public.portal_growth_text(p_title, 120, false);
  if v_title = '' then
    raise exception '보고서 제목을 적어 주세요.' using errcode = '22023';
  end if;
  if p_period_start is not null and p_period_end is not null and p_period_start > p_period_end then
    raise exception '기간 시작이 끝보다 늦습니다.' using errcode = '22023';
  end if;
  v_summary := public.portal_growth_text(p_summary, 1000, true);
  v_note := public.portal_growth_text(p_staff_note, 1000, true);
  v_corr := public.portal_growth_text(p_correction_note, 300, false);
  v_sections := public.portal_growth_clean_sections(p_sections);
  if v_summary = '' and not exists (select 1 from jsonb_array_elements(v_sections) s where jsonb_array_length(s -> 'items') > 0) then
    raise exception '보고서에 고객이 볼 내용이 없습니다.' using errcode = '22023';
  end if;

  if p_supersedes is not null then
    select * into v_old from public.portal_reports
     where id = p_supersedes and workspace_id = p_workspace_id and operations_client_id = p_client_id
     for update;
    if not found then
      raise exception 'not found' using errcode = 'P0002';
    end if;
    if v_old.status <> 'published' then
      raise exception '이미 정정했거나 내린 보고서입니다 — 새로 불러온 뒤 다시 해 주세요.' using errcode = '40001';
    end if;
    if v_corr = '' then
      raise exception '무엇을 고쳤는지 한 줄 적어 주세요(고객에게 보입니다).' using errcode = '22023';
    end if;
    v_group := v_old.report_group;
    v_ver := v_old.version + 1;
  end if;

  begin
    insert into public.portal_reports (
      workspace_id, operations_client_id, report_group, version, kind, title, period_start, period_end,
      summary, sections, staff_note, correction_note, status, supersedes, source_refs, client_key, published_by
    ) values (
      p_workspace_id, p_client_id, v_group, v_ver, p_kind, v_title, p_period_start, p_period_end,
      v_summary, v_sections, v_note, case when p_supersedes is null then '' else v_corr end, 'published', p_supersedes,
      public.portal_growth_clean_refs(p_source_refs), p_client_key, auth.uid()
    )
    returning id into v_id;
  exception when unique_violation then
    -- 같은 순간 같은 발행 번호로 두 번 — 먼저 들어간 것을 돌려준다
    select * into v_existing from public.portal_reports where workspace_id = p_workspace_id and client_key = p_client_key;
    if found then
      return jsonb_build_object('id', v_existing.id, 'version', v_existing.version, 'report_group', v_existing.report_group,
                                'status', v_existing.status, 'created', false);
    end if;
    raise;
  end;

  if p_supersedes is not null then
    update public.portal_reports set status = 'superseded', superseded_by = v_id where id = p_supersedes;
  end if;
  return jsonb_build_object('id', v_id, 'version', v_ver, 'report_group', v_group, 'status', 'published', 'created', true);
end;
$$;
revoke all on function public.portal_publish_report(uuid, text, text, text, text, date, date, text, jsonb, text, jsonb, uuid, text) from public, anon;
grant execute on function public.portal_publish_report(uuid, text, text, text, text, date, date, text, jsonb, text, jsonb, uuid, text) to authenticated;

-- 내부: 보고서 내리기(지우지 않는다 · 까닭은 내부에만)
create or replace function public.portal_withdraw_report(p_report_id uuid, p_reason text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws  uuid;
  v_out public.portal_reports;
begin
  select workspace_id into v_ws from public.portal_reports where id = p_report_id;
  if v_ws is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if auth.uid() is null or not public.can_write_workspace(v_ws) or not public.view_consent_ok(v_ws) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.portal_reports
     set status = 'withdrawn', withdrawn_at = now(), withdrawn_by = auth.uid(),
         withdrawn_reason = nullif(public.portal_growth_text(p_reason, 300, false), '')
   where id = p_report_id and status = 'published'
  returning * into v_out;
  if not found then
    raise exception '이미 내렸거나 정정한 보고서입니다 — 새로 불러온 뒤 다시 해 주세요.' using errcode = '40001';
  end if;
  return jsonb_build_object('id', v_out.id, 'status', v_out.status, 'withdrawn_at', v_out.withdrawn_at);
end;
$$;
revoke all on function public.portal_withdraw_report(uuid, text) from public, anon;
grant execute on function public.portal_withdraw_report(uuid, text) to authenticated;

-- 내부: 고객이 보는 보고서 목록 그대로(미리보기 — 아무것도 기록하지 않는다)
create or replace function public.portal_preview_reports(p_workspace_id uuid, p_client_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_workspace_id is null
     or not public.is_workspace_member(p_workspace_id) or not public.view_consent_ok(p_workspace_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  return coalesce((
    select jsonb_agg(public.portal_report_item(r.id, null, null, false) order by r.published_at desc)
    from public.portal_reports r
    where r.workspace_id = p_workspace_id and r.operations_client_id = p_client_id and r.status = 'published'
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.portal_preview_reports(uuid, text) from public, anon;
grant execute on function public.portal_preview_reports(uuid, text) to authenticated;

-- 내부: 보고서 한 편을 고객이 보는 모양 그대로(미리보기 — 기록 0)
create or replace function public.portal_preview_report(p_report_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.portal_reports where id = p_report_id;
  if v_ws is null or auth.uid() is null or not public.is_workspace_member(v_ws) or not public.view_consent_ok(v_ws) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  return public.portal_report_item(p_report_id, null, null, true);
end;
$$;
revoke all on function public.portal_preview_report(uuid) from public, anon;
grant execute on function public.portal_preview_report(uuid) to authenticated;

-- 내부: 이 업체에 연결된 고객 계정의 이메일 — 계정마다 '열어 봄 · 확인' 을 이름으로 보이게.
-- 직원은 고객 프로필 표를 못 읽는다(RLS 그대로). 여기서는 그 작업공간 · 그 업체에 연결된 계정만 · 이메일 한 칸만 돌려준다.
create or replace function public.portal_link_accounts(p_workspace_id uuid, p_client_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_workspace_id is null
     or not public.is_workspace_member(p_workspace_id) or not public.view_consent_ok(p_workspace_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('link_id', l.id, 'email', p.email) order by l.linked_at)
    from public.portal_client_links l
    join public.profiles p on p.id = l.profile_id
    where l.workspace_id = p_workspace_id and l.operations_client_id = p_client_id
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.portal_link_accounts(uuid, text) from public, anon;
grant execute on function public.portal_link_accounts(uuid, text) to authenticated;

-- (묶음: 맨 아래에서 한 번에 commit)

-- 확인(바꾸지 않음): 표 2 · 고객 함수 6 · 내부 함수 5
select 'portal_reports' as what, (to_regclass('public.portal_reports') is not null) as ok
union all select 'portal_receipts', (to_regclass('public.portal_receipts') is not null)
union all select 'portal_publish_report', (to_regproc('public.portal_publish_report') is not null);

-- ───────────────────────────── 0034 공유 서류 · 결과 글 열람 기록(D-685) ─────────────────────────────
-- 20261128000034_result_receipts.sql
--
-- 고객성장관리 P1-3(D-685) — 내부에서 공유한 결과 자료를 고객이 열어 봤는지 계정마다 서버에 남긴다.
--   · '공유 서류'(portal_documents · visibility = shared_with_customer · 파일 있음) — 고객이 [열기] 로 파일을 연 때
--   · '결과 글'(portal_updates · category = result · status = published) — 고객 화면 '결과' 탭에서 그 글이 보인 때
-- 0033 의 열람 표(portal_receipts)를 그대로 쓴다 — 종류(item_kind)에 'document' · 'result' 를 더할 뿐.
--
-- 원칙(0033 그대로)
--   · 고객은 표를 직접 읽지도 쓰지도 못한다. 아래 함수 하나로만 기록 — auth.uid() 가 그 연결(활성)의 고객일 때만 · 그 연결에 보이는 자료만.
--   · 직원은 기록을 만들 수도 고칠 수도 없다(그 연결의 고객이 아니면 'not found'). 내부 미리보기 · 고객 화면 보기는 이 함수를 부르지 않는다.
--   · 1분 안에 다시 불러도 횟수는 그대로. 열어 봤다는 표시일 뿐 — 검수 · 승인이 아니다.
--   · 이 기능을 넣은 때를 남긴다(portal_result_receipts_since) — 그 전에 공유한 자료는 '안 열어 봄' 으로 세지 않는다(기록이 없던 때라 모른다).
--
-- 바꾸는 것: portal_receipts 의 종류 검사를 넓힘(home · report → home · report · document · result — 예전 줄은 모두 그대로 맞는다) · 함수 2.
-- 표 · 열 · 정책 삭제 없음. 여러 번 실행해도 같다(넣은 때는 처음 넣은 때 그대로).
-- 먼저 있어야 하는 것: 0033 (없으면 멈춘다).
-- 되돌리기: supabase/manual/rollback_0034.sql · 확인: supabase/manual/verify_after_0034.sql

-- (묶음: 거래는 맨 위 begin 하나)

do $$
begin
  if to_regclass('public.portal_receipts') is null
     or to_regproc('public.portal_link_owned') is null
     or to_regproc('public.portal_mark_report_seen') is null then
    raise exception '0034 는 0033 을 넣은 뒤에 넣습니다(먼저 넣을 것이 빠졌습니다).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. 열람 종류 넓히기 — 한 문장(지우고 다시 거는 사이가 없다). 예전 줄(home · report)은 그대로 맞는다.
-- ---------------------------------------------------------------------
alter table public.portal_receipts
  drop constraint if exists portal_receipts_item_kind_check,
  add constraint portal_receipts_item_kind_check check (item_kind in ('home', 'report', 'document', 'result'));

comment on table public.portal_receipts is
  '고객 계정이 고객 화면을 처음 · 최근에 연 때 · 보고서 · 공유 서류 · 결과 글을 열어 본 때 · 보고서를 확인한 때. 서버 함수만 쓴다(직원 · 고객 모두 표에 직접 쓰지 못한다). 확인은 계약 검수가 아니다.';

-- ---------------------------------------------------------------------
-- 2. 이 기능을 넣은 때 — 처음 넣을 때 한 번만 만든다(다시 실행해도 그 때 그대로)
-- ---------------------------------------------------------------------
do $$
begin
  if to_regproc('public.portal_result_receipts_since') is null then
    execute format(
      'create function public.portal_result_receipts_since() returns timestamptz language sql immutable as $f$ select %L::timestamptz $f$',
      now()
    );
  end if;
end $$;
comment on function public.portal_result_receipts_since() is
  '공유 서류 · 결과 글 열람 기록을 남기기 시작한 때(0034 를 처음 넣은 때). 그 전에 공유한 자료는 안 열어 봄으로 세지 않는다.';
revoke all on function public.portal_result_receipts_since() from public, anon;
grant execute on function public.portal_result_receipts_since() to authenticated;

-- ---------------------------------------------------------------------
-- 3. 고객: 공유 서류를 열었다 · 결과 글이 보였다
-- ---------------------------------------------------------------------
create or replace function public.portal_mark_item_seen(p_link_id uuid, p_kind text, p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws     uuid;
  v_client text;
  v_ok     boolean := false;
  v_out    jsonb;
begin
  if p_kind is null or p_kind not in ('document', 'result') then
    raise exception 'bad kind' using errcode = '22023';
  end if;
  if not public.portal_link_owned(p_link_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  select workspace_id, operations_client_id into v_ws, v_client from public.portal_client_links where id = p_link_id;
  if p_kind = 'document' then
    select true into v_ok from public.portal_documents d
     where d.id = p_item_id and d.portal_client_link_id = p_link_id and d.workspace_id = v_ws
       and d.visibility = 'shared_with_customer' and coalesce(d.storage_path, '') <> '';
  else
    select true into v_ok from public.portal_updates u
     where u.id = p_item_id and u.portal_client_link_id = p_link_id and u.workspace_id = v_ws
       and u.category = 'result' and u.status = 'published';
  end if;
  if not coalesce(v_ok, false) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.portal_receipts (workspace_id, operations_client_id, portal_client_link_id, profile_id, item_kind, item_id, item_version)
  values (v_ws, v_client, p_link_id, auth.uid(), p_kind, p_item_id, 1)
  on conflict (portal_client_link_id, profile_id, item_kind, item_id, item_version) do update
    set last_seen_at = now(), seen_count = public.portal_receipts.seen_count + 1
    where public.portal_receipts.last_seen_at < now() - interval '1 minute';
  select jsonb_build_object('seen_at', first_seen_at) into v_out
    from public.portal_receipts
   where portal_client_link_id = p_link_id and profile_id = auth.uid() and item_kind = p_kind and item_id = p_item_id and item_version = 1;
  return v_out;
end;
$$;
comment on function public.portal_mark_item_seen(uuid, text, uuid) is
  '고객: 공유 서류를 열었다(document) · 결과 글이 보였다(result). 그 연결(활성)의 고객 · 그 연결에 보이는 자료만. 1분 안 반복은 횟수 그대로.';
revoke all on function public.portal_mark_item_seen(uuid, text, uuid) from public, anon;
grant execute on function public.portal_mark_item_seen(uuid, text, uuid) to authenticated;

-- (묶음: 맨 아래에서 한 번에 commit)

-- 내부 함수 0 · 고객 함수 1 · 넣은 때 1(읽기만). 직원은 0033 의 읽기 정책(같은 작업공간 · 0026 허락 문)으로 표를 읽는다.

-- ───────────────────────────── 0035 고객 화면 '새 결과 자료'(D-686) ─────────────────────────────
-- 20261128000035_result_new.sql
--
-- 고객성장관리 P1-3b(D-686) — 고객 화면에 '새 결과 자료' 를 보여 준다(보고서의 '새 보고서' 와 같은 뜻).
--   · 새 결과 자료 = 내 연결(활성)에 공유한 서류(파일 있음) · 발행한 결과 글 가운데, 기록을 남기기 시작한 뒤(0034 넣은 때) 공유했고 이 계정이 아직 안 연 것.
--   · 계정마다 따로 — 같은 회사 다른 계정이 열어도 내 화면에서는 '새' 그대로(보고서와 같은 원칙).
--   · 기록을 남기기 전에 공유한 자료는 '새' 로 세지 않는다(그때 열었는지 모른다 — 넣는 순간 예전 자료가 한꺼번에 '새' 가 되지 않게).
--
-- 함수 2(고객용 · 읽기만 — 아무것도 기록하지 않는다). 표 · 열 · 정책 · 예전 함수 변경 없음. 여러 번 실행해도 같다.
-- 먼저 있어야 하는 것: 0034 (없으면 멈춘다).
-- 되돌리기: supabase/manual/rollback_0035.sql · 확인: supabase/manual/verify_after_0035.sql

-- (묶음: 거래는 맨 위 begin 하나)

do $$
begin
  if to_regproc('public.portal_mark_item_seen') is null
     or to_regproc('public.portal_result_receipts_since') is null
     or to_regproc('public.portal_link_owned') is null then
    raise exception '0035 는 0034 를 넣은 뒤에 넣습니다(먼저 넣을 것이 빠졌습니다).';
  end if;
end $$;

-- 고객: 이 연결의 결과 자료마다 새 것인지 · 내가 연 때(서버가 고른 칸만 — 제목 · 파일 이름 · 경로는 기존 투영 함수에서)
create or replace function public.portal_results_state(p_link_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz := public.portal_result_receipts_since();
begin
  if not public.portal_link_owned(p_link_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('kind', x.kind, 'id', x.id, 'seen_at', x.seen_at, 'is_new', x.seen_at is null and x.shared_at >= v_since) order by x.shared_at desc)
      from (
        select 'document'::text as kind, d.id, d.created_at as shared_at,
               (select min(rc.first_seen_at) from public.portal_receipts rc
                 where rc.portal_client_link_id = p_link_id and rc.profile_id = auth.uid() and rc.item_kind = 'document' and rc.item_id = d.id) as seen_at
          from public.portal_documents d
         where d.portal_client_link_id = p_link_id and d.visibility = 'shared_with_customer' and coalesce(d.storage_path, '') <> ''
        union all
        select 'result'::text, u.id, u.published_at,
               (select min(rc.first_seen_at) from public.portal_receipts rc
                 where rc.portal_client_link_id = p_link_id and rc.profile_id = auth.uid() and rc.item_kind = 'result' and rc.item_id = u.id)
          from public.portal_updates u
         where u.portal_client_link_id = p_link_id and u.category = 'result' and u.status = 'published' and u.published_at is not null
      ) x
  ), '[]'::jsonb);
end;
$$;
comment on function public.portal_results_state(uuid) is
  '고객: 이 연결(활성 · 내 것)의 공유 서류 · 결과 글마다 {kind, id, seen_at, is_new}. 읽기만(기록 0). 기록을 남기기 전에 공유한 것은 is_new = false.';
revoke all on function public.portal_results_state(uuid) from public, anon;
grant execute on function public.portal_results_state(uuid) to authenticated;

-- 고객: 내 활성 연결마다 새 결과 자료 수(성장 홈 '지금 할 일' · 프로젝트 카드)
create or replace function public.portal_result_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select l.id from public.portal_client_links l where l.profile_id = auth.uid() and l.status = 'active'
  ), items as (
    select d.portal_client_link_id as link_id, 'document'::text as kind, d.id, d.created_at as shared_at
      from public.portal_documents d join mine on mine.id = d.portal_client_link_id
     where d.visibility = 'shared_with_customer' and coalesce(d.storage_path, '') <> ''
    union all
    select u.portal_client_link_id, 'result', u.id, u.published_at
      from public.portal_updates u join mine on mine.id = u.portal_client_link_id
     where u.category = 'result' and u.status = 'published' and u.published_at is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object('link_id', m.id, 'results_new', (
           select count(*) from items i
            where i.link_id = m.id and i.shared_at >= public.portal_result_receipts_since()
              and not exists (select 1 from public.portal_receipts rc
                               where rc.portal_client_link_id = m.id and rc.profile_id = auth.uid() and rc.item_kind = i.kind and rc.item_id = i.id)
         )) order by m.id), '[]'::jsonb)
    from mine m;
$$;
comment on function public.portal_result_summary() is
  '고객: 내 활성 연결마다 {link_id, results_new} — 기록을 남기기 시작한 뒤 공유했고 이 계정이 아직 안 연 공유 서류 · 결과 글 수. 읽기만.';
revoke all on function public.portal_result_summary() from public, anon;
grant execute on function public.portal_result_summary() to authenticated;

-- (묶음: 맨 아래에서 한 번에 commit)

-- 고객 함수 2(읽기만) · 내부 함수 0.

-- ───────────────────────────── 0036 고객 화면 '담당자가 추천해요'(D-689) ─────────────────────────────
-- 20261128000036_recommendations.sql
--
-- 고객성장관리 P1-4(D-689 · 대표 2026-11-28 '담당자가 고른 것만') — 고객 화면(My MIRAE)에 맞는 지원사업 · 다음 성장 과제 추천.
--   · 담당자가 고른 것만 고객에게 보인다(저절로 나가는 것 0). 업체마다 3개까지 · 내리면 바로 빠진다(지우지 않는다).
--   · 고객이 보는 칸: 종류(지원사업 · 다음 과제) · 제목 · 근거 한 줄 · 마감일 · 공고 주소 · 올린 때 · 내가 [관심 있어요] 누른 때.
--     내부 출처(어느 공고 · 어느 판정에서 왔는지) · 올린 사람은 고객 투영에 없다.
--   · [관심 있어요] 는 고객 계정마다 한 번(다시 눌러도 처음 때 그대로) — 직원은 만들 수도 고칠 수도 없다. 계약 · 신청이 아니다.
--   · 0033 원칙 그대로: 고객은 표를 직접 읽지 못한다(아래 portal_* 함수로만) · 직원은 같은 작업공간이면 읽기만 · 쓰기는 함수만.
--   · 0023(작업공간 고정) · 0026(허락 동안만 — 대표가 팀장 작업공간을 볼 때) 장치를 새 표에도 똑같이 단다.
--
-- 표 2 · 고객 함수 2 · 내부 함수 2 · 지킴 함수 1(트리거). 예전 표 · 열 · 정책 · 함수 변경 없음. 여러 번 실행해도 같다.
-- 먼저 있어야 하는 것: 0033 (없으면 멈춘다 — 0034 · 0035 와는 상관없다).
-- 되돌리기: supabase/manual/rollback_0036.sql · 확인: supabase/manual/verify_after_0036.sql

-- (묶음: 거래는 맨 위 begin 하나)

do $$
begin
  if to_regproc('public.portal_growth_text') is null
     or to_regproc('public.portal_link_owned') is null
     or to_regproc('public.can_write_workspace') is null
     or to_regproc('public.workspace_id_lock') is null
     or to_regproc('public.view_consent_ok') is null
     or to_regproc('public.view_consent_blocked_workspaces') is null then
    raise exception '0036 은 0033 을 넣은 뒤에 넣습니다(먼저 넣을 것이 빠졌습니다).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. portal_recommendations — 담당자가 고객 화면에 올린 추천(업체 단위 · 내리면 withdrawn)
-- ---------------------------------------------------------------------
create table if not exists public.portal_recommendations (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  operations_client_id text not null references public.operations_clients (id) on delete cascade,
  kind                 text not null check (kind in ('grant', 'task')),
  title                text not null check (char_length(btrim(title)) between 1 and 80),
  reason               text not null default '' check (char_length(reason) <= 160),
  deadline             date,
  link_url             text check (link_url is null or (char_length(link_url) <= 500 and link_url ~* '^https?://[^[:space:]<>"]+$')),
  -- 내부 감사용 — 어느 공고 · 어느 판정에서 왔는지({type, id} · 고객 투영에 없다)
  source_ref           jsonb not null default '{}'::jsonb check (jsonb_typeof(source_ref) = 'object'),
  -- 올리기 번호(화면이 만든다) — 두 번 눌러도 · 다시 보내도 한 건
  client_key           text not null check (char_length(client_key) between 8 and 80),
  status               text not null default 'shown' check (status in ('shown', 'withdrawn')),
  shown_by             uuid references auth.users (id) on delete set null,
  shown_at             timestamptz not null default now(),
  withdrawn_at         timestamptz,
  withdrawn_by         uuid references auth.users (id) on delete set null,
  unique (workspace_id, client_key)
);
comment on table public.portal_recommendations is
  '담당자가 고객 화면(My MIRAE)에 올린 추천(지원사업 · 다음 과제). 업체 단위 · 3개까지 · 내리면 withdrawn(지우지 않는다). 고객은 portal_* 함수로만 본다.';
create index if not exists portal_recommendations_client_idx on public.portal_recommendations (workspace_id, operations_client_id, status, shown_at desc);

-- ---------------------------------------------------------------------
-- 2. portal_recommendation_interest — 고객 계정마다 [관심 있어요] 누른 때(직원은 쓸 수 없다)
-- ---------------------------------------------------------------------
create table if not exists public.portal_recommendation_interest (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  operations_client_id  text not null references public.operations_clients (id) on delete cascade,
  portal_client_link_id uuid not null references public.portal_client_links (id) on delete cascade,
  profile_id            uuid not null references public.profiles (id) on delete cascade,
  recommendation_id     uuid not null references public.portal_recommendations (id) on delete cascade,
  interested_at         timestamptz not null default now(),
  unique (recommendation_id, profile_id)
);
comment on table public.portal_recommendation_interest is
  '고객 계정이 추천에 [관심 있어요] 를 누른 때(계정마다 한 번). 서버 함수만 쓴다. 신청 · 계약이 아니다 — 담당자가 연락할 신호.';
create index if not exists portal_recommendation_interest_client_idx on public.portal_recommendation_interest (workspace_id, operations_client_id, interested_at desc);

-- ---------------------------------------------------------------------
-- 3. 같은 작업공간 지킴 — 업체 · 연결 · 추천이 그 작업공간 · 그 업체 것이어야 한다
-- ---------------------------------------------------------------------
create or replace function public.portal_reco_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.operations_clients c where c.id = new.operations_client_id and c.workspace_id = new.workspace_id) then
    raise exception '다른 워크스페이스의 업체에는 넣을 수 없습니다.' using errcode = '42501';
  end if;
  if tg_table_name = 'portal_recommendation_interest' then
    if not exists (
      select 1 from public.portal_client_links l
      where l.id = new.portal_client_link_id and l.workspace_id = new.workspace_id
        and l.operations_client_id = new.operations_client_id and l.profile_id = new.profile_id
    ) or not exists (
      select 1 from public.portal_recommendations r
      where r.id = new.recommendation_id and r.workspace_id = new.workspace_id and r.operations_client_id = new.operations_client_id
    ) then
      raise exception '그 연결의 고객 기록이 아닙니다.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.portal_reco_guard() from public, anon, authenticated;

drop trigger if exists zz_portal_recommendations_same_workspace on public.portal_recommendations;
create trigger zz_portal_recommendations_same_workspace
  before insert or update of workspace_id, operations_client_id on public.portal_recommendations
  for each row execute function public.portal_reco_guard();

drop trigger if exists zz_portal_reco_interest_same_workspace on public.portal_recommendation_interest;
create trigger zz_portal_reco_interest_same_workspace
  before insert or update of workspace_id, operations_client_id, portal_client_link_id, profile_id, recommendation_id on public.portal_recommendation_interest
  for each row execute function public.portal_reco_guard();

-- 0023 작업공간 고정
drop trigger if exists zz_workspace_id_lock on public.portal_recommendations;
create trigger zz_workspace_id_lock before update of workspace_id on public.portal_recommendations
  for each row execute function public.workspace_id_lock();
drop trigger if exists zz_workspace_id_lock on public.portal_recommendation_interest;
create trigger zz_workspace_id_lock before update of workspace_id on public.portal_recommendation_interest
  for each row execute function public.workspace_id_lock();

-- ---------------------------------------------------------------------
-- 4. 권한 — 앱 계정은 읽기(작업공간 구성원)만 · 쓰기는 아래 함수만 · anon 0
-- ---------------------------------------------------------------------
alter table public.portal_recommendations enable row level security;
alter table public.portal_recommendation_interest enable row level security;
revoke all on public.portal_recommendations from anon, authenticated;
revoke all on public.portal_recommendation_interest from anon, authenticated;
grant select on public.portal_recommendations to authenticated;
grant select on public.portal_recommendation_interest to authenticated;

drop policy if exists "Workspace members can read portal recommendations" on public.portal_recommendations;
create policy "Workspace members can read portal recommendations"
  on public.portal_recommendations for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can read portal recommendation interest" on public.portal_recommendation_interest;
create policy "Workspace members can read portal recommendation interest"
  on public.portal_recommendation_interest for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- 0026 허락 문(대표가 팀장 작업공간을 볼 때) — 다른 고객 자료 표와 같은 문
drop policy if exists "zz View consent gate" on public.portal_recommendations;
create policy "zz View consent gate"
  on public.portal_recommendations as restrictive for all to authenticated
  using (not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[])))
  with check (not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[])));
drop policy if exists "zz View consent gate" on public.portal_recommendation_interest;
create policy "zz View consent gate"
  on public.portal_recommendation_interest as restrictive for all to authenticated
  using (not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[])))
  with check (not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[])));

-- ---------------------------------------------------------------------
-- 5. 고객 함수 — auth.uid() 가 가진 활성 연결에서만 · 남의 것은 'not found'
-- ---------------------------------------------------------------------

-- 고객: 이 연결(업체)에 올라온 추천 — 서버가 고른 칸만(내부 출처 · 올린 사람 0) + 내가 [관심 있어요] 누른 때
create or replace function public.portal_recommendations(p_link_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ws     uuid;
  v_client text;
begin
  if not public.portal_link_owned(p_link_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  select workspace_id, operations_client_id into v_ws, v_client from public.portal_client_links where id = p_link_id;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', r.id,
             'kind', r.kind,
             'title', r.title,
             'reason', r.reason,
             'deadline', r.deadline,
             'link_url', r.link_url,
             'shown_at', r.shown_at,
             'interested_at', (select i.interested_at from public.portal_recommendation_interest i
                                where i.recommendation_id = r.id and i.profile_id = auth.uid())
           ) order by r.shown_at desc)
      from public.portal_recommendations r
     where r.workspace_id = v_ws and r.operations_client_id = v_client and r.status = 'shown'
  ), '[]'::jsonb);
end;
$$;
comment on function public.portal_recommendations(uuid) is
  '고객: 이 연결(활성 · 내 것)의 업체에 담당자가 올린 추천 {id, kind, title, reason, deadline, link_url, shown_at, interested_at}. 읽기만.';
revoke all on function public.portal_recommendations(uuid) from public, anon;
grant execute on function public.portal_recommendations(uuid) to authenticated;

-- 고객: [관심 있어요] — 계정마다 한 번(다시 눌러도 처음 때 그대로). 신청 · 계약이 아니다.
create or replace function public.portal_recommendation_interest(p_link_id uuid, p_rec_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws     uuid;
  v_client text;
  v_at     timestamptz;
begin
  if not public.portal_link_owned(p_link_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  select workspace_id, operations_client_id into v_ws, v_client from public.portal_client_links where id = p_link_id;
  if not exists (
    select 1 from public.portal_recommendations r
     where r.id = p_rec_id and r.workspace_id = v_ws and r.operations_client_id = v_client and r.status = 'shown'
  ) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.portal_recommendation_interest (workspace_id, operations_client_id, portal_client_link_id, profile_id, recommendation_id)
  values (v_ws, v_client, p_link_id, auth.uid(), p_rec_id)
  on conflict (recommendation_id, profile_id) do nothing;
  select interested_at into v_at from public.portal_recommendation_interest where recommendation_id = p_rec_id and profile_id = auth.uid();
  return jsonb_build_object('interested_at', v_at);
end;
$$;
comment on function public.portal_recommendation_interest(uuid, uuid) is
  '고객: 추천에 [관심 있어요] — 그 연결(활성)의 고객 · 지금 올라와 있는 추천만 · 계정마다 한 번.';
revoke all on function public.portal_recommendation_interest(uuid, uuid) from public, anon;
grant execute on function public.portal_recommendation_interest(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. 내부 함수 — 그 작업공간에 쓸 수 있는 사람만 · 0026 허락 문 그대로
-- ---------------------------------------------------------------------

-- 내부: 고객 화면에 추천 올리기. 한 거래 — 올리기 번호가 같으면 처음 것 · 같은 출처가 이미 올라와 있으면 그것을 돌려준다.
create or replace function public.portal_show_recommendation(
  p_workspace_id uuid,
  p_client_id    text,
  p_client_key   text,
  p_kind         text,
  p_title        text,
  p_reason       text default '',
  p_deadline     date default null,
  p_link_url     text default null,
  p_source_ref   jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.portal_recommendations;
  v_id       uuid;
  v_title    text;
  v_reason   text;
  v_url      text;
  v_ref      jsonb := '{}'::jsonb;
begin
  if auth.uid() is null or p_workspace_id is null
     or not public.can_write_workspace(p_workspace_id) or not public.view_consent_ok(p_workspace_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.operations_clients c where c.id = p_client_id and c.workspace_id = p_workspace_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if p_client_key is null or char_length(p_client_key) not between 8 and 80 then
    raise exception '올리기 번호가 틀렸습니다.' using errcode = '22023';
  end if;

  -- 같은 업체에 두 사람이 동시에 올려도 3개를 넘지 않게 — 그 업체 하나만 잠근다(거래 끝에 풀린다)
  perform pg_advisory_xact_lock(hashtextextended('portal_reco:' || p_workspace_id::text || ':' || p_client_id, 0));

  -- 같은 올리기 번호 = 이미 한 것(두 번 눌림 · 다시 보냄)
  select * into v_existing from public.portal_recommendations where workspace_id = p_workspace_id and client_key = p_client_key;
  if found then
    if v_existing.operations_client_id <> p_client_id then
      raise exception '올리기 번호가 다른 업체 것과 겹칩니다.' using errcode = '22023';
    end if;
    return jsonb_build_object('id', v_existing.id, 'status', v_existing.status, 'created', false);
  end if;

  if p_kind is null or p_kind not in ('grant', 'task') then
    raise exception '추천 종류가 틀렸습니다.' using errcode = '22023';
  end if;
  v_title := public.portal_growth_text(p_title, 80, false);
  if v_title = '' then
    raise exception '추천 제목을 적어 주세요.' using errcode = '22023';
  end if;
  v_reason := public.portal_growth_text(p_reason, 160, false);
  v_url := nullif(btrim(coalesce(p_link_url, '')), '');
  if v_url is not null and (char_length(v_url) > 500 or v_url !~* '^https?://[^[:space:]<>"]+$') then
    raise exception '주소는 http:// 나 https:// 로 시작해야 합니다.' using errcode = '22023';
  end if;
  -- 내부 출처는 type · id 두 칸만 다시 만든다(모르는 칸은 버린다)
  if p_source_ref is not null and jsonb_typeof(p_source_ref) = 'object'
     and jsonb_typeof(p_source_ref -> 'type') = 'string' and jsonb_typeof(p_source_ref -> 'id') = 'string'
     and char_length(p_source_ref ->> 'type') between 1 and 20 and char_length(p_source_ref ->> 'id') between 1 and 120 then
    v_ref := jsonb_build_object('type', p_source_ref ->> 'type', 'id', p_source_ref ->> 'id');
  end if;

  -- 같은 출처(같은 공고 · 같은 판정)가 이미 올라와 있으면 그것을 돌려준다(겹쳐 올리지 않는다)
  if v_ref <> '{}'::jsonb then
    select * into v_existing from public.portal_recommendations
     where workspace_id = p_workspace_id and operations_client_id = p_client_id and status = 'shown' and source_ref = v_ref
     limit 1;
    if found then
      return jsonb_build_object('id', v_existing.id, 'status', v_existing.status, 'created', false);
    end if;
  end if;

  if (select count(*) from public.portal_recommendations
       where workspace_id = p_workspace_id and operations_client_id = p_client_id and status = 'shown') >= 3 then
    raise exception '고객 화면에는 추천을 3개까지 올려요 — 하나를 내린 뒤 올려 주세요.' using errcode = '22023';
  end if;

  insert into public.portal_recommendations (workspace_id, operations_client_id, kind, title, reason, deadline, link_url, source_ref, client_key, shown_by)
  values (p_workspace_id, p_client_id, p_kind, v_title, v_reason, p_deadline, v_url, v_ref, p_client_key, auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', 'shown', 'created', true);
end;
$$;
revoke all on function public.portal_show_recommendation(uuid, text, text, text, text, text, date, text, jsonb) from public, anon;
grant execute on function public.portal_show_recommendation(uuid, text, text, text, text, text, date, text, jsonb) to authenticated;

-- 내부: 추천 내리기(지우지 않는다 · 고객 화면에서 바로 빠진다 · [관심 있어요] 기록은 남는다)
create or replace function public.portal_withdraw_recommendation(p_rec_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws  uuid;
  v_out public.portal_recommendations;
begin
  select workspace_id into v_ws from public.portal_recommendations where id = p_rec_id;
  if v_ws is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if auth.uid() is null or not public.can_write_workspace(v_ws) or not public.view_consent_ok(v_ws) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.portal_recommendations
     set status = 'withdrawn', withdrawn_at = now(), withdrawn_by = auth.uid()
   where id = p_rec_id and status = 'shown'
  returning * into v_out;
  if not found then
    raise exception '이미 내린 추천입니다 — 새로 불러온 뒤 다시 해 주세요.' using errcode = '40001';
  end if;
  return jsonb_build_object('id', v_out.id, 'status', v_out.status, 'withdrawn_at', v_out.withdrawn_at);
end;
$$;
revoke all on function public.portal_withdraw_recommendation(uuid) from public, anon;
grant execute on function public.portal_withdraw_recommendation(uuid) to authenticated;

-- (묶음: 맨 아래에서 한 번에 commit)

-- 표 2 · 고객 함수 2 · 내부 함수 2. 직원은 두 표를 같은 작업공간이면 읽는다(0026 허락 문 그대로).

commit;

-- 결과(바꾸지 않음) — 네 줄 모두 들어감 이면 끝
with fn(name) as (
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
), part(no, what, ok) as (
  values
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', to_regclass('public.portal_reports') is not null),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', to_regclass('public.portal_receipts') is not null),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_growth_guard')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_growth_text')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_growth_clean_sections')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_growth_clean_refs')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_report_item')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_reports')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_report')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_mark_report_seen')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_acknowledge_report')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_mark_home')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_growth_summary')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_publish_report')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_withdraw_report')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_preview_reports')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_preview_report')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_link_accounts')),
  ('0034', '공유 서류 · 결과 글 열람 기록(D-685)', exists (select 1 from fn where name = 'portal_mark_item_seen')),
  ('0035', '고객 화면 ''새 결과 자료''(D-686)', exists (select 1 from fn where name = 'portal_results_state')),
  ('0035', '고객 화면 ''새 결과 자료''(D-686)', exists (select 1 from fn where name = 'portal_result_summary')),
  ('0036', '고객 화면 ''담당자가 추천해요''(D-689)', to_regclass('public.portal_recommendations') is not null),
  ('0036', '고객 화면 ''담당자가 추천해요''(D-689)', to_regclass('public.portal_recommendation_interest') is not null),
  ('0036', '고객 화면 ''담당자가 추천해요''(D-689)', exists (select 1 from fn where name = 'portal_reco_guard')),
  ('0036', '고객 화면 ''담당자가 추천해요''(D-689)', exists (select 1 from fn where name = 'portal_recommendations')),
  ('0036', '고객 화면 ''담당자가 추천해요''(D-689)', exists (select 1 from fn where name = 'portal_recommendation_interest')),
  ('0036', '고객 화면 ''담당자가 추천해요''(D-689)', exists (select 1 from fn where name = 'portal_show_recommendation')),
  ('0036', '고객 화면 ''담당자가 추천해요''(D-689)', exists (select 1 from fn where name = 'portal_withdraw_recommendation'))
)
select no as 번호, what as 무엇, count(*) filter (where ok) || '/' || count(*) as 있는_것,
       case when bool_and(ok) then '들어감' when bool_or(ok) then '일부만' else '없음' end as 결과
from part group by no, what order by no;
