/**
 * 홍보 글 만들기 화면 (D-203) — 업체 하나로 블로그 · 짧은 영상 · 긴 영상 · 카드뉴스 · 카톡 · 플레이스 소개 · 키워드.
 *
 * 순서: 업체 홍보 정보(업체 기록에서 저절로 · 고치기) → 먼저 만들 것 3개(누르면 바로 글) → 직접 고르기(형식 · 키워드 · 주제)
 *      → 결과(복사 · 다른 안 · 고치기 · 보관함 · 업체 기록에 붙이기 · 대표는 AI 전략실로) → 보관함.
 * 규칙 + 업종 견본으로 채우며 'AI' 가 아니다. 업체마다 다른 내용은 [대괄호] 로 비워 두고 점검이 알린다.
 * D-207: 차별점 · 판매 채널 · 손님이 망설이는 점 칸, '이 칸만 채우면' 안내, 블로그 글 종류(우리 글 / 체험단 가이드), 주제 카드에 전략,
 *        쇼츠 길이 20~30 / 30~60초, 카드뉴스 광고 유형 5가지, 키워드 검색량 붙여넣기 정리, 한 달 올릴 계획(주 2회 / 주 4회).
 * D-208: '이런 일이 있을 때' 상황 12가지(누르면 카톡 · 블로그 · 카드뉴스 묶음 · 묶음 모두 저장), 한 달 치 한 번에 만들기 ·
 *        업체 일정에 올릴 날 걸기 · 계획 칸에 만듦/올림, 보관함 '올렸어요' 표시 · 거르기.
 * D-227: 대표 "한 페이지에 너무 많으면 역효과 · 길을 잃지 않게 · 토스처럼 다음 단계로" —
 *        길잡이 ① 고르기 → ② 다듬기 → ③ 저장 · 올리기, '무엇을 만들까요' 는 네 길(추천 · 상황 · 직접 · 한 달 계획) 중
 *        고른 하나만 펼친다. 홍보 정보 칸 · 보관함은 접어 둔다(펼침은 이 기기에 기억). 지운 기능은 없다.
 * D-228: 참고한 외부 방법 3차 관찰 — 홍보 정보에 '글 재료'(후기 · 고객 한마디 · 이번 달 혜택+끝나는 날 · 가격 · 말하는 사람),
 *        다른 AI 도구에 붙여 넣을 요청문 + 받은 글 점검(주지 않은 혜택 · 지어낸 출처 · 숫자 뜻 바뀜), 검색량 등급 · 월 100 이상만.
 * D-229: 콘텐츠 작성 규칙집(1~3차 합본) — 브리프 6칸 줄(업체 · 독자 · 알리는 것 · 화자 · 사실 목록 · 넣지 말 것) · 흔한 반박 ·
 *        배송 · 교환 조건 · 넣지 말 것 칸, 요청문은 고른 채널로(길이 · 지역 · 마지막 제안), 결과 아래 '발행 전 검수표', 카드 기본 7장.
 * D-230: 규칙집 남은 것 — 제목 각도 17개 중 후보 5개(검색 의도 다르게 · 이 키워드로 쓴 각도는 빼고), 카드뉴스 5안 한 번에(순서 고정),
 *        올린 글에 조회 · 저장 · 문의 숫자 적기 → 보관함 '무엇이 잘 됐나'(각도 · 카드 유형별).
 */
import { AiAssist } from '../../components/ai/AiAssist'
import { contentBundle } from '../../services/aiAssist/builders'
import { isMiraeSubject } from '../../services/marketingTrial'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFold } from '../../components/ui/fold'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Archive, Award, BarChart3, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, Circle, ClipboardCheck, Copy, Factory, Gem, Globe, Info, Layers, ListChecks, ListOrdered, MapPin, Megaphone, Package, PencilLine, Phone, RefreshCw, Save, Send, Sparkles, Star, Trash2, Wand2, type LucideIcon } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge, BottomSheet } from '../../components/ui/primitives'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { useToast } from '../../components/ui/toastContext'
import { useUnsavedChangesGuard } from '../../lib/useUnsavedChangesGuard'
import { localDateOf, todayLocalDate } from '../../lib/appClock'
import { useOwnerAiAccess } from '../../auth/ownerAiAccess'
import { usePageCrumbs } from '../../lib/crumbStore'
import {
  AD_TYPES,
  AD_TYPE_HINT,
  ANGLE_LABEL,
  CARD_FIVE,
  MATERIAL_GOAL,
  angleVideoTitle,
  applyTone,
  cardFive,
  cardFiveTypes,
  riskyAdTypes,
  materialList,
  performanceBy,
  titleCandidates,
  usedAngles,
  type AngleId,
  type ContentStats,
  type TitleCandidate,
  AI_REQUEST_TIPS,
  VOLUME_TIER_LABEL,
  aiRequestText,
  briefSlots,
  reviewChecklist,
  type ReviewItem,
  offerLine,
  volumeTier,
  AD_TYPE_LABEL,
  BLOG_TYPE_HINT,
  BLOG_TYPE_LABEL,
  SHORT_LEN_LABEL,
  activePlan,
  keepPlan,
  monthPlan,
  monthPlanFrom,
  parseKeywordVolumes,
  planCopyText,
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
  type ContentProfile,
  type Draft,
  type DraftBlock,
  type DraftCheck,
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
  type VolumeTier,
  regulatedOf,
} from '../../services/contentStudio'
import { INDUSTRIES, type IndustryKey } from '../../services/siteBuilder'
import { KR_PUBLIC_HOLIDAYS } from '../../services/daysOff'
import type { ClientOpsRecord } from '../../types/clientOps'
import { copyToClipboard, useOwnerAiIdentity, useOwnerAiRepo } from '../../pages/ownerAi/shared'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import { useToolClient } from '../shared/toolClientContext'
import { listClients, saveClient } from '../../services/clientOpsService'
import { withToolDeadlineDone } from '../../services/toolResultGroups'
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
  /** D-230 'cards5' = 카드뉴스 5안 한 번에 */
  key: SituationKey | 'cards5'
  label: string
  fill: string[]
  /** 묶음 위에 한 줄 안내(카드 5안 — 글 재료 수) */
  note?: string
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

/** D-230 카드 5안 묶음 — 글 재료가 7개보다 적으면 5안이 서로 비슷해진다(규칙집 0-5) */
function cardFivePack(profile: ContentProfile, keyword: string, topicType: TopicType, pages: 5 | 7, variant: number, today: string): PackState {
  const ts = topicsFor(profile, keyword, today, variant)
  const items = cardFive(profile, { keyword, topic: ts.find((x) => x.type === topicType) ?? ts[0], pages, variant }, today)
  const mats = materialList(profile).length
  const types = cardFiveTypes(profile)
  // D-234 규제 업종은 두 안(교육 세 안) — 나머지 틀이 금지 표현을 다시 만든다(규칙집 ⟲4차 5-2)
  const cut = types.length < CARD_FIVE.length ? ` 규제 업종이라 ${CARD_FIVE.filter((a) => !types.includes(a)).map((a) => AD_TYPE_LABEL[a].replace(/형$/, '')).join(' · ')} 안은 뺐어요(사례 · 손실 압박 · 실적을 다시 만들기 쉬워요).` : ''
  return {
    key: 'cards5',
    label: `카드뉴스 ${types.length}안`,
    fill: [],
    note: `${mats < MATERIAL_GOAL ? `글 재료가 ${mats}개예요 — ${MATERIAL_GOAL}개 이상이면 안끼리 덜 비슷해져요(홍보 정보 › 글 재료).` : `글 재료 ${mats}개로 만들었어요. ${types.map((a) => AD_TYPE_LABEL[a].replace(/형$/, '')).join(' → ')} 순서예요.`}${cut}`,
    items,
    saved: items.map(() => null),
    touched: items.map(() => false),
    at: 0,
  }
}

/** 묶음 머리 아이콘 · 색 */
function packStyle(key: PackState['key']): { icon: LucideIcon; tone: MkTone } {
  return key === 'cards5' ? { icon: KIND_STYLE.cards.icon, tone: 'fuchsia' } : (SITUATION_STYLE[key] ?? { icon: Layers, tone: 'violet' })
}

export function ContentStudio({ record, store }: { record: ClientOpsRecord; store: ContentStore }) {
  const today = todayLocalDate()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const ownerAi = useOwnerAiAccess()
  const aiRepo = useOwnerAiRepo()
  const aiIdent = useOwnerAiIdentity()
  const toolClient = useToolClient()
  const { profile, source } = useMemo(() => buildProfile(record, today, store.overrides, store.site), [record, today, store.overrides, store.site])
  // D-239 AI 도우미 — 이 업체 홍보 정보 + 규칙집. 미래AI랩이면 우리 회사 소개를 더한다
  const assistBuild = useCallback(
    () => contentBundle({ today, profile, source, keyword: mainKeyword(profile), mirae: isMiraeSubject(record.id), items: store.items.map((x) => ({ title: x.title, kind: x.kind, createdAt: x.createdAt })) }),
    [today, profile, source, record.id, store.items],
  )
  const saveAssistItem = useCallback(
    async (item: { title: string; body?: string }, assistId: string) => {
      const text = (item.body ?? '').trim()
      if (!text) return false
      const r = await store.addDraft({ kind: assistId === 'content.place' ? 'place' : 'blog', title: item.title.slice(0, 60) || 'AI 도우미로 쓴 글', blocks: [{ label: '', text }], notes: ['AI 도우미로 쓴 글 — 올리기 전에 사실 · 혜택 · 숫자를 한 번 확인하세요'], input: { variant: 0, tone: profile.tone } })
      return !!r
    },
    [store, profile.tone],
  )

  // D-231 콘텐츠 레이더 › 내 콘텐츠 [홍보 글로] — 주제를 키워드에 넣고 '직접 고르기 › 블로그' 로 연다
  const [urlParams] = useSearchParams()
  const carried = (urlParams.get('kw') ?? '').trim().slice(0, 40)
  const [kind, setKind] = useState<ContentKind>('blog')
  const [keyword, setKeyword] = useState(() => carried || mainKeyword(profile))
  const [topicType, setTopicType] = useState<TopicType>('tips')
  // D-229 규칙집 3-5 — 카드뉴스는 보통 7~8장
  const [pages, setPages] = useState<5 | 7>(7)
  const [purpose, setPurpose] = useState<KakaoPurpose>('news')
  const [variant, setVariant] = useState(0)
  const [blogType, setBlogType] = useState<BlogType>('brand')
  const [shortLen, setShortLen] = useState<ShortLen>('20-30')
  const [adType, setAdType] = useState<AdType>('info')
  /** D-230 고른 제목 각도(없으면 주제 제목 그대로) · 후보 돌리기 · 접기 */
  const [angle, setAngle] = useState<AngleId | null>(null)
  const [angleRound, setAngleRound] = useState(0)
  const [angleOpen, setAngleOpen] = useState(false)
  const [shown, setShown] = useState<Shown | null>(null)
  // D-235 경로 줄 끝에 지금 만드는 글 종류(마케팅 · 브랜딩 › 홍보 글 만들기 › 업체 › 짧은 영상 대본)
  usePageCrumbs(shown ? [{ label: KIND_LABEL[shown.draft.kind] }] : [])
  /** 고친 글(저장 전) — 고치기 칸을 닫아도 남는다 */
  const [editing, setEditing] = useState<DraftBlock[] | null>(null)
  /** D-209 고치기 칸이 열려 있는지 — '고치기 그만' 은 칸만 닫고 고친 글은 남긴다(전에는 말없이 버렸다) */
  const [editOpen, setEditOpen] = useState(false)
  useEffect(() => {
    if (!editing) setEditOpen(false)
  }, [editing])
  const [busy, setBusy] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  /** D-228 다른 AI 도구에 맡길 때 — 요청문 복사 · 받은 글 점검 */
  const [aiReqOpen, setAiReqOpen] = useState(false)
  /** 받은 글 점검에 붙여 넣은 글 — 창을 닫았다 열어도 남게 여기 둔다 */
  const [aiGot, setAiGot] = useState('')
  /** D-227 무엇을 만들까요 — 네 길 중 지금 펼친 하나 */
  const [mode, setMode] = useState<Mode>(() => (carried ? 'direct' : 'pick'))
  const [pack, setPack] = useState<PackState | null>(null)
  const packRef = useRef<PackState | null>(null)
  packRef.current = pack
  const resultRef = useRef<HTMLDivElement | null>(null)
  const holidays = useMemo(() => holidaysAround(today), [today])

  // D-229 주제 제목의 'N가지' 는 고른 형식이 실제로 다루는 개수(블로그 2 · 짧은 쇼츠 2 · 나머지 3)
  const topicCount = kind === 'blog' || (kind === 'shorts' && shortLen === '20-30') ? 2 : 3
  const topics = useMemo(() => topicsFor(profile, keyword, today, variant, topicCount), [profile, keyword, today, variant, topicCount])
  const made = useMemo(() => store.items.map((i) => ({ kind: i.kind, topicType: i.input.topicType, purpose: i.input.purpose, createdAt: i.createdAt })), [store.items])
  const picks = useMemo(() => firstPicks(profile, today, made), [profile, today, made])
  const findWords = useMemo(() => keywordGroups(profile).find((g) => g.key === 'find')?.words.slice(0, 4) ?? [], [profile])
  // D-234 규제 업종 — 카드뉴스 유형 중 권하지 않는 것(규칙집 ⟲4차 5-2)
  const regulated = useMemo(() => regulatedOf(profile), [profile])
  const riskyCards = useMemo(() => riskyAdTypes(profile), [profile])
  const archiveRows = useMemo(() => latestByRoot(store.items), [store.items])
  const situationNow = useMemo(() => situationsFor(profile, today, holidays).filter((x) => x.now).length, [profile, today, holidays])
  // D-230 제목 각도 — 블로그(우리 글) · 긴 영상만. 이 키워드로 저장한 글의 각도는 빼고 후보 5개
  const angleOn = (kind === 'blog' && blogType === 'brand') || kind === 'video'
  const usedHere = useMemo(() => usedAngles(store.items, keyword.trim() || mainKeyword(profile)), [store.items, keyword, profile])
  const angleCands = useMemo(
    () => (angleOn ? titleCandidates(profile, keyword, today, usedHere, 5, topicCount, angleRound * 5).map((c) => (kind === 'video' ? { ...c, title: applyTone(angleVideoTitle(profile, c.id, keyword, topicCount, today) ?? c.title, profile.tone) } : c)) : []),
    [angleOn, profile, keyword, today, usedHere, topicCount, angleRound, kind],
  )
  const angleSel = angle && angleCands.some((c) => c.id === angle) ? angle : null
  const bestAngle = useMemo(() => performanceBy(store.items).find((r) => r.key.startsWith('angle:') && (r.inquiries > 0 || r.saves > 0)) ?? null, [store.items])

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
      const first = pk.items[0]?.draft.input
      const items = pk.key === 'cards5' ? cardFivePack(profile, first?.keyword ?? '', first?.topicType ?? 'tips', first?.pages === 5 ? 5 : 7, first?.variant ?? 0, today).items : situationPack(profile, pk.key, today, holidaysAround(today)).items
      const next = { ...pk, items, saved: items.map(() => null), touched: items.map(() => false) }
      setPack(next)
      setShown((cur) => (cur && !cur.item ? { draft: next.items[next.at]?.draft ?? cur.draft, item: null } : cur))
      setEditing(null)
      return
    }
    setShown((cur) => {
      if (!cur || cur.item) return cur
      const inp = cur.draft.input
      const ts = topicsFor(profile, inp.keyword ?? '', today, inp.variant)
      return { draft: makeDraft(profile, { kind: cur.draft.kind, keyword: inp.keyword, topic: ts.find((t) => t.type === inp.topicType), pages: inp.pages, purpose: inp.purpose, variant: inp.variant, blogType: inp.blogType, shortLen: inp.shortLen, adType: inp.adType, angle: inp.angle }, today), item: null }
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

  const generate = (over: Partial<{ kind: ContentKind; topicType: TopicType; purpose: KakaoPurpose; variant: number; pages: 5 | 7; keyword: string; angle: AngleId | null }> = {}) => {
    const k = over.kind ?? kind
    const v = over.variant ?? variant
    const tt = over.topicType ?? topicType
    const kw = over.keyword ?? keyword
    const ts = topicsFor(profile, kw, today, v)
    const t = ts.find((x) => x.type === tt) ?? ts[0]
    show(makeDraft(profile, { kind: k, keyword: kw, topic: t, pages: over.pages ?? pages, purpose: over.purpose ?? purpose, variant: v, blogType, shortLen, adType, ...(over.angle ? { angle: over.angle } : {}) }, today))
  }

  /** D-230 카드뉴스 5안 한 번에 — 상황 묶음처럼 탭 5개 · 모두 저장 */
  const openCardFive = () => guard(() => {
    const pk = cardFivePack(profile, keyword, topicType, pages, variant, today)
    setPack(pk)
    show(pk.items[0].draft, null, true)
  })

  const onPick = (p: ContentPick) => {
    setKind(p.kind)
    if (p.topicType) setTopicType(p.topicType)
    if (p.purpose) setPurpose(p.purpose)
    setVariant(0)
    generate({ kind: p.kind, topicType: p.topicType, purpose: p.purpose, variant: 0 })
  }

  const blocks = editing ?? shown?.draft.blocks ?? []
  // D-228 홍보 정보와 맞지 않는 혜택 · 출처 · 숫자도 같이 본다(고치다 넣은 말까지)
  const checks = shown ? draftChecks(shown.draft.kind, blocks, profile.industry, shown.draft.input.keyword, profile) : []
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
    if (it.input.planDate && !isTrialId(record.id)) void syncPlanDone(it.input.planDate, it.kind, on)
  }

  /** D-236: 업체 일정에 건 '홍보 글 올리기' 도 같이 처리됨으로 — 올린 글이 오늘 화면에 30일 동안 '늦음' 으로 남았다 */
  const syncPlanDone = async (date: string, k: ContentKind, on: boolean) => {
    try {
      const list = await listClients(toolClient.workspaceId).catch(() => toolClient.loadClients())
      const target = list.find((c) => c.id === record.id)
      if (!target) return
      const next = withToolDeadlineDone(target, 'content', { date, title: planDeadlineTitle(k) }, on)
      if (next !== target) toolClient.replaceClient(await saveClient(next))
    } catch {
      // 글의 '올림' 표시는 이미 저장됐다 — 업체 일정만 다음에 다시 누르면 맞춰진다
    }
  }

  /** D-230 올린 뒤 숫자 — 사슬 전체에 적는다 */
  const saveStats = async (it: ContentItem, st: ContentStats | null) => {
    if (!(await store.setStats(it.rootId, st))) {
      showToast('저장하지 못했어요. 적은 숫자는 그대로 있어요 — 다시 눌러 주세요.')
      return false
    }
    showToast(st ? "숫자를 적었어요 — 보관함 '무엇이 잘 됐나' 에 모여요." : '적은 숫자를 지웠어요.')
    setShown((cur) => {
      if (!cur?.item || cur.item.rootId !== it.rootId) return cur
      const { stats: _s, ...rest } = cur.item
      return { ...cur, item: st ? { ...rest, stats: st } : rest }
    })
    return true
  }

  const toAi = async () => {
    if (!shown || busy) return
    setBusy(true)
    try {
      const r = await sendDraftToOwnerAi(aiRepo, aiIdent, record, shown.draft.title, text)
      showToast(r.added ? 'AI 전략실 자료에 넣었어요 — 자유 AI 작업에 "이 글을 다듬어 줘" 라고 적어 주세요.' : '이미 AI 전략실 자료에 있는 글이에요.')
      navigate(`/ops/clients/${encodeURIComponent(record.id)}?tab=ai`)
    } catch (e) {
      showToast(e instanceof Error && /0021|설정/.test(e.message) ? 'AI 전략실 DB 설정이 필요해요.' : 'AI 전략실에 넣지 못했어요. 잠시 뒤 다시 눌러 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="content-studio">
      <ProfileCard record={record} profile={profile} source={source} saved={archiveRows.length} posted={archiveRows.filter((r) => r.item.postedAt).length} onEdit={() => setProfileOpen(true)} onAiReq={() => setAiReqOpen(true)} />
      {/* D-239: 규칙집(제목 각도 17 · 블로그 구성 · 넣지 말 것)을 그대로 지켜 AI 가 한 번에 쓰는 블로그 · 플레이스 글 — 만든 글은 보관함에 쌓인다 */}
      <AiAssist
        page="content"
        scope={`content:${record.id}`}
        title={`블로그 · 플레이스 홍보 글 · ${record.companyName}`}
        presets={['content.blog', 'content.place', 'content.titles', 'content.keywords']}
        build={assistBuild}
        onSaveItem={saveAssistItem}
      />

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
      <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5" data-testid="content-picks">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="t-section flex min-w-0 items-center gap-2.5 text-violet-900">
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
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
                <button type="button" onClick={() => guard(() => onPick(p))} className={`tap group flex h-full w-full flex-col items-start gap-2 rounded-(--radius-control) border bg-white p-3 text-left transition-shadow hover:shadow-md ${TONE[ks.tone].line} ${TONE[ks.tone].hover}`} data-testid="content-pick" data-key={p.key} data-kind={p.kind}>
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
      <SituationCard profile={profile} today={today} holidays={holidays} openKey={pack && pack.key !== 'cards5' ? pack.key : null} onPick={openPack} />
      )}
      {mode === 'plan' && (
      <PlanCard
        startOpen
        record={record}
        profile={profile}
        today={today}
        store={store}
        onOpen={openItem}
        onCopy={copy}
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
              {angleOn && (
                <AnglePicker
                  open={angleOpen}
                  onToggle={() => setAngleOpen((o) => !o)}
                  cands={angleCands}
                  sel={angleSel}
                  onSel={setAngle}
                  onMore={() => setAngleRound((r) => r + 1)}
                  used={usedHere}
                  best={bestAngle?.label.replace(/^제목 각도 · /, '') ?? ''}
                  video={kind === 'video'}
                />
              )}
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
              {riskyCards.length > 0 && (
                <p className="t-meta mb-1 rounded-(--radius-control) bg-white px-3 py-2 break-keep text-danger-700 ring-1 ring-slate-200" data-testid="content-adtype-regulated">
                  {regulated?.label} 업종 — {riskyCards.map((a) => AD_TYPE_LABEL[a]).join(' · ')}은 금지한 표현(사례 · 금액 · 손실 압박 · 실적)을 다시 만들기 쉬워요. {cardFiveTypes(profile).map((a) => AD_TYPE_LABEL[a]).join(' · ')}을 권해요.
                </p>
              )}
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {AD_TYPES.map((a) => (
                  <button key={a} type="button" aria-pressed={adType === a} onClick={() => setAdType(a)} data-testid="content-adtype-btn" data-value={a} data-risky={riskyCards.includes(a) ? '1' : undefined} className={`tap flex min-h-12 flex-col items-start justify-center rounded-(--radius-control) border px-3 py-1.5 text-left ${adType === a ? TONE.fuchsia.on : `border-slate-200 bg-white ${TONE.fuchsia.hover}`}`}>
                    <span className={`t-sub inline-flex flex-wrap items-center gap-1.5 font-semibold break-keep ${adType === a ? 'text-fuchsia-900' : 'text-slate-800'}`}>
                      {AD_TYPE_LABEL[a]}
                      {riskyCards.includes(a) && <span className="t-meta rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">권하지 않음</span>}
                    </span>
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
          <button type="button" className={MK_PRIMARY.violet} onClick={() => guard(() => generate({ angle: angleOn ? angleSel : null }))} data-testid="content-make">
            <Sparkles className="size-5" aria-hidden="true" />
            {kind === 'blog' && blogType === 'review' ? '체험단 가이드 만들기' : `${KIND_LABEL[kind]} 만들기`}
          </button>
          {kind === 'cards' && (
            <button type="button" onClick={openCardFive} className="tap flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 text-center hover:border-fuchsia-500" data-testid="content-cards5">
              <span className="t-body inline-flex items-center gap-1.5 font-semibold text-fuchsia-900">
                <Layers className="size-4" aria-hidden="true" />
                {cardFiveTypes(profile).length}안 한 번에 만들기
              </span>
              <span className="t-meta break-keep text-fuchsia-800">{cardFiveTypes(profile).map((a) => AD_TYPE_LABEL[a].replace(/형$/, '')).join(' → ')}</span>
            </button>
          )}
          <p className="t-meta break-keep text-slate-500">업체 기록과 업종 견본으로 채워요(규칙 · 'AI' 아님). 업체마다 다른 곳은 [대괄호] 로 비워 둬요.</p>
        </section>
        )}

        {/* 결과 — D-227 고른 길 아래 한 자리(② 글 다듬기 · ③ 저장 · 올리기) */}
        <div ref={resultRef}>
          {shown ? (
            <section className={`${card} flex flex-col gap-3 overflow-hidden p-4 sm:p-5`} data-testid="content-result" data-kind={shown.draft.kind}>
              {pack && (
                <div className="flex flex-col gap-2 rounded-(--radius-control) border border-violet-200 bg-white p-3" data-testid="content-pack" data-key={pack.key}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="t-sub flex min-w-0 items-center gap-2 font-semibold break-keep text-violet-900">
                      <MkIcon icon={packStyle(pack.key).icon} tone={packStyle(pack.key).tone} size="sm" />
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
                      const tt = pack.key === 'cards5' ? 'fuchsia' : tabTone(x.tab)
                      return (
                        <button key={x.tab} type="button" role="tab" aria-selected={i === pack.at} onClick={() => packGo(i)} className={`tap t-sub flex min-h-11 items-center gap-1.5 rounded-full border px-4 font-semibold ${i === pack.at ? `${TONE[tt].solid} border-transparent shadow-sm` : `bg-white text-slate-700 ${TONE[tt].line} ${TONE[tt].hover}`}`} data-testid="content-pack-tab" data-saved={pack.saved[i] ? '1' : '0'}>
                          <span className={`tabular-nums ${i === pack.at ? 'opacity-90' : 'text-slate-500'}`}>{i + 1}</span>
                          {x.tab}
                          {pack.saved[i] && <Check className={`size-4 ${i === pack.at ? '' : 'text-success-600'}`} aria-label="저장됨" />}
                        </button>
                      )
                    })}
                  </div>
                  {pack.note && (
                    <p className="t-meta break-keep text-slate-700" data-testid="content-pack-note">
                      {pack.note}
                    </p>
                  )}
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
                {shown.draft.input.angle && (
                  <span data-testid="content-result-angle">
                    <Badge tone="brand">각도 · {ANGLE_LABEL[shown.draft.input.angle]}</Badge>
                  </span>
                )}
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

              <ReviewChecklist key={`review-${shown.item?.rootId ?? shown.draft.title}`} items={reviewChecklist(shown.draft.kind, checks, profile, { guide: shown.draft.kind === 'blog' && shown.draft.input.blogType === 'review' })} />

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
                        show(keepPlan(makeDraft(profile, { kind: shown.draft.kind, keyword: shown.draft.input.keyword ?? keyword, topic: ts.find((x) => x.type === tt) ?? ts[0], pages: shown.draft.input.pages, purpose: shown.draft.input.purpose, variant: v, blogType: shown.draft.input.blogType, shortLen: shown.draft.input.shortLen, adType: shown.draft.input.adType, angle: shown.draft.input.angle }, today), shown.draft.input))
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
                {/* D-220: 가상 업체 · 컨설턴트는 AI 전략실(업체마다)에 아직 없다 — 임시등록한 뒤에 */}
                {ownerAi === 'yes' && !isTrialId(record.id) && (
                  <Button size="sm" variant="ghost" onClick={() => void toAi()} disabled={busy} data-testid="content-to-ai">
                    <Sparkles className="size-4 text-violet-600" aria-hidden="true" />
                    AI 전략실에서 다듬기
                  </Button>
                )}
              </div>

              {shown.item?.postedAt && <StatsBox key={`stats-${shown.item.rootId}`} item={shown.item} onSave={saveStats} />}

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
                            show(makeDraft(profile, { kind: k, keyword: shown.draft.input.keyword, topic: topicsFor(profile, shown.draft.input.keyword ?? keyword, today, shown.draft.input.variant).find((t) => t.type === shown.draft.input.topicType), pages, variant: shown.draft.input.variant, shortLen, adType, angle: shown.draft.input.angle }, today))
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
            <section className="flex flex-col items-center gap-3 rounded-(--radius-panel) border border-dashed border-slate-300 bg-white p-6 text-center" data-testid="content-empty">
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

      {aiReqOpen && (
        <AiRequestSheet
          profile={profile}
          store={store}
          got={aiGot}
          setGot={setAiGot}
          onClose={() => setAiReqOpen(false)}
          onEditProfile={() => {
            setAiReqOpen(false)
            setProfileOpen(true)
          }}
          onSaved={(it) => {
            setAiReqOpen(false)
            setAiGot('')
            show({ kind: it.kind, title: it.title, blocks: it.blocks, notes: [], input: it.input }, it)
          }}
        />
      )}
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

function ProfileCard({ record, profile, source, saved, posted, onEdit, onAiReq }: { record: ClientOpsRecord; profile: ReturnType<typeof buildProfile>['profile']; source: ReturnType<typeof buildProfile>['source']; saved: number; posted: number; onEdit: () => void; onAiReq: () => void }) {
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
  // D-228 글 재료 — 적어 둔 것만(칸 수 · '채운 칸' 에는 세지 않는다)
  const material = [
    { label: '후기', value: profile.reviews },
    { label: '후기 출처', value: profile.reviews ? profile.reviewSource : '' },
    { label: '고객 한마디', value: profile.voice ? `"${profile.voice}"` : '' },
    { label: '이번 달 혜택', value: offerLine(profile) },
    { label: '가격 · 조건', value: profile.price },
    { label: '말하는 사람', value: profile.speaker },
  ].filter((m) => m.value)
  // D-227 칸 7개는 접어 둔다 — 머리 띠(숫자) · 채울 칸 안내만 늘 보이게. 펼침은 이 기기에 기억
  const [open, setOpen] = useFold('content.profile', false)
  // D-229 규칙집 0장 — 브리프 칸 · 재료 n/7 (D-234 ⟲4차: 구매·문의처를 더해 7칸)
  const slots = briefSlots(profile, source)
  const filled = slots.filter((x) => x.ok).length
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
            <button type="button" onClick={onAiReq} className={HERO_BTN} data-testid="content-ai-req">
              <Send className="size-4 text-sky-700" aria-hidden="true" />
              다른 AI 도구에 맡기기
            </button>
          </>
        }
      />
      <div className="flex flex-col gap-3 p-4 sm:p-5">
      <button type="button" onClick={onEdit} className="tap flex w-full min-w-0 flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-violet-400" data-testid="content-brief" data-filled={filled}>
        <span className="t-sub flex flex-wrap items-baseline gap-x-2 gap-y-0.5 break-keep">
          <b className="font-bold text-violet-900">브리프 {slots.length}칸 · {filled}/{slots.length}</b>
          <span className="t-meta font-semibold text-violet-700">{slots.find((x) => x.key === 'facts')?.note}</span>
          <span className="t-meta text-slate-500">모든 글이 이 한 장에서 시작해요</span>
        </span>
        <span className="flex flex-wrap gap-1.5">
          {slots.map((x) => (
            <span key={x.key} title={x.note} className={`t-meta inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold ${x.ok ? 'bg-white text-violet-900 ring-1 ring-violet-200' : 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'}`} data-testid="content-brief-slot" data-key={x.key} data-ok={x.ok ? '1' : '0'}>
              {x.ok ? <Check className="size-3.5" aria-hidden="true" /> : <AlertTriangle className="size-3.5" aria-hidden="true" />}
              {x.label}
            </span>
          ))}
        </span>
      </button>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="tap -my-1 flex min-h-11 w-full min-w-0 items-center gap-2 rounded-(--radius-control) text-left hover:bg-slate-50" data-testid="content-profile-toggle">
        <ChevronRight aria-hidden="true" className={`size-5 shrink-0 text-violet-500 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        <span className="t-sub min-w-0 flex-1 font-semibold break-keep text-slate-800">{open ? '홍보 정보 접기' : `홍보 정보 ${rows.length}칸 보기`}</span>
        <span className={`t-meta shrink-0 rounded-full px-2 py-0.5 font-semibold ${missing ? 'bg-amber-100 text-amber-900' : 'bg-violet-50 text-violet-800'}`}>{missing ? `빈 칸 ${missing}` : '다 채움'}</span>
      </button>
      {open && (
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className={`flex min-w-0 items-start gap-2.5 rounded-(--radius-control) border p-2.5 ${r.missing ? 'border-dashed border-slate-300 bg-white' : 'border-slate-200 bg-white'}`} data-testid="content-profile-row" data-missing={r.missing ? '1' : '0'}>
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
      {open && material.length > 0 && (
        <dl className="flex flex-col gap-1 rounded-(--radius-control) border border-slate-200 bg-white p-2.5" data-testid="content-profile-material">
          <span className="t-meta font-bold text-violet-900">글 재료 · 적어 둔 것만 글에 들어가요</span>
          {material.map((m) => (
            <div key={m.label} className="t-sub flex min-w-0 flex-wrap gap-x-2 break-keep">
              <dt className="shrink-0 font-semibold text-slate-600">{m.label}</dt>
              <dd className="min-w-0 break-words text-slate-900">{m.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {gaps.length > 0 && (
        <button type="button" onClick={onEdit} className="tap flex w-full min-w-0 items-start gap-2.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-brand-500" data-testid="content-profile-gaps">
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
/** 업체 일정에 거는 올릴 날 한 줄 — '올렸어요' 를 누르면 이 제목으로 찾아 처리됨으로 바꾼다(D-236) */
const planDeadlineTitle = (k: ContentKind) => `홍보 글 올리기 · ${KIND_LABEL[k]}`
function shortDate(d: string): string {
  const [, m, dd] = d.split('-').map(Number)
  return `${m}/${dd} (${DOW[new Date(`${d}T00:00:00Z`).getUTCDay()]})`
}

function PlanCard({ record, profile, today, store, onPick, onOpen, onCopy, startOpen = false }: { record: ClientOpsRecord; profile: ReturnType<typeof buildProfile>['profile']; today: string; store: ContentStore; onPick: (slot: PlanSlot) => void; onOpen: (it: ContentItem) => void; onCopy: (t: string, what?: string) => void; startOpen?: boolean }) {
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
  // D-236: 이미 올린 칸은 처리됨으로 걸어 둔다(다시 걸어도 '늦음' 으로 안 돌아가게)
  const deadlines = slots.map((sl, i) => ({ date: sl.date, title: planDeadlineTitle(sl.kind), note: sl.title, ...(states[i].posted ? { done: true as const } : {}) }))

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

  /** D-237 [모두 복사] — 올릴 날 순서로 날짜 · 형식 · 제목 + 본문. 만든 글은 보관함의 새 판, 안 만든 칸은 [한 번에 만들기] 와 같은 글 */
  const copyAll = () => {
    const todo = slots.filter((_, i) => !states[i].item)
    const drafts = planDrafts(profile, todo, today, (d) => !!sameContent(store.items, d.kind, d.blocks))
    let k = 0
    const rows = slots.map((sl, i) => {
      const it = states[i].item
      const d = it ? null : drafts[k++]
      return { date: sl.date, kind: sl.kind, title: it?.title ?? d?.title ?? sl.title, blocks: it?.blocks ?? d?.blocks ?? null }
    })
    onCopy(planCopyText(rows), `한 달 치 ${slots.length}편`)
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
            <button type="button" onClick={() => (states[nextAt].item ? onOpen(states[nextAt].item as ContentItem) : onPick(slots[nextAt]))} className="tap flex w-full min-w-0 items-center gap-2.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 text-left hover:border-sky-400" data-testid="content-plan-next-open">
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
            <button type="button" className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:border-violet-400" onClick={copyAll} data-testid="content-plan-copy-all">
              <Copy className="size-4" aria-hidden="true" />
              모두 복사
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
                className={`tap flex h-full w-full min-w-0 flex-col items-start gap-1.5 rounded-(--radius-control) border p-3 text-left transition-shadow hover:shadow-sm ${on ? TONE[ss.tone].on : sit.now ? 'border-brand-500 bg-white hover:border-brand-600' : `border-slate-200 bg-white ${TONE[ss.tone].hover}`}`}
                data-testid="content-situation"
                data-key={sit.key}
              >
                {sit.now && (
                  <span className="t-meta flex w-full items-start gap-1 rounded-md bg-slate-100 px-2 py-1 font-semibold break-keep text-brand-700" data-testid="content-situation-now">
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
    <div className="rounded-(--radius-control) border border-slate-200 bg-white" data-testid="content-fill">
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

/** D-228 검색량 등급 색 — 많이 찾음은 진하게, 거의 안 찾음은 흐리게 */
const TIER_CHIP: Record<VolumeTier, string> = {
  high: 'bg-emerald-100 text-emerald-900',
  mid: 'bg-sky-100 text-sky-900',
  low: 'bg-amber-100 text-amber-900',
  tiny: 'bg-slate-200 text-slate-700',
  none: 'bg-slate-100 text-slate-600',
}

function KeywordVolumeBox({ onPick }: { onPick: (word: string) => void }) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<KeywordVolume[] | null>(null)
  // D-228 월 100 아래는 따로 글을 쓰기보다 다른 글 안에 — 걸러 보기(숫자 없는 줄은 남긴다)
  const [min100, setMin100] = useState(false)
  const fmt = (n: number | null, small: boolean) => (n === null ? '—' : small && n === 0 ? '< 10' : n.toLocaleString('ko-KR'))
  const hasNum = !!rows?.some((r) => r.total !== null)
  const under = rows ? rows.filter((r) => r.total !== null && (r.total < 100 || r.small)).length : 0
  const list = rows ? (min100 ? rows.filter((r) => r.total === null || (r.total >= 100 && !r.small)) : rows) : []
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
        {rows && (
          <span className="t-meta text-slate-500" data-testid="content-volume-count">
            {min100 ? `${rows.length}개 중 ${list.length}개` : `${rows.length}개`}
            {list.length > 30 ? ' · 위 30개만 보여요' : ''}
          </span>
        )}
        {hasNum && (
          <button type="button" aria-pressed={min100} onClick={() => setMin100(!min100)} className={`${chip(min100)} ml-auto inline-flex items-center gap-1.5`} data-testid="content-volume-min100">
            {min100 && <Check className="size-4" aria-hidden="true" />}월 100 이상만
          </button>
        )}
      </div>
      {hasNum && under > 0 && (
        <p className="t-meta break-keep text-slate-600" data-testid="content-volume-tip">
          한 달 검색이 100 아래인 말 {under}개는 따로 글을 쓰기보다 다른 글의 본문 · 해시태그에 같이 넣는 편이 나아요.
        </p>
      )}
      {rows && list.length > 0 && (
        <ol className="flex flex-col divide-y divide-slate-200 rounded-(--radius-control) border border-slate-200 bg-white">
          {list.slice(0, 30).map((r, i) => (
            <li key={r.word} className="flex min-w-0 items-center gap-2 px-3 py-2" data-testid="content-volume-row" data-tier={volumeTier(r)}>
              <span className="t-meta w-5 shrink-0 text-right tabular-nums text-slate-400">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="t-sub flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 break-keep text-slate-800">
                  <span className="min-w-0 break-words">{r.word}</span>
                  {r.total !== null && <span className={`t-meta shrink-0 rounded-full px-2 py-0.5 font-semibold ${TIER_CHIP[volumeTier(r)]}`} data-testid="content-volume-tier">{VOLUME_TIER_LABEL[volumeTier(r)]}</span>}
                </span>
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
  const field = (label: string, key: 'item' | 'area' | 'target' | 'phone' | 'hours' | 'differ' | 'channel' | 'objection' | 'reviews' | 'reviewSource' | 'voice' | 'offer' | 'price' | 'speaker' | 'rebuttal' | 'shipping' | 'avoid', placeholder: string) => (
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
        {/* D-229 규칙집 0-8 — 걱정 1개와 흔한 반박 1개가 모든 글의 출발점 */}
        {field('흔한 반박(손님이 흔히 하는 생각 한 가지)', 'rebuttal', '예: 리모델링은 어디서 하나 다 똑같다')}
        {/* D-228 글 재료 — 적어 둔 것만 글에 넣는다(비우면 숫자 · 후기 · 혜택을 지어내지 않고 뺀다) */}
        <div className="flex flex-col gap-1 border-t border-slate-200 pt-4" data-testid="content-ov-material">
          <h3 className="t-sub flex items-center gap-1.5 font-bold text-violet-900">
            <Star className="size-4 text-violet-600" aria-hidden="true" />
            글 재료 — 있는 것만 · 사실만
          </h3>
          <p className="t-meta break-keep text-slate-600">적어 둔 것만 블로그 · 카드뉴스 · 카톡에 들어가요. 비워 두면 숫자 · 후기 · 혜택을 지어내지 않고 뺍니다.</p>
        </div>
        {field('후기 수 · 평점', 'reviews', '예: 네이버 후기 320개 · 평점 4.8')}
        {/* D-234 규칙집 ⟲4차 — 후기 출처가 비면 다른 도구가 후기 위치를 지어내거나 다른 플랫폼 이름을 넣었다 */}
        {field('후기 출처(손님이 어디서 볼 수 있나요)', 'reviewSource', '예: 자사몰 · 매장 방명록 · 네이버 플레이스')}
        {field('실제 고객 한마디(받은 그대로)', 'voice', '예: 끝나고도 먼저 연락 주셔서 놀랐어요')}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          {field('이번 달 혜택', 'offer', '예: 첫 방문 견적 무료')}
          <label className="flex flex-col gap-1.5">
            <span className="t-sub font-semibold text-slate-700">혜택 끝나는 날</span>
            <input type="date" className={inputClass} value={ov.offerUntil ?? ''} onChange={(e) => setOv((p) => ({ ...p, offerUntil: e.target.value || undefined }))} data-testid="content-ov-offerUntil" />
          </label>
        </div>
        <p className="t-meta -mt-2 break-keep text-slate-500">끝나는 날이 지나면 혜택은 글에서 저절로 빠져요.</p>
        {field('가격 · 조건(단위까지)', 'price', '예: 1회 32,000원 · 공임 3만 원(부품값 별도) · 300만 원부터')}
        <p className="t-meta -mt-2 break-keep text-slate-500">'1회' · '월' · '공임' 처럼 단위를 같이 적어 주세요 — 단위가 없으면 다른 도구가 '월 ○원' 처럼 바꿔 써요.</p>
        {field('배송 · 교환 조건', 'shipping', '예: 전국 택배 · 3만 원 이상 무료 배송 · 7일 안 교환')}
        {field('글에서 말하는 사람(직함과 이름)', 'speaker', '예: 대표 김OO · 원장 이OO')}
        <p className="t-meta -mt-2 break-keep text-slate-500">직함만 적으면 다른 도구가 엉뚱한 실명을 붙일 수 있어요 — 이름까지 적어 주세요.</p>
        {/* D-229 브리프 '넣지 말 것' — 기본 금지는 늘 붙고, 업체가 따로 막은 말을 더한다 */}
        <div className="flex flex-col gap-1 border-t border-slate-200 pt-4" data-testid="content-ov-avoid-section">
          <h3 className="t-sub flex items-center gap-1.5 font-bold text-violet-900">
            <AlertTriangle className="size-4 text-violet-600" aria-hidden="true" />
            넣지 말 것
          </h3>
          <p className="t-meta break-keep text-slate-600">다른 업체 · 지어낸 출처 · 깎아내리기 · 관계없는 사업 이야기는 늘 막아요. 업체가 따로 막은 말이 있으면 더해 주세요 — 글 점검이 찾아 알려요.</p>
        </div>
        {field('업체가 넣지 말라고 한 말(쉼표로 나눔)', 'avoid', '예: 최저가, 다른 지점 이름')}
      </div>
    </BottomSheet>
  )
}

/* ------------------------------------------------------------------ */
/* D-229 발행 전 검수표 — 규칙집 6장(자동으로 본 것 · 찾은 문제 · 사람이 체크할 것)                    */
/* ------------------------------------------------------------------ */

function ReviewChecklist({ items, testId = 'content-review' }: { items: ReviewItem[]; testId?: string }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<ReadonlySet<number>>(new Set())
  if (!items.length) return null
  const warn = items.filter((x) => x.state === 'warn').length
  const manual = items.filter((x) => x.state === 'manual').length
  const checked = items.filter((x, i) => x.state === 'manual' && done.has(i)).length
  const groups = items.map((x) => x.group).filter((g, i, all) => all.indexOf(g) === i)
  return (
    <section className="rounded-(--radius-control) border border-slate-200 bg-white" data-testid={testId} data-open={open ? '1' : '0'} data-warn={warn}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="tap flex min-h-11 w-full min-w-0 items-center gap-2 px-3 py-2 text-left hover:bg-slate-50" data-testid={`${testId}-toggle`}>
        <ChevronRight aria-hidden="true" className={`size-5 shrink-0 text-violet-500 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        <ListChecks aria-hidden="true" className="size-4 shrink-0 text-violet-700" />
        <span className="t-sub min-w-0 flex-1 font-semibold break-keep text-slate-800">발행 전 검수표</span>
        <span className={`t-meta shrink-0 rounded-full px-2 py-0.5 font-semibold ${warn ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`} data-testid={`${testId}-sum`}>
          {warn ? `확인 ${warn}` : '자동 통과'} · 사람 {checked}/{manual}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-3 py-3">
          <p className="t-meta break-keep text-slate-500">초록 ✓ 은 규칙으로 확인한 것, 노랑 ! 은 찾은 문제, 네모는 사람이 보고 체크할 것이에요. 크게 고쳤으면 처음부터 다시 봐 주세요.</p>
          {groups.map((g) => (
            <div key={g}>
              <p className="t-meta font-bold text-slate-700">{g}</p>
              <ul className="mt-1 flex flex-col">
                {items.map((x, i) =>
                  x.group !== g ? null : (
                    <li key={i} data-testid={`${testId}-item`} data-state={x.state} className="t-sub break-keep">
                      {x.state === 'manual' ? (
                        <label className="flex min-h-11 cursor-pointer items-start gap-2 py-1.5">
                          <input
                            type="checkbox"
                            className="mt-0.5 size-5 shrink-0 accent-violet-600"
                            checked={done.has(i)}
                            onChange={() =>
                              setDone((prev) => {
                                const next = new Set(prev)
                                if (next.has(i)) next.delete(i)
                                else next.add(i)
                                return next
                              })
                            }
                            data-testid={`${testId}-check`}
                          />
                          <span className="min-w-0 text-slate-700">{x.text}</span>
                        </label>
                      ) : (
                        <span className="flex items-start gap-2 py-1.5">
                          {x.state === 'pass' ? <CheckCircle2 aria-label="통과" className="mt-0.5 size-5 shrink-0 text-success-600" /> : <AlertTriangle aria-label="확인" className="mt-0.5 size-5 shrink-0 text-warning-600" />}
                          <span className={`min-w-0 ${x.state === 'pass' ? 'text-slate-600' : 'font-semibold text-warning-700'}`}>{x.text}</span>
                        </span>
                      )}
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* D-228 다른 AI 도구에 맡기기 — 요청문 복사 → 받은 글 점검                     */
/* ------------------------------------------------------------------ */

const GOT_KINDS: ContentKind[] = ['blog', 'shorts', 'video', 'cards', 'kakao', 'place']

function AiRequestSheet({ profile, store, got, setGot, onClose, onEditProfile, onSaved }: { profile: ContentProfile; store: ContentStore; got: string; setGot: (v: string) => void; onClose: () => void; onEditProfile: () => void; onSaved: (it: ContentItem) => void }) {
  const { showToast } = useToast()
  const [stage, setStage] = useState(got.trim() ? 1 : 0)
  // D-229 맡길 글(채널) — 요청문의 길이 · 지역 · 마지막 제안이 이것으로 바뀌고, 받은 글 점검도 같은 형식으로 본다
  const [gotKind, setGotKind] = useState<ContentKind>('blog')
  const [result, setResult] = useState<DraftCheck[] | null>(null)
  const [busy, setBusy] = useState(false)
  const resultRef = useRef<HTMLDivElement | null>(null)
  const req = useMemo(() => aiRequestText(profile, { kind: gotKind, keyword: mainKeyword(profile) }), [profile, gotKind])
  // 사실 목록이 얇으면 먼저 채우라고 — 재료가 없을수록 바깥 도구가 지어낸다
  const thin = profileGaps(profile).filter((g) => ['differ', 'reviews', 'reviewSource', 'price', 'voice', 'offer'].includes(g.key))
  const warn = result?.filter((c) => c.level !== 'info') ?? []
  const run = () => {
    setResult(draftChecks(gotKind, [{ label: '', text: got.trim() }], profile.industry, undefined, profile))
    // 휴대폰에서는 결과가 창 아래로 밀린다 — 결과 첫 줄이 보이게
    window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60)
  }
  const save = async () => {
    const text = got.trim()
    if (!text || busy) return
    setBusy(true)
    try {
      const first = text.split('\n').map((l) => l.replace(/^[#>*\-\s]+/, '').trim()).find(Boolean) ?? ''
      const title = first.length > 40 ? `${first.slice(0, 40)}…` : first || '다른 AI 도구에서 받은 글'
      const r = await store.addDraft({ kind: gotKind, title, blocks: [{ label: '', text }], notes: [], input: { variant: 0, tone: profile.tone } })
      if (!r) return showToast('저장하지 못했어요. 붙여 넣은 글은 그대로 있어요 — 다시 눌러 주세요.')
      showToast(r.dup ? '같은 글이 이미 보관함에 있어요.' : '보관함에 저장했어요 — 아래 결과 칸에 열어 뒀어요.')
      onSaved(r.item)
    } finally {
      setBusy(false)
    }
  }
  return (
    <BottomSheet
      title="다른 AI 도구에 맡기기"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onClose}>닫기</Button>
          {stage === 0 ? (
            <Button variant="primary" onClick={() => setStage(1)} data-testid="content-ai-next">
              글을 받았으면 · 점검하기
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void save()} disabled={busy || !got.trim()} data-testid="content-ai-save">
              <Save className="size-4" aria-hidden="true" />
              보관함에 저장
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4" data-testid="content-ai-sheet" data-stage={stage === 0 ? 'copy' : 'check'}>
        <div className="mx-auto w-full max-w-sm">
          <MkSteps
            steps={[
              { key: 'copy', label: '요청문 복사' },
              { key: 'check', label: '받은 글 점검' },
            ]}
            current={stage}
            tone="sky"
            onGo={(k) => setStage(k === 'copy' ? 0 : 1)}
            testId="content-ai-steps"
          />
        </div>
        {stage === 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5" data-testid="content-ai-channel">
              <span className="t-sub w-full font-semibold text-slate-700">어떤 글을 맡기나요?</span>
              {GOT_KINDS.map((k) => (
                <button key={k} type="button" aria-pressed={gotKind === k} onClick={() => setGotKind(k)} className={mkChip(gotKind === k, 'sky')} data-testid="content-ai-channel-btn" data-kind={k}>
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            <p className="t-sub break-keep text-slate-700">다른 AI 글쓰기 도구의 '추가 요청' 칸에 이 글을 그대로 붙여 넣으세요. 업체 · 독자 · 쓸 수 있는 사실 · 넣지 말 것을 적어 두면 엉뚱한 업종 이야기와 지어낸 숫자가 줄어요. 여기서는 AI 를 부르지 않아요 — 복사만 해요.</p>
            <pre className="t-sub max-h-72 overflow-auto rounded-(--radius-control) border border-slate-200 bg-white p-3 font-sans break-words whitespace-pre-wrap text-slate-800" data-testid="content-ai-req-text">
              {req}
            </pre>
            <button type="button" className={MK_PRIMARY.sky} onClick={async () => showToast((await copyToClipboard(req)) ? '요청문을 복사했어요 — 다른 AI 도구의 추가 요청 칸에 붙여 넣으세요.' : '복사하지 못했어요 — 글을 길게 눌러 복사해 주세요.')} data-testid="content-ai-req-copy">
              <Copy className="size-4" aria-hidden="true" />
              요청문 복사
            </button>
            {thin.length > 0 && (
              <button type="button" onClick={onEditProfile} className="tap flex w-full min-w-0 items-start gap-2.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-amber-500" data-testid="content-ai-thin">
                <MkIcon icon={Sparkles} tone="amber" size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="t-sub block font-bold break-keep text-amber-900">사실 목록이 얇아요 — {thin.map((g) => g.label).join(' · ')}</span>
                  <span className="t-meta block break-keep text-slate-700">채워 두면 요청문의 사실 목록에 들어가요. 없으면 바깥 도구가 숫자 · 후기를 지어내기 쉬워요.</span>
                </span>
                <ChevronRight className="mt-1 size-5 shrink-0 text-amber-700" aria-hidden="true" />
              </button>
            )}
            <div className="flex flex-col gap-1.5 rounded-(--radius-control) bg-slate-50 p-3" data-testid="content-ai-tips">
              <span className="t-sub font-bold text-slate-800">쓰는 법</span>
              <ol className="flex flex-col gap-1">
                {AI_REQUEST_TIPS.map((tip, i) => (
                  <li key={tip} className="t-meta flex gap-1.5 break-keep text-slate-700">
                    <span className="shrink-0 font-bold text-sky-700 tabular-nums">{i + 1}</span>
                    <span className="min-w-0">{tip}</span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        ) : (
          <>
            <p className="t-sub break-keep text-slate-700">받은 글을 붙여 넣고 [점검하기] 를 누르세요. 홍보 정보에 없는 혜택 · 지어낸 출처 · 뜻이 바뀐 숫자 · 광고 규정에 걸리는 말을 찾아 드려요.</p>
            <div className="flex flex-wrap items-center gap-1.5" data-testid="content-ai-kind">
              <span className="t-sub w-full font-semibold text-slate-700">무슨 글인가요?</span>
              {GOT_KINDS.map((k) => (
                <button key={k} type="button" aria-pressed={gotKind === k} onClick={() => setGotKind(k)} className={mkChip(gotKind === k, 'sky')} data-testid="content-ai-kind-btn" data-kind={k}>
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            <textarea className={`${inputClass} min-h-40`} value={got} onChange={(e) => (setGot(e.target.value), setResult(null))} placeholder="다른 AI 도구에서 받은 글을 여기에 붙여 넣으세요." aria-label="받은 글 붙여 넣기" data-testid="content-ai-check-input" />
            <button type="button" className={MK_PRIMARY.sky} onClick={run} disabled={!got.trim()} data-testid="content-ai-check-run">
              <ClipboardCheck className="size-4" aria-hidden="true" />
              점검하기
            </button>
            {result && (
              <div ref={resultRef} className="flex scroll-mt-4 flex-col gap-1.5" data-testid="content-ai-check-result" data-warn={warn.length}>
                <p className={`t-sub flex items-start gap-1.5 rounded-(--radius-control) px-3 py-2 font-semibold break-keep ${warn.length ? 'bg-warning-50 text-warning-700' : 'bg-success-50 text-success-700'}`}>
                  {warn.length ? <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                  <span className="min-w-0">{warn.length ? `확인할 곳 ${warn.length}개 — 고친 뒤 다시 [점검하기] 를 눌러 보세요.` : '걸리는 곳이 없어요. 그래도 숫자 · 이름 · 날짜는 한 번 더 눈으로 봐 주세요.'}</span>
                </p>
                <ul className="flex flex-col gap-1.5">
                  {result.map((c) => (
                    <li key={c.key} data-level={c.level} data-key={c.key} className={`t-sub flex items-start gap-2 rounded-(--radius-control) px-3 py-2 break-keep ${c.level === 'must' ? 'bg-danger-50 text-danger-700' : c.level === 'should' ? 'bg-warning-50 text-warning-700' : 'bg-slate-50 text-slate-600'}`} data-testid="content-ai-check-item">
                      {c.level === 'info' ? <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                      <span className="min-w-0">{c.text}</span>
                    </li>
                  ))}
                </ul>
                <ReviewChecklist items={reviewChecklist(gotKind, result, profile)} testId="content-ai-review" />
              </div>
            )}
            <p className="t-meta break-keep text-slate-500">[보관함에 저장] 하면 우리 글처럼 고치기 · 올렸어요 표시 · 한 달 계획에 쓸 수 있어요.</p>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

/* ------------------------------------------------------------------ */
/* D-230 제목 각도 · 올린 뒤 숫자                                           */
/* ------------------------------------------------------------------ */

/** 제목 각도 고르기 — 접어 두고, 펼치면 후보 5개(각도 · 검색 의도 · 제목) */
function AnglePicker({ open, onToggle, cands, sel, onSel, onMore, used, best, video }: { open: boolean; onToggle: () => void; cands: TitleCandidate[]; sel: AngleId | null; onSel: (a: AngleId | null) => void; onMore: () => void; used: AngleId[]; best: string; video: boolean }) {
  const picked = cands.find((c) => c.id === sel)
  return (
    <div className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white p-2.5" data-testid="content-angle" data-open={open ? '1' : '0'}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="tap flex min-h-11 w-full items-center gap-2 text-left" data-testid="content-angle-toggle">
        <ChevronRight aria-hidden="true" className={`size-5 shrink-0 text-sky-500 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        <span className="min-w-0 flex-1">
          <span className="t-sub block font-semibold text-slate-800">제목 각도 고르기 <span className="font-normal text-slate-500">(선택)</span></span>
          <span className="t-meta block break-keep text-slate-600" data-testid="content-angle-summary">
            {picked ? `${picked.label} — ${picked.title}` : `고르지 않으면 주제 제목 그대로 · 후보 ${cands.length}개`}
          </span>
        </span>
      </button>
      {open && (
        <>
          <p className="t-meta break-keep text-slate-600">손님이 찾는 이유(검색 의도)가 서로 다르게 골랐어요. {video ? '영상은 지역을 빼고 괄호 꼬리말을 붙여요.' : '블로그 제목은 25~35자예요.'}</p>
          <button type="button" aria-pressed={!sel} onClick={() => onSel(null)} className={`tap flex min-h-11 items-center rounded-(--radius-control) border px-3 py-1.5 text-left ${!sel ? TONE.sky.on : 'border-slate-200 bg-white hover:border-sky-300'}`} data-testid="content-angle-btn" data-value="">
            <span className="t-sub font-semibold text-slate-800">주제 제목 그대로</span>
          </button>
          {cands.map((c) => (
            <button key={c.id} type="button" aria-pressed={sel === c.id} onClick={() => onSel(c.id)} className={`tap flex min-h-12 flex-col items-start justify-center rounded-(--radius-control) border px-3 py-1.5 text-left ${sel === c.id ? TONE.sky.on : 'border-slate-200 bg-white hover:border-sky-300'}`} data-testid="content-angle-btn" data-value={c.id} data-intent={c.intent}>
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="t-meta font-semibold break-keep text-sky-800">{c.label}</span>
                <span className="t-meta rounded-full bg-sky-100 px-2 font-semibold break-keep text-sky-900" title="손님이 찾는 이유(검색 의도)">{c.intent}</span>
                {c.again && <span className="t-meta rounded-full bg-slate-100 px-2 break-keep text-slate-600">전에 쓴 각도</span>}
              </span>
              <span className="t-body block break-keep text-slate-800" data-testid="content-angle-title">{c.title}</span>
            </button>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onMore} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-full border border-sky-300 bg-white px-3 font-semibold text-sky-800 hover:border-sky-500" data-testid="content-angle-more">
              <RefreshCw className="size-4" aria-hidden="true" />
              다른 각도 보기
            </button>
          </div>
          {used.length > 0 && (
            <p className="t-meta break-keep text-slate-600" data-testid="content-angle-used">
              <b className="font-semibold text-slate-700">이 키워드로 쓴 각도</b> — {used.map((a) => ANGLE_LABEL[a]).join(' · ')}. 같은 각도가 반복되지 않게 빼고 골랐어요.
            </p>
          )}
          {best && (
            <p className="t-meta break-keep text-emerald-800" data-testid="content-angle-best">
              <b className="font-semibold">지난 기록에서 문의 · 저장이 많았던 각도</b> — {best}
            </p>
          )}
        </>
      )}
    </div>
  )
}

const STAT_FIELDS: { key: 'views' | 'saves' | 'inquiries'; label: string }[] = [
  { key: 'views', label: '조회' },
  { key: 'saves', label: '저장 · 공감' },
  { key: 'inquiries', label: '문의' },
]

/** 숫자 짧게 — 1,234 */
function statLine(st: ContentStats): string {
  return STAT_FIELDS.filter((f) => st[f.key] !== undefined).map((f) => `${f.label.split(' ')[0]} ${(st[f.key] as number).toLocaleString('ko-KR')}`).join(' · ')
}

/** 올린 글의 조회 · 저장 · 문의 — 채널 화면에서 본 숫자를 그대로 적는다 */
function StatsBox({ item, onSave }: { item: ContentItem; onSave: (it: ContentItem, st: ContentStats | null) => Promise<boolean> }) {
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(STAT_FIELDS.map((f) => [f.key, item.stats?.[f.key] !== undefined ? String(item.stats?.[f.key]) : ''])))
  const [busy, setBusy] = useState(false)
  const parsed = STAT_FIELDS.map((f) => ({ f, n: vals[f.key].replace(/[^\d]/g, '') }))
  const changed = STAT_FIELDS.some((f) => (vals[f.key].replace(/[^\d]/g, '') || '') !== (item.stats?.[f.key] !== undefined ? String(item.stats?.[f.key]) : ''))
  const submit = async () => {
    if (busy) return
    setBusy(true)
    const st: ContentStats = { at: new Date().toISOString() }
    for (const { f, n } of parsed) if (n) st[f.key] = Math.min(999_999_999, Number(n))
    const empty = STAT_FIELDS.every((f) => st[f.key] === undefined)
    await onSave(item, empty ? null : st)
    setBusy(false)
  }
  return (
    <div className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-white p-3" data-testid="content-stats">
      <p className="t-sub flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold text-emerald-900">
        <BarChart3 className="size-4 shrink-0" aria-hidden="true" />
        올린 뒤 숫자
        <span className="t-meta font-normal break-keep text-emerald-800">{item.stats?.at ? `${localDateOf(item.stats.at).slice(5).replace('-', '/')} 적음` : '블로그 통계 · 인사이트에서 본 숫자를 그대로'}</span>
      </p>
      <div className="grid grid-cols-3 gap-2">
        {STAT_FIELDS.map((f) => (
          <label key={f.key} className="flex min-w-0 flex-col gap-1">
            <span className="t-meta font-semibold break-keep text-slate-700">{f.label}</span>
            <input className={`${inputClass} text-right tabular-nums`} inputMode="numeric" maxLength={11} value={vals[f.key]} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value.replace(/[^\d,]/g, '') }))} placeholder="0" data-testid="content-stats-input" data-key={f.key} />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void submit()} disabled={busy || !changed} data-testid="content-stats-save">
          <Save className="size-4" aria-hidden="true" />
          숫자 저장
        </Button>
        <span className="t-meta break-keep text-slate-600">어떤 제목 각도 · 카드 유형이 잘 됐는지 보관함에 모여요.</span>
      </div>
    </div>
  )
}

/** 보관함 위 '무엇이 잘 됐나' — 숫자를 적은 글만 각도 · 유형별로 */
function PerfBox({ items, rows, onOpen }: { items: readonly ContentItem[]; rows: { item: ContentItem }[]; onOpen: (it: ContentItem) => void }) {
  const perf = useMemo(() => performanceBy(items), [items])
  const posted = rows.filter((r) => r.item.postedAt)
  const need = posted.filter((r) => !r.item.stats)
  if (!posted.length) return null
  const top = perf[0]
  const lead = !!top && top.inquiries + top.saves + top.views > 0
  return (
    <div className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-white p-3" data-testid="content-perf">
      <p className="t-sub flex items-center gap-2 font-semibold text-emerald-900">
        <BarChart3 className="size-4 shrink-0" aria-hidden="true" />
        무엇이 잘 됐나
      </p>
      {perf.length === 0 ? (
        <p className="t-meta break-keep text-slate-700" data-testid="content-perf-empty">올린 글에 조회 · 저장 · 문의 숫자를 적으면 어떤 제목 각도 · 카드 유형이 잘 됐는지 여기 모여요. 만들기만 해서는 알 수 없어요.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {perf.slice(0, 5).map((r, i) => (
            <li key={r.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-(--radius-control) bg-white px-2.5 py-1.5" data-testid="content-perf-row" data-key={r.key}>
              <span className="t-sub min-w-0 font-semibold break-keep text-slate-800">
                {i === 0 && lead && <span className="mr-1 rounded-full bg-emerald-600 px-2 py-0.5 text-white">1위</span>}
                {r.label}
              </span>
              <span className="t-meta break-keep text-slate-600">
                글 {r.n}편 · 문의 {r.inquiries.toLocaleString('ko-KR')} · 저장 {r.saves.toLocaleString('ko-KR')} · 조회 {r.views.toLocaleString('ko-KR')}
              </span>
            </li>
          ))}
        </ol>
      )}
      {need.length > 0 && (
        <div className="flex flex-col gap-1" data-testid="content-perf-need">
          <span className="t-meta font-semibold text-slate-700">숫자를 아직 안 적은 올린 글 {need.length}편</span>
          <div className="flex flex-wrap gap-1.5">
            {need.slice(0, 3).map((r) => (
              <button key={r.item.rootId} type="button" onClick={() => onOpen(r.item)} className="tap t-meta inline-flex min-h-11 max-w-full items-center gap-1 rounded-full border border-emerald-300 bg-white px-3 text-left font-semibold text-emerald-900 hover:border-emerald-500" data-testid="content-perf-need-open">
                <span className="truncate">{r.item.title}</span>
                <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
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
          <PerfBox items={store.items} rows={rows} onOpen={onOpen} />
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
                    {item.input.angle ? ` · 각도 ${ANGLE_LABEL[item.input.angle]}` : ''}
                  </span>
                  {item.stats && (
                    <span className="t-meta w-full font-semibold break-keep text-emerald-700" data-testid="content-archive-stats">
                      {statLine(item.stats)}
                    </span>
                  )}
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
