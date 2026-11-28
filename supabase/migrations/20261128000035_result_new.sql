-- 20261128000035_result_new.sql
--
-- 고객성장관리 P1-3b(D-686) — 고객 화면에 '새 결과 자료' 를 보여 준다(보고서의 '새 보고서' 와 같은 뜻).
--   · 새 결과 자료 = 내 연결(활성)에 공유한 서류(파일 있음) · 발행한 결과 글 가운데, 기록을 남기기 시작한 뒤(0034 넣은 때) 공유했고 이 계정이 아직 안 연 것.
--   · 계정마다 따로 — 같은 회사 다른 계정이 열어도 내 화면에서는 '새' 그대로(보고서와 같은 원칙).
--   · 기록을 남기기 전에 공유한 자료는 '새' 로 세지 않는다(그때 열었는지 모른다 — 넣는 순간 예전 자료가 한꺼번에 '새' 가 되지 않게).
--
-- 함수 2(고객용 · 읽기만 — 아무것도 기록하지 않는다). 표 · 열 · 정책 · 예전 함수 변경 없음. 여러 번 실행해도 같다.
-- 먼저 있어야 하는 것: 0034 (없으면 멈춘다).
-- 되돌리기: supabase/manual/rollback_0035.sql · 확인: supabase/manual/verify_after_0035.sql

begin;

do $$
begin
  if to_regproc('public.portal_mark_item_seen') is null
     or to_regproc('public.portal_result_receipts_since') is null
     or to_regproc('public.portal_link_owned') is null then
    raise exception '0035 는 0034 를 넣은 뒤에 넣습니다(먼저 넣을 것이 빠졌습니다).';
  end if;
end $$;

-- 고객: 이 연결의 결과 자료마다 새 것인지 · 내가 연 때(서버가 고른 칸만 — 제목 · 파일 이름 · 경로는 기존 투영 함수에서)
create or replace function public.portal_results_state(p_link_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz := public.portal_result_receipts_since();
begin
  if not public.portal_link_owned(p_link_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('kind', x.kind, 'id', x.id, 'seen_at', x.seen_at, 'is_new', x.seen_at is null and x.shared_at >= v_since) order by x.shared_at desc)
      from (
        select 'document'::text as kind, d.id, d.created_at as shared_at,
               (select min(rc.first_seen_at) from public.portal_receipts rc
                 where rc.portal_client_link_id = p_link_id and rc.profile_id = auth.uid() and rc.item_kind = 'document' and rc.item_id = d.id) as seen_at
          from public.portal_documents d
         where d.portal_client_link_id = p_link_id and d.visibility = 'shared_with_customer' and coalesce(d.storage_path, '') <> ''
        union all
        select 'result'::text, u.id, u.published_at,
               (select min(rc.first_seen_at) from public.portal_receipts rc
                 where rc.portal_client_link_id = p_link_id and rc.profile_id = auth.uid() and rc.item_kind = 'result' and rc.item_id = u.id)
          from public.portal_updates u
         where u.portal_client_link_id = p_link_id and u.category = 'result' and u.status = 'published' and u.published_at is not null
      ) x
  ), '[]'::jsonb);
end;
$$;
comment on function public.portal_results_state(uuid) is
  '고객: 이 연결(활성 · 내 것)의 공유 서류 · 결과 글마다 {kind, id, seen_at, is_new}. 읽기만(기록 0). 기록을 남기기 전에 공유한 것은 is_new = false.';
revoke all on function public.portal_results_state(uuid) from public, anon;
grant execute on function public.portal_results_state(uuid) to authenticated;

-- 고객: 내 활성 연결마다 새 결과 자료 수(성장 홈 '지금 할 일' · 프로젝트 카드)
create or replace function public.portal_result_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select l.id from public.portal_client_links l where l.profile_id = auth.uid() and l.status = 'active'
  ), items as (
    select d.portal_client_link_id as link_id, 'document'::text as kind, d.id, d.created_at as shared_at
      from public.portal_documents d join mine on mine.id = d.portal_client_link_id
     where d.visibility = 'shared_with_customer' and coalesce(d.storage_path, '') <> ''
    union all
    select u.portal_client_link_id, 'result', u.id, u.published_at
      from public.portal_updates u join mine on mine.id = u.portal_client_link_id
     where u.category = 'result' and u.status = 'published' and u.published_at is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object('link_id', m.id, 'results_new', (
           select count(*) from items i
            where i.link_id = m.id and i.shared_at >= public.portal_result_receipts_since()
              and not exists (select 1 from public.portal_receipts rc
                               where rc.portal_client_link_id = m.id and rc.profile_id = auth.uid() and rc.item_kind = i.kind and rc.item_id = i.id)
         )) order by m.id), '[]'::jsonb)
    from mine m;
$$;
comment on function public.portal_result_summary() is
  '고객: 내 활성 연결마다 {link_id, results_new} — 기록을 남기기 시작한 뒤 공유했고 이 계정이 아직 안 연 공유 서류 · 결과 글 수. 읽기만.';
revoke all on function public.portal_result_summary() from public, anon;
grant execute on function public.portal_result_summary() to authenticated;

commit;

-- 고객 함수 2(읽기만) · 내부 함수 0.
