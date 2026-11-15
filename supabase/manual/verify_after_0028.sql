-- 0028(L-7 · D-610 가입하면 바로 쓰기) 적용 뒤 확인 — 읽기만
-- SQL Editor 에 통째로 붙여 실행. 맨 위 줄이 이 거래를 읽기 전용으로 묶는다(같은 덩어리 안 쓰기 문장은 오류로 막힌다).
-- 결과: 번호 | 무엇 | 값 | 판정 — 1~5 가 모두 '좋음' 이면 들어간 것이다. 6 · 7 은 지금 상태 안내(판정 아님 · 개인 정보 없음).
set transaction read only;
select n, item, val, verdict from (
  select 1 as n, '가입 열기 설정 표 · 열린 계정 기록 표 · 설정 한 줄' as item,
         (select count(*)::text from pg_tables where schemaname = 'public' and tablename in ('self_signup_policy', 'self_signup_accounts')) || ' · '
           || (case when to_regclass('public.self_signup_policy') is null then '-' else (select count(*)::text from public.self_signup_policy) end) as val,
         case when (select count(*) from pg_tables where schemaname = 'public' and tablename in ('self_signup_policy', 'self_signup_accounts')) = 2
               and to_regclass('public.self_signup_policy') is not null and (select count(*) from public.self_signup_policy) = 1 then '좋음' else '없음' end as verdict
  union all
  select 2, '함수(signup_open · self_signup_*)',
         (select count(*)::text from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public'
            and (p.proname like 'self\_signup\_%' or p.proname = 'signup_open')),
         case when (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public'
            and (p.proname like 'self\_signup\_%' or p.proname = 'signup_open')) = 8 then '좋음' else '없음' end
  union all
  select 3, '앱 계정이 두 표에 가진 권한(읽기만 · 정책이 없어 0줄)',
         coalesce((select string_agg(distinct privilege_type, ',') from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name in ('self_signup_policy', 'self_signup_accounts')), '-'),
         case when (select string_agg(distinct privilege_type, ',') from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name in ('self_signup_policy', 'self_signup_accounts')) = 'SELECT'
               and not exists (select 1 from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public' and table_name in ('self_signup_policy', 'self_signup_accounts'))
               and not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('self_signup_policy', 'self_signup_accounts')) then '좋음' else '살펴볼 것' end
  union all
  select 4, '로그인 안 한 사람: 열림 여부만(시작 · 대표 설정 0)',
         (case when to_regprocedure('public.self_signup_start(text)') is null then '-' else
            has_function_privilege('anon', 'public.signup_open()', 'execute')::text || ' · '
            || has_function_privilege('anon', 'public.self_signup_start(text)', 'execute')::text || ' · '
            || has_function_privilege('anon', 'public.self_signup_admin()', 'execute')::text end),
         case when to_regprocedure('public.self_signup_start(text)') is not null
               and has_function_privilege('anon', 'public.signup_open()', 'execute')
               and not has_function_privilege('anon', 'public.self_signup_start(text)', 'execute')
               and not has_function_privilege('anon', 'public.self_signup_admin()', 'execute') then '좋음' else '살펴볼 것' end
  union all
  select 5, '안쪽 함수(남은 자리 · 조건)는 앱에서 못 부름',
         (case when to_regprocedure('public.self_signup_check(uuid)') is null then '-' else
            has_function_privilege('authenticated', 'public.self_signup_seats_left()', 'execute')::text || ' · '
            || has_function_privilege('authenticated', 'public.self_signup_check(uuid)', 'execute')::text end),
         case when to_regprocedure('public.self_signup_check(uuid)') is not null
               and not has_function_privilege('authenticated', 'public.self_signup_seats_left()', 'execute')
               and not has_function_privilege('authenticated', 'public.self_signup_check(uuid)', 'execute') then '좋음' else '살펴볼 것' end
  union all
  select 6, '지금 가입하면 바로 쓰기(열림 · 받을 사람 수)',
         (case when to_regclass('public.self_signup_policy') is null then '-' else
            (select (case when open then '켜짐' else '꺼짐' end) || ' · ' || seat_limit || '명' from public.self_signup_policy where id = 1) end), '안내'
  union all
  select 7, '이 길로 열린 계정 수',
         (case when to_regclass('public.self_signup_accounts') is null then '-' else (select count(*)::text from public.self_signup_accounts) end), '안내'
) x
order by n;
