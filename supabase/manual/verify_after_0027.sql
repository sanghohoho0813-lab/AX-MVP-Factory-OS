-- 0027(L-9 · D-609 고객마다 상담 신청 링크) 적용 뒤 확인 — 읽기만
-- SQL Editor 에 통째로 붙여 실행. 맨 위 줄이 이 거래를 읽기 전용으로 묶는다(같은 덩어리 안 쓰기 문장은 오류로 막힌다).
-- 결과: 번호 | 무엇 | 값 | 판정 — 1~5 가 모두 '좋음' 이면 들어간 것이다. 6 · 7 은 지금 상태 안내(판정 아님 · 개인 정보 없음).
set transaction read only;
select n, item, val, verdict from (
  select 1 as n, '상담 신청 링크 표 · 주인만 읽는 규칙' as item,
         (select count(*)::text from pg_tables where schemaname = 'public' and tablename = 'public_intake_links') || ' · '
           || (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'public_intake_links') as val,
         case when (select count(*) from pg_tables where schemaname = 'public' and tablename = 'public_intake_links') = 1
               and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'public_intake_links') >= 1 then '좋음' else '없음' end as verdict
  union all
  select 2, '화면이 쓰는 함수(intake_link_* · public_intake_form · public_intake_submit)',
         (select count(*)::text from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public'
            and (p.proname like 'intake\_link\_%' or p.proname in ('public_intake_form', 'public_intake_submit'))),
         case when (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public'
            and (p.proname like 'intake\_link\_%' or p.proname in ('public_intake_form', 'public_intake_submit'))) = 7 then '좋음' else '없음' end
  union all
  select 3, '앱 계정이 링크 표에 가진 권한(읽기만이어야 함)',
         coalesce((select string_agg(distinct privilege_type, ',') from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name = 'public_intake_links'), '-'),
         case when (select string_agg(distinct privilege_type, ',') from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name = 'public_intake_links') = 'SELECT'
               and not exists (select 1 from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public' and table_name = 'public_intake_links') then '좋음' else '살펴볼 것' end
  union all
  select 4, '로그인 안 한 사람: 공개 화면 · 신청만 부를 수 있음(링크 만들기 0)',
         (case when to_regprocedure('public.public_intake_submit(text,jsonb)') is null then '-' else
            has_function_privilege('anon', 'public.public_intake_form(text)', 'execute')::text || ' · '
            || has_function_privilege('anon', 'public.public_intake_submit(text,jsonb)', 'execute')::text || ' · '
            || has_function_privilege('anon', 'public.intake_link_save(uuid,text,text)', 'execute')::text end),
         case when to_regprocedure('public.public_intake_submit(text,jsonb)') is not null
               and has_function_privilege('anon', 'public.public_intake_form(text)', 'execute')
               and has_function_privilege('anon', 'public.public_intake_submit(text,jsonb)', 'execute')
               and not has_function_privilege('anon', 'public.intake_link_save(uuid,text,text)', 'execute') then '좋음' else '살펴볼 것' end
  union all
  select 5, '주소 겹침 막기 · 작업공간마다 열린 링크 하나',
         (select count(*)::text from pg_indexes where schemaname = 'public' and indexname in ('public_intake_links_slug_idx', 'public_intake_links_one_open_idx')),
         case when (select count(*) from pg_indexes where schemaname = 'public' and indexname in ('public_intake_links_slug_idx', 'public_intake_links_one_open_idx')) = 2 then '좋음' else '없음' end
  union all
  select 6, '지금 열린 링크 수',
         (select count(*)::text from public.public_intake_links where revoked_at is null), '안내'
  union all
  select 7, '링크로 받은 신청 수(전체)',
         (select coalesce(sum(received_count), 0)::text from public.public_intake_links), '안내'
) x
order by n;
