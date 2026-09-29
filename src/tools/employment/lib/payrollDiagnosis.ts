// ============================================================
// 4대보험 가입자 명부 자동진단 — 파일 읽기 + 순수 로직(rosterCore) 다시 내보내기
//
// 원본: git-test-kind-cori/src/lib/payrollDiagnosis.js 를 TS 로 옮겼다.
// 바뀐 것 둘: (1) xlsx 는 OS 의 xlsxText 로 읽는다.
//            (2) PDF 글자 추출은 OS 의 docTextExtract.extractTextFromFile 을 쓴다 (pdfjs 직접 호출 제거).
// D-136: 분류·계산 로직은 rosterCore.ts 한 곳에 있다(원본 화면도 같은 파일을 쓴다).
// ============================================================

import { extractTextFromFile } from '../../../services/docTextExtract'
import { isXlsxFile, readXlsxText } from '../../../services/xlsxText'
import { detectRoster, extractEmployees, parseRosterText, textToGrid, type RosterEmployee, type RosterMeta } from './rosterCore'

export * from './rosterCore'

export type RosterFileError = 'unsupported' | 'empty' | 'no_rows' | 'no_text' | 'read_failed'

export interface RosterFileResult {
  ok: boolean
  employees?: RosterEmployee[]
  meta?: RosterMeta
  headerIdx?: number
  missingCount?: number
  error?: RosterFileError
  message?: string
  /** 글자를 어떻게 뽑았는지 (pdf_text | ocr | text | xlsx) */
  method?: string
}

// ── 파일 파싱 (엑셀 · CSV/TSV 글자 · PDF) — 브라우저 메모리에서만 ──────────
// 엑셀(.xlsx)은 D-89 부터 그대로 읽는다 (services/xlsxText.ts, 라이브러리 없이).
export async function parseRosterFile(file: File): Promise<RosterFileResult> {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  const isText = file.type.startsWith('text/') || ['csv', 'tsv', 'txt'].indexOf(ext) >= 0
  const isPdf = file.type === 'application/pdf' || ext === 'pdf'
  const isXlsx = isXlsxFile(file)
  if (!isText && !isPdf && !isXlsx) return { ok: false, error: 'unsupported' }
  try {
    if (isXlsx) {
      const text = await readXlsxText(await file.arrayBuffer())
      const grid = textToGrid(text)
      if (!grid || grid.length < 2) return { ok: false, error: 'empty' }
      const det = detectRoster(grid)
      const emps = extractEmployees(grid, det)
      if (!emps.length) {
        const res = parseRosterText(text)
        if (res.employees.length) return { ok: true, employees: res.employees, meta: res.meta, missingCount: res.missingCount, method: 'xlsx' }
        return { ok: false, error: 'no_rows', headerIdx: det.headerIdx }
      }
      return { ok: true, employees: emps, meta: det.meta, headerIdx: det.headerIdx, method: 'xlsx' }
    }
    if (isPdf) {
      const ex = await extractTextFromFile(file)
      const textLen = ex.text.replace(/\s/g, '').length
      if (textLen < 8) return { ok: false, error: 'no_text', method: ex.method }
      const res = parseRosterText(ex.text)
      if (!res.employees.length) return { ok: false, error: 'no_rows', method: ex.method }
      return { ok: true, employees: res.employees, meta: res.meta, missingCount: res.missingCount, method: ex.method }
    }
    const text = await file.text()
    const grid = textToGrid(text)
    if (!grid || grid.length < 2) return { ok: false, error: 'empty' }
    const det = detectRoster(grid)
    const emps = extractEmployees(grid, det)
    if (!emps.length) {
      // 헤더가 없는 붙여넣기 글자일 수 있다 → 주민번호 앵커 파서로 한 번 더
      const res = parseRosterText(text)
      if (res.employees.length) return { ok: true, employees: res.employees, meta: res.meta, missingCount: res.missingCount, method: 'text' }
      return { ok: false, error: 'no_rows', headerIdx: det.headerIdx }
    }
    return { ok: true, employees: emps, meta: det.meta, headerIdx: det.headerIdx, method: 'text' }
  } catch (e) {
    return { ok: false, error: 'read_failed', message: e instanceof Error ? e.message : undefined }
  }
}

