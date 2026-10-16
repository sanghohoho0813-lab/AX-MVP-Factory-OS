/**
 * 홍보 글 만들기 화면 (D-203) — 업체 하나로 블로그 · 짧은 영상 · 긴 영상 · 카드뉴스 · 카톡 · 플레이스 소개 · 키워드.
 *
 * 순서: 업체 홍보 정보(업체 기록에서 저절로 · 고치기) → 먼저 만들 것 3개(누르면 바로 글) → 직접 고르기(형식 · 키워드 · 주제)
 *      → 결과(복사 · 다른 안 · 고치기 · 보관함 · 업체 기록에 붙이기 · 대표는 AI 작업실로) → 보관함.
 * 규칙 + 업종 견본으로 채우며 'AI' 가 아니다. 업체마다 다른 내용은 [대괄호] 로 비워 두고 점검이 알린다.
 * D-207: 차별점 · 판매 채널 · 손님이 망설이는 점 칸, '이 칸만 채우면' 안내, 블로그 글 종류(우리 글 / 체험단 가이드), 주제 카드에 전략,
 *        쇼츠 길이 20~30 / 30~60초, 카드뉴스 광고 유형 5가지, 키워드 검색량 붙여넣기 정리, 한 달 올릴 계획(주 2회 / 주 4회).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarDays, Check, ChevronDown, ChevronRight, Copy, Info, ListOrdered, PencilLine, RefreshCw, Save, Sparkles, Star, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge, BottomSheet } from '../../components/ui/primitives'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { useToast } from '../../components/ui/toastContext'
import { todayLocalDate } from '../../lib/appClock'
import { useOwnerAiAccess } from '../../auth/ownerAiAccess'
import {
  AD_TYPES,
  AD_TYPE_HINT,
  AD_TYPE_LABEL,
  BLOG_TYPE_HINT,
  BLOG_TYPE_LABEL,
  SHORT_LEN_LABEL,
  monthPlan,
  parseKeywordVolumes,
  profileGaps,
  CONTENT_KINDS,
  CONTENT_LIB,
  KIND_HINT,
  KIND_LABEL,
  NEEDS_TOPIC,
  PURPOSE_LABEL,
  TONE_LABEL,
  TOPIC_LABEL,
  buildProfile,
  draftChecks,
  firstPicks,
  keywordGroups,
  latestByRoot,
  mainKeyword,
  makeDraft,
  plainText,
  topicsFor,
  type ContentItem,
  type ContentKind,
  type ContentPick,
  type Draft,
  type DraftBlock,
  type KakaoPurpose,
  type KeywordVolume,
  type PlanSlot,
  type AdType,
  type BlogType,
  type ProfileOverrides,
  type ShortLen,
  type Tone,
  type TopicType,
} from '../../services/contentStudio'
import { INDUSTRIES, type IndustryKey } from '../../services/siteBuilder'
import type { ClientOpsRecord } from '../../types/clientOps'
import { copyToClipboard, useOwnerAiIdentity, useOwnerAiRepo } from '../../pages/ownerAi/shared'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import { inputClass } from '../homepage/BlockFields'
import { sendDraftToOwnerAi } from './aiHandoff'
import type { ContentStore } from './useContentStore'

const card = 'rounded-(--radius-panel) border border-slate-200 bg-white'
const PURPOSES: KakaoPurpose[] = ['news', 'event', 'season', 'thanks']

function chip(on: boolean): string {
  return `tap t-body min-h-11 rounded-full border px-4 font-semibold ${on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`
}

/** 화면에 띄운 글 — 새로 만든 것(item 없음) 또는 보관함에서 연 것 */
interface Shown {
  draft: Draft
  item: ContentItem | null
}

export function ContentStudio({ record, store }: { record: ClientOpsRecord; store: ContentStore }) {
  const today = todayLocalDate()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const ownerAi = useOwnerAiAccess()
  const aiRepo = useOwnerAiRepo()
  const aiIdent = useOwnerAiIdentity()
  const { profile, source } = useMemo(() => buildProfile(record, today, store.overrides, store.site), [record, today, store.overrides, store.site])

  const [kind, setKind] = useState<ContentKind>('blog')
  const [keyword, setKeyword] = useState(() => mainKeyword(profile))
  const [topicType, setTopicType] = useState<TopicType>('tips')
  const [pages, setPages] = useState<5 | 7>(5)
  const [purpose, setPurpose] = useState<KakaoPurpose>('news')
  const [variant, setVariant] = useState(0)
  const [blogType, setBlogType] = useState<BlogType>('brand')
  const [shortLen, setShortLen] = useState<ShortLen>('20-30')
  const [adType, setAdType] = useState<AdType>('info')
  const [shown, setShown] = useState<Shown | null>(null)
  const [editing, setEditing] = useState<DraftBlock[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const resultRef = useRef<HTMLDivElement | null>(null)

  const topics = useMemo(() => topicsFor(profile, keyword, today, variant), [profile, keyword, today, variant])
  const made = useMemo(() => store.items.map((i) => ({ kind: i.kind, topicType: i.input.topicType, purpose: i.input.purpose, createdAt: i.createdAt })), [store.items])
  const picks = useMemo(() => firstPicks(profile, today, made), [profile, today, made])
  const findWords = useMemo(() => keywordGroups(profile).find((g) => g.key === 'find')?.words.slice(0, 4) ?? [], [profile])

  // 지역 · 대표 상품을 고치면 키워드 칸도 따라간다(사람이 직접 친 키워드는 그대로)
  const lastMain = useRef(mainKeyword(profile))
  useEffect(() => {
    const m = mainKeyword(profile)
    if (m !== lastMain.current) {
      // 직접 고른 키워드도 그 안의 지역 · 상품 부분은 새 값으로('화성 정밀 금속부품 추천' → '동탄 정밀가공 부품 추천')
      const old = lastMain.current
      setKeyword((k) => (old && k.includes(old) ? k.replace(old, m) : k))
      lastMain.current = m
    }
  }, [profile])

  // 말투를 바꾸면 화면의 새 글(저장 전 · 고치기 전)도 같은 요청으로 다시 만든다
  const lastTone = useRef(profile.tone)
  useEffect(() => {
    if (profile.tone === lastTone.current) return
    lastTone.current = profile.tone
    setShown((cur) => {
      if (!cur || cur.item) return cur
      const inp = cur.draft.input
      const ts = topicsFor(profile, inp.keyword ?? '', today, inp.variant)
      return { draft: makeDraft(profile, { kind: cur.draft.kind, keyword: inp.keyword, topic: ts.find((t) => t.type === inp.topicType), pages: inp.pages, purpose: inp.purpose, variant: inp.variant, blogType: inp.blogType, shortLen: inp.shortLen, adType: inp.adType }, today), item: null }
    })
    setEditing(null)
  }, [profile, today])

  // 고치는 중에 창을 닫으면 묻는다
  const dirty = !!editing && !!shown && JSON.stringify(editing) !== JSON.stringify(shown.draft.blocks)
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const show = (d: Draft, item: ContentItem | null = null) => {
    setShown({ draft: d, item })
    setEditing(null)
    // 창만 굴린다 — scrollIntoView 는 overflow 가 숨겨진 바깥 상자까지 굴려서 머리줄 · 메뉴가 밀렸다
    window.setTimeout(() => {
      const el = resultRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY - 88
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }, 60)
  }

  const generate = (over: Partial<{ kind: ContentKind; topicType: TopicType; purpose: KakaoPurpose; variant: number; pages: 5 | 7; keyword: string }> = {}) => {
    const k = over.kind ?? kind
    const v = over.variant ?? variant
    const tt = over.topicType ?? topicType
    const kw = over.keyword ?? keyword
    const ts = topicsFor(profile, kw, today, v)
    const t = ts.find((x) => x.type === tt) ?? ts[0]
    show(makeDraft(profile, { kind: k, keyword: kw, topic: t, pages: over.pages ?? pages, purpose: over.purpose ?? purpose, variant: v, blogType, shortLen, adType }, today))
  }

  const onPick = (p: ContentPick) => {
    setKind(p.kind)
    if (p.topicType) setTopicType(p.topicType)
    if (p.purpose) setPurpose(p.purpose)
    setVariant(0)
    generate({ kind: p.kind, topicType: p.topicType, purpose: p.purpose, variant: 0 })
  }

  const blocks = editing ?? shown?.draft.blocks ?? []
  const checks = shown ? draftChecks(shown.draft.kind, blocks, profile.industry, shown.draft.input.keyword) : []
  const text = shown ? plainText(shown.draft.kind, blocks) : ''

  const copy = async (t: string, what = '글') => showToast((await copyToClipboard(t)) ? `${what}을 복사했어요.` : '복사하지 못했어요 — 글을 길게 눌러 복사해 주세요.')

  const save = async () => {
    if (!shown || busy) return
    setBusy(true)
    try {
      if (shown.item) {
        const v = await store.saveVersion(shown.item, blocks)
        if (!v) return showToast('저장하지 못했어요. 적은 글은 화면에 그대로 있어요 — 다시 눌러 주세요.')
        setShown({ draft: { ...shown.draft, blocks: v.blocks }, item: v })
        setEditing(null)
        showToast(v.id === shown.item.id ? '바뀐 곳이 없어요.' : `고친 글을 ${v.version}판으로 저장했어요(이전 판도 남아 있어요).`)
      } else {
        const r = await store.addDraft(shown.draft, blocks)
        if (!r) return showToast('저장하지 못했어요. 적은 글은 화면에 그대로 있어요 — 다시 눌러 주세요.')
        setShown({ draft: { ...shown.draft, blocks: r.item.blocks }, item: r.item })
        setEditing(null)
        showToast(r.dup ? '같은 글이 이미 보관함에 있어요.' : '보관함에 저장했어요.')
      }
    } finally {
      setBusy(false)
    }
  }

  const toAi = async () => {
    if (!shown || busy) return
    setBusy(true)
    try {
      const r = await sendDraftToOwnerAi(aiRepo, aiIdent, record, shown.draft.title, text)
      showToast(r.added ? 'AI 작업실 자료에 넣었어요 — 자유 AI 작업에 "이 글을 다듬어 줘" 라고 적어 주세요.' : '이미 AI 작업실 자료에 있는 글이에요.')
      navigate(`/ops/clients/${encodeURIComponent(record.id)}?tab=ai`)
    } catch (e) {
      showToast(e instanceof Error && /0021|설정/.test(e.message) ? 'AI 작업실 DB 설정이 필요해요.' : 'AI 작업실에 넣지 못했어요. 잠시 뒤 다시 눌러 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="content-studio">
      <ProfileCard record={record} profile={profile} source={source} onEdit={() => setProfileOpen(true)} />

      {/* 먼저 만들 것 — 눈에 잘 띄게 */}
      <section className="rounded-(--radius-panel) border-2 border-brand-300 bg-brand-50 p-4 sm:p-5" data-testid="content-picks">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="t-section flex items-center gap-2 text-brand-900">
            <Sparkles className="size-5 text-brand-600" aria-hidden="true" />
            {record.companyName}에 먼저 만들 것
          </h2>
          <span className="t-sub break-keep text-brand-800">누르면 이 업체 글이 바로 나와요</span>
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          {picks.map((p, i) => (
            <li key={p.key}>
              <button type="button" onClick={() => onPick(p)} className="tap flex h-full w-full flex-col items-start gap-1 rounded-(--radius-control) border border-brand-200 bg-white p-3 text-left hover:border-brand-500" data-testid="content-pick" data-key={p.key} data-kind={p.kind}>
                <span className="flex w-full items-center gap-2">
                  <span className="t-meta flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{i + 1}</span>
                  <span className="t-body min-w-0 flex-1 font-semibold break-keep text-slate-900">{p.label}</span>
                  <ChevronRight className="size-4 shrink-0 text-brand-600" aria-hidden="true" />
                </span>
                <span className="t-sub break-keep text-slate-600">{p.why}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <PlanCard
        profile={profile}
        today={today}
        onPick={(slot) => {
          setKind(slot.kind)
          if (slot.topicType) setTopicType(slot.topicType)
          if (slot.purpose) setPurpose(slot.purpose)
          setVariant(0)
          generate({ kind: slot.kind, topicType: slot.topicType, purpose: slot.purpose, variant: 0 })
        }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start">
        {/* 직접 고르기 */}
        <section className={`${card} flex flex-col gap-4 p-4 sm:p-5`} data-testid="content-maker">
          <h2 className="t-section text-slate-900">직접 고르기</h2>
          <fieldset className="flex flex-col gap-2">
            <legend className="t-sub mb-1 font-semibold text-slate-700">무엇을 만들까요?</legend>
            <div className="grid grid-cols-2 gap-2">
              {CONTENT_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  data-testid="content-kind"
                  data-kind={k}
                  className={`tap flex min-h-[3.75rem] flex-col items-start justify-center rounded-(--radius-control) border px-3 py-2 text-left ${kind === k ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                >
                  <span className={`t-body font-semibold break-keep ${kind === k ? 'text-brand-800' : 'text-slate-800'}`}>{KIND_LABEL[k]}</span>
                  <span className="t-meta break-keep text-slate-500">{KIND_HINT[k]}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {kind === 'blog' && (
            <fieldset className="flex flex-col gap-1.5" data-testid="content-blogtype">
              <legend className="t-sub mb-1 font-semibold text-slate-700">누가 쓰는 글인가요?</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['brand', 'review'] as BlogType[]).map((b) => (
                  <button key={b} type="button" aria-pressed={blogType === b} onClick={() => setBlogType(b)} data-testid="content-blogtype-btn" data-value={b} className={`tap flex min-h-[3.75rem] flex-col items-start justify-center rounded-(--radius-control) border px-3 py-2 text-left ${blogType === b ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
                    <span className={`t-body font-semibold break-keep ${blogType === b ? 'text-brand-800' : 'text-slate-800'}`}>{BLOG_TYPE_LABEL[b]}</span>
                    <span className="t-meta break-keep text-slate-500">{BLOG_TYPE_HINT[b]}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {NEEDS_TOPIC.has(kind) && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="t-sub font-semibold text-slate-700">키워드(손님이 찾는 말)</span>
                <input className={inputClass} value={keyword} maxLength={40} onChange={(e) => setKeyword(e.target.value)} data-testid="content-keyword" />
              </label>
              <div className="-mt-2 flex flex-wrap gap-1.5">
                {findWords.map((w) => (
                  <button key={w} type="button" onClick={() => setKeyword(w)} className={`tap t-sub min-h-9 rounded-full border px-3 ${keyword === w ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}>
                    {w}
                  </button>
                ))}
              </div>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="t-sub mb-1 font-semibold text-slate-700">주제</legend>
                {topics.map((t) => (
                  <label key={t.type} className={`tap flex cursor-pointer items-start gap-2 rounded-(--radius-control) border px-3 py-2 ${topicType === t.type ? 'border-brand-600 bg-brand-50' : 'border-slate-200'}`} data-testid="content-topic" data-type={t.type}>
                    <input type="radio" name="topic" className="mt-1.5 size-4 accent-brand-600" checked={topicType === t.type} onChange={() => setTopicType(t.type)} />
                    <span className="min-w-0">
                      <span className="t-meta font-semibold text-brand-700">{TOPIC_LABEL[t.type]}</span>
                      <span className="t-body block break-keep text-slate-800">{t.title}</span>
                      {topicType === t.type && (
                        <span className="t-meta mt-0.5 block break-keep text-slate-500" data-testid="content-topic-strategy">
                          전략 · {t.strategy}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </fieldset>
            </>
          )}
          {kind === 'shorts' && (
            <div className="flex flex-wrap items-center gap-2" data-testid="content-shortlen">
              <span className="t-sub font-semibold text-slate-700">길이</span>
              {(['20-30', '30-60'] as ShortLen[]).map((l) => (
                <button key={l} type="button" aria-pressed={shortLen === l} onClick={() => setShortLen(l)} className={chip(shortLen === l)} data-testid="content-shortlen-btn" data-value={l}>
                  {SHORT_LEN_LABEL[l]}
                </button>
              ))}
            </div>
          )}
          {kind === 'cards' && (
            <fieldset className="flex flex-col gap-1.5" data-testid="content-adtype">
              <legend className="t-sub mb-1 font-semibold text-slate-700">어떤 마음을 움직일까요?</legend>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {AD_TYPES.map((a) => (
                  <button key={a} type="button" aria-pressed={adType === a} onClick={() => setAdType(a)} data-testid="content-adtype-btn" data-value={a} className={`tap flex min-h-12 flex-col items-start justify-center rounded-(--radius-control) border px-3 py-1.5 text-left ${adType === a ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
                    <span className={`t-sub font-semibold break-keep ${adType === a ? 'text-brand-800' : 'text-slate-800'}`}>{AD_TYPE_LABEL[a]}</span>
                    <span className="t-meta break-keep text-slate-500">{AD_TYPE_HINT[a]}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {kind === 'cards' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="t-sub font-semibold text-slate-700">장 수</span>
              {([5, 7] as const).map((n) => (
                <button key={n} type="button" aria-pressed={pages === n} onClick={() => setPages(n)} className={chip(pages === n)}>
                  {n}장
                </button>
              ))}
            </div>
          )}
          {kind === 'kakao' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="t-sub w-full font-semibold text-slate-700">무슨 소식인가요?</span>
              {PURPOSES.map((p) => (
                <button key={p} type="button" aria-pressed={purpose === p} onClick={() => setPurpose(p)} className={chip(purpose === p)} data-testid="content-purpose" data-purpose={p}>
                  {PURPOSE_LABEL[p]}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="t-sub w-full font-semibold text-slate-700">말투</span>
            {(['friendly', 'formal'] as Tone[]).map((t) => (
              <button key={t} type="button" aria-pressed={profile.tone === t} onClick={() => void store.saveOverrides({ ...store.overrides, tone: t })} className={chip(profile.tone === t)} data-testid="content-tone" data-tone={t}>
                {TONE_LABEL[t]}
              </button>
            ))}
          </div>
          <Button variant="primary" onClick={() => generate()} data-testid="content-make">
            <Sparkles className="size-4" aria-hidden="true" />
            {kind === 'blog' && blogType === 'review' ? '체험단 가이드 만들기' : `${KIND_LABEL[kind]} 만들기`}
          </Button>
          <p className="t-meta break-keep text-slate-500">업체 기록과 업종 견본으로 채워요(규칙 · 'AI' 아님). 업체마다 다른 곳은 [대괄호] 로 비워 둬요.</p>
        </section>

        {/* 결과 */}
        <div ref={resultRef}>
          {shown ? (
            <section className={`${card} flex flex-col gap-3 p-4 sm:p-5`} data-testid="content-result" data-kind={shown.draft.kind}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{KIND_LABEL[shown.draft.kind]}</Badge>
                {shown.item && <Badge tone="success">보관함 · {shown.item.version}판</Badge>}
                {shown.draft.input.topicType && <Badge>{TOPIC_LABEL[shown.draft.input.topicType]}</Badge>}
              </div>
              <h2 className="t-section break-keep text-slate-900" data-testid="content-result-title">{shown.draft.title}</h2>

              {(checks.length > 0 || shown.draft.notes.length > 0) && (
                <ul className="flex flex-col gap-1.5" data-testid="content-checks">
                  {checks.map((c) => (
                    <li key={c.key} data-level={c.level} className={`t-sub flex items-start gap-2 rounded-(--radius-control) px-3 py-2 break-keep ${c.level === 'must' ? 'bg-danger-50 text-danger-700' : c.level === 'should' ? 'bg-warning-50 text-warning-700' : 'bg-slate-50 text-slate-600'}`}>
                      {c.level === 'info' ? <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                      <span className="min-w-0">{c.text}</span>
                    </li>
                  ))}
                  {shown.draft.notes
                    .filter((n) => !checks.some((c) => c.text === n))
                    .map((n) => (
                      <li key={n} data-level="info" className="t-sub flex items-start gap-2 rounded-(--radius-control) bg-slate-50 px-3 py-2 break-keep text-slate-600">
                        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span className="min-w-0">{n}</span>
                      </li>
                    ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="primary" size="sm" onClick={() => void copy(text)} data-testid="content-copy">
                  <Copy className="size-4" aria-hidden="true" />
                  전체 복사
                </Button>
                {!shown.item && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const v = variant + 1
                      setVariant(v)
                      const tt = shown.draft.input.topicType ?? topicType
                      const ts = topicsFor(profile, shown.draft.input.keyword ?? keyword, today, v)
                      show(makeDraft(profile, { kind: shown.draft.kind, keyword: shown.draft.input.keyword ?? keyword, topic: ts.find((x) => x.type === tt) ?? ts[0], pages: shown.draft.input.pages, purpose: shown.draft.input.purpose, variant: v, blogType: shown.draft.input.blogType, shortLen: shown.draft.input.shortLen, adType: shown.draft.input.adType }, today))
                    }}
                    data-testid="content-again"
                  >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    다른 안
                  </Button>
                )}
                <Button size="sm" onClick={() => setEditing(editing ? null : shown.draft.blocks.map((b) => ({ ...b })))} data-testid="content-edit" aria-pressed={!!editing}>
                  <PencilLine className="size-4" aria-hidden="true" />
                  {editing ? '고치기 그만' : '고치기'}
                </Button>
                <Button size="sm" onClick={() => void save()} disabled={busy || (!!shown.item && !dirty)} data-testid="content-save">
                  <Save className="size-4" aria-hidden="true" />
                  {shown.item ? (dirty ? '고친 판으로 저장' : '저장됨') : '보관함에 저장'}
                </Button>
                {ownerAi === 'yes' && (
                  <Button size="sm" variant="ghost" onClick={() => void toAi()} disabled={busy} data-testid="content-to-ai">
                    <Sparkles className="size-4 text-violet-600" aria-hidden="true" />
                    AI 작업실에서 다듬기
                  </Button>
                )}
              </div>

              <ol className="flex flex-col gap-2" data-testid="content-blocks">
                {blocks.map((b, i) => (
                  <li key={i} className="rounded-(--radius-control) border border-slate-200 bg-slate-50/60 p-3" data-testid="content-block">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        {(b.label || b.hint) && (
                          <p className="flex flex-wrap items-baseline gap-x-2">
                            {b.label && <span className="t-body font-semibold break-keep text-slate-900">{b.label}</span>}
                            {b.hint && <span className="t-meta break-keep text-slate-500">{b.hint}</span>}
                          </p>
                        )}
                        {editing ? (
                          <textarea
                            className={`${inputClass} mt-1 min-h-24 font-normal`}
                            value={b.text}
                            rows={Math.min(14, Math.max(3, b.text.split('\n').length + 1))}
                            onChange={(e) => setEditing((prev) => (prev ? prev.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) : prev))}
                            aria-label={`${b.label || b.hint || '글'} 고치기`}
                            data-testid="content-block-input"
                          />
                        ) : shown.draft.kind === 'keywords' && b.label !== '해시태그' ? (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {b.text.split('\n').map((w) => (
                              <button
                                key={w}
                                type="button"
                                title="이 말로 블로그 주제 보기"
                                onClick={() => {
                                  setKeyword(w)
                                  setKind('blog')
                                  showToast(`키워드를 "${w}" 로 바꿨어요 — 주제를 골라 [블로그 글 만들기] 를 눌러 주세요.`)
                                }}
                                className="tap t-sub min-h-9 rounded-full border border-slate-300 bg-white px-3 text-slate-700 hover:border-brand-500"
                                data-testid="content-word"
                              >
                                {w}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="t-body mt-1 break-words whitespace-pre-wrap text-slate-700">{b.text}</p>
                        )}
                      </div>
                      {!editing && (
                        <button type="button" className="tap flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-white hover:text-slate-800" onClick={() => void copy(b.label ? `${b.label}\n${b.text}` : b.text, '이 칸')} aria-label={`${b.label || b.hint || '이 칸'} 복사`}>
                          <Copy className="size-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>

              {shown.draft.kind === 'keywords' && (
                <KeywordVolumeBox
                  onPick={(w) => {
                    setKeyword(w)
                    setKind('blog')
                    setBlogType('brand')
                    generate({ kind: 'blog', keyword: w, variant: 0 })
                    showToast(`"${w}" 로 블로그 글을 만들었어요 — 다른 주제는 왼쪽에서 고를 수 있어요.`)
                  }}
                />
              )}

              {NEEDS_TOPIC.has(shown.draft.kind) && shown.draft.input.topicType && (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3" data-testid="content-chain">
                  <span className="t-sub font-semibold text-slate-700">같은 주제로</span>
                  {(['blog', 'shorts', 'cards', 'video'] as ContentKind[])
                    .filter((k) => k !== shown.draft.kind)
                    .map((k) => (
                      <Button
                        key={k}
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setKind(k)
                          setTopicType(shown.draft.input.topicType as TopicType)
                          setKeyword(shown.draft.input.keyword ?? keyword)
                          show(makeDraft(profile, { kind: k, keyword: shown.draft.input.keyword, topic: topicsFor(profile, shown.draft.input.keyword ?? keyword, today, shown.draft.input.variant).find((t) => t.type === shown.draft.input.topicType), pages, variant: shown.draft.input.variant, shortLen, adType }, today))
                        }}
                        data-testid="content-chain-kind"
                        data-kind={k}
                      >
                        {KIND_LABEL[k]}
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </Button>
                    ))}
                </div>
              )}

              <ToolResultAttach
                toolKey="content"
                title={`홍보 글 · ${KIND_LABEL[shown.draft.kind]}`}
                verdict={checks.some((c) => c.level === 'must') ? 'check' : 'ready'}
                verdictLabel={checks.some((c) => c.level === 'must') ? '[대괄호] 채우기' : '내보낼 수 있음'}
                summary={`${KIND_LABEL[shown.draft.kind]} — ${shown.draft.title}`}
                data={{ kind: shown.draft.kind, title: shown.draft.title, chars: text.length }}
                followUp={{ text: `홍보 글(${KIND_LABEL[shown.draft.kind]}) 업체 확인 · 올리기`, days: 3 }}
                presetClientId={record.id}
              />
            </section>
          ) : (
            <section className={`${card} flex flex-col items-start gap-2 p-5`} data-testid="content-empty">
              <h2 className="t-section text-slate-900">여기에 글이 나와요</h2>
              <p className="t-sub break-keep text-slate-600">위의 '먼저 만들 것' 을 누르거나, 왼쪽에서 형식을 고르고 [만들기] 를 눌러 주세요.</p>
            </section>
          )}
        </div>
      </div>

      <ArchiveCard store={store} onOpen={(it) => show({ kind: it.kind, title: it.title, blocks: it.blocks, notes: [], input: it.input }, it)} openId={shown?.item?.rootId ?? null} />

      {profileOpen && (
        <ProfileSheet
          overrides={store.overrides}
          profileItem={profile.item}
          onClose={() => setProfileOpen(false)}
          onSave={async (ov) => {
            const ok = await store.saveOverrides(ov)
            showToast(ok ? '홍보 정보를 저장했어요 — 다음 글부터 반영돼요.' : '저장하지 못했어요. 다시 눌러 주세요.')
            if (ok) setProfileOpen(false)
          }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 업체 홍보 정보                                                        */
/* ------------------------------------------------------------------ */

function ProfileCard({ record, profile, source, onEdit }: { record: ClientOpsRecord; profile: ReturnType<typeof buildProfile>['profile']; source: ReturnType<typeof buildProfile>['source']; onEdit: () => void }) {
  const ind = INDUSTRIES.find((i) => i.key === profile.industry)
  const rows: { label: string; value: string; from?: string; missing?: boolean }[] = [
    { label: '업종', value: ind?.label ?? '기타' },
    { label: '대표 상품 · 서비스', value: profile.item, from: source.item === 'industry' ? '업종 말 — 고쳐 주세요' : source.item === 'override' ? '직접 적음' : '업체 기록', missing: source.item === 'industry' },
    { label: '하는 일', value: profile.services.join(' · '), from: source.services === 'site' ? '홈페이지' : source.services === 'override' ? '직접 적음' : source.services === 'record' ? '업체 기록' : '', missing: !profile.services.length },
    { label: '지역', value: profile.region || profile.area, missing: !profile.area },
    { label: '대표 전화', value: profile.phone, missing: !profile.phone },
    { label: '강점(사실)', value: profile.strengths.join(' · ') },
    { label: '차별점', value: profile.differ, missing: !profile.differ },
  ]
  const missing = rows.filter((r) => r.missing).length
  const gaps = profileGaps(profile)
  return (
    <section className={`${card} flex flex-col gap-3 p-4 sm:p-5`} data-testid="content-profile">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="t-section break-keep text-slate-900">{record.companyName} 홍보 정보</h2>
          <p className="t-sub mt-0.5 break-keep text-slate-600">업체 기록에서 저절로 채웠어요. 모든 글이 이 정보를 같이 써요.{missing ? ` 빈 칸 ${missing}개를 채우면 글이 더 정확해져요.` : ''}</p>
        </div>
        <Button size="sm" onClick={onEdit} data-testid="content-profile-edit">
          <PencilLine className="size-4" aria-hidden="true" />
          고치기
        </Button>
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="min-w-0" data-testid="content-profile-row" data-missing={r.missing ? '1' : '0'}>
            <dt className="t-meta flex flex-wrap items-center gap-1.5 text-slate-500">
              {r.label}
              {r.from && <span className="text-slate-400">· {r.from}</span>}
            </dt>
            <dd className={`t-body break-words ${r.missing ? 'text-warning-700' : 'text-slate-800'}`}>{r.value || (r.missing ? '비어 있어요' : '—')}</dd>
          </div>
        ))}
      </dl>
      {gaps.length > 0 && (
        <button type="button" onClick={onEdit} className="tap flex w-full min-w-0 items-start gap-2 rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2.5 text-left hover:border-warning-500" data-testid="content-profile-gaps">
          <Info className="mt-0.5 size-4 shrink-0 text-warning-700" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="t-sub block font-semibold break-keep text-warning-700">이 칸만 채우면 글이 훨씬 좋아져요 · {gaps.length}개</span>
            <span className="mt-1 flex flex-col gap-0.5">
              {gaps.slice(0, 3).map((g) => (
                <span key={g.key} className="t-meta block break-keep text-slate-700" data-testid="content-profile-gap" data-key={g.key}>
                  <b className="font-semibold text-slate-800">{g.label}</b> — {g.why}
                </span>
              ))}
            </span>
          </span>
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-warning-700" aria-hidden="true" />
        </button>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 한 달 올릴 계획                                                        */
/* ------------------------------------------------------------------ */

const DOW = ['일', '월', '화', '수', '목', '금', '토']
function shortDate(d: string): string {
  const [, m, dd] = d.split('-').map(Number)
  return `${m}/${dd} (${DOW[new Date(`${d}T00:00:00Z`).getUTCDay()]})`
}

function PlanCard({ profile, today, onPick }: { profile: ReturnType<typeof buildProfile>['profile']; today: string; onPick: (slot: PlanSlot) => void }) {
  const [open, setOpen] = useState(false)
  const [perWeek, setPerWeek] = useState<2 | 4>(2)
  const slots = useMemo(() => (open ? monthPlan(profile, today, perWeek) : []), [open, profile, today, perWeek])
  return (
    <section className={`${card} flex flex-col gap-3 p-4 sm:p-5`} data-testid="content-plan">
      <button type="button" className="tap flex w-full min-w-0 items-center gap-2 text-left" aria-expanded={open} onClick={() => setOpen((v) => !v)} data-testid="content-plan-toggle">
        <CalendarDays className="size-5 shrink-0 text-brand-700" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="t-section block break-keep text-slate-900">한 달 올릴 계획</span>
          <span className="t-sub block break-keep text-slate-600">다음 주 월요일부터 4주 — 무엇을 언제 올릴지 정해 줘요. 하나 누르면 바로 글이 돼요.</span>
        </span>
        <ChevronDown className={`size-5 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="t-sub font-semibold text-slate-700">얼마나 자주</span>
            {([2, 4] as const).map((n) => (
              <button key={n} type="button" aria-pressed={perWeek === n} onClick={() => setPerWeek(n)} className={chip(perWeek === n)} data-testid="content-plan-per" data-value={n}>
                주 {n}회
              </button>
            ))}
            <span className="t-meta text-slate-500">· {slots.length}개</span>
          </div>
          <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {slots.map((sl, i) => (
              <li key={`${sl.date}-${i}`} className="min-w-0">
                <button type="button" onClick={() => onPick(sl)} className="tap flex w-full min-w-0 flex-col items-start gap-0.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 text-left hover:border-brand-400 hover:bg-brand-50" data-testid="content-plan-slot" data-kind={sl.kind}>
                  <span className="t-meta flex w-full min-w-0 flex-wrap items-center gap-x-1.5 text-slate-500">
                    <span className="tabular-nums">{shortDate(sl.date)}</span>
                    <span className="font-semibold text-brand-700">{KIND_LABEL[sl.kind]}</span>
                  </span>
                  <span className="t-sub block w-full break-keep text-slate-800">{sl.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 키워드 검색량 정리                                                      */
/* ------------------------------------------------------------------ */

function KeywordVolumeBox({ onPick }: { onPick: (word: string) => void }) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<KeywordVolume[] | null>(null)
  const fmt = (n: number | null, small: boolean) => (n === null ? '—' : small && n === 0 ? '< 10' : n.toLocaleString('ko-KR'))
  return (
    <section className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3" data-testid="content-volume">
      <h3 className="t-sub flex items-center gap-1.5 font-semibold text-slate-800">
        <ListOrdered className="size-4 text-brand-700" aria-hidden="true" />
        검색량 붙여 넣어 정리하기
      </h3>
      <p className="t-meta break-keep text-slate-600">네이버 광고 '키워드 도구' 표를 그대로 복사해 붙여 넣으세요(키워드 · PC · 모바일 칸). 많이 찾는 순으로 줄 세워 드려요. 쉼표로 적은 목록도 돼요.</p>
      <textarea className={`${inputClass} min-h-24 font-mono text-[0.8125rem]`} value={text} onChange={(e) => setText(e.target.value)} placeholder={'동탄 욕실 리모델링\t320\t1,450\n동탄 인테리어\t880\t3,200'} data-testid="content-volume-input" aria-label="검색량 표 붙여 넣기" />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setRows(parseKeywordVolumes(text))} disabled={!text.trim()} data-testid="content-volume-run">
          <ListOrdered className="size-4" aria-hidden="true" />
          정리하기
        </Button>
        {rows && <span className="t-meta text-slate-500" data-testid="content-volume-count">{rows.length}개{rows.length > 30 ? ' · 위 30개만 보여요' : ''}</span>}
      </div>
      {rows && rows.length > 0 && (
        <ol className="flex flex-col divide-y divide-slate-200 rounded-(--radius-control) border border-slate-200 bg-white">
          {rows.slice(0, 30).map((r, i) => (
            <li key={r.word} className="flex min-w-0 items-center gap-2 px-3 py-2" data-testid="content-volume-row">
              <span className="t-meta w-5 shrink-0 text-right tabular-nums text-slate-400">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="t-sub block break-keep text-slate-800">{r.word}</span>
                {r.total !== null && (
                  <span className="t-meta block tabular-nums text-slate-500">
                    합 <b className="font-semibold text-slate-700">{fmt(r.total, r.small)}</b> · PC {fmt(r.pc, r.small)} · 모바일 {fmt(r.mobile, r.small)}
                  </span>
                )}
              </span>
              <Button size="sm" onClick={() => onPick(r.word)} data-testid="content-volume-pick">
                이 말로 글
              </Button>
            </li>
          ))}
        </ol>
      )}
      {rows && rows.length === 0 && <p className="t-meta text-warning-700">읽을 수 있는 키워드가 없어요. 표를 그대로 복사해 붙여 넣어 주세요.</p>}
    </section>
  )
}

function ProfileSheet({ overrides, profileItem, onClose, onSave }: { overrides: ProfileOverrides; profileItem: string; onClose: () => void; onSave: (ov: ProfileOverrides) => Promise<void> }) {
  const [ov, setOv] = useState<ProfileOverrides>(overrides)
  const [saving, setSaving] = useState(false)
  const list = (s: string) =>
    s
      .split(/[,·\n]/)
      .map((x) => x.trim())
      .filter(Boolean)
  const [servicesText, setServicesText] = useState((overrides.services ?? []).join(', '))
  const [extraText, setExtraText] = useState((overrides.extraStrengths ?? []).join(', '))
  const field = (label: string, key: 'item' | 'area' | 'target' | 'phone' | 'hours' | 'differ' | 'channel' | 'objection', placeholder: string) => (
    <label className="flex flex-col gap-1.5">
      <span className="t-sub font-semibold text-slate-700">{label}</span>
      <input className={inputClass} value={ov[key] ?? ''} placeholder={placeholder} onChange={(e) => setOv((p) => ({ ...p, [key]: e.target.value }))} data-testid={`content-ov-${key}`} />
    </label>
  )
  return (
    <BottomSheet
      title="홍보 정보 고치기"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>닫기</Button>
          <Button
            variant="primary"
            disabled={saving}
            data-testid="content-ov-save"
            onClick={async () => {
              setSaving(true)
              await onSave({ ...ov, services: list(servicesText), extraStrengths: list(extraText) })
              setSaving(false)
            }}
          >
            <Check className="size-4" aria-hidden="true" />
            저장
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="t-sub break-keep text-slate-600">비워 두면 업체 기록 · 업종 견본으로 채워요. 여기서 고친 것은 홍보 글에만 쓰고, 업체 기록은 바꾸지 않아요.</p>
        <label className="flex flex-col gap-1.5">
          <span className="t-sub font-semibold text-slate-700">업종(견본)</span>
          <select className={inputClass} value={ov.industry ?? ''} onChange={(e) => setOv((p) => ({ ...p, industry: (e.target.value || undefined) as IndustryKey | undefined }))} data-testid="content-ov-industry">
            <option value="">업체 기록으로 알아보기</option>
            {INDUSTRIES.map((i) => (
              <option key={i.key} value={i.key}>
                {i.label}
              </option>
            ))}
          </select>
        </label>
        {field('대표 상품 · 서비스(키워드 가운데 말)', 'item', `지금: ${profileItem}`)}
        <label className="flex flex-col gap-1.5">
          <span className="t-sub font-semibold text-slate-700">하는 일(쉼표로 나눔)</span>
          <input className={inputClass} value={servicesText} placeholder="예: 욕실 리모델링, 주방 리모델링, 누수 수리" onChange={(e) => setServicesText(e.target.value)} data-testid="content-ov-services" />
        </label>
        {field('키워드 지역(짧게)', 'area', '예: 동탄 · 강남 · 망원')}
        {field('주 고객', 'target', ov.industry ? CONTENT_LIB[ov.industry].target : '예: 근처에 사는 30~40대 가족')}
        <label className="flex flex-col gap-1.5">
          <span className="t-sub font-semibold text-slate-700">더할 강점(사실만 · 쉼표로 나눔)</span>
          <input className={inputClass} value={extraText} placeholder="예: 주차 20대, 당일 견적" onChange={(e) => setExtraText(e.target.value)} data-testid="content-ov-extra" />
        </label>
        {field('대표 전화(글에 넣을 번호)', 'phone', '회사 대표 번호')}
        {field('운영 시간', 'hours', '예: 평일 09:00 – 18:00 · 토 휴무')}
        {field('차별점(다른 곳과 다른 한 가지 · 사실만)', 'differ', '예: 시공 뒤 1년 무상 점검을 계약서에 적어 드려요')}
        {field('판매 채널(어디서 사거나 예약하나요)', 'channel', '예: 네이버 예약 · 스마트스토어 · 전화')}
        {field('손님이 망설이는 점', 'objection', '예: 공사 기간 동안 생활이 불편할까 봐')}
      </div>
    </BottomSheet>
  )
}

/* ------------------------------------------------------------------ */
/* 보관함                                                                */
/* ------------------------------------------------------------------ */

function ArchiveCard({ store, onOpen, openId }: { store: ContentStore; onOpen: (it: ContentItem) => void; openId: string | null }) {
  const { showToast } = useToast()
  const [filter, setFilter] = useState<'all' | 'fav' | ContentKind>('all')
  const [del, setDel] = useState<{ rootId: string; title: string; versions: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const rows = useMemo(() => latestByRoot(store.items), [store.items])
  const shown = rows.filter((r) => (filter === 'all' ? true : filter === 'fav' ? r.item.favorite : r.item.kind === filter))
  const kindsHere = CONTENT_KINDS.filter((k) => rows.some((r) => r.item.kind === k))
  return (
    <section className={`${card} flex flex-col gap-3 p-4 sm:p-5`} data-testid="content-archive">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="t-section text-slate-900">보관함</h2>
        <span className="t-sub text-slate-500">{rows.length}편</span>
      </div>
      {rows.length === 0 ? (
        <p className="t-sub break-keep text-slate-500">아직 저장한 글이 없어요. 글을 만들고 [보관함에 저장] 을 누르면 여기에 남아요.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'fav', ...kindsHere] as const).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`tap t-sub min-h-9 rounded-full border px-3 ${filter === f ? 'border-brand-600 bg-brand-50 font-semibold text-brand-700' : 'border-slate-200 text-slate-600'}`}>
                {f === 'all' ? '전체' : f === 'fav' ? '즐겨찾기' : KIND_LABEL[f]}
              </button>
            ))}
          </div>
          <ul className="flex flex-col divide-y divide-slate-100">
            {shown.map(({ item, versions }) => (
              <li key={item.rootId} className={`flex items-center gap-2 py-1.5 ${openId === item.rootId ? 'bg-brand-50/60' : ''}`} data-testid="content-archive-item" data-kind={item.kind}>
                <button
                  type="button"
                  className="tap flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) hover:bg-slate-50"
                  aria-label={item.favorite ? '즐겨찾기 빼기' : '즐겨찾기'}
                  aria-pressed={item.favorite}
                  onClick={async () => {
                    if (!(await store.toggleFavorite(item.rootId))) showToast('바꾸지 못했어요. 다시 눌러 주세요.')
                  }}
                  data-testid="content-fav"
                >
                  <Star className={`size-5 ${item.favorite ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} aria-hidden="true" />
                </button>
                <button type="button" className="tap flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center text-left" onClick={() => onOpen(item)} data-testid="content-archive-open">
                  <span className="t-body w-full truncate font-medium text-slate-800">{item.title}</span>
                  <span className="t-meta text-slate-500">
                    {KIND_LABEL[item.kind]} · {item.createdAt.slice(0, 10)}
                    {versions > 1 ? ` · ${versions}판` : ''}
                  </span>
                </button>
                <button type="button" className="tap flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-400 hover:bg-danger-50 hover:text-danger-700" aria-label={`${item.title} 지우기`} onClick={() => setDel({ rootId: item.rootId, title: item.title, versions })} data-testid="content-del">
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <ConfirmModal
        open={!!del}
        title="이 글을 지울까요?"
        message={del ? `「${del.title}」${del.versions > 1 ? ` (고친 판 ${del.versions}개 모두)` : ''}` : ''}
        warning="지우면 되돌릴 수 없어요."
        confirmLabel="지우기"
        danger
        busy={busy}
        onCancel={() => setDel(null)}
        onConfirm={async () => {
          if (!del) return
          setBusy(true)
          const ok = await store.removeChain(del.rootId)
          setBusy(false)
          setDel(null)
          showToast(ok ? '지웠어요.' : '지우지 못했어요. 다시 눌러 주세요.')
        }}
      />
    </section>
  )
}
