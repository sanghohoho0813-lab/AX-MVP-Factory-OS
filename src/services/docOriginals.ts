/**
 * D-549 SAFE-5 서류 원본 묶음(내려받기 — 올릴 때 합친 PDF 를 나누는 docBundle.ts 와 다른 일) — 서류함의 원본 파일(PDF · 사진 · 한글 …)을 압축 파일(.zip) 하나로 내려받는다.
 *
 * 왜: 원본은 클라우드 보관함에만 있었다 — 백업 파일(D-521)에는 '파일 목록' 만 들어가고, 원본은 칸마다 하나씩 받아야 했다.
 *     정책자금 · 지원사업을 신청할 때 받은 서류를 기관에 한꺼번에 내야 하는데, 그때마다 칸을 하나씩 눌렀다.
 *
 *  - 파일 이름은 **서류 칸 이름**(사업자등록증.pdf) — 고객이 보낸 이름('스캔0001.pdf' · 'KakaoTalk_2026…jpg')이 아니라 무엇인지 보이게.
 *    같은 이름이면 '(2)' · 확장자는 원래 파일 것. 원래 이름 · 발급일 · 유효기간 · 올린 날은 '목록.txt' 에.
 *  - 못 받은 파일(지워짐 · 인터넷 끊김)은 건너뛰고 목록 맨 아래에 까닭을 적는다 — 나머지는 그대로 담긴다(하나 때문에 전부 멈추지 않게).
 *  - 너무 크면(합계 300MB) 그 뒤 파일은 담지 않고 목록에 적는다 — 브라우저가 멈추지 않게.
 *  - 읽기만 한다(저장 · 지우기 0). 규칙 계산 — 외부 호출은 우리 보관함에서 파일을 받는 것뿐.
 */
import type { ClientOpsRecord, DocumentKey } from '../types/clientOps'
import { allDocumentMetas, documentMetaOf } from './clientOpsDocuments'
import { zipStore } from './patent/zip'

/** 한 묶음에 담는 원본 합계 한도 — 넘으면 그 뒤 파일은 목록에만(업체별로 나눠 받게) */
export const ORIGINALS_MAX_BYTES = 300 * 1024 * 1024

export interface OriginalItem {
  key: DocumentKey
  label: string
  fileName: string
  storagePath: string
  fileSize: number
  issuedAt: string
  validUntil: string
  uploadedAt: string
}

/** 이 업체 서류함에서 원본 파일이 있는 칸(서류함 순서 그대로) — keys 를 주면 그 칸만 */
export function originalItems(record: ClientOpsRecord, keys?: readonly DocumentKey[] | null): OriginalItem[] {
  const only = keys ? new Set(keys) : null
  const order = allDocumentMetas(record).map((m) => m.key)
  // 지운 칸에 파일만 남은 것도 담는다(원본을 잃지 않게) — 서류함 순서 뒤에
  const rest = Object.keys(record.documents ?? {}).filter((k) => !order.includes(k))
  const out: OriginalItem[] = []
  for (const key of [...order, ...rest]) {
    if (only && !only.has(key)) continue
    const st = record.documents?.[key]
    if (!st?.storagePath) continue
    out.push({
      key,
      label: documentMetaOf(record, key).label,
      fileName: st.fileName || st.storagePath.split('/').pop() || '',
      storagePath: st.storagePath,
      fileSize: st.fileSize || 0,
      issuedAt: st.issuedAt || '',
      validUntil: st.validUntil || '',
      uploadedAt: (st.uploadedAt || '').slice(0, 10),
    })
  }
  return out
}

/** 압축 안 이름에 쓸 수 없는 글자(윈도 · 맥)를 빼고 줄인다 */
export function zipSafeName(s: string, max = 60): string {
  // 보이지 않는 제어 글자(줄바꿈 · 탭 …)는 빈칸으로 — 정규식 대신 글자 번호로(검사 도구가 제어 글자 정규식을 싫어함)
  const visible = [...s].map((c) => (c.charCodeAt(0) < 32 ? ' ' : c)).join('')
  const t = visible.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '')
  return (t.length > max ? t.slice(0, max).trim() : t) || '서류'
}

/** 확장자(점 포함 · 소문자) — 없으면 '' */
function extOf(fileName: string): string {
  const m = /\.([A-Za-z0-9]{1,6})$/.exec(fileName.trim())
  return m ? `.${m[1].toLowerCase()}` : ''
}

/** 칸 이름 + 원래 확장자 · 같은 이름이면 '(2)' '(3)' — used 는 대소문자 무시로 센다 */
export function entryName(label: string, fileName: string, used: Set<string>, folder = ''): string {
  const base = zipSafeName(label)
  const ext = extOf(fileName)
  let n = 1
  let name = `${folder}${base}${ext}`
  while (used.has(name.toLowerCase())) {
    n += 1
    name = `${folder}${base} (${n})${ext}`
  }
  used.add(name.toLowerCase())
  return name
}

export interface OriginalRow {
  item: OriginalItem
  /** 압축 안 이름 — 못 담았으면 null */
  entry: string | null
  /** 못 담은 까닭 */
  reason?: string
}

const sizeText = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : n >= 1024 ? `${Math.round(n / 1024)}KB` : `${n}B`)

/** 업체 하나의 목록.txt — 메모장에서 한글이 깨지지 않게 BOM 을 붙인다 */
export function originalsIndex(company: string, title: string, rows: readonly OriginalRow[], today: string): string {
  const got = rows.filter((r) => r.entry)
  const miss = rows.filter((r) => !r.entry)
  const lines = [
    `${company} — ${title}`,
    `만든 날: ${today} · 담은 파일 ${got.length}개${miss.length ? ` · 못 담은 파일 ${miss.length}개(맨 아래)` : ''}`,
    '파일 이름은 서류 칸 이름이에요. 원래 파일 이름 · 발급일 · 유효기간은 아래에.',
    '',
  ]
  for (const r of got) {
    const parts = [`원래 이름 ${r.item.fileName || '-'}`]
    if (r.item.issuedAt) parts.push(`발급일 ${r.item.issuedAt}`)
    if (r.item.validUntil) parts.push(`유효기간 끝 ${r.item.validUntil}`)
    if (r.item.uploadedAt) parts.push(`올린 날 ${r.item.uploadedAt}`)
    if (r.item.fileSize) parts.push(sizeText(r.item.fileSize))
    lines.push(`· ${(r.entry ?? '').split('/').pop()} — ${parts.join(' · ')}`)
  }
  if (miss.length) {
    lines.push('', `못 담은 파일 ${miss.length}개 — 서류함에서 그 칸을 열어 다시 받아 보세요`)
    for (const r of miss) lines.push(`· ${r.item.label} (${r.item.fileName || '이름 없음'}) — ${r.reason ?? '받지 못함'}`)
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}

export interface OriginalsSource {
  record: ClientOpsRecord
  /** 이 칸만(없으면 원본이 있는 칸 전부) */
  keys?: readonly DocumentKey[] | null
}

export interface OriginalsResult {
  zip: Uint8Array
  /** 담은 파일 수 · 못 담은 파일 수 · 담은 업체 수 */
  got: number
  failed: number
  clients: number
  /** 크기 한도로 뺀 파일 수 */
  overSize: number
  rows: Array<OriginalRow & { company: string }>
}

/**
 * 원본 묶음을 만든다. fetchBytes 는 보관함 경로 → 파일 내용(서명 주소로 받기 · 시험에서는 가짜).
 * 여러 업체면 업체마다 폴더(업체 이름/) + 그 폴더의 목록.txt, 맨 위에 전체 목록.txt.
 * 하나씩 차례로 받는다(동시에 많이 받으면 휴대폰 · 느린 인터넷에서 끊긴다) · 실패하면 한 번 더.
 */
export async function buildOriginalsZip(
  sources: readonly OriginalsSource[],
  opts: {
    fetchBytes: (storagePath: string) => Promise<Uint8Array>
    today: string
    title: string
    onProgress?: (done: number, total: number) => void
    maxBytes?: number
  },
): Promise<OriginalsResult> {
  const max = opts.maxBytes ?? ORIGINALS_MAX_BYTES
  const many = sources.length > 1
  const plan = sources.map((s) => ({ record: s.record, items: originalItems(s.record, s.keys) })).filter((p) => p.items.length > 0)
  const total = plan.reduce((n, p) => n + p.items.length, 0)
  const files: Array<{ name: string; data: Uint8Array | string }> = []
  const rows: OriginalsResult['rows'] = []
  const usedFolders = new Set<string>()
  let bytes = 0
  let done = 0
  let overSize = 0
  for (const p of plan) {
    const company = p.record.companyName || '이름 없는 업체'
    let folder = ''
    if (many) {
      let f = zipSafeName(company, 40)
      let n = 1
      while (usedFolders.has(f.toLowerCase())) f = `${zipSafeName(company, 40)} (${++n})`
      usedFolders.add(f.toLowerCase())
      folder = `${f}/`
    }
    const used = new Set<string>([`${folder}목록.txt`.toLowerCase()])
    const mine: OriginalRow[] = []
    for (const item of p.items) {
      done += 1
      opts.onProgress?.(done, total)
      if (bytes + item.fileSize > max) {
        overSize += 1
        mine.push({ item, entry: null, reason: `묶음이 너무 커져(${sizeText(max)} 넘음) 담지 않았어요 — 업체 서류함에서 따로 내려받으세요` })
        continue
      }
      let data: Uint8Array | null = null
      let reason = ''
      for (let tryNo = 0; tryNo < 2 && !data; tryNo += 1) {
        try {
          data = await opts.fetchBytes(item.storagePath)
        } catch (cause) {
          reason = cause instanceof Error && cause.message ? cause.message : '받지 못함'
        }
      }
      if (!data) {
        mine.push({ item, entry: null, reason: reason || '받지 못함' })
        continue
      }
      if (bytes + data.length > max) {
        overSize += 1
        mine.push({ item, entry: null, reason: `묶음이 너무 커져(${sizeText(max)} 넘음) 담지 않았어요 — 업체 서류함에서 따로 내려받으세요` })
        continue
      }
      bytes += data.length
      const entry = entryName(item.label, item.fileName, used, folder)
      files.push({ name: entry, data })
      mine.push({ item: { ...item, fileSize: item.fileSize || data.length }, entry })
    }
    files.push({ name: `${folder}목록.txt`, data: originalsIndex(company, opts.title, mine, opts.today) })
    rows.push(...mine.map((r) => ({ ...r, company })))
  }
  const got = rows.filter((r) => r.entry).length
  const failed = rows.length - got
  if (many) {
    const head = [`${opts.title} — ${opts.today}`, `업체 ${plan.length}곳 · 담은 파일 ${got}개${failed ? ` · 못 담은 파일 ${failed}개` : ''}`, '업체마다 폴더 안 목록.txt 에 서류 칸 · 원래 파일 이름 · 발급일이 있어요.', '']
    for (const p of plan) {
      const company = p.record.companyName || '이름 없는 업체'
      const mine = rows.filter((r) => r.company === company)
      head.push(`· ${company} — ${mine.filter((r) => r.entry).length}개${mine.some((r) => !r.entry) ? ` (못 담음 ${mine.filter((r) => !r.entry).length})` : ''}`)
    }
    files.unshift({ name: '목록.txt', data: '﻿' + head.join('\r\n') + '\r\n' })
  }
  return { zip: zipStore(files), got, failed, clients: plan.length, overSize, rows }
}

/** 내려받는 압축 파일 이름 */
export function originalsZipName(kind: 'client' | 'policy' | 'workspace', name: string, today: string): string {
  const label = kind === 'policy' ? '정책자금신청서류' : kind === 'workspace' ? '서류원본전부' : '서류원본'
  return `${zipSafeName(name || (kind === 'workspace' ? '작업공간' : '업체'), 40).replace(/\s+/g, '_')}_${label}_${today}.zip`
}

/** 끝난 뒤 한 줄 — 몇 개 담았는지 · 못 담은 것 */
export function originalsDoneLine(r: Pick<OriginalsResult, 'got' | 'failed' | 'clients' | 'overSize'>, workspace = false): string {
  if (r.got === 0 && r.failed === 0) return '내려받을 원본 파일이 없어요 — 서류함에 파일을 올린 칸이 없습니다.'
  const head = workspace ? `업체 ${r.clients}곳 · 원본 ${r.got}개를 압축 파일 하나로 내려받았어요` : `원본 ${r.got}개를 압축 파일 하나로 내려받았어요`
  if (!r.failed) return `${head}. 파일 이름은 서류 칸 이름이고, 원래 이름 · 발급일은 안의 목록.txt 에 있어요.`
  return `${head}. ${r.failed}개는 담지 못했어요${r.overSize ? '(크기 한도)' : ''} — 까닭은 목록.txt 맨 아래에 있어요.`
}
