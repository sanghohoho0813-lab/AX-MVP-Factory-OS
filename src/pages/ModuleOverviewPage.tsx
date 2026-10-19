/**
 * 모듈 살펴보기 (D-127) — `/modules/:moduleKey`
 *
 * 잠겨 있어도 늘 열리는 소개 화면. 이 모듈이 맡는 일 · 들어 있는 기능 · 앞으로 들어올 것.
 * 업체에서 왔으면(`?client=`) 기능 단추가 그 업체로 열린다(주소에 업체를 싣는다).
 * 사는 단추 · 가격은 없다 — 결제가 붙기 전이다.
 */

import { useCallback } from 'react'
import { AiAssist } from '../components/ai/AiAssist'
import { moduleBundle } from '../services/aiAssist/builders'
import { listClients } from '../services/clientOpsService'
import { useIsPilot } from '../auth/osAccess'
import { isPilotHiddenPath } from '../config/moduleRegistry'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, Clock, Lock, Sparkles } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Badge, Section, Surface } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'
import { NotFoundState } from '../components/ui/NotFoundState'
import { useToast } from '../components/ui/toastContext'
import { lockedSentence, withClient } from '../components/modules/moduleText'
import { catalogModule, featuresOfModule, visibleModules } from '../config/productCatalog'
import { clientEntryHref, featureDesc, featureIcon, featureLabel, featurePath } from '../config/featurePaths'
import { notifyEntitlementsChanged, useEntitlements } from '../lib/entitlementsStore'
import { todayLocalDate } from '../lib/appClock'
import { setAccess, TRIAL_DAYS } from '../services/moduleAccess'
import { MODULE_GUIDES } from '../content/flowSteps'

export function ModuleOverviewPage() {
  const { moduleKey = '' } = useParams()
  const [params] = useSearchParams()
  const clientId = params.get('client')
  const { ent, workspaceId } = useEntitlements()
  const { showToast } = useToast()
  // D-162: Pilot 에게는 잘 안 쓰는 모듈(기술사업화 · AX · 웹 스튜디오)과 요금제 말을 보이지 않는다
  const pilot = useIsPilot()
  const m = catalogModule(moduleKey)
  if (!m || !m.visible) return <NotFoundState title="모듈을 찾지 못했습니다" description="주소가 바뀌었거나 없는 모듈입니다." backTo="/tools" backLabel="모듈 전체로" />

  const e = ent.module(m.key)
  const features = featuresOfModule(m.key).filter((f) => !(pilot && featurePath(f) && isPilotHiddenPath(featurePath(f) as string)))
  const startTrial = async () => {
    await setAccess(workspaceId, m.entitlementKey, 'trial', todayLocalDate())
    notifyEntitlementsChanged()
    showToast(`${m.name} 모듈 체험을 시작했습니다 (${TRIAL_DAYS}일).`)
  }

  return (
    <div className="flex flex-col gap-6" data-testid="module-overview" data-module-key={m.key}>
      <PageHeader title={`${m.name} 모듈`} description={m.description} />
      {/* D-239: 이 분야 고객 전체를 거꾸로 — 업체마다 받을 수 있는 것(규칙 판정)을 AI 가 정리 */}
      {e.usable && <ModuleAssist moduleName={m.name} moduleKey={m.key} features={features.map((f) => f.key).filter((k) => k !== 'grants')} workspaceId={workspaceId} usable={(k) => ent.feature(k).usable} />}

      <Surface edge={e.usable ? 'success' : 'warning'} showEdge>
        <div className="flex flex-col gap-2" data-testid="module-status" data-usable={e.usable ? 'yes' : 'no'}>
          <p className="t-card flex flex-wrap items-center gap-2 font-bold break-keep text-slate-900">
            {e.usable ? <Check aria-hidden="true" className="size-5 shrink-0 text-success-600" /> : <Lock aria-hidden="true" className="size-5 shrink-0 text-amber-600" />}
            {e.usable ? '지금 쓰고 있습니다' : `${lockedSentence(e.source)}`}
            <Badge tone={e.usable ? (e.source === 'trial' ? 'warning' : 'success') : 'neutral'}>{e.label}</Badge>
          </p>
          <p className="t-body break-keep text-slate-700">이 모듈이 맡는 일 — {m.covers.join(' · ')}</p>
          {!e.usable && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button variant="secondary" onClick={() => void startTrial()} data-testid="module-trial">
                <Sparkles aria-hidden="true" className="size-4" /> {TRIAL_DAYS}일 체험
              </Button>
              <span className="t-meta break-keep text-slate-500">결제는 아직 붙어 있지 않습니다. 각 기능의 첫 화면은 지금도 볼 수 있습니다.</span>
            </div>
          )}
        </div>
      </Surface>

      {/* D-235: 처음 여는 사람이 따라 할 세 걸음 — 무엇을 위한 걸음인지까지 */}
      {MODULE_GUIDES[m.key] && (
        <Section title="이렇게 쓰세요">
          <ol className="grid gap-2.5 md:grid-cols-3" data-testid="module-guide">
            {MODULE_GUIDES[m.key].map((g, i) => {
              const inner = (
                <>
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white tabular-nums">
                      {i + 1}
                    </span>
                    <span className="t-card min-w-0 flex-1 font-bold break-keep text-slate-900">{g.title}</span>
                    {g.to && <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />}
                  </span>
                  <span className="t-sub mt-1.5 block break-keep text-slate-600">{g.why}</span>
                </>
              )
              return (
                <li key={g.title} data-step={i + 1}>
                  {g.to ? (
                    <Link to={withClient(g.to, clientId)} className="ax-lift tap flex h-full flex-col rounded-(--radius-panel) border border-brand-100 bg-brand-50/60 px-4 py-3.5 hover:border-brand-300">
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex h-full flex-col rounded-(--radius-panel) border border-brand-100 bg-brand-50/60 px-4 py-3.5">{inner}</div>
                  )}
                </li>
              )
            })}
          </ol>
        </Section>
      )}

      <Section title="들어 있는 기능" count={features.filter((f) => featurePath(f)).length}>
        <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3" data-testid="module-features">
          {features.map((f) => {
            const path = featurePath(f)
            const Icon = featureIcon(f)
            const fe = ent.feature(f.key)
            const label = featureLabel(f)
            const href = clientId && f.clientEntry ? clientEntryHref(f, clientId) : path ? withClient(path, clientId) : null
            const reachable = href && (fe.usable || f.lockedPreview !== 'intro')
            const body = (
              <>
                <span className="flex items-center gap-2.5">
                  {Icon && <Icon aria-hidden="true" className={`size-5 shrink-0 ${reachable ? 'text-brand-600' : 'text-slate-400'}`} />}
                  <span className="t-card min-w-0 flex-1 font-bold break-keep text-slate-900">{label}</span>
                  {!path && <Badge>준비 중</Badge>}
                  {reachable && <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />}
                </span>
                <span className="t-sub mt-1.5 block break-keep text-slate-600">{featureDesc(f)}</span>
                {path && !fe.usable && (
                  <span className="t-sub mt-1.5 block break-keep font-medium text-amber-800">
                    {f.lockedPreview === 'first-section' ? '첫 화면은 볼 수 있습니다' : f.lockedPreview === 'full' ? '잠겨 있어도 쓸 수 있습니다' : '모듈을 열면 씁니다'}
                  </span>
                )}
                {reachable && clientId && f.clientEntry && (
                  <span className="t-sub mt-2 inline-flex w-fit items-center rounded-(--radius-control) bg-brand-50 px-2.5 py-1 font-semibold text-brand-800">
                    {f.clientEntry.topic} {f.clientEntry.verb}
                  </span>
                )}
              </>
            )
            return (
              <li key={f.key}>
                {reachable ? (
                  <Link to={href} data-feature={f.key} className="ax-lift tap flex h-full flex-col rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3.5 hover:border-brand-300">
                    {body}
                  </Link>
                ) : (
                  <div data-feature={f.key} className="flex h-full flex-col rounded-(--radius-panel) border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3.5">
                    {body}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {m.upcoming.length > 0 && (
          <p className="t-body flex items-start gap-2 break-keep text-slate-600" data-testid="module-upcoming">
            <Clock aria-hidden="true" className="mt-1 size-4 shrink-0 text-slate-400" />
            앞으로 들어올 것 — {m.upcoming.join(' · ')}
          </p>
        )}
      </Section>

      <nav aria-label="다른 전문 모듈" className="flex flex-col gap-2">
        <p className="t-sub font-semibold text-slate-600">다른 전문 모듈</p>
        <div className="flex flex-wrap gap-2">
          {visibleModules()
            .filter((x) => x.key !== m.key && !(pilot && x.rarelyUsed))
            .map((x) => (
              <Link
                key={x.key}
                to={withClient(x.route, clientId)}
                className="tap t-body inline-flex items-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700"
              >
                <x.icon aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                {x.name}
                {!ent.module(x.key).usable && <span className="t-meta text-slate-500">· 잠김</span>}
              </Link>
            ))}
          <Link to="/tools" className="tap t-body inline-flex items-center px-2 py-2 font-medium text-brand-700 hover:underline">
            {pilot ? '모듈 전체' : '모듈 전체 · 요금제'}
          </Link>
        </div>
      </nav>
    </div>
  )
}

function ModuleAssist({ moduleName, moduleKey, features, workspaceId, usable }: { moduleName: string; moduleKey: string; features: string[]; workspaceId: string | null; usable: (key: string) => boolean }) {
  const key = features.join(',')
  const build = useCallback(async () => {
    const records = await listClients(workspaceId).catch(() => [])
    return moduleBundle({ today: todayLocalDate(), records, features: key.split(','), notices: [], usable, title: `${moduleName} 모듈 · 고객 전체` })
  }, [workspaceId, key, moduleName]) // eslint-disable-line react-hooks/exhaustive-deps
  if (features.length === 0) return null
  return <AiAssist page="module" scope={`module:${moduleKey}`} title={`${moduleName} 모듈 · 고객 전체`} presets={['module.all', 'module.first', 'module.missing']} build={build} />
}
