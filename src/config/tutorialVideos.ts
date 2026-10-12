/**
 * 안내 영상 (D-185) — 최은혜 팀장님을 위한 사용 안내.
 * 영상 파일은 public/tutorial 에 두 벌씩: PC 가로(16:9) · 휴대폰 세로(9:16). 자막은 영상 안에 들어 있다.
 */
export interface TutorialVideo {
  key: 'part1' | 'part2'
  label: string
  title: string
  /** 영상 길이(초) — 목록에 '약 n분' */
  seconds: number
  wide: string
  tall: string
  posterWide: string
  posterTall: string
}

export const TUTORIAL_VIDEOS: TutorialVideo[] = [
  {
    key: 'part1',
    label: '1편',
    title: '시스템 소개 · 고객 관리 · 전문 모듈',
    seconds: 309,
    wide: '/tutorial/part1-wide.mp4',
    tall: '/tutorial/part1-tall.mp4',
    posterWide: '/tutorial/part1-wide.jpg',
    posterTall: '/tutorial/part1-tall.jpg',
  },
  {
    key: 'part2',
    label: '2편',
    title: '정책자금 · 기업인증 · 앞으로 계획',
    seconds: 294,
    wide: '/tutorial/part2-wide.mp4',
    tall: '/tutorial/part2-tall.mp4',
    posterWide: '/tutorial/part2-wide.jpg',
    posterTall: '/tutorial/part2-tall.jpg',
  },
]

export function minutesLabel(seconds: number): string {
  return `약 ${Math.max(1, Math.round(seconds / 60))}분`
}
