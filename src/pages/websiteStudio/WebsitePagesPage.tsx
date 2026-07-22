import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from 'lucide-react'
import type { WebsiteDesign, WebsitePage, WebsiteSection } from '../../types/websiteDesign'
import {
  PAGE_STATUSES,
  PAGE_STATUS_META,
  SECTION_TYPES,
  SECTION_TYPE_META,
} from '../../lib/websiteDesignMeta'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  WebsiteDesignEditError,
  addSection,
  deleteSection,
  duplicateSection,
  moveSection,
  updateSection,
} from '../../services/websiteDesignService'
import { SectionStatusBadge, PageStatusBadge } from '../../components/websiteStudio/badges'
import { WebsiteSectionFrame } from './websiteShared'

function PagesBody({ design }: { design: WebsiteDesign }) {
  const { showToast } = useToast()
  const pages = design.pages.filter((p) => p.status !== 'excluded').sort((a, b) => a.orderIndex - b.orderIndex)
  return (
    <>
      <div className="rounded-(--radius-card) border border-brand-100 bg-brand-50/50 px-4 py-3">
        <p className="text-[0.9rem] break-keep text-slate-600">각 페이지의 섹션 구조·순서·목적·준비상태를 정리합니다. 복잡한 빌더가 아니라 블록 구조를 정리하는 도구입니다.</p>
      </div>
      {pages.map((p) => <PageCard key={p.id} design={design} page={p} onToast={showToast} />)}
    </>
  )
}

function PageCard({ design, page, onToast }: { design: WebsiteDesign; page: WebsitePage; onToast: (m: string) => void }) {
  const [addType, setAddType] = useState<WebsiteSection['sectionType']>('content')
  const sections = [...page.sections].sort((a, b) => a.orderIndex - b.orderIndex)
  const run = (fn: () => void, ok: string) => {
    try { fn(); onToast(ok) } catch (error) { onToast(error instanceof WebsiteDesignEditError ? error.message : '처리 실패') }
  }
  return (
    <Panel title={`${page.name} · 섹션 ${sections.length}개`} actions={<PageStatusBadge status={page.status} />}>
      <ul className="flex flex-col gap-2">
        {sections.map((s, i) => (
          <li key={s.id} className="rounded-(--radius-card) border border-slate-200 px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[0.85rem] font-semibold text-slate-500">{i + 1}</span>
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{s.title || SECTION_TYPE_META[s.sectionType].label}</p>
              <SectionStatusBadge status={s.contentStatus} />
              <select
                aria-label={`${SECTION_TYPE_META[s.sectionType].label} 범위`}
                value={s.scope}
                onChange={(e) => run(() => updateSection(design.id, page.id, s.id, { scope: e.target.value as WebsiteSection['scope'] }), '범위를 변경했습니다.')}
                className="rounded-(--radius-control) border border-slate-300 px-2 py-1 text-[0.85rem] text-slate-700 focus:border-brand-400 focus:outline-none"
              >
                {PAGE_STATUSES.map((sc) => <option key={sc} value={sc}>{PAGE_STATUS_META[sc].label}</option>)}
              </select>
              <div className="flex items-center gap-1">
                <IconBtn label="위로" onClick={() => run(() => moveSection(design.id, page.id, s.id, 'up'), '이동했습니다.')} disabled={i === 0}><ChevronUp className="size-4" /></IconBtn>
                <IconBtn label="아래로" onClick={() => run(() => moveSection(design.id, page.id, s.id, 'down'), '이동했습니다.')} disabled={i === sections.length - 1}><ChevronDown className="size-4" /></IconBtn>
                <IconBtn label="복제" onClick={() => run(() => duplicateSection(design.id, page.id, s.id), '복제했습니다.')}><Copy className="size-4" /></IconBtn>
                <IconBtn label="삭제" onClick={() => run(() => deleteSection(design.id, page.id, s.id), '삭제했습니다.')} danger><Trash2 className="size-4" /></IconBtn>
              </div>
            </div>
            {(s.keyMessage || s.requiredAssets.length > 0) && (
              <p className="mt-1.5 pl-8 text-[0.85rem] break-keep text-slate-500">
                {s.keyMessage && <span>{s.keyMessage}</span>}
                {s.requiredAssets.length > 0 && <span className="text-slate-400"> · 필요 이미지: {s.requiredAssets.join(', ')}</span>}
                {s.ctaActionId && <span className="text-brand-500"> · CTA 포함</span>}
              </p>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <select value={addType} onChange={(e) => setAddType(e.target.value as WebsiteSection['sectionType'])} aria-label="추가할 섹션 유형" className="rounded-(--radius-control) border border-slate-300 px-2.5 py-1.5 text-[0.9rem] text-slate-700 focus:border-brand-400 focus:outline-none">
          {SECTION_TYPES.map((st) => <option key={st} value={st}>{SECTION_TYPE_META[st].label}</option>)}
        </select>
        <button type="button" onClick={() => run(() => addSection(design.id, page.id, addType), '섹션을 추가했습니다.')} className="inline-flex items-center gap-1 rounded-(--radius-control) border border-slate-200 px-3 py-1.5 text-[0.9rem] font-medium text-slate-600 hover:bg-slate-50">
          <Plus aria-hidden="true" className="size-4" />섹션 추가
        </button>
      </div>
    </Panel>
  )
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={`flex size-8 items-center justify-center rounded-(--radius-control) border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${danger ? 'hover:text-danger-600' : 'hover:text-slate-800'}`}>
      {children}
    </button>
  )
}

export function WebsitePagesPage() {
  const { projectId = '' } = useParams()
  return <WebsiteSectionFrame projectId={projectId} render={(design) => <PagesBody design={design} />} />
}
