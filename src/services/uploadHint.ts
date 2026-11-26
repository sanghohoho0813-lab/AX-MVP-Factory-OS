/**
 * D-656 서류 올리기 링크 ↔ 서류 요청 잇기 — 업체 기록에 적어 두는 '열린 링크' 한 칸(사본).
 *
 * 진짜 상태(주소 · 기한 · 받은 파일)는 서버(0031)에 있다. 이 칸은 다시 부탁 문구 · 요청 문구에 '올리기 주소' 한 줄을 붙이려고
 * 링크를 만들거나 · 바꾸거나 · 닫을 때 같이 적어 두는 사본이다 — 오늘 '보낼 안내' 는 업체마다 서버에 묻지 않는다.
 * 사본이 낡아도(다른 기기에서 닫음) 고객은 '닫힌 주소' 안내를 볼 뿐이다. 주소로는 올리기만 된다(읽기 0).
 * 순수 함수만 — 서버 · 화면을 끌어오지 않는다(오늘 화면이 가볍게 쓰도록).
 */

export interface UploadHint {
  /** /up/<20자리> 의 20자리 */
  slug: string
  /** 열려 있는 마지막 날(YYYY-MM-DD · 한국 날짜) */
  until: string
}

const SLUG = /^[0-9A-Za-z]{20}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/

/** 서류 올리기 공개 화면 주소 */
export function uploadUrl(slug: string, origin: string = typeof window !== 'undefined' ? window.location.origin : ''): string {
  return `${origin.replace(/\/+$/, '')}/up/${slug}`
}

/** 저장된 값 다듬기(clientOpsService.normalizeClientOps) */
export function normalizeUploadHint(value: unknown): { uploadHint?: UploadHint } {
  if (!value || typeof value !== 'object') return {}
  const o = value as Record<string, unknown>
  const slug = typeof o.slug === 'string' ? o.slug.trim() : ''
  const until = typeof o.until === 'string' ? o.until.trim() : ''
  return SLUG.test(slug) && DAY.test(until) ? { uploadHint: { slug, until } } : {}
}

/** 서버 링크 → 사본. 없는 링크 · 기한 지난 링크 · 읽을 수 없는 날짜면 null */
export function hintFromLink(link: { slug: string; expiresAt: string; expired?: boolean } | null | undefined): UploadHint | null {
  if (!link || link.expired || !SLUG.test(link.slug)) return null
  const t = Date.parse(link.expiresAt)
  if (!Number.isFinite(t)) return null
  return { slug: link.slug, until: new Date(t + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) }
}

export function sameHint(a: UploadHint | null | undefined, b: UploadHint | null | undefined): boolean {
  return (a?.slug ?? '') === (b?.slug ?? '') && (a?.until ?? '') === (b?.until ?? '')
}

/** 사본을 적거나(열린 링크) 지운다(닫음 · 기한 지남) */
export function withUploadHint<T extends { uploadHint?: UploadHint }>(record: T, link: { slug: string; expiresAt: string; expired?: boolean } | null | undefined): T {
  const hint = hintFromLink(link)
  if (hint) return { ...record, uploadHint: hint }
  if (!record.uploadHint) return record
  const next = { ...record }
  delete next.uploadHint
  return next
}

/** 오늘도 열려 있는 사본 — 기한이 지났으면 null */
export function openHint(record: { uploadHint?: UploadHint }, today: string): UploadHint | null {
  const h = record.uploadHint
  return h && h.until >= today ? h : null
}

/** 문구에 붙일 줄('' 포함 · 앞에 빈 줄 하나). 열린 링크가 없으면 [] */
export function uploadHintLines(record: { uploadHint?: UploadHint }, today: string, origin?: string): string[] {
  const h = openHint(record, today)
  if (!h) return []
  return ['', '아래 주소를 누르시면 휴대폰으로 바로 올리실 수 있어요(로그인 · 앱 설치 없음).', uploadUrl(h.slug, origin)]
}

/** 요청 문구에 올리기 주소 붙이기 — 끝인사('… 감사합니다.') 줄이 있으면 그 앞에, 없으면 맨 끝에. 이미 그 주소가 있으면 그대로 */
export function withUploadLine(text: string, record: { uploadHint?: UploadHint }, today: string, origin?: string): string {
  const lines = uploadHintLines(record, today, origin)
  if (!lines.length || text.includes(lines[lines.length - 1])) return text
  const body = text.replace(/\s+$/, '').split('\n')
  const last = body.length - 1
  if (last >= 2 && /감사합니다\.?\s*$/.test(body[last]) && body[last - 1].trim() === '') {
    return [...body.slice(0, last - 1), ...lines, '', body[last]].join('\n')
  }
  return [...body, ...lines].join('\n')
}
