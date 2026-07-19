import { NavLink } from 'react-router-dom'
import { FileStack, LayoutDashboard, Layers, ListChecks } from 'lucide-react'

const TABS = [
  { to: '/diagnosis', label: '개요', icon: LayoutDashboard, end: true },
  { to: '/diagnosis/questions', label: '질문은행', icon: ListChecks, end: false },
  { to: '/diagnosis/modules', label: '업종·목적 모듈', icon: Layers, end: false },
  { to: '/diagnosis/templates', label: '설문 템플릿', icon: FileStack, end: false },
]

/** 진단 스튜디오 하위 탭 내비게이션 */
export function DiagnosisStudioNav() {
  return (
    <nav
      aria-label="진단 스튜디오 메뉴"
      className="flex gap-1 overflow-x-auto border-b border-slate-200"
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
              isActive
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`
          }
        >
          <tab.icon aria-hidden="true" className="size-4" />
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
