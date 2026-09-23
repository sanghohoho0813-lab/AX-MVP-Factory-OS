/**
 * 잠긴 모듈 — 보여는 주되, 쓰려면 대표 승인 (D-91).
 *
 * 첫 화면(대시보드)은 잠겨 있어도 보인다. 팔려면 무엇이 들어 있는지 보여야 하기 때문이다.
 * 다른 화면을 열면 이 화면이 대신 선다 — 감추지 않고, 무엇이 필요한지 적는다.
 *
 * 결제는 붙이지 않는다. 대표가 여기서 바로 열거나 체험을 시작한다.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge, Section, Surface } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/toastContext'
import { todayLocalDate } from '../../lib/appClock'
import type { ToolDefinition } from '../../config/toolRegistry'
import {
  accessLabel,
  canUse,
  defaultAccess,
  listAccess,
  setAccess,
  TRIAL_DAYS,
  type ModuleAccess,
} from '../../services/moduleAccess'
import { useToolClient } from './toolClientContext'

export interface ModuleGateProps {
  tool: ToolDefinition
  /** 지금 보고 있는 화면 (첫 화면은 잠겨도 보인다) */
  section: string
  children: ReactNode
}

export function ModuleGate({ tool, section, children }: ModuleGateProps) {
  const { workspaceId } = useToolClient()
  const { showToast } = useToast()
  const [access, setLocal] = useState<ModuleAccess | null>(null)
  const today = todayLocalDate()

  useEffect(() => {
    let alive = true
    void listAccess(workspaceId).then((map) => {
      if (alive) setLocal(map.get(tool.key) ?? defaultAccess(tool.key))
    })
    return () => {
      alive = false
    }
  }, [workspaceId, tool.key])

  // 읽는 중에는 그대로 보여 준다 — 잠깐 잠겼다 열리는 깜빡임을 만들지 않는다
  if (!access) return <>{children}</>

  const first = tool.sections?.[0]?.key ?? ''
  const usable = canUse(access, today)
  if (usable || section === first) {
    return (
      <>
        {!usable && (
          <Surface edge="warning" showEdge className="mb-4">
            <p className="t-sub flex flex-wrap items-center gap-2 break-keep text-slate-700" data-testid="module-locked-banner">
              <Lock aria-hidden="true" className="size-4 shrink-0 text-amber-600" />이 모듈은 <b>{accessLabel(access, today)}</b> 상태입니다.
              첫 화면은 볼 수 있고, 다른 화면을 쓰려면 아래에서 열어 주세요.
              <Link to="/tools" className="font-medium text-brand-700 hover:underline">
                도구함에서 관리
              </Link>
            </p>
          </Surface>
        )}
        {children}
      </>
    )
  }

  const open = async (state: 'trial' | 'open') => {
    const next = await setAccess(workspaceId, tool.key, state, today)
    setLocal(next)
    showToast(state === 'open' ? `${tool.label} 을(를) 열었습니다.` : `${tool.label} 체험을 시작했습니다 (${TRIAL_DAYS}일).`)
  }

  return (
    <Section title={`${tool.label} — ${accessLabel(access, today)}`}>
      <Surface edge="warning" showEdge>
        <div className="flex flex-col gap-3" data-testid="module-locked">
          <p className="t-card flex items-center gap-2 font-bold text-slate-900">
            <Lock aria-hidden="true" className="size-5 shrink-0 text-amber-600" />
            대표 승인이 필요한 화면입니다
          </p>
          <p className="t-sub break-keep text-slate-600">
            {tool.desc}
          </p>
          <p className="t-meta break-keep text-slate-500">
            {/* D-94: 첫 화면 이름은 모듈마다 다르다(크레탑은 ‘보고서 분석’) — ‘대시보드’ 로 박아 두지 않는다 */}
            이 모듈의 첫 화면(‘{tool.sections?.[0]?.label ?? '첫 화면'}’)은 잠겨 있어도 볼 수 있습니다. 나머지 화면은 열어야 씁니다.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => void open('open')} data-testid="module-unlock">
              지금 열기
            </Button>
            <Button variant="ghost" onClick={() => void open('trial')} data-testid="module-trial">
              <Sparkles aria-hidden="true" className="size-4" /> {TRIAL_DAYS}일 체험
            </Button>
            <Badge tone="neutral">결제는 아직 붙어 있지 않습니다</Badge>
          </div>
        </div>
      </Surface>
    </Section>
  )
}
