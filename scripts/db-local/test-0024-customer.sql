-- D-533 외부 구독 고객 ↔ 내부 팀장 분리(0024) 시험 — 로컬 시험 DB(axqa)에서만. test-0019 · 0020 · 0023 다음에 돈다.
--   대표 O(a1 · full) · 내부 팀장 P(b1 · pilot · 대표가 편집자) · 가입자 R(c1 · 등급 없음) · 새 고객 C(d1)
\set QUIET 1
\set ON_ERROR_STOP 1
select set_config('request.jwt.claim.sub', '', false);
select qa.eq('준비: 기존 계정은 모두 internal(지금과 같음)', (select count(*)::text from public.os_access where audience <> 'internal'), '0');
insert into auth.users (id, email) values ('24000000-0000-0000-0000-0000000000d1', 'cust24@x.kr') on conflict do nothing;
-- 고객 준비(customer_provision.sql 과 같은 순서): AI 권한(customer) → 등급(pilot · customer)
insert into public.ai_entitlements (user_id, kind, plan, monthly_units, active_until, note)
  values ('24000000-0000-0000-0000-0000000000d1', 'customer', 'growth', 600, now() + interval '30 days', '시험 고객') on conflict (user_id) do nothing;
select qa.ok('고객 등록(pilot · customer)', $q$insert into public.os_access (user_id, tier, note, audience) values ('24000000-0000-0000-0000-0000000000d1', 'pilot', '시험 고객', 'customer')$q$);

-- 고객 C: 자기 작업공간 하나 · 자기 업체 · 대표 자료 0 · 자기 등급 못 바꿈
select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-0000000000d1', false);
set role authenticated;
select qa.ok('C: 자기 작업공간 만들기', $q$insert into qa.ids select 'C', (public.create_workspace('고객 작업공간')).id$q$);
select qa.ok('C: 자기 업체 넣기', $q$insert into public.operations_clients (id, workspace_id, company_name, payload) select 'c24-client', v, '고객사 업체', '{}' from qa.ids where k = 'C'$q$);
select qa.no('C: 작업공간 두 번째(pilot 규칙)', $q$select public.create_workspace('두 번째')$q$);
select qa.eq('C: 대표 작업공간 업체 0', (select count(*)::text from public.operations_clients c join qa.ids i on i.v = c.workspace_id and i.k = 'O'), '0');
select qa.eq('C: 팀장 작업공간 업체 0', (select count(*)::text from public.operations_clients where id = 'p19-client'), '0');
select qa.no('C: 내 등급을 internal 로 바꾸기', $q$update public.os_access set audience = 'internal' where user_id = auth.uid()$q$);
select qa.no('C: 내 AI 권한을 internal 로 바꾸기', $q$update public.ai_entitlements set kind = 'internal' where user_id = auth.uid()$q$);
reset role;

-- 서버 작업(SQL Editor): 대표 연결 함수는 고객을 건너뛴다 · 대표를 직접 넣는 것도 막힌다
select set_config('request.jwt.claim.sub', '', false);
select qa.eq('연결 함수: 고객 작업공간에 대표 0줄', public.os_access_link_owner_to_pilots()::text, '0');
select qa.eq('대표는 고객 작업공간 구성원 아님', (select count(*)::text from public.workspace_members m join qa.ids i on i.v = m.workspace_id and i.k = 'C' where m.user_id = '19000000-0000-0000-0000-0000000000a1'), '0');
select qa.no('서버 작업으로도 대표를 고객 작업공간 편집자로 넣기 막힘', $q$insert into public.workspace_members (workspace_id, user_id, role) select v, '19000000-0000-0000-0000-0000000000a1', 'editor' from qa.ids where k = 'C'$q$);
select qa.no('서버 작업으로 대표 구성원 줄을 고객 작업공간으로 옮기기 막힘', $q$update public.workspace_members set workspace_id = (select v from qa.ids where k = 'C') where workspace_id = (select v from qa.ids where k = 'P') and user_id = '19000000-0000-0000-0000-0000000000a1'$q$);

-- 대표 O: 팀장 화면 목록에 고객 없음 · 고객 업체 안 보임 · 내부 팀장은 그대로
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O: 팀장 화면 목록 = 내부 팀장 하나(고객 없음)', (select count(*)::text from public.my_pilot_views()), '1');
select qa.eq('O: 그 하나 = 내부 팀장 작업공간', (select (workspace_id = (select v from qa.ids where k = 'P'))::text from public.my_pilot_views()), 'true');
select qa.eq('O: 고객 업체 안 보임', (select count(*)::text from public.operations_clients where id = 'c24-client'), '0');
select qa.eq('O: 내부 팀장 업체는 보임(편집자 그대로)', (select count(*)::text from public.operations_clients where id = 'p19-client'), '1');
-- 고객 업체 고치기 — RLS 가 줄을 숨겨 0줄 고침(오류 없이). 아래 '결과' 줄로 그대로인지 본다
update public.operations_clients set company_name = '대표가 고침' where id = 'c24-client';
reset role;
select qa.eq('결과: 고객 업체 이름 그대로', (select company_name from public.operations_clients where id = 'c24-client'), '고객사 업체');

-- 바꾸기 안전장치(서버 작업)
select set_config('request.jwt.claim.sub', '', false);
select qa.no('내부 팀장(대표가 구성원)을 customer 로 바꾸기 — 멈춤', $q$update public.os_access set audience = 'customer' where user_id = '19000000-0000-0000-0000-0000000000b1'$q$);
select qa.eq('내부 팀장은 internal 그대로', (select audience from public.os_access where user_id = '19000000-0000-0000-0000-0000000000b1'), 'internal');
select qa.no('고객의 AI 권한을 internal(한도 없음)로 — 막힘', $q$update public.ai_entitlements set kind = 'internal', plan = 'internal' where user_id = '24000000-0000-0000-0000-0000000000d1'$q$);
insert into public.ai_entitlements (user_id, kind, plan, note) values ('19000000-0000-0000-0000-0000000000c1', 'internal', 'internal', '시험') on conflict (user_id) do update set kind = 'internal';
select qa.no('AI 가 internal 인 계정을 customer 로 등록 — 막힘', $q$insert into public.os_access (user_id, tier, note, audience) values ('19000000-0000-0000-0000-0000000000c1', 'pilot', 'x', 'customer')$q$);
delete from public.ai_entitlements where user_id = '19000000-0000-0000-0000-0000000000c1' and note = '시험';
select qa.no('대표(full)를 customer 로 — 막힘', $q$update public.os_access set audience = 'customer' where user_id = '19000000-0000-0000-0000-0000000000a1'$q$);
select qa.eq('내부 팀장 작업공간의 대표 편집자 줄 그대로', (select role::text from public.workspace_members where workspace_id = (select v from qa.ids where k = 'P') and user_id = '19000000-0000-0000-0000-0000000000a1'), 'editor');
select qa.eq('연결 함수 다시: 내부 팀장은 이미 있음 · 고객 건너뜀 = 0', public.os_access_link_owner_to_pilots()::text, '0');
