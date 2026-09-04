import { useState, type ReactNode } from 'react'
import {
  Archive,
  Banknote,
  CalendarClock,
  FileCheck2,
  History,
  Landmark,
  ListChecks,
  UserPen,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ActivityEntry, ActivityKind } from '../../types/clientOps'
import { activityTimeText } from '../../services/clientOpsActivity'
import { Panel } from '../ui/Panel'

/**
 * 활동 기록 — 이 업체에서 무엇이 언제 바뀌었는지 시간순으로 보여준다.
 * 직접 적는 메모와 달리 시스템이 자동으로 쌓으므로, 오래 손 놓았던 업체도
 * 이 목록만 훑으면 어디까지 진행했는지 바로 파악할 수 있다.
 */

const KIND_ICON: Record<ActivityKind, LucideIcon> = {
  service_status: ListChecks,
  service_due: CalendarClock,
  document: FileCheck2,
  fee_added: Banknote,
  fee_received: Banknote,
  funding_added: Landmark,
  funding_status: Landmark,
  profile: UserPen,
  archive: Archive,
}

/** 종류별 색 — 화면 테마와 분리된 고정 분류색을 쓴다 */
const KIND_CLASS: Record<ActivityKind, string> = {
  service_status: 'bg-cat-plan-50 text-cat-plan-700',
  service_due: 'bg-cat-plan-50 text-cat-plan-700',
  document: 'bg-cat-doc-50 text-cat-doc-700',
  fee_added: 'bg-cat-money-50 text-cat-money-700',
  fee_received: 'bg-cat-money-50 text-cat-money-700',
  funding_added: 'bg-cat-fund-50 text-cat-fund-700',
  funding_status: 'bg-cat-fund-50 text-cat-fund-700',
  profile: 'bg-cat-client-50 text-cat-client-700',
  archive: 'bg-slate-100 text-slate-600',
}

const PAGE = 12

export function ActivityLog({
  entries,
  /** 접이식 구역 안에 들어갈 때 — 카드 안 카드가 되지 않도록 감싸지 않는다 */
  bare = false,
}: {
  entries: ActivityEntry[]
  bare?: boolean
}) {
  const [shown, setShown] = useState(PAGE)
  const visible = entries.slice(0, shown)

  const Wrap = ({ children }: { children: ReactNode }) =>
    bare ? <div>{children}</div> : <Panel title="활동 기록">{children}</Panel>

  return (
    <Wrap>
      {!bare && (
        <p className="t-sub mb-4 break-keep text-slate-500">
          상태를 바꾸면 자동으로 한 줄씩 쌓입니다. 오래 못 본 업체도 여기만 보면 어디까지 했는지 알 수 있습니다.
        </p>
      )}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <History aria-hidden="true" className="size-7 text-slate-300" />
          <p className="text-[0.95rem] text-slate-500">아직 기록이 없습니다.</p>
          <p className="text-[0.88rem] break-keep text-slate-400">
            업무 단계를 바꾸거나 서류를 받음으로 표시하면 여기에 남습니다.
          </p>
        </div>
      ) : (
        <>
          <ol className="flex flex-col">
            {visible.map((a, i) => {
              const Icon = KIND_ICON[a.kind] ?? History
              const last = i === visible.length - 1
              return (
                <li key={a.id} className="flex gap-3">
                  {/* 세로 연결선 — 시간 흐름을 눈으로 따라가게 한다 */}
                  <div className="flex flex-col items-center">
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${KIND_CLASS[a.kind]}`}>
                      <Icon aria-hidden="true" className="size-3.5" />
                    </span>
                    {!last && <span aria-hidden="true" className="w-px flex-1 bg-slate-200" />}
                  </div>
                  <div className={`min-w-0 flex-1 ${last ? 'pb-0' : 'pb-3'}`}>
                    <p className="text-[0.95rem] break-keep text-slate-800">{a.text}</p>
                    <p className="text-[0.85rem] text-slate-400">
                      <time dateTime={a.at}>{activityTimeText(a.at)}</time>
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
          {entries.length > shown && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="mt-3 w-full rounded-(--radius-control) border border-slate-200 py-2 text-[0.92rem] font-medium text-slate-600 hover:bg-slate-50"
            >
              이전 기록 더 보기 ({entries.length - shown}건)
            </button>
          )}
        </>
      )}
    </Wrap>
  )
}
