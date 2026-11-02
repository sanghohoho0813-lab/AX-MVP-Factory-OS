/**
 * D-498 대화창에 서류 올리기 — 대표: "오늘 ○○ 1차 미팅 가는데 사업자등록증 받았어, 정책자금 어떻게 제안할까".
 *
 *  1. 이 기기에서 글을 읽는다(PDF 글자 · 사진 OCR · 한글 · 워드) — 아직 아무 데도 저장하지 않는다.
 *  2. 어느 회사 서류인가 — 사업자번호 · 이름으로 등록된 업체를 찾고, 없으면 '새 업체'.
 *  3. 임시 판정 — 그 업체 기록(새 업체면 빈 기록)에 서류를 얹어 회사 정보를 읽고(analyzeUploadedDocs) 모듈 판정을 다시 한다. 저장하지 않는다.
 *  4. 답 아래 단추 하나로 진짜 저장 — 기존 업체는 그 업체 '서류 올리기'(D-187 넘기기), 새 업체는 '새 업체 등록' 창(서류로 칸이 채워진 채).
 *     저장 · 분류 · 분석은 원래 화면의 길을 그대로 쓴다(새로 만든 저장 길 없음).
 */
import type { ClientOpsRecord } from '../../types/clientOps'
import type { ReadMethod, ReadDoc } from '../docAutoFill'
import type { DocBatchSummary } from '../docAutoAnalyze'
import type { NewClientGuess } from '../newClientFromDocs'

/** 대화창에 올린 서류 하나(파일은 메모리에만) */
export interface ChatDoc {
  id: string
  file: File
  status: 'reading' | 'done'
  text: string
  method: ReadMethod
  /** 읽고 난 뒤 서류 종류(사업자등록증 · 재무제표 …) — 칸 이름 */
  label: string
  /** 못 읽은 까닭 한 줄 */
  note?: string
}

/** 서류가 가리키는 회사 */
export interface DocCompany {
  /** 등록된 업체면 그 id */
  clientId: string | null
  name: string
  bizNo: string
  contact: string
}

const digits = (s: string) => String(s ?? '').replace(/[^0-9]/g, '')

/** 읽은 서류의 회사 — 서류에서 찾은 이름 · 번호로 등록된 업체를 찾는다(번호가 맞으면 번호, 아니면 이름) */
export function docCompanyOf(guess: NewClientGuess, records: readonly ClientOpsRecord[], findClient: (records: ClientOpsRecord[], c: { name: string; bizNo: string }) => ClientOpsRecord | null): DocCompany | null {
  const name = guess.companyName?.value?.trim() ?? ''
  const bizNo = guess.businessNumber?.value?.trim() ?? ''
  const contact = guess.contactName?.value?.trim() ?? ''
  if (!name && digits(bizNo).length !== 10) return null
  const hit = findClient([...records], { name, bizNo })
  return { clientId: hit?.id ?? null, name: hit?.companyName ?? name, bizNo, contact }
}

/** 대화창 한 번에 받는 서류 수 — 더 많으면 업체 상세 [서류 올리기] 로 */
export const CHAT_DOC_MAX = 10

/** 질문 없이 서류만 보냈을 때 묻는 말 */
export function defaultDocQuestion(labels: readonly string[]): string {
  const kinds = [...new Set(labels.filter(Boolean))].slice(0, 2).join(' · ')
  return kinds ? `${kinds} 받았어 — 이 업체에 무엇을 먼저 제안할까?` : '이 서류로 무엇을 먼저 제안할 수 있을까?'
}

/** 임시 판정 결과에서 '방금 올린 서류로 읽은 것' 줄(자료 칸 · 규칙 답 공용) */
export function readFactsLines(summary: Pick<DocBatchSummary, 'entered' | 'flagged'> | null): string[] {
  if (!summary) return []
  const out = summary.entered.map((e) => `${e.label}: ${e.display}`)
  for (const f of summary.flagged) out.push(`${f.label}: ${f.display}(확인 필요)`)
  return [...new Set(out)].slice(0, 12)
}

/**
 * 임시 판정 — 업체 기록(새 업체면 빈 기록)에 서류를 얹는다. 저장하지 않는다.
 * 칸이 정해진 서류는 '받음' 으로 두어(정책자금 준비 서류 등) 판정이 서류함을 보게 한다.
 */
export async function previewWithDocs(base: ClientOpsRecord, docs: readonly ChatDoc[], ctx: { now: string; today: string; makeId: () => string }): Promise<{ record: ClientOpsRecord; summary: DocBatchSummary }> {
  const [{ placeDocument }, { allDocumentMetas }, { withDocument }, { analyzeUploadedDocs }] = await Promise.all([
    import('../docClassify'),
    import('../clientOpsDocuments'),
    import('../clientOpsService'),
    import('../docAutoAnalyze'),
  ])
  const metas = allDocumentMetas(base).filter((m) => m.needsFile)
  let rec = base
  const readDocs: ReadDoc[] = []
  for (const d of docs) {
    if (d.status !== 'done') continue
    const p = placeDocument({ text: d.text, fileName: d.file.name }, metas)
    if (p.kind === 'existing') {
      rec = withDocument(rec, p.key, { received: true, ...(p.issuedAt ? { issuedAt: p.issuedAt } : {}) })
      readDocs.push({ key: p.key, fileName: d.file.name, text: d.text, method: d.method, docSure: p.sure })
    } else if (d.text) {
      // 칸이 없는 서류도 글은 읽는다 — 서류 올리기 창이 새 칸(customdoc_)에 넣을 때와 같은 모양(명부 · 크레탑 · 주주명부는 글로 판단)
      readDocs.push({ key: 'customdoc_chat' as ReadDoc['key'], fileName: d.file.name, text: d.text, method: d.method, docSure: false })
    }
  }
  return analyzeUploadedDocs(rec, readDocs, ctx)
}

/** 서류 칸 이름(읽기 끝난 뒤 칩에 보일 이름) — 모르면 '' */
export async function labelOfDoc(text: string, fileName: string): Promise<string> {
  const [{ placeDocument }, { allDocumentMetas }] = await Promise.all([import('../docClassify'), import('../clientOpsDocuments')])
  const p = placeDocument({ text, fileName }, allDocumentMetas({ customDocuments: [] }).filter((m) => m.needsFile))
  return p.kind === 'existing' || p.sure ? p.label : ''
}

/** AI 에 보내도 되는 '읽은 것' 만 — 사람 이름 · 번호 · 생년월일 · 주소 · 연락처는 빼고(업종 · 개업일 · 매출 · 직원 수 같은 것) */
const PRIVATE_FACT = /representative|contact|number|phone|email|birth|address|corporate|ceo|owner/i
export function aiFactLines(summary: Pick<DocBatchSummary, 'entered' | 'flagged'> | null): string[] {
  if (!summary) return []
  const ok = (k: string) => !PRIVATE_FACT.test(k)
  const out = summary.entered.filter((e) => ok(e.key)).map((e) => `${e.label}: ${e.display}`)
  for (const f of summary.flagged) if (ok(f.key)) out.push(`${f.label}: ${f.display}(확인 필요)`)
  return [...new Set(out)].slice(0, 12)
}

/** 아직 등록 안 된 업체의 임시 기록 id — 이 id 로 가는 이동 주소는 답에서 뺀다 */
export const CHAT_NEW_ID = 'chat_new'
