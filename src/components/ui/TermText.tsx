/**
 * D-509 글 속 컨설팅 용어에 점선 밑줄 — 누르거나 마우스를 올리면 한 줄 설명(services/consultTerms).
 * 링크 안에서는 쓰지 않는다(단추가 링크 안에 들어가면 누를 때 화면이 넘어간다) — 판정 카드 본문 · 말하기 대본에만.
 */
import { useMemo, useState } from 'react'
import { CONSULT_TERMS, splitTerms } from '../../services/consultTerms'

function TermTip({ term, children }: { term: string; children: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="group/term relative inline">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-label={`${term} — 뜻 보기`}
        data-testid="term"
        data-term={term}
        className="inline rounded-sm p-0 align-baseline [font:inherit] text-inherit underline decoration-slate-400 decoration-dotted underline-offset-4 hover:decoration-brand-600"
      >
        {children}
      </button>
      <span
        role="tooltip"
        data-testid="term-tip"
        className={`pointer-events-none absolute top-full left-0 z-40 mt-1 w-max max-w-[min(20rem,calc(100vw-3rem))] rounded-(--radius-control) bg-slate-900 px-3 py-2 text-[0.92rem] leading-snug font-medium break-keep whitespace-normal text-white shadow-lg ${open ? 'block' : 'hidden group-hover/term:block'}`}
      >
        <b className="font-bold">{term}</b> — {CONSULT_TERMS[term]}
      </span>
    </span>
  )
}

/** 글 그대로 — 사전에 있는 말만 점선 밑줄(같은 글에서 처음 한 번) */
export function TermText({ text }: { text: string }) {
  const pieces = useMemo(() => splitTerms(text), [text])
  return (
    <>
      {pieces.map((p, i) =>
        p.term ? (
          <TermTip key={`${i}-${p.term}`} term={p.term}>
            {p.text}
          </TermTip>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}
