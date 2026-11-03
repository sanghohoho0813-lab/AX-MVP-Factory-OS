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
 * D-295 대표: "정책자금 · 고용지원금 · 기업인증은 새 공고가 떴다고 키워드에 올리지 말고 고정 키워드로 따로(정부지원금 · 정부지원사업까지 5개) ·
 *        이번 주 키워드 10개는 유튜브에서 실제로 뜨는 것만 · 폰에서는 2열로 · 한참 내려가지 않게"
 *  - 맨 위 '고정 키워드' 다섯 칸(새 공고 칩) → 아래 '이번 주 키워드' 10칸(폰 2열 · 작은 칸). 폰에서는 형식 칩 · 기준 줄을 접어 둔다(물음표에 그대로).
 * D-507 대표 "60대 이상이 처음 딱 봐도 이해하기 쉽고 계속 쓰기 쉽게"
 *  - 맨 위 한 줄 질문(이번 주 무엇을 올릴까요?) + 1 → 2 → 3(주제 누르기 → 글 · 대본이 나와요 → [복사] 해서 올리기).
 *  - 어려운 기준 줄(벤치마킹 채널 · 칩)은 [사용 방법] 안으로 — 지운 것 없음(같은 글 · 같은 시험 이름).
 *  - 지난번 하던 것이 있으면 맨 위에 [이어서 하기] 한 장 — 다음에 할 일(대본 쓰기 · 찍기 · 올리기)과 이번 달 올린 수.
 *  - 말은 쉬운 말로(롱폼 → 긴 영상 · 고정 키워드 → 우리 본업 주제 · 이번 주 키워드 → 이번 주 뜨는 주제).
 * D-511 대표 "이번 주 무엇을 올릴까요? 안에도 글자가 너무 많다" — 첫 화면은 대화창 + 목록(MkAsk)이 되고, 이 판은 [이번 주 찍을 것] 을 눌러야 열린다.
 *  - 제목 아래 설명 줄 · 주제마다 분야 칩(경제 · 경영 등) · 묶음 이름 옆 설명 · 지난주 비교 줄은 [사용 방법] 안으로(지운 것 없음 — 같은 시험 이름).
 *  - [이어서 하기] 는 첫 화면(대화창 아래)으로 옮겼다(ResumeCard 를 내보낸다).
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, AtSign, CalendarDays, CircleHelp, Clapperboard, Film, Flame, GalleryHorizontalEnd, History, MonitorPlay, PenLine, Pin, Sparkles, type LucideIcon } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { HintTip } from '../../../components/ui/fold'
import { TextScaleQuickButton } from '../../../components/ui/TextScaleQuickButton'
import { AiConfirm } from '../../../components/ai/AiConfirm'
import type { ContentAxis } from '../../../services/marketing/radarPlaybook'
import { cleanTopic } from '../../../services/marketing/contentPack'
import { isMarketingCustomer, mkText } from '../../../services/marketing/persona'

/** 처음 쓰는 사람도 알아보게 — 레이더 축 이름(시장수요 · BRIDGE)을 쉬운 말로 */
const AXIS_EASY: Record<ContentAxis, string> = { market: '경제 · 경영', axai: 'AI · 업무', bridge: '경영 × AI' }

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
  /** D-295 고정 키워드 둘째 줄(짧게 — '융자 · 보증') */
  sub?: string
}

const HOW_TO: readonly { title: string; body: string }[] = [
  { title: '주제를 하나 누르세요', body: '맨 위 다섯(정책자금 · 고용지원금 · 기업인증 · 정부지원금 · 정부지원사업)은 우리 본업 주제라 늘 그 자리예요 — 작은 글씨는 기업마당에 이번 주 새로 나온 공고 수예요. 아래 \'이번 주 뜨는 주제\' 는 경제 · 경영 · AI 유튜브에서 최근 2주 동안 여러 채널이 함께 다루고 많이 본 주제예요(1번이 가장 강해요).' },
  { title: '글이 한 번에 나와요', body: '제목 · 유튜브 대본 · 짧은 영상(릴스) 대본 · 블로그 글 · 카드뉴스 · 올릴 때 쓰는 글까지. 대표 계정이면 [AI로 다 쓰기] 를 눌렀을 때 AI 가 검증된 방법대로 더 자연스럽게 다시 써요(20~60초 — 그동안 초안을 먼저 보여 드려요).' },
  { title: '칸마다 [복사] 해서 쓰세요', body: '[공식 자료 확인] 이라고 적힌 빈칸은 공고 · 보도자료 · 실제 상담 기록으로 채워요. 금액 · 날짜는 지어내지 않아요.' },
  { title: '찍을 거면 [내 콘텐츠에 담기]', body: '대본이 그대로 저장돼요. 찍는 날 · 올리는 날 · 할 일 표는 위 목차의 [내 콘텐츠] 에서 적어요. 다음에 오면 맨 위 [이어서 하기] 로 바로 돌아와요.' },
]

/** D-507 첫 화면 1 → 2 → 3 — 누르면 무엇이 되는지 먼저 보이게 */
const STEPS: readonly { t: string; short: string }[] = [
  { t: '주제 누르기', short: '주제 누르기' },
  { t: '글 · 대본이 나와요', short: '글 · 대본 나옴' },
  { t: '[복사] 해서 올리기', short: '복사해 올리기' },
]

/** D-507 지난번 하던 것(내 콘텐츠 수첩에서 아직 올리지 않은 가장 최근 줄) */
export interface HomeResume {
  /** 형식 이름(유튜브 긴 영상 · 릴스 · 틱톡 · 스레드 글) — 없으면 안 보임 */
  kindLabel?: string
  topic: string
  /** 지금 단계(쉬운 말) */
  stage: string
  /** 다음에 할 일(쉬운 말) */
  next: string
  href: string
  /** 아직 올리지 않은 것 수 */
  making: number
  /** 이번 달 올린 것 수 */
  posted: number
}

export function KeywordHome({
  fixed = [],
  keywords,
  status,
  aiDone,
  fresh,
  basis,
  change,
  onPick,
  onCustom,
  week,
  resume,
}: {
  /** D-507 지난번 하던 것 — 없으면 카드 없음 */
  resume?: HomeResume | null
  /** D-346 1주일치 한 번에 — ai: 누르면 AI 를 부를 수 있음(두 번 눌러 확인) · done: 이번에 만들 주를 이미 써 둠 */
  week?: { ai: boolean; done: boolean; onOpen: (startAi: boolean) => void }
  /** D-295 고정 키워드(늘 다섯 — 유튜브 데이터가 없어도 보인다) */
  fixed?: HomeKeyword[]
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
    <section className="flex flex-col overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white" aria-labelledby="mk-home-title" data-testid="mk-home">
      <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
        {/* D-507 한 줄 질문 + 1 → 2 → 3 — 처음 온 사람도 무엇을 누르면 어떻게 되는지 먼저 보이게(예전 형식 칩 · 기준 줄은 [사용 방법] 안) */}
        <div className="min-w-0 flex-1">
          {/* 제목 옆 ⓘ 는 앱 어디서나 같은 '설명 보기'(qa:easy) · 오른쪽 단추는 글자로 [사용법](둘이 헷갈리지 않게) */}
          <HintTip tip="맨 위 다섯은 우리 본업 주제라 늘 그 자리예요(작은 글씨 = 기업마당 이번 주 새 공고 수). 아래 이번 주 뜨는 주제는 경제 · 경영 · AI 유튜브에서 최근 2주 동안 많이 본 주제예요. 하나를 누르면 올릴 글 · 대본이 바로 나와요." label="이번 주 무엇을 올릴까요?">
            <h2 id="mk-home-title" className="t-section flex items-center gap-1.5 text-slate-900">
              <Flame aria-hidden="true" className="size-5 shrink-0 text-red-600" />
              <span>
                <span className="max-sm:hidden">이번 주 </span>무엇을 올릴까요?
              </span>
            </h2>
          </HintTip>
          {/* 휴대폰은 세 칸(번호 위 · 글 아래), PC 는 한 줄 화살표 */}
          <ol className="mt-2 grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-x-1.5 sm:gap-y-1" aria-label="쓰는 순서" data-testid="mk-steps">
            {STEPS.map((st, i) => (
              <li key={st.t} className="t-sub flex flex-col items-center gap-1 px-0.5 text-center leading-snug font-semibold break-keep text-slate-800 sm:flex-row sm:gap-1.5 sm:p-0 sm:text-left">
                {i > 0 && <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-slate-400 max-sm:hidden" />}
                <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[0.8125rem] font-bold text-white">
                  {i + 1}
                </span>
                <span>
                  <span className="sm:hidden">{st.short}</span>
                  <span className="max-sm:hidden">{st.t}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <button
          type="button"
          onClick={() => setHelp((v) => !v)}
          aria-expanded={help}
          aria-label="사용 방법"
          className="tap t-sub inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50 sm:px-3"
          data-testid="mk-howto-toggle"
        >
          {/* 휴대폰은 글자만(제목이 두 줄로 꺾이지 않게 · 제목 옆 ⓘ 와 헷갈리지 않게) */}
          <CircleHelp aria-hidden="true" className="size-4 max-sm:hidden" /> <span className="sm:hidden">사용법</span>
          <span className="hidden sm:inline">사용 방법</span>
        </button>
      </div>

      {help && (
        <div className="flex flex-col gap-2 border-b border-slate-100 bg-white px-4 py-3">
          <ol className="flex flex-col gap-2" data-testid="mk-howto">
            {HOW_TO.map((h, i) => (
              <li key={h.title} className="flex gap-2.5">
                <span aria-hidden="true" className="t-sub flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-900 font-bold text-white">
                  {i + 1}
                </span>
                <p className="t-sub min-w-0 break-keep text-slate-800">
                  <b className="text-slate-900">{h.title}</b> — {isMarketingCustomer() ? mkText(h.body).replace('대표 계정이면 ', '') : h.body}
                </p>
              </li>
            ))}
            <li className="t-sub break-keep pl-8 text-slate-600">{mkText('주제를 하나 누르면 유튜브 대본 · 짧은 영상 대본 · 블로그 글 · 카드뉴스가 한 번에 나와요.')} 왜 이 주제인지 · 관련 영상 · 시장 신호는 이 판 아래 [자세히 보기] 에 있어요.</li>
          </ol>
          {/* 한 번에 나오는 형식 · 무엇을 기준으로 골랐나(예전 첫 화면 위 두 줄) — 처음 화면을 가볍게 하려고 여기로 */}
          <ul className="flex flex-wrap gap-1.5 pl-8" aria-label="한 번에 나오는 형식" data-testid="mk-formats">
            {FORMATS.filter((f) => !(isMarketingCustomer() && f.label === '카드뉴스')).map((f) => (
              <li key={f.label} className="t-meta inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                <f.icon aria-hidden="true" className="size-3.5" />
                {f.label}
              </li>
            ))}
          </ul>
          {basis && (
            <p className="t-meta break-keep pl-8 text-slate-600" data-testid="mk-basis">
              {basis}
            </p>
          )}
          {change && list.length > 0 && (
            <p className="t-meta break-keep pl-8 text-slate-700" data-testid="mk-change">
              {change}
            </p>
          )}
          {/* D-507 글자가 작게 보이면 바로 여기서 — 앱 전체 글자 크기(설정 › 보기 와 같은 값 · 누를 때마다 기본 → 크게 → 매우 크게) */}
          <p className="t-sub flex flex-wrap items-center gap-2 pl-8 break-keep text-slate-700" data-testid="mk-howto-text">
            글자가 작게 보이면 <TextScaleQuickButton showLabel /> <span className="t-meta text-slate-600">누를 때마다 기본 → 크게 → 매우 크게</span>
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 p-3 sm:p-4">
        {resume && <ResumeCard {...resume} />}
        {week && <WeekButton {...week} />}
        {fixed.length > 0 && (
          <div className="flex flex-col gap-1.5" data-testid="mk-fixed">
            <p className="t-meta flex items-center gap-1 font-bold text-slate-700">
              <Pin aria-hidden="true" className="size-3.5 text-slate-500" /> 우리 본업 주제
            </p>
            <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-5" data-testid="mk-fixed-keys">
              {fixed.map((k) => (
                <li key={k.key} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onPick(k.key)}
                    className="tap flex h-full min-h-14 w-full min-w-0 flex-col items-start justify-center gap-0.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-left transition-colors hover:border-brand-400 hover:shadow-sm"
                    data-testid="mk-fixed-key"
                    data-key={k.key}
                  >
                    <span className="t-sub w-full font-bold break-keep text-slate-900 [overflow-wrap:anywhere]">{k.topic}</span>
                    {k.note ? (
                      <span className="t-meta max-w-full truncate rounded-full border border-emerald-300 bg-white px-1.5 font-semibold text-emerald-800" data-testid="mk-key-note">
                        {k.note}
                      </span>
                    ) : (
                      k.sub && <span className="t-meta max-w-full truncate text-slate-500">{k.sub}</span>
                    )}
                    {aiDone.has(k.key) && (
                      <span className="t-meta inline-flex items-center gap-0.5 font-semibold text-violet-700" data-testid="mk-key-ai">
                        <Sparkles aria-hidden="true" className="size-3" /> AI로 써 둠
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="t-meta -mb-1.5 flex items-center gap-1 font-bold text-slate-700">
          <Flame aria-hidden="true" className="size-3.5 text-slate-500" /> 이번 주 뜨는 주제
        </p>
        {list.length > 0 ? (
          <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3" data-testid="mk-keys">
            {list.map((k, i) => (
              <li key={k.key} className="min-w-0">
                {/* D-478 칸 높이를 한 줄에서 맞춘다(h-full) · 1번은 분홍 바탕 대신 흰 칸 + 진한 테두리(박스 색은 하나) */}
                <button
                  type="button"
                  onClick={() => onPick(k.key)}
                  className={`tap group flex h-full min-h-14 w-full min-w-0 items-center gap-2 rounded-xl border bg-white px-2 py-2 text-left transition-colors sm:min-h-16 sm:gap-3 sm:px-3 sm:py-2.5 ${i === 0 ? 'border-slate-900 ring-1 ring-slate-900 hover:shadow-sm' : 'border-slate-200 hover:border-brand-400 hover:shadow-sm'}`}
                  data-testid="mk-key"
                  data-key={k.key}
                  title={k.notice ? '지원사업 · 공고' : AXIS_EASY[k.axis]}
                >
                  <span aria-hidden="true" className={`t-sub flex size-7 shrink-0 items-center justify-center rounded-full font-bold sm:text-base sm:size-9 ${i === 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="t-sub font-bold break-keep text-slate-900 [overflow-wrap:anywhere] sm:text-base">{k.topic}</span>
                    <span className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                      {k.note && (
                        <span className="t-meta rounded-full border border-emerald-300 bg-white px-2 py-0.5 font-semibold text-emerald-800" data-testid="mk-key-note">
                          {k.note}
                        </span>
                      )}
                      {fresh?.has(k.key) && (
                        <span className="t-meta rounded-full bg-brand-600 px-2 py-0.5 font-bold text-white" data-testid="mk-key-new">
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
                  <ArrowRight aria-hidden="true" className="hidden size-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600 sm:block" />
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
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-(--radius-control) border border-slate-300 bg-white px-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
            <PenLine aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
            <span className="sr-only">직접 주제 쓰기</span>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              maxLength={60}
              placeholder="원하는 주제를 직접 써도 돼요 — 예) 2027 정책자금 달라지는 점"
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

/**
 * D-346 대표 "버튼 하나만 누르면 1주일치 유튜브 롱폼 1 · 릴스쇼츠 3 · 스레드 7 한 번에 쫙".
 * AI 를 부를 수 있으면 두 번 눌러 확인(D-289)한 뒤 여섯 갈래를 바로 — 이미 써 둔 주면 그냥 열기(다시 쓰기는 안에서).
 */
function WeekButton({ ai, done, onOpen }: { ai: boolean; done: boolean; onOpen: (startAi: boolean) => void }) {
  const body = (
    <button
      type="button"
      onClick={() => onOpen(ai && !done)}
      className="tap group flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-700 px-3 py-3 text-left text-white shadow-(--shadow-card) hover:from-violet-800 hover:to-fuchsia-800 sm:px-4"
      data-testid="mk-week-open"
      data-done={done ? '1' : '0'}
      // D-511 설명 줄은 마우스를 올리면(글자를 줄였다 — 무엇이 나오는지는 옆 칩 셋)
      title="이번 주 뜨는 주제에 우리 본업을 엮어, 일주일 동안 올릴 것을 AI 가 한 번에 써요"
    >
      <CalendarDays aria-hidden="true" className="size-6 shrink-0" />
      <span className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
        <span className="t-body font-bold break-keep">{done ? '1주일치 콘텐츠 보기' : '1주일치 콘텐츠 한 번에 만들기'}</span>
      </span>
      <span className="flex flex-wrap gap-1">
        {[
          { icon: MonitorPlay, t: '유튜브 긴 영상 1' },
          { icon: Film, t: '짧은 영상 3' },
          { icon: AtSign, t: '스레드 글 7' },
        ].map((c) => (
          <span key={c.t} className="t-meta inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 font-semibold ring-1 ring-white/25">
            <c.icon aria-hidden="true" className="size-3.5" /> {c.t}
          </span>
        ))}
      </span>
      {done ? (
        <span className="t-meta inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-semibold text-violet-800">
          <Sparkles aria-hidden="true" className="size-3.5" /> AI로 써 둠
        </span>
      ) : (
        <ArrowRight aria-hidden="true" className="hidden size-5 shrink-0 transition-transform group-hover:translate-x-0.5 sm:block" />
      )}
    </button>
  )
  return ai && !done ? <AiConfirm confirmLabel="이대로 1주일치 만들기">{body}</AiConfirm> : body
}

/**
 * D-507 지난번 하던 것 — 다시 왔을 때 어디서부터인지 찾지 않게(계속 쓰기 쉽게).
 * 흰 칸 + 회색 테두리(박스 색 하나) · 큰 단추 하나.
 */
export function ResumeCard({ kindLabel, topic, stage, next, href, making, posted }: HomeResume) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:px-4" data-testid="mk-resume">
      <History aria-hidden="true" className="size-6 shrink-0 text-slate-500" />
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
        <span className="t-meta font-semibold text-slate-600" data-testid="mk-resume-kind">
          지난번 하던 것{kindLabel ? ` · ${kindLabel}` : ''}
        </span>
        <span className="t-body font-bold break-keep text-slate-900 [overflow-wrap:anywhere]" data-testid="mk-resume-topic">
          {topic}
        </span>
        <span className="t-sub break-keep text-slate-700">
          지금 <b className="font-semibold text-slate-900">{stage}</b> · 다음은 <b className="font-semibold text-brand-700">{next}</b>
          {making > 1 || posted > 0 ? (
            <span className="text-slate-600" data-testid="mk-resume-count">
              {' '}
              ({[making > 1 ? `만드는 중 ${making}개` : '', posted > 0 ? `이번 달 올린 것 ${posted}개` : ''].filter(Boolean).join(' · ')})
            </span>
          ) : null}
        </span>
      </div>
      <Link to={href} className="tap t-sub inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-(--radius-control) bg-brand-600 px-4 font-bold text-white hover:bg-brand-700" data-testid="mk-resume-go">
        이어서 하기 <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  )
}
