/**
 * 자가진단 · 실사 대비 흐름 (D-170) — 한 화면에 한 질문. 고르면 바로 저장된다.
 * 자가진단: 질문 → 쉬운 설명 → 기록으로 미리 고른 답(근거) → 선택 → 필요한 증빙 · 지금 있는 증빙.
 * 실사 대비: 예상 질문 → 의도 → 기록에서 찾은 것 → 쓸 증빙 → 답변 초안 → [이대로] [고치기] [대표 확인 필요].
 */
import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { ANSWER_LABEL, ITEM_VERDICT_LABEL, runSelfCheck, type Answer, type SelfCheckItem } from '../core/selfCheck'
import { inspectionCards, mockInspection, PREP_STATE_LABEL, type InspectionQuestion, type PreparedAnswer } from '../core/inspection'
import type { CertificationClientContext } from '../core/types'
import type { CertRule } from '../rules/officialRules'
import { ReadinessBadge } from './certParts'

function Pager({ i, n, onPrev, onNext, nextLabel }: { i: number; n: number; onPrev: () => void; onNext: () => void; nextLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" onClick={onPrev} disabled={i === 0} data-testid="flow-prev">
        <ArrowLeft aria-hidden="true" className="size-4" /> 앞
      </Button>
      <span className="t-sub tabular-nums text-slate-600" data-testid="flow-pos">
        {i + 1} / {n}
      </span>
      <Button variant="primary" onClick={onNext} data-testid="flow-next">
        {nextLabel} <ArrowRight aria-hidden="true" className="size-4" />
      </Button>
    </div>
  )
}

function EvidenceLine({ have, missing }: { have: string[]; missing: string[] }) {
  if (have.length + missing.length === 0) return null
  return (
    <ul className="flex flex-col gap-1">
      {have.map((h) => (
        <li key={h} className="t-sub flex items-start gap-1.5 text-success-700">
          <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> <span className="break-keep">{h} — 있음</span>
        </li>
      ))}
      {missing.map((m) => (
        <li key={m} className="t-sub flex items-start gap-1.5 text-warning-800">
          <X aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> <span className="break-keep">{m} — 받아야 함</span>
        </li>
      ))}
    </ul>
  )
}

export function SelfCheckFlow({ rule, items, ctx, answers, onAnswer, onDone }: { rule: CertRule; items: SelfCheckItem[]; ctx: CertificationClientContext; answers: Record<string, Answer>; onAnswer: (id: string, a: Answer) => void; onDone: () => void }) {
  const [i, setI] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const result = useMemo(() => runSelfCheck(items, ctx, answers), [items, ctx, answers])
  if (showResult) {
    return (
      <Surface>
        <div className="flex flex-col gap-3" data-testid="selfcheck-result">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="t-section font-bold text-slate-900">{rule.label} 준비 점검 결과</h3>
            <ReadinessBadge r={result.readiness} />
          </div>
          <p className="t-sub break-keep text-slate-600">MIRAE 준비 점검(자체 5단계)입니다. 공식 점수는 아래 공식 기준으로 확인하세요.</p>
          {rule.officialScores && (
            <div className="rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3" data-testid="selfcheck-official">
              <p className="t-sub font-semibold text-slate-800">공식 기준</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {rule.officialScores.map((s) => (
                  <li key={s.label} className="t-sub break-keep text-slate-700">
                    · {s.label}: <b className="font-semibold">{s.value}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.strengths.length > 0 && <Block title="강점" tone="text-success-700" lines={result.strengths} />}
          {result.gaps.length > 0 && <Block title="보완 · 증빙 보강" tone="text-warning-800" lines={result.gaps} />}
          {result.confirm.length > 0 && <Block title="대표 확인 필요" tone="text-warning-800" lines={result.confirm} />}
          {result.prepare.length > 0 && <Block title="실사 전에 준비할 자료" tone="text-slate-800" lines={result.prepare} />}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={onDone} data-testid="selfcheck-to-inspection">
              실사 대비 시작
            </Button>
            <Button variant="ghost" onClick={() => setShowResult(false)}>
              답 고치기
            </Button>
          </div>
        </div>
      </Surface>
    )
  }
  const r = result.items[i]
  return (
    <Surface>
      <div className="flex flex-col gap-3" data-testid="selfcheck-card" data-id={r.item.id}>
        <span className="t-meta font-semibold text-brand-700">{r.item.area}</span>
        <h3 className="t-section font-bold break-keep text-slate-900">{r.item.question}</h3>
        <p className="t-body break-keep text-slate-700">{r.item.plain}</p>
        {r.suggested && r.because && (
          <p className="t-sub rounded-(--radius-control) border border-brand-200 bg-brand-50 px-3 py-2 break-keep text-brand-900" data-testid="selfcheck-suggest">
            기록으로 미리 골랐어요: <b className="font-semibold">{ANSWER_LABEL[r.answer]}</b> — {r.because}
          </p>
        )}
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="답">
          {(['yes', 'partly', 'no', 'unknown'] as Answer[]).map((a) => (
            <button key={a} type="button" role="radio" aria-checked={r.answer === a} onClick={() => onAnswer(r.item.id, a)} className={`tap t-body min-h-11 min-w-20 rounded-full border px-4 font-semibold ${r.answer === a ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`} data-testid={`selfcheck-answer-${a}`}>
              {ANSWER_LABEL[a]}
            </button>
          ))}
        </div>
        <EvidenceLine have={r.haveEvidence} missing={r.missingEvidence} />
        <p className="t-sub font-semibold text-slate-800" data-testid="selfcheck-verdict">
          판정: {ITEM_VERDICT_LABEL[r.verdict]}
        </p>
        {r.item.fieldRisk && <p className="t-sub break-keep text-slate-600">현장에서: {r.item.fieldRisk}</p>}
        <Pager i={i} n={items.length} onPrev={() => setI((v) => Math.max(0, v - 1))} onNext={() => (i + 1 < items.length ? setI(i + 1) : setShowResult(true))} nextLabel={i + 1 < items.length ? '다음' : '결과 보기'} />
      </div>
    </Surface>
  )
}

function Block({ title, tone, lines }: { title: string; tone: string; lines: string[] }) {
  return (
    <div>
      <p className={`t-sub font-semibold ${tone}`}>{title}</p>
      <ul className="mt-0.5 flex flex-col gap-0.5">
        {lines.map((l) => (
          <li key={l} className="t-sub break-keep text-slate-700">
            · {l}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function InspectionFlow({ qs, ctx, labelOf, prep, onPrep }: { qs: InspectionQuestion[]; ctx: CertificationClientContext; labelOf: (id: string) => string; prep: Record<string, PreparedAnswer>; onPrep: (id: string, p: PreparedAnswer) => void }) {
  const cards = useMemo(() => inspectionCards(qs, ctx, labelOf), [qs, ctx, labelOf])
  const [i, setI] = useState(0)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [mock, setMock] = useState(false)
  const result = useMemo(() => mockInspection(cards, prep), [cards, prep])
  if (mock) {
    return (
      <Surface>
        <div className="flex flex-col gap-3" data-testid="mock-result">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="t-section font-bold text-slate-900">실사 대비 상태</h3>
            <ReadinessBadge r={result.readiness} />
          </div>
          <p className="t-sub text-slate-600">
            질문 {result.total}개 중 {result.answered}개 준비 · 점수가 아니라 5단계로 봅니다.
          </p>
          {result.strengths.length > 0 && <Block title="강점" tone="text-success-700" lines={result.strengths} />}
          {result.needs.length > 0 && <Block title="보완 필요(자료)" tone="text-warning-800" lines={result.needs} />}
          {result.ownerConfirm.length > 0 && <Block title="실사 전 반드시 확인(대표 답)" tone="text-danger-700" lines={result.ownerConfirm} />}
          <Button variant="ghost" className="self-start" onClick={() => setMock(false)}>
            질문으로 돌아가기
          </Button>
        </div>
      </Surface>
    )
  }
  const k = cards[i]
  const p = prep[k.q.id]
  return (
    <Surface>
      <div className="flex flex-col gap-3" data-testid="inspection-card" data-id={k.q.id}>
        <span className="t-meta font-semibold text-brand-700">예상 질문</span>
        <h3 className="t-section font-bold break-keep text-slate-900">"{k.q.question}"</h3>
        <p className="t-sub break-keep text-slate-600">
          <b className="font-semibold">질문 의도</b> · {k.q.intent}
        </p>
        {k.facts.length > 0 && (
          <p className="t-sub break-keep text-slate-700">
            <b className="font-semibold">기록에서 확인된 것</b> · {k.facts.join(' · ')}
          </p>
        )}
        <EvidenceLine have={k.haveEvidence} missing={k.missingEvidence} />
        {editing ? (
          <label className="flex flex-col gap-1">
            <span className="t-sub font-semibold text-slate-800">답변 고치기</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="t-body w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none" data-testid="inspection-edit" />
          </label>
        ) : k.draft || p?.text ? (
          <div className="rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3">
            <p className="t-meta font-semibold text-slate-600">{p?.state === 'edited' ? '고친 답변' : '답변 초안'} — [ ] 는 대표님 말로 채우세요</p>
            <p className="t-body mt-1 break-keep text-slate-800" data-testid="inspection-draft">
              {p?.state === 'edited' && p.text ? p.text : k.draft}
            </p>
          </div>
        ) : (
          <p className="t-body rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2 break-keep text-warning-800" data-testid="inspection-owner">
            기록에 근거가 없어 초안을 만들지 않았습니다 — 대표 확인 필요
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {editing ? (
            <Button
              variant="primary"
              onClick={() => {
                onPrep(k.q.id, { state: 'edited', text: text.trim() })
                setEditing(false)
              }}
              disabled={!text.trim()}
            >
              저장
            </Button>
          ) : (
            <>
              <Button variant={p?.state === 'ok' ? 'primary' : 'secondary'} onClick={() => onPrep(k.q.id, { state: 'ok' })} disabled={!k.draft && p?.state !== 'edited'} data-testid="inspection-ok">
                이대로
              </Button>
              <Button
                variant={p?.state === 'edited' ? 'primary' : 'secondary'}
                onClick={() => {
                  setText(p?.text ?? k.draft ?? '')
                  setEditing(true)
                }}
                data-testid="inspection-edit-open"
              >
                고치기
              </Button>
              <Button variant={p?.state === 'confirm' ? 'primary' : 'secondary'} onClick={() => onPrep(k.q.id, { state: 'confirm' })} data-testid="inspection-confirm">
                대표 확인 필요
              </Button>
            </>
          )}
        </div>
        {p && <p className="t-sub font-semibold text-slate-700">지금: {PREP_STATE_LABEL[p.state]}</p>}
        <Pager
          i={i}
          n={cards.length}
          onPrev={() => {
            setEditing(false)
            setI((v) => Math.max(0, v - 1))
          }}
          onNext={() => {
            setEditing(false)
            if (i + 1 < cards.length) setI(i + 1)
            else setMock(true)
          }}
          nextLabel={i + 1 < cards.length ? '다음 질문' : '모의 실사 결과'}
        />
      </div>
    </Surface>
  )
}
