/**
 * 정책자금 신청 · 일정 · 백업 단위 테스트.
 * 실행: npm run test:client-ops-stage2
 */

import { buildAllAlerts, buildClientAlerts } from '../clientOpsAlerts'
import {
  buildAllSchedule,
  buildClientSchedule,
  groupByDate,
  monthGrid,
  overdueEvents,
  shiftMonth,
  upcomingWithin,
} from '../clientOpsSchedule'
import {
  BackupError,
  buildBackup,
  backupFileName,
  mergeBackup,
  parseBackup,
} from '../clientOpsBackup'
import {
  normalizeClientOps,
  withArchived,
  withFunding,
  withNewFunding,
  withService,
  withoutFunding,
} from '../clientOpsService'
import type { ClientOpsRecord, DocumentKey } from '../../types/clientOps'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const TODAY = '2026-08-27'
const client = (over: Partial<ClientOpsRecord> = {}): ClientOpsRecord =>
  normalizeClientOps({ id: 'c1', companyName: '가나테크', ...over })
function withDocs(r: ClientOpsRecord, keys: DocumentKey[], issuedAt = TODAY): ClientOpsRecord {
  const documents = { ...r.documents }
  for (const k of keys) documents[k] = { ...documents[k], received: true, issuedAt, updatedAt: null }
  return { ...r, documents }
}

/* ---------------- 정책자금 신청 건 ---------------- */
{
  let r = client()
  r = withNewFunding(r, { programName: '청년창업사관학교', institution: '중진공', applyDueDate: '2026-09-10', requestedAmount: 100_000_000 })
  check('자금: 신청 건 추가', r.fundingApplications.length === 1)
  check('자금: 기본 상태 watching', r.fundingApplications[0].status === 'watching')
  const id = r.fundingApplications[0].id

  r = withFunding(r, id, { status: 'submitted' })
  check('자금: 접수 시 제출일 자동 기록', r.fundingApplications[0].submittedAt !== null)

  r = withFunding(r, id, { status: 'selected', approvedAmount: 80_000_000 })
  check('자금: 선정 시 결과일 자동 기록', r.fundingApplications[0].resultAt !== null)
  check('자금: 확정 금액 저장', r.fundingApplications[0].approvedAmount === 80_000_000)

  r = withoutFunding(r, id)
  check('자금: 삭제', r.fundingApplications.length === 0)
}
{
  // 신청 마감 지남 → critical
  let r = client()
  r = withNewFunding(r, { programName: '스마트공장 지원사업', institution: '중기부', applyDueDate: '2026-08-20' })
  const a = buildClientAlerts(r, TODAY).find((x) => x.kind === 'funding_overdue')
  check('자금: 마감 지남 경고', a !== undefined)
  check('자금: critical', a?.severity === 'critical')
  check('자금: 사업명 표시', a?.title.includes('스마트공장 지원사업') === true, a?.title)
  check('자금: 며칠 지났는지', a?.title.includes('7일') === true, a?.title)
}
{
  let r = client()
  r = withNewFunding(r, { programName: '테스트공고', applyDueDate: '2026-08-31' })
  check('자금: 마감 임박 경고', buildClientAlerts(r, TODAY).some((x) => x.kind === 'funding_due_soon'))
}
{
  // 이미 접수했으면 마감 경고 안 함
  let r = client()
  r = withNewFunding(r, { programName: '완료공고', applyDueDate: '2026-08-01' })
  r = withFunding(r, r.fundingApplications[0].id, { status: 'submitted' })
  check('자금: 접수 완료면 경고 없음', !buildClientAlerts(r, TODAY).some((x) => x.kind.startsWith('funding_')))
}

/* ---------------- 보관 ---------------- */
{
  let r = client()
  r = withService(r, 'patent', { status: 'in_progress', dueDate: '2026-08-01' })
  check('보관 전: 경고 발생', buildAllAlerts([r], TODAY).length > 0)
  const archived = withArchived(r, true)
  check('보관: 경고에서 빠짐', buildAllAlerts([archived], TODAY).length === 0)
  check('보관: 일정에서도 빠짐', buildClientSchedule(archived, TODAY).length === 0)
  check('보관 해제', withArchived(archived, false).archivedAt === null)
}

/* ---------------- 일정 수집 ---------------- */
{
  let r = client()
  r = withService(r, 'patent', { status: 'in_progress', dueDate: '2026-09-01', nextStep: '명세서' })
  r = withService(r, 'venture', { status: 'done', dueDate: '2026-08-10' })
  r = withNewFunding(r, { programName: '공고A', applyDueDate: '2026-09-05' })
  r = { ...r, fees: [{ id: 'f1', serviceKey: null, kind: 'deposit', label: '계약금', amount: 3_000_000, dueDate: '2026-09-03', receivedAt: null, note: '' }] }
  r = withDocs(r, ['corporateRegistry'], '2026-07-01') // 3개월 → 2026-10-01 만료

  const ev = buildClientSchedule(r, TODAY)
  check('일정: 업무 마감 포함', ev.some((e) => e.kind === 'task' && e.date === '2026-09-01'))
  check('일정: 완료 업무는 done 표시', ev.find((e) => e.id.includes('venture'))?.done === true)
  check('일정: 정책자금 포함', ev.some((e) => e.kind === 'funding' && e.date === '2026-09-05'))
  check('일정: 수금 포함', ev.some((e) => e.kind === 'payment' && e.date === '2026-09-03'))
  check('일정: 서류 만료 포함', ev.some((e) => e.kind === 'document' && e.date === '2026-10-01'), JSON.stringify(ev.filter(e=>e.kind==='document').map(e=>e.date)))

  const all = buildAllSchedule([r], TODAY)
  check('일정: 날짜순 정렬', all.every((e, i) => i === 0 || all[i - 1].date <= e.date))

  const g = groupByDate(all)
  check('일정: 날짜별 묶기', (g.get('2026-09-01') ?? []).length === 1)

  const soon = upcomingWithin(all, 7)
  check('일정: 7일 이내 미완료만', soon.every((e) => !e.done && (e.daysLeft ?? 99) <= 7))
}
{
  let r = client()
  r = withService(r, 'patent', { status: 'in_progress', dueDate: '2026-08-01' })
  const over = overdueEvents(buildClientSchedule(r, TODAY))
  check('일정: 지난 미완료 추출', over.length === 1 && over[0].daysLeft === -26, String(over[0]?.daysLeft))
}

/* ---------------- 달력 격자 ---------------- */
{
  const g = monthGrid(2026, 9)
  check('달력: 42칸', g.length === 42, String(g.length))
  check('달력: 일요일 시작', new Date(`${g[0]}T00:00:00Z`).getUTCDay() === 0)
  check('달력: 해당 월 1일 포함', g.includes('2026-09-01'))
  check('달력: 앞뒤 달 채움', g[0] < '2026-09-01' && g[41] > '2026-09-30')

  check('달력: 다음 달', JSON.stringify(shiftMonth(2026, 12, 1)) === JSON.stringify([2027, 1]))
  check('달력: 이전 달', JSON.stringify(shiftMonth(2026, 1, -1)) === JSON.stringify([2025, 12]))
  check('달력: 여러 달 이동', JSON.stringify(shiftMonth(2026, 5, 8)) === JSON.stringify([2027, 1]))
}

/* ---------------- 백업 ---------------- */
{
  const a = client({ id: 'a', companyName: 'A사' })
  const b = client({ id: 'b', companyName: 'B사' })
  const file = buildBackup([a, b])
  check('백업: 형식 표시', file.format === 'ax-client-ops')
  check('백업: 건수', file.count === 2)

  const restored = parseBackup(JSON.stringify(file))
  check('백업: 복원 건수', restored.length === 2)
  check('백업: 내용 유지', restored[0].companyName === 'A사')
  check('백업: 파일명', backupFileName(TODAY) === 'client-ops-backup-2026-08-27.json', backupFileName(TODAY))
  check('백업: 파일명은 ASCII만 (브라우저가 한글명을 버림)', /^[\x20-\x7E]+$/.test(backupFileName(TODAY)))
}
{
  let threw = ''
  try {
    parseBackup('그냥 텍스트')
  } catch (e) {
    threw = e instanceof BackupError ? e.message : 'other'
  }
  check('백업: JSON 아님 거부', threw.includes('JSON'), threw)

  threw = ''
  try {
    parseBackup(JSON.stringify({ format: 'other', clients: [] }))
  } catch (e) {
    threw = e instanceof BackupError ? e.message : 'other'
  }
  check('백업: 다른 형식 거부', threw.includes('백업 파일이 아닙니다'), threw)
}
{
  // 병합: 더 최근 수정본이 이긴다
  const mine = client({ id: 'x', companyName: '내것', updatedAt: '2026-08-27T10:00:00.000Z' })
  const older = client({ id: 'x', companyName: '옛것', updatedAt: '2026-08-01T10:00:00.000Z' })
  const newer = client({ id: 'x', companyName: '새것', updatedAt: '2026-08-28T10:00:00.000Z' })
  const other = client({ id: 'y', companyName: '다른곳' })

  const r1 = mergeBackup([mine], [older], 'merge')
  check('병합: 오래된 백업은 무시', r1.records[0].companyName === '내것' && r1.kept === 1)

  const r2 = mergeBackup([mine], [newer], 'merge')
  check('병합: 최신 백업이 덮어씀', r2.records[0].companyName === '새것' && r2.updated === 1)

  const r3 = mergeBackup([mine], [other], 'merge')
  check('병합: 없는 건 추가', r3.records.length === 2 && r3.added === 1)

  const r4 = mergeBackup([mine, other], [newer], 'replace')
  check('교체: 백업 내용만 남음', r4.records.length === 1 && r4.records[0].companyName === '새것')
}

console.log(`\nclient-ops-stage2: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
console.log('CLIENT_OPS_STAGE2_PASS')
