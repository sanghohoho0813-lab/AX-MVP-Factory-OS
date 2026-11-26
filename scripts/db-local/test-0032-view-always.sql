-- L-27 보완 · D-675 대표가 '늘 보기' 로 정해 둔 내부 팀장 작업공간은 허락 없이도(0032) 시험 — 로컬 시험 DB(axqa)에서만. test-0026 다음에 돈다.
--   대표 O(a1 · full · 팀장 작업공간 편집자) · 내부 팀장 P(b1 · pilot · internal) · 가입자 R(c1) · 외부 고객 C(24…d1)
\set QUIET 1
\set ON_ERROR_STOP 1

-- 준비: 팀장이 열어 둔 허락을 모두 닫는다 · 고객 자료(업체 · 업체 걸린 모듈 기록 · 파일)가 있는지
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select public.view_consent_revoke((select v from qa.ids where k = 'P')) is not null as closed \gset
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into public.module_data (id, workspace_id, module_key, bucket, client_id, payload)
select 'p32-md-client', v, 'policy-funding', 'notes', 'p19-client', '{"t":"x"}'::jsonb from qa.ids where k = 'P' on conflict (id) do nothing;
insert into storage.objects (bucket_id, name, owner)
select 'client-documents', v::text || '/clients/p19-client/always.pdf', '19000000-0000-0000-0000-0000000000b1' from qa.ids where k = 'P'
  and not exists (select 1 from storage.objects where name like '%/clients/p19-client/always.pdf');
do $$ begin
  set local session_replication_role = replica;
  insert into public.portal_client_links (id, workspace_id, operations_client_id, profile_id)
  select '32000000-0000-0000-0000-00000000aa01', v, 'p19-client', '19000000-0000-0000-0000-0000000000c1' from qa.ids where k = 'P'
  on conflict do nothing;
end $$;
select qa.eq('준비: 늘 보기 표 · 함수 · 팀장 업체 1 · 업체 걸린 모듈 기록 1 · 파일 1',
  (to_regclass('public.workspace_view_always') is not null)::text || ' ' || (to_regprocedure('public.view_always_set(uuid, boolean)') is not null)::text || ' '
  || (select count(*)::text from public.operations_clients where id = 'p19-client') || ' ' || (select count(*)::text from public.module_data where id = 'p32-md-client') || ' '
  || (select count(*)::text from storage.objects where bucket_id = 'client-documents' and name like '%/clients/p19-client/always.pdf'), 'true true 1 1 1');

-- ---------- 대표 O · 켜기 전(0026 그대로) ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('A1 켜기 전: 닫힌 목록 = 팀장 작업공간 · 팀장 업체 0 · 상태 viewer · 켤 수 있음 · 늘 보기 없음',
  (select (public.view_consent_blocked_workspaces() = array[(select v from qa.ids where k = 'P')])::text) || ' '
  || (select count(*)::text from public.operations_clients where id = 'p19-client') || ' '
  || (select (s->>'role') || ' ' || (s->>'canAlways') || ' ' || coalesce(s->>'always', '-') from (select public.view_consent_state(v) s from qa.ids where k = 'P') x), 'true 0 viewer true -');
select qa.no('A2 늘 보기 표에 직접 넣기 막힘', $q$insert into public.workspace_view_always (workspace_id, viewer_id) select v, auth.uid() from qa.ids where k = 'P'$q$);
select qa.no('A3 내 작업공간(주인 본인)에는 켤 수 없음', $q$select public.view_always_set((select v from qa.ids where k = 'O'), true)$q$);
select qa.no('A4 외부 구독 고객 작업공간에는 켤 수 없음(구성원도 아님 — 0024)', $q$select public.view_always_set((select v from qa.ids where k = 'C'), true)$q$);
select qa.eq('A5 꺼져 있을 때 끄기 = 아무것도 안 함(기록 0줄)', (select coalesce(public.view_always_set(v, false)->>'always', '-') from qa.ids where k = 'P') || ' ' || (select count(*)::text from public.workspace_view_always), '- 0');

-- ---------- 대표 O · 켜기 ----------
-- (켜기 · 끄기와 그 뒤 확인은 문장을 나눈다 — 같은 문장 안의 stable 함수는 방금 바꾼 줄을 못 본다)
select qa.eq('A6 늘 보기 켜기 → 돌려준 상태에 켠 때', (select (s->'always'->>'since') is not null from (select public.view_always_set(v, true) s from qa.ids where k = 'P') x)::text, 'true');
select qa.eq('A6b 닫힌 목록 없음 · 상태 다시 읽어도 켜짐', (select cardinality(public.view_consent_blocked_workspaces())::text) || ' ' || (select ((public.view_consent_state(v)->'always'->>'since') is not null)::text from qa.ids where k = 'P'), '0 true');
select qa.eq('A7 허락 없이도 팀장 업체 · 업체 걸린 모듈 기록 · 서류 파일 · 고객 화면 연결 보임',
  (select count(*)::text from public.operations_clients where id = 'p19-client') || ' ' || (select count(*)::text from public.module_data where id = 'p32-md-client') || ' '
  || (select count(*)::text from storage.objects where bucket_id = 'client-documents' and name like '%/clients/p19-client/always.pdf') || ' '
  || (select count(*)::text from public.portal_client_links where id = '32000000-0000-0000-0000-00000000aa01')
  || ' ' || (select coalesce(s->>'active', '-') from (select public.view_consent_state(v) s from qa.ids where k = 'P') x), '1 1 1 1 -');
select qa.eq('A8 팀장 업체 고치기 = 1줄(편집자 그대로)', qa.rows($q$update public.operations_clients set company_name = 'P 고객사' where id = 'p19-client'$q$), '1');
select qa.ok('A9 고객 화면 미리 보기 열림', $q$select public.portal_preview_project('32000000-0000-0000-0000-00000000aa01')$q$);
select qa.eq('A10 두 번 켜도', (select (public.view_always_set(v, true)->'always') is not null from qa.ids where k = 'P')::text, 'true');
select qa.eq('A10b 켜진 줄 하나', (select count(*)::text from public.workspace_view_always where ended_at is null), '1');
select qa.no('A11 기록 고치기(끈 때 지우기 · 다른 사람으로) 막힘', $q$update public.workspace_view_always set viewer_id = '19000000-0000-0000-0000-0000000000c1'$q$);
select qa.no('A12 기록 지우기 막힘', $q$delete from public.workspace_view_always$q$);
reset role;

-- ---------- 팀장 P · 대표가 켜 둔 것을 본다(끌 수는 없다) ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('B1 팀장 상태: owner · 늘 보기(켠 때 · 누가) · 지난 기록 1 · 허락 없음',
  (select (s->>'role') || ' ' || ((s->'always'->>'since') is not null)::text || ' ' || ((s->'always'->>'by') <> '')::text || ' ' || jsonb_array_length(s->'alwaysHistory')::text || ' ' || coalesce(s->>'active', '-')
   from (select public.view_consent_state(v) s from qa.ids where k = 'P') x), 'owner true true 1 -');
select qa.no('B2 팀장이 늘 보기 끄기 막힘(대표만)', $q$select public.view_always_set((select v from qa.ids where k = 'P'), false)$q$);
select qa.no('B3 팀장이 스스로 켜기 막힘', $q$select public.view_always_set((select v from qa.ids where k = 'P'), true)$q$);
select qa.no('B4 팀장이 기록 고치기 막힘', $q$update public.workspace_view_always set ended_at = now()$q$);
select qa.eq('B5 팀장 [지금 닫기] 는 그대로 된다(허락 기록만 닫힘) · 자기 자료 그대로', (select (public.view_consent_revoke(v)->>'role') from qa.ids where k = 'P') || ' ' || (select count(*)::text from public.operations_clients where id = 'p19-client'), 'owner 1');
select qa.eq('B6 팀장에게 닫힌 목록 없음', (select cardinality(public.view_consent_blocked_workspaces())::text), '0');
reset role;

select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('A13 팀장이 닫아도 늘 보기 동안은 계속 보임', (select count(*)::text from public.operations_clients where id = 'p19-client') || ' ' || (select cardinality(public.view_consent_blocked_workspaces())::text), '1 0');
reset role;

-- ---------- 두 번째 내부 팀장 Q — 늘 보기는 켠 그 작업공간 하나에만(다른 팀장 작업공간은 그대로 닫힘) ----------
select set_config('request.jwt.claim.sub', '', false);
insert into auth.users (id, email) values ('32000000-0000-0000-0000-0000000000b2', 'q32@x.kr') on conflict do nothing;
insert into public.profiles (id, email) values ('32000000-0000-0000-0000-0000000000b2', 'q32@x.kr') on conflict (id) do update set email = excluded.email;
insert into public.os_access (user_id, tier) values ('32000000-0000-0000-0000-0000000000b2', 'pilot') on conflict (user_id) do update set tier = excluded.tier;
select set_config('request.jwt.claim.sub', '32000000-0000-0000-0000-0000000000b2', false);
set role authenticated;
insert into qa.ids select 'Q32', (public.create_workspace('두 번째 팀장')).id;
insert into public.operations_clients (id, workspace_id, company_name, payload) select 'q32-client', v, 'Q 고객사', '{}' from qa.ids where k = 'Q32';
reset role;
select set_config('request.jwt.claim.sub', '', false);
select public.os_access_link_owner_to_pilots() >= 0 as linked \gset
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('D1 다른 내부 팀장(Q): P 만 늘 보기 → 닫힌 목록 = Q 하나 · Q 업체 0 · P 업체 1 · Q 는 켤 수 있는 곳 · Q 에 켜진 것 없음',
  (select (public.view_consent_blocked_workspaces() = array[(select v from qa.ids where k = 'Q32')])::text) || ' '
  || (select count(*)::text from public.operations_clients where id = 'q32-client') || ' ' || (select count(*)::text from public.operations_clients where id = 'p19-client') || ' '
  || (select (s->>'canAlways') || ' ' || coalesce(s->>'always', '-') from (select public.view_consent_state(v) s from qa.ids where k = 'Q32') x), 'true 0 1 true -');
select qa.eq('D2 Q 에도 따로 켜기', (select (public.view_always_set(v, true)->'always') is not null from qa.ids where k = 'Q32')::text, 'true');
select qa.eq('D2b Q 업체 보임 · 켜진 줄 2(작업공간마다 하나) · 닫힌 목록 없음',
  (select count(*)::text from public.operations_clients where id = 'q32-client') || ' ' || (select count(*)::text from public.workspace_view_always where ended_at is null) || ' ' || (select cardinality(public.view_consent_blocked_workspaces())::text), '1 2 0');
select qa.eq('D3 Q 만 끄기', (select coalesce(public.view_always_set(v, false)->>'always', '-') from qa.ids where k = 'Q32'), '-');
select qa.eq('D3b Q 는 다시 0 · P 는 그대로 1 · 닫힌 목록 = Q 하나',
  (select count(*)::text from public.operations_clients where id = 'q32-client') || ' ' || (select count(*)::text from public.operations_clients where id = 'p19-client') || ' '
  || (select (public.view_consent_blocked_workspaces() = array[(select v from qa.ids where k = 'Q32')])::text), '0 1 true');
reset role;
select set_config('request.jwt.claim.sub', '32000000-0000-0000-0000-0000000000b2', false);
set role authenticated;
select qa.eq('D4 Q 에게는 자기 작업공간 기록만(1줄 · 끈 때 있음) · P 작업공간 기록 0 · P 업체 0',
  (select count(*)::text from public.workspace_view_always) || ' ' || (select count(*)::text from public.workspace_view_always where ended_at is not null) || ' '
  || (select count(*)::text from public.workspace_view_always where workspace_id = (select v from qa.ids where k = 'P')) || ' ' || (select count(*)::text from public.operations_clients where id = 'p19-client'), '1 1 0 0');
select qa.no('D5 Q 가 P 작업공간에 켜기 막힘(구성원도 대표도 아님)', $q$select public.view_always_set((select v from qa.ids where k = 'P'), true)$q$);
reset role;
-- Q 견본 치우기(아래 줄 수 · 다음 시험이 세는 것에 섞이지 않게)
select set_config('request.jwt.claim.sub', '', false);
delete from public.operations_clients where id = 'q32-client';
delete from public.workspaces where id = (select v from qa.ids where k = 'Q32');
delete from public.os_access where user_id = '32000000-0000-0000-0000-0000000000b2';
delete from public.profiles where id = '32000000-0000-0000-0000-0000000000b2';
delete from auth.users where id = '32000000-0000-0000-0000-0000000000b2';
delete from qa.ids where k = 'Q32';
select qa.eq('D6 Q 견본을 치운 뒤: 늘 보기 줄은 P 것 하나(켜짐) · 작업공간 · 계정 0',
  (select count(*)::text from public.workspace_view_always) || ' ' || (select count(*)::text from public.workspace_view_always where ended_at is null) || ' '
  || (select count(*)::text from public.workspaces where name = '두 번째 팀장') || ' ' || (select count(*)::text from public.os_access where user_id = '32000000-0000-0000-0000-0000000000b2'), '1 1 0 0');

-- ---------- 다른 사람 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
select qa.no('R1 가입자: 켜기 막힘', $q$select public.view_always_set((select v from qa.ids where k = 'P'), true)$q$);
select qa.eq('R2 가입자: 기록 0줄 · 상태 none', (select count(*)::text from public.workspace_view_always) || ' ' || (select public.view_consent_state(v)->>'role' from qa.ids where k = 'P'), '0 none');
reset role;
select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-0000000000d1', false);
set role authenticated;
select qa.no('C1 외부 고객: 팀장 작업공간 켜기 막힘', $q$select public.view_always_set((select v from qa.ids where k = 'P'), true)$q$);
select qa.no('C2 외부 고객: 자기 작업공간 켜기 막힘(대표가 아님)', $q$select public.view_always_set((select v from qa.ids where k = 'C'), true)$q$);
select qa.eq('C3 외부 고객: 자기 상태에 늘 보기 없음 · 기록 0줄', (select coalesce(public.view_consent_state(v)->>'always', '-') from qa.ids where k = 'C') || ' ' || (select count(*)::text from public.workspace_view_always), '- 0');
reset role;
set role anon;
select qa.no('X1 로그인 없는 사람: 켜기 함수 실행 불가', $q$select public.view_always_set('00000000-0000-0000-0000-000000000000', true)$q$);
select qa.no('X2 로그인 없는 사람: 기록 표 읽기 불가', $q$select count(*) from public.workspace_view_always$q$);
reset role;

-- 팀장이 외부 고객(customer)으로 바뀐 것처럼 되면 켜 둔 줄이 있어도 닫힌다(늘 보기는 내부 팀장만) — 서버 작업으로 칸만 잠깐 바꿔 본다
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  set local session_replication_role = replica;
  update public.os_access set audience = 'customer' where user_id = '19000000-0000-0000-0000-0000000000b1';
end $$;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('A14 내부 팀장이 아니면 켜 둔 줄이 있어도 닫힘 · 상태에 늘 보기 없음 · 켤 수 없음',
  (select count(*)::text from public.operations_clients where id = 'p19-client') || ' ' || (select coalesce(s->>'always', '-') || ' ' || (s->>'canAlways') from (select public.view_consent_state(v) s from qa.ids where k = 'P') x), '0 - false');
select qa.no('A15 내부 팀장이 아니면 켜기 막힘', $q$select public.view_always_set((select v from qa.ids where k = 'P'), true)$q$);
reset role;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  set local session_replication_role = replica;
  update public.os_access set audience = 'internal' where user_id = '19000000-0000-0000-0000-0000000000b1';
end $$;

-- ---------- 대표 O · 끄기 → 0026 으로 돌아감 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('A16 끄기 → 돌려준 상태에 늘 보기 없음', (select coalesce(public.view_always_set(v, false)->>'always', '-') from qa.ids where k = 'P'), '-');
select qa.eq('A16b 다시 닫힘 · 팀장 업체 0 · 업체 걸린 모듈 기록 0 · 파일 0', (select cardinality(public.view_consent_blocked_workspaces())::text) || ' ' || (select count(*)::text from public.operations_clients where id = 'p19-client') || ' '
  || (select count(*)::text from public.module_data where id = 'p32-md-client') || ' ' || (select count(*)::text from storage.objects where bucket_id = 'client-documents' and name like '%/clients/p19-client/always.pdf'), '1 0 0 0');
select qa.eq('A17 기록은 남는다(끈 때) · 켜진 줄 0', (select count(*)::text from public.workspace_view_always where ended_at is not null) || ' ' || (select count(*)::text from public.workspace_view_always where ended_at is null), '1 0');
select qa.eq('A18 다시 켜기', (select (public.view_always_set(v, true)->'always') is not null from qa.ids where k = 'P')::text, 'true');
select qa.eq('A18b 새 줄(기록 2 — 예전 줄은 그대로) · 다시 보임', (select count(*)::text from public.workspace_view_always) || ' ' || (select count(*)::text from public.operations_clients where id = 'p19-client'), '2 1');
select qa.eq('A19 시험 끝 — 끄기(다음 시험은 0026 상태에서)', (select coalesce(public.view_always_set(v, false)->>'always', '-') from qa.ids where k = 'P'), '-');
reset role;
select set_config('request.jwt.claim.sub', '', false);
-- 견본 치우기(다음 시험이 세는 줄에 섞이지 않게)
delete from storage.objects where name like '%/clients/p19-client/always.pdf';
delete from public.module_data where id = 'p32-md-client';
do $$ begin
  set local session_replication_role = replica;
  delete from public.portal_client_links where id = '32000000-0000-0000-0000-00000000aa01';
end $$;
