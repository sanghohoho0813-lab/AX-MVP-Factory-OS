-- 0031(L-41 · D-652 서류 올리기 링크) 적용 뒤 확인 — 읽기만
-- SQL Editor 에 통째로 붙여 실행. 맨 위 줄이 이 거래를 읽기 전용으로 묶는다(같은 덩어리 안 쓰기 문장은 오류로 막힌다).
-- 결과: 번호 | 무엇 | 값 | 판정 — 1~5 가 모두 '좋음' 이면 들어간 것이다. 6 · 7 은 지금 상태 안내(판정 아님 · 업체 이름 · 파일 이름 없음).
set transaction read only;
select n, item, val, verdict from (
  select 1 as n, '표 둘 · 읽기 규칙(그 작업공간에 쓸 수 있는 사람만)' as item,
         (select count(*)::text from pg_tables where schemaname = 'public' and tablename in ('client_upload_links', 'client_upload_files')) || ' · '
           || (select count(*)::text from pg_policies where schemaname = 'public' and tablename in ('client_upload_links', 'client_upload_files')) as val,
         case when (select count(*) from pg_tables where schemaname = 'public' and tablename in ('client_upload_links', 'client_upload_files')) = 2
               and (select count(*) from pg_policies where schemaname = 'public' and tablename in ('client_upload_links', 'client_upload_files')) >= 4 then '좋음' else '없음' end as verdict
  union all
  select 2, '화면이 쓰는 함수(upload_link_* · public_upload_*)',
         (select count(*)::text from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public'
            and (p.proname like 'upload\_link\_%' or p.proname in ('public_upload_form', 'public_upload_reserve', 'public_upload_done'))),
         case when (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public'
            and (p.proname like 'upload\_link\_%' or p.proname in ('public_upload_form', 'public_upload_reserve', 'public_upload_done'))) = 13 then '좋음' else '없음' end
  union all
  select 3, '앱 계정이 표에 가진 권한(읽기만이어야 함) · 로그인 안 한 사람 0',
         coalesce((select string_agg(distinct privilege_type, ',') from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name in ('client_upload_links', 'client_upload_files')), '-'),
         case when (select string_agg(distinct privilege_type, ',') from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name in ('client_upload_links', 'client_upload_files')) = 'SELECT'
               and not exists (select 1 from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public' and table_name in ('client_upload_links', 'client_upload_files')) then '좋음' else '살펴볼 것' end
  union all
  select 4, '로그인 안 한 사람: 공개 화면 · 예약 · 다 올림만(링크 만들기 0)',
         (case when to_regprocedure('public.public_upload_reserve(text,text,text,bigint,text)') is null then '-' else
            has_function_privilege('anon', 'public.public_upload_form(text)', 'execute')::text || ' · '
            || has_function_privilege('anon', 'public.public_upload_reserve(text,text,text,bigint,text)', 'execute')::text || ' · '
            || has_function_privilege('anon', 'public.upload_link_save(uuid,text,jsonb,integer,text)', 'execute')::text end),
         case when to_regprocedure('public.public_upload_reserve(text,text,text,bigint,text)') is not null
               and has_function_privilege('anon', 'public.public_upload_form(text)', 'execute')
               and has_function_privilege('anon', 'public.public_upload_reserve(text,text,text,bigint,text)', 'execute')
               and not has_function_privilege('anon', 'public.upload_link_save(uuid,text,jsonb,integer,text)', 'execute') then '좋음' else '살펴볼 것' end
  union all
  select 5, '보관함 넣기 정책 하나(예약한 경로만 · anon · authenticated)',
         coalesce((select string_agg(cmd || ':' || array_to_string(roles, '+'), ',') from pg_policies where schemaname = 'storage' and policyname = 'Upload links: reserved path insert'), '-'),
         case when (select count(*) from pg_policies where schemaname = 'storage' and policyname = 'Upload links: reserved path insert' and cmd = 'INSERT') = 1 then '좋음' else '없음' end
  union all
  select 6, '지금 열린 링크 수',
         (select count(*)::text from public.client_upload_links where revoked_at is null and expires_at > now()), '안내'
  union all
  select 7, '고객이 올리고 아직 칸에 안 넣은 파일 수',
         (select count(*)::text from public.client_upload_files where status = 'uploaded'), '안내'
) x
order by n;
