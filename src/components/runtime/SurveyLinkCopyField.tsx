import { Check, Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/Button'

interface SurveyLinkCopyFieldProps {
  url: string
  onOpen?: () => void
}

/** 테스트 링크 표시 + 복사(클립보드 실패 시 직접 선택 안내) */
export function SurveyLinkCopyField({ url, onOpen }: SurveyLinkCopyFieldProps) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  const handleCopy = async () => {
    setFailed(false)
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
        return
      }
      throw new Error('clipboard unavailable')
    } catch {
      setFailed(true)
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          readOnly
          aria-label="테스트 링크"
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 bg-slate-50 px-3 font-mono text-[13px] text-slate-700"
        />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleCopy} className="flex-1 sm:flex-none">
            {copied ? (
              <>
                <Check aria-hidden="true" className="size-4 text-success-600" />
                복사됨
              </>
            ) : (
              <>
                <Copy aria-hidden="true" className="size-4" />
                테스트 링크 복사
              </>
            )}
          </Button>
          {onOpen && (
            <Button variant="secondary" onClick={onOpen} className="flex-1 sm:flex-none">
              <ExternalLink aria-hidden="true" className="size-4" />
              응답자 화면 열기
            </Button>
          )}
        </div>
      </div>
      {failed && (
        <p className="mt-1.5 text-xs break-keep text-warning-700">
          자동 복사에 실패했습니다. 위 입력창을 눌러 링크를 직접 선택·복사해 주세요.
        </p>
      )}
    </div>
  )
}
