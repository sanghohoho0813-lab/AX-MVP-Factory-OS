-- D-164 대표가 팀장 화면 보기(0020) 시험 — 로컬 시험 DB(axqa)에서만. test-0019 다음에 돈다(그 사람 · 작업공간을 쓴다).
\set QUIET 1
\set ON_ERROR_STOP 1
-- 서버 작업(SQL Editor 와 같음): 대표를 Pilot 작업공간 편집자로
select set_config('request.jwt.claim.sub', '', false);
select qa.eq('연결: 대표가 Pilot 작업공간 편집자로 1줄', public.os_access_link_owner_to_pilots()::text, '1');
select qa.eq('연결: 두 번 해도 늘지 않음', public.os_access_link_owner_to_pilots()::text, '0');

-- 대표 O: 팀장 화면 목록 · 팀장 업체 보임
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O: 볼 수 있는 팀장 화면 = Pilot 작업공간 하나', (select count(*)::text from public.my_pilot_views()), '1');
select qa.eq('O: 그 작업공간 = Pilot 작업공간', (select (workspace_id = (select v from qa.ids where k = 'P'))::text from public.my_pilot_views()), 'true');
select qa.eq('O: 팀장 업체가 보인다(편집자)', (select count(*)::text from public.operations_clients where id = 'p19-client'), '1');
select qa.no('O: 연결 함수를 앱에서 부를 수 없음', $q$select public.os_access_link_owner_to_pilots()$q$);
reset role;

-- 팀장 P: 대표 화면 목록 없음 · 대표 작업공간은 여전히 0
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P: 팀장 화면 목록 없음(pilot)', (select count(*)::text from public.my_pilot_views()), '0');
select qa.eq('P: 대표 작업공간 업체 0(대표가 내 작업공간에 들어와도)', (select count(*)::text from public.operations_clients c join qa.ids i on i.v = c.workspace_id and i.k = 'O'), '0');
select qa.eq('P: 작업공간 목록 = 자기 것 하나', (select count(*)::text from public.workspaces), '1');
select qa.no('P: 연결 함수를 부를 수 없음', $q$select public.os_access_link_owner_to_pilots()$q$);
-- 대표 줄(내 작업공간 안)의 사람을 다른 사람으로 바꿔 초대 없이 들이기 — 막힘
select qa.no('P: 대표 구성원 줄의 user_id 를 다른 사람으로 바꿀 수 없음', $q$update public.workspace_members set user_id = '19000000-0000-0000-0000-0000000000c1' where workspace_id = (select v from qa.ids where k = 'P') and user_id = '19000000-0000-0000-0000-0000000000a1'$q$);
select qa.no('P: 구성원 줄을 다른 작업공간으로 옮길 수 없음', $q$update public.workspace_members set workspace_id = (select v from qa.ids where k = 'O') where workspace_id = (select v from qa.ids where k = 'P') and user_id = '19000000-0000-0000-0000-0000000000a1'$q$);
reset role;
select qa.eq('P: 그래도 대표 줄은 그대로(편집자)', (select role::text from public.workspace_members where workspace_id = (select v from qa.ids where k = 'P') and user_id = '19000000-0000-0000-0000-0000000000a1'), 'editor');
select qa.eq('P: 가입자 R 은 팀장 작업공간에 들어가지 않음', (select count(*)::text from public.workspace_members where workspace_id = (select v from qa.ids where k = 'P') and user_id = '19000000-0000-0000-0000-0000000000c1'), '0');
set role authenticated;
-- 역할 바꾸기는 지금처럼 된다(앱이 쓰는 길)
update public.workspace_members set role = 'viewer' where workspace_id = (select v from qa.ids where k = 'P') and user_id = '19000000-0000-0000-0000-0000000000a1';
reset role;
select qa.eq('P: 역할 바꾸기는 된다(앱 그대로)', (select role::text from public.workspace_members where workspace_id = (select v from qa.ids where k = 'P') and user_id = '19000000-0000-0000-0000-0000000000a1'), 'viewer');
update public.workspace_members set role = 'editor' where workspace_id = (select v from qa.ids where k = 'P') and user_id = '19000000-0000-0000-0000-0000000000a1';

-- 가입자 R · 로그인 안 한 사람
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
select qa.eq('R: 팀장 화면 목록 없음', (select count(*)::text from public.my_pilot_views()), '0');
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select qa.no('anon: 팀장 화면 목록 부를 수 없음', $q$select * from public.my_pilot_views()$q$);
reset role;
