/**
 * D-251 마케팅 · 브랜딩 첫 화면 — 이번 주 키워드 단추만.
 * 대표: "첫 화면에 굉장히 많이 보이는데 진짜 심플하게 · 바로 버튼들만 · 이번 주 키워드들만 딱 ·
 *        키워드 1등이 뭐고 왜 그런 거고 관련 영상은 뭐고 이런 건 다 아래에 몰아서".
 *  - 단추 하나 = 키워드 하나(레이더 후보 앞 10개 — D-253 6→10). 누르면 콘텐츠 묶음(PackView) — 제목 · 유튜브 · 릴스 · 블로그 · 카드뉴스 · 올릴 때 글.
 *  - 레이더에 없는 주제는 아래 한 줄에 직접 써서 같은 묶음으로.
 *  - 왜 이 키워드인지 · 관련 영상 · 시장 신호 · AI 도우미는 화면 아래 [자세히 보기] 에 그대로 있다(지운 것 없음).
 * D-267 대표: "계속 똑같네 · 이번 주 기준으로 업데이트 되는 게 맞아? · 지원금 · 정책자금은 안 뜨나?"
 *  - 무엇을 기준으로 골랐는지 한 줄(벤치마킹 채널 최근 2주 · 기업마당 이번 주 새 공고) · 지난주와 비교 한 줄 · 새로 들어온 키워드에 '새로'
 *  - 우리 분야(정책자금 · 고용지원금 · 인증 · 지원사업)는 이번 주 새 공고 수로 — 칩 '이번 주 새 공고 n건'
 */
import { useState } from 'react'
import { ArrowRight, CircleHelp, Clapperboard, Film, Flame, GalleryHorizontalEnd, PenLine, Sparkles, type LucideIcon } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { HintTip } from '../../../components/ui/fold'
import type { ContentAxis } from '../../../services/marketing/radarPlaybook'
import { cleanTopic } from '../../../services/marketing/contentPack'

/** 처음 쓰는 사람도 알아보게 — 레이더 축 이름(시장수요 · BRIDGE)을 쉬운 말로 */
const AXIS_EASY: Record<ContentAxis, string> = { market: '경제 · 경영', axai: 'AI · 업무', bridge: '경영 × AI' }
const AXIS_TONE: Record<ContentAxis, string> = {
  market: 'bg-slate-100 text-slate-700',
  axai: 'bg-violet-100 text-violet-800',
  bridge: 'bg-amber-100 text-amber-900',
}

const HOME_MAX = 10

/** D-282 키워드 하나로 나오는 형식 — 무엇이 나오는지 아이콘으로 먼저 보이게(콘텐츠 묶음 PackView 의 칸과 같다) */
const FORMATS: readonly { label: string; icon: LucideIcon }[] = [
  { label: '유튜브 대본', icon: Clapperboard },
  { label: '릴스', icon: Film },
  { label: '블로그', icon: PenLine },
  { label: '카드뉴스', icon: GalleryHorizontalEnd },
]

export interface HomeKeyword {
  key: string
  topic: string
  axis: ContentAxis
  /** 레이더 주제 번호(공고 키워드와 같은 주제인지 볼 때) */
  topicId?: string
  /** D-267 기업마당 공고로 고른 키워드 */
  notice?: boolean
  /** D-267 칩 — '이번 주 새 공고 7건' */
  note?: string
}

const HOW_TO: readonly { title: string; body: string }[] = [
  { title: '키워드 하나를 누르세요', body: '경제 · 경영 · AI 채널에서 최근 2주 함께 오르는 주제예요. 1번이 가장 강한 흐름이에요. 초록 칩(지원사업 · 공고)은 기업마당에 이번 주 새 공고가 많이 올라온 우리 분야예요.' },
  { title: '글이 한 번에 나와요', body: '제목 · 유튜브 대본 · 릴스 대본 · 블로그 글 · 카드뉴스 · 올릴 때 글까지. 대표 계정이면 [AI로 다 쓰기] 를 눌렀을 때 AI 가 검증된 방법대로 다시 써요(20~60초 — 그동안 초안을 먼저 보여 드려요).' },
  { title: '칸마다 [복사] 해서 쓰세요', body: '[공식 자료 확인] 빈칸은 공고 · 보도자료 · 실제 상담 기록으로 채워요. 금액 · 날짜는 지어내지 않아요.' },
  { title: '찍을 거면 [내 콘텐츠에 담기]', body: '대본이 그대로 저장돼요. 촬영일 · 게시일 · 체크리스트는 위 목차의 [내 콘텐츠] 에서 적어요.' },
]

export function KeywordHome({
  keywords,
  status,
  aiDone,
  fresh,
  basis,
  change,
  onPick,
  onCustom,
}: {
  /** null = 아직 키워드를 받지 못함(받는 중 · 키 없음) */
  keywords: HomeKeyword[] | null
  status: 'loading' | 'ready' | 'none'
  /** AI 로 다 써 둔 키워드 */
  aiDone: ReadonlySet<string>
  /** D-267 지난주 목록에 없던 키워드 */
  fresh?: ReadonlySet<string>
  /** D-267 무엇을 기준으로 골랐나 한 줄 */
  basis?: string
  /** D-267 지난주와 비교 한 줄(지난주 기록이 없으면 '') */
  change?: string
  onPick: (key: string) => void
  onCustom: (topic: string) => void
}) {
  const [custom, setCustom] = useState('')
  const [help, setHelp] = useState(false)
  const topic = cleanTopic(custom)
  const list = (keywords ?? []).slice(0, HOME_MAX)
  return (
    <section className="flex flex-col overflow-hidden rounded-(--radius-panel) border border-red-200 bg-white shadow-(--shadow-card)" aria-labelledby="mk-home-title" data-testid="mk-home">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-gradient-to-r from-red-600 to-rose-700 px-4 py-3 text-white">
        <Flame aria-hidden="true" className="size-6 shrink-0" />
        <div className="min-w-0 flex-1 basis-48">
          <HintTip tip="경제 · 경영 · AI 벤치마킹 채널에서 최근 2주 동안 여러 곳이 함께 다루고 평소보다 잘된 주제 + 기업마당에 이번 주 새 공고가 많이 올라온 우리 분야(정책자금 · 지원금 · 인증)예요(규칙 계산). 영상은 6시간마다 · 공고는 매일 아침 9시에 새로 받아요. 근거는 화면 아래 [자세히 보기] 에 있어요." label="이번 주 키워드" onDark>
            <h2 id="mk-home-title" className="t-section text-white">
              이번 주 키워드
            </h2>
          </HintTip>
          <p className="t-sub break-keep text-white/90">누르면 유튜브 대본 · 릴스 · 블로그 · 카드뉴스가 한 번에 나와요</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="한 번에 나오는 형식" data-testid="mk-formats">
            {FORMATS.map((f) => (
              <li key={f.label} className="t-meta inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 font-semibold text-white ring-1 ring-white/25">
                <f.icon aria-hidden="true" className="size-3.5" />
                {f.label}
              </li>
            ))}
          </ul>
          {basis && (
            <p className="t-meta break-keep text-white/80" data-testid="mk-basis">
              {basis}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setHelp((v) => !v)}
          aria-expanded={help}
          className="tap t-sub inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-(--radius-control) bg-white/15 px-3 font-semibold text-white ring-1 ring-white/30 hover:bg-white/25"
          data-testid="mk-howto-toggle"
        >
          <CircleHelp aria-hidden="true" className="size-4" /> 사용 방법
        </button>
      </div>

      {help && (
        <ol className="flex flex-col gap-2 border-b border-red-100 bg-red-50/60 px-4 py-3" data-testid="mk-howto">
          {HOW_TO.map((h, i) => (
            <li key={h.title} className="flex gap-2.5">
              <span aria-hidden="true" className="t-sub flex size-6 shrink-0 items-center justify-center rounded-full bg-red-600 font-bold text-white">
                {i + 1}
              </span>
              <p className="t-sub min-w-0 break-keep text-slate-800">
                <b className="text-slate-900">{h.title}</b> — {h.body}
              </p>
            </li>
          ))}
          <li className="t-sub break-keep pl-8 text-slate-600">왜 이 키워드인지 · 관련 영상 · 시장 신호는 화면 맨 아래 [자세히 보기] 에 있어요.</li>
        </ol>
      )}

      <div className="flex flex-col gap-3 p-3 sm:p-4">
        {change && list.length > 0 && (
          <p className="t-sub break-keep rounded-lg bg-slate-50 px-3 py-2 text-slate-700" data-testid="mk-change">
            {change}
          </p>
        )}
        {list.length > 0 ? (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="mk-keys">
            {list.map((k, i) => (
              <li key={k.key} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onPick(k.key)}
                  className={`tap group flex min-h-16 w-full min-w-0 items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${i === 0 ? 'border-red-400 bg-red-50 hover:border-red-500' : 'border-slate-200 bg-white hover:border-red-300 hover:bg-red-50/50'}`}
                  data-testid="mk-key"
                  data-key={k.key}
                >
                  <span aria-hidden="true" className={`t-body flex size-9 shrink-0 items-center justify-center rounded-full font-bold ${i === 0 ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="t-body font-bold break-keep text-slate-900 [overflow-wrap:anywhere]">{k.topic}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {k.notice ? (
                        <span className="t-meta rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-900">지원사업 · 공고</span>
                      ) : (
                        <span className={`t-meta rounded-full px-2 py-0.5 font-semibold ${AXIS_TONE[k.axis]}`}>{AXIS_EASY[k.axis]}</span>
                      )}
                      {k.note && (
                        <span className="t-meta rounded-full border border-emerald-300 bg-white px-2 py-0.5 font-semibold text-emerald-800" data-testid="mk-key-note">
                          {k.note}
                        </span>
                      )}
                      {fresh?.has(k.key) && (
                        <span className="t-meta rounded-full bg-red-600 px-2 py-0.5 font-bold text-white" data-testid="mk-key-new">
                          새로
                        </span>
                      )}
                      {aiDone.has(k.key) && (
                        <span className="t-meta inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-800" data-testid="mk-key-ai">
                          <Sparkles aria-hidden="true" className="size-3.5" /> AI로 써 둠
                        </span>
                      )}
                    </span>
                  </span>
                  <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-red-500 transition-transform group-hover:translate-x-0.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-sub break-keep rounded-xl bg-slate-50 px-3 py-3 text-slate-600" data-testid="mk-keys-empty">
            {status === 'loading' ? '이번 주 키워드를 받는 중이에요…' : '이번 주 키워드를 아직 받지 못했어요 — 아래 안내를 보세요. 직접 쓴 주제로는 지금 바로 만들 수 있어요.'}
          </p>
        )}

        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault()
            if (topic.length >= 2) onCustom(topic)
          }}
          data-testid="mk-custom"
        >
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-(--radius-control) border border-slate-300 bg-white px-3 focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-100">
            <PenLine aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
            <span className="sr-only">직접 주제 쓰기</span>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              maxLength={60}
              placeholder="직접 주제 쓰기 — 예) 2027 정책자금 달라지는 점"
              className="t-body min-h-11 min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
              data-testid="mk-custom-input"
            />
          </label>
          <Button type="submit" variant="secondary" disabled={topic.length < 2} data-testid="mk-custom-go">
            이 주제로 만들기 <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </form>
      </div>
    </section>
  )
}
