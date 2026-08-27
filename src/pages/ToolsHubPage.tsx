import { ArrowRight, BarChart3, FileCheck2, FlaskConical, FolderKanban, Lightbulb, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'

const groups = [
  { title: '고객·진단', icon: Users, color: 'bg-sky-50 text-sky-700', links: [['고객사·프로젝트', '/clients'], ['기업 진단', '/diagnosis'], ['설문 관리', '/diagnosis/surveys'], ['분석 결과', '/diagnosis/assessments']] },
  { title: 'AX 설계', icon: Lightbulb, color: 'bg-amber-50 text-amber-700', links: [['만들 업무 선택', '/selection'], ['AX 기능 설계', '/mvp-design'], ['홈페이지 설계', '/website-studio'], ['제출자료', '/deliverables/results']] },
  { title: '검증·성과', icon: FlaskConical, color: 'bg-emerald-50 text-emerald-700', links: [['현장 검증', '/validation'], ['검증 결과', '/validation/results'], ['전체 현황', '/reports'], ['사례 라이브러리', '/cases']] },
] as const

export function ToolsHubPage() {
  return <div className="space-y-7"><PageHeader title="전체 도구" description="고객 운영 외의 기존 설계·진단·검증 기능을 한곳에서 엽니다." /><div className="grid gap-5 xl:grid-cols-3">{groups.map((group) => <section key={group.title} className="border-t-2 border-slate-200 pt-4"><div className="flex items-center gap-3"><span className={`flex size-10 items-center justify-center rounded-lg ${group.color}`}><group.icon className="size-5" /></span><h2 className="font-semibold text-slate-900">{group.title}</h2></div><ul className="mt-4 divide-y divide-slate-100 border-y border-slate-100">{group.links.map(([label, path]) => <li key={path}><Link to={path} className="flex min-h-12 items-center justify-between py-3 text-sm font-medium text-slate-700 hover:text-brand-700"><span>{label}</span><ArrowRight className="size-4 text-slate-400" /></Link></li>)}</ul></section>)}</div><div className="grid gap-3 sm:grid-cols-3"><Link to="/funding" className="flex items-center gap-3 border border-slate-200 bg-white p-4 shadow-(--shadow-card) hover:border-brand-300"><FolderKanban className="size-5 text-brand-600" /><span className="font-medium text-slate-800">자금·지원사업</span></Link><Link to="/deliverables/results" className="flex items-center gap-3 border border-slate-200 bg-white p-4 shadow-(--shadow-card) hover:border-brand-300"><FileCheck2 className="size-5 text-brand-600" /><span className="font-medium text-slate-800">결과자료</span></Link><Link to="/reports" className="flex items-center gap-3 border border-slate-200 bg-white p-4 shadow-(--shadow-card) hover:border-brand-300"><BarChart3 className="size-5 text-brand-600" /><span className="font-medium text-slate-800">전체 진행 현황</span></Link></div></div>
}
