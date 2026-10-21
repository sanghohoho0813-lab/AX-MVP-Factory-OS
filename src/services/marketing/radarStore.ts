/**
 * 콘텐츠 레이더 저장 (D-194) — 새 데이터 시스템을 만들지 않고 기존 모듈 기록(`moduleData`)을 쓴다.
 *
 *  - `marketing/ideas` — 콘텐츠 수첩(아이디어 → 제작 예정 → 대본 준비 → 촬영 완료 → 게시 완료).
 *  - `marketing/radar_prefs` — 채널 묶음 바꿈 · 사용 여부 · 대표가 더한 채널 · 비중 가이드 · 숨긴 후보(D-195)(작업공간마다 한 줄).
 *  - 작업공간(workspace)마다 따로 — 클라우드는 module_data 표의 RLS(그 작업공간 사람만), 로컬은 사용자별 금고(axmvp.*).
 *    팀장(Pilot) 작업공간과 대표 작업공간은 서로 보이지 않는다(D-163 · qa:isolation 이 표 전체를 본다).
 *  - 영상 제목 · 숫자는 공개된 유튜브 정보만. 대본 · 자막은 저장하지 않는다(이번 단계에서 만들지 않는다).
 *  - 나중에 대본 만들기(LLM)를 붙일 때는 toContentBrief() 가 넘길 모양이다 — 지금은 호출 0(복사해서 쓰는 글만).
 *  - D-231 '내 콘텐츠' — 같은 수첩 줄에 촬영일 · 게시일 · 체크리스트 · 게시 주소 · 첫 문장 · 직접 적은 주제(custom)를 더했다(새 표 없음).
 */
import { generateId } from '../../storage/localStore'
import { nowIso, todayLocalDate } from '../../lib/appClock'
import { deleteRow, listRows, saveRow } from '../moduleData'
import { isGroup, normalizeMix, type BenchmarkChannelGroup, type ContentAxis, type MixGuide, type Opportunity } from './ytRadar'
import { shootKit } from './shootKit'

const MODULE = 'marketing'
const IDEAS = 'ideas'
const PREFS = 'radar_prefs'

/* ------------------------------------------------------------------ */
/* 콘텐츠 수첩                                                            */
/* ------------------------------------------------------------------ */

export type IdeaStatus = 'idea' | 'selected' | 'script' | 'filmed' | 'published'
export const IDEA_STATUSES: readonly IdeaStatus[] = ['idea', 'selected', 'script', 'filmed', 'published']
export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = { idea: '아이디어', selected: '제작 예정', script: '대본 준비', filmed: '촬영 완료', published: '게시 완료' }

export interface ContentIdea {
  id: string
  /** 같은 후보를 두 번 담지 않게 — '축:주제' */
  key: string
  topic: string
  topicId: string
  /** MIRAE 관점 */
  angle: string
  type: ContentAxis
  benchmarkVideoIds: string[]
  /** 참고 영상 제목(화면에 다시 보여 줄 때 · 데이터를 다시 받지 않아도) */
  benchmarkTitles: string[]
  titleCandidates: string[]
  thumbnailCandidates: string[]
  /** 담을 때의 근거 문장 */
  whyNow: string[]
  savedAt: string
  status: IdeaStatus
  memo: string
  /** D-231 첫 문장(찍기 키트) */
  hook: string
  /** D-231 촬영일 · 게시일(YYYY-MM-DD, 없으면 '') */
  shootDate: string
  publishDate: string
  /** D-231 체크리스트 — 끝낸 칸 번호(MAKE_CHECKS) */
  checks: MakeCheckId[]
  /** D-231 올린 주소(https 만) */
  link: string
  /** D-231 레이더에서 담음 · 직접 적음 */
  source: 'radar' | 'custom'
  /** D-241 AI 도우미 [대본 끝까지] 로 쓴 대본(이 줄에 저장 · 없으면 '') */
  script: string
}

/** D-231 만들기 체크리스트 — 찍고 올리고 나눠 올리기까지 */
export const MAKE_CHECKS = [
  { id: 'title', label: '제목 · 썸네일 문구' },
  { id: 'script', label: '대본 · 첫 문장' },
  { id: 'shoot', label: '촬영' },
  { id: 'edit', label: '편집 · 자막' },
  { id: 'upload', label: '업로드(제목 · 설명 · 태그)' },
  { id: 'shorts', label: '쇼츠로 잘라 올리기' },
  { id: 'promo', label: '블로그 · 카드뉴스로 나눠 올리기' },
] as const
export type MakeCheckId = (typeof MAKE_CHECKS)[number]['id']
const CHECK_IDS: readonly string[] = MAKE_CHECKS.map((c) => c.id)
const DAY = /^\d{4}-\d{2}-\d{2}$/
const day = (v: unknown) => (typeof v === 'string' && DAY.test(v) ? v : '')

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.slice(0, max) : '')
const strs = (v: unknown, n: number, max = 200) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, n).map((x) => x.slice(0, max)) : [])
const isAxis = (v: unknown): v is ContentAxis => v === 'market' || v === 'axai' || v === 'bridge'
const isStatus = (v: unknown): v is IdeaStatus => typeof v === 'string' && (IDEA_STATUSES as readonly string[]).includes(v)

export function normalizeIdea(raw: Record<string, unknown>, id: string): ContentIdea | null {
  const topic = str(raw.topic, 120).trim()
  if (!topic) return null
  return {
    id,
    key: str(raw.key, 120) || `${isAxis(raw.type) ? raw.type : 'market'}:${str(raw.topicId, 60)}`,
    topic,
    topicId: str(raw.topicId, 60),
    angle: str(raw.angle, 400),
    type: isAxis(raw.type) ? raw.type : 'market',
    benchmarkVideoIds: strs(raw.benchmarkVideoIds, 5, 40),
    benchmarkTitles: strs(raw.benchmarkTitles, 5, 200),
    titleCandidates: strs(raw.titleCandidates, 5, 200),
    thumbnailCandidates: strs(raw.thumbnailCandidates, 4, 80),
    whyNow: strs(raw.whyNow, 5, 200),
    savedAt: str(raw.savedAt, 40) || nowIso(),
    status: isStatus(raw.status) ? raw.status : 'idea',
    memo: str(raw.memo, 1000),
    hook: str(raw.hook, 200),
    shootDate: day(raw.shootDate),
    publishDate: day(raw.publishDate),
    checks: Array.isArray(raw.checks) ? [...new Set(raw.checks.filter((c): c is MakeCheckId => typeof c === 'string' && CHECK_IDS.includes(c)))] : [],
    link: typeof raw.link === 'string' && /^https:\/\/[^\s<>"']{4,}$/.test(raw.link) ? raw.link.slice(0, 300) : '',
    source: raw.source === 'custom' ? 'custom' : 'radar',
    script: str(raw.script, SCRIPT_MAX),
  }
}

/** D-241 대본 한 편 — 12분 롱폼 대사 + 화면 글 + 제목 · 썸네일 · 설명란이 넉넉히 들어가게 */
export const SCRIPT_MAX = 20000

/** D-231 레이더에 없는 주제를 직접 적어 담기 */
export function customIdea(topic: string, memo = ''): Omit<ContentIdea, 'id' | 'savedAt'> {
  const t = topic.trim().slice(0, 120)
  return { ...EMPTY_EXTRA, key: `custom:${generateId()}`, topic: t, topicId: '', angle: '', type: 'market', benchmarkVideoIds: [], benchmarkTitles: [], titleCandidates: [], thumbnailCandidates: [], whyNow: [], status: 'selected', memo: memo.trim().slice(0, 1000), source: 'custom' }
}

const EMPTY_EXTRA = { hook: '', shootDate: '', publishDate: '', checks: [] as MakeCheckId[], link: '', source: 'radar' as const, script: '' }

/** D-231 이번 주(월~일) 일정 — 촬영일 · 게시일이 이번 주인 것, 날짜 순 */
export interface WeekItem {
  date: string
  what: 'shoot' | 'publish'
  idea: ContentIdea
}
export function weekRange(today = todayLocalDate()): { from: string; to: string } {
  const d = new Date(`${today}T00:00:00Z`)
  const dow = (d.getUTCDay() + 6) % 7
  const from = new Date(d.getTime() - dow * 86_400_000).toISOString().slice(0, 10)
  const to = new Date(d.getTime() + (6 - dow) * 86_400_000).toISOString().slice(0, 10)
  return { from, to }
}
export function weekSchedule(ideas: readonly ContentIdea[], today = todayLocalDate()): WeekItem[] {
  const { from, to } = weekRange(today)
  const out: WeekItem[] = []
  for (const i of ideas) {
    if (i.shootDate && i.shootDate >= from && i.shootDate <= to && i.status !== 'published') out.push({ date: i.shootDate, what: 'shoot', idea: i })
    if (i.publishDate && i.publishDate >= from && i.publishDate <= to) out.push({ date: i.publishDate, what: 'publish', idea: i })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.what === 'shoot' ? -1 : 1))
}

/** D-231 단계마다 몇 개 */
export function stageCounts(ideas: readonly ContentIdea[]): Record<IdeaStatus, number> {
  const out = Object.fromEntries(IDEA_STATUSES.map((s) => [s, 0])) as Record<IdeaStatus, number>
  for (const i of ideas) out[i.status] += 1
  return out
}

/** D-231 날짜가 지난 일(촬영일이 지났는데 촬영 전 · 게시일이 지났는데 게시 전) */
export function lateOf(i: ContentIdea, today = todayLocalDate()): 'shoot' | 'publish' | null {
  if (i.status === 'published') return null
  if (i.publishDate && i.publishDate < today) return 'publish'
  if (i.shootDate && i.shootDate < today && (i.status === 'idea' || i.status === 'selected' || i.status === 'script')) return 'shoot'
  return null
}

/** 후보 카드 → 수첩에 담을 모양 */
export function ideaFromOpportunity(o: Opportunity): Omit<ContentIdea, 'id' | 'savedAt' | 'status' | 'memo' | 'shootDate' | 'publishDate' | 'checks' | 'link' | 'source' | 'script'> & Partial<Pick<ContentIdea, 'source'>> {
  return {
    key: o.key,
    hook: shootKit(o).hook,
    source: 'radar',
    topic: o.topic,
    topicId: o.topicId,
    angle: o.view,
    type: o.axis,
    benchmarkVideoIds: o.benchmarks.map((b) => b.id),
    benchmarkTitles: o.benchmarks.map((b) => `${b.title} (${b.channelName})`),
    titleCandidates: o.titles.map((t) => t.text),
    thumbnailCandidates: [...o.thumbs],
    whyNow: [...o.whyNow],
  }
}

/**
 * [이번 주로 확정](D-195) — 새 저장 방식을 만들지 않고 수첩(ContentIdea)에 '제작 예정' 으로 담는다.
 * 이미 수첩에 있으면 그 줄의 단계만 바꾼다(새 줄을 만들지 않는다). 이미 대본 준비 · 촬영 · 게시까지 갔으면 단계를 되돌리지 않는다.
 */
export function confirmInput(o: Opportunity, ideas: readonly ContentIdea[]): { input: Parameters<typeof saveIdea>[1]; existed: boolean; changed: boolean } {
  const old = ideas.find((i) => i.key === o.key)
  if (old) {
    const changed = old.status === 'idea'
    return { input: { ...old, status: changed ? 'selected' : old.status }, existed: true, changed }
  }
  return { input: { ...ideaFromOpportunity(o), status: 'selected' }, existed: false, changed: true }
}

/** 이번 주 제작 예정(머리에 작게) — 최근 담은 것부터 3개까지 */
export const selectedIdeas = (ideas: readonly ContentIdea[], n = 3) => ideas.filter((i) => i.status === 'selected').slice(0, n)

export async function listIdeas(workspaceId: string | null): Promise<ContentIdea[]> {
  const rows = await listRows(workspaceId, MODULE, IDEAS)
  return rows
    .map((r) => normalizeIdea(r.data, r.id))
    .filter((x): x is ContentIdea => x !== null)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

/** 저장할 때 받는 모양 — D-231 새 칸은 없어도 된다(예전 줄 · 예전 부르는 곳 그대로) */
export type IdeaInput = Omit<ContentIdea, 'id' | 'savedAt' | 'status' | 'memo' | 'hook' | 'shootDate' | 'publishDate' | 'checks' | 'link' | 'source' | 'script'> &
  Partial<Pick<ContentIdea, 'id' | 'savedAt' | 'status' | 'memo' | 'hook' | 'shootDate' | 'publishDate' | 'checks' | 'link' | 'source' | 'script'>>

export async function saveIdea(workspaceId: string | null, input: IdeaInput): Promise<ContentIdea> {
  const id = input.id ?? `idea_${generateId()}`
  const clean = normalizeIdea({ ...input, savedAt: input.savedAt ?? nowIso(), status: input.status ?? 'idea', memo: input.memo ?? '' }, id)
  if (!clean) throw new Error('주제가 비어 있습니다.')
  const { id: _i, ...data } = clean
  void _i
  await saveRow(workspaceId, MODULE, IDEAS, { id, data: data as unknown as Record<string, unknown> })
  return clean
}

export async function removeIdea(workspaceId: string | null, id: string): Promise<void> {
  await deleteRow(workspaceId, MODULE, IDEAS, id)
}

/**
 * 나중에 대본 만들기로 넘길 모양 — ContentOpportunity → ContentBrief → (다음 단계) ScriptGeneration.
 * 지금은 사람이 복사해서 쓰는 글(briefText)만 만든다(외부 호출 0).
 */
export interface ContentBrief {
  topic: string
  type: ContentAxis
  audience: string
  angle: string
  titleCandidates: string[]
  thumbnailCandidates: string[]
  evidence: string[]
  references: Array<{ videoId: string; url: string; title: string }>
}

export function toContentBrief(i: ContentIdea): ContentBrief {
  return {
    topic: i.topic,
    type: i.type,
    audience: '중소기업 · 소상공인 대표',
    angle: i.angle,
    titleCandidates: i.titleCandidates,
    thumbnailCandidates: i.thumbnailCandidates,
    evidence: i.whyNow,
    references: i.benchmarkVideoIds.map((id, k) => ({ videoId: id, url: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`, title: i.benchmarkTitles[k] ?? '' })),
  }
}

const AXIS_WORD: Record<ContentAxis, string> = { market: '시장수요형', axai: 'AX · AI 실무형', bridge: 'BRIDGE형(시장 주제 + AX)' }

/** 복사용 브리프 — 참고 영상 제목은 '참고' 로만(그대로 베끼지 않는다는 말을 같이 적는다) */
export function briefText(i: ContentIdea): string {
  const b = toContentBrief(i)
  return [
    `[콘텐츠 브리프] ${b.topic}`,
    `유형: ${AXIS_WORD[b.type]} · 시청자: ${b.audience}`,
    `이렇게 말해요: ${b.angle}`,
    ...(i.hook ? [`첫 문장: ${i.hook}`] : []),
    ...(i.shootDate || i.publishDate ? [`일정: ${i.shootDate ? `촬영 ${i.shootDate}` : ''}${i.shootDate && i.publishDate ? ' · ' : ''}${i.publishDate ? `게시 ${i.publishDate}` : ''}`] : []),
    '',
    '제목 후보',
    ...b.titleCandidates.map((t, k) => `${k + 1}. ${t}`),
    '',
    `썸네일 문구 후보: ${b.thumbnailCandidates.join(' / ')}`,
    '',
    '왜 지금',
    ...b.evidence.map((e) => `- ${e}`),
    '',
    '참고한 벤치마킹 영상(주제 · 구조 참고용 — 제목 · 대사를 그대로 쓰지 않는다)',
    ...b.references.map((r) => `- ${r.title} ${r.url}`),
  ].join('\n')
}

/* ------------------------------------------------------------------ */
/* 채널 설정 · 비중 가이드                                                  */
/* ------------------------------------------------------------------ */

export interface AddedChannel {
  id: string
  title: string
  handle: string
  group: BenchmarkChannelGroup
  note: string
  subs: number
  addedAt: string
}

/**
 * D-241 채널 설계 기준 — AI 도우미가 기획 · 대본을 쓸 때 늘 따르는 것(대표가 고친다).
 * 대표: "기획을 할 거면 정확히 내 컨텐츠에 맞게 설계". 처음에는 아래 기본값 — 고치면 그것이 기준.
 */
export interface ChannelBrief {
  channel: string
  host: string
  audience: string
  covers: string
  avoid: string
  tone: string
  format: string
  ending: string
}

export const BRIEF_FIELDS: ReadonlyArray<{ key: keyof ChannelBrief; label: string; hint: string }> = [
  { key: 'channel', label: '채널', hint: '이름 · 무엇을 하는 채널인지' },
  { key: 'host', label: '화자', hint: '누가 말하나(이름 · 경력)' },
  { key: 'audience', label: '시청자', hint: '누가 보나' },
  { key: 'covers', label: '다루는 것', hint: '이 채널의 주제' },
  { key: 'avoid', label: '다루지 않는 것 · 쓰지 않는 말', hint: '기획에서 빼야 할 것' },
  { key: 'tone', label: '말투', hint: '어떻게 말하나' },
  { key: 'format', label: '형식 · 길이', hint: '롱폼 · 쇼츠 · 분량 · 구성' },
  { key: 'ending', label: '끝맺음', hint: '영상 끝에 시청자에게 바라는 행동' },
]

export const DEFAULT_BRIEF: ChannelBrief = {
  channel: '김팀장의 경영노트 — 미래AI랩이 운영하는 중소기업 경영 채널',
  host: '김팀장(미래AI랩) — 중소기업 대표를 수백 곳 상담해 온 경영 컨설턴트',
  audience: '중소기업 · 소상공인 대표(50~60대 포함)와 경리 · 실무자',
  covers: '정책자금 · 고용지원금 · 기업부설연구소 · 창업감면 · 절세 · 지원사업 · 기업인증, 그리고 이 일들에 AI 를 붙여 실제로 시간을 줄이는 법(AX)',
  avoid: '일반적인 AI 도구 기능 소개 · "N배 빨라진다 · N분 컷 · 퇴근이 빨라진다 · 꿀팁 · 충격" 같은 상투어 · 근거 없는 금액 약속 · 남의 영상 제목 · 대사 베끼기',
  tone: '상담실에서 대표님께 말하듯 — 쉬운 말, 과장 없이, 실제 상담에서 본 장면과 숫자로',
  format: '롱폼 8~12분(문제 → 왜 생기나 → 실제 사례 → 해결 순서 → 체크리스트) + 롱폼에서 자른 쇼츠 1~2편',
  ending: '"우리 회사는 해당되는지" 궁금하면 설명란 링크로 무료 상담 신청',
}

const BRIEF_MAX = 300

export function normalizeBrief(raw: unknown): ChannelBrief | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const out = {} as ChannelBrief
  let any = false
  for (const f of BRIEF_FIELDS) {
    const v = str(r[f.key], BRIEF_MAX).trim()
    out[f.key] = v || DEFAULT_BRIEF[f.key]
    if (v) any = true
  }
  return any ? out : null
}

export const briefOf = (prefs: Pick<RadarPrefs, 'brief'>): ChannelBrief => prefs.brief ?? DEFAULT_BRIEF

export interface RadarPrefs {
  /** 정해 둔 채널의 묶음 바꿈 · 사용 여부(끄면 계산에서 뺀다) */
  overrides: Record<string, { group?: BenchmarkChannelGroup; enabled?: boolean }>
  /** 대표가 [채널 추가] 로 더한 채널 — 10곳까지 */
  added: AddedChannel[]
  mix: MixGuide
  /** [관심 없음] 으로 숨긴 후보 — Opportunity.key('축:주제') 그대로. 정확히 그 후보만 빠진다(D-195) */
  muted: string[]
  /** D-241 채널 설계 기준(null = 기본값 DEFAULT_BRIEF) */
  brief: ChannelBrief | null
}

export const MAX_ADDED = 10
export const MAX_MUTED = 60
export const EMPTY_PREFS: RadarPrefs = { overrides: {}, added: [], mix: normalizeMix(null), muted: [], brief: null }
/** 숨긴 후보 키 — '시장수요 · AX·AI · BRIDGE : 주제 번호' 모양만 */
const MUTED_KEY = /^(market|axai|bridge):[a-z_]{1,40}$/

const UC = /^UC[\w-]{22}$/
/** 묶음 바꿈 · 끄기는 받아 온 채널 번호 그대로(예시 채널 'sample_ch_3' 도) — 글자 · 숫자 · _ · - 만 */
const CHANNEL_KEY = /^[\w-]{1,64}$/

export function normalizePrefs(raw: unknown): RadarPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const overrides: RadarPrefs['overrides'] = {}
  if (r.overrides && typeof r.overrides === 'object') {
    for (const [id, v] of Object.entries(r.overrides as Record<string, unknown>)) {
      if (!CHANNEL_KEY.test(id) || !v || typeof v !== 'object') continue
      const o = v as Record<string, unknown>
      const one: { group?: BenchmarkChannelGroup; enabled?: boolean } = {}
      if (isGroup(o.group)) one.group = o.group
      if (typeof o.enabled === 'boolean') one.enabled = o.enabled
      if (Object.keys(one).length) overrides[id] = one
    }
  }
  const seen = new Set<string>()
  const added: AddedChannel[] = []
  if (Array.isArray(r.added)) {
    for (const a of r.added as Array<Record<string, unknown>>) {
      const id = str(a?.id, 40)
      if (!UC.test(id) || seen.has(id) || added.length >= MAX_ADDED) continue
      seen.add(id)
      added.push({
        id,
        title: str(a.title, 80) || id,
        handle: str(a.handle, 80),
        group: isGroup(a.group) ? a.group : 'ai',
        note: str(a.note, 120),
        subs: Math.max(0, Math.round(Number(a.subs) || 0)),
        addedAt: str(a.addedAt, 40) || nowIso(),
      })
    }
  }
  const muted = Array.isArray(r.muted) ? [...new Set((r.muted as unknown[]).filter((k): k is string => typeof k === 'string' && MUTED_KEY.test(k)))].slice(0, MAX_MUTED) : []
  return { overrides, added, mix: normalizeMix(r.mix as Partial<MixGuide> | undefined), muted, brief: normalizeBrief(r.brief) }
}

/** 작업공간마다 한 줄 — 번호는 작업공간 번호로(클라우드 표의 번호는 모든 작업공간에서 하나여야 한다) */
const prefsId = (workspaceId: string | null) => `radarprefs_${workspaceId ?? 'local'}`

export async function loadPrefs(workspaceId: string | null): Promise<RadarPrefs> {
  const rows = await listRows(workspaceId, MODULE, PREFS)
  const row = rows.find((r) => r.id === prefsId(workspaceId)) ?? rows[0]
  return row ? normalizePrefs(row.data) : EMPTY_PREFS
}

export async function savePrefs(workspaceId: string | null, prefs: RadarPrefs): Promise<RadarPrefs> {
  const clean = normalizePrefs(prefs)
  await saveRow(workspaceId, MODULE, PREFS, { id: prefsId(workspaceId), data: clean as unknown as Record<string, unknown> })
  return clean
}

/* ------------------------------------------------------------------ */
/* D-241 AI 기획 → 내 콘텐츠 · 대본                                        */
/* ------------------------------------------------------------------ */

/** AI 답의 기획 한 개(AssistItem 과 같은 모양 — 여기서는 쓰는 칸만) */
export interface AiPlanItem {
  title: string
  detail?: string
  tag?: string
  outline?: string[]
  body?: string
}

/** 담을 때 메모 — 무엇을 왜 · 구성(1,000자 안) */
export function aiPlanMemo(item: AiPlanItem, stamp: string): string {
  const lines = [`[AI 기획 ${stamp}]${item.tag ? ` ${item.tag}` : ''}`]
  if (item.detail) lines.push(item.detail.trim())
  if (item.outline?.length) lines.push('구성', ...item.outline.slice(0, 10).map((o) => `- ${o.trim()}`))
  return lines.join('\n').slice(0, 1000)
}

/**
 * AI 기획 → 내 콘텐츠 '제작 예정' 줄.
 * 레이더 후보(opp)에서 나온 기획이면 그 후보 줄(같은 key)에 합친다 — 이미 있으면 새 줄을 만들지 않고 제목 후보 · 첫 문장 · 메모만 더한다.
 * 이미 대본 준비 · 촬영 · 게시까지 갔으면 단계를 되돌리지 않는다.
 */
export function aiPlanInput(item: AiPlanItem, opp: Opportunity | null, ideas: readonly ContentIdea[], stamp: string, targetId?: string): { input: IdeaInput; existed: boolean } {
  const title = item.title.trim().slice(0, 120)
  const memo = aiPlanMemo(item, stamp)
  const hook = (item.body ?? '').trim().slice(0, 200)
  // targetId — 답이 '내 콘텐츠' 줄 번호(i#)를 가리키면 그 줄에
  const old = (targetId ? ideas.find((i) => i.id === targetId) : undefined) ?? (opp ? ideas.find((i) => i.key === opp.key) : undefined) ?? ideas.find((i) => i.topic === title || i.titleCandidates[0] === title)
  if (old) {
    const titles = [title, ...old.titleCandidates.filter((t) => t !== title)].slice(0, 5)
    const mergedMemo = old.memo.includes(memo.split('\n')[0]) ? old.memo : [memo, old.memo].filter(Boolean).join('\n\n').slice(0, 1000)
    return { input: { ...old, titleCandidates: titles, hook: old.hook || hook, memo: mergedMemo, status: old.status === 'idea' ? 'selected' : old.status }, existed: true }
  }
  if (opp) {
    const base = ideaFromOpportunity(opp)
    return {
      input: { ...base, titleCandidates: [title, ...base.titleCandidates.filter((t) => t !== title)].slice(0, 5), hook: hook || base.hook, memo, status: 'selected' },
      existed: false,
    }
  }
  const c = customIdea(title, memo)
  return { input: { ...c, angle: (item.detail ?? '').trim().slice(0, 400), hook, titleCandidates: [title] }, existed: false }
}
