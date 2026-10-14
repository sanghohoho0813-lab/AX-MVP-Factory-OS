-- 대표 AI 작업실(0021) 시험 — 로컬 시험 DB(axqa)에서만. test-0019 · 0020 다음에 돈다(그 사람 · 작업공간을 쓴다).
--   O = 대표(full · 권한) · P = 팀장(Pilot — 권한 줄을 실수로 넣어도 열리면 안 됨) · S = 대표가 초대한 직원(full · 권한 없음) · R = 공개 가입자
\set QUIET 1
\set ON_ERROR_STOP 1

-- ---------- 서버(SQL Editor 와 같음) ----------
select set_config('request.jwt.claim.sub', '', false);
select qa.eq('서버: 로그인 안 한 사람은 권한 없음', public.has_capability('can_use_owner_ai_workspace')::text, 'false');
-- 처음 권한 함수: 상담신청 받는 작업공간 주인이 full 이면 그 사람만(이름 · 이메일 아님)
select public.owner_ai_seed_owner();
select qa.eq('서버: 처음 권한은 상담신청 받는 작업공간 주인(full)에게만',
  (select count(*)::text from public.user_capabilities c where c.capability = 'can_use_owner_ai_workspace'
     and c.user_id <> (select w.owner_id from public.workspaces w where w.id = public.default_intake_workspace())), '0');
select qa.eq('서버: 처음 권한 함수 두 번 불러도 늘지 않음', public.owner_ai_seed_owner()::text, '0');
insert into public.user_capabilities (user_id, capability, note) values
  ('19000000-0000-0000-0000-0000000000a1', 'can_use_owner_ai_workspace', 'qa 대표'),
  ('19000000-0000-0000-0000-0000000000b1', 'can_use_owner_ai_workspace', 'qa 실수로 Pilot 에게')
on conflict (user_id, capability) do nothing;
insert into public.operations_clients (id, workspace_id, company_name, payload)
select 'o21-client', v, 'O 고객사', '{}' from qa.ids where k = 'O' on conflict (id) do nothing;
insert into public.operations_clients (id, workspace_id, company_name, payload)
select 'o21-client2', v, 'O 고객사2', '{}' from qa.ids where k = 'O' on conflict (id) do nothing;

-- ---------- 대표 O ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O: 권한 있음', public.has_capability('can_use_owner_ai_workspace')::text, 'true');
select qa.eq('O: 내 권한 목록', array_to_string(public.my_capabilities(), ','), 'can_use_owner_ai_workspace');
select qa.ok('O: 업체 Case 만들기(고객 아님 · 동료 요청)', $q$insert into public.company_cases (id, workspace_id, owner_id, company_name, relation, biz_no) select 'case_qa21aaaa', v, auth.uid(), '동료요청 주식회사', 'peer_request', '1234567890' from qa.ids where k = 'O'$q$);
select qa.ok('O: 기존 고객과 이은 Case', $q$insert into public.company_cases (id, workspace_id, owner_id, company_name, relation, client_id) select 'case_qa21bbbb', v, auth.uid(), 'O 고객사', 'contracted', 'o21-client' from qa.ids where k = 'O'$q$);
select qa.no('O: 같은 고객에 Case 하나 더(중복)', $q$insert into public.company_cases (id, workspace_id, owner_id, company_name, client_id) select 'case_qa21cccc', v, auth.uid(), 'O 고객사 또', 'o21-client' from qa.ids where k = 'O'$q$);
select qa.no('O: 같은 사업자번호 Case 하나 더(중복)', $q$insert into public.company_cases (id, workspace_id, owner_id, company_name, biz_no) select 'case_qa21dddd', v, auth.uid(), '이름만 다름', '1234567890' from qa.ids where k = 'O'$q$);
select qa.no('O: 다른 작업공간 고객을 이을 수 없음', $q$insert into public.company_cases (id, workspace_id, owner_id, company_name, client_id) select 'case_qa21eeee', v, auth.uid(), 'X', 'p19-client' from qa.ids where k = 'O'$q$);
select qa.no('O: 남의 이름(owner_id)으로 만들 수 없음', $q$insert into public.company_cases (id, workspace_id, owner_id, company_name) select 'case_qa21ffff', v, '19000000-0000-0000-0000-0000000000e1', 'X' from qa.ids where k = 'O'$q$);
select qa.no('O: 이상한 아이디 막힘', $q$insert into public.company_cases (id, workspace_id, owner_id, company_name) select 'x', v, auth.uid(), 'X' from qa.ids where k = 'O'$q$);
select qa.ok('O: 관계 상태 바꾸기', $q$update public.company_cases set relation = 'proposing' where id = 'case_qa21aaaa'$q$);
select qa.no('O: 없는 관계 상태', $q$update public.company_cases set relation = 'vip' where id = 'case_qa21aaaa'$q$);
select qa.no('O: Case 작업공간 옮기기 막힘', $q$update public.company_cases set workspace_id = (select v from qa.ids where k = 'P') where id = 'case_qa21aaaa'$q$);
select qa.ok('O: 보관(지우지 않음)', $q$update public.company_cases set archived_at = now() where id = 'case_qa21bbbb'$q$);
select qa.ok('O: 보관하면 같은 고객에 새 Case 가능', $q$insert into public.company_cases (id, workspace_id, owner_id, company_name, client_id) select 'case_qa21gggg', v, auth.uid(), 'O 고객사', 'o21-client' from qa.ids where k = 'O'$q$);
select qa.no('O: Case 지우기 막힘', $q$delete from public.company_cases where id = 'case_qa21aaaa'$q$);
select qa.eq('O: Case 지우기는 안 됨(그대로 있음)', (select count(*)::text from public.company_cases where id = 'case_qa21aaaa'), '1');

-- 기억(버전) — 덧붙이기만
select qa.ok('O: 기억 v1', $q$insert into public.company_context_snapshots (case_id, version, content, source) values ('case_qa21aaaa', 1, '{"oneLine":"v1"}', 'manual')$q$);
select qa.ok('O: 기억 v2', $q$insert into public.company_context_snapshots (case_id, version, content, source) values ('case_qa21aaaa', 2, '{"oneLine":"v2"}', 'run:adopt')$q$);
select qa.no('O: 같은 버전 둘 막힘', $q$insert into public.company_context_snapshots (case_id, version, content) values ('case_qa21aaaa', 2, '{}')$q$);
select qa.no('O: 예전 기억 고치기 막힘', $q$update public.company_context_snapshots set content = '{"oneLine":"덮어쓰기"}' where case_id = 'case_qa21aaaa' and version = 1$q$);
select qa.no('O: 기억 지우기 막힘', $q$delete from public.company_context_snapshots where case_id = 'case_qa21aaaa'$q$);
select qa.eq('O: 예전 기억은 고쳐지지도 지워지지도 않음', (select string_agg(content->>'oneLine', ',' order by version) from public.company_context_snapshots where case_id = 'case_qa21aaaa'), 'v1,v2');

-- AI 실행 기록 — 결과는 고칠 수 없고 평가만
select qa.ok('O: 실행 기록 넣기', $q$insert into public.ai_runs (id, company_case_id, skill_id, skill_version, input, structured_output, rendered_output, provider, model, tier, status, request_id, token_usage) values ('21000000-0000-0000-0000-00000000aa01', 'case_qa21aaaa', 'AX_PENGUIN', 1, '{"task":"x"}', '{"oneLine":"y"}', '# y', 'openai', 'm-deep', 'deep', 'succeeded', 'req-qa21-0001', '{"input":10,"output":20}')$q$);
select qa.no('O: 같은 요청 번호로 또 넣기(두 번 눌림) 막힘', $q$insert into public.ai_runs (company_case_id, skill_id, skill_version, provider, status, request_id) values ('case_qa21aaaa', 'AX_PENGUIN', 1, 'openai', 'succeeded', 'req-qa21-0001')$q$);
select qa.ok('O: 채택', $q$update public.ai_runs set evaluation = 'adopted', evaluated_at = now() where id = '21000000-0000-0000-0000-00000000aa01'$q$);
select qa.no('O: 없는 평가', $q$update public.ai_runs set evaluation = 'great' where id = '21000000-0000-0000-0000-00000000aa01'$q$);
select qa.no('O: 결과 고치기 막힘', $q$update public.ai_runs set rendered_output = '바꿈' where id = '21000000-0000-0000-0000-00000000aa01'$q$);
select qa.no('O: 토큰 · 비용 고치기 막힘', $q$update public.ai_runs set token_usage = '{"input":0}' where id = '21000000-0000-0000-0000-00000000aa01'$q$);
select qa.no('O: 실행 기록 지우기 막힘', $q$delete from public.ai_runs where id = '21000000-0000-0000-0000-00000000aa01'$q$);
select qa.eq('O: 실행 기록 지우기 안 됨', (select count(*)::text from public.ai_runs where id = '21000000-0000-0000-0000-00000000aa01'), '1');
select qa.ok('O: 고친 글 1', $q$insert into public.ai_output_revisions (original_run_id, revision_no, content) values ('21000000-0000-0000-0000-00000000aa01', 1, '{"text":"r1"}')$q$);
select qa.ok('O: 고친 글 2', $q$insert into public.ai_output_revisions (original_run_id, revision_no, content) values ('21000000-0000-0000-0000-00000000aa01', 2, '{"text":"r2"}')$q$);
select qa.no('O: 고친 글 덮어쓰기 막힘', $q$update public.ai_output_revisions set content = '{"text":"덮어쓰기"}' where revision_no = 1$q$);
select qa.eq('O: 고친 글 이력은 그대로', (select string_agg(content->>'text', ',' order by revision_no) from public.ai_output_revisions where original_run_id = '21000000-0000-0000-0000-00000000aa01'), 'r1,r2');
select qa.no('O: 스스로 권한 넣기 막힘', $q$insert into public.user_capabilities (user_id, capability) values ('19000000-0000-0000-0000-0000000000e1', 'can_use_owner_ai_workspace')$q$);
reset role;

-- ---------- 팀장 P(권한 줄이 실수로 있어도) ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P: 권한 줄이 있어도 Pilot 이면 false', public.has_capability('can_use_owner_ai_workspace')::text, 'false');
select qa.eq('P: 내 권한 목록 비어 있음', array_to_string(public.my_capabilities(), ','), '');
select qa.eq('P: 업체 Case 0', (select count(*)::text from public.company_cases), '0');
select qa.eq('P: 기억 0', (select count(*)::text from public.company_context_snapshots), '0');
select qa.eq('P: 실행 기록 0', (select count(*)::text from public.ai_runs), '0');
select qa.eq('P: 고친 글 0', (select count(*)::text from public.ai_output_revisions), '0');
select qa.no('P: 자기 작업공간에 Case 만들기', $q$insert into public.company_cases (id, workspace_id, owner_id, company_name) select 'case_qa21pppp', v, auth.uid(), 'P 업체' from qa.ids where k = 'P'$q$);
select qa.no('P: 대표 Case 에 실행 기록 넣기', $q$insert into public.ai_runs (company_case_id, skill_id, skill_version, provider, status) values ('case_qa21aaaa', 'AX_PENGUIN', 1, 'openai', 'succeeded')$q$);
select qa.no('P: 대표 Case 에 기억 넣기', $q$insert into public.company_context_snapshots (case_id, version, content) values ('case_qa21aaaa', 9, '{}')$q$);
update public.company_cases set company_name = 'P 가 바꿈' where id = 'case_qa21aaaa';
update public.ai_runs set evaluation = 'rejected' where id = '21000000-0000-0000-0000-00000000aa01';
reset role;
select qa.eq('P: 대표 Case · 평가를 바꾸지 못함', (select company_name || '/' || (select evaluation from public.ai_runs where id = '21000000-0000-0000-0000-00000000aa01') from public.company_cases where id = 'case_qa21aaaa'), '동료요청 주식회사/adopted');

-- ---------- 대표 직원 S(full · 권한 없음) ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000e1', false);
set role authenticated;
select qa.eq('S: 등급 full 이어도 권한 없으면 false', public.has_capability('can_use_owner_ai_workspace')::text, 'false');
select qa.eq('S: 대표 Case 0', (select count(*)::text from public.company_cases), '0');
select qa.eq('S: 실행 기록 0', (select count(*)::text from public.ai_runs), '0');
select qa.no('S: 대표 작업공간에 Case 만들기', $q$insert into public.company_cases (id, workspace_id, owner_id, company_name) select 'case_qa21ssss', v, auth.uid(), 'S 업체' from qa.ids where k = 'O'$q$);
reset role;

-- ---------- 공개 가입자 R · 로그인 안 한 사람 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
select qa.eq('R: 권한 없음', public.has_capability('can_use_owner_ai_workspace')::text, 'false');
select qa.eq('R: Case 0', (select count(*)::text from public.company_cases), '0');
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select qa.no('anon: Case 읽기', $q$select count(*) from public.company_cases$q$);
select qa.no('anon: 권한 함수', $q$select public.has_capability('can_use_owner_ai_workspace')$q$);
select qa.no('anon: 처음 권한 함수', $q$select public.owner_ai_seed_owner()$q$);
reset role;

-- ---------- 권한을 빼면(SQL Editor) 대표도 닫히고, 데이터는 그대로 ----------
delete from public.user_capabilities where user_id = '19000000-0000-0000-0000-0000000000a1' and capability = 'can_use_owner_ai_workspace';
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O: 권한을 빼면 Case 0(화면 · 데이터 닫힘)', (select count(*)::text from public.company_cases), '0');
reset role;
select qa.eq('서버: 데이터는 그대로', (select count(*)::text from public.company_cases where owner_id = '19000000-0000-0000-0000-0000000000a1'), '3');
insert into public.user_capabilities (user_id, capability, note) values ('19000000-0000-0000-0000-0000000000a1', 'can_use_owner_ai_workspace', 'qa 다시') on conflict do nothing;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O: 다시 주면 다시 보임', (select count(*)::text from public.company_cases), '3');
reset role;
-- 다음 시험(pilot-isolation)이 쓰지 않게 실수로 넣은 Pilot 권한 줄은 뺀다
delete from public.user_capabilities where user_id = '19000000-0000-0000-0000-0000000000b1';
