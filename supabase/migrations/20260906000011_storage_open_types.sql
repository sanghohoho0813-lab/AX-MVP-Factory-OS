-- 20260906000011_storage_open_types.sql
--
-- 파일 보관함(client-documents)의 형식·크기 제한을 푼다.
--
-- 왜
--   지금까지는 PDF·JPG·PNG·WEBP 만, 10MB 까지만 올라갔다. 실제 업무에서는
--   한글(HWP)·워드·엑셀·압축파일(ZIP)을 주고받고, 스캔본은 10MB 를 쉽게 넘는다.
--
--   더구나 고객 플랫폼(miraeailab.com)의 서류 올리기 화면은 이미
--   .hwp / .docx / .xlsx 를 고를 수 있게 열어 두었는데, 저장소가 그 형식을
--   거부하고 있었다. 고객이 한글 파일을 고르면 "파일을 올리지 못했습니다" 로
--   끝났다는 뜻이다. 이 마이그레이션이 그 어긋남도 함께 없앤다.
--
-- 무엇을
--   allowed_mime_types = null  형식 제한 없음
--   file_size_limit    = null  버킷 자체 상한 없음 → 프로젝트 전역 설정을 따른다
--
--   전역 설정은 SQL 로 바꿀 수 없다. 더 큰 파일이 필요하면
--   Dashboard → Storage → Settings → "Upload file size limit" 에서 올린다.
--   (Pro 플랜 기준 최대 50GB. 기본값은 50MB.)
--
-- 안전
--   * 버킷은 여전히 비공개(public = false)다. 링크를 아는 것만으로는 못 연다.
--   * 읽기·쓰기 정책(RLS)은 건드리지 않는다 — 워크스페이스 멤버와, 자기 경로에
--     올리는 연결된 고객만 접근한다. 형식 제한을 푸는 것은 "누가" 가 아니라
--     "무엇을" 에 대한 것이라 접근 권한은 그대로다.
--   * 이미 올라간 파일은 손대지 않는다.
--
-- 원칙: additive/제한 완화만. 표·정책·데이터 삭제 없음. 멱등.
--
-- 주의: 20260827000005_operations_hub.sql 은 버킷을 10MB·4형식으로 되돌리는
--       upsert 를 갖고 있다. 파일명 순서상 이 파일이 뒤에 실행되므로 최종
--       상태는 여기 값이 이긴다. 전체 마이그레이션을 처음부터 다시 돌려도 같다.

begin;

update storage.buckets
   set allowed_mime_types = null,
       file_size_limit    = null,
       public             = false
 where id = 'client-documents';

commit;

-- ------------------------------------------------------------------
-- 확인용 — 실행하면 지금 상태를 보여준다
-- ------------------------------------------------------------------
--   select id,
--          public,
--          coalesce(file_size_limit::text, '전역 설정 따름') as 크기제한,
--          coalesce(array_to_string(allowed_mime_types, ', '), '제한 없음') as 형식제한
--     from storage.buckets
--    where id = 'client-documents';
--
--   기대값: public=false · 크기제한=전역 설정 따름 · 형식제한=제한 없음
