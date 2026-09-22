/**
 * 도구함 — 이 OS 안에 들어오는 '작은 OS·계산기' 목록 (D-86).
 *
 * 세금 계산기처럼 고객 기록과 상관없이 혼자 도는 것들이 앞으로 계속 늘어난다
 * (기업인증 OS · 크레탑 OS …). 그때마다 사이드바를 다시 짜지 않도록 **여기 한 줄만 더한다**.
 *   - `status: 'live'`  — 지금 쓸 수 있다. 사이드바 도구함에도 올라간다.
 *   - `status: 'planned'` — 자리만 잡아 둔 것. 도구함 화면에 '아직 없다' 고 적어 두고, 누를 수 없다.
 *
 * 없는 기능을 있는 것처럼 보이게 하지 않는다 — 자리만 잡아 둔 것은 그렇게 적는다.
 */

import type { LucideIcon } from 'lucide-react'
import { BadgeCheck, Calculator, Database } from 'lucide-react'

export interface ToolDefinition {
  key: string
  label: string
  /** 한 줄 설명 — 도구함 카드에 그대로 보인다 */
  desc: string
  /** 사이드바에 걸릴 때의 짧은 설명(툴팁). 없으면 설명 없이 걸린다 */
  navHint?: string
  /** 들어갈 주소. 아직 없는 것은 null */
  path: string | null
  icon: LucideIcon
  status: 'live' | 'planned'
}

export const TOOLS: ToolDefinition[] = [
  {
    key: 'tax',
    label: '세금 계산기',
    desc: '대표이사 급여·퇴직급여·주식양수도·상속·가지급금 등 9종. 기업지원단 배포본과 같은 숫자입니다.',
    navHint: '급여·퇴직·주식·상속·가지급금 9종',
    path: '/tools/tax',
    icon: Calculator,
    status: 'live',
  },
  {
    key: 'cert-os',
    label: '기업인증 OS',
    desc: '대표가 따로 만들어 둔 것입니다. 여기로 옮기면 이 자리에 붙습니다 — 아직 없습니다.',
    path: null,
    icon: BadgeCheck,
    status: 'planned',
  },
  {
    key: 'cretop-os',
    label: '크레탑 OS',
    desc: '대표가 따로 만들어 둔 것입니다. 여기로 옮기면 이 자리에 붙습니다 — 아직 없습니다.',
    path: null,
    icon: Database,
    status: 'planned',
  },
]

/** 지금 쓸 수 있는 것만 (사이드바 도구함이 이것으로 만들어진다) */
export function liveTools(): ToolDefinition[] {
  return TOOLS.filter((t) => t.status === 'live')
}

export function plannedTools(): ToolDefinition[] {
  return TOOLS.filter((t) => t.status === 'planned')
}
