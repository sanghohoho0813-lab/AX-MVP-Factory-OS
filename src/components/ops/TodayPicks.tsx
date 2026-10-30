/**
 * NX-1 오늘 화면 '오늘 먼저 제안할 것' — 대표 목표 2 "맞는 모듈을 알아서 싹 다 추천하고, 눈에 잘 띄게".
 * 예전엔 '먼저 제안할 업체 n곳' 이 처음엔 접혀 있는 '영업' 칸 안 문장 속 작은 링크라 새로 쓰는 사람에게는 보이지 않았다.
 *  - 추천 모듈이 있는 업체를 가능성 높은 것 많은 순으로 3곳(휴대폰 2곳) · 업체마다 모듈 칩(가능성 높음 초록 · 검토해 볼 만함 노랑) · [맞춤 추천] 으로 바로.
 *  - 판정은 고객 관리 카드 띠와 같은 규칙 계산(AI 아님) — 지원사업 공고 수는 빼고 모듈 판정만.
 */
import { Link } from 'react-router-dom'
import { Lightbulb } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { ClientReco } from './useClientReco'
import { HelpHeading } from '../ui/fold'
import { improvedSinceGiven } from '../../services/diagnosisGiven'

export function TodayPicks({ clients, reco, phone }: { clients: readonly ClientOpsRecord[]; reco: ClientReco; phone: boolean }) {
  if (!reco.ready) return null
  const picks = clients
    .filter((c) => c.archivedAt === null && c.status !== 'completed')
    .map((c) => {
      const chips = reco.chips.get(c.id) ?? []
      return { c, chips, good: chips.filter((x) => x.tone === 'good').length, score: reco.scores.get(c.id) ?? 0 }
    })
    .filter((p) => p.chips.length > 0)
    .sort((a, b) => b.good - a.good || b.score - a.score || a.c.companyName.localeCompare(b.c.companyName, 'ko'))
  if (!picks.length) return null
  const shown = picks.slice(0, phone ? 2 : 3)
  const goodCount = picks.filter((p) => p.good > 0).length
  return (
    <section aria-labelledby="today-picks-title" className="flex flex-col gap-2.5 rounded-(--radius-panel) border-2 border-success-200 bg-success-50/50 p-4" data-testid="today-picks">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <HelpHeading
          id="today-picks-title"
          label="오늘 먼저 제안할 것"
          help="업체 기록 · 서류로 맞는 모듈을 규칙으로 가려 가능성 높은 것 많은 업체부터 보여 줘요(AI 아님). 초록은 가능성 높음 · 노랑은 검토해 볼 만함. 누르면 그 업체 맞춤 추천으로 가요."
          className="t-section flex items-center gap-2 break-keep text-slate-900"
        >
          <Lightbulb aria-hidden="true" className="size-5 shrink-0 text-amber-500" />
          오늘 먼저 제안할 것
        </HelpHeading>
        <span className="t-sub break-keep text-slate-600">
          {goodCount > 0 ? (
            <>
              가능성 높은 모듈이 있는 업체 <b className="text-slate-900">{goodCount}곳</b>
              {picks.length > goodCount ? ` · 검토해 볼 만한 곳 ${picks.length - goodCount}곳` : ''}
            </>
          ) : (
            <>
              검토해 볼 만한 모듈이 있는 업체 <b className="text-slate-900">{picks.length}곳</b>
            </>
          )}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {shown.map(({ c, chips }) => (
          <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5" data-testid="today-pick" data-client={c.id}>
            <span className="t-body min-w-0 font-bold break-keep text-slate-900">{c.companyName}</span>
            <span className="flex min-w-0 flex-[1_1_12rem] flex-wrap gap-1.5">
              {chips.slice(0, 4).map((g) => (
                <span
                  key={g.key}
                  title={g.tone === 'good' ? '가능성 높음' : '검토해 볼 만함'}
                  className={`t-meta rounded-full px-2 py-0.5 font-semibold break-keep ${g.tone === 'good' ? 'bg-success-100 text-success-800' : 'bg-warning-50 text-warning-800'}`}
                  data-testid="today-pick-chip"
                  data-tone={g.tone}
                >
                  {g.label}
                  {g.tone === 'good' ? ' · 가능성 높음' : ''}
                </span>
              ))}
              {chips.length > 4 && <span className="t-meta text-slate-600">+{chips.length - 4}</span>}
            </span>
            {/* D-368 진단서를 드린 뒤 새로 추천할 수 있게 된 모듈 — 다시 드릴 때 */}
            {(() => {
              const fresh = improvedSinceGiven(c.diagnosisGiven, chips)
              return fresh.length > 0 ? (
                <span className="t-meta rounded-full bg-amber-50 px-2 py-0.5 font-semibold break-keep text-amber-900 ring-1 ring-amber-200" data-testid="today-pick-new">
                  진단서 드린 뒤 새 추천: {fresh.join(' · ')}
                </span>
              ) : null
            })()}
            <Link to={`/ops/clients/${c.id}?tab=smart`} className="tap t-sub ml-auto inline-flex shrink-0 items-center font-semibold text-brand-700 hover:underline" data-testid="today-pick-go">
              맞춤 추천 보기 →
            </Link>
          </li>
        ))}
      </ul>
      {picks.length > shown.length && (
        <Link to="/ops/clients?sort=reco" className="tap t-sub self-start font-semibold text-brand-700 hover:underline" data-testid="today-picks-all">
          {picks.length}곳 모두 보기(추천 많은 순) →
        </Link>
      )}
    </section>
  )
}
