/**
 * 업체 상세 > 이 업체로 도구 열기 (D-89).
 *
 * 도구함에 가서 도구를 고르고, 판정한 뒤 다시 업체를 고르던 길을 없앤다.
 * 여기서 누르면 도구가 `?client=<id>` 로 열리고, 결과는 단추 한 번에 이 업체로 돌아온다.
 *
 * 쓸 수 있는 도구(`live`)만 보인다 — 자리만 잡아 둔 것은 여기 나오지 않는다.
 */

import { Link } from 'react-router-dom'
import { Wrench } from 'lucide-react'
import { liveTools } from '../../config/toolRegistry'
import { Section, Surface } from '../ui/primitives'

export function ClientToolsCard({ clientId }: { clientId: string }) {
  const tools = liveTools().filter((t) => t.path !== null)
  if (tools.length === 0) return null

  return (
    <Section title="이 업체로 도구 열기">
      <Surface className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap gap-2" data-testid="client-tools">
          {tools.map((t) => {
            const Icon = t.icon
            return (
              <Link
                key={t.key}
                to={`${t.path}?client=${clientId}`}
                data-tool={t.key}
                className="tap inline-flex items-center gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 text-[0.95rem] font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                <Icon aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                {t.label}
              </Link>
            )
          })}
        </div>
        <p className="t-meta break-keep text-slate-400">
          <Wrench aria-hidden="true" className="mr-1 inline size-3.5 align-[-2px]" />
          도구에서 나온 판정은 단추 한 번으로 이 업체 기록에 붙습니다. 기한이 있는 결과는 달력에도 올라갑니다.
        </p>
      </Surface>
    </Section>
  )
}
