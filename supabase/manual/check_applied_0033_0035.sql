-- =====================================================================
-- 운영 DB 점검 — 0033 ~ 0035 세 개가 들어가 있는지 한 장으로(D-687)
-- **읽기만** 한다(맨 위 `set transaction read only` + SELECT 한 문장). 넣기 전에도 · 넣은 뒤에도 몇 번이든 실행해도 된다.
-- 이 파일은 `node scripts/make-ops-bundle.mjs` 가 만든다(마이그레이션이 만드는 표 · 함수 이름을 그대로 센다).
-- 사용: Supabase SQL Editor 에 이 파일을 **통째로** 붙여 넣고 실행.
-- 결과: 세 줄(번호 | 무엇 | 있는 것 | 결과) — '없음'(아직) · '들어감'(끝) · '일부만'(있을 수 없는 상태 — 묶음을 다시 통째로 실행).
-- 되돌린 것(rollback_00NN — 권한만 거둠)은 이 표에서 '들어감' 으로 보인다. 그것까지 가르려면 verify_after_0033 · 0034 · 0035.sql.
-- =====================================================================
set transaction read only;

with fn(name) as (
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
), part(no, what, ok) as (
  values
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', to_regclass('public.portal_reports') is not null),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', to_regclass('public.portal_receipts') is not null),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_growth_guard')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_growth_text')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_growth_clean_sections')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_growth_clean_refs')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_report_item')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_reports')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_report')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_mark_report_seen')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_acknowledge_report')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_mark_home')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_growth_summary')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_publish_report')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_withdraw_report')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_preview_reports')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_preview_report')),
  ('0033', '고객에게 보고서 발행 · 계정별 열어 봄 · 확인(D-681)', exists (select 1 from fn where name = 'portal_link_accounts')),
  ('0034', '공유 서류 · 결과 글 열람 기록(D-685)', exists (select 1 from fn where name = 'portal_mark_item_seen')),
  ('0035', '고객 화면 ''새 결과 자료''(D-686)', exists (select 1 from fn where name = 'portal_results_state')),
  ('0035', '고객 화면 ''새 결과 자료''(D-686)', exists (select 1 from fn where name = 'portal_result_summary'))
)
select no as 번호, what as 무엇, count(*) filter (where ok) || '/' || count(*) as 있는_것,
       case when bool_and(ok) then '들어감' when bool_or(ok) then '일부만' else '없음' end as 결과
from part group by no, what order by no;
