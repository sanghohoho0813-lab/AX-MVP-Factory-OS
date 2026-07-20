import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileJson, FileText, FileType, Printer } from 'lucide-react'
import type {
  DeliverableAudience,
  DeliverableExportFormat,
  DeliverablePackage,
  DeliverableSection,
} from '../../types/deliverables'
import type { Project } from '../../types/domain'
import { AUDIENCE_META, INSTITUTION_DISCLAIMER, PACKAGE_TYPE_META } from '../../lib/deliverableMeta'
import { exportPackage, getRedactedView } from '../../services/deliverableService'
import { Button } from '../../components/ui/Button'
import { HelpNote } from '../../components/ui/HelpNote'
import { ContentBlocks } from '../../components/deliverables/ContentBlockView'
import { useToast } from '../../components/ui/toastContext'
import { PackageSectionFrame } from './deliverableShared'

/** 미리보기에서 선택 가능한 대상 독자 (혼합 제외) */
const PREVIEW_AUDIENCES: DeliverableAudience[] = ['internal', 'client', 'developer', 'institution']

/** 페이지 나눔을 넣을 주요 Section */
const PAGE_BREAK_TYPES = new Set(['cover', 'executive_summary'])

const EXPORT_MIME: Record<Exclude<DeliverableExportFormat, 'print'>, string> = {
  markdown: 'text/markdown',
  text: 'text/plain',
  json: 'application/json',
}

const EXPORT_LABEL: Record<Exclude<DeliverableExportFormat, 'print'>, string> = {
  markdown: 'Markdown',
  text: '텍스트',
  json: 'JSON',
}

/** 브라우저에서 즉시 파일을 생성해 내려받는다 (Blob·base64를 저장하지 않는다). */
function download(content: string, fileName: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function SectionBlock({
  section,
  index,
  showInternal,
}: {
  section: DeliverableSection
  index: number
  showInternal: boolean
}) {
  const isCover = section.type === 'cover'
  const majorBreak = PAGE_BREAK_TYPES.has(section.type) && index > 0
  const Heading = isCover ? 'h1' : 'h2'
  return (
    <section className={`avoid-break flex flex-col gap-3${majorBreak ? ' print-page-break' : ''}`}>
      <div className="flex flex-col gap-1 border-b border-slate-200 pb-2">
        <Heading className={`break-keep font-bold text-slate-900 ${isCover ? 'text-2xl' : 'text-lg'}`}>
          {section.title}
        </Heading>
        {section.subtitle && <p className="text-[13px] break-keep text-slate-500">{section.subtitle}</p>}
      </div>
      <ContentBlocks blocks={section.structuredContent} showInternal={showInternal} />
    </section>
  )
}

function PreviewBody({
  pkg,
  project,
  organizationName,
  packageId,
}: {
  pkg: DeliverablePackage
  project: Project
  organizationName: string
  packageId: string
}) {
  const { showToast } = useToast()
  const [audience, setAudience] = useState<DeliverableAudience>('internal')
  const [statusMessage, setStatusMessage] = useState('')

  const view = useMemo(() => getRedactedView(pkg, audience), [pkg, audience])
  const showInternal = audience === 'internal' || audience === 'mixed'
  const isRedactedAudience = !showInternal
  const includesValidation = pkg.includedTracks.includes('validation')
  const isInstitution = pkg.type === 'institution_preparation'

  function handleExport(format: Exclude<DeliverableExportFormat, 'print'>) {
    try {
      const { content, fileName } = exportPackage(packageId, format, audience)
      download(content, fileName, EXPORT_MIME[format])
      setStatusMessage(`${EXPORT_LABEL[format]} 파일 "${fileName}"을 내려받았습니다.`)
      showToast(`${EXPORT_LABEL[format]} 파일을 내보냈습니다.`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '내보내기에 실패했습니다.')
    }
  }

  function handlePrint() {
    setStatusMessage('인쇄·PDF 저장 창을 열었습니다.')
    window.print()
  }

  return (
    <>
      <HelpNote
        summary="선택한 대상 독자 기준으로 최종 문서를 미리 보고, 인쇄·PDF로 저장하거나 파일로 내보냅니다."
        what="대상 독자에 맞춰 내부 전용 Section·항목을 숨긴 문서를 렌더합니다."
        when="검토를 마친 뒤 고객·개발자·기관에 전달할 자료를 확인·배포할 때 사용합니다."
        next="문서가 맞으면 검토·확정 화면에서 자료를 확정하세요."
      />

      {/* 도구 모음 (인쇄 시 숨김) */}
      <div className="no-print flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)">
        <div
          role="radiogroup"
          aria-label="대상 독자"
          className="flex flex-wrap items-center gap-2"
        >
          <span className="mr-1 text-[13px] font-medium text-slate-500">대상 독자</span>
          {PREVIEW_AUDIENCES.map((a) => {
            const active = audience === a
            return (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setAudience(a)}
                className={`inline-flex items-center gap-1.5 rounded-(--radius-control) border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {AUDIENCE_META[a].label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <Button variant="primary" size="sm" onClick={handlePrint}>
            <Printer aria-hidden="true" className="size-4" />
            인쇄·PDF 저장
          </Button>
          <span className="mx-1 text-slate-300">|</span>
          <Button variant="secondary" size="sm" onClick={() => handleExport('markdown')}>
            <FileText aria-hidden="true" className="size-4" />
            Markdown
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport('text')}>
            <FileType aria-hidden="true" className="size-4" />
            텍스트
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport('json')}>
            <FileJson aria-hidden="true" className="size-4" />
            JSON
          </Button>
        </div>

        {isRedactedAudience && (view.removedSectionCount > 0 || view.removedBlockCount > 0) && (
          <p className="text-[13px] break-keep text-slate-500">
            이 보기에서 {view.removedSectionCount}개 Section·{view.removedBlockCount}개 내부 항목이 숨겨졌습니다.
          </p>
        )}
        <p aria-live="polite" className="min-h-[1rem] text-[13px] break-keep text-success-700">
          {statusMessage}
        </p>
      </div>

      {/* 인쇄·내보내기 대상 문서 */}
      <div className="print-document flex flex-col gap-6 rounded-(--radius-panel) border border-slate-200 bg-white p-6 shadow-(--shadow-card) sm:p-8">
        {/* 표지 */}
        <header className="avoid-break flex flex-col gap-2 border-b-2 border-slate-900 pb-5 print-page-break">
          <p className="text-[13px] font-medium text-slate-500">{organizationName}</p>
          <h1 className="text-2xl font-bold break-keep text-slate-900">{pkg.name}</h1>
          {pkg.description && <p className="text-[13px] break-keep text-slate-600">{pkg.description}</p>}
          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-slate-400">프로젝트</dt>
              <dd className="break-keep text-slate-700">{project.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-slate-400">유형</dt>
              <dd className="break-keep text-slate-700">{PACKAGE_TYPE_META[pkg.type].label}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-slate-400">대상 독자</dt>
              <dd className="break-keep text-slate-700">{AUDIENCE_META[audience].label}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-slate-400">버전</dt>
              <dd className="text-slate-700">v{pkg.version}</dd>
            </div>
          </dl>
        </header>

        {isInstitution && (
          <div className="avoid-break rounded-(--radius-card) border border-success-200 bg-success-50/70 px-4 py-3">
            <p className="text-[13px] font-semibold break-keep text-success-800">기관 제출 준비 안내</p>
            <p className="mt-1 text-[13px] leading-relaxed break-keep text-success-800">{INSTITUTION_DISCLAIMER}</p>
          </div>
        )}

        {!includesValidation && (
          <div className="avoid-break rounded-(--radius-card) border border-warning-200 bg-warning-50/70 px-4 py-3">
            <p className="text-[13px] leading-relaxed break-keep text-warning-800">
              검증 전 설계안입니다. 실제 사용 테스트로 검증되지 않은 설계 기준의 자료이며, 검증 완료 자료가 아닙니다.
            </p>
          </div>
        )}

        {view.sections.length === 0 ? (
          <p className="text-[13px] break-keep text-slate-500">이 대상 독자에게 공개할 Section이 없습니다.</p>
        ) : (
          view.sections.map((section, index) => (
            <SectionBlock key={section.id} section={section} index={index} showInternal={showInternal} />
          ))
        )}
      </div>
    </>
  )
}

export function PackagePreviewPage() {
  const { projectId = '', packageId = '' } = useParams()
  return (
    <PackageSectionFrame
      projectId={projectId}
      packageId={packageId}
      render={(pkg, project, organizationName) => (
        <PreviewBody pkg={pkg} project={project} organizationName={organizationName} packageId={packageId} />
      )}
    />
  )
}
