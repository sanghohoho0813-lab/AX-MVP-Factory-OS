/**
 * 엑셀로 대상자 한 번에 넣기 — 원본 ExcelImport 마법사의 규칙 (D-92).
 *
 * 원본 SubsidyApp.jsx 1582~1860: 헤더 행 자동 탐지 → 컬럼 자동 매핑(완전 일치=높음 · 단독 부분 일치=보통 ·
 * 복수 후보=확인 필요) → 날짜·사업자번호 검사 → 미리보기(정상·주의·중복 의심·저장 제외) → 등록.
 *
 * 바뀐 한 가지 — 원본은 업체도 만들었다. 이 OS 에서 업체는 고객 운영에만 있다. 그래서 행의 업체는
 * **사업자번호(숫자 10자리) → 업체명** 순으로 고객 운영의 업체에 맞춘다. 못 맞추면 '고객 운영에 없는 업체' 로
 * 저장에서 뺀다(업체를 몰래 만들지 않는다). 업체 화면 안에서 열면 모든 행을 그 업체로 넣는다.
 * 주민등록번호는 받지 않는다 — 생년월일 칸만 읽는다.
 */

import { EMP_STAGES, type EmpStage } from './empRecords'

export interface XlField {
  key: string
  label: string
  required: boolean
  aliases: string[]
}

/** 원본 1582줄 XL_FIELDS (업체 쪽 필수는 '업체 화면 밖에서 열 때' 만 따진다) */
export const XL_FIELDS: XlField[] = [
  { key: 'companyName', label: '업체명', required: true, aliases: ['업체명', '회사명', '기업명', '고객사명', '거래처명', '사업장명', '법인명', '상호', '상호명'] },
  { key: 'bizNo', label: '사업자등록번호', required: false, aliases: ['사업자등록번호', '사업자번호', '사업자', '사업자NO', '사업자No', '등록번호', '사업장번호'] },
  { key: 'empName', label: '직원명', required: true, aliases: ['직원명', '근로자명', '성명', '이름', '대상자명', '신청자명', '근로자', '직원', '대상자'] },
  { key: 'birthDate', label: '생년월일', required: false, aliases: ['생년월일', '생일', '생년', '생년월일6자리'] },
  { key: 'startDate', label: '입사일', required: false, aliases: ['입사일', '입사일자', '채용일', '채용일자', '고용일', '고용일자', '근무시작일', '입직일'] },
  { key: 'salary', label: '월 급여', required: false, aliases: ['급여', '월급여', '월급', '임금', '월임금', '보수월액', '기본급'] },
  { key: 'programName', label: '지원금명', required: false, aliases: ['지원금명', '지원금', '지원사업', '지원사업명', '장려금명', '장려금', '프로그램명', '제도명', '사업명'] },
  { key: 'status', label: '신청상태', required: false, aliases: ['신청상태', '상태', '진행상태', '진행단계', '처리상태', '접수상태', '신청여부', '지급상태'] },
  { key: 'memo', label: '메모', required: false, aliases: ['메모', '비고', '특이사항', '참고', '코멘트', '내용', '상담메모'] },
]

export type Conf = 'high' | 'mid' | 'low' | 'none'

/** 원본 1599줄 — 괄호 부가설명·공백·특수문자 제거 + 소문자 */
export function xlNormHead(h: unknown): string {
  return String(h == null ? '' : h)
    .replace(/\(.*?\)|（.*?）/g, '')
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/g, '')
}

/** 원본 1603줄 xlAutoMap */
export function xlAutoMap(headerCells: readonly unknown[]): { map: Record<string, number>; conf: Record<string, Conf> } {
  const norm = (headerCells || []).map(xlNormHead)
  const map: Record<string, number> = {}
  const conf: Record<string, Conf> = {}
  for (const f of XL_FIELDS) {
    let exact = -1
    let partial = -1
    let partialCnt = 0
    norm.forEach((h, idx) => {
      if (!h) return
      if (f.aliases.some((a) => xlNormHead(a) === h)) {
        if (exact === -1) exact = idx
        return
      }
      if (
        f.aliases.some((a) => {
          const an = xlNormHead(a)
          return an.length >= 2 && h.length >= 2 && (h.includes(an) || an.includes(h))
        })
      ) {
        if (partial === -1) partial = idx
        partialCnt++
      }
    })
    if (exact >= 0) {
      map[f.key] = exact
      conf[f.key] = 'high'
    } else if (partial >= 0) {
      map[f.key] = partial
      conf[f.key] = partialCnt > 1 ? 'low' : 'mid'
    } else {
      map[f.key] = -1
      conf[f.key] = 'none'
    }
  }
  // 같은 엑셀 컬럼이 두 필드에 잡히면 신뢰도 높은 쪽만 유지
  const used: Record<number, string> = {}
  const rank: Record<Conf, number> = { high: 3, mid: 2, low: 1, none: 0 }
  for (const f of XL_FIELDS) {
    const c = map[f.key]
    if (c == null || c < 0) continue
    if (used[c] !== undefined) {
      if (rank[conf[f.key]] > rank[conf[used[c]]]) {
        map[used[c]] = -1
        conf[used[c]] = 'none'
        used[c] = f.key
      } else {
        map[f.key] = -1
        conf[f.key] = 'none'
      }
    } else used[c] = f.key
  }
  return { map, conf }
}

/** 원본 1629줄 — 첫 10행 가운데 필수 3점·선택 1점이 가장 높은 행 */
export function xlDetectHeader(grid: readonly (readonly unknown[])[]): number {
  let best = 0
  let bestScore = 0
  for (let i = 0; i < Math.min(10, grid.length); i++) {
    const r = xlAutoMap(grid[i] || [])
    let score = 0
    for (const f of XL_FIELDS) if (r.map[f.key] >= 0) score += f.required ? 3 : 1
    if (score > bestScore) {
      bestScore = score
      best = i
    }
  }
  return best
}

/** 원본 1640줄 — yyyy-mm-dd / yyyy.mm.dd / yyyy/mm/dd / 20260115 / 엑셀 일련번호 / m/d/yy */
export function xlNormDate(v: unknown): { value: string; ok: boolean; empty?: boolean } {
  if (v == null || String(v).trim() === '') return { value: '', ok: true, empty: true }
  let s = String(v).trim()
  if (/^\d{5}$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000)
    if (!Number.isNaN(d.getTime())) return { value: d.toISOString().split('T')[0], ok: true }
  }
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (us) {
    let y = Number(us[3])
    if (y < 100) y += y < 50 ? 2000 : 1900
    s = `${y}-${us[1]}-${us[2]}`
  }
  let m = s
    .replace(/[.·/년월]/g, '-')
    .replace(/일/g, '')
    .replace(/\s+/g, '')
    .replace(/-+/g, '-')
    .replace(/-$/, '')
  if (/^\d{8}$/.test(m)) m = `${m.slice(0, 4)}-${m.slice(4, 6)}-${m.slice(6, 8)}`
  const mm = m.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (mm) {
    const dt = new Date(Number(mm[1]), Number(mm[2]) - 1, Number(mm[3]))
    if (!Number.isNaN(dt.getTime()) && dt.getMonth() === Number(mm[2]) - 1) return { value: `${mm[1]}-${`0${mm[2]}`.slice(-2)}-${`0${mm[3]}`.slice(-2)}`, ok: true }
  }
  return { value: String(v), ok: false }
}

/** 원본 1656줄 */
export function xlBizNoCheck(s: unknown): { ok: boolean; reason?: string } {
  const raw = String(s || '').trim()
  const d = raw.replace(/\D/g, '')
  if (d.length !== 10) return { ok: false, reason: '숫자 10자리가 아님' }
  if (raw.includes('-') && !/^\d{3}-\d{2}-\d{5}$/.test(raw)) return { ok: false, reason: '하이픈 위치 이상 (123-45-67890 형식 권장)' }
  return { ok: true }
}

/** 원본 matchProgramId — 이름이 같거나 별칭이 들어 있으면 */
export function matchProgramId(name: string, programs: ReadonlyArray<{ id: string; name: string }>): string {
  if (!name) return ''
  const n = String(name).replace(/\s+/g, '')
  for (const p of programs) if (p.name.replace(/\s+/g, '') === n) return p.id
  const aliases: Record<string, string[]> = { 청년일자리도약: ['청년일자리도약', '청년도약'], 고용촉진: ['고용촉진'], 고령자계속고용: ['고령자계속고용'], 새일여성인턴: ['새일여성인턴'], 정규직전환: ['정규직전환'], 시니어인턴: ['시니어인턴'] }
  for (const [k, list] of Object.entries(aliases)) {
    if (!list.some((a) => n.includes(a))) continue
    const hit = programs.find((p) => p.name.replace(/\s+/g, '').includes(k))
    if (hit) return hit.id
  }
  for (const p of programs) {
    const pn = p.name.replace(/\s+/g, '')
    if (pn && n.length >= 4 && (pn.includes(n) || n.includes(pn))) return p.id
  }
  return ''
}

/** 원본 findStatusKey — 원본의 '신청완료'·'진행중' 같은 말도 받아 준다 */
export function findStatusKey(raw: string): EmpStage | null {
  if (!raw) return null
  const n = String(raw).replace(/\s+/g, '')
  const hit = EMP_STAGES.find((s) => {
    const l = s.label.replace(/\s+/g, '')
    return l === n || n.includes(l)
  })
  if (hit) return hit.key
  if (/신청완료|접수/.test(n)) return 'submitted'
  if (/진행/.test(n)) return 'inprogress'
  if (/지급완료|완료/.test(n)) return 'completed'
  return null
}

/** csv 한 벌을 표로 (따옴표 안 쉼표·줄바꿈 처리) */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let cur: string[] = []
  let cell = ''
  let q = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (q) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',' || ch === '\t') {
      cur.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      cur.push(cell)
      rows.push(cur)
      cur = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || cur.length) {
    cur.push(cell)
    rows.push(cur)
  }
  return rows.map((r) => r.map((c) => c.trim()))
}

export interface ImportClient {
  id: string
  companyName: string
  businessNumber: string
}

export interface PreviewRow {
  rowNo: number
  companyName: string
  bizNo: string
  empName: string
  startDate: string
  birthDate: string
  salary: number
  programName: string
  programId: string
  stage: EmpStage
  memo: string
  clientId: string
  status: '정상' | '주의' | '중복 의심' | '저장 제외'
  messages: string[]
}

export interface ImportPreview {
  rows: PreviewRow[]
  /** 저장될 줄 (제외·중복 뺀 것) */
  toSave: PreviewRow[]
  junk: number
  excluded: number
  warned: number
  duplicates: number
  clientCount: number
}

function normName(s: string): string {
  return s.replace(/\(주\)|㈜|주식회사|\s+/g, '').toLowerCase()
}

/**
 * 원본 buildPreview — 현재 헤더 행·매핑 기준 미리보기·검증 (저장 없음).
 * fixedClientId 가 있으면(업체 화면 안) 모든 행을 그 업체로 넣고 업체 칸은 보지 않는다.
 */
export function buildImportPreview(input: {
  grid: readonly (readonly unknown[])[]
  headerRow: number
  map: Record<string, number>
  clients: readonly ImportClient[]
  programs: ReadonlyArray<{ id: string; name: string }>
  existing: ReadonlyArray<{ clientId: string; name: string; hireDate: string }>
  fixedClientId?: string
}): ImportPreview {
  const { grid, headerRow, map, clients, programs, existing, fixedClientId } = input
  const cell = (row: readonly unknown[], key: string) => {
    const i = map[key]
    return i == null || i < 0 ? '' : String(row[i] == null ? '' : row[i]).trim()
  }
  const byBiz = new Map<string, ImportClient>()
  const byName = new Map<string, ImportClient>()
  for (const c of clients) {
    const d = (c.businessNumber || '').replace(/\D/g, '')
    if (d && !byBiz.has(d)) byBiz.set(d, c)
    const n = normName(c.companyName || '')
    if (n && !byName.has(n)) byName.set(n, c)
  }
  const rows: PreviewRow[] = []
  const seenPair: Record<string, number> = {}
  const seenSave = new Set<string>()
  let junk = 0
  for (let i = headerRow + 1; i < grid.length; i++) {
    const raw = grid[i]
    if (!raw || raw.every((v) => String(v == null ? '' : v).trim() === '')) continue
    const rowNo = i + 1
    const companyName = cell(raw, 'companyName')
    const bizNo = cell(raw, 'bizNo')
    const empName = cell(raw, 'empName')
    if (!fixedClientId && !companyName && !bizNo && !empName) {
      junk++
      continue
    }
    if (fixedClientId && !empName) {
      junk++
      continue
    }
    if (/^(합계|총계|소계)$/.test(companyName) || /^(합계|총계|소계)$/.test(empName)) {
      junk++
      continue
    }
    const startD = xlNormDate(cell(raw, 'startDate'))
    const birthD = xlNormDate(cell(raw, 'birthDate'))
    const programName = cell(raw, 'programName')
    const warns: string[] = []
    let excluded: string | null = null
    let client: ImportClient | undefined
    if (fixedClientId) client = clients.find((c) => c.id === fixedClientId)
    else {
      if (!companyName && !bizNo) excluded = '업체명 없음 — 저장 제외'
      const digits = bizNo.replace(/\D/g, '')
      if (bizNo) {
        const bc = xlBizNoCheck(bizNo)
        if (!bc.ok) warns.push(`사업자번호 확인 필요 — ${bc.reason}`)
      }
      client = (digits && byBiz.get(digits)) || byName.get(normName(companyName))
      if (!client && !excluded) excluded = `고객 관리에 없는 업체 (${companyName || bizNo}) — 업체를 먼저 등록하세요`
    }
    if (!empName && !excluded) excluded = '직원명 없음 — 저장 제외'
    if (!startD.ok) warns.push('입사일 날짜 형식 확인 필요')
    if (!birthD.ok) warns.push('생년월일 날짜 형식 확인 필요')
    const pid = matchProgramId(programName, programs)
    if (programName && !pid) warns.push('지원금명 자동 매칭 실패 — 미지정으로 등록')
    else if (!programName) warns.push('지원금명 미입력 — 미지정으로 등록')
    const rawStatus = cell(raw, 'status')
    const stageKey = findStatusKey(rawStatus)
    if (rawStatus && !stageKey) warns.push('신청상태 미매칭 — 준비중으로 등록')
    const salary = Number(cell(raw, 'salary').replace(/[^\d]/g, '')) || 0
    let isDup = false
    if (client && empName) {
      const pairKey = `${client.id}|${empName}`
      if (seenPair[pairKey]) {
        isDup = true
        warns.push(`같은 업체+직원명 중복 의심 (${seenPair[pairKey]}행과 동일)`)
      } else seenPair[pairKey] = rowNo
      const sd = startD.ok ? startD.value : ''
      const dupDb = existing.some((ex) => ex.clientId === client!.id && ex.name.trim() === empName && (!sd || !ex.hireDate || ex.hireDate === sd))
      if (dupDb) {
        isDup = true
        warns.push('이미 등록된 대상자 — 저장에서 뺍니다')
      }
      const sk = `${client.id}|${empName}|${sd}`
      if (seenSave.has(sk)) isDup = true
      seenSave.add(sk)
    }
    const status: PreviewRow['status'] = excluded ? '저장 제외' : isDup ? '중복 의심' : warns.length > 0 ? '주의' : '정상'
    rows.push({
      rowNo,
      companyName: client?.companyName ?? companyName,
      bizNo,
      empName,
      startDate: startD.ok ? startD.value : '',
      birthDate: birthD.ok ? birthD.value : '',
      salary,
      programName,
      programId: pid,
      stage: stageKey ?? 'preparing',
      memo: cell(raw, 'memo'),
      clientId: client?.id ?? '',
      status,
      messages: (excluded ? [excluded] : []).concat(warns),
    })
  }
  const toSave = rows.filter((r) => r.status !== '저장 제외' && r.status !== '중복 의심')
  return {
    rows,
    toSave,
    junk,
    excluded: rows.filter((r) => r.status === '저장 제외').length,
    warned: rows.filter((r) => r.status === '주의').length,
    duplicates: rows.filter((r) => r.status === '중복 의심').length,
    clientCount: new Set(toSave.map((r) => r.clientId)).size,
  }
}

/** 원본 downloadTemplate 의 샘플 양식 — csv 로 (엑셀에서 바로 열린다) */
export function templateCsv(): string {
  const headers = ['업체명', '사업자등록번호', '직원명', '생년월일', '입사일', '월 급여', '지원금명', '신청상태', '메모']
  const rows = [
    ['(주)한빛테크', '123-45-67890', '박청년', '2000-03-15', '2026-04-01', '2800000', '청년일자리도약장려금', '지급중', '사전신청 완료'],
    ['(주)한빛테크', '123-45-67890', '이도약', '1999-11-02', '2026-05-12', '2600000', '청년일자리도약장려금', '준비중', ''],
    ['바른상사', '987-65-43210', '정새일', '1988-07-21', '2026-03-02', '2500000', '새일여성인턴제', '서류접수', '새일센터 연계'],
  ]
  return `﻿${[headers, ...rows].map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\r\n')}`
}
