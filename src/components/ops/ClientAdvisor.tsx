/**
 * 업체 상세 · 맞춤 추천 — '맞춤 상담' 대화 화면 (D-145).
 *
 *  왼쪽(휴대폰은 위): 목차 다섯 묶음 — 누르면 펼쳐지고, 질문을 누르면 바로 답
 *  오른쪽(휴대폰은 아래): 주고받은 질문 · 답 카드(결론 · 이 회사 기준 · 절차 · 준비 서류 · 열기 · 복사 · 다음 약속으로)
 *  맨 아래: 직접 적기 — 가장 가까운 질문으로 답하고, 정해 둔 답이 없으면 'AI 연결 준비 중' 자리
 *
 * 답은 규칙으로 만든다(clientAdvisor — LLM 호출 0). 묻은 질문만 이 브라우저에 남기고(업체마다), 답은 열 때마다 지금 기록으로 다시 만든다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarPlus, ChevronDown, Copy, MessageCircleQuestion, Send, Trash2 } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { GrantNotice } from '../../services/grants/grantMatch'
import { ADVISOR_GROUPS, ALL_QUESTIONS, answerFor, answerText, type AdvisorAnswer } from '../../services/clientAdvisor'
import { INSIGHT_TONE_LABEL, type Insight, type InsightTone } from '../../services/clientInsights'
import { copyText } from '../../services/grants/grantView'
import { Button } from '../ui/Button'
import { Badge, Surface, type Tone } from '../ui/primitives'
import { AiSoonButton } from '../ui/AiSoonButton'
import { useToast } from '../ui/toastContext'

const TONE: Record<InsightTone, Tone> = { good: 'success', maybe: 'brand', done: 'neutral', need: 'warning', no: 'neutral' }

interface Turn {
  id: string
  /** 목차 질문이면 그 id, 직접 적은 것이면 null */
  qid: string | null
  text: string
}

const keyFor = (clientId: string) => `axmvp.advisor.v1.${clientId}`

function loadTurns(clientId: string): Turn[] {
  try {
    const raw = localStorage.getItem(keyFor(clientId))
    const v = raw ? (JSON.parse(raw) as Turn[]) : []
    return Array.isArray(v) ? v.filter((t) => t && typeof t.text === 'string').slice(-12) : []
  } catch {
    return []
  }
}

function saveTurns(clientId: string, turns: Turn[]) {
  try {
    localStorage.setItem(keyFor(clientId), JSON.stringify(turns.slice(-12)))
  } catch {
    // 저장 공간이 없으면 이 창에서만 — 대화는 그대로 된다
  }
}

export function ClientAdvisor({
  record,
  today,
  notices,
  insights,
  onSetNext,
}: {
  record: ClientOpsRecord
  today: string
  notices: readonly GrantNotice[]
  insights: Insight[]
  onSetNext: (text: string) => void
}) {
  const { showToast } = useToast()
  const [turns, setTurns] = useState<Turn[]>(() => loadTurns(record.id))
  const [openGroup, setOpenGroup] = useState<string>(ADVISOR_GROUPS[0].key)
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(record.id)
  if (seen !== record.id) {
    setSeen(record.id)
    setTurns(loadTurns(record.id))
  }
  useEffect(() => saveTurns(record.id, turns), [record.id, turns])

  const ctx = useMemo(() => ({ record, today, notices, insights }), [record, today, notices, insights])
  // 답은 지금 기록으로 다시 만든다 — 서류를 더 올리면 같은 질문의 답이 바뀐다
  const answers = useMemo(() => turns.map((t) => (t.qid ? answerFor(t.qid, ctx) : answerText(t.text, ctx))), [turns, ctx])

  const ask = (qid: string | null, text: string) => {
    if (!text.trim()) return
    setTurns((list) => [...list, { id: `${Date.now().toString(36)}${list.length}`, qid, text: text.trim().slice(0, 200) }].slice(-12))
    window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60)
  }

  return (
    <section aria-labelledby="advisor-title" className="flex flex-col gap-3" data-testid="advisor">
      <div className="flex flex-wrap items-center gap-2">
        <MessageCircleQuestion aria-hidden="true" className="size-5 text-brand-600" />
        <h2 id="advisor-title" className="text-[1.15rem] font-bold text-slate-900">
          맞춤 상담
        </h2>
        <span className="t-sub text-slate-500">— {record.companyName || '이 회사'} 기록으로 답해요</span>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 목차 */}
        <nav aria-label="상담 목차" className="flex flex-col gap-2" data-testid="advisor-toc">
          {ADVISOR_GROUPS.map((g) => {
            const open = openGroup === g.key
            return (
              <div key={g.key} className="overflow-hidden rounded-(--radius-card) border border-slate-200 bg-white">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenGroup(open ? '' : g.key)}
                  data-testid="advisor-group"
                  className="tap flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="t-body block font-bold text-slate-900">{g.title}</span>
                    <span className="t-sub block break-keep text-slate-500">{g.hint}</span>
                  </span>
                  <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <ul className="flex flex-col gap-1.5 border-t border-slate-100 px-3 py-2.5">
                    {g.questions.map((qq) => (
                      <li key={qq.id}>
                        <button
                          type="button"
                          onClick={() => ask(qq.id, qq.label)}
                          data-testid="advisor-q"
                          data-q={qq.id}
                          className="tap t-sub w-full rounded-(--radius-control) border border-brand-100 bg-brand-50/60 px-3 py-2 text-left font-semibold break-keep text-brand-800 hover:border-brand-300 hover:bg-brand-50"
                        >
                          {qq.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </nav>

        {/* 대화 */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-h-40 flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-slate-50/60 p-3 sm:p-4 lg:max-h-[44rem] lg:overflow-y-auto" data-testid="advisor-log">
            {turns.length === 0 ? (
              <p className="t-sub my-auto break-keep text-center text-slate-500">왼쪽 목차에서 질문을 누르거나 아래에 직접 적어 보세요. 이 회사 정보 · 모듈 판정으로 바로 답해요.</p>
            ) : (
              turns.map((t, i) => (
                <div key={t.id} className="flex flex-col gap-2">
                  <p className="t-body self-end rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 break-keep text-white [overflow-wrap:anywhere]" data-testid="advisor-question">
                    {t.text}
                  </p>
                  <AnswerCard
                    a={answers[i]}
                    onAsk={(qid) => ask(qid, ALL_QUESTIONS.find((x) => x.id === qid)?.label ?? '')}
                    onCopy={async (text) => showToast((await copyText(text)) ? '복사했습니다 — 카톡 · 메모에 붙여 넣으세요' : '복사하지 못했습니다')}
                    onSetNext={onSetNext}
                  />
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
          <form
            className="flex flex-wrap items-stretch gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              ask(null, draft)
              setDraft('')
            }}
          >
            <label className="min-w-0 flex-[1_1_14rem]">
              <span className="sr-only">직접 묻기</span>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="예: 정책자금 어디에 신청해? · 받아야 할 서류는?"
                data-testid="advisor-input"
                className="t-body min-h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 focus:border-brand-500 focus:outline-none"
              />
            </label>
            <Button type="submit" variant="primary" disabled={!draft.trim()} data-testid="advisor-send">
              <Send aria-hidden="true" className="size-4" /> 묻기
            </Button>
            <AiSoonButton label="AI에게 묻기" what="목차에 없는 질문도 이 회사 정보로 답하고, 컨설팅 결과 · 절차를 글로 써 줍니다" />
          </form>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="t-meta break-keep text-slate-500">지금은 정해 둔 규칙으로 답해요(AI 아님 · 밖으로 보내는 것 없음).</p>
            {turns.length > 0 && (
              <button type="button" onClick={() => setTurns([])} className="tap t-sub inline-flex items-center gap-1 text-slate-500 hover:text-slate-800" data-testid="advisor-clear">
                <Trash2 aria-hidden="true" className="size-4" /> 대화 지우기
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function AnswerCard({ a, onAsk, onCopy, onSetNext }: { a: AdvisorAnswer; onAsk: (qid: string) => void; onCopy: (text: string) => void; onSetNext: (text: string) => void }) {
  return (
    <Surface edge={a.verdict ? TONE[a.verdict.tone] : 'neutral'} showEdge className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2.5" data-testid="advisor-answer" data-q={a.questionId ?? ''}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="t-card font-bold break-keep text-slate-900">{a.title}</span>
          {a.verdict && <Badge tone={TONE[a.verdict.tone]}>{INSIGHT_TONE_LABEL[a.verdict.tone]}</Badge>}
        </div>
        {a.verdict && <p className="t-body font-semibold break-keep text-slate-800 [overflow-wrap:anywhere]">{a.verdict.text}</p>}
        {a.facts.length > 0 && (
          <div>
            <p className="t-meta font-semibold text-slate-500">이 회사 기준</p>
            <ul className="t-sub mt-1 flex flex-col gap-0.5 break-keep text-slate-700">
              {a.facts.map((f) => (
                <li key={f} className="[overflow-wrap:anywhere]">· {f}</li>
              ))}
            </ul>
          </div>
        )}
        {a.steps.length > 0 && (
          <div>
            <p className="t-meta font-semibold text-slate-500">순서 · 할 일</p>
            <ol className="t-sub mt-1 flex flex-col gap-1 break-keep text-slate-800">
              {a.steps.map((s, i) => (
                <li key={`${i}-${s}`} className="flex gap-2">
                  <span className="shrink-0 font-bold text-brand-700">{i + 1}.</span>
                  <span className="min-w-0 [overflow-wrap:anywhere]">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {a.docs.length > 0 && (
          <p className="t-sub flex flex-wrap items-center gap-1.5">
            <span className="text-slate-500">준비 서류</span>
            {a.docs.map((d) => (
              <span key={d} className="t-meta rounded-full border border-slate-200 bg-white px-2 py-0.5 font-semibold text-slate-700">
                {d}
              </span>
            ))}
          </p>
        )}
        {a.missing.length > 0 && (
          <p className="t-sub flex flex-wrap items-center gap-1.5">
            <span className="text-slate-500">알면 더 정확</span>
            {a.missing.map((m) => (
              <span key={m} className="t-meta rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 font-semibold text-warning-800">
                {m}
              </span>
            ))}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {a.links.map((l) => (
            <Link key={l.href} to={l.href} className="tap t-sub inline-flex items-center gap-1 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:border-brand-400">
              {l.label} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ))}
          {a.copyText && (
            <Button size="sm" variant="secondary" onClick={() => onCopy(a.copyText)} data-testid="advisor-copy">
              <Copy aria-hidden="true" className="size-4" /> 복사
            </Button>
          )}
          {a.questionId && a.verdict && a.verdict.tone !== 'no' && (
            <Button size="sm" variant="ghost" onClick={() => onSetNext(`${a.title} — ${a.verdict?.text ?? ''}`.slice(0, 60))} data-testid="advisor-next">
              <CalendarPlus aria-hidden="true" className="size-4" /> 다음 약속으로
            </Button>
          )}
        </div>
        {a.suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" data-testid="advisor-suggest">
            <span className="t-meta text-slate-500">이것도 물어보세요</span>
            {a.suggestions.map((s) => (
              <button key={s.id} type="button" onClick={() => onAsk(s.id)} className="tap t-meta rounded-full border border-brand-200 bg-white px-2.5 py-1 font-semibold text-brand-700 hover:bg-brand-50">
                {s.label}
              </button>
            ))}
          </div>
        )}
        <p className="t-meta break-keep text-slate-400">{a.note}</p>
      </div>
    </Surface>
  )
}
