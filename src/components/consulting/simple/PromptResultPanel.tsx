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
      <p className="t-sub mt-1 break-keep text-slate-600">
        {pkg.title} · {pkg.prompt.length.toLocaleString()}자
        {pkg.privacy.total > 0 && <span className="text-warning-700"> · {privacySummary(pkg.privacy)}</span>}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => void copy()}>
          {copied ? <Check aria-hidden="true" className="size-4" /> : <ClipboardCopy aria-hidden="true" className="size-4" />}
          {copied ? '복사했습니다' : '복사'}
        </Button>
        <Button onClick={() => void openAt('https://chatgpt.com/')}>
          <ExternalLink aria-hidden="true" className="size-4" /> ChatGPT 열기
        </Button>
        <Button onClick={() => void openAt('https://claude.ai/new')}>
          <ExternalLink aria-hidden="true" className="size-4" /> Claude 열기
        </Button>
        <Button variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? '접기' : '내용 보기'}
        </Button>
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

      <p className="t-meta mt-3 break-keep text-slate-500">
        붙여 넣고 결과가 나오면 아래에서 그대로 가져오면 됩니다. 종류·버전은 시스템이 정합니다.
      </p>
    </section>
  )
}
