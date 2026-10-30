/**
 * D-247 특허 · 벤처 — 대표 "어디 있는지 못 찾겠다, 기업인증 밖으로 빼 줘(지금 기능들만)".
 *
 *   /patent-venture             첫 화면 — D-249 진행판(회사마다 명세서 · 사업계획서 · 다음 할 일 하나) + 도구 세 장
 *   /patent-venture/write       특허 명세서 쓰기(D-248 · pages/patent/SpecWritePage)
 *   /patent-venture/plan        벤처 사업계획서 쓰기(?client=) — 기업인증 › 벤처 안 화면과 같은 기록
 *   /patent-venture/spec-check  명세서 점검(특허·MVP 안 화면과 같은 것)
 *
 * 기업인증 › 벤처 안 입구는 그대로 둔다(지운 것 없음). 메뉴 줄은 대표만(moduleRegistry 'patent-venture').
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ChevronRight, FilePen, FileSearch, GraduationCap, PenLine } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Badge, Blank, Surface, type Tone } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/toastContext'
import { ClientPickerOptions } from '../components/ops/ClientPickerOptions'
import { useToolClient } from '../tools/shared/toolClientContext'
import { useModuleBucket } from '../tools/shared/useModuleBucket'
import type { ClientOpsRecord } from '../types/clientOps'
import { useCertData } from '../certification/integration/useCertData'
import { VenturePlanWorkbench } from '../certification/ui/VenturePlanWorkbench'
import { sectionHref } from '../certification/ui/certNav'
import { localDateOf, todayLocalDate } from '../lib/appClock'
import type { SpecDraft } from '../services/patent/specDraft'
import { PV_HOME, planHref, pvBoard, pvSummary, specHref, type PvBoardRow, type PvStage } from '../services/patent/pvBoard'
import { sampleDraft } from '../services/patent/specCoach'
import { liveRows } from '../services/patent/specTrash'

const HOME = PV_HOME

/** 회사 고르기 — 고르고 [사업계획서 쓰기] */
function PlanClientPick({ autoFocus = false }: { autoFocus?: boolean }) {
  const { loadClients, clientId } = useToolClient()
  const navigate = useNavigate()
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  // PV-1 업체에서 열었으면(?client=) 그 회사가 골라진 채로 — 다시 고르지 않게
  const [picked, setPicked] = useState(clientId ?? '')
  useEffect(() => {
    let alive = true
    void loadClients().then((l) => alive && setClients(l.filter((c) => c.archivedAt === null)))
    return () => {
      alive = false
    }
  }, [loadClients])
  if (clients && clients.length === 0) return <Blank title="아직 업체가 없습니다. 고객 관리에서 회사를 먼저 등록해 주세요(우리 회사도 업체로 등록해 쓰면 됩니다)." />
  return (
    <div className="flex flex-col gap-2" data-testid="pv-plan-pick">
      <label className="flex flex-col gap-1">
        <span className="t-sub font-semibold text-slate-700">어느 회사 사업계획서인가요?</span>
        <select
          value={picked}
          autoFocus={autoFocus}
          onChange={(e) => setPicked(e.target.value)}
          className="tap t-body w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2.5 focus:border-brand-500 focus:outline-none sm:max-w-md"
          data-testid="pv-plan-client"
        >
          <option value="">회사 고르기</option>
          {clients && <ClientPickerOptions clients={clients.map((c) => ({ id: c.id, companyName: c.companyName, businessNumber: c.businessNumber, corporateNumber: c.corporateNumber }))} />}
        </select>
      </label>
      <div>
        <Button onClick={() => picked && navigate(planHref(picked))} disabled={!picked} data-testid="pv-plan-open">
          <PenLine aria-hidden="true" className="size-4 shrink-0" /> 사업계획서 쓰기
        </Button>
      </div>
      <p className="t-sub break-keep text-slate-500">목록에 없으면 고객 관리에서 회사를 먼저 등록하세요. 우리 회사 것도 업체로 등록해 두고 쓰면 됩니다.</p>
    </div>
  )
}

/** 큰 카드 한 장 — 무엇을 하는지 · 순서 · 단추 */
function ToolCard({ testId, icon, title, line, steps, children }: { testId: string; icon: ReactNode; title: string; line: string; steps: string[]; children: ReactNode }) {
  return (
    <Surface showEdge edge="brand">
      <section className="flex flex-col gap-3" data-testid={testId}>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700" aria-hidden="true">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="t-section break-keep font-bold text-slate-900">{title}</h2>
            <p className="t-sub break-keep text-slate-600">{line}</p>
          </div>
        </div>
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 t-sub text-slate-600" aria-label="순서">
          {steps.map((s, i) => (
            <li key={s} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-slate-400" />}
              <span className="break-keep">
                <b className="text-slate-800">{i + 1}</b> {s}
              </span>
            </li>
          ))}
        </ol>
        {children}
      </section>
    </Surface>
  )
}

type DraftRow = { draft: SpecDraft } & Record<string, unknown>
type CertWorkRow = { cert?: string; notes?: Record<string, string> } & Record<string, unknown>

const STAGE: Record<PvStage, { label: string; tone: Tone }> = {
  spec: { label: '명세서 쓰는 중', tone: 'brand' },
  'spec-fix': { label: '명세서 고칠 것', tone: 'warning' },
  send: { label: '재료로 보낼 차례', tone: 'brand' },
  plan: { label: '사업계획서 쓰는 중', tone: 'brand' },
  'plan-fix': { label: '사업계획서 고칠 것', tone: 'warning' },
  enter: { label: '사이트에 붙일 차례', tone: 'brand' },
  done: { label: '끝', tone: 'success' },
}

/** 오늘 · 어제 · 10월 3일 */
function whenText(iso: string, today: string): string {
  const d = localDateOf(iso)
  if (!d) return ''
  if (d === today) return '오늘'
  const y = new Date(`${today}T00:00:00`)
  y.setDate(y.getDate() - 1)
  if (d === todayLocalDate(y)) return '어제'
  const [, m, day] = d.split('-')
  return `${Number(m)}월 ${Number(day)}일`
}

const FLOW = [
  { key: 'spec', n: 1, title: '특허 명세서 쓰기', line: '아이디어를 칸에 적으면 구성요소 · 청구항 · 본문 뼈대가 나옵니다' },
  { key: 'check', n: 2, title: '점검 · 내보내기', line: '특허로 서식에 맞는지 보고 MD · 도면 초안 · 확인표 묶음으로 받습니다' },
  { key: 'plan', n: 3, title: '벤처 사업계획서', line: '명세서 요약을 재료로 신청서 칸을 순서대로 채웁니다' },
] as const

/** 처음 쓰는 사람에게 — 세 단계가 어떻게 이어지는지 */
function FlowStrip() {
  return (
    <ol className="grid gap-2 sm:grid-cols-3" data-testid="pv-flow" aria-label="특허 · 벤처 순서">
      {FLOW.map((f, i) => (
        <li key={f.key} className="relative flex min-w-0 items-start gap-2.5 rounded-(--radius-panel) border border-slate-200 bg-white px-3 py-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 t-sub font-bold text-white" aria-hidden="true">
            {f.n}
          </span>
          <span className="min-w-0">
            <span className="t-body block font-semibold break-keep text-slate-900">{f.title}</span>
            <span className="t-sub block break-keep text-slate-600">{f.line}</span>
          </span>
          {i < FLOW.length - 1 && <ChevronRight aria-hidden="true" className="absolute top-1/2 -right-3 z-10 hidden size-4 -translate-y-1/2 text-slate-400 sm:block" />}
        </li>
      ))}
    </ol>
  )
}

/** 줄 안 작은 단계 표시 — ● 명세서 › ● 점검 › ○ 사업계획서 */
function FlowDots({ flow }: { flow: PvBoardRow['flow'] }) {
  const items = [
    { on: flow.spec, label: '명세서' },
    { on: flow.check, label: '점검' },
    { on: flow.plan, label: '사업계획서' },
  ]
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1" aria-label="진행" data-testid="pv-row-flow">
      {items.map((it, i) => (
        <li key={it.label} className="flex items-center gap-1.5" data-done={it.on ? '1' : '0'}>
          {i > 0 && <span aria-hidden="true" className={`h-px w-3 ${it.on ? 'bg-success-500' : 'bg-slate-300'}`} />}
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 t-meta font-semibold ${it.on ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500'}`}>
            {it.on ? <Check aria-hidden="true" className="size-3.5" /> : <span aria-hidden="true" className="size-1.5 rounded-full bg-slate-400" />}
            {it.label}
            <span className="sr-only">{it.on ? ' 다 됨' : ' 아직'}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

function Meter({ value, tone }: { value: number; tone: 'brand' | 'success' | 'warning' }) {
  const bar = tone === 'success' ? 'bg-success-600' : tone === 'warning' ? 'bg-warning-500' : 'bg-brand-600'
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
      <span className={`block h-full rounded-full ${bar}`} style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </span>
  )
}

/** 명세서 · 사업계획서 칸 — 누르면 그 화면 */
function PartLink({ testId, label, text, value, tone, href }: { testId: string; label: string; text: string; value: number | null; tone: 'brand' | 'success' | 'warning'; href: string | null }) {
  const inner = (
    <>
      <span className="flex items-baseline justify-between gap-2">
        <span className="t-meta font-semibold text-slate-500">{label}</span>
        {href && <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 text-slate-400" />}
      </span>
      <span className="t-sub block break-keep text-slate-800 [overflow-wrap:anywhere]">{text}</span>
      {value !== null && <Meter value={value} tone={tone} />}
    </>
  )
  const cls = 'flex min-w-0 flex-col gap-1 rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2'
  return href ? (
    <Link to={href} className={`tap ${cls} hover:border-brand-300 hover:bg-white`} data-testid={testId}>
      {inner}
    </Link>
  ) : (
    <div className={cls} data-testid={testId}>
      {inner}
    </div>
  )
}

function BoardRow({ r, today }: { r: PvBoardRow; today: string }) {
  const st = STAGE[r.stage]
  const spec = r.spec
  const plan = r.plan
  const specText = spec ? `${spec.title || '(명칭 아직 없음)'} · ${spec.done}/${spec.total}단계${spec.errors ? ` · 고칠 것 ${spec.errors}` : ''}${r.specCount > 1 ? ` · 초안 ${r.specCount}건` : ''}` : '아직 없음'
  const planText = plan ? `서술 ${plan.narrative}/${plan.narrativeTotal} · 핵심 요약 ${plan.core}/${plan.coreTotal}${plan.hasPatent ? ' · 특허 재료 있음' : ''}` : r.clientId ? '아직 시작 안 함' : '회사를 고르면 쓸 수 있어요'
  return (
    <li className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-3 sm:p-4" data-testid="pv-row" data-stage={r.stage} data-key={r.key}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="t-body font-bold break-keep text-slate-900 [overflow-wrap:anywhere]" data-testid="pv-row-name">
            {r.companyName}
          </p>
          <p className="t-meta text-slate-500">{whenText(r.updatedAt, today)} 손댐</p>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <FlowDots flow={r.flow} />
      <div className="grid gap-2 sm:grid-cols-2">
        <PartLink testId="pv-row-spec" label="특허 명세서" text={specText} value={spec ? spec.done / spec.total : null} tone={spec?.errors ? 'warning' : spec && spec.done === spec.total ? 'success' : 'brand'} href={spec ? specHref(spec.id, r.clientId) : null} />
        <PartLink testId="pv-row-plan" label="벤처 사업계획서" text={planText} value={plan ? (plan.narrative + plan.core) / Math.max(1, plan.narrativeTotal + plan.coreTotal) : null} tone={plan?.complete ? 'success' : 'brand'} href={r.clientId ? planHref(r.clientId) : null} />
      </div>
      <div className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center">
        <p className="t-sub min-w-0 flex-1 break-keep text-slate-800" data-testid="pv-row-next-text">
          <b className="font-semibold">다음</b> · {r.next.text}
        </p>
        <Link to={r.next.href} className="tap inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-(--radius-control) bg-brand-600 px-3 py-2 t-sub font-semibold text-white hover:bg-brand-700 sm:self-auto" data-testid="pv-row-next">
          {r.next.label} <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </li>
  )
}

const SHOW = 5

/** 진행판 — 회사마다 한 줄, 다음 할 일 하나 */
function Board({ rows, today, onSample, busy }: { rows: PvBoardRow[]; today: string; onSample: () => void; busy: boolean }) {
  const [all, setAll] = useState(false)
  const sum = pvSummary(rows)
  const shown = all ? rows : rows.slice(0, SHOW)
  if (rows.length === 0) {
    return (
      <Surface showEdge edge="brand">
        <section className="flex flex-col gap-4" data-testid="pv-empty">
          <div className="flex flex-col gap-1">
            <h2 className="t-section font-bold break-keep text-slate-900">처음이세요? 이 순서로 갑니다</h2>
            <p className="t-sub break-keep text-slate-600">특허 명세서를 먼저 쓰면, 그 요약이 벤처 사업계획서의 재료가 됩니다. 쓰다 멈춰도 여기서 이어서 할 수 있어요.</p>
          </div>
          <FlowStrip />
          <div className="flex flex-wrap gap-2">
            <Link to={`${HOME}/write`} className="tap inline-flex items-center gap-1.5 rounded-(--radius-control) bg-brand-600 px-4 py-2.5 t-body font-semibold text-white hover:bg-brand-700" data-testid="pv-empty-write">
              <FilePen aria-hidden="true" className="size-4 shrink-0" /> 새 명세서 쓰기
            </Link>
            <Button variant="secondary" onClick={onSample} disabled={busy} data-testid="pv-empty-sample">
              <GraduationCap aria-hidden="true" className="size-4 shrink-0" /> 견본으로 연습해 보기
            </Button>
          </div>
          <p className="t-sub break-keep text-slate-500">견본은 '공구 마모 예측' 연습용 발명입니다(실제 고객 발명 아님). 1~4단계가 채워져 있어 무엇을 어떻게 적는지 보면서 5 본문을 직접 써 볼 수 있어요.</p>
        </section>
      </Surface>
    )
  }
  return (
    <section className="flex flex-col gap-3" data-testid="pv-board">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="t-section font-bold break-keep text-slate-900">이어서 하기</h2>
          <p className="t-sub break-keep text-slate-600">회사마다 지금 어디까지 왔는지와 다음 할 일 하나 — 최근에 손댄 순서</p>
        </div>
        <dl className="flex flex-wrap gap-1.5" data-testid="pv-summary">
          {[
            { k: '진행 중', v: sum.active, id: 'active' },
            { k: '명세서 다 됨', v: sum.specDone, id: 'spec' },
            { k: '사업계획서 다 됨', v: sum.planDone, id: 'plan' },
          ].map((x) => (
            <div key={x.id} className="flex items-baseline gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1" data-testid={`pv-sum-${x.id}`} data-n={x.v}>
              <dt className="t-meta text-slate-500">{x.k}</dt>
              <dd className="t-sub font-bold text-slate-900 tabular-nums">{x.v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <ul className="flex flex-col gap-2.5">
        {shown.map((r) => (
          <BoardRow key={r.key} r={r} today={today} />
        ))}
      </ul>
      {rows.length > SHOW && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setAll((v) => !v)} aria-expanded={all} data-testid="pv-more">
            {all ? '접기' : `나머지 ${rows.length - SHOW}건 더 보기`}
          </Button>
        </div>
      )}
    </section>
  )
}

export function PatentVentureHomePage() {
  const drafts = useModuleBucket<DraftRow>('patent-draft', 'draft')
  const works = useModuleBucket<CertWorkRow>('cert-os', 'work')
  const { loadClients, clientId: urlClient } = useToolClient()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  const [busy, setBusy] = useState(false)
  const today = todayLocalDate()
  useEffect(() => {
    let alive = true
    void loadClients().then(
      (l) => alive && setClients(l.filter((c) => c.archivedAt === null)),
      () => alive && setClients([]),
    )
    return () => {
      alive = false
    }
  }, [loadClients])

  const rows = useMemo(() => {
    if (!drafts.rows || !works.rows || !clients) return null
    return pvBoard({
      drafts: liveRows(drafts.rows).map((r) => ({ id: r.id, clientId: r.clientId, updatedAt: r.updatedAt, draft: r.data.draft })),
      plans: works.rows.filter((r) => r.data.cert === 'venture').map((r) => ({ clientId: r.clientId, updatedAt: r.updatedAt, notes: r.data.notes ?? {} })),
      clients,
    })
  }, [drafts.rows, works.rows, clients])

  const startSample = async () => {
    setBusy(true)
    try {
      const r = await drafts.save({ clientId: '', data: { draft: sampleDraft() } })
      showToast('견본을 열었습니다 — 1~4단계는 채워져 있어요. 단계를 넘기며 보고 5 본문을 직접 써 보세요')
      navigate(specHref(r.id, '', 'idea'))
    } catch (e) {
      showToast(`견본을 만들지 못했습니다: ${e instanceof Error ? e.message : '연결을 확인하세요'}`)
    } finally {
      setBusy(false)
    }
  }

  const loadError = drafts.error || works.error
  return (
    <div className="flex flex-col gap-5" data-testid="pv-home">
      <PageHeader title="특허 · 벤처 — 전체 화면" description="회사별 진행판과 도구 카드 — 대화창의 [자세히]에서 왔어요." descriptionAsHint showOnPhone />
      <div>
        <Link to={urlClient ? `${HOME}?client=${encodeURIComponent(urlClient)}` : HOME} className="tap t-sub inline-flex items-center gap-1.5 rounded-(--radius-control) px-2 py-2 font-semibold text-brand-700 hover:bg-brand-50" data-testid="pv-back-chat">
          <ArrowLeft aria-hidden="true" className="size-4" /> 대화창으로
        </Link>
      </div>
      {loadError ? (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center" data-testid="pv-board-error">
          <p className="t-sub min-w-0 flex-1 break-keep font-semibold text-amber-900">진행 상황을 읽지 못했습니다. 저장해 둔 기록은 그대로 있어요. 아래 도구는 그대로 쓸 수 있습니다.</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void drafts.reload()
              void works.reload()
            }}
          >
            다시 읽기
          </Button>
        </div>
      ) : rows === null ? (
        <p className="t-sub text-slate-500" role="status" data-testid="pv-board-loading">
          진행 상황을 읽는 중…
        </p>
      ) : (
        <Board rows={rows} today={today} onSample={() => void startSample()} busy={busy} />
      )}

      <section className="flex flex-col gap-3" aria-labelledby="pv-tools-title">
        <h2 id="pv-tools-title" className="t-body font-bold text-slate-900">
          새로 시작하기
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <ToolCard
            testId="pv-card-write"
            icon={<FilePen className="size-5" />}
            title="특허 명세서 쓰기"
            line="아이디어 다섯 질문과 권리축 일곱 줄을 적으면 구성요소 · 도면 · 청구항 · 본문 뼈대가 나옵니다. 특허로 편집기에 붙일 MD 와 제출 준비 묶음으로 받습니다."
            steps={['아이디어', '구성요소 · 도면', '청구항 · 본문', '점검 · 내보내기']}
          >
            <div className="flex flex-wrap gap-2">
              <Link to={`${HOME}/write`} className="tap inline-flex items-center gap-1.5 rounded-(--radius-control) bg-brand-600 px-4 py-2.5 t-body font-semibold text-white hover:bg-brand-700" data-testid="pv-write-open">
                <FilePen aria-hidden="true" className="size-4 shrink-0" /> 명세서 쓰기 열기
              </Link>
              {rows !== null && rows.length > 0 && (
                <Button variant="secondary" onClick={() => void startSample()} disabled={busy} data-testid="pv-sample">
                  <GraduationCap aria-hidden="true" className="size-4 shrink-0" /> 견본으로 연습
                </Button>
              )}
            </div>
          </ToolCard>
          <ToolCard
            testId="pv-card-plan"
            icon={<PenLine className="size-5" />}
            title="벤처 사업계획서 쓰기"
            line="벤처 혁신성장유형 신청서 칸 순서 그대로 씁니다. 칸마다 [복사] 해서 신청 사이트에 붙이면 됩니다."
            steps={['재료(특허 명세서 · AX)', '칸 채우기', '점검 · 내려받기']}
          >
            <PlanClientPick />
          </ToolCard>
          <ToolCard
            testId="pv-card-spec"
            icon={<FileSearch className="size-5" />}
            title="특허 명세서 점검"
            line="특허로에 넣기 전에 형식 · 도면 · 청구항이 서로 맞는지 봅니다. 규칙 점검이라 AI 를 쓰지 않습니다."
            steps={['명세서 파일 올리기(HWPX · MD)', '고칠 곳 보기']}
          >
            <div>
              <Link to={`${HOME}/spec-check`} className="tap inline-flex items-center gap-1.5 rounded-(--radius-control) bg-brand-600 px-4 py-2.5 t-body font-semibold text-white hover:bg-brand-700" data-testid="pv-spec-open">
                <FileSearch aria-hidden="true" className="size-4 shrink-0" /> 명세서 점검 열기
              </Link>
            </div>
          </ToolCard>
        </div>
      </section>
      <p className="t-sub break-keep text-slate-500" data-testid="pv-note">
        벤처 확인 받을 수 있는지 · 준비 서류 · 실사 준비는 기업인증 › 벤처기업에 그대로 있습니다. 여기서 쓴 사업계획서는 그 화면의 [사업계획서 쓰기]와 같은 기록입니다.
      </p>
    </div>
  )
}

export function VenturePlanPage() {
  const d = useCertData()
  const navigate = useNavigate()
  const head = <PageHeader title={d.clientName ? `${d.clientName} 벤처 사업계획서` : '벤처 사업계획서'} description="벤처 혁신성장유형 신청서 칸 순서 그대로 — 칸마다 복사해 신청 사이트에 붙입니다" descriptionAsHint />
  if (!d.clientId) {
    return (
      <div className="flex flex-col gap-5">
        {head}
        <Surface>
          <PlanClientPick autoFocus />
        </Surface>
      </div>
    )
  }
  if (!d.ctx || !d.loaded) {
    return (
      <div className="flex flex-col gap-5">
        {head}
        {d.loadError ? (
          <div role="alert" data-testid="pv-plan-load-error" className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center">
            <p className="t-sub min-w-0 flex-1 break-keep font-semibold text-amber-900">사업계획서 기록을 읽지 못했습니다. 저장해 둔 기록은 그대로 있고, 다시 읽기 전에는 바꾸지 않습니다.</p>
            <Button variant="secondary" size="sm" onClick={() => void d.reloadAll()}>
              다시 읽기
            </Button>
          </div>
        ) : (
          <p className="t-sub text-slate-500" role="status">
            회사 기록을 읽는 중…
          </p>
        )}
      </div>
    )
  }
  const work = d.workOf('venture')
  return (
    <div className="flex flex-col gap-5" data-testid="pv-plan-page">
      {head}
      <VenturePlanWorkbench ctx={d.ctx} notes={work.notes} onSave={(patch) => d.saveWork('venture', { notes: patch })} onBack={() => navigate(HOME)} backLabel="특허 · 벤처로" />
      <p className="t-sub break-keep text-slate-500">
        벤처 확인 준비(받을 수 있는지 · 서류 · 실사)는{' '}
        <Link to={sectionHref('venture', d.clientId)} className="font-semibold text-brand-700 underline underline-offset-2" data-testid="pv-plan-cert-link">
          기업인증 › 벤처기업
        </Link>
        에 있습니다.
      </p>
    </div>
  )
}
