/**
 * 아직 옮기지 않은 모듈 화면 (D-91).
 *
 * 목차에는 원본의 화면이 전부 서 있다. 그중 아직 옮기지 못한 칸은
 * **비어 있다고 그대로 적는다** — 없는 기능을 있는 것처럼 보이게 하지 않는다.
 * 옮기는 대로 이 자리가 진짜 화면으로 바뀐다.
 */

import { Link } from 'react-router-dom'
import { Hammer } from 'lucide-react'
import { Surface } from '../../components/ui/primitives'

export function ModulePending({ label, note }: { label: string; note?: string }) {
  return (
    <Surface edge="brand" showEdge>
      <div className="flex flex-col gap-2" data-testid="module-pending">
        <p className="t-card flex items-center gap-2 font-bold text-slate-900">
          <Hammer aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
          {label} — 아직 옮기지 않았습니다
        </p>
        <p className="t-sub break-keep text-slate-600">
          {note ?? '원본 OS 에 있던 화면입니다. 옮기는 중이며, 끝나면 이 자리에 그대로 섭니다.'}
        </p>
        <p className="t-meta break-keep text-slate-400">
          그동안은 왼쪽 목차의 다른 화면을 쓰거나,{' '}
          <Link to="/ops/clients" className="font-medium text-brand-700 hover:underline">
            고객 운영
          </Link>
          에서 업체 기록으로 처리하세요.
        </p>
      </div>
    </Surface>
  )
}
