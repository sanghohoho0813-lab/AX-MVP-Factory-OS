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
    '원본(법인컨설팅 세일즈 OS) 14화면이 그대로 돈다. 영업 › 영업 관리로 옮겼다.',
    '옮긴 것: 영업 단계(잠재 고객 → 1차 · 2차 미팅 → 3차 클로징 → 계약, 보류 · 이탈) · 영업 보드 · 새 잠재고객 · 업체별 영업 기록, 그리고 미팅 준비(리드 점수 · 전략 TOP3 · 첫 연락 · 1·2·3차 대본 · 고객 체크 17 · 메모 나누기).',
    '다음에 옮길 것: 상품 가격표 40종(원본 가격 그대로) · 견적 · 범위서 · 제안서 · 월납 제안 · 계약 준비팩, 전략 라이브러리.',
    '다 옮기면 이 목록에서 내린다. 여기 쌓인 기록은 영업 관리 화면을 열 때 한 번 복사되고, 원본은 지우지 않는다.',
  ],
}

export function ToolsReviewPage() {
  const tools = reviewTools()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="도입 검토중"
        description="쓸 수는 있지만 아직 정식으로 들이지 않은 도구입니다. 써 보고 '이건 쓰겠다' 하면 사이드바 컨설팅 작업실로 올립니다."
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
