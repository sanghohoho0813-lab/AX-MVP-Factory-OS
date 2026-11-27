-- 20261128000034_result_receipts.sql
--
-- 고객성장관리 P1-3(D-685) — 내부에서 공유한 결과 자료를 고객이 열어 봤는지 계정마다 서버에 남긴다.
--   · '공유 서류'(portal_documents · visibility = shared_with_customer · 파일 있음) — 고객이 [열기] 로 파일을 연 때
--   · '결과 글'(portal_updates · category = result · status = published) — 고객 화면 '결과' 탭에서 그 글이 보인 때
-- 0033 의 열람 표(portal_receipts)를 그대로 쓴다 — 종류(item_kind)에 'document' · 'result' 를 더할 뿐.
--
-- 원칙(0033 그대로)
--   · 고객은 표를 직접 읽지도 쓰지도 못한다. 아래 함수 하나로만 기록 — auth.uid() 가 그 연결(활성)의 고객일 때만 · 그 연결에 보이는 자료만.
--   · 직원은 기록을 만들 수도 고칠 수도 없다(그 연결의 고객이 아니면 'not found'). 내부 미리보기 · 고객 화면 보기는 이 함수를 부르지 않는다.
--   · 1분 안에 다시 불러도 횟수는 그대로. 열어 봤다는 표시일 뿐 — 검수 · 승인이 아니다.
--   · 이 기능을 넣은 때를 남긴다(portal_result_receipts_since) — 그 전에 공유한 자료는 '안 열어 봄' 으로 세지 않는다(기록이 없던 때라 모른다).
--
-- 바꾸는 것: portal_receipts 의 종류 검사를 넓힘(home · report → home · report · document · result — 예전 줄은 모두 그대로 맞는다) · 함수 2.
-- 표 · 열 · 정책 삭제 없음. 여러 번 실행해도 같다(넣은 때는 처음 넣은 때 그대로).
-- 먼저 있어야 하는 것: 0033 (없으면 멈춘다).
-- 되돌리기: supabase/manual/rollback_0034.sql · 확인: supabase/manual/verify_after_0034.sql

begin;

do $$
begin
  if to_regclass('public.portal_receipts') is null
     or to_regproc('public.portal_link_owned') is null
     or to_regproc('public.portal_mark_report_seen') is null then
    raise exception '0034 는 0033 을 넣은 뒤에 넣습니다(먼저 넣을 것이 빠졌습니다).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. 열람 종류 넓히기 — 한 문장(지우고 다시 거는 사이가 없다). 예전 줄(home · report)은 그대로 맞는다.
-- ---------------------------------------------------------------------
alter table public.portal_receipts
  drop constraint if exists portal_receipts_item_kind_check,
  add constraint portal_receipts_item_kind_check check (item_kind in ('home', 'report', 'document', 'result'));

comment on table public.portal_receipts is
  '고객 계정이 고객 화면을 처음 · 최근에 연 때 · 보고서 · 공유 서류 · 결과 글을 열어 본 때 · 보고서를 확인한 때. 서버 함수만 쓴다(직원 · 고객 모두 표에 직접 쓰지 못한다). 확인은 계약 검수가 아니다.';

-- ---------------------------------------------------------------------
-- 2. 이 기능을 넣은 때 — 처음 넣을 때 한 번만 만든다(다시 실행해도 그 때 그대로)
-- ---------------------------------------------------------------------
do $$
begin
  if to_regproc('public.portal_result_receipts_since') is null then
    execute format(
      'create function public.portal_result_receipts_since() returns timestamptz language sql immutable as $f$ select %L::timestamptz $f$',
      now()
    );
  end if;
end $$;
comment on function public.portal_result_receipts_since() is
  '공유 서류 · 결과 글 열람 기록을 남기기 시작한 때(0034 를 처음 넣은 때). 그 전에 공유한 자료는 안 열어 봄으로 세지 않는다.';
revoke all on function public.portal_result_receipts_since() from public, anon;
grant execute on function public.portal_result_receipts_since() to authenticated;

-- ---------------------------------------------------------------------
-- 3. 고객: 공유 서류를 열었다 · 결과 글이 보였다
-- ---------------------------------------------------------------------
create or replace function public.portal_mark_item_seen(p_link_id uuid, p_kind text, p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws     uuid;
  v_client text;
  v_ok     boolean := false;
  v_out    jsonb;
begin
  if p_kind is null or p_kind not in ('document', 'result') then
    raise exception 'bad kind' using errcode = '22023';
  end if;
  if not public.portal_link_owned(p_link_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  select workspace_id, operations_client_id into v_ws, v_client from public.portal_client_links where id = p_link_id;
  if p_kind = 'document' then
    select true into v_ok from public.portal_documents d
     where d.id = p_item_id and d.portal_client_link_id = p_link_id and d.workspace_id = v_ws
       and d.visibility = 'shared_with_customer' and coalesce(d.storage_path, '') <> '';
  else
    select true into v_ok from public.portal_updates u
     where u.id = p_item_id and u.portal_client_link_id = p_link_id and u.workspace_id = v_ws
       and u.category = 'result' and u.status = 'published';
  end if;
  if not coalesce(v_ok, false) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.portal_receipts (workspace_id, operations_client_id, portal_client_link_id, profile_id, item_kind, item_id, item_version)
  values (v_ws, v_client, p_link_id, auth.uid(), p_kind, p_item_id, 1)
  on conflict (portal_client_link_id, profile_id, item_kind, item_id, item_version) do update
    set last_seen_at = now(), seen_count = public.portal_receipts.seen_count + 1
    where public.portal_receipts.last_seen_at < now() - interval '1 minute';
  select jsonb_build_object('seen_at', first_seen_at) into v_out
    from public.portal_receipts
   where portal_client_link_id = p_link_id and profile_id = auth.uid() and item_kind = p_kind and item_id = p_item_id and item_version = 1;
  return v_out;
end;
$$;
comment on function public.portal_mark_item_seen(uuid, text, uuid) is
  '고객: 공유 서류를 열었다(document) · 결과 글이 보였다(result). 그 연결(활성)의 고객 · 그 연결에 보이는 자료만. 1분 안 반복은 횟수 그대로.';
revoke all on function public.portal_mark_item_seen(uuid, text, uuid) from public, anon;
grant execute on function public.portal_mark_item_seen(uuid, text, uuid) to authenticated;

commit;

-- 내부 함수 0 · 고객 함수 1 · 넣은 때 1(읽기만). 직원은 0033 의 읽기 정책(같은 작업공간 · 0026 허락 문)으로 표를 읽는다.
