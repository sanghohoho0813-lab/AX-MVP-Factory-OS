/**
 * D-598 안내 네 칸(무엇을 하나요 · 왜 있나요 · 쓰면 이렇게 돼요 · 앞으로) 앞의 작은 아이콘 — 대표(2026-11-11):
 * "번호나 색 들어간 작은 이모티콘으로 나눠서 눈에 잘 띄게 — 디자인은 다 다르되 색은 서로 너무 대비되지 않게, 한눈에 복잡하지 않게."
 *
 *  - 모양은 칸마다 다르게(ⓘ · ? · 오름 화살표 · 로켓), 색은 넷 다 지금 테마의 강조색 한 가지 — 연한 바탕 + 진한 선(작은 칩 — 박스 색 규칙 밖).
 *    처음에는 테마의 네 색(주 · 둘째 · 강조 · 밝은 강조)을 나눠 썼는데, 오닉스 골드에서는 둘이 회색으로 묻히고 딥 틸에서는 청록 ↔ 주황이 서로 대비됐다
 *    (2026-11-11 사진) → 한 가지 색이 '서로 대비되지 않게' 에 맞다. 강조색은 테마마다 가장 색이 있는 칸이라 어느 테마에서도 '색 들어간' 아이콘으로 보인다.
 *  - 보라(AI) · 빨강(늦음) 은 쓰지 않는다. 글자 이름은 그대로(GUIDE_LABELS) — 아이콘은 읽는 사람이 칸을 빨리 가르게 돕는 것뿐.
 *  - 쓰는 곳: 마우스 안내 카드(GuideLayer) · 휴대폰 '이 화면 안내'(ScreenGuideSheet) · 사용법 안내 화면(GuidePage).
 */
import { CircleHelp, Info, Rocket, TrendingUp, type LucideIcon } from 'lucide-react'
import type { GuideSectionKey } from '../../content/menuGuide'

const SECTION_ICON: Record<GuideSectionKey, LucideIcon> = { what: Info, why: CircleHelp, effect: TrendingUp, next: Rocket }
const TONE = 'bg-accent-50 text-accent-700'

/** 칸 이름 앞의 작은 아이콘 — size: 카드(작게) · 화면(조금 크게) */
export function GuideSectionIcon({ k, size = 'sm' }: { k: GuideSectionKey; size?: 'sm' | 'md' }) {
  const Icon = SECTION_ICON[k]
  const box = size === 'md' ? 'size-6 rounded-lg' : 'size-5 rounded-md'
  const icon = size === 'md' ? 'size-4' : 'size-3.5'
  return (
    <span aria-hidden="true" data-testid="guide-sec-icon" data-k={k} className={`inline-flex shrink-0 items-center justify-center ${box} ${TONE}`}>
      <Icon className={icon} strokeWidth={2.25} />
    </span>
  )
}
