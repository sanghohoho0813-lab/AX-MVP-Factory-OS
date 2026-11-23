-- =====================================================================
-- 운영 DB 점검 — 0031(L-41 · D-652 서류 올리기 링크)이 들어가 있는지, 넣기 전에 있어야 할 것(0017 · 0019 · 0026)이 있는지
-- **읽기만** 해서 알려 준다. (마이그레이션 아님 — 넣기 전에도 · 넣은 뒤에도 몇 번이든 실행해도 된다)
-- 사용: Supabase SQL Editor 에 이 파일을 **통째로** 붙여 넣고 실행.
-- 읽기 전용 보장: 맨 위 `set transaction read only` + 아래는 SELECT 한 문장뿐. 표 안의 링크 · 파일(내용)은 읽지 않는다 — 있는지 · 권한 · 정책만 본다.
-- 결과: 표 하나(묶음 | 번호 | 무엇 | 본 것 | 결과)
--   '0 확인' 읽기 전용 거래 = on
--   '1 먼저' 0031 을 넣기 전에 있어야 하는 것 — 세 줄 모두 '들어감' 이어야 시작(0026 이 없으면 0031 은 아무것도 바꾸지 않고 멈춘다)
--   '2 이번' 0031 — '없음'(아직) · '들어감'(끝) · '꺼짐(되돌림)'(rollback_0031 뒤) · '일부만'(중간에 멈춤 — 0031 파일을 다시 통째로 실행)
-- 넣는 순서 · 되돌리기: docs/OPS_0023_0024_RUNBOOK.md §16.
-- =====================================================================
set transaction read only;

with fn(name) as (
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
), need(no, what, ok) as (
  values
  (17, '0017 공개 링크 횟수 기록(public_intake_log · hash_access_token)',
     to_regclass('public.public_intake_log') is not null and exists (select 1 from fn where name = 'hash_access_token')),
  (19, '0019 계정 등급(os_access · my_os_access)',
     to_regclass('public.os_access') is not null and exists (select 1 from fn where name = 'my_os_access')),
  (26, '0026 대표가 팀장 자료를 볼 때 허락(view_consent_ok)',
     exists (select 1 from fn where name = 'view_consent_ok'))
), parts(no, what, ok) as (
  values
  (1, '표 client_upload_links · client_upload_files', to_regclass('public.client_upload_links') is not null and to_regclass('public.client_upload_files') is not null),
  (2, 'RLS 켜짐(둘 다)', coalesce((select bool_and(c.relrowsecurity) and count(*) = 2 from pg_class c where c.oid in (to_regclass('public.client_upload_links'), to_regclass('public.client_upload_files'))), false)),
  (3, '함수 13(upload_link_* 10 · public_upload_* 3)', (select count(*) = 13 from fn where name like 'upload\_link\_%' or name in ('public_upload_form', 'public_upload_reserve', 'public_upload_done'))),
  (4, '앱 계정 권한 = 읽기만 · 로그인 안 한 사람 0',
     coalesce((select string_agg(distinct privilege_type, ',') = 'SELECT' from information_schema.role_table_grants where table_schema = 'public' and table_name in ('client_upload_links', 'client_upload_files') and grantee = 'authenticated'), false)
     and not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name in ('client_upload_links', 'client_upload_files') and grantee = 'anon')),
  (5, '보관함 넣기 정책(예약한 경로만)', exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Upload links: reserved path insert')),
  (6, '로그인 안 한 사람: 공개 화면 · 예약 · 다 올림만 부를 수 있음',
     case when to_regprocedure('public.public_upload_reserve(text,text,text,bigint,text)') is null
            or to_regprocedure('public.upload_link_save(uuid,text,jsonb,integer,text)') is null then false
          else has_function_privilege('anon', 'public.public_upload_form(text)', 'execute')
               and has_function_privilege('anon', 'public.public_upload_reserve(text,text,text,bigint,text)', 'execute')
               and has_function_privilege('anon', 'public.public_upload_done(text,text)', 'execute')
               and not has_function_privilege('anon', 'public.upload_link_save(uuid,text,jsonb,integer,text)', 'execute') end),
  (7, '앱 계정: 링크 만들기 · 받은 파일 정하기',
     case when to_regprocedure('public.upload_link_save(uuid,text,jsonb,integer,text)') is null
            or to_regprocedure('public.upload_link_decide(uuid,text)') is null then false
          else has_function_privilege('authenticated', 'public.upload_link_save(uuid,text,jsonb,integer,text)', 'execute')
               and has_function_privilege('authenticated', 'public.upload_link_decide(uuid,text)', 'execute') end)
), sum as (
  select count(*) filter (where ok) as got, count(*) as total,
         bool_and(ok) filter (where no in (1, 2, 3, 4)) as base_ok,
         bool_or(ok) filter (where no in (5, 6, 7)) as on_any
  from parts
)
select '0 확인' as 묶음, 0 as 번호, '읽기 전용 거래' as 무엇, current_setting('transaction_read_only') as 본_것, current_setting('transaction_read_only') as 결과
union all
select '1 먼저', no, what, case when ok then '있음' else '없음' end, case when ok then '들어감' else '없음' end from need
union all
select '2 이번', 31, '0031 서류 올리기 링크', got || '/' || total,
       case when got = total then '들어감'
            when got = 0 then '없음'
            when base_ok and not on_any then '꺼짐(되돌림)'
            else '일부만' end
from sum
order by 번호;
