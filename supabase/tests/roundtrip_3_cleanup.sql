-- =====================================================================
-- 왕복 확인 [3/3] 정리
-- ---------------------------------------------------------------------
-- 확인이 끝난 뒤 실행한다. 이 확인 과정이 만든 것만 지운다.
-- 실제 고객 데이터는 건드리지 않는다 (전부 cli_roundtrip_check 에 매달린 행뿐).
--
-- 테스트 고객 계정 자체는 남는다 — 지우려면
-- Dashboard → Authentication → Users 에서 삭제한다.
-- =====================================================================

do $$
declare v_link uuid; n int;
begin
  select id into v_link from public.portal_client_links
   where operations_client_id = 'cli_roundtrip_check';

  if v_link is not null then
    delete from public.customer_events  where portal_client_link_id = v_link;
    get diagnostics n = row_count; raise notice 'customer_events  %건 삭제', n;
    delete from public.portal_updates   where portal_client_link_id = v_link;
    get diagnostics n = row_count; raise notice 'portal_updates   %건 삭제', n;
    delete from public.portal_requests  where portal_client_link_id = v_link;
    get diagnostics n = row_count; raise notice 'portal_requests  %건 삭제', n;
    delete from public.portal_documents where portal_client_link_id = v_link;
    get diagnostics n = row_count; raise notice 'portal_documents %건 삭제', n;
    delete from public.portal_client_links where id = v_link;
    raise notice 'portal_client_links 1건 삭제';
  end if;

  delete from public.operations_clients where id = 'cli_roundtrip_check';
  get diagnostics n = row_count; raise notice 'operations_clients %건 삭제', n;
end $$;

-- 남은 게 없는지 확인 — 전부 0 이어야 한다
select '남은 테스트 업체' as 항목, count(*)::int as 개수 from public.operations_clients where id = 'cli_roundtrip_check'
union all
select '남은 테스트 연결', count(*)::int from public.portal_client_links where operations_client_id = 'cli_roundtrip_check';

-- 참고: 스토리지에 올린 테스트 PDF 는 남는다.
-- Dashboard → Storage → client-documents → {workspace}/portal/{link}/ 에서 지운다.
