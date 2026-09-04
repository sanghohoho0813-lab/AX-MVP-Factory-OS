-- 20260903000008_event_client_link.sql
--
-- 결함 수정: 이미 고객사와 연결된 계정이 만든 이벤트에 operations_client_id 가 비어 있었다.
--
-- 증상
--   bridge_emit_customer_event 는 portal_client_link_id 를 채우고 status 를 'linked' 로
--   남기지만, 그 연결이 가리키는 operations_client_id 는 복사하지 않았다.
--   내부 이벤트함(EventCard)은 operations_client_id 로 고객사 링크와 처리 버튼을 결정하므로
--   화면에는 상태 배지가 "연결됨" 인데 본문은 "아직 고객사와 연결되지 않음" 이 뜨고,
--   담당자에게 "새 고객사로 만들기" 가 제시된다 — 누르면 고객사가 중복 생성된다.
--   고객 서류 업로드·요청이 들어오는 왕복의 첫 화면에서 바로 나타나는 문제다.
--
-- 조치
--   1. emit 함수가 연결에서 operations_client_id 를 함께 복사하도록 수정
--   2. 이미 쌓인 행 backfill (연결은 있는데 고객사가 비어 있는 것만)
--
-- 원칙: additive/보정만 — 스키마 변경 없음, 멱등.

begin;

-- ------------------------------------------------------------------
-- 1. emit 함수 — 연결에서 workspace_id 와 operations_client_id 를 함께 읽는다
-- ------------------------------------------------------------------
create or replace function public.bridge_emit_customer_event(
  p_event_type text,
  p_source_type text,
  p_source_id text,
  p_payload jsonb,
  p_priority text default 'medium',
  p_profile_id uuid default null,
  p_link_id uuid default null,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws   uuid;
  v_link uuid := p_link_id;
  v_ops  text;
  v_id   uuid;
begin
  -- 연결이 없고 프로필만 알면 그 프로필의 활성 연결 하나를 찾아 본다(고객사가 하나뿐일 때만 확정)
  if v_link is null and p_profile_id is not null then
    select l.id into v_link
    from public.portal_client_links l
    where l.profile_id = p_profile_id and l.status = 'active'
    order by l.updated_at desc
    limit 1;
    if (select count(*) from public.portal_client_links l where l.profile_id = p_profile_id and l.status = 'active') > 1 then
      v_link := null; -- 여러 고객사에 연결된 계정은 사람이 고른다
    end if;
  end if;

  -- 연결이 정해졌으면 워크스페이스와 고객사를 함께 가져온다.
  -- operations_client_id 를 빠뜨리면 이벤트함이 "연결 안 됨" 으로 보여 중복 고객사를 만들게 된다.
  if v_link is not null then
    select workspace_id, operations_client_id
      into v_ws, v_ops
      from public.portal_client_links
     where id = v_link;
  end if;
  if v_ws is null then
    v_ws := public.default_intake_workspace();
  end if;
  if v_ws is null then
    return null; -- 받을 워크스페이스가 없으면 조용히 건너뛴다(설정 전 환경)
  end if;

  insert into public.customer_events (
    workspace_id, portal_client_link_id, operations_client_id, profile_id,
    event_type, source_type, source_id,
    dedupe_key, customer_safe_payload, priority, status, occurred_at
  ) values (
    v_ws, v_link, v_ops, p_profile_id,
    p_event_type, p_source_type, p_source_id,
    p_source_type || ':' || p_source_id || ':' || p_event_type,
    coalesce(p_payload, '{}'::jsonb),
    case when p_priority in ('high', 'medium', 'low') then p_priority else 'medium' end,
    case when v_link is null then 'new' else 'linked' end,
    coalesce(p_occurred_at, now())
  )
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.bridge_emit_customer_event(text, text, text, jsonb, text, uuid, uuid, timestamptz)
  from public, anon, authenticated;

-- ------------------------------------------------------------------
-- 2. 이미 쌓인 이벤트 backfill — 연결은 있는데 고객사가 비어 있는 행만
-- ------------------------------------------------------------------
update public.customer_events e
   set operations_client_id = l.operations_client_id
  from public.portal_client_links l
 where e.portal_client_link_id = l.id
   and e.operations_client_id is null
   and l.operations_client_id is not null;

commit;

-- 확인용
--   select count(*) from public.customer_events
--    where portal_client_link_id is not null and operations_client_id is null;
--   -- → 0
