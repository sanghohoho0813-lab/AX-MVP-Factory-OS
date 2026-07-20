import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, Copy, Network, Plus, Trash2 } from 'lucide-react'
import type { WebsiteDesign, WebsitePageStatus } from '../../types/websiteDesign'
import { PAGE_STATUSES, PAGE_STATUS_META, PAGE_TYPE_META } from '../../lib/websiteDesignMeta'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  WebsiteDesignEditError,
  addPage,
  deletePage,
  duplicatePage,
  movePage,
  setPageStatus,
} from '../../services/websiteDesignService'
import { PageStatusBadge } from '../../components/websiteStudio/badges'
import { WebsiteSectionFrame } from './websiteShared'

function SitemapBody({ design }: { design: WebsiteDesign }) {
  const { showToast } = useToast()
  const [newName, setNewName] = useState('')
  const pages = [...design.pages].sort((a, b) => a.orderIndex - b.orderIndex)

  const run = (fn: () => void, ok: string) => {
    try { fn(); showToast(ok) } catch (error) { showToast(error instanceof WebsiteDesignEditError ? error.message : '처리 실패') }
  }

  const add = () => {
    if (!newName.trim()) return
    run(() => addPage(design.id, newName.trim()), '페이지를 추가했습니다.')
    setNewName('')
  }

  return (
    <>
      <div className="rounded-(--radius-card) border border-brand-100 bg-brand-50/50 px-4 py-3">
        <p className="flex items-start gap-2 text-[13px] break-keep text-slate-600">
          <Network aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-brand-500" />
          1차 홈페이지는 꼭 필요한 페이지만 담습니다. 필요 없는 페이지는 나중에·제외로 미루세요. (활성 페이지 최대 8개)
        </p>
      </div>

      <Panel title={`사이트 구조 (${pages.filter((p) => p.status !== 'excluded').length}개 활성)`}>
        <ul className="flex flex-col gap-2">
          {pages.map((p, i) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-(--radius-card) border border-slate-200 px-3.5 py-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{p.name} <span className="text-xs font-normal text-slate-400">{p.slug}</span></p>
                <p className="text-xs text-slate-400">{PAGE_TYPE_META[p.pageType].label} · 섹션 {p.sections.length}개</p>
              </div>
              <select
                aria-label={`${p.name} 상태`}
                value={p.status}
                onChange={(e) => run(() => setPageStatus(design.id, p.id, e.target.value as WebsitePageStatus), '상태를 변경했습니다.')}
                className="rounded-(--radius-control) border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-brand-400 focus:outline-none"
              >
                {PAGE_STATUSES.map((s) => <option key={s} value={s}>{PAGE_STATUS_META[s].label}</option>)}
              </select>
              <PageStatusBadge status={p.status} />
              <div className="flex items-center gap-1">
                <IconBtn label="위로" onClick={() => run(() => movePage(design.id, p.id, 'up'), '이동했습니다.')} disabled={i === 0}><ChevronUp className="size-4" /></IconBtn>
                <IconBtn label="아래로" onClick={() => run(() => movePage(design.id, p.id, 'down'), '이동했습니다.')} disabled={i === pages.length - 1}><ChevronDown className="size-4" /></IconBtn>
                <IconBtn label="복제" onClick={() => run(() => duplicatePage(design.id, p.id), '복제했습니다.')}><Copy className="size-4" /></IconBtn>
                <IconBtn label="삭제" onClick={() => run(() => deletePage(design.id, p.id), '삭제했습니다.')} danger><Trash2 className="size-4" /></IconBtn>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex max-w-[560px] items-end gap-2">
          <label className="min-w-0 flex-1 text-xs font-semibold text-slate-500">새 페이지 이름
            <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} className="mt-0.5 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[14px] focus:border-brand-400 focus:outline-none" placeholder="예: 자료실" />
          </label>
          <Button variant="secondary" onClick={add}><Plus aria-hidden="true" className="size-4" />페이지 추가</Button>
        </div>
      </Panel>
    </>
  )
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex size-8 items-center justify-center rounded-(--radius-control) border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${danger ? 'hover:text-danger-600' : 'hover:text-slate-800'}`}
    >
      {children}
    </button>
  )
}

export function WebsiteSitemapPage() {
  const { projectId = '' } = useParams()
  return <WebsiteSectionFrame projectId={projectId} render={(design) => <SitemapBody design={design} />} />
}
