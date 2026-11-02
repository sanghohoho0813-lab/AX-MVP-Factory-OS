/**
 * D-502~D-505 '이 말에서 알게 된 ○○ 사정' 카드 — 오늘 대화창 · 업체 상세 업무 일기가 같이 쓴다.
 * 사정(상황 예시 질문의 답) · 숫자(회사 정보) · 다음 약속 · 이 말로 달라지는 판정 → [○○에 기록] 한 번(최종 확인).
 */
import { Check } from 'lucide-react'
import { Button } from '../ui/Button'
import { friendlyDate } from '../../services/clientOpsNextAction'
import type { TalkAnswer, TalkNext, TalkNumber } from '../../services/homeAsk/homeTalk'

export function TalkCard({
  company,
  answers,
  numbers = [],
  next,
  changes = [],
  title,
  saved,
  savedText,
  busy,
  onRecord,
  testId = 'home-ask-talk',
}: {
  company: string
  answers: readonly TalkAnswer[]
  numbers?: readonly TalkNumber[]
  next?: TalkNext | null
  changes?: readonly string[]
  /** 머리 글(기본: 이 말에서 알게 된 ○○ 사정) */
  title?: string
  saved: boolean
  savedText: string
  busy: boolean
  onRecord?: () => void
  testId?: string
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3.5 py-2.5" data-testid={testId} data-saved={saved ? '1' : '0'}>
      <span className="t-meta font-semibold text-slate-500">{title ?? `이 말에서 알게 된 ${company} 사정`}</span>
      <ul className="t-sub flex flex-col gap-0.5 text-slate-700">
        {answers.map((t) => (
          <li key={t.key} className="flex flex-wrap items-baseline gap-x-1.5 break-keep" data-testid="home-ask-talk-item" data-key={t.key} data-a={t.a}>
            <Check aria-hidden="true" className="size-4 shrink-0 self-center text-slate-400" />
            <span>{t.label}</span>
            <span className={`font-semibold ${t.a === 'yes' ? 'text-brand-700' : 'text-slate-500'}`}>— {t.a === 'yes' ? '있음' : '없음'}</span>
            <span className="t-meta min-w-0 truncate text-slate-400">“{t.phrase}”</span>
          </li>
        ))}
        {numbers.map((n) => (
          <li key={n.key} className="flex flex-wrap items-baseline gap-x-1.5 break-keep" data-testid="home-ask-talk-num" data-key={n.key} data-value={n.value}>
            <Check aria-hidden="true" className="size-4 shrink-0 self-center text-slate-400" />
            <span>
              {n.label}
              {n.asOf ? `(${n.asOf}년)` : ''}
            </span>
            <span className="font-semibold text-brand-700">— {n.display}</span>
            <span className="t-meta min-w-0 truncate text-slate-400">“{n.phrase}”</span>
          </li>
        ))}
        {next && (
          <li className="flex flex-wrap items-baseline gap-x-1.5 break-keep" data-testid="home-ask-talk-next" data-date={next.date}>
            <Check aria-hidden="true" className="size-4 shrink-0 self-center text-slate-400" />
            <span>다음 약속</span>
            <span className="font-semibold text-brand-700">
              — {friendlyDate(next.date)} {next.text}
            </span>
            <span className="t-meta min-w-0 truncate text-slate-400">“{next.phrase}”</span>
          </li>
        )}
      </ul>
      {changes.length > 0 && (
        <p className="t-sub break-keep text-slate-700" data-testid="home-ask-talk-changes">
          <span className="font-semibold text-slate-500">이 말로 달라지는 판정 </span>
          {changes.join(' · ')}
        </p>
      )}
      {saved ? (
        <p className="t-sub inline-flex items-center gap-1.5 font-semibold text-slate-600">
          <Check aria-hidden="true" className="size-4 text-success-700" />
          {savedText}
        </p>
      ) : (
        onRecord && (
          <Button size="sm" variant="primary" className="self-start" disabled={busy} onClick={onRecord} data-testid="home-ask-talk-save">
            {busy ? '기록하는 중…' : `${company}에 기록`}
          </Button>
        )
      )}
    </div>
  )
}
