/**
 * D-251 콘텐츠 묶음 — 이번 주 키워드 하나를 누르면 한 번에(제목 · 유튜브 대본 · 릴스 대본 · 블로그 글 · 카드뉴스 · 올릴 때 글).
 * 대표: "버튼 누르면 검증된 방식으로 유튜브 대본부터 릴스 대본 · 블로그 글 등 다 한 번에 쫙".
 *
 *  - 먼저 규칙 초안(contentPack · AI 아님)을 바로 보여 준다 — 기다리지 않게.
 *  - D-253: AI 는 [AI로 다 쓰기] 를 눌렀을 때만(모델은 바로 옆에서 고른다) — 세 갈래(유튜브 · 릴스 묶음 · 블로그)를 동시에 다시 쓴다.
 *    갈래 하나가 끝날 때마다 그 칸이 바뀐다. 실패한 갈래는 규칙 초안 그대로 + 이유 한 줄.
 *  - AI 결과는 이 브라우저(로그인한 사람별 금고)에 키워드별로 남긴다 — 다시 열어도 다시 부르지 않는다. [AI로 다시 쓰기] 로만 다시.
 *  - 팀장 화면을 보는 중이면 AI 를 부르지 않는다(규칙 초안만 · 저장 안 함).
 */
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ArrowLeft, AtSign, BookmarkPlus, ChevronDown, ClipboardCopy, ExternalLink, FileText, Film, GalleryHorizontalEnd, ListChecks, Loader2, MonitorPlay, RotateCcw, Send, Smartphone, Sparkles, Type, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { Fold, HintTip } from '../../../components/ui/fold'
import { packBundle } from '../../../services/aiAssist/builders'
import { todayLocalDate } from '../../../lib/appClock'
import { packAiVersion, packRun, packSaved, startPackAi, subscribePackAi, type PartState } from '../../../services/marketing/packAi'
import { ModelPicker } from '../../../components/ai/ModelPicker'
import type { ChannelBrief } from '../../../services/marketing/radarStore'
import { PACK_AI_PARTS, PACK_LABEL, makePack, packPartLabel, packText, sectionText, withAi, type ContentPack, type PackAiPart, type PackAiSaved, type PackSectionId, type PackSource } from '../../../services/marketing/contentPack'
import { AiConfirm } from '../../../components/ai/AiConfirm'
import { mkText } from '../../../services/marketing/persona'

const SECTION_LOOK: Record<PackSectionId, { icon: LucideIcon; chip: string }> = {
  titles: { icon: Type, chip: 'bg-violet-100 text-violet-700' },
  video: { icon: MonitorPlay, chip: 'bg-red-100 text-red-600' },
  shorts: { icon: Smartphone, chip: 'bg-fuchsia-100 text-fuchsia-700' },
  blog: { icon: FileText, chip: 'bg-emerald-100 text-emerald-700' },
  cards: { icon: GalleryHorizontalEnd, chip: 'bg-amber-100 text-amber-700' },
  upload: { icon: Send, chip: 'bg-sky-100 text-sky-700' },
  checks: { icon: ListChecks, chip: 'bg-slate-100 text-slate-600' },
}

const when = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function PackView({
  source,
  brief,
  rank,
  readOnly,
  ownerAi,
  savedIdeaHref,
  onBack,
  onCopy,
  onSave,
  briefSlot,
  whySlot,
}: {
  source: PackSource
  brief: ChannelBrief
  /** 이번 주 키워드 몇 번째(직접 쓴 주제면 0) */
  rank: number
  readOnly: boolean
  /** 대표 AI 를 쓸 수 있음 */
  ownerAi: boolean
  /** 이미 내 콘텐츠에 있으면 그 줄 주소 */
  savedIdeaHref: string | null
  onBack: () => void
  onCopy: (text: string, what: string) => void
  onSave: (pack: ContentPack) => Promise<string | null>
  /** 채널 설계 기준 카드(인사 · 말투 · 끝맺음) */
  briefSlot?: ReactNode
  /** 이 키워드를 고른 이유 · 관련 영상(레이더 후보) — 빨간 머리 상자 안 [펼쳐보기] 로(D-253) */
  whySlot?: ReactNode
}) {
  const rule = useMemo(() => makePack(source, brief), [source, brief])
  // AI 진행 · 결과는 화면 밖(packAi)에 — 나갔다 들어와도 쓰는 중 · 나간 사이에 온 답이 그대로 보인다
  const version = useSyncExternalStore(subscribePackAi, packAiVersion)
  const run = useMemo(() => packRun(source.key), [source.key, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const saved = useMemo(() => packSaved(source.key), [source.key, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const parts = run.parts
  const [savedHref, setSavedHref] = useState<string | null>(savedIdeaHref)
  const [saving, setSaving] = useState(false)
  useEffect(() => setSavedHref(savedIdeaHref), [savedIdeaHref])

  const pack = useMemo(() => (saved ? withAi(rule, saved.sections) : rule), [rule, saved])
  const running = Object.values(parts).includes('running')
  const canAi = ownerAi && !readOnly
  const runAi = () => {
    if (canAi) startPackAi(source.key, packBundle({ today: todayLocalDate(), pack: rule, brief }).context, rule.headline)
  }

  // D-253 대표 "들어가면 바로 AI 로 써지게 말고 내가 눌렀을 때만" — 열 때 저절로 부르지 않는다. 모델을 고르고 [AI로 다 쓰기] 를 눌러야.
  const [whyOpen, setWhyOpen] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const href = await onSave(pack)
      if (href) setSavedHref(href)
    } finally {
      setSaving(false)
    }
  }

  const go = (id: PackSectionId) => document.getElementById(`pack-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const aiIds = new Set(Object.keys(saved?.sections ?? {}))

  return (
    <div className="flex flex-col gap-4" data-testid="mk-pack" data-key={source.key}>
      <div>
        <button type="button" onClick={onBack} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) px-2 font-semibold text-slate-700 hover:bg-slate-100" data-testid="mk-pack-back">
          <ArrowLeft aria-hidden="true" className="size-4" /> 이번 주 키워드
        </button>
      </div>

      <header className="relative overflow-hidden rounded-(--radius-panel) bg-gradient-to-br from-red-600 via-red-600 to-rose-700 p-4 text-white sm:p-5">
        <span aria-hidden="true" className="pointer-events-none absolute -top-14 -right-10 size-44 rounded-full bg-white/10" />
        <div className="relative flex flex-col gap-1">
          <p className="t-meta font-semibold text-white/90">{rank > 0 ? `이번 주 키워드 ${rank}번` : '직접 고른 주제'}</p>
          <HintTip tip="이 키워드 하나로 만든 묶음이에요 — 아래 칸마다 [이 칸 복사] 로 가져가 쓰고, 찍을 거면 [내 콘텐츠에 담기]." label={source.topic} onDark>
            <h2 className="t-page break-keep text-white [overflow-wrap:anywhere]" data-testid="mk-pack-topic">
              {source.topic}
            </h2>
          </HintTip>
          <p className="t-sub break-keep text-white/95 [overflow-wrap:anywhere]" data-testid="mk-pack-headline">
            추천 제목: {pack.headline}
          </p>
        </div>
        <div className="relative mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onCopy(packText(pack), '전체 묶음')} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) bg-white px-3 font-semibold text-slate-900 shadow-sm hover:bg-white/90" data-testid="mk-pack-copy-all">
            <ClipboardCopy aria-hidden="true" className="size-4" /> 전체 복사
          </button>
          {savedHref ? (
            <Link to={savedHref} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) bg-white/15 px-3 font-semibold text-white ring-1 ring-white/40 hover:bg-white/25" data-testid="mk-pack-open-idea">
              <ExternalLink aria-hidden="true" className="size-4" /> 내 콘텐츠에서 보기
            </Link>
          ) : null}
          {whySlot && (
            <button
              type="button"
              onClick={() => setWhyOpen((v) => !v)}
              aria-expanded={whyOpen}
              aria-controls="mk-pack-why"
              className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) bg-white/15 px-3 font-semibold text-white ring-1 ring-white/40 hover:bg-white/25"
              data-testid="mk-pack-why-toggle"
            >
              <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${whyOpen ? 'rotate-180' : ''}`} /> {whyOpen ? '접기' : '왜 이 키워드? · 관련 영상 펼쳐보기'}
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) bg-white/15 px-3 font-semibold text-white ring-1 ring-white/40 hover:bg-white/25 disabled:opacity-60"
              data-testid="mk-pack-save"
            >
              <BookmarkPlus aria-hidden="true" className="size-4" /> {savedHref ? '대본 다시 저장' : '내 콘텐츠에 담기'}
            </button>
          )}
        </div>
        {whySlot && whyOpen && (
          <div id="mk-pack-why" className="relative mt-3 rounded-xl bg-white p-3 text-slate-900 shadow-sm sm:p-4" data-testid="mk-pack-why">
            {whySlot}
          </div>
        )}
      </header>

      <AiBar canAi={canAi} ownerAi={ownerAi} readOnly={readOnly} parts={parts} errors={run.errors} saved={saved} storeFull={run.storeFull} onRun={runAi} />

      <nav aria-label="묶음 칸으로 가기" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" data-testid="mk-pack-nav">
        {pack.sections.map((x) => {
          const L = SECTION_LOOK[x.id]
          return (
            <button key={x.id} type="button" onClick={() => go(x.id)} className="tap t-sub inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 font-semibold whitespace-nowrap text-slate-700 hover:border-red-300" data-testid="mk-pack-chip">
              <L.icon aria-hidden="true" className="size-4" />
              {x.label}
              {x.id === 'checks' && pack.holes > 0 && <span className="t-meta rounded-full bg-amber-100 px-1.5 font-bold text-amber-900">{pack.holes}</span>}
            </button>
          )
        })}
      </nav>

      {/* MUX-2 같은 주제를 스레드 · 릴스 · 틱톡 전용 공식으로 — 주제를 들고 가면 그 화면이 형식을 추천해 [AI로 바로 쓰기] 하나만 누르면 된다 */}
      <div className="flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5" data-testid="mk-pack-channels">
        <span className="t-sub min-w-[10rem] flex-1 break-keep font-semibold text-slate-800">같은 주제로 다른 채널 — 채널마다 공식이 달라 따로 써요</span>
        <Link to={`/marketing/threads?topic=${encodeURIComponent(source.topic)}`} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50" data-testid="mk-pack-to-threads">
          <AtSign aria-hidden="true" className="size-4" /> 스레드 글 쓰기
        </Link>
        <Link to={`/marketing/shorts?topic=${encodeURIComponent(source.topic)}`} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50" data-testid="mk-pack-to-shorts">
          <Film aria-hidden="true" className="size-4" /> 릴스 · 틱톡 대본 쓰기
        </Link>
      </div>

      {pack.sections.map((x) => {
        const L = SECTION_LOOK[x.id]
        const ai = aiIds.has(x.id)
        const busy = running && PACK_AI_PARTS.some((p) => parts[p.part] === 'running' && p.sections.includes(x.id))
        return (
          <section key={x.id} id={`pack-${x.id}`} className="flex scroll-mt-20 flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-3 sm:p-4" data-testid="mk-pack-section" data-sec={x.id} data-ai={ai ? '1' : '0'}>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span aria-hidden="true" className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${L.chip}`}>
                <L.icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1 basis-40">
                <h3 className="t-section break-keep text-slate-900">{x.label}</h3>
                <p className="t-meta break-keep text-slate-500">{x.hint}</p>
              </div>
              {x.id !== 'checks' && (
                <span className={`t-meta inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${ai ? 'bg-violet-100 text-violet-800' : 'bg-slate-100 text-slate-600'}`} data-testid="mk-pack-origin">
                  {busy ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : ai ? <Sparkles aria-hidden="true" className="size-3.5" /> : null}
                  {busy ? 'AI가 쓰는 중' : ai ? 'AI가 씀' : '규칙 초안'}
                </span>
              )}
              <Button size="sm" variant="secondary" onClick={() => onCopy(sectionText(x), x.label)} data-testid="mk-pack-copy">
                <ClipboardCopy aria-hidden="true" className="size-4" /> 이 칸 복사
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {x.blocks.map((b, i) => (
                <div key={`${b.label}-${i}`} className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2.5" data-testid="mk-pack-block">
                  <div className="flex items-start gap-2">
                    <p className="t-sub min-w-0 flex-1 font-bold break-keep text-slate-800 [overflow-wrap:anywhere]">{b.label}</p>
                    <button type="button" onClick={() => onCopy(b.text, b.label)} className="tap t-meta -my-1 inline-flex min-h-9 shrink-0 items-center gap-1 rounded-(--radius-control) px-2 font-semibold text-slate-600 hover:bg-white hover:text-slate-900">
                      <ClipboardCopy aria-hidden="true" className="size-3.5" /> 복사
                    </button>
                  </div>
                  <p className="t-body break-keep whitespace-pre-wrap text-slate-900 [overflow-wrap:anywhere]">{b.text}</p>
                </div>
              ))}
            </div>
          </section>
        )
      })}

      {briefSlot && (
        <Fold id="mk-pack-brief" title="채널 설계 기준 — 인사 · 말투 · 끝맺음" hint="대본의 인사 · 끝맺음과 AI 가 쓰는 말투가 이 기준을 따릅니다. 바꾸면 다음 묶음부터 바뀌어요." panel testId="mk-pack-brief">
          {briefSlot}
        </Fold>
      )}
      <p className="t-meta break-keep text-slate-500">{PACK_LABEL.checks} 칸의 □ 를 모두 확인한 뒤 올리세요. 규칙 초안은 규칙으로 만든 글이고(AI 아님), ✨ 표시가 있는 칸만 AI 가 쓴 글이에요.</p>
    </div>
  )
}

function AiBar({
  canAi,
  ownerAi,
  readOnly,
  parts,
  errors,
  saved,
  storeFull,
  onRun,
}: {
  canAi: boolean
  ownerAi: boolean
  readOnly: boolean
  parts: Record<PackAiPart, PartState>
  errors: string[]
  saved: PackAiSaved | null
  storeFull: boolean
  onRun: () => void
}) {
  if (!canAi) {
    return (
      <p className="t-sub break-keep rounded-xl bg-slate-50 px-3 py-2 text-slate-600" data-testid="mk-pack-ai-off">
        {readOnly ? '팀장 화면을 보는 중이라 규칙 초안만 보여 드려요(AI 를 부르지 않고 저장하지 않아요).' : ownerAi ? '' : 'AI 로 다시 쓰기는 대표 계정에서만 돼요 — 아래는 규칙으로 만든 초안이에요.'}
      </p>
    )
  }
  const running = Object.values(parts).includes('running')
  const icon = (s: PartState) => (s === 'running' ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : s === 'done' ? '✓' : s === 'error' ? '!' : '·')
  return (
    <div className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 ${errors.length ? 'border-amber-300 bg-amber-50' : 'border-violet-200 bg-violet-50'}`} data-testid="mk-pack-ai" data-state={running ? 'running' : errors.length ? 'error' : saved ? 'done' : 'idle'}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Sparkles aria-hidden="true" className="size-5 shrink-0 text-violet-700" />
        <p className="t-sub min-w-0 flex-1 basis-56 break-keep font-semibold text-violet-950">
          {running
            ? 'AI 가 검증된 방법대로 쓰는 중이에요(20~60초) — 그동안 아래 초안을 먼저 보세요.'
            : saved
              ? `AI 가 쓴 글이에요${saved.model ? ` · ${saved.model}` : ''}${when(saved.at) ? ` · ${when(saved.at)}` : ''}`
              : mkText('모델을 고르고 [AI로 다 쓰기] 를 누르면 제목 · 대본 · 블로그 · 카드뉴스를 검증된 방법대로 다시 써요. 누르기 전에는 부르지 않아요.')}
        </p>
        <div className="flex flex-wrap items-start gap-2">
          <ModelPicker />
          <AiConfirm><Button size="sm" variant={saved ? 'secondary' : 'primary'} onClick={onRun} disabled={running} data-testid="mk-pack-ai-run">
            {saved ? <RotateCcw aria-hidden="true" className="size-4" /> : <Sparkles aria-hidden="true" className="size-4" />}
            {running ? '쓰는 중…' : saved ? 'AI로 다시 쓰기' : 'AI로 다 쓰기'}
          </Button></AiConfirm>
        </div>
      </div>
      {(running || Object.values(parts).some((s) => s !== 'idle')) && (
        <ul className="flex flex-wrap gap-1.5" data-testid="mk-pack-ai-parts">
          {PACK_AI_PARTS.map((p) => (
            <li key={p.part} className={`t-meta inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${parts[p.part] === 'error' ? 'bg-amber-100 text-amber-900' : parts[p.part] === 'done' ? 'bg-violet-100 text-violet-800' : 'bg-white text-slate-600'}`} data-part={p.part} data-state={parts[p.part]}>
              {icon(parts[p.part])} {packPartLabel(p)}
            </li>
          ))}
        </ul>
      )}
      {errors.length > 0 && (
        <p role="alert" className="t-sub break-keep text-amber-900" data-testid="mk-pack-ai-error">
          일부를 AI 로 쓰지 못했어요 — {errors.join(' · ')} 그 칸은 규칙 초안 그대로예요.
        </p>
      )}
      {storeFull && <p className="t-meta break-keep text-amber-900">이 브라우저 저장 공간이 가득 차 AI 결과를 남기지 못했어요 — 지금 화면의 글은 [전체 복사] 로 가져가세요.</p>}
    </div>
  )
}
