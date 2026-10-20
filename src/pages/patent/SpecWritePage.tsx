/**
 * D-248 특허 명세서 쓰기 — 메뉴 '특허 · 벤처' › 명세서 쓰기(`/patent-venture/write`).
 *
 *   1 아이디어(명칭 · 다섯 질문 · 권리축 7줄) → 2 구성요소 · 단계(권리축으로 뼈대) → 3 도면(장수 · 역할 · 대표도 · 그림 초안)
 *   → 4 청구항(뼈대 · 고쳐 쓰기) → 5 본문(뼈대 · AI 초안) → 6 점검 · 내보내기(초안 점검 + 명세서 점검 · MD · 벤처 재료로)
 *
 * 규칙은 엔진(services/patent/specDraft) · AI 는 대표만(SpecWriteAi). 저장은 모듈 기록 'patent-draft/draft' 한 줄 = 초안 하나(회사 없이도).
 * 출원(제출)은 대표가 특허로에서 직접 — 이 화면은 붙여 넣을 글을 만든다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, FilePlus2, Import, Sparkles } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Blank, Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { InlineConfirm } from '../../components/ui/InlineConfirm'
import { useToast } from '../../components/ui/toastContext'
import { ClientPickerOptions } from '../../components/ops/ClientPickerOptions'
import { downloadText } from '../../components/consulting/studioParts'
import { useToolClient } from '../../tools/shared/toolClientContext'
import { useModuleBucket, type BucketRow } from '../../tools/shared/useModuleBucket'
import { useOwnerAiAccess } from '../../auth/ownerAiAccess'
import { todayLocalDate } from '../../lib/appClock'
import type { ClientOpsRecord } from '../../types/clientOps'
import { checkDraft, draftProgress, emptyDraft, normalizeDraft, specMarkdown, type DraftStep, type SpecDraft } from '../../services/patent/specDraft'
import { checkSpec } from '../../services/patent/specCheck'
import { parseSpecText } from '../../services/patent/specParse'
import { specDigest } from '../../services/patent/specDigest'
import { useCertData } from '../../certification/integration/useCertData'
import { VK } from '../../certification/core/venturePlan'
import { BodyStep, CheckStep, ClaimsStep, FiguresStep, IdeaStep, PartsStep } from './SpecWriteSteps'
import { IdeaImportPanel, SpecAiPanel } from './SpecWriteAi'

type Row = { draft: SpecDraft } & Record<string, unknown>
const HOME = '/patent-venture'
const WRITE = `${HOME}/write`
const hrefOf = (id: string, clientId: string) => `${WRITE}?draft=${encodeURIComponent(id)}${clientId ? `&client=${encodeURIComponent(clientId)}` : ''}`

/** short — 휴대폰(큰 글자)에서 탭이 세 줄로 늘어나지 않게 */
const TABS: readonly { key: DraftStep; label: string; short: string }[] = [
  { key: 'idea', label: '아이디어', short: '아이디어' },
  { key: 'parts', label: '구성요소 · 단계', short: '구성요소' },
  { key: 'figures', label: '도면', short: '도면' },
  { key: 'claims', label: '청구항', short: '청구항' },
  { key: 'body', label: '본문', short: '본문' },
  { key: 'check', label: '점검 · 내보내기', short: '내보내기' },
]

function useClients(): ClientOpsRecord[] | null {
  const { loadClients } = useToolClient()
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  useEffect(() => {
    let alive = true
    void loadClients().then((l) => alive && setClients(l.filter((c) => c.archivedAt === null)))
    return () => {
      alive = false
    }
  }, [loadClients])
  return clients
}

function ClientSelect({ value, onChange, clients, label, testId }: { value: string; onChange: (id: string) => void; clients: ClientOpsRecord[] | null; label: string; testId: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="t-sub font-semibold text-slate-700">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="tap t-body w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2.5 sm:max-w-md" data-testid={testId}>
        <option value="">회사 고르지 않음</option>
        {clients && <ClientPickerOptions clients={clients.map((c) => ({ id: c.id, companyName: c.companyName, businessNumber: c.businessNumber, corporateNumber: c.corporateNumber }))} />}
      </select>
    </label>
  )
}

/* ------------------------------------------------------------------ */
/* 목록                                                                  */
/* ------------------------------------------------------------------ */

function DraftList({ rows, onNew, onRemove }: { rows: BucketRow<Row>[]; onNew: (clientId: string) => Promise<void>; onRemove: (id: string) => Promise<void> }) {
  const { clientId } = useToolClient()
  const clients = useClients()
  const [pick, setPick] = useState(clientId ?? '')
  const [busy, setBusy] = useState(false)
  const nameOf = (id: string) => clients?.find((c) => c.id === id)?.companyName ?? ''
  const sorted = [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return (
    <div className="flex flex-col gap-4" data-testid="spec-list">
      <Surface showEdge edge="brand">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="t-section font-bold break-keep text-slate-900">새 명세서 쓰기</h2>
            <p className="t-sub break-keep text-slate-600">아이디어 → 구성요소 → 도면 → 청구항 → 본문 순서로 칸을 채우면 특허로 편집기에 붙일 글이 나옵니다. 회사는 나중에 골라도 됩니다(벤처 사업계획서 재료로 보낼 때 필요).</p>
          </div>
          <ClientSelect value={pick} onChange={setPick} clients={clients} label="어느 회사 특허인가요?" testId="spec-new-client" />
          <div>
            <Button
              variant="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await onNew(pick)
                } finally {
                  setBusy(false)
                }
              }}
              data-testid="spec-new"
            >
              <FilePlus2 aria-hidden="true" className="size-4" /> 새 명세서 쓰기
            </Button>
          </div>
        </div>
      </Surface>
      <section className="flex flex-col gap-2">
        <h2 className="t-body font-bold text-slate-900">쓰던 명세서 {rows.length ? `${rows.length}건` : ''}</h2>
        {rows.length === 0 ? (
          <Blank title="아직 쓴 명세서가 없습니다." />
        ) : (
          <ul className="flex flex-col gap-2">
            {sorted.map((r) => {
              const d = normalizeDraft(r.data.draft)
              const p = draftProgress(d)
              return (
                <li key={r.id} className="flex flex-col gap-2 rounded-(--radius-panel) border border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-center" data-testid="spec-row">
                  <Link to={hrefOf(r.id, r.clientId)} className="tap min-w-0 flex-1" data-testid="spec-row-open">
                    <p className="t-body font-semibold break-keep text-slate-900">{d.title.trim() || '(명칭 아직 없음)'}</p>
                    <p className="t-sub break-keep text-slate-600">
                      {nameOf(r.clientId) || '회사 고르지 않음'} · {p.done}/{p.total}단계 · {r.updatedAt.slice(0, 10)}
                    </p>
                  </Link>
                  <InlineConfirm question="이 명세서 초안을 지울까요? 되돌릴 수 없습니다." onConfirm={() => void onRemove(r.id)} testId="spec-row-remove" className="self-end sm:self-auto" />
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 벤처 사업계획서 재료로                                                  */
/* ------------------------------------------------------------------ */

function VentureSend({ title, md }: { title: string; md: string }) {
  const cert = useCertData()
  const { showToast } = useToast()
  const [ask, setAsk] = useState(false)
  const [sent, setSent] = useState(false)
  const digest = useMemo(() => specDigest(parseSpecText(md, 'draft.md')), [md])
  const cur = cert.loaded && cert.clientId ? (cert.workOf('venture').notes[VK.patent] ?? '') : ''
  const send = async () => {
    try {
      await cert.saveWork('venture', { notes: { [VK.patent]: digest.text, [VK.patentFile]: `명세서 쓰기 · ${title.slice(0, 40) || '명칭 없음'}` } })
      setSent(true)
      setAsk(false)
      showToast('벤처 사업계획서 재료(특허)에 넣었습니다')
    } catch (e) {
      showToast(`넣지 못했습니다: ${e instanceof Error ? e.message : '연결을 확인하세요'}`)
    }
  }
  return (
    <div className="flex flex-col gap-2" data-testid="spec-venture">
      <p className="t-sub break-keep text-slate-700">
        <b className="font-semibold">{cert.clientName || '이 회사'}</b> 벤처 사업계획서의 '재료 · 특허 명세서' 칸에 이 명세서 요약(명칭 · 과제 · 해결 수단 · 효과 · 독립 청구항 · 구성요소)을 넣습니다.
      </p>
      {ask ? (
        <div className="flex flex-col gap-2 rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2" role="alertdialog" data-testid="spec-venture-ask">
          <p className="t-sub break-keep font-semibold text-warning-900">사업계획서 재료에 이미 다른 특허 글이 있습니다. 이 명세서로 바꿀까요?</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => void send()} data-testid="spec-venture-yes">
              네, 바꿉니다
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAsk(false)}>
              그만두기
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!cert.loaded || !digest.text.trim()} onClick={() => (cur.trim() && cur !== digest.text ? setAsk(true) : void send())} data-testid="spec-venture-send">
            벤처 사업계획서 재료로 보내기
          </Button>
          {(sent || cur === digest.text) && cert.clientId && (
            <Link to={`${HOME}/plan?client=${encodeURIComponent(cert.clientId)}`} className="tap t-sub inline-flex items-center font-semibold text-brand-700 underline underline-offset-2" data-testid="spec-venture-open">
              사업계획서 쓰기로 →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 편집기                                                                */
/* ------------------------------------------------------------------ */

type SaveState = 'saved' | 'dirty' | 'saving' | 'failed'

function SpecEditor({ row, save, onBack }: { row: BucketRow<Row>; save: (input: { id?: string; clientId?: string; data: Row }) => Promise<BucketRow<Row>>; onBack: () => void }) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const ai = useOwnerAiAccess()
  const { clientId: urlClient, clientName } = useToolClient()
  const clients = useClients()
  const [d, setD] = useState<SpecDraft>(() => normalizeDraft(row.data.draft))
  const [tab, setTab] = useState<DraftStep>(() => (normalizeDraft(row.data.draft).title.trim() ? 'parts' : 'idea'))
  const [state, setState] = useState<SaveState>('saved')
  const [aiOpen, setAiOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const dRef = useRef(d)
  const clientRef = useRef(row.clientId)
  const saveRef = useRef(save)
  saveRef.current = save
  const timer = useRef<number | null>(null)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const today = todayLocalDate()

  /** 저장은 한 줄로 — 늘 그 순간의 가장 최근 초안을 */
  const commit = useCallback(() => {
    chain.current = chain.current.then(async () => {
      const snap = dRef.current
      setState('saving')
      try {
        await saveRef.current({ id: row.id, clientId: clientRef.current, data: { draft: snap } })
        setState(dRef.current === snap ? 'saved' : 'dirty')
      } catch (e) {
        setState('failed')
        showToast(`저장하지 못했습니다: ${e instanceof Error && e.message ? e.message : '연결을 확인하세요'} — 적은 글은 화면에 있어요. 잠시 뒤 다시 저장됩니다.`)
      }
    })
    return chain.current
  }, [row.id, showToast])

  const flush = useCallback(() => {
    if (timer.current === null) return
    window.clearTimeout(timer.current)
    timer.current = null
    void commit()
  }, [commit])

  const update = useCallback(
    (fn: (cur: SpecDraft) => SpecDraft) => {
      const next = fn(dRef.current)
      dRef.current = next
      setD(next)
      setState('dirty')
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        timer.current = null
        void commit()
      }, 900)
    },
    [commit],
  )

  // 떠날 때 못 한 저장은 바로
  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current)
        timer.current = null
        void commit()
      }
    },
    [commit],
  )

  /** AI · 가져오기 — 합친 결과를 바로 저장하고 돌려준다 */
  const apply = useCallback(
    async <T extends { draft: SpecDraft }>(fn: (cur: SpecDraft) => T): Promise<T> => {
      const m = fn(dRef.current)
      dRef.current = m.draft
      setD(m.draft)
      if (timer.current !== null) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
      await commit()
      return m
    },
    [commit],
  )

  const setClient = async (id: string) => {
    clientRef.current = id
    await commit()
    navigate(hrefOf(row.id, id), { replace: true })
  }

  const prog = draftProgress(d)
  const issues = useMemo(() => checkDraft(d), [d])
  const errs = issues.filter((i) => i.level === 'error')
  const mdFull = useMemo(() => (tab === 'check' ? specMarkdown(d) : ''), [d, tab])
  const report = useMemo(() => (tab === 'check' ? checkSpec(parseSpecText(specMarkdown(d, { notice: false }), 'draft.md')) : null), [d, tab])
  const next = !prog.steps.idea
    ? { text: '명칭(한글 · 영문)과 아이디어 질문 셋 이상을 적어 주세요', step: 'idea' as DraftStep, label: '1 아이디어로' }
    : !prog.steps.parts
      ? { text: '권리축으로 구성요소 · 단계 뼈대를 만드세요(단추 하나)', step: 'parts' as DraftStep, label: '2 구성요소로' }
      : !prog.steps.figures
        ? { text: '도면 장수와 대표도를 정하세요', step: 'figures' as DraftStep, label: '3 도면으로' }
        : !prog.steps.claims
          ? { text: '청구항이 2개 이상 되게 — 종속항 씨앗을 하나 더하거나 [고쳐 쓰기]', step: 'claims' as DraftStep, label: '4 청구항으로' }
          : !prog.steps.body
            ? { text: `본문 일곱 칸 중 넷 이상을 고쳐 쓰세요 — [뼈대 넣고 고치기]${ai === 'yes' ? ' 또는 AI 초안' : ''}`, step: 'body' as DraftStep, label: '5 본문으로' }
            : errs.length
              ? { text: `고쳐야 할 것 ${errs.length}개`, step: 'check' as DraftStep, label: '점검 보기' }
              : { text: '다 됐습니다 — MD 를 내려받아 특허로 편집기에 붙이세요', step: 'check' as DraftStep, label: '6 내보내기로' }

  const goStep = (s: DraftStep) => {
    flush()
    setTab(s)
    window.scrollTo({ top: 0 })
  }
  const idx = TABS.findIndex((t) => t.key === tab)
  const stepIssues = (s: DraftStep) => issues.filter((i) => i.step === s)

  const download = () => {
    downloadText(`patent-spec-${today.replace(/-/g, '')}.md`, mdFull || specMarkdown(d))
    showToast('MD 를 내려받았습니다 — 맨 위 입력 주의부터 읽어 주세요')
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mdFull || specMarkdown(d))
      showToast('명세서 전체를 복사했습니다')
    } catch {
      showToast('복사하지 못했습니다 — [MD 내려받기] 를 써 주세요')
    }
  }

  // 단계를 바꿔도 AI 진행이 보이게 — 탭 위에 둔다
  const aiPanel = ai === 'yes' && aiOpen ? <SpecAiPanel d={d} today={today} apply={apply} onClose={() => setAiOpen(false)} /> : null

  return (
    <div className="flex flex-col gap-4" data-testid="spec-editor" data-progress={`${prog.done}/${prog.total}`}>
      <Surface>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => { flush(); onBack() }} data-testid="spec-back-list">
              <ArrowLeft aria-hidden="true" className="size-4" /> 명세서 목록
            </Button>
            <span className={`t-meta ml-auto whitespace-nowrap ${state === 'failed' ? 'text-danger-700' : 'text-slate-500'}`} data-testid="spec-save-state" data-state={state}>
              {state === 'saved' ? '저장됨' : state === 'saving' ? '저장 중…' : state === 'failed' ? '저장 못 함' : '고치는 중'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="t-section font-bold break-keep text-slate-900" data-testid="spec-editor-title">
              {d.title.trim() || '새 명세서'}
            </h2>
            <p className="t-sub break-keep text-slate-600">
              {urlClient ? clientName || '회사' : '회사 고르지 않음'} · {prog.done}/{prog.total}단계{d.source ? ` · ${d.source}` : ''}
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-(--radius-control) border border-brand-200 bg-brand-50 px-3 py-2.5 sm:flex-row sm:items-center" data-testid="spec-next">
            <p className="t-sub min-w-0 flex-1 break-keep text-slate-800">
              <b className="font-semibold">지금 할 것</b> · {next.text}
            </p>
            <Button variant="primary" size="sm" className="self-start sm:self-auto" onClick={() => goStep(next.step)} data-testid="spec-next-go">
              {next.label}
            </Button>
          </div>
          {ai === 'yes' && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setImportOpen((v) => !v)} aria-expanded={importOpen} data-testid="spec-import-open">
                <Import aria-hidden="true" className="size-4" /> AI 작업실에서 가져오기
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setAiOpen(true)
                  goStep('body')
                }}
                data-testid="spec-ai-open"
              >
                <Sparkles aria-hidden="true" className="size-4" /> AI 초안 만들기
              </Button>
            </div>
          )}
        </div>
      </Surface>

      {ai === 'yes' && importOpen && (
        <IdeaImportPanel
          clientId={clientRef.current}
          onClose={() => setImportOpen(false)}
          onPick={(fn, label) => {
            void apply((cur) => ({ draft: fn(cur) })).then(() => {
              setImportOpen(false)
              setTab('idea')
              showToast(`${label ? `'${label}' — ` : ''}빈 칸만 채웠습니다. 이미 적은 칸은 그대로입니다.`)
            })
          }}
        />
      )}

      {aiPanel}

      <div role="tablist" className="grid grid-cols-3 gap-1.5 rounded-(--radius-control) border border-slate-200 bg-slate-50 p-1 sm:grid-cols-6" data-testid="spec-tabs">
        {TABS.map((t, i) => {
          const errN = t.key === 'check' ? errs.length : 0
          return (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => goStep(t.key)} className={`tap t-sub flex min-h-11 flex-col items-center justify-center rounded-[8px] px-1.5 font-semibold break-keep ${tab === t.key ? 'bg-white text-slate-900 shadow-(--shadow-card)' : 'text-slate-600'}`} data-testid={`spec-tab-${t.key}`}>
              <span>
                {i + 1} <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </span>
              <span className={`t-meta font-normal ${errN ? 'text-danger-700' : 'text-slate-500'}`}>{t.key === 'check' ? (errN ? `${errN}` : '') : prog.steps[t.key] ? '✓' : ''}</span>
            </button>
          )
        })}
      </div>

      {tab === 'idea' && <IdeaStep d={d} update={update} flush={flush} />}
      {tab === 'parts' && <PartsStep d={d} update={update} flush={flush} issues={stepIssues('parts')} />}
      {tab === 'figures' && <FiguresStep d={d} update={update} flush={flush} issues={stepIssues('figures')} onError={showToast} />}
      {tab === 'claims' && <ClaimsStep d={d} update={update} flush={flush} issues={stepIssues('claims')} />}
      {tab === 'body' && <BodyStep d={d} update={update} flush={flush} issues={stepIssues('body')} />}
      {tab === 'check' && report && (
        <CheckStep
          d={d}
          update={update}
          report={report}
          md={mdFull}
          onGo={goStep}
          onDownload={download}
          onCopy={() => void copy()}
          venture={
            <Surface>
              <section className="flex flex-col gap-3" data-testid="spec-venture-card">
                <h3 className="t-body font-bold text-slate-900">벤처 사업계획서로 잇기</h3>
                {urlClient ? (
                  <VentureSend title={d.title} md={specMarkdown(d, { notice: false })} />
                ) : (
                  <ClientSelect value="" onChange={(id) => void setClient(id)} clients={clients} label="어느 회사 사업계획서 재료로 보낼까요?" testId="spec-venture-client" />
                )}
              </section>
            </Surface>
          }
        />
      )}

      <div className="flex justify-between gap-2">
        {idx > 0 ? (
          <Button variant="secondary" onClick={() => goStep(TABS[idx - 1].key)} data-testid="spec-prev">
            ← 이전
          </Button>
        ) : (
          <span />
        )}
        {idx < TABS.length - 1 ? (
          <Button variant="primary" onClick={() => goStep(TABS[idx + 1].key)} data-testid="spec-next-step">
            다음 →
          </Button>
        ) : (
          <Button variant="primary" onClick={download}>
            <Download aria-hidden="true" className="size-4" /> MD 내려받기
          </Button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 화면                                                                  */
/* ------------------------------------------------------------------ */

export function SpecWritePage() {
  const bucket = useModuleBucket<Row>('patent-draft', 'draft')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const draftId = params.get('draft')
  const head = <PageHeader title="특허 명세서 쓰기" description="아이디어부터 칸을 채우면 특허로 편집기에 붙일 명세서가 나옵니다. 규칙으로 뼈대를 만들고, AI 초안은 대표만." descriptionAsHint />

  const create = async (clientId: string) => {
    try {
      const r = await bucket.save({ clientId, data: { draft: emptyDraft() } })
      navigate(hrefOf(r.id, clientId))
    } catch (e) {
      showToast(`만들지 못했습니다: ${e instanceof Error ? e.message : '연결을 확인하세요'}`)
    }
  }
  const remove = async (id: string) => {
    try {
      await bucket.remove(id)
      showToast('지웠습니다')
    } catch (e) {
      showToast(`지우지 못했습니다: ${e instanceof Error ? e.message : '연결을 확인하세요'}`)
    }
  }

  let body
  if (bucket.error) {
    body = (
      <div role="alert" className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center" data-testid="spec-load-error">
        <p className="t-sub min-w-0 flex-1 break-keep font-semibold text-amber-900">명세서 기록을 읽지 못했습니다. 저장해 둔 기록은 그대로 있습니다.</p>
        <Button variant="secondary" size="sm" onClick={() => void bucket.reload()}>
          다시 읽기
        </Button>
      </div>
    )
  } else if (!bucket.rows) {
    body = (
      <p className="t-sub text-slate-500" role="status">
        명세서 기록을 읽는 중…
      </p>
    )
  } else if (!draftId) {
    body = <DraftList rows={bucket.rows} onNew={create} onRemove={remove} />
  } else {
    const row = bucket.rows.find((r) => r.id === draftId)
    body = row ? (
      <SpecEditor key={row.id} row={row} save={bucket.save} onBack={() => navigate(WRITE)} />
    ) : (
      <div className="flex flex-col gap-2" data-testid="spec-missing">
        <Blank title="이 명세서를 찾지 못했습니다(지웠거나 다른 작업공간)." />
        <div>
          <Button variant="secondary" onClick={() => navigate(WRITE)}>
            명세서 목록으로
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-5" data-testid="spec-write-page">
      {head}
      {body}
    </div>
  )
}
