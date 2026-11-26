-- 0032 되돌리기 — '늘 보기' 를 모두 끄고(켜 둔 줄에 끈 때만 적는다) 켜는 함수 권한을 거둔다. 대표가 되돌리라고 할 때만.
-- 하는 일: 켜져 있는 늘 보기 줄에 끈 때를 적는다 → 그 작업공간은 다시 0026 그대로(팀장이 허락한 동안만 보임) · 앱은 [늘 보기] 단추를 숨긴다.
-- 남기는 것: 기록 표와 그 안의 기록(지우지 않음) · 함수 본문. 다시 쓰려면 0032 파일을 통째로 다시 실행한 뒤 앱에서 다시 켠다.
begin;
update public.workspace_view_always set ended_at = now() where ended_at is null;
revoke execute on function public.view_always_set(uuid, boolean) from authenticated;
commit;
-- 확인: 0 | false 이면 되돌려진 것
select (select count(*) from public.workspace_view_always where ended_at is null) as always_on_now,
       has_function_privilege('authenticated', 'public.view_always_set(uuid, boolean)', 'execute') as app_can_set;
