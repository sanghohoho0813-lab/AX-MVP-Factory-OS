-- =====================================================================
-- L-9 · D-609 고객(컨설턴트)마다 상담 신청 링크 — 글 끝에 붙이는 한 줄 주소
--
-- 지금: 로그인 없이 받는 상담 신청(지원사업 알림 등)은 대표 작업공간(default_intake_workspace)으로만 들어간다.
--       팀장 · 구독 고객은 자기 글을 보고 온 사람을 받을 주소가 없다(손으로 영업 관리에 적어야 했다).
-- 0027 뒤:
--   - 작업공간 주인은 [내 상담 신청 링크 만들기] 한 번 → https://…/ask/<12자리> 주소가 생긴다(작업공간마다 하나).
--   - 그 주소에서 누가 이름 · 연락처 · 하고 싶은 말을 적고 동의하면 → **그 작업공간의 잠재고객**(업체 기록 · 계약 전)으로 바로 들어간다.
--     유입 경로 = 고른 경로(스레드 · 인스타 · 유튜브 · 블로그) 또는 '상담 링크' · 다음 할 일 = '상담 신청 — 연락드리기'(오늘).
--   - 주인은 언제든 [주소 새로 만들기](예전 주소는 그 순간부터 안 받음) · [받지 않기].
--   - 공개 화면이 읽는 것은 제목 · 한 줄 소개뿐 — 작업공간 · 주인 이메일 · 업체 목록은 나가지 않는다.
--   - 막는 것: 동의 없음 · 연락처 없음 · 이상한 번호 · 한 곳(접속 주소)에서 10분 5번 · 같은 연락처는 링크마다 하루 한 번(다시 눌러도 '접수됨')
--     · 링크 하나에 10분 20번 · 하루 200번 · 전체 10분 300번 · 사용 승인이 없는(또는 끊긴) 주인의 링크 · 로봇이 채우는 숨은 칸.
--
-- 방법: 더하기만 — 표 1(public_intake_links) · 함수 6. 기존 표 · 열 · 정책 · 함수는 그대로. 여러 번 실행해도 같다.
--   앱은 표에 직접 쓰지 못한다(읽기도 작업공간 주인만) — 함수로만.
-- 선행: 0017(public_intake_log · hash_access_token) · 0019(os_access).
-- 되돌리기: supabase/manual/rollback_0027.sql — 함수 실행 권한만 거둔다(링크 · 이미 들어온 잠재고객은 그대로 · 공개 주소는 '지금 받지 않아요').
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.public_intake_log') is null or to_regprocedure('public.hash_access_token(text)') is null
     or to_regclass('public.os_access') is null then
    raise exception '0017 · 0019 를 먼저 실행하세요. 0027 은 아무것도 바꾸지 않았습니다.';
  end if;
end $$;

-- 1) 상담 신청 링크 — 작업공간마다 열린 링크는 하나(닫은 링크는 기록으로 남김)
create table if not exists public.public_intake_links (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  slug             text not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  title            text not null default '',
  intro            text not null default '',
  created_by       uuid,
  created_at       timestamptz not null default now(),
  revoked_at       timestamptz,
  received_count   integer not null default 0,
  last_received_at timestamptz
);
comment on table public.public_intake_links is
  'L-9 작업공간마다 상담 신청 링크(/ask/<slug>). 앱은 함수(intake_link_*)로만 쓴다 — 표에 직접 쓰기 0. 읽기는 작업공간 주인만. 닫은 링크는 지우지 않고 revoked_at 만 적는다.';
create unique index if not exists public_intake_links_slug_idx on public.public_intake_links (slug);
create unique index if not exists public_intake_links_one_open_idx on public.public_intake_links (workspace_id) where revoked_at is null;
alter table public.public_intake_links enable row level security;
revoke all on public.public_intake_links from public, anon, authenticated;
grant select on public.public_intake_links to authenticated;
drop policy if exists "Intake links: workspace owner can read" on public.public_intake_links;
create policy "Intake links: workspace owner can read"
  on public.public_intake_links for select to authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

-- workspace_id 는 한 번 정하면 못 바꾼다(0023 이 있으면 같은 장치)
do $$
begin
  if to_regprocedure('public.workspace_id_lock()') is not null then
    execute 'drop trigger if exists zz_workspace_id_lock on public.public_intake_links';
    execute 'create trigger zz_workspace_id_lock before update of workspace_id on public.public_intake_links for each row execute function public.workspace_id_lock()';
  end if;
end $$;

-- 2) 주인 화면 상태 — 주인이 아니면 {role:none}(앱은 아무것도 안 그림)
create or replace function public.intake_link_state(p_ws uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l public.public_intake_links%rowtype;
begin
  if auth.uid() is null or p_ws is null
     or not exists (select 1 from public.workspaces w where w.id = p_ws and w.owner_id = auth.uid())
     or public.my_os_access() is null then
    return jsonb_build_object('role', 'none');
  end if;
  select * into l from public.public_intake_links where workspace_id = p_ws and revoked_at is null;
  return jsonb_build_object(
    'role', 'owner',
    'link', case when l.id is null then null else jsonb_build_object(
      'slug', l.slug, 'title', l.title, 'intro', l.intro,
      'createdAt', l.created_at, 'received', l.received_count, 'lastAt', l.last_received_at) end,
    'closed', (select count(*) from public.public_intake_links where workspace_id = p_ws and revoked_at is not null)
  );
end;
$$;

-- 주인 확인(함수 안에서만 씀)
create or replace function public.intake_link_owner_check(p_ws uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_ws is null
     or not exists (select 1 from public.workspaces w where w.id = p_ws and w.owner_id = auth.uid()) then
    raise exception '내 작업공간에서만 상담 신청 링크를 만들 수 있어요.' using errcode = '42501';
  end if;
  if public.my_os_access() is null then
    raise exception '사용 승인 뒤에 만들 수 있어요.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.intake_link_owner_check(uuid) from public, anon, authenticated;

-- 3) 만들기 · 제목 고치기(열린 링크가 있으면 제목 · 소개만 고친다)
create or replace function public.intake_link_save(p_ws uuid, p_title text, p_intro text default '')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_title text := left(btrim(regexp_replace(coalesce(p_title, ''), '[\r\n\t]+', ' ', 'g')), 40);
  v_intro text := left(btrim(regexp_replace(coalesce(p_intro, ''), '[\r\n\t]+', ' ', 'g')), 80);
begin
  perform public.intake_link_owner_check(p_ws);
  if v_title = '' then v_title := '상담 신청'; end if;
  perform pg_advisory_xact_lock(hashtext('intake_link:' || p_ws::text));
  update public.public_intake_links set title = v_title, intro = v_intro
   where workspace_id = p_ws and revoked_at is null;
  if not found then
    insert into public.public_intake_links (workspace_id, title, intro, created_by)
    values (p_ws, v_title, v_intro, auth.uid());
  end if;
  return public.intake_link_state(p_ws);
end;
$$;

-- 4) 주소 새로 만들기 — 예전 주소는 그 순간부터 안 받는다(제목 · 소개는 그대로)
create or replace function public.intake_link_rotate(p_ws uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l public.public_intake_links%rowtype;
begin
  perform public.intake_link_owner_check(p_ws);
  perform pg_advisory_xact_lock(hashtext('intake_link:' || p_ws::text));
  select * into l from public.public_intake_links where workspace_id = p_ws and revoked_at is null;
  if l.id is null then
    raise exception '아직 만든 링크가 없어요.' using errcode = '22023';
  end if;
  update public.public_intake_links set revoked_at = now() where id = l.id;
  insert into public.public_intake_links (workspace_id, title, intro, created_by)
  values (p_ws, l.title, l.intro, auth.uid());
  return public.intake_link_state(p_ws);
end;
$$;

-- 5) 받지 않기 — 다시 받으려면 [만들기](새 주소)
create or replace function public.intake_link_off(p_ws uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.intake_link_owner_check(p_ws);
  update public.public_intake_links set revoked_at = now() where workspace_id = p_ws and revoked_at is null;
  return public.intake_link_state(p_ws);
end;
$$;

-- 6) 공개 화면 — 제목 · 한 줄 소개만. 없거나 닫힌 주소 · 승인이 끊긴 주인이면 null
create or replace function public.public_intake_form(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('title', l.title, 'intro', l.intro)
    from public.public_intake_links l
    join public.workspaces w on w.id = l.workspace_id
    join public.os_access a on a.user_id = w.owner_id
   where l.slug = lower(btrim(coalesce(p_slug, ''))) and l.revoked_at is null
   limit 1;
$$;

-- 7) 공개 신청 — 그 작업공간의 잠재고객으로. 'ok' | 'closed'(없거나 닫힌 주소)
create or replace function public.public_intake_submit(p_slug text, p_payload jsonb)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l         public.public_intake_links%rowtype;
  v_name    text;
  v_company text;
  v_phone   text;
  v_email   text;
  v_message text;
  v_source  text;
  v_ip      text;
  v_contact text;
  v_at      timestamptz := now();
  v_iso     text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or length(p_payload::text) > 4000 then
    raise exception 'invalid payload' using errcode = '22023';
  end if;
  select li.* into l
    from public.public_intake_links li
    join public.workspaces w on w.id = li.workspace_id
    join public.os_access a on a.user_id = w.owner_id
   where li.slug = lower(btrim(coalesce(p_slug, ''))) and li.revoked_at is null
   limit 1;
  if l.id is null then
    return 'closed';
  end if;
  if coalesce(p_payload->>'consent', 'false') <> 'true' then
    raise exception 'consent required' using errcode = '22023';
  end if;
  -- 사람 눈에 안 보이는 칸 — 채워져 있으면 로봇. 접수된 것처럼 답하고 아무것도 안 넣는다
  if btrim(coalesce(p_payload->>'website', '')) <> '' then
    return 'ok';
  end if;

  v_name    := left(btrim(regexp_replace(coalesce(p_payload->>'name', ''), '[\r\n\t]+', ' ', 'g')), 30);
  v_company := left(btrim(regexp_replace(coalesce(p_payload->>'company_name', ''), '[\r\n\t]+', ' ', 'g')), 60);
  v_phone   := left(btrim(coalesce(p_payload->>'phone', '')), 30);
  v_email   := left(btrim(coalesce(p_payload->>'email', '')), 80);
  v_message := left(btrim(coalesce(p_payload->>'message', '')), 500);
  v_source  := btrim(coalesce(p_payload->>'source', ''));
  if v_name = '' and v_company = '' then
    raise exception 'name required' using errcode = '22023';
  end if;
  if v_phone = '' and v_email = '' then
    raise exception 'contact required' using errcode = '22023';
  end if;
  if v_phone <> '' and v_phone !~ '^[0-9+() -]{8,20}$' then
    raise exception 'invalid phone' using errcode = '22023';
  end if;
  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if v_source not in ('스레드', '인스타', '유튜브', '블로그') then
    v_source := '상담 링크';
  end if;

  -- 전체 둑(10분 300번) — 넘쳐도 서버가 버티게
  if (select count(*) from public.public_intake_log g
       where g.kind = 'intake_link' and g.at > now() - interval '10 minutes') >= 300 then
    raise exception 'too many requests' using errcode = '54000';
  end if;
  -- 한 곳(접속 주소)에서 10분 5번 — 앞단(Cloudflare)이 넣는 cf-connecting-ip 먼저. 원문은 남기지 않고 해시만
  v_ip := btrim(split_part(coalesce(
            nullif(current_setting('request.headers', true), '')::jsonb ->> 'cf-connecting-ip',
            nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for',
            nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-real-ip', ''), ',', 1));
  if v_ip <> '' then
    if (select count(*) from public.public_intake_log g
         where g.kind = 'intake_link_ip' and g.key_hash = public.hash_access_token(v_ip)
           and g.at > now() - interval '10 minutes') >= 5 then
      raise exception 'too many requests' using errcode = '54000';
    end if;
    insert into public.public_intake_log (kind, key_hash) values ('intake_link_ip', public.hash_access_token(v_ip));
  end if;
  -- 링크 하나에 10분 20번 · 하루 200번 — 주소가 퍼져 장난이 와도 그 사람 고객 목록이 넘치지 않게
  if (select count(*) from public.public_intake_log g
       where g.kind = 'intake_link' and g.key_hash = public.hash_access_token(l.id::text)
         and g.at > now() - interval '10 minutes') >= 20
     or (select count(*) from public.public_intake_log g
       where g.kind = 'intake_link' and g.key_hash = public.hash_access_token(l.id::text)
         and g.at > now() - interval '1 day') >= 200 then
    raise exception 'too many requests' using errcode = '54000';
  end if;
  -- 같은 연락처는 링크마다 하루 한 번 — 다시 눌러도 '접수됨'(두 줄 안 생김)
  v_contact := l.id::text || '|' || lower(coalesce(nullif(regexp_replace(v_phone, '[^0-9]', '', 'g'), ''), v_email));
  if exists (select 1 from public.public_intake_log g
              where g.kind = 'intake_link_contact' and g.key_hash = public.hash_access_token(v_contact)
                and g.at > now() - interval '1 day') then
    return 'ok';
  end if;
  insert into public.public_intake_log (kind, key_hash) values ('intake_link_contact', public.hash_access_token(v_contact));
  insert into public.public_intake_log (kind, key_hash) values ('intake_link', public.hash_access_token(l.id::text));

  -- 잠재고객(업체 기록 · 계약 전) — 앱이 영업 관리에서 손으로 등록할 때와 같은 모양(status waiting · sales.stage lead)
  insert into public.operations_clients (id, workspace_id, company_name, status, next_action, next_action_due_date, payload)
  values (
    gen_random_uuid()::text,
    l.workspace_id,
    coalesce(nullif(v_company, ''), v_name),
    'waiting',
    '상담 신청 — 연락드리기',
    (v_at at time zone 'Asia/Seoul')::date,
    jsonb_build_object(
      'contactName', v_name,
      'contactPhone', v_phone,
      'contactEmail', v_email,
      'sales', jsonb_build_object(
        'stage', 'lead', 'source', v_source, 'referrer', '', 'interests', '[]'::jsonb,
        'concern', v_message, 'expectedFee', null,
        'history', jsonb_build_array(jsonb_build_object('at', v_iso, 'from', null, 'to', 'lead')),
        'movedAt', v_iso),
      'activity', jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid()::text, 'kind', 'sales',
        'text', '상담 신청 링크로 직접 신청 — 잠재고객 등록 · ' || v_source,
        'serviceKey', null, 'at', v_iso))
    )
  );
  update public.public_intake_links set received_count = received_count + 1, last_received_at = v_at where id = l.id;
  return 'ok';
end;
$$;

-- 권한: 주인 함수는 로그인한 사람만 · 공개 함수는 누구나(함수 안에서 막는다)
revoke all on function public.intake_link_state(uuid) from public, anon;
revoke all on function public.intake_link_save(uuid, text, text) from public, anon;
revoke all on function public.intake_link_rotate(uuid) from public, anon;
revoke all on function public.intake_link_off(uuid) from public, anon;
grant execute on function public.intake_link_state(uuid) to authenticated;
grant execute on function public.intake_link_save(uuid, text, text) to authenticated;
grant execute on function public.intake_link_rotate(uuid) to authenticated;
grant execute on function public.intake_link_off(uuid) to authenticated;
revoke all on function public.public_intake_form(text) from public;
revoke all on function public.public_intake_submit(text, jsonb) from public;
grant execute on function public.public_intake_form(text) to anon, authenticated;
grant execute on function public.public_intake_submit(text, jsonb) to anon, authenticated;

commit;
