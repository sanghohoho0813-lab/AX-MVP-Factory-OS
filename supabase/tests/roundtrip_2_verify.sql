-- =====================================================================
-- 왕복 확인 [2/3] 검증
-- ---------------------------------------------------------------------
-- 고객 플랫폼에서 ① 요청 보내기 ② PDF 업로드 를 마친 뒤 실행한다.
-- 읽기만 한다 — 아무것도 바꾸지 않는다.
--
-- 결과표를 그대로 복사해서 붙여 주면 판독한다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. 왕복 ①② 핵심 판정
-- ---------------------------------------------------------------------
with l as (
  select id, workspace_id from public.portal_client_links
   where operations_client_id = 'cli_roundtrip_check' limit 1
), req as (
  select e.* from public.customer_events e, l
   where e.portal_client_link_id = l.id and e.event_type = 'customer_request_created'
   order by e.occurred_at desc limit 1
), upl as (
  select e.* from public.customer_events e, l
   where e.portal_client_link_id = l.id and e.event_type = 'document_uploaded'
   order by e.occurred_at desc limit 1
), doc as (
  select d.* from public.portal_documents d, l
   where d.portal_client_link_id = l.id and d.status = 'uploaded'
   order by d.uploaded_at desc nulls last limit 1
)
select 순, 항목, 판정, 내용
from (
  select 1 as 순, '① 고객 요청이 내부 이벤트함에 들어옴' as 항목,
         case when exists (select 1 from req) then '✅' else '❌' end as 판정,
         coalesce((select customer_safe_payload->>'title' from req), '아직 없음') as 내용
  union all
  select 2, '① 요청 이벤트에 고객사 id 채워짐 (…0008)',
         case when (select operations_client_id from req) = 'cli_roundtrip_check' then '✅' else '❌' end,
         coalesce((select operations_client_id from req), '비어 있음')
  union all
  select 3, '① 요청 이벤트가 연결됨(linked) 상태',
         case when (select status from req) = 'linked' then '✅' else '❌' end,
         coalesce((select status from req), '-')
  union all
  select 4, '② 서류 업로드가 내부 이벤트함에 들어옴',
         case when exists (select 1 from upl) then '✅' else '❌' end,
         coalesce((select coalesce(customer_safe_payload->>'file_name', customer_safe_payload->>'title') from upl), '아직 없음')
  union all
  select 5, '② 업로드 이벤트에 고객사 id 채워짐 (…0008)',
         case when (select operations_client_id from upl) = 'cli_roundtrip_check' then '✅' else '❌' end,
         coalesce((select operations_client_id from upl), '비어 있음')
  union all
  select 6, '② 서류가 uploaded 로 바뀜',
         case when exists (select 1 from doc) then '✅' else '❌' end,
         coalesce((select title || ' · ' || coalesce(file_name, '') from doc), '아직 requested')
  union all
  select 7, '② 업로드 경로가 서버 발급 규칙을 지킴',
         case when (select d.storage_path like l.workspace_id::text || '/portal/' || l.id::text || '/%'
                      from doc d, l) then '✅' else '❌' end,
         coalesce((select storage_path from doc), '-')
  union all
  select 8, '고객이 올린 것으로 기록됨 (source=customer)',
         case when (select source from doc) = 'customer' then '✅' else '❌' end,
         coalesce((select source::text from doc), '-')
) t order by 순;

-- ---------------------------------------------------------------------
-- B. 이 연결에 쌓인 이벤트 전체 (담당자 화면에 뜨는 것과 같다)
-- ---------------------------------------------------------------------
select e.occurred_at, e.event_type, e.status, e.priority,
       e.operations_client_id as 고객사, e.customer_safe_payload as 내용
  from public.customer_events e
  join public.portal_client_links l on l.id = e.portal_client_link_id
 where l.operations_client_id = 'cli_roundtrip_check'
 order by e.occurred_at desc;

-- ---------------------------------------------------------------------
-- C. 고객이 실제로 받는 투영에 내부 정보가 섞이지 않았는지
--    (내부 미리보기 RPC 는 고객 투영과 같은 함수를 쓴다)
-- ---------------------------------------------------------------------
select 항목, 판정
from (
  select '수임료(5500000)가 고객 투영에 없다' as 항목,
         case when position('5500000' in coalesce(p.proj::text, '')) = 0 then '✅' else '❌ 누출' end as 판정
    from (select public.portal_project_projection(
                   (select id from public.portal_client_links
                     where operations_client_id = 'cli_roundtrip_check' limit 1)) as proj) p
  union all
  select '내부 메모가 고객 투영에 없다',
         case when position('내부 메모' in coalesce(p.proj::text, '')) = 0 then '✅' else '❌ 누출' end
    from (select public.portal_project_projection(
                   (select id from public.portal_client_links
                     where operations_client_id = 'cli_roundtrip_check' limit 1)) as proj) p
  union all
  select 'internal_note 키가 고객 투영에 없다',
         case when position('internal_note' in coalesce(p.proj::text, '')) = 0 then '✅' else '❌ 누출' end
    from (select public.portal_project_projection(
                   (select id from public.portal_client_links
                     where operations_client_id = 'cli_roundtrip_check' limit 1)) as proj) p
  union all
  select 'workspace_id 가 고객 투영에 없다',
         case when position('workspace_id' in coalesce(p.proj::text, '')) = 0 then '✅' else '❌ 누출' end
    from (select public.portal_project_projection(
                   (select id from public.portal_client_links
                     where operations_client_id = 'cli_roundtrip_check' limit 1)) as proj) p
) t order by 항목;
