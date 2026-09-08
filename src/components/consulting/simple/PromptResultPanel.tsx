/**
 * 프롬프트가 만들어진 직후 화면 (§13).
 *
 * 기본은 접혀 있다. 대표가 수천 글자를 매번 읽을 필요는 없다.
 * [복사] [ChatGPT 열기] [Claude 열기] [내용 보기] 만 보인다.
 */

import { useState } from 'react'
import { Check, ClipboardCopy, ExternalLink, FileDown } from 'lucide-react'
import type { ConsultingPromptPackage } from '../../../types/consulting'
import { privacySummary } from '../../../domain/consulting/privacyFilter'
import { Button } from '../../ui/Button'
import { copyText, downloadText } from '../studioParts'

export function PromptResultPanel({ pkg, onCopied }: { pkg: ConsultingPromptPackage; onCopied?: () => void }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const ok = await copyText(pkg.prompt)
    setCopied(ok)
    setTimeout(() => setCopied(false), 2200)
    onCopied?.()
  }
  const openAt = async (url: string) => {
    await copy()
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="rounded-(--radius-panel) border border-success-200 bg-success-50/40 p-5">
      <p className="t-card break-keep text-slate-900">프롬프트가 만들어졌습니다</p>
      <p className="t-sub mt-1 break-keep text-slate-700">
        {pkg.title} · {pkg.prompt.length.toLocaleString()}자
        {pkg.privacy.total > 0 && <span className="text-warning-700"> · {privacySummary(pkg.privacy)}</span>}
      </p>

      {/*
        강조 버튼은 하나다 (§13·§31). 대부분은 "복사해서 ChatGPT 에 붙여넣기" 하나면 끝난다.
        Claude 로 하거나 내용을 보는 것은 그 다음 줄에 약하게 둔다.
      */}
      <div className="mt-3">
        <Button variant="primary" size="md" className="w-full sm:w-auto" onClick={() => void openAt('https://chatgpt.com/')}>
          <ExternalLink aria-hidden="true" className="size-4" /> 복사하고 ChatGPT 열기
        </Button>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <button type="button" onClick={() => void copy()} className="tap t-sub inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900">
            {copied ? <Check aria-hidden="true" className="size-4 text-success-600" /> : <ClipboardCopy aria-hidden="true" className="size-4" />}
            {copied ? '복사했습니다' : '복사만 하기'}
          </button>
          <button type="button" onClick={() => void openAt('https://claude.ai/new')} className="tap t-sub inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900">
            <ExternalLink aria-hidden="true" className="size-4" /> Claude 에서 하기
          </button>
          <button type="button" onClick={() => setOpen((v) => !v)} className="tap t-sub font-medium text-slate-600 hover:text-slate-900">
            {open ? '접기' : '내용 보기'}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3">
          <textarea
            readOnly
            aria-label="프롬프트 내용"
            value={pkg.prompt}
            rows={14}
            className="t-sub w-full resize-y rounded-(--radius-control) border border-slate-200 bg-white px-3 py-3 font-mono leading-relaxed text-slate-800"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => downloadText(`${pkg.type}_prompt.md`, pkg.prompt)}>
              <FileDown aria-hidden="true" className="size-4" /> Markdown
            </Button>
            {pkg.context.trim() !== '' && (
              <Button size="sm" onClick={() => downloadText(`${pkg.type}_context.md`, pkg.context)}>
                <FileDown aria-hidden="true" className="size-4" /> 함께 붙일 회사 자료
              </Button>
            )}
          </div>
        </div>
      )}

      <p className="t-sub mt-3 break-keep text-slate-600">
        새 창에 <strong className="font-semibold">붙여넣기만</strong> 하면 됩니다. 결과가 나오면 아래에서 그대로 가져오세요.
      </p>
    </section>
  )
}
