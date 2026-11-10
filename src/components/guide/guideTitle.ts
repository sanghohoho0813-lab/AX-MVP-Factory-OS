/** D-565 안내 열쇠 → 화면에 보일 이름(메뉴 표 · 마케팅 목차에서 찾는다) */
import { MODULES } from '../../config/moduleRegistry'
import { MARKETING_GUIDE_LIST } from '../../content/menuGuide'
import { FUNCTION_GUIDES } from '../../content/functionGuide'

export function guideTitle(key: string): string {
  return FUNCTION_GUIDES[key]?.label ?? MODULES.find((m) => m.key === key)?.label ?? MARKETING_GUIDE_LIST.find((m) => m.key === key)?.label ?? key
}
