/**
 * 모듈 구독 관리 — 잠김 · 체험 · 열림 (D-91).
 *
 * 모듈을 따로 파는 구조를 위한 자리다. 대표가 여기서 상태를 바꾼다.
 * **결제는 아직 붙어 있지 않다** — 그렇게 화면에 적는다.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Sparkles, Unlock } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge, Section, Surface, type Tone } from '../ui/primitives'
import { useToast } from '../ui/toastContext'
import { todayLocalDate } from '../../lib/appClock'
import { TOOLS } from '../../config/toolRegistry'
import {
  accessLabel,
  canUse,
  defaultAccess,
  listAccess,
  setAccess,
  TRIAL_DAYS,
  type ModuleAccess,
  type ModuleAccessState,
} from '../../services/moduleAccess'

export function ModuleAccessPanel({ workspaceId }: { workspaceId: string | null }) {
  const { showToast } = useToast()
  const [map, setMap] = useState<Map<string, ModuleAccess> | null>(null)
  const today = todayLocalDate()

  useEffect(() => {
    let alive = true
    void listAccess(workspaceId).then((m) => {
      if (alive) setMap(m)
    })
    return () => {
      alive = false
    }
  }, [workspaceId])

  if (!map) return null

  // 목차가 여러 칸인 모듈만 판다 — 계산기 한 장짜리는 잠그지 않는다
  const modules = TOOLS.filter((t) => t.path !== null && (t.sections?.length ?? 0) > 1)
  const alwaysOpen = TOOLS.filter((t) => t.path !== null && (t.sections?.length ?? 0) <= 1)

  const change = async (key: string, label: string, state: ModuleAccessState) => {
    const next = await setAccess(workspaceId, key, state, today)
    setMap(new Map(map).set(key, next))
    showToast(
      state === 'open' ? `${label} 을(를) 열었습니다.` : state === 'trial' ? `${label} 체험을 시작했습니다 (${TRIAL_DAYS}일).` : `${label} 을(를) 잠갔습니다.`,
    )
  }

  return (
    <Section title="모듈 구독" count={modules.length}>
      <Surface>
        <p className="t-sub break-keep pb-3 text-slate-600">
          모듈은 따로 열고 닫을 수 있습니다. 잠긴 모듈도 <b>첫 화면은 보입니다</b> — 무엇이 들어 있는지 보여야 하기 때문입니다.
          결제는 아직 붙어 있지 않습니다.
          {alwaysOpen.length > 0 && (
            <>
              {' '}
              {alwaysOpen.map((t) => t.label).join(' · ')}는 한 장짜리라 잠그지 않고 늘 열려 있습니다.
            </>
          )}
        </p>
        <ul className="flex flex-col gap-2" data-testid="module-access-list">
          {modules.map((t) => {
            const access = map.get(t.key) ?? defaultAccess(t.key)
            const usable = canUse(access, today)
            const tone: Tone = usable ? (access.state === 'trial' ? 'warning' : 'success') : 'danger'
            return (
              <li key={t.key}>
                <Surface as="div" edge={tone} showEdge padded={false}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5" data-module={t.key}>
                    {usable ? (
                      <Unlock aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Lock aria-hidden="true" className="size-4 shrink-0 text-rose-600" />
                    )}
                    <span className="t-sub font-bold text-slate-900">{t.label}</span>
                    <Badge tone={tone}>{accessLabel(access, today)}</Badge>
                    <span className="t-meta min-w-0 flex-1 truncate text-slate-500">{t.sections?.length ?? 0}화면</span>
                    {/* D-94: 지금 상태에서 뜻이 있는 단추만 — 열린 모듈에 ‘체험’(열림 → 체험으로 내려감)·‘열기’(아무 일 없음)를 두지 않는다 */}
                    <span className="flex flex-wrap gap-1.5">
                      {access.state !== 'open' && (
                        <Button variant={usable ? 'ghost' : 'primary'} size="sm" data-act="open" onClick={() => void change(t.key, t.label, 'open')}>
                          {access.state === 'trial' && usable ? '정식으로 열기' : '열기'}
                        </Button>
                      )}
                      {access.state === 'locked' && (
                        <Button variant="ghost" size="sm" data-act="trial" onClick={() => void change(t.key, t.label, 'trial')}>
                          <Sparkles aria-hidden="true" className="size-4" /> 체험 {TRIAL_DAYS}일
                        </Button>
                      )}
                      {access.state !== 'locked' && (
                        <Button variant="ghost" size="sm" data-act="lock" onClick={() => void change(t.key, t.label, 'locked')}>
                          잠그기
                        </Button>
                      )}
                      {usable && t.path && (
                        <Link to={t.path} className="t-sub inline-flex items-center self-center px-2 font-medium text-brand-700 hover:underline" data-act="go">
                          모듈로 가기 →
                        </Link>
                      )}
                    </span>
                  </div>
                </Surface>
              </li>
            )
          })}
        </ul>
      </Surface>
    </Section>
  )
}
