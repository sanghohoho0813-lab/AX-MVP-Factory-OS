/**
 * D-282 화면 제목 앞 기능 아이콘 칸 — 메뉴와 같은 아이콘 · 같은 색.
 * 화면 제목이 그 화면을 맡은 메뉴 줄 이름으로 시작할 때만(고객 관리 · 일정 · 마케팅 · 브랜딩 …) 저절로 붙는다.
 * 업체 상세처럼 제목이 업체 이름인 화면에는 붙지 않는다. 메뉴 표에서 계산 — 화면마다 따로 적지 않는다.
 */
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { moduleForPath, navParentForPath } from '../../config/moduleRegistry'
import { moduleTone } from '../../config/featureVisual'
import { IconTile } from './visual'

export function useTitleIcon(title: string): ReactNode | null {
  const { pathname } = useLocation()
  const m = navParentForPath(pathname) ?? moduleForPath(pathname)
  if (!m || m.key === 'today') return null
  const label = m.label.replace(/\s*\([^)]*\)\s*$/, '').trim()
  if (!label || !title.startsWith(label)) return null
  return <IconTile icon={m.icon} tone={moduleTone(m.parent ?? m.key)} size="lg" />
}
