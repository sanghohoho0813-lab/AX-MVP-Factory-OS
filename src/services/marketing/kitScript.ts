/**
 * D-558 '이렇게 찍으세요' AI 추천 제목 하나 → 대본(길이 분) → 내 보관함(내 콘텐츠).
 * 대표(2026-11-09): "제목을 누르면 복사만 되는데 — 한 번 더 누르면 몇 분짜리인지 골라 대본까지 뽑고, 그걸 보관함으로.
 *   언제 · 어느 키워드 · 몇 번째 어떤 형식의 제목을 골랐는지 · 같이 나온 것까지 히스토리로(토큰 써서 얻은 것 재활용)."
 * 대본은 서버 함수 radar.script(고른 모델 · 대표 AI 그대로). 결과는 이 브라우저(사람별 금고)에 제목마다 — 화면을 나갔다 와도 그대로.
 */
import { AssistError, callAssist, type AssistAnswer } from '../aiAssist/client'
import type { AssistContext } from '../aiAssist/context'
import { briefSection } from '../aiAssist/marketingBuilders'
import { newRequestId, readChoice } from '../aiAssist/store'
import type { KitAi } from './kitAi'
import type { ChannelBrief, IdeaOrigin } from './radarStore'
import type { Opportunity } from './ytRadar'

/** 고르기 쉬운 길이(분) — 직접 넣기도 된다(1~15) */
export const SCRIPT_MINUTES = [1, 3, 5, 10] as const
export const MINUTES_MAX = 15
/** 말 분량 — 1분에 약 350자(초당 6자 안팎). 한 번에 쓰는 대사는 3,600자까지(그 뒤는 '촬영 때 더 말할 것') */
export const charsFor = (minutes: number) => Math.min(3600, Math.max(350, Math.round(minutes * 350)))
export const clampMinutes = (n: number) => (Number.isFinite(n) ? Math.min(MINUTES_MAX, Math.max(1, Math.round(n))) : 5)

export interface ScriptPart {
  title: string
  body: string
  screen: string[]
}
export interface KitScript {
  at: string
  model: string
  minutes: number
  /** 1부터 — 같이 나온 제목 가운데 몇 번째 */
  titleIndex: number
  title: string
  titleType: string
  headline: string
  parts: ScriptPart[]
  /** 제목 후보 · 썸네일 문구 · 설명란(대본 뒤에 붙는 칸) */
  extras: { title: string; lines: string[]; body: string }[]
  /** 복사 · 보관함에 넣는 글 한 덩어리 */
  text: string
}

export const SCRIPT_STORE_KEY = 'axmvp.mkkitscript.v1'
export const SCRIPT_MAX = 30

/** 대본 칸 키 — 후보(주 포함) + 몇 번째 제목 */
export const scriptKey = (kitKey: string, titleIndex: number) => `${kitKey}#t${titleIndex}`

const EXTRA = /제목\s*후보|썸네일|설명란|고정\s*댓글/

/** 답 → 대본 칸. 대사가 하나도 없으면 null(실패로 본다) */
export function parseScript(a: AssistAnswer | null, meta: { at: string; model: string; minutes: number; titleIndex: number; title: string; titleType: string }): KitScript | null {
  if (!a) return null
  const items = a.items ?? []
  const parts: ScriptPart[] = []
  const extras: KitScript['extras'] = []
  for (const it of items) {
    const t = (it.title ?? '').trim()
    if (!t) continue
    if (EXTRA.test(t)) {
      extras.push({ title: t.slice(0, 40), lines: (it.outline ?? []).map((x) => x.trim()).filter(Boolean).slice(0, 8), body: (it.body ?? '').trim().slice(0, 1500) })
      continue
    }
    const body = (it.body ?? it.detail ?? '').trim()
    if (!body) continue
    parts.push({ title: t.slice(0, 60), body: body.slice(0, 4000), screen: (it.outline ?? []).map((x) => x.trim()).filter(Boolean).slice(0, 8) })
  }
  if (!parts.length) return null
  const headline = (a.headline ?? '').trim().slice(0, 200)
  const text = scriptText({ title: meta.title, minutes: meta.minutes, headline, parts, extras, next: a.next ?? [] })
  return { ...meta, headline, parts, extras, text }
}

export function scriptText(s: { title: string; minutes: number; headline: string; parts: ScriptPart[]; extras: KitScript['extras']; next?: readonly string[] }): string {
  const lines = [`[제목] ${s.title}`, `[길이] 약 ${s.minutes}분`, '']
  for (const p of s.parts) {
    lines.push(`■ ${p.title}`, p.body)
    if (p.screen.length) lines.push(`(화면: ${p.screen.join(' / ')})`)
    lines.push('')
  }
  for (const e of s.extras) {
    lines.push(`■ ${e.title}`)
    for (const l of e.lines) lines.push(`- ${l}`)
    if (e.body) lines.push(e.body)
    lines.push('')
  }
  if (s.next?.length) lines.push('찍기 전 준비', ...s.next.map((n) => `- ${n}`))
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '')

export function parseScriptStore(raw: string | null): Record<string, KitScript> {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw) as Record<string, Partial<KitScript>>
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    const out: Record<string, KitScript> = {}
    for (const [k, x] of Object.entries(v)) {
      if (!x || typeof x.at !== 'string' || typeof x.text !== 'string' || !x.text.trim() || !Array.isArray(x.parts) || k.length > 240) continue
      out[k] = {
        at: x.at,
        model: str(x.model, 80),
        minutes: clampMinutes(Number(x.minutes)),
        titleIndex: Math.max(1, Math.round(Number(x.titleIndex) || 1)),
        title: str(x.title, 120),
        titleType: str(x.titleType, 12),
        headline: str(x.headline, 200),
        parts: x.parts.filter((p) => p && typeof p.body === 'string').slice(0, 20).map((p) => ({ title: str(p.title, 60), body: str(p.body, 4000), screen: Array.isArray(p.screen) ? p.screen.filter((s): s is string => typeof s === 'string').slice(0, 8) : [] })),
        extras: Array.isArray(x.extras) ? x.extras.filter((e) => e && typeof e.title === 'string').slice(0, 6).map((e) => ({ title: str(e.title, 40), lines: Array.isArray(e.lines) ? e.lines.filter((l): l is string => typeof l === 'string').slice(0, 8) : [], body: str(e.body, 1500) })) : [],
        text: str(x.text, 20000),
      }
    }
    return out
  } catch {
    return {}
  }
}

export function putScriptStore(store: Record<string, KitScript>, key: string, s: KitScript): Record<string, KitScript> {
  const all = Object.entries({ ...store, [key]: s }).sort((a, b) => b[1].at.localeCompare(a[1].at))
  return Object.fromEntries(all.slice(0, SCRIPT_MAX))
}

/** 보낼 자료 — 채널 설계 기준 · 고른 제목 · 같이 나온 추천(첫 문장 · 구성 · 썸네일) · 길이(분 → 글자 수) · 요청 한 줄 */
export function scriptContext(input: { o: Opportunity; kit: KitAi; titleIndex: number; minutes: number; brief: ChannelBrief; request?: string; today: string }): AssistContext {
  const { o, kit, titleIndex, minutes, brief } = input
  const t = kit.titles[titleIndex - 1] ?? kit.titles[0]
  const sections: AssistContext['sections'] = [
    briefSection(brief),
    {
      name: '고른 기획(이 기획 하나로 대본을 끝까지)',
      rows: [
        {
          제목: t?.text ?? o.topic,
          제목형식: t?.type ?? '',
          길이: `${minutes}분`,
          목표글자수: `대사 약 ${charsFor(minutes).toLocaleString('ko-KR')}자`,
          첫문장: kit.hook,
          이렇게말해요: kit.view,
          구성: kit.outline,
          썸네일: kit.thumbs,
          후보주제: o.topic.slice(0, 80),
          왜지금: o.summary.slice(0, 240),
          이어줄본업: kit.core,
        },
      ],
    },
  ]
  const req = (input.request ?? '').trim()
  if (req) sections.push({ name: '요청', rows: [{ 요청: req.slice(0, 300) }] })
  return { title: `대본 — ${(t?.text ?? o.topic).slice(0, 40)}`, today: input.today, purpose: `고른 제목 하나로 ${minutes}분짜리 대본을 끝까지`, sections }
}

/** 보관함(내 콘텐츠)에 남길 히스토리 — 언제 · 어느 키워드(몇 순위) · 몇 번째 어떤 형식 · 같이 나온 것 전부 */
export function originOf(input: { o: Opportunity; kit: KitAi; script: KitScript; rank: number; week: string; savedAt: string }): IdeaOrigin {
  const { o, kit, script } = input
  return {
    from: 'kit',
    savedAt: input.savedAt,
    week: input.week,
    keyword: o.topic.slice(0, 120),
    rank: Math.max(0, Math.round(input.rank) || 0),
    core: kit.core,
    titleIndex: script.titleIndex,
    titleType: script.titleType,
    titles: kit.titles.map((x) => ({ text: x.text, type: x.type })),
    hook: kit.hook,
    thumbs: [...kit.thumbs],
    outline: [...kit.outline],
    view: kit.view,
    minutes: script.minutes,
    model: script.model || kit.model,
    kitAt: kit.at,
    scriptAt: script.at,
  }
}

/** 저장된 때(ISO · 세계 표준시) → 이 기기 시각 'MM.DD HH:mm'(대표님 화면은 한국 시각) — 읽지 못하면 '' */
export function localStamp(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 보관함 메모 첫 줄(히스토리를 그리지 않는 화면에서도 읽히게) */
export function originMemo(g: IdeaOrigin): string {
  const when = localStamp(g.savedAt)
  return `${when} 보관 · 이번 주${g.rank ? ` ${g.rank}순위` : ''} '${g.keyword}'${g.core ? ` → ${g.core}` : ''} · AI 제목 ${g.titles.length}개 중 ${g.titleIndex}번째${g.titleType ? `(${g.titleType})` : ''} · ${g.minutes}분 대본`
}

/* ------------------------------------------------------------------ */
/* 진행 상태 · 결과 — 화면 밖(모듈)에                                         */
/* ------------------------------------------------------------------ */

const memory = new Map<string, KitScript>()
const running = new Set<string>()
const errors = new Map<string, string>()
const subs = new Set<() => void>()
let version = 0
const emit = () => {
  version += 1
  for (const f of subs) f()
}
export const subscribeScript = (f: () => void) => {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
export const scriptVersion = () => version

function readStore(): Record<string, KitScript> {
  try {
    return parseScriptStore(window.localStorage.getItem(SCRIPT_STORE_KEY))
  } catch {
    return {}
  }
}
export const scriptSaved = (key: string): KitScript | null => memory.get(key) ?? readStore()[key] ?? null
export const scriptRunning = (key: string) => running.has(key)
export const scriptError = (key: string) => errors.get(key) ?? ''

export function startKitScript(key: string, context: AssistContext, meta: { minutes: number; titleIndex: number; title: string; titleType: string }): void {
  if (running.has(key)) return
  running.add(key)
  errors.delete(key)
  emit()
  void callAssist({ requestId: newRequestId(), assistId: 'radar.script', page: 'radar', choice: readChoice(), context })
    .then((run) => {
      const got = parseScript(run.structured, { ...meta, at: run.createdAt || new Date().toISOString(), model: run.model })
      if (!got) throw new AssistError('provider_error', 'AI 답에서 대본을 찾지 못했어요 — 한 번 더 눌러 주세요.')
      memory.set(key, got)
      try {
        window.localStorage.setItem(SCRIPT_STORE_KEY, JSON.stringify(putScriptStore(readStore(), key, got)))
      } catch {
        /* 저장 공간이 막혀도 이번 접속 동안은 보인다 */
      }
    })
    .catch((e: unknown) => {
      errors.set(key, e instanceof Error && e.message ? e.message : '다시 눌러 주세요.')
    })
    .finally(() => {
      running.delete(key)
      emit()
    })
}
