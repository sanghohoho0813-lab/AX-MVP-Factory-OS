import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Copy, Download, RefreshCw, Sparkles } from 'lucide-react'
import type { WebsiteDesign, WebsitePromptType } from '../../types/websiteDesign'
import { PROMPT_TYPES, PROMPT_TYPE_META } from '../../lib/websiteDesignMeta'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  WebsiteDesignEditError,
  generatePrompt,
  regeneratePrompt,
  updatePromptContent,
} from '../../services/websiteDesignService'
import { WebsiteSectionFrame } from './websiteShared'

function PromptBody({ design }: { design: WebsiteDesign }) {
  const { showToast } = useToast()
  const [active, setActive] = useState<WebsitePromptType>('claude_code')
  const [live, setLive] = useState('')
  const [draft, setDraft] = useState<string | null>(null)
  const prompt = design.generatedPrompts.find((p) => p.type === active)

  const run = (fn: () => void, ok: string) => {
    try { fn(); showToast(ok); setDraft(null) } catch (error) { showToast(error instanceof WebsiteDesignEditError ? error.message : '처리 실패') }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard?.writeText(text)
      setLive('개발 지시문을 복사했습니다.')
      showToast('복사했습니다.')
    } catch {
      setLive('복사에 실패했습니다.')
      showToast('복사에 실패했습니다. 텍스트를 직접 선택해 복사하세요.')
    }
  }

  const download = (text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${design.name}-${active}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setLive('개발 지시문을 파일로 내려받았습니다.')
  }

  return (
    <>
      <div className="rounded-(--radius-card) border border-brand-100 bg-brand-50/50 px-4 py-3">
        <p className="text-[0.9rem] break-keep text-slate-600">사이트 구조·디자인·콘텐츠를 바탕으로 개발 지시문을 조립합니다. 렌더마다 자동 생성하지 않고, 명시적으로 생성합니다.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PROMPT_TYPES.map((t) => (
          <button key={t} type="button" onClick={() => { setActive(t); setDraft(null) }}
            className={`rounded-(--radius-control) border px-3 py-1.5 text-[0.9rem] font-medium transition-colors ${t === active ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            {PROMPT_TYPE_META[t].label}
          </button>
        ))}
      </div>

      <p aria-live="polite" className="sr-only">{live}</p>

      <Panel title={PROMPT_TYPE_META[active].label}>
        <p className="mb-3 text-[0.9rem] break-keep text-slate-500">{PROMPT_TYPE_META[active].description}</p>
        {!prompt ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-[0.9rem] text-slate-500">아직 생성되지 않았습니다.</p>
            <Button variant="primary" onClick={() => run(() => generatePrompt(design.id, active), '개발 지시문을 생성했습니다.')}>
              <Sparkles aria-hidden="true" className="size-4" />
              개발 지시문 생성
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => copy(draft ?? prompt.content)}><Copy aria-hidden="true" className="size-4" />전체 복사</Button>
              <Button variant="secondary" size="sm" onClick={() => download(draft ?? prompt.content)}><Download aria-hidden="true" className="size-4" />파일로 저장</Button>
              <Button variant="secondary" size="sm" onClick={() => run(() => regeneratePrompt(design.id, active), '원본으로 재생성했습니다.')}><RefreshCw aria-hidden="true" className="size-4" />원본 재생성</Button>
              {prompt.manuallyEdited && <span className="rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-[0.85rem] font-medium text-warning-700">수정됨</span>}
            </div>
            <label htmlFor="prompt-text" className="text-[0.85rem] font-semibold text-slate-500">개발 지시문 텍스트 (직접 수정 가능)</label>
            <textarea
              id="prompt-text"
              value={draft ?? prompt.content}
              onChange={(e) => setDraft(e.target.value)}
              rows={20}
              className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 font-mono text-[0.9rem] leading-relaxed text-slate-700 focus:border-brand-400 focus:outline-none"
            />
            {draft !== null && draft !== prompt.content && (
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={() => run(() => updatePromptContent(design.id, prompt.id, draft), '수정본을 저장했습니다.')}>수정본 저장</Button>
                <Button variant="secondary" size="sm" onClick={() => setDraft(null)}>취소</Button>
              </div>
            )}
          </div>
        )}
      </Panel>
    </>
  )
}

export function WebsitePromptPage() {
  const { projectId = '' } = useParams()
  return <WebsiteSectionFrame projectId={projectId} render={(design) => <PromptBody design={design} />} />
}
