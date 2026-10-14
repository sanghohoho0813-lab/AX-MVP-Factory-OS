/**
 * 업체 상세 '맞춤 추천' › 상황 예시로 바로 설계 (D-199 · 로드맵 5단계).
 *
 * 대표 지시(고도화 목표 3): 계산기는 상황 예시로 — 상황 예시를 많이 두고, 한 번 누르면 그 업체 숫자로 설계까지.
 *  - 줄 하나 = 상황 하나. 바로 설계된 것이 먼저(같으면 카탈로그 순서) · 모듈 칩으로 거르기.
 *  - 누르면 그 자리에서 설계(결과 · 이 상황에 필요한 숫자 ✓/✗ · 업체 기록에서 채운 값 · 가정 ★)
 *    + [모듈에서 이어서](같은 가정 · 같은 업체로 열림) · [요청 문구](빠진 것만) · [다음 약속으로].
 *  - 계산은 services/scenarios.ts(모듈 화면과 같은 엔진). 규칙 계산 — 'AI' 라고 부르지 않는다.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarPlus, Check, ChevronDown, MessageSquareText, Minus } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { Button } from '../ui/Button'
import { Badge, Section, type Tone } from '../ui/primitives'
import { SCENARIO_MODULE_LABEL, type ScenarioModule } from '../../services/scenarioPresets'
import { SCENARIO_STATE_LABEL, runScenarios, scenariosRequest, type ScenarioRun, type ScenarioState } from '../../services/scenarios'

const STATE_TONE: Record<ScenarioState, Tone> = { ready: 'success', partial: 'brand', need: 'warning' }
const FIRST = 6

/** '회사 정보 · 자산', '회사 정보 · 부채' … → '회사 정보(자산 · 부채 …)' — 같은 출처는 한 번만 */
function tidyFilled(list: readonly string[]): string {
  const groups = new Map<string, string[]>()
  const solo: string[] = []
  for (const f of list) {
    const m = f.match(/^(회사 정보|크레탑 보고서) · (.+)$/)
    if (m) groups.set(m[1], [...(groups.get(m[1]) ?? []), m[2]])
    else solo.push(f)
  }
  return [...[...groups].map(([k, v]) => `${k}(${v.join(' · ')})`), ...solo].join(' / ')
}

export function ClientScenarios({
  record,
  today,
  usable,
  onRequestText,
  onSetNext,
}: {
  record: ClientOpsRecord
  today: string
  usable: (module: ScenarioModule) => boolean
  onRequestText?: (text: string) => void
  onSetNext: (text: string) => void
}) {
  const runs = useMemo(() => runScenarios(record, today, usable, true), [record, today, usable])
  const [mod, setMod] = useState<ScenarioModule | 'all'>('all')
  const [open, setOpen] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const modules = useMemo(() => [...new Set(runs.map((r) => r.module))], [runs])
  const shown = mod === 'all' ? runs : runs.filter((r) => r.module === mod)
  const list = more || mod !== 'all' ? shown : shown.slice(0, FIRST)
  const ready = runs.filter((r) => r.state === 'ready').length
  const allRequest = useMemo(() => scenariosRequest(record, runs.filter((r) => r.state === 'need')), [record, runs])
  if (runs.length === 0) return null
  return (
    <Section title="상황 예시로 바로 설계" count={runs.length} fold={{ id: 'smart.scenarios', open: true }}>
      <div className="flex flex-col gap-3" data-testid="smart-scenarios" data-count={runs.length} data-ready={ready}>
        <p className="t-sub break-keep text-slate-600">
          이 업체 숫자로 바로 계산해요 — 상황을 누르면 설계가 펼쳐지고, 모듈에서 같은 가정으로 이어서 볼 수 있어요.
          <span className="ml-1 font-semibold text-success-700" data-testid="scenario-ready-count">
            바로 설계됨 {ready}가지
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="모듈로 거르기">
          {(['all', ...modules] as const).map((m) => {
            const n = m === 'all' ? runs.length : runs.filter((r) => r.module === m).length
            const on = mod === m
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setMod(m)
                  setOpen(null)
                }}
                className={`tap t-sub inline-flex items-center gap-1 rounded-full border px-3 font-semibold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400'}`}
                data-testid="scenario-filter"
                data-module={m}
              >
                {m === 'all' ? '전체' : SCENARIO_MODULE_LABEL[m]} <span className={on ? 'text-white/80' : 'text-slate-400'}>{n}</span>
              </button>
            )
          })}
        </div>
        <ul className="flex flex-col gap-2" data-testid="scenario-list">
          {list.map((r) => (
            <ScenarioRow key={r.id} r={r} open={open === r.id} onToggle={() => setOpen((x) => (x === r.id ? null : r.id))} onRequestText={onRequestText} onSetNext={onSetNext} />
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {mod === 'all' && !more && shown.length > FIRST && (
            <Button size="sm" variant="secondary" onClick={() => setMore(true)} data-testid="scenario-more">
              <ChevronDown aria-hidden="true" className="size-4" /> 상황 더 보기 ({shown.length - FIRST})
            </Button>
          )}
          {allRequest && onRequestText && (
            <Button size="sm" variant="ghost" onClick={() => onRequestText(allRequest)} data-testid="scenario-request-all">
              <MessageSquareText aria-hidden="true" className="size-4" /> 빠진 것 한 번에 요청 문구
            </Button>
          )}
        </div>
      </div>
    </Section>
  )
}

function ScenarioRow({ r, open, onToggle, onRequestText, onSetNext }: { r: ScenarioRun; open: boolean; onToggle: () => void; onRequestText?: (text: string) => void; onSetNext: (text: string) => void }) {
  // 머리글과 같은 줄은 펼친 곳에서 다시 쓰지 않는다
  const lines = r.lines.filter((l) => l !== r.headline)
  return (
    <li className="flex min-w-0 flex-col rounded-(--radius-card) border border-slate-200 bg-white" data-testid="scenario-row" data-id={r.id} data-module={r.module} data-state={r.state}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="tap flex w-full min-w-0 items-start gap-3 px-4 py-3 text-left hover:bg-slate-50" data-testid="scenario-toggle">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <Badge tone="neutral">{r.moduleLabel}</Badge>
            <span className="t-body min-w-0 font-bold break-keep text-slate-900 [overflow-wrap:anywhere]">{r.title}</span>
          </span>
          <span className="t-sub line-clamp-2 break-keep text-slate-700 [overflow-wrap:anywhere]" data-testid="scenario-headline">
            {r.headline}
          </span>
          {r.amount && (
            <span className="t-sub font-bold break-keep text-success-700" data-testid="scenario-amount">
              {r.amount}
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={STATE_TONE[r.state]}>
            <span data-testid="scenario-state">{SCENARIO_STATE_LABEL[r.state]}</span>
          </Badge>
          <ChevronDown aria-hidden="true" className={`size-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3" data-testid="scenario-detail">
          <p className="t-meta break-keep text-slate-500">{r.when}</p>
          {lines.length > 0 && (
            <ul className="flex flex-col gap-1" data-testid="scenario-lines">
              {lines.map((l) => (
                <li key={l} className="t-sub flex gap-2 break-keep text-slate-800 [overflow-wrap:anywhere]">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" />
                  <span className="min-w-0">{l}</span>
                </li>
              ))}
            </ul>
          )}
          {r.needs.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="t-sub font-semibold text-slate-900">이 상황에 필요한 숫자</p>
              <ul className="flex flex-wrap gap-1.5" data-testid="scenario-needs">
                {r.needs.map((n) => (
                  <li
                    key={n.label}
                    className={`t-meta inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 break-keep ${n.ok ? 'border-success-200 bg-success-50 text-success-800' : 'border-warning-200 bg-warning-50 text-warning-800'}`}
                    data-testid="scenario-need"
                    data-ok={n.ok ? '1' : '0'}
                  >
                    {n.ok ? <Check aria-hidden="true" className="size-3.5 shrink-0" /> : <Minus aria-hidden="true" className="size-3.5 shrink-0" />}
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {n.label}
                      {n.ok && n.value ? <b className="ml-1 font-semibold">{n.value}</b> : !n.ok ? <span className="ml-1">— 없음</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.filledFrom.length > 0 && (
            <p className="t-meta break-keep text-slate-500" data-testid="scenario-filled">
              업체 기록에서 채움 · {tidyFilled(r.filledFrom)}
            </p>
          )}
          {r.assumptions.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {r.assumptions.map((a) => (
                <li key={a} className="t-meta break-keep text-slate-500">
                  {a}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Link to={r.openPath} className="tap t-sub inline-flex items-center gap-1 rounded-(--radius-control) bg-brand-600 px-3 font-semibold text-white hover:bg-brand-700" data-testid="scenario-open">
              {r.moduleLabel}에서 이어서 <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            {r.request && onRequestText && (
              <Button size="sm" variant="secondary" onClick={() => onRequestText(r.request)} data-testid="scenario-request">
                <MessageSquareText aria-hidden="true" className="size-4" /> 빠진 것 요청 문구
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onSetNext(`${r.moduleLabel} — ${r.title} 설계 보여 드리기`)} data-testid="scenario-next">
              <CalendarPlus aria-hidden="true" className="size-4" /> 다음 약속으로
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
