-- 0026 되돌리기 — 대표가 팀장 화면에서 고객 자료를 다시 **허락 없이** 보게(0020 상태). 대표가 되돌리라고 할 때만.
-- 하는 일: 0026 이 더한 문(정책)만 뗀다 · 화면 함수 실행 권한을 거둔다(앱은 허락 화면을 숨긴다).
-- 남기는 것: 허락 · 요청 기록 표와 그 안의 기록(지우지 않음) · 함수 본문. 다시 켜려면 0026 파일을 통째로 다시 실행.
begin;
do $$
declare t text;
begin
  for t in select tablename from pg_policies where schemaname = 'public' and policyname = 'zz View consent gate' loop
    execute format('drop policy %I on public.%I', 'zz View consent gate', t);
  end loop;
end $$;
drop policy if exists "zz View consent gate client documents" on storage.objects;
revoke execute on function public.view_consent_state(uuid) from authenticated;
revoke execute on function public.view_consent_grant(uuid, integer) from authenticated;
revoke execute on function public.view_consent_revoke(uuid) from authenticated;
revoke execute on function public.view_consent_request(uuid) from authenticated;
revoke execute on function public.view_consent_decline(uuid) from authenticated;
commit;
-- 확인: 0 | 0 이면 되돌려진 것
select (select count(*) from pg_policies where policyname = 'zz View consent gate') as gate_policies,
       (select count(*) from pg_policies where policyname = 'zz View consent gate client documents') as storage_gate;
