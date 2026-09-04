import { ArrowRight, BarChart3, FileCheck2, FlaskConical, FolderKanban, Lightbulb, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { ListSurface, Section } from '../components/ui/primitives'

/**
 * 전체 도구 — 매일 쓰는 화면이 아니라 필요할 때 찾아 들어가는 목록이다.
 * 그래서 카드로 크게 벌리지 않고 이름만 정갈하게 나열한다.
 * 아이콘 색은 무채색으로 둔다 — 여기서 색을 쓰면 정작 급한 화면과 경쟁한다.
 */
const groups = [
  {
    title: '고객·진단',
    icon: Users,
    links: [
      ['고객사·프로젝트', '/clients'],
      ['기업 진단', '/diagnosis'],
      ['설문 관리', '/diagnosis/surveys'],
      ['분석 결과', '/diagnosis/assessments'],
    ],
  },
  {
    title: 'AX 설계',
    icon: Lightbulb,
    links: [
      ['만들 업무 선택', '/selection'],
      ['AX 기능 설계', '/mvp-design'],
      ['홈페이지 설계', '/website-studio'],
      ['제출자료', '/deliverables/results'],
    ],
  },
  {
    title: '검증·성과',
    icon: FlaskConical,
    links: [
      ['현장 검증', '/validation'],
      ['검증 결과', '/validation/results'],
      ['전체 현황', '/reports'],
      ['사례 라이브러리', '/cases'],
    ],
  },
] as const

const SHORTCUTS = [
  { label: '자금·지원사업', to: '/funding', icon: FolderKanban },
  { label: '결과자료', to: '/deliverables/results', icon: FileCheck2 },
  { label: '전체 진행 현황', to: '/reports', icon: BarChart3 },
] as const

export function ToolsHubPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="전체 도구" description="고객 운영 외의 설계·진단·검증 기능을 한곳에서 엽니다." />

      <div className="grid gap-5 xl:grid-cols-3">
        {groups.map((group) => (
          <Section
            key={group.title}
            title={group.title}
            action={<group.icon aria-hidden="true" className="size-5 text-slate-400" />}
          >
            <ListSurface>
              {group.links.map(([label, path]) => (
                <Link
                  key={path}
                  to={path}
                  className="tap t-body flex items-center justify-between gap-2 px-4 py-3.5 font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-700 sm:px-5"
                >
                  <span className="min-w-0 break-keep">{label}</span>
                  <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-slate-300" />
                </Link>
              ))}
            </ListSurface>
          </Section>
        ))}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        {SHORTCUTS.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="ax-lift tap flex items-center gap-3 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3.5"
          >
            <s.icon aria-hidden="true" className="size-5 shrink-0 text-slate-400" />
            <span className="t-body font-medium text-slate-800">{s.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
