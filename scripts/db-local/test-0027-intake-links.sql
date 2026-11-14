-- L-9 · D-609 고객(컨설턴트)마다 상담 신청 링크(0027) 시험 — 로컬 시험 DB(axqa)에서만. test-0019 · 0020 · 0024 · 0026 다음에 돈다.
--   대표 O(a1 · full · 팀장 작업공간 편집자) · 내부 팀장 P(b1 · pilot) · 가입자 R(c1 · 등급 없음) · 외부 고객 C(24…d1)
\set QUIET 1
\set ON_ERROR_STOP 1
create or replace function qa.rows(q text) returns text language plpgsql as $$ declare n int; begin execute q; get diagnostics n = row_count; return n::text; end $$;
create table if not exists qa.slugs (k text primary key, slug text);
truncate qa.slugs;
grant all on qa.slugs to anon, authenticated;
grant usage on schema qa to anon;
grant execute on all functions in schema qa to anon, authenticated;
select set_config('request.headers', '', false);

-- ---------- 팀장 P — 내 링크 만들기 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P1 처음 상태 = owner · 링크 없음', (select (s->>'role') || ' ' || coalesce(s->>'link', '-') from (select public.intake_link_state(v) s from qa.ids where k = 'P') x), 'owner -');
insert into qa.slugs select 'P', public.intake_link_save(v, '  김팀장 상담 신청  ', '정책자금 · 고용지원금')->'link'->>'slug' from qa.ids where k = 'P';
select qa.eq('P2 만들기 → 12자리 주소 · 제목 앞뒤 빈칸 정리', (select (slug ~ '^[0-9a-f]{12}$')::text from qa.slugs where k = 'P') || ' ' || (select l.title from public.public_intake_links l where l.slug = (select slug from qa.slugs where k = 'P')), 'true 김팀장 상담 신청');
select qa.eq('P3 제목 고쳐도 같은 주소 · 열린 링크는 하나', (select (public.intake_link_save(v, '팀장 상담', '')->'link'->>'slug') = (select slug from qa.slugs where k = 'P') from qa.ids where k = 'P')::text || ' ' || (select count(*)::text from public.public_intake_links where workspace_id = (select v from qa.ids where k = 'P') and revoked_at is null), 'true 1');
select qa.eq('P4 빈 제목 → 상담 신청 · 40자까지', (select public.intake_link_save(v, e'\n\n', '')->'link'->>'title' from qa.ids where k = 'P') || ' | ' || (select length(public.intake_link_save(v, repeat('가', 60), e'첫 줄\n둘째 줄')->'link'->>'title')::text from qa.ids where k = 'P'), '상담 신청 | 40');
select qa.eq('P4b 소개 줄바꿈 → 빈칸', (select l.intro from public.public_intake_links l where l.slug = (select slug from qa.slugs where k = 'P')), '첫 줄 둘째 줄');
select public.intake_link_save(v, '팀장 상담', '정책자금 · 고용지원금 상담') from qa.ids where k = 'P';
select qa.no('P5 표에 직접 넣기 막힘', $q$insert into public.public_intake_links (workspace_id, title) select v, '직접' from qa.ids where k = 'P'$q$);
select qa.eq('P6 내 링크는 하나 보임', (select count(*)::text from public.public_intake_links where workspace_id = (select v from qa.ids where k = 'P')), '1');
select qa.no('P6b 받은 수 직접 늘리기 막힘', $q$update public.public_intake_links set received_count = 999$q$);
select qa.no('P6c 링크 지우기 막힘', $q$delete from public.public_intake_links$q$);
select qa.no('P7 대표 작업공간에 링크 만들기 막힘', $q$select public.intake_link_save((select v from qa.ids where k = 'O'), '가로채기', '')$q$);
select qa.no('P8 주인 확인 함수는 앱에서 부를 수 없음', $q$select public.intake_link_owner_check((select v from qa.ids where k = 'P'))$q$);
reset role;

-- ---------- 대표 O ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O1 팀장 작업공간(편집자여도) 상태 = none', (select public.intake_link_state(v)->>'role' from qa.ids where k = 'P'), 'none');
select qa.no('O2 팀장 작업공간에 링크 만들기 막힘', $q$select public.intake_link_save((select v from qa.ids where k = 'P'), '대표가', '')$q$);
select qa.no('O3 팀장 링크 새로 만들기(가로채기) 막힘', $q$select public.intake_link_rotate((select v from qa.ids where k = 'P'))$q$);
select qa.no('O4 팀장 링크 끄기 막힘', $q$select public.intake_link_off((select v from qa.ids where k = 'P'))$q$);
select qa.eq('O5 팀장 링크 안 보임', (select count(*)::text from public.public_intake_links where workspace_id = (select v from qa.ids where k = 'P')), '0');
insert into qa.slugs select 'O', public.intake_link_save(v, '대표 상담', '')->'link'->>'slug' from qa.ids where k = 'O';
select qa.eq('O6 내 작업공간 링크는 따로(주소 다름)', (select (o.slug <> p.slug and o.slug ~ '^[0-9a-f]{12}$')::text from qa.slugs o, qa.slugs p where o.k = 'O' and p.k = 'P'), 'true');
reset role;

-- ---------- 가입자 R · 외부 고객 C ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
select qa.eq('R1 가입자 상태 none · 링크 0', (select public.intake_link_state(v)->>'role' from qa.ids where k = 'P') || ' ' || (select count(*)::text from public.public_intake_links), 'none 0');
select qa.no('R2 가입자 링크 만들기 막힘', $q$select public.intake_link_save((select v from qa.ids where k = 'P'), 'R', '')$q$);
reset role;
select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-0000000000d1', false);
set role authenticated;
insert into qa.slugs select 'C', public.intake_link_save(v, '고객 컨설턴트 상담', '')->'link'->>'slug' from qa.ids where k = 'C';
select qa.eq('C1 외부 고객도 자기 작업공간 링크', (select (slug ~ '^[0-9a-f]{12}$')::text from qa.slugs where k = 'C') || ' ' || (select count(*)::text from public.public_intake_links), 'true 1');
reset role;

-- ---------- 로그인 안 한 사람(공개 화면) ----------
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select qa.eq('A1 공개 화면 = 제목 · 소개만', (select public.public_intake_form(slug)::text from qa.slugs where k = 'P'), '{"intro": "정책자금 · 고용지원금 상담", "title": "팀장 상담"}');
select qa.eq('A2 대문자 · 앞뒤 빈칸 주소도 같은 화면', (select (public.public_intake_form('  ' || upper(slug) || ' ') ->> 'title') from qa.slugs where k = 'P'), '팀장 상담');
select qa.eq('A3 없는 주소 = null', coalesce(public.public_intake_form('000000000000')::text, 'null') || ' ' || coalesce(public.public_intake_form('')::text, 'null') || ' ' || coalesce(public.public_intake_form(null)::text, 'null'), 'null null null');
select qa.no('A4 주인 상태 함수 부를 수 없음', $q$select public.intake_link_state((select v from qa.ids where k = 'P'))$q$);
select qa.no('A5 링크 표 읽기 막힘', $q$select count(*) from public.public_intake_links$q$);
select qa.no('A6 링크 만들기 부를 수 없음', $q$select public.intake_link_save((select v from qa.ids where k = 'P'), 'x', '')$q$);
select qa.no('A7 동의 없음 막힘', $q$select public.public_intake_submit((select slug from qa.slugs where k = 'P'), '{"name":"홍길동","phone":"010-1111-2222"}')$q$);
select qa.no('A8 이름 · 회사 둘 다 없음 막힘', $q$select public.public_intake_submit((select slug from qa.slugs where k = 'P'), '{"phone":"010-1111-2222","consent":true}')$q$);
select qa.no('A9 연락처 없음 막힘', $q$select public.public_intake_submit((select slug from qa.slugs where k = 'P'), '{"name":"홍길동","consent":true}')$q$);
select qa.no('A10 이상한 번호 막힘', $q$select public.public_intake_submit((select slug from qa.slugs where k = 'P'), '{"name":"홍길동","phone":"<script>","consent":true}')$q$);
select qa.no('A11 이상한 이메일 막힘', $q$select public.public_intake_submit((select slug from qa.slugs where k = 'P'), '{"name":"홍길동","email":"not-mail","consent":true}')$q$);
select qa.no('A12 너무 큰 내용 막힘', $q$select public.public_intake_submit((select slug from qa.slugs where k = 'P'), jsonb_build_object('name','홍길동','phone','010-1111-2222','consent',true,'message',repeat('가', 5000)))$q$);
select qa.no('A13 배열 · 문자 내용 막힘', $q$select public.public_intake_submit((select slug from qa.slugs where k = 'P'), '[1,2]')$q$);
select qa.eq('A14 없는 주소로 신청 = closed(아무것도 안 들어감)', public.public_intake_submit('000000000000', '{"name":"홍길동","phone":"010-1111-2222","consent":true}'), 'closed');
select set_config('request.headers', '{"cf-connecting-ip":"5.5.5.5","x-forwarded-for":"7.7.7.7"}', false);
select qa.eq('A15 바른 신청 = ok', (select public.public_intake_submit(slug, '{"name":"홍길동","company_name":"(주)길동상사","phone":"010-1234-5678","email":"gd@x.kr","message":"정책자금 상담 받고 싶어요","source":"스레드","consent":true}') from qa.slugs where k = 'P'), 'ok');
select qa.eq('A16 같은 연락처 다시 = ok(두 줄 안 생김 · 번호 모양 달라도)', (select public.public_intake_submit(slug, '{"name":"홍길동","phone":"01012345678","consent":true}') from qa.slugs where k = 'P'), 'ok');
select qa.eq('A17 경로가 목록 밖이면 상담 링크 · 회사 없으면 이름으로', (select public.public_intake_submit(slug, '{"name":"김개인","phone":"010-2222-3333","source":"광고<b>","consent":true}') from qa.slugs where k = 'P'), 'ok');
select qa.eq('A18 숨은 칸(로봇) = ok 지만 안 들어감', (select public.public_intake_submit(slug, '{"name":"봇","phone":"010-9999-0000","website":"http://spam","consent":true}') from qa.slugs where k = 'P'), 'ok');
select qa.eq('A19 업체 표는 0줄(RLS)', (select count(*)::text from public.operations_clients), '0');
reset role;

-- 서버에서 들어간 것 확인(서버 작업)
select set_config('request.jwt.claim.sub', '', false);
select qa.eq('S1 팀장 작업공간에 잠재고객 2곳(같은 연락처 1 · 로봇 0)', (select count(*)::text from public.operations_clients where workspace_id = (select v from qa.ids where k = 'P') and next_action = '상담 신청 — 연락드리기'), '2');
select qa.eq('S2 첫 신청 모양 — 회사 · 대기 · 잠재고객 · 경로 · 고민 · 연락처 · 오늘(한국 날짜)',
  (select c.company_name || ' | ' || c.status || ' | ' || (c.payload->'sales'->>'stage') || ' | ' || (c.payload->'sales'->>'source') || ' | ' || (c.payload->'sales'->>'concern')
          || ' | ' || (c.payload->>'contactName') || ' | ' || (c.payload->>'contactPhone') || ' | ' || (c.payload->>'contactEmail')
          || ' | ' || (c.next_action_due_date = (now() at time zone 'Asia/Seoul')::date)::text
          || ' | ' || jsonb_array_length(c.payload->'sales'->'history')::text || ' | ' || (c.payload->'activity'->0->>'kind')
     from public.operations_clients c where c.workspace_id = (select v from qa.ids where k = 'P') and c.company_name = '(주)길동상사'),
  '(주)길동상사 | waiting | lead | 스레드 | 정책자금 상담 받고 싶어요 | 홍길동 | 010-1234-5678 | gd@x.kr | true | 1 | sales');
select qa.eq('S3 경로 밖 → 상담 링크 · 회사 없음 → 이름', (select c.company_name || ' ' || (c.payload->'sales'->>'source') from public.operations_clients c where c.workspace_id = (select v from qa.ids where k = 'P') and c.payload->>'contactName' = '김개인'), '김개인 상담 링크');
select qa.eq('S4 받은 수 2 · 마지막 받은 때 있음', (select received_count::text || ' ' || (last_received_at is not null)::text from public.public_intake_links where slug = (select slug from qa.slugs where k = 'P')), '2 true');
select qa.eq('S5 접속 주소 · 연락처 원문은 남지 않음(해시만)', (select count(*)::text from public.public_intake_log where key_hash in ('5.5.5.5', '7.7.7.7', '01012345678', '010-1234-5678') or key_hash like '%|%' or key_hash like '%.%'), '0');
select qa.eq('S6 접속 주소는 cf-connecting-ip 로 셈(x-forwarded-for 아님)', (select count(*)::text from public.public_intake_log where kind = 'intake_link_ip' and key_hash = public.hash_access_token('5.5.5.5')) || ' ' || (select count(*)::text from public.public_intake_log where kind = 'intake_link_ip' and key_hash = public.hash_access_token('7.7.7.7')), '3 0');

-- ---------- 한도 ----------
set role anon;
select qa.eq('L1 한 곳에서 10분에 5번까지 — 4번째 · 5번째 ok', (select public.public_intake_submit(slug, '{"name":"한도1","phone":"010-3000-0001","consent":true}') || ' ' || public.public_intake_submit(slug, '{"name":"한도2","phone":"010-3000-0002","consent":true}') from qa.slugs where k = 'P'), 'ok ok');
select qa.no('L2 6번째는 막힘(다른 연락처여도)', $q$select public.public_intake_submit((select slug from qa.slugs where k = 'P'), '{"name":"한도3","phone":"010-3000-0003","consent":true}')$q$);
-- 링크 하나에 10분 20번: 대표 링크로 서로 다른 곳 · 연락처 20번 → 21번째 막힘
do $$
declare i int; ok int := 0;
begin
  for i in 1..20 loop
    perform set_config('request.headers', format('{"cf-connecting-ip":"10.0.0.%s"}', i), false);
    if public.public_intake_submit((select slug from qa.slugs where k = 'O'), jsonb_build_object('name', '링크한도' || i, 'phone', '010-4000-' || lpad(i::text, 4, '0'), 'consent', true)) = 'ok' then ok := ok + 1; end if;
  end loop;
  raise notice '%  L3 링크 하나에 서로 다른 곳 20번 ok = %', case when ok = 20 then 'PASS' else 'FAIL' end, ok;
end $$;
select set_config('request.headers', '{"cf-connecting-ip":"10.0.0.99"}', false);
select qa.no('L4 그 링크 21번째는 막힘', $q$select public.public_intake_submit((select slug from qa.slugs where k = 'O'), '{"name":"링크한도21","phone":"010-4000-0021","consent":true}')$q$);
select qa.eq('L5 다른 링크(외부 고객)는 그대로 받음', (select public.public_intake_submit(slug, '{"name":"고객의 고객","phone":"010-5000-0001","consent":true}') from qa.slugs where k = 'C'), 'ok');
reset role;
select qa.eq('L6 대표 작업공간 잠재고객 20 · 외부 고객 1', (select count(*)::text from public.operations_clients where workspace_id = (select v from qa.ids where k = 'O') and next_action = '상담 신청 — 연락드리기') || ' ' || (select count(*)::text from public.operations_clients where workspace_id = (select v from qa.ids where k = 'C') and next_action = '상담 신청 — 연락드리기'), '20 1');

-- ---------- 누가 무엇을 보나 ----------
select set_config('request.headers', '', false);
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('V1 팀장: 내 잠재고객 4곳 보임 · 받은 수 4', (select count(*)::text from public.operations_clients where workspace_id = (select v from qa.ids where k = 'P') and next_action = '상담 신청 — 연락드리기') || ' ' || (select public.intake_link_state(v)->'link'->>'received' from qa.ids where k = 'P'), '4 4');
select qa.eq('V2 팀장: 대표 · 외부 고객 잠재고객 0', (select count(*)::text from public.operations_clients where workspace_id in (select v from qa.ids where k in ('O', 'C'))), '0');
reset role;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('V3 대표: 팀장 링크로 들어온 잠재고객 0(허락 전 — 0026) · 외부 고객 것 0', (select count(*)::text from public.operations_clients where workspace_id in (select v from qa.ids where k in ('P', 'C'))), '0');
select qa.eq('V4 대표: 내 링크로 들어온 20곳은 보임', (select count(*)::text from public.operations_clients where workspace_id = (select v from qa.ids where k = 'O') and next_action = '상담 신청 — 연락드리기'), '20');
reset role;

-- ---------- 주소 새로 만들기 · 받지 않기 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
insert into qa.slugs select 'P2', public.intake_link_rotate(v)->'link'->>'slug' from qa.ids where k = 'P';
select qa.eq('N1 새 주소 · 제목 그대로 · 닫힌 링크 1', (select (p2.slug <> p.slug)::text from qa.slugs p, qa.slugs p2 where p.k = 'P' and p2.k = 'P2') || ' ' || (select public.intake_link_state(v)->'link'->>'title' from qa.ids where k = 'P') || ' ' || (select public.intake_link_state(v)->>'closed' from qa.ids where k = 'P'), 'true 팀장 상담 1');
reset role;
set role anon;
select set_config('request.headers', '{"cf-connecting-ip":"8.8.8.1"}', false);
select qa.eq('N2 예전 주소: 화면 null · 신청 closed', coalesce((select public.public_intake_form(slug)::text from qa.slugs where k = 'P'), 'null') || ' ' || (select public.public_intake_submit(slug, '{"name":"늦은 사람","phone":"010-6000-0001","consent":true}') from qa.slugs where k = 'P'), 'null closed');
select qa.eq('N3 새 주소는 받음', (select public.public_intake_submit(slug, '{"name":"새 주소 사람","phone":"010-6000-0002","consent":true}') from qa.slugs where k = 'P2'), 'ok');
reset role;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('N4 받지 않기 → 링크 없음 · 닫힌 링크 2', (select coalesce(s->>'link', '-') || ' ' || (s->>'closed') from (select public.intake_link_off(v) s from qa.ids where k = 'P') x), '- 2');
select qa.no('N5 링크 없을 때 새로 만들기 막힘', $q$select public.intake_link_rotate((select v from qa.ids where k = 'P'))$q$);
reset role;
set role anon;
select qa.eq('N6 끈 주소: 화면 null · 신청 closed', coalesce((select public.public_intake_form(slug)::text from qa.slugs where k = 'P2'), 'null') || ' ' || (select public.public_intake_submit(slug, '{"name":"끈 뒤","phone":"010-6000-0003","consent":true}') from qa.slugs where k = 'P2'), 'null closed');
reset role;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('N7 다시 만들기 → 또 새 주소(예전 둘과 다름)', (select (s->'link'->>'slug') not in (select slug from qa.slugs where k in ('P', 'P2')) from (select public.intake_link_save(v, '팀장 상담', '') s from qa.ids where k = 'P') x)::text, 'true');
reset role;

-- ---------- 사용 승인이 없는 주인의 링크(서버가 억지로 만든 경우) ----------
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  set local session_replication_role = replica;
  insert into public.workspaces (id, name, owner_id) values ('27000000-0000-0000-0000-0000000000e1', 'R 몰래', '19000000-0000-0000-0000-0000000000c1') on conflict do nothing;
  insert into public.public_intake_links (workspace_id, slug, title) values ('27000000-0000-0000-0000-0000000000e1', 'aaaaaaaaaaaa', '승인 없음') on conflict do nothing;
end $$;
set role anon;
select qa.eq('U1 승인 없는 주인 링크: 화면 null · 신청 closed', coalesce(public.public_intake_form('aaaaaaaaaaaa')::text, 'null') || ' ' || public.public_intake_submit('aaaaaaaaaaaa', '{"name":"x","phone":"010-7000-0001","consent":true}'), 'null closed');
reset role;
select qa.eq('U2 그 작업공간에 들어간 것 0', (select count(*)::text from public.operations_clients where workspace_id = '27000000-0000-0000-0000-0000000000e1'), '0');

-- 정리: 다음 시험(격리)이 쓰지 않도록 이 시험이 만든 줄만 지운다(시험 DB)
select set_config('request.headers', '', false);
select set_config('request.jwt.claim.sub', '', false);
delete from public.operations_clients where next_action = '상담 신청 — 연락드리기';
delete from public.public_intake_links;
delete from public.workspaces where id = '27000000-0000-0000-0000-0000000000e1';
delete from public.public_intake_log where kind like 'intake_link%';
