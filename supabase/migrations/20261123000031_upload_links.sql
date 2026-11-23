-- =====================================================================
-- L-41 · D-652 서류 올리기 링크 — 업체 대표가 로그인 없이 링크 하나로 서류를 올린다
--
-- 지금: 업체 대표에게 서류를 받으려면 카톡 · 메일로 파일을 받아 컨설턴트가 내려받고 → 서류함에 다시 올렸다(두 번 일 · 파일이 흩어짐).
-- 0031 뒤:
--   - 업체 서류함에서 [올리기 링크 만들기] → 받을 서류를 고르고 → https://…/up/<20자리> 주소가 생긴다(업체마다 열린 링크는 하나).
--   - 업체 대표는 휴대폰으로 열어 서류마다 [올리기] → 파일이 그 업체 보관함 폴더로 바로 들어간다(로그인 0 · 앱 설치 0).
--   - 컨설턴트 서류함에 '고객이 올린 서류 n' → [이 칸에 넣기] 한 번이면 그 칸이 '받음'(넣기 전에는 기록이 바뀌지 않는다).
--   - 막는 것: 기한(1~30일 · 기본 14일) · 닫은 링크 · 사용 승인이 끊긴 주인 · 고른 서류 밖 칸 · 형식(PDF · 사진 · 한글 · 워드 · 엑셀 · 파워포인트 · 글)
--     · 한 파일 20MB · 링크 하나에 80개 · 링크 하나 10분 40번 · 하루 150번 · 한 곳(접속 주소)에서 10분 40번 · 전체 10분 600번
--     · 보관함에는 서버가 정해 준 경로(예약 30분 안)에만 넣을 수 있다 — 다른 폴더 · 다른 업체 · 덮어쓰기 0.
--   - 공개 화면이 읽는 것: 업체 이름 · 받을 서류 이름 · 한 줄 안내 · 기한 · 서류마다 올린 개수뿐(작업공간 · 주인 · 다른 서류 · 파일 이름 0).
--
-- 방법: 더하기만 — 표 2(client_upload_links · client_upload_files) · 함수 13(앱이 부르는 9 · 안쪽 4) · 보관함 넣기 정책 1. 기존 표 · 열 · 정책 · 함수는 그대로. 여러 번 실행해도 같다.
--   앱은 표에 직접 쓰지 못한다(읽기도 그 작업공간에 쓸 수 있는 사람만) — 함수로만.
-- 선행: 0017(public_intake_log · hash_access_token) · 0019(os_access) · 0026(view_consent_ok).
-- 되돌리기: supabase/manual/rollback_0031.sql — 함수 실행 권한 · 보관함 넣기 정책만 거둔다(링크 · 받은 파일 기록 · 파일은 그대로 · 공개 주소는 '닫힘').
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.public_intake_log') is null or to_regprocedure('public.hash_access_token(text)') is null
     or to_regclass('public.os_access') is null or to_regprocedure('public.view_consent_ok(uuid)') is null then
    raise exception '0017 · 0019 · 0026 을 먼저 실행하세요. 0031 은 아무것도 바꾸지 않았습니다.';
  end if;
end $$;

-- 1) 올리기 링크 — 업체마다 열린 링크는 하나(닫은 링크는 기록으로 남김)
create table if not exists public.client_upload_links (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  client_id        text not null,
  slug             text not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 20),
  title            text not null default '',
  note             text not null default '',
  docs             jsonb not null default '[]'::jsonb,
  expires_at       timestamptz not null default now() + interval '14 days',
  created_by       uuid,
  created_at       timestamptz not null default now(),
  revoked_at       timestamptz,
  uploaded_count   integer not null default 0,
  last_uploaded_at timestamptz
);
comment on table public.client_upload_links is
  'L-41 업체마다 서류 올리기 링크(/up/<slug>). 앱은 함수(upload_link_*)로만 쓴다 — 표에 직접 쓰기 0. 닫은 링크는 지우지 않고 revoked_at 만 적는다.';
create unique index if not exists client_upload_links_slug_idx on public.client_upload_links (slug);
create unique index if not exists client_upload_links_one_open_idx on public.client_upload_links (workspace_id, client_id) where revoked_at is null;

-- 2) 링크로 받은 파일 — 예약(reserved) → 올림(uploaded) → 넣음(accepted) / 안 씀(dismissed)
create table if not exists public.client_upload_files (
  id           uuid primary key default gen_random_uuid(),
  link_id      uuid not null references public.client_upload_links (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id    text not null,
  doc_key      text not null default '',
  doc_label    text not null default '',
  file_name    text not null,
  file_size    bigint not null default 0,
  content_type text not null default '',
  storage_path text not null,
  status       text not null default 'reserved' check (status in ('reserved', 'uploaded', 'accepted', 'dismissed')),
  created_at   timestamptz not null default now(),
  uploaded_at  timestamptz,
  decided_at   timestamptz,
  decided_by   uuid
);
comment on table public.client_upload_files is
  'L-41 올리기 링크로 받은 파일. 공개 함수가 경로를 정해 예약하고, 올린 뒤 uploaded · 컨설턴트가 칸에 넣으면 accepted. 앱 쓰기는 함수로만.';
create unique index if not exists client_upload_files_path_idx on public.client_upload_files (storage_path);
create index if not exists client_upload_files_client_idx on public.client_upload_files (workspace_id, client_id, status);
create index if not exists client_upload_files_link_idx on public.client_upload_files (link_id, created_at desc);

-- 3) 읽기 — 그 작업공간에 쓸 수 있는 사람만(대표가 팀장 작업공간을 볼 때는 허락 동안만 — 0026). 쓰기는 함수로만.
alter table public.client_upload_links enable row level security;
alter table public.client_upload_files enable row level security;
revoke all on public.client_upload_links from public, anon, authenticated;
revoke all on public.client_upload_files from public, anon, authenticated;
grant select on public.client_upload_links to authenticated;
grant select on public.client_upload_files to authenticated;
drop policy if exists "Upload links: workspace writers can read" on public.client_upload_links;
create policy "Upload links: workspace writers can read"
  on public.client_upload_links for select to authenticated
  using (public.can_write_workspace(workspace_id) and public.view_consent_ok(workspace_id));
drop policy if exists "Upload files: workspace writers can read" on public.client_upload_files;
create policy "Upload files: workspace writers can read"
  on public.client_upload_files for select to authenticated
  using (public.can_write_workspace(workspace_id) and public.view_consent_ok(workspace_id));
-- 0026 과 같은 문(고객 자료 표마다 하나) — 새 표에도
drop policy if exists "zz View consent gate" on public.client_upload_links;
create policy "zz View consent gate" on public.client_upload_links as restrictive for all to authenticated
  using (not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[])))
  with check (not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[])));
drop policy if exists "zz View consent gate" on public.client_upload_files;
create policy "zz View consent gate" on public.client_upload_files as restrictive for all to authenticated
  using (not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[])))
  with check (not (workspace_id = any ((select public.view_consent_blocked_workspaces())::uuid[])));

-- workspace_id 는 한 번 정하면 못 바꾼다(0023 이 있으면 같은 장치)
do $$
begin
  if to_regprocedure('public.workspace_id_lock()') is not null then
    execute 'drop trigger if exists zz_workspace_id_lock on public.client_upload_links';
    execute 'create trigger zz_workspace_id_lock before update of workspace_id on public.client_upload_links for each row execute function public.workspace_id_lock()';
    execute 'drop trigger if exists zz_workspace_id_lock on public.client_upload_files';
    execute 'create trigger zz_workspace_id_lock before update of workspace_id on public.client_upload_files for each row execute function public.workspace_id_lock()';
  end if;
end $$;

-- 4) 쓸 수 있는 사람 확인(함수 안에서만 씀) — 그 작업공간에 쓸 수 있고 · 사용 승인 · 허락(0026) · 그 작업공간의 업체
create or replace function public.upload_link_access_check(p_ws uuid, p_client text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_ws is null or coalesce(p_client, '') = ''
     or not public.can_write_workspace(p_ws) or not public.view_consent_ok(p_ws) then
    raise exception '이 업체 서류함에 쓸 수 있는 사람만 올리기 링크를 다룰 수 있어요.' using errcode = '42501';
  end if;
  if public.my_os_access() is null then
    raise exception '사용 승인 뒤에 쓸 수 있어요.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.operations_clients c where c.id = p_client and c.workspace_id = p_ws) then
    raise exception '이 작업공간에 없는 업체예요.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.upload_link_access_check(uuid, text) from public, anon, authenticated;

-- 5) 업체 서류함 상태 — 쓸 수 없는 사람이면 {role:none}(앱은 아무것도 안 그림)
create or replace function public.upload_link_state(p_ws uuid, p_client text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l public.client_upload_links%rowtype;
begin
  if auth.uid() is null or p_ws is null or coalesce(p_client, '') = ''
     or not public.can_write_workspace(p_ws) or not public.view_consent_ok(p_ws) or public.my_os_access() is null
     or not exists (select 1 from public.operations_clients c where c.id = p_client and c.workspace_id = p_ws) then
    return jsonb_build_object('role', 'none');
  end if;
  select * into l from public.client_upload_links where workspace_id = p_ws and client_id = p_client and revoked_at is null;
  return jsonb_build_object(
    'role', 'writer',
    'link', case when l.id is null then null else jsonb_build_object(
      'slug', l.slug, 'title', l.title, 'note', l.note, 'docs', l.docs,
      'expiresAt', l.expires_at, 'expired', l.expires_at <= now(),
      'createdAt', l.created_at, 'uploaded', l.uploaded_count, 'lastAt', l.last_uploaded_at) end,
    'files', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id, 'docKey', f.doc_key, 'docLabel', f.doc_label, 'fileName', f.file_name,
               'fileSize', f.file_size, 'contentType', f.content_type, 'storagePath', f.storage_path,
               'uploadedAt', f.uploaded_at) order by f.uploaded_at desc)
        from (select * from public.client_upload_files
               where workspace_id = p_ws and client_id = p_client and status = 'uploaded'
               order by uploaded_at desc limit 100) f), '[]'::jsonb),
    'accepted', (select count(*) from public.client_upload_files where workspace_id = p_ws and client_id = p_client and status = 'accepted'),
    'closed', (select count(*) from public.client_upload_links where workspace_id = p_ws and client_id = p_client and revoked_at is not null)
  );
end;
$$;

-- 받을 서류 목록 다듬기(함수 안에서만 씀) — [{key,label}] · 키는 영문 · 숫자 · _ - 60자 · 이름 40자 · 30개 · 같은 키 한 번
create or replace function public.upload_link_clean_docs(p_docs jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', k, 'label', lb) order by n), '[]'::jsonb)
    from (
      select k, lb, n
        from (
          select distinct on (k) k, lb, n
            from (
              select btrim(d->>'key') as k,
                     left(btrim(regexp_replace(coalesce(d->>'label', ''), '[\r\n\t]+', ' ', 'g')), 40) as lb,
                     n
                from jsonb_array_elements(case when jsonb_typeof(p_docs) = 'array' then p_docs else '[]'::jsonb end) with ordinality as e(d, n)
               where jsonb_typeof(d) = 'object'
            ) x
           where k ~ '^[A-Za-z0-9_-]{1,60}$' and lb <> ''
           order by k, n
        ) d
       order by n
       limit 30
    ) y;
$$;
revoke all on function public.upload_link_clean_docs(jsonb) from public, anon, authenticated;

-- 6) 만들기 · 고치기(열린 링크가 있으면 받을 서류 · 안내 · 기한만 고친다 — 주소 그대로)
create or replace function public.upload_link_save(p_ws uuid, p_client text, p_docs jsonb, p_days integer default 14, p_note text default '')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_docs  jsonb := public.upload_link_clean_docs(p_docs);
  v_days  integer := least(greatest(coalesce(p_days, 14), 1), 30);
  v_note  text := left(btrim(regexp_replace(coalesce(p_note, ''), '[\r\n\t]+', ' ', 'g')), 120);
  v_title text;
begin
  perform public.upload_link_access_check(p_ws, p_client);
  if p_docs is not null and length(p_docs::text) > 20000 then
    raise exception 'docs too large' using errcode = '22023';
  end if;
  select left(btrim(regexp_replace(coalesce(c.company_name, ''), '[\r\n\t]+', ' ', 'g')), 60) into v_title
    from public.operations_clients c where c.id = p_client and c.workspace_id = p_ws;
  if coalesce(v_title, '') = '' then v_title := '서류 올리기'; end if;
  perform pg_advisory_xact_lock(hashtext('upload_link:' || p_ws::text || ':' || p_client));
  update public.client_upload_links
     set docs = v_docs, note = v_note, title = v_title, expires_at = now() + make_interval(days => v_days)
   where workspace_id = p_ws and client_id = p_client and revoked_at is null;
  if not found then
    insert into public.client_upload_links (workspace_id, client_id, title, note, docs, expires_at, created_by)
    values (p_ws, p_client, v_title, v_note, v_docs, now() + make_interval(days => v_days), auth.uid());
  end if;
  return public.upload_link_state(p_ws, p_client);
end;
$$;

-- 7) 주소 새로 만들기 — 예전 주소는 그 순간부터 안 받는다(받을 서류 · 안내 · 기한은 그대로)
create or replace function public.upload_link_rotate(p_ws uuid, p_client text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l public.client_upload_links%rowtype;
begin
  perform public.upload_link_access_check(p_ws, p_client);
  perform pg_advisory_xact_lock(hashtext('upload_link:' || p_ws::text || ':' || p_client));
  select * into l from public.client_upload_links where workspace_id = p_ws and client_id = p_client and revoked_at is null;
  if l.id is null then
    raise exception '아직 만든 링크가 없어요.' using errcode = '22023';
  end if;
  update public.client_upload_links set revoked_at = now() where id = l.id;
  insert into public.client_upload_links (workspace_id, client_id, title, note, docs, expires_at, created_by)
  values (p_ws, p_client, l.title, l.note, l.docs, greatest(l.expires_at, now() + interval '1 day'), auth.uid());
  return public.upload_link_state(p_ws, p_client);
end;
$$;

-- 8) 닫기 — 다시 받으려면 [만들기](새 주소)
create or replace function public.upload_link_off(p_ws uuid, p_client text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.upload_link_access_check(p_ws, p_client);
  update public.client_upload_links set revoked_at = now()
   where workspace_id = p_ws and client_id = p_client and revoked_at is null;
  return public.upload_link_state(p_ws, p_client);
end;
$$;

-- 9) 받은 파일 정하기 — accepted(칸에 넣음) · dismissed(안 씀) · uploaded(되돌리기). changed = 이번 부름이 바꿨는지(두 번 눌러도 한 번)
create or replace function public.upload_link_decide(p_file uuid, p_decision text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  f public.client_upload_files%rowtype;
  v_to text := btrim(coalesce(p_decision, ''));
  v_n integer;
begin
  if v_to not in ('accepted', 'dismissed', 'uploaded') then
    raise exception 'invalid decision' using errcode = '22023';
  end if;
  select * into f from public.client_upload_files where id = p_file;
  if f.id is null then
    raise exception '이 업체 서류함에 쓸 수 있는 사람만 올리기 링크를 다룰 수 있어요.' using errcode = '42501';
  end if;
  perform public.upload_link_access_check(f.workspace_id, f.client_id);
  if f.status = 'reserved' then
    raise exception '아직 다 올라오지 않은 파일이에요.' using errcode = '22023';
  end if;
  update public.client_upload_files
     set status = v_to,
         decided_at = case when v_to = 'uploaded' then null else now() end,
         decided_by = case when v_to = 'uploaded' then null else auth.uid() end
   where id = f.id and status <> v_to
     and (v_to <> 'uploaded' and status = 'uploaded' or v_to = 'uploaded' and status in ('accepted', 'dismissed'));
  get diagnostics v_n = row_count;
  return jsonb_build_object('changed', v_n > 0,
    'status', (select status from public.client_upload_files where id = f.id));
end;
$$;

-- 10) 작업공간 전체 — 업체마다 '고객이 올리고 아직 칸에 안 넣은 파일' 수(고객 관리 카드 · 오늘)
create or replace function public.upload_link_inbox(p_ws uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_ws is null or not public.can_write_workspace(p_ws) or not public.view_consent_ok(p_ws)
     or public.my_os_access() is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('clientId', client_id, 'waiting', n, 'lastAt', last_at) order by last_at desc)
      from (select f.client_id, count(*) as n, max(f.uploaded_at) as last_at
              from public.client_upload_files f
             where f.workspace_id = p_ws and f.status = 'uploaded'
             group by f.client_id) x), '[]'::jsonb);
end;
$$;

-- 열린 링크 찾기(함수 안에서만 씀) — 닫힘 · 기한 지남 · 사용 승인이 끊긴 주인 · 지운 업체면 없음
create or replace function public.upload_link_open(p_slug text)
returns public.client_upload_links
language sql
stable
security definer
set search_path = public
as $$
  select li.*
    from public.client_upload_links li
    join public.workspaces w on w.id = li.workspace_id
    join public.os_access a on a.user_id = w.owner_id
    join public.operations_clients c on c.id = li.client_id and c.workspace_id = li.workspace_id
   where li.slug = lower(btrim(coalesce(p_slug, ''))) and li.revoked_at is null and li.expires_at > now()
   limit 1;
$$;
revoke all on function public.upload_link_open(text) from public, anon, authenticated;

-- 11) 공개 화면 — 업체 이름 · 안내 · 받을 서류 · 기한 · 서류마다 올린 개수. 없거나 닫힌 주소면 null
create or replace function public.public_upload_form(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l public.client_upload_links%rowtype;
begin
  l := public.upload_link_open(p_slug);
  if l.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'title', l.title, 'note', l.note, 'docs', l.docs, 'expiresAt', l.expires_at,
    'sent', coalesce((
      select jsonb_agg(jsonb_build_object('key', doc_key, 'n', n, 'lastAt', last_at) order by last_at desc)
        from (select f.doc_key, count(*) as n, max(f.uploaded_at) as last_at
                from public.client_upload_files f
               where f.link_id = l.id and f.status in ('uploaded', 'accepted')
               group by f.doc_key) x), '[]'::jsonb));
end;
$$;

-- 12) 공개 예약 — 서버가 경로를 정한다(올리는 사람이 폴더 · 이름을 고르지 못한다). {status:'ok', id, path} | {status:'closed'}
create or replace function public.public_upload_reserve(p_slug text, p_doc_key text, p_file_name text, p_size bigint, p_type text default '')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l       public.client_upload_links%rowtype;
  v_key   text := btrim(coalesce(p_doc_key, ''));
  v_label text := '';
  v_name  text := left(btrim(regexp_replace(coalesce(p_file_name, ''), '[\r\n\t/\\]+', '_', 'g')), 120);
  v_ext   text;
  v_type  text := left(btrim(coalesce(p_type, '')), 100);
  v_id    uuid := gen_random_uuid();
  v_path  text;
  v_ip    text;
begin
  l := public.upload_link_open(p_slug);
  if l.id is null then
    return jsonb_build_object('status', 'closed');
  end if;
  if v_name = '' then
    raise exception 'name required' using errcode = '22023';
  end if;
  v_ext := lower(substring(v_name from '\.([A-Za-z0-9]{1,5})$'));
  if v_ext is null or v_ext not in ('pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'tif', 'tiff',
                                   'hwp', 'hwpx', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt') then
    raise exception 'file type not allowed' using errcode = '22023';
  end if;
  if p_size is null or p_size <= 0 or p_size > 20971520 then
    raise exception 'file size' using errcode = '22023';
  end if;
  if v_key <> '' then
    select left(coalesce(d->>'label', ''), 40) into v_label
      from jsonb_array_elements(l.docs) d where d->>'key' = v_key limit 1;
    if v_label is null or v_label = '' then
      raise exception 'unknown document' using errcode = '22023';
    end if;
  end if;
  if v_type !~ '^[A-Za-z0-9.+/-]*$' then v_type := ''; end if;

  -- 전체 둑(10분 600번)
  if (select count(*) from public.public_intake_log g
       where g.kind = 'upload_link' and g.at > now() - interval '10 minutes') >= 600 then
    raise exception 'too many requests' using errcode = '54000';
  end if;
  -- 한 곳(접속 주소)에서 10분 40번 — 원문은 남기지 않고 해시만
  v_ip := btrim(split_part(coalesce(
            nullif(current_setting('request.headers', true), '')::jsonb ->> 'cf-connecting-ip',
            nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for',
            nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-real-ip', ''), ',', 1));
  if v_ip <> '' then
    if (select count(*) from public.public_intake_log g
         where g.kind = 'upload_link_ip' and g.key_hash = public.hash_access_token(v_ip)
           and g.at > now() - interval '10 minutes') >= 40 then
      raise exception 'too many requests' using errcode = '54000';
    end if;
  end if;
  -- 링크 하나에 10분 40번 · 하루 150번 · 모두 80개
  if (select count(*) from public.public_intake_log g
       where g.kind = 'upload_link' and g.key_hash = public.hash_access_token(l.id::text)
         and g.at > now() - interval '10 minutes') >= 40
     or (select count(*) from public.public_intake_log g
       where g.kind = 'upload_link' and g.key_hash = public.hash_access_token(l.id::text)
         and g.at > now() - interval '1 day') >= 150 then
    raise exception 'too many requests' using errcode = '54000';
  end if;
  if (select count(*) from public.client_upload_files f where f.link_id = l.id) >= 80 then
    raise exception 'too many files' using errcode = '54000';
  end if;
  if v_ip <> '' then
    insert into public.public_intake_log (kind, key_hash) values ('upload_link_ip', public.hash_access_token(v_ip));
  end if;
  insert into public.public_intake_log (kind, key_hash) values ('upload_link', public.hash_access_token(l.id::text));

  -- 경로: <작업공간>/<업체>/upload-link/<링크>/<파일 id>.<형식> — 첫 폴더가 작업공간이라 컨설턴트는 기존 보관함 규칙 그대로 읽는다
  v_path := l.workspace_id::text || '/' || l.client_id || '/upload-link/' || l.id::text || '/' || v_id::text || '.' || v_ext;
  insert into public.client_upload_files (id, link_id, workspace_id, client_id, doc_key, doc_label, file_name, file_size, content_type, storage_path)
  values (v_id, l.id, l.workspace_id, l.client_id, v_key, v_label, v_name, p_size, v_type, v_path);
  return jsonb_build_object('status', 'ok', 'id', v_id, 'path', v_path);
end;
$$;

-- 보관함 넣기 허락(정책이 부름) — 방금 예약한(30분 안) 경로 · 열린 링크만
create or replace function public.upload_link_path_ok(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.client_upload_files f
      join public.client_upload_links l on l.id = f.link_id
      join public.workspaces w on w.id = l.workspace_id
      join public.os_access a on a.user_id = w.owner_id
      join public.operations_clients c on c.id = l.client_id and c.workspace_id = l.workspace_id
     where f.storage_path = p_name and f.status = 'reserved'
       and f.created_at > now() - interval '30 minutes'
       and l.revoked_at is null and l.expires_at > now()
  );
$$;

-- 13) 공개 다 올림 — 'ok' | 'closed' | 'missing'(보관함에 없음) | 'too_big'. 같은 파일을 두 번 알려도 한 번만 센다
create or replace function public.public_upload_done(p_slug text, p_path text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l      public.client_upload_links%rowtype;
  f      public.client_upload_files%rowtype;
  v_obj  jsonb;
  v_size bigint;
  v_seen boolean := true;
begin
  l := public.upload_link_open(p_slug);
  if l.id is null then
    return 'closed';
  end if;
  select * into f from public.client_upload_files
   where link_id = l.id and storage_path = coalesce(p_path, '') for update;
  if f.id is null then
    raise exception 'unknown file' using errcode = '22023';
  end if;
  if f.status <> 'reserved' then
    return case when f.status = 'dismissed' and f.decided_by is null then 'too_big' else 'ok' end;
  end if;
  -- 보관함에 정말 들어왔는지(읽을 수 없는 환경이면 건너뛴다 — 정책이 이미 예약 경로만 받는다)
  begin
    select to_jsonb(o) into v_obj from storage.objects o where o.bucket_id = 'client-documents' and o.name = f.storage_path;
    v_seen := v_obj is not null;
  exception when others then
    v_obj := null;
    v_seen := true;
  end;
  if not v_seen then
    return 'missing';
  end if;
  v_size := case when coalesce(v_obj->'metadata'->>'size', '') ~ '^[0-9]{1,15}$' then (v_obj->'metadata'->>'size')::bigint end;
  if v_size is not null and v_size > 20971520 then
    update public.client_upload_files set status = 'dismissed', decided_at = now(), file_size = v_size where id = f.id;
    return 'too_big';
  end if;
  update public.client_upload_files
     set status = 'uploaded', uploaded_at = now(), file_size = coalesce(v_size, file_size)
   where id = f.id;
  update public.client_upload_links set uploaded_count = uploaded_count + 1, last_uploaded_at = now() where id = l.id;
  return 'ok';
end;
$$;

-- 14) 보관함 — 로그인 안 한 사람도 '예약한 경로' 에만 넣을 수 있다(읽기 · 고치기 · 지우기 0). 기존 정책은 그대로.
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "Upload links: reserved path insert" on storage.objects';
    execute 'create policy "Upload links: reserved path insert"
      on storage.objects for insert to anon, authenticated
      with check (bucket_id = ''client-documents'' and public.upload_link_path_ok(name))';
  end if;
end $$;

-- 권한: 업체 함수는 로그인한 사람만 · 공개 함수는 누구나(함수 안에서 막는다)
revoke all on function public.upload_link_state(uuid, text) from public, anon;
revoke all on function public.upload_link_save(uuid, text, jsonb, integer, text) from public, anon;
revoke all on function public.upload_link_rotate(uuid, text) from public, anon;
revoke all on function public.upload_link_off(uuid, text) from public, anon;
revoke all on function public.upload_link_decide(uuid, text) from public, anon;
revoke all on function public.upload_link_inbox(uuid) from public, anon;
grant execute on function public.upload_link_state(uuid, text) to authenticated;
grant execute on function public.upload_link_save(uuid, text, jsonb, integer, text) to authenticated;
grant execute on function public.upload_link_rotate(uuid, text) to authenticated;
grant execute on function public.upload_link_off(uuid, text) to authenticated;
grant execute on function public.upload_link_decide(uuid, text) to authenticated;
grant execute on function public.upload_link_inbox(uuid) to authenticated;
revoke all on function public.public_upload_form(text) from public;
revoke all on function public.public_upload_reserve(text, text, text, bigint, text) from public;
revoke all on function public.public_upload_done(text, text) from public;
revoke all on function public.upload_link_path_ok(text) from public;
grant execute on function public.public_upload_form(text) to anon, authenticated;
grant execute on function public.public_upload_reserve(text, text, text, bigint, text) to anon, authenticated;
grant execute on function public.public_upload_done(text, text) to anon, authenticated;
grant execute on function public.upload_link_path_ok(text) to anon, authenticated;

commit;
