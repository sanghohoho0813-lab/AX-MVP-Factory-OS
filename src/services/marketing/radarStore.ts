/**
 * 콘텐츠 레이더 저장 (D-194) — 새 데이터 시스템을 만들지 않고 기존 모듈 기록(`moduleData`)을 쓴다.
 *
 *  - `marketing/ideas` — 콘텐츠 수첩(아이디어 → 제작 예정 → 대본 준비 → 촬영 완료 → 게시 완료).
 *  - `marketing/radar_prefs` — 채널 묶음 바꿈 · 사용 여부 · 대표가 더한 채널 · 비중 가이드(작업공간마다 한 줄).
 *  - 작업공간(workspace)마다 따로 — 클라우드는 module_data 표의 RLS(그 작업공간 사람만), 로컬은 사용자별 금고(axmvp.*).
 *    팀장(Pilot) 작업공간과 대표 작업공간은 서로 보이지 않는다(D-163 · qa:isolation 이 표 전체를 본다).
 *  - 영상 제목 · 숫자는 공개된 유튜브 정보만. 대본 · 자막은 저장하지 않는다(이번 단계에서 만들지 않는다).
 *  - 나중에 대본 만들기(LLM)를 붙일 때는 toContentBrief() 가 넘길 모양이다 — 지금은 호출 0(복사해서 쓰는 글만).
 */
import { generateId } from '../../storage/localStore'
import { nowIso } from '../../lib/appClock'
import { deleteRow, listRows, saveRow } from '../moduleData'
import { isGroup, normalizeMix, type BenchmarkChannelGroup, type ContentAxis, type MixGuide, type Opportunity } from './ytRadar'

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
}

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
  }
}

/** 후보 카드 → 수첩에 담을 모양 */
export function ideaFromOpportunity(o: Opportunity): Omit<ContentIdea, 'id' | 'savedAt' | 'status' | 'memo'> {
  return {
    key: o.key,
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

export async function listIdeas(workspaceId: string | null): Promise<ContentIdea[]> {
  const rows = await listRows(workspaceId, MODULE, IDEAS)
  return rows
    .map((r) => normalizeIdea(r.data, r.id))
    .filter((x): x is ContentIdea => x !== null)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export async function saveIdea(workspaceId: string | null, input: Omit<ContentIdea, 'id' | 'savedAt' | 'status' | 'memo'> & Partial<Pick<ContentIdea, 'id' | 'savedAt' | 'status' | 'memo'>>): Promise<ContentIdea> {
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
    `MIRAE 관점: ${b.angle}`,
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

export interface RadarPrefs {
  /** 정해 둔 채널의 묶음 바꿈 · 사용 여부(끄면 계산에서 뺀다) */
  overrides: Record<string, { group?: BenchmarkChannelGroup; enabled?: boolean }>
  /** 대표가 [채널 추가] 로 더한 채널 — 10곳까지 */
  added: AddedChannel[]
  mix: MixGuide
}

export const MAX_ADDED = 10
export const EMPTY_PREFS: RadarPrefs = { overrides: {}, added: [], mix: normalizeMix(null) }

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
  return { overrides, added, mix: normalizeMix(r.mix as Partial<MixGuide> | undefined) }
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
