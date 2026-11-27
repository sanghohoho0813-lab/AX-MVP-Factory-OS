-- D-681 고객성장관리 P0(0033) 시험 — 로컬 시험 DB(axqa)에서만. test-0019 · 0024 · 0026 · 0032 다음에 돈다. 운영 DB 에는 절대 실행하지 않는다.
--   대표 O(a1 · full · 업체 A · B) · 내부 팀장 P(b1 · 자기 작업공간) · 외부 구독 고객 C(24…d1 · 자기 작업공간)
--   My MIRAE 고객: A1 · A2(같은 업체 A 의 두 계정) · B1(업체 B) · 연결 없는 가입자 R(c1) · 로그인 안 한 사람(anon)
\set QUIET 1
\set ON_ERROR_STOP 1
create table if not exists qa.g33 (k text primary key, v text);
truncate qa.g33;
grant all on qa.g33 to anon, authenticated;
grant select on qa.ids to anon;
grant usage on schema qa to anon;
grant execute on all functions in schema qa to anon, authenticated;
select set_config('request.jwt.claim.sub', '', false);

-- 준비(시험 DB): 고객 계정 셋 · 업체 둘(대표) · 업체 하나(팀장) · 지난 기록 0
insert into auth.users (id, email) values
  ('33000000-0000-0000-0000-0000000000a1', 'a1@cust33.kr'),
  ('33000000-0000-0000-0000-0000000000a2', 'a2@cust33.kr'),
  ('33000000-0000-0000-0000-0000000000b1', 'b1@cust33.kr') on conflict do nothing;
insert into public.profiles (id, email) values
  ('33000000-0000-0000-0000-0000000000a1', 'a1@cust33.kr'),
  ('33000000-0000-0000-0000-0000000000a2', 'a2@cust33.kr'),
  ('33000000-0000-0000-0000-0000000000b1', 'b1@cust33.kr') on conflict (id) do update set email = excluded.email;
do $$ begin
  set local session_replication_role = replica;
  delete from public.portal_receipts where operations_client_id in ('o33-a', 'o33-b', 'p33-x');
  delete from public.portal_reports where operations_client_id in ('o33-a', 'o33-b', 'p33-x');
  delete from public.portal_client_links where operations_client_id in ('o33-a', 'o33-b', 'p33-x');
end $$;
insert into public.operations_clients (id, workspace_id, company_name, payload) select 'o33-a', v, '(주)에이정밀', '{"internalMemo":"비밀 메모 A"}' from qa.ids where k = 'O' on conflict (id) do nothing;
insert into public.operations_clients (id, workspace_id, company_name, payload) select 'o33-b', v, '비상사', '{}' from qa.ids where k = 'O' on conflict (id) do nothing;
insert into public.operations_clients (id, workspace_id, company_name, payload) select 'p33-x', v, '팀장 고객사', '{}' from qa.ids where k = 'P' on conflict (id) do nothing;

select qa.eq('준비: 표 2 RLS 켜짐', (select string_agg(relname || ':' || relrowsecurity, ',' order by relname) from pg_class where relname in ('portal_reports', 'portal_receipts') and relnamespace = 'public'::regnamespace), 'portal_receipts:true,portal_reports:true');
select qa.eq('준비: 앱 계정 표 권한은 SELECT 하나 · anon 0', (select string_agg(distinct privilege_type || '/' || grantee, ',') from information_schema.role_table_grants where table_schema = 'public' and table_name in ('portal_reports', 'portal_receipts') and grantee in ('anon', 'authenticated')), 'SELECT/authenticated');
select qa.eq('준비: 안쪽 함수 5개는 앱 계정 · anon · PUBLIC 이 부를 수 없음', (select count(*)::text from information_schema.routine_privileges where routine_schema = 'public' and routine_name in ('portal_growth_guard', 'portal_growth_text', 'portal_growth_clean_sections', 'portal_growth_clean_refs', 'portal_report_item') and grantee in ('anon', 'authenticated', 'PUBLIC')), '0');
select qa.eq('준비: 고객 · 내부 함수 11개는 anon · PUBLIC 0', (select count(*)::text from information_schema.routine_privileges where routine_schema = 'public' and routine_name in ('portal_reports', 'portal_report', 'portal_mark_report_seen', 'portal_acknowledge_report', 'portal_mark_home', 'portal_growth_summary', 'portal_publish_report', 'portal_withdraw_report', 'portal_preview_reports', 'portal_preview_report', 'portal_link_accounts') and grantee in ('anon', 'PUBLIC')), '0');
select qa.eq('준비: 두 표에 허락 문(0026) · 작업공간 고정(0023) · 같은 작업공간 지킴', (select count(*)::text from pg_policies where policyname = 'zz View consent gate' and tablename in ('portal_reports', 'portal_receipts')) || ' ' || (select count(*)::text from pg_trigger g join pg_class c on c.oid = g.tgrelid where c.relname in ('portal_reports', 'portal_receipts') and g.tgname in ('zz_workspace_id_lock', 'zz_portal_reports_same_workspace', 'zz_portal_receipts_same_workspace')), '2 4');

-- ---------- 대표 O — 연결 만들기 · 발행 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
with x as (insert into public.portal_client_links (workspace_id, operations_client_id, profile_id, consultant_name) select v, 'o33-a', '33000000-0000-0000-0000-0000000000a1', '김담당' from qa.ids where k = 'O' returning id) insert into qa.g33 select 'linkA1', id::text from x;
with x as (insert into public.portal_client_links (workspace_id, operations_client_id, profile_id) select v, 'o33-a', '33000000-0000-0000-0000-0000000000a2' from qa.ids where k = 'O' returning id) insert into qa.g33 select 'linkA2', id::text from x;
with x as (insert into public.portal_client_links (workspace_id, operations_client_id, profile_id) select v, 'o33-b', '33000000-0000-0000-0000-0000000000b1' from qa.ids where k = 'O' returning id) insert into qa.g33 select 'linkB1', id::text from x;
select qa.eq('O0 연결 셋(A 두 계정 · B 한 계정)', (select count(*)::text from qa.g33 where k like 'link%'), '3');

insert into qa.g33 select 'repA', (public.portal_publish_report(v, 'o33-a', 'key-a-progress-0001', 'progress', '11월 경과 보고', '2026-11-01', '2026-11-27',
  '이번 달에 벤처인증 서류를 정리했습니다.',
  '[{"key":"done","title":"끝낸 일","items":[{"text":"법인설립 완료","date":"2026-11-03","internal":"수수료 300만원"},{"text":""},{"text":"서류 정리"}],"fee":"비밀"},{"key":"ask","title":"부탁드릴 것","items":[{"text":"재무제표 올려 주세요"}]}]',
  '다음 주에 연락드리겠습니다.', '[{"type":"service","id":"venture","at":"2026-11-20"},{"bad":1}]'))->>'id' from qa.ids where k = 'O';
select qa.eq('O1 발행 → 1판 · 상태 published · 칸은 서버가 다시 만든 것만(모르는 칸 · 빈 줄 · 수수료 칸 버림)',
  (select r.version || ' ' || r.status || ' ' || r.sections::text from public.portal_reports r where r.id = (select v from qa.g33 where k = 'repA')::uuid),
  '1 published [{"key": "done", "items": [{"tag": null, "date": "2026-11-03", "text": "법인설립 완료"}, {"tag": null, "date": null, "text": "서류 정리"}], "title": "끝낸 일"}, {"key": "ask", "items": [{"tag": null, "date": null, "text": "재무제표 올려 주세요"}], "title": "부탁드릴 것"}]');
select qa.eq('O2 같은 발행 번호로 다시(두 번 눌림) → 같은 보고서 · created=false · 줄 1',
  (select (public.portal_publish_report(v, 'o33-a', 'key-a-progress-0001', 'progress', '11월 경과 보고 (두 번째)', null, null, '다른 글', '[]', '', '[]')->>'created') from qa.ids where k = 'O')
  || ' ' || (select count(*)::text from public.portal_reports where operations_client_id = 'o33-a'), 'false 1');
select qa.eq('O3 내부 출처는 모양을 고른 것만(type · id · at)', (select source_refs::text from public.portal_reports where id = (select v from qa.g33 where k = 'repA')::uuid), '[{"at": "2026-11-20", "id": "venture", "type": "service"}]');
insert into qa.g33 select 'repB', (public.portal_publish_report(v, 'o33-b', 'key-b-final-00001', 'final', '최종 보고', null, null, 'B 업체 최종 보고 요약', '[]', '', '[]'))->>'id' from qa.ids where k = 'O';
select qa.no('O4 빈 보고서(요약도 줄도 없음) 막힘', $q$select public.portal_publish_report((select v from qa.ids where k = 'O'), 'o33-a', 'key-a-empty-00001', 'progress', '빈 보고', null, null, '', '[{"title":"칸","items":[]}]', '', '[]')$q$);
select qa.no('O5 칸 9개 막힘', $q$select public.portal_publish_report((select v from qa.ids where k = 'O'), 'o33-a', 'key-a-many-000001', 'progress', '많은 칸', null, null, '요약', (select jsonb_agg(jsonb_build_object('title', 't' || g, 'items', '[]'::jsonb)) from generate_series(1, 9) g), '', '[]')$q$);
select qa.no('O6 한 줄 301자 막힘', $q$select public.portal_publish_report((select v from qa.ids where k = 'O'), 'o33-a', 'key-a-long-000001', 'progress', '긴 줄', null, null, '요약', jsonb_build_array(jsonb_build_object('title', '칸', 'items', jsonb_build_array(jsonb_build_object('text', repeat('가', 301))))), '', '[]')$q$);
select qa.no('O7 모르는 종류 막힘', $q$select public.portal_publish_report((select v from qa.ids where k = 'O'), 'o33-a', 'key-a-kind-000001', 'invoice', '청구', null, null, '요약', '[]', '', '[]')$q$);
select qa.no('O8 기간 거꾸로 막힘', $q$select public.portal_publish_report((select v from qa.ids where k = 'O'), 'o33-a', 'key-a-date-000001', 'progress', '기간', '2026-11-30', '2026-11-01', '요약', '[]', '', '[]')$q$);
select qa.no('O9 짧은 발행 번호 막힘', $q$select public.portal_publish_report((select v from qa.ids where k = 'O'), 'o33-a', 'short', 'progress', '번호', null, null, '요약', '[]', '', '[]')$q$);
select qa.no('O10 표에 직접 넣기 막힘', $q$insert into public.portal_reports (workspace_id, operations_client_id, report_group, kind, title, client_key) select v, 'o33-a', gen_random_uuid(), 'progress', '직접', 'key-direct-00001' from qa.ids where k = 'O'$q$);
select qa.eq('O11 표 직접 고치기 0줄(권한 없음 → 막힘)', (select count(*)::text from public.portal_reports where id = (select v from qa.g33 where k = 'repA')::uuid and status = 'published'), '1');
select qa.no('O11b 표 직접 상태 바꾸기 막힘', $q$update public.portal_reports set status = 'withdrawn' where id = (select v from qa.g33 where k = 'repA')::uuid$q$);
select qa.no('O12 직원이 열람 기록 직접 만들기 막힘', $q$insert into public.portal_receipts (workspace_id, operations_client_id, portal_client_link_id, profile_id, item_kind, item_id) select v, 'o33-a', (select v from qa.g33 where k = 'linkA1')::uuid, '33000000-0000-0000-0000-0000000000a1', 'report', (select v from qa.g33 where k = 'repA')::uuid from qa.ids where k = 'O'$q$);
select qa.no('O13 직원이 고객 함수로 열람 남기기(그 연결의 고객 아님) 막힘', $q$select public.portal_mark_report_seen((select v from qa.g33 where k = 'linkA1')::uuid, (select v from qa.g33 where k = 'repA')::uuid)$q$);
select qa.no('O14 다른 작업공간 id + 내 업체 막힘', $q$select public.portal_publish_report((select v from qa.ids where k = 'C'), 'o33-a', 'key-a-otherws-001', 'progress', 'x', null, null, '요약', '[]', '', '[]')$q$);
select qa.eq('O15 미리보기 = 고객 목록 모양 · 열람 칸 비어 있음 · 내부 칸(출처 · 발행한 사람) 없음',
  (select (jsonb_array_length(public.portal_preview_reports(v, 'o33-a')))::text || ' ' || coalesce(public.portal_preview_reports(v, 'o33-a') -> 0 ->> 'seen_at', '-') || ' ' || ((public.portal_preview_reports(v, 'o33-a') -> 0) ?| array['source_refs', 'published_by', 'workspace_id', 'operations_client_id', 'withdrawn_reason', 'client_key'])::text from qa.ids where k = 'O'),
  '1 - false');
select qa.eq('O16 보고서 한 편 미리보기 — 칸까지 · 기록 0줄', (select jsonb_array_length(public.portal_preview_report((select v from qa.g33 where k = 'repA')::uuid) -> 'sections')::text) || ' ' || (select count(*)::text from public.portal_receipts where operations_client_id = 'o33-a'), '2 0');
select qa.eq('O17 연결된 계정 이메일 — 그 업체 연결만(A 두 계정 · 연결 순) · 이메일 한 칸만', (select (select string_agg(x ->> 'email', ',') from jsonb_array_elements(public.portal_link_accounts(v, 'o33-a')) x) || ' ' || (select count(*)::text from jsonb_array_elements(public.portal_link_accounts(v, 'o33-a')) x, jsonb_object_keys(x) k where k not in ('link_id', 'email')) from qa.ids where k = 'O'), 'a1@cust33.kr,a2@cust33.kr 0');
select qa.no('O18 다른 작업공간 id 로 계정 이메일 막힘', $q$select public.portal_link_accounts((select v from qa.ids where k = 'C'), 'o33-a')$q$);
reset role;

-- ---------- 고객 A1 ----------
select set_config('request.jwt.claim.sub', '33000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('A1 성장 홈 요약 — 내 연결 하나 · 보고서 1 · 안 본 것 1 · 확인 안 한 것 1 · 첫 방문 없음',
  (select jsonb_array_length(public.portal_growth_summary())::text) || ' ' || (select (s ->> 'reports_total') || ' ' || (s ->> 'reports_unseen') || ' ' || (s ->> 'reports_unacked') || ' ' || coalesce(s ->> 'first_visit_at', '-') from jsonb_array_elements(public.portal_growth_summary()) s),
  '1 1 1 1 -');
select qa.eq('A2 고객 화면 들어옴 → 첫 방문 기록 · 1분 안에 다시 와도 한 줄 · 횟수 그대로', (select public.portal_mark_home()::text) || ' ' || (select public.portal_mark_home()::text), '1 0');
select qa.eq('A3 보고서 목록 — 1 · 본문(칸) 없음 · 내부 칸 없음', (select jsonb_array_length(public.portal_reports((select v from qa.g33 where k = 'linkA1')::uuid))::text) || ' ' || coalesce(public.portal_reports((select v from qa.g33 where k = 'linkA1')::uuid) -> 0 ->> 'sections', '-') || ' ' || ((public.portal_reports((select v from qa.g33 where k = 'linkA1')::uuid) -> 0) ?| array['source_refs', 'published_by', 'workspace_id', 'operations_client_id', 'client_key'])::text, '1 - false');
select qa.eq('A4 보고서 한 편 — 칸 · 담당자 한마디 · 회사 이름 · 담당 이름 · 내부 메모 없음',
  (select (r -> 'sections' -> 0 -> 'items' -> 0 ->> 'text') || ' | ' || (r ->> 'staff_note') || ' | ' || (r ->> 'company_name') || ' | ' || (r ->> 'consultant_name') || ' | ' || (position('비밀' in r::text) = 0 and position('수수료' in r::text) = 0)::text from (select public.portal_report((select v from qa.g33 where k = 'linkA1')::uuid, (select v from qa.g33 where k = 'repA')::uuid) as r) s),
  '법인설립 완료 | 다음 주에 연락드리겠습니다. | (주)에이정밀 | 김담당 | true');
select qa.eq('A5 열어 봄 기록 → 열람 시각 · 확인 아직', (select (public.portal_mark_report_seen((select v from qa.g33 where k = 'linkA1')::uuid, (select v from qa.g33 where k = 'repA')::uuid) ->> 'seen_at' is not null)::text || ' ' || coalesce(public.portal_mark_report_seen((select v from qa.g33 where k = 'linkA1')::uuid, (select v from qa.g33 where k = 'repA')::uuid) ->> 'acknowledged_at', '-')), 'true -');
select qa.eq('A6 [확인했어요] → 확인 시각 · 다시 눌러도 처음 때 그대로', (select (public.portal_acknowledge_report((select v from qa.g33 where k = 'linkA1')::uuid, (select v from qa.g33 where k = 'repA')::uuid) ->> 'acknowledged_at') = (public.portal_acknowledge_report((select v from qa.g33 where k = 'linkA1')::uuid, (select v from qa.g33 where k = 'repA')::uuid) ->> 'acknowledged_at'))::text, 'true');
select qa.eq('A7 요약 — 안 본 것 0 · 확인 안 한 것 0 · 첫 방문 있음', (select (s ->> 'reports_unseen') || ' ' || (s ->> 'reports_unacked') || ' ' || (s ->> 'first_visit_at' is not null)::text from jsonb_array_elements(public.portal_growth_summary()) s), '0 0 true');
select qa.no('A8 남의 업체(B) 보고서를 내 연결로 열기 막힘', $q$select public.portal_report((select v from qa.g33 where k = 'linkA1')::uuid, (select v from qa.g33 where k = 'repB')::uuid)$q$);
select qa.no('A9 남의 연결(B)로 목록 막힘', $q$select public.portal_reports((select v from qa.g33 where k = 'linkB1')::uuid)$q$);
select qa.no('A10 남의 연결(B)로 열람 남기기 막힘', $q$select public.portal_mark_report_seen((select v from qa.g33 where k = 'linkB1')::uuid, (select v from qa.g33 where k = 'repB')::uuid)$q$);
select qa.no('A11 같은 업체 다른 계정(A2) 연결로 확인 위조 막힘', $q$select public.portal_acknowledge_report((select v from qa.g33 where k = 'linkA2')::uuid, (select v from qa.g33 where k = 'repA')::uuid)$q$);
select qa.eq('A12 표 직접 읽기 0줄(보고서 · 기록)', (select count(*)::text from public.portal_reports) || ' ' || (select count(*)::text from public.portal_receipts), '0 0');
select qa.no('A13 열람 기록 직접 고치기(확인 시각 지우기) 막힘', $q$update public.portal_receipts set acknowledged_at = null$q$);
select qa.no('A14 고객이 발행 막힘', $q$select public.portal_publish_report((select v from qa.ids where k = 'O'), 'o33-a', 'key-cust-000001', 'progress', 'x', null, null, '요약', '[]', '', '[]')$q$);
select qa.no('A15 고객이 미리보기 막힘', $q$select public.portal_preview_reports((select v from qa.ids where k = 'O'), 'o33-a')$q$);
select qa.no('A16 고객이 내리기 막힘', $q$select public.portal_withdraw_report((select v from qa.g33 where k = 'repA')::uuid, '')$q$);
select qa.no('A17 고객이 계정 이메일 목록 막힘', $q$select public.portal_link_accounts((select v from qa.ids where k = 'O'), 'o33-a')$q$);
reset role;

-- ---------- 같은 업체 두 번째 계정 A2 — 보고서는 같이 보고 · 열람은 따로 ----------
select set_config('request.jwt.claim.sub', '33000000-0000-0000-0000-0000000000a2', false);
set role authenticated;
select qa.eq('A2-1 같은 보고서 보임 · 나는 아직 안 봄(계정마다 따로)', (select (s ->> 'reports_total') || ' ' || (s ->> 'reports_unseen') from jsonb_array_elements(public.portal_growth_summary()) s), '1 1');
reset role;

-- ---------- 고객 B1 ----------
select set_config('request.jwt.claim.sub', '33000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('B1 내 업체 보고서만(B) · A 보고서 0', (select jsonb_agg(x ->> 'title')::text from jsonb_array_elements(public.portal_reports((select v from qa.g33 where k = 'linkB1')::uuid)) x), '["최종 보고"]');
select qa.no('B2 A 연결 · A 보고서 열기 막힘', $q$select public.portal_report((select v from qa.g33 where k = 'linkA1')::uuid, (select v from qa.g33 where k = 'repA')::uuid)$q$);
reset role;

-- ---------- 연결 없는 가입자 R · 외부 구독 고객 C · 로그인 안 한 사람 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
select qa.eq('R1 연결 없는 가입자 — 요약 빈 칸 · 방문 기록 0', public.portal_growth_summary()::text || ' ' || public.portal_mark_home()::text, '[] 0');
select qa.no('R2 보고서 id 를 알아도 막힘', $q$select public.portal_report((select v from qa.g33 where k = 'linkA1')::uuid, (select v from qa.g33 where k = 'repA')::uuid)$q$);
reset role;
select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-0000000000d1', false);
set role authenticated;
select qa.eq('C1 외부 구독 고객 — My MIRAE 연결 없음 → 요약 빈 칸 · 대표 보고서 표 0줄', public.portal_growth_summary()::text || ' ' || (select count(*)::text from public.portal_reports), '[] 0');
select qa.no('C2 외부 구독 고객이 대표 업체 발행 막힘', $q$select public.portal_publish_report((select v from qa.ids where k = 'O'), 'o33-a', 'key-c-000000001', 'progress', 'x', null, null, '요약', '[]', '', '[]')$q$);
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select qa.no('N1 로그인 안 한 사람 — 목록 막힘', $q$select public.portal_reports((select v from qa.g33 where k = 'linkA1')::uuid)$q$);
select qa.no('N2 로그인 안 한 사람 — 방문 기록 막힘', $q$select public.portal_mark_home()$q$);
select qa.no('N3 로그인 안 한 사람 — 표 읽기 막힘', $q$select count(*) from public.portal_reports$q$);
select qa.no('N4 로그인 안 한 사람 — 계정 이메일 막힘', $q$select public.portal_link_accounts((select v from qa.ids where k = 'O'), 'o33-a')$q$);
reset role;

-- ---------- 내부 팀장 P — 대표 자료 0 · 대표 업체 발행 막힘 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P1 대표 보고서 · 열람 기록 0줄', (select count(*)::text from public.portal_reports) || ' ' || (select count(*)::text from public.portal_receipts), '0 0');
select qa.no('P2 대표 업체에 발행 막힘', $q$select public.portal_publish_report((select v from qa.ids where k = 'O'), 'o33-a', 'key-p-000000001', 'progress', 'x', null, null, '요약', '[]', '', '[]')$q$);
select qa.no('P3 대표 보고서 미리보기 막힘', $q$select public.portal_preview_report((select v from qa.g33 where k = 'repA')::uuid)$q$);
select qa.no('P3b 대표 업체 계정 이메일 막힘', $q$select public.portal_link_accounts((select v from qa.ids where k = 'O'), 'o33-a')$q$);
insert into qa.g33 select 'repP', (public.portal_publish_report(v, 'p33-x', 'key-p-own-000001', 'consult_summary', '상담 요약', null, null, '팀장 자기 업체', '[]', '', '[]'))->>'id' from qa.ids where k = 'P';
select qa.eq('P4 내 작업공간 업체에는 발행 가능', (select count(*)::text from public.portal_reports where id = (select v from qa.g33 where k = 'repP')::uuid), '1');
reset role;

-- ---------- 대표 O — 팀장 작업공간은 허락(0026) 없이 못 봄 · 내부에서 본 열람 상태 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O20 허락 없음: 팀장 작업공간 보고서 0줄 · 미리보기 막힘', (select count(*)::text from public.portal_reports where operations_client_id = 'p33-x'), '0');
select qa.no('O20b 허락 없음: 팀장 업체 보고서 미리보기 막힘', $q$select public.portal_preview_report((select v from qa.g33 where k = 'repP')::uuid)$q$);
select qa.no('O20c 허락 없음: 팀장 업체 보고서 내리기 막힘', $q$select public.portal_withdraw_report((select v from qa.g33 where k = 'repP')::uuid, '')$q$);
select qa.eq('O21b 내부에서 보는 열람 기록(연결 id 로) — A1 home · A1 report(확인)',
  (select string_agg(case when rc.portal_client_link_id = (select v from qa.g33 where k = 'linkA1')::uuid then 'A1' else '?' end || ':' || rc.item_kind || ':' || (rc.acknowledged_at is not null)::text, ',' order by rc.item_kind) from public.portal_receipts rc where rc.operations_client_id in ('o33-a', 'o33-b')),
  'A1:home:false,A1:report:true');

-- 정정 — 새 판(2) · 예전 판 superseded · 같은 예전 판을 또 정정하면 막힘(두 탭 · 두 기기)
insert into qa.g33 select 'repA2', (public.portal_publish_report(v, 'o33-a', 'key-a-progress-0002', 'progress', '11월 경과 보고', '2026-11-01', '2026-11-27',
  '이번 달에 벤처인증 서류를 정리했습니다. (날짜 고침)', '[{"key":"done","title":"끝낸 일","items":[{"text":"법인설립 완료","date":"2026-11-04"}]}]', '', '[]',
  (select v from qa.g33 where k = 'repA')::uuid, '법인설립 완료일을 11/4 로 고쳤습니다'))->>'id' from qa.ids where k = 'O';
select qa.eq('O22 정정 → 2판 · 같은 묶음 · 예전 판은 superseded(지우지 않음) · 서로 가리킴',
  (select n.version || ' ' || (n.report_group = o.report_group)::text || ' ' || o.status || ' ' || (o.superseded_by = n.id)::text || ' ' || (n.supersedes = o.id)::text from public.portal_reports n, public.portal_reports o where n.id = (select v from qa.g33 where k = 'repA2')::uuid and o.id = (select v from qa.g33 where k = 'repA')::uuid),
  '2 true superseded true true');
select qa.no('O23 같은 예전 판을 또 정정(늦게 연 다른 탭) 막힘', $q$select public.portal_publish_report((select v from qa.ids where k = 'O'), 'o33-a', 'key-a-progress-0003', 'progress', '또', null, null, '요약', '[]', '', '[]', (select v from qa.g33 where k = 'repA')::uuid, '또 고침')$q$);
select qa.no('O24 정정 사유 없이 정정 막힘', $q$select public.portal_publish_report((select v from qa.ids where k = 'O'), 'o33-a', 'key-a-progress-0004', 'progress', '또', null, null, '요약', '[]', '', '[]', (select v from qa.g33 where k = 'repA2')::uuid, '')$q$);
select qa.no('O25 다른 업체(B) 보고서로 정정 막힘', $q$select public.portal_publish_report((select v from qa.ids where k = 'O'), 'o33-a', 'key-a-progress-0005', 'progress', '또', null, null, '요약', '[]', '', '[]', (select v from qa.g33 where k = 'repB')::uuid, '사유')$q$);
reset role;

-- ---------- 고객 A1 — 정정 판 · 예전 판 ----------
select set_config('request.jwt.claim.sub', '33000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('A20 목록은 최신 판 하나 · 정정 표시 · 사유 보임 · 새 판은 아직 안 봄', (select jsonb_array_length(l)::text || ' ' || (l -> 0 ->> 'version') || ' ' || (l -> 0 ->> 'corrected') || ' ' || (l -> 0 ->> 'correction_note') || ' ' || coalesce(l -> 0 ->> 'seen_at', '-') from (select public.portal_reports((select v from qa.g33 where k = 'linkA1')::uuid) as l) s), '1 2 true 법인설립 완료일을 11/4 로 고쳤습니다 -');
select qa.eq('A21 예전 판을 열면 본문 없이 "새 판 있음" 만', (select (r ->> 'status') || ' ' || ((r ->> 'latest_id') = (select v from qa.g33 where k = 'repA2'))::text || ' ' || coalesce(r ->> 'sections', '-') from (select public.portal_report((select v from qa.g33 where k = 'linkA1')::uuid, (select v from qa.g33 where k = 'repA')::uuid) as r) s), 'superseded true -');
select qa.no('A22 예전 판에 확인 막힘', $q$select public.portal_acknowledge_report((select v from qa.g33 where k = 'linkA1')::uuid, (select v from qa.g33 where k = 'repA')::uuid)$q$);
select qa.eq('A23 요약 — 새 판은 안 본 것 1(예전 판 열람 기록은 따로 남음)', (select (s ->> 'reports_unseen') || ' ' || (s ->> 'reports_unacked') from jsonb_array_elements(public.portal_growth_summary()) s), '1 1');
reset role;

-- ---------- 대표 O — 내리기 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O30 내리기 → withdrawn · 까닭은 내부에만', (select public.portal_withdraw_report((select v from qa.g33 where k = 'repA2')::uuid, '잘못된 업체 숫자 — 다시 확인') ->> 'status'), 'withdrawn');
select qa.no('O31 이미 내린 것 다시 내리기 막힘', $q$select public.portal_withdraw_report((select v from qa.g33 where k = 'repA2')::uuid, '')$q$);
select qa.no('O32 내린 판을 정정 막힘', $q$select public.portal_publish_report((select v from qa.ids where k = 'O'), 'o33-a', 'key-a-progress-0006', 'progress', '또', null, null, '요약', '[]', '', '[]', (select v from qa.g33 where k = 'repA2')::uuid, '사유')$q$);
reset role;
select set_config('request.jwt.claim.sub', '33000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('A30 내린 뒤 — 목록 0 · 열면 제목만(본문 · 까닭 없음) · 새 판 없음', (select jsonb_array_length(public.portal_reports((select v from qa.g33 where k = 'linkA1')::uuid))::text) || ' ' || (select (r ->> 'status') || ' ' || coalesce(r ->> 'latest_id', '-') || ' ' || (position('다시 확인' in r::text) = 0)::text from (select public.portal_report((select v from qa.g33 where k = 'linkA1')::uuid, (select v from qa.g33 where k = 'repA2')::uuid) as r) s), '0 withdrawn - true');
select qa.no('A31 내린 판 열람 기록 막힘', $q$select public.portal_mark_report_seen((select v from qa.g33 where k = 'linkA1')::uuid, (select v from qa.g33 where k = 'repA2')::uuid)$q$);
reset role;

-- ---------- 연결 끊기 · 잠시 멈춤 — 그 순간부터 막힘 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
update public.portal_client_links set status = 'revoked' where id = (select v from qa.g33 where k = 'linkB1')::uuid;
update public.portal_client_links set status = 'paused' where id = (select v from qa.g33 where k = 'linkA2')::uuid;
reset role;
select set_config('request.jwt.claim.sub', '33000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.no('V1 끊긴 연결 — 목록 막힘', $q$select public.portal_reports((select v from qa.g33 where k = 'linkB1')::uuid)$q$);
select qa.no('V2 끊긴 연결 — 보고서 열기 막힘', $q$select public.portal_report((select v from qa.g33 where k = 'linkB1')::uuid, (select v from qa.g33 where k = 'repB')::uuid)$q$);
select qa.eq('V3 끊긴 연결 — 요약 빈 칸 · 방문 기록 0', public.portal_growth_summary()::text || ' ' || public.portal_mark_home()::text, '[] 0');
reset role;
select set_config('request.jwt.claim.sub', '33000000-0000-0000-0000-0000000000a2', false);
set role authenticated;
select qa.no('V4 잠시 멈춘 연결 — 목록 막힘', $q$select public.portal_reports((select v from qa.g33 where k = 'linkA2')::uuid)$q$);
reset role;

-- ---------- 기존 6단계 · 기존 함수 그대로 ----------
select set_config('request.jwt.claim.sub', '33000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('X1 기존 내 프로젝트 목록 · 상세 그대로(단계 6종 · 칸 그대로)', (select count(*)::text from public.portal_my_projects()) || ' ' || (select (public.portal_project((select v from qa.g33 where k = 'linkA1')::uuid) -> 'project' ->> 'stage')), '1 preparing');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- 견본 치우기(다음 시험이 세는 줄에 섞이지 않게)
do $$ begin
  set local session_replication_role = replica;
  delete from public.portal_receipts where operations_client_id in ('o33-a', 'o33-b', 'p33-x');
  delete from public.portal_reports where operations_client_id in ('o33-a', 'o33-b', 'p33-x');
  delete from public.portal_client_links where operations_client_id in ('o33-a', 'o33-b', 'p33-x');
end $$;
