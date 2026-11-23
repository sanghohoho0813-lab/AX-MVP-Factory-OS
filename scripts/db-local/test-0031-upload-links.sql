-- L-41 · D-652 서류 올리기 링크(0031) 시험 — 로컬 시험 DB(axqa)에서만. test-0019 · 0024 · 0026 · 0027 다음에 돈다.
--   대표 O(a1 · full · 팀장 작업공간 편집자) · 내부 팀장 P(b1 · pilot) · 가입자 R(c1 · 등급 없음) · 외부 고객 C(24…d1) · 로그인 안 한 사람(anon)
\set QUIET 1
\set ON_ERROR_STOP 1
create table if not exists qa.ul (k text primary key, v text);
truncate qa.ul;
grant all on qa.ul to anon, authenticated;
grant select on qa.ids to anon;
grant usage on schema qa to anon;
grant execute on all functions in schema qa to anon, authenticated;
select set_config('request.headers', '', false);
select set_config('request.jwt.claim.sub', '', false);

-- 준비(시험 DB): 업체 셋 · 허락 0 · 지난 기록 0
update public.workspace_view_grants set revoked_at = now() where revoked_at is null;
delete from public.public_intake_log where kind like 'upload_link%';
delete from public.client_upload_links where client_id in ('p31-client', 'o31-client', 'c31-client');
delete from storage.objects where name like '%/upload-link/%';
insert into public.operations_clients (id, workspace_id, company_name, payload) select 'p31-client', v, '(주)한빛정밀', '{}' from qa.ids where k = 'P' on conflict (id) do nothing;
insert into public.operations_clients (id, workspace_id, company_name, payload) select 'o31-client', v, '대표 고객사', '{}' from qa.ids where k = 'O' on conflict (id) do nothing;
insert into public.operations_clients (id, workspace_id, company_name, payload) select 'c31-client', v, '고객의 고객사', '{}' from qa.ids where k = 'C' on conflict (id) do nothing;
select qa.eq('준비: 표 2 RLS 켜짐', (select string_agg(relname || ':' || relrowsecurity, ',' order by relname) from pg_class where relname in ('client_upload_links', 'client_upload_files') and relnamespace = 'public'::regnamespace), 'client_upload_files:true,client_upload_links:true');
select qa.eq('준비: 앱 계정 표 권한은 SELECT 하나 · anon 0', (select string_agg(distinct privilege_type || '/' || grantee, ',') from information_schema.role_table_grants where table_schema = 'public' and table_name in ('client_upload_links', 'client_upload_files') and grantee in ('anon', 'authenticated', 'PUBLIC')), 'SELECT/authenticated');
select qa.eq('준비: 안쪽 함수 3개는 앱 계정이 부를 수 없음', (select count(*)::text from information_schema.routine_privileges where routine_schema = 'public' and routine_name in ('upload_link_access_check', 'upload_link_clean_docs', 'upload_link_open') and grantee in ('anon', 'authenticated', 'PUBLIC')), '0');
select qa.eq('준비: 업체 함수는 anon · PUBLIC 0', (select count(*)::text from information_schema.routine_privileges where routine_schema = 'public' and routine_name in ('upload_link_state', 'upload_link_save', 'upload_link_rotate', 'upload_link_off', 'upload_link_decide', 'upload_link_inbox') and grantee in ('anon', 'PUBLIC')), '0');
select qa.eq('준비: 보관함 넣기 정책 하나(anon · authenticated · INSERT)', (select string_agg(cmd || ':' || array_to_string(roles, '+'), ',') from pg_policies where schemaname = 'storage' and policyname = 'Upload links: reserved path insert'), 'INSERT:anon+authenticated');

-- ---------- 팀장 P — 내 업체 링크 만들기 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P1 처음 상태 = writer · 링크 없음 · 받은 파일 0', (select (s->>'role') || ' ' || coalesce(s->>'link', '-') || ' ' || jsonb_array_length(s->'files') from (select public.upload_link_state(v, 'p31-client') s from qa.ids where k = 'P') x), 'writer - 0');
insert into qa.ul select 'slug', public.upload_link_save(v, 'p31-client', '[{"key":"bizReg","label":"사업자등록증"},{"key":"fin","label":"재무제표\n3년"},{"key":"bad key","label":"x"},{"key":"bizReg","label":"겹침"},"문자"]', 7, e'  최근 3개월 안에\n뗀 것으로  ')->'link'->>'slug' from qa.ids where k = 'P';
select qa.eq('P2 만들기 → 20자리 주소', (select (v ~ '^[0-9a-f]{20}$')::text from qa.ul where k = 'slug'), 'true');
select qa.eq('P3 받을 서류 다듬기(이상한 키 · 겹침 · 문자 빼기 · 줄바꿈 → 빈칸)', (select l.docs::text from public.client_upload_links l where l.slug = (select v from qa.ul where k = 'slug')), '[{"key": "bizReg", "label": "사업자등록증"}, {"key": "fin", "label": "재무제표 3년"}]');
select qa.eq('P4 제목 = 업체 이름 · 안내 한 줄 · 기한 7일', (select l.title || ' | ' || l.note || ' | ' || (l.expires_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour')::text from public.client_upload_links l where l.slug = (select v from qa.ul where k = 'slug')), '(주)한빛정밀 | 최근 3개월 안에 뗀 것으로 | true');
select qa.eq('P5 다시 저장해도 같은 주소 · 열린 링크 하나 · 기한은 30일까지', (select ((s->'link'->>'slug') = (select v from qa.ul where k = 'slug'))::text || ' ' || jsonb_array_length(s->'link'->'docs') from (select public.upload_link_save(v, 'p31-client', '[{"key":"bizReg","label":"사업자등록증"}]', 400, '') s from qa.ids where k = 'P') x) || ' ' || (select count(*)::text from public.client_upload_links where client_id = 'p31-client' and revoked_at is null) || ' ' || (select (expires_at < now() + interval '30 days 1 hour')::text from public.client_upload_links where client_id = 'p31-client' and revoked_at is null), 'true 1 1 true');
select public.upload_link_save(v, 'p31-client', '[{"key":"bizReg","label":"사업자등록증"},{"key":"fin","label":"재무제표"}]', 14, '최근 3개월 안에 뗀 것으로') from qa.ids where k = 'P';
select qa.eq('P6 내 링크는 보임(읽기만)', (select count(*)::text from public.client_upload_links where client_id = 'p31-client'), '1');
select qa.no('P7 표에 직접 넣기 막힘', $q$insert into public.client_upload_links (workspace_id, client_id) select v, 'p31-client' from qa.ids where k = 'P'$q$);
select qa.no('P7b 받은 수 직접 늘리기 막힘', $q$update public.client_upload_links set uploaded_count = 999$q$);
select qa.no('P7c 링크 지우기 막힘', $q$delete from public.client_upload_links$q$);
select qa.no('P7d 받은 파일 표에 직접 넣기 막힘', $q$insert into public.client_upload_files (link_id, workspace_id, client_id, file_name, storage_path) select l.id, l.workspace_id, l.client_id, 'x.pdf', 'x' from public.client_upload_links l limit 1$q$);
select qa.eq('P8 대표 작업공간 업체 상태 = none', (select public.upload_link_state(v, 'o31-client')->>'role' from qa.ids where k = 'O'), 'none');
select qa.no('P9 대표 작업공간 업체에 링크 만들기 막힘', $q$select public.upload_link_save((select v from qa.ids where k = 'O'), 'o31-client', '[]', 14, '')$q$);
select qa.no('P10 내 작업공간 id + 남의 업체 id 막힘', $q$select public.upload_link_save((select v from qa.ids where k = 'P'), 'o31-client', '[]', 14, '')$q$);
select qa.no('P11 없는 업체 막힘', $q$select public.upload_link_save((select v from qa.ids where k = 'P'), 'no-such-client', '[]', 14, '')$q$);
select qa.no('P12 안쪽 함수(쓸 수 있는 사람 확인) 부를 수 없음', $q$select public.upload_link_access_check((select v from qa.ids where k = 'P'), 'p31-client')$q$);
select qa.no('P12b 안쪽 함수(열린 링크 찾기) 부를 수 없음', $q$select public.upload_link_open((select v from qa.ul where k = 'slug'))$q$);
select qa.no('P13 너무 큰 서류 목록 막힘', $q$select public.upload_link_save((select v from qa.ids where k = 'P'), 'p31-client', (select jsonb_agg(jsonb_build_object('key', 'k' || g, 'label', repeat('가', 40))) from generate_series(1, 400) g), 14, '')$q$);
reset role;

-- ---------- 대표 O — 팀장 작업공간은 허락(0026) 없이 못 다룸 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O1 허락 없음: 팀장 업체 상태 none · 링크 안 보임', (select public.upload_link_state(v, 'p31-client')->>'role' from qa.ids where k = 'P') || ' ' || (select count(*)::text from public.client_upload_links where client_id = 'p31-client'), 'none 0');
select qa.no('O2 허락 없음: 팀장 업체 링크 고치기 막힘', $q$select public.upload_link_save((select v from qa.ids where k = 'P'), 'p31-client', '[]', 30, '')$q$);
select qa.no('O3 허락 없음: 팀장 업체 링크 새로 만들기(가로채기) 막힘', $q$select public.upload_link_rotate((select v from qa.ids where k = 'P'), 'p31-client')$q$);
select qa.no('O4 허락 없음: 팀장 업체 링크 닫기 막힘', $q$select public.upload_link_off((select v from qa.ids where k = 'P'), 'p31-client')$q$);
select qa.eq('O5 허락 없음: 팀장 작업공간 받은 파일 목록 빈 칸', (select public.upload_link_inbox(v)::text from qa.ids where k = 'P'), '[]');
insert into qa.ul select 'oslug', public.upload_link_save(v, 'o31-client', '[{"key":"bizReg","label":"사업자등록증"}]', 14, '')->'link'->>'slug' from qa.ids where k = 'O';
select qa.eq('O6 내 작업공간 업체 링크는 따로(주소 다름)', (select (o.v <> p.v and o.v ~ '^[0-9a-f]{20}$')::text from qa.ul o, qa.ul p where o.k = 'oslug' and p.k = 'slug'), 'true');
reset role;

-- ---------- 가입자 R · 외부 고객 C ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
select qa.eq('R1 가입자: 상태 none · 링크 · 파일 0', (select public.upload_link_state(v, 'p31-client')->>'role' from qa.ids where k = 'P') || ' ' || (select count(*)::text from public.client_upload_links) || ' ' || (select count(*)::text from public.client_upload_files), 'none 0 0');
select qa.no('R2 가입자: 링크 만들기 막힘', $q$select public.upload_link_save((select v from qa.ids where k = 'P'), 'p31-client', '[]', 14, '')$q$);
reset role;
select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-0000000000d1', false);
set role authenticated;
insert into qa.ul select 'cslug', public.upload_link_save(v, 'c31-client', '[{"key":"bizReg","label":"사업자등록증"}]', 14, '')->'link'->>'slug' from qa.ids where k = 'C';
select qa.eq('C1 외부 고객도 자기 업체 링크 · 남의 링크 0', (select (v ~ '^[0-9a-f]{20}$')::text from qa.ul where k = 'cslug') || ' ' || (select count(*)::text from public.client_upload_links), 'true 1');
select qa.eq('C2 외부 고객: 팀장 업체 상태 none', (select public.upload_link_state(v, 'p31-client')->>'role' from qa.ids where k = 'P'), 'none');
reset role;

-- ---------- 로그인 안 한 사람(업체 대표의 휴대폰) ----------
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select qa.eq('A1 공개 화면 = 업체 이름 · 안내 · 받을 서류 · 기한 · 올린 것 0', (select (f - 'expiresAt')::text || ' ' || (f ? 'expiresAt')::text from (select public.public_upload_form(v) f from qa.ul where k = 'slug') x), '{"docs": [{"key": "bizReg", "label": "사업자등록증"}, {"key": "fin", "label": "재무제표"}], "note": "최근 3개월 안에 뗀 것으로", "sent": [], "title": "(주)한빛정밀"} true');
select qa.eq('A2 대문자 · 앞뒤 빈칸 주소도 같은 화면 · 없는 주소 null', (select public.public_upload_form('  ' || upper(v) || ' ')->>'title' from qa.ul where k = 'slug') || ' ' || coalesce(public.public_upload_form('00000000000000000000')::text, 'null') || ' ' || coalesce(public.public_upload_form('')::text, 'null'), '(주)한빛정밀 null null');
select qa.no('A3 업체 상태 함수 부를 수 없음', $q$select public.upload_link_state((select v from qa.ids where k = 'P'), 'p31-client')$q$);
select qa.no('A3b 링크 만들기 부를 수 없음', $q$select public.upload_link_save((select v from qa.ids where k = 'P'), 'p31-client', '[]', 14, '')$q$);
select qa.no('A3c 받은 파일 정하기 부를 수 없음', $q$select public.upload_link_decide(gen_random_uuid(), 'accepted')$q$);
select qa.no('A3d 받은 파일 목록 부를 수 없음', $q$select public.upload_link_inbox((select v from qa.ids where k = 'P'))$q$);
select qa.no('A4 링크 표 읽기 막힘', $q$select count(*) from public.client_upload_links$q$);
select qa.no('A4b 받은 파일 표 읽기 막힘', $q$select count(*) from public.client_upload_files$q$);
select qa.no('A5 고른 서류 밖 칸 막힘', $q$select public.public_upload_reserve((select v from qa.ul where k = 'slug'), 'stockList', 'a.pdf', 1000, 'application/pdf')$q$);
select qa.no('A5b 실행 파일 막힘', $q$select public.public_upload_reserve((select v from qa.ul where k = 'slug'), 'bizReg', 'virus.exe', 1000, '')$q$);
select qa.no('A5c 형식 없는 이름 막힘', $q$select public.public_upload_reserve((select v from qa.ul where k = 'slug'), 'bizReg', 'noext', 1000, '')$q$);
select qa.no('A5d 0바이트 막힘', $q$select public.public_upload_reserve((select v from qa.ul where k = 'slug'), 'bizReg', 'a.pdf', 0, '')$q$);
select qa.no('A5e 20MB 넘음 막힘', $q$select public.public_upload_reserve((select v from qa.ul where k = 'slug'), 'bizReg', 'a.pdf', 20971521, '')$q$);
select qa.no('A5f 이름 없음 막힘', $q$select public.public_upload_reserve((select v from qa.ul where k = 'slug'), 'bizReg', '   ', 1000, '')$q$);
select qa.eq('A5g 없는 주소 예약 = closed', public.public_upload_reserve('00000000000000000000', 'bizReg', 'a.pdf', 1000, '')->>'status', 'closed');
insert into qa.ul select 'r1', public.public_upload_reserve(v, 'bizReg', '../../사업자등록증 최신.PDF', 123456, 'application/pdf')::text from qa.ul where k = 'slug';
insert into qa.ul select 'path1', (v::jsonb)->>'path' from qa.ul where k = 'r1';
insert into qa.ul select 'id1', (v::jsonb)->>'id' from qa.ul where k = 'r1';
select qa.eq('A6 예약 → 서버가 정한 경로(작업공간/업체/upload-link/링크/파일.pdf)', (select (v ~ ('^' || (select v::text from qa.ids where k = 'P') || '/p31-client/upload-link/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'))::text from qa.ul where k = 'path1'), 'true');
insert into qa.ul select 'path2', public.public_upload_reserve(v, '', '현장 사진.JPG', 2048, 'image/jpeg')->>'path' from qa.ul where k = 'slug';
select qa.eq('A7 그 밖의 서류(칸 없음)도 예약 · 형식은 소문자', (select (v ~ '\.jpg$')::text from qa.ul where k = 'path2'), 'true');
select qa.ok('A8 예약한 경로에 파일 넣기', $q$insert into storage.objects (bucket_id, name) values ('client-documents', (select v from qa.ul where k = 'path1'))$q$);
select qa.no('A8b 같은 폴더 다른 이름 막힘', $q$insert into storage.objects (bucket_id, name) values ('client-documents', regexp_replace((select v from qa.ul where k = 'path1'), '[^/]+$', 'evil.pdf'))$q$);
select qa.no('A8c 같은 업체 다른 폴더(서류 칸 폴더) 막힘', $q$insert into storage.objects (bucket_id, name) values ('client-documents', (select v::text from qa.ids where k = 'P') || '/p31-client/bizReg/x.pdf')$q$);
select qa.no('A8d 대표 작업공간 폴더 막힘', $q$insert into storage.objects (bucket_id, name) values ('client-documents', (select v::text from qa.ids where k = 'O') || '/o31-client/upload-link/x/y.pdf')$q$);
select qa.no('A8e 다른 보관함(bucket) 막힘', $q$insert into storage.objects (bucket_id, name) values ('public-files', (select v from qa.ul where k = 'path2'))$q$);
select qa.no('A8g 보관함 고치기(이름 바꾸기) 막힘', $q$update storage.objects set name = name || '.x' where bucket_id = 'client-documents'$q$);
select qa.eq('A9 아직 안 올린 파일 다 올림 = missing', (select public.public_upload_done(s.v, p.v) from qa.ul s, qa.ul p where s.k = 'slug' and p.k = 'path2'), 'missing');
select qa.eq('A10 다 올림 = ok · 두 번 알려도 ok', (select public.public_upload_done(s.v, p.v) || ' ' || public.public_upload_done(s.v, p.v) from qa.ul s, qa.ul p where s.k = 'slug' and p.k = 'path1'), 'ok ok');
select qa.no('A10b 다 올린 뒤 같은 경로에 다시 넣기(덮어쓰기) 막힘', $q$insert into storage.objects (bucket_id, name) values ('client-documents', (select v from qa.ul where k = 'path1'))$q$);
select qa.eq('A10c 다 올린 경로는 더 이상 넣기 허락 아님', (select public.upload_link_path_ok(v)::text from qa.ul where k = 'path1'), 'false');
select qa.no('A11 모르는 경로 다 올림 막힘', $q$select public.public_upload_done((select v from qa.ul where k = 'slug'), 'aaaa/bbbb.pdf')$q$);
select qa.no('A11b 다른 링크의 경로로 다 올림 막힘', $q$select public.public_upload_done((select v from qa.ul where k = 'oslug'), (select v from qa.ul where k = 'path1'))$q$);
select qa.eq('A12 공개 화면 올린 것 = 서류마다 개수만(파일 이름 0)', (select (x->>'key') || ':' || (x->>'n') || ' ' || (x ? 'name')::text from (select jsonb_array_elements(public.public_upload_form(v)->'sent') x from qa.ul where k = 'slug') y), 'bizReg:1 false');
-- 접속 주소 한도 · 링크 한도 · 전체 둑
select set_config('request.headers', '{"cf-connecting-ip":"9.9.9.9"}', false);
reset role;
insert into public.public_intake_log (kind, key_hash) select 'upload_link_ip', public.hash_access_token('9.9.9.9') from generate_series(1, 40);
set role anon;
select qa.no('A13 한 곳(접속 주소)에서 10분 40번 넘음 막힘', $q$select public.public_upload_reserve((select v from qa.ul where k = 'slug'), 'bizReg', 'a.pdf', 10, '')$q$);
select set_config('request.headers', '{"cf-connecting-ip":"8.8.8.8"}', false);
select qa.eq('A13b 다른 곳은 그대로', (select public.public_upload_reserve(v, 'bizReg', 'b.pdf', 10, '')->>'status' from qa.ul where k = 'slug'), 'ok');
select set_config('request.headers', '', false);
reset role;
insert into public.public_intake_log (kind, key_hash) select 'upload_link', public.hash_access_token(l.id::text) from public.client_upload_links l, generate_series(1, 40) where l.slug = (select v from qa.ul where k = 'slug');
set role anon;
select qa.no('A14 링크 하나 10분 40번 넘음 막힘', $q$select public.public_upload_reserve((select v from qa.ul where k = 'slug'), 'bizReg', 'a.pdf', 10, '')$q$);
select qa.eq('A14b 다른 링크는 그대로', (select public.public_upload_reserve(v, 'bizReg', 'b.pdf', 10, '')->>'status' from qa.ul where k = 'oslug'), 'ok');
reset role;
insert into qa.ul select 'oid', f.id::text from public.client_upload_files f where f.client_id = 'o31-client' limit 1;
delete from public.public_intake_log where kind like 'upload_link%';
insert into public.client_upload_files (link_id, workspace_id, client_id, file_name, storage_path)
  select l.id, l.workspace_id, l.client_id, 'f' || g || '.pdf', 'qa31/fill/' || g from public.client_upload_links l, generate_series(1, 80) g where l.slug = (select v from qa.ul where k = 'slug');
set role anon;
select qa.no('A15 링크 하나에 80개 넘음 막힘', $q$select public.public_upload_reserve((select v from qa.ul where k = 'slug'), 'bizReg', 'a.pdf', 10, '')$q$);
reset role;
delete from public.client_upload_files where storage_path like 'qa31/fill/%';
insert into public.public_intake_log (kind, key_hash) select 'upload_link', md5(g::text) from generate_series(1, 600) g;
set role anon;
select qa.no('A16 전체 둑(10분 600번) 넘음 막힘', $q$select public.public_upload_reserve((select v from qa.ul where k = 'oslug'), 'bizReg', 'a.pdf', 10, '')$q$);
reset role;
delete from public.public_intake_log where kind like 'upload_link%';
-- 닫힘: 기한 지남 · 사용 승인 끊긴 주인 · 지운 업체 · 30분 지난 예약
set role anon;
insert into qa.ul select 'path3', public.public_upload_reserve(v, 'fin', '재무제표.xlsx', 5000, '')->>'path' from qa.ul where k = 'slug';
reset role;
begin;
update public.client_upload_links set expires_at = now() - interval '1 minute' where slug = (select v from qa.ul where k = 'slug');
set role anon;
select qa.eq('A17 기한 지남: 화면 null · 예약 closed · 다 올림 closed · 넣기 허락 아님', coalesce((select public.public_upload_form(v)::text from qa.ul where k = 'slug'), 'null') || ' ' || (select public.public_upload_reserve(v, 'bizReg', 'a.pdf', 10, '')->>'status' from qa.ul where k = 'slug') || ' ' || (select public.public_upload_done(s.v, p.v) from qa.ul s, qa.ul p where s.k = 'slug' and p.k = 'path3') || ' ' || (select public.upload_link_path_ok(v)::text from qa.ul where k = 'path3'), 'null closed closed false');
reset role;
rollback;
begin;
delete from public.os_access where user_id = '19000000-0000-0000-0000-0000000000b1';
set role anon;
select qa.eq('A18 주인 사용 승인 끊김: 화면 null · 넣기 허락 아님', coalesce((select public.public_upload_form(v)::text from qa.ul where k = 'slug'), 'null') || ' ' || (select public.upload_link_path_ok(v)::text from qa.ul where k = 'path3'), 'null false');
reset role;
rollback;
begin;
delete from public.operations_clients where id = 'p31-client';
set role anon;
select qa.eq('A19 업체를 지우면: 화면 null', coalesce((select public.public_upload_form(v)::text from qa.ul where k = 'slug'), 'null'), 'null');
reset role;
rollback;
begin;
update public.client_upload_files set created_at = now() - interval '31 minutes' where storage_path = (select v from qa.ul where k = 'path3');
set role anon;
select qa.no('A20 30분 지난 예약 경로에 넣기 막힘', $q$insert into storage.objects (bucket_id, name) values ('client-documents', (select v from qa.ul where k = 'path3'))$q$);
reset role;
rollback;
set role anon;
select qa.eq('A21 30분 안 예약 경로는 넣기 허락', (select public.upload_link_path_ok(v)::text from qa.ul where k = 'path3'), 'true');
reset role;

-- ---------- 팀장 P — 받은 파일 보기 · 칸에 넣기 · 되돌리기 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P20 받은 파일 1(예약만 한 것은 안 보임) · 이름 · 칸 · 경로 · 크기', (select jsonb_array_length(s->'files')::text || ' ' || (s->'files'->0->>'fileName') || ' ' || (s->'files'->0->>'docKey') || ':' || (s->'files'->0->>'docLabel') || ' ' || ((s->'files'->0->>'storagePath') = (select v from qa.ul where k = 'path1'))::text || ' ' || (s->'files'->0->>'fileSize') || ' ' || (s->'link'->>'uploaded') from (select public.upload_link_state(v, 'p31-client') s from qa.ids where k = 'P') x), '1 .._.._사업자등록증 최신.PDF bizReg:사업자등록증 true 123456 1');
select qa.eq('P21 작업공간 목록 = 업체마다 기다리는 수', (select (x->>'clientId') || ':' || (x->>'waiting') from (select jsonb_array_elements(public.upload_link_inbox(v)) x from qa.ids where k = 'P') y), 'p31-client:1');
select qa.eq('P22 칸에 넣기 → changed · 두 번 눌러도 한 번', (select (public.upload_link_decide(v::uuid, 'accepted')->>'changed') || ' ' || (public.upload_link_decide(v::uuid, 'accepted')->>'changed') from qa.ul where k = 'id1'), 'true false');
select qa.eq('P23 넣은 뒤: 기다리는 파일 0 · 넣은 파일 1 · 목록 빈 칸', (select jsonb_array_length(s->'files')::text || ' ' || (s->>'accepted') from (select public.upload_link_state(v, 'p31-client') s from qa.ids where k = 'P') x) || ' ' || (select public.upload_link_inbox(v)::text from qa.ids where k = 'P'), '0 1 []');
select qa.eq('P24 되돌리기 → 다시 기다림 · 안 씀 → 목록에서 빠짐', (select (public.upload_link_decide(v::uuid, 'uploaded')->>'status') || ' ' || (public.upload_link_decide(v::uuid, 'dismissed')->>'status') || ' ' || (public.upload_link_decide(v::uuid, 'uploaded')->>'status') from qa.ul where k = 'id1'), 'uploaded dismissed uploaded');
select qa.no('P25 이상한 정하기 막힘', $q$select public.upload_link_decide((select v::uuid from qa.ul where k = 'id1'), 'deleted')$q$);
select qa.no('P26 아직 안 올라온(예약) 파일 정하기 막힘', $q$select public.upload_link_decide((select f.id from public.client_upload_files f where f.storage_path = (select v from qa.ul where k = 'path2')), 'accepted')$q$);
select qa.no('P27 없는 파일 정하기 막힘', $q$select public.upload_link_decide(gen_random_uuid(), 'accepted')$q$);
select qa.no('P28 남의(대표) 작업공간 파일 정하기 막힘', $q$select public.upload_link_decide((select v::uuid from qa.ul where k = 'oid'), 'dismissed')$q$);
reset role;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
select qa.no('R3 가입자: 팀장 파일 정하기 막힘', $q$select public.upload_link_decide((select v::uuid from qa.ul where k = 'id1'), 'accepted')$q$);
reset role;
select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-0000000000d1', false);
set role authenticated;
select qa.no('C3 외부 고객: 팀장 파일 정하기 막힘', $q$select public.upload_link_decide((select v::uuid from qa.ul where k = 'id1'), 'accepted')$q$);
reset role;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.no('O10 허락 없음: 팀장 파일 정하기 막힘', $q$select public.upload_link_decide((select v::uuid from qa.ul where k = 'id1'), 'accepted')$q$);
select qa.eq('O11 허락 없음: 팀장 받은 파일 줄 0', (select count(*)::text from public.client_upload_files where client_id = 'p31-client'), '0');
reset role;
-- 팀장이 7일 허락하면(0026) 대표도 그 동안은 다룬다
insert into public.workspace_view_grants (workspace_id, grantee_id, granted_by, expires_at)
  select v, '19000000-0000-0000-0000-0000000000a1', '19000000-0000-0000-0000-0000000000b1', now() + interval '7 days' from qa.ids where k = 'P';
set role authenticated;
select qa.eq('O12 허락 동안: 팀장 업체 상태 writer · 받은 파일 1', (select (s->>'role') || ' ' || jsonb_array_length(s->'files') from (select public.upload_link_state(v, 'p31-client') s from qa.ids where k = 'P') x), 'writer 1');
reset role;
update public.workspace_view_grants set revoked_at = now() where revoked_at is null;
set role authenticated;
select qa.eq('O13 허락 닫으면 다시 none', (select public.upload_link_state(v, 'p31-client')->>'role' from qa.ids where k = 'P'), 'none');
reset role;

-- ---------- 주소 새로 만들기 · 닫기 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
insert into qa.ul select 'slug2', public.upload_link_rotate(v, 'p31-client')->'link'->>'slug' from qa.ids where k = 'P';
select qa.eq('P30 새 주소 ≠ 예전 주소 · 받을 서류 그대로 · 받은 파일 그대로', (select (n.v <> o.v and n.v ~ '^[0-9a-f]{20}$')::text from qa.ul n, qa.ul o where n.k = 'slug2' and o.k = 'slug') || ' ' || (select jsonb_array_length(s->'link'->'docs')::text || ' ' || jsonb_array_length(s->'files') || ' ' || (s->>'closed') from (select public.upload_link_state(v, 'p31-client') s from qa.ids where k = 'P') x), 'true 2 1 1');
reset role;
set role anon;
select qa.eq('P31 예전 주소: 화면 null · 예약 closed · 새 주소는 열림', coalesce((select public.public_upload_form(v)::text from qa.ul where k = 'slug'), 'null') || ' ' || (select public.public_upload_reserve(v, 'bizReg', 'a.pdf', 10, '')->>'status' from qa.ul where k = 'slug') || ' ' || (select public.public_upload_form(v)->>'title' from qa.ul where k = 'slug2'), 'null closed (주)한빛정밀');
select qa.eq('P31b 예전 주소에서 예약한 경로도 넣기 허락 아님', (select public.upload_link_path_ok(v)::text from qa.ul where k = 'path3'), 'false');
reset role;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P32 닫기 → 링크 없음 · 받은 파일은 그대로', (select coalesce(s->>'link', '-') || ' ' || jsonb_array_length(s->'files') from (select public.upload_link_off(v, 'p31-client') s from qa.ids where k = 'P') x), '- 1');
select qa.no('P33 링크 없을 때 새 주소 만들기 막힘', $q$select public.upload_link_rotate((select v from qa.ids where k = 'P'), 'p31-client')$q$);
reset role;
set role anon;
select qa.eq('P34 닫은 뒤 새 주소도 화면 null', coalesce((select public.public_upload_form(v)::text from qa.ul where k = 'slug2'), 'null'), 'null');
reset role;

-- 정리: 다음 시험(격리)이 쓰지 않도록 이 시험이 만든 줄만 지운다(시험 DB)
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.headers', '', false);
delete from storage.objects where name like '%/upload-link/%';
delete from public.client_upload_links where client_id in ('p31-client', 'o31-client', 'c31-client');
delete from public.operations_clients where id in ('p31-client', 'o31-client', 'c31-client');
delete from public.public_intake_log where kind like 'upload_link%';
