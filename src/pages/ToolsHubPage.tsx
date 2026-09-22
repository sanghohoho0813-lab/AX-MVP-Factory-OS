import { ArrowRight, BarChart3, FileCheck2, FlaskConical, FolderKanban, Lightbulb, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { ListSurface, Section } from '../components/ui/primitives'
import { TOOLS } from '../config/toolRegistry'

/**
 * 도구함 — 고객 기록과 상관없이 혼자 도는 것들이 모이는 곳 (D-86).
 *
 * 앞으로 대표가 따로 만들어 둔 작은 OS 들이 여기로 들어온다. 그때 화면을 고치지 않도록
 * 목록은 `toolRegistry.ts` 한 곳에서 읽는다. 아직 없는 것은 **없다고 적고 누를 수 없게** 둔다.
 *
 * 아래의 설계·진단·검증 목록은 AX STUDIO 로 가는 길이다 — 자주 쓰지 않으므로 도구 아래에 둔다.
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
      <PageHeader title="도구함" description="계산기처럼 혼자 도는 것들이 모이는 곳입니다. 새로 만든 것도 여기로 들어옵니다." />

      <section aria-labelledby="tools-list" className="flex flex-col gap-3">
        <h2 id="tools-list" className="t-section text-slate-900">
          도구
        </h2>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {TOOLS.map((t) => {
            const body = (
              <>
                <span className="flex items-center gap-2.5">
                  <t.icon aria-hidden="true" className={`size-5 shrink-0 ${t.status === 'live' ? 'text-brand-600' : 'text-slate-300'}`} />
                  <span className={`t-card font-bold ${t.status === 'live' ? 'text-slate-900' : 'text-slate-500'}`}>{t.label}</span>
                  {t.status === 'planned' && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 t-meta font-medium text-slate-500">아직 없음</span>
                  )}
                  {t.status === 'live' && <ArrowRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-slate-300" />}
                </span>
                <span className="t-sub mt-1.5 block break-keep text-slate-500">{t.desc}</span>
              </>
            )
            return t.status === 'live' && t.path ? (
              <Link
                key={t.key}
                to={t.path}
                className="ax-lift tap flex flex-col rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3.5 hover:border-brand-300"
              >
                {body}
              </Link>
            ) : (
              <div key={t.key} className="flex flex-col rounded-(--radius-panel) border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3.5">
                {body}
              </div>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="studio-links" className="flex flex-col gap-3">
        <h2 id="studio-links" className="t-section text-slate-900">
          설계·진단·검증 (AX STUDIO)
        </h2>
        <div className="grid gap-5 xl:grid-cols-3">
          {groups.map((group) => (
            <Section key={group.title} title={group.title} action={<group.icon aria-hidden="true" className="size-5 text-slate-400" />}>
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
      </section>

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
