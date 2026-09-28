/**
 * 절세 설계 — 원하는 결과로 찾기 (D-130).
 *
 * 흐름은 셋: ① 원하는 것을 적거나 누른다 → ② 이 회사 현황(업체 기록에서 채움 · 고칠 수 있음) → ③ 방법 비교 · 추천 · 근거.
 * 계산은 전부 services/taxPlan.ts — 세금 계산기 9종의 식을 그대로 부른다. 여기는 그리기만.
 * 적는 중인 값은 업체마다 이 브라우저에 남고, [업체 기록에 저장] 을 누르면 업체 기록(주주명부 · 절세 현황)에 들어간다.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BadgeCheck, ChevronDown, ClipboardCopy, ExternalLink, Plus, Printer, Save, Search, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { useToast } from '../ui/toastContext'
import { copyText } from '../consulting/studioParts'
import { useToolClient } from '../../tools/shared/toolClientContext'
import { listClients, saveClient, withToolResult } from '../../services/clientOpsService'
import { generateId } from '../../storage/localStore'
import { formatWon } from '../../services/customerFacts'
import { computeSalary } from '../../services/taxCalc'
import {
  CORP_BAND_OPTIONS,
  CORP_TYPE_OPTIONS,
  GOAL_LABEL,
  PROFILE_FIELDS,
  RELATION_LABEL,
  cashPlan,
  ceoOf,
  cretopStockOf,
  giftPlan,
  holdersFromText,
  holdingsOf,
  inheritancePlan,
  loanPlan,
  parseGoalText,
  planSummary,
  profileSuggestions,
  retirePlan,
  salaryPlan,
  shareValueOf,
  splitPlan,
  viewProfile,
  wonOf,
  type CalcOpen,
  type CashRouteKey,
  type SplitPlan,
  type CashRoute,
  type Proof,
  calcNo,
  checkProof,
  type CheckState,
  type SuccessionResult,
  type GiftMode,
  type GoalKey,
  type ProfileKey,
  type SalaryMode,
  type TaxProfile,
} from '../../services/taxPlan'
import type { ShareholderRelation, ShareholderRow } from '../../types/clientOps'

interface PlanState {
  profile: TaxProfile
  register: ShareholderRow[]
  text: string
  goals: GoalKey[]
  cashTarget: string
  salary: { mode: SalaryMode; rate: string; net: string }
  gift: { recipientId: string; mode: GiftMode; amount: string }
}

const EMPTY: PlanState = {
  profile: {},
  register: [],
  text: '',
  goals: [],
  cashTarget: '',
  salary: { mode: 'rate', rate: '', net: '' },
  gift: { recipientId: '', mode: 'pct', amount: '' },
}

const GOAL_ORDER: GoalKey[] = ['cash', 'salary', 'gift', 'inherit', 'loan', 'retire']
const EXAMPLES = ['1억 현금화하고 싶어', '급여 실효세율 20%로', '세후 월 800만원 받게 급여', '자녀에게 지분 10% 증여', '가업승계 준비', '가지급금 3억 정리', '퇴직금 얼마까지 되나']

const draftKey = (clientId: string | null) => `axmvp.taxplan.${clientId ?? 'none'}`

function readDraft(clientId: string | null): PlanState | null {
  try {
    const raw = localStorage.getItem(draftKey(clientId))
    if (!raw) return null
    const d = JSON.parse(raw) as Partial<PlanState>
    return { ...EMPTY, ...d, salary: { ...EMPTY.salary, ...d.salary }, gift: { ...EMPTY.gift, ...d.gift } }
  } catch {
    return null
  }
}

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const won = (n: number) => (Number.isFinite(n) ? `${Math.round(n).toLocaleString('ko-KR')}원` : '-')
const krw = (n: number) => (Number.isFinite(n) ? formatWon(n) : '-')

/** 긴 글자 단추 — 큰 글자 · 좁은 휴대폰에서 줄을 바꾼다(한 줄에 가두면 화면 밖으로 나간다) */
const wrapBtn = '!h-auto min-h-11 max-w-full !justify-start !whitespace-normal !shrink break-keep py-2 text-left'

const inputCls =
  'mt-1 block min-h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-[0.98rem] text-slate-900 focus:border-brand-500 focus:outline-none'

/* ------------------------------------------------------------------ */

export function TaxPlanner({ onOpenCalc }: { onOpenCalc: (open: CalcOpen) => void }) {
  const { clientId, clientRecord, clientName, workspaceId, replaceClient } = useToolClient()
  const { showToast } = useToast()
  const [st, setSt] = useState<PlanState>(() => readDraft(clientId) ?? EMPTY)
  const [saving, setSaving] = useState(false)
  const hadDraft = useRef(readDraft(clientId) !== null)
  const today = todayIso()

  // 업체 기록을 읽으면 — 적는 중인 것이 없을 때만 — 업체 기록의 주주명부 · 현황으로 시작한다
  const seeded = useRef(false)
  useEffect(() => {
    if (!clientRecord || seeded.current) return
    seeded.current = true
    if (hadDraft.current) return
    setSt((cur) => ({ ...cur, profile: { ...clientRecord.taxProfile }, register: clientRecord.shareholderRegister.map((r) => ({ ...r })) }))
  }, [clientRecord])

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(clientId), JSON.stringify(st))
    } catch {
      /* 저장 못 해도 계산은 된다 */
    }
  }, [st, clientId])

  const setProfile = (k: ProfileKey, v: string) => setSt((cur) => ({ ...cur, profile: { ...cur.profile, [k]: v } }))
  const toggleGoal = (g: GoalKey) => setSt((cur) => ({ ...cur, goals: cur.goals.includes(g) ? cur.goals.filter((x) => x !== g) : [...cur.goals, g] }))

  /* ---- 계산 ---- */
  const p = useMemo(() => viewProfile(st.profile), [st.profile])
  const sv = useMemo(() => shareValueOf(p, st.register), [p, st.register])
  const holdings = useMemo(() => holdingsOf(st.register, sv), [st.register, sv])
  const ceo = ceoOf(st.register)
  const on = (g: GoalKey) => st.goals.includes(g)
  const wantCash = st.goals.includes('cash')
  const wantSalary = st.goals.includes('salary')
  const wantGift = st.goals.includes('gift')
  const wantInherit = st.goals.includes('inherit')
  const wantLoan = st.goals.includes('loan')
  const wantRetire = st.goals.includes('retire')
  const cashTarget = wonOf(st.cashTarget)
  const cash = useMemo(() => (wantCash && cashTarget > 0 ? cashPlan(p, st.register, sv, cashTarget, today) : null), [wantCash, cashTarget, p, st.register, sv, today])
  /* D-133: 여러 해에 나눠 가져오기 — 계산이 무거워(해마다 9종 식을 다시 푼다) 펼쳤을 때만 */
  const [splitOpen, setSplitOpen] = useState(false)
  const split = useMemo(() => (splitOpen && cash ? splitPlan(p, st.register, sv, cashTarget, today) : null), [splitOpen, cash, p, st.register, sv, cashTarget, today])
  const salary = useMemo(
    () => (wantSalary ? salaryPlan(p, { mode: st.salary.mode, ratePct: Number(st.salary.rate) || 0, netMonthly: wonOf(st.salary.net) }) : null),
    [wantSalary, st.salary, p],
  )
  const giftAmount = st.gift.mode === 'pct' || st.gift.mode === 'shares' ? Number(st.gift.amount.replace(/[,%\s주]/g, '')) || 0 : wonOf(st.gift.amount)
  const gift = useMemo(
    () => (wantGift || wantInherit ? giftPlan(p, st.register, sv, { recipientId: st.gift.recipientId, mode: st.gift.mode, amount: giftAmount }) : null),
    [wantGift, wantInherit, st.gift, giftAmount, p, st.register, sv],
  )
  const inherit = useMemo(() => (wantInherit ? inheritancePlan(p, st.register, sv, wantGift ? gift : null) : null), [wantInherit, wantGift, p, st.register, sv, gift])
  const loan = useMemo(() => (wantLoan ? loanPlan(p) : null), [wantLoan, p])
  const retire = useMemo(() => (wantRetire ? retirePlan(p, today) : null), [wantRetire, p, today])

  /* ---- 문장으로 찾기 ---- */
  const [heard, setHeard] = useState<string[]>([])
  const find = () => {
    const g = parseGoalText(st.text)
    if (g.goals.length === 0) {
      setHeard([])
      showToast('알아듣지 못했습니다 — 아래 예시처럼 적거나, 볼 것을 눌러 고르세요.')
      return
    }
    setHeard(g.heard)
    setSt((cur) => {
      const next: PlanState = { ...cur, goals: [...new Set([...cur.goals, ...g.goals])] }
      // 적힌 금액은 사람이 읽는 모양(1억원 · 800만원)으로 칸에 넣는다
      if (g.cash) next.cashTarget = formatWon(g.cash)
      if (g.loan) next.profile = { ...next.profile, loanBalance: formatWon(g.loan) }
      if (g.salary) next.salary = { mode: g.salary.mode, rate: g.salary.ratePct ? String(g.salary.ratePct) : cur.salary.rate, net: g.salary.netMonthly ? formatWon(g.salary.netMonthly) : cur.salary.net }
      if (g.gift) {
        const firstKid = cur.register.find((r) => r.relation === 'child' || r.relation === 'minor_child')
        const amount = !g.gift.amount ? '' : g.gift.mode === 'value' || g.gift.mode === 'budget' ? formatWon(g.gift.amount) : String(g.gift.amount)
        next.gift = { recipientId: cur.gift.recipientId || firstKid?.id || '', mode: g.gift.mode, amount }
      }
      return next
    })
  }

  /* ---- 업체 기록에 저장 ---- */
  const summaryParts = () => {
    const parts: { title: string; lines: string[] }[] = []
    const now: string[] = []
    if (sv.perShare > 0) now.push(`1주당 가치 ${won(sv.perShare)} · 기업가치 ${krw(sv.total)} (${sv.source === 'manual' ? '직접 적음' : '09 비상장주식 식'})`)
    for (const h of holdings) now.push(`${h.row.name}(${RELATION_LABEL[h.row.relation]}) ${h.row.shares.toLocaleString('ko-KR')}주 · ${(h.ratio * 100).toFixed(1)}%${sv.perShare > 0 ? ` · ${krw(h.value)}` : ''}`)
    if (now.length) parts.push({ title: '현황', lines: now })
    if (cash) {
      const lines = cash.routes.map((r) => {
        const tag = r === cash.best ? '[추천] ' : r.unsafe ? '[추천하지 않음] ' : r.key === 'retire' && r.ok ? '[퇴임할 때만] ' : ''
        const burden = r.netBurden < 0 ? `이득 ${krw(-r.netBurden)}` : `순부담 ${krw(r.netBurden)}`
        return `${tag}${r.verify.length > 0 ? '★' : ''}${r.label}: ${r.ok ? `세금 ${krw(r.personalTax)} · 법인세 절감 ${krw(r.corpSaving)} · ${burden}` : `안 됨 — ${r.reason}`}`
      })
      parts.push({ title: `대표가 세후 ${krw(cash.target)} 가져오기`, lines })
    }
    if (split?.best) parts.push({ title: '여러 해에 나눠 가져오면', lines: [...split.rows.map(splitLine), `★ ${split.outside}`] })
    if (salary?.ok && salary.r) parts.push({ title: '급여 맞추기', lines: [`${salary.message}: 월 ${won(salary.monthly)} · 실효부담률 ${(salary.r.effRate * 100).toFixed(1)}% · 세후 월 ${won(salary.r.afterTax / 12)}`] })
    if (gift?.ok && on('gift'))
      parts.push({
        title: '지분 증여',
        lines: [
          ...gift.lines,
          `증여세 ${won(gift.tax)} · 대표 지분 ${gift.ceoAfterPct.toFixed(1)}% · ${gift.recipient} ${gift.recipientAfterPct.toFixed(1)}%`,
          ...(gift.succession && gift.succession.state !== 'no' ? [`★ 가업승계 과세특례 적용 시 증여세 ${won(gift.succession.total)}${gift.succession.state === 'unknown' ? ' (요건 확인 필요)' : ''}`] : []),
        ],
      })
    if (inherit?.ok)
      parts.push({
        title: '상속세 미리 보기',
        lines: [
          `지금 상속되면 상속세 ${krw(inherit.taxNow)}`,
          ...(inherit.withGift ? [`증여 후 10년 안 ${krw(inherit.withGift.within10)} · 10년 뒤 ${krw(inherit.withGift.after10)} (증여세 ${krw(inherit.withGift.giftTax)} 별도)`] : []),
          ...(inherit.familyBiz ? [`★ 가업상속공제 시 ${krw(inherit.familyBiz.tax)}`] : []),
        ],
      })
    if (loan?.ok) parts.push({ title: '가지급금', lines: [`해마다 ${krw(loan.yearLoss)} · 5년 ${krw(loan.fiveYear)} · 10년 ${krw(loan.tenYear)} 손해`] })
    if (retire?.ok) parts.push({ title: '퇴직금', lines: [`한도 ${krw(retire.limit)} · 세금 ${krw(retire.tax)} · 세후 ${krw(retire.net)}`] })
    return parts
  }

  const save = async () => {
    if (!clientId) return
    setSaving(true)
    try {
      const fresh = (await listClients(workspaceId)).find((c) => c.id === clientId)
      if (!fresh) throw new Error('업체를 찾지 못했습니다.')
      const profile = Object.fromEntries(Object.entries(st.profile).filter(([, v]) => typeof v === 'string' && v.trim() !== '')) as Record<string, string>
      let next = { ...fresh, taxProfile: profile, shareholderRegister: st.register }
      const parts = summaryParts()
      if (parts.length > 0) {
        next = withToolResult(next, {
          toolKey: 'tax',
          title: '절세 설계 — 원하는 결과로 찾기',
          verdict: null,
          verdictLabel: cash?.best ? `추천 ${cash.best.label}` : st.goals.map((g) => GOAL_LABEL[g]).join(' · '),
          summary: planSummary(parts),
          data: { plan: true, goals: st.goals },
        })
      }
      const saved = await saveClient(next)
      replaceClient(saved)
      showToast(`${saved.companyName} 기록에 주주명부 · 절세 현황${parts.length > 0 ? ' · 결과' : ''}를 저장했습니다.`)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다 — 적은 것은 이 브라우저에 남아 있습니다.')
    } finally {
      setSaving(false)
    }
  }

  const copy = async () => {
    const ok = await copyText(planSummary(summaryParts()))
    showToast(ok ? '요약을 복사했습니다.' : '복사하지 못했습니다.')
  }

  /* ---- D-131: 결과를 정확히 하려면 필요한데 비어 있는 값 ---- */
  const needsFor = (g: GoalKey): NeedItem[] => {
    const out: NeedItem[] = []
    const add = (key: string, label: string) => {
      if (!out.some((x) => x.key === key)) out.push({ key, label })
    }
    const noCeo = !ceo || ceo.shares <= 0
    const noValue = !(sv.perShare > 0)
    if (g === 'cash') {
      if (!p.monthlySalary) add('monthlySalary', '대표 월 급여')
      if (noCeo) add('holders', '주주명부(대표 주식 수)')
      if (noValue) add('value', '주식가치 재료(자산 · 순이익)')
      if (!p.retainedEarnings) add('retainedEarnings', '배당 가능한 이익')
      if (!p.ceoStartDate) add('ceoStartDate', '대표 취임일')
      if (ceo && !ceo.acquirePrice && !p.par) add('par', '1주 액면가')
    }
    if (g === 'salary' && !p.monthlySalary) add('monthlySalary', '대표 월 급여(지금과 비교)')
    if (g === 'gift') {
      if (noCeo) add('holders', '주주명부(대표 주식 수)')
      if (noValue) add('value', '주식가치 재료(자산 · 순이익)')
      const who = st.register.find((r) => r.id === st.gift.recipientId)
      if (who && (who.relation === 'child' || who.relation === 'minor_child')) {
        if (p.ceoAge === null) add('ceoAge', '대표 나이(특례 요건)')
        if (p.bizYears === null) add('bizYears', '경영한 햇수(특례 요건)')
        if (!p.bizAssetRatioGiven) add('bizAssetRatio', '가업자산 비율')
      }
    }
    if (g === 'inherit') {
      if (!p.estateRealEstate && !p.estateFinancial) add('estateRealEstate', '대표 부동산 · 금융재산')
      if (!(st.profile.children ?? '').trim()) add('children', '자녀 수')
      if (noValue) add('value', '주식가치 재료(자산 · 순이익)')
      if (p.bizYears === null) add('bizYears', '경영한 햇수(가업상속공제)')
    }
    if (g === 'loan') {
      if (!p.loanBalance) add('loanBalance', '가지급금 잔액')
      if (!p.monthlySalary) add('monthlySalary', '대표 월 급여')
    }
    if (g === 'retire') {
      if (!p.ceoStartDate) add('ceoStartDate', '대표 취임일')
      if (!p.monthlySalary) add('monthlySalary', '대표 월 급여')
    }
    return out
  }
  const needSet = new Set<string>()
  for (const g of GOAL_ORDER) {
    if (!on(g)) continue
    for (const n of needsFor(g)) {
      if (n.key === 'value') ['vAsset', 'vInc2'].forEach((k) => needSet.add(k))
      else needSet.add(n.key)
    }
  }
  /** 모자란 값을 누르면 그 칸이 있는 접힌 묶음을 펴고 그 칸으로 간다 */
  const jump = (key: string) => {
    const sel = key === 'holders' ? '[data-testid="fold-holders"]' : key === 'value' ? '[data-field="vAsset"]' : `[data-field="${key}"]`
    const el = document.querySelector<HTMLElement>(sel)
    if (!el) return
    const det = el.tagName === 'DETAILS' ? (el as HTMLDetailsElement) : el.closest('details')
    if (det && !det.open) det.open = true
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      if (el.matches('input, select')) el.focus({ preventScroll: true })
    })
  }

  /* ---- D-132: 한눈 요약 — 목표마다 한 줄. 누르면 그 카드로 ---- */
  const glance: { goal: GoalKey; text: string; ok: boolean }[] = GOAL_ORDER.filter(on).map((g) => {
    if (g === 'cash')
      return {
        goal: g,
        ok: !!cash?.best,
        text: cash?.best
          ? `추천 ${cash.best.label} — 순부담 ${krw(cash.best.netBurden)}${split?.best && split.best.years > 1 && split.saving > 0 ? ` · ★${split.best.years}년에 나누면 ${krw(split.saving)} 덜` : ''}`
          : cashTarget > 0
            ? '되는 방법이 없습니다 — 아래 까닭을 보세요'
            : '가져올 금액을 적으세요',
      }
    if (g === 'salary') return { goal: g, ok: !!salary?.ok, text: salary?.ok ? `월 급여 ${won(salary.monthly)}${salary.r ? ` · 실효 ${(salary.r.effRate * 100).toFixed(1)}%` : ''}` : (salary?.message ?? '') }
    if (g === 'gift')
      return {
        goal: g,
        ok: !!gift?.ok,
        text: gift?.ok
          ? `증여세 ${krw(gift.tax)}${gift.succession && gift.succession.state !== 'no' ? ` · ★특례면 ${krw(gift.succession.total)}` : ''}`
          : (gift?.message ?? ''),
      }
    if (g === 'inherit') return { goal: g, ok: !!inherit?.ok, text: inherit?.ok ? `지금 상속되면 ${krw(inherit.taxNow)}${inherit.familyBiz ? ` · ★가업상속공제면 ${krw(inherit.familyBiz.tax)}` : ''}` : (inherit?.message ?? '') }
    if (g === 'loan') return { goal: g, ok: !!loan?.ok, text: loan?.ok ? `해마다 ${krw(loan.yearLoss)} 손해 · 10년 ${krw(loan.tenYear)}` : '가지급금 잔액을 적으세요' }
    return { goal: g, ok: !!retire?.ok, text: retire?.ok ? `한도 ${krw(retire.limit)} · 세후 ${krw(retire.net)}` : (retire?.message ?? '') }
  })
  /** 인쇄 한 장에 적을 '계산기와 맞춰 본 곳' 수 */
  const proofCount = () => {
    const pfs = [cash?.best?.proof, salary?.proof, gift?.ok ? gift.proof : null, inherit?.ok ? inherit.proof : null, loan?.ok ? loan.proof : null, retire?.ok ? retire.proof : null, ...(split?.best?.proofs ?? [])].filter(
      (x): x is Proof => !!x,
    )
    return { all: pfs.length, ok: pfs.filter((x) => checkProof(x).ok).length }
  }
  const goTo = (g: GoalKey) => document.querySelector(`[data-testid="result-${g}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })

  /* ---- D-132: 현황 채움 — 결과에 크게 쓰이는 칸 ---- */
  const core: [string, boolean][] = [
    ['대표 월 급여', p.monthlySalary > 0],
    ['주주명부(대표 주식)', !!ceo && ceo.shares > 0],
    ['주식가치', sv.perShare > 0],
    ['대표 취임일', !!p.ceoStartDate],
    ['배당 가능한 이익', p.retainedEarnings > 0],
    ['대표 나이', p.ceoAge !== null],
    ['경영한 햇수', p.bizYears !== null],
  ]
  const filled = core.filter(([, ok]) => ok).length

  const suggestions = profileSuggestions(clientRecord, st.profile, today)
  const cretop = cretopStockOf(clientRecord)
  const textHolders = st.register.length === 0 && clientRecord?.shareholders ? holdersFromText(clientRecord.shareholders, clientRecord.representativeName) : []
  const salaryNow = p.monthlySalary > 0 ? computeSalary(p.monthlySalary) : null
  const loanNow = p.loanBalance > 0 ? loanPlan(p) : null

  return (
    <NeedCtx.Provider value={needSet}>
    <div className="flex flex-col gap-5" data-testid="tax-plan">
      {/* ① 원하는 것 */}
      <section className="no-print flex flex-col gap-3 rounded-(--radius-panel) border border-brand-200 bg-brand-50 p-4" aria-labelledby="plan-want">
        <h2 id="plan-want" className="t-card font-bold text-slate-900">
          원하는 결과를 적으세요{clientName ? ` — ${clientName}` : ''}
        </h2>
        {st.goals.length === 0 && (
          <p className="t-sub break-keep text-slate-600">
          예) &ldquo;1억 현금화하고 싶어&rdquo; · &ldquo;급여 실효세율 20%로&rdquo; · &ldquo;자녀에게 지분 10% 증여&rdquo;. 적은 낱말로 목표를 고르고, 세금 계산기 9종의 식으로 거꾸로 계산합니다.
        </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">원하는 결과</span>
            <input
              data-testid="plan-text"
              value={st.text}
              onChange={(e) => setSt((cur) => ({ ...cur, text: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') find()
              }}
              placeholder="예: 이번에 1억 현금화하고 싶어"
              className={inputCls.replace('mt-1 ', '')}
            />
          </label>
          <Button variant="primary" onClick={find} data-testid="plan-find">
            <Search aria-hidden="true" className="size-4" /> 찾기
          </Button>
        </div>
        {/* D-131: 목표를 고르면 예시는 접는다 — 휴대폰에서 결과가 바로 보이게 */}
        {st.goals.length === 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="예시">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setSt((cur) => ({ ...cur, text: ex }))}
              className="tap t-sub rounded-full border border-brand-200 bg-white px-3 py-1.5 text-brand-800 hover:border-brand-500"
            >
              {ex}
            </button>
          ))}
        </div>
        )}
        {heard.length > 0 && (
          <p className="t-sub break-keep text-slate-700" data-testid="plan-heard">
            <b className="font-semibold">알아들은 것:</b> {heard.join(' · ')}
          </p>
        )}
        <div>
          <p className="t-sub font-semibold text-slate-700">한 번에 볼 것</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {GOAL_ORDER.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={on(g)}
                data-goal={g}
                onClick={() => toggleGoal(g)}
                className={`tap t-sub inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium ${on(g) ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-500'}`}
              >
                {on(g) && <BadgeCheck aria-hidden="true" className="size-4" />}
                {GOAL_LABEL[g]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ③ 결과 */}
      {st.goals.length === 0 ? (
        <p className="no-print t-body rounded-(--radius-panel) border border-dashed border-slate-300 bg-white px-4 py-5 break-keep text-slate-600">
          위에서 원하는 결과를 적거나 &lsquo;한 번에 볼 것&rsquo;을 누르면 여기에 방법 · 세금 · 근거가 나옵니다.
        </p>
      ) : (
        <section className="no-print flex flex-col gap-4" aria-labelledby="plan-result">
          <div className="flex flex-col gap-2 rounded-(--radius-panel) border-2 border-navy-900 bg-white p-4" data-testid="plan-glance">
            <p className="t-card font-bold text-slate-900">한눈에</p>
            <ul className="flex flex-col gap-1">
              {glance.map((x) => (
                <li key={x.goal}>
                  <button type="button" onClick={() => goTo(x.goal)} className="tap flex w-full flex-col gap-0.5 rounded-(--radius-control) px-1 py-1 text-left hover:bg-slate-50 sm:flex-row sm:items-baseline sm:gap-2" data-glance={x.goal}>
                    <span className="t-sub shrink-0 font-semibold text-slate-500">{GOAL_LABEL[x.goal]}</span>
                    <span className={`t-body min-w-0 flex-1 font-bold break-keep tabular-nums ${x.ok ? 'text-navy-900' : 'text-slate-500'}`}>{x.text}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="t-sub break-keep text-slate-600">
              모든 숫자는 세금 계산기 9종의 식으로 계산했습니다 — 결과마다 <b className="font-semibold text-success-700">✓ 계산기 같은 숫자</b>로 다시 맞춰 봅니다.
              {needSet.size > 0 && <span className="font-semibold text-danger-700"> 빨간 칸 {needSet.size}개를 채우면 더 정확해집니다.</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id="plan-result" className="t-card font-bold text-slate-900">결과</h2>
            <p className="t-sub text-slate-600">
              <b className="font-bold text-amber-800">★</b> = 확실하지 않아 세무사 검증이 필요한 부분
            </p>
          </div>
          {GOAL_ORDER.filter(on).map((g) => {
            if (g === 'cash')
              return (
                <ResultCard key={g} title={GOAL_LABEL.cash} testId="result-cash">
                  <div className="max-w-md">
                    <span className="t-sub font-medium text-slate-700">대표 손에 남길 금액(세후)</span>
                    <MoneyInput value={st.cashTarget} onChange={(v) => setSt((cur) => ({ ...cur, cashTarget: v }))} label="대표 손에 남길 금액(세후)" />
                  </div>
                  <NeedBox items={needsFor('cash')} onJump={jump} />
                  {cash ? <CashRoutes plan={cash} onOpen={onOpenCalc} /> : <p className="t-sub text-slate-500">금액을 적으면 급여 · 배당 · 자사주(양도 · 소각) · 퇴직금을 모두 계산해 비교합니다.</p>}
                  {cash?.best && <SplitBox open={splitOpen} onToggle={setSplitOpen} split={split} />}
                </ResultCard>
              )
            if (g === 'salary')
              return (
                <ResultCard key={g} title={GOAL_LABEL.salary} testId="result-salary">
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="급여 목표">
                    {(
                      [
                        ['rate', '실효부담률 %'],
                        ['net', '세후 월 금액'],
                        ['min', '회사+대표 부담 최소'],
                      ] as [SalaryMode, string][]
                    ).map(([m, label]) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={st.salary.mode === m}
                        onClick={() => setSt((cur) => ({ ...cur, salary: { ...cur.salary, mode: m } }))}
                        className={`tap t-sub rounded-full border px-3 py-1.5 font-medium ${st.salary.mode === m ? 'border-navy-900 bg-navy-900 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {st.salary.mode === 'rate' && (
                    <div className="max-w-md">
                      <label className="block">
                        <span className="t-sub font-medium text-slate-700">개인 실효부담률 상한(%)</span>
                        <input value={st.salary.rate} onChange={(e) => setSt((cur) => ({ ...cur, salary: { ...cur.salary, rate: e.target.value } }))} inputMode="decimal" placeholder="예: 20" className={inputCls} aria-label="개인 실효부담률 상한(%)" />
                      </label>
                      <QuickPick values={['15', '20', '25', '30', '35']} suffix="%" current={st.salary.rate} onPick={(v) => setSt((cur) => ({ ...cur, salary: { ...cur.salary, rate: v } }))} />
                    </div>
                  )}
                  {st.salary.mode === 'net' && (
                    <div className="max-w-md">
                      <span className="t-sub font-medium text-slate-700">세후 월 실수령 목표</span>
                      <MoneyInput value={st.salary.net} onChange={(v) => setSt((cur) => ({ ...cur, salary: { ...cur.salary, net: v } }))} label="세후 월 실수령 목표" />
                    </div>
                  )}
                  <NeedBox items={needsFor('salary')} onJump={jump} />
                  {salary && (
                    <Outcome
                      ok={salary.ok}
                      message={salary.message}
                      headline={salary.ok ? `월 급여 ${won(salary.monthly)}` : ''}
                      lines={
                        salary.ok && salary.r
                          ? [
                              `개인 실효부담률 ${(salary.r.effRate * 100).toFixed(1)}% · 세후 월 ${won(salary.r.afterTax / 12)}`,
                              `대표 세금 · 4대보험 연 ${krw(salary.r.personalTotal)} · 법인세 절감 연 ${krw(p.corpRate > 0.2 ? salary.r.corpSaveHigh : salary.r.corpSaveLow)}`,
                              ...(salary.current ? [`지금(월 ${won(p.monthlySalary)}): 실효 ${(salary.current.effRate * 100).toFixed(1)}% · 세후 월 ${won(salary.current.afterTax / 12)}`] : []),
                            ]
                          : []
                      }
                      basis={salary.basis}
                      proof={salary.proof}
                      open={salary.open}
                      onOpen={onOpenCalc}
                    />
                  )}
                </ResultCard>
              )
            if (g === 'gift')
              return (
                <ResultCard key={g} title={GOAL_LABEL.gift} testId="result-gift">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block">
                      <span className="t-sub font-medium text-slate-700">받는 사람</span>
                      <select
                        value={st.gift.recipientId}
                        onChange={(e) => setSt((cur) => ({ ...cur, gift: { ...cur.gift, recipientId: e.target.value } }))}
                        className={inputCls}
                        aria-label="받는 사람"
                      >
                        <option value="">— 주주명부에서 고르기 —</option>
                        {st.register
                          .filter((r) => r.relation !== 'ceo')
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name || '(이름 없음)'} · {RELATION_LABEL[r.relation]}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="t-sub font-medium text-slate-700">얼마나</span>
                      <select value={st.gift.mode} onChange={(e) => setSt((cur) => ({ ...cur, gift: { ...cur.gift, mode: e.target.value as GiftMode } }))} className={inputCls} aria-label="얼마나">
                        <option value="pct">지분 %</option>
                        <option value="shares">주식 수</option>
                        <option value="value">금액어치</option>
                        <option value="budget">증여세 얼마 이하로 최대</option>
                        <option value="free">증여세 없이 최대</option>
                      </select>
                    </label>
                    {st.gift.mode !== 'free' && (
                      <div className="block">
                        <span className="t-sub font-medium text-slate-700">{st.gift.mode === 'pct' ? '지분(%)' : st.gift.mode === 'shares' ? '주식 수' : st.gift.mode === 'budget' ? '증여세 상한' : '금액'}</span>
                        {st.gift.mode === 'value' || st.gift.mode === 'budget' ? (
                          <MoneyInput value={st.gift.amount} onChange={(v) => setSt((cur) => ({ ...cur, gift: { ...cur.gift, amount: v } }))} label="증여 크기" />
                        ) : (
                          <>
                            <input value={st.gift.amount} onChange={(e) => setSt((cur) => ({ ...cur, gift: { ...cur.gift, amount: e.target.value } }))} inputMode="decimal" className={inputCls} aria-label="증여 크기" />
                            {st.gift.mode === 'pct' && <QuickPick values={['5', '10', '20', '30', '50']} suffix="%" current={st.gift.amount} onPick={(v) => setSt((cur) => ({ ...cur, gift: { ...cur.gift, amount: v } }))} />}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <NeedBox items={needsFor('gift')} onJump={jump} />
                  {gift && (
                    <Outcome
                      ok={gift.ok}
                      message={gift.message}
                      headline={gift.ok ? `증여세 ${won(gift.tax)}` : ''}
                      lines={gift.ok ? [...gift.lines, `대표 지분 → ${gift.ceoAfterPct.toFixed(1)}% · ${gift.recipient} → ${gift.recipientAfterPct.toFixed(1)}%`] : []}
                      conditions={gift.ok ? gift.conditions : []}
                      basis={gift.basis}
                      proof={gift.proof}
                      open={gift.open}
                      onOpen={onOpenCalc}
                    />
                  )}
                  {gift?.ok && gift.succession && <SuccessionBlock r={gift.succession} />}
                </ResultCard>
              )
            if (g === 'inherit')
              return (
                <ResultCard key={g} title={GOAL_LABEL.inherit} testId="result-inherit">
                  <NeedBox items={needsFor('inherit')} onJump={jump} />
                  {inherit && (
                    <Outcome
                      ok={inherit.ok}
                      message={inherit.message}
                      headline={inherit.ok ? `지금 상속되면 상속세 ${krw(inherit.taxNow)}` : ''}
                      lines={
                        inherit.ok
                          ? [
                              ...inherit.lines,
                              ...(inherit.withGift
                                ? [
                                    `위 증여(${krw(inherit.withGift.giftValue)}, 증여세 ${krw(inherit.withGift.giftTax)})를 하면 — 10년 안에 상속: 상속세 ${krw(inherit.withGift.within10)} · 10년 뒤 상속: ${krw(inherit.withGift.after10)}`,
                                    `10년 뒤라면 증여세까지 더해 ${krw(inherit.withGift.after10 + inherit.withGift.giftTax)} (지금 ${krw(inherit.taxNow)}보다 ${krw(inherit.taxNow - inherit.withGift.after10 - inherit.withGift.giftTax)} 적음)`,
                                  ]
                                : ['지분 증여 · 가업승계를 함께 켜면 증여했을 때와 비교합니다.']),
                            ]
                          : []
                      }
                      conditions={inherit.ok ? inherit.conditions : []}
                      basis={inherit.basis}
                      proof={inherit.proof}
                      open={inherit.open}
                      onOpen={onOpenCalc}
                    />
                  )}
                  {inherit?.ok && inherit.familyBiz && (
                    <div className="flex flex-col gap-2 rounded-(--radius-control) border border-amber-300 bg-white p-3" data-testid="family-biz">
                      <p className="t-card font-bold text-slate-900">★ 가업상속공제를 받으면</p>
                      <p className="text-[1.1rem] font-bold text-navy-900 tabular-nums">
                        상속세 {krw(inherit.familyBiz.tax)} <span className="t-body font-semibold text-brand-800">(공제 {krw(inherit.familyBiz.deduction)} · 지금보다 {krw(inherit.taxNow - inherit.familyBiz.tax)} 적음)</span>
                      </p>
                      <ProofBadge proof={inherit.familyBiz.proof} outside={inherit.familyBiz.outside} />
                      <VerifyBox items={inherit.familyBiz.verify} />
                    </div>
                  )}
                </ResultCard>
              )
            if (g === 'loan')
              return (
                <ResultCard key={g} title={GOAL_LABEL.loan} testId="result-loan">
                  <NeedBox items={needsFor('loan')} onJump={jump} />
                  {loan && (
                    <Outcome
                      ok={loan.ok}
                      message={loan.message || '회사 · 대표 칸에 가지급금 잔액을 적어 주세요.'}
                      headline={loan.ok ? `해마다 ${krw(loan.yearLoss)} 손해` : ''}
                      lines={loan.ok ? [...loan.lines, `5년 ${krw(loan.fiveYear)} · 10년 ${krw(loan.tenYear)}`] : []}
                      basis={loan.basis}
                      proof={loan.proof}
                      open={loan.open}
                      onOpen={onOpenCalc}
                      extra={
                        loan.ok ? (
                          <Button variant="secondary" size="sm" className={wrapBtn} onClick={() => setSt((cur) => ({ ...cur, cashTarget: formatWon(p.loanBalance), goals: cur.goals.includes('cash') ? cur.goals : ['cash', ...cur.goals] }))}>
                            갚을 돈 {krw(p.loanBalance)} 가장 싸게 가져오기
                          </Button>
                        ) : null
                      }
                    />
                  )}
                </ResultCard>
              )
            return (
              <ResultCard key={g} title={GOAL_LABEL.retire} testId="result-retire">
                <NeedBox items={needsFor('retire')} onJump={jump} />
                {retire && (
                  <Outcome
                    ok={retire.ok}
                    message={retire.message}
                    headline={retire.ok ? `한도 ${krw(retire.limit)} · 세후 ${krw(retire.net)}` : ''}
                    lines={retire.ok ? [...retire.lines, `퇴직소득세(지방세 포함) ${won(retire.tax)}`] : []}
                    conditions={retire.ok ? ['실제로 퇴임할 때만 받을 수 있습니다 — 정관에 임원 퇴직금 규정이 있어야 합니다.'] : []}
                    basis={retire.basis}
                    proof={retire.proof}
                    open={retire.open}
                    onOpen={onOpenCalc}
                  />
                )}
              </ResultCard>
            )
          })}
        </section>
      )}

      {/* ② 현황 */}
      <section className="no-print flex flex-col gap-3" aria-labelledby="plan-now">
        <div className="flex flex-col gap-1.5">
          <h2 id="plan-now" className="t-card font-bold text-slate-900">
            이 회사 현황 <span className="t-sub font-normal text-slate-500">— 고치면 위 결과가 바로 바뀝니다</span>
          </h2>
          <div className="flex items-center gap-3" data-testid="plan-filled">
            <span className="t-sub shrink-0 font-semibold text-slate-700 tabular-nums">
              채운 칸 {filled}/{core.length}
            </span>
            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
              <span className="block h-full rounded-full bg-brand-600" style={{ width: `${(filled / core.length) * 100}%` }} />
            </span>
          </div>
          {filled < core.length && (
            <p className="t-sub break-keep text-slate-600">
              아직: {core.filter(([, ok]) => !ok).map(([k]) => k).join(' · ')}
            </p>
          )}
        </div>
        <NowSummary
          perShare={sv.perShare}
          total={sv.total}
          source={sv.source}
          ceoName={ceo?.name ?? ''}
          ceoRatio={ceo && sv.totalShares > 0 ? ceo.shares / sv.totalShares : null}
          ceoValue={ceo ? ceo.shares * sv.perShare : 0}
          salaryLine={salaryNow ? `대표 월 급여 ${won(p.monthlySalary)} · 실효부담 ${(salaryNow.effRate * 100).toFixed(1)}% · 세후 월 ${won(salaryNow.afterTax / 12)}` : ''}
          loanLine={loanNow?.ok ? `가지급금 ${krw(p.loanBalance)} → 해마다 약 ${krw(loanNow.yearLoss)} 손해` : ''}
        />
        {suggestions.length > 0 && (
          <div className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center" data-testid="plan-suggest">
            <p className="t-sub min-w-0 flex-1 break-keep text-slate-700">
              업체 기록에서 채울 수 있는 값 {suggestions.length}개 — {suggestions.map((x) => `${PROFILE_FIELDS[x.key]}(${x.from})`).join(' · ')}
            </p>
            <Button
              variant="secondary"
              onClick={() => setSt((cur) => ({ ...cur, profile: { ...cur.profile, ...Object.fromEntries(suggestions.map((x) => [x.key, x.value])) } }))}
            >
              채우기
            </Button>
          </div>
        )}

        <Fold title="회사 · 대표" open={p.monthlySalary === 0} testId="fold-company">
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyField k="monthlySalary" st={st} set={setProfile} />
            <DateField k="ceoStartDate" st={st} set={setProfile} />
            <SelectField k="corpBand" options={[...CORP_BAND_OPTIONS]} st={st} set={setProfile} />
            <MoneyField k="loanBalance" st={st} set={setProfile} />
            <MoneyField k="retainedEarnings" st={st} set={setProfile} />
            <MoneyField k="otherFinIncome" st={st} set={setProfile} />
            <NumberField k="ceoAge" st={st} set={setProfile} hint="예: 62" />
            <NumberField k="bizYears" st={st} set={setProfile} hint="예: 15" />
          </div>
        </Fold>

        <Fold title={`주주명부 ${st.register.length > 0 ? `${st.register.length}명` : ''}`} open={st.register.length === 0} testId="fold-holders">
          <Holders st={st} setSt={setSt} totalShares={sv.totalShares} perShare={sv.perShare} />
          {textHolders.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="t-sub break-keep text-slate-700">
                업체 기록의 주주 글: {textHolders.map((h) => `${h.name} ${h.pct}%`).join(' · ')}
                {p.totalShares > 0 ? '' : ' — 발행주식 총수를 적으면 주식 수로 나눠 넣습니다.'}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className={wrapBtn}
                disabled={!(p.totalShares > 0)}
                onClick={() =>
                  setSt((cur) => ({
                    ...cur,
                    register: textHolders.map((h) => ({ id: generateId(), name: h.name, relation: h.relation, shares: Math.round((p.totalShares * h.pct) / 100), acquirePrice: 0 })),
                  }))
                }
              >
                이 글로 주주명부 채우기
              </Button>
            </div>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <NumberField k="totalShares" st={st} set={setProfile} hint="비우면 주주명부 합계" />
            <MoneyField k="par" st={st} set={setProfile} />
          </div>
        </Fold>

        <Fold title={`주식가치${sv.perShare > 0 ? ` — 1주 ${won(sv.perShare)}` : ''}`} open={sv.perShare === 0} testId="fold-value">
          <p className="t-sub break-keep text-slate-600">09 비상장주식 가치평가(상증세법 보충적 평가) 식으로 계산합니다. 직접 적으면 그 값을 씁니다.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <MoneyField k="vAsset" st={st} set={setProfile} />
            <MoneyField k="vDebt" st={st} set={setProfile} />
            <MoneyField k="vInc2" st={st} set={setProfile} />
            <MoneyField k="vInc1" st={st} set={setProfile} />
            <MoneyField k="vInc0" st={st} set={setProfile} />
            <SelectField k="vType" options={[...CORP_TYPE_OPTIONS]} st={st} set={setProfile} />
            <MoneyField k="vReBook" st={st} set={setProfile} />
            <MoneyField k="vReFair" st={st} set={setProfile} />
            <NumberField k="vRate" st={st} set={setProfile} hint="기본 10%" />
            <MoneyField k="perShareManual" st={st} set={setProfile} />
          </div>
          {cretop && (
            <Button variant="ghost" size="sm" className={`mt-2 ${wrapBtn}`} onClick={() => setProfile('perShareManual', String(cretop.perShare))}>
              크레탑 분석 값({won(cretop.perShare)}) 쓰기
            </Button>
          )}
          {sv.notes.length > 0 && (
            <ul className="t-sub mt-2 list-disc pl-5 break-keep text-slate-600">
              {sv.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </Fold>

        {(on('inherit') || on('gift')) && (
          <Fold title="가업승계 · 상속 재료" open testId="fold-estate">
            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyField k="estateRealEstate" st={st} set={setProfile} />
              <MoneyField k="estateFinancial" st={st} set={setProfile} />
              <MoneyField k="estateOther" st={st} set={setProfile} />
              <MoneyField k="estateDebt" st={st} set={setProfile} />
              <SelectField k="spouseAlive" options={['있음', '없음']} st={st} set={setProfile} />
              <NumberField k="children" st={st} set={setProfile} />
              <MoneyField k="priorGift" st={st} set={setProfile} />
              <NumberField k="bizAssetRatio" st={st} set={setProfile} hint="모르면 비움(100%로 계산 ★)" quick={['100', '90', '80', '70']} />
            </div>
          </Fold>
        )}
        {(on('retire') || on('cash')) && (
          <Fold title="퇴직금 정관" open={false} testId="fold-retire">
            <NumberField k="retireMult" st={st} set={setProfile} hint="2020년 이후 최대 2배 · 기본 2" />
          </Fold>
        )}
      </section>

      <div className="no-print flex flex-col gap-3 rounded-(--radius-panel) border border-amber-300 bg-amber-50 px-4 py-3">
        <p className="t-sub break-keep text-slate-700">
          <b className="font-semibold">참고용 계산입니다.</b> 세금 계산기 9종(기업지원단 배포본)의 식을 그대로 써서 거꾸로 찾았습니다. 실행 전에 담당 세무사가 요건 · 사실관계를 확인해야 합니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {clientId && (
            <Button variant="primary" onClick={() => void save()} disabled={saving} data-testid="plan-save">
              <Save aria-hidden="true" className="size-4" /> {saving ? '저장 중…' : '업체 기록에 저장'}
            </Button>
          )}
          <Button variant="secondary" onClick={() => void copy()}>
            <ClipboardCopy aria-hidden="true" className="size-4" /> 요약 복사
          </Button>
          {st.goals.length > 0 && (
            <Button variant="secondary" onClick={() => window.print()} data-testid="plan-print" title="대표님께 드릴 한 장으로 인쇄하거나 PDF로 저장합니다">
              <Printer aria-hidden="true" className="size-4" /> 인쇄 · PDF
            </Button>
          )}
        </div>
      </div>
      {st.goals.length > 0 && <PrintSheet clientName={clientName} today={today} glance={glance} parts={summaryParts()} proofs={proofCount()} />}
    </div>
    </NeedCtx.Provider>
  )
}

/* ------------------------------------------------------------------ */
/* 작은 부품                                                             */
/* ------------------------------------------------------------------ */

function WonHint({ text }: { text: string }) {
  const n = wonOf(text)
  if (!text.trim()) return null
  return <span className={`t-meta mt-1 block ${n > 0 ? 'text-slate-500' : 'text-danger-700'}`}>{n > 0 ? `= ${formatWon(n)}` : '금액을 읽지 못했습니다 (예: 120000000 또는 1억 2천만)'}</span>
}

type SetProfile = (k: ProfileKey, v: string) => void

/** D-131: 결과를 정확히 하려면 필요한데 비어 있는 칸 — 빨갛게 */
const NeedCtx = createContext<Set<string>>(new Set())

const STEPS: [number, string][] = [
  [1e6, '+100만'],
  [1e7, '+1,000만'],
  [1e8, '+1억'],
  [1e9, '+10억'],
]

/**
 * 금액 칸 — 숫자 키패드(휴대폰)로 적거나, 100만 · 1,000만 · 1억 · 10억 단추로 더한다.
 * '1억 2천만' 처럼 글로 적어도 읽는다(컴퓨터 자판).
 */
function MoneyInput({ value, onChange, label, field, placeholder, need }: { value: string; onChange: (v: string) => void; label: string; field?: string; placeholder?: string; need?: boolean }) {
  const add = (step: number) => onChange((wonOf(value) + step).toLocaleString('ko-KR'))
  return (
    <div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        placeholder={placeholder ?? '숫자만 또는 아래 단추'}
        className={`${inputCls} ${need ? '!border-danger-500 bg-danger-50' : ''}`}
        aria-label={label}
        aria-invalid={need || undefined}
        data-field={field}
      />
      <div className="mt-1.5 flex flex-wrap gap-1" aria-label={`${label} 빨리 더하기`}>
        {STEPS.map(([n, t]) => (
          <button key={t} type="button" onClick={() => add(n)} className="tap t-sub rounded-(--radius-control) border border-slate-200 bg-white px-2.5 font-medium text-slate-700 tabular-nums hover:border-brand-500">
            {t}
          </button>
        ))}
        {value.trim() !== '' && (
          <button type="button" onClick={() => onChange('')} className="tap t-sub rounded-(--radius-control) px-2.5 text-slate-500 hover:text-danger-700" aria-label={`${label} 지우기`}>
            지우기
          </button>
        )}
      </div>
      <WonHint text={value} />
    </div>
  )
}

/** 자주 쓰는 값 빨리 고르기(%) */
function QuickPick({ values, suffix, current, onPick }: { values: string[]; suffix: string; current: string; onPick: (v: string) => void }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {values.map((v) => (
        <button key={v} type="button" aria-pressed={current === v} onClick={() => onPick(v)} className={`tap t-sub rounded-(--radius-control) border px-2.5 font-medium tabular-nums ${current === v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-700'}`}>
          {v}
          {suffix}
        </button>
      ))}
    </div>
  )
}

function NeedNote({ need }: { need: boolean }) {
  return need ? <span className="t-meta mt-1 block font-semibold text-danger-700">적으면 결과가 더 정확해집니다</span> : null
}

function MoneyField({ k, st, set }: { k: ProfileKey; st: PlanState; set: SetProfile }) {
  const need = useContext(NeedCtx).has(k)
  return (
    <div className="block">
      <span className={`t-sub font-medium ${need ? 'text-danger-700' : 'text-slate-700'}`}>{PROFILE_FIELDS[k]}</span>
      <MoneyInput value={st.profile[k] ?? ''} onChange={(v) => set(k, v)} label={PROFILE_FIELDS[k]} field={k} need={need} />
      <NeedNote need={need} />
    </div>
  )
}

function NumberField({ k, st, set, hint, quick }: { k: ProfileKey; st: PlanState; set: SetProfile; hint?: string; quick?: string[] }) {
  const need = useContext(NeedCtx).has(k)
  return (
    <div className="block">
      <label className="block">
        <span className={`t-sub font-medium ${need ? 'text-danger-700' : 'text-slate-700'}`}>{PROFILE_FIELDS[k]}</span>
        <input
          value={st.profile[k] ?? ''}
          onChange={(e) => set(k, e.target.value)}
          inputMode="decimal"
          placeholder={hint}
          className={`${inputCls} ${need ? '!border-danger-500 bg-danger-50' : ''}`}
          aria-label={PROFILE_FIELDS[k]}
          aria-invalid={need || undefined}
          data-field={k}
        />
      </label>
      {quick && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {quick.map((q) => (
            <button key={q} type="button" onClick={() => set(k, q)} aria-pressed={st.profile[k] === q} className={`tap t-sub rounded-(--radius-control) border px-2.5 font-medium tabular-nums ${st.profile[k] === q ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-700'}`}>
              {q}
            </button>
          ))}
        </div>
      )}
      <NeedNote need={need} />
    </div>
  )
}

function DateField({ k, st, set }: { k: ProfileKey; st: PlanState; set: SetProfile }) {
  const need = useContext(NeedCtx).has(k)
  return (
    <label className="block">
      <span className={`t-sub font-medium ${need ? 'text-danger-700' : 'text-slate-700'}`}>{PROFILE_FIELDS[k]}</span>
      <input type="date" value={st.profile[k] ?? ''} onChange={(e) => set(k, e.target.value)} className={`${inputCls} ${need ? '!border-danger-500 bg-danger-50' : ''}`} aria-label={PROFILE_FIELDS[k]} data-field={k} />
      <NeedNote need={need} />
    </label>
  )
}

function SelectField({ k, options, st, set }: { k: ProfileKey; options: string[]; st: PlanState; set: SetProfile }) {
  return (
    <label className="block">
      <span className="t-sub font-medium text-slate-700">{PROFILE_FIELDS[k]}</span>
      <select value={st.profile[k] || options[0]} onChange={(e) => set(k, e.target.value)} className={inputCls} aria-label={PROFILE_FIELDS[k]} data-field={k}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}

/** ★ 확실하지 않아 세무사 검증이 필요한 것 */
function VerifyBox({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="rounded-(--radius-control) border border-amber-300 bg-amber-50 px-3 py-2.5" data-verify>
      <p className="t-sub font-bold text-amber-900">★ 검증 필요 — 세무사와 확인하세요</p>
      <ul className="t-sub mt-1 flex flex-col gap-1 break-keep text-slate-800">
        {items.map((v) => (
          <li key={v}>★ {v}</li>
        ))}
      </ul>
    </div>
  )
}

export interface NeedItem {
  key: string
  label: string
}

/** 모자란 값 — 누르면 그 칸으로 가서 펼친다 */
function NeedBox({ items, onJump }: { items: NeedItem[]; onJump: (key: string) => void }) {
  if (items.length === 0) return null
  return (
    <div className="rounded-(--radius-control) border border-danger-200 bg-danger-50 px-3 py-2.5" data-need>
      <p className="t-sub font-bold text-danger-800">이 값을 적으면 더 정확하게 알 수 있습니다</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((it) => (
          <button key={it.key} type="button" onClick={() => onJump(it.key)} className="tap t-sub rounded-full border border-danger-300 bg-white px-3 font-semibold text-danger-800 hover:border-danger-500" data-need-key={it.key}>
            {it.label} 적기
          </button>
        ))}
      </div>
    </div>
  )
}

const CHECK_MARK: Record<CheckState, string> = { ok: '✓', no: '✗', unknown: '?' }

function SuccessionBlock({ r }: { r: SuccessionResult }) {
  return (
    <div className="flex flex-col gap-2 rounded-(--radius-control) border border-brand-200 bg-brand-50 p-3" data-testid="succession">
      <p className="t-card font-bold text-slate-900">가업승계 증여세 과세특례와 비교</p>
      <ul className="flex flex-col gap-1">
        {r.checks.map((c) => (
          <li key={c.label} className="t-sub flex items-start gap-2 break-keep" data-check={c.state}>
            <span aria-hidden="true" className={`w-5 shrink-0 text-center font-bold ${c.state === 'ok' ? 'text-success-700' : c.state === 'no' ? 'text-danger-700' : 'text-amber-700'}`}>
              {CHECK_MARK[c.state]}
            </span>
            <span className="min-w-0">
              <b className="font-semibold text-slate-800">{c.label}</b> <span className="text-slate-600">— {c.note}</span>
            </span>
          </li>
        ))}
      </ul>
      {r.state === 'no' ? (
        <p className="t-body font-semibold break-keep text-danger-800">요건이 맞지 않아 특례를 받을 수 없습니다 — 위 일반 증여세가 적용됩니다.</p>
      ) : (
        <>
          <p className="text-[1.15rem] font-bold text-navy-900 tabular-nums">
            특례 적용 시 증여세 {won(r.total)}
            {r.saving > 0 && <span className="t-body font-semibold text-brand-800"> · 일반보다 {krw(r.saving)} 적음</span>}
          </p>
          {r.state === 'unknown' && <p className="t-sub break-keep text-amber-800">? 표시 요건을 확인해야 특례를 받을 수 있습니다.</p>}
          <ul className="flex flex-col gap-0.5">
            {r.lines.map((l) => (
              <li key={l} className="t-body break-keep text-slate-800 tabular-nums">
                {l}
              </li>
            ))}
          </ul>
        </>
      )}
      <ProofBadge outside={r.outside} />
      <VerifyBox items={r.verify} />
      <Basis basis={r.basis} />
    </div>
  )
}

/** 처음에만 열림/닫힘을 정하고, 그다음은 사람이 누른 대로 — 값을 적자마자 접히면 적던 칸이 사라진다 */
function Fold({ title, open, testId, children }: { title: string; open: boolean; testId: string; children: ReactNode }) {
  const [isOpen, setOpen] = useState(open)
  return (
    <details open={isOpen} onToggle={(e) => setOpen(e.currentTarget.open)} className="group rounded-(--radius-panel) border border-slate-200 bg-white" data-testid={testId}>
      <summary className="tap flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-[1rem] font-semibold text-slate-900">
        <span className="min-w-0 break-keep">{title}</span>
        <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-100 px-4 py-4">{children}</div>
    </details>
  )
}

function NowSummary(props: {
  perShare: number
  total: number
  source: 'manual' | '09' | 'none'
  ceoName: string
  ceoRatio: number | null
  ceoValue: number
  salaryLine: string
  loanLine: string
}) {
  const lines = [
    props.perShare > 0 ? `1주당 가치 ${won(props.perShare)} · 기업가치 ${krw(props.total)} (${props.source === 'manual' ? '직접 적음' : '09 비상장주식 식'})` : '',
    props.ceoName && props.ceoRatio !== null ? `대표 ${props.ceoName} 지분 ${(props.ceoRatio * 100).toFixed(1)}%${props.perShare > 0 ? ` · 평가액 ${krw(props.ceoValue)}` : ''}` : '',
    props.salaryLine,
    props.loanLine,
  ].filter(Boolean)
  if (lines.length === 0) {
    return <p className="t-sub rounded-(--radius-control) bg-slate-50 px-4 py-3 break-keep text-slate-600">아래 칸을 채우면 주식가치 · 대표 지분 · 급여 부담이 여기 한 번에 보입니다.</p>
  }
  return (
    <ul className="flex flex-col gap-1.5 rounded-(--radius-control) bg-slate-50 px-4 py-3" data-testid="plan-now-summary">
      {lines.map((l) => (
        <li key={l} className="t-body break-keep text-slate-800">
          {l}
        </li>
      ))}
    </ul>
  )
}

const RELATIONS: ShareholderRelation[] = ['ceo', 'spouse', 'child', 'minor_child', 'parent', 'executive', 'relative', 'corp', 'other']

function Holders({ st, setSt, totalShares, perShare }: { st: PlanState; setSt: (f: (cur: PlanState) => PlanState) => void; totalShares: number; perShare: number }) {
  const patch = (id: string, p: Partial<ShareholderRow>) => setSt((cur) => ({ ...cur, register: cur.register.map((r) => (r.id === id ? { ...r, ...p } : r)) }))
  const num = (v: string) => {
    const n = Number(v.replace(/[,\s주원]/g, ''))
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  return (
    <div className="flex flex-col gap-2">
      {st.register.length === 0 && <p className="t-sub break-keep text-slate-600">아직 주주명부가 없습니다. 대표부터 한 줄씩 넣으세요 — 지분율 · 평가액은 저절로 계산됩니다.</p>}
      {st.register.map((r, i) => (
        <div key={r.id} className="grid grid-cols-2 gap-2 rounded-(--radius-control) border border-slate-200 p-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] sm:items-end" data-testid="holder-row">
          <label className="col-span-2 block sm:col-span-1">
            <span className="t-meta font-medium text-slate-600">이름</span>
            <input value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} className={inputCls} aria-label={`주주 ${i + 1} 이름`} />
          </label>
          <label className="block">
            <span className="t-meta font-medium text-slate-600">관계</span>
            <select value={r.relation} onChange={(e) => patch(r.id, { relation: e.target.value as ShareholderRelation })} className={inputCls} aria-label={`주주 ${i + 1} 관계`}>
              {RELATIONS.map((x) => (
                <option key={x} value={x}>
                  {RELATION_LABEL[x]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="t-meta font-medium text-slate-600">주식 수</span>
            <input
              value={r.shares ? r.shares.toLocaleString('ko-KR') : ''}
              onChange={(e) => patch(r.id, { shares: Math.floor(num(e.target.value)) })}
              inputMode="numeric"
              className={`${inputCls} text-right tabular-nums`}
              aria-label={`주주 ${i + 1} 주식 수`}
            />
          </label>
          <label className="block">
            <span className="t-meta font-medium text-slate-600">1주 취득가</span>
            <input
              value={r.acquirePrice ? r.acquirePrice.toLocaleString('ko-KR') : ''}
              onChange={(e) => patch(r.id, { acquirePrice: num(e.target.value) })}
              inputMode="numeric"
              placeholder="모르면 비움"
              className={`${inputCls} text-right tabular-nums`}
              aria-label={`주주 ${i + 1} 1주 취득가`}
            />
          </label>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <span className="t-sub text-slate-600 tabular-nums sm:hidden">
              {totalShares > 0 ? `${((r.shares / totalShares) * 100).toFixed(1)}%` : ''}
              {perShare > 0 && r.shares > 0 ? ` · ${krw(r.shares * perShare)}` : ''}
            </span>
            <button
              type="button"
              aria-label={`주주 ${i + 1} ${r.name || ''} 지우기`}
              onClick={() => setSt((cur) => ({ ...cur, register: cur.register.filter((x) => x.id !== r.id) }))}
              className="tap inline-flex items-center justify-center rounded-(--radius-control) text-slate-400 hover:bg-slate-100 hover:text-danger-600"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </div>
          <p className="t-sub col-span-full hidden text-slate-600 tabular-nums sm:block">
            {totalShares > 0 ? `지분 ${((r.shares / totalShares) * 100).toFixed(1)}%` : '지분 -'}
            {perShare > 0 && r.shares > 0 ? ` · 평가액 ${krw(r.shares * perShare)}` : ''}
          </p>
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => setSt((cur) => ({ ...cur, register: [...cur.register, { id: generateId(), name: '', relation: cur.register.some((x) => x.relation === 'ceo') ? 'child' : 'ceo', shares: 0, acquirePrice: 0 }] }))}
        data-testid="holder-add"
      >
        <Plus aria-hidden="true" className="size-4" /> 주주 추가
      </Button>
    </div>
  )
}

function ResultCard({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4" data-testid={testId}>
      <h3 className="t-card border-b-2 border-navy-900 pb-2 font-bold text-slate-900">{title}</h3>
      {children}
    </section>
  )
}

function Basis({ basis }: { basis: string[] }) {
  return (
    <details className="rounded-(--radius-control) bg-slate-50">
      <summary className="tap t-sub flex cursor-pointer items-center px-3 font-medium text-slate-700">계산 근거 보기</summary>
      <ul className="t-sub list-disc px-3 pb-3 pl-7 break-keep text-slate-600">
        {basis.map((b) => (
          <li key={b} className="mt-1">
            {b}
          </li>
        ))}
      </ul>
    </details>
  )
}

function OpenButton({ open, onOpen }: { open: CalcOpen | null; onOpen: (o: CalcOpen) => void }) {
  if (!open) return null
  return (
    <Button variant="ghost" size="sm" className={wrapBtn} onClick={() => onOpen(open)}>
      <ExternalLink aria-hidden="true" className="size-4" /> 같은 숫자로 {open.label}
    </Button>
  )
}

function Outcome(props: {
  ok: boolean
  message: string
  headline: string
  lines: string[]
  conditions?: string[]
  basis: string[]
  open: CalcOpen | null
  onOpen: (o: CalcOpen) => void
  extra?: ReactNode
  proof?: Proof | null
  outside?: string
}) {
  if (!props.ok) return <p className="t-body rounded-(--radius-control) bg-slate-50 px-3 py-2.5 break-keep text-slate-700">{props.message}</p>
  return (
    <div className="flex flex-col gap-2" data-outcome>
      {props.message && <p className="t-sub break-keep text-slate-600">{props.message}</p>}
      <p className="text-[1.25rem] font-bold break-keep text-navy-900 tabular-nums">{props.headline}</p>
      <ul className="flex flex-col gap-1">
        {props.lines.map((l) => (
          <li key={l} className="t-body break-keep text-slate-800 tabular-nums">
            {l}
          </li>
        ))}
      </ul>
      {(props.conditions ?? []).length > 0 && (
        <ul className="t-sub list-disc pl-5 break-keep text-slate-600">
          {props.conditions!.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      <ProofBadge proof={props.proof} outside={props.outside} />
      <div className="flex flex-wrap items-center gap-2">
        {props.extra}
        <OpenButton open={props.open} onOpen={props.onOpen} />
      </div>
      <Basis basis={props.basis} />
    </div>
  )
}

function CashRoutes({ plan, onOpen }: { plan: NonNullable<ReturnType<typeof cashPlan>>; onOpen: (o: CalcOpen) => void }) {
  const best = plan.best
  const others = plan.routes.filter((r) => r.ok && r !== best && r.key !== 'retire' && !r.unsafe)
  const saving = best && others.length > 0 ? Math.min(...others.map((r) => r.netBurden)) - best.netBurden : 0
  const main = plan.routes.filter((r) => !r.unsafe)
  const risky = plan.routes.filter((r) => r.unsafe)
  return (
    <div className="flex flex-col gap-3">
      {best && (
        <p className="t-body rounded-(--radius-control) border border-brand-200 bg-brand-50 px-3 py-2.5 break-keep text-slate-800" data-testid="route-best">
          <b className="font-bold text-brand-800">추천: {best.label}</b> — 순부담 {krw(best.netBurden)}
          {saving > 0 ? `, 다음으로 싼 방법보다 ${krw(saving)} 적게 냅니다.` : '.'}
          {best.verify.length > 0 && <span className="text-amber-800"> ★ 표시는 세무사 확인.</span>}
        </p>
      )}
      <ol className="flex flex-col gap-3">
        {main.map((r) => (
          <RouteCard key={r.key} r={r} best={r === best} onOpen={onOpen} />
        ))}
      </ol>
      {risky.length > 0 && (
        <details className="group flex flex-col gap-2" data-testid="route-risky">
          <summary className="tap t-body flex cursor-pointer list-none items-center gap-2 font-bold text-amber-900">
            <span className="min-w-0 flex-1 break-keep">★ 검증 필요 — 추천하지 않는 방법 {risky.length}개(다툼이 있음) 보기</span>
            <ChevronDown aria-hidden="true" className="size-5 shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <ol className="mt-2 flex flex-col gap-3">
            {risky.map((r) => (
              <RouteCard key={r.key} r={r} best={false} onOpen={onOpen} />
            ))}
          </ol>
        </details>
      )}
      {plan.notes.length > 0 && (
        <ul className="t-sub list-disc pl-5 break-keep text-slate-600">
          {plan.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <p className="t-sub break-keep text-slate-500">순부담 = 대표가 내는 세금(4대보험 포함) − 회사가 덜 내는 법인세. 적을수록 좋습니다(법인세가 더 줄면 “이득”). 퇴직금은 퇴임할 때만 받을 수 있어 추천에서 뺍니다.</p>
    </div>
  )
}

/**
 * D-132: 계산기 대조 표시 — 이 숫자가 세금 계산기 9종의 식에서 나왔는지 그 자리에서 다시 맞춰 본다.
 *  ✓ 계산기 NN과 같은 숫자 · ★ 계산기 밖 식(특례 등) · ⚠ 다름(나오면 안 된다 — 세무사 확인)
 */
function ProofBadge({ proof, outside }: { proof?: Proof | null; outside?: string }) {
  const res = proof ? checkProof(proof) : null
  return (
    <span className="flex flex-wrap items-center gap-1.5" data-proof={res ? (res.ok ? 'ok' : 'bad') : 'none'}>
      {res && res.ok && (
        <span className="t-meta inline-flex items-center gap-1 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 font-semibold text-success-700">
          ✓ 계산기 {calcNo(proof!.calc)}과 같은 숫자
        </span>
      )}
      {res && !res.ok && (
        <span className="t-meta rounded-full border border-danger-300 bg-danger-50 px-2 py-0.5 font-bold text-danger-800">⚠ 계산기 {calcNo(proof!.calc)}과 다름 — 세무사 확인</span>
      )}
      {outside && <span className="t-meta rounded-(--radius-control) border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold break-keep text-amber-900">★ {outside}</span>}
    </span>
  )
}

function RouteBody({ r, onOpen }: { r: CashRoute; onOpen: (o: CalcOpen) => void }) {
  return (
    <>
      {r.ok ? (
        <>
          <dl className="t-sub grid grid-cols-1 gap-x-4 gap-y-0.5 text-slate-700 sm:grid-cols-2">
            {(
              [
                ['대표 세금', r.personalTax],
                ['법인세 절감', r.corpSaving],
                ['회사에서 나가는 돈', r.companyOut],
                [r.receiver ? `${r.receiver} 손에` : '대표 손에', r.net],
              ] as [string, number][]
            ).map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 sm:justify-start">
                <dt className="min-w-0 break-keep text-slate-500">{k}</dt>
                <dd className="shrink-0 font-semibold whitespace-nowrap tabular-nums" title={won(v)}>
                  {krw(v)}
                </dd>
              </div>
            ))}
          </dl>
          <ul className="t-sub flex flex-col gap-0.5 break-keep text-slate-700">
            {r.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="t-sub break-keep text-slate-600">안 됨 — {r.reason}</p>
      )}
      {r.conditions.length > 0 && (
        <ul className="t-sub list-disc pl-5 break-keep text-slate-600">
          {r.conditions.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      {r.ok && <ProofBadge proof={r.proof} outside={r.outside} />}
      <VerifyBox items={r.verify} />
      <div className="flex flex-wrap items-center gap-2">
        <OpenButton open={r.open} onOpen={onOpen} />
      </div>
      {r.basis.length > 0 && <Basis basis={r.basis} />}
    </>
  )
}

/** 추천은 펼쳐 두고, 나머지는 한 줄 — 누르면 펼친다(D-132: 여섯 장을 다 펴면 휴대폰에서 끝이 없었다) */
function RouteCard({ r, best, onOpen }: { r: CashRoute; best: boolean; onOpen: (o: CalcOpen) => void }) {
  const [open, setOpen] = useState(best)
  return (
    <li className={`rounded-(--radius-control) border ${best ? 'border-brand-500 bg-white' : r.ok ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50'}`} data-route={r.key} data-ok={r.ok}>
      <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="group">
        <summary className="tap flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5">
          <span className="flex min-w-0 flex-[1_1_14rem] flex-wrap items-center gap-x-2 gap-y-1">
            {best && <span className="t-meta rounded-full bg-brand-600 px-2 py-0.5 font-bold whitespace-nowrap text-white">추천</span>}
            <span className="t-card font-bold break-keep text-slate-900">{r.label}</span>
            {r.verify.length > 0 && <span className="t-meta rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-bold whitespace-nowrap text-amber-900">★ 검증 필요</span>}
            {r.key === 'retire' && r.ok && <span className="t-meta rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 font-semibold whitespace-nowrap text-slate-700">퇴임할 때만</span>}
          </span>
          <span className={`ml-auto shrink-0 text-right font-bold whitespace-nowrap tabular-nums ${r.ok ? 'text-[1.05rem] text-navy-900' : 't-sub text-slate-500'}`}>
            {!r.ok ? '안 됨' : r.netBurden < 0 ? `이득 ${krw(-r.netBurden)}` : `순부담 ${krw(r.netBurden)}`}
          </span>
          <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-2 border-t border-slate-100 px-3 pt-2.5 pb-3">
          <RouteBody r={r} onOpen={onOpen} />
        </div>
      </details>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* D-133: 여러 해에 나눠 가져오기 · 대표님께 드릴 한 장                     */
/* ------------------------------------------------------------------ */

const ROUTE_SHORT: Record<CashRouteKey, string> = {
  salary: '급여',
  dividend: '배당',
  shareSale: '주식 팔기',
  shareBurn: '자사주 소각',
  spouseBurn: '배우자 증여 후 소각',
  retire: '퇴직금',
  mix: '급여+배당',
}

/** 해마다 고른 방법 — 같은 것이 이어지면 '주식 팔기 ×3' */
function stepsText(row: SplitPlan['rows'][number]): string {
  const out: string[] = []
  let i = 0
  while (i < row.steps.length) {
    let j = i
    while (j + 1 < row.steps.length && row.steps[j + 1].key === row.steps[i].key) j += 1
    const n = j - i + 1
    out.push(`${ROUTE_SHORT[row.steps[i].key]}${n > 1 ? ` ×${n}` : ''}`)
    i = j + 1
  }
  return out.join(' → ')
}

function splitLine(row: SplitPlan['rows'][number]): string {
  const head = row.years === 1 ? '1년에 다' : `${row.years}년에 나눠(해마다 ${krw(row.perYear)})`
  return row.ok ? `${head}: ${stepsText(row)} · 순부담 합 ${krw(row.total)}` : `${head}: 안 됨 — ${row.reason}`
}

function SplitBox({ open, onToggle, split }: { open: boolean; onToggle: (v: boolean) => void; split: SplitPlan | null }) {
  const one = split?.oneShot
  const proofs = split?.best?.proofs ?? []
  const bad = proofs.filter((x) => !checkProof(x).ok).length
  const calcs = [...new Set(proofs.map((x) => calcNo(x.calc)))].join(' · ')
  return (
    <details open={open} onToggle={(e) => onToggle(e.currentTarget.open)} className="group rounded-(--radius-control) border border-slate-200 bg-slate-50" data-testid="split-box">
      <summary className="tap flex cursor-pointer list-none items-center gap-2 px-3 py-2.5">
        <span className="t-body min-w-0 flex-1 font-bold break-keep text-slate-900">여러 해에 나눠 가져오면? (1 · 2 · 3 · 5년 비교)</span>
        <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      {open && split && (
        <div className="flex flex-col gap-2 border-t border-slate-200 px-3 pt-2.5 pb-3">
          {split.best && (
            <p className="t-body break-keep text-slate-800" data-testid="split-best">
              {split.best.years === 1 ? (
                <>
                  <b className="font-bold text-brand-800">1년에 다 가져오는 것</b>이 가장 적게 냅니다.
                </>
              ) : one?.ok ? (
                <>
                  <b className="font-bold text-brand-800">{split.best.years}년에 나누면</b> 1년에 다 가져올 때보다 <b className="font-bold">{krw(split.saving)}</b> 덜 냅니다.
                </>
              ) : (
                <>
                  1년에는 안 되고, <b className="font-bold text-brand-800">{split.best.years}년에 나누면</b> 됩니다.
                </>
              )}
            </p>
          )}
          <ol className="flex flex-col gap-1.5">
            {split.rows.map((r) => {
              const isBest = r === split.best
              return (
                <li
                  key={r.years}
                  data-split={r.years}
                  data-ok={r.ok}
                  className={`flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-(--radius-control) border px-3 py-2 ${isBest ? 'border-brand-500 bg-white' : 'border-slate-200 bg-white'}`}
                >
                  <span className="t-body min-w-0 flex-[1_1_12rem] break-keep">
                    <b className="font-bold text-slate-900">{r.years === 1 ? '1년에 다' : `${r.years}년에 나눠`}</b>
                    {isBest && <span className="t-meta ml-1.5 rounded-full bg-brand-600 px-2 py-0.5 font-bold whitespace-nowrap text-white">가장 적음</span>}
                    <span className="t-sub block text-slate-600">{r.ok ? `해마다 ${krw(r.perYear)} · ${stepsText(r)}` : `안 됨 — ${r.reason}`}</span>
                  </span>
                  {r.ok && (
                    <span className="ml-auto shrink-0 text-right whitespace-nowrap tabular-nums">
                      <span className="t-sub text-slate-500">순부담 합 </span>
                      <b className="font-bold text-navy-900">{krw(r.total)}</b>
                      {one?.ok && r.years > 1 && <span className="t-sub block text-success-700">{r.total < one.total ? `${krw(one.total - r.total)} 덜` : `${krw(r.total - one.total)} 더`}</span>}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
          <span className="flex flex-wrap items-center gap-1.5" data-proof={proofs.length === 0 ? 'none' : bad === 0 ? 'ok' : 'bad'}>
            {proofs.length > 0 && bad === 0 && (
              <span className="t-meta inline-flex items-center gap-1 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 font-semibold text-success-700">
                ✓ 해마다 계산기 {calcs}과 같은 숫자({proofs.length}번 맞춰 봄)
              </span>
            )}
            {bad > 0 && <span className="t-meta rounded-full border border-danger-300 bg-danger-50 px-2 py-0.5 font-bold text-danger-800">⚠ 계산기와 다른 해 {bad}개 — 세무사 확인</span>}
            <span className="t-meta rounded-(--radius-control) border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold break-keep text-amber-900">★ {split.outside}</span>
          </span>
          {split.notes.length > 0 && (
            <ul className="t-sub list-disc pl-5 break-keep text-slate-600">
              {split.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </details>
  )
}

/** 인쇄할 때만 보이는 한 장 — 한눈에 · 목표별 결과 · ★ · 세무사 확인 */
function PrintSheet({
  clientName,
  today,
  glance,
  parts,
  proofs,
}: {
  clientName: string
  today: string
  glance: { goal: GoalKey; text: string }[]
  parts: { title: string; lines: string[] }[]
  proofs: { all: number; ok: number }
}) {
  return (
    <div className="print-document hidden bg-white text-slate-900 print:block" data-testid="plan-print-sheet" aria-hidden="true">
      <h1 className="text-[1.5rem] font-bold">{clientName ? `${clientName} ` : ''}절세 설계 요약</h1>
      <p className="mt-1 text-slate-600">{today} · 세금 계산기 9종의 식으로 계산 · 참고용</p>
      <section className="avoid-break mt-4 rounded border-2 border-slate-900 p-3">
        <h2 className="font-bold">한눈에</h2>
        <ul className="mt-1 flex flex-col gap-0.5">
          {glance.map((x) => (
            <li key={x.goal}>
              <span className="text-slate-600">{GOAL_LABEL[x.goal]}</span> — <b>{x.text}</b>
            </li>
          ))}
        </ul>
      </section>
      {parts.map((pt) => (
        <section key={pt.title} className="avoid-break mt-3">
          <h2 className="border-b border-slate-400 pb-0.5 font-bold">{pt.title}</h2>
          <ul className="mt-1 flex flex-col gap-0.5">
            {pt.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      ))}
      <section className="avoid-break mt-4 border-t border-slate-400 pt-2 text-slate-700">
        <p>
          계산기와 다시 맞춰 본 곳 {proofs.all}곳 중 {proofs.ok}곳 같은 숫자. ★ 표시는 확실하지 않아 세무사 검증이 필요한 부분입니다.
        </p>
        <p>참고용 계산입니다 — 실행 전에 담당 세무사가 요건 · 사실관계를 확인해야 합니다.</p>
      </section>
    </div>
  )
}
