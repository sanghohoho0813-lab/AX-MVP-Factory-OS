-- 0028 되돌리기 — 가입하면 바로 쓰기를 멈춘다(새 가입자는 다시 '아직 사용 승인 전' 화면 · 대표 설정 칸은 숨는다). 대표가 되돌리라고 할 때만.
-- 하는 일: 0028 함수 실행 권한만 거둔다.
-- 남기는 것: 설정 표 · 열린 계정 기록 · 이미 열린 고객 계정 · 작업공간 · 함수 본문 — 아무것도 지우지 않는다. 다시 켜려면 0028 파일을 통째로 다시 실행.
begin;
revoke execute on function public.signup_open() from anon, authenticated;
revoke execute on function public.self_signup_state() from authenticated;
revoke execute on function public.self_signup_start(text) from authenticated;
revoke execute on function public.self_signup_admin() from authenticated;
revoke execute on function public.self_signup_admin_save(boolean, integer, integer, integer, boolean) from authenticated;
revoke execute on function public.self_signup_admin_list(integer) from authenticated;
commit;
-- 확인: false | false 이면 되돌려진 것
select has_function_privilege('anon', 'public.signup_open()', 'execute') as anon_open,
       has_function_privilege('authenticated', 'public.self_signup_start(text)', 'execute') as app_start;
