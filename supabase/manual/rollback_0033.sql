-- 0033 되돌리기 — 고객성장관리(보고서 발행 · 열람/확인 기록)를 멈춘다. 대표가 되돌리라고 할 때만.
-- 하는 일: 0033 함수 실행 권한 · 두 표 읽기 권한을 거둔다 → 내부 OS 의 '고객에게 보낸 보고서' 칸 · 홈페이지의 '보고서' 칸이 숨고 예전 화면 그대로 돌아간다.
-- 남기는 것: 보고서 표 · 열람 기록 표와 그 안의 기록 · 함수 본문 · 기존 고객 포털(0006) 함수와 권한 — 아무것도 지우지 않는다.
-- 다시 켜려면 0033 파일을 통째로 다시 실행.
begin;
revoke execute on function public.portal_reports(uuid) from authenticated;
revoke execute on function public.portal_report(uuid, uuid) from authenticated;
revoke execute on function public.portal_mark_report_seen(uuid, uuid) from authenticated;
revoke execute on function public.portal_acknowledge_report(uuid, uuid) from authenticated;
revoke execute on function public.portal_mark_home() from authenticated;
revoke execute on function public.portal_growth_summary() from authenticated;
revoke execute on function public.portal_publish_report(uuid, text, text, text, text, date, date, text, jsonb, text, jsonb, uuid, text) from authenticated;
revoke execute on function public.portal_withdraw_report(uuid, text) from authenticated;
revoke execute on function public.portal_preview_reports(uuid, text) from authenticated;
revoke execute on function public.portal_preview_report(uuid) from authenticated;
revoke execute on function public.portal_link_accounts(uuid, text) from authenticated;
-- 내부 화면이 표를 직접 읽는 길도 닫는다(기록은 그대로 — 0033 을 다시 실행하면 다시 읽힌다)
revoke select on public.portal_reports from authenticated;
revoke select on public.portal_receipts from authenticated;
commit;
-- 확인: false | false | false 이면 되돌려진 것
select has_function_privilege('authenticated', 'public.portal_growth_summary()', 'execute') as customer_summary,
       has_function_privilege('authenticated', 'public.portal_publish_report(uuid,text,text,text,text,date,date,text,jsonb,text,jsonb,uuid,text)', 'execute') as staff_publish,
       has_function_privilege('authenticated', 'public.portal_mark_home()', 'execute') as customer_mark_home;
