import { useParams } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import type { ContentItemStatus, AssetStatus, WebsiteDesign } from '../../types/websiteDesign'
import {
  ASSET_STATUS_META,
  ASSET_TYPE_META,
  CONTENT_ITEM_STATUS_META,
  CONTENT_ITEM_TYPE_META,
} from '../../lib/websiteDesignMeta'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  WebsiteDesignEditError,
  updateAssetRequirement,
  updateContentItem,
} from '../../services/websiteDesignService'
import { AssetStatusBadge } from '../../components/websiteStudio/badges'
import { WebsiteSectionFrame } from './websiteShared'

const CONTENT_STATUSES: ContentItemStatus[] = ['ready', 'draft', 'needs_review', 'missing']
const ASSET_STATUSES: AssetStatus[] = ['ready', 'partial', 'replacement_possible', 'missing']

function ContentBody({ design }: { design: WebsiteDesign }) {
  const { showToast } = useToast()
  const run = (fn: () => void) => {
    try { fn(); showToast('저장했습니다.') } catch (error) { showToast(error instanceof WebsiteDesignEditError ? error.message : '처리 실패') }
  }
  const mustHave = [
    ...design.contentItems.filter((c) => c.required && c.status === 'missing').map((c) => c.title),
    ...design.assetRequirements.filter((a) => a.required && a.status === 'missing').map((a) => a.title),
  ]

  return (
    <>
      {mustHave.length > 0 && (
        <Panel title="홈페이지 제작 전에 반드시 받아야 할 자료">
          <ul className="flex flex-col gap-1.5">
            {mustHave.map((m) => (
              <li key={m} className="flex items-center gap-2 text-[0.9rem] text-slate-700">
                <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0 text-warning-500" />{m}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="콘텐츠 준비 상태" flush>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[0.9rem]">
            <thead>
              <tr className="border-b border-slate-100 text-[0.85rem] text-slate-400">
                <th scope="col" className="px-5 py-2.5 font-medium">콘텐츠</th>
                <th scope="col" className="px-3 py-2.5 font-medium">유형</th>
                <th scope="col" className="px-3 py-2.5 font-medium">필수</th>
                <th scope="col" className="px-3 py-2.5 font-medium">상태</th>
                <th scope="col" className="px-5 py-2.5 font-medium">담당자</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {design.contentItems.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-2.5 font-medium text-slate-700">{c.title}</td>
                  <td className="px-3 py-2.5 text-slate-500">{CONTENT_ITEM_TYPE_META[c.type].label}</td>
                  <td className="px-3 py-2.5 text-slate-500">{c.required ? '필수' : '선택'}</td>
                  <td className="px-3 py-2.5">
                    <select aria-label={`${c.title} 상태`} value={c.status} onChange={(e) => run(() => updateContentItem(design.id, c.id, { status: e.target.value as ContentItemStatus }))} className="rounded-(--radius-control) border border-slate-300 px-2 py-1 text-[0.85rem] text-slate-700 focus:border-brand-400 focus:outline-none">
                      {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{CONTENT_ITEM_STATUS_META[s].label}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-2.5">
                    <input aria-label={`${c.title} 담당자`} value={c.owner} onChange={(e) => updateContentItem(design.id, c.id, { owner: e.target.value })} placeholder="담당자" className="w-28 rounded-(--radius-control) border border-slate-300 px-2 py-1 text-[0.85rem] focus:border-brand-400 focus:outline-none" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="이미지·영상·로고 자산 준비 상태" flush>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[0.9rem]">
            <thead>
              <tr className="border-b border-slate-100 text-[0.85rem] text-slate-400">
                <th scope="col" className="px-5 py-2.5 font-medium">자산</th>
                <th scope="col" className="px-3 py-2.5 font-medium">수량</th>
                <th scope="col" className="px-3 py-2.5 font-medium">필수</th>
                <th scope="col" className="px-5 py-2.5 font-medium">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {design.assetRequirements.map((a) => (
                <tr key={a.id}>
                  <td className="px-5 py-2.5 font-medium text-slate-700">{a.title} <span className="text-[0.85rem] font-normal text-slate-400">{ASSET_TYPE_META[a.type].label}</span></td>
                  <td className="px-3 py-2.5 text-slate-500">{a.quantity}개</td>
                  <td className="px-3 py-2.5 text-slate-500">{a.required ? '필수' : '선택'}</td>
                  <td className="px-5 py-2.5 flex items-center gap-2">
                    <select aria-label={`${a.title} 상태`} value={a.status} onChange={(e) => run(() => updateAssetRequirement(design.id, a.id, { status: e.target.value as AssetStatus }))} className="rounded-(--radius-control) border border-slate-300 px-2 py-1 text-[0.85rem] text-slate-700 focus:border-brand-400 focus:outline-none">
                      {ASSET_STATUSES.map((s) => <option key={s} value={s}>{ASSET_STATUS_META[s].label}</option>)}
                    </select>
                    <AssetStatusBadge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-[0.85rem] text-slate-400">실제 파일 업로드는 하지 않으며 요구사항과 준비상태만 기록합니다.</p>
      </Panel>
    </>
  )
}

export function WebsiteContentPage() {
  const { projectId = '' } = useParams()
  return <WebsiteSectionFrame projectId={projectId} render={(design) => <ContentBody design={design} />} />
}
