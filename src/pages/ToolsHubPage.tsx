import { ArrowRight, BarChart3, FileCheck2, FlaskConical, FolderKanban, Lightbulb, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { ModuleAccessPanel } from '../components/tools/ModuleAccessPanel'
import { getDataModeConfig } from '../data/dataMode'
import { useAuth } from '../auth/AuthProvider'
import { Badge, ListSurface, Section } from '../components/ui/primitives'
import { REVIEW_HUB_PATH, TOOLS, type ToolDefinition } from '../config/toolRegistry'

/**
 * 도구함 — 고객 기록과 상관없이 혼자 도는 것들이 모이는 곳 (D-86 · D-88).
 *
 * 대표가 따로 만들어 둔 작은 OS 들이 여기로 들어온다. 그때 화면을 고치지 않도록
 * 목록은 `toolRegistry.ts` 한 곳에서 읽는다.
 *   - 쓸 수 있는 것 → 카드, 누르면 들어간다
 *   - 도입 검토중 → 따로 묶어 '검토중' 배지. 쓸 수는 있다
 *   - 아직 없는 것 → **없다고 적고 누를 수 없게** 둔다
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

export function ToolCard({ t }: { t: ToolDefinition }) {
  const live = t.status !== 'planned' && t.path
  const body = (
    <>
      <span className="flex items-center gap-2.5">
        <t.icon aria-hidden="true" className={`size-5 shrink-0 ${live ? 'text-brand-600' : 'text-slate-300'}`} />
        <span className={`t-card font-bold ${live ? 'text-slate-900' : 'text-slate-500'}`}>{t.label}</span>
        {t.status === 'planned' && <Badge>아직 없음</Badge>}
        {t.status === 'review' && <Badge tone="warning">검토중</Badge>}
        {live && <ArrowRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-slate-300" />}
      </span>
      <span className="t-sub mt-1.5 block break-keep text-slate-500">{t.desc}</span>
      {/* D-94: 원본 저장소 이름(git-test · kind-cori 등)은 대표에게 뜻이 없어 카드에서 뺐다 — toolRegistry.origin 에는 남아 있다 */}
    </>
  )
  return live ? (
    <Link
      to={t.path as string}
      className="ax-lift tap flex flex-col rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3.5 hover:border-brand-300"
      data-tool={t.key}
    >
      {body}
    </Link>
  ) : (
    <div className="flex flex-col rounded-(--radius-panel) border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3.5" data-tool={t.key}>
      {body}
    </div>
  )
}

function ModuleAccessSection() {
  // 로컬 모드에는 작업실이 없다 — 다른 화면과 같은 방식으로 가른다
  const mode = getDataModeConfig().mode
  return mode === 'supabase' ? <CloudAccess /> : <ModuleAccessPanel workspaceId={null} />
}

function CloudAccess() {
  const { currentWorkspaceId } = useAuth()
  return <ModuleAccessPanel workspaceId={currentWorkspaceId} />
}

export function ToolsHubPage() {
  const live = TOOLS.filter((t) => t.status === 'live')
  const review = TOOLS.filter((t) => t.status === 'review')
  const planned = TOOLS.filter((t) => t.status === 'planned')
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="컨설팅 작업실"
        description="계산기·판정기·분석기처럼 혼자 도는 것들이 모이는 곳입니다. 대표가 따로 만들어 둔 OS 들의 핵심이 여기로 들어왔습니다. 전부 규칙 계산이고 외부 호출이 없습니다."
      />

      <section aria-labelledby="tools-list" className="flex flex-col gap-3">
        <h2 id="tools-list" className="t-section text-slate-900">
          도구 <span className="t-meta font-medium text-slate-500">{live.length}개</span>
        </h2>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {live.map((t) => (
            <ToolCard key={t.key} t={t} />
          ))}
        </div>
      </section>

      {review.length > 0 && (
        <section aria-labelledby="tools-review" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="tools-review" className="t-section text-slate-900">
              도입 검토중 <span className="t-meta font-medium text-slate-500">{review.length}개</span>
            </h2>
            <Link to={REVIEW_HUB_PATH} className="t-sub font-medium text-brand-700 hover:underline">
              왜 검토중인가
            </Link>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {review.map((t) => (
              <ToolCard key={t.key} t={t} />
            ))}
          </div>
        </section>
      )}

      {planned.length > 0 && (
        <section aria-labelledby="tools-planned" className="flex flex-col gap-3">
          <h2 id="tools-planned" className="t-section text-slate-900">
            자리만 잡아 둔 것
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {planned.map((t) => (
              <ToolCard key={t.key} t={t} />
            ))}
          </div>
        </section>
      )}

      <ModuleAccessSection />

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
