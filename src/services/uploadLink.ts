/**
 * L-41 · D-652 서류 올리기 링크 — 서버 0031(upload_link_* · public_upload_*).
 *
 *  - 문은 DB 가 지킨다(그 작업공간에 쓸 수 있는 사람만 링크 · 공개 화면은 업체 이름 · 받을 서류만 · 보관함은 서버가 정한 경로에만) —
 *    이 파일은 부르고 모양을 맞출 뿐이다.
 *  - 0031 전(함수 없음) · 되돌린 뒤(실행 권한 없음) · 로컬 모드 → 'missing' — 링크 칸은 그리지 않는다(지금과 같다).
 *  - 공개 화면(/up/<20자리>)은 로그인 없이 — 공개 함수 셋 + 보관함 넣기만 부른다. 로그인해 둔 브라우저에서 열어도
 *    그 사람 자격으로 올리지 않게 세션 없는 연결을 쓴다(getAnonSupabaseClient).
 */
import { getDataModeConfig } from '../data/dataMode'
import { getAnonSupabaseClient, getSupabaseClient } from '../lib/supabase/client'

import { uploadUrl } from './uploadHint'
export { uploadSlugFromPath } from '../lib/askPath'

export interface UploadDoc {
  key: string
  label: string
}

export interface UploadLinkInfo {
  slug: string
  title: string
  note: string
  docs: UploadDoc[]
  expiresAt: string
  expired: boolean
  createdAt: string
  uploaded: number
  lastAt: string
}

export interface UploadedFile {
  id: string
  /** '' = 업체 대표가 '그 밖의 서류' 로 올림(칸은 이쪽에서 정한다) */
  docKey: string
  docLabel: string
  fileName: string
  fileSize: number
  contentType: string
  storagePath: string
  uploadedAt: string
}

export type UploadState =
  | { role: 'none' }
  | { role: 'writer'; link: UploadLinkInfo | null; files: UploadedFile[]; accepted: number; closed: number }

export const UPLOAD_CHANGED = 'axmvp:upload-link-changed'
/** 서버와 같은 한도 */
export const UPLOAD_MAX_BYTES = 20 * 1024 * 1024
export const UPLOAD_EXTS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'tif', 'tiff', 'hwp', 'hwpx', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt'] as const
/** 고르는 창에 걸 형식(휴대폰은 사진 찍기도 함께 보인다) */
export const UPLOAD_ACCEPT = 'image/*,application/pdf,' + UPLOAD_EXTS.map((e) => `.${e}`).join(',')
export const UPLOAD_DAYS = [7, 14, 30] as const
export const UPLOAD_DOCS_MAX = 30
/** 업체 대표가 고를 칸이 없을 때 — 서버 doc_key '' */
export const OTHER_UPLOAD_LABEL = '그 밖의 서류'

// ---------------------------------------------------------------- 규칙(순수)

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)

export function parseUploadDocs(raw: unknown): UploadDoc[] {
  if (!Array.isArray(raw)) return []
  const out: UploadDoc[] = []
  const seen = new Set<string>()
  for (const d of raw) {
    if (!d || typeof d !== 'object') continue
    const key = str((d as Record<string, unknown>).key)
    const label = str((d as Record<string, unknown>).label)
    if (!/^[A-Za-z0-9_-]{1,60}$/.test(key) || !label || seen.has(key)) continue
    seen.add(key)
    out.push({ key, label })
  }
  return out.slice(0, UPLOAD_DOCS_MAX)
}

export function parseUploadState(raw: unknown): UploadState {
  if (!raw || typeof raw !== 'object') return { role: 'none' }
  const o = raw as Record<string, unknown>
  if (o.role !== 'writer') return { role: 'none' }
  const l = o.link && typeof o.link === 'object' ? (o.link as Record<string, unknown>) : null
  const slug = l ? str(l.slug) : ''
  const files: UploadedFile[] = Array.isArray(o.files)
    ? (o.files as unknown[]).flatMap((f) => {
        if (!f || typeof f !== 'object') return []
        const r = f as Record<string, unknown>
        const id = str(r.id)
        const storagePath = str(r.storagePath)
        if (!id || !storagePath) return []
        return [{ id, docKey: str(r.docKey), docLabel: str(r.docLabel), fileName: str(r.fileName) || '서류', fileSize: num(r.fileSize), contentType: str(r.contentType), storagePath, uploadedAt: str(r.uploadedAt) }]
      })
    : []
  return {
    role: 'writer',
    link:
      l && /^[0-9a-f]{20}$/.test(slug)
        ? {
            slug,
            title: str(l.title),
            note: str(l.note),
            docs: parseUploadDocs(l.docs),
            expiresAt: str(l.expiresAt),
            expired: l.expired === true,
            createdAt: str(l.createdAt),
            uploaded: num(l.uploaded),
            lastAt: str(l.lastAt),
          }
        : null,
    files,
    accepted: num(o.accepted),
    closed: num(o.closed),
  }
}

/** 공개 주소 — 지금 열린 주소(운영 · 미리 보기 모두 같은 곳) */
export { uploadUrl }

/** '12월 7일' — 한국 날짜 */
export function koDate(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t + 9 * 60 * 60 * 1000)
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`
}

/** 카톡으로 보낼 문구 — 받을 서류 · 기한 · 주소. 대표 회사 이름(OS) 없이 */
export function uploadRequestText(input: { contactName?: string; link: Pick<UploadLinkInfo, 'slug' | 'docs' | 'expiresAt'>; origin?: string }): string {
  const who = input.contactName?.trim() ? `${input.contactName.trim()} 대표님` : '대표님'
  const until = koDate(input.link.expiresAt)
  const docs = input.link.docs.map((d, i) => `${i + 1}. ${d.label}`)
  return [
    `안녕하세요, ${who}.`,
    '',
    '아래 주소를 누르시면 휴대폰으로 바로 서류를 올리실 수 있어요(로그인 · 앱 설치 없음).',
    '사진으로 찍어 올리셔도 괜찮습니다.',
    ...(docs.length ? ['', '올려 주실 서류', ...docs] : []),
    '',
    uploadUrl(input.link.slug, input.origin),
    ...(until ? ['', `${until}까지 열려 있어요.`] : []),
  ].join('\n')
}

/** 고르기 전 확인(서버와 같은 규칙) — 문제 있으면 사람 말로 한 줄, 없으면 '' */
export function uploadFileProblem(file: { name: string; size: number }): string {
  const ext = /\.([A-Za-z0-9]{1,5})$/.exec(file.name.trim())?.[1]?.toLowerCase() ?? ''
  if (!ext || !(UPLOAD_EXTS as readonly string[]).includes(ext)) return '이 형식은 올릴 수 없어요. 사진 · PDF · 한글 · 워드 · 엑셀 파일로 올려 주세요.'
  if (file.size <= 0) return '빈 파일이에요. 다시 골라 주세요.'
  if (file.size > UPLOAD_MAX_BYTES) return `파일이 너무 커요(${sizeText(file.size)}). 20MB 아래로 — 사진은 한 장씩 올려 주세요.`
  return ''
}

export function sizeText(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, '')}MB`
}

/** 서버 오류 → 사람 말 */
export function uploadErrorText(error: unknown): string {
  const msg = String((error as { message?: string })?.message ?? error ?? '')
  if (/too many requests/i.test(msg)) return '잠깐 사이에 너무 많이 올렸어요. 10분쯤 뒤에 다시 올려 주세요.'
  if (/too many files/i.test(msg)) return '이 주소로 올릴 수 있는 파일 수를 다 채웠어요. 보내 준 분께 알려 주세요.'
  if (/file type/i.test(msg)) return '이 형식은 올릴 수 없어요. 사진 · PDF · 한글 · 워드 · 엑셀 파일로 올려 주세요.'
  if (/file size|too large|exceeded|payload/i.test(msg)) return '파일이 너무 커요. 20MB 아래로 — 사진은 한 장씩 올려 주세요.'
  if (/unknown document/i.test(msg)) return '이 서류 칸이 바뀌었어요. 화면을 새로 열어 주세요.'
  if (/failed to fetch|network|load failed|timeout|timed out/i.test(msg)) return '인터넷 연결이 잠깐 끊겼어요. 연결을 확인하고 다시 올려 주세요.'
  if (/[가-힣]/.test(msg)) return msg
  return '잠깐 연결이 안 됐어요. 잠시 뒤 다시 올려 주세요.'
}

/** 함수가 없거나(0031 전) 실행 권한이 없으면(되돌림) 'missing' 으로 본다 */
export function isUploadMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  const code = String(error.code ?? '')
  return (
    code === '42883' || code === 'PGRST202' || code === '42501' ||
    /could not find the function|does not exist|schema cache|permission denied for function/i.test(String(error.message ?? ''))
  )
}

// ---------------------------------------------------------------- 서버 — 업체 서류함(로그인한 사람)

export type UploadLoad = { status: 'ready'; state: UploadState } | { status: 'missing' } | { status: 'off' }

/** 0031 전이면 한 시간 동안 다시 묻지 않는다(업체를 열 때마다 404 를 쌓지 않게 · 새로 고치면 다시 묻는다) */
let missingUntil = 0
const MISSING_MS = 60 * 60 * 1000

export async function loadUploadLink(workspaceId: string | null | undefined, clientId: string): Promise<UploadLoad> {
  if (!workspaceId || !clientId || getDataModeConfig().mode !== 'supabase') return { status: 'missing' }
  if (Date.now() < missingUntil) return { status: 'missing' }
  try {
    const { data, error } = await getSupabaseClient().rpc('upload_link_state', { p_ws: workspaceId, p_client: clientId })
    if (error) {
      if (!isUploadMissing(error)) return { status: 'off' }
      missingUntil = Date.now() + MISSING_MS
      return { status: 'missing' }
    }
    return { status: 'ready', state: parseUploadState(data) }
  } catch {
    return { status: 'off' }
  }
}

function changed(): void {
  try {
    window.dispatchEvent(new CustomEvent(UPLOAD_CHANGED))
  } catch {
    // 듣는 쪽이 없어도 된다
  }
}

async function call(fn: string, args: Record<string, unknown>): Promise<UploadState> {
  const { data, error } = await getSupabaseClient().rpc(fn, args)
  if (error) throw error
  changed()
  return parseUploadState(data)
}

export const saveUploadLink = (workspaceId: string, clientId: string, docs: UploadDoc[], days: number, note = '') =>
  call('upload_link_save', { p_ws: workspaceId, p_client: clientId, p_docs: docs.slice(0, UPLOAD_DOCS_MAX), p_days: days, p_note: note })
export const rotateUploadLink = (workspaceId: string, clientId: string) => call('upload_link_rotate', { p_ws: workspaceId, p_client: clientId })
export const offUploadLink = (workspaceId: string, clientId: string) => call('upload_link_off', { p_ws: workspaceId, p_client: clientId })

/** 받은 파일 정하기 — changed = 이번 부름이 바꿨는지(두 번 눌러도 한 번) */
export async function decideUploadedFile(fileId: string, decision: 'accepted' | 'dismissed' | 'uploaded'): Promise<{ changed: boolean; status: string }> {
  const { data, error } = await getSupabaseClient().rpc('upload_link_decide', { p_file: fileId, p_decision: decision })
  if (error) throw error
  changed()
  const o = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  return { changed: o.changed === true, status: str(o.status) }
}

/** 작업공간 전체 — 업체마다 '고객이 올리고 아직 칸에 안 넣은 파일' 수 */
export async function loadUploadInbox(workspaceId: string | null | undefined): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (!workspaceId || getDataModeConfig().mode !== 'supabase' || Date.now() < missingUntil) return out
  try {
    const { data, error } = await getSupabaseClient().rpc('upload_link_inbox', { p_ws: workspaceId })
    if (error) {
      if (isUploadMissing(error)) missingUntil = Date.now() + MISSING_MS
      return out
    }
    for (const r of Array.isArray(data) ? (data as unknown[]) : []) {
      if (!r || typeof r !== 'object') continue
      const o = r as Record<string, unknown>
      const id = str(o.clientId)
      const n = num(o.waiting)
      if (id && n > 0) out.set(id, n)
    }
  } catch {
    // 못 읽으면 숫자 없이
  }
  return out
}

// ---------------------------------------------------------------- 서버 — 공개 화면(로그인 없음)

export interface PublicUploadForm {
  title: string
  note: string
  docs: UploadDoc[]
  expiresAt: string
  /** 서류마다 이 주소로 올린 수(파일 이름은 오지 않는다) */
  sent: Record<string, number>
}

export type PublicUploadLoad = ({ status: 'open' } & PublicUploadForm) | { status: 'closed' } | { status: 'error' }

export async function loadPublicUploadForm(slug: string): Promise<PublicUploadLoad> {
  if (!slug || getDataModeConfig().mode !== 'supabase') return { status: 'closed' }
  try {
    const { data, error } = await getAnonSupabaseClient().rpc('public_upload_form', { p_slug: slug })
    if (error) return isUploadMissing(error) ? { status: 'closed' } : { status: 'error' }
    if (!data || typeof data !== 'object') return { status: 'closed' }
    const o = data as Record<string, unknown>
    const sent: Record<string, number> = {}
    for (const s of Array.isArray(o.sent) ? (o.sent as unknown[]) : []) {
      if (!s || typeof s !== 'object') continue
      const r = s as Record<string, unknown>
      sent[str(r.key)] = num(r.n)
    }
    return { status: 'open', title: str(o.title) || '서류 올리기', note: str(o.note), docs: parseUploadDocs(o.docs), expiresAt: str(o.expiresAt), sent }
  } catch {
    return { status: 'error' }
  }
}

/**
 * 파일 하나 올리기 — 서버가 경로를 정하고(예약) → 그 경로에 넣고 → 다 올렸다고 알린다.
 * 'ok' | 'closed'(그 사이 링크가 닫힘 · 기한 지남). 문제는 사람 말로 던진다.
 */
export async function uploadPublicFile(slug: string, docKey: string, file: File): Promise<'ok' | 'closed'> {
  const problem = uploadFileProblem(file)
  if (problem) throw new Error(problem)
  const sb = getAnonSupabaseClient()
  const { data, error } = await sb.rpc('public_upload_reserve', {
    p_slug: slug,
    p_doc_key: docKey,
    p_file_name: file.name,
    p_size: file.size,
    p_type: file.type || '',
  })
  if (error) throw new Error(uploadErrorText(error))
  const r = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  if (r.status === 'closed') return 'closed'
  const path = str(r.path)
  if (!path) throw new Error(uploadErrorText(''))
  const put = async () => {
    const { error: e } = await sb.storage.from('client-documents').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
    return e ? e.message || 'upload failed' : ''
  }
  // 잠깐 끊긴 것은 한 번 더(크기 · 형식 거절은 다시 해도 같다)
  let err = await put()
  if (err && !/exceeded|too large|payload|mime|not supported|content type|duplicate|already exists/i.test(err)) {
    await new Promise((done) => setTimeout(done, 1200))
    err = await put()
  }
  if (err && !/duplicate|already exists/i.test(err)) throw new Error(uploadErrorText(err))
  const { data: done, error: doneError } = await sb.rpc('public_upload_done', { p_slug: slug, p_path: path })
  if (doneError) throw new Error(uploadErrorText(doneError))
  if (done === 'closed') return 'closed'
  if (done === 'too_big') throw new Error('파일이 너무 커요. 20MB 아래로 — 사진은 한 장씩 올려 주세요.')
  if (done === 'missing') throw new Error('파일이 끝까지 올라가지 않았어요. 다시 올려 주세요.')
  return 'ok'
}
