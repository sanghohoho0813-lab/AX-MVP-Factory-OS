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

begin;

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

commit;

-- 표 2 · 고객 함수 2 · 내부 함수 2. 직원은 두 표를 같은 작업공간이면 읽는다(0026 허락 문 그대로).
