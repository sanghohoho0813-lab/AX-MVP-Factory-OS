/**
 * 1차 미팅 체크리스트 — 메뉴 숫자용 (D-104).
 *
 * 영업자용 AX 1차 미팅 체크리스트 프로그램이 들어오면 여기서 '아직 끝내지 않은 1차 미팅' 수를 돌려준다.
 * 지금은 프로그램이 없어 늘 0 — 0 이면 메뉴에 숫자를 달지 않는다(빨간 0 은 할 일이 있는 것처럼 보인다).
 */
export async function countPendingFirstMeetings(_workspaceId: string | null): Promise<number> {
  return 0
}
