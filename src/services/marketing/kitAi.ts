/**
 * D-351 '이번 주 이렇게 찍으세요' — [AI로 내 채널에 맞게 추천](radar.kit). 규칙 추천(brandAngle)으로 모자랄 때 누른다.
 * 채널 설계 기준 전부 · 이 후보(주제 · 왜 지금 · 잘된 영상 제목 틀) · 고른 본업을 보내고, 제목(유형별) · 첫 문장 · 이렇게 말해요 · 썸네일 · 구성을 받는다.
 * 결과는 이 브라우저(사람별 금고)에 후보마다 — 화면을 나갔다 와도(같은 접속 · 새로 고침) 그대로. 쓰는 중에 다른 화면으로 가도 답은 남는다.
 * D-515 작업공간 기록(marketing / kits · 한 줄 · 최근 40개)에도 — 다른 기기에서 같은 후보를 열면 다시 부르지 않고 그 추천이 보인다(keyedSync).
 */
import { AssistError, callAssist, type AssistAnswer } from '../aiAssist/client'
import type { AssistContext } from '../aiAssist/context'
import { briefSection } from '../aiAssist/marketingBuilders'
import { newRequestId, readChoice } from '../aiAssist/store'
import type { BrandCore } from './brandAngle'
import type { ChannelBrief } from './radarStore'
import type { Opportunity } from './ytRadar'
import { PATTERN_LABEL } from './ytRadar'
import { deviceNow, keyedCloudSync, mergeKeyed, type KeyedRowSpec } from './keyedSync'

export interface KitAi {
  at: string
  model: string
  /** 이어 준 본업 */
  core: string
  view: string
  hook: string
  titles: { text: string; type: string }[]
  thumbs: string[]
  outline: string[]
  /** D-515 어느 기기에서 AI 로 썼나(다른 기기에서 열면 'PC에서 씀') — 예전 기록에는 없다 */
  device?: 'pc' | 'phone'
}

export const KIT_STORE_KEY = 'axmvp.mkkit.v1'
export const KIT_MAX = 40

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

export function parseKitStore(raw: string | null): Record<string, KitAi> {
  if (!raw) return {}
  try {
    return kitStoreOf(JSON.parse(raw) as unknown)
  } catch {
    return {}
  }
}

/** D-515 이미 읽은 값(클라우드 한 줄 등)을 같은 규칙으로 다듬기 — 깨진 값 · 제목 없는 칸은 버린다 */
export function kitStoreOf(raw: unknown): Record<string, KitAi> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const v = raw as Record<string, Partial<KitAi>>
  const out: Record<string, KitAi> = {}
  for (const [k, x] of Object.entries(v)) {
    if (!x || typeof x.at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(x.at) || !Array.isArray(x.titles) || !x.titles.length || k.length > 200) continue
    out[k] = {
      at: x.at,
      model: str(x.model, 80),
      core: str(x.core, 40),
      view: str(x.view, 600),
      hook: str(x.hook, 300),
      titles: x.titles.filter((t) => t && typeof t.text === 'string').slice(0, 8).map((t) => ({ text: str(t.text, 120), type: str(t.type, 12) })),
      thumbs: Array.isArray(x.thumbs) ? x.thumbs.filter((t): t is string => typeof t === 'string').slice(0, 4).map((t) => t.slice(0, 40)) : [],
      outline: Array.isArray(x.outline) ? x.outline.filter((t): t is string => typeof t === 'string').slice(0, 10).map((t) => t.slice(0, 200)) : [],
      ...(x.device === 'pc' || x.device === 'phone' ? { device: x.device } : {}),
    }
  }
  return out
}

export function putKitStore(store: Record<string, KitAi>, key: string, kit: KitAi): Record<string, KitAi> {
  const all = Object.entries({ ...store, [key]: kit }).sort((a, b) => b[1].at.localeCompare(a[1].at))
  return Object.fromEntries(all.slice(0, KIT_MAX))
}

/** 답 → 칸. 제목 · 첫 문장이 없으면 null(실패로 본다) */
export function parseKitAnswer(a: AssistAnswer, core: string, at: string, model: string): KitAi | null {
  const items = a.items ?? []
  const tagOf = (t?: string) => (t ?? '').replace(/\s+/g, '')
  const titles = items.filter((i) => tagOf(i.tag) === '제목' && i.title?.trim()).map((i) => ({ text: i.title.trim().slice(0, 120), type: (i.when ?? '').trim().slice(0, 12) }))
  const hook = items.find((i) => tagOf(i.tag) === '첫문장')
  const thumbs = items.find((i) => tagOf(i.tag) === '썸네일')
  const plan = items.find((i) => tagOf(i.tag) === '구성')
  const hookText = (hook?.body || hook?.title || '').trim()
  if (!titles.length || !hookText) return null
  return {
    at,
    model,
    core,
    view: (a.headline ?? '').trim().slice(0, 600),
    hook: hookText.slice(0, 300),
    titles: titles.slice(0, 8),
    thumbs: (thumbs?.outline ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 4),
    outline: (plan?.outline ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 10),
  }
}

/** 보낼 자료 — 채널 설계 기준 · 이 후보 · 고른 본업(시청자 글에 레이더 숫자는 쓰지 않게 근거는 '참고' 로만) */
export function kitContext(o: Opportunity, brief: ChannelBrief, core: BrandCore | null, cores: readonly BrandCore[], today: string): AssistContext {
  return {
    title: '이번 주 이렇게 찍으세요 — 내 채널에 맞게',
    today,
    purpose: '이번 주 후보 하나를 채널 설계 기준의 본업에 맞춰 찍을 수 있게',
    sections: [
      briefSection(brief),
      {
        name: '이번 주 후보',
        rows: [
          {
            주제: o.topic.slice(0, 80),
            종류: o.axis === 'axai' ? 'AI · AX 실무(미끼 — 본업으로 잇기)' : o.axis === 'bridge' ? '본업 × AI 장치' : '시장 주제',
            왜지금: o.summary.slice(0, 240),
            지금각도: o.view.slice(0, 300),
            잘된영상제목틀: [...new Set(o.benchmarks.flatMap((v) => v.patterns))].map((p) => PATTERN_LABEL[p] ?? p).slice(0, 4).join(' · '),
          },
        ],
      },
      {
        name: '본업(채널 설계 기준에서 — 앞일수록 중요)',
        rows: cores.slice(0, 8).map((c) => ({ 본업: c.label, AI로하는일: c.task, 대표가얻는것: c.gain, 사람이확인: c.check, 고름: core?.id === c.id ? '이 본업으로' : '' })),
      },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 진행 상태 · 결과 — 화면 밖(모듈)에                                         */
/* ------------------------------------------------------------------ */

const memory = new Map<string, KitAi>()
const running = new Map<string, string>()
const errors = new Map<string, string>()
const subs = new Set<() => void>()
let version = 0
const emit = () => {
  version += 1
  for (const f of subs) f()
}
export const subscribeKit = (f: () => void) => {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
export const kitVersion = () => version

function readStore(): Record<string, KitAi> {
  try {
    return parseKitStore(window.localStorage.getItem(KIT_STORE_KEY))
  } catch {
    return {}
  }
}
export function kitSaved(key: string): KitAi | null {
  return memory.get(key) ?? readStore()[key] ?? null
}
export const kitRunning = (key: string) => running.has(key)
export const kitError = (key: string) => errors.get(key) ?? ''

/** 후보 키 + 주(같은 주제라도 주가 바뀌면 새로) */
export const kitKey = (o: Pick<Opportunity, 'key'>, week: string) => `${week}:${o.key}`

/* D-515 클라우드 — 다른 기기에서 쓴 추천 가져오기 · 이 기기 추천 올리기(묶음 결과와 같은 길) */
export const KIT_ROW: KeyedRowSpec<KitAi> = { module: 'marketing', bucket: 'kits', rowPrefix: 'mkkits_', field: 'kits', max: KIT_MAX, parse: kitStoreOf }

const cloud = keyedCloudSync<KitAi>({
  ...KIT_ROW,
  local: () => mergeKeyed(readStore(), Object.fromEntries(memory), KIT_MAX),
  running: () => new Set(running.keys()),
  adopt: (next, keys) => {
    for (const k of keys) memory.set(k, next[k])
    try {
      window.localStorage.setItem(KIT_STORE_KEY, JSON.stringify(next))
    } catch {
      /* 저장 공간이 막혀도 이번 접속 동안은 보인다 */
    }
  },
  changed: emit,
})

/** 클라우드에 올리지 못한 채 이 기기에만 있음(연결되면 다시) */
export const kitCloudFailed = () => cloud.failed()

/** 마케팅 화면을 열 때 · 돌아올 때 · 인터넷이 다시 될 때 — ws 가 null 이면(팀장 화면 보기 등) 이후 올리지 않는다 */
export const openKitSync = (ws: string | null): Promise<void> => cloud.open(ws)

export function startKitAi(key: string, context: AssistContext, core: string): void {
  if (running.has(key)) return
  running.set(key, core)
  errors.delete(key)
  emit()
  void callAssist({ requestId: newRequestId(), assistId: 'radar.kit', page: 'radar', choice: readChoice(), context })
    .then((run) => {
      const got = run.structured ? parseKitAnswer(run.structured, core, run.createdAt || new Date().toISOString(), run.model) : null
      if (!got) throw new AssistError('provider_error', 'AI 답을 칸으로 나누지 못했습니다 — 한 번 더 눌러 주세요.')
      got.device = deviceNow()
      memory.set(key, got)
      try {
        window.localStorage.setItem(KIT_STORE_KEY, JSON.stringify(putKitStore(readStore(), key, got)))
      } catch {
        /* 저장 공간이 막혀도 이번 접속 동안은 보인다 */
      }
    })
    .catch((e: unknown) => {
      errors.set(key, e instanceof Error ? e.message : '다시 눌러 주세요.')
    })
    .finally(() => {
      running.delete(key)
      emit()
      // 다 쓴 뒤에 올린다(쓰는 중인 키는 맞추기에서 빠지므로 running 을 지운 다음)
      cloud.push()
    })
}
