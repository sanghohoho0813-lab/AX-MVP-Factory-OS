/**
 * D-565 안내 네 칸 이름 · D-598 순서 — 카드 · 휴대폰 안내 · 사용법 안내 화면이 같은 순서 · 같은 아이콘(components/guide/GuideSectionIcon).
 * D-647 작은 파일로 뗌 — 마우스 안내 층(GuideLayer)은 앱 뼈대에 있고, 안내 글 묶음(menuGuide · functionGuide)은 마우스를 올릴 때 받는다.
 */
export const GUIDE_LABELS = { what: '무엇을 하나요', why: '왜 있나요', effect: '쓰면 이렇게 돼요', next: '앞으로' } as const

export type GuideSectionKey = keyof typeof GUIDE_LABELS
export const GUIDE_SECTION_ORDER: ReadonlyArray<GuideSectionKey> = ['what', 'why', 'effect', 'next']

/** 마케팅 목차 칸 → 안내 열쇠 */
export const MARKETING_GUIDE_KEYS: Record<string, string> = {
  plan: 'mk-plan',
  top: 'mk-top',
  channels: 'mk-top',
  analysis: 'mk-top',
  make: 'mk-make',
  threads: 'mk-threads',
  shorts: 'mk-shorts',
  content: 'mk-content',
  homepage: 'mk-homepage',
}
