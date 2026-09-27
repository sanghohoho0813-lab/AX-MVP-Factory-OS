/**
 * 요금제와 모듈 (D-91 → D-127).
 *
 * 대표가 여기서 요금제(BASIC · GROWTH · PRO · ALL)를 고르고, GROWTH · PRO 면 모듈을 고른다.
 * 모듈마다 체험 · 열기 · 잠그기도 여기서. **결제는 아직 붙어 있지 않다** — 그렇게 화면에 적는다.
 *
 * 요금제 표(몇 개 고르나 · 무엇이 드나)는 productCatalog.ts 에서 읽는다. 여기에 요금제 이름으로 if 를 쓰지 않는다.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge, Section, Surface, type Tone } from '../ui/primitives'
import { useToast } from '../ui/toastContext'
import { todayLocalDate } from '../../lib/appClock'
import { josa } from '../../lib/josa'
import { notifyEntitlementsChanged, useEntitlements } from '../../lib/entitlementsStore'
import { FEATURE_CATALOG, PLAN_CATALOG, visibleModules, type CatalogModule } from '../../config/productCatalog'
import { TOOLS } from '../../config/toolRegistry'
import { validateSelection, type ModuleEntitlement } from '../../services/entitlements'
import { accessLabel, listAccess, setAccess, TRIAL_DAYS, type ModuleAccess, type ModuleAccessState } from '../../services/moduleAccess'
import { saveSubscription } from '../../services/subscription'

/** 도구 key → 모듈 key (카탈로그에서) */
const FEATURE_OF: Record<string, string> = Object.fromEntries(FEATURE_CATALOG.map((f) => [f.key, f.module]))

export function ModuleAccessPanel() {
  const { ent, ready, workspaceId } = useEntitlements()
  const { showToast } = useToast()
  const today = todayLocalDate()
  const [raw, setRaw] = useState<Map<string, ModuleAccess> | null>(null)
  const [planKey, setPlanKey] = useState(ent.subscription.planKey)
  const [picked, setPicked] = useState<string[]>(ent.subscription.selectedModules)

  // 저장된 요금제가 읽히면(또는 바뀌면) 고르던 것을 그것으로
  const savedKey = `${ent.subscription.planKey}|${ent.subscription.selectedModules.join()}`
  const [seen, setSeen] = useState(savedKey)
  if (seen !== savedKey) {
    setSeen(savedKey)
    setPlanKey(ent.subscription.planKey)
    setPicked(ent.subscription.selectedModules)
  }

  useEffect(() => {
    let alive = true
    void listAccess(workspaceId).then((m) => {
      if (alive) setRaw(m)
    })
    return () => {
      alive = false
    }
  }, [workspaceId, ent])

  if (!ready || !raw) return null

  const plan = PLAN_CATALOG.find((p) => p.key === planKey) ?? ent.plan
  const check = validateSelection(plan.key, picked)
  const dirty = plan.key !== ent.subscription.planKey || check.selected.join() !== ent.subscription.selectedModules.join()
  const modules = visibleModules()

  const savePlan = async () => {
    await saveSubscription(workspaceId, plan.key, check.selected)
    notifyEntitlementsChanged()
    showToast(`${plan.name} 요금제로 바꿨습니다.`)
  }
  const toggle = (key: string) => setPicked((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]))

  const change = async (accessKey: string, label: string, state: ModuleAccessState) => {
    await setAccess(workspaceId, accessKey, state, today)
    notifyEntitlementsChanged()
    showToast(
      state === 'open'
        ? `${josa(label, '을/를')} 열어 두었습니다.`
        : state === 'trial'
          ? `${label} 체험을 시작했습니다 (${TRIAL_DAYS}일).`
          : state === 'locked'
            ? `${josa(label, '을/를')} 잠갔습니다.`
            : `${josa(label, '은/는')} 이제 요금제를 따릅니다.`,
    )
  }

  return (
    <Section title="요금제와 모듈">
      <Surface>
        <div className="flex flex-col gap-4" id="plan" data-testid="plan-panel">
          <p className="t-body break-keep text-slate-700">
            기본 OS(고객 · 일정 · 상담 · 영업 · 자료 · 업무 기록 · 정산)는 어느 요금제든 들어 있습니다. 전문 모듈은 요금제에 따라 열립니다.
            <span className="text-slate-500"> 결제는 아직 붙어 있지 않습니다 — 여기서 고른 것이 바로 적용됩니다.</span>
          </p>
          <div role="radiogroup" aria-label="요금제" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" data-testid="plan-picker">
            {PLAN_CATALOG.map((p) => {
              const on = p.key === plan.key
              return (
                <button
                  key={p.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-plan={p.key}
                  onClick={() => setPlanKey(p.key)}
                  className={`tap flex flex-col items-start gap-0.5 rounded-(--radius-control) border px-3.5 py-2.5 text-left ${on ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-slate-300 bg-white hover:border-brand-300'}`}
                >
                  <span className="t-body flex items-center gap-1.5 font-bold text-slate-900">
                    {on && <Check aria-hidden="true" className="size-4 text-brand-700" />}
                    {p.name}
                    {p.key === ent.subscription.planKey && <span className="t-meta font-medium text-slate-500">· 지금</span>}
                  </span>
                  <span className="t-sub break-keep text-slate-600">{p.summary}</span>
                </button>
              )
            })}
          </div>

          {!plan.includesAllModules && plan.selectableModules > 0 && (
            <fieldset className="flex flex-col gap-2" data-testid="plan-modules">
              <legend className="t-body pb-1 font-semibold text-slate-800">
                모듈 고르기 — {plan.selectableModules}개 중 {check.selected.length}개 골랐습니다
              </legend>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {modules.map((m) => {
                  const on = picked.includes(m.key)
                  const full = !on && check.selected.length >= plan.selectableModules
                  return (
                    <label
                      key={m.key}
                      className={`tap flex cursor-pointer items-center gap-2.5 rounded-(--radius-control) border px-3 py-2 ${on ? 'border-brand-600 bg-brand-50' : 'border-slate-300 bg-white'} ${full ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <input type="checkbox" className="size-5 shrink-0" checked={on} disabled={full} onChange={() => toggle(m.key)} data-pick={m.key} />
                      <span className="t-body font-medium text-slate-900">{m.name}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )}
          {check.errors.length > 0 && <p className="t-sub break-keep text-danger-700">{check.errors.join(' ')}</p>}
          {dirty && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={() => void savePlan()} data-testid="plan-save">
                {plan.name} 요금제로 바꾸기
              </Button>
              <Button variant="ghost" onClick={() => { setPlanKey(ent.subscription.planKey); setPicked(ent.subscription.selectedModules) }}>
                그대로 두기
              </Button>
            </div>
          )}
        </div>
      </Surface>

      <ul className="flex flex-col gap-2" data-testid="module-access-list">
        {modules.map((m) => (
          <ModuleRow key={m.key} m={m} e={ent.module(m.key)} raw={raw} today={today} onChange={change} />
        ))}
      </ul>
    </Section>
  )
}

function ModuleRow({
  m,
  e,
  raw,
  today,
  onChange,
}: {
  m: CatalogModule
  e: ModuleEntitlement
  raw: Map<string, ModuleAccess>
  today: string
  onChange: (accessKey: string, label: string, state: ModuleAccessState) => Promise<void>
}) {
  const tone: Tone = e.usable ? (e.source === 'trial' ? 'warning' : 'success') : 'neutral'
  const byOwner = e.source === 'granted' || e.source === 'trial' || e.source === 'trial-ended' || e.source === 'locked'
  // D-91 때 도구마다 남긴 잠금 · 체험 — 모듈과 따로 정해져 있으면 보여 주고 되돌릴 수 있게
  const own = TOOLS.filter((t) => {
    const a = raw.get(t.key)
    return a && a.state !== 'inherit' && FEATURE_OF[t.key] === m.key
  })
  return (
    <li>
      <Surface as="div" edge={tone} showEdge padded={false}>
        <div className="flex flex-col gap-2 px-3.5 py-3" data-module={m.key}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <m.icon aria-hidden="true" className="size-5 shrink-0 text-slate-500" />
            <span className="t-body font-bold text-slate-900">{m.name}</span>
            <Badge tone={tone}>{e.label}</Badge>
            <span className="ml-auto flex flex-wrap gap-1.5">
              {!e.usable && e.source !== 'locked' && e.source !== 'trial-ended' && (
                <Button variant="secondary" size="sm" data-act="trial" onClick={() => void onChange(m.entitlementKey, `${m.name} 모듈`, 'trial')}>
                  체험 {TRIAL_DAYS}일
                </Button>
              )}
              {(!e.usable || e.source === 'trial') && e.source !== 'locked' && (
                <Button variant="ghost" size="sm" data-act="open" onClick={() => void onChange(m.entitlementKey, `${m.name} 모듈`, 'open')}>
                  {e.source === 'trial' ? '계속 열어 두기' : '열기'}
                </Button>
              )}
              {byOwner && (
                <Button variant="ghost" size="sm" data-act="inherit" onClick={() => void onChange(m.entitlementKey, `${m.name} 모듈`, 'inherit')}>
                  {e.source === 'locked' ? '잠금 풀기' : '요금제 따르기'}
                </Button>
              )}
              {e.usable && e.source !== 'granted' && e.source !== 'trial' && (
                <Button variant="ghost" size="sm" data-act="lock" onClick={() => void onChange(m.entitlementKey, `${m.name} 모듈`, 'locked')}>
                  잠그기
                </Button>
              )}
              <Link to={m.route} data-act="go" className="tap t-sub inline-flex items-center px-2 font-medium text-brand-700 hover:underline">
                살펴보기
              </Link>
            </span>
          </div>
          {own.length > 0 && (
            <div className="t-sub flex flex-wrap items-center gap-2 break-keep text-slate-600" data-testid="module-own-overrides">
              <span>따로 정한 도구 —</span>
              {own.map((t) => (
                <span key={t.key} className="inline-flex items-center gap-1.5">
                  <b className="font-semibold text-slate-800">{t.label}</b>({accessLabel(raw.get(t.key) as ModuleAccess, today)})
                  <Button variant="ghost" size="sm" data-act="feature-inherit" data-feature={t.key} onClick={() => void onChange(t.key, t.label, 'inherit')}>
                    모듈 따르기
                  </Button>
                </span>
              ))}
            </div>
          )}
        </div>
      </Surface>
    </li>
  )
}
