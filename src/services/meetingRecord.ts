/**
 * D-654 미팅 녹음 요약(대표만) — 녹음 → 2분 조각마다 받아 적기(서버 AI · Gemini) → 다 받아 적은 글 → 미팅 메모(서버 AI).
 *
 * 여기는 화면과 떨어진 규칙만: 녹음 형식 고르기 · 조각 시각 · 받아 적은 답 읽기 · 보낼 자료 · 메모 글 만들기.
 * 녹음 파일은 어디에도 저장하지 않는다(조각을 서버에 보내 받아 적으면 버린다). 메모 칸에 들어간 글만 [기록] 때 업무 일기에 남는다.
 */
import type { AssistAnswer, AssistRun } from './aiAssist/client'
import type { AssistContext } from './aiAssist/context'

/** 조각 길이(초) — 24kbps 로 2분이면 약 360KB(서버 한 조각 한도 1.5MB 안 · 한 번 받아 적기 60초 안) */
export const REC_CHUNK_SEC = 120
/** 녹음 최대 길이(초) — 넘으면 저절로 멈추고 정리 */
export const REC_MAX_SEC = 90 * 60
/** 녹음 품질(말소리만 — 작게) */
export const REC_BITRATE = 24_000
/** 너무 작은 조각(말소리 없음 · 멈추자마자 끝난 조각)은 보내지 않는다 */
export const REC_MIN_BYTES = 1_000
/** 받아 적은 글을 정리에 보낼 때 한 줄 길이(서버가 칸을 300자에서 자른다) */
export const LINE_MAX = 280

/** 브라우저가 녹음할 수 있는 형식 가운데 서버가 받는 것 — 크롬 · 안드로이드 webm/opus · 아이폰 사파리 mp4 */
export const REC_MIMES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'] as const

export function pickRecordMime(isSupported: (mime: string) => boolean): string | null {
  for (const m of REC_MIMES) {
    try {
      if (isSupported(m)) return m
    } catch {
      /* 묻는 함수가 없는 브라우저 */
    }
  }
  return null
}

/** 이 브라우저에서 녹음 단추를 보여 줄 수 있나(마이크 · 녹음기 · 맞는 형식) */
export function canRecordHere(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const MR = (window as unknown as { MediaRecorder?: { isTypeSupported?: (m: string) => boolean } }).MediaRecorder
  if (!MR || !navigator.mediaDevices?.getUserMedia) return false
  return !!pickRecordMime((m) => (typeof MR.isTypeSupported === 'function' ? MR.isTypeSupported(m) : m === 'audio/webm'))
}

/** 시험에서 조각 길이를 줄일 때만(전역 __recChunkMs) — 평소에는 2분 */
export function chunkMs(): number {
  const v = Number((globalThis as unknown as { __recChunkMs?: unknown }).__recChunkMs)
  return Number.isFinite(v) && v >= 500 ? v : REC_CHUNK_SEC * 1000
}

export const clockOf = (sec: number): string => {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** "m:ss" · "h:mm:ss" → 초(못 읽으면 null) */
export function secOf(text: string): number | null {
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/.exec(String(text ?? '').trim())
  if (!m) return null
  const sec = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3])
  return Number.isFinite(sec) ? sec : null
}

export interface HeardLine {
  /** 녹음 처음부터 몇 초 */
  at: number
  /** 컨설턴트 · 대표님 · '' */
  who: string
  text: string
}

/**
 * 받아 적기 답(조각 하나) → 줄. 시각은 조각 시작(start) + 조각 안 시각.
 * 조각 안 시각이 조각 길이보다 크면(모델이 녹음 처음부터 센 경우) 그 시각을 그대로 쓴다.
 */
export function heardLinesOf(answer: AssistAnswer | null | undefined, start: number, chunkSec = REC_CHUNK_SEC): HeardLine[] {
  const items = Array.isArray(answer?.items) ? answer!.items : []
  const out: HeardLine[] = []
  for (const it of items) {
    const text = String(it?.body ?? it?.detail ?? '').replace(/\s+/g, ' ').trim()
    if (!text) continue
    const inside = secOf(String(it?.title ?? ''))
    const at = inside === null ? start : inside > chunkSec + 5 && inside >= start ? inside : start + inside
    const who = /대표/.test(String(it?.tag ?? '')) ? '대표님' : /컨설|상담/.test(String(it?.tag ?? '')) ? '컨설턴트' : ''
    out.push({ at, who, text })
  }
  return out
}

/** 받아 적은 글 전체(복사용) — "[m:ss] 대표님: 말" */
export function heardText(lines: readonly HeardLine[]): string {
  return lines.map((l) => `[${clockOf(l.at)}] ${l.who ? `${l.who}: ` : ''}${l.text}`).join('\n')
}

/** 정리 단추에 보낼 자료 — 받아 적은 글을 280자 줄로(서버가 칸을 300자에서 자른다) */
export function summaryContext(company: string, lines: readonly HeardLine[], today: string): AssistContext {
  const rows: { 시각: string; 누구: string; 말: string }[] = []
  for (const l of lines) {
    for (let i = 0; i < l.text.length; i += LINE_MAX) rows.push({ 시각: clockOf(l.at), 누구: l.who, 말: l.text.slice(i, i + LINE_MAX) })
  }
  return {
    title: '미팅 녹음 정리',
    today,
    purpose: '컨설턴트가 업체 기록에 남길 미팅 메모 — 들은 것만',
    sections: [
      { name: '업체', rows: [{ 업체: company }] },
      { name: '받아 적은 글', rows },
    ],
  }
}

/** 받아 적기 자료(조각 하나) — 업체 이름 · 몇 번째 조각만(사람 이름 · 전화는 보내지 않는다) */
export function transcribeContext(company: string, index: number, start: number, today: string): AssistContext {
  return { title: '미팅 녹음', today, sections: [{ name: '업체', rows: [{ 업체: company, 조각: `${index + 1}번째 · ${clockOf(start)} 부터` }] }] }
}

const TAG_ORDER = ['숫자', '사정', '약속', '할 일', '확인할 것'] as const

/**
 * 정리 답 → 미팅 메모 칸에 넣을 글. 규칙(업무 일기 읽기 · D-505)이 숫자 · 사정 · 약속을 알아듣는 모양 그대로 —
 * "직원 18명", "다음 주 화요일 오후 2시 2차 미팅" 처럼 한 줄씩. 머리에 '[녹음 정리]' 한 줄(사람이 고칠 수 있게 표시만).
 */
export function memoFromSummary(answer: AssistAnswer | null | undefined, ended: string): string {
  if (!answer) return ''
  const items = (Array.isArray(answer.items) ? answer.items : []).filter((it) => String(it?.title ?? '').trim())
  const rank = (t: string) => {
    const i = TAG_ORDER.findIndex((x) => String(t ?? '').includes(x))
    return i === -1 ? TAG_ORDER.length : i
  }
  const sorted = [...items].sort((a, b) => rank(String(a.tag ?? '')) - rank(String(b.tag ?? '')))
  const head = `[녹음 정리 · ${ended}]${answer.headline?.trim() ? ` ${answer.headline.trim()}` : ''}`
  const lines = sorted.map((it) => {
    const tag = String(it.tag ?? '').trim()
    const pre = tag === '할 일' ? '할 일: ' : tag === '확인할 것' ? '확인할 것: ' : ''
    return `· ${pre}${String(it.title).trim()}`
  })
  const next = (Array.isArray(answer.next) ? answer.next : []).map((n) => String(n ?? '').trim()).filter(Boolean)
  const nextLines = next.filter((n) => !lines.some((l) => l.includes(n))).map((n) => `· 할 일: ${n}`)
  const caution = answer.caution?.trim() ? [`(확인: ${answer.caution.trim()})`] : []
  return [head, ...lines, ...nextLines, ...caution].join('\n')
}

/** 받아 적기 답이 읽을 만한가(조각 하나) — 말소리 없음이면 빈 줄로 통과 */
export const heardRunOk = (run: AssistRun): AssistRun | null => (run.structured ? run : null)

/** Blob → base64(앞의 'data:…;base64,' 빼고) */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = String(r.result ?? '')
      const i = s.indexOf('base64,')
      resolve(i >= 0 ? s.slice(i + 7) : '')
    }
    r.onerror = () => reject(r.error ?? new Error('read'))
    r.readAsDataURL(blob)
  })
}
