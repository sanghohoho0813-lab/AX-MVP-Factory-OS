import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { ModuleAccessPanel } from '../components/tools/ModuleAccessPanel'
import { Badge } from '../components/ui/primitives'
import { REVIEW_HUB_PATH, TOOLS, type ToolDefinition } from '../config/toolRegistry'
import { featuresOfModule, visibleModules, type CatalogModule } from '../config/productCatalog'
import { featureIcon, featureLabel, featurePath } from '../config/featurePaths'
import { useEntitlements } from '../lib/entitlementsStore'

/**
 * 전문 모듈 전체 (D-86 · D-88 · D-127) — 예전 '컨설팅 작업실(도구함)'.
 *
 * 모듈 카드 여섯 장(분야마다 하나) · 그 안의 기능 · 요금제와 모듈 관리.
 * 목록은 제품 카탈로그(productCatalog.ts)와 도구 목록(toolRegistry.ts)에서 읽는다 — 새 도구가 들어와도 이 화면은 고치지 않는다.
 *   - 아직 없는 기능 → '준비 중', 누를 수 없다
 *   - 도입 검토중 → 따로 묶어 '검토중' 배지. 쓸 수는 있다
 */
/** AX 스튜디오 안쪽에서 자주 찾는 화면 — 메뉴에는 없고 여기서 바로 간다 */
const STUDIO_LINKS = [
  ['설문 관리', '/diagnosis/surveys'],
  ['분석 결과', '/diagnosis/assessments'],
  ['검증 결과', '/validation/results'],
  ['제출자료', '/deliverables/results'],
  ['전체 진행 현황', '/reports'],
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

/** 전문 모듈 한 장 — 이름 · 상태 · 소개 · 들어 있는 기능(누르면 그 기능으로) */
function ModuleCard({ m }: { m: CatalogModule }) {
  const { ent } = useEntitlements()
  const e = ent.module(m.key)
  const features = featuresOfModule(m.key)
  return (
    <li className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-4" data-module-card={m.key}>
      <div className="flex flex-wrap items-center gap-2">
        <m.icon aria-hidden="true" className="size-5 shrink-0 text-brand-600" />
        <h3 className="t-card font-bold text-slate-900">{m.name}</h3>
        <Badge tone={e.usable ? (e.source === 'trial' ? 'warning' : 'success') : 'neutral'}>{e.usable ? (e.source === 'trial' ? e.label : '쓰는 중') : '잠김'}</Badge>
      </div>
      <p className="t-sub break-keep text-slate-600">{m.description}</p>
      <ul className="flex flex-col divide-y divide-slate-100 border-y border-slate-100">
        {features.map((f) => {
          const path = featurePath(f)
          const Icon = featureIcon(f)
          return (
            <li key={f.key}>
              {path ? (
                <Link to={path} data-tool={f.source === 'tool' ? f.key : undefined} data-feature={f.key} className="tap t-body flex items-center gap-2.5 py-2.5 font-medium text-slate-800 hover:text-brand-700">
                  {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-slate-400" />}
                  <span className="min-w-0 flex-1 break-keep">{featureLabel(f)}</span>
                  <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-slate-300" />
                </Link>
              ) : (
                <div data-tool={f.source === 'tool' ? f.key : undefined} className="t-body flex items-center gap-2.5 py-2.5 text-slate-500">
                  {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-slate-300" />}
                  <span className="min-w-0 flex-1 break-keep">{featureLabel(f)}</span>
                  <Badge>준비 중</Badge>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <Link to={m.route} className="tap t-body inline-flex w-fit items-center gap-1 font-semibold text-brand-700 hover:underline" data-act="explore">
        {m.name} 살펴보기 <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </li>
  )
}

export function ToolsHubPage() {
  const review = TOOLS.filter((t) => t.status === 'review')
  const moved = TOOLS.filter((t) => t.status === 'moved')
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="전문 모듈"
        description="기본 OS 위에 더하는 전문 업무입니다. 분야마다 모듈 하나 — 업체 화면에서 바로 열리고, 업체 정보를 다시 적지 않습니다. 전부 규칙 계산이고 외부 호출이 없습니다."
      />

      <section aria-labelledby="modules-list" className="flex flex-col gap-3">
        <h2 id="modules-list" className="t-section text-slate-900">
          모듈 <span className="t-meta font-medium text-slate-500">{visibleModules().length}개</span>
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="module-cards">
          {visibleModules().map((m) => (
            <ModuleCard key={m.key} m={m} />
          ))}
        </ul>
        <p className="t-sub flex flex-wrap items-center gap-x-3 gap-y-1 break-keep text-slate-600">
          <span className="font-semibold text-slate-700">AX 스튜디오 안쪽 화면</span>
          {STUDIO_LINKS.map(([label, to]) => (
            <Link key={to} to={to} className="tap inline-flex items-center font-medium text-brand-700 hover:underline">
              {label}
            </Link>
          ))}
        </p>
      </section>

      {/* D-118: 다른 곳으로 옮겨 간 것 — 카드가 아니라 한 줄 안내. 예전 화면은 기록 보기용으로 열린다 */}
      {moved.length > 0 && (
        <section aria-label="옮겨 간 것" data-testid="tools-moved" className="flex flex-col gap-1.5 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3">
          {moved.map((t) => (
            <p key={t.key} className="t-sub flex flex-wrap items-baseline gap-x-2 gap-y-1 break-keep text-slate-600">
              <span className="font-semibold text-slate-800">{t.label}</span>
              <span>→ {t.movedTo?.label}로 옮겼습니다.</span>
              {t.movedTo && <Link to={t.movedTo.path} className="tap inline-flex items-center font-semibold text-brand-700 hover:underline">열기</Link>}
              {t.path && <Link to={t.path} className="tap inline-flex items-center text-slate-600 hover:underline">예전 화면(기록 보기)</Link>}
            </p>
          ))}
        </section>
      )}

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

      <ModuleAccessPanel />
    </div>
  )
}
