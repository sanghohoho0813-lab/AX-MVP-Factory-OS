/**
 * 출시 예정 (D-169) — 결과물이 나오는 컨설팅 상품. 지금은 상품표의 기간 · 설명만 보여 준다.
 *   /upcoming          전체(가나다 순)
 *   /upcoming/{key}    상품 하나
 * 하나씩 모듈로 만들면 `upcomingProducts.ts` 에서 빼고 제 분야(기업성장 · 절세·재무)로 옮긴다.
 */
import { Link, useParams } from 'react-router-dom'
import { CircleDashed, Rocket } from 'lucide-react'
import { Badge, Blank, ScreenTitle } from '../components/ui/primitives'
import { DEFAULT_PACKAGES, pkgDuration } from '../services/salesProposal'
import { UPCOMING_PATH, UPCOMING_PRODUCTS, upcomingProduct, type UpcomingProduct } from '../config/upcomingProducts'

function contentOf(p: UpcomingProduct): { period: string; desc: string } | null {
  const pkg = DEFAULT_PACKAGES.find((x) => x.name === p.pkgName)
  return pkg ? { period: pkgDuration(pkg), desc: pkg.desc } : null
}

function ProductCard({ p, big }: { p: UpcomingProduct; big?: boolean }) {
  const c = contentOf(p)
  const body = (
    <>
      <span className="flex flex-wrap items-center gap-2">
        <span className={`${big ? 't-section' : 't-body'} font-bold break-keep text-slate-900`}>{p.title}</span>
        <Badge tone="brand">출시 예정</Badge>
      </span>
      {c ? (
        <>
          <span className="t-sub font-semibold text-slate-600" data-testid="upcoming-period">
            기간 {c.period}
          </span>
          <span className="t-body break-keep text-slate-700" data-testid="upcoming-desc">
            {c.desc}
          </span>
        </>
      ) : (
        <span className="t-sub text-slate-500">상품표에서 내용을 찾지 못했습니다.</span>
      )}
    </>
  )
  const cls = 'flex flex-col gap-1.5 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5'
  return big ? (
    <div className={cls} data-testid="upcoming-card">
      {body}
    </div>
  ) : (
    <Link to={`${UPCOMING_PATH}/${p.key}`} className={`${cls} tap hover:border-brand-300`} data-testid="upcoming-card">
      {body}
    </Link>
  )
}

export default function UpcomingPage() {
  const { key = '' } = useParams()
  if (key) {
    const p = upcomingProduct(key)
    if (!p) return <Blank title="없는 상품입니다." />
    return (
      <div className="flex max-w-3xl flex-col gap-5">
        <ScreenTitle title={p.title} sub="출시 예정 — 모듈로 들어오면 이 자리에서 바로 진행합니다" />
        <ProductCard p={p} big />
        <Link to={UPCOMING_PATH} className="tap t-sub inline-flex items-center gap-1.5 self-start font-semibold text-brand-700 hover:underline">
          <CircleDashed aria-hidden="true" className="size-4" /> 출시 예정 전체 보기
        </Link>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-5">
      <ScreenTitle title="출시 예정" sub={`결과물이 나오는 컨설팅 ${UPCOMING_PRODUCTS.length}가지 — 하나씩 모듈로 들어옵니다`} />
      <p className="t-sub inline-flex items-center gap-1.5 break-keep text-slate-600">
        <Rocket aria-hidden="true" className="size-4 shrink-0 text-brand-600" /> 내용은 영업 관리 › 상품표의 기간 · 설명 그대로입니다.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2" data-testid="upcoming-list">
        {UPCOMING_PRODUCTS.map((p) => (
          <li key={p.key} className="flex">
            <ProductCard p={p} />
          </li>
        ))}
      </ul>
    </div>
  )
}
