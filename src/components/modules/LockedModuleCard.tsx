/**
 * 잠긴 모듈 한 장 (D-127) — 모든 모듈이 같은 모양으로 잠긴다.
 *
 * 광고처럼 보이지 않게: 사는 단추 · 가격 · 큰 색 띠가 없다. 무엇이 들어 있는지 한 줄,
 * [모듈 살펴보기] 하나, 대표가 바로 쓰는 [14일 체험] 하나. 결제는 아직 없다고 적는다.
 */

import { Link, useSearchParams } from 'react-router-dom'
import { Lock, Sparkles } from 'lucide-react'
import { Button } from '../ui/Button'
import { Surface } from '../ui/primitives'
import { useToast } from '../ui/toastContext'
import { todayLocalDate } from '../../lib/appClock'
import { josa } from '../../lib/josa'
import { notifyEntitlementsChanged, useEntitlements } from '../../lib/entitlementsStore'
import { catalogModule } from '../../config/productCatalog'
import { setAccess, TRIAL_DAYS } from '../../services/moduleAccess'
import type { EntitlementSource } from '../../services/entitlements'
import { lockedSentence, withClient } from './moduleText'

export function LockedModuleCard({
  moduleKey,
  featureLabel,
  compact = false,
  source,
  accessKey,
}: {
  moduleKey: string
  /** 지금 열려던 기능 이름 — 없으면 모듈 설명만 */
  featureLabel?: string
  /** 첫 화면 위에 얹는 한 줄짜리 */
  compact?: boolean
  /** 기능 하나만 따로 잠긴 때(D-91 도구별 기록) — 그 까닭 */
  source?: EntitlementSource
  /** 체험을 걸 이름 — 기본은 모듈 권한 이름 */
  accessKey?: string
}) {
  const { ent, workspaceId } = useEntitlements()
  const { showToast } = useToast()
  const [params] = useSearchParams()
  const m = catalogModule(moduleKey)
  if (!m) return null
  const why = source ?? ent.module(moduleKey).source
  const clientId = params.get('client')
  const more = withClient(m.route, clientId)

  const startTrial = async () => {
    await setAccess(workspaceId, accessKey ?? m.entitlementKey, 'trial', todayLocalDate())
    notifyEntitlementsChanged()
    showToast(`${m.name} 모듈 체험을 시작했습니다 (${TRIAL_DAYS}일).`)
  }

  if (compact) {
    return (
      <Surface edge="warning" showEdge className="mb-4">
        <p className="t-body flex flex-wrap items-center gap-x-2 gap-y-1.5 break-keep text-slate-700" data-testid="module-locked-banner">
          <Lock aria-hidden="true" className="size-4 shrink-0 text-amber-600" />
          <span>
            {accessKey && accessKey !== m.entitlementKey ? '이 도구는' : <><b>{m.name} 모듈</b>은</>} {lockedSentence(why)}. 이 첫 화면은 볼 수 있습니다.
          </span>
          <Link to={more} className="tap inline-flex items-center font-semibold text-brand-700 hover:underline" data-testid="module-explore">
            모듈 살펴보기
          </Link>
        </p>
      </Surface>
    )
  }

  return (
    <Surface edge="warning" showEdge>
      <div className="flex flex-col gap-3" data-testid="module-locked" data-module-key={m.key}>
        <p className="t-card flex items-start gap-2 font-bold break-keep text-slate-900">
          <Lock aria-hidden="true" className="mt-1 size-5 shrink-0 text-amber-600" />
          <span>
            {m.name} 모듈 — <span className="font-medium text-slate-700">{m.description}</span>
          </span>
        </p>
        <p className="t-body break-keep text-slate-700">
          {featureLabel ? `${josa(featureLabel, '은/는')} ${m.name} 모듈에 들어 있습니다. ` : ''}
          {lockedSentence(why)}. 모듈 소개와 첫 화면은 언제든 볼 수 있습니다.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={more}
            data-testid="module-explore"
            className="tap inline-flex h-11 items-center justify-center rounded-(--radius-control) border border-brand-600 bg-brand-600 px-4 font-medium text-white hover:bg-brand-700 sm:h-10"
          >
            모듈 살펴보기
          </Link>
          <Button variant="ghost" onClick={() => void startTrial()} data-testid="module-trial">
            <Sparkles aria-hidden="true" className="size-4" /> {TRIAL_DAYS}일 체험
          </Button>
        </div>
        <p className="t-meta break-keep text-slate-500">결제는 아직 붙어 있지 않습니다 — 대표가 ‘모듈 전체’ 화면의 요금제에서 바로 엽니다.</p>
      </div>
    </Surface>
  )
}
