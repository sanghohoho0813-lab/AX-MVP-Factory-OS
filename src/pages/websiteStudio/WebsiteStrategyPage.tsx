import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Users } from 'lucide-react'
import type { WebsiteDesign, WebsiteType } from '../../types/websiteDesign'
import { WEBSITE_TYPES, WEBSITE_TYPE_META, CONVERSION_PRIORITY_META } from '../../lib/websiteDesignMeta'
import { TONE_BADGE_CLASS } from '../../lib/statusMeta'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  WebsiteDesignEditError,
  setWebsiteType,
  updateConversionAction,
  updateStrategy,
} from '../../services/websiteDesignService'
import { WebsiteSectionFrame } from './websiteShared'

function StrategyBody({ design }: { design: WebsiteDesign }) {
  const { showToast } = useToast()
  const [purpose, setPurpose] = useState(design.strategy.purpose)
  const [keyMessage, setKeyMessage] = useState(design.strategy.keyMessage)
  const [type, setType] = useState<WebsiteType>(design.strategy.websiteType)
  const [reason, setReason] = useState(design.strategy.websiteTypeOverrideReason)
  const isOverride = type !== design.strategy.websiteType

  const saveText = () => {
    try {
      updateStrategy(design.id, { purpose, keyMessage })
      showToast('저장했습니다.')
    } catch (error) {
      showToast(error instanceof WebsiteDesignEditError ? error.message : '저장 실패')
    }
  }

  const applyType = () => {
    try {
      setWebsiteType(design.id, type, reason)
      showToast('홈페이지 유형을 변경하고 사이트 구조를 다시 생성했습니다.')
    } catch (error) {
      showToast(error instanceof WebsiteDesignEditError ? error.message : '유형 변경 실패')
    }
  }

  const primary = design.strategy.conversionActions.find((c) => c.id === design.strategy.primaryConversionActionId)

  return (
    <>
      <Panel title="홈페이지 유형">
        <p className="mb-2 text-[13px] break-keep text-slate-500">추천: <span className="font-medium text-slate-700">{WEBSITE_TYPE_META[design.strategy.websiteType].label}</span> — {design.strategy.websiteTypeReason}</p>
        <div className="flex flex-wrap gap-2">
          {WEBSITE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-(--radius-control) border px-3 py-1.5 text-[13px] font-medium transition-colors ${t === type ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              {WEBSITE_TYPE_META[t].label}
            </button>
          ))}
        </div>
        {isOverride && (
          <div className="mt-3">
            <label htmlFor="type-reason" className="mb-1 block text-xs font-semibold text-slate-500">유형 변경 사유 (필수)</label>
            <textarea id="type-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[13px] focus:border-brand-400 focus:outline-none" placeholder="예: 사례 노출이 핵심이라 포트폴리오형으로 변경합니다." />
          </div>
        )}
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={applyType} disabled={!isOverride}>유형 적용 · 사이트 구조 재생성</Button>
        </div>
      </Panel>

      <Panel title="홈페이지 목표">
        <div className="flex max-w-[1000px] flex-col gap-3">
          <div>
            <label htmlFor="s-purpose" className="mb-1 block text-xs font-semibold text-slate-500">홈페이지 목적</label>
            <textarea id="s-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[14px] focus:border-brand-400 focus:outline-none" />
          </div>
          <div>
            <label htmlFor="s-msg" className="mb-1 block text-xs font-semibold text-slate-500">핵심 메시지</label>
            <input id="s-msg" value={keyMessage} onChange={(e) => setKeyMessage(e.target.value)} className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[14px] focus:border-brand-400 focus:outline-none" />
          </div>
          <div><Button variant="secondary" size="sm" onClick={saveText}>저장</Button></div>
        </div>
      </Panel>

      <Panel title="핵심 고객">
        <ul className="flex flex-col gap-3">
          {design.strategy.audiences.map((a) => (
            <li key={a.id} className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <Users aria-hidden="true" className="size-4 text-slate-400" />
                <p className="text-sm font-semibold text-slate-800">{a.name}</p>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500">{a.priority === 'primary' ? '핵심' : '보조'}</span>
              </div>
              <p className="mt-1 text-[13px] break-keep text-slate-600">{a.description}</p>
              {a.trustNeeds.length > 0 && <p className="mt-1 text-xs text-slate-400">신뢰 요소: {a.trustNeeds.join(', ')}</p>}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="핵심 전환 행동(CTA)">
        <p className="mb-3 text-[13px] break-keep text-slate-500">핵심 CTA: <span className="font-medium text-slate-700">{primary?.label ?? '미설정'}</span></p>
        <ul className="flex flex-col gap-3">
          {design.strategy.conversionActions.map((c) => (
            <li key={c.id} className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${TONE_BADGE_CLASS[CONVERSION_PRIORITY_META[c.priority].tone]}`}>{CONVERSION_PRIORITY_META[c.priority].label}</span>
                <p className="text-sm font-semibold text-slate-800">{c.label}</p>
              </div>
              <div className="mt-2 grid max-w-[700px] grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="text-xs text-slate-500">행동 이름
                  <input value={c.label} onChange={(e) => updateConversionAction(design.id, c.id, { label: e.target.value })} className="mt-0.5 w-full rounded-(--radius-control) border border-slate-300 px-2.5 py-1.5 text-[13px] text-slate-700 focus:border-brand-400 focus:outline-none" />
                </label>
                <label className="text-xs text-slate-500">버튼 문구
                  <input value={c.buttonText} onChange={(e) => updateConversionAction(design.id, c.id, { buttonText: e.target.value })} className="mt-0.5 w-full rounded-(--radius-control) border border-slate-300 px-2.5 py-1.5 text-[13px] text-slate-700 focus:border-brand-400 focus:outline-none" />
                </label>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}

export function WebsiteStrategyPage() {
  const { projectId = '' } = useParams()
  return <WebsiteSectionFrame projectId={projectId} render={(design) => <StrategyBody design={design} />} />
}
