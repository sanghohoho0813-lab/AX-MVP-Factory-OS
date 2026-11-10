/**
 * D-565 메뉴별 사용법 영상 자리 — 대표 "튜토리얼 영상도 넣을 거야 나중에. 넣을 자리를 만들어 줘."
 *
 * 영상을 넣는 법(코드 한 줄):
 *   1) 파일을 public/tutorial/menu/ 에 둔다(예: public/tutorial/menu/client-ops.mp4 · 표지 그림은 같은 이름 .jpg).
 *   2) 아래 MENU_VIDEOS 에 한 줄 — 열쇠는 메뉴 key(content/menuGuide 의 열쇠와 같다).
 *        'client-ops': { src: '/tutorial/menu/client-ops.mp4', poster: '/tutorial/menu/client-ops.jpg', seconds: 180 },
 *   유튜브 등 바깥 주소는 넣지 않는다(화면 안에서 바로 재생 — 바깥 사이트로 보내지 않는다).
 * 줄이 없으면 그 메뉴의 영상 칸은 '영상 준비 중' 으로 보인다.
 */
export interface MenuVideo {
  /** public 아래 주소(/tutorial/menu/… .mp4) */
  src: string
  poster?: string
  /** 길이(초) — '약 n분' */
  seconds?: number
  /** 영상 제목(없으면 메뉴 이름) */
  title?: string
}

export const MENU_VIDEOS: Readonly<Record<string, MenuVideo>> = {}

export function menuVideo(key: string): MenuVideo | null {
  const v = MENU_VIDEOS[key]
  // 화면 안 파일만 — 바깥 주소(http)는 받지 않는다
  return v && v.src.startsWith('/') && !v.src.startsWith('//') ? v : null
}
