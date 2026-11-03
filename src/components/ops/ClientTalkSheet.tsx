/**
 * D-508 말하기 대본 — 맞춤 추천 판정(같은 엔진)을 상담 자리에서 그대로 읽을 말로.
 *
 * 탭 하나에 한 가지(📐 첫 화면은 단순하게):
 *  - [미팅 순서] 시작 → 먼저 여쭤볼 것 → 제안 1~3 → 받을 서류 → 마무리 · 다음 약속(복사 · 인쇄)
 *  - [제안마다] 고객에게 이렇게 말하세요 · 쉽게 말하면 · 대표님이 물으면 · 이렇게는 말하지 마세요(복사 · 그 모듈 열기)
 * 컨설턴트가 보는 메모다(고객 종이가 아니다) — 수수료 · 영업자 · 업무 일기는 없다. 규칙으로 만든 글이다('AI' 아님).
 */
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowRight, Copy, MessageCircle, Printer, Search } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { INSIGHT_TONE_LABEL, topPicks, type Insight } from '../../services/clientInsights'
import { TALK_CAUTION, faqSearch, meetingScript, meetingScriptText, talkCard, talkText, type MeetingScript, type TalkCard } from '../../services/consultTalk'
import { CONSULT_TERMS } from '../../services/consultTerms'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { copyText } from '../consulting/studioParts'
import { useToast } from '../ui/toastContext'
import { josa } from '../../lib/josa'
import { TermText } from '../ui/TermText'

type Tab = { id: string; label: string; card: TalkCard | null; ins: Insight | null }

/** 미팅 순서 — 화면 · 인쇄가 같은 내용 */
function ScriptDocument({ s, printing }: { s: MeetingScript; printing?: boolean }) {
  return (
    <article className={printing ? 'px-8 py-6' : 'flex flex-col gap-3'} data-testid={printing ? 'talk-script-print' : 'talk-script'}>
      {printing && <h2 className="mb-3 border-b border-slate-300 pb-1 text-[1.3rem] font-bold text-slate-900">{s.company} 미팅 대본</h2>}
      <ol className="flex flex-col gap-3">
        {s.sections.map((sec, i) => (
          <li key={sec.id} className="avoid-break rounded-(--radius-control) border border-slate-200 bg-white px-3.5 py-3" data-testid={printing ? 'talk-script-print-section' : 'talk-script-section'} data-id={sec.id}>
            <p className="t-card flex items-center gap-2 font-bold text-slate-900">
              <span aria-hidden="true" className="t-meta flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-900 font-bold text-white">
                {i + 1}
              </span>
              {sec.title}
            </p>
            <ul className="mt-1.5 flex flex-col gap-1 pl-8">
              {sec.lines.map((l) => (
                <li key={l} className={`t-body break-keep [overflow-wrap:anywhere] ${l.startsWith('· ') ? 'text-slate-700' : 'text-slate-900'}`}>
                  {l}
                </li>
              ))}
            </ul>
            {sec.faq && sec.faq.length > 0 && (
              <dl className="mt-2 flex flex-col gap-1 pl-8" data-testid="talk-script-faq">
                <dt className="t-meta font-semibold text-slate-500">대표님이 물으면</dt>
                {sec.faq.map((f) => (
                  <dd key={f.q} className="t-sub break-keep text-slate-700 [overflow-wrap:anywhere]">
                    <b className="font-semibold text-slate-900">Q. {f.q}</b> {f.a}
                  </dd>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ol>
      <p className="t-meta break-keep text-slate-600">※ {TALK_CAUTION}</p>
    </article>
  )
}

function CardView({ card, ins, onCopy }: { card: TalkCard; ins: Insight; onCopy: () => void }) {
  return (
    <div className="flex flex-col gap-3" data-testid="talk-card" data-key={card.key} data-topic={card.topic}>
      <section className="rounded-(--radius-control) border border-slate-200 bg-white px-3.5 py-3">
        <p className="t-meta font-semibold text-slate-500">
          고객에게 이렇게 말하세요 · <span className="text-slate-700">{INSIGHT_TONE_LABEL[ins.tone]}</span>
        </p>
        <ul className="mt-1.5 flex flex-col gap-1.5" data-testid="talk-say">
          {card.say.map((s) => (
            <li key={s} className="t-body font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">
              “{s}”
            </li>
          ))}
        </ul>
        {card.basis && (
          <p className="t-sub mt-2 break-keep text-slate-500 [overflow-wrap:anywhere]">
            판정 근거(화면에만) — <TermText text={card.basis} />
          </p>
        )}
      </section>
      <section className="rounded-(--radius-control) border border-slate-200 bg-white px-3.5 py-3" data-testid="talk-easy">
        <p className="t-meta font-semibold text-slate-500">쉽게 말하면</p>
        <p className="t-body mt-1 break-keep text-slate-800 [overflow-wrap:anywhere]">
          <TermText text={card.easy} />
        </p>
      </section>
      <section className="rounded-(--radius-control) border border-slate-200 bg-white px-3.5 py-3" data-testid="talk-faq">
        <p className="t-meta font-semibold text-slate-500">대표님이 물으면</p>
        <dl className="mt-1.5 flex flex-col gap-2">
          {card.faq.map((f) => (
            <div key={f.q}>
              <dt className="t-body font-bold break-keep text-slate-900">Q. {f.q}</dt>
              <dd className="t-sub break-keep text-slate-700 [overflow-wrap:anywhere]">
                <TermText text={f.a} />
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="rounded-(--radius-control) border border-slate-200 bg-white px-3.5 py-3" data-testid="talk-avoid">
        <p className="t-meta font-semibold text-danger-700">이렇게는 말하지 마세요</p>
        <ul className="mt-1 flex flex-col gap-1">
          {[...card.avoid, TALK_CAUTION].map((a) => (
            <li key={a} className="t-sub break-keep text-slate-800 [overflow-wrap:anywhere]">
              · {a}
            </li>
          ))}
        </ul>
      </section>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onCopy} data-testid="talk-copy">
          <Copy aria-hidden="true" className="size-4" /> 이 말하기 복사
        </Button>
        <Link to={ins.openPath} className="tap t-sub inline-flex min-h-10 items-center gap-1 rounded-(--radius-control) px-2 font-semibold text-brand-700 hover:underline" data-testid="talk-open-module">
          {ins.openLabel} <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </div>
  )
}

/** D-508 대표님이 물은 말 → 가장 가까운 답(모든 모듈 '대표님이 물으면' · 용어 뜻) — 규칙으로 찾는다 */
function AskFinder() {
  const [q, setQ] = useState('')
  const hits = useMemo(() => faqSearch(q, CONSULT_TERMS), [q])
  const EXAMPLES = ['갚아야 하나요', '직원이 그만두면', '세무조사', '얼마나 걸려요', '인정이자']
  return (
    <div className="flex flex-col gap-3" data-testid="talk-ask">
      <label className="flex flex-col gap-1.5">
        <span className="t-sub font-semibold text-slate-800">대표님이 물은 말을 낱말 한두 개로 적어 보세요</span>
        <span className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 갚아야 하나요 · 직원 그만두면 · 세무조사" className="t-body min-h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white pr-3 pl-9" data-testid="talk-ask-input" />
        </span>
      </label>
      {!q.trim() && (
        <div className="flex flex-wrap gap-1.5" data-testid="talk-ask-examples">
          {EXAMPLES.map((x) => (
            <button key={x} type="button" onClick={() => setQ(x)} className="tap t-sub min-h-10 rounded-full border border-slate-200 bg-white px-3 font-semibold text-slate-700 hover:border-slate-300">
              {x}
            </button>
          ))}
        </div>
      )}
      {q.trim() && hits.length === 0 && <p className="t-sub break-keep text-slate-600" data-testid="talk-ask-none">맞는 답을 못 찾았어요 — 다른 낱말로 적어 보세요(예: 대출 · 직원 · 세금 · 연구소).</p>}
      {hits.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid="talk-ask-hits">
          {hits.map((h) => (
            <li key={h.q + h.a} className="rounded-(--radius-control) border border-slate-200 bg-white px-3.5 py-2.5" data-testid="talk-ask-hit" data-topic={h.topic}>
              <p className="t-meta font-semibold text-slate-500">{h.label}</p>
              <p className="t-body font-bold break-keep text-slate-900">Q. {h.q}</p>
              <p className="t-sub break-keep text-slate-700 [overflow-wrap:anywhere]">
                <TermText text={h.a} />
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="t-meta break-keep text-slate-600">※ {TALK_CAUTION}</p>
    </div>
  )
}

export function ClientTalkSheet({ record, insights, focus, onClose }: { record: ClientOpsRecord; insights: readonly Insight[]; focus?: string | null; onClose: () => void }) {
  const { showToast } = useToast()
  const script = useMemo(() => meetingScript(record, insights), [record, insights])
  // 탭: 미팅 순서 + 먼저 제안할 것(같은 순서) + 눌러서 연 모듈(제안 밖이면 맨 뒤에)
  const tabs = useMemo<Tab[]>(() => {
    const list: Tab[] = [{ id: 'script', label: '미팅 순서', card: null, ins: null }]
    const picks = topPicks(insights).filter((p) => talkCard(p))
    picks.forEach((p, i) => list.push({ id: p.key, label: `${i + 1} ${p.label}`, card: talkCard(p), ins: p }))
    const f = focus ? insights.find((i) => i.key === focus) : null
    if (f && !picks.some((p) => p.key === f.key) && talkCard(f)) list.push({ id: f.key, label: f.label, card: talkCard(f), ins: f })
    list.push({ id: 'ask', label: '대표님이 물으면 찾기', card: null, ins: null })
    return list
  }, [insights, focus])
  const [tab, setTab] = useState(() => (focus && tabs.some((t) => t.id === focus) ? focus : 'script'))
  const cur = tabs.find((t) => t.id === tab) ?? tabs[0]
  const copy = async (text: string, what: string) => showToast((await copyText(text)) ? `${josa(what, '을/를')} 복사했어요 — 메모나 카톡에 붙여 넣으세요` : '복사하지 못했어요 — 다시 눌러 주세요')
  return (
    <>
      <Modal
        open
        size="lg"
        title={`${record.companyName} 말하기 대본`}
        onClose={onClose}
        footer={
          cur.id === 'script' ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => void copy(meetingScriptText(script), '미팅 대본')} data-testid="talk-script-copy">
                <Copy aria-hidden="true" className="size-4" /> 대본 복사
              </Button>
              <Button variant="primary" onClick={() => window.print()} data-testid="talk-print">
                <Printer aria-hidden="true" className="size-4" /> 인쇄 · PDF로 저장
              </Button>
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-3" data-testid="talk-sheet">
          <p className="t-sub flex items-start gap-1.5 break-keep text-slate-600">
            <MessageCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-500" />
            맞춤 추천 판정 그대로 — 상담 자리에서 읽을 말이에요. 컨설턴트 메모라 고객 종이에는 들어가지 않아요.
          </p>
          <div role="tablist" aria-label="말하기 대본" className="flex flex-wrap gap-1.5" data-testid="talk-tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === cur.id}
                onClick={() => setTab(t.id)}
                className={`tap t-sub min-h-10 rounded-(--radius-control) border px-3 font-semibold break-keep ${t.id === cur.id ? 'border-brand-500 bg-white text-brand-700 ring-2 ring-brand-200' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                data-testid="talk-tab"
                data-key={t.id}
              >
                {t.label}
              </button>
            ))}
          </div>
          {cur.id === 'ask' ? <AskFinder /> : cur.id === 'script' || !cur.card || !cur.ins ? <ScriptDocument s={script} /> : <CardView card={cur.card} ins={cur.ins} onCopy={() => void copy(talkText(cur.card!), '말하기 카드')} />}
        </div>
      </Modal>
      {/* 인쇄 종이 — 미팅 순서만(진단서와 같은 틀: body 바로 아래) */}
      {cur.id === 'script' &&
        createPortal(
          <div className="print-document print-solo hidden bg-white text-slate-900 print:block" aria-hidden="true">
            <ScriptDocument s={script} printing />
          </div>,
          document.body,
        )}
    </>
  )
}
