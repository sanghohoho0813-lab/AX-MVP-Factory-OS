-- =====================================================================
-- 운영 DB 점검 — 0030(D-638 AI 답 보관 — 화면을 떠나도 답을 다시 받기)이 들어가 있는지 **읽기만** 해서 알려 준다.
-- (마이그레이션 아님 — 넣기 전에도 · 넣은 뒤에도 몇 번이든 실행해도 된다. 선행 없음 — auth.users 만 있으면 된다)
-- 사용: Supabase SQL Editor 에 이 파일을 **통째로** 붙여 넣고 실행.
-- 읽기 전용 보장: 맨 위 `set transaction read only` + 아래는 SELECT 한 문장뿐. 표 안의 답(내용)은 읽지 않는다 — 있는지 · 권한 · 정책만 본다.
-- 결과: 표 하나(묶음 | 번호 | 무엇 | 본 것 | 결과)
--   '0 확인' 읽기 전용 거래 = on · '2 이번' 0030 — '없음'(아직) · '들어감'(끝) · '일부만'(중간에 멈춤 — 0030 파일을 다시 통째로 실행) · '꺼짐(되돌림)'(rollback_0030 뒤)
-- 넣는 순서 · 되돌리기: docs/OPS_0023_0024_RUNBOOK.md §15.
-- =====================================================================
set transaction read only;

with t as (
  select to_regclass('public.ai_assist_results') as rel
), parts(no, what, ok) as (
  values
  (1, '표 ai_assist_results', (select rel is not null from t)),
  (2, 'RLS 켜짐', coalesce((select c.relrowsecurity from pg_class c where c.oid = (select rel from t)), false)),
  (3, '정책 둘(자기 줄 읽기 · 넣기)', (select count(*) = 2 from pg_policies where schemaname = 'public' and tablename = 'ai_assist_results')),
  (4, '앱 계정 권한 = 읽기 · 넣기만(고치기 · 지우기 없음)', coalesce((select string_agg(privilege_type, ',' order by privilege_type) = 'INSERT,SELECT' from information_schema.role_table_grants where table_schema = 'public' and table_name = 'ai_assist_results' and grantee = 'authenticated'), false)),
  (5, '로그인 안 한 사람(anon) 권한 0', (select count(*) = 0 from information_schema.role_table_grants where table_schema = 'public' and table_name = 'ai_assist_results' and grantee = 'anon'))
), sum as (
  select count(*) filter (where ok) as got, count(*) as total,
         bool_and(ok) filter (where no in (1, 2, 3, 5)) as base_ok,
         bool_or(ok) filter (where no = 4) as grant_ok
  from parts
)
select '0 확인' as 묶음, 0 as 번호, '읽기 전용 거래' as 무엇, current_setting('transaction_read_only') as 본_것, current_setting('transaction_read_only') as 결과
union all
select '2 이번', 30, '0030 AI 답 보관', got || '/' || total,
       case when got = total then '들어감'
            when got = 0 then '없음'
            when base_ok and not grant_ok then '꺼짐(되돌림)'
            else '일부만' end
from sum
order by 번호;
