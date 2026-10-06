-- D-162 1인 Pilot 격리 시험 — 로컬 시험 DB(axqa)에서만. scripts/db-local/run.sh 가 부른다. 운영 DB 에는 절대 실행하지 않는다.
--
-- Owner(작업공간 A) 의 줄을 workspace_id 가 있는 **모든 표**에 하나씩 넣고(자동), 보관함(client-documents)에 A 폴더 파일을 둔 뒤,
-- Pilot(작업공간 B 만) 으로 읽기 · 고치기 · 지우기 · A 로 넣기를 해 본다. 하나라도 보이거나 바뀌면 FAIL.
\set QUIET 1
\set ON_ERROR_STOP 1
create schema if not exists qa;
create or replace function qa.eq(label text, got text, want text) returns void language plpgsql as $$
begin if got is not distinct from want then raise notice 'PASS  % = %', label, got; else raise notice 'FAIL  % = % (기대 %)', label, got, want; end if; end $$;
grant usage on schema qa to anon, authenticated; grant execute on all functions in schema qa to anon, authenticated;

-- 사람 · 작업공간
insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-0000000000a1', 'owner@qa.kr'),
  ('b1000000-0000-0000-0000-0000000000b1', 'pilot@qa.kr') on conflict do nothing;
insert into public.profiles (id, email) values
  ('a1000000-0000-0000-0000-0000000000a1', 'owner@qa.kr'),
  ('b1000000-0000-0000-0000-0000000000b1', 'pilot@qa.kr') on conflict (id) do nothing;
insert into public.workspaces (id, name, owner_id) values
  ('aaaa0000-0000-0000-0000-00000000000a', 'OWNER-A', 'a1000000-0000-0000-0000-0000000000a1'),
  ('bbbb0000-0000-0000-0000-00000000000b', 'PILOT-B', 'b1000000-0000-0000-0000-0000000000b1') on conflict do nothing;
insert into public.workspace_members (workspace_id, user_id, role) values
  ('aaaa0000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-0000000000a1', 'owner'),
  ('bbbb0000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-0000000000b1', 'owner') on conflict do nothing;

-- Owner 줄을 workspace_id 가 있는 모든 표에 하나씩(관계 · 트리거는 잠시 끄고 — 시험 장치만)
create or replace function qa.literal_for(tbl text, col text, typ text, udt text) returns text language plpgsql as $$
declare chk text; lit text;
begin
  if col = 'workspace_id' then return quote_literal('aaaa0000-0000-0000-0000-00000000000a'); end if;
  if col in ('user_id', 'owner_id', 'created_by', 'invited_by', 'profile_id', 'customer_profile_id') then return quote_literal('a1000000-0000-0000-0000-0000000000a1'); end if;
  -- 형식이 정해진 칸(정규식 · 범위)
  if tbl = 'ops_custom_services' and col = 'key' then return quote_literal('custom_qa' || substr(md5(random()::text), 1, 6)); end if;
  if tbl = 'consulting_evidence' and col = 'slot' then return '1'; end if;
  -- 허용 값이 정해진 칸(check)은 첫 값
  select pg_get_constraintdef(c.oid) into chk from pg_constraint c join pg_class r on r.oid = c.conrelid join pg_namespace n on n.oid = r.relnamespace
   where n.nspname = 'public' and r.relname = tbl and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%' || col || '%' limit 1;
  if chk is not null and typ in ('text', 'character varying') then
    lit := substring(chk from '''([^'']*)''');
    if lit is not null then return quote_literal(lit); end if;
  end if;
  return case
    when typ = 'uuid' then 'gen_random_uuid()'
    when typ in ('text', 'character varying') then quote_literal('qa-owner-' || col)
    when typ in ('jsonb', 'json') then quote_literal('{}')
    when typ like 'timestamp%' then 'now()'
    when typ = 'date' then 'current_date'
    when typ = 'boolean' then 'false'
    when typ in ('integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision') then '0'
    when typ = 'ARRAY' then quote_literal('{}')
    when typ = 'USER-DEFINED' then quote_literal((select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = udt order by e.enumsortorder limit 1))
    else 'null' end;
end $$;

create table if not exists qa.seeded (tbl text primary key, ok boolean, why text);
truncate qa.seeded;
do $$
declare t text; cols text; vals text; r record; sql text;
begin
  set local session_replication_role = replica;
  for t in select distinct table_name from information_schema.columns where table_schema = 'public' and column_name = 'workspace_id'
            and table_name not in ('workspace_members', 'workspaces') order by 1 loop
    cols := ''; vals := '';
    for r in select column_name, data_type, udt_name from information_schema.columns
              where table_schema = 'public' and table_name = t and (column_name = 'workspace_id' or (is_nullable = 'NO' and column_default is null)) order by ordinal_position loop
      cols := cols || case when cols = '' then '' else ', ' end || quote_ident(r.column_name);
      vals := vals || case when vals = '' then '' else ', ' end || qa.literal_for(t, r.column_name, r.data_type, r.udt_name);
    end loop;
    sql := format('insert into public.%I (%s) values (%s)', t, cols, vals);
    begin
      execute sql;
      insert into qa.seeded values (t, true, '');
    exception when others then
      insert into qa.seeded values (t, false, sqlerrm);
    end;
  end loop;
end $$;
select qa.eq('씨앗: Owner 줄을 못 넣은 표', (select coalesce(string_agg(tbl || ':' || why, ' | '), '') from qa.seeded where not ok), '');
select qa.eq('씨앗: Owner 줄을 넣은 표 수(workspace_id 가 있는 표 전부)', (select count(*)::text from qa.seeded where ok), (select count(*)::text from qa.seeded));
grant select on qa.seeded to authenticated, anon;

-- 보관함: Owner 폴더에 파일 하나
insert into storage.objects (bucket_id, name, owner) values
  ('client-documents', 'aaaa0000-0000-0000-0000-00000000000a/clients/c1/biz.pdf', 'a1000000-0000-0000-0000-0000000000a1');

-- ===================== Pilot 으로 =====================
select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-0000000000b1', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;

create temp table if not exists qa_result (tbl text, saw int, upd int, del int, ins text);
grant all on qa_result to authenticated;
do $$
declare t text; n int; u int; d int; ins text; cols text; vals text; r record;
begin
  for t in select tbl from qa.seeded where ok order by 1 loop
    execute format('select count(*) from public.%I', t) into n;
    begin
      execute format('update public.%I set workspace_id = workspace_id where workspace_id = %L', t, 'aaaa0000-0000-0000-0000-00000000000a');
      get diagnostics u = row_count;
    exception when others then u := 0; end;
    begin
      execute format('delete from public.%I where workspace_id = %L', t, 'aaaa0000-0000-0000-0000-00000000000a');
      get diagnostics d = row_count;
    exception when others then d := 0; end;
    cols := ''; vals := '';
    for r in select column_name, data_type, udt_name from information_schema.columns
              where table_schema = 'public' and table_name = t and (column_name = 'workspace_id' or (is_nullable = 'NO' and column_default is null)) order by ordinal_position loop
      cols := cols || case when cols = '' then '' else ', ' end || quote_ident(r.column_name);
      vals := vals || case when vals = '' then '' else ', ' end || qa.literal_for(t, r.column_name, r.data_type, r.udt_name);
    end loop;
    begin
      execute format('insert into public.%I (%s) values (%s)', t, cols, vals);
      ins := 'INSERTED';
    exception when insufficient_privilege then ins := 'rls';
      when others then ins := 'blocked:' || sqlstate;
    end;
    insert into qa_result values (t, n, u, d, ins);
  end loop;
end $$;
select qa.eq('Pilot: Owner 줄이 보이는 표', (select coalesce(string_agg(tbl || '=' || saw, ' '), '') from qa_result where saw > 0), '');
select qa.eq('Pilot: Owner 줄을 고친 표', (select coalesce(string_agg(tbl, ' '), '') from qa_result where upd > 0), '');
select qa.eq('Pilot: Owner 줄을 지운 표', (select coalesce(string_agg(tbl, ' '), '') from qa_result where del > 0), '');
select qa.eq('Pilot: Owner 작업공간(A)으로 넣어진 표', (select coalesce(string_agg(tbl, ' '), '') from qa_result where ins = 'INSERTED'), '');
select qa.eq('Pilot: A 로 넣기가 RLS 가 아닌 다른 이유로 막힌 표(참고 — 0 이 아니면 살펴볼 것)', (select coalesce(string_agg(tbl || ':' || ins, ' '), '') from qa_result where ins like 'blocked:%' and ins <> 'blocked:42501'), '');
select qa.eq('Pilot: 작업공간 목록에는 자기 것 하나', (select string_agg(name, ',') from public.workspaces), 'PILOT-B');
select qa.eq('Pilot: 멤버 목록에는 자기 줄만', (select count(*)::text from public.workspace_members), '1');
select qa.eq('Pilot: 프로필은 자기 것만', (select string_agg(email, ',') from public.profiles), 'pilot@qa.kr');
select qa.eq('Pilot: Owner 작업공간 멤버 확인 함수 = 거짓', (select public.is_workspace_member('aaaa0000-0000-0000-0000-00000000000a')::text), 'false');
select qa.eq('Pilot: 보관함 Owner 파일 보임', (select count(*)::text from storage.objects where name like 'aaaa0000%'), '0');
do $$ begin
  insert into storage.objects (bucket_id, name, owner) values ('client-documents', 'aaaa0000-0000-0000-0000-00000000000a/clients/c1/evil.pdf', 'b1000000-0000-0000-0000-0000000000b1');
  raise notice 'FAIL  Pilot: Owner 폴더에 파일 올리기 — 막혀야 하는데 통과';
exception when others then raise notice 'PASS  Pilot: Owner 폴더에 파일 올리기 막힘 (%)', sqlerrm; end $$;
do $$ declare n int; begin
  update storage.objects set name = name where name like 'aaaa0000%'; get diagnostics n = row_count;
  if n = 0 then raise notice 'PASS  Pilot: Owner 파일 고치기 0줄'; else raise notice 'FAIL  Pilot: Owner 파일 % 줄 고침', n; end if;
  delete from storage.objects where name like 'aaaa0000%'; get diagnostics n = row_count;
  if n = 0 then raise notice 'PASS  Pilot: Owner 파일 지우기 0줄'; else raise notice 'FAIL  Pilot: Owner 파일 % 줄 지움', n; end if;
end $$;
do $$ begin
  insert into storage.objects (bucket_id, name, owner) values ('client-documents', 'bbbb0000-0000-0000-0000-00000000000b/clients/c9/mine.pdf', 'b1000000-0000-0000-0000-0000000000b1');
  raise notice 'PASS  Pilot: 자기 작업공간 폴더에는 올릴 수 있음';
exception when others then raise notice 'FAIL  Pilot: 자기 폴더에 못 올림 (%)', sqlerrm; end $$;
reset role;

-- ===================== 로그인 안 한 사람(anon) — Supabase 처럼 표 권한은 열려 있고 RLS 가 막는다 =====================
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$
declare t text; n int; bad text := '';
begin
  for t in select tbl from qa.seeded where ok order by 1 loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      if n > 0 then bad := bad || t || '=' || n || ' '; end if;
    exception when insufficient_privilege then null;
    end;
  end loop;
  if bad = '' then raise notice 'PASS  로그인 안 한 사람: Owner 줄이 보이는 표 없음'; else raise notice 'FAIL  로그인 안 한 사람에게 보이는 표: %', bad; end if;
end $$;
reset role;

-- ===================== Owner 로 — Pilot 것이 섞이지 않는다 =====================
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('Owner: Pilot 파일 안 보임', (select count(*)::text from storage.objects where name like 'bbbb0000%'), '0');
select qa.eq('Owner: 작업공간 목록에 Pilot 것 없음', (select string_agg(name, ',') from public.workspaces), 'OWNER-A');
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);
