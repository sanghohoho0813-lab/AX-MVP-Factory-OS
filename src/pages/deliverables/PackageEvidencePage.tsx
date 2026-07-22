import { useParams } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import type {
  DeliverableEvidenceType,
  DeliverablePackage,
} from '../../types/deliverables'
import { Panel } from '../../components/ui/Panel'
import { HelpNote } from '../../components/ui/HelpNote'
import { EmptyState } from '../../components/ui/EmptyState'
import { ContentBlocks } from '../../components/deliverables/ContentBlockView'
import { PackageSectionFrame, ReadOnlyNotice, DeliverableNotFound } from './deliverableShared'

const EVIDENCE_TYPE_LABEL: Record<DeliverableEvidenceType, string> = {
  survey: '설문',
  assessment: '진단',
  selection: '과제선정',
  design: '설계',
  validation: '실제 사용 테스트',
  metric: 'KPI',
  document: '문서',
  link: '링크',
  manual: '수동',
}

function EvidenceTable({ pkg }: { pkg: DeliverablePackage }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[0.9rem]">
        <thead>
          <tr className="border-b border-slate-200">
            <th scope="col" className="px-2.5 py-2 text-left font-semibold text-slate-600">출처</th>
            <th scope="col" className="px-2.5 py-2 text-left font-semibold text-slate-600">유형</th>
            <th scope="col" className="px-2.5 py-2 text-left font-semibold text-slate-600">설명</th>
            <th scope="col" className="px-2.5 py-2 text-left font-semibold text-slate-600">검증</th>
            <th scope="col" className="px-2.5 py-2 text-left font-semibold text-slate-600">외부 링크</th>
          </tr>
        </thead>
        <tbody>
          {pkg.evidenceIndex.map((item) => (
            <tr key={item.id} className="border-b border-slate-100 align-top">
              <td className="px-2.5 py-2 break-keep text-slate-800">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{item.title}</span>
                  {item.internalOnly && (
                    <span className="inline-flex items-center rounded border border-danger-200 bg-danger-50 px-1.5 py-0.5 text-[0.82rem] font-semibold text-danger-600">
                      내부 전용
                    </span>
                  )}
                </div>
              </td>
              <td className="px-2.5 py-2 whitespace-nowrap text-slate-600">
                {EVIDENCE_TYPE_LABEL[item.evidenceType]}
              </td>
              <td className="px-2.5 py-2 break-keep whitespace-pre-wrap text-slate-600">
                {item.description || '-'}
              </td>
              <td className="px-2.5 py-2 whitespace-nowrap">
                {item.verified ? (
                  <span className="inline-flex items-center rounded-md border border-success-200 bg-success-50 px-2 py-0.5 text-[0.82rem] font-medium text-success-700">
                    확인
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-[0.82rem] font-medium text-warning-700">
                    확인 필요
                  </span>
                )}
              </td>
              <td className="px-2.5 py-2 break-all text-slate-500">
                {item.externalUrl ? (
                  <span title="외부 URL은 메타데이터로만 저장됩니다.">{item.externalUrl}</span>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EvidenceView({ pkg }: { pkg: DeliverablePackage }) {
  const evidenceSection = pkg.sections.find((s) => s.type === 'evidence_index')

  return (
    <div className="flex flex-col gap-5">
      <HelpNote
        summary={'증거 없는 수동 문장은 "수동 작성 · 근거 확인 필요"로 표시하며, 외부 URL은 메타데이터로만 저장합니다(Blob·base64 저장 안 함).'}
        what="자료에 사용된 출처(설문·진단·과제선정·설계·테스트·문서·링크)를 한곳에 정리합니다."
        when="고객·기관·개발자에게 자료의 근거를 설명하거나 검증 상태를 점검할 때 사용합니다."
        next="검토·확정 탭에서 근거가 확인된 자료를 확정할 수 있습니다."
      />
      <ReadOnlyNotice pkg={pkg} />

      <Panel title="근거 인덱스" flush={pkg.evidenceIndex.length > 0}>
        {pkg.evidenceIndex.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="아직 근거 항목이 없습니다."
            description="자료에 출처가 연결되면 근거 인덱스가 자동으로 채워집니다."
          />
        ) : (
          <EvidenceTable pkg={pkg} />
        )}
      </Panel>

      {evidenceSection && evidenceSection.structuredContent.length > 0 && (
        <Panel title={evidenceSection.title || '근거 상세'}>
          <ContentBlocks blocks={evidenceSection.structuredContent} showInternal={true} />
        </Panel>
      )}
    </div>
  )
}

export function PackageEvidencePage() {
  const { projectId, packageId } = useParams<{ projectId: string; packageId: string }>()
  if (!projectId || !packageId) return <DeliverableNotFound />
  return (
    <PackageSectionFrame
      projectId={projectId}
      packageId={packageId}
      render={(pkg) => <EvidenceView pkg={pkg} />}
    />
  )
}
