import { useParams } from 'react-router-dom'
import { ShieldCheck, Star } from 'lucide-react'
import type { MvpDesign, RolePermissionAction } from '../../types/mvpDesign'
import { Panel } from '../../components/ui/Panel'
import { DesignSectionFrame } from './designShared'

const ACTION_LABEL: Record<RolePermissionAction, string> = {
  create: '등록',
  read: '조회',
  update: '수정',
  delete: '삭제',
  approve: '승인',
  export: '내보내기',
}

function actionsFor(design: MvpDesign, roleId: string, entityId: string): RolePermissionAction[] {
  const perm = design.permissions.find((p) => p.roleId === roleId && p.entityId === entityId)
  return perm?.actions ?? []
}

export function DesignPermissionsPage() {
  const { projectId = '' } = useParams()
  return (
    <DesignSectionFrame
      projectId={projectId}
      render={(design) => {
        const roles = [...design.roles].sort((a, b) => a.order - b.order)
        const entities = [...design.entities].sort((a, b) => a.order - b.order)
        const overLimit = design.guardrailChecks.find((g) => g.key === 'max_roles')
        return (
          <>
            <Panel title={`역할 · ${roles.length}개`}>
              {overLimit && overLimit.status === 'exceeded' && (
                <p className="mb-3 text-[13px] font-medium text-danger-600">역할이 상한(3개)을 초과했습니다. 1차 범위에서는 역할을 최소화하세요.</p>
              )}
              <ul className="flex flex-col gap-3">
                {roles.map((role) => (
                  <li key={role.id} className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck aria-hidden="true" className="size-4 text-slate-400" />
                      <p className="text-sm font-semibold text-slate-800">{role.name}</p>
                      {role.isPrimaryUser && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-success-200 bg-success-50 px-1.5 py-0.5 text-[11px] font-medium text-success-700">
                          <Star aria-hidden="true" className="size-3" />주 사용자
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[13px] break-keep text-slate-500">{role.description}</p>
                    <p className="mt-1 text-xs text-slate-400">실제 사용자: {role.sourceUsers}</p>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="권한 매트릭스">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-400">
                      <th className="py-2 pr-3 font-medium">데이터</th>
                      {roles.map((r) => (
                        <th key={r.id} className="py-2 pr-3 font-medium">{r.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {entities.map((ent) => (
                      <tr key={ent.id}>
                        <td className="py-2 pr-3 font-medium text-slate-700">{ent.label}</td>
                        {roles.map((role) => {
                          const actions = actionsFor(design, role.id, ent.id)
                          return (
                            <td key={role.id} className="py-2 pr-3 text-slate-500">
                              {actions.length === 0 ? '—' : actions.map((a) => ACTION_LABEL[a]).join('·')}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs break-keep text-slate-400">
                민감정보가 포함된 데이터는 담당 역할만 조회하도록 제한합니다. 관리자 기능은 최소로 유지합니다.
              </p>
            </Panel>
          </>
        )
      }}
    />
  )
}
