/**
 * 기업인증 화면 조각 (D-170) — OS 의 Badge · Button · 글자 단계(t-*) · 색 토큰만 쓴다. 따로 디자인을 만들지 않는다.
 * 색만으로 뜻을 전하지 않는다 — 모든 등급 · 상태에 글자가 같이 있다.
 */
import { useState, type ReactNode } from 'react'
import { Check, CircleHelp, Copy, MessageSquareText, Triangle, X } from 'lucide-react'
import { Badge, BottomSheet } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { READINESS_LABEL, RECOMMENDATION_LABEL, type BenefitPick, type CheckState, type Readiness, type Reason, type Recommendation } from '../core/types'
import type { ExplainSet } from '../core/explain'
import type { CertRule } from '../rules/officialRules'
import { STEP_LABEL } from './certNav'

type Tone = 'neutral' | 'brand' | 'danger' | 'warning' | 'success'

const REC_TONE: Record<Recommendation, Tone> = {
  held: 'success',
  now: 'success',
  possible: 'brand',
  after_fix: 'warning',
  too_early: 'neutral',
  low_priority: 'neutral',
  not_needed: 'neutral',
  need_info: 'warning',
}

const READY_TONE: Record<Readiness, Tone> = {
  very_high: 'success',
  high: 'success',
  medium: 'brand',
  low: 'warning',
  very_low: 'danger',
  unknown: 'warning',
}

/** FV: 준비도 배지는 진행할 인증에만 — '우선순위 낮음 · 필요 없음 · 추가 확인 필요' 에는 배지를 하나만(덜 복잡하게) */
export function showReadiness(a: { recommendation: Recommendation; readiness: Readiness }): boolean {
  if (a.recommendation === 'need_info' && a.readiness === 'unknown') return false
  return a.recommendation !== 'low_priority' && a.recommendation !== 'not_needed'
}

export function RecBadge({ rec }: { rec: Recommendation }) {
  return (
    <Badge tone={REC_TONE[rec]} className="font-semibold">
      <span data-testid="cert-rec" data-rec={rec}>
        {RECOMMENDATION_LABEL[rec]}
      </span>
    </Badge>
  )
}

export function ReadinessBadge({ r }: { r: Readiness }) {
  return (
    <Badge tone={READY_TONE[r]}>
      <span data-testid="cert-readiness" data-readiness={r}>
        {r === 'unknown' ? READINESS_LABEL[r] : `준비도 ${READINESS_LABEL[r]}`}
      </span>
    </Badge>
  )
}

/** P1: 이전 인증 만료(연장 기간도 지남) — 보유 중으로 보이지 않게 */
export function ExpiredBadge() {
  return (
    <Badge tone="danger" className="font-semibold">
      <span data-testid="cert-expired">이전 인증 만료</span>
    </Badge>
  )
}

const MARK: Record<CheckState, { icon: ReactNode; cls: string; sr: string }> = {
  ok: { icon: <Check aria-hidden="true" className="size-4 shrink-0 text-success-600" />, cls: 'text-slate-800', sr: '충족' },
  warn: { icon: <Triangle aria-hidden="true" className="size-3.5 shrink-0 text-warning-600" />, cls: 'text-warning-800', sr: '보강 필요' },
  no: { icon: <X aria-hidden="true" className="size-4 shrink-0 text-danger-600" />, cls: 'text-danger-700', sr: '미충족' },
  unknown: { icon: <CircleHelp aria-hidden="true" className="size-4 shrink-0 text-warning-600" />, cls: 'text-warning-800', sr: '확인 필요' },
}

export function ReasonList({ reasons, max }: { reasons: Reason[]; max?: number }) {
  const shown = max ? reasons.slice(0, max) : reasons
  return (
    <ul className="flex flex-col gap-1" data-testid="cert-reasons">
      {shown.map((r, i) => (
        <li key={`${r.text}-${i}`} className={`t-sub flex items-start gap-1.5 break-keep ${MARK[r.state].cls}`}>
          <span className="mt-0.5 flex w-4 justify-center">{MARK[r.state].icon}</span>
          <span className="sr-only">{MARK[r.state].sr}: </span>
          <span className="min-w-0">{r.text}</span>
        </li>
      ))}
    </ul>
  )
}

/** 이 업체에 특히 유용한 혜택 — 칩을 누르면 '왜 추천했나요?' */
export function BenefitPicks({ picks }: { picks: BenefitPick[] }) {
  const [open, setOpen] = useState('')
  if (picks.length === 0) return null
  const cur = picks.find((p) => p.id === open)
  return (
    <div className="flex flex-col gap-2" data-testid="cert-benefits">
      <span className="t-meta font-semibold text-slate-600">이 업체에 특히 유용</span>
      <div className="flex flex-wrap gap-2">
        {picks.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-expanded={open === p.id}
            onClick={() => setOpen((v) => (v === p.id ? '' : p.id))}
            className={`tap t-sub min-h-10 rounded-full border px-3 font-semibold ${open === p.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-brand-200 bg-brand-50 text-brand-800'}`}
            data-testid="cert-benefit"
          >
            {p.title}
          </button>
        ))}
      </div>
      {cur && (
        <p className="t-sub rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2 break-keep text-slate-700" data-testid="cert-benefit-why">
          <b className="font-semibold">왜 추천했나요?</b> {cur.why}
          {cur.conditional && <span className="mt-1 block text-warning-800">적용 여부 추가 확인 필요 — 기관 · 시기 · 조건에 따라 달라집니다.</span>}
        </p>
      )}
    </div>
  )
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** 고객에게 설명하기 — 30초 · 카톡 · 준비서류 · 미팅용(누르면 내용이 보이고 복사) */
export function ExplainBox({ set, first = 'thirty' }: { set: ExplainSet; first?: Exclude<keyof ExplainSet, 'fit'> }) {
  const { showToast } = useToast()
  type Tab = Exclude<keyof ExplainSet, 'fit'>
  const [k, setK] = useState<Tab>(first)
  const LABEL: Record<Tab, string> = { thirty: '30초 설명', kakao: '카톡으로 설명', docRequest: '준비서류 요청', meeting: '미팅용 설명' }
  return (
    <div className="flex flex-col gap-2" data-testid="cert-explain">
      {set.fit && (
        <p className="t-sub rounded-(--radius-control) bg-brand-50 px-3 py-2 break-keep text-brand-700" data-testid="cert-explain-fit">
          {set.fit}
        </p>
      )}
      <div className="flex flex-wrap gap-2" role="tablist">
        {(Object.keys(LABEL) as Tab[]).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={k === key} onClick={() => setK(key)} className={`tap t-sub min-h-10 rounded-full border px-3 font-semibold ${k === key ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-700'}`} data-testid={`cert-explain-${key}`}>
            {LABEL[key]}
          </button>
        ))}
      </div>
      <pre className="t-sub rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3 font-sans whitespace-pre-wrap break-keep text-slate-800" data-testid="cert-explain-text">
        {set[k]}
      </pre>
      <Button
        variant="secondary"
        className="self-start"
        onClick={() => void copy(set[k]).then((ok) => showToast(ok ? `${LABEL[k]} 문구를 복사했습니다` : '복사하지 못했습니다 — 글을 길게 눌러 복사해 주세요'))}
        data-testid="cert-explain-copy"
      >
        <Copy aria-hidden="true" className="size-4" /> 복사
      </Button>
    </div>
  )
}


/** AX: [고객에게 설명하기] — 탭 넷을 늘 펼쳐 두지 않고 단추 하나 → 시트 */
export function ExplainButton({ set, first = 'thirty', variant = 'secondary' }: { set: ExplainSet; first?: Exclude<keyof ExplainSet, 'fit'>; variant?: 'secondary' | 'ghost' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={variant} size="sm" className="self-start" onClick={() => setOpen(true)} data-testid="cert-explain-open">
        <MessageSquareText aria-hidden="true" className="size-4" /> 고객에게 설명하기
      </Button>
      {open && (
        <BottomSheet title="고객에게 설명하기" onClose={() => setOpen(false)}>
          <ExplainBox set={set} first={first} />
        </BottomSheet>
      )}
    </>
  )
}

export function StepTabs({ step, onStep }: { step: number; onStep: (n: number) => void }) {
  return (
    <div role="tablist" className="grid grid-cols-2 gap-1.5 rounded-(--radius-control) border border-slate-200 bg-slate-50 p-1 sm:grid-cols-4" data-testid="cert-steps">
      {STEP_LABEL.map((l, i) => (
        <button key={l} type="button" role="tab" aria-selected={step === i} onClick={() => onStep(i)} className={`tap t-sub min-h-11 rounded-[8px] px-2 font-semibold break-keep ${step === i ? 'bg-white text-slate-900 shadow-(--shadow-card)' : 'text-slate-600'}`} data-testid={`cert-step-${i}`}>
          {i + 1}. {l}
        </button>
      ))}
    </div>
  )
}

/**
 * AX Hotfix: [공식 평가구조 보기] — 공식 점수 기준 · 업종별 지표(메인비즈 2026 개편)를 접어서. MIRAE 사전진단과 섞지 않는다.
 */
export function OfficialStructure({ rule, testid = 'cert-official' }: { rule: CertRule; testid?: string }) {
  if (!rule.officialScores && !rule.officialStructure) return null
  return (
    <details className="rounded-(--radius-control) border border-slate-200 bg-slate-50" data-testid={`${testid}-box`}>
      <summary className="tap t-sub cursor-pointer px-3 py-2 font-semibold text-slate-800">공식 평가구조 보기(기관 점수 — MIRAE 판단과 별개)</summary>
      <div className="flex flex-col gap-2 px-3 pb-3" data-testid={testid}>
        {rule.officialScores && (
          <ul className="flex flex-col gap-0.5">
            {rule.officialScores.map((x) => (
              <li key={x.label} className="t-sub break-keep text-slate-700">
                · {x.label}: <b className="font-semibold">{x.value}</b>
              </li>
            ))}
          </ul>
        )}
        {rule.officialStructure && (
          <div className="flex flex-col gap-1 border-t border-slate-200 pt-2" data-testid="cert-official-structure">
            <p className="t-sub font-semibold text-slate-800">{rule.officialStructure.title}</p>
            <ul className="flex flex-col gap-0.5">
              {rule.officialStructure.rows.map((r) => (
                <li key={r.label} className="t-sub break-keep text-slate-700">
                  · <b className="font-semibold">{r.label}</b> — {r.value}
                </li>
              ))}
            </ul>
            <p className="t-sub break-keep text-slate-500">{rule.officialStructure.note}</p>
          </div>
        )}
      </div>
    </details>
  )
}
