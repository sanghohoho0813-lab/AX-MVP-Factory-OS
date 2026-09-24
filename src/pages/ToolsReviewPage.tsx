import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { Surface } from '../components/ui/primitives'
import { reviewTools } from '../config/toolRegistry'
import { ToolCard } from './ToolsHubPage'

/**
 * 도입 검토중 (D-88) — 쓸 수는 있지만 아직 정식으로 들이지 않은 도구들.
 *
 * 대표가 "메인은 지금 OS 기능에 충실하되, 더 가져올 만한 기능만 검토중 목차에 넣어 두라" 고 해서 만든 자리다.
 * 여기 있는 것은 세 가지가 다르다: 사이드바에 이름이 따로 안 걸린다 · 카드에 '검토중' 배지가 붙는다 ·
 * 왜 검토중인지 이 화면에 적혀 있다. 들이기로 하면 `toolRegistry.ts` 의 status 를 'live' 로 바꾸면 끝이다.
 */
const WHY: Record<string, string[]> = {
  'sales-kit': [
    '원본(법인컨설팅 세일즈 OS)은 고객 관리·파이프라인·오늘 할 일까지 통째로 갖고 있다. 그 부분은 이 OS 에 이미 있어 가져오지 않았다.',
    '가져온 것은 이 OS 에 없던 것뿐이다 — 미팅 대본(테마 8종), 절세전략 17종 추천, 상품 가격표 40종(8분류), 제안 주제 34종, 고객 플래그 17종.',
    '가격표와 수임료 범위는 원본 값 그대로다. 대표가 실제 가격 정책과 맞는지 보고 정해야 한다.',
    '결과를 업체 기록에 붙일 수는 있지만, 고객 플랫폼으로 발행하는 요약에는 수임료·내부 전략 문장이 섞이지 않게 대본만 나간다.',
  ],
}

export function ToolsReviewPage() {
  const tools = reviewTools()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="도입 검토중"
        description="쓸 수는 있지만 아직 정식으로 들이지 않은 도구입니다. 써 보고 '이건 쓰겠다' 하면 사이드바 컨설팅 작업실으로 올립니다."
      />
      {tools.length === 0 ? (
        <Surface className="p-6 text-center">
          <span className="t-body text-slate-600">검토중인 도구가 없습니다.</span>
        </Surface>
      ) : (
        <div className="flex flex-col gap-5">
          {tools.map((t) => (
            <div key={t.key} className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <ToolCard t={t} />
              <Surface className="flex flex-col gap-2 p-4">
                <span className="t-card font-bold text-slate-900">왜 검토중인가</span>
                <ul className="flex flex-col gap-1.5">
                  {(WHY[t.key] ?? ['원본에서 핵심만 옮겼다. 대표가 써 보고 정한다.']).map((line) => (
                    <li key={line} className="flex gap-2 t-sub break-keep text-slate-600">
                      <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-slate-300" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                {t.path && (
                  <Link to={t.path} className="t-sub mt-1 font-medium text-brand-700 hover:underline">
                    써 보기 →
                  </Link>
                )}
              </Surface>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
