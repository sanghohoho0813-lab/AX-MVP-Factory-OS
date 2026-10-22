/**
 * D-266 압축 파일(.zip)을 풀어 안의 서류를 하나씩 — 대표 지시(고도화 최종 목표 1) "서류는 대충 올려도 알아서".
 * 고객은 서류를 '서류모음.zip' 하나로 카톡 · 메일에 보내는 일이 많다. 예전에는 압축 파일이 통째로 '기타 · 확인 필요' 한 칸에 들어갔다.
 *
 *  - 안의 파일을 꺼내 그냥 넣은 파일처럼 읽고 칸을 정한다. 폴더 이름은 '압축 이름/안의 폴더' 로 남긴다(서류함 폴더 보기).
 *  - Windows 기본 압축 · 알집 옛 판의 한글 이름(CP949)도 읽는다(zip.ts).
 *  - 압축 안의 압축은 한 번 더까지. 시스템 파일(__MACOSX · .DS_Store · Thumbs.db · ~$ 임시 파일)은 뺀다.
 *  - 암호가 걸린 항목 · 못 여는 압축(깨짐 · .7z · .alz · .egg · .rar)은 원래 파일을 그대로 두고 까닭을 알린다(잃는 파일 없음).
 * 규칙 계산 — 외부 호출 없음.
 */

import { DROP_FILE_LIMIT, relativePathOf, setRelativePath } from '../lib/dropFiles'
import { isSystemFile } from './docShelf'
import { readZipEntry, zipEntries, ZIP_MAX_TOTAL } from './patent/zip'

/** 압축 안의 압축은 한 번 더까지 */
const MAX_DEPTH = 2

export function isZipFile(f: Pick<File, 'name' | 'type'>): boolean {
  return /\.zip$/i.test(f.name) || f.type === 'application/zip' || f.type === 'application/x-zip-compressed'
}

/** 이 OS 가 풀 수 없는 압축 형식 */
export function isOtherArchive(f: Pick<File, 'name'>): boolean {
  return /\.(7z|rar|alz|egg|tar|gz|tgz|bz2|xz)$/i.test(f.name)
}

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  hwp: 'application/x-hwp',
  hwpx: 'application/hwp+zip',
  zip: 'application/zip',
}
export function mimeOf(name: string): string {
  return MIME[/\.([A-Za-z0-9]+)$/.exec(name)?.[1]?.toLowerCase() ?? ''] ?? 'application/octet-stream'
}

/** 압축 하나를 연 결과 — 화면에 '서류모음.zip 에서 7개' · 못 연 까닭 */
export interface ArchiveNote {
  archive: string
  /** 꺼낸 파일 수(시스템 파일 · 폴더 빼고) */
  opened: number
  /** 못 꺼낸 것(암호 · 깨짐 · 너무 큼 · 수 한도) */
  skipped: number
  /** 압축째 못 열었으면 까닭(그때는 원래 파일을 그대로 올린다) */
  reason?: string
}

/** 압축 파일에서 꺼낸 파일의 출처('서류모음.zip') — 화면에 '서류모음.zip 안' 으로 */
const ORIGIN = new WeakMap<File, string>()
export function archiveOf(file: File): string {
  return ORIGIN.get(file) ?? ''
}

const baseName = (path: string) => path.split('/').filter(Boolean).pop() ?? path
const noExt = (name: string) => name.replace(/\.[A-Za-z0-9]{1,5}$/, '')

async function open(file: File, depth: number, room: number, out: File[], notes: ArchiveNote[]): Promise<void> {
  const note: ArchiveNote = { archive: file.name, opened: 0, skipped: 0 }
  // 안쪽 압축은 바깥 압축 줄에 합쳐 센다 — 못 열었을 때만 따로 알린다
  const report = () => {
    if (depth === 0 || note.reason) notes.push(note)
  }
  let bytes: Uint8Array
  let entries: ReturnType<typeof zipEntries>
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
    entries = zipEntries(bytes)
  } catch {
    note.reason = '압축 파일이 깨졌거나 ZIP 이 아니라 열지 못했어요'
    out.push(file)
    report()
    return
  }
  // 압축 안 경로 앞에 '압축 이름' 폴더 — 폴더째 올린 압축이면 그 폴더 아래로
  const parent = relativePathOf(file).split('/').slice(0, -1).join('/')
  const prefix = [parent, noExt(file.name)].filter(Boolean).join('/')
  let total = 0
  for (const e of entries) {
    if (e.name.endsWith('/')) continue
    const name = baseName(e.name)
    const path = `${prefix}/${e.name}`
    if (isSystemFile({ name, webkitRelativePath: path }) || e.size === 0) continue
    if (out.length >= room) {
      note.skipped += 1
      continue
    }
    total += e.size
    if (e.encrypted || total > ZIP_MAX_TOTAL) {
      note.skipped += 1
      continue
    }
    let data: Uint8Array
    try {
      data = await readZipEntry(bytes, e)
    } catch {
      note.skipped += 1
      continue
    }
    const inner = new File([data as BlobPart], name, { type: mimeOf(name), lastModified: file.lastModified })
    setRelativePath(inner, path)
    ORIGIN.set(inner, archiveOf(file) || file.name)
    if (isZipFile(inner) && depth + 1 < MAX_DEPTH) {
      const before = out.length
      await open(inner, depth + 1, room, out, notes)
      note.opened += out.length - before
      continue
    }
    out.push(inner)
    note.opened += 1
  }
  if (note.opened === 0) {
    // 하나도 못 꺼냈으면(전부 암호 · 빈 압축) 원래 파일을 그대로 — 잃는 파일이 없게
    note.reason = note.skipped > 0 ? '안의 파일에 암호가 걸려 있거나 너무 커서 꺼내지 못했어요' : '안에 서류가 없어요'
    out.push(file)
  }
  report()
}

/**
 * 넣은 파일 중 압축(.zip)은 풀어 안의 파일로 바꾼다. 다른 파일은 그대로(순서 유지).
 * limit = 한 번에 다루는 파일 수(넘으면 나머지는 '못 꺼낸 것' 으로 센다).
 */
export async function expandArchives(files: readonly File[], limit = DROP_FILE_LIMIT): Promise<{ files: File[]; notes: ArchiveNote[] }> {
  const out: File[] = []
  const notes: ArchiveNote[] = []
  for (const f of files) {
    if (isZipFile(f)) await open(f, 0, limit, out, notes)
    else {
      if (isOtherArchive(f)) notes.push({ archive: f.name, opened: 0, skipped: 0, reason: `.${/\.([A-Za-z0-9]+)$/.exec(f.name)?.[1] ?? ''} 압축은 열 수 없어요 — 풀어서 올리면 하나씩 읽어요(이 파일은 그대로 서류함에)` })
      out.push(f)
    }
  }
  return { files: out, notes }
}

/** 화면에 띄울 한 줄 — '서류모음.zip 에서 서류 7개를 꺼냈어요 · 암호 1개는 못 꺼냄' */
export function archiveSummary(notes: readonly ArchiveNote[]): string {
  if (notes.length === 0) return ''
  const parts = notes.map((n) => {
    if (n.reason && n.opened === 0) return `${n.archive} — ${n.reason}`
    return `${n.archive} 에서 서류 ${n.opened}개를 꺼냈어요${n.skipped ? ` · ${n.skipped}개는 못 꺼냄(암호 · 너무 큼 · 한도)` : ''}`
  })
  return parts.slice(0, 3).join(' / ') + (parts.length > 3 ? ` 외 ${parts.length - 3}개` : '')
}
