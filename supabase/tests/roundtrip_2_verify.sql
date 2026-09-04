-- =====================================================================
-- 왕복 확인 [2/3] 검증
-- ---------------------------------------------------------------------
-- 고객 플랫폼에서 ① 요청 보내기 ② PDF 업로드 를 마친 뒤 실행한다.
-- 읽기만 한다 — 아무것도 바꾸지 않는다.
--
-- SQL Editor 는 "마지막 쿼리 결과" 하나만 보여주므로,
-- 판정·이벤트목록·누출검사를 표 하나에 모아 마지막에 한 번에 출력한다.
--
-- 결과표를 그대로 복사해서 보내면 판독한다.
-- =====================================================================

drop table if exists _v;
create temp table _v (순 int, 구분 text, 항목 text, 값 text);

do $$
declare
  v_link uuid; v_ws uuid;
  r_req  public.customer_events%rowtype;
  r_upl  public.customer_events%rowtype;
  r_doc  public.portal_documents%rowtype;
  v_proj jsonb;
  n int;
begin
  select id, workspace_id into v_link, v_ws
    from public.portal_client_links
   where operations_client_id = 'cli_roundtrip_check' limit 1;

  if v_link is null then
    insert into _v values (0, '오류', '연결 없음', 'roundtrip_1_setup.sql 을 먼저 실행하세요');
    return;
  end if;

  select * into r_req from public.customer_events
   where portal_client_link_id = v_link and event_type = 'customer_request_created'
   order by occurred_at desc limit 1;

  select * into r_upl from public.customer_events
   where portal_client_link_id = v_link and event_type = 'document_uploaded'
   order by occurred_at desc limit 1;

  select * into r_doc from public.portal_documents
   where portal_client_link_id = v_link and status = 'uploaded'
   order by uploaded_at desc nulls last limit 1;

  -- ---------------- A. 왕복 ①② 핵심 판정 ----------------
  insert into _v values
    (11, 'A. 왕복 ① 고객 → 내부', '요청이 이벤트함에 들어옴',
         case when r_req.id is not null then '✅ ' || coalesce(r_req.customer_safe_payload->>'title', '(제목 없음)')
              else '❌ 아직 없음' end),
    (12, 'A. 왕복 ① 고객 → 내부', '요청 이벤트에 고객사 id',
         case when r_req.operations_client_id = 'cli_roundtrip_check' then '✅ ' || r_req.operations_client_id
              when r_req.id is null then '❌ 이벤트 자체가 없음'
              else '❌ ' || coalesce(r_req.operations_client_id, '비어 있음') end),
    (13, 'A. 왕복 ① 고객 → 내부', '요청 이벤트 상태',
         case when r_req.status = 'linked' then '✅ linked'
              else '❌ ' || coalesce(r_req.status::text, '-') end),
    (14, 'A. 왕복 ① 고객 → 내부', '서류 업로드가 이벤트함에 들어옴',
         case when r_upl.id is not null then '✅ ' || coalesce(r_upl.customer_safe_payload->>'file_name',
                                                              r_upl.customer_safe_payload->>'title', '(이름 없음)')
              else '❌ 아직 없음' end),
    (15, 'A. 왕복 ① 고객 → 내부', '업로드 이벤트에 고객사 id',
         case when r_upl.operations_client_id = 'cli_roundtrip_check' then '✅ ' || r_upl.operations_client_id
              when r_upl.id is null then '❌ 이벤트 자체가 없음'
              else '❌ ' || coalesce(r_upl.operations_client_id, '비어 있음') end),
    (16, 'A. 왕복 ① 고객 → 내부', '서류가 uploaded 로 바뀜',
         case when r_doc.id is not null then '✅ ' || r_doc.title || ' · ' || coalesce(r_doc.file_name, '')
              else '❌ 아직 requested' end),
    (17, 'A. 왕복 ① 고객 → 내부', '업로드 경로가 서버 발급 규칙 준수',
         case when r_doc.storage_path like v_ws::text || '/portal/' || v_link::text || '/%'
              then '✅ ' || r_doc.storage_path
              else '❌ ' || coalesce(r_doc.storage_path, '-') end),
    (18, 'A. 왕복 ① 고객 → 내부', '고객이 올린 것으로 기록됨',
         case when r_doc.source::text = 'customer' then '✅ customer'
              else '❌ ' || coalesce(r_doc.source::text, '-') end);

  -- ---------------- B. 이벤트함에 쌓인 것 전부 ----------------
  insert into _v
  select 20, 'B. 이벤트함 내용',
         to_char(e.occurred_at, 'MM-DD HH24:MI') || ' · ' || e.event_type,
         e.status || ' · ' || e.priority || ' · 고객사=' || coalesce(e.operations_client_id, '(없음)')
         || ' · ' || coalesce(e.customer_safe_payload::text, '')
    from public.customer_events e
   where e.portal_client_link_id = v_link
   order by e.occurred_at desc;

  select count(*) into n from public.customer_events where portal_client_link_id = v_link;
  if n = 0 then
    insert into _v values (20, 'B. 이벤트함 내용', '(비어 있음)', '고객 행동이 아직 하나도 안 들어왔다');
  end if;

  -- ---------------- C. 고객 투영 누출 검사 ----------------
  v_proj := public.portal_project_projection(v_link);
  insert into _v values
    (31, 'C. 고객 투영 누출 검사', '수임료(5500000) 없음',
         case when position('5500000'      in coalesce(v_proj::text, '')) = 0 then '✅' else '❌ 누출' end),
    (32, 'C. 고객 투영 누출 검사', '내부 메모 없음',
         case when position('내부 메모'     in coalesce(v_proj::text, '')) = 0 then '✅' else '❌ 누출' end),
    (33, 'C. 고객 투영 누출 검사', 'internal_note 키 없음',
         case when position('internal_note' in coalesce(v_proj::text, '')) = 0 then '✅' else '❌ 누출' end),
    (34, 'C. 고객 투영 누출 검사', 'workspace_id 없음',
         case when position('workspace_id'  in coalesce(v_proj::text, '')) = 0 then '✅' else '❌ 누출' end);

  -- ---------------- D. 종합 ----------------
  insert into _v values (40, 'D. 종합', '왕복 ① 판정',
    case when r_req.id is not null and r_upl.id is not null
              and r_req.operations_client_id = 'cli_roundtrip_check'
              and r_upl.operations_client_id = 'cli_roundtrip_check'
         then '✅ 고객 요청·서류가 내부 이벤트함까지 도달했다'
         else '❌ 아직 닫히지 않았다 — 위 A 에서 ❌ 항목 확인' end);
end $$;

-- =====================================================================
-- 결과 — 이 표 하나만 복사해서 보내면 된다
-- =====================================================================
select 구분, 항목, 값 from _v order by 순, 항목;
