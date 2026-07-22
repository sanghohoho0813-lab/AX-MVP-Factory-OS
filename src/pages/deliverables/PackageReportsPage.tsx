import { useParams } from 'react-router-dom'
import { FileText } from 'lucide-react'
import type { DeliverablePackage, DeliverableSectionType } from '../../types/deliverables'
import { HelpNote } from '../../components/ui/HelpNote'
import { EmptyState } from '../../components/ui/EmptyState'
import { PackageSectionFrame, ReadOnlyNotice } from './deliverableShared'
import { SectionEditorCard } from './SectionEditorCard'

const REPORT_TYPES = new Set<DeliverableSectionType>([
  'cover',
  'executive_summary',
  'company_profile',
  'project_overview',
  'diagnosis_summary',
  'ax_suitability',
  'website_readiness',
  'selected_task',
  'priority_matrix',
  'mvp_scope',
  'website_strategy',
  'sitemap',
  'page_sections',
  'content_assets',
  'validation_summary',
  'stage_gate',
  'kpi_results',
  'issue_summary',
  'implementation_roadmap',
  'risk_register',
  'evidence_index',
])

function ReportsBody({ pkg, packageId }: { pkg: DeliverablePackage; packageId: string }) {
  const readOnly =
    pkg.status === 'finalized' || pkg.status === 'superseded' || pkg.status === 'archived'

  const sections = [...pkg.sections]
    .filter((s) => REPORT_TYPES.has(s.type) && s.status !== 'excluded')
    .sort((a, b) => a.orderIndex - b.orderIndex)

  return (
    <>
      <HelpNote
        summary="보고서 성격의 Section 본문을 검토하고 편집합니다."
        what="자동 생성된 본문을 수정하거나, 최신 출처로 원본을 재생성하고, 검토 완료로 표시합니다."
        when="자료를 확정하기 전 보고서 내용을 다듬을 때 사용합니다."
        next="개발명세는 개발명세 화면에서, 대상별 노출은 미리보기에서 확인하세요."
      />

      <ReadOnlyNotice pkg={pkg} />

      {sections.length > 0 ? (
        sections.map((section) => (
          <SectionEditorCard key={section.id} packageId={packageId} section={section} readOnly={readOnly} />
        ))
      ) : (
        <EmptyState
          icon={FileText}
          title="포함된 보고서 Section이 없습니다"
          description="포함 자료 화면에서 Section을 포함하거나, 다른 유형의 자료를 확인하세요."
        />
      )}
    </>
  )
}

export function PackageReportsPage() {
  const { projectId = '', packageId = '' } = useParams()
  return (
    <PackageSectionFrame
      projectId={projectId}
      packageId={packageId}
      render={(pkg) => <ReportsBody pkg={pkg} packageId={packageId} />}
    />
  )
}
