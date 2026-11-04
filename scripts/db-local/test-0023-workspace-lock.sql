-- D-530 SAFE-2 작업공간 고정(0023) 시험 — 로컬 시험 DB(axqa)에서만. test-0019 · 0020 다음에 돈다(대표 O 주인 · 팀장 P 작업공간 편집자).
\set QUIET 1
\set ON_ERROR_STOP 1
select set_config('request.jwt.claim.sub', '', false);
select qa.eq('준비: 업무 표 장치 붙음(업체 · 모듈 기록 · 업무 일기 포함)', (select count(*)::text from pg_trigger g join pg_class c on c.oid = g.tgrelid where g.tgname = 'zz_workspace_id_lock' and c.relname in ('operations_clients', 'module_data', 'ops_journal_entries')), '3');
-- 대표 작업공간에 업체 · 모듈 기록 하나씩(서버 작업으로)
insert into public.operations_clients (id, workspace_id, company_name, payload) select 'o23-client', v, '대표 업체 23', '{}' from qa.ids where k = 'O' on conflict (id) do nothing;
insert into public.module_data (id, workspace_id, module_key, bucket, payload) select 'o23-md', v, 'employment', 'staff', '{"name":"직원"}' from qa.ids where k = 'O' on conflict (id) do nothing;

-- 대표 O: 대표 작업공간 주인 + 팀장 작업공간 편집자 — 두 곳 다 쓸 수 있는 사람
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O: 팀장 작업공간에도 쓸 수 있다(0020 편집자)', (select public.can_write_workspace(v)::text from qa.ids where k = 'P'), 'true');
-- D-530 사고 재현: 같은 id 로 팀장 작업공간에 upsert → 예전에는 옮겨졌다
select qa.no('O: 같은 id upsert 로 대표 업체를 팀장 작업공간으로 옮기기', $q$insert into public.operations_clients (id, workspace_id, company_name, payload) select 'o23-client', v, '대표 업체 23', '{}' from qa.ids where k = 'P' on conflict (id) do update set workspace_id = excluded.workspace_id, company_name = excluded.company_name$q$);
select qa.no('O: update 로 업체 작업공간 바꾸기', $q$update public.operations_clients set workspace_id = (select v from qa.ids where k = 'P') where id = 'o23-client'$q$);
select qa.no('O: 모듈 기록을 팀장 작업공간으로 옮기기', $q$update public.module_data set workspace_id = (select v from qa.ids where k = 'P') where id = 'o23-md'$q$);
select qa.no('O: 모듈 기록 upsert 로 옮기기', $q$insert into public.module_data (id, workspace_id, module_key, bucket, payload) select 'o23-md', v, 'employment', 'staff', '{}' from qa.ids where k = 'P' on conflict (id) do update set workspace_id = excluded.workspace_id$q$);
-- 앱이 쓰는 길은 그대로
select qa.ok('O: 같은 작업공간 안 업체 고치기(이름 · 내용)', $q$update public.operations_clients set company_name = '대표 업체 23 고침', payload = '{"memo":"ok"}' where id = 'o23-client'$q$);
select qa.ok('O: 고치기에 같은 workspace_id 를 함께 보내도 된다(앱 모양)', $q$update public.operations_clients set workspace_id = (select v from qa.ids where k = 'O'), company_name = '대표 업체 23' where id = 'o23-client'$q$);
select qa.ok('O: 같은 작업공간 upsert(백업 불러오기 같은 작업공간)', $q$insert into public.operations_clients (id, workspace_id, company_name, payload) select 'o23-client', v, '대표 업체 23', '{}' from qa.ids where k = 'O' on conflict (id) do update set workspace_id = excluded.workspace_id, company_name = excluded.company_name$q$);
select qa.ok('O: 모듈 기록 저장(saveRow 와 같은 upsert)', $q$insert into public.module_data (id, workspace_id, module_key, bucket, payload, updated_at) select 'o23-md', v, 'employment', 'staff', '{"name":"직원2"}', now() from qa.ids where k = 'O' on conflict (id) do update set payload = excluded.payload, updated_at = excluded.updated_at, workspace_id = excluded.workspace_id$q$);
select qa.ok('O: 새 업체 넣기', $q$insert into public.operations_clients (id, workspace_id, company_name, payload) select 'o23-new', v, '새 업체', '{}' from qa.ids where k = 'O'$q$);
select qa.ok('O: 업체 지우기', $q$delete from public.operations_clients where id = 'o23-new'$q$);
reset role;
select qa.eq('결과: 대표 업체는 대표 작업공간 그대로', (select (workspace_id = (select v from qa.ids where k = 'O'))::text from public.operations_clients where id = 'o23-client'), 'true');
select qa.eq('결과: 모듈 기록도 대표 작업공간 그대로', (select (workspace_id = (select v from qa.ids where k = 'O'))::text from public.module_data where id = 'o23-md'), 'true');

-- 팀장 P: 자기 업체를 대표 작업공간으로 밀어 넣기 — 원래 RLS 로도 막히고 장치로도 막힌다
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.no('P: 자기 업체를 대표 작업공간으로 옮기기', $q$update public.operations_clients set workspace_id = (select v from qa.ids where k = 'O') where id = 'p19-client'$q$);
select qa.ok('P: 자기 업체 고치기는 된다', $q$update public.operations_clients set company_name = 'P 고객사' where id = 'p19-client'$q$);
reset role;

-- 서버 작업(SQL Editor)은 막지 않는다 — 대표가 직접 옮겨야 할 때
select set_config('request.jwt.claim.sub', '', false);
select qa.ok('서버 작업: SQL Editor 에서는 옮길 수 있다(로그인한 사람 없음)', $q$update public.module_data set workspace_id = (select v from qa.ids where k = 'P') where id = 'o23-md'$q$);
update public.module_data set workspace_id = (select v from qa.ids where k = 'O') where id = 'o23-md';
delete from public.module_data where id = 'o23-md';
delete from public.operations_clients where id = 'o23-client';
