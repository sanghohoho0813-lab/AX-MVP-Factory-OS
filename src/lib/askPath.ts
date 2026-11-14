/**
 * L-9 · D-609 상담 신청 공개 화면 주소(/ask/<12자리>) 알아보기 — App.tsx 맨 처음 조각이 쓴다.
 * 아무것도 가져오지 않는 작은 파일이어야 한다(Supabase 같은 큰 조각이 로그인 화면 첫 조각에 섞이지 않게 — D-590).
 */
export function slugFromPath(pathname: string): string {
  const m = /^\/ask\/([0-9A-Za-z]{12})\/?$/.exec(pathname)
  return m ? m[1].toLowerCase() : ''
}
