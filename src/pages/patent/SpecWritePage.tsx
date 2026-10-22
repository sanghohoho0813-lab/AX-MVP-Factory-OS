/**
 * D-248 특허 명세서 쓰기 — 메뉴 '특허 · 벤처' › 명세서 쓰기(`/patent-venture/write`).
 *
 *   1 아이디어(명칭 · 다섯 질문 · 권리축 7줄) → 2 구성요소 · 단계(권리축으로 뼈대) → 3 도면(장수 · 역할 · 대표도 · 그림 초안)
 *   → 4 청구항(뼈대 · 고쳐 쓰기) → 5 본문(뼈대 · AI 초안) → 6 점검 · 내보내기(초안 점검 + 명세서 점검 · MD · 벤처 재료로)
 *
 * 규칙은 엔진(services/patent/specDraft) · AI 는 대표만(SpecWriteAi). 저장은 모듈 기록 'patent-draft/draft' 한 줄 = 초안 하나(회사 없이도).
 * 출원(제출)은 대표가 특허로에서 직접 — 이 화면은 붙여 넣을 글을 만든다.
 *
 * D-249: ?step= 로 그 단계 바로 열기(진행판 [이어서 하기]) · 견본으로 연습 · 지우기/바꾸기 뒤 [되돌리기] ·
 *   PC 오른쪽 고정판(진행 · 고칠 것 · 저장) · 작은 화면 고정 단계 줄(이전 · n/6 · 다음) · 제출 준비 묶음(ZIP).
 * D-261 대표: "처음 명세서 시작하는데 너무 뭐가 많아 · 타자 치는 거 없애 · 버튼 한 번에 처음부터 끝까지".
 *   대표는 어디서 열어도(?step= 포함) AI 작업판이 먼저 — 타자 칸은 [직접 고치기] 를 눌렀을 때만.
 *   새 명세서 = 회사 고르기(고르면 그 기록으로) + [AI 로 처음부터 끝까지] 한 번 → 만들고 바로 전부 써줘(?auto=1).
 *   D-269 새 명세서 = 회사 · 모델 고르기 + [기획부터 시작] → 아이디어 5개까지만 저절로(?auto=1) — 그다음은 절차마다 단추.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Download, FilePlus2, GraduationCap, Import, Sparkles } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Badge, Blank, Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { InlineConfirm } from '../../components/ui/InlineConfirm'
import { useToast } from '../../components/ui/toastContext'
import { ClientPickerOptions } from '../../components/ops/ClientPickerOptions'
import { downloadText } from '../../components/consulting/studioParts'
import { useToolClient } from '../../tools/shared/toolClientContext'
import { SpecAiBoard } from './SpecAiBoard'
import { ModelPicker } from '../../components/ai/ModelPicker'
import { attachSpecHost } from '../../services/patent/specRun'
import { useModuleBucket, type BucketRow } from '../../tools/shared/useModuleBucket'
import { useOwnerAiAccess } from '../../auth/ownerAiAccess'
import { localDateOf, todayLocalDate } from '../../lib/appClock'
import type { ClientOpsRecord } from '../../types/clientOps'
import { checkDraft, draftProgress, emptyDraft, normalizeDraft, specMarkdown, type DraftStep, type SpecDraft } from '../../services/patent/specDraft'
import { checkSpec } from '../../services/patent/specCheck'
import { parseSpecText } from '../../services/patent/specParse'
import { specDigest } from '../../services/patent/specDigest'
import { useCertData } from '../../certification/integration/useCertData'
import { VK } from '../../certification/core/venturePlan'
import { PV_HOME, specAutoHref, specHref } from '../../services/patent/pvBoard'
import { SAMPLE_SOURCE, sampleDraft, submitChecklist } from '../../services/patent/specCoach'
import { blockSvg, flowSvg } from '../../services/patent/specFigureSvg'
import { zipStore } from '../../services/patent/zip'
import { BodyStep, CheckStep, ClaimsStep, FiguresStep, IdeaStep, PartsStep, type Act } from './SpecWriteSteps'
import { IdeaImportPanel, SpecAiPanel } from './SpecWriteAi'
import { downloadBytes, svgToPngBytes } from './specFigureFile'

type Row = { draft: SpecDraft } & Record<string, unknown>
const HOME = PV_HOME
const WRITE = `${HOME}/write`
const hrefOf = (id: string, clientId: string, step?: DraftStep) => specHref(id, clientId, step)

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

function DraftList({ rows, onNew, onSample, onRemove }: { rows: BucketRow<Row>[]; onNew: (clientId: string) => Promise<void>; onSample: () => Promise<void>; onRemove: (id: string) => Promise<void> }) {
  const { clientId } = useToolClient()
  const clients = useClients()
  const ai = useOwnerAiAccess()
  const [pick, setPick] = useState(clientId ?? '')
  const [busy, setBusy] = useState(false)
  const nameOf = (id: string) => clients?.find((c) => c.id === id)?.companyName ?? ''
  const sorted = [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const go = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-4" data-testid="spec-list">
      {ai === 'yes' ? (
        <Surface showEdge edge="brand">
          <div className="flex flex-col gap-3" data-testid="spec-new-ai">
            <div className="flex flex-col gap-1">
              <h2 className="t-section font-bold break-keep text-slate-900">AI 와 명세서를 기획부터 써요</h2>
              <p className="t-sub break-keep text-slate-600">회사를 고르고 단추를 누르면 아이디어 5개(순위 · 이유)부터 — 고르고 · 구성을 확인하고 · 본문을 쓰는 차례마다 단추로 넘어갑니다. 타자 칠 칸은 없어요.</p>
            </div>
            <ClientSelect value={pick} onChange={setPick} clients={clients} label="어느 회사 특허인가요?" testId="spec-new-client" />
            {/* D-269 모델은 시작하기 전에 — 예전엔 명세서를 만들자마자 쓰기 시작해, 그 뒤에 고른 모델이 적용되지 않았다 */}
            <div className="flex flex-col gap-1">
              <p className="t-meta font-semibold text-slate-700">어느 AI 로 쓸까요? (모든 단계가 이 모델로 · 쓰는 중에 바꾸면 다음 단계부터)</p>
              <ModelPicker testId="spec-new-model" />
            </div>
            <Button variant="primary" className="min-h-12 self-start" disabled={busy} onClick={() => void go(() => onNew(pick))} data-testid="spec-new">
              <Sparkles aria-hidden="true" className="size-5" /> {pick ? `${nameOf(pick) || '이 회사'} 명세서 — 기획부터 시작` : '명세서 기획부터 시작'}
            </Button>
            {!pick && <p className="t-meta break-keep text-slate-500">회사를 고르면 그 회사 기록 · 상담 메모로 아이디어를 냅니다(안 고르면 일반 아이디어).</p>}
            <button type="button" disabled={busy} onClick={() => void go(onSample)} className="tap t-meta self-start font-semibold text-slate-600 underline underline-offset-2" data-testid="spec-sample">
              견본(연습용 발명)으로 둘러보기
            </button>
          </div>
        </Surface>
      ) : (
      <Surface showEdge edge="brand">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="t-section font-bold break-keep text-slate-900">새 명세서 쓰기</h2>
            <p className="t-sub break-keep text-slate-600">아이디어 → 구성요소 → 도면 → 청구항 → 본문 순서로 칸을 채우면 특허로 편집기에 붙일 글이 나옵니다. 회사는 나중에 골라도 됩니다(벤처 사업계획서 재료로 보낼 때 필요).</p>
          </div>
          <ClientSelect value={pick} onChange={setPick} clients={clients} label="어느 회사 특허인가요?" testId="spec-new-client" />
          <div className="flex flex-wrap gap-2">
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
            <Button
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await onSample()
                } finally {
                  setBusy(false)
                }
              }}
              data-testid="spec-sample"
            >
              <GraduationCap aria-hidden="true" className="size-4" /> 견본으로 연습해 보기
            </Button>
          </div>
          <p className="t-meta break-keep text-slate-500">견본은 '공구 마모 예측' 연습용 발명(실제 고객 발명 아님)입니다. 1~4단계가 채워져 있어 무엇을 어떻게 적는지 보면서 5 본문을 직접 써 볼 수 있어요.</p>
        </div>
      </Surface>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="t-body font-bold text-slate-900">쓰던 명세서 {rows.length ? `${rows.length}건` : ''}</h2>
        {rows.length === 0 ? (
          <Blank title="아직 쓴 명세서가 없습니다." />
        ) : (
          <ul className="flex flex-col gap-2">
            {sorted.map((r) => {
              const d = normalizeDraft(r.data.draft)
              const p = draftProgress(d)
              const sample = d.source === SAMPLE_SOURCE
              return (
                <li key={r.id} className="flex flex-col gap-2 rounded-(--radius-panel) border border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-center" data-testid="spec-row" data-sample={sample ? '1' : '0'}>
                  <Link to={hrefOf(r.id, r.clientId)} className="tap flex min-w-0 flex-1 flex-col gap-1" data-testid="spec-row-open">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="t-body min-w-0 font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">{d.title.trim() || '(명칭 아직 없음)'}</span>
                      {sample && <Badge tone="warning">견본 · 연습용</Badge>}
                    </span>
                    <span className="t-sub break-keep text-slate-600">
                      {nameOf(r.clientId) || '회사 고르지 않음'} · {p.done}/{p.total}단계 · {localDateOf(r.updatedAt)}
                    </span>
                    <span className="block h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                      <span className={`block h-full rounded-full ${p.done === p.total ? 'bg-success-600' : 'bg-brand-600'}`} style={{ width: `${Math.round((p.done / p.total) * 100)}%` }} />
                    </span>
                  </Link>
                  <InlineConfirm question="이 명세서 초안을 지울까요? 지운 바로 뒤에는 알림의 [되돌리기]로 살릴 수 있어요." onConfirm={() => void onRemove(r.id)} testId="spec-row-remove" className="self-end sm:self-auto" />
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
const SAVE_TEXT: Record<SaveState, string> = { saved: '저장됨', saving: '저장 중…', failed: '저장 못 함', dirty: '고치는 중' }
type NextHint = { text: string; step: DraftStep; label: string }

/** 작은 화면(PC 넓은 화면 아래) — 내려도 따라오는 단계 줄: 이전 · n/6 · 다음 */
function StepBar({ idx, state, errs, done, onPrev, onNext }: { idx: number; state: SaveState; errs: number; done: number; onPrev: () => void; onNext: () => void }) {
  const t = TABS[idx]
  const last = idx >= TABS.length - 1
  return (
    <div className="sticky top-16 z-20 -mx-4 border-b border-slate-200 bg-slate-50/95 px-4 py-1.5 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 xl:hidden" data-testid="spec-bar" data-step={t.key}>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onPrev} disabled={idx === 0} aria-label="이전 단계" data-testid="spec-bar-prev">
          <ChevronLeft aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">이전</span>
        </Button>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
          <p className="t-sub flex flex-wrap items-baseline justify-center gap-x-1.5 font-semibold text-slate-900" data-testid="spec-bar-title">
            <span className="tabular-nums">
              {idx + 1}/{TABS.length}
            </span>
            <span className="break-keep sm:hidden">{t.short}</span>
            <span className="hidden break-keep sm:inline">{t.label}</span>
          </p>
          <span className="block h-1 w-full max-w-48 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
            <span className="block h-full rounded-full bg-brand-600" style={{ width: `${Math.round((done / TABS.length) * 100)}%` }} />
          </span>
          <p className={`t-meta text-center ${state === 'failed' || errs ? 'text-danger-700' : 'text-slate-500'}`} data-testid="spec-bar-state">
            {SAVE_TEXT[state]}
            {errs ? ` · 고칠 것 ${errs}` : ''}
          </p>
        </div>
        <Button variant={last ? 'secondary' : 'primary'} size="sm" onClick={onNext} disabled={last} aria-label="다음 단계" data-testid="spec-bar-next">
          <span className="hidden sm:inline">다음</span>
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  )
}

/** PC 넓은 화면 — 오른쪽에 붙어 따라오는 판: 진행 · 단계로 가기 · 고칠 것 · 지금 할 것 · 저장 */
function SideRail({ tab, prog, errs, state, next, onGo }: { tab: DraftStep; prog: ReturnType<typeof draftProgress>; errs: { id: string; text: string; step: DraftStep }[]; state: SaveState; next: NextHint; onGo: (s: DraftStep) => void }) {
  return (
    <aside className="hidden xl:block" aria-label="명세서 진행 상황" data-testid="spec-rail">
      <div className="sticky top-20 flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-3 shadow-(--shadow-card)">
        <div className="flex flex-col gap-1.5">
          <p className="t-meta flex items-center justify-between gap-2 font-semibold text-slate-500">
            <span>진행</span>
            <span className={state === 'failed' ? 'text-danger-700' : ''} data-testid="spec-rail-save">
              {SAVE_TEXT[state]}
            </span>
          </p>
          <p className="t-body font-bold text-slate-900 tabular-nums">
            {prog.done}/{prog.total}단계
          </p>
          <span className="block h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <span className={`block h-full rounded-full ${prog.done === prog.total ? 'bg-success-600' : 'bg-brand-600'}`} style={{ width: `${Math.round((prog.done / prog.total) * 100)}%` }} />
          </span>
        </div>
        <ol className="flex flex-col gap-0.5">
          {TABS.map((t, i) => {
            const ok = prog.steps[t.key]
            return (
              <li key={t.key}>
                <button type="button" onClick={() => onGo(t.key)} aria-current={tab === t.key ? 'step' : undefined} className={`tap t-sub flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left ${tab === t.key ? 'bg-brand-50 font-semibold text-brand-800' : 'text-slate-700 hover:bg-slate-50'}`} data-testid={`spec-rail-${t.key}`}>
                  <span className={`t-meta grid size-5 shrink-0 place-items-center rounded-full font-bold ${ok ? 'bg-success-600 text-white' : 'bg-slate-200 text-slate-600'}`} aria-hidden="true">
                    {ok ? <Check className="size-3" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 break-keep">{t.label}</span>
                  <span className="sr-only">{ok ? '다 됨' : '아직'}</span>
                </button>
              </li>
            )
          })}
        </ol>
        {errs.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-slate-100 pt-2" data-testid="spec-rail-errors">
            <p className="t-meta font-semibold text-danger-700">고칠 것 {errs.length}개</p>
            <ul className="flex flex-col gap-0.5">
              {errs.slice(0, 3).map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => onGo(e.step)} className="t-meta w-full break-keep rounded-[6px] px-1 py-1 text-left text-slate-700 hover:bg-slate-50">
                    ✕ {e.text}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-2">
          <p className="t-meta break-keep text-slate-700">
            <b className="font-semibold text-slate-900">지금 할 것</b> · {next.text}
          </p>
          <Button variant="primary" size="sm" onClick={() => onGo(next.step)} data-testid="spec-rail-next">
            {next.label}
          </Button>
        </div>
      </div>
    </aside>
  )
}

const STEP_KEYS = TABS.map((t) => t.key)
const isStep = (x: string | null): x is DraftStep => !!x && (STEP_KEYS as string[]).includes(x)

function SpecEditor({ row, save, onBack, initialStep, others, auto = false, onAutoStarted }: { row: BucketRow<Row>; save: (input: { id?: string; clientId?: string; data: Row }) => Promise<BucketRow<Row>>; onBack: () => void; initialStep: DraftStep | null; others: string[]; auto?: boolean; onAutoStarted?: () => void }) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const ai = useOwnerAiAccess()
  const { clientId: urlClient, clientName, clientRecord } = useToolClient()
  const clients = useClients()
  const [d, setD] = useState<SpecDraft>(() => normalizeDraft(row.data.draft))
  // D-252 대표 계정은 AI 작업판이 먼저. D-261 ?step= 으로 열어도 작업판 먼저(타자 칸 없음) — [직접 고치기] 를 누르면 그 단계 화면
  const [view, setView] = useState<'ai' | 'edit'>('ai')
  const record = (clients ?? []).find((c) => c.id === row.clientId) ?? (clientRecord && clientRecord.id === row.clientId ? clientRecord : null)
  const [tab, setTab] = useState<DraftStep>(() => initialStep ?? (normalizeDraft(row.data.draft).title.trim() ? 'parts' : 'idea'))
  const [packing, setPacking] = useState(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
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

  // D-252 AI 진행(화면 밖)과 잇기 — 이 화면이 열려 있는 동안 받은 답은 바로 저장, 닫혀 있던 사이 받은 답은 열 때 넣는다
  useEffect(
    () =>
      attachSpecHost(row.id, {
        get: () => dRef.current,
        apply: async (p) => {
          await apply((cur) => ({ draft: p(cur) }))
        },
      }),
    [row.id, apply],
  )

  /** 지우기 · 바꾸기 — 바로 저장하고 [되돌리기]. 되돌리면 이 동작이 바꾼 칸만 앞 값으로(그 사이 다른 칸에 적은 글은 그대로) */
  const offerUndo = useCallback(
    (label: string, before: SpecDraft, after: SpecDraft) => {
      const keys = (Object.keys(after) as (keyof SpecDraft)[]).filter((k) => after[k] !== before[k])
      if (!keys.length) {
        showToast(label)
        return
      }
      showToast(label, {
        label: '되돌리기',
        onClick: () => {
          if (!alive.current) {
            showToast('명세서 화면을 떠나서 되돌리지 못했습니다 — 다시 열어 고쳐 주세요')
            return
          }
          update((cur) => {
            const back = { ...cur } as Record<string, unknown>
            for (const k of keys) back[k] = before[k]
            return back as unknown as SpecDraft
          })
          flush()
          showToast('되돌렸습니다')
        },
      })
    },
    [update, flush, showToast],
  )
  const act = useCallback<Act>(
    (label, fn) => {
      const before = dRef.current
      const after = fn(before)
      if (after === before) return
      update(() => after)
      flush()
      offerUndo(label, before, after)
    },
    [update, flush, offerUndo],
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
  const next: NextHint = !prog.steps.idea
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

  const checklist = useMemo(() => (tab === 'check' ? submitChecklist(d, report, today) : ''), [d, report, today, tab])
  const pack = async () => {
    flush()
    setPacking(true)
    try {
      const files: { name: string; data: Uint8Array | string }[] = [{ name: 'spec.md', data: specMarkdown(d) }]
      const figs = [blockSvg(d), flowSvg(d)]
      for (let i = 0; i < figs.length; i += 1) {
        if (figs[i].boxes > 0) files.push({ name: `fig${i + 1}-draft.png`, data: await svgToPngBytes(figs[i].svg, figs[i].height) })
      }
      files.push({ name: 'checklist.txt', data: checklist || submitChecklist(d, report, today) })
      downloadBytes(`patent-pack-${today.replace(/-/g, '')}.zip`, zipStore(files), 'application/zip')
      showToast(`제출 준비 묶음을 받았습니다 — 파일 ${files.length}개(${files.map((f) => f.name).join(' · ')})`)
    } catch (e) {
      showToast(`묶음을 만들지 못했습니다: ${e instanceof Error && e.message ? e.message : '잠시 뒤 다시 해 주세요'} — [MD 내려받기] 는 그대로 됩니다`)
    } finally {
      setPacking(false)
    }
  }

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

  const boardView = ai === 'yes' && view === 'ai'
  const openEdit = (s: DraftStep) => {
    setView('edit')
    goStep(s)
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
          {ai === 'yes' && (
            <div className="flex flex-wrap items-start gap-2">
              <div role="tablist" aria-label="쓰는 방법" className="inline-flex rounded-(--radius-control) border border-slate-200 bg-slate-50 p-1">
                <button type="button" role="tab" aria-selected={view === 'ai'} onClick={() => setView('ai')} className={`tap t-sub inline-flex min-h-10 items-center gap-1.5 rounded-[8px] px-3 font-semibold ${view === 'ai' ? 'bg-white text-violet-900 shadow-(--shadow-card)' : 'text-slate-600'}`} data-testid="spec-view-ai">
                  <Sparkles aria-hidden="true" className="size-4" /> AI 작업판
                </button>
                <button type="button" role="tab" aria-selected={view === 'edit'} onClick={() => setView('edit')} className={`tap t-sub inline-flex min-h-10 items-center gap-1.5 rounded-[8px] px-3 font-semibold ${view === 'edit' ? 'bg-white text-slate-900 shadow-(--shadow-card)' : 'text-slate-600'}`} data-testid="spec-view-edit">
                  직접 고치기
                </button>
              </div>
              {boardView && <ModelPicker className="min-w-0" />}
            </div>
          )}
          {!boardView && (
          <div className="flex flex-col gap-2 rounded-(--radius-control) border border-brand-200 bg-brand-50 px-3 py-2.5 sm:flex-row sm:items-center" data-testid="spec-next">
            <p className="t-sub min-w-0 flex-1 break-keep text-slate-800">
              <b className="font-semibold">지금 할 것</b> · {next.text}
            </p>
            <Button variant="primary" size="sm" className="self-start sm:self-auto" onClick={() => goStep(next.step)} data-testid="spec-next-go">
              {next.label}
            </Button>
          </div>
          )}
          {ai === 'yes' && !boardView && (
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

      {boardView && (
        <SpecAiBoard
          draftId={row.id}
          d={d}
          act={act}
          apply={async (fn) => {
            await apply((cur) => ({ draft: fn(cur) }))
          }}
          record={record}
          others={others}
          today={today}
          onEdit={openEdit}
          onDownload={download}
          onPack={() => void pack()}
          packing={packing}
          autoStart={auto}
          onAutoStarted={onAutoStarted}
          wantClient={row.clientId}
        />
      )}

      {!boardView && ai === 'yes' && importOpen && (
        <IdeaImportPanel
          clientId={clientRef.current}
          onClose={() => setImportOpen(false)}
          onPick={(fn, label) => {
            const before = dRef.current
            void apply((cur) => ({ draft: fn(cur) })).then((m) => {
              setImportOpen(false)
              setTab('idea')
              offerUndo(`${label ? `'${label}' — ` : ''}빈 칸만 채웠습니다. 이미 적은 칸은 그대로입니다.`, before, m.draft)
            })
          }}
        />
      )}

      {!boardView && aiPanel}

      {!boardView && (
      <>
      <StepBar idx={idx} state={state} errs={errs.length} done={prog.done} onPrev={() => idx > 0 && goStep(TABS[idx - 1].key)} onNext={() => idx < TABS.length - 1 && goStep(TABS[idx + 1].key)} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_16.5rem]">
        <div className="flex min-w-0 flex-col gap-4">
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

          {tab === 'idea' && <IdeaStep d={d} update={update} flush={flush} act={act} />}
          {tab === 'parts' && <PartsStep d={d} update={update} flush={flush} issues={stepIssues('parts')} act={act} />}
          {tab === 'figures' && <FiguresStep d={d} update={update} flush={flush} issues={stepIssues('figures')} onError={showToast} act={act} />}
          {tab === 'claims' && <ClaimsStep d={d} update={update} flush={flush} issues={stepIssues('claims')} act={act} />}
          {tab === 'body' && <BodyStep d={d} update={update} flush={flush} issues={stepIssues('body')} act={act} />}
          {tab === 'check' && report && (
            <CheckStep
              d={d}
              update={update}
              report={report}
              md={mdFull}
              onGo={goStep}
              onDownload={download}
              onCopy={() => void copy()}
              onPack={() => void pack()}
              packing={packing}
              checklist={checklist}
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
        <SideRail tab={tab} prog={prog} errs={errs} state={state} next={next} onGo={goStep} />
      </div>
      </>
      )}
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
  const stepParam = params.get('step')
  const auto = params.get('auto') === '1'
  const ai = useOwnerAiAccess()
  // 저절로 쓰기를 시작했으면 주소에서 auto 를 지운다(새로 고쳐도 두 번 시작하지 않게)
  const dropAuto = useCallback(() => {
    const next = new URLSearchParams(window.location.search)
    if (!next.has('auto')) return
    next.delete('auto')
    navigate(`${WRITE}?${next.toString()}`, { replace: true })
  }, [navigate])
  const head = <PageHeader title="특허 명세서 쓰기" description="아이디어부터 칸을 채우면 특허로 편집기에 붙일 명세서가 나옵니다. 규칙으로 뼈대를 만들고, AI 초안은 대표만." descriptionAsHint />

  const create = async (clientId: string) => {
    try {
      const r = await bucket.save({ clientId, data: { draft: emptyDraft() } })
      // D-261 대표(AI)면 열자마자 처음부터 끝까지 — 아니면 예전처럼 빈 명세서
      navigate(ai === 'yes' ? specAutoHref(r.id, clientId) : hrefOf(r.id, clientId))
    } catch (e) {
      showToast(`만들지 못했습니다: ${e instanceof Error ? e.message : '연결을 확인하세요'}`)
    }
  }
  const sample = async () => {
    try {
      const r = await bucket.save({ clientId: '', data: { draft: sampleDraft() } })
      showToast('견본을 열었습니다 — 1~4단계는 채워져 있어요. 단계를 넘기며 보고 5 본문을 직접 써 보세요')
      navigate(hrefOf(r.id, '', 'idea'))
    } catch (e) {
      showToast(`견본을 만들지 못했습니다: ${e instanceof Error ? e.message : '연결을 확인하세요'}`)
    }
  }
  const remove = async (id: string) => {
    const gone = bucket.rows?.find((r) => r.id === id)
    try {
      await bucket.remove(id)
      showToast(
        '명세서 초안을 지웠습니다',
        gone
          ? {
              label: '되돌리기',
              onClick: () =>
                void bucket.save({ id: gone.id, clientId: gone.clientId, data: gone.data }).then(
                  () => showToast('되살렸습니다'),
                  (e: unknown) => showToast(`되살리지 못했습니다: ${e instanceof Error ? e.message : '연결을 확인하세요'}`),
                ),
            }
          : undefined,
      )
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
    body = <DraftList rows={bucket.rows} onNew={create} onSample={sample} onRemove={remove} />
  } else {
    const row = bucket.rows.find((r) => r.id === draftId)
    body = row ? (
      <SpecEditor
        key={row.id}
        row={row}
        save={bucket.save}
        onBack={() => navigate(WRITE)}
        initialStep={isStep(stepParam) ? stepParam : null}
        others={bucket.rows.filter((r) => r.id !== row.id && r.clientId === row.clientId).map((r) => normalizeDraft(r.data.draft).title.trim()).filter(Boolean)}
        auto={auto}
        onAutoStarted={dropAuto}
      />
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
