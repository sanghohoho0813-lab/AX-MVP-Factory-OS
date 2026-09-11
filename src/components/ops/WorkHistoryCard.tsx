/**
 * 해 드린 일 — 이 업체에 무엇을 해 줬는가.
 *
 * 새로 적게 만들지 않는다. 업무마다 이미 '완료' 와 완료한 날짜가 저장돼 있으니
 * 그것만 모아서 최근 순으로 보여 준다. 대표가 오랜만에 전화를 받았을 때
 * "우리 뭐 해 드렸더라" 를 이 카드 한 장으로 답하게 하는 것이 목적이다.
 *
 * '지금 하는 일' 은 여기 두지 않는다 — 같은 화면 맨 위 '지금 할 일' 카드에 이미
 * 진행 중인 업무 조각이 있다. 한 화면에 같은 말을 두 번 쓰면 둘 다 안 읽는다.
 */

import { CheckCircle2 } from 'lucide-react'
import type { ClientOpsRecord, ServiceKey } from '../../types/clientOps'
import { doneWorks } from '../../services/contractSummary'

export function WorkHistoryCard({
  record,
  onOpen,
}: {
  record: ClientOpsRecord
  onOpen: (key: ServiceKey) => void
}) {
  const done = doneWorks(record)

  return (
    <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="t-section text-slate-900">해 드린 일</h2>
        {done.length > 0 && <span className="t-sub text-slate-500">끝낸 일 {done.length}건</span>}
      </div>

      {done.length === 0 ? (
        <p className="t-sub mt-2 break-keep text-slate-500">
          아직 끝낸 일이 없습니다. 업무 탭에서 상태를 '완료' 로 바꾸면 여기에 쌓입니다.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {done.map((w) => (
            <li key={w.key}>
              <button
                type="button"
                onClick={() => onOpen(w.key)}
                className="tap flex w-full items-center gap-2 rounded-(--radius-control) px-2 py-1.5 text-left hover:bg-slate-50"
              >
                <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success-600" />
                <span className="t-body min-w-0 flex-1 break-keep font-medium text-slate-900">{w.label}</span>
                {w.at !== '' && <span className="t-sub shrink-0 tabular-nums text-slate-500">{w.at}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
