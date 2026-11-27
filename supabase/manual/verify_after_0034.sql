-- 0034(D-685 공유 서류 · 결과 글 열람 기록) 적용 뒤 확인 — 읽기만
-- SQL Editor 에 통째로 붙여 실행. 맨 위 줄이 이 거래를 읽기 전용으로 묶는다(같은 덩어리 안 쓰기 문장은 오류로 막힌다).
-- 결과: 번호 | 무엇 | 값 | 판정 — 1~4 가 모두 '좋음' 이면 들어간 것이다. 5 · 6 은 지금 상태 안내(판정 아님).
set transaction read only;
select n, item, val, verdict from (
  select 1 as n, '열람 종류에 공유 서류 · 결과 글' as item,
         coalesce((select pg_get_constraintdef(oid) from pg_constraint where conname = 'portal_receipts_item_kind_check' and conrelid = 'public.portal_receipts'::regclass), '없음') as val,
         case when coalesce((select pg_get_constraintdef(oid) from pg_constraint where conname = 'portal_receipts_item_kind_check' and conrelid = 'public.portal_receipts'::regclass), '') like '%document%result%' then '좋음' else '없음' end as verdict
  union all
  select 2, '고객 함수 1 · 넣은 때 1',
         (select count(*)::text from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in ('portal_mark_item_seen', 'portal_result_receipts_since')),
         case when (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in ('portal_mark_item_seen', 'portal_result_receipts_since')) = 2 then '좋음' else '없음' end
  union all
  select 3, '로그인한 계정은 부를 수 있음 · 로그인 안 한 사람(anon)은 못 부름',
         has_function_privilege('authenticated', 'public.portal_mark_item_seen(uuid,text,uuid)', 'execute')::text || ' · ' || has_function_privilege('anon', 'public.portal_mark_item_seen(uuid,text,uuid)', 'execute')::text,
         case when has_function_privilege('authenticated', 'public.portal_mark_item_seen(uuid,text,uuid)', 'execute') and not has_function_privilege('anon', 'public.portal_mark_item_seen(uuid,text,uuid)', 'execute')
               and not has_function_privilege('anon', 'public.portal_result_receipts_since()', 'execute') then '좋음' else '확인' end
  union all
  select 4, '열람 표 앱 권한은 그대로(읽기만 · anon 0)',
         coalesce((select string_agg(distinct grantee || ':' || privilege_type, ',') from information_schema.role_table_grants
                    where table_schema = 'public' and table_name = 'portal_receipts' and grantee in ('anon', 'authenticated')), '없음'),
         case when (select string_agg(distinct grantee || ':' || privilege_type, ',') from information_schema.role_table_grants
                    where table_schema = 'public' and table_name = 'portal_receipts' and grantee in ('anon', 'authenticated')) = 'authenticated:SELECT' then '좋음' else '확인' end
  union all
  select 5, '기록을 남기기 시작한 때', coalesce((select public.portal_result_receipts_since()::text), '없음'), '안내'
  union all
  select 6, '지금까지 열어 본 기록(공유 서류 · 결과 글)',
         (select count(*) filter (where item_kind = 'document') || ' · ' || count(*) filter (where item_kind = 'result') from public.portal_receipts),
         '안내'
) x
order by n;
