import { NavLink } from 'react-router-dom'
import {
  ClipboardCheck,
  GitCompareArrows,
  LayoutDashboard,
  MessageCircleQuestion,
  TriangleAlert,
  Trophy,
} from 'lucide-react'

interface AnalysisNavProps {
  projectId: string
}

/** 진단 분석 하위 탭 내비게이션 */
export function AnalysisNav({ projectId }: AnalysisNavProps) {
  const base = `/diagnosis/projects/${projectId}/analysis`
  const tabs = [
    { to: base, label: '개요', icon: LayoutDashboard, end: true },
    { to: `${base}/compare`, label: '응답자 비교', icon: GitCompareArrows, end: false },
    { to: `${base}/issues`, label: '확인 필요 항목', icon: TriangleAlert, end: false },
    { to: `${base}/interview`, label: '추가 인터뷰', icon: MessageCircleQuestion, end: false },
    { to: `${base}/score`, label: '점수 상세', icon: Trophy, end: false },
    { to: `${base}/result`, label: '결과', icon: ClipboardCheck, end: false },
  ]
  return (
    <nav
      aria-label="진단 분석 메뉴"
      className="flex gap-1 overflow-x-auto border-b border-slate-200"
    >
      {tabs.map((tab) => (
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
