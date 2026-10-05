-- =====================================================================
-- D-153 직원이 고객 계정을 이메일로 찾기 — 고객 플랫폼 연결용
--
-- 문제: 고객 계정 표(profiles)는 '자기 것 · 같은 워크스페이스 동료' 만 읽을 수 있다(RLS). 그래서 직원이 업체 상세
--       > 고객 플랫폼에서 고객 이메일로 계정을 찾으면 늘 '찾지 못했습니다' 였다(고객은 워크스페이스 동료가 아니다).
-- 해결: 직원(워크스페이스 소유자 · 관리자 · 편집자)만 부를 수 있는 조회 함수 하나.
--       - 정확히 같은 이메일(대소문자 무시)만 — 비슷한 이메일 · 목록 · 다른 칸은 돌려주지 않는다(id · email 둘만)
--       - 로그인 안 한 사람 · 어느 워크스페이스에도 직원이 아닌 사람은 빈 결과
-- 원칙: 추가만(함수 하나). 표 · 정책을 바꾸지 않는다. 여러 번 실행해도 같다.
-- 운영 DB 에는 대표가 Supabase SQL Editor 에서 한 번 실행해야 켜진다(안 해도 앱은 예전처럼 직접 찾기로 돈다).
-- =====================================================================

create or replace function public.staff_find_customer_profile(p_email text)
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email
  from public.profiles p
  where lower(p.email) = lower(btrim(coalesce(p_email, '')))
    and btrim(coalesce(p_email, '')) <> ''
    and exists (
      select 1 from public.workspace_members m
      where m.user_id = auth.uid() and m.role in ('owner', 'admin', 'editor')
    )
  limit 1;
$$;
revoke all on function public.staff_find_customer_profile(text) from public, anon;
grant execute on function public.staff_find_customer_profile(text) to authenticated;
