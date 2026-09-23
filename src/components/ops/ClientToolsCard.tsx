/**
 * 업체 상세 > 이 업체로 도구 열기 (D-89 · D-90).
 *
 * 도구함에 가서 도구를 고르고, 판정한 뒤 다시 업체를 고르던 길을 없앤다.
 * 여기서 누르면 도구가 `?client=<id>` 로 열리고, 결과는 단추 한 번에 이 업체로 돌아온다.
 *
 * D-90 부터는 **서류가 준비됐는지 먼저 말해 준다.**
 * 고용지원금은 4대보험 가입자 명부가 없으면 진단할 것이 없고, 크레탑은 보고서가 없으면 읽을 것이 없다.
 * 없는 서류는 숫자가 아니라 **이름을 그대로** 적고, 서류함으로 바로 가는 길을 붙인다.
 * 도구를 막지는 않는다 — 손으로 붙여넣어 쓰는 길이 늘 있기 때문이다.
 */

import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Check, FileUp } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { liveTools } from '../../config/toolRegistry'
import { missingDocsForTools, missingDocsText, missingReason, readinessOf } from '../../services/toolReadiness'
import { Badge, Section, Surface } from '../ui/primitives'

export function ClientToolsCard({
  record,
  today,
  onOpenDocs,
}: {
  record: ClientOpsRecord
  today: string
  /** 서류함 탭으로 보내기 */
  onOpenDocs: () => void
}) {
  const tools = liveTools().filter((t) => t.path !== null)
  if (tools.length === 0) return null

  const readiness = readinessOf(record, tools, today)
  const blockedCount = readiness.filter((r) => !r.ready).length
  const missingAll = missingDocsForTools(record, tools, today)

  return (
    <Section title="이 업체로 도구 열기" count={tools.length}>
      <div className="flex flex-col gap-2.5" data-testid="client-tools">
        {/* 없는 서류를 맨 위에 한 줄로 — 무엇을 받아야 하는지가 먼저다 */}
        {missingAll.length > 0 && (
          <Surface edge="danger" showEdge className="flex flex-col gap-2 p-4" data-testid="client-tools-missing-wrap">
            <div className="flex flex-wrap items-center gap-2">
              <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-danger-600" />
              <span className="t-card font-bold break-keep text-slate-900">
                도구를 돌리려면 서류 {missingAll.length}건이 더 필요합니다
              </span>
              <Badge tone="danger">{blockedCount}개 도구가 막혀 있음</Badge>
            </div>
            <p className="t-body break-keep text-slate-700" data-testid="client-tools-missing">
              {missingDocsText(missingAll)}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenDocs}
                className="tap inline-flex items-center gap-1.5 rounded-(--radius-control) border border-danger-300 bg-white px-3 py-1.5 text-[0.92rem] font-medium text-danger-700 hover:bg-danger-50"
              >
                <FileUp aria-hidden="true" className="size-4" /> 서류함에서 올리기
              </button>
            </div>
          </Surface>
        )}

        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {readiness.map((r) => {
            const t = r.tool
            const Icon = t.icon
            const blocked = !r.ready
            return (
              <Link
                key={t.key}
                to={`${t.path}?client=${record.id}`}
                data-tool={t.key}
                data-ready={r.ready ? 'yes' : 'no'}
                className={`tap flex flex-col gap-1.5 rounded-(--radius-panel) border p-3.5 ${
                  blocked
                    ? 'border-danger-200 bg-danger-50/40 hover:border-danger-300'
                    : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/40'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon aria-hidden="true" className={`size-4 shrink-0 ${blocked ? 'text-danger-500' : 'text-slate-400'}`} />
                  <span className="t-body min-w-0 flex-1 truncate font-bold text-slate-900">{t.label}</span>
                  <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-slate-300" />
                </span>
                {blocked ? (
                  <span className="flex flex-col gap-0.5">
                    {r.missing.map((need) => (
                      <span key={need.key} className="t-sub flex flex-wrap items-baseline gap-1 font-medium break-keep text-danger-700">
                        <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0 translate-y-0.5" />
                        {need.label}
                        <span className="t-meta font-normal text-danger-600">— {missingReason(need)}</span>
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="t-sub flex items-center gap-1 text-success-700">
                    <Check aria-hidden="true" className="size-3.5 shrink-0" />
                    {r.needsNothing ? '바로 쓸 수 있습니다' : '필요한 서류가 다 있습니다'}
                  </span>
                )}
                {r.missingOptional.length > 0 && (
                  <span className="t-meta break-keep text-slate-500">
                    있으면 더 정확합니다 — {missingDocsText(r.missingOptional)}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        <p className="t-meta break-keep text-slate-400">
          도구에서 나온 판정은 단추 한 번으로 이 업체 기록에 붙습니다. 기한이 있는 결과는 달력에도 올라갑니다.
          서류가 없어도 도구는 열립니다 — 그때는 직접 붙여넣어 쓰면 됩니다.
        </p>
      </div>
    </Section>
  )
}
