/**
 * D-246 벤처 사업계획서 쓰기 — 기업인증 › 벤처 안(`?plan=1`).
 *
 *   1 재료(특허 명세서 · AX/MVP · 메모) → 2 요약 → 3 핵심 요약 7 → 4 [1] 문제정의 → 5 [2] 성장전략 → 6 점검 · 내보내기
 *
 * 칸 순서 · 체크박스 · 문장 틀은 실제 신청 사이트와 같다(엔진 certification/core/venturePlan). 칸마다 [복사] 해서 사이트에 붙인다.
 * 저장은 기업인증 벤처 기록(notes)에 칸마다 — 다른 칸 · 대표 답과 섞이지 않게 'vplan:' 이름표.
 * AI 초안은 대표만(VenturePlanAi) — 없어도 이 화면만으로 쓸 수 있다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronDown, Copy, FileUp } from 'lucide-react'
import { Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { downloadText } from '../../components/consulting/studioParts'
import { useOwnerAiAccess } from '../../auth/ownerAiAccess'
import type { CertificationClientContext } from '../core/types'
import {
  VK,
  VPLAN_FIELDS,
  VPLAN_PART_LABEL,
  charCount,
  checkPlan,
  factFill,
  planFactsOf,
  planMarkdown,
  planProgress,
  readPlan,
  type VPlanField,
  type VPlanIssue,
  type VPlanPart,
  type VPlanState,
  type VPlanStatus,
} from '../core/venturePlan'
import { parseSpecFile } from '../../services/patent/specParse'
import { specDigest } from '../../services/patent/specDigest'
import { VenturePlanAi } from './VenturePlanAi'

type Tab = 'mat' | VPlanPart | 'check'
const TABS: readonly { key: Tab; label: string }[] = [
  { key: 'mat', label: '재료' },
  { key: 'summary', label: '요약' },
  { key: 'core', label: '핵심 요약' },
  { key: 'problem', label: '[1] 문제정의' },
  { key: 'growth', label: '[2] 성장전략' },
  { key: 'check', label: '점검 · 내보내기' },
]

export function VenturePlanWorkbench({ ctx, notes, onSave, onBack }: { ctx: CertificationClientContext; notes: Record<string, string>; onSave: (patch: Record<string, string>) => Promise<void>; onBack: () => void }) {
  const { showToast } = useToast()
  const ai = useOwnerAiAccess()
  const [tab, setTab] = useState<Tab>(() => (notes[VK.patent] || notes[VK.ax] ? 'summary' : 'mat'))
  const [aiOpen, setAiOpen] = useState(false)
  const s = useMemo(() => readPlan(notes), [notes])
  const prog = planProgress(s)
  const issues = useMemo(() => checkPlan(s), [s])
  const warnCount = issues.filter((i) => i.level === 'warn').length
  const facts = planFactsOf(ctx, s)
  const coreFilled = VPLAN_FIELDS.filter((f) => f.part === 'core' && (s.text[f.id] ?? '').trim()).length
  const hasMaterial = !!(s.materials.patent.trim() || s.materials.ax.trim())

  /** 저장 — 실패하면 알리고 false(적은 글은 화면에 남는다) */
  const save = async (patch: Record<string, string>): Promise<boolean> => {
    try {
      await onSave(patch)
      return true
    } catch (e) {
      const why = e instanceof Error && e.message ? e.message : '연결을 확인하세요'
      showToast(`저장하지 못했습니다: ${why} — 적은 글은 화면에 있어요. 잠시 뒤 칸을 한 번 더 눌러 주세요.`)
      return false
    }
  }

  const goField = (id: string) => {
    const f = VPLAN_FIELDS.find((x) => x.id === id)
    if (!f) return
    setTab(f.part)
    window.setTimeout(() => document.getElementById(`vplan-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60)
  }

  const fillFacts = async () => {
    const r = factFill(s, facts)
    if (!r.filled.length) {
      showToast('채울 빈 칸이 없습니다 — 이미 적은 칸은 그대로 둡니다')
      return
    }
    if (await save(r.patch)) showToast(`회사 기록으로 ${r.filled.length}칸 채웠습니다: ${r.filled.map((id) => VPLAN_FIELDS.find((f) => f.id === id)?.title ?? id).join(' · ')}`)
  }

  const next = !hasMaterial
    ? { text: '먼저 재료 — 특허 명세서를 올리거나 AX(MVP) 내용을 붙여 넣으면 사업계획서가 특허 · AX 와 한 이야기로 이어집니다', tab: 'mat' as Tab, label: '재료 넣기' }
    : prog.narrativeFilled < prog.narrativeTotal
      ? { text: `서술 칸 ${prog.narrativeTotal - prog.narrativeFilled}개가 비어 있습니다`, tab: (VPLAN_FIELDS.find((f) => f.limit === 1000 && !(s.text[f.id] ?? '').trim())?.part ?? 'problem') as Tab, label: '빈 칸으로' }
      : coreFilled < 7
        ? { text: `핵심 요약 ${7 - coreFilled}칸이 비어 있습니다 — 서술 칸을 한 문장씩 줄인 것`, tab: 'core' as Tab, label: '핵심 요약으로' }
        : warnCount > 0
          ? { text: `내기 전에 고칠 것 ${warnCount}개`, tab: 'check' as Tab, label: '점검 보기' }
          : { text: '다 썼습니다 — 칸마다 [복사] 해서 신청 사이트에 붙이고 [사이트에 넣음] 을 눌러 두세요', tab: 'check' as Tab, label: '점검 · 내보내기' }

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

  return (
    <div className="flex flex-col gap-4" data-testid="vplan" data-complete={prog.complete}>
      <Surface>
        <div className="flex flex-col gap-3">
          <Button variant="ghost" size="sm" className="self-start" onClick={onBack} data-testid="vplan-back">
            <ArrowLeft aria-hidden="true" className="size-4" /> 벤처 진행으로
          </Button>
          <div className="flex flex-col gap-1">
            <h2 className="t-section font-bold break-keep text-slate-900">벤처 사업계획서 쓰기 · 혁신성장유형</h2>
            <p className="t-sub break-keep text-slate-600">신청 사이트와 같은 순서 · 같은 체크박스예요. 칸마다 쓰면 바로 저장되고, [복사] 해서 사이트 칸에 붙여 넣습니다. 제출은 대표님이 사이트에서 직접 합니다.</p>
          </div>
          <p className="t-sub flex flex-wrap gap-x-3 gap-y-1 text-slate-700" data-testid="vplan-progress">
            <span>
              {prog.narrativeFilled === prog.narrativeTotal ? '✓' : '△'} 서술 {prog.narrativeFilled}/{prog.narrativeTotal}
            </span>
            <span>
              {coreFilled === 7 ? '✓' : '△'} 핵심 요약 {coreFilled}/7
            </span>
            <span>
              사이트에 넣음 {prog.entered}/{prog.total}
            </span>
            {warnCount > 0 && <span className="font-semibold text-danger-700">고칠 것 {warnCount}</span>}
          </p>
          <div className="flex flex-col gap-2 rounded-(--radius-control) border border-brand-200 bg-brand-50 px-3 py-2.5 sm:flex-row sm:items-center" data-testid="vplan-next">
            <p className="t-sub min-w-0 flex-1 break-keep text-slate-800">
              <b className="font-semibold">지금 할 것</b> · {next.text}
            </p>
            <Button variant="primary" size="sm" className="self-start sm:self-auto" onClick={() => setTab(next.tab)} data-testid="vplan-next-go">
              {next.label}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void fillFacts()} data-testid="vplan-fact-fill">
              회사 기록으로 채우기
            </Button>
            {ai === 'yes' && (
              <Button variant="secondary" size="sm" onClick={() => setAiOpen((v) => !v)} aria-expanded={aiOpen} data-testid="vplan-ai-open">
                AI 초안 만들기
              </Button>
            )}
          </div>
        </div>
      </Surface>

      {ai === 'yes' && aiOpen && <VenturePlanAi notes={notes} facts={facts} today={ctx.today} hasMaterial={hasMaterial} onSave={onSave} onGoMaterials={() => setTab('mat')} onGoField={goField} onClose={() => setAiOpen(false)} />}

      <div role="tablist" className="grid grid-cols-3 gap-1.5 rounded-(--radius-control) border border-slate-200 bg-slate-50 p-1 sm:grid-cols-6" data-testid="vplan-tabs">
        {TABS.map((t, i) => {
          const fields = t.key === 'mat' || t.key === 'check' ? [] : VPLAN_FIELDS.filter((f) => f.part === t.key)
          const done = fields.filter((f) => (s.text[f.id] ?? '').trim()).length
          const badge = t.key === 'mat' ? (hasMaterial ? '✓' : '') : t.key === 'check' ? (warnCount ? `${warnCount}` : '') : `${done}/${fields.length}`
          return (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`tap t-sub flex min-h-11 flex-col items-center justify-center rounded-[8px] px-1.5 font-semibold break-keep ${tab === t.key ? 'bg-white text-slate-900 shadow-(--shadow-card)' : 'text-slate-600'}`} data-testid={`vplan-tab-${t.key}`}>
              <span>
                {i + 1} {t.label}
              </span>
              {badge && <span className={`t-meta font-normal ${t.key === 'check' ? 'text-danger-700' : 'text-slate-500'}`}>{badge}</span>}
            </button>
          )
        })}
      </div>

      {tab === 'mat' && <MaterialsPanel s={s} save={save} />}
      {tab !== 'mat' && tab !== 'check' && (
        <div className="flex flex-col gap-3" data-testid={`vplan-part-${tab}`}>
          <h3 className="t-body font-bold text-slate-900">{VPLAN_PART_LABEL[tab]}</h3>
          {VPLAN_FIELDS.filter((f) => f.part === tab).map((f) => (
            <FieldCard key={f.id} f={f} s={s} issues={issues.filter((i) => i.field === f.id)} save={save} />
          ))}
        </div>
      )}
      {tab === 'check' && <CheckPanel s={s} issues={issues} companyName={ctx.companyName} today={ctx.today} onGo={goField} />}

      <div className="flex justify-between gap-2">
        {TABS.findIndex((t) => t.key === tab) > 0 ? (
          <Button variant="secondary" onClick={() => setTab(TABS[TABS.findIndex((t) => t.key === tab) - 1].key)} data-testid="vplan-prev">
            ← 이전
          </Button>
        ) : (
          <span />
        )}
        {TABS.findIndex((t) => t.key === tab) < TABS.length - 1 && (
          <Button
            variant="secondary"
            onClick={() => {
              setTab(TABS[TABS.findIndex((t) => t.key === tab) + 1].key)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            data-testid="vplan-next-tab"
          >
            다음 → {TABS[TABS.findIndex((t) => t.key === tab) + 1].label}
          </Button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 글 칸 저장 — 쓰는 동안 1.2초 뒤 · 칸을 떠날 때 · 화면을 떠날 때                      */
/* ------------------------------------------------------------------ */

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function useDraft(value: string, write: (v: string) => Promise<boolean>) {
  const [draft, setDraftState] = useState(value)
  const [state, setState] = useState<SaveState>('idle')
  const dirty = useRef(false)
  const latest = useRef(value)
  const timer = useRef<number | null>(null)
  const writeRef = useRef(write)
  writeRef.current = write
  useEffect(() => {
    if (!dirty.current) {
      latest.current = value
      setDraftState(value)
    }
  }, [value])
  const flush = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    if (!dirty.current) return
    const v = latest.current
    setState('saving')
    void writeRef.current(v).then((ok) => {
      if (ok && latest.current === v) dirty.current = false
      setState(ok ? 'saved' : 'error')
    })
  }
  const flushRef = useRef(flush)
  flushRef.current = flush
  // 탭을 바꾸거나 화면을 떠나도 쓰던 글을 저장한다
  useEffect(() => () => flushRef.current(), [])
  const setDraft = (v: string) => {
    latest.current = v
    dirty.current = true
    setDraftState(v)
    setState('idle')
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => flushRef.current(), 1200)
  }
  return { draft, setDraft, flush, state }
}

const SAVE_LABEL: Record<SaveState, string> = { idle: '', saving: '저장 중…', saved: '저장됨', error: '저장 못 함 — 칸 밖을 눌러 다시' }

/* ------------------------------------------------------------------ */
/* 칸 하나                                                               */
/* ------------------------------------------------------------------ */

function FieldCard({ f, s, issues, save }: { f: VPlanField; s: VPlanState; issues: VPlanIssue[]; save: (patch: Record<string, string>) => Promise<boolean> }) {
  const { showToast } = useToast()
  const value = s.text[f.id] ?? ''
  const d = useDraft(value, (v) => save({ [VK.text(f.id)]: v }))
  const status = s.status[f.id] ?? ''
  const checks = s.checks[f.id] ?? []
  const sug = (s.suggestion[f.id] ?? '').trim()
  const fromAi = !!(s.ai[f.id] ?? '').trim() && (s.ai[f.id] ?? '').trim() === d.draft.trim()
  const n = charCount(d.draft.trim())
  const over = !!f.limit && n > f.limit
  const [sugOpen, setSugOpen] = useState(false)

  const setStatus = (v: VPlanStatus) => void save({ [VK.status(f.id)]: status === v ? '' : v })
  const toggleCheck = (c: string) => {
    const nextChecks = checks.includes(c) ? checks.filter((x) => x !== c) : [...checks, c]
    void save({ [VK.checks(f.id)]: (f.checks ?? []).filter((x) => nextChecks.includes(x)).join('|') })
  }
  const copy = async () => {
    const ok = await navigator.clipboard.writeText(d.draft.trim()).then(() => true).catch(() => false)
    showToast(ok ? `'${f.title}' 복사 — 사이트 칸에 붙인 뒤 [사이트에 넣음] 을 눌러 두세요` : '복사하지 못했습니다 — 글을 직접 골라 복사해 주세요')
  }
  const takeSuggestion = async () => {
    d.setDraft(sug)
    if (await save({ [VK.text(f.id)]: sug, [VK.ai(f.id)]: sug, [VK.suggestion(f.id)]: '', [VK.status(f.id)]: '' })) {
      setSugOpen(false)
      showToast('AI 새 안으로 바꿨습니다')
    }
  }

  return (
    <Surface>
      <div id={`vplan-${f.id}`} className="flex scroll-mt-24 flex-col gap-2.5" data-testid="vplan-field" data-id={f.id} data-status={status} data-over={over}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <h4 className="t-body min-w-0 flex-1 font-bold break-keep text-slate-900">
            <span className="t-meta mr-1.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 font-semibold whitespace-nowrap text-slate-600">{f.no}</span>
            {f.title}
          </h4>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${f.title} 상태`}>
            <button type="button" aria-pressed={status === 'checked'} onClick={() => setStatus('checked')} className={`tap t-meta min-h-9 rounded-full border px-2.5 font-semibold ${status === 'checked' ? 'border-success-300 bg-success-50 text-success-700' : 'border-slate-300 text-slate-600'}`} data-testid="vplan-status-checked">
              {status === 'checked' ? '✓ ' : ''}확인함
            </button>
            <button type="button" aria-pressed={status === 'entered'} onClick={() => setStatus('entered')} className={`tap t-meta min-h-9 rounded-full border px-2.5 font-semibold ${status === 'entered' ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600'}`} data-testid="vplan-status-entered">
              {status === 'entered' ? '✓ ' : ''}사이트에 넣음
            </button>
          </div>
        </div>

        {f.checks && (
          <fieldset className="flex flex-col gap-1" data-testid="vplan-checks">
            <legend className="t-meta mb-1 text-slate-600">사이트 체크박스 — 근거가 있는 것만(여러 개)</legend>
            <div className="flex flex-wrap gap-1.5">
              {f.checks.map((c) => (
                <label key={c} className={`tap t-sub flex min-h-10 cursor-pointer items-center gap-1.5 rounded-(--radius-control) border px-2.5 break-keep ${checks.includes(c) ? 'border-brand-300 bg-brand-50 text-slate-900' : 'border-slate-200 text-slate-700'}`}>
                  <input type="checkbox" className="size-4 shrink-0" checked={checks.includes(c)} onChange={() => toggleCheck(c)} />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {f.kind === 'choice' ? (
          <select value={d.draft} onChange={(e) => { d.setDraft(e.target.value); window.setTimeout(d.flush, 0) }} className="t-body min-h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3" aria-label={f.title} data-testid="vplan-choice">
            <option value="">고르세요</option>
            {(f.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : f.kind === 'line' ? (
          <input value={d.draft} onChange={(e) => d.setDraft(e.target.value)} onBlur={d.flush} inputMode={f.id === 'rnd_expense' ? 'numeric' : undefined} className="t-body min-h-11 w-full rounded-(--radius-control) border border-slate-300 px-3" aria-label={f.title} data-testid="vplan-input" />
        ) : (
          <textarea
            value={d.draft}
            onChange={(e) => d.setDraft(e.target.value)}
            onBlur={d.flush}
            rows={f.limit === 1000 ? 12 : f.kind === 'rows' ? 4 : 4}
            placeholder={f.kind === 'rows' ? f.rowHint : f.template ? '아래 [문장 틀 넣기] 를 누르면 사이트의 빈칸 문장이 들어갑니다' : ''}
            className="t-body w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 leading-relaxed"
            aria-label={f.title}
            data-testid="vplan-text"
          />
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {(f.kind === 'text' || f.limit) && (
            <span className={`t-meta ${over ? 'font-semibold text-danger-700' : 'text-slate-500'}`} data-testid="vplan-count">
              {n.toLocaleString('ko-KR')}
              {f.limit ? ` / ${f.limit.toLocaleString('ko-KR')}자` : '자'}
              {over ? ' — 넘음' : ''}
            </span>
          )}
          {fromAi && status !== 'checked' && status !== 'entered' && <span className="t-meta rounded-full bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">AI 초안 · 읽고 고쳐 주세요</span>}
          {d.state !== 'idle' && <span className={`t-meta ${d.state === 'error' ? 'font-semibold text-danger-700' : 'text-slate-500'}`} data-testid="vplan-save-state">{SAVE_LABEL[d.state]}</span>}
          <span className="flex-1" />
          {f.template && !d.draft.trim() && (
            <Button variant="ghost" size="sm" onClick={() => d.setDraft(f.template!)} data-testid="vplan-template">
              문장 틀 넣기
            </Button>
          )}
          {d.draft.trim() && f.kind !== 'choice' && (
            <Button variant="secondary" size="sm" onClick={() => void copy()} data-testid="vplan-copy">
              <Copy aria-hidden="true" className="size-4" /> 복사
            </Button>
          )}
        </div>
        {f.limitNote && <p className="t-meta break-keep text-slate-500">{f.limitNote}</p>}

        {issues.length > 0 && (
          <ul className="flex flex-col gap-0.5" data-testid="vplan-issues">
            {issues.map((i) => (
              <li key={i.id} className={`t-sub break-keep ${i.level === 'warn' ? 'text-danger-700' : 'text-slate-600'}`} data-testid="vplan-issue" data-id={i.id}>
                {i.level === 'warn' ? '△' : 'ⓘ'} {i.text}
              </li>
            ))}
          </ul>
        )}

        {sug && (
          <div className="flex flex-col gap-2 rounded-(--radius-control) border border-violet-200 bg-violet-50 px-3 py-2" data-testid="vplan-suggestion">
            <div className="flex flex-wrap items-center gap-2">
              <p className="t-sub min-w-0 flex-1 break-keep text-slate-800">AI 새 안이 있습니다 — 고치신 글은 그대로 두었어요.</p>
              <Button variant="ghost" size="sm" onClick={() => setSugOpen((v) => !v)} aria-expanded={sugOpen} data-testid="vplan-suggestion-open">
                {sugOpen ? '접기' : '새 안 보기'}
              </Button>
            </div>
            {sugOpen && (
              <>
                <p className="t-sub max-h-72 overflow-y-auto break-keep whitespace-pre-wrap text-slate-800" data-testid="vplan-suggestion-text">
                  {sug}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" onClick={() => void takeSuggestion()} data-testid="vplan-suggestion-take">
                    이 안으로 바꾸기
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void save({ [VK.suggestion(f.id)]: '' })} data-testid="vplan-suggestion-drop">
                    새 안 버리기
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        <details className="rounded-(--radius-control) border border-slate-200" data-testid="vplan-guide">
          <summary className="tap t-sub inline-flex w-full cursor-pointer list-none items-center gap-1 px-3 py-2 font-semibold text-slate-600 [&::-webkit-details-marker]:hidden">
            <ChevronDown aria-hidden="true" className="size-4" /> 무엇을 쓰나요?
          </summary>
          <div className="flex flex-col gap-1.5 px-3 pb-3">
            {f.template && <p className="t-sub break-keep text-slate-700">사이트 문장 틀 · {f.template}</p>}
            {f.rowHint && <p className="t-sub break-keep text-slate-700">한 줄 · {f.rowHint}</p>}
            <ul className="flex flex-col gap-0.5">
              {f.guide.map((g) => (
                <li key={g} className="t-sub break-keep text-slate-700">
                  · {g}
                </li>
              ))}
            </ul>
            {(f.avoid ?? []).length > 0 && (
              <ul className="flex flex-col gap-0.5">
                {(f.avoid ?? []).map((g) => (
                  <li key={g} className="t-sub break-keep text-danger-700">
                    ✕ {g}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </div>
    </Surface>
  )
}

/* ------------------------------------------------------------------ */
/* 재료                                                                 */
/* ------------------------------------------------------------------ */

function MaterialsPanel({ s, save }: { s: VPlanState; save: (patch: Record<string, string>) => Promise<boolean> }) {
  const { showToast } = useToast()
  const patent = useDraft(s.materials.patent, (v) => save({ [VK.patent]: v }))
  const ax = useDraft(s.materials.ax, (v) => save({ [VK.ax]: v }))
  const memo = useDraft(s.materials.memo, (v) => save({ [VK.memo]: v }))
  const [info, setInfo] = useState('')
  const [undo, setUndo] = useState<{ text: string; file: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const readFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const doc = await parseSpecFile(file.name, new Uint8Array(await file.arrayBuffer()))
      const dg = specDigest(doc)
      if (!dg.text.trim()) {
        showToast('명세서에서 읽을 내용을 찾지 못했습니다 — 특허로 서식(.hwpx) 또는 MD 파일인지 확인해 주세요')
        return
      }
      if (s.materials.patent.trim()) setUndo({ text: s.materials.patent, file: s.materials.patentFile })
      patent.setDraft(dg.text)
      patent.flush()
      await save({ [VK.patentFile]: file.name })
      setInfo(`${dg.title || '명칭 없음'} · 청구항 ${dg.claims.total}개(독립 ${dg.claims.independent}개)`)
      showToast('명세서 요약을 재료로 넣었습니다 — 원문 파일은 저장하지 않습니다')
    } catch {
      showToast('명세서를 읽지 못했습니다 — 파일이 손상되지 않았는지 확인해 주세요')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const area = (label: string, hint: string, d: ReturnType<typeof useDraft>, testid: string, rows: number, placeholder: string) => (
    <div className="flex flex-col gap-1.5">
      <label className="t-body font-bold text-slate-900" htmlFor={testid}>
        {label}
      </label>
      <p className="t-sub break-keep text-slate-600">{hint}</p>
      <textarea id={testid} value={d.draft} onChange={(e) => d.setDraft(e.target.value)} onBlur={d.flush} rows={rows} placeholder={placeholder} className="t-body w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 leading-relaxed" data-testid={testid} />
      <span className="t-meta text-slate-500">
        {charCount(d.draft).toLocaleString('ko-KR')}자{d.state !== 'idle' ? ` · ${SAVE_LABEL[d.state]}` : ''}
      </span>
    </div>
  )

  return (
    <div className="flex flex-col gap-3" data-testid="vplan-part-mat">
      <Surface>
        <div className="flex flex-col gap-3">
          <p className="t-sub break-keep text-slate-700">사업계획서는 <b className="font-semibold">특허(무엇을 발명했나) → AX · MVP(실제로 무엇을 만들었나) → 시장</b> 이 한 이야기여야 심사에서 설득됩니다. 여기 넣은 재료를 보고 칸을 씁니다(AI 초안도 이 재료만 씁니다).</p>
          <div className="flex flex-col gap-1.5">
            <p className="t-body font-bold text-slate-900">1. 특허 명세서</p>
            <p className="t-sub break-keep text-slate-600">특허로 서식 파일(.hwpx) 또는 MD 를 고르면 명칭 · 과제 · 해결 수단 · 효과 · 독립 청구항 · 구성요소만 뽑아 넣습니다. 원문 파일은 저장하지 않아요.</p>
            <input ref={inputRef} id="vplan-spec-file" type="file" accept=".hwpx,.md,.txt,.markdown" className="sr-only" onChange={(e) => void readFile(e.target.files?.[0])} data-testid="vplan-spec-input" />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} data-testid="vplan-spec-pick">
                <FileUp aria-hidden="true" className="size-4" /> 명세서 파일 고르기
              </Button>
              {s.materials.patentFile && <span className="t-sub min-w-0 break-all text-slate-600" data-testid="vplan-spec-file">{s.materials.patentFile}</span>}
              {undo && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    patent.setDraft(undo.text)
                    patent.flush()
                    void save({ [VK.patentFile]: undo.file })
                    setUndo(null)
                    setInfo('')
                  }}
                  data-testid="vplan-spec-undo"
                >
                  앞의 재료로 되돌리기
                </Button>
              )}
            </div>
            {info && <p className="t-sub break-keep font-semibold text-success-700" data-testid="vplan-spec-info">✓ {info}</p>}
          </div>
          {area('특허 재료(고칠 수 있음)', '출원 전이면 "출원 예정", 출원했으면 출원번호를 [1] 7 지식재산권 칸에 넣으세요. 등록 전에는 "등록 · 보유" 라고 쓰지 않습니다.', patent, 'vplan-mat-patent', 8, '[발명의 명칭] …\n[과제의 해결 수단] …')}
        </div>
      </Surface>
      <Surface>
        {area('2. AX · MVP — 실제로 만든 것과 계획', 'AX 분석 · MVP 에서 실제로 구현한 화면 · 기능 · 시험 결과, 그리고 앞으로 만들 것을 나눠서 붙여 넣으세요. 특허의 어느 구성요소가 어느 기능이 되는지 적으면 가장 좋습니다.', ax, 'vplan-mat-ax', 8, '실제로 만든 것: …\n계획: …')}
      </Surface>
      <Surface>
        {area('3. 컨설턴트 메모 — 확인된 숫자와 출처', '시장 규모 · 성장률(출처) · 고객 수 · 매출 · 팀 경력 · 투자/대출 상담 같은 확인된 사실만. 여기 없는 숫자는 쓰지 않습니다.', memo, 'vplan-mat-memo', 6, '예: 거래처 49곳(2026-06, 대표 확인) · 국내 시장 1.2조 원(○○보고서 2025)')}
      </Surface>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 점검 · 내보내기                                                        */
/* ------------------------------------------------------------------ */

function CheckPanel({ s, issues, companyName, today, onGo }: { s: VPlanState; issues: VPlanIssue[]; companyName: string; today: string; onGo: (id: string) => void }) {
  const { showToast } = useToast()
  const prog = planProgress(s)
  const empty = VPLAN_FIELDS.filter((f) => !(s.text[f.id] ?? '').trim())
  const notEntered = VPLAN_FIELDS.filter((f) => (s.text[f.id] ?? '').trim() && s.status[f.id] !== 'entered')
  const md = planMarkdown(s, companyName)
  const warn = issues.filter((i) => i.level === 'warn')
  const info = issues.filter((i) => i.level === 'info')
  const titleOf = (id: string) => {
    const f = VPLAN_FIELDS.find((x) => x.id === id)
    return f ? `${f.no} ${f.title}` : id
  }
  const row = (i: VPlanIssue) => (
    <li key={`${i.field}-${i.id}`} className="flex flex-col gap-1 border-b border-slate-100 py-2 last:border-b-0 sm:flex-row sm:items-center" data-testid="vplan-check-row" data-level={i.level} data-id={i.id}>
      <p className="t-sub min-w-0 flex-1 break-keep text-slate-800">
        <b className="font-semibold">{titleOf(i.field)}</b> · {i.text}
      </p>
      <Button variant="ghost" size="sm" className="self-start sm:self-auto" onClick={() => onGo(i.field)}>
        그 칸으로
      </Button>
    </li>
  )
  return (
    <div className="flex flex-col gap-3" data-testid="vplan-part-check">
      <Surface>
        <div className="flex flex-col gap-2">
          <h3 className="t-body font-bold text-slate-900">내기 전에</h3>
          <p className="t-sub break-keep text-slate-700" data-testid="vplan-check-summary">
            {prog.complete ? '✓ 서술 · 핵심 요약 · 기술명을 모두 썼습니다' : `아직 빈 칸 ${empty.length}개`} · 고칠 것 {warn.length} · 참고 {info.length} · 사이트에 넣음 {prog.entered}/{prog.total}
          </p>
          {warn.length > 0 ? <ul data-testid="vplan-check-warn">{warn.map(row)}</ul> : <p className="t-sub font-semibold text-success-700">✓ 고칠 것 없음(글자 수 · 빈칸 표시 · 특허 출원/등록 말 · 기술명)</p>}
          {info.length > 0 && (
            <details className="rounded-(--radius-control) border border-slate-200">
              <summary className="tap t-sub cursor-pointer px-3 py-2 font-semibold text-slate-600">참고 {info.length}개(체크박스 · 문장 틀)</summary>
              <ul className="px-3 pb-2">{info.map(row)}</ul>
            </details>
          )}
          {empty.length > 0 && (
            <p className="t-sub break-keep text-slate-600" data-testid="vplan-check-empty">
              빈 칸 · {empty.map((f) => f.title).join(' · ')}
            </p>
          )}
          {notEntered.length > 0 && prog.entered > 0 && (
            <p className="t-sub break-keep text-slate-600">
              아직 사이트에 안 넣은 칸 · {notEntered.map((f) => f.title).join(' · ')}
            </p>
          )}
        </div>
      </Surface>
      <Surface>
        <div className="flex flex-col gap-2">
          <h3 className="t-body font-bold text-slate-900">내보내기</h3>
          <p className="t-sub break-keep text-slate-600">대표님 검토용 한 장(사이트 순서 · 체크박스 · 글자 수 · 맨 위에 회사 이름). 사이트에는 칸마다 [복사] 로 붙여 넣습니다.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => downloadText(`venture-plan-${today.replace(/-/g, '')}.md`, md)} data-testid="vplan-md">
              한 장(MD) 내려받기
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void navigator.clipboard.writeText(md).then(() => showToast('전체를 복사했습니다(검토용)')).catch(() => showToast('복사하지 못했습니다'))} data-testid="vplan-copy-all">
              <Copy aria-hidden="true" className="size-4" /> 전체 복사(검토용)
            </Button>
          </div>
        </div>
      </Surface>
    </div>
  )
}
