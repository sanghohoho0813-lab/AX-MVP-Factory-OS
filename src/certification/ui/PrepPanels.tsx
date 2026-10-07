/**
 * 기업인증 P2 — 준비 묶음 화면들. 문구 · 판단은 전부 Core(inspectionPackage · submitGate · venturePack · handoff)가 만든다.
 * 이 파일은 보여 주고, 복사하고, 대표 답을 받아 적을 뿐이다(AI 호출 없음).
 *
 *   InspectionPackPanel — [실사 준비하기]: A 업체 핵심정보 · B/C 예상 질문과 말하기 가이드 · D 가져갈 자료 · E 전날 체크 · 대표 확인
 *   SubmitGatePanel     — [제출 전 최종 확인]: 제출 준비 가능 / 먼저 확인 필요 · 제출자료 정리 · 모자란 것만 요청
 *   VenturePackPanel    — [벤처 준비 패키지]: 9칸 ✓ / △ / ?
 */
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCopy, Copy, Send } from 'lucide-react'
import { Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { copyText } from '../../components/consulting/studioParts'
import type { Sourced } from '../core/answerGuide'
import { BRING_LABEL, BRING_MARK, inspectionPackageText, ownerKey, ownerQuestionMessage, type InspectionPackage, type PackageQuestion } from '../core/inspectionPackage'
import { GATE_VERDICT_LABEL, missingDocsRequest, type SubmitGate } from '../core/submitGate'
import { PACK_LABEL, PACK_MARK, venturePackText, type VentureSection } from '../core/venturePack'
import { handoffText, type HandoffPackage } from '../core/handoff'

function useCopy() {
  const { showToast } = useToast()
  return async (text: string, done: string) => showToast((await copyText(text)) ? done : '복사하지 못했습니다 — 글을 길게 눌러 복사해 주세요')
}

function Block({ title, children, testid }: { title: string; children: ReactNode; testid: string }) {
  return (
    <section className="flex flex-col gap-1.5" data-testid={testid}>
      <h4 className="t-sub font-bold text-slate-900">{title}</h4>
      {children}
    </section>
  )
}

/** 입력만 되고 확인 전인 값이 있으면 — 왜 안 썼는지 · 어디서 확인하는지 한 줄 */
export function UnconfirmedHint({ count, clientId }: { count: number; clientId: string }) {
  if (count === 0) return null
  return (
    <p className="t-sub break-keep rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2 text-warning-800" data-testid="pack-unconfirmed">
      입력만 되고 확인 전인 회사 정보 {count}개는 답에 쓰지 않았습니다.{' '}
      <Link to={`/ops/clients/${clientId}`} className="tap inline-flex min-h-10 items-center font-semibold underline">
        회사 정보에서 확인하기
      </Link>
    </p>
  )
}

function SourcedLine({ s, mark = '✓' }: { s: Sourced; mark?: string }) {
  return (
    <li className="t-sub break-keep text-slate-800" data-testid="sourced-line" data-basis={s.basis}>
      <span className="font-semibold text-success-700">{mark}</span> {s.text}
      <span className="t-meta block text-slate-500">근거: {s.basis}</span>
    </li>
  )
}

/** AI 로 넘기기 — 복사만. 이 OS 는 AI 를 직접 부르지 않는다 */
export function HandoffButton({ pkg }: { pkg: HandoffPackage }) {
  const copy = useCopy()
  return (
    <Button variant="secondary" onClick={() => void copy(handoffText(pkg), 'AI에 붙여 넣을 자료를 복사했습니다 — 지어내지 말라는 지시도 같이 들어 있습니다')} data-testid="cert-handoff-copy" title="외부 AI 도구에 붙여 넣을 자료를 복사합니다(이 화면은 AI를 부르지 않습니다)">
      <ClipboardCopy aria-hidden="true" className="size-4" /> AI로 다듬기(자료 복사)
    </Button>
  )
}

/* ------------------------------------------------------------------ */
/* 대표님께 확인할 것                                                     */
/* ------------------------------------------------------------------ */

export function OwnerAskBox({
  questions,
  notes,
  onNote,
  companyName,
  certLabel,
  sender,
}: {
  questions: string[]
  notes: Record<string, string>
  onNote: (key: string, text: string) => Promise<void>
  companyName: string
  certLabel: string
  sender: string
}) {
  const copy = useCopy()
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  if (!questions.length) return <p className="t-sub text-success-700" data-testid="owner-ask-none">✓ 대표님께 따로 확인할 것이 없습니다.</p>
  return (
    <div className="flex flex-col gap-2" data-testid="owner-ask">
      <ul className="flex flex-col gap-1.5">
        {questions.map((q) => {
          const k = ownerKey(q)
          return (
            <li key={k} className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2" data-testid="owner-ask-item">
              <div className="flex items-start gap-2">
                <span aria-hidden="true" className="t-sub text-slate-500">□</span>
                <span className="t-sub min-w-0 flex-1 break-keep text-slate-800">{q}</span>
                {open !== k && (
                  <Button size="sm" variant="ghost" onClick={() => { setOpen(k); setDraft(notes[k] ?? '') }} data-testid="owner-answer-open">
                    답 적기
                  </Button>
                )}
              </div>
              {open === k && (
                <div className="flex flex-col gap-1.5">
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} className="t-body w-full rounded-(--radius-control) border border-slate-300 px-3 py-2" placeholder="대표님이 답한 그대로 짧게" aria-label={`${q} — 대표 답`} data-testid="owner-answer-input" />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="primary" disabled={!draft.trim()} onClick={() => void onNote(k, draft.trim()).then(() => setOpen(null))} data-testid="owner-answer-save">
                      저장
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>
                      닫기
                    </Button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <p className="t-meta break-keep text-slate-500">답을 적으면 그 질문은 목록에서 빠지고, 실사 답 가이드에 '대표 답' 근거로 들어갑니다.</p>
      <Button variant="secondary" className="self-start" onClick={() => void copy(ownerQuestionMessage(companyName, certLabel, questions, sender), '대표님께 보낼 카톡 · 문자 문구를 복사했습니다')} data-testid="owner-ask-send">
        <Send aria-hidden="true" className="size-4" /> 대표에게 질문 보내기(문구 복사)
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 실사 준비 패키지                                                       */
/* ------------------------------------------------------------------ */

function QuestionCard({ x, n }: { x: PackageQuestion; n: number }) {
  const g = x.guide
  return (
    <details className="rounded-(--radius-control) border border-slate-200 bg-white" data-testid="pack-question" data-needs-owner={g.needsOwner}>
      <summary className="tap flex cursor-pointer items-start gap-2 px-3 py-2.5">
        <span className="t-sub shrink-0 font-bold text-slate-500 tabular-nums">{n}</span>
        <span className="min-w-0 flex-1">
          <span className="t-sub block font-semibold break-keep text-slate-900">{x.q.question}</span>
          <span className="t-meta block break-keep text-slate-500">
            {x.why}
            {g.needsOwner ? ' · 대표 확인 필요' : ''}
          </span>
        </span>
      </summary>
      <div className="flex flex-col gap-2 border-t border-slate-100 px-3 py-2.5">
        <p className="t-meta break-keep text-slate-600">
          <b className="font-semibold">묻는 이유</b> · {x.q.intent}
        </p>
        <div>
          <p className="t-meta font-semibold text-slate-600">핵심 답</p>
          {g.core.length ? (
            <ul className="flex flex-col gap-1" data-testid="pack-core">
              {g.core.map((s) => (
                <SourcedLine key={s.text} s={s} />
              ))}
            </ul>
          ) : (
            <p className="t-sub break-keep text-warning-800" data-testid="pack-core-missing">
              {x.q.topic ?? '이 질문'}은(는) 대표 확인 후 보완이 필요합니다.
            </p>
          )}
        </div>
        {g.points.length > 0 && (
          <div>
            <p className="t-meta font-semibold text-slate-600">꼭 말할 것</p>
            <ul className="flex flex-col gap-1">
              {g.points.map((s) => (
                <SourcedLine key={s.text} s={s} mark="·" />
              ))}
            </ul>
          </div>
        )}
        {(g.evidenceHave.length > 0 || g.evidenceMissing.length > 0) && (
          <p className="t-meta break-keep text-slate-600">
            <b className="font-semibold">증빙</b> · {g.evidenceHave.map((e) => `✓ ${e}`).concat(g.evidenceMissing.map((e) => `△ ${e}`)).join(' · ')}
          </p>
        )}
        {!x.prepared && g.ownerAsk.length > 0 && (
          <p className="t-meta break-keep text-danger-700">
            <b className="font-semibold">대표 확인</b> · {g.ownerAsk.join(' / ')}
          </p>
        )}
      </div>
    </details>
  )
}

export function InspectionPackPanel({
  pkg,
  handoff,
  notes,
  onNote,
  sender,
  onPractice,
  onClose,
  unconfirmed,
  clientId,
}: {
  unconfirmed: number
  clientId: string
  pkg: InspectionPackage
  handoff: HandoffPackage
  notes: Record<string, string>
  onNote: (key: string, text: string) => Promise<void>
  sender: string
  onPractice: () => void
  onClose: () => void
}) {
  const copy = useCopy()
  return (
    <Surface>
      <div className="flex flex-col gap-4" data-testid="cert-pack">
        <div className="flex flex-col gap-1">
          <h3 className="t-section font-bold break-keep text-slate-900">
            {pkg.companyName} {pkg.certLabel} 실사 준비
          </h3>
          <p className="t-sub break-keep text-slate-600">확인된 사실 · 서류함 자료 · 대표님 답만으로 만들었습니다. 근거 없는 말은 넣지 않았습니다.</p>
        </div>
        <UnconfirmedHint count={unconfirmed} clientId={clientId} />

        <Block title="업체 핵심정보" testid="pack-company">
          {pkg.company.length ? (
            <ul className="flex flex-col gap-1">
              {pkg.company.map((s) => (
                <SourcedLine key={s.text} s={s} />
              ))}
            </ul>
          ) : (
            <p className="t-sub text-warning-800">확인된 회사 정보가 아직 없습니다 — 회사 정보 · 서류함을 먼저 채워 주세요.</p>
          )}
          {pkg.strengths.length > 0 && (
            <ul className="mt-1 flex flex-col gap-1" data-testid="pack-strengths">
              {pkg.strengths.map((s) => (
                <SourcedLine key={s.text} s={s} mark="★" />
              ))}
            </ul>
          )}
        </Block>

        <Block title={`예상 핵심질문 ${pkg.questions.length}개 — 눌러서 말하기 가이드`} testid="pack-questions">
          <div className="flex flex-col gap-1.5">
            {pkg.questions.map((x, i) => (
              <QuestionCard key={x.q.id} x={x} n={i + 1} />
            ))}
          </div>
        </Block>

        <Block title="가져갈 자료" testid="pack-bring">
          <ul className="flex flex-col gap-0.5">
            {pkg.bring.map((b) => (
              <li key={b.label} className={`t-sub break-keep ${b.state === 'ready' ? 'text-success-700' : b.state === 'fix' ? 'text-warning-800' : 'text-slate-700'}`} data-testid="pack-bring-item" data-state={b.state}>
                <b className="font-semibold">{BRING_MARK[b.state]}</b> {b.label} <span className="t-meta">({BRING_LABEL[b.state]})</span>
              </li>
            ))}
          </ul>
        </Block>

        <Block title="실사 전날 체크" testid="pack-daybefore">
          <ul className="flex flex-col gap-0.5">
            {pkg.dayBefore.map((d) => (
              <li key={d} className="t-sub break-keep text-slate-800">
                □ {d}
              </li>
            ))}
          </ul>
        </Block>

        <Block title={`대표님께 확인할 것 (${pkg.ownerQuestions.length})`} testid="pack-owner">
          <OwnerAskBox questions={pkg.ownerQuestions} notes={notes} onNote={onNote} companyName={pkg.companyName} certLabel={pkg.certLabel} sender={sender} />
        </Block>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <Button variant="secondary" onClick={() => void copy(inspectionPackageText(pkg), '실사 준비 자료를 복사했습니다')} data-testid="pack-copy">
            <Copy aria-hidden="true" className="size-4" /> 복사
          </Button>
          <HandoffButton pkg={handoff} />
          <Button variant="secondary" onClick={onPractice} data-testid="cert-inspection-start">
            질문 하나씩 준비
          </Button>
          <Button variant="ghost" onClick={onClose} data-testid="pack-close">
            닫기
          </Button>
        </div>
      </div>
    </Surface>
  )
}

/* ------------------------------------------------------------------ */
/* 제출 전 최종 확인                                                      */
/* ------------------------------------------------------------------ */

export function SubmitGatePanel({
  gate,
  companyName,
  certLabel,
  ownerQuestions,
  notes,
  onNote,
  sender,
  onRequestDocs,
  onClose,
}: {
  gate: SubmitGate
  companyName: string
  certLabel: string
  ownerQuestions: string[]
  notes: Record<string, string>
  onNote: (key: string, text: string) => Promise<void>
  sender: string
  onRequestDocs: (labels: string[]) => Promise<number>
  onClose: () => void
}) {
  const { showToast } = useToast()
  const ready = gate.verdict === 'ready'
  const request = async () => {
    const added = await onRequestDocs(gate.docs.need.map((d) => d.label)).catch(() => -1)
    const copied = await copyText(missingDocsRequest(companyName, gate.cert, gate.docs, sender))
    showToast(added < 0 ? '서류함에 칸을 만들지 못했습니다' : `${copied ? '모자란 자료만 요청하는 문구를 복사했습니다' : '문구를 복사하지 못했습니다'}${added > 0 ? ` · 서류함에 칸 ${added}개` : ''}`)
  }
  return (
    <Surface>
      <div className="flex flex-col gap-4" data-testid="cert-gate" data-verdict={gate.verdict}>
        <div className={`flex flex-col gap-1 rounded-(--radius-control) border px-3 py-3 ${ready ? 'border-success-200 bg-success-50' : 'border-warning-200 bg-warning-50'}`}>
          <p className="t-meta font-semibold text-slate-600">{certLabel} 제출 전 최종 확인</p>
          <p className={`t-section font-bold ${ready ? 'text-success-700' : 'text-warning-800'}`} data-testid="cert-gate-verdict">
            {GATE_VERDICT_LABEL[gate.verdict]}
          </p>
          <p className="t-sub break-keep text-slate-700">{ready ? '아래 항목이 모두 확인됐습니다. 공식 점수는 기관 평가로 정해집니다.' : `△ 항목 ${gate.items.filter((x) => !x.ok).length}개를 먼저 확인해 주세요.`}</p>
        </div>
        <ul className="flex flex-col gap-1" data-testid="cert-gate-items">
          {gate.items.map((x) => (
            <li key={x.id} className={`t-sub break-keep ${x.ok ? 'text-success-700' : 'text-warning-800'}`} data-testid="cert-gate-item" data-ok={x.ok}>
              <b className="font-semibold">{x.ok ? '✓' : '△'}</b> {x.text}
            </li>
          ))}
        </ul>

        <Block title="제출자료 정리" testid="cert-submit-docs">
          <ul className="flex flex-col gap-0.5">
            {gate.docs.have.map((d) => (
              <li key={d} className="t-sub break-keep text-success-700" data-testid="submit-doc" data-have="true">
                ✓ {d} <span className="t-meta text-slate-500">(서류함에 있음)</span>
              </li>
            ))}
            {gate.docs.need.map((d) => (
              <li key={d.label} className="t-sub break-keep text-warning-800" data-testid="submit-doc" data-have="false">
                △ {d.label} <span className="t-meta">({d.stale ? '새로 발급 필요' : '받을 것'})</span>
              </li>
            ))}
          </ul>
          {gate.docs.need.length > 0 && (
            <Button variant="secondary" className="self-start" onClick={() => void request()} data-testid="cert-gate-request">
              모자란 자료만 요청({gate.docs.need.length})
            </Button>
          )}
          <p className="t-meta break-keep text-slate-500">서류함에 이미 있는 자료는 다시 요청하지 않습니다. 파일은 서류함에서 한 장씩 내려받을 수 있습니다.</p>
        </Block>

        {ownerQuestions.length > 0 && (
          <Block title={`대표님께 확인할 것 (${ownerQuestions.length})`} testid="cert-gate-owner">
            <OwnerAskBox questions={ownerQuestions} notes={notes} onNote={onNote} companyName={companyName} certLabel={certLabel} sender={sender} />
          </Block>
        )}

        {gate.official.length > 0 && (
          <details className="rounded-(--radius-control) border border-slate-200 bg-slate-50" data-testid="cert-gate-official">
            <summary className="tap t-sub cursor-pointer px-3 py-2 font-semibold text-slate-700">공식 기준(기관 평가 점수 — 자체 판정과 별개)</summary>
            <ul className="flex flex-col gap-0.5 px-3 pb-3">
              {gate.official.map((s) => (
                <li key={s.label} className="t-sub break-keep text-slate-700">
                  · {s.label}: <b className="font-semibold">{s.value}</b>
                </li>
              ))}
            </ul>
          </details>
        )}
        <Button variant="ghost" className="self-start" onClick={onClose} data-testid="cert-gate-close">
          닫기
        </Button>
      </div>
    </Surface>
  )
}

/* ------------------------------------------------------------------ */
/* 벤처 준비 패키지                                                       */
/* ------------------------------------------------------------------ */

export function VenturePackPanel({
  companyName,
  sections,
  handoff,
  notes,
  onNote,
  sender,
  onClose,
  unconfirmed,
  clientId,
}: {
  unconfirmed: number
  clientId: string
  companyName: string
  sections: VentureSection[]
  handoff: HandoffPackage
  notes: Record<string, string>
  onNote: (key: string, text: string) => Promise<void>
  sender: string
  onClose: () => void
}) {
  const copy = useCopy()
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const asks = sections.filter((s) => s.state !== 'ok').map((s) => s.ask)
  const tone = { ok: 'text-success-700', partly: 'text-warning-800', ask: 'text-slate-600' } as const
  return (
    <Surface>
      <div className="flex flex-col gap-4" data-testid="venture-pack">
        <div className="flex flex-col gap-1">
          <h3 className="t-section font-bold break-keep text-slate-900">{companyName} 벤처 준비 패키지</h3>
          <p className="t-sub break-keep text-slate-600">벤처확인 신청 · 사업계획서에 들어갈 사실을 9칸으로 모았습니다. 비어 있는 칸은 지어내지 않고 대표님께 묻습니다.</p>
          <p className="t-sub font-semibold text-slate-800" data-testid="venture-pack-count">
            ✓ {sections.filter((s) => s.state === 'ok').length} · △ {sections.filter((s) => s.state === 'partly').length} · ? {sections.filter((s) => s.state === 'ask').length}
          </p>
        </div>
        <UnconfirmedHint count={unconfirmed} clientId={clientId} />
        <div className="grid gap-2 sm:grid-cols-2">
          {sections.map((s) => {
            const key = `venture:${s.id}`
            return (
              <div key={s.id} className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5" data-testid="venture-section" data-state={s.state} data-id={s.id}>
                <p className={`t-sub font-bold break-keep ${tone[s.state]}`}>
                  {PACK_MARK[s.state]} {s.title} <span className="t-meta font-semibold">· {PACK_LABEL[s.state]}</span>
                </p>
                {s.lines.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {s.lines.map((l) => (
                      <SourcedLine key={l.text} s={l} mark="·" />
                    ))}
                  </ul>
                )}
                {s.state !== 'ok' && <p className="t-meta break-keep text-danger-700">대표 확인 · {s.ask}</p>}
                {open === key ? (
                  <div className="flex flex-col gap-1.5">
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} className="t-body w-full rounded-(--radius-control) border border-slate-300 px-3 py-2" placeholder="대표님이 답한 그대로 짧게" aria-label={`${s.title} — 대표 답`} data-testid="venture-answer-input" />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="primary" disabled={!draft.trim()} onClick={() => void onNote(key, draft.trim()).then(() => setOpen(null))} data-testid="venture-answer-save">
                        저장
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>
                        닫기
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" className="self-start" onClick={() => { setOpen(key); setDraft(notes[key] ?? '') }} data-testid="venture-answer-open">
                    {notes[key] ? '대표 답 고치기' : '대표 답 적기'}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <Button variant="secondary" onClick={() => void copy(venturePackText(companyName, sections), '벤처 준비 패키지를 복사했습니다')} data-testid="venture-pack-copy">
            <Copy aria-hidden="true" className="size-4" /> 복사
          </Button>
          <HandoffButton pkg={handoff} />
          {asks.length > 0 && (
            <Button variant="secondary" onClick={() => void copy(ownerQuestionMessage(companyName, '벤처기업 확인', asks, sender), '대표님께 보낼 카톡 · 문자 문구를 복사했습니다')} data-testid="venture-ask-send">
              <Send aria-hidden="true" className="size-4" /> 대표에게 질문 보내기
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </Surface>
  )
}
