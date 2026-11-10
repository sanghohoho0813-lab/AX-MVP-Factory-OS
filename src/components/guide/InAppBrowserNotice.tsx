/**
 * D-594 앱 안 브라우저 안내 — 카카오톡 · 네이버 · 인스타그램 안에서 열렸을 때만 보인다(평소 브라우저에서는 아무것도 없다).
 *
 * 한 칸: 지금 어디서 열렸는지 · 왜 바꾸는 게 좋은지 한 줄 · [다른 브라우저로 열기](길이 있을 때) · 글 안내 · [주소 복사].
 * 흰 칸 + 회색 테두리(강조는 글자로) — 다른 칸 안에 들어갈 때(compact)는 테두리 없이 글만(상자 안 상자를 만들지 않는다). 글자 15px 이상 · 누르는 칸 44px.
 */
import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { IN_APP_LABEL, currentInApp, externalOpenUrl } from '../../lib/inAppBrowser'

async function copyText(text: string): Promise<boolean> {
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

export function InAppBrowserNotice({ testId = 'inapp-notice', compact = false, className = '' }: { testId?: string; compact?: boolean; className?: string }) {
  const kind = currentInApp()
  const [copied, setCopied] = useState(false)
  if (!kind) return null
  const href = window.location.href
  const open = externalOpenUrl(kind, href, navigator.userAgent)
  return (
    <div role="note" className={`flex flex-col gap-2 ${compact ? '' : 'rounded-(--radius-panel) border border-slate-300 bg-white p-4'} ${className}`} data-testid={testId} data-kind={kind}>
      <p className="text-[1rem] font-bold break-keep text-slate-900">
        지금 <span className="text-danger-700">{IN_APP_LABEL[kind]} 안</span>에서 열렸어요
      </p>
      <p className="text-[0.9375rem] break-keep text-slate-700">
        {compact ? '여기서는 홈 화면에 넣을 수 없어요. 먼저 평소 쓰는 브라우저(사파리 · 크롬)로 여세요.' : '이대로 쓰면 로그인이 자주 풀리고, 파일 내려받기 · 홈 화면에 넣기가 안 돼요. 평소 쓰는 브라우저(사파리 · 크롬)로 여는 것이 좋아요.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {open && (
          <a href={open} className="tap inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) bg-brand-600 px-4 text-[0.9375rem] font-bold text-white hover:bg-brand-700" data-testid={`${testId}-open`}>
            <ExternalLink aria-hidden="true" className="size-4" /> 다른 브라우저로 열기
          </a>
        )}
        <button
          type="button"
          onClick={() => void copyText(href).then(setCopied)}
          className="tap inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3.5 text-[0.9375rem] font-semibold text-slate-800 hover:bg-slate-50"
          data-testid={`${testId}-copy`}
        >
          {copied ? <Check aria-hidden="true" className="size-4 text-success-700" /> : <Copy aria-hidden="true" className="size-4" />}
          {copied ? '복사했어요 — 브라우저 주소 칸에 붙여 넣으세요' : '주소 복사'}
        </button>
      </div>
      <p className="text-[0.9375rem] break-keep text-slate-600">
        {open ? '안 열리면 ' : ''}화면 모서리의 ⋮ (또는 공유 단추)를 눌러 &lsquo;다른 브라우저로 열기&rsquo; · &lsquo;Safari로 열기&rsquo; 를 고르세요.
      </p>
    </div>
  )
}
