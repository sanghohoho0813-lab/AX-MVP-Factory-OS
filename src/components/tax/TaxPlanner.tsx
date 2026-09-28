/**
 * 절세 설계 — 원하는 결과로 찾기 (D-130).
 *
 * 흐름은 셋: ① 원하는 것을 적거나 누른다 → ② 이 회사 현황(업체 기록에서 채움 · 고칠 수 있음) → ③ 방법 비교 · 추천 · 근거.
 * 계산은 전부 services/taxPlan.ts — 세금 계산기 9종의 식을 그대로 부른다. 여기는 그리기만.
 * 적는 중인 값은 업체마다 이 브라우저에 남고, [업체 기록에 저장] 을 누르면 업체 기록(주주명부 · 절세 현황)에 들어간다.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BadgeCheck, ChevronDown, ClipboardCopy, ExternalLink, Plus, Save, Search, Trash2 } from 'lucide-react'
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
  viewProfile,
  wonOf,
  type CalcOpen,
  type CashRoute,
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
      const lines = cash.routes.map((r) => `${r === cash.best ? '[추천] ' : ''}${r.label}: ${r.ok ? `대표 세금 ${krw(r.personalTax)} · 법인세 절감 ${krw(r.corpSaving)} · 순부담 ${krw(r.netBurden)}` : `안 됨 — ${r.reason}`}`)
      parts.push({ title: `대표가 세후 ${krw(cash.target)} 가져오기`, lines })
    }
    if (salary?.ok && salary.r) parts.push({ title: '급여 맞추기', lines: [`${salary.message}: 월 ${won(salary.monthly)} · 실효부담률 ${(salary.r.effRate * 100).toFixed(1)}% · 세후 월 ${won(salary.r.afterTax / 12)}`] })
    if (gift?.ok && on('gift')) parts.push({ title: '지분 증여', lines: [...gift.lines, `증여세 ${won(gift.tax)} · 대표 지분 ${gift.ceoAfterPct.toFixed(1)}% · ${gift.recipient} ${gift.recipientAfterPct.toFixed(1)}%`] })
    if (inherit?.ok) parts.push({ title: '상속세 미리 보기', lines: [`지금 상속되면 상속세 ${krw(inherit.taxNow)}`, ...(inherit.withGift ? [`증여 후 10년 안 ${krw(inherit.withGift.within10)} · 10년 뒤 ${krw(inherit.withGift.after10)} (증여세 ${krw(inherit.withGift.giftTax)} 별도)`] : [])] })
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

  const suggestions = profileSuggestions(clientRecord, st.profile)
  const cretop = cretopStockOf(clientRecord)
  const textHolders = st.register.length === 0 && clientRecord?.shareholders ? holdersFromText(clientRecord.shareholders, clientRecord.representativeName) : []
  const salaryNow = p.monthlySalary > 0 ? computeSalary(p.monthlySalary) : null
  const loanNow = p.loanBalance > 0 ? loanPlan(p) : null

  return (
    <div className="flex flex-col gap-5" data-testid="tax-plan">
      {/* ① 원하는 것 */}
      <section className="flex flex-col gap-3 rounded-(--radius-panel) border border-brand-200 bg-brand-50 p-4" aria-labelledby="plan-want">
        <h2 id="plan-want" className="t-card font-bold text-slate-900">
          원하는 결과를 적으세요{clientName ? ` — ${clientName}` : ''}
        </h2>
        <p className="t-sub break-keep text-slate-600">
          예) &ldquo;1억 현금화하고 싶어&rdquo; · &ldquo;급여 실효세율 20%로&rdquo; · &ldquo;자녀에게 지분 10% 증여&rdquo;. 적은 낱말로 목표를 고르고, 세금 계산기 9종의 식으로 거꾸로 계산합니다.
        </p>
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

      {/* ② 현황 */}
      <section className="flex flex-col gap-3" aria-labelledby="plan-now">
        <h2 id="plan-now" className="t-card font-bold text-slate-900">이 회사 현황</h2>
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

        {on('inherit') && (
          <Fold title="대표 재산(상속세용)" open testId="fold-estate">
            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyField k="estateRealEstate" st={st} set={setProfile} />
              <MoneyField k="estateFinancial" st={st} set={setProfile} />
              <MoneyField k="estateOther" st={st} set={setProfile} />
              <MoneyField k="estateDebt" st={st} set={setProfile} />
              <SelectField k="spouseAlive" options={['있음', '없음']} st={st} set={setProfile} />
              <NumberField k="children" st={st} set={setProfile} />
              <MoneyField k="priorGift" st={st} set={setProfile} />
            </div>
          </Fold>
        )}
        {(on('retire') || on('cash')) && (
          <Fold title="퇴직금 정관" open={false} testId="fold-retire">
            <NumberField k="retireMult" st={st} set={setProfile} hint="2020년 이후 최대 2배 · 기본 2" />
          </Fold>
        )}
      </section>

      {/* ③ 결과 */}
      {st.goals.length === 0 ? (
        <p className="t-body rounded-(--radius-panel) border border-dashed border-slate-300 bg-white px-4 py-5 break-keep text-slate-600">
          위에서 원하는 결과를 적거나 &lsquo;한 번에 볼 것&rsquo;을 누르면 여기에 방법 · 세금 · 근거가 나옵니다.
        </p>
      ) : (
        <section className="flex flex-col gap-4" aria-labelledby="plan-result">
          <h2 id="plan-result" className="t-card font-bold text-slate-900">결과</h2>
          {GOAL_ORDER.filter(on).map((g) => {
            if (g === 'cash')
              return (
                <ResultCard key={g} title={GOAL_LABEL.cash} testId="result-cash">
                  <label className="block max-w-sm">
                    <span className="t-sub font-medium text-slate-700">대표 손에 남길 금액(세후)</span>
                    <input value={st.cashTarget} onChange={(e) => setSt((cur) => ({ ...cur, cashTarget: e.target.value }))} placeholder="예: 1억" className={inputCls} aria-label="대표 손에 남길 금액(세후)" />
                    <WonHint text={st.cashTarget} />
                  </label>
                  {cash ? <CashRoutes plan={cash} onOpen={onOpenCalc} /> : <p className="t-sub text-slate-500">금액을 적으면 급여 · 배당 · 주식 팔기 · 퇴직금을 모두 계산해 비교합니다.</p>}
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
                    <label className="block max-w-xs">
                      <span className="t-sub font-medium text-slate-700">개인 실효부담률 상한(%)</span>
                      <input value={st.salary.rate} onChange={(e) => setSt((cur) => ({ ...cur, salary: { ...cur.salary, rate: e.target.value } }))} inputMode="decimal" placeholder="예: 20" className={inputCls} aria-label="개인 실효부담률 상한(%)" />
                    </label>
                  )}
                  {st.salary.mode === 'net' && (
                    <label className="block max-w-xs">
                      <span className="t-sub font-medium text-slate-700">세후 월 실수령 목표</span>
                      <input value={st.salary.net} onChange={(e) => setSt((cur) => ({ ...cur, salary: { ...cur.salary, net: e.target.value } }))} placeholder="예: 800만" className={inputCls} aria-label="세후 월 실수령 목표" />
                      <WonHint text={st.salary.net} />
                    </label>
                  )}
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
                      <label className="block">
                        <span className="t-sub font-medium text-slate-700">{st.gift.mode === 'pct' ? '지분(%)' : st.gift.mode === 'shares' ? '주식 수' : st.gift.mode === 'budget' ? '증여세 상한' : '금액'}</span>
                        <input value={st.gift.amount} onChange={(e) => setSt((cur) => ({ ...cur, gift: { ...cur.gift, amount: e.target.value } }))} className={inputCls} aria-label="증여 크기" />
                        {(st.gift.mode === 'value' || st.gift.mode === 'budget') && <WonHint text={st.gift.amount} />}
                      </label>
                    )}
                  </div>
                  {gift && (
                    <Outcome
                      ok={gift.ok}
                      message={gift.message}
                      headline={gift.ok ? `증여세 ${won(gift.tax)}` : ''}
                      lines={gift.ok ? [...gift.lines, `대표 지분 → ${gift.ceoAfterPct.toFixed(1)}% · ${gift.recipient} → ${gift.recipientAfterPct.toFixed(1)}%`] : []}
                      conditions={gift.ok ? gift.conditions : []}
                      basis={gift.basis}
                      open={gift.open}
                      onOpen={onOpenCalc}
                    />
                  )}
                </ResultCard>
              )
            if (g === 'inherit')
              return (
                <ResultCard key={g} title={GOAL_LABEL.inherit} testId="result-inherit">
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
                      open={inherit.open}
                      onOpen={onOpenCalc}
                    />
                  )}
                </ResultCard>
              )
            if (g === 'loan')
              return (
                <ResultCard key={g} title={GOAL_LABEL.loan} testId="result-loan">
                  {loan && (
                    <Outcome
                      ok={loan.ok}
                      message={loan.message || '회사 · 대표 칸에 가지급금 잔액을 적어 주세요.'}
                      headline={loan.ok ? `해마다 ${krw(loan.yearLoss)} 손해` : ''}
                      lines={loan.ok ? [...loan.lines, `5년 ${krw(loan.fiveYear)} · 10년 ${krw(loan.tenYear)}`] : []}
                      basis={loan.basis}
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
                {retire && (
                  <Outcome
                    ok={retire.ok}
                    message={retire.message}
                    headline={retire.ok ? `한도 ${krw(retire.limit)} · 세후 ${krw(retire.net)}` : ''}
                    lines={retire.ok ? [...retire.lines, `퇴직소득세(지방세 포함) ${won(retire.tax)}`] : []}
                    conditions={retire.ok ? ['실제로 퇴임할 때만 받을 수 있습니다 — 정관에 임원 퇴직금 규정이 있어야 합니다.'] : []}
                    basis={retire.basis}
                    open={retire.open}
                    onOpen={onOpenCalc}
                  />
                )}
              </ResultCard>
            )
          })}
        </section>
      )}

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
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 작은 부품                                                             */
/* ------------------------------------------------------------------ */

function WonHint({ text }: { text: string }) {
  const n = wonOf(text)
  if (!text.trim()) return null
  return <span className={`t-meta mt-1 block ${n > 0 ? 'text-slate-500' : 'text-danger-700'}`}>{n > 0 ? `= ${n.toLocaleString('ko-KR')}원` : '금액을 읽지 못했습니다 (예: 1억 2천만)'}</span>
}

type SetProfile = (k: ProfileKey, v: string) => void

function MoneyField({ k, st, set }: { k: ProfileKey; st: PlanState; set: SetProfile }) {
  const v = st.profile[k] ?? ''
  return (
    <label className="block">
      <span className="t-sub font-medium text-slate-700">{PROFILE_FIELDS[k]}</span>
      <input value={v} onChange={(e) => set(k, e.target.value)} placeholder="예: 1억 2천만" className={inputCls} aria-label={PROFILE_FIELDS[k]} data-field={k} />
      <WonHint text={v} />
    </label>
  )
}

function NumberField({ k, st, set, hint }: { k: ProfileKey; st: PlanState; set: SetProfile; hint?: string }) {
  return (
    <label className="block">
      <span className="t-sub font-medium text-slate-700">{PROFILE_FIELDS[k]}</span>
      <input value={st.profile[k] ?? ''} onChange={(e) => set(k, e.target.value)} inputMode="decimal" placeholder={hint} className={inputCls} aria-label={PROFILE_FIELDS[k]} data-field={k} />
    </label>
  )
}

function DateField({ k, st, set }: { k: ProfileKey; st: PlanState; set: SetProfile }) {
  return (
    <label className="block">
      <span className="t-sub font-medium text-slate-700">{PROFILE_FIELDS[k]}</span>
      <input type="date" value={st.profile[k] ?? ''} onChange={(e) => set(k, e.target.value)} className={inputCls} aria-label={PROFILE_FIELDS[k]} data-field={k} />
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
  const others = plan.routes.filter((r) => r.ok && r !== best && r.key !== 'retire')
  const saving = best && others.length > 0 ? Math.min(...others.map((r) => r.netBurden)) - best.netBurden : 0
  return (
    <div className="flex flex-col gap-3">
      {best && (
        <p className="t-body rounded-(--radius-control) border border-brand-200 bg-brand-50 px-3 py-2.5 break-keep text-slate-800" data-testid="route-best">
          <b className="font-bold text-brand-800">추천: {best.label}</b> — 순부담 {krw(best.netBurden)}
          {saving > 0 ? `, 다음으로 싼 방법보다 ${krw(saving)} 적게 냅니다.` : '.'}
        </p>
      )}
      <ol className="flex flex-col gap-3">
        {plan.routes.map((r) => (
          <RouteCard key={r.key} r={r} best={r === best} onOpen={onOpen} />
        ))}
      </ol>
      {plan.notes.length > 0 && (
        <ul className="t-sub list-disc pl-5 break-keep text-slate-600">
          {plan.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <p className="t-sub break-keep text-slate-500">순부담 = 대표가 내는 세금(4대보험 포함) − 회사가 덜 내는 법인세. 적을수록 좋습니다.</p>
    </div>
  )
}

function RouteCard({ r, best, onOpen }: { r: CashRoute; best: boolean; onOpen: (o: CalcOpen) => void }) {
  return (
    <li className={`flex flex-col gap-2 rounded-(--radius-control) border p-3 ${best ? 'border-brand-500 bg-white' : r.ok ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50'}`} data-route={r.key} data-ok={r.ok}>
      <div className="flex flex-wrap items-center gap-2">
        {best && <span className="t-meta rounded-full bg-brand-600 px-2 py-0.5 font-bold text-white">추천</span>}
        <span className="t-card font-bold break-keep text-slate-900">{r.label}</span>
      </div>
      {r.ok ? (
        <>
          <p className="text-[1.15rem] font-bold text-navy-900 tabular-nums">순부담 {krw(r.netBurden)}</p>
          <dl className="t-sub grid grid-cols-1 gap-x-4 gap-y-0.5 text-slate-700 sm:grid-cols-2">
            {(
              [
                ['대표 세금', r.personalTax],
                ['법인세 절감', r.corpSaving],
                ['회사에서 나가는 돈', r.companyOut],
                ['대표 손에', r.net],
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
      <div className="flex flex-wrap items-center gap-2">
        <OpenButton open={r.open} onOpen={onOpen} />
      </div>
      {r.basis.length > 0 && <Basis basis={r.basis} />}
    </li>
  )
}
