/**
 * 홍보 글 만들기 화면 (D-203) — 업체 하나로 블로그 · 짧은 영상 · 긴 영상 · 카드뉴스 · 카톡 · 플레이스 소개 · 키워드.
 *
 * 순서: 업체 홍보 정보(업체 기록에서 저절로 · 고치기) → 먼저 만들 것 3개(누르면 바로 글) → 직접 고르기(형식 · 키워드 · 주제)
 *      → 결과(복사 · 다른 안 · 고치기 · 보관함 · 업체 기록에 붙이기 · 대표는 AI 작업실로) → 보관함.
 * 규칙 + 업종 견본으로 채우며 'AI' 가 아니다. 업체마다 다른 내용은 [대괄호] 로 비워 두고 점검이 알린다.
 * D-207: 차별점 · 판매 채널 · 손님이 망설이는 점 칸, '이 칸만 채우면' 안내, 블로그 글 종류(우리 글 / 체험단 가이드), 주제 카드에 전략,
 *        쇼츠 길이 20~30 / 30~60초, 카드뉴스 광고 유형 5가지, 키워드 검색량 붙여넣기 정리, 한 달 올릴 계획(주 2회 / 주 4회).
 * D-208: '이런 일이 있을 때' 상황 12가지(누르면 카톡 · 블로그 · 카드뉴스 묶음 · 묶음 모두 저장), 한 달 치 한 번에 만들기 ·
 *        업체 일정에 올릴 날 걸기 · 계획 칸에 만듦/올림, 보관함 '올렸어요' 표시 · 거르기.
 * D-227: 대표 "한 페이지에 너무 많으면 역효과 · 길을 잃지 않게 · 토스처럼 다음 단계로" —
 *        길잡이 ① 고르기 → ② 다듬기 → ③ 저장 · 올리기, '무엇을 만들까요' 는 네 길(추천 · 상황 · 직접 · 한 달 계획) 중
 *        고른 하나만 펼친다. 홍보 정보 칸 · 보관함은 접어 둔다(펼침은 이 기기에 기억). 지운 기능은 없다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFold } from '../../components/ui/fold'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Archive, Award, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, Circle, Copy, Factory, Gem, Globe, Info, Layers, ListChecks, ListOrdered, MapPin, Megaphone, Package, PencilLine, Phone, RefreshCw, Save, Sparkles, Star, Trash2, Wand2, type LucideIcon } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge, BottomSheet } from '../../components/ui/primitives'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { useToast } from '../../components/ui/toastContext'
import { useUnsavedChangesGuard } from '../../lib/useUnsavedChangesGuard'
import { localDateOf, todayLocalDate } from '../../lib/appClock'
import { useOwnerAiAccess } from '../../auth/ownerAiAccess'
import {
  AD_TYPES,
  AD_TYPE_HINT,
  AD_TYPE_LABEL,
  BLOG_TYPE_HINT,
  BLOG_TYPE_LABEL,
  SHORT_LEN_LABEL,
  activePlan,
  keepPlan,
  monthPlan,
  monthPlanFrom,
  parseKeywordVolumes,
  planDrafts,
  planSlotStates,
  sameContent,
  situationPack,
  situationsFor,
  SITUATION_SHORT,
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
  fillHoles,
  firstPicks,
  holeGroups,
  holeNames,
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
  type SituationKey,
  type Tone,
  type TopicType,
} from '../../services/contentStudio'
import { INDUSTRIES, type IndustryKey } from '../../services/siteBuilder'
import { KR_PUBLIC_HOLIDAYS } from '../../services/daysOff'
import type { ClientOpsRecord } from '../../types/clientOps'
import { copyToClipboard, useOwnerAiIdentity, useOwnerAiRepo } from '../../pages/ownerAi/shared'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import { inputClass } from '../homepage/BlockFields'
import { sendDraftToOwnerAi } from './aiHandoff'
import { isTrialId, subjectQuery } from '../../services/marketingTrial'
import type { ContentStore } from './useContentStore'
import { KindGlyph, MkHead, MkHero, MkIcon, MkPick, MkSteps, MkTag } from '../marketing/mkKit'
import { HERO_BTN, KIND_ACCENT, KIND_STYLE, MK_PRIMARY, SITUATION_STYLE, TONE, mkChip, tabTone, type MkTone } from '../marketing/mkTheme'

const card = 'rounded-(--radius-panel) border border-slate-200 bg-white shadow-sm'
const PURPOSES: KakaoPurpose[] = ['news', 'event', 'season', 'thanks']

// D-226 고르는 칩 · 칸은 테마 색이 아니라 홍보 글 색(보라)
const chip = (on: boolean) => mkChip(on, 'violet')
const pickBox = (on: boolean) => (on ? TONE.violet.on : `border-slate-200 bg-white ${TONE.violet.hover}`)

/** D-227 무엇을 만들까요 — 추천 · 상황 · 직접 · 한 달 계획 중 하나만 펼친다 */
type Mode = 'pick' | 'situation' | 'direct' | 'plan'

/** 화면에 띄운 글 — 새로 만든 것(item 없음) 또는 보관함에서 연 것 */
interface Shown {
  draft: Draft
  item: ContentItem | null
}

/** D-208 상황 묶음 — 화면에 띄운 글은 늘 items[at] 이다(묶음이 null 이 아니면) */
interface PackState {
  key: SituationKey
  label: string
  fill: string[]
  items: { tab: string; draft: Draft }[]
  saved: (ContentItem | null)[]
  /** D-209 저장 전 글을 고치거나 빈 칸을 채운 탭 — 다른 글로 넘어가기 전에 묻는다 */
  touched: boolean[]
  at: number
}

/** 공휴일 표(올해 · 내년) — 상황 '쉬는 날을 알려요' 의 지금 때 */
function holidaysAround(today: string) {
  const y = Number(today.slice(0, 4))
  return [...(KR_PUBLIC_HOLIDAYS[y] ?? []), ...(KR_PUBLIC_HOLIDAYS[y + 1] ?? [])]
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
  /** 고친 글(저장 전) — 고치기 칸을 닫아도 남는다 */
  const [editing, setEditing] = useState<DraftBlock[] | null>(null)
  /** D-209 고치기 칸이 열려 있는지 — '고치기 그만' 은 칸만 닫고 고친 글은 남긴다(전에는 말없이 버렸다) */
  const [editOpen, setEditOpen] = useState(false)
  useEffect(() => {
    if (!editing) setEditOpen(false)
  }, [editing])
  const [busy, setBusy] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  /** D-227 무엇을 만들까요 — 네 길 중 지금 펼친 하나 */
  const [mode, setMode] = useState<Mode>('pick')
  const [pack, setPack] = useState<PackState | null>(null)
  const packRef = useRef<PackState | null>(null)
  packRef.current = pack
  const resultRef = useRef<HTMLDivElement | null>(null)
  const holidays = useMemo(() => holidaysAround(today), [today])

  const topics = useMemo(() => topicsFor(profile, keyword, today, variant), [profile, keyword, today, variant])
  const made = useMemo(() => store.items.map((i) => ({ kind: i.kind, topicType: i.input.topicType, purpose: i.input.purpose, createdAt: i.createdAt })), [store.items])
  const picks = useMemo(() => firstPicks(profile, today, made), [profile, today, made])
  const findWords = useMemo(() => keywordGroups(profile).find((g) => g.key === 'find')?.words.slice(0, 4) ?? [], [profile])
  const archiveRows = useMemo(() => latestByRoot(store.items), [store.items])
  const situationNow = useMemo(() => situationsFor(profile, today, holidays).filter((x) => x.now).length, [profile, today, holidays])

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
    const pk = packRef.current
    if (pk) {
      // 묶음은 통째로 새 말투로 — 이미 저장한 글은 보관함에 그대로 있다
      const sp = situationPack(profile, pk.key, today, holidaysAround(today))
      const next = { ...pk, items: sp.items, saved: sp.items.map(() => null), touched: sp.items.map(() => false) }
      setPack(next)
      setShown((cur) => (cur && !cur.item ? { draft: next.items[next.at]?.draft ?? cur.draft, item: null } : cur))
      setEditing(null)
      return
    }
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
  // D-209 묶음의 다른 탭에 저장 전 고침 · 채움이 남아 있는지
  const packTouched = !!pack && pack.touched.some((t, i) => t && !pack.saved[i])
  const unsaved = dirty || packTouched
  /** D-227 길잡이 단계 — 0 고르기 · 1 다듬기(새 글 · 고치는 중) · 2 저장함(올리기 남음) · 3 올림까지 끝 */
  const step = !shown ? 0 : !shown.item || dirty ? 1 : shown.item.postedAt ? 3 : 2
  const [leaveAsk, setLeaveAsk] = useState<{ run: () => void } | null>(null)
  /** D-209 저장 전 고침이 있으면 다른 글을 열기 전에 묻는다(말없이 사라지지 않게) */
  const guard = (run: () => void) => (unsaved ? setLeaveAsk({ run }) : run())
  // D-221 메뉴 · 링크로 다른 화면에 가도 묻는다(예전에는 창 닫기만 막아 고친 글이 말없이 사라졌다)
  const { blocker: leaveRoute } = useUnsavedChangesGuard(unsaved)
  useEffect(() => {
    if (!unsaved) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [unsaved])

  // 창만 굴린다 — scrollIntoView 는 overflow 가 숨겨진 바깥 상자까지 굴려서 머리줄 · 메뉴가 밀렸다
  const toResult = () =>
    window.setTimeout(() => {
      const el = resultRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY - 88
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }, 60)

  const show = (d: Draft, item: ContentItem | null = null, keepPack = false) => {
    setShown({ draft: d, item })
    setEditing(null)
    if (!keepPack) setPack(null)
    toResult()
  }

  /** 보관함 · 계획 칸에서 글 열기 — 이미 띄운 글이면 그 자리로만(고치던 것 그대로) */
  const openItem = (it: ContentItem) => {
    if (shown?.item?.rootId === it.rootId) return toResult()
    guard(() => show({ kind: it.kind, title: it.title, blocks: it.blocks, notes: [], input: it.input }, it))
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
  // D-209 [대괄호] 한 번에 채우기 — 묶음이면 지금 글 + 저장 전 탭 모두
  const fillNames = shown ? holeNames(pack ? [blocks, ...pack.items.filter((_, j) => j !== pack.at && !pack.saved[j]).map((x) => x.draft.blocks)] : [blocks]) : []
  const applyFill = (vals: Record<string, string>, drop: string[]) => {
    if (!shown) return
    const cur = fillHoles(blocks, vals, drop)
    let tabs = cur.filled ? 1 : 0
    let spots = cur.filled
    if (cur.filled) setEditing(cur.blocks)
    if (pack) {
      const touched = [...pack.touched]
      const items = pack.items.map((x, j) => {
        if (j === pack.at || pack.saved[j]) return x
        const r = fillHoles(x.draft.blocks, vals, drop)
        if (!r.filled) return x
        tabs += 1
        spots += r.filled
        touched[j] = true
        return { ...x, draft: { ...x.draft, blocks: r.blocks } }
      })
      setPack({ ...pack, items, touched })
    }
    const kept = pack ? pack.saved.filter((x, j) => x && j !== pack.at).length : 0
    showToast(spots ? `빈 칸 ${spots}곳을 채웠어요${pack ? `(글 ${tabs}편)` : ''} — 저장해야 남아요.${kept ? ` 이미 저장한 ${kept}편은 그대로예요.` : ''}` : '넣을 값을 적어 주세요.')
  }

  const copy = async (t: string, what = '글') => showToast((await copyToClipboard(t)) ? `${what}을 복사했어요.` : '복사하지 못했어요 — 글을 길게 눌러 복사해 주세요.')

  const save = async () => {
    if (!shown || busy) return
    setBusy(true)
    try {
      if (shown.item) {
        const v = await store.saveVersion(shown.item, blocks)
        if (!v) return showToast('저장하지 못했어요. 적은 글은 화면에 그대로 있어요 — 다시 눌러 주세요.')
        setShown({ draft: { ...shown.draft, title: v.title, blocks: v.blocks }, item: v })
        setEditing(null)
        // D-208 고침: 묶음 탭을 넘겼다 와도 새 판이 보이게
        setPack((pk) => (pk ? { ...pk, items: pk.items.map((x, i) => (i === pk.at ? { ...x, draft: { ...x.draft, title: v.title, blocks: v.blocks } } : x)), saved: pk.saved.map((x, i) => (i === pk.at ? v : x)) } : pk))
        showToast(v.id === shown.item.id ? '바뀐 곳이 없어요.' : `고친 글을 ${v.version}판으로 저장했어요(이전 판도 남아 있어요).`)
      } else {
        const r = await store.addDraft(shown.draft, blocks)
        if (!r) return showToast('저장하지 못했어요. 적은 글은 화면에 그대로 있어요 — 다시 눌러 주세요.')
        setShown({ draft: { ...shown.draft, title: r.item.title, blocks: r.item.blocks }, item: r.item })
        setEditing(null)
        setPack((pk) => (pk ? { ...pk, items: pk.items.map((x, i) => (i === pk.at ? { ...x, draft: { ...x.draft, title: r.item.title, blocks: r.item.blocks } } : x)), saved: pk.saved.map((x, i) => (i === pk.at ? r.item : x)) } : pk))
        showToast(r.dup ? '같은 글이 이미 보관함에 있어요.' : '보관함에 저장했어요.')
      }
    } finally {
      setBusy(false)
    }
  }

  /** D-208 상황 하나 → 묶음 */
  const openPack = (key: SituationKey) => {
    // D-209 이미 연 묶음을 다시 누르면 새로 만들지 않고 그 자리로(채우던 것 그대로)
    if (pack?.key === key) return toResult()
    const sp = situationPack(profile, key, today, holidays)
    if (!sp.items.length) return
    guard(() => {
      setPack({ key, label: sp.situation.label, fill: sp.situation.fill, items: sp.items, saved: sp.items.map(() => null), touched: sp.items.map(() => false), at: 0 })
      show(sp.items[0].draft, null, true)
    })
  }

  const packGo = (i: number) => {
    if (!pack || i === pack.at || !shown) return
    let items = pack.items
    let touched = pack.touched
    if (dirty) {
      // 저장 전 글을 고치던 중이면 고친 글을 묶음에 남기고 넘어간다 · 저장한 글을 고치던 중이면 먼저 저장하라고 알린다
      if (shown.item) return showToast('고친 글을 먼저 [고친 판으로 저장] 해 주세요.')
      items = items.map((x, j) => (j === pack.at && editing ? { ...x, draft: { ...x.draft, blocks: editing } } : x))
      touched = touched.map((t, j) => t || j === pack.at)
    }
    setPack({ ...pack, items, touched, at: i })
    show(items[i].draft, pack.saved[i], true)
  }

  const packSaveAll = async () => {
    if (!pack || busy) return
    // D-208 고침: 이미 저장한 글을 고치던 중이면 그 고침을 덮지 않게 먼저 저장하라고 알린다
    if (dirty && shown?.item) return showToast('고친 글을 먼저 [고친 판으로 저장] 해 주세요.')
    const items = pack.items.map((x, j) => (j === pack.at && editing && !shown?.item ? { ...x, draft: { ...x.draft, blocks: editing } } : x))
    const todo = items.map((x, j) => ({ d: x.draft, j })).filter((x) => !pack.saved[x.j])
    if (!todo.length) return
    setBusy(true)
    try {
      const r = await store.addMany(todo.map((x) => x.d))
      const saved = [...pack.saved]
      todo.forEach((x, k) => {
        if (r.items[k]) saved[x.j] = r.items[k]
      })
      const next = { ...pack, items, saved }
      setPack(next)
      const cur = saved[pack.at]
      if (cur) {
        setShown({ draft: { ...items[pack.at].draft, blocks: cur.blocks }, item: cur })
        setEditing(null)
      }
      showToast(r.failed ? `${r.failed}편을 저장하지 못했어요 — 다시 눌러 주세요.` : `묶음 ${r.added}편을 보관함에 저장했어요${r.dup ? ` · 이미 있던 ${r.dup}편은 건너뛰었어요` : ''}.`)
    } finally {
      setBusy(false)
    }
  }

  const togglePosted = async (it: ContentItem) => {
    const on = !it.postedAt
    if (!(await store.setPosted(it.rootId, on))) return showToast('바꾸지 못했어요. 다시 눌러 주세요.')
    showToast(on ? '올렸어요로 표시했어요.' : '아직 안 올린 글로 바꿨어요.')
    setShown((cur) => (cur?.item && cur.item.rootId === it.rootId ? { ...cur, item: { ...cur.item, ...(on ? { postedAt: new Date().toISOString() } : { postedAt: undefined }) } } : cur))
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
      <ProfileCard record={record} profile={profile} source={source} saved={archiveRows.length} posted={archiveRows.filter((r) => r.item.postedAt).length} onEdit={() => setProfileOpen(true)} />

      {/* D-227 길잡이 — 지금 몇 단계 · 다음에 누를 것 · 네 길 중 하나 */}
      <section className={`${card} flex flex-col gap-4 p-4 sm:p-5`} data-testid="content-guide">
        <div className="mx-auto w-full max-w-xl">
          <MkSteps
            steps={[
              { key: 'choose', label: '고르기' },
              { key: 'edit', label: '다듬기' },
              { key: 'save', label: '저장 · 올리기' },
            ]}
            current={step}
            tone="violet"
            onGo={(k) => (k === 'choose' ? document.querySelector('[data-testid="content-guide"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : toResult())}
            testId="content-steps"
          />
        </div>
        <p className="t-sub flex items-start gap-1.5 break-keep text-slate-700" data-testid="content-next">
          <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-violet-600" />
          <span className="min-w-0">
            <b className="font-bold text-slate-900">지금 할 일 — </b>
            {step === 0
              ? '아래 네 가지 중 하나를 고르세요. 처음이면 [추천 3개] 를 누르면 이 업체에 맞는 글이 바로 나와요.'
              : step === 1
                ? '아래 글을 읽고 [대괄호] 를 채우거나 [고치기] 로 다듬은 뒤 [보관함에 저장] 을 눌러 주세요.'
                : step === 2
                  ? '저장했어요. 업체가 글을 올리면 [올렸어요 표시] 를 눌러 주세요 — 한 달 계획 · 오늘 화면에 반영돼요.'
                  : '올린 글까지 표시했어요. 다음 글을 만들려면 위에서 다시 고르세요.'}
          </span>
        </p>
        <MkPick
          label="무엇을 만들까요"
          testId="content-mode"
          value={mode}
          onChange={(k) => setMode(k as Mode)}
          options={[
            { key: 'pick', label: '추천 3개', hint: '이 업체에 먼저 만들 글', icon: Sparkles, tone: 'violet', badge: picks.length },
            { key: 'situation', label: '이런 일이 있을 때', hint: '새 상품 · 휴무 · 행사 …', icon: Layers, tone: 'fuchsia', badge: situationNow || undefined },
            { key: 'direct', label: '직접 고르기', hint: '블로그 · 영상 · 카드뉴스 …', icon: Wand2, tone: 'sky' },
            { key: 'plan', label: '한 달 계획', hint: '4주 치 한 번에 · 달력', icon: CalendarDays, tone: 'emerald' },
          ]}
        />
      </section>

      {/* 먼저 만들 것 — 눈에 잘 띄게(D-226 글 종류마다 색 아이콘) */}
      {mode === 'pick' && (
      <section className="rounded-(--radius-panel) border-2 border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4 shadow-sm sm:p-5" data-testid="content-picks">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="t-section flex min-w-0 items-center gap-2.5 text-violet-900">
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-700 text-white shadow-sm">
              <Sparkles className="size-5" />
            </span>
            {/* D-224 띄어쓰기 없는 아주 긴 업체 이름도 줄을 바꿔 휴대폰에서 옆으로 넘치지 않게 */}
            <span className="min-w-0 [overflow-wrap:anywhere]">{record.companyName}에 먼저 만들 것</span>
          </h2>
          <span className="t-sub break-keep text-violet-800">누르면 이 업체 글이 바로 나와요</span>
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
          {picks.map((p, i) => {
            const ks = KIND_STYLE[p.kind]
            return (
              <li key={p.key}>
                <button type="button" onClick={() => guard(() => onPick(p))} className={`tap group flex h-full w-full flex-col items-start gap-2 rounded-(--radius-control) border-2 bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md ${TONE[ks.tone].line} ${TONE[ks.tone].hover}`} data-testid="content-pick" data-key={p.key} data-kind={p.kind}>
                  <span className="flex w-full items-center gap-2.5">
                    <MkIcon icon={ks.icon} tone={ks.tone} />
                    <span className="min-w-0 flex-1">
                      <span className={`t-meta block font-bold ${TONE[ks.tone].text}`}>
                        {i + 1}순위{p.label.includes(KIND_LABEL[p.kind].slice(0, 2)) ? '' : ` · ${KIND_LABEL[p.kind]}`}
                      </span>
                      <span className="t-body block font-semibold break-keep text-slate-900">{p.label}</span>
                    </span>
                    <ChevronRight className={`size-5 shrink-0 transition-transform group-hover:translate-x-0.5 ${TONE[ks.tone].text}`} aria-hidden="true" />
                  </span>
                  <span className="t-sub break-keep text-slate-600">{p.why}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
      )}
      {mode === 'situation' && (
      <SituationCard profile={profile} today={today} holidays={holidays} openKey={pack?.key ?? null} onPick={openPack} />
      )}
      {mode === 'plan' && (
      <PlanCard
        startOpen
        record={record}
        profile={profile}
        today={today}
        store={store}
        onOpen={openItem}
        onPick={(slot) =>
          guard(() => {
            setKind(slot.kind)
            if (slot.topicType) setTopicType(slot.topicType)
            if (slot.purpose) setPurpose(slot.purpose)
            setVariant(0)
            // D-208 고침: 계획 칸에서 만든 글에도 올릴 날을 달아 저장하면 그 칸이 '만듦' 이 된다
            show(planDrafts(profile, [slot], today, (d) => !!sameContent(store.items, d.kind, d.blocks))[0])
          })
        }
      />
      )}

      {/* D-227 직접 고르기일 때만 왼쪽 칸 + 오른쪽 결과, 다른 길은 결과가 고른 판 바로 아래 한 줄로 */}
      <div className={mode === 'direct' ? 'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start' : 'flex flex-col gap-4'}>
        {/* 직접 고르기 */}
        {mode === 'direct' && (
        <section className={`${card} flex flex-col gap-4 p-4 sm:p-5`} data-testid="content-maker">
          <MkHead icon={Wand2} tone="violet" title="직접 고르기" />
          <fieldset className="flex flex-col gap-2">
            <legend className="t-sub mb-1 font-semibold text-slate-700">무엇을 만들까요?</legend>
            <div className="grid grid-cols-2 gap-2">
              {CONTENT_KINDS.map((k) => {
                const ks = KIND_STYLE[k]
                const on = kind === k
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setKind(k)}
                    data-testid="content-kind"
                    data-kind={k}
                    className={`tap flex min-h-[3.75rem] min-w-0 items-start gap-2 rounded-(--radius-control) border px-2.5 py-2 text-left ${on ? TONE[ks.tone].on : `border-slate-200 bg-white ${TONE[ks.tone].hover}`}`}
                  >
                    <MkIcon icon={ks.icon} tone={ks.tone} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className={`t-body block font-semibold break-keep ${on ? TONE[ks.tone].deep : 'text-slate-800'}`}>{KIND_LABEL[k]}</span>
                      <span className="t-meta block break-keep text-slate-500">{KIND_HINT[k]}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          {kind === 'blog' && (
            <fieldset className="flex flex-col gap-1.5" data-testid="content-blogtype">
              <legend className="t-sub mb-1 font-semibold text-slate-700">누가 쓰는 글인가요?</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['brand', 'review'] as BlogType[]).map((b) => (
                  <button key={b} type="button" aria-pressed={blogType === b} onClick={() => setBlogType(b)} data-testid="content-blogtype-btn" data-value={b} className={`tap flex min-h-[3.75rem] flex-col items-start justify-center rounded-(--radius-control) border px-3 py-2 text-left ${pickBox(blogType === b)}`}>
                    <span className={`t-body font-semibold break-keep ${blogType === b ? 'text-violet-900' : 'text-slate-800'}`}>{BLOG_TYPE_LABEL[b]}</span>
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
                  <button key={w} type="button" onClick={() => setKeyword(w)} className={`tap t-sub min-h-9 rounded-full border px-3 ${keyword === w ? 'border-sky-500 bg-sky-50 font-semibold text-sky-800' : 'border-slate-200 text-slate-600 hover:border-sky-300'}`}>
                    {w}
                  </button>
                ))}
              </div>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="t-sub mb-1 font-semibold text-slate-700">주제</legend>
                {topics.map((t) => (
                  <label key={t.type} className={`tap flex cursor-pointer items-start gap-2 rounded-(--radius-control) border px-3 py-2 ${pickBox(topicType === t.type)}`} data-testid="content-topic" data-type={t.type}>
                    <input type="radio" name="topic" className="mt-1.5 size-4 accent-violet-600" checked={topicType === t.type} onChange={() => setTopicType(t.type)} />
                    <span className="min-w-0">
                      <span className="t-meta font-semibold text-violet-700">{TOPIC_LABEL[t.type]}</span>
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
                  <button key={a} type="button" aria-pressed={adType === a} onClick={() => setAdType(a)} data-testid="content-adtype-btn" data-value={a} className={`tap flex min-h-12 flex-col items-start justify-center rounded-(--radius-control) border px-3 py-1.5 text-left ${adType === a ? TONE.fuchsia.on : `border-slate-200 bg-white ${TONE.fuchsia.hover}`}`}>
                    <span className={`t-sub font-semibold break-keep ${adType === a ? 'text-fuchsia-900' : 'text-slate-800'}`}>{AD_TYPE_LABEL[a]}</span>
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
              <button key={t} type="button" aria-pressed={profile.tone === t} onClick={() => (profile.tone === t ? undefined : guard(() => void store.saveOverrides({ ...store.overrides, tone: t })))} className={chip(profile.tone === t)} data-testid="content-tone" data-tone={t}>
                {TONE_LABEL[t]}
              </button>
            ))}
          </div>
          <button type="button" className={MK_PRIMARY.violet} onClick={() => guard(() => generate())} data-testid="content-make">
            <Sparkles className="size-5" aria-hidden="true" />
            {kind === 'blog' && blogType === 'review' ? '체험단 가이드 만들기' : `${KIND_LABEL[kind]} 만들기`}
          </button>
          <p className="t-meta break-keep text-slate-500">업체 기록과 업종 견본으로 채워요(규칙 · 'AI' 아님). 업체마다 다른 곳은 [대괄호] 로 비워 둬요.</p>
        </section>
        )}

        {/* 결과 — D-227 고른 길 아래 한 자리(② 글 다듬기 · ③ 저장 · 올리기) */}
        <div ref={resultRef}>
          {shown ? (
            <section className={`${card} flex flex-col gap-3 overflow-hidden p-4 sm:p-5`} data-testid="content-result" data-kind={shown.draft.kind}>
              {pack && (
                <div className="flex flex-col gap-2 rounded-(--radius-control) border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-3" data-testid="content-pack" data-key={pack.key}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="t-sub flex min-w-0 items-center gap-2 font-semibold break-keep text-violet-900">
                      <MkIcon icon={SITUATION_STYLE[pack.key]?.icon ?? Layers} tone={SITUATION_STYLE[pack.key]?.tone ?? 'violet'} size="sm" />
                      <span className="min-w-0">
                        {pack.label} · 글 {pack.items.length}편 묶음
                      </span>
                    </p>
                    <button type="button" className={MK_PRIMARY.violet} onClick={() => void packSaveAll()} disabled={busy || pack.saved.every(Boolean)} data-testid="content-pack-save-all">
                      <Save className="size-4" aria-hidden="true" />
                      {pack.saved.every(Boolean) ? '묶음 모두 저장됨' : `${pack.items.length}편 모두 보관함에 저장`}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="묶음 글">
                    {pack.items.map((x, i) => {
                      const tt = tabTone(x.tab)
                      return (
                        <button key={x.tab} type="button" role="tab" aria-selected={i === pack.at} onClick={() => packGo(i)} className={`tap t-sub flex min-h-11 items-center gap-1.5 rounded-full border px-4 font-semibold ${i === pack.at ? `${TONE[tt].solid} border-transparent shadow-sm` : `bg-white text-slate-700 ${TONE[tt].line} ${TONE[tt].hover}`}`} data-testid="content-pack-tab" data-saved={pack.saved[i] ? '1' : '0'}>
                          <span className={`tabular-nums ${i === pack.at ? 'opacity-90' : 'text-slate-500'}`}>{i + 1}</span>
                          {x.tab}
                          {pack.saved[i] && <Check className={`size-4 ${i === pack.at ? '' : 'text-success-600'}`} aria-label="저장됨" />}
                        </button>
                      )
                    })}
                  </div>
                  {pack.fill.length > 0 && (
                    <p className="t-meta break-keep text-slate-700" data-testid="content-pack-fill">
                      <b className="font-semibold text-slate-800">업체에 물어 채울 것</b> — {pack.fill.join(' · ')}. 글 안의 [대괄호] 자리예요.
                    </p>
                  )}
                </div>
              )}
              {/* D-226 글 종류 색 띠 — 무슨 글인지 한눈에 */}
              {!pack && (
                <div className={`-mx-4 -mt-4 flex min-w-0 items-center gap-2.5 border-b px-4 py-2.5 sm:-mx-5 sm:-mt-5 sm:px-5 ${TONE[KIND_STYLE[shown.draft.kind].tone].soft} ${TONE[KIND_STYLE[shown.draft.kind].tone].line}`} data-testid="content-result-band">
                  <MkIcon icon={KIND_STYLE[shown.draft.kind].icon} tone={KIND_STYLE[shown.draft.kind].tone} size="sm" />
                  <span className={`t-sub shrink-0 font-bold ${TONE[KIND_STYLE[shown.draft.kind].tone].deep}`}>{KIND_LABEL[shown.draft.kind]}</span>
                  <span className="t-meta min-w-0 break-keep text-slate-600">{KIND_HINT[shown.draft.kind]}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {pack && <MkTag tone={KIND_STYLE[shown.draft.kind].tone}>{KIND_LABEL[shown.draft.kind]}</MkTag>}
                {shown.item && <Badge tone="success">보관함 · {shown.item.version}판</Badge>}
                {dirty && (
                  <span data-testid="content-unsaved">
                    <Badge tone="warning">고친 내용 · 저장 전</Badge>
                  </span>
                )}
                {shown.item?.postedAt && <Badge tone="success">올림 · {localDateOf(shown.item.postedAt).slice(5).replace('-', '/')}</Badge>}
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

              {fillNames.length > 0 && <FillBox key={`fill-${pack ? `pack-${pack.key}` : (shown.item?.rootId ?? shown.draft.title)}`} names={fillNames} scope={pack ? `저장 전 글 ${1 + pack.items.filter((_, j) => j !== pack.at && !pack.saved[j]).length}편` : '이 글'} onApply={applyFill} />}

              <div className="flex flex-wrap gap-2">
                <button type="button" className={MK_PRIMARY.violet} onClick={() => void copy(text)} data-testid="content-copy">
                  <Copy className="size-4" aria-hidden="true" />
                  전체 복사
                </button>
                {!shown.item && !pack && (
                  <Button
                    size="sm"
                    onClick={() =>
                      guard(() => {
                        const v = variant + 1
                        setVariant(v)
                        const tt = shown.draft.input.topicType ?? topicType
                        const ts = topicsFor(profile, shown.draft.input.keyword ?? keyword, today, v)
                        // D-221 계획 칸에서 연 글이면 '다른 안' 도 같은 칸(올릴 날)으로 — 예전에는 날짜가 빠져 칸이 '안 만듦' 으로 남았다
                        show(keepPlan(makeDraft(profile, { kind: shown.draft.kind, keyword: shown.draft.input.keyword ?? keyword, topic: ts.find((x) => x.type === tt) ?? ts[0], pages: shown.draft.input.pages, purpose: shown.draft.input.purpose, variant: v, blogType: shown.draft.input.blogType, shortLen: shown.draft.input.shortLen, adType: shown.draft.input.adType }, today), shown.draft.input))
                      })
                    }
                    data-testid="content-again"
                  >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    다른 안
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    if (editOpen) return setEditOpen(false)
                    setEditing((e) => e ?? shown.draft.blocks.map((b) => ({ ...b })))
                    setEditOpen(true)
                  }}
                  data-testid="content-edit"
                  aria-pressed={editOpen}
                >
                  <PencilLine className="size-4" aria-hidden="true" />
                  {editOpen ? '고치기 그만' : '고치기'}
                </Button>
                <Button size="sm" onClick={() => void save()} disabled={busy || (!!shown.item && !dirty)} data-testid="content-save">
                  <Save className="size-4" aria-hidden="true" />
                  {shown.item ? (dirty ? '고친 판으로 저장' : '저장됨') : '보관함에 저장'}
                </Button>
                {shown.item && (
                  <Button size="sm" onClick={() => void togglePosted(shown.item as ContentItem)} aria-pressed={!!shown.item.postedAt} data-testid="content-posted">
                    {shown.item.postedAt ? <CheckCircle2 className="size-4 text-success-600" aria-hidden="true" /> : <Circle className="size-4" aria-hidden="true" />}
                    {shown.item.postedAt ? '올렸어요 · 되돌리기' : '올렸어요 표시'}
                  </Button>
                )}
                {/* D-220: 가상 업체 · 컨설턴트는 AI 작업실(업체마다)에 아직 없다 — 임시등록한 뒤에 */}
                {ownerAi === 'yes' && !isTrialId(record.id) && (
                  <Button size="sm" variant="ghost" onClick={() => void toAi()} disabled={busy} data-testid="content-to-ai">
                    <Sparkles className="size-4 text-violet-600" aria-hidden="true" />
                    AI 작업실에서 다듬기
                  </Button>
                )}
              </div>

              <ol className="flex flex-col gap-2" data-testid="content-blocks">
                {blocks.map((b, i) => (
                  <li key={i} className={`rounded-(--radius-control) border border-l-4 border-slate-200 bg-white p-3 ${KIND_ACCENT[shown.draft.kind]}`} data-testid="content-block">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        {(b.label || b.hint) && (
                          <p className="flex flex-wrap items-baseline gap-x-2">
                            {b.label && <span className={`t-body font-semibold break-keep ${TONE[KIND_STYLE[shown.draft.kind].tone].deep}`}>{b.label}</span>}
                            {b.hint && <span className="t-meta break-keep text-slate-500">{b.hint}</span>}
                          </p>
                        )}
                        {editOpen && editing ? (
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
                                  setMode('direct')
                                  showToast(`키워드를 "${w}" 로 바꿨어요 — 위 [직접 고르기] 에서 주제를 골라 [블로그 글 만들기] 를 눌러 주세요.`)
                                }}
                                className="tap t-sub min-h-9 rounded-full border border-sky-200 bg-sky-50 px-3 text-sky-900 hover:border-sky-500"
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
                      {!editOpen && (
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
                  onPick={(w) =>
                    guard(() => {
                      setKeyword(w)
                      setKind('blog')
                      setBlogType('brand')
                      generate({ kind: 'blog', keyword: w, variant: 0 })
                      setMode('direct')
                      showToast(`"${w}" 로 블로그 글을 만들었어요 — 다른 주제는 위 [직접 고르기] 에서 고를 수 있어요.`)
                    })
                  }
                />
              )}

              {NEEDS_TOPIC.has(shown.draft.kind) && shown.draft.input.topicType && (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3" data-testid="content-chain">
                  <span className="t-sub font-semibold text-slate-700">같은 주제로</span>
                  {(['blog', 'shorts', 'cards', 'video'] as ContentKind[])
                    .filter((k) => k !== shown.draft.kind)
                    .map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={`tap t-sub inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 font-semibold ${TONE[KIND_STYLE[k].tone].line} ${TONE[KIND_STYLE[k].tone].soft} ${TONE[KIND_STYLE[k].tone].deep} ${TONE[KIND_STYLE[k].tone].hover}`}
                        onClick={() =>
                          guard(() => {
                            setKind(k)
                            setTopicType(shown.draft.input.topicType as TopicType)
                            setKeyword(shown.draft.input.keyword ?? keyword)
                            show(makeDraft(profile, { kind: k, keyword: shown.draft.input.keyword, topic: topicsFor(profile, shown.draft.input.keyword ?? keyword, today, shown.draft.input.variant).find((t) => t.type === shown.draft.input.topicType), pages, variant: shown.draft.input.variant, shortLen, adType }, today))
                          })
                        }
                        data-testid="content-chain-kind"
                        data-kind={k}
                      >
                        <KindGlyph kind={k} />
                        {KIND_LABEL[k]}
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </button>
                    ))}
                </div>
              )}

              {/* D-220: 가상 업체 · 컨설턴트는 붙일 업체 기록이 없다 — 임시등록하면 붙일 수 있다 */}
              {!isTrialId(record.id) && (
              <ToolResultAttach
                key={shown.item?.rootId ?? `${shown.draft.kind}-${shown.draft.title}`}
                toolKey="content"
                title={`홍보 글 · ${KIND_LABEL[shown.draft.kind]}`}
                verdict={checks.some((c) => c.level === 'must') ? 'check' : 'ready'}
                verdictLabel={checks.some((c) => c.level === 'must') ? '[대괄호] 채우기' : '내보낼 수 있음'}
                summary={`${KIND_LABEL[shown.draft.kind]} — ${shown.draft.title}`}
                data={{ kind: shown.draft.kind, title: shown.draft.title, chars: text.length }}
                followUp={{ text: `홍보 글(${KIND_LABEL[shown.draft.kind]}) 업체 확인 · 올리기`, days: 3 }}
                presetClientId={record.id}
              />
              )}
            </section>
          ) : (
            <section className="flex flex-col items-center gap-3 rounded-(--radius-panel) border-2 border-dashed border-violet-200 bg-gradient-to-br from-violet-50/70 via-white to-fuchsia-50/70 p-6 text-center" data-testid="content-empty">
              <span aria-hidden="true" className="flex -space-x-2">
                {(['blog', 'shorts', 'cards', 'kakao'] as ContentKind[]).map((k) => (
                  <span key={k} className="rounded-xl ring-4 ring-white">
                    <MkIcon icon={KIND_STYLE[k].icon} tone={KIND_STYLE[k].tone} size="lg" />
                  </span>
                ))}
              </span>
              <h2 className="t-section text-slate-900">여기에 글이 나와요</h2>
              <p className="t-sub max-w-md break-keep text-slate-600">
                {mode === 'pick' ? "위의 추천 글 하나를 누르면 여기에 바로 나와요." : mode === 'situation' ? '위에서 지금 있는 일 하나를 누르면 카톡 · 블로그 · 카드뉴스가 한 묶음으로 여기에 나와요.' : mode === 'plan' ? '위 한 달 계획에서 칸 하나를 누르면 그 글이 여기에 나와요.' : '형식을 고르고 [만들기] 를 눌러 주세요.'}
              </p>
            </section>
          )}
        </div>
      </div>

      <ArchiveCard
        store={store}
        onOpen={openItem}
        onPosted={(it) => void togglePosted(it)}
        onRemoved={(rootId) => {
          // D-208 고침: 화면에 띄운 글을 지우면 결과 칸도 비운다(지운 글을 '올렸어요' · '고친 판' 으로 되살리지 않게)
          if (shown?.item?.rootId === rootId) {
            setShown(null)
            setEditing(null)
          }
          setPack((pk) => (pk ? { ...pk, saved: pk.saved.map((x) => (x?.rootId === rootId ? null : x)) } : pk))
        }}
        openId={shown?.item?.rootId ?? null}
      />

      <ConfirmModal
        open={!!leaveAsk}
        title="저장하지 않은 고침이 있어요"
        message={packTouched && !dirty ? '묶음에서 채우거나 고친 글이 아직 보관함에 없어요. 넘어가면 그 내용이 사라져요.' : '고친 내용이 아직 저장되지 않았어요. 넘어가면 고친 내용이 사라져요.'}
        confirmLabel="고침 버리고 넘어가기"
        cancelLabel="계속 고치기"
        danger
        onCancel={() => setLeaveAsk(null)}
        onConfirm={() => {
          const run = leaveAsk?.run
          setLeaveAsk(null)
          setEditing(null)
          if (pack) setPack((pk) => (pk ? { ...pk, touched: pk.touched.map(() => false) } : pk))
          run?.()
        }}
      />
      <ConfirmModal
        open={leaveRoute.state === 'blocked'}
        title="저장하지 않은 고침이 있어요"
        message="이 화면을 나가면 보관함에 저장하지 않은 고친 내용이 사라져요. 나갈까요?"
        confirmLabel="저장하지 않고 나가기"
        cancelLabel="계속 고치기"
        danger
        onConfirm={() => leaveRoute.proceed?.()}
        onCancel={() => leaveRoute.reset?.()}
      />

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

function ProfileCard({ record, profile, source, saved, posted, onEdit }: { record: ClientOpsRecord; profile: ReturnType<typeof buildProfile>['profile']; source: ReturnType<typeof buildProfile>['source']; saved: number; posted: number; onEdit: () => void }) {
  const ind = INDUSTRIES.find((i) => i.key === profile.industry)
  const rows: { label: string; value: string; from?: string; missing?: boolean; icon: LucideIcon; tone: MkTone }[] = [
    { label: '업종', value: ind?.label ?? '기타', icon: Factory, tone: 'indigo' },
    { label: '대표 상품 · 서비스', value: profile.item, from: source.item === 'industry' ? '업종 말 — 고쳐 주세요' : source.item === 'override' ? '직접 적음' : '업체 기록', missing: source.item === 'industry', icon: Package, tone: 'violet' },
    { label: '하는 일', value: profile.services.join(' · '), from: source.services === 'site' ? '홈페이지' : source.services === 'override' ? '직접 적음' : source.services === 'record' ? '업체 기록' : '', missing: !profile.services.length, icon: ListChecks, tone: 'sky' },
    { label: '지역', value: profile.region || profile.area, missing: !profile.area, icon: MapPin, tone: 'rose' },
    { label: '대표 전화', value: profile.phone, missing: !profile.phone, icon: Phone, tone: 'emerald' },
    { label: '강점(사실)', value: profile.strengths.join(' · '), icon: Award, tone: 'orange' },
    { label: '차별점', value: profile.differ, missing: !profile.differ, icon: Gem, tone: 'fuchsia' },
  ]
  const missing = rows.filter((r) => r.missing).length
  const gaps = profileGaps(profile)
  // D-227 칸 7개는 접어 둔다 — 머리 띠(숫자) · 채울 칸 안내만 늘 보이게. 펼침은 이 기기에 기억
  const [open, setOpen] = useFold('content.profile', false)
  return (
    <section className={`${card} flex flex-col overflow-hidden`} data-testid="content-profile">
      {/* D-226 머리 띠 — 누구 홍보 정보인지 · 보관함 · 올림 · 채운 칸이 한눈에 */}
      <MkHero
        tone="violet"
        icon={Megaphone}
        eyebrow="홍보 정보 · 모든 글이 이 정보로"
        title={record.companyName}
        sub={`업체 기록에서 저절로 채웠어요. 모든 글이 이 정보를 같이 써요.${missing ? ` 빈 칸 ${missing}개를 채우면 글이 더 정확해져요.` : ''}`}
        stats={[
          { label: '보관함', value: `${saved}편`, testId: 'content-stat-saved' },
          { label: '올림', value: `${posted}편`, testId: 'content-stat-posted' },
          { label: '채운 칸', value: `${rows.length - missing}/${rows.length}`, testId: 'content-stat-filled' },
        ]}
        actions={
          <>
            <Link to={`/tools/homepage/build?${subjectQuery(record.id)}`} className={HERO_BTN} data-testid="content-to-site">
              <Globe className="size-4 text-emerald-700" aria-hidden="true" />
              이 업체 홈페이지
            </Link>
            <button type="button" onClick={onEdit} className={HERO_BTN} data-testid="content-profile-edit">
              <PencilLine className="size-4 text-violet-700" aria-hidden="true" />
              고치기
            </button>
          </>
        }
      />
      <div className="flex flex-col gap-3 p-4 sm:p-5">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="tap -my-1 flex min-h-11 w-full min-w-0 items-center gap-2 rounded-(--radius-control) text-left hover:bg-slate-50" data-testid="content-profile-toggle">
        <ChevronRight aria-hidden="true" className={`size-5 shrink-0 text-violet-500 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        <span className="t-sub min-w-0 flex-1 font-semibold break-keep text-slate-800">{open ? '홍보 정보 접기' : `홍보 정보 ${rows.length}칸 보기`}</span>
        <span className={`t-meta shrink-0 rounded-full px-2 py-0.5 font-semibold ${missing ? 'bg-amber-100 text-amber-900' : 'bg-violet-50 text-violet-800'}`}>{missing ? `빈 칸 ${missing}` : '다 채움'}</span>
      </button>
      {open && (
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className={`flex min-w-0 items-start gap-2.5 rounded-(--radius-control) border p-2.5 ${r.missing ? 'border-dashed border-amber-300 bg-amber-50/70' : 'border-slate-200 bg-white'}`} data-testid="content-profile-row" data-missing={r.missing ? '1' : '0'}>
            <MkIcon icon={r.icon} tone={r.missing ? 'amber' : r.tone} size="sm" />
            <div className="min-w-0 flex-1">
              <dt className="t-meta flex flex-wrap items-center gap-1.5 text-slate-500">
                <span className="font-semibold text-slate-600">{r.label}</span>
                {r.from && <span className="text-slate-500">· {r.from}</span>}
              </dt>
              <dd className={`t-body break-words ${r.missing ? 'font-semibold text-amber-800' : 'text-slate-900'}`}>{r.value || (r.missing ? '비어 있어요' : '—')}</dd>
            </div>
          </div>
        ))}
      </dl>
      )}
      {gaps.length > 0 && (
        <button type="button" onClick={onEdit} className="tap flex w-full min-w-0 items-start gap-2.5 rounded-(--radius-control) border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2.5 text-left hover:border-amber-500" data-testid="content-profile-gaps">
          <MkIcon icon={Sparkles} tone="amber" size="sm" />
          <span className="min-w-0 flex-1">
            <span className="t-sub block font-bold break-keep text-amber-900">이 칸만 채우면 글이 훨씬 좋아져요 · {gaps.length}개</span>
            <span className="mt-1 flex flex-col gap-0.5">
              {gaps.slice(0, 3).map((g) => (
                <span key={g.key} className="t-meta block break-keep text-slate-700" data-testid="content-profile-gap" data-key={g.key}>
                  <b className="font-semibold text-slate-800">{g.label}</b> — {g.why}
                </span>
              ))}
            </span>
          </span>
          <ChevronRight className="mt-1 size-5 shrink-0 text-amber-700" aria-hidden="true" />
        </button>
      )}
      </div>
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

function PlanCard({ record, profile, today, store, onPick, onOpen, startOpen = false }: { record: ClientOpsRecord; profile: ReturnType<typeof buildProfile>['profile']; today: string; store: ContentStore; onPick: (slot: PlanSlot) => void; onOpen: (it: ContentItem) => void; startOpen?: boolean }) {
  const { showToast } = useToast()
  // D-227 '한 달 계획' 을 골라 들어오면 바로 펼친 채로(누른 뒤 또 누르지 않게)
  const [open, setOpen] = useState(startOpen)
  const [perWeek, setPerWeek] = useState<2 | 4>(2)
  const [fresh, setFresh] = useState(false)
  const [busy, setBusy] = useState(false)
  // 진행 중인 계획(보관함 글의 올릴 날)이 있으면 그 칸을 그대로 — 날이 지나도 같은 칸
  const running = useMemo(() => (fresh ? null : activePlan(store.items, today)), [fresh, store.items, today])
  const slots = useMemo(() => (running ? monthPlanFrom(profile, running.monday, running.perWeek, today) : monthPlan(profile, today, perWeek)), [running, profile, today, perWeek])
  const states = useMemo(() => planSlotStates(slots, store.items), [slots, store.items])
  const made = states.filter((x) => x.item).length
  const posted = states.filter((x) => x.posted).length
  // D-209 접어 둬도 다음에 올릴 글 하나는 보이게 · 지난 날인데 안 올린 글 수
  const nextAt = running ? slots.findIndex((sl, i) => !states[i].posted && sl.date >= today) : -1
  const late = running ? slots.filter((sl, i) => !states[i].posted && sl.date < today).length : 0
  const deadlines = slots.map((sl) => ({ date: sl.date, title: `홍보 글 올리기 · ${KIND_LABEL[sl.kind]}`, note: sl.title }))

  const makeAll = async () => {
    if (busy) return
    setBusy(true)
    try {
      const todo = slots.filter((_, i) => !states[i].item)
      const r = await store.addMany(planDrafts(profile, todo, today, (d) => !!sameContent(store.items, d.kind, d.blocks)))
      setFresh(false)
      showToast(r.failed ? `${r.failed}편을 만들지 못했어요 — 다시 눌러 주세요.` : `한 달 치 ${todo.length}편을 보관함에 넣었어요${r.dup ? `(이미 있던 글 ${r.dup}편에 날짜를 달았어요)` : ''}. 아래 [업체 일정에 올릴 날 걸기] 를 누르면 달력에도 올라가요.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`${card} flex flex-col gap-3 p-4 sm:p-5`} data-testid="content-plan">
      <button type="button" className="tap flex w-full min-w-0 items-center gap-2.5 text-left" aria-expanded={open} onClick={() => setOpen((v) => !v)} data-testid="content-plan-toggle">
        <MkIcon icon={CalendarDays} tone="sky" />
        <span className="min-w-0 flex-1">
          <span className="t-section flex flex-wrap items-center gap-x-2 break-keep text-slate-900">
            한 달 올릴 계획
            {running && (
              <span className="t-meta rounded-full bg-success-50 px-2 py-0.5 font-semibold text-success-700" data-testid="content-plan-progress">
                올림 {posted}/{slots.length}
              </span>
            )}
          </span>
          <span className="t-sub block break-keep text-slate-600">{running ? `진행 중 · ${shortDate(slots[0].date)} ~ ${shortDate(slots[slots.length - 1].date)} · 만듦 ${made}/${slots.length}` : '다음 주 월요일부터 4주 — 무엇을 언제 올릴지 정하고, 한 번에 만들어 달력에 올려요.'}</span>
        </span>
        <ChevronDown className={`size-5 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {!open && running && (nextAt >= 0 || late > 0) && (
        <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3" data-testid="content-plan-next">
          {nextAt >= 0 && (
            <button type="button" onClick={() => (states[nextAt].item ? onOpen(states[nextAt].item as ContentItem) : onPick(slots[nextAt]))} className="tap flex w-full min-w-0 items-center gap-2.5 rounded-(--radius-control) border border-sky-200 bg-sky-50 px-3 py-2 text-left hover:border-sky-400" data-testid="content-plan-next-open">
              <MkIcon icon={KIND_STYLE[slots[nextAt].kind].icon} tone={KIND_STYLE[slots[nextAt].kind].tone} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="t-meta block font-semibold text-sky-800">
                  {slots[nextAt].date === today ? '오늘 올릴 글' : '다음에 올릴 글'} · {shortDate(slots[nextAt].date)} · {KIND_LABEL[slots[nextAt].kind]}
                  {states[nextAt].item ? ' · 만듦' : ''}
                </span>
                <span className="t-sub block break-keep text-slate-800">{slots[nextAt].title}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-sky-700" aria-hidden="true" />
            </button>
          )}
          {late > 0 && (
            <p className="t-meta break-keep text-warning-700" data-testid="content-plan-late">
              올릴 날이 지났는데 아직 안 올린 글 {late}편 — 펼쳐서 확인해 주세요.
            </p>
          )}
        </div>
      )}
      {open && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {running ? (
              <>
                <span className="t-sub font-semibold text-slate-700">주 {running.perWeek}회 계획</span>
                <button type="button" className="tap t-sub min-h-11 px-2 font-semibold text-violet-700 underline-offset-2 hover:underline" onClick={() => setFresh(true)} data-testid="content-plan-new">
                  새 계획 짜기
                </button>
              </>
            ) : (
              <>
                <span className="t-sub font-semibold text-slate-700">얼마나 자주</span>
                {([2, 4] as const).map((n) => (
                  <button key={n} type="button" aria-pressed={perWeek === n} onClick={() => setPerWeek(n)} className={chip(perWeek === n)} data-testid="content-plan-per" data-value={n}>
                    주 {n}회
                  </button>
                ))}
              </>
            )}
            <span className="t-meta text-slate-500">· {slots.length}개</span>
          </div>
          <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {slots.map((sl, i) => {
              const st = states[i]
              return (
                <li key={`${sl.date}-${i}`} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => (st.item ? onOpen(st.item) : onPick(sl))}
                    className={`tap flex w-full min-w-0 flex-col items-start gap-0.5 rounded-(--radius-control) border border-l-4 px-3 py-2 text-left ${KIND_ACCENT[sl.kind]} ${TONE[KIND_STYLE[sl.kind].tone].hover} ${st.posted ? 'border-success-200 bg-success-50/60' : st.item ? 'border-violet-200 bg-white' : 'border-slate-200 bg-white'}`}
                    data-testid="content-plan-slot"
                    data-kind={sl.kind}
                    data-state={st.posted ? 'posted' : st.item ? 'made' : 'none'}
                  >
                    <span className="t-meta flex w-full min-w-0 flex-wrap items-center gap-x-1.5 text-slate-500">
                      <span className="tabular-nums">{shortDate(sl.date)}</span>
                      <span className={`inline-flex items-center gap-1 font-semibold ${TONE[KIND_STYLE[sl.kind].tone].text}`}>
                        <KindGlyph kind={sl.kind} className="size-3.5" />
                        {KIND_LABEL[sl.kind]}
                      </span>
                      {st.posted ? (
                        <span className="ml-auto flex items-center gap-0.5 font-semibold text-success-700">
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          올림
                        </span>
                      ) : st.item ? (
                        <span className="ml-auto font-semibold text-violet-700">만듦</span>
                      ) : null}
                    </span>
                    <span className="t-sub block w-full break-keep text-slate-800">{sl.title}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={MK_PRIMARY.violet} onClick={() => void makeAll()} disabled={busy || made === slots.length} data-testid="content-plan-make-all">
              <Wand2 className="size-4" aria-hidden="true" />
              {made === slots.length ? `${slots.length}편 모두 만들었어요` : made ? `남은 ${slots.length - made}편 한 번에 만들기` : `한 달 치 ${slots.length}편 한 번에 만들기`}
            </button>
            <span className="t-meta break-keep text-slate-500">보관함에 날짜를 달아 넣어요 · 같은 글은 두 번 넣지 않아요.</span>
          </div>
          {made > 0 && isTrialId(record.id) && (
            <p className="t-meta break-keep border-t border-slate-100 pt-3 text-slate-500" data-testid="content-plan-attach-trial">
              임시등록하면 업체 일정에 올릴 날을 걸 수 있어요(일정 달력 · 오늘 화면에 떠요).
            </p>
          )}
          {made > 0 && !isTrialId(record.id) && (
            <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3" data-testid="content-plan-attach">
              <p className="t-sub font-semibold text-slate-800">업체 일정에 올릴 날 걸기</p>
              <p className="t-meta break-keep text-slate-500 [overflow-wrap:anywhere]">누르면 {record.companyName} 기록에 계획이 붙고, 올릴 날 {slots.length}개가 일정 달력 · 오늘 화면에 떠요. 다시 걸면 날짜만 새로 바뀌어요.</p>
              <ToolResultAttach
                toolKey="content"
                title="홍보 글 한 달 계획"
                verdict="ready"
                verdictLabel={`주 ${running?.perWeek ?? perWeek}회 · ${slots.length}편`}
                summary={`홍보 글 한 달 계획 — ${shortDate(slots[0].date)} ~ ${shortDate(slots[slots.length - 1].date)} · ${slots.length}편`}
                data={{ perWeek: running?.perWeek ?? perWeek, slots: slots.map((sl) => ({ date: sl.date, kind: sl.kind, title: sl.title })) }}
                deadlines={deadlines}
                followUp={{ text: '홍보 글 첫 편 올렸는지 확인', days: 7 }}
                presetClientId={record.id}
              />
            </div>
          )}
        </>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 상황 예시                                                             */
/* ------------------------------------------------------------------ */

function SituationCard({ profile, today, holidays, openKey, onPick }: { profile: ReturnType<typeof buildProfile>['profile']; today: string; holidays: { date: string; name: string }[]; openKey: SituationKey | null; onPick: (key: SituationKey) => void }) {
  const [more, setMore] = useState(false)
  // 지금 때인 상황을 앞으로
  const list = useMemo(() => {
    const all = situationsFor(profile, today, holidays)
    return [...all.filter((x) => x.now), ...all.filter((x) => !x.now)]
  }, [profile, today, holidays])
  return (
    <section className={`${card} flex flex-col gap-3 p-4 sm:p-5`} data-testid="content-situations">
      <MkHead icon={Layers} tone="fuchsia" title="이런 일이 있을 때" aside="하나 누르면 카톡 · 블로그 · 카드뉴스가 한 묶음으로 나와요" />
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((sit, i) => {
          const ss = SITUATION_STYLE[sit.key] ?? { icon: Layers, tone: 'violet' as MkTone }
          const on = openKey === sit.key
          return (
            <li key={sit.key} className={i >= 6 && !more ? 'hidden sm:block' : ''}>
              <button
                type="button"
                onClick={() => onPick(sit.key)}
                aria-pressed={on}
                className={`tap flex h-full w-full min-w-0 flex-col items-start gap-1.5 rounded-(--radius-control) border p-3 text-left transition-shadow hover:shadow-sm ${on ? TONE[ss.tone].on : sit.now ? 'border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-fuchsia-50 hover:border-violet-500' : `border-slate-200 bg-white ${TONE[ss.tone].hover}`}`}
                data-testid="content-situation"
                data-key={sit.key}
              >
                {sit.now && (
                  <span className="t-meta flex w-full items-start gap-1 rounded-md bg-violet-600 px-2 py-1 font-semibold break-keep text-white" data-testid="content-situation-now">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">지금 때 · {sit.now}</span>
                  </span>
                )}
                {/* 휴대폰(두 칸)은 아이콘을 위 줄에 — 옆에 두면 이름이 세 줄로 짜부라진다 */}
                <span className="flex w-full min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                  <MkIcon icon={ss.icon} tone={ss.tone} size="sm" />
                  <span className="t-body w-full min-w-0 font-semibold break-keep text-slate-900 sm:w-auto sm:flex-1">{sit.label}</span>
                </span>
                <span className="t-meta hidden w-full break-keep text-slate-500 sm:block">{sit.hint}</span>
                <span className="mt-auto flex w-full flex-wrap gap-1">
                  {sit.tabs.map((t) => (
                    <MkTag key={t} tone={tabTone(t)}>
                      {t}
                    </MkTag>
                  ))}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {list.length > 6 && (
        <button type="button" className="tap t-sub min-h-11 rounded-(--radius-control) border border-slate-200 font-semibold text-slate-700 sm:hidden" onClick={() => setMore((v) => !v)} aria-expanded={more} data-testid="content-situation-more">
          {more ? '접기' : `상황 ${list.length - 6}개 더 보기`}
        </button>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* [대괄호] 한 번에 채우기 (D-209)                                          */
/* ------------------------------------------------------------------ */

function FillBox({ names, scope, onApply }: { names: string[]; scope: string; onApply: (vals: Record<string, string>, drop: string[]) => void }) {
  const [open, setOpen] = useState(false)
  // 같은 이름(— 앞)은 입력 하나로 — 적은 값은 묶인 [대괄호] 모두에
  const groups = useMemo(() => holeGroups(names), [names])
  const [vals, setVals] = useState<Record<string, string>>({})
  const [drop, setDrop] = useState<string[]>([])
  const ready = groups.some((g) => vals[g.label]?.trim() || drop.includes(g.label))
  const apply = () => {
    const out: Record<string, string> = {}
    const dropNames: string[] = []
    for (const g of groups) {
      if (drop.includes(g.label)) dropNames.push(...g.names)
      else for (const n of g.names) out[n] = vals[g.label] ?? ''
    }
    onApply(out, dropNames)
  }
  return (
    <div className="rounded-(--radius-control) border border-warning-200 bg-warning-50/60" data-testid="content-fill">
      <button type="button" className="tap flex min-h-11 w-full min-w-0 items-center gap-2 px-3 py-2 text-left" aria-expanded={open} onClick={() => setOpen((v) => !v)} data-testid="content-fill-toggle">
        <PencilLine className="size-4 shrink-0 text-warning-700" aria-hidden="true" />
        <span className="t-sub min-w-0 flex-1 font-semibold break-keep text-slate-800">
          빈 칸 {groups.length}가지 한 번에 채우기 <span className="font-normal text-slate-600">· 적으면 {scope}의 같은 [대괄호] 가 모두 바뀌어요</span>
        </span>
        <ChevronDown className={`size-5 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 border-t border-warning-200 px-3 pt-2.5 pb-3">
          {groups.map((g) => {
            const off = drop.includes(g.label)
            return (
              <div key={g.label} className="flex min-w-0 flex-col gap-1" data-testid="content-fill-row">
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="t-sub min-w-0 font-semibold break-keep text-slate-700 [overflow-wrap:anywhere]">{g.label}</span>
                  {g.hint && <span className="t-meta min-w-0 break-keep text-slate-500 [overflow-wrap:anywhere]">{g.hint}</span>}
                  <input className={inputClass} value={vals[g.label] ?? ''} disabled={off} maxLength={200} onChange={(e) => setVals((v) => ({ ...v, [g.label]: e.target.value }))} data-testid="content-fill-input" data-name={g.label} />
                </label>
                {g.optional && (
                  <label className="tap t-sub flex min-h-11 w-fit cursor-pointer items-center gap-2 text-slate-700">
                    <input type="checkbox" className="size-4 accent-violet-600" checked={off} onChange={(e) => setDrop((d) => (e.target.checked ? [...d, g.label] : d.filter((x) => x !== g.label)))} data-testid="content-fill-drop" />
                    없어요 — 이 줄 지우기
                  </label>
                )}
              </div>
            )
          })}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" disabled={!ready} onClick={apply} data-testid="content-fill-apply">
              <Check className="size-4" aria-hidden="true" />
              {scope}에 넣기
            </Button>
            <span className="t-meta break-keep text-slate-500">비운 칸은 [대괄호] 그대로 남아요.</span>
          </div>
        </div>
      )}
    </div>
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
        <ListOrdered className="size-4 text-sky-700" aria-hidden="true" />
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

function ArchiveCard({ store, onOpen, onPosted, onRemoved, openId }: { store: ContentStore; onOpen: (it: ContentItem) => void; onPosted: (it: ContentItem) => void; onRemoved: (rootId: string) => void; openId: string | null }) {
  const { showToast } = useToast()
  const [filter, setFilter] = useState<'all' | 'fav' | 'todo' | 'posted' | ContentKind>('all')
  const [del, setDel] = useState<{ rootId: string; title: string; versions: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const rows = useMemo(() => latestByRoot(store.items), [store.items])
  const shown = rows.filter((r) => (filter === 'all' ? true : filter === 'fav' ? r.item.favorite : filter === 'todo' ? !r.item.postedAt : filter === 'posted' ? !!r.item.postedAt : r.item.kind === filter))
  const postedN = rows.filter((r) => r.item.postedAt).length
  const kindsHere = CONTENT_KINDS.filter((k) => rows.some((r) => r.item.kind === k))
  // D-227 보관함은 접어 둔다(제목 줄에 편수 · 올림 수) — 지금 띄운 글이 보관함 글이면 펼친 채로
  const [open, setOpen] = useFold('content.archive', false)
  /** 지금 띄운 글인데도 사람이 접은 경우 — 그 글에서는 다시 펼치지 않는다 */
  const [shut, setShut] = useState<string | null>(null)
  const isOpen = open || (!!openId && openId !== shut && rows.some((r) => r.item.rootId === openId))
  const toggle = () => {
    if (isOpen) {
      setOpen(false)
      setShut(openId)
    } else {
      setOpen(true)
      setShut(null)
    }
  }
  return (
    <section className={`${card} flex flex-col ${isOpen ? 'gap-3' : ''} p-4 sm:p-5`} data-testid="content-archive" data-open={isOpen ? '1' : '0'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="t-section min-w-0 text-slate-900">
          <button type="button" onClick={toggle} aria-expanded={isOpen} className="tap flex min-h-11 min-w-0 items-center gap-2 text-left" data-testid="content-archive-toggle">
            <ChevronRight aria-hidden="true" className={`size-5 shrink-0 text-indigo-400 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`} />
            <MkIcon icon={Archive} tone="indigo" />
            보관함
          </button>
        </h2>
        <span className="t-sub rounded-full bg-indigo-50 px-3 py-0.5 font-semibold text-indigo-800" data-testid="content-archive-count">
          {rows.length}편{rows.length ? ` · 올림 ${postedN}` : ''}
        </span>
      </div>
      {!isOpen ? null : rows.length === 0 ? (
        <p className="t-sub break-keep text-slate-500">아직 저장한 글이 없어요. 글을 만들고 [보관함에 저장] 을 누르면 여기에 남아요.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'todo', 'posted', 'fav', ...kindsHere] as const).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`tap t-sub min-h-11 rounded-full border px-3 ${filter === f ? 'border-transparent bg-indigo-600 font-semibold text-white shadow-sm' : 'border-slate-200 text-slate-600 hover:border-indigo-300'}`} data-testid="content-archive-filter" data-value={f}>
                {f === 'all' ? '전체' : f === 'fav' ? '즐겨찾기' : f === 'todo' ? '아직 안 올림' : f === 'posted' ? '올린 글' : KIND_LABEL[f]}
              </button>
            ))}
          </div>
          <ul className="flex flex-col divide-y divide-slate-100">
            {shown.map(({ item, versions }) => (
              <li key={item.rootId} className={`flex items-center gap-2 py-1.5 ${openId === item.rootId ? 'bg-violet-50' : ''}`} data-testid="content-archive-item" data-kind={item.kind}>
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
                <span className="hidden sm:inline-flex">
                  <MkIcon icon={KIND_STYLE[item.kind].icon} tone={KIND_STYLE[item.kind].tone} size="sm" />
                </span>
                <button type="button" className="tap flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center text-left" onClick={() => onOpen(item)} data-testid="content-archive-open">
                  <span className="t-body line-clamp-2 w-full font-medium break-keep text-slate-800">{item.title}</span>
                  <span className="t-meta w-full break-keep text-slate-500">
                    <b className={`font-semibold ${TONE[KIND_STYLE[item.kind].tone].text}`}>{KIND_LABEL[item.kind]}</b>
                    {item.input.situation ? ` · ${SITUATION_SHORT[item.input.situation as SituationKey] ?? ''}` : ''}
                    {item.input.planDate ? ` · ${shortDate(item.input.planDate)} 올릴 글` : ` · ${localDateOf(item.createdAt)}`}
                    {versions > 1 ? ` · ${versions}판` : ''}
                  </span>
                </button>
                <button
                  type="button"
                  className={`tap t-meta flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-full px-1.5 font-semibold sm:px-2.5 ${item.postedAt ? 'text-success-700 hover:bg-success-50' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                  aria-pressed={!!item.postedAt}
                  aria-label={item.postedAt ? `${item.title} — 올렸어요(누르면 아직으로)` : `${item.title} — 올렸어요로 표시`}
                  title={item.postedAt ? '누르면 아직 안 올린 글로 바꿔요' : "업체가 올렸으면 눌러 '올림' 으로 표시해요"}
                  onClick={() => onPosted(item)}
                  data-testid="content-archive-posted"
                >
                  {item.postedAt ? <CheckCircle2 className="size-5 sm:size-4" aria-hidden="true" /> : <Circle className="size-5 sm:size-4" aria-hidden="true" />}
                  {/* 휴대폰은 동그라미만(제목 자리를 넓게) — 거르기 칩 '아직 안 올림 · 올린 글' 이 뜻을 알려 준다 */}
                  <span className="hidden sm:inline">{item.postedAt ? '올림' : '아직'}</span>
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
          if (ok) onRemoved(del.rootId)
          setBusy(false)
          setDel(null)
          showToast(ok ? '지웠어요.' : '지우지 못했어요. 다시 눌러 주세요.')
        }}
      />
    </section>
  )
}
