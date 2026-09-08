/**
 * 단계 — 묶음별 목록 + 현재 단계 상세(상태 바꾸기 · 완료 조건 · exit checklist · 건너뛰기 · 막힘).
 * 모바일은 이전/현재/다음 세 칸과 바텀시트 전체 목록으로 다닌다.
 */

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ListTree } from 'lucide-react'
import { Badge, BottomSheet, Surface } from '../ui/primitives'
import { Button } from '../ui/Button'
import { useEditor } from './editorContext'
import { STAGE_GROUP_LABEL, nextStageKey, prevStageKey, stageDef, stagesByGroup } from '../../domain/consulting/workflowDefinition'
import { canCompleteStage, canSkipStage, gateCheckedCount } from '../../domain/consulting/gateEngine'
import { nextOpenStage } from '../../domain/consulting/nextActionResolver'
import { GATE_ITEMS, NO_GO_SIGNALS } from '../../domain/consulting/qaRules'
import { nowIso } from '../../lib/appClock'
import type { GateDecision, StageKey, StageStatus } from '../../types/consulting'
import { CheckRow, STAGE_STATUS_LABEL, StageBadge, TextField, stageTitle } from './studioParts'

export function StagesTab({ focus }: { focus?: string }) {
  const ed = useEditor()
  const { project: p, artifacts, evidence, today, update, decide, goTo } = ed
  const [selected, setSelected] = useState<StageKey>((focus && (focus in p.stages) ? focus : p.currentStage) as StageKey)
  const [listOpen, setListOpen] = useState(false)
  const [skipReason, setSkipReason] = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const def = stageDef(selected)
  const state = p.stages[selected]
  const gate = useMemo(() => canCompleteStage(p, selected, { artifacts, evidence, today }), [p, selected, artifacts, evidence, today])
  const prev = prevStageKey(selected)
  const next = nextStageKey(selected)
  const checklistDone = def.exitChecklist.every((_, i) => checked[`${selected}-${i}`])

  const setStatus = (status: StageStatus, extra: Partial<typeof state> = {}) => {
    const at = nowIso()
    update((cur) => ({
      ...cur,
      stages: {
        ...cur.stages,
        [selected]: {
          ...cur.stages[selected],
          ...extra,
          status,
          startedAt: cur.stages[selected].startedAt ?? (status !== 'not_started' ? at : null),
          completedAt: status === 'completed' ? at : null,
          updatedAt: at,
        },
      },
    }))
  }

  const complete = async () => {
    if (!gate.ok) return
    setStatus('completed')
    const following = nextOpenStage(p, selected)
    update((cur) => {
      const at = nowIso()
      const stages = { ...cur.stages }
      if (following !== selected && stages[following].status === 'not_started') {
        stages[following] = { ...stages[following], status: 'in_progress', startedAt: at, updatedAt: at }
      }
      return { ...cur, stages, currentStage: following }
    })
    await decide({ stageKey: selected, kind: 'stage', summary: `${stageTitle(selected)} 완료`, reason: '완료 조건·exit checklist 확인' })
    setSelected(following)
  }

  const skip = async () => {
    const ok = canSkipStage(selected, skipReason)
    if (!ok.ok) {
      ed.toast(ok.blockers[0])
      return
    }
    setStatus('skipped', { skipReason: skipReason.trim() })
    const following = nextOpenStage(p, selected)
    update((cur) => ({ ...cur, currentStage: cur.currentStage === selected ? following : cur.currentStage }))
    await decide({ stageKey: selected, kind: 'stage', summary: `${stageTitle(selected)} 건너뜀`, reason: skipReason.trim() })
    setSkipReason('')
  }

  const block = () => {
    if (blockReason.trim().length < 2) {
      ed.toast('무엇에 막혔는지 적어 주세요.')
      return
    }
    setStatus('blocked', { blockedBy: blockReason.trim() })
    setBlockReason('')
  }

  const makeCurrent = () => {
    update((cur) => ({ ...cur, currentStage: selected }))
    if (state.status === 'not_started') setStatus('in_progress')
  }

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[280px_1fr] lg:items-start lg:gap-5">
      {/* 모바일: 이전/현재/다음 */}
      <div className="flex items-center gap-2 lg:hidden">
        <Button variant="secondary" size="sm" disabled={!prev} onClick={() => prev && setSelected(prev)} aria-label="이전 단계">
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Button>
        <button type="button" onClick={() => setListOpen(true)} className="tap flex min-w-0 flex-1 items-center justify-center gap-2 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2">
          <ListTree aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
          <span className="t-body truncate font-semibold text-slate-900">{stageTitle(selected)}</span>
        </button>
        <Button variant="secondary" size="sm" disabled={!next} onClick={() => next && setSelected(next)} aria-label="다음 단계">
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>

      {/* 데스크톱: 묶음별 목록 */}
      <nav aria-label="단계 목록" className="hidden lg:block">
        <StageList selected={selected} onSelect={setSelected} />
      </nav>

      {/* 상세 */}
      <div className="flex min-w-0 flex-col gap-4">
        <Surface edge={state.status === 'blocked' ? 'danger' : selected === p.currentStage ? 'brand' : 'neutral'} showEdge>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="t-section text-slate-900">{stageTitle(selected)}</h2>
            <StageBadge status={state.status} />
            {selected === p.currentStage ? <Badge tone="brand">현재</Badge> : (
              <button type="button" onClick={makeCurrent} className="t-meta font-medium text-brand-700 hover:underline">
                이 단계로 옮기기
              </button>
            )}
          </div>
          <p className="t-body mt-2 break-keep text-slate-700">{def.purpose}</p>
          <p className="t-meta mt-1 text-slate-400">Master 활성 PART: {def.activeParts}</p>
          {state.status === 'skipped' && state.skipReason && <p className="t-sub mt-2 text-slate-600">건너뛴 이유: {state.skipReason}</p>}
          {state.status === 'blocked' && state.blockedBy && <p className="t-sub mt-2 text-danger-700">막힌 이유: {state.blockedBy}</p>}
        </Surface>

        {selected === 'S1' && <GateBlock />}

        <Surface>
          <h3 className="t-card text-slate-900">완료 조건</h3>
          {gate.ok ? (
            <p className="t-body mt-2 text-success-700">필요한 사실·산출물이 모두 있습니다.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {gate.blockers.map((b) => (
                <li key={b} className="t-body flex items-start gap-2 break-keep text-slate-700">
                  <Badge tone="warning">필요</Badge>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          {gate.notes.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {gate.notes.map((n) => (
                <li key={n} className="t-sub break-keep text-slate-500">· {n}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {def.requiredFacts.length > 0 && <Button size="sm" onClick={() => goTo('factsheet', def.requiredFacts[0])}>사실표 열기</Button>}
            {def.promptTypes.length > 0 && <Button size="sm" onClick={() => goTo('prompts', def.promptTypes[0])}>프롬프트 만들기</Button>}
            {def.requiredArtifacts.length > 0 && <Button size="sm" onClick={() => goTo('artifacts', def.requiredArtifacts[0])}>산출물</Button>}
          </div>
        </Surface>

        <Surface>
          <h3 className="t-card text-slate-900">exit checklist — 사람이 확인</h3>
          <div className="mt-2 flex flex-col gap-1.5">
            {def.exitChecklist.map((item, i) => (
              <CheckRow key={item} label={item} checked={checked[`${selected}-${i}`] === true} onChange={(v) => setChecked((c) => ({ ...c, [`${selected}-${i}`]: v }))} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" disabled={!gate.ok || !checklistDone || state.status === 'completed'} onClick={() => void complete()}>
              완료로 넘기기
            </Button>
            {state.status !== 'completed' && state.status !== 'in_progress' && (
              <Button onClick={() => setStatus('in_progress')}>진행 중으로</Button>
            )}
            {state.status === 'in_progress' && <Button onClick={() => setStatus('ready_for_review')}>검토 대기로</Button>}
            {state.status === 'blocked' && <Button onClick={() => setStatus('in_progress', { blockedBy: '' })}>막힘 풀림</Button>}
          </div>
          {!checklistDone && gate.ok && <p className="t-meta mt-2 text-slate-500">체크리스트를 모두 확인해야 완료로 넘길 수 있습니다.</p>}
        </Surface>

        <div className="grid gap-4 md:grid-cols-2">
          <Surface>
            <h3 className="t-card text-slate-900">막힘 표시</h3>
            <p className="t-sub mt-1 break-keep text-slate-500">무엇에 막혔는지 적어 두면 다음 행동 맨 위에 올라옵니다.</p>
            <div className="mt-2">
              <TextField label="막힌 이유" value={blockReason} onCommit={setBlockReason} placeholder="예: 대표자 인터뷰 일정 미정" />
            </div>
            <Button variant="danger" className="mt-2" onClick={block} disabled={state.status === 'completed'}>막힘으로 표시</Button>
          </Surface>
          <Surface>
            <h3 className="t-card text-slate-900">건너뛰기</h3>
            <p className="t-sub mt-1 break-keep text-slate-500">{def.skippable ? '이 회사에 해당하지 않을 때만. 이유가 필요합니다.' : '이 단계는 건너뛸 수 없습니다.'}</p>
            <div className="mt-2">
              <TextField label="이유" value={skipReason} onCommit={setSkipReason} placeholder="예: 이미 등록된 특허 보유 (10-2345678)" />
            </div>
            <Button className="mt-2" disabled={!def.skippable || state.status === 'completed'} onClick={() => void skip()}>건너뜀으로 표시</Button>
          </Surface>
        </div>

        <TextField label="단계 메모" value={state.note} multiline rows={3} onCommit={(v) => update((cur) => ({ ...cur, stages: { ...cur.stages, [selected]: { ...cur.stages[selected], note: v, updatedAt: nowIso() } } }))} />
      </div>

      {listOpen && (
        <BottomSheet title="단계 목록" onClose={() => setListOpen(false)}>
          <StageList selected={selected} onSelect={(k) => { setSelected(k); setListOpen(false) }} />
        </BottomSheet>
      )}
    </div>
  )
}

function StageList({ selected, onSelect }: { selected: StageKey; onSelect: (k: StageKey) => void }) {
  const { project: p } = useEditor()
  return (
    <div className="flex flex-col gap-3">
      {stagesByGroup().map(({ group, stages }) => (
        <div key={group}>
          <p className="t-meta px-1 font-semibold text-slate-500">{STAGE_GROUP_LABEL[group]}</p>
          <ul className="mt-1 flex flex-col gap-1">
            {stages.map((s) => {
              const st = p.stages[s.key].status
              const active = s.key === selected
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.key)}
                    aria-current={active ? 'true' : undefined}
                    className={`tap flex w-full items-center gap-2 rounded-(--radius-control) border px-3 py-2 text-left ${active ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <span className="t-meta w-8 shrink-0 font-bold text-slate-500">{s.key}</span>
                    <span className="t-body min-w-0 flex-1 truncate text-slate-900">{s.label}</span>
                    <span className={`size-2 shrink-0 rounded-full ${st === 'completed' || st === 'skipped' ? 'bg-success-500' : st === 'blocked' ? 'bg-danger-500' : st === 'in_progress' ? 'bg-brand-500' : st === 'ready_for_review' ? 'bg-warning-500' : 'bg-slate-200'}`} aria-label={STAGE_STATUS_LABEL[st]} />
                    {s.key === p.currentStage && <span className="t-meta shrink-0 font-semibold text-brand-700">현재</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** S1 — GO / HOLD / NO-GO. 체크는 사람이, 결정도 사람이. 코드는 개수만 센다. */
function GateBlock() {
  const { project: p, update, decide } = useEditor()
  const count = gateCheckedCount(p)
  const [reason, setReason] = useState(p.gate.reason)
  const pick = async (d: GateDecision) => {
    if (reason.trim() === '') {
      return
    }
    update((cur) => ({ ...cur, gate: { ...cur.gate, decision: d, reason: reason.trim(), decidedAt: nowIso() } }))
    await decide({ stageKey: 'S1', kind: 'gate', summary: `VENTURE GATE ${d.toUpperCase().replace('_', '-')} (GO 근거 ${count}/9)`, reason: reason.trim() })
  }
  return (
    <Surface edge="brand" showEdge>
      <h3 className="t-card text-slate-900">VENTURE GO / HOLD / NO-GO</h3>
      <p className="t-sub mt-1 break-keep text-slate-500">해당하는 것만 사실대로 표시합니다. 점수를 계산하지 않습니다 — GO 근거 {count}/9.</p>
      <div className="mt-3 flex flex-col gap-1.5">
        {GATE_ITEMS.map((g) => (
          <CheckRow key={g.key} label={g.text} checked={p.gate.items[g.key] === true} onChange={(v) => update((cur) => ({ ...cur, gate: { ...cur.gate, items: { ...cur.gate.items, [g.key]: v } } }))} />
        ))}
      </div>
      <details className="mt-3">
        <summary className="t-sub cursor-pointer font-medium text-slate-600">NO-GO 신호 (하나라도 있으면 억지로 진행하지 않는다)</summary>
        <ul className="mt-1 list-disc pl-5">
          {NO_GO_SIGNALS.map((s) => (
            <li key={s} className="t-sub break-keep text-slate-600">{s}</li>
          ))}
        </ul>
      </details>
      <div className="mt-3">
        <TextField label="결정 이유" value={reason} onCommit={setReason} placeholder="예: 현장문제·거래처 명확. 특허 포인트는 보강 필요" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant={p.gate.decision === 'go' ? 'primary' : 'secondary'} disabled={reason.trim() === ''} onClick={() => void pick('go')}>GO</Button>
        <Button variant={p.gate.decision === 'hold' ? 'primary' : 'secondary'} disabled={reason.trim() === ''} onClick={() => void pick('hold')}>HOLD</Button>
        <Button variant={p.gate.decision === 'no_go' ? 'danger' : 'secondary'} disabled={reason.trim() === ''} onClick={() => void pick('no_go')}>NO-GO</Button>
      </div>
      {p.gate.decision && <p className="t-meta mt-2 text-slate-500">현재 결정: {p.gate.decision.toUpperCase().replace('_', '-')} · {p.gate.decidedAt?.slice(0, 10)}</p>}
      {reason.trim() === '' && <p className="t-meta mt-1 text-slate-500">이유를 적어야 결정 버튼이 열립니다.</p>}
    </Surface>
  )
}
