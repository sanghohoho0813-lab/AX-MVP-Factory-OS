import { Bell, Building, PenLine, Share2, Sparkles, Users, type LucideIcon } from 'lucide-react'

/** 향후 확장 항목 아이콘 (D-103) — 사이드바 펼침 목록과 가운데 안내창이 같이 쓴다 */
const FUTURE_ICON: Record<string, LucideIcon> = {
  notify: Bell,
  llm_summary: PenLine,
  team_journal: Users,
  share_results: Share2,
  saas: Building,
}

export function futureIcon(key: string): LucideIcon {
  return FUTURE_ICON[key] ?? Sparkles
}
