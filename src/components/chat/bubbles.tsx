/**
 * D-634 대화창 말풍선 — 대표: "카카오톡 상대방이랑 할 때처럼 핑퐁 하듯이 · 모든 대화창이 다 카카오톡 같은 대화창".
 *
 *   MeBubble     내 말 — 오른쪽 · 테마 파랑 바탕 · 옆에 시각
 *   BotRow       AI 말 — 왼쪽 프로필(보라 동그라미 · AI 만 보라) + 이름 한 줄 + 그 아래 말풍선 여러 개
 *   BotBubble    흰 바탕 + 얇은 회색 테두리(박스 색 규칙 그대로) · 첫 말풍선만 왼쪽 위 꼬리
 *   TypingBubble AI 가 쓰는 중 — 점 세 개
 *
 * 바탕은 대화창 판의 CHAT_TINT(옅은 회색) 하나 — 말풍선마다 다른 색을 칠하지 않는다.
 */
import type { ReactNode } from 'react'
import { MessageCircle, Sparkles } from 'lucide-react'

/** 왼쪽 프로필 — AI 답은 보라(AI 만 보라) · 정해진 답(규칙 계산)은 회색 말풍선 그림 */
export function BotAvatar({ className = '', ai = true }: { className?: string; ai?: boolean }) {
  return (
    <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-full text-white ${ai ? 'bg-violet-600' : 'bg-slate-600'} ${className}`}>
      {ai ? <Sparkles className="size-4" /> : <MessageCircle className="size-4" />}
    </span>
  )
}

/** 내 말 — 오른쪽. 시각은 말풍선 왼쪽 아래(카카오톡처럼) */
export function MeBubble({ children, time, testId, className = '', small = false }: { children: ReactNode; time?: string; testId?: string; className?: string; small?: boolean }) {
  return (
    <div className={`flex min-w-0 items-end justify-end gap-1.5 ${className}`} data-chat="me">
      {time ? <span className="t-meta shrink-0 pb-0.5 text-slate-500">{time}</span> : null}
      <p
        className={`${small ? 't-sub px-3 py-2' : 't-body px-3.5 py-2'} max-w-[85%] min-w-0 rounded-2xl rounded-tr-md bg-brand-600 break-keep whitespace-pre-wrap text-white [overflow-wrap:anywhere]`}
        data-testid={testId}
      >
        {children}
      </p>
    </div>
  )
}

/**
 * AI 말 — 왼쪽 프로필 + 이름 한 줄(옆에 꼬리표 · 시각) + 그 아래 말풍선들.
 * continued: 바로 앞도 AI 말이면 프로필 · 이름 없이 자리만(같은 사람이 이어 말하는 모양).
 */
export function BotRow({
  children,
  ai = true,
  name,
  tag,
  time,
  continued = false,
  testId,
  className = '',
}: {
  children: ReactNode
  /** AI 가 쓴 답인가 — 아니면(정해진 답 · 규칙 계산) 'AI' 라고 부르지 않는다 */
  ai?: boolean
  name?: string
  tag?: ReactNode
  time?: string
  continued?: boolean
  testId?: string
  className?: string
}) {
  name ??= ai ? 'AI 도우미' : '도우미'
  return (
    <div className={`flex min-w-0 items-start gap-2 ${className}`} data-chat="bot" data-testid={testId}>
      {continued ? <span aria-hidden="true" className="w-8 shrink-0" /> : <BotAvatar ai={ai} />}
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
        {!continued && (
          <p className="t-meta flex max-w-full min-w-0 flex-wrap items-center gap-x-1.5 font-semibold text-slate-700">
            <span>{name}</span>
            {tag}
            {time ? <span className="font-normal text-slate-500">{time}</span> : null}
          </p>
        )}
        {children}
      </div>
    </div>
  )
}

/** 흰 말풍선 — wide 는 목록처럼 판 폭을 다 쓰는 것(답 항목 · 표) */
export function BotBubble({ children, first = false, wide = false, tight = false, className = '', testId }: { children: ReactNode; first?: boolean; wide?: boolean; /** 안쪽 여백 작게(목록이 들어갈 때) */ tight?: boolean; className?: string; testId?: string }) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-slate-200 bg-white text-slate-900 ${tight ? 'px-2 py-1.5' : 'px-3.5 py-2.5'} ${first ? 'rounded-tl-md' : ''} ${wide ? 'w-full' : 'w-fit max-w-full'} ${className}`}
      data-testid={testId}
    >
      {children}
    </div>
  )
}

/** AI 가 쓰는 중 — 말풍선 안 점 세 개(글은 화면 읽기 프로그램용) */
export function TypingBubble({ label = 'AI가 답을 쓰는 중', testId, note, name }: { label?: string; testId?: string; note?: ReactNode; name?: string }) {
  return (
    <BotRow testId={testId} name={name}>
      <BotBubble first>
        <span role="status" className="flex items-center gap-2">
          <span aria-hidden="true" className="flex items-center gap-1 py-1">
            <span className="size-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
            <span className="size-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
            <span className="size-2 animate-bounce rounded-full bg-slate-400" />
          </span>
          <span className="sr-only">{label}</span>
          {note ? <span className="t-sub text-slate-600">{note}</span> : null}
        </span>
      </BotBubble>
    </BotRow>
  )
}

/** 대화 가운데 작은 알림(카카오톡의 날짜 줄처럼) */
export function ChatNotice({ children, testId, title }: { children: ReactNode; testId?: string; title?: string }) {
  return (
    <p className="t-meta mx-auto w-fit max-w-full rounded-full bg-slate-200/70 px-3 py-1 text-center break-keep text-slate-600" data-testid={testId} title={title}>
      {children}
    </p>
  )
}

/** D-638 답이 길어 끝이 잘렸을 때 답 아래 한 줄 — 모든 대화창이 같은 글 */
export function CutLine({ testId = 'chat-cut' }: { testId?: string }) {
  return (
    <p className="t-sub break-keep text-slate-700" data-testid={testId}>
      ✂ 답이 길어 끝이 잘렸어요 — "이어서 써 줘" 라고 물으면 이어서 써요.
    </p>
  )
}
