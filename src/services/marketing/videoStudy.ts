/**
 * D-259 · D-260 벤치마킹 영상 한 편 깊게 보기 — 대표: "영상 상세정보 딱 눌러보면 해당 롱폼영상 풀 대본도 같이 나오면" ·
 * "버튼 딱 클릭하면 저 내용에서 최대한 비슷하게 가져올 수 있는 내용을 우리 회사 정보에 맞게 딱 추천".
 *
 *   대본 받아 적기(radar.transcript) — 서버가 영상 번호로 YouTube 주소를 만들어 Gemini 에 영상 그대로 붙인다. 60초 안에 답하게 10분씩 나눠
 *     세 구간씩 동시에 부르고, 받은 구간부터 보인다. 다 받은 대본은 영상마다 이 브라우저(사람별 금고)에 남는다.
 *   우리 회사 버전(radar.adapt) — 영상 숫자 · 참고할 것 · (있으면) 대본 · 채널 설계 기준 · 규칙집으로 우리 채널 한 편을 기획 → [내 콘텐츠에 담기].
 *
 * 이 파일은 계산 · 저장 · 모양만(화면 없음 · 단위 시험).
 */
import { safeText, type AssistContext } from '../aiAssist/context'
import { MIRAE_PROFILE } from '../aiAssist/builders'
import { customerProfileLines, isMarketingCustomer, mkText } from './persona'
import { packRules } from './contentPack'
import { BRIEF_FIELDS, defaultBrief, type ChannelBrief, type IdeaInput } from './radarStore'
import type { AssistAnswer } from '../aiAssist/client'
import type { RadarVideo } from './ytRadar'

/** 한 번에 받아 적는 구간(초) — 서버 끝은 15분(VIDEO_SEGMENT_MAX) */
export const TRANSCRIPT_SEGMENT = 600
/** 받아 적는 끝 — 이보다 긴 영상은 앞부분만(2시간) */
export const TRANSCRIPT_MAX_SEC = 2 * 3600
/** 동시에 부르는 구간 수 */
export const TRANSCRIPT_PARALLEL = 3

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/
/** 서버가 받아 줄 영상 번호인가(예시 영상 · 이상한 번호는 받아 적기 없음) */
export const canTranscribe = (id: string) => VIDEO_ID_RE.test(id) && !id.startsWith('sample_')

export interface Segment {
  start: number
  end: number
}

/** 영상 길이 → 구간들(10분씩 · 2시간까지). 길이를 모르면 앞 10분 */
export function transcriptSegments(durationSec: number): Segment[] {
  const total = Number.isFinite(durationSec) && durationSec > 0 ? Math.min(Math.ceil(durationSec), TRANSCRIPT_MAX_SEC) : TRANSCRIPT_SEGMENT
  const out: Segment[] = []
  for (let s = 0; s < total; s += TRANSCRIPT_SEGMENT) out.push({ start: s, end: Math.min(total, s + TRANSCRIPT_SEGMENT) })
  // 마지막 구간이 너무 짧으면(1분 안) 앞 구간에 붙인다 — 부르는 횟수 ↓ (서버 끝 15분 안)
  if (out.length > 1 && out[out.length - 1].end - out[out.length - 1].start < 60) {
    const last = out.pop() as Segment
    out[out.length - 1].end = last.end
  }
  return out
}

/** '1:02:03' · '12:05' · '0:07' → 초. 모르면 null */
export function parseClock(raw: string): number | null {
  const m = /^\s*(?:(\d{1,2}):)?(\d{1,3}):(\d{2})\s*$/.exec(raw ?? '')
  if (!m) return null
  const h = m[1] ? Number(m[1]) : 0
  const mm = Number(m[2])
  const ss = Number(m[3])
  if (ss > 59 || (m[1] && mm > 59)) return null
  return h * 3600 + mm * 60 + ss
}

export function clockOf(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export interface TranscriptLine {
  t: number
  text: string
  /** 말 없이 화면 글 */
  screen?: boolean
}

export interface TranscriptPart extends Segment {
  status: 'done' | 'error'
  lines: TranscriptLine[]
  headline?: string
  error?: string
}

export interface TranscriptDoc {
  id: string
  title: string
  at: string
  model: string
  duration: number
  parts: TranscriptPart[]
}

/**
 * AI 답(항목 = 말 덩어리) → 줄. title 의 시각을 읽고(모르면 구간 처음), 구간 밖 시각은 구간 안으로 · 시각 순.
 * 빈 말은 버린다.
 */
export function partLines(items: AssistAnswer['items'] | undefined, seg: Segment): TranscriptLine[] {
  const raw: { t: number | null; text: string; screen: boolean }[] = []
  for (const it of items ?? []) {
    const text = (it.body ?? it.detail ?? '').trim()
    if (!text) continue
    raw.push({ t: parseClock(it.title ?? ''), text: text.slice(0, 4000), screen: /화면\s*글/.test(it.detail ?? '') && !!it.body })
  }
  // 뒷 구간인데 시각이 모두 구간 처음보다 앞이면(구간 처음부터 센 시각으로 답함) 구간 처음을 더한다 — 모두 구간 처음으로 몰리지 않게
  const known = raw.map((r) => r.t).filter((t): t is number => t !== null)
  const shift = seg.start > 0 && known.length > 0 && known.every((t) => t < seg.start) && Math.max(...known) <= seg.end - seg.start ? seg.start : 0
  const out = raw.map((r) => {
    const t0 = r.t === null ? seg.start : r.t + shift
    const t = Math.min(Math.max(t0, seg.start), Math.max(seg.start, seg.end - 1))
    return { t, text: r.text, ...(r.screen ? { screen: true } : {}) }
  })
  return out.sort((a, b) => a.t - b.t)
}

export const transcriptDone = (d: TranscriptDoc | null, segs: readonly Segment[]) => !!d && segs.every((s) => d.parts.some((p) => p.start === s.start && p.status === 'done'))
export const transcriptLines = (d: TranscriptDoc | null): TranscriptLine[] => (d ? d.parts.filter((p) => p.status === 'done').flatMap((p) => p.lines).sort((a, b) => a.t - b.t) : [])

/** 복사 · 저장용 글 — "0:00  말" 한 줄씩 */
export function transcriptText(d: TranscriptDoc | null): string {
  const lines = transcriptLines(d)
  if (!d || !lines.length) return ''
  return [`[대본] ${d.title}`, ...lines.map((l) => `${clockOf(l.t)}  ${l.screen ? '(화면 글) ' : ''}${l.text}`)].join('\n')
}

/* ------------------------------------------------------------------ */
/* 저장 — 영상마다 대본 · 우리 버전(이 브라우저 · 사람별 금고)                 */
/* ------------------------------------------------------------------ */

export const TRANSCRIPT_KEY = 'axmvp.mk.transcript.v1'
export const ADAPT_KEY = 'axmvp.mk.adapt.v1'
/** 남기는 영상 수(오래된 것부터 버림) */
export const STUDY_KEEP = 30

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

export function parseTranscripts(raw: string | null): Record<string, TranscriptDoc> {
  try {
    const v = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    const out: Record<string, TranscriptDoc> = {}
    for (const [id, d0] of Object.entries(v)) {
      const d = d0 as Record<string, unknown>
      if (!canTranscribe(id) || !d || typeof d !== 'object' || !Array.isArray(d.parts)) continue
      const parts: TranscriptPart[] = []
      for (const p0 of d.parts as Record<string, unknown>[]) {
        if (!p0 || typeof p0 !== 'object') continue
        const start = Number(p0.start)
        const end = Number(p0.end)
        if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) continue
        const lines = Array.isArray(p0.lines)
          ? (p0.lines as Record<string, unknown>[]).filter((l) => l && typeof l.text === 'string' && Number.isFinite(Number(l.t))).slice(0, 400).map((l) => ({ t: Number(l.t), text: str(l.text, 4000), ...(l.screen === true ? { screen: true } : {}) }))
          : []
        parts.push({ start, end, status: p0.status === 'done' ? 'done' : 'error', lines, headline: str(p0.headline, 300) || undefined, error: p0.status === 'done' ? undefined : str(p0.error, 300) || '받지 못했어요' })
      }
      out[id] = { id, title: str(d.title, 200), at: str(d.at, 40), model: str(d.model, 80), duration: Number(d.duration) || 0, parts }
    }
    return out
  } catch {
    return {}
  }
}

/** 새 것을 넣고 오래된 것부터 STUDY_KEEP 개까지 */
export function keepLatest<T extends { at: string }>(all: Record<string, T>, id: string, doc: T): Record<string, T> {
  const next = { ...all, [id]: doc }
  const ids = Object.keys(next).sort((a, b) => (next[b].at || '').localeCompare(next[a].at || ''))
  return Object.fromEntries(ids.slice(0, STUDY_KEEP).map((k) => [k, next[k]]))
}

export interface AdaptSaved {
  at: string
  model: string
  answer: AssistAnswer
  /** 대본을 보고 썼는지 */
  withTranscript: boolean
}

export function parseAdapts(raw: string | null): Record<string, AdaptSaved> {
  try {
    const v = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    const out: Record<string, AdaptSaved> = {}
    for (const [id, a0] of Object.entries(v)) {
      const a = a0 as Record<string, unknown>
      const ans = a && (a.answer as Record<string, unknown>)
      if (!id || id.length > 40 || !ans || typeof ans.headline !== 'string' || !Array.isArray(ans.items)) continue
      out[id] = {
        at: str(a.at, 40),
        model: str(a.model, 80),
        withTranscript: a.withTranscript === true,
        answer: {
          headline: str(ans.headline, 300),
          items: (ans.items as Record<string, unknown>[]).filter((i) => i && typeof i.title === 'string').slice(0, 12).map((i) => ({ title: str(i.title, 200), tag: str(i.tag, 40) || undefined, detail: str(i.detail, 1000) || undefined, body: str(i.body, 6000) || undefined, outline: Array.isArray(i.outline) ? (i.outline as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 12).map((x) => x.slice(0, 300)) : undefined })),
          next: Array.isArray(ans.next) ? (ans.next as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 6) : undefined,
          caution: str(ans.caution, 400) || undefined,
        },
      }
    }
    return out
  } catch {
    return {}
  }
}

/* ------------------------------------------------------------------ */
/* 우리 회사 버전 — 보낼 자료 · 받은 답 → 내 콘텐츠                         */
/* ------------------------------------------------------------------ */

/** 대본 줄을 자료로(앞부분부터 · 한 줄 300자 · 모두 합쳐 약 2만 자) */
export function transcriptRows(d: TranscriptDoc | null, budget = 20000): { 시각: string; 말: string }[] {
  const rows: { 시각: string; 말: string }[] = []
  let left = budget
  for (const l of transcriptLines(d)) {
    const text = l.text.slice(0, 300)
    if (left - text.length < 0) break
    left -= text.length
    rows.push({ 시각: clockOf(l.t), 말: text })
  }
  return rows
}

const ratioText = (v: RadarVideo) => (v.ratio === null ? '기준 부족' : `평소의 ${(v.adjusted ?? v.ratio).toFixed(1)}배`)

/**
 * 대본 받아 적기에 보낼 자료 — 영상 이름 · 채널 · 길이만. 채널 설계 기준 · 규칙집 · 앞서 받은 대본은 보내지 않는다
 * (받아 적기는 '들린 그대로' — 마케팅 규칙이 섞이면 고쳐 쓸 수 있다).
 */
export function transcriptContext(v: Pick<RadarVideo, 'title' | 'channelName' | 'durationSec'>, today: string): AssistContext {
  return {
    title: `마케팅 · 벤치마킹 영상 대본 받아 적기 · ${safeText(v.title, [], 60)}`,
    today,
    purpose: '공개 YouTube 영상의 말을 들리는 그대로 받아 적는다',
    sections: [{ name: '영상', rows: [{ 제목: safeText(v.title, [], 160), 채널: safeText(v.channelName, [], 60), 길이: clockOf(v.durationSec) }] }],
  }
}

export function adaptContext(i: { v: RadarVideo; lessons: readonly string[]; brief?: ChannelBrief | null; transcript: TranscriptDoc | null; today: string }): AssistContext {
  const { v } = i
  const brief = i.brief ?? defaultBrief()
  const rows = transcriptRows(i.transcript)
  return {
    title: `마케팅 · 벤치마킹 영상 → 우리 회사 버전 · ${safeText(v.title, [], 60)}`,
    today: i.today,
    purpose: mkText('남의 채널에서 잘 된 영상 하나의 틀을 빌려, 미래AI랩 채널(채널 설계 기준)에 맞는 우리 영상 한 편으로 다시 기획한다'),
    sections: [
      {
        name: '참고 영상(틀만 참고 · 제목 · 대사는 베끼지 않기)',
        rows: [
          {
            제목: safeText(v.title, [], 160),
            채널: safeText(v.channelName, [], 60),
            길이: v.isShort ? '쇼츠' : `롱폼 ${Math.max(1, Math.round(v.durationSec / 60))}분`,
            조회: v.views,
            평소대비: ratioText(v),
            올린지: `${Math.max(1, Math.floor(v.ageDays))}일`,
            좋아요율: `${v.likeRate.toFixed(1)}%`,
            구독자대비: v.channelSubs > 0 ? `조회가 구독자의 ${v.viewsPerSub.toFixed(1)}배` : '',
            참고할것_규칙: i.lessons.slice(0, 6).map((l) => safeText(l, [], 200)),
          },
        ],
      },
      ...(rows.length ? [{ name: `참고 영상 대본(받아 적은 것 · ${rows.length}줄)`, rows }] : []),
      { name: '채널 설계 기준(대표가 정함 — 반드시 따름)', rows: BRIEF_FIELDS.map((f) => ({ 항목: f.label, 기준: safeText(brief[f.key], [], 300) })) },
    ],
    facts: [...(isMarketingCustomer() ? customerProfileLines() : MIRAE_PROFILE), rows.length ? '참고 영상 대본이 있다 — 구성 · 흐름은 대본에서 읽는다.' : '참고 영상 대본이 없다 — 제목 · 숫자 · 참고할 것만으로 짐작한다.'],
    rules: [...packRules()],
  }
}

/** 받은 답에서 tag(없으면 title)로 항목 찾기 */
export function adaptItem(a: AssistAnswer | null, tag: string, title?: RegExp): AssistAnswer['items'][number] | undefined {
  if (!a) return undefined
  return a.items.find((i) => (i.tag ?? '').replace(/\s+/g, '') === tag.replace(/\s+/g, '')) ?? (title ? a.items.find((i) => title.test(i.title)) : undefined)
}

/** 복사 · 대본 칸에 넣을 글 */
export function adaptText(a: AssistAnswer | null, v: Pick<RadarVideo, 'title' | 'channelName'>): string {
  if (!a) return ''
  const out = [`[우리 버전] ${a.headline}`, `(참고: ${v.channelName} · ${v.title} — 틀만 참고)`]
  for (const i of a.items) {
    out.push('', `■ ${i.title}`)
    if (i.detail) out.push(i.detail)
    if (i.outline?.length) out.push(...i.outline.map((o) => `- ${o}`))
    if (i.body) out.push(i.body)
  }
  if (a.next?.length) out.push('', '■ 찍기 전 준비물', ...a.next.map((n) => `□ ${n}`))
  if (a.caution) out.push('', `확인: ${a.caution}`)
  return out.join('\n').trim()
}

/** 답 → 내 콘텐츠 한 줄(같은 영상은 같은 줄 · 대본 칸에 전체) */
export function adaptIdea(a: AssistAnswer, v: RadarVideo): IdeaInput {
  const titles = adaptItem(a, '제목', /제목/)?.outline ?? []
  const thumbs = adaptItem(a, '썸네일', /썸네일/)?.outline ?? []
  const why = adaptItem(a, '분석', /왜/)?.outline ?? []
  const hook = adaptItem(a, '첫문장', /첫\s*문장/)?.body ?? ''
  const topic = (a.headline || v.title).trim().slice(0, 120)
  return {
    key: `video:${v.id}`,
    topic,
    topicId: v.topics[0] ?? '',
    angle: (why[0] ?? '').slice(0, 400),
    type: v.domains.includes('ai') ? 'axai' : 'market',
    benchmarkVideoIds: [v.id],
    benchmarkTitles: [v.title.slice(0, 200)],
    titleCandidates: titles.slice(0, 5),
    thumbnailCandidates: thumbs.slice(0, 4),
    whyNow: why.slice(0, 5),
    hook: hook.slice(0, 200),
    status: 'script',
    checks: ['script'],
    source: 'radar',
    script: adaptText(a, v),
  }
}
