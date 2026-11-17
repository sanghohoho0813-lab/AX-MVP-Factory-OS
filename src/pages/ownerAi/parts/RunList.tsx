/**
 * D-624 AI 결과 — 작업마다 한 줄(뜨는 주제 목록처럼). 누르면 그 줄 아래에 그 결과만 펼친다.
 *
 * 대표: "AI 결과가 최신 결과가 위로 쌓이고 스크롤을 너무 내리게 돼 있다 — 병렬로 쌓이거나 펼쳐 보면 딱 그 결과가 나오게."
 *  - 예전: 결과마다 큰 카드를 새것부터 쌓았다(같은 작업을 다시 만들면 카드가 또 하나 · 맨 위 하나만 펼침 · 8개 넘으면 '더 보기').
 *  - 지금: 줄 순서는 작업 순서(빠른 작업 10가지 순서 그대로) — 새로 만들어도 줄이 움직이지 않는다.
 *          줄 = 작업 이름 · 상태(검토 전 · 채택 · 결과 n개) · 만든 때 · 결과 첫 줄. 한 번에 한 줄만 펼친다.
 *          같은 작업 결과가 여럿이면 펼친 안에서 [최신 · 날짜] 칩으로 고른다(지우지 않고 쌓이는 것은 그대로).
 *  - 새 결과가 나오면 그 작업 줄을 펼치고 그 결과를 고른 채 그 줄로 옮겨 준다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { runHeadline } from '../../../services/ownerAi/render'
import { QUICK_ACTIONS, skillName } from '../../../services/ownerAi/skillCatalog'
import { EVALUATION_LABEL, type AiRevision, type AiRun, type Evaluation, type SkillId } from '../../../services/ownerAi/types'
import { Surface } from '../../../components/ui/primitives'
import { SKILL_ICON_TEXT, skillIcon } from '../skillVisual'
import { RunBody } from './RunCard'
import { EVAL_TEXT, fmtShort, runsBySkill, statusLabel } from './runStatus'

/** 줄 순서 — 빠른 작업 10가지 순서 그대로, 그 뒤 자료 요약 · 기억 정리 · 그 밖 */
const ORDER: SkillId[] = [...new Set<SkillId>([...QUICK_ACTIONS.map((a) => a.skill), 'SNAPSHOT_EXTRACT', 'CONTEXT_UPDATE'])]
const rank = (s: SkillId) => {
  const i = ORDER.indexOf(s)
  return i < 0 ? ORDER.length : i
}
/** 펼친 안에서 처음 보이는 결과 칩 수(더 있으면 '지난 결과 n개') */
const CHIPS = 6

export interface RunFocus {
  skill: SkillId
  runId: string
  /** 같은 결과로 다시 옮길 때도 바뀌게 */
  n: number
}

export interface RunHandlers {
  busy: boolean
  onEvaluate: (run: AiRun) => (evaluation: Evaluation, note: string, part: unknown) => Promise<boolean>
  onRevise: (run: AiRun) => (text: string, note: string) => Promise<boolean>
  onToMemory: (run: AiRun) => void
  /** 없으면 [다시 만들기] 없음 */
  regenerate: (run: AiRun) => (() => void) | undefined
  toast: (m: string) => void
}

export function RunList({ runs, revisions, focus, handlers }: { runs: readonly AiRun[]; revisions: ReadonlyMap<string, AiRevision>; focus: RunFocus | null; handlers: RunHandlers }) {
  const groups = useMemo(() => [...runsBySkill(runs)].sort((a, b) => rank(a[0]) - rank(b[0])), [runs])
  // 처음 열 때 — 가장 최근 결과가 아직 검토 전이면 그 작업 줄을 펼쳐 둔다(예전 '맨 위 카드만 펼침' 과 같은 뜻)
  const [openSkill, setOpenSkill] = useState<SkillId | null>(() => {
    const latest = [...runs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
    return latest && latest.evaluation === 'draft' ? latest.skillId : null
  })
  const [picked, setPicked] = useState<Partial<Record<SkillId, string>>>({})
  const [allChips, setAllChips] = useState<SkillId | null>(null)
  const rowRefs = useRef(new Map<SkillId, HTMLLIElement>())

  useEffect(() => {
    if (!focus) return
    setOpenSkill(focus.skill)
    setPicked((p) => ({ ...p, [focus.skill]: focus.runId }))
    // 결과가 그려진 다음 그 줄로(머리줄에 가리지 않게 scroll-mt)
    const t = window.setTimeout(() => rowRefs.current.get(focus.skill)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60)
    return () => window.clearTimeout(t)
  }, [focus])

  return (
    <Surface className="px-2 py-1 sm:px-3">
      <ul className="flex flex-col" data-testid="run-list">
        {groups.map(([skill, list]) => {
          const open = openSkill === skill
          const latest = list[0]
          const run = list.find((r) => r.id === picked[skill]) ?? latest
          const Icon = skillIcon(skill)
          const headline = runHeadline(latest, revisions.get(latest.id)?.content)
          const showAll = allChips === skill
          const chips = showAll ? list : list.slice(0, CHIPS)
          // 고른 결과가 접힌 칩 안에 있으면 그것도 보이게
          if (!chips.includes(run)) chips.push(run)
          const bodyId = `run-group-body-${skill}`
          return (
            <li
              key={skill}
              ref={(el) => {
                if (el) rowRefs.current.set(skill, el)
                else rowRefs.current.delete(skill)
              }}
              className="min-w-0 scroll-mt-24 border-b border-slate-100 last:border-b-0"
              data-testid="run-group"
              data-group={skill}
              data-open={open ? '1' : '0'}
            >
              <button
                type="button"
                onClick={() => setOpenSkill(open ? null : skill)}
                aria-expanded={open}
                aria-controls={open ? bodyId : undefined}
                className={`tap group flex min-h-14 w-full min-w-0 items-center gap-3 rounded-lg px-1.5 py-2.5 text-left transition-colors hover:bg-slate-50 ${open ? 'bg-slate-50' : ''}`}
                data-testid="run-group-toggle"
              >
                <Icon aria-hidden="true" className={`size-5 shrink-0 ${SKILL_ICON_TEXT}`} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="t-body font-bold break-keep text-slate-900">{skillName(skill)}</span>
                    <span className={`t-meta font-semibold ${EVAL_TEXT[latest.evaluation]}`} data-testid="run-group-status">
                      {statusLabel(list)}
                    </span>
                    <span className="t-meta text-slate-500 tabular-nums">{fmtShort(latest.createdAt)}</span>
                  </span>
                  {!open && headline && (
                    <span className="t-sub line-clamp-1 break-all text-slate-600" data-testid="run-group-line">
                      {headline}
                    </span>
                  )}
                </span>
                <ChevronDown aria-hidden="true" className={`size-5 shrink-0 transition-transform group-hover:text-brand-600 ${open ? 'rotate-180 text-brand-600' : 'text-slate-400'}`} />
              </button>
              {open && (
                <div id={bodyId} className="flex min-w-0 flex-col gap-3 px-1.5 pt-2 pb-4 sm:px-3" data-testid="run-group-body">
                  {list.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1.5" data-testid="run-versions" role="group" aria-label={`${skillName(skill)} 결과 고르기`}>
                      {chips.map((r) => {
                        const on = r.id === run.id
                        return (
                          <button
                            key={r.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setPicked((p) => ({ ...p, [skill]: r.id }))}
                            className={`tap t-meta inline-flex min-h-10 items-center gap-1 rounded-full border px-3 font-semibold whitespace-nowrap ${on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-400'}`}
                            data-testid="run-version"
                            data-run-id={r.id}
                          >
                            {r.id === latest.id ? '최신 · ' : ''}
                            {fmtShort(r.createdAt)} · {r.status === 'pasted' ? '붙여넣음' : EVALUATION_LABEL[r.evaluation]}
                          </button>
                        )
                      })}
                      {!showAll && list.length > CHIPS && (
                        <button type="button" onClick={() => setAllChips(skill)} className="tap t-meta min-h-10 px-2 font-semibold text-brand-700 hover:underline" data-testid="run-versions-more">
                          지난 결과 {list.length - CHIPS}개 더
                        </button>
                      )}
                    </div>
                  )}
                  <RunBody
                    key={run.id}
                    run={run}
                    revision={revisions.get(run.id)}
                    busy={handlers.busy}
                    onEvaluate={handlers.onEvaluate(run)}
                    onRevise={handlers.onRevise(run)}
                    onToMemory={() => handlers.onToMemory(run)}
                    onRegenerate={handlers.regenerate(run)}
                    toast={handlers.toast}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Surface>
  )
}
