/**
 * D-248 명세서 쓰기 — 단계 화면 여섯(아이디어 · 구성요소 · 도면 · 청구항 · 본문 · 점검/내보내기).
 * 규칙은 전부 엔진(services/patent/specDraft) — 여기는 칸을 보여 주고 고친 것을 돌려줄 뿐.
 *
 * D-249: 칸마다 예시(견본 발명) · 권리축 '~하는' 끝맺음 한 번에 고치기 · 아이디어 답 짧음/마케팅 말 · 본문 권장 길이 막대 ·
 *   지우기/바꾸기는 act(되돌리기 알림) · 제출 준비 묶음(ZIP).
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Download, Lightbulb, Package, Plus, Trash2, Wand2 } from 'lucide-react'
import { Surface, Disclosure } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { InlineConfirm } from '../../components/ui/InlineConfirm'
import {
  AXIS_LABEL,
  FIG_ROLE_LABEL,
  SECTION_KEYS,
  SECTION_LABEL,
  checkDraft,
  checkTitle,
  claimSkeleton,
  claimsOf,
  defaultFigures,
  drawingDescLines,
  figureSubject,
  isSkeleton,
  sectionSkeleton,
  signLines,
  skeletonFromAxis,
  splitClaims,
  titleFromFormula,
  titleParts,
  type DraftIssue,
  type DraftStep,
  type FigRole,
  type SectionKey,
  type SpecAxis,
  type SpecDraft,
  type SpecIdea,
} from '../../services/patent/specDraft'
import type { SpecReport } from '../../services/patent/specCheck'
import { AXIS_EXAMPLE, IDEA_EXAMPLE, SECTION_RANGE, axisEndingFix, ideaHint, lengthRatio, lengthState } from '../../services/patent/specCoach'
import { FigurePreview } from './SpecFigures'

type Update = (fn: (cur: SpecDraft) => SpecDraft) => void
/** 지우기 · 바꾸기 — 하고 나서 [되돌리기] 알림(SpecWritePage) */
export type Act = (label: string, fn: (cur: SpecDraft) => SpecDraft) => void

const inputCls = 't-body min-h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3'
const areaCls = 't-body w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 leading-relaxed'

function Card({ title, hint, children, testId, aside }: { title: string; hint?: string; children: ReactNode; testId?: string; aside?: ReactNode }) {
  return (
    <Surface>
      <section className="flex flex-col gap-3" data-testid={testId}>
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="t-body font-bold break-keep text-slate-900">{title}</h3>
            {hint && <p className="t-sub break-keep text-slate-600">{hint}</p>}
          </div>
          {aside}
        </div>
        {children}
      </section>
    </Surface>
  )
}

function Issues({ list, testId }: { list: DraftIssue[]; testId?: string }) {
  if (!list.length) return null
  return (
    <ul className="flex flex-col gap-1" data-testid={testId}>
      {list.map((i) => (
        <li key={i.id} className={`t-sub break-keep ${i.level === 'error' ? 'text-danger-700' : i.level === 'warn' ? 'text-warning-800' : 'text-slate-600'}`} data-issue={i.id}>
          {i.level === 'error' ? '✕ ' : i.level === 'warn' ? '△ ' : 'ⓘ '}
          {i.text}
        </li>
      ))}
    </ul>
  )
}

/** 카드 오른쪽 위 [예시 보기] — 견본 발명(공구 마모 예측)의 같은 칸 */
function ExampleToggle({ open, onToggle, testId }: { open: boolean; onToggle: () => void; testId: string }) {
  return (
    <Button variant={open ? 'secondary' : 'ghost'} size="sm" onClick={onToggle} aria-pressed={open} data-testid={testId}>
      <Lightbulb aria-hidden="true" className="size-4" /> {open ? '예시 닫기' : '예시 보기'}
    </Button>
  )
}

function ExampleLine({ text, testId }: { text: string; testId: string }) {
  return (
    <p className="t-sub break-keep rounded-(--radius-control) border border-dashed border-brand-200 bg-brand-50/60 px-2.5 py-1.5 text-slate-700" data-testid={testId}>
      <b className="font-semibold text-brand-800">예시</b> {text}
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* 1 아이디어                                                            */
/* ------------------------------------------------------------------ */

const IDEA_Q: readonly { key: keyof SpecIdea; label: string; hint: string }[] = [
  { key: 'problem', label: '① 지금 무엇이 문제인가요?', hint: '현장에서 실제로 불편한 것 · 손해 보는 것' },
  { key: 'prior', label: '② 지금은 어떻게 하고, 무엇이 모자란가요?', hint: '기존 방식(사람 · 기존 제품)과 그 한계' },
  { key: 'distinct', label: '③ 우리 방식은 무엇이 다른가요?', hint: '차별 구조 — 무엇을 무엇과 엮어 어떻게 판단하는지' },
  { key: 'flow', label: '④ 처리 흐름', hint: '입력 → 정리 → 판단 → 출력 → 행동 → 다시 반영 (화살표로 적어도 됩니다)' },
  { key: 'point', label: '⑤ 경쟁사가 가장 쉽게 베낄 부분', hint: '권리로 막고 싶은 구조 — 청구항 1의 중심이 됩니다' },
]

const AXIS_HINT = (k: keyof SpecAxis) => `예) ${AXIS_EXAMPLE[k]}`

export function IdeaStep({ d, update, flush, act }: { d: SpecDraft; update: Update; flush: () => void; act: Act }) {
  const [f, setF] = useState({ target: '', judge: '', result: '', kind: '시스템 및 방법' })
  const [ideaEx, setIdeaEx] = useState(false)
  const [axisEx, setAxisEx] = useState(false)
  const titleIssues = checkTitle(d)
  const made = titleFromFormula(f.target, f.judge, f.result, f.kind)
  const axisKeys = Object.keys(AXIS_LABEL) as (keyof SpecAxis)[]
  const fixes = axisKeys.map((k) => ({ k, fixed: axisEndingFix(k, d.axis[k]) })).filter((x): x is { k: keyof SpecAxis; fixed: string } => x.fixed !== null)
  const fixAll = () =>
    act(`권리축 ${fixes.length}줄 끝맺음을 '~하는' 으로 고쳤습니다`, (c) => {
      const axis = { ...c.axis }
      for (const k of axisKeys) axis[k] = axisEndingFix(k, axis[k]) ?? axis[k]
      return { ...c, axis }
    })
  return (
    <div className="flex flex-col gap-3" data-testid="spec-step-idea">
      <Card title="발명의 명칭" hint="'시스템 및 방법' 으로 끝나게 짓습니다. 영문 명칭도 같이 — 특허로에는 한글명칭{영문명칭} 한 줄로 들어갑니다." testId="spec-title-card">
        <label className="flex flex-col gap-1">
          <span className="t-sub font-semibold text-slate-700">한글 명칭</span>
          <input value={d.title} onChange={(e) => update((c) => ({ ...c, title: e.target.value.replace(/\n/g, ' ') }))} onBlur={flush} className={inputCls} placeholder="예) 공구 진동정보 기반 마모상태 판정 및 교체시점 산출 시스템 및 방법" data-testid="spec-title" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="t-sub font-semibold text-slate-700">영문 명칭(대문자)</span>
          <input value={d.titleEn} onChange={(e) => update((c) => ({ ...c, titleEn: e.target.value.replace(/\n/g, ' ') }))} onBlur={flush} className={inputCls} placeholder="SYSTEM AND METHOD FOR …" data-testid="spec-title-en" />
        </label>
        <Issues list={titleIssues.map((t) => ({ id: t.id, level: t.level, step: 'idea' as DraftStep, text: t.text }))} testId="spec-title-issues" />
        <Disclosure title="명칭 만들기 도우미 — [무엇을] 기반 [어떤 판단] 및 [어떤 결과]">
          <div className="flex flex-col gap-2" data-testid="spec-title-helper">
            <div className="grid gap-2 sm:grid-cols-3">
              <input value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} className={inputCls} placeholder="무엇을(예: 공구 진동정보)" aria-label="무엇을" data-testid="spec-tf-target" />
              <input value={f.judge} onChange={(e) => setF({ ...f, judge: e.target.value })} className={inputCls} placeholder="어떤 판단(예: 마모상태 판정)" aria-label="어떤 판단" data-testid="spec-tf-judge" />
              <input value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })} className={inputCls} placeholder="어떤 결과(예: 교체시점 산출)" aria-label="어떤 결과" data-testid="spec-tf-result" />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={`${inputCls} sm:w-56`} aria-label="끝말">
                {['시스템 및 방법', '장치 및 방법', '방법'].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
              <p className="t-sub min-w-0 flex-1 break-keep text-slate-700" data-testid="spec-tf-preview">
                {made || '세 칸을 채우면 여기 명칭이 나옵니다'}
              </p>
              <Button variant="secondary" size="sm" disabled={!f.judge.trim()} onClick={() => update((c) => ({ ...c, title: made }))} data-testid="spec-tf-use">
                이 명칭 쓰기
              </Button>
            </div>
          </div>
        </Disclosure>
      </Card>

      <Card title="아이디어 다섯 가지 질문" hint="짧게 적어도 됩니다. 배경기술 · 과제 · 효과의 뼈대가 여기서 나옵니다." testId="spec-idea-card" aside={<ExampleToggle open={ideaEx} onToggle={() => setIdeaEx((v) => !v)} testId="spec-idea-examples" />}>
        {IDEA_Q.map((q) => {
          const hint = ideaHint(d.idea[q.key])
          return (
            <label key={q.key} className="flex flex-col gap-1">
              <span className="t-sub font-semibold text-slate-800">{q.label}</span>
              <span className="t-meta break-keep text-slate-500">{q.hint}</span>
              {ideaEx && <ExampleLine text={IDEA_EXAMPLE[q.key]} testId={`spec-idea-ex-${q.key}`} />}
              <textarea value={d.idea[q.key]} onChange={(e) => update((c) => ({ ...c, idea: { ...c.idea, [q.key]: e.target.value } }))} onBlur={flush} rows={2} className={areaCls} data-testid={`spec-idea-${q.key}`} />
              {hint && (
                <span className="t-sub break-keep text-warning-800" data-testid={`spec-idea-hint-${q.key}`}>
                  △ {hint}
                </span>
              )}
            </label>
          )
        })}
      </Card>

      <Card title="권리축 일곱 줄" hint="줄마다 '~하는' 으로 끝나게 쓰면 다음 단계에서 구성요소 · 단계 · 청구항 뼈대가 바로 나옵니다. 마지막 줄(연결관계)이 청구항 1의 중심입니다." testId="spec-axis-card" aside={<ExampleToggle open={axisEx} onToggle={() => setAxisEx((v) => !v)} testId="spec-axis-examples" />}>
        {fixes.length > 1 && (
          <div className="flex flex-col gap-2 rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2 sm:flex-row sm:items-center" data-testid="spec-axis-fix-banner">
            <p className="t-sub min-w-0 flex-1 break-keep text-warning-900">'~하는' 으로 끝나지 않는 줄이 {fixes.length}개 있어요. 이대로면 청구항 문장이 어색해집니다.</p>
            <Button variant="secondary" size="sm" className="self-start sm:self-auto" onClick={fixAll} data-testid="spec-axis-fix-all">
              <Wand2 aria-hidden="true" className="size-4" /> 한 번에 고치기
            </Button>
          </div>
        )}
        {axisKeys.map((k) => {
          const fixed = fixes.find((x) => x.k === k)?.fixed ?? null
          return (
            <label key={k} className="flex flex-col gap-1">
              <span className={`t-sub font-semibold ${k === 'link' ? 'text-brand-800' : 'text-slate-800'}`}>{AXIS_LABEL[k]}</span>
              {axisEx && <ExampleLine text={AXIS_EXAMPLE[k]} testId={`spec-axis-ex-${k}`} />}
              <input value={d.axis[k]} onChange={(e) => update((c) => ({ ...c, axis: { ...c.axis, [k]: e.target.value } }))} onBlur={flush} className={inputCls} placeholder={AXIS_HINT(k)} data-testid={`spec-axis-${k}`} />
              {fixed && (
                <span className="flex flex-col gap-1.5 sm:flex-row sm:items-center" data-testid={`spec-axis-fix-${k}`}>
                  <span className="t-sub min-w-0 flex-1 break-keep text-warning-800">
                    △ '~하는' 으로 — <b className="font-semibold text-slate-900">{fixed}</b>
                  </span>
                  <Button variant="ghost" size="sm" className="self-start sm:self-auto" onClick={() => act(`${AXIS_LABEL[k]} 끝맺음을 고쳤습니다`, (c) => ({ ...c, axis: { ...c.axis, [k]: fixed } }))} data-testid={`spec-axis-fix-use-${k}`}>
                    이렇게 고치기
                  </Button>
                </span>
              )}
            </label>
          )
        })}
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 2 구성요소 · 단계                                                       */
/* ------------------------------------------------------------------ */

const nextNo = (nos: string[], base: number, prefix = '') => {
  const nums = nos.map((x) => Number(x.replace(/\D/g, ''))).filter((x) => Number.isFinite(x) && x > 0)
  return `${prefix}${nums.length ? Math.max(...nums) + 10 : base}`
}

export function PartsStep({ d, update, flush, issues, act }: { d: SpecDraft; update: Update; flush: () => void; issues: DraftIssue[]; act: Act }) {
  const axisFilled = (['input', 'process', 'state', 'judge', 'output', 'feedback'] as (keyof SpecAxis)[]).filter((k) => d.axis[k].trim()).length
  const hasParts = d.components.length > 0 || d.steps.length > 0
  const fromAxis = (redo: boolean) => {
    const sk = skeletonFromAxis(d.axis)
    if (redo) act('구성요소 · 단계를 새 뼈대로 바꿨습니다', (c) => ({ ...c, components: sk.components, steps: sk.steps }))
    else update((c) => ({ ...c, components: sk.components, steps: sk.steps }))
  }
  return (
    <div className="flex flex-col gap-3" data-testid="spec-step-parts">
      <Card title="권리축으로 뼈대 만들기" hint={`권리축 ${axisFilled}줄 → 구성요소 110 · 120 … 와 단계 S110 · S120 … 를 만듭니다. 이름은 바꿔도 됩니다(예: 판정부 → 마모판정부).`}>
        {axisFilled === 0 ? (
          <p className="t-sub break-keep text-warning-800">1단계 권리축을 먼저 적어 주세요.</p>
        ) : hasParts ? (
          <InlineConfirm label="권리축으로 다시 만들기" question="지금 구성요소 · 단계를 새 뼈대로 바꿀까요? 고친 이름 · 내용이 사라집니다." confirmLabel="네, 다시 만듭니다" icon={null} onConfirm={() => fromAxis(true)} testId="spec-skeleton-redo" />
        ) : (
          <div>
            <Button variant="primary" onClick={() => fromAxis(false)} data-testid="spec-skeleton">
              권리축으로 뼈대 만들기
            </Button>
          </div>
        )}
      </Card>

      <Card title="구성요소(부호)" hint="100번은 시스템 전체입니다. 구성요소는 110부터 — 청구항에는 '하는 일 + 이름' 으로 들어갑니다." testId="spec-parts-card">
        <label className="flex flex-col gap-1">
          <span className="t-sub font-semibold text-slate-700">100 · 시스템 이름</span>
          <input value={d.systemName} onChange={(e) => update((c) => ({ ...c, systemName: e.target.value }))} onBlur={flush} className={inputCls} placeholder={titleParts(d.title).system || '예) 공구관리 시스템'} data-testid="spec-system-name" />
        </label>
        <ul className="flex flex-col gap-2">
          {d.components.map((c, i) => (
            <li key={i} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-1.5 rounded-(--radius-control) border border-slate-200 p-2 sm:grid-cols-[5rem_minmax(0,11rem)_minmax(0,1fr)_auto] sm:gap-2" data-testid="spec-comp">
              <input value={c.no} onChange={(e) => update((x) => ({ ...x, components: x.components.map((y, j) => (j === i ? { ...y, no: e.target.value } : y)) }))} onBlur={flush} className={inputCls} aria-label="부호" data-testid="spec-comp-no" />
              <input value={c.name} onChange={(e) => update((x) => ({ ...x, components: x.components.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) }))} onBlur={flush} className={inputCls} aria-label="이름" placeholder="이름(…부)" data-testid="spec-comp-name" />
              <Button variant="ghost" size="sm" className="sm:order-2" aria-label={`${c.name || c.no} 지우기`} onClick={() => act(`구성요소 ${c.name.trim() || c.no}(을)를 지웠습니다`, (x) => ({ ...x, components: x.components.filter((_, j) => j !== i) }))} data-testid="spec-comp-remove">
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
              <input value={c.does} onChange={(e) => update((x) => ({ ...x, components: x.components.map((y, j) => (j === i ? { ...y, does: e.target.value } : y)) }))} onBlur={flush} className={`${inputCls} col-span-3 sm:order-1 sm:col-span-1`} aria-label="하는 일" placeholder="하는 일(~하는)" data-testid="spec-comp-does" />
            </li>
          ))}
        </ul>
        <div>
          <Button variant="secondary" size="sm" onClick={() => update((x) => ({ ...x, components: [...x.components, { no: nextNo(x.components.map((c) => c.no), 110), name: '', does: '' }] }))} data-testid="spec-comp-add">
            <Plus aria-hidden="true" className="size-4" /> 구성요소 더하기
          </Button>
        </div>
      </Card>

      <Card title="방법 단계" hint="방법 청구항 · 도 2 순서도가 이 순서를 따릅니다." testId="spec-steps-card">
        <ul className="flex flex-col gap-2">
          {d.steps.map((s, i) => (
            <li key={i} className="grid grid-cols-[minmax(0,6rem)_minmax(0,1fr)_auto] items-center gap-1.5 rounded-(--radius-control) border border-slate-200 p-2 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:gap-2" data-testid="spec-stepline">
              <input value={s.no} onChange={(e) => update((x) => ({ ...x, steps: x.steps.map((y, j) => (j === i ? { ...y, no: e.target.value } : y)) }))} onBlur={flush} className={inputCls} aria-label="단계 번호" />
              <Button variant="ghost" size="sm" className="col-start-3 sm:order-2" aria-label={`${s.no} 지우기`} onClick={() => act(`단계 ${s.no}(을)를 지웠습니다`, (x) => ({ ...x, steps: x.steps.filter((_, j) => j !== i) }))} data-testid="spec-step-remove">
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
              <input value={s.text} onChange={(e) => update((x) => ({ ...x, steps: x.steps.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)) }))} onBlur={flush} className={`${inputCls} col-span-3 sm:order-1 sm:col-span-1`} aria-label="단계 내용" placeholder="~하는" data-testid="spec-step-text" />
            </li>
          ))}
        </ul>
        <div>
          <Button variant="secondary" size="sm" onClick={() => update((x) => ({ ...x, steps: [...x.steps, { no: nextNo(x.steps.map((s) => s.no), 110, 'S'), text: '' }] }))} data-testid="spec-step-add">
            <Plus aria-hidden="true" className="size-4" /> 단계 더하기
          </Button>
        </div>
      </Card>

      <Card title="종속항 씨앗" hint="청구항 2 · 3 … 이 됩니다. 어느 구성요소를 더 자세히 할지 고르고 '~하는' 으로 적습니다." testId="spec-seeds-card">
        <ul className="flex flex-col gap-2">
          {d.seeds.map((s, i) => (
            <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 rounded-(--radius-control) border border-slate-200 p-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:gap-2" data-testid="spec-seed">
              <select value={s.comp} onChange={(e) => update((x) => ({ ...x, seeds: x.seeds.map((y, j) => (j === i ? { ...y, comp: e.target.value } : y)) }))} className={inputCls} aria-label="어느 구성요소">
                <option value="">시스템 전체</option>
                {d.components.filter((c) => c.name.trim()).map((c) => (
                  <option key={c.no} value={c.no}>
                    {c.name}({c.no})
                  </option>
                ))}
              </select>
              <Button variant="ghost" size="sm" className="sm:order-2" aria-label="씨앗 지우기" onClick={() => act('종속항 씨앗을 지웠습니다', (x) => ({ ...x, seeds: x.seeds.filter((_, j) => j !== i) }))} data-testid="spec-seed-remove">
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
              <input value={s.text} onChange={(e) => update((x) => ({ ...x, seeds: x.seeds.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)) }))} onBlur={flush} className={`${inputCls} col-span-2 sm:order-1 sm:col-span-1`} aria-label="종속항 내용" placeholder="예) 마모 단계를 정상 · 주의 · 교체의 세 단계로 나누는" data-testid="spec-seed-text" />
            </li>
          ))}
        </ul>
        <div>
          <Button variant="secondary" size="sm" onClick={() => update((x) => ({ ...x, seeds: [...x.seeds, { comp: '', text: '' }] }))} data-testid="spec-seed-add">
            <Plus aria-hidden="true" className="size-4" /> 종속항 씨앗 더하기
          </Button>
        </div>
      </Card>
      <Issues list={issues} testId="spec-parts-issues" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 3 도면                                                                */
/* ------------------------------------------------------------------ */

export function FiguresStep({ d, update, flush, issues, onError, act }: { d: SpecDraft; update: Update; flush: () => void; issues: DraftIssue[]; onError: (msg: string) => void; act: Act }) {
  const setCount = (n: number) => {
    const fn = (c: SpecDraft) => {
      const preset = defaultFigures(n)
      const figures = preset.map((p, i) => (c.figures[i] ? { ...c.figures[i], n: i + 1 } : p))
      return { ...c, figures, repFig: Math.min(c.repFig, figures.length) }
    }
    // 줄이면 뒤 도면에 적은 글이 사라진다 — 되돌릴 수 있게
    if (n < d.figures.length) act(`도면을 ${n}장으로 줄였습니다`, fn)
    else update(fn)
  }
  return (
    <div className="flex flex-col gap-3" data-testid="spec-step-figures">
      <Card title="도면 몇 장" hint="소프트웨어 특허는 4~5장을 먼저 봅니다 — 1 전체 구성 · 2 처리 흐름 · 3 차별 관계 · 4 출력 · 5 재반영. 장수 채우기용 도면은 넣지 않습니다.">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select value={d.figures.length} onChange={(e) => setCount(Number(e.target.value))} className={`${inputCls} sm:w-40`} aria-label="도면 수" data-testid="spec-fig-count">
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}장
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2">
            <span className="t-sub font-semibold text-slate-700">대표도</span>
            <select value={d.repFig} onChange={(e) => update((c) => ({ ...c, repFig: Number(e.target.value) }))} className={`${inputCls} w-28`} data-testid="spec-rep-fig">
              {d.figures.map((f) => (
                <option key={f.n} value={f.n}>
                  도 {f.n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card title="도면마다 무엇을 보여 주나요?" hint="비워 두면 역할과 구성요소로 정합니다(회색 글씨). '도면의 간단한 설명' 과 본문이 이 말을 같이 씁니다." testId="spec-figs-card">
        <ul className="flex flex-col gap-2">
          {d.figures.map((f, i) => (
            <li key={f.n} className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 p-2" data-testid="spec-fig-row">
              <div className="flex flex-wrap items-center gap-2">
                <b className="t-body w-12 shrink-0 text-slate-900">도 {f.n}</b>
                <select value={f.role} onChange={(e) => update((c) => ({ ...c, figures: c.figures.map((x, j) => (j === i ? { ...x, role: e.target.value as FigRole } : x)) }))} className={`${inputCls} min-w-0 flex-1 sm:max-w-64`} aria-label={`도 ${f.n} 역할`}>
                  {(Object.keys(FIG_ROLE_LABEL) as FigRole[]).map((r) => (
                    <option key={r} value={r}>
                      {FIG_ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <input value={f.kind} onChange={(e) => update((c) => ({ ...c, figures: c.figures.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)) }))} onBlur={flush} className={`${inputCls} w-28`} aria-label={`도 ${f.n} 종류`} />
              </div>
              <input value={f.subject} onChange={(e) => update((c) => ({ ...c, figures: c.figures.map((x, j) => (j === i ? { ...x, subject: e.target.value } : x)) }))} onBlur={flush} className={inputCls} aria-label={`도 ${f.n} 보여 주는 것`} placeholder={figureSubject(d, { ...f, subject: '' })} data-testid="spec-fig-subject" />
            </li>
          ))}
        </ul>
      </Card>

      <Card title="미리 보기" hint="그림은 출발점입니다 — 특허로에 넣기 전에 선 · 글자를 다듬고, 도면마다 그림 1개만 넣습니다." testId="spec-figs-preview">
        <div className="grid gap-4 lg:grid-cols-2">
          <FigurePreview d={d} which={1} onError={onError} />
          <FigurePreview d={d} which={2} onError={onError} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="t-sub font-semibold text-slate-800">도면의 간단한 설명</p>
          <ul className="flex flex-col gap-0.5" data-testid="spec-fig-desc">
            {drawingDescLines(d).map((l) => (
              <li key={l} className="t-sub break-keep text-slate-700">
                {l}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1">
          <p className="t-sub font-semibold text-slate-800">부호의 설명</p>
          <p className="t-sub break-keep text-slate-700" data-testid="spec-signs">
            {signLines(d).join(' · ')}
          </p>
        </div>
      </Card>
      <Issues list={issues} testId="spec-figs-issues" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 4 청구항                                                              */
/* ------------------------------------------------------------------ */

function Suggestion({ text, onUse, onDrop, testId }: { text: string; onUse: () => void; onDrop: () => void; testId: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-(--radius-control) border border-brand-200 bg-brand-50 px-3 py-2" data-testid={testId}>
      <p className="t-sub font-semibold text-brand-900">AI 새 안 — 고치신 글은 그대로 두었습니다</p>
      <Disclosure title="새 안 보기">
        <p className="t-sub whitespace-pre-wrap break-keep text-slate-800">{text}</p>
      </Disclosure>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={onUse} data-testid={`${testId}-use`}>
          이 안으로 바꾸기
        </Button>
        <Button variant="ghost" size="sm" onClick={onDrop} data-testid={`${testId}-drop`}>
          버리기
        </Button>
      </div>
    </div>
  )
}

export function ClaimsStep({ d, update, flush, issues, act }: { d: SpecDraft; update: Update; flush: () => void; issues: DraftIssue[]; act: Act }) {
  const edited = d.claims.some((c) => c.trim())
  const shown = claimsOf(d)
  const sug = d.suggestion.claims
  return (
    <div className="flex flex-col gap-3" data-testid="spec-step-claims">
      <Card
        title={edited ? '청구항(고친 것)' : '청구항 뼈대'}
        hint={edited ? '청구항 1은 시스템 독립항, 마지막은 방법 독립항입니다. 청구항에는 부호를 쓰지 않습니다.' : '권리축 · 구성요소 · 단계 · 종속항 씨앗에서 만든 뼈대입니다. 앞 단계를 고치면 뼈대도 따라 바뀝니다. 문장을 직접 다듬으려면 [고쳐 쓰기].'}
        testId="spec-claims-card"
      >
        {!edited ? (
          <>
            <ol className="flex flex-col gap-2" data-testid="spec-claims-skeleton">
              {shown.map((c, i) => (
                <li key={i} className="flex flex-col gap-0.5 rounded-(--radius-control) border border-slate-200 px-3 py-2">
                  <span className="t-meta font-semibold text-slate-500">청구항 {i + 1}</span>
                  <span className="t-sub break-keep text-slate-800">{c}</span>
                </li>
              ))}
            </ol>
            {shown.length > 0 ? (
              <div>
                <Button variant="secondary" size="sm" onClick={() => update((c) => ({ ...c, claims: claimSkeleton(c) }))} data-testid="spec-claims-edit">
                  고쳐 쓰기
                </Button>
              </div>
            ) : (
              <p className="t-sub text-warning-800">2단계에서 구성요소를 먼저 만들어 주세요.</p>
            )}
          </>
        ) : (
          <>
            <ol className="flex flex-col gap-2">
              {d.claims.map((c, i) => (
                <li key={i} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="t-sub font-semibold text-slate-700">청구항 {i + 1}</span>
                    <Button variant="ghost" size="sm" aria-label={`청구항 ${i + 1} 지우기`} onClick={() => act(`청구항 ${i + 1}을 지웠습니다`, (x) => ({ ...x, claims: x.claims.filter((_, j) => j !== i) }))} data-testid="spec-claim-remove">
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                  <textarea value={c} onChange={(e) => update((x) => ({ ...x, claims: x.claims.map((y, j) => (j === i ? e.target.value : y)) }))} onBlur={flush} rows={4} className={areaCls} data-testid="spec-claim" />
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => update((x) => ({ ...x, claims: [...x.claims, `청구항 1에 있어서, `] }))} data-testid="spec-claim-add">
                <Plus aria-hidden="true" className="size-4" /> 청구항 더하기
              </Button>
              <InlineConfirm label="뼈대로 되돌리기" question="고친 청구항을 지우고 뼈대로 돌아갈까요?" confirmLabel="네, 되돌립니다" icon={null} onConfirm={() => act('청구항을 뼈대로 되돌렸습니다', (c) => ({ ...c, claims: [] }))} testId="spec-claims-reset" />
            </div>
          </>
        )}
        {sug && (
          <Suggestion
            text={sug}
            testId="spec-claims-sug"
            onUse={() =>
              act('청구항을 AI 새 안으로 바꿨습니다', (c) => {
                const list = splitClaims(sug)
                const { claims: _drop, ...rest } = c.suggestion
                return { ...c, claims: list, ai: { ...c.ai, claims: list.join('\n\n') }, suggestion: rest }
              })
            }
            onDrop={() =>
              act('청구항 새 안을 버렸습니다', (c) => {
                const { claims: _drop, ...rest } = c.suggestion
                return { ...c, suggestion: rest }
              })
            }
          />
        )}
      </Card>
      <Issues list={issues} testId="spec-claims-issues" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 5 본문                                                                */
/* ------------------------------------------------------------------ */

const SECTION_HINT: Record<SectionKey, string> = {
  field: '1~2문장 — "본 발명은 … 에 관한 것이다."',
  background: '기존 방식과 그 한계(3~5문단). 특정 회사 · 제품 이름을 지어내지 않습니다.',
  problem: '"… 을 제공하는 것을 목적으로 한다." 로 맺습니다.',
  solution: '청구항을 풀어 씁니다 — 시스템 문단 · 종속항 문단 · 방법 문단.',
  effect: '출력 · 재반영에서 나오는 효과만. 숫자 약속은 하지 않습니다.',
  detail: '도 1 구성 → 구성요소마다 → 도 2 흐름(S번호) → 나머지 도면 → 변형 실시예. 이름(부호)를 그대로.',
  abstract: '400자 이내 한 문단.',
}

const LEN_TEXT = { empty: '아직 비었음', short: '조금 더', ok: '알맞음', long: '긴 편 — 줄여도 됩니다' } as const
const LEN_TONE = { empty: 'bg-slate-300', short: 'bg-warning-500', ok: 'bg-success-600', long: 'bg-warning-500' } as const

/** 본문 칸 권장 길이(대략 · 막지 않음) — 막대 + 권장 범위 */
function LengthMeter({ k, len, skeleton }: { k: SectionKey; len: number; skeleton: boolean }) {
  const [min, max] = SECTION_RANGE[k]
  const st = skeleton ? 'short' : lengthState(k, len)
  const lo = (min / (max * 1.2)) * 100
  const hi = (1 / 1.2) * 100
  return (
    <div className="flex flex-col gap-1" data-testid="spec-section-meter" data-state={skeleton ? 'skeleton' : st}>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <span className="absolute inset-y-0 rounded-full bg-success-100" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
        <span className={`absolute inset-y-0 left-0 rounded-full ${LEN_TONE[st]}`} style={{ width: `${lengthRatio(k, len) * 100}%` }} />
      </div>
      <p className="t-meta flex flex-wrap justify-between gap-x-2 text-slate-500">
        <span>
          권장 {min.toLocaleString()}~{max.toLocaleString()}자(대략)
        </span>
        <span className={st === 'ok' ? 'font-semibold text-success-700' : st === 'empty' ? '' : 'font-semibold text-warning-800'}>
          {skeleton ? '뼈대 그대로 — 고쳐 써 주세요' : `${len.toLocaleString()}자 · ${LEN_TEXT[st]}`}
        </span>
      </p>
    </div>
  )
}

export function BodyStep({ d, update, flush, issues, act }: { d: SpecDraft; update: Update; flush: () => void; issues: DraftIssue[]; act: Act }) {
  return (
    <div className="flex flex-col gap-3" data-testid="spec-step-body">
      {SECTION_KEYS.map((k) => {
        const sk = sectionSkeleton(d, k)
        const cur = d.text[k] ?? ''
        const sug = d.suggestion[k]
        const mine = issues.filter((i) => i.id.endsWith(`_${k}`))
        return (
          <Surface key={k}>
            <section className="flex flex-col gap-2" data-testid="spec-section" data-key={k}>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <h3 className="t-body font-bold break-keep text-slate-900">{SECTION_LABEL[k]}</h3>
                  <p className="t-sub break-keep text-slate-600">{SECTION_HINT[k]}</p>
                </div>
                <span className={`t-meta shrink-0 whitespace-nowrap ${isSkeleton(d, k) ? 'text-warning-800' : 'text-slate-500'}`} data-testid="spec-section-state">
                  {isSkeleton(d, k) ? '뼈대 그대로' : `${cur.trim().length.toLocaleString()}자`}
                </span>
              </div>
              <textarea value={cur} onChange={(e) => update((c) => ({ ...c, text: { ...c.text, [k]: e.target.value } }))} onBlur={flush} rows={k === 'detail' ? 12 : k === 'field' || k === 'abstract' ? 3 : 6} placeholder={sk || '아직 뼈대가 없습니다 — 앞 단계를 채우면 여기 회색 글씨로 나옵니다'} className={areaCls} data-testid="spec-section-text" />
              <LengthMeter k={k} len={cur.trim().length} skeleton={!!cur.trim() && !!sk && cur.trim() === sk.trim()} />
              {!cur.trim() && sk && (
                <div>
                  <Button variant="secondary" size="sm" onClick={() => update((c) => ({ ...c, text: { ...c.text, [k]: sk } }))} data-testid="spec-section-fill">
                    뼈대 넣고 고치기
                  </Button>
                </div>
              )}
              {sug && (
                <Suggestion
                  text={sug}
                  testId={`spec-sug-${k}`}
                  onUse={() =>
                    act(`${SECTION_LABEL[k]}을 AI 새 안으로 바꿨습니다`, (c) => {
                      const { [k]: _drop, ...rest } = c.suggestion
                      return { ...c, text: { ...c.text, [k]: sug }, ai: { ...c.ai, [k]: sug }, suggestion: rest }
                    })
                  }
                  onDrop={() =>
                    act(`${SECTION_LABEL[k]} 새 안을 버렸습니다`, (c) => {
                      const { [k]: _drop, ...rest } = c.suggestion
                      return { ...c, suggestion: rest }
                    })
                  }
                />
              )}
              <Issues list={mine} />
            </section>
          </Surface>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 6 점검 · 내보내기                                                      */
/* ------------------------------------------------------------------ */

const STEP_NAME: Record<DraftStep, string> = { idea: '1 아이디어', parts: '2 구성요소', figures: '3 도면', claims: '4 청구항', body: '5 본문', check: '6 점검' }

export function CheckStep({
  d,
  update,
  report,
  md,
  onGo,
  onDownload,
  onCopy,
  onPack,
  packing,
  checklist,
  venture,
}: {
  d: SpecDraft
  update: Update
  report: SpecReport
  md: string
  onGo: (s: DraftStep) => void
  onDownload: () => void
  onCopy: () => void
  onPack: () => void
  packing: boolean
  checklist: string
  venture: ReactNode
}) {
  const issues = useMemo(() => checkDraft(d), [d])
  const errors = issues.filter((i) => i.level === 'error').length + report.counts.error
  return (
    <div className="flex flex-col gap-3" data-testid="spec-step-check">
      <Card title="내기 전에 볼 것" hint="초안 점검(이 화면 규칙) + 명세서 점검(특허로 서식 규칙)을 같이 돌립니다. 규칙 점검이라 AI 를 쓰지 않습니다." testId="spec-check-card">
        <p className={`t-body font-semibold ${errors ? 'text-danger-700' : 'text-success-700'}`} data-testid="spec-check-summary" data-errors={errors}>
          {errors ? `고쳐야 할 것 ${errors}개` : '고쳐야 할 것 없음'} · 확인할 것 {issues.filter((i) => i.level === 'warn').length + report.counts.warn}개
        </p>
        {issues.length > 0 && (
          <ul className="flex flex-col gap-1.5" data-testid="spec-draft-issues">
            {issues.map((i) => (
              <li key={i.id} className="flex flex-col gap-1 border-b border-slate-100 pb-1.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-3" data-issue={i.id}>
                <p className={`t-sub min-w-0 flex-1 break-keep ${i.level === 'error' ? 'text-danger-700' : i.level === 'warn' ? 'text-warning-800' : 'text-slate-600'}`}>
                  {i.level === 'error' ? '✕' : i.level === 'warn' ? '△' : 'ⓘ'} {i.text}
                </p>
                {i.step !== 'check' && (
                  <Button variant="ghost" size="sm" className="self-start sm:self-auto" onClick={() => onGo(i.step)}>
                    {STEP_NAME[i.step]}로
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {report.findings.filter((f) => f.level !== 'info').length > 0 && (
          <Disclosure title={`명세서 점검(특허로 서식) — 고칠 것 ${report.counts.error} · 확인 ${report.counts.warn}`}>
            <ul className="flex flex-col gap-1.5" data-testid="spec-format-findings">
              {report.findings
                .filter((f) => f.level !== 'info')
                .map((f, i) => (
                  <li key={`${f.id}-${i}`} className="t-sub break-keep text-slate-700" data-finding={f.id}>
                    <b className={f.level === 'error' ? 'text-danger-700' : 'text-warning-800'}>{f.level === 'error' ? '✕' : '△'} {f.title}</b> — {f.fix || f.detail}
                  </li>
                ))}
            </ul>
          </Disclosure>
        )}
      </Card>

      <Card title="특허로 편집기에 붙이기" hint="MD 파일을 내려받아 굵은 제목(식별항목)마다 그 아래 본문만 편집기에 붙여 넣습니다. 맨 위 '입력 주의' 를 먼저 읽어 주세요." testId="spec-export-card">
        <label className="t-sub flex items-center gap-2 text-slate-800">
          <input type="checkbox" checked={d.numbered} onChange={(e) => update((c) => ({ ...c, numbered: e.target.checked }))} className="size-5 shrink-0" data-testid="spec-numbered" />
          문단 번호 [0001] 붙이기
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={onDownload} data-testid="spec-md-download">
            <Download aria-hidden="true" className="size-4" /> MD 내려받기
          </Button>
          <Button variant="secondary" onClick={onCopy} data-testid="spec-md-copy">
            <Copy aria-hidden="true" className="size-4" /> 전체 복사
          </Button>
        </div>
        <div className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2.5" data-testid="spec-pack-card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="t-sub min-w-0 flex-1 break-keep text-slate-700">
              <b className="font-semibold text-slate-900">제출 준비 묶음</b> — 명세서 MD · 도 1 · 도 2 그림 초안(PNG) · 제출 전 확인표를 ZIP 하나로 받습니다. 특허로에서 출원할 때 옆에 펴 두고 쓰세요.
            </p>
            <Button variant="secondary" className="self-start sm:self-auto" onClick={onPack} disabled={packing} data-testid="spec-pack">
              <Package aria-hidden="true" className="size-4" /> {packing ? '묶는 중…' : 'ZIP 받기'}
            </Button>
          </div>
          <Disclosure title="제출 전 확인표 미리 보기">
            <pre className="t-sub max-h-80 overflow-auto whitespace-pre-wrap break-words text-slate-800" data-testid="spec-checklist">
              {checklist}
            </pre>
          </Disclosure>
        </div>
        <Disclosure title="미리 보기">
          <pre className="t-sub max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-(--radius-control) bg-slate-50 p-3 text-slate-800" data-testid="spec-md-preview">
            {md}
          </pre>
        </Disclosure>
        <p className="t-sub break-keep text-slate-500">
          HWPX 로 저장한 뒤 다시 보려면{' '}
          <Link to="/patent-venture/spec-check" className="font-semibold text-brand-700 underline underline-offset-2">
            명세서 점검
          </Link>
          에 올리면 됩니다. 출원(제출)은 대표님이 특허로에서 직접 합니다.
        </p>
      </Card>
      {venture}
    </div>
  )
}
