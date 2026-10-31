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
 *     작년 · 올해 매월 말 인원(통합고용세액공제용 · D-302)을 함께 남기고, 재직 인원이 비어 있으면 넣는다. 주민등록번호는 남기지 않는다(명부 읽기가 생년월일 · 성별만 남김).
 *  4. 주주명부(D-303) — 주주 · 주식 수 · 관계 · 발행주식 총수 · 1주 금액을 읽어, 검산이 맞고 주주표가 비어 있으면 바로 넣는다
 *     (절세 설계 · 05 · 06 계산기 · 상황 예시가 같은 주주표를 쓴다). 주민등록번호 · 주소는 남기지 않는다.
 *  5. 등기부등본 · 정관(D-304) — 대표 취임일(퇴직금 기산일) · 1주의 금액 · 발행주식 총수 · 대표이사 퇴직금 지급배수를 절세 현황 빈 칸에.
 *     재무제표(D-305) — 가지급금 잔액 · 배당 가능한 이익(미처분이익잉여금) · 직전 연도 순이익도 같은 규칙으로.
 *     급여대장 · 근로소득 원천징수영수증(D-342) — 대표 본인 줄 · 영수증이면 월 급여(급여대장 과세 급여 / 총급여 ÷ 근무한 달 수)를
 *     '대표 월 급여' 빈 칸에(퇴직금 · 급여 vs 배당이 이 숫자로).
 *  6. 그 밖의 판정(정책자금 · 창업감면 · 연구소 · 지원사업 …)은 저장하지 않고 '맞춤 추천' 이 볼 때마다 계산한다
 *     — 업체 정보가 바뀌면 판정도 바로 바뀐다(clientInsights).
 *
 * 무거운 엔진(크레탑 · 명부)은 필요할 때만 불러온다. 규칙 계산 — 외부 호출 없음. 저장은 부르는 쪽.
 */
import type { ClientOpsRecord, DocUploadLog } from '../types/clientOps'
import { withToolResult } from './clientOpsService'
import { formatWon, pendingFacts, readFact, usableFactValue, withFactDecisions, withFactValue } from './customerFacts'
import { placeOf } from './grants/grantMatch'
import { withDocUploadLog } from './clientOpsService'
import { autoFillFromDocs, type FilledFact, type FlaggedFact, type ReadDoc } from './docAutoFill'
import { holdersLine, looksLikeShareholderRegister, readShareholderDoc, type RegisterRead } from './shareholderDoc'
import { readRegistryTax, readRetireMultiple } from './registryTax'
import { ASSUMPTIONS, wonOf } from './taxPlan'
import { detectDocSource } from './koreanDocParser'
import { parseFinancialStatement } from './finStatementParser'
import { latestFullYear, looksLikeVatCert, readVatCert, vatSummary } from './vatDoc'
import { ceoWageReceipt, looksLikePayrollLedger, looksLikeWageReceipt, monthlyPayOf, readLedgerCeoPay, readWageReceipts } from './wageReceipt'

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
  /** D-212: 못 올린 파일 — 올리는 쪽이 채운다 */
  failed?: { fileName: string; reason: string }[]
  /** D-345 올리기 전 업체 기록 — 방금 올린 서류로 새로 판정된 모듈을 보여 주려고(화면에서만 · 업체 기록에는 남기지 않는다) */
  before?: ClientOpsRecord
}

/**
 * D-183: 올리기 한 번 → 업체 기록에 남길 모양. 바로 넣은 값은 저장된 값 그대로도 남긴다 —
 * '확인할 것' 에서 [아니요] 를 누르면 지금 값이 이 값일 때만 다시 확인으로 돌린다(그 사이 고친 값은 그대로).
 * 파일 글자는 남기지 않는다.
 */
export function docUploadLogOf(record: ClientOpsRecord, summary: DocBatchSummary, id: string): DocUploadLog {
  return {
    id,
    at: summary.at,
    files: summary.files,
    placed: (summary.placed ?? []).slice(0, 60),
    entered: summary.entered.slice(0, 40).map((e) => ({ ...e, value: readFact(record, e.key)?.value || e.display })),
    flagged: summary.flagged.slice(0, 40),
    ...(summary.cretop ? { cretop: { fileName: summary.cretop.fileName, filled: summary.cretop.filled.slice(0, 20) } } : {}),
    ...(summary.roster ? { roster: summary.roster } : {}),
    warnings: summary.warnings.slice(0, 5),
    ...(summary.failed?.length ? { failed: summary.failed.slice(0, 30).map((f) => ({ fileName: f.fileName.slice(0, 200), reason: f.reason.slice(0, 120) })) } : {}),
  }
}

/** D-183: 업체 기록에 남긴 올리기 → 화면에 보일 모양(맞춤 추천 '올린 서류') */
export function batchOfLog(log: DocUploadLog): DocBatchSummary {
  return {
    files: log.files,
    entered: log.entered.map(({ key, label, display, fileName }) => ({ key, label, display, fileName })),
    flagged: log.flagged,
    cretop: log.cretop ? { fileName: log.cretop.fileName, company: '', filled: log.cretop.filled } : null,
    roster: log.roster ?? null,
    warnings: log.warnings,
    at: log.at,
    placed: log.placed,
    ...(log.failed?.length ? { failed: log.failed } : {}),
  }
}

/** 올리기 한 번을 업체 기록에 남긴다(최근 5번) */
export function withUploadSummary(record: ClientOpsRecord, summary: DocBatchSummary, id: string): ClientOpsRecord {
  return withDocUploadLog(record, docUploadLogOf(record, summary, id))
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
  // D-303 주주명부 — 주주 주소 · 주민번호가 회사 정보로 읽히지 않게 회사 정보 읽기에서 뺀다(주주표로 따로).
  //   명부보다 먼저 가린다: 주민번호가 여럿이고 '명부' 라는 말이 있어 예전에는 4대보험 명부로 읽혀 주주가 직원으로 셌다
  const holderDocs = readable.filter((d) => !cretopDocs.includes(d) && looksLikeShareholderRegister(d))
  // D-342 근로소득 원천징수영수증 — 부양가족 주민번호 · 징수의무자 주소가 있어 명부 · 회사 정보로 읽지 않는다(대표 월 급여만 따로)
  const wageDocs = readable.filter((d) => !cretopDocs.includes(d) && !holderDocs.includes(d) && looksLikeWageReceipt(d.text, d.fileName))
  const rosterDocs = readable.filter((d) => !cretopDocs.includes(d) && !holderDocs.includes(d) && !wageDocs.includes(d) && looksLikeRoster(d))
  const factDocs = readable.filter((d) => !cretopDocs.includes(d) && !rosterDocs.includes(d) && !holderDocs.includes(d) && !wageDocs.includes(d))
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
      // D-302 엑셀 명부는 상실일 · 상태 칸까지(그만둔 사람 · 그만둔 날) — 없으면 예전처럼 주민번호로
      const parsed = core.parseRosterTable(rDoc.text)
      if (parsed.employees.length === 0) {
        warnings.push(`${rDoc.fileName}: 명부에서 직원을 찾지 못했습니다 — 고용지원금 '4대보험 명부 진단' 에서 직접 올려 주세요.`)
      } else {
        const analysis = core.analyzeRoster(parsed.employees, { baseDate: today })
        const youth = enroll.youthEnrollItems(analysis.rows, today)
        // D-334 비수도권 업체면 지원금도 그 지역 금액(고령자 계속고용 월 40만) · 주소를 모르면 수도권 금액
        const sido = placeOf(usableFactValue(rec, 'businessAddress')).sido
        const total = core.estimateSubsidyTotal(analysis.subsidySummary, sido ? (['서울', '경기', '인천'].includes(sido) ? '수도권' : '비수도권') : null)
        const lines = analysis.subsidySummary.filter((s) => s.candidateCount > 0).map((s) => `· ${s.name} 후보 ${s.candidateCount}명`)
        // D-302 통합고용세액공제용 — 작년 · 올해 매월 말 인원 평균(금액은 맞춤 추천이 볼 때마다 지금 주소 · 규모로)
        const hc = core.rosterHeadcount(parsed.employees, { baseDate: today, issueDate: parsed.meta?.issueDate ?? null })
        // D-378 신고가 끝난 해(작년)의 늘어난 인원 — 그해 신고서에 통합고용세액공제가 없으면 경정청구 신호. 그만둔 사람까지 있는 명부일 때만
        const past = hc && hc.basis === 'history' ? core.rosterHeadcount(parsed.employees, { baseDate: `${hc.cur.year - 1}-12-31`, issueDate: parsed.meta?.issueDate ?? null }) : null
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
            hc ? `[통합고용세액공제 인원] ${hc.prev.year}년 매월 말 평균 ${core.headText(hc.prev.total)}명 → ${hc.cur.year}년 ${hc.cur.actualMonths < 12 ? '예상 ' : ''}${core.headText(hc.cur.total)}명(명부 날짜로 셈)` : '',
          ]
            .filter(Boolean)
            .join('\n'),
          data: {
            tab: 'roster',
            counts: analysis.counts,
            subsidySummary: analysis.subsidySummary.map((s) => ({ key: s.key, name: s.name, candidateCount: s.candidateCount, level: s.level })),
            issueDate: parsed.meta?.issueDate ?? null,
            // D-191: 최대 예상 지원금(원) — 맞춤 추천이 엔진 없이 금액을 보여 준다
            subsidyTotal: total,
            ...(hc ? { headcount: hc } : {}),
            ...(past && past.cur.year === hc!.cur.year - 1 ? { headcountPast: past } : {}),
            from: 'upload',
          },
          deadlines: enroll.youthEnrollDeadlines(youth),
          createdAt: now,
        })
        // 재직 인원 — 비어 있으면 넣는다(명부에서 센 숫자). D-391 원천세 신고서로 먼저 들어간 인원(그달 급여 받은 사람)은 명부 재직 인원으로 바꾼다
        const empNow = readFact(rec, 'employeeCount')
        if ((empNow?.value ?? '') === '' || (empNow?.source === 'withholding' && empNow.value !== String(analysis.counts.activeCount))) {
          rec = withFactValue(rec, 'employeeCount', String(analysis.counts.activeCount), { source: 'payrollRoster', status: 'entered', asOf: parsed.meta?.issueDate ?? '', now })
          entered.push({ key: 'employeeCount', label: '직원 수', display: `${analysis.counts.activeCount}명`, fileName: rDoc.fileName })
        }
        roster = { fileName: rDoc.fileName, employees: analysis.counts.totalEmp, active: analysis.counts.activeCount, candidates: analysis.candidateSubsidyCount, youthDeadlines: youth.length }
      }
    } catch {
      warnings.push(`${rDoc.fileName}: 명부를 읽지 못했습니다 — 고용지원금 '4대보험 명부 진단' 에서 직접 올려 주세요.`)
    }
  }

  // 4. D-303 주주명부 — 가장 마지막에 올린 것 하나. 검산이 맞고 주주표가 비어 있을 때만 바로 넣는다(아니면 확인으로)
  const hDoc = holderDocs[holderDocs.length - 1]
  if (hDoc) {
    const read = readShareholderDoc(hDoc.text, rec.representativeName)
    const sum = read.holders.reduce((a, h) => a + h.shares, 0)
    const display = `주주 ${read.holders.length}명 · ${sum.toLocaleString('ko-KR')}주(${holdersLine(read)})`
    const empty = rec.shareholderRegister.every((r) => !r.name.trim() && !(r.shares > 0))
    const same = !empty && sameHolders(rec.shareholderRegister, read)
    if (read.holders.length === 0) {
      warnings.push(`${hDoc.fileName}: 주주명부에서 주주를 찾지 못했습니다 — 절세 설계 › 주주명부에 직접 적어 주세요.`)
    } else if (!read.sure) {
      const why =
        read.totalShares !== null && read.totalShares !== sum
          ? `주식 수 합(${sum.toLocaleString('ko-KR')}주)이 발행주식 총수(${read.totalShares.toLocaleString('ko-KR')}주)와 달라 바로 넣지 않았어요 — 절세 설계에서 확인`
          : '합계 · 지분율이 없어 맞는지 확인하지 못했어요 — 절세 설계에서 확인'
      flagged.push({ key: 'shareholderRegister', label: '주주명부', display, fileName: hDoc.fileName, note: why })
    } else if (!empty && !same) {
      flagged.push({ key: 'shareholderRegister', label: '주주명부', display, fileName: hDoc.fileName, note: '지금 적힌 주주표와 달라 바꾸지 않았어요 — 절세 설계에서 확인' })
    } else if (empty) {
      const profile = { ...(rec.taxProfile ?? {}) }
      const blank = (k: string) => !String(profile[k] ?? '').trim()
      const extra: FilledFact[] = []
      if (read.totalShares && blank('totalShares')) {
        profile.totalShares = String(read.totalShares)
        extra.push({ key: 'taxProfile.totalShares', label: '발행주식 총수', display: `${read.totalShares.toLocaleString('ko-KR')}주`, fileName: hDoc.fileName })
      }
      if (read.par && blank('par')) {
        profile.par = String(read.par)
        extra.push({ key: 'taxProfile.par', label: '1주 액면가', display: `${read.par.toLocaleString('ko-KR')}원`, fileName: hDoc.fileName })
      }
      rec = {
        ...rec,
        shareholderRegister: read.holders.map((h) => ({ id: makeId(), name: h.name, relation: h.relation, shares: h.shares, acquirePrice: 0 })),
        taxProfile: profile,
        // 회사 정보 '주주·임원 구성' 칸이 비어 있으면 지분 한 줄로
        shareholders: rec.shareholders.trim() ? rec.shareholders : holdersLine(read),
      }
      entered.push({ key: 'shareholderRegister', label: '주주명부', display, fileName: hDoc.fileName }, ...extra)
    }
  }

  // 5. D-304 등기부등본 → 대표 취임일 · 1주의 금액 · 발행주식 총수 / 정관 · 퇴직금 지급규정 → 지급배수 (절세 현황 — 빈 칸만, 다르면 확인)
  const putProfile = (key: string, value: string, label: string, display: string, fileName: string, sure: boolean, why: string) => {
    const cur = String(rec.taxProfile?.[key] ?? '').trim()
    const same = cur !== '' && cur.replace(/[,\s원주배]/g, '') === value.replace(/[,\s원주배]/g, '')
    if (same) return
    if (!sure) {
      flagged.push({ key: `taxProfile.${key}`, label, display, fileName, note: why })
      return
    }
    if (cur !== '') {
      flagged.push({ key: `taxProfile.${key}`, label, display, fileName, note: `지금 적힌 값(${cur})과 달라 바꾸지 않았어요 — 절세 설계에서 확인` })
      return
    }
    rec = { ...rec, taxProfile: { ...(rec.taxProfile ?? {}), [key]: value } }
    entered.push({ key: `taxProfile.${key}`, label, display, fileName })
  }
  for (const d of factDocs) {
    // D-311 부가세 과세표준증명 · 면세 수입금액증명 — 매출은 1번(회사 정보)에서 넣었다. 여기서는 넣은 줄에 해마다 · 전년 대비를 붙인다
    const vat = looksLikeVatCert(d.text, d.fileName) ? readVatCert(d.text) : null
    if (vat) {
      const line = vatSummary(vat, formatWon)
      const at = entered.findIndex((e) => e.key === 'revenue' && e.fileName === d.fileName)
      if (at >= 0) entered[at] = { ...entered[at], display: line }
      else if (!latestFullYear(vat)) flagged.push({ key: 'revenue', label: '매출', display: line, fileName: d.fileName, note: vat.years.some((y) => y.overlap) ? '신고 기간이 겹쳐 해마다 더하지 못했어요 — 서류를 보고 매출을 적어 주세요' : '1~12월이 다 있는 해가 없어 매출로 넣지 않았어요' })
      continue
    }
    const isRegistry = d.key === 'corporateRegistry' || detectDocSource(d.text) === 'corporate_registry'
    const reg = isRegistry ? readRegistryTax(d.text, rec.representativeName) : null
    if (reg) {
      if (reg.ceoStart) putProfile('ceoStartDate', reg.ceoStart, '대표 취임일', reg.ceoStartSure ? `${reg.ceoStart} — 퇴직금 기산일(등기부 · ${reg.ceoStartNote})` : reg.ceoStart, d.fileName, reg.ceoStartSure, reg.ceoStartNote)
      if (reg.par) putProfile('par', String(reg.par), '1주 액면가', `${reg.par.toLocaleString('ko-KR')}원`, d.fileName, reg.parSure, '1주의 금액이 여러 가지로 나와요 — 절세 설계에서 확인')
      if (reg.totalShares)
        putProfile('totalShares', String(reg.totalShares), '발행주식 총수', `${reg.totalShares.toLocaleString('ko-KR')}주`, d.fileName, reg.sharesSure, reg.capital ? `1주의 금액 × 총수가 자본금(${reg.capital.toLocaleString('ko-KR')}원)과 달라요 — 절세 설계에서 확인` : '자본금과 맞춰 보지 못했어요 — 절세 설계에서 확인')
      continue
    }
    // D-305 재무제표 → 가지급금 잔액 · 배당 가능한 이익(미처분이익잉여금) · 직전 연도 순이익
    if (d.key === 'financialStatements' || /재\s*무\s*상\s*태\s*표|대\s*차\s*대\s*조\s*표|손\s*익\s*계\s*산\s*서|표준\s*재무제표/.test(d.text.slice(0, 3000))) {
      const f = parseFinancialStatement(d.text)
            // 이름은 짧게(맞춤 추천 표의 이름 칸이 한 줄로) · 금액은 회사 정보와 같은 '억 · 만원' 글로
      const yrEnd = f.year ? `${f.year}년 말 ` : ''
      if (f.loanBalance !== undefined && f.loanBalance > 0) putProfile('loanBalance', String(f.loanBalance), '가지급금', `${yrEnd}${formatWon(f.loanBalance)}`, d.fileName, true, '')
      if (f.retainedEarnings !== undefined) {
        if (f.retainedEarnings > 0) putProfile('retainedEarnings', String(f.retainedEarnings), '배당 가능 이익', `${yrEnd}${formatWon(f.retainedEarnings)}(미처분이익잉여금)`, d.fileName, true, '')
        else if (f.retainedEarnings < 0 && !String(rec.taxProfile?.retainedEarnings ?? '').trim())
          flagged.push({ key: 'taxProfile.retainedEarnings', label: '배당 가능 이익', display: `${yrEnd}결손 ${formatWon(Math.abs(f.retainedEarnings))}`, fileName: d.fileName, note: '미처리결손금이라 배당할 이익이 없어요 — 배당 계획은 결손을 메운 뒤' })
      }
      if (f.netIncomePrev !== undefined) putProfile('vInc1', String(f.netIncomePrev), '전년 순이익', `${f.year ? `${Number(f.year) - 1}년 ` : ''}${formatWon(f.netIncomePrev)}`, d.fileName, true, '')
      continue
    }
    const mult = /정\s*관|퇴\s*직\s*금\s*(?:지\s*급\s*)?규\s*정|임원\s*퇴직/.test(`${d.fileName} ${d.text.slice(0, 600)}`) ? readRetireMultiple(d.text) : null
    // 정관 배수가 세법 한도보다 크면 계산은 한도로(절세 설계와 같은 규칙) — 보이는 글에 함께
    const cap = Number(ASSUMPTIONS.retireMultPost)
    if (mult !== null) putProfile('retireMult', String(mult), '퇴직금 배수', `정관 · 대표이사 ${mult}배${mult > cap ? ` (계산은 세법 한도 ${cap}배)` : ''}`, d.fileName, true, '')
  }

  // 6. D-342 대표 월 급여 — 급여대장(이번 달 대표 줄 과세 급여)이 먼저, 없으면 근로소득 원천징수영수증(총급여 ÷ 근무한 달 수).
  //    대표 본인 것만 · 빈 칸만, 다르면 확인
  let ledgerPut = false
  for (const d of readable.filter((x) => !cretopDocs.includes(x) && !holderDocs.includes(x) && !wageDocs.includes(x) && looksLikePayrollLedger(x.text, x.fileName))) {
    const l = readLedgerCeoPay(d.text, rec.representativeName)
    if (!l || wonOf(rec.taxProfile?.monthlySalary) === l.monthly) continue
    ledgerPut = true
    putProfile('monthlySalary', String(l.monthly), '대표 월 급여', `월 ${formatWon(l.monthly)} — ${l.month ? `${l.month.slice(0, 4)}년 ${Number(l.month.slice(5))}월 ` : ''}급여대장 ${l.taxable ? '과세 급여' : '지급 합계(비과세 포함일 수 있음)'}`, d.fileName, true, '')
  }
  for (const d of ledgerPut ? [] : wageDocs) {
    const list = readWageReceipts(d.text)
    const r = ceoWageReceipt(list, rec.representativeName)
    if (!r) {
      // 대표 이름을 모르고 같은 장의 대표자와도 맞춰 보지 못했으면 — 한 사람 것일 때만 확인으로(직원 영수증은 조용히 둔다)
      if (list.length === 1 && !rec.representativeName.trim() && !list[0].payerCeo)
        flagged.push({ key: 'taxProfile.monthlySalary', label: '대표 월 급여', display: `월 ${formatWon(monthlyPayOf(list[0]))}(${list[0].name})`, fileName: d.fileName, note: '대표 이름을 몰라 대표 본인 영수증인지 확인하지 못했어요 — 맞으면 절세 설계에 적어 주세요' })
      continue
    }
    const monthly = monthlyPayOf(r)
    // 이미 같은 금액('780만' 처럼 적었어도)이면 조용히
    if (wonOf(rec.taxProfile?.monthlySalary) === monthly) continue
    const basis = `${r.year ? `${r.year}년 ` : ''}총급여 ${formatWon(r.totalPay)} ÷ ${r.months}개월${r.monthsSure ? '' : '(근무기간 못 읽음)'}`
    putProfile('monthlySalary', String(monthly), '대표 월 급여', `월 ${formatWon(monthly)} — ${basis}`, d.fileName, true, '')
  }

  return { record: rec, summary: { files: docs.length, entered, flagged, cretop, roster, warnings, at: now, before: record } }
}

/** 지금 주주표와 올린 주주명부가 같은가(이름 · 주식 수) */
function sameHolders(rows: ClientOpsRecord['shareholderRegister'], read: RegisterRead): boolean {
  const key = (n: string, s: number) => `${n.replace(/\s/g, '')}:${s}`
  const a = rows.filter((r) => r.name.trim() || r.shares > 0).map((r) => key(r.name, r.shares)).sort()
  const b = read.holders.map((h) => key(h.name, h.shares)).sort()
  return a.length === b.length && a.every((x, i) => x === b[i])
}
