import { useParams } from 'react-router-dom'
import { Boxes, ShieldAlert } from 'lucide-react'
import { Panel } from '../../components/ui/Panel'
import { EmptyState } from '../../components/ui/EmptyState'
import { FIELD_TYPE_META } from '../../lib/mvpDesignMeta'
import { DesignSectionFrame } from './designShared'

export function DesignDataPage() {
  const { projectId = '' } = useParams()
  return (
    <DesignSectionFrame
      projectId={projectId}
      render={(design) => {
        const entities = [...design.entities].sort((a, b) => a.order - b.order)
        return (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-3 text-[13px]">
              <Boxes aria-hidden="true" className="size-4 text-slate-400" />
              <span className="text-slate-600">데이터 {entities.length}종</span>
              {entities.some((e) => e.hasSensitiveData) && (
                <span className="inline-flex items-center gap-1 text-warning-600"><ShieldAlert aria-hidden="true" className="size-3.5" />민감정보 포함</span>
              )}
            </div>
            {entities.length === 0 ? (
              <Panel title="데이터" flush>
                <EmptyState icon={Boxes} title="데이터가 없습니다" description="Must/Should 기능이 지정되면 필요한 데이터가 도출됩니다." />
              </Panel>
            ) : (
              entities.map((entity) => (
                <Panel key={entity.id} title={`${entity.label} · ${entity.name}`}>
                  <p className="mb-3 text-[13px] break-keep text-slate-500">{entity.description}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs text-slate-400">
                          <th className="py-2 pr-3 font-medium">필드</th>
                          <th className="py-2 pr-3 font-medium">유형</th>
                          <th className="py-2 pr-3 font-medium">필수</th>
                          <th className="py-2 font-medium">설명</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {entity.fields.map((f) => (
                          <tr key={f.id}>
                            <td className="py-2 pr-3">
                              <span className="font-medium text-slate-700">{f.label}</span>
                              {f.sensitive && <span className="ml-1.5 rounded border border-warning-200 bg-warning-50 px-1 text-[10px] text-warning-700">민감</span>}
                              <span className="ml-1 text-xs text-slate-400">{f.name}</span>
                            </td>
                            <td className="py-2 pr-3 text-slate-600">{FIELD_TYPE_META[f.type].label}</td>
                            <td className="py-2 pr-3 text-slate-500">{f.required ? '필수' : '선택'}</td>
                            <td className="py-2 break-keep text-slate-500">{f.computedFrom ? `계산: ${f.computedFrom}` : f.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              ))
            )}
          </>
        )
      }}
    />
  )
}
