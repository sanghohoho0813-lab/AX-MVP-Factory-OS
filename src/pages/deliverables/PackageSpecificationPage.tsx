import { useParams } from 'react-router-dom'
import { Code2 } from 'lucide-react'
import type { DeliverablePackage, DeliverableSectionType } from '../../types/deliverables'
import { HelpNote } from '../../components/ui/HelpNote'
import { EmptyState } from '../../components/ui/EmptyState'
import { PackageSectionFrame, ReadOnlyNotice } from './deliverableShared'
import { SectionEditorCard } from './SectionEditorCard'

const SPEC_TYPES = new Set<DeliverableSectionType>([
  'workflow',
  'feature_specification',
  'screen_specification',
  'data_specification',
  'permission_specification',
  'business_rules',
  'ai_guardrails',
  'integration_scope',
  'acceptance_criteria',
  'test_scenarios',
])

function SpecificationBody({ pkg, packageId }: { pkg: DeliverablePackage; packageId: string }) {
  const readOnly =
    pkg.status === 'finalized' || pkg.status === 'superseded' || pkg.status === 'archived'

  const sections = [...pkg.sections]
    .filter((s) => SPEC_TYPES.has(s.type) && s.status !== 'excluded')
    .sort((a, b) => a.orderIndex - b.orderIndex)

  if (sections.length === 0) {
    return (
      <>
        <ReadOnlyNotice pkg={pkg} />
        <EmptyState
          icon={Code2}
          title="이 자료에는 AX 개발명세가 없습니다"
          description="개발명세는 확정된 AX MVP 설계에서 생성됩니다. 홈페이지 전용 자료이거나 AX 설계가 확정되지 않은 경우 표시되지 않습니다."
        />
      </>
    )
  }

  return (
    <>
      <HelpNote
        summary="개발자 전달용 AX 개발명세 Section을 검토하고 편집합니다."
        what="워크플로·기능·화면·데이터·권한·비즈니스 규칙 등 개발자가 바로 착수할 수 있는 명세를 다듬습니다."
        when="개발 전달자료를 확정하기 전에 명세 내용을 확인할 때 사용합니다."
        next="개발 프롬프트 화면에서 이 명세를 바탕으로 한 프롬프트를 확인하세요."
      />

      <div className="rounded-(--radius-card) border border-brand-100 bg-brand-50/40 px-4 py-3 text-[13px] break-keep text-slate-600">
        이 명세는 개발자 전달용 문서이며, 이 화면에서 실제 코딩은 하지 않습니다. 확정된 AX MVP 설계 스냅샷을 기준으로 생성됩니다.
      </div>

      <ReadOnlyNotice pkg={pkg} />

      {sections.map((section) => (
        <SectionEditorCard key={section.id} packageId={packageId} section={section} readOnly={readOnly} />
      ))}
    </>
  )
}

export function PackageSpecificationPage() {
  const { projectId = '', packageId = '' } = useParams()
  return (
    <PackageSectionFrame
      projectId={projectId}
      packageId={packageId}
      render={(pkg) => <SpecificationBody pkg={pkg} packageId={packageId} />}
    />
  )
}
