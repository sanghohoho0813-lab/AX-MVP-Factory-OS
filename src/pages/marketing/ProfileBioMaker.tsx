/**
 * D-588 프로필 소개 글 만들기 — 접힌 한 줄('프로필에는 뭐라고 쓰죠?')을 누르면 채널별 소개 글 초안 세 가지.
 *
 * 📐 첫 화면에는 한 줄만(접힘). 안에서: 재료 여섯 칸(내 브랜드에서 미리 채움) → 채널 탭(한 번에 하나) → 초안 세 가지 · 글자 수 · [복사].
 *  - 글은 services/marketing/profileBio(규칙 — AI 아님). 빈 칸은 [대괄호] 로 나오고, 어느 칸을 채우면 되는지 한 줄로 알려 준다.
 *  - 여기서 고친 칸은 저장하지 않는다(초안을 만드는 데만 쓴다) — 계속 쓰려면 설정 › 내 브랜드에 적는다.
 *  - 부풀리는 말(건수 늘리기 · 보장 · 시간 압박)은 있는 글 규칙(consultLint)으로 빨갛게 알려 준다.
 * 마케팅 영역 — 글자 15px 이상 · 쉬운 말(D-507) · 누르는 칸 44px.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy } from 'lucide-react'
import { useBrandProfile } from '../../services/brandProfile'
import { BIO_CHANNELS, BIO_FIELDS, bioBlanks, bioDrafts, bioInputFromBrand, type BioChannel, type BioInput } from '../../services/marketing/profileBio'
import { consultLint } from '../../services/marketing/consultRules'
import { axShown } from '../../services/marketing/persona'

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

export function ProfileBioMaker({ testId = 'mk-bio' }: { testId?: string }) {
  const { profile, loaded } = useBrandProfile()
  const base = useMemo(() => bioInputFromBrand(loaded ? profile : null), [profile, loaded])
  // 여기서 고친 칸만 따로 — 내 브랜드가 나중에 읽혀도 고친 칸은 그대로 둔다
  const [edits, setEdits] = useState<Partial<BioInput>>({})
  const input: BioInput = { ...base, ...edits }
  const [channel, setChannel] = useState<BioChannel>('sns')
  const [copied, setCopied] = useState<string>('')
  const cur = BIO_CHANNELS.find((c) => c.key === channel) ?? BIO_CHANNELS[0]
  const drafts = bioDrafts(input, channel)
  const blanks = bioBlanks(input)
  const warns = consultLint(Object.values(input).join('\n'), { ax: axShown() })

  return (
    <details className="rounded-(--radius-panel) border border-slate-200 bg-white" data-testid={testId}>
      <summary className="t-body flex min-h-12 cursor-pointer flex-wrap items-center gap-x-2 rounded-(--radius-panel) px-4 py-2.5 font-bold break-keep text-slate-900 hover:bg-slate-50" data-testid={`${testId}-toggle`} data-guide="fn-mk-bio">
        프로필에는 뭐라고 쓰죠? <span className="font-semibold text-brand-700">프로필 소개 글 만들기</span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-slate-100 px-4 py-4">
        <p className="t-body break-keep text-slate-800">
          글에서는 팔지 않고, <strong className="font-bold text-slate-900">상담 · 연락 받는 길은 프로필에</strong> 적어요. 아래 칸을 채우면 바로 붙여 넣을 소개 글이 나와요.
        </p>

        <div className="grid gap-3 sm:grid-cols-2" data-testid={`${testId}-fields`}>
          {BIO_FIELDS.map((f) => (
            <label key={f.key} className="flex min-w-0 flex-col gap-1">
              <span className="t-sub font-semibold text-slate-800">{f.label}</span>
              <input
                value={input[f.key]}
                onChange={(e) => setEdits((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                maxLength={120}
                className="min-h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 text-[0.9375rem] text-slate-900"
                data-testid={`${testId}-input`}
                data-key={f.key}
              />
            </label>
          ))}
        </div>
        {blanks.length > 0 && (
          <p role="status" className="t-sub break-keep text-slate-700" data-testid={`${testId}-blanks`}>
            비어 있는 칸은 [대괄호] 로 나와요 — <strong className="font-semibold text-slate-900">{blanks.join(' · ')}</strong> 을 채워 보세요. 늘 쓰려면{' '}
            <Link to="/settings" className="font-semibold text-brand-700 underline underline-offset-2">
              설정 › 내 브랜드
            </Link>
            에 적어 두면 돼요.
          </p>
        )}
        {warns.length > 0 && (
          <ul className="flex flex-col gap-1" aria-label="고치면 좋은 말" data-testid={`${testId}-warns`}>
            {warns.slice(0, 3).map((w, i) => (
              <li key={i} className="t-sub font-semibold break-keep text-danger-700">
                {w.text}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2">
          <div role="tablist" aria-label="어디 프로필인가요" className="flex flex-wrap gap-1.5" data-testid={`${testId}-tabs`}>
            {BIO_CHANNELS.map((c) => {
              const on = c.key === cur.key
              return (
                <button
                  key={c.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => {
                    setChannel(c.key)
                    setCopied('')
                  }}
                  className={`tap t-body min-h-11 rounded-full border px-3.5 font-semibold ${on ? 'border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-200' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}
                  data-testid={`${testId}-tab`}
                  data-key={c.key}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
          <p className="t-sub break-keep text-slate-700" data-testid={`${testId}-hint`}>
            {cur.hint}
          </p>
        </div>

        <ol className="flex flex-col gap-3" aria-label={`${cur.label} 소개 글 초안`} data-testid={`${testId}-drafts`}>
          {drafts.map((d) => (
            <li key={d.key} className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-white p-3" data-testid={`${testId}-draft`} data-key={d.key} data-over={d.over ? '1' : '0'}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="t-sub font-bold text-slate-900">{d.label}</span>
                <span className={`t-sub tabular-nums ${d.over ? 'font-bold text-danger-700' : 'text-slate-700'}`} data-testid={`${testId}-count`}>
                  {d.length} / {cur.limit}자{d.over ? ' — 넘어요 · 칸을 줄여 보세요' : ''}
                </span>
              </div>
              <p className="t-body break-keep whitespace-pre-wrap text-slate-900" data-testid={`${testId}-text`}>
                {d.text}
              </p>
              <button
                type="button"
                onClick={() => void copy(d.text).then((ok) => setCopied(ok ? d.key : ''))}
                className="tap t-body inline-flex min-h-11 items-center gap-1.5 self-start rounded-(--radius-control) border border-slate-300 bg-white px-3.5 font-semibold text-slate-800 hover:bg-slate-50"
                data-testid={`${testId}-copy`}
              >
                {copied === d.key ? <Check aria-hidden="true" className="size-4 text-success-700" /> : <Copy aria-hidden="true" className="size-4" />}
                {copied === d.key ? '복사했어요 — 프로필에 붙여 넣으세요' : '복사'}
              </button>
            </li>
          ))}
        </ol>
        <p className="t-sub break-keep text-slate-700">숫자 · 경력은 확인된 것만 적어요 — 적지 않은 것은 지어내지 않아요.</p>
      </div>
    </details>
  )
}
