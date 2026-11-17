/**
 * D-507 마케팅 화면마다 맨 위 '이 화면은' 한 줄 — 대표 "60대 이상이 처음 딱 봐도 이해하기 쉽게".
 *  - 무엇을 해 주는 곳인지 한 문장 + (있으면) 1 → 2 → 3 짧은 순서.
 *  - 흰 칸 + 얇은 회색 테두리(박스 색 하나) · 휴대폰은 순서를 세 칸으로(번호 위 · 글 아래).
 *  - 쓰는 사람이 [접기] 를 누르면 그 화면에서는 한 줄 요약만 남긴다(다시 누르면 펼침 · 이 브라우저에 기억).
 * D-627 대표 "목차를 눌러 들어갔을 때 한 화면 글자 수를 엄격하게" — 처음에는 한 줄(무엇을 하는 곳)만, 1 → 2 → 3 은 [순서 보기] 를 눌러야.
 *   펼쳐 둔 화면은 이 브라우저에 기억한다(axmvp.mkguide.open.v1). 예전에 [접기] 한 기억(closed)도 그대로 접힘.
 */
import { useState } from 'react'
import { ArrowRight, ChevronDown, ChevronUp, Info } from 'lucide-react'

const KEY = 'axmvp.mkguide.closed.v1'
/** D-627 순서를 펼쳐 둔 화면 */
const OPEN_KEY = 'axmvp.mkguide.open.v1'

function readList(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeList(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list.slice(-40)))
  } catch {
    // 저장이 막혀도 화면은 그대로
  }
}

export function ScreenGuide({
  id,
  what,
  steps = [],
  testId = 'mk-guide',
  plain = false,
  tip,
}: {
  id: string
  /** D-627 한 줄(30자 안) — 더 긴 설명은 tip(ⓘ) */
  what: string
  steps?: readonly string[]
  testId?: string
  /** D-603 테두리 칸 없이 글 한 줄(아래 큰 판과 겹쳐 박스가 늘지 않게) */
  plain?: boolean
  /** D-627 더 긴 설명 — 마우스를 올리면(title) */
  tip?: string
}) {
  const [closed, setClosed] = useState(() => !readList(OPEN_KEY).includes(id) || readList(KEY).includes(id))
  const toggle = () => {
    const opened = readList(OPEN_KEY).filter((x) => x !== id)
    writeList(OPEN_KEY, closed ? [...opened, id] : opened)
    writeList(KEY, readList(KEY).filter((x) => x !== id))
    setClosed(!closed)
  }
  return (
    <section className={`flex flex-col gap-2 ${plain ? 'px-1' : 'rounded-(--radius-control) border border-slate-200 bg-white px-3.5 py-2.5'}`} data-testid={testId} data-screen-guide={id} data-open={closed ? '0' : '1'} aria-label="이 화면은">
      <div className="flex items-center gap-2">
        <Info aria-hidden="true" className="size-5 shrink-0 text-brand-700" />
        {/* D-627 더 긴 설명(tip)은 마우스를 올리면 — 휴대폰 좁은 줄에 ? 단추가 끼어 글이 세 줄로 꺾이지 않게 */}
        <p className="t-sub min-w-0 flex-1 break-keep text-slate-800" title={tip}>
          <b className="font-bold text-slate-900">이 화면은</b> — {what}
        </p>
        {steps.length > 0 && (
          <button type="button" onClick={toggle} aria-expanded={!closed} className="tap t-meta inline-flex min-h-10 shrink-0 items-center gap-1 rounded-(--radius-control) px-2 font-semibold text-slate-600 hover:bg-slate-50" data-testid={`${testId}-toggle`}>
            {closed ? (
              <>
                순서 보기 <ChevronDown aria-hidden="true" className="size-4" />
              </>
            ) : (
              <>
                접기 <ChevronUp aria-hidden="true" className="size-4" />
              </>
            )}
          </button>
        )}
      </div>
      {steps.length > 0 && !closed && (
        <ol className={`grid gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-x-1.5 sm:gap-y-1 sm:pl-7 ${steps.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`} aria-label="쓰는 순서" data-testid={`${testId}-steps`}>
          {steps.map((t, i) => (
            <li key={t} className="t-sub flex flex-col items-center gap-1 px-0.5 text-center leading-snug font-semibold break-keep text-slate-800 sm:flex-row sm:gap-1.5 sm:p-0 sm:text-left">
              {i > 0 && <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-slate-400 max-sm:hidden" />}
              <span aria-hidden="true" className="t-meta flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-900 font-bold text-white">
                {i + 1}
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
