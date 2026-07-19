import { ArrowRight, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { PriorityTask } from '../../types'
import { StatusBadge } from '../ui/StatusBadge'
import { useToast } from '../ui/toastContext'

interface PriorityListProps {
  tasks: PriorityTask[]
}

const RANK_CLASS: Record<number, string> = {
  1: 'bg-danger-500 text-white',
  2: 'bg-warning-500 text-white',
  3: 'bg-brand-600 text-white',
}

export function PriorityList({ tasks }: PriorityListProps) {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const handleAction = (task: PriorityTask) => {
    if (task.action.type === 'navigate') {
      navigate(task.action.to)
    } else {
      showToast(task.action.message)
    }
  }

  return (
    <section
      aria-label="오늘의 우선순위"
      className="flex h-full flex-col rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)"
    >
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">오늘의 우선순위</h2>
      </div>
      <ol className="flex flex-1 flex-col divide-y divide-slate-100">
        {tasks.map((task) => (
          <li key={task.id} className="flex flex-1 flex-col gap-2.5 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span
                aria-label={`${task.rank}순위`}
                className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  RANK_CLASS[task.rank] ?? 'bg-slate-500 text-white'
                }`}
              >
                {task.rank}
              </span>
              <StatusBadge tone={task.tone}>{task.dueLabel}</StatusBadge>
              <p className="min-w-0 truncate text-sm font-semibold text-slate-800">
                {task.client} — {task.title}
              </p>
            </div>
            <p className="text-[13px] break-keep text-slate-500">
              {task.nextAction}
            </p>
            <div className="mt-auto flex items-center justify-between gap-3 pt-0.5">
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
                <UserRound aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="truncate">{task.owner}</span>
              </span>
              <button
                type="button"
                onClick={() => handleAction(task)}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-brand-600 hover:bg-brand-50 hover:text-brand-700"
              >
                {task.action.label}
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
