/**
 * 서류 한 번 올리기 → 모듈이 저절로 읽는다 (D-144).
 *
 * 대표 지시: "굳이 모듈을 찾아 열어서 또 서류를 넣을 필요 없이, 업체에서 서류만 넣으면
 * 지금까지 · 앞으로 도입한 모듈이 자동으로 분석해서 결과를 맞춤 추천에 먼저 보여 준다."
 *
 * 올린 서류마다(글자를 읽은 것):
 *  1. 회사 정보 — 확실한 것은 바로 넣고 애매한 것은 까닭을 붙여 묻는다(docAutoFill).
 *  2. 크레탑 기업종합보고서 — 크레탑 분석기와 같은 엔진으로 읽어 업체에 반영 · 분석 결과를 붙인다.
 *     다른 회사 보고서면(사업자번호 · 이름이 다르면) 붙이지 않고 알려만 준다.
 *  3. 4대보험 가입자 명부 — 고용지원금 명부 진단과 같은 엔진으로 직원별 후보 · 청년도약 참여신청 기한을 붙이고,
 *     재직 인원이 비어 있으면 넣는다. 주민등록번호는 남기지 않는다(명부 읽기가 생년월일 · 성별만 남김).
 *  4. 그 밖의 판정(정책자금 · 창업감면 · 연구소 · 지원사업 …)은 저장하지 않고 '맞춤 추천' 이 볼 때마다 계산한다
 *     — 업체 정보가 바뀌면 판정도 바로 바뀐다(clientInsights).
 *
 * 무거운 엔진(크레탑 · 명부)은 필요할 때만 불러온다. 규칙 계산 — 외부 호출 없음. 저장은 부르는 쪽.
 */
import type { ClientOpsRecord } from '../types/clientOps'
import { withToolResult } from './clientOpsService'
import { pendingFacts, readFact, withFactDecisions, withFactValue } from './customerFacts'
import { autoFillFromDocs, type FilledFact, type FlaggedFact, type ReadDoc } from './docAutoFill'

export interface DocBatchSummary {
  files: number
  entered: FilledFact[]
  flagged: FlaggedFact[]
  cretop: { fileName: string; company: string; filled: string[] } | null
  roster: { fileName: string; employees: number; active: number; candidates: number; youthDeadlines: number } | null
  /** 붙이지 못한 까닭(다른 회사 보고서 등) */
  warnings: string[]
  at: string
  /** D-146: 파일마다 서류함 어느 칸에 넣었나(올리는 쪽이 채운다) — '다 어디 갔는지 모르겠다' 를 없앤다 */
  placed?: { fileName: string; label: string; other: boolean; numbered: boolean; same?: boolean }[]
}

const CRETOP_SIGNAL = /크레탑|CRETOP|한국평가데이터|기업종합보고서|KoDATA/i
/** 주민등록번호 모양(앞 6 · 뒤 첫 자리) — 명부인지 가리는 데만 쓴다. 저장하지 않는다 */
const RRN_LIKE = /\d{6}\s*-\s*[1-8]/g

export function looksLikeCretop(doc: Pick<ReadDoc, 'key' | 'text' | 'fileName'>): boolean {
  if (doc.key === 'cretopReport') return doc.text.length > 300
  return doc.text.length > 800 && CRETOP_SIGNAL.test(`${doc.fileName} ${doc.text.slice(0, 4000)}`)
}

export function looksLikeRoster(doc: Pick<ReadDoc, 'key' | 'text' | 'fileName'>): boolean {
  const n = (doc.text.match(RRN_LIKE) ?? []).length
  if (doc.key === 'payrollRoster' || doc.key === 'healthInsurance') return n >= 1
  return n >= 2 && /(가입자|피보험자|취득일|자격\s*취득|명부)/.test(`${doc.fileName} ${doc.text.slice(0, 3000)}`)
}

/** salesCretop.companyKey 와 같은 규칙 — 크레탑 엔진을 미리 불러오지 않으려고 여기 둔다 */
function companyKey(name: string): string {
  return name
    .replace(/\(\s*주\s*\)|㈜|주식회사|\(\s*유\s*\)|유한회사/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

function sameCompany(record: ClientOpsRecord, name: string, bizNo: string): boolean {
  const d = (v: string) => v.replace(/[^0-9]/g, '')
  const a = d(record.businessNumber)
  const b = d(bizNo)
  if (a.length === 10 && b.length === 10) return a === b
  const x = companyKey(record.companyName)
  const y = companyKey(name)
  if (x === '' || y === '') return true
  return x.includes(y) || y.includes(x)
}

/** 서류 묶음 하나를 읽어 업체 기록에 반영한다 */
export async function analyzeUploadedDocs(
  record: ClientOpsRecord,
  docs: readonly ReadDoc[],
  opts: { now: string; today: string; makeId: () => string },
): Promise<{ record: ClientOpsRecord; summary: DocBatchSummary }> {
  const { now, today, makeId } = opts
  const warnings: string[] = []
  const readable = docs.filter((d) => d.text.replace(/\s/g, '').length >= 10)
  // 1. 회사 정보(크레탑 · 명부 글은 회사 정보 읽기에 넣지 않는다 — 그 안의 숫자는 각 엔진이 읽는다)
  const cretopDocs = readable.filter(looksLikeCretop)
  const rosterDocs = readable.filter((d) => !cretopDocs.includes(d) && looksLikeRoster(d))
  const factDocs = readable.filter((d) => !cretopDocs.includes(d) && !rosterDocs.includes(d))
  const filled = autoFillFromDocs(record, factDocs, now, makeId)
  let rec = filled.record
  const entered = [...filled.entered]
  const flagged = [...filled.flagged]

  // 2. 크레탑 — 가장 마지막에 올린 보고서 하나
  let cretop: DocBatchSummary['cretop'] = null
  const cDoc = cretopDocs[cretopDocs.length - 1]
  if (cDoc) {
    try {
      const [{ analyzeCretopText }, sc, cr] = await Promise.all([import('../tools/cretop/mini/analysisCore.js'), import('./salesCretop'), import('../tools/cretop/lib/cretopResult')])
      const ui = analyzeCretopText(cDoc.text)
      const name = String(ui.companyInfo?.companyName ?? '')
      const bizNo = String(ui.companyInfo?.businessNo ?? '')
      if (!sameCompany(rec, name, bizNo)) {
        warnings.push(`${cDoc.fileName}: ${name || '다른 회사'} 보고서 같아 이 업체에 붙이지 않았습니다.`)
      } else {
        const applied = sc.applyCretopToClient(rec, sc.digestCretop(ui), { at: now, source: '' })
        rec = withToolResult(applied.record, { ...cr.cretopResultInput(ui, []), createdAt: now })
        // 크레탑 숫자(매출 · 이익 · 자산 · 부채) — 비어 있는 칸은 바로 넣는다(보고서 표에서 읽은 숫자)
        const fromCretop = pendingFacts(rec).filter((p) => p.from === 'cretop')
        const auto = fromCretop.filter((p) => p.current === '')
        if (auto.length) rec = withFactDecisions(rec, auto.map((p) => ({ id: p.id, action: 'accept' as const })), now)
        for (const p of auto) entered.push({ key: p.key, label: p.label, display: p.display, fileName: cDoc.fileName })
        for (const p of fromCretop) if (!auto.includes(p)) flagged.push({ key: p.key, label: p.label, display: p.display, fileName: cDoc.fileName, note: '크레탑 숫자가 지금 적힌 값과 달라요' })
        cretop = { fileName: cDoc.fileName, company: name, filled: applied.filled }
      }
    } catch {
      warnings.push(`${cDoc.fileName}: 크레탑 보고서를 읽지 못했습니다 — 크레탑 분석기에서 직접 열어 주세요.`)
    }
  }

  // 3. 4대보험 명부 — 가장 마지막에 올린 명부 하나
  let roster: DocBatchSummary['roster'] = null
  const rDoc = rosterDocs[rosterDocs.length - 1]
  if (rDoc) {
    try {
      const [core, enroll] = await Promise.all([import('../tools/employment/lib/rosterCore'), import('../tools/employment/lib/rosterEnroll')])
      const parsed = core.parseRosterText(rDoc.text)
      if (parsed.employees.length === 0) {
        warnings.push(`${rDoc.fileName}: 명부에서 직원을 찾지 못했습니다 — 고용지원금 '4대보험 명부 진단' 에서 직접 올려 주세요.`)
      } else {
        const analysis = core.analyzeRoster(parsed.employees, { baseDate: today })
        const youth = enroll.youthEnrollItems(analysis.rows, today)
        const total = core.estimateSubsidyTotal(analysis.subsidySummary)
        const lines = analysis.subsidySummary.filter((s) => s.candidateCount > 0).map((s) => `· ${s.name} 후보 ${s.candidateCount}명`)
        rec = withToolResult(rec, {
          toolKey: 'employment',
          title: '4대보험 명부 진단',
          verdict: analysis.candidateSubsidyCount > 0 ? 'candidates' : 'none',
          verdictLabel: `후보 지원금 ${analysis.candidateSubsidyCount}건 · 확인 항목 ${analysis.checkItemCount}`,
          summary: [
            `[4대보험 명부 진단] ${analysis.counts.totalEmp}명 중 재직 ${analysis.counts.activeCount}명 · 청년 추정 ${analysis.counts.youthCount}명`,
            ...lines,
            total > 0 ? `조건 충족 시 최대 ${Math.round(total / 10_000).toLocaleString()}만원 검토 가능성(1차 추정)` : '',
            youth.length ? `청년도약 참여신청 기한 ${youth.length}명 — 지나면 신청 불가` : '',
          ]
            .filter(Boolean)
            .join('\n'),
          data: {
            tab: 'roster',
            counts: analysis.counts,
            subsidySummary: analysis.subsidySummary.map((s) => ({ key: s.key, name: s.name, candidateCount: s.candidateCount, level: s.level })),
            issueDate: parsed.meta?.issueDate ?? null,
            from: 'upload',
          },
          deadlines: enroll.youthEnrollDeadlines(youth),
          createdAt: now,
        })
        // 재직 인원 — 비어 있으면 넣는다(명부에서 센 숫자)
        if ((readFact(rec, 'employeeCount')?.value ?? '') === '') {
          rec = withFactValue(rec, 'employeeCount', String(analysis.counts.activeCount), { source: 'payrollRoster', status: 'entered', asOf: parsed.meta?.issueDate ?? '', now })
          entered.push({ key: 'employeeCount', label: '직원 수', display: `${analysis.counts.activeCount}명`, fileName: rDoc.fileName })
        }
        roster = { fileName: rDoc.fileName, employees: analysis.counts.totalEmp, active: analysis.counts.activeCount, candidates: analysis.candidateSubsidyCount, youthDeadlines: youth.length }
      }
    } catch {
      warnings.push(`${rDoc.fileName}: 명부를 읽지 못했습니다 — 고용지원금 '4대보험 명부 진단' 에서 직접 올려 주세요.`)
    }
  }

  return { record: rec, summary: { files: docs.length, entered, flagged, cretop, roster, warnings, at: now } }
}
