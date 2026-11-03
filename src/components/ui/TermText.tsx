/**
 * D-509 글 속 컨설팅 용어에 점선 밑줄 — 누르거나 마우스를 올리면 한 줄 설명(services/consultTerms).
 * 링크 안에서는 쓰지 않는다(단추가 링크 안에 들어가면 누를 때 화면이 넘어간다) — 판정 카드 본문 · 말하기 대본에만.
 * 뜻 상자는 열렸을 때만 그린다 — 숨긴 글이 화면 글(복사 · 읽어 주기 · 시험의 글 비교)에 섞이지 않게.
 * 누르는 자리는 위아래로 넓혀(휴대폰 손가락 44px) 줄 간격은 그대로 둔다(안쪽 여백 + 같은 크기 바깥 음수 여백).
 */
import { useMemo, useState } from 'react'
import { CONSULT_TERMS, splitTerms } from '../../services/consultTerms'

function TermTip({ term, children }: { term: string; children: string }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  return (
    <span className="relative inline" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        onBlur={() => {
          setOpen(false)
          setHover(false)
        }}
        aria-expanded={open}
        aria-label={`${term} — 뜻 보기`}
        data-testid="term"
        data-term={term}
        className="-my-[11px] inline-block rounded-sm px-0 py-[11px] align-baseline [font:inherit] text-inherit underline decoration-slate-400 decoration-dotted underline-offset-4 hover:decoration-brand-600"
      >
        {children}
      </button>
      {(open || hover) && (
        <span
          role="tooltip"
          data-testid="term-tip"
          className="pointer-events-none absolute top-full left-0 z-40 mt-1 block w-max max-w-[min(20rem,calc(100vw-3rem))] rounded-(--radius-control) bg-slate-900 px-3 py-2 text-[0.92rem] leading-snug font-medium break-keep whitespace-normal text-white shadow-lg"
        >
          <b className="font-bold">{term}</b> — {CONSULT_TERMS[term]}
        </span>
      )}
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
