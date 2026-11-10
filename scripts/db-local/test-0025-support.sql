-- D-568 L-4 고객 문의 · 화면 오류(0025) 시험 — 로컬 시험 DB(axqa)에서만. test-0019 · 0020 · 0024 다음에 돈다.
--   대표 O(a1 · full · 상담신청 받는 작업공간 주인 = 운영자) · 내부 팀장 P(b1 · pilot) · 가입자 R(c1 · 등급 없음) · 고객 C(d1 · pilot · customer)
\set QUIET 1
\set ON_ERROR_STOP 1
select set_config('request.jwt.claim.sub', '', false);
select qa.eq('준비: 표 1 · 정책 1', (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'support_messages'), '1');
select qa.eq('준비: 앱 계정의 표 권한은 SELECT 하나', (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'support_messages' and grantee = 'authenticated'), 'SELECT');
select qa.eq('준비: 로그인 안 한 사람(anon)의 표 권한 0', (select count(*)::text from information_schema.role_table_grants where table_schema = 'public' and table_name = 'support_messages' and grantee = 'anon'), '0');
select qa.eq('서버 작업(로그인한 사람 없음)은 운영자가 아니다', public.support_is_operator()::text, 'false');
select qa.no('서버 작업으로 읽음 표시 함수 — 막힘(운영자만)', $q$select public.support_mark_read(array[gen_random_uuid()])$q$);

-- 로그인 안 한 사람
set role anon;
select qa.no('anon: 표 읽기 막힘', $q$select count(*) from public.support_messages$q$);
select qa.no('anon: 보내기 함수 막힘', $q$select public.support_send('question', '익명 글', '{}')$q$);
select qa.no('anon: 받은함 함수 막힘', $q$select count(*) from public.support_inbox(10)$q$);
reset role;

-- 고객 C: 문의 보내기 · 자기 것만 읽기 · 직접 쓰기 막힘
select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-0000000000d1', false);
set role authenticated;
select qa.eq('C: 운영자 아님', public.support_is_operator()::text, 'false');
select qa.ok('C: 문의 보내기', $q$select public.support_send('question', '  서류를 올렸는데 칸에 안 들어가요  ', '{"path":"/ops/clients"}')$q$);
select qa.eq('C: 내 글 1줄 · 앞뒤 빈칸 정리', (select count(*)::text || ':' || max(body) from public.support_messages), '1:서류를 올렸는데 칸에 안 들어가요');
select qa.no('C: 표에 직접 넣기 막힘', $q$insert into public.support_messages (user_id, kind, body) values (auth.uid(), 'question', '직접')$q$);
select qa.no('C: 답장 칸 직접 고치기 막힘', $q$update public.support_messages set reply = '내가 쓴 답장' where user_id = auth.uid()$q$);
select qa.no('C: 지우기 막힘', $q$delete from public.support_messages where user_id = auth.uid()$q$);
select qa.no('C: 답장 함수 막힘(운영자만)', $q$select public.support_reply((select id from public.support_messages limit 1), '가짜 답장')$q$);
select qa.no('C: 읽음 표시 함수 막힘(운영자만)', $q$select public.support_mark_read(array(select id from public.support_messages))$q$);
select qa.eq('C: 받은함 함수 0줄', (select count(*)::text from public.support_inbox(100)), '0');
select qa.no('C: 빈 글 막힘', $q$select public.support_send('question', '   ', '{}')$q$);
select qa.no('C: 모르는 종류 막힘', $q$select public.support_send('feedback', '글', '{}')$q$);
select qa.ok('C: 아주 긴 글 · 큰 화면 정보도 받는다(잘라서)', $q$select public.support_send('question', repeat('가', 5000), jsonb_build_object('big', repeat('x', 9000)))$q$);
select qa.eq('C: 긴 글은 2000자 · 큰 화면 정보는 비움', (select char_length(body)::text || ':' || context::text from public.support_messages where body like '가가%'), '2000:{}');
reset role;

-- 내부 팀장 P: 화면 오류 — 같은 오류는 하루 한 줄 · 고객 글은 안 보임
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.ok('P: 화면 오류 보내기', $q$select public.support_send('error', 'TypeError: x is undefined', '{"path":"/marketing"}')$q$);
select qa.ok('P: 같은 오류 또 보내기(새 줄 없음)', $q$select public.support_send('error', 'TypeError: x is undefined', '{"path":"/calendar"}')$q$);
select qa.eq('P: 내 오류 1줄', (select count(*)::text from public.support_messages where kind = 'error'), '1');
select qa.eq('P: 고객 글 0줄', (select count(*)::text from public.support_messages where user_id = '24000000-0000-0000-0000-0000000000d1'), '0');
select qa.eq('P: 받은함 함수 0줄', (select count(*)::text from public.support_inbox(100)), '0');
reset role;

-- 가입자 R(등급 없음): 보내기 막힘
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
select qa.no('R: 등급 없는 계정은 보내기 막힘', $q$select public.support_send('question', '가입만 했어요', '{}')$q$);
select qa.eq('R: 읽히는 글 0줄', (select count(*)::text from public.support_messages), '0');
reset role;

-- 대표 O(운영자): 전부 읽기 · 읽음 · 답장 — 보낸 글은 못 고친다
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O: 운영자', public.support_is_operator()::text, 'true');
select qa.eq('O: 전부 읽힘(고객 2 · 팀장 1)', (select count(*)::text from public.support_messages), '3');
select qa.eq('O: 받은함 — 고객 글에 이메일 · 고객 구분', (select author_email || ':' || author_audience from public.support_inbox(100) where body like '서류를%'), 'cust24@x.kr:customer');
select qa.eq('O: 받은함 — 팀장 글은 internal', (select author_audience from public.support_inbox(100) where kind = 'error'), 'internal');
select qa.eq('O: 안 읽은 것 3', (select count(*)::text from public.support_inbox(100) where read_at is null), '3');
select qa.eq('O: 읽음 표시 1줄', public.support_mark_read(array(select id from public.support_messages where kind = 'error'))::text, '1');
select qa.eq('O: 읽음 표시 다시 = 0줄', public.support_mark_read(array(select id from public.support_messages where kind = 'error'))::text, '0');
select qa.eq('O: 답장', public.support_reply((select id from public.support_messages where body like '서류를%'), '  서류함에서 [무슨 서류?] 를 눌러 보세요  ')::text, 'true');
select qa.eq('O: 답장하면 읽음도 같이 · 보낸 글은 그대로', (select (read_at is not null)::text || ':' || reply || ':' || body from public.support_messages where body like '서류를%'), 'true:서류함에서 [무슨 서류?] 를 눌러 보세요:서류를 올렸는데 칸에 안 들어가요');
select qa.eq('O: 없는 글에 답장 = false', public.support_reply(gen_random_uuid(), '답')::text, 'false');
select qa.no('O: 빈 답장 막힘', $q$select public.support_reply((select id from public.support_messages limit 1), '  ')$q$);
select qa.no('O: 보낸 글 직접 고치기 막힘(표 쓰기 권한 없음)', $q$update public.support_messages set body = '바꾼 글'$q$);
select qa.no('O: 지우기 막힘', $q$delete from public.support_messages$q$);
select qa.eq('O: 남의 글에 답장 본 표시 = 0줄(보낸 사람만)', public.support_seen(array(select id from public.support_messages))::text, '0');
reset role;

-- 고객 C: 답장이 보인다 · 봤다는 표시 · 남의 글에는 안 된다 · 하루 한도
select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-0000000000d1', false);
set role authenticated;
select qa.eq('C: 답장 보임 · 아직 안 봄', (select reply || ':' || (seen_at is null)::text from public.support_messages where reply is not null), '서류함에서 [무슨 서류?] 를 눌러 보세요:true');
select qa.eq('C: 답장 봤다 1줄', public.support_seen(array(select id from public.support_messages))::text, '1');
select qa.eq('C: 다시 = 0줄', public.support_seen(array(select id from public.support_messages))::text, '0');
select qa.ok('C: 문의 18개 더(하루 20개까지)', $q$select public.support_send('question', '질문 ' || g, '{}') from generate_series(1, 18) g$q$);
select qa.no('C: 21번째 문의 막힘(하루 한도)', $q$select public.support_send('question', '질문 스물한 번째', '{}')$q$);
select qa.ok('C: 오류는 따로 센다', $q$select public.support_send('error', 'RangeError: 고객 화면', '{}')$q$);
select qa.eq('C: 내 글 21줄(문의 20 · 오류 1)', (select count(*)::text from public.support_messages), '21');
reset role;

-- 대표가 다시 답하면 '답장 본 때' 가 비워진다(새 답장 표시)
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O: 다시 답장', public.support_reply((select id from public.support_messages where body like '서류를%'), '고쳤어요 — 다시 올려 보세요')::text, 'true');
select qa.eq('O: 답장 본 때 비움', (select (seen_at is null)::text from public.support_messages where body like '서류를%'), 'true');
reset role;
select set_config('request.jwt.claim.sub', '', false);
