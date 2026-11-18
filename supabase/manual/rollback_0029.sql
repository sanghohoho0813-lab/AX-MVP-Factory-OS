-- 0029 되돌리기 — 앱에서 가입 신청을 승인 · 거절하는 길을 멈춘다(대표 설정 '가입 신청' 칸 · 종 숫자가 숨고, 새 가입자는 예전 '아직 사용 승인 전' 화면).
-- 대표가 되돌리라고 할 때만.
-- 하는 일: 0029 함수 실행 권한만 거둔다.
-- 남기는 것: 결정 기록 표 · 이미 승인한 고객 계정 · 작업공간 · 함수 본문 — 아무것도 지우지 않는다. 다시 켜려면 0029 파일을 통째로 다시 실행.
-- (되돌린 동안 승인은 지금처럼 SQL Editor 에서 customer_provision.sql 로)
begin;
revoke execute on function public.my_signup_status() from authenticated;
revoke execute on function public.signup_requests(integer) from authenticated;
revoke execute on function public.signup_requests_count() from authenticated;
revoke execute on function public.signup_approve(uuid, text) from authenticated;
revoke execute on function public.signup_reject(uuid, text) from authenticated;
commit;
-- 확인: false | false 이면 되돌려진 것
select has_function_privilege('authenticated', 'public.my_signup_status()', 'execute') as app_status,
       has_function_privilege('authenticated', 'public.signup_approve(uuid, text)', 'execute') as app_approve;
