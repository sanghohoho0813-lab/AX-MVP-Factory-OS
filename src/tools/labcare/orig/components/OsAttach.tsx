/**
 * 원본 화면 안의 '업체 기록에 붙이기' 단추 (D-92).
 *
 * 원본 연구소 OS 에는 없던 칸이다 — 이 OS 에서는 연구소 고객사가 곧 고객 운영 업체라서,
 * 점검 결과·리포트·변경신고 기한을 그 업체 기록(달력·오늘 포함)으로 보낼 수 있다.
 * 샘플 고객사처럼 고객 운영에 없는 곳이면 단추를 그리지 않는다.
 */
import type { ToolDeadline } from '../../../../types/clientOps'
import { ToolResultAttach } from '../../../shared/ToolResultAttach'
import { osClientOf } from '../store'

export default function OsAttach({
  clientId,
  title,
  verdict = null,
  verdictLabel,
  summary,
  data,
  deadlines,
}: {
  clientId?: string
  title: string
  verdict?: string | null
  verdictLabel: string
  summary: string
  data: unknown
  deadlines?: ToolDeadline[]
}) {
  const os = clientId ? osClientOf(clientId) : undefined
  if (clientId && !os) return null
  return (
    <div className="print-hide mt-3 flex flex-wrap items-center gap-2" data-testid="lab-os-attach">
      <ToolResultAttach
        toolKey="labcare"
        title={title}
        verdict={verdict}
        verdictLabel={verdictLabel}
        summary={summary}
        data={data}
        deadlines={deadlines}
        presetClientId={os?.id}
      />
      {os ? <span className="text-sm text-slate-500">→ 고객 관리 <b className="text-slate-700">{os.companyName}</b> 기록에 붙습니다</span> : null}
    </div>
  )
}
