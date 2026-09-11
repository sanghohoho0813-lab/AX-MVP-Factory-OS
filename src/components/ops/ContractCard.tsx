/**
 * 계약 — 한눈에 보고, 눌러서 고친다.
 *
 * 대표가 업체를 열었을 때 가장 먼저 확인하는 것 중 하나가 "이 회사 언제 계약했지,
 * 얼마짜리였지" 다. 그 답을 카드 한 장에 두고, 자세한 것(보험 건별 월납보험료·가입일)은
 * 눌러야 나온다.
 *
 * 금액을 지어내지 않는다 — 안 적은 값은 줄이 비어 있다.
 */

import { useState } from 'react'
import { CalendarCheck2, ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  CONTRACT_KIND_HINT,
  CONTRACT_KIND_LABEL,
  CONTRACT_KIND_ORDER,
  type ClientOpsRecord,
  type ContractInfo,
  type ContractKind,
  type InsurancePolicy,
} from '../../types/clientOps'
import { monthlyPremiumTotal, summarizeContract } from '../../services/contractSummary'
import { formatKrw } from '../../lib/format'
import { BottomSheet } from '../ui/primitives'
import { Button } from '../ui/Button'

/** 숫자 입력 — 빈 칸이면 null(모름), 숫자면 원 단위 */
function amountOf(text: string): number | null {
  const d = text.replace(/[^0-9]/g, '')
  return d === '' ? null : Number(d)
}

/**
 * 적는 동안에도 자리점을 찍어 준다 — `8000000` 은 몇 자리인지 세어야 하고, 세다 틀린다.
 * 저장은 언제나 숫자만 남긴다.
 */
function withCommas(text: string): string {
  const n = amountOf(text)
  return n === null ? '' : n.toLocaleString('ko-KR')
}

function newPolicy(): InsurancePolicy {
  return {
    id: `pol_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    insurer: '',
    productName: '',
    monthlyPremium: null,
    startedAt: '',
    payTerm: '',
    note: '',
  }
}

/* ------------------------------------------------------------------ */
/* 요약 카드                                                             */
/* ------------------------------------------------------------------ */

export function ContractCard({
  record,
  today,
  onSave,
}: {
  record: ClientOpsRecord
  today: string
  onSave: (next: ContractInfo) => void
}) {
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const c = record.contract
  const s = summarizeContract(c, today)
  const premium = monthlyPremiumTotal(c)

  return (
    <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <h2 className="t-section text-slate-900">계약</h2>
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          <Pencil aria-hidden="true" className="size-3.5" />
          {s.hasAny ? '계약 고치기' : '계약 정보 적기'}
        </Button>
      </div>

      {!s.hasAny ? (
        <p className="t-sub mt-2 break-keep text-slate-500">
          언제 · 어떤 방식으로 · 얼마에 계약했는지 적어 두면 여기서 한눈에 보입니다.
        </p>
      ) : (
        <>
          {/* 한눈에 — 언제 · 몇 달째 · 어떤 방식 */}
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {s.signedAt !== '' && (
              <span className="t-body inline-flex items-center gap-1.5 font-semibold text-slate-900">
                <CalendarCheck2 aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                <span className="tabular-nums">{s.signedAt}</span>
              </span>
            )}
            {s.ageText !== '' && (
              <span className="t-sub inline-flex shrink-0 items-center rounded-full bg-brand-50 px-2 py-0.5 font-bold text-brand-700 tabular-nums">
                {s.ageText}
              </span>
            )}
            {s.kindLabel !== '' && (
              <span className="t-sub rounded-full border border-slate-200 px-2 py-0.5 font-medium text-slate-700">{s.kindLabel}</span>
            )}
          </div>

          {/* 얼마에 */}
          {s.moneyText !== '' && <p className="t-body mt-2 font-semibold text-slate-800">{s.moneyText}</p>}
          {c.note.trim() !== '' && <p className="t-sub mt-1 break-keep text-slate-600">{c.note}</p>}

          {/* 자세한 것은 눌러야 나온다 */}
          {c.policies.length > 0 && (
            <>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="tap t-sub mt-3 inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-brand-700"
              >
                {open ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
                보험 {c.policies.length}건 {open ? '접기' : '자세히'}
                {premium !== null && !open && <span className="text-slate-500">· 월 {formatKrw(premium)}</span>}
              </button>
              {open && (
                <ul className="mt-2 flex flex-col gap-2">
                  {c.policies.map((p) => (
                    <li key={p.id} className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
                      <p className="t-body font-semibold break-keep text-slate-900">
                        {p.insurer || '보험사 미기재'}
                        {p.productName !== '' && <span className="font-normal text-slate-600"> · {p.productName}</span>}
                      </p>
                      <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                        {p.monthlyPremium !== null && (
                          <div className="flex items-baseline gap-1.5">
                            <dt className="t-sub text-slate-500">월납보험료</dt>
                            <dd className="t-body font-semibold tabular-nums text-slate-900">{formatKrw(p.monthlyPremium)}</dd>
                          </div>
                        )}
                        {p.startedAt !== '' && (
                          <div className="flex items-baseline gap-1.5">
                            <dt className="t-sub text-slate-500">가입일</dt>
                            <dd className="t-body tabular-nums text-slate-800">{p.startedAt}</dd>
                          </div>
                        )}
                        {p.payTerm !== '' && (
                          <div className="flex items-baseline gap-1.5">
                            <dt className="t-sub text-slate-500">납입기간</dt>
                            <dd className="t-body text-slate-800">{p.payTerm}</dd>
                          </div>
                        )}
                      </dl>
                      {p.note.trim() !== '' && <p className="t-sub mt-1 break-keep text-slate-600">{p.note}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}

      {editing && <ContractSheet contract={c} onClose={() => setEditing(false)} onSave={(next) => { onSave(next); setEditing(false) }} />}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 편집 시트                                                             */
/* ------------------------------------------------------------------ */

function ContractSheet({
  contract,
  onSave,
  onClose,
}: {
  contract: ContractInfo
  onSave: (next: ContractInfo) => void
  onClose: () => void
}) {
  const [signedAt, setSignedAt] = useState(contract.signedAt)
  const [kind, setKind] = useState<ContractKind | ''>(contract.kind)
  const [cash, setCash] = useState(contract.cashAmount === null ? '' : String(contract.cashAmount))
  const [note, setNote] = useState(contract.note)
  const [policies, setPolicies] = useState<InsurancePolicy[]>(contract.policies)

  /** 방식에 따라 물어볼 것이 달라진다 — 현금 계약에 보험 칸을 보여 주지 않는다 */
  const wantsCash = kind === 'cash' || kind === 'mixed' || kind === ''
  const wantsInsurance = kind === 'insurance' || kind === 'mixed'

  const patch = (id: string, p: Partial<InsurancePolicy>) =>
    setPolicies((cur) => cur.map((x) => (x.id === id ? { ...x, ...p } : x)))

  const save = () =>
    onSave({
      signedAt: signedAt.trim(),
      kind,
      cashAmount: wantsCash ? amountOf(cash) : null,
      policies: wantsInsurance ? policies.filter((p) => p.insurer.trim() !== '' || p.productName.trim() !== '' || p.monthlyPremium !== null) : [],
      note: note.trim(),
    })

  return (
    <BottomSheet
      title="계약 정보"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={save}>
            저장
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="t-sub font-medium text-slate-700">계약일</span>
          <input
            type="date"
            value={signedAt}
            onChange={(e) => setSignedAt(e.target.value)}
            className="t-body mt-1 h-12 w-full rounded-(--radius-control) border border-slate-300 px-3"
          />
        </label>

        <div>
          <span className="t-sub font-medium text-slate-700">어떤 방식으로 계약했나요?</span>
          <div className="mt-1.5 flex flex-col gap-2">
            {CONTRACT_KIND_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(kind === k ? '' : k)}
                className={`tap flex w-full items-start gap-3 rounded-(--radius-card) border px-4 py-3 text-left ${
                  kind === k ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-400' : 'border-slate-200 bg-white hover:border-brand-300'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="t-body block font-semibold text-slate-900">{CONTRACT_KIND_LABEL[k]}</span>
                  <span className="t-sub mt-0.5 block break-keep text-slate-600">{CONTRACT_KIND_HINT[k]}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {wantsCash && (
          <label className="block">
            <span className="t-sub font-medium text-slate-700">현금 계약 금액</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                inputMode="numeric"
                aria-label="현금 계약 금액"
                value={withCommas(cash)}
                placeholder="예: 5,000,000"
                onChange={(e) => setCash(e.target.value.replace(/[^0-9]/g, ''))}
                className="t-body h-12 min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 px-3 text-right tabular-nums"
              />
              <span className="t-body shrink-0 text-slate-600">원</span>
            </div>
          </label>
        )}

        {wantsInsurance && (
          <div>
            <span className="t-sub font-medium text-slate-700">보험 계약</span>
            <div className="mt-1.5 flex flex-col gap-3">
              {policies.map((p, i) => (
                <div key={p.id} className="rounded-(--radius-card) border border-slate-200 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="t-sub font-semibold text-slate-700">{i + 1}번째</span>
                    <button
                      type="button"
                      aria-label={`${i + 1}번째 보험 지우기`}
                      onClick={() => setPolicies((cur) => cur.filter((x) => x.id !== p.id))}
                      className="tap rounded p-1 text-slate-400 hover:bg-danger-50 hover:text-danger-700"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-col gap-2">
                    <input
                      aria-label={`${i + 1}번째 보험사`}
                      value={p.insurer}
                      placeholder="보험사"
                      onChange={(e) => patch(p.id, { insurer: e.target.value })}
                      className="t-body h-11 w-full rounded-(--radius-control) border border-slate-300 px-3"
                    />
                    <input
                      aria-label={`${i + 1}번째 상품명`}
                      value={p.productName}
                      placeholder="상품명"
                      onChange={(e) => patch(p.id, { productName: e.target.value })}
                      className="t-body h-11 w-full rounded-(--radius-control) border border-slate-300 px-3"
                    />
                    <label className="block">
                      <span className="t-sub text-slate-600">월납보험료</span>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          inputMode="numeric"
                          aria-label={`${i + 1}번째 월납보험료`}
                          value={p.monthlyPremium === null ? '' : p.monthlyPremium.toLocaleString('ko-KR')}
                          placeholder="예: 350,000"
                          onChange={(e) => patch(p.id, { monthlyPremium: amountOf(e.target.value) })}
                          className="t-body h-11 min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 px-3 text-right tabular-nums"
                        />
                        <span className="t-body shrink-0 text-slate-600">원</span>
                      </div>
                    </label>
                    <label className="block">
                      <span className="t-sub text-slate-600">가입일</span>
                      <input
                        type="date"
                        aria-label={`${i + 1}번째 가입일`}
                        value={p.startedAt}
                        onChange={(e) => patch(p.id, { startedAt: e.target.value })}
                        className="t-body mt-1 h-11 w-full rounded-(--radius-control) border border-slate-300 px-3"
                      />
                    </label>
                    <input
                      aria-label={`${i + 1}번째 납입기간`}
                      value={p.payTerm}
                      placeholder="납입기간 — 예: 10년납 · 전기납"
                      onChange={(e) => patch(p.id, { payTerm: e.target.value })}
                      className="t-body h-11 w-full rounded-(--radius-control) border border-slate-300 px-3"
                    />
                    <input
                      aria-label={`${i + 1}번째 메모`}
                      value={p.note}
                      placeholder="메모 — 예: 계약자 법인 · 피보험자 대표"
                      onChange={(e) => patch(p.id, { note: e.target.value })}
                      className="t-body h-11 w-full rounded-(--radius-control) border border-slate-300 px-3"
                    />
                  </div>
                </div>
              ))}
              <Button variant="secondary" onClick={() => setPolicies((cur) => [...cur, newPolicy()])}>
                <Plus aria-hidden="true" className="size-4" /> 보험 계약 추가
              </Button>
            </div>
            {/* 주민등록번호는 어떤 칸에도 넣지 않는다 (CLAUDE.md) */}
            <p className="t-sub mt-2 break-keep text-slate-500">주민등록번호·증권번호는 여기에 적지 않습니다.</p>
          </div>
        )}

        <label className="block">
          <span className="t-sub font-medium text-slate-700">계약 조건 메모</span>
          <textarea
            value={note}
            rows={3}
            placeholder="예: 벤처인증 성공 시 성공보수 300만원 추가"
            onChange={(e) => setNote(e.target.value)}
            className="t-body mt-1 w-full resize-y rounded-(--radius-control) border border-slate-300 px-3 py-2.5"
          />
        </label>
      </div>
    </BottomSheet>
  )
}
