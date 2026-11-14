-- L-27 · D-608 대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만(0026) 시험 — 로컬 시험 DB(axqa)에서만. test-0019 · 0020 · 0024 다음에 돈다.
--   대표 O(a1 · full · 팀장 작업공간 편집자) · 내부 팀장 P(b1 · pilot) · 가입자 R(c1) · 외부 고객 C(24…d1)
\set QUIET 1
\set ON_ERROR_STOP 1
create or replace function qa.rows(q text) returns text language plpgsql as $$ declare n int; begin execute q; get diagnostics n = row_count; return n::text; end $$;
grant execute on function qa.rows(text) to authenticated;

-- 준비(서버 작업 · 로그인 없음): 팀장 작업공간에 고객 자료 · 마케팅 기록 · 서류 파일 · 고객 화면 연결
select set_config('request.jwt.claim.sub', '', false);
insert into public.module_data (id, workspace_id, module_key, bucket, client_id, payload)
select x.id, (select v from qa.ids where k = 'P'), x.mk, x.b, x.c, '{"t":"x"}'::jsonb
from (values
  ('p26-md-client', 'policy-funding', 'notes', 'p19-client'),
  ('p26-md-emp', 'employment', 'employees', null),
  ('p26-md-mkc', 'marketing', 'threads', 'p19-client'),
  ('p26-md-mk', 'marketing', 'threads', null),
  ('p26-md-brand', 'brand', 'profile', null),
  ('p26-md-fb', 'feedback', 'responses', null)) as x(id, mk, b, c)
on conflict (id) do nothing;
insert into storage.objects (bucket_id, name, owner)
select 'client-documents', v::text || '/clients/p19-client/biz.pdf', '19000000-0000-0000-0000-0000000000b1' from qa.ids where k = 'P';
do $$ begin
  set local session_replication_role = replica;
  insert into public.portal_client_links (id, workspace_id, operations_client_id, profile_id)
  select '26000000-0000-0000-0000-00000000aa01', v, 'p19-client', '19000000-0000-0000-0000-0000000000c1' from qa.ids where k = 'P'
  on conflict do nothing;
end $$;
select qa.eq('준비: 문이 달린 표(고객 자료) 15개 이상 · 모듈 기록 문 1 · 파일 문 1',
  ((select count(*) from pg_policies where schemaname = 'public' and policyname = 'zz View consent gate' and tablename <> 'module_data') >= 15)::text || ' '
  || (select count(*)::text from pg_policies where schemaname = 'public' and policyname = 'zz View consent gate' and tablename = 'module_data') || ' '
  || (select count(*)::text from pg_policies where schemaname = 'storage' and policyname = 'zz View consent gate client documents'), 'true 1 1');
select qa.eq('준비: 업무 일기 · 상품표 · 구성원 · 공개 공고는 문 없음',
  (select count(*)::text from pg_policies where policyname = 'zz View consent gate' and tablename in ('ops_journal_entries', 'ops_custom_services', 'workspace_members', 'portal_grant_notices', 'ui_preferences')), '0');

-- ---------- 대표 O · 허락 전 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O1 닫힌 작업공간 = 팀장 작업공간 하나', (select (public.view_consent_blocked_workspaces() = array[(select v from qa.ids where k = 'P')])::text), 'true');
select qa.eq('O2 구성원(편집자) 그대로 · 팀장 화면 목록 1', (select public.is_workspace_member(v)::text from qa.ids where k = 'P') || ' ' || (select count(*)::text from public.my_pilot_views()), 'true 1');
select qa.eq('O3 팀장 업체 0', (select count(*)::text from public.operations_clients where workspace_id = (select v from qa.ids where k = 'P')), '0');
select qa.eq('O4 모듈 기록 — 업체 걸린 줄 · 업체 자료 모듈 0 / 마케팅 · 브랜딩 · 피드백 3',
  (select string_agg(id, ',' order by id) from public.module_data where workspace_id = (select v from qa.ids where k = 'P') and id like 'p26-%'), 'p26-md-brand,p26-md-fb,p26-md-mk');
select qa.eq('O5 팀장 서류 파일 0', (select count(*)::text from storage.objects where bucket_id = 'client-documents' and name like (select v::text from qa.ids where k = 'P') || '/clients/p19-client/%'), '0');
select qa.eq('O6 팀장 업체 고치기 = 0줄', qa.rows($q$update public.operations_clients set company_name = '대표가 바꿈' where id = 'p19-client'$q$), '0');
select qa.eq('O7 팀장 업체 지우기 = 0줄', qa.rows($q$delete from public.operations_clients where id = 'p19-client'$q$), '0');
select qa.no('O8 팀장 작업공간에 업체 넣기 막힘', $q$insert into public.operations_clients (id, workspace_id, company_name, payload) select 'o26-into-p', v, '대표가 넣은 업체', '{}' from qa.ids where k = 'P'$q$);
select qa.no('O9 팀장 작업공간에 업체 걸린 모듈 기록 넣기 막힘', $q$insert into public.module_data (id, workspace_id, module_key, bucket, client_id, payload) select 'o26-md-c', v, 'policy-funding', 'notes', 'p19-client', '{}' from qa.ids where k = 'P'$q$);
select qa.no('O10 업체 자료 모듈(고용지원금)은 업체 없이도 막힘', $q$insert into public.module_data (id, workspace_id, module_key, bucket, payload) select 'o26-md-emp', v, 'employment', 'employees', '{}' from qa.ids where k = 'P'$q$);
select qa.ok('O11 마케팅 기록(업체 없음)은 그대로 저장 — D-538 이번 주 참고 길', $q$insert into public.module_data (id, workspace_id, module_key, bucket, payload) select 'o26-md-mk', v, 'marketing', 'weekref', '{}' from qa.ids where k = 'P'$q$);
select qa.ok('O12 AI 기준(자체점검 기준) 저장 — D-538 길', $q$insert into public.module_data (id, workspace_id, module_key, bucket, payload) select 'o26-md-ai', v, 'ai', 'skills', '{}' from qa.ids where k = 'P'$q$);
select qa.no('O13 마케팅 줄을 업체에 거는 것으로 바꾸기 막힘', $q$update public.module_data set client_id = 'p19-client' where id = 'o26-md-mk'$q$);
select qa.no('O14 팀장 폴더에 파일 올리기 막힘', $q$insert into storage.objects (bucket_id, name, owner) select 'client-documents', v::text || '/clients/p19-client/evil.pdf', auth.uid() from qa.ids where k = 'P'$q$);
select qa.eq('O15 고객 화면 연결 0 · 미리 보기 막힘', (select count(*)::text from public.portal_client_links where workspace_id = (select v from qa.ids where k = 'P')), '0');
select qa.no('O16 고객 화면 미리 보기(security definer)도 막힘', $q$select public.portal_preview_project('26000000-0000-0000-0000-00000000aa01')$q$);
select qa.ok('O17 내 작업공간 업체 넣기 · 고치기 그대로', $q$insert into public.operations_clients (id, workspace_id, company_name, payload) select 'o26-own', v, '대표 업체 26', '{}' from qa.ids where k = 'O'$q$);
select qa.eq('O18 내 작업공간 업체 보임 · 내 작업공간은 닫힌 목록에 없음', (select count(*)::text from public.operations_clients where id = 'o26-own') || ' ' || (select public.view_consent_ok(v)::text from qa.ids where k = 'O'), '1 true');
select qa.eq('O19 상태 = viewer · 허락 없음 · 요청 없음', (select (s->>'role') || ' ' || coalesce(s->>'active', '-') || ' ' || coalesce(s->>'request', '-') from (select public.view_consent_state(v) s from qa.ids where k = 'P') x), 'viewer - -');
select qa.no('O20 대표가 스스로 허락하기 막힘', $q$select public.view_consent_grant((select v from qa.ids where k = 'P'), 7)$q$);
select qa.no('O21 허락 표에 직접 넣기 막힘', $q$insert into public.workspace_view_grants (workspace_id, grantee_id, granted_by, expires_at) select v, auth.uid(), auth.uid(), now() + interval '30 days' from qa.ids where k = 'P'$q$);
select qa.no('O22 요청 표에 직접 넣기 막힘', $q$insert into public.workspace_view_requests (workspace_id, requester_id) select v, auth.uid() from qa.ids where k = 'P'$q$);
select qa.no('O23 팀장 대신 닫기 · 거절 막힘', $q$select public.view_consent_decline((select v from qa.ids where k = 'P'))$q$);
select qa.no('O24 이름 함수는 앱에서 부를 수 없음', $q$select public.view_consent_person(auth.uid())$q$);
select qa.eq('O25 허락 요청 보내기 → 열린 요청', (select coalesce(s->'request'->>'createdAt', '') <> '' from (select public.view_consent_request(v) s from qa.ids where k = 'P') x)::text, 'true');
select qa.eq('O26 두 번 눌러도 열린 요청은 하나', (select (public.view_consent_request(v) ->> 'role') from qa.ids where k = 'P') || ' ' || (select count(*)::text from public.workspace_view_requests where closed_at is null), 'viewer 1');
reset role;

-- ---------- 팀장 P ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P1 내 자료는 그대로 — 업체 1 · 모듈 기록 8 · 파일 1', (select count(*)::text from public.operations_clients where id = 'p19-client') || ' ' || (select count(*)::text from public.module_data where workspace_id = (select v from qa.ids where k = 'P') and (id like 'p26-%' or id like 'o26-%')) || ' ' || (select count(*)::text from storage.objects where name like (select v::text from qa.ids where k = 'P') || '/clients/p19-client/%'), '1 8 1');
select qa.eq('P2 상태 = owner · 대표 계정 1 · 허락 없음 · 요청 있음(보낸 사람 이름)', (select (s->>'role') || ' ' || (s->>'viewers') || ' ' || coalesce(s->>'active', '-') || ' ' || (s->'request'->>'by') from (select public.view_consent_state(v) s from qa.ids where k = 'P') x), 'owner 1 - 대표');
select qa.eq('P3 닫힌 목록 없음(팀장 자신은 늘 그대로)', (select cardinality(public.view_consent_blocked_workspaces())::text), '0');
select qa.no('P4 기간 3일은 막힘(1 · 7 · 30 만)', $q$select public.view_consent_grant((select v from qa.ids where k = 'P'), 3)$q$);
select qa.no('P5 다른 작업공간(대표 것) 허락 막힘', $q$select public.view_consent_grant((select v from qa.ids where k = 'O'), 7)$q$);
select qa.no('P6 허락 표에 직접 넣기 막힘', $q$insert into public.workspace_view_grants (workspace_id, grantee_id, granted_by, expires_at) select v, '19000000-0000-0000-0000-0000000000c1', auth.uid(), now() + interval '30 days' from qa.ids where k = 'P'$q$);
select qa.eq('P7 7일 허락 → 지금 허락 있음 · 열린 요청 없음', (select coalesce(s->'active'->>'expiresAt', '') <> '' and (s->>'request') is null from (select public.view_consent_grant(v, 7) s from qa.ids where k = 'P') x)::text, 'true');
select qa.eq('P7b 대표 요청은 지우지 않고 허락함으로 닫힘', (select string_agg(coalesce(closed_reason, 'open'), ',') from public.workspace_view_requests), 'granted');
select qa.no('P8 허락 기간 늘리기(표 직접 고치기) 막힘', $q$update public.workspace_view_grants set expires_at = now() + interval '3650 days'$q$);
reset role;

-- ---------- 대표 O · 허락 뒤 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O30 닫힌 목록 없음 · 상태 active(7일 뒤 끝)', (select cardinality(public.view_consent_blocked_workspaces())::text) || ' ' || (select ((s->'active'->>'expiresAt')::timestamptz between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour')::text from (select public.view_consent_state(v) s from qa.ids where k = 'P') x), '0 true');
select qa.eq('O31 팀장 업체 · 모듈 기록 · 파일 · 고객 화면 연결 보임', (select count(*)::text from public.operations_clients where id = 'p19-client') || ' ' || (select count(*)::text from public.module_data where workspace_id = (select v from qa.ids where k = 'P') and (id like 'p26-%' or id like 'o26-%')) || ' ' || (select count(*)::text from storage.objects where name like (select v::text from qa.ids where k = 'P') || '/clients/p19-client/%') || ' ' || (select count(*)::text from public.portal_client_links where workspace_id = (select v from qa.ids where k = 'P')), '1 8 1 1');
select qa.eq('O32 팀장 업체 고치기 = 1줄(편집자 그대로)', qa.rows($q$update public.operations_clients set company_name = 'P 고객사' where id = 'p19-client'$q$), '1');
select qa.ok('O33 고객 화면 미리 보기 열림', $q$select public.portal_preview_project('26000000-0000-0000-0000-00000000aa01')$q$);
reset role;

-- 기한이 지나면 저절로 닫힘(서버 작업으로 시계를 앞당긴 것처럼)
select set_config('request.jwt.claim.sub', '', false);
update public.workspace_view_grants set created_at = now() - interval '8 days', expires_at = now() - interval '1 day' where revoked_at is null;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O40 기한 지남 → 다시 닫힘 · 업체 0 · 상태 active 없음', (select cardinality(public.view_consent_blocked_workspaces())::text) || ' ' || (select count(*)::text from public.operations_clients where id = 'p19-client') || ' ' || (select coalesce(public.view_consent_state(v)->>'active', '-') from qa.ids where k = 'P'), '1 0 -');
reset role;

-- 팀장이 다시 하루 허락 → 바로 닫기
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P10 하루 허락', (select (public.view_consent_grant(v, 1)->'active') is not null from qa.ids where k = 'P')::text, 'true');
reset role;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O41 하루 허락 동안 보임', (select count(*)::text from public.operations_clients where id = 'p19-client'), '1');
reset role;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P11 지금 닫기 → 허락 없음 · 지난 기록에 닫은 때', (select (s->>'active') is null and (s->'history'->0->>'revokedAt') is not null from (select public.view_consent_revoke(v) s from qa.ids where k = 'P') x)::text, 'true');
reset role;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O42 닫은 순간부터 다시 0', (select count(*)::text from public.operations_clients where id = 'p19-client') || ' ' || (select count(*)::text from storage.objects where name like (select v::text from qa.ids where k = 'P') || '/clients/p19-client/%'), '0 0');
-- 요청 → 거절 → 다시 요청
select qa.eq('O43 다시 요청', (select (public.view_consent_request(v)->'request') is not null from qa.ids where k = 'P')::text, 'true');
reset role;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P12 거절 → 열린 요청 없음 · 여전히 허락 없음', (select (s->>'request') is null and (s->>'active') is null from (select public.view_consent_decline(v) s from qa.ids where k = 'P') x)::text, 'true');
select qa.eq('P13 지난 기록 = 허락 2(기한 지남 · 닫음) · 요청 2(허락함 · 거절함) — 지운 것 없음', (select string_agg((h->>'kind') || ':' || coalesce(h->>'closedReason', case when h->>'revokedAt' is not null then 'revoked' when (h->>'expiresAt')::timestamptz < now() then 'expired' else 'open' end), ',' order by h->>'createdAt') from (select jsonb_array_elements(public.view_consent_state(v)->'history') h from qa.ids where k = 'P') x), 'grant:expired,request:granted,grant:revoked,request:declined');
reset role;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O44 거절 소식 · 다시 요청할 수 있음', (select (s->'lastClosed'->>'closedReason') from (select public.view_consent_state(v) s from qa.ids where k = 'P') x) || ' ' || (select ((public.view_consent_request(v)->'request') is not null)::text from qa.ids where k = 'P'), 'declined true');
reset role;

-- ---------- 다른 사람 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
select qa.eq('R1 가입자: 상태 none · 닫힌 목록 없음', (select public.view_consent_state(v)->>'role' from qa.ids where k = 'P') || ' ' || (select cardinality(public.view_consent_blocked_workspaces())::text), 'none 0');
select qa.no('R2 가입자: 허락 요청 막힘', $q$select public.view_consent_request((select v from qa.ids where k = 'P'))$q$);
select qa.eq('R3 가입자: 허락 · 요청 기록 0', (select count(*)::text from public.workspace_view_grants) || ' ' || (select count(*)::text from public.workspace_view_requests), '0 0');
reset role;
select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-0000000000d1', false);
set role authenticated;
select qa.eq('C1 외부 고객: 내 작업공간 상태 owner(대표 계정 0 — 0024) · 내 업체 그대로', (select (s->>'role') || ' ' || (s->>'viewers') from (select public.view_consent_state(v) s from qa.ids where k = 'C') x) || ' ' || (select count(*)::text from public.operations_clients where id = 'c24-client'), 'owner 0 1');
select qa.no('C2 외부 고객: 허락할 대표 계정이 없어 막힘', $q$select public.view_consent_grant((select v from qa.ids where k = 'C'), 7)$q$);
select qa.eq('C3 외부 고객: 팀장 작업공간 상태 none', (select public.view_consent_state(v)->>'role' from qa.ids where k = 'P'), 'none');
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select qa.no('anon: 상태 함수 부를 수 없음', $q$select public.view_consent_state('00000000-0000-0000-0000-000000000000')$q$);
select qa.no('anon: 허락 표 읽기 막힘', $q$select count(*) from public.workspace_view_grants$q$);
reset role;

-- 정리: 다음 시험(격리)이 쓰지 않도록 이 시험이 만든 줄만 지운다(시험 DB)
select set_config('request.jwt.claim.sub', '', false);
delete from public.module_data where id like 'p26-%' or id like 'o26-%';
delete from public.operations_clients where id = 'o26-own';
delete from storage.objects where name like '%/clients/p19-client/%' ;
do $$ begin set local session_replication_role = replica; delete from public.portal_client_links where id = '26000000-0000-0000-0000-00000000aa01'; end $$;
