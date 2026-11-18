-- 0029(D-635 가입 신청 → 대표가 앱에서 승인 · 거절) 적용 뒤 확인 — 읽기만
-- SQL Editor 에 통째로 붙여 실행. 맨 위 줄이 이 거래를 읽기 전용으로 묶는다(같은 덩어리 안 쓰기 문장은 오류로 막힌다).
-- 결과: 번호 | 무엇 | 값 | 판정 — 1~5 가 모두 '좋음' 이면 들어간 것이다. 6 · 7 · 8 은 지금 상태 안내(판정 아님 · 개인 정보 없음 · 숫자만).
set transaction read only;
select n, item, val, verdict from (
  select 1 as n, '결정 기록 표 · 앱 규칙 0개(함수로만)' as item,
         (select count(*)::text from pg_tables where schemaname = 'public' and tablename = 'signup_decisions') || ' · '
           || (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'signup_decisions') as val,
         case when (select count(*) from pg_tables where schemaname = 'public' and tablename = 'signup_decisions') = 1
               and (select relrowsecurity from pg_class where oid = to_regclass('public.signup_decisions')) is true
               and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'signup_decisions') = 0 then '좋음' else '없음' end as verdict
  union all
  select 2, '함수(signup_request_check · my_signup_status · signup_requests · signup_requests_count · signup_approve · signup_reject)',
         (select count(*)::text from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public'
            and p.proname in ('signup_request_check', 'my_signup_status', 'signup_requests', 'signup_requests_count', 'signup_approve', 'signup_reject')),
         case when (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public'
            and p.proname in ('signup_request_check', 'my_signup_status', 'signup_requests', 'signup_requests_count', 'signup_approve', 'signup_reject')) = 6 then '좋음' else '없음' end
  union all
  select 3, '앱 계정이 결정 표에 가진 권한(읽기만 · 정책이 없어 0줄)',
         coalesce((select string_agg(distinct privilege_type, ',') from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name = 'signup_decisions'), '-'),
         case when (select string_agg(distinct privilege_type, ',') from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name = 'signup_decisions') = 'SELECT'
               and not exists (select 1 from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public' and table_name = 'signup_decisions') then '좋음' else '살펴볼 것' end
  union all
  select 4, '로그인 안 한 사람: 다섯 함수 모두 못 부름(내 상태 · 목록 · 숫자 · 승인 · 거절)',
         (case when to_regprocedure('public.signup_approve(uuid, text)') is null then '-' else
            has_function_privilege('anon', 'public.my_signup_status()', 'execute')::text || ' · '
            || has_function_privilege('anon', 'public.signup_requests(integer)', 'execute')::text || ' · '
            || has_function_privilege('anon', 'public.signup_requests_count()', 'execute')::text || ' · '
            || has_function_privilege('anon', 'public.signup_approve(uuid, text)', 'execute')::text || ' · '
            || has_function_privilege('anon', 'public.signup_reject(uuid, text)', 'execute')::text end),
         case when to_regprocedure('public.signup_approve(uuid, text)') is not null
               and not has_function_privilege('anon', 'public.my_signup_status()', 'execute')
               and not has_function_privilege('anon', 'public.signup_requests(integer)', 'execute')
               and not has_function_privilege('anon', 'public.signup_requests_count()', 'execute')
               and not has_function_privilege('anon', 'public.signup_approve(uuid, text)', 'execute')
               and not has_function_privilege('anon', 'public.signup_reject(uuid, text)', 'execute') then '좋음' else '살펴볼 것' end
  union all
  select 5, '로그인한 앱: 다섯 함수는 부름(대표인지는 함수 안에서) · 안쪽 조건 함수는 못 부름',
         (case when to_regprocedure('public.signup_request_check(uuid)') is null then '-' else
            has_function_privilege('authenticated', 'public.my_signup_status()', 'execute')::text || ' · '
            || has_function_privilege('authenticated', 'public.signup_approve(uuid, text)', 'execute')::text || ' · '
            || has_function_privilege('authenticated', 'public.signup_request_check(uuid)', 'execute')::text end),
         case when to_regprocedure('public.signup_request_check(uuid)') is not null
               and has_function_privilege('authenticated', 'public.my_signup_status()', 'execute')
               and has_function_privilege('authenticated', 'public.signup_requests(integer)', 'execute')
               and has_function_privilege('authenticated', 'public.signup_requests_count()', 'execute')
               and has_function_privilege('authenticated', 'public.signup_approve(uuid, text)', 'execute')
               and has_function_privilege('authenticated', 'public.signup_reject(uuid, text)', 'execute')
               and not has_function_privilege('authenticated', 'public.signup_request_check(uuid)', 'execute') then '좋음'
              when to_regprocedure('public.signup_request_check(uuid)') is not null
               and not has_function_privilege('authenticated', 'public.signup_approve(uuid, text)', 'execute') then '꺼짐(되돌림)'
              else '살펴볼 것' end
  union all
  select 6, '지금 기다리는 가입 신청 수(거절한 사람 빼고 · 메일 확인 전 포함)',
         (case when to_regprocedure('public.signup_request_check(uuid)') is null then '-' else
            (select count(*)::text from auth.users u
              where not exists (select 1 from public.signup_decisions d where d.user_id = u.id and d.decision = 'rejected')
                and public.signup_request_check(u.id) in ('pending', 'unconfirmed')) end), '안내'
  union all
  select 7, '대표 결정 기록(승인 · 거절)',
         (case when to_regclass('public.signup_decisions') is null then '-' else
            (select '승인 ' || count(*) filter (where decision = 'approved') || ' · 거절 ' || count(*) filter (where decision = 'rejected') from public.signup_decisions) end), '안내'
  union all
  select 8, '0028 가입하면 바로 쓰기(꺼짐이어야 대표 승인으로만 열림)',
         (case when to_regclass('public.self_signup_policy') is null then '-' else
            (select case when open then '켜짐' else '꺼짐' end from public.self_signup_policy where id = 1) end), '안내'
) x
order by n;
