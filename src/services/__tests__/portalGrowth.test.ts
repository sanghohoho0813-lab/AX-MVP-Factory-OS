/**
 * D-681 고객성장관리 P0 — 규칙 시험(portalGrowthRules · portalGrowth 의 순수 부분).
 *  REP: 기간(한국 날짜 · 2주 · 1개월 · 월말 · 연말 · 지난 보고 이후) · 초안 줄(끝낸 일 · 진행 · 선정/입금 따로 · 부탁 5 · 보완 먼저 · 다음 30일 4)
 *       · 내부 글 꺼짐 · 수수료 · 메모 0 · 발행 모양(켠 줄만) · 안내 문구(내부 id · 금액 0)
 *  USE: 사용 상태(연결 전 · 가입 안내 · 안 오심 · 사용 중 · 30일 · 멈춤 · 끊음)
 *  RULE: 후속 업무(3일 · 14일 · 30일 · 새 주기 = 새 열쇠 · 풀리면 빠짐 · 연습 모드 방문 규칙 건너뜀)
 *  OFF: 0033 없음 · 되돌림(실행 권한 없음) 알아보기 — 다른 오류는 '꺼짐' 으로 숨기지 않음
 */
import { normalizeClientOps } from '../clientOpsService'
import type { ClientOpsRecord } from '../../types/clientOps'
import {
  ASK_MAX,
  NEXT_MAX,
  REPORT_KIND_LABEL,
  buildReportDraft,
  contractStart,
  daysBetween,
  defaultPeriod,
  draftPayload,
  draftPeriod,
  hasActiveWork,
  periodUsable,
  periodsFor,
  portalFollowUps,
  portalInviteText,
  portalUsage,
  reportNoticeText,
  shiftDay,
  type PortalSeen,
} from '../portalGrowthRules'
import { growthErrorText, isGrowthOff, reportCustomerUrl } from '../portalGrowth'

let passed = 0
let failed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1
    console.log('PASS ', name)
  } else {
    failed += 1
    console.log('FAIL ', name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 900))
  }
}

const today = '2026-11-27'
const svc = (status: string, extra: Record<string, unknown> = {}) => ({ status, dueDate: '', nextStep: '', note: '', startedAt: null, completedAt: null, waitingSince: null, ...extra })
const base = (over: Partial<ClientOpsRecord> = {}): ClientOpsRecord =>
  normalizeClientOps({
    id: 'c1',
    workspaceId: null,
    companyName: '(주)에이정밀',
    representativeName: '김에이',
    status: 'active',
    createdAt: '2026-01-05T00:00:00Z',
    updatedAt: '2026-01-05T00:00:00Z',
    notes: '수수료 300만원 협의 — 비밀',
    ...over,
  } as Partial<ClientOpsRecord>)

// ---------------- 기간 ----------------
check('REP-01a 최근 2주 = 오늘 포함 14일', JSON.stringify(draftPeriod('2w', base(), today)) === JSON.stringify({ from: '2026-11-14', to: today }))
check('REP-01b 최근 1개월 = 한 달 전 다음 날부터', JSON.stringify(draftPeriod('1m', base(), today)) === JSON.stringify({ from: '2026-10-28', to: today }))
check('REP-01c 3/31 의 1개월 = 3/1 부터(2월 말일로 맞춘 뒤 다음 날)', draftPeriod('1m', base(), '2026-03-31').from === '2026-03-01', draftPeriod('1m', base(), '2026-03-31'))
check('REP-01d 1/10 의 2주 = 전해 12/28 부터(연말 넘김)', draftPeriod('2w', base(), '2026-01-10').from === '2025-12-28')
check('REP-01e 지난 보고 이후 = 지난 보고 끝 다음 날 · 없으면 1개월', draftPeriod('since_last', base(), today, '2026-11-13').from === '2026-11-14' && draftPeriod('since_last', base(), today, null).from === '2026-10-28')
check('REP-01f 지난 보고 끝이 오늘이면 오늘 하루', draftPeriod('since_last', base(), today, today).from === today)
check('REP-01g 올해 = 1/1', draftPeriod('year', base(), today).from === '2026-01-01')
check('REP-01h 날짜 더하기 · 날 수(윤년 2/29)', shiftDay('2028-02-28', 1) === '2028-02-29' && daysBetween('2026-11-24', today) === 3 && daysBetween('bad', today) === 0)

// ---------------- 초안 ----------------
const rec = base({
  services: {
    ...base().services,
    incorporation: svc('done', { completedAt: '2026-11-20T03:00:00Z' }), // 한국 · 세계 시각 모두 11/20
    venture: svc('in_progress', { nextStep: '대표 개인 채무 확인 후 진행(내부)', dueDate: '2026-12-10' }),
    patent: svc('waiting_client'),
    policyFund: svc('done', { completedAt: '2026-09-01T00:00:00Z' }), // 기간 밖
  } as ClientOpsRecord['services'],
  fundingApplications: [
    { id: 'f1', programName: '창업도약 패키지', status: 'selected', resultAt: '2026-11-20', approvedAmount: 50_000_000, executedAmount: 30_000_000, executedAt: '2026-11-25', applyDueDate: '', resultDueDate: '' },
    { id: 'f2', programName: '혁신바우처', status: 'selected', resultAt: '2026-11-21', approvedAmount: 20_000_000, executedAmount: null, executedAt: null, applyDueDate: '', resultDueDate: '' },
    { id: 'f3', programName: '수출지원', status: 'preparing', resultAt: null, approvedAmount: null, applyDueDate: '2026-12-05', resultDueDate: '' },
    { id: 'f4', programName: '먼 공고', status: 'preparing', resultAt: null, approvedAmount: null, applyDueDate: '2027-03-01', resultDueDate: '' },
  ] as unknown as ClientOpsRecord['fundingApplications'],
})
const docs = [
  { id: 'd1', title: '사업자등록증', status: 'verified' as const, verifiedAt: '2026-11-20T02:00:00Z' },
  { id: 'd2', title: '재무제표', status: 'requested' as const, verifiedAt: null },
  { id: 'd3', title: '4대보험 명부', status: 'rejected' as const, verifiedAt: null },
  ...Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, title: `추가 서류 ${i + 1}`, status: 'requested' as const, verifiedAt: null })),
]
const updates = [
  { id: 'u1', title: '계약서 확인', status: 'published' as const, actionRequired: true, actionLabel: '계약서 서명해 주세요', completedAt: null },
  { id: 'u2', title: '내린 안내', status: 'archived' as const, actionRequired: true, actionLabel: '보이면 안 됨', completedAt: null },
]
const d = buildReportDraft({ record: rec, today, kind: 'progress', period: draftPeriod('2w', rec, today), docs, updates })
const sec = (k: string) => d.sections.find((s) => s.key === k)
const texts = (k: string) => (sec(k)?.lines ?? []).map((l) => l.text)
check('REP-02a 경과 보고 칸 차례 — 지금 진행 중 · 끝낸 일 · 확보한 자금 · 부탁드릴 것 · 다음 계획', d.sections.map((s) => s.key).join(',') === 'now,done,money,ask,next', d.sections.map((s) => s.key))
check('REP-02b 끝낸 일 — 기간 안 업무(11/20) · 확인 끝낸 서류 · 기간 밖 업무 0', texts('done').some((t) => t.startsWith('법인') && t.endsWith('완료')) && sec('done')?.lines.find((l) => l.text.startsWith('법인'))?.date === '2026-11-20' && texts('done').includes('자료 확인 완료: 사업자등록증') && !texts('done').some((t) => t.includes('정책자금')), texts('done'))
check('REP-02c 진행 중 — 이름 + 상태(회신 대기는 고객 말로) · 직원이 적은 다음 단계는 꺼진 내부 글', texts('now').some((t) => t.startsWith('벤처') && t.includes('진행 중')) && texts('now').some((t) => t.includes('대표님 회신을 기다리고')) && sec('now')!.lines.filter((l) => l.internal).every((l) => !l.on && l.text.includes('개인 채무')), sec('now')?.lines)
check('REP-02 SEC-04 수수료 · 메모 글은 어느 줄에도 없음', !JSON.stringify(d).includes('300만원') && !JSON.stringify(d).includes('비밀'))
check('REP-02d 자금 — 한 사업 한 줄 · 입금(확정)과 선정(입금 전)을 글로 나눔 · 합계 줄 0', texts('money').length === 2 && texts('money').some((t) => t.includes('창업도약') && t.includes('입금 확인 3,000만원')) && texts('money').some((t) => t.includes('혁신바우처') && t.includes('선정 2,000만원') && t.includes('아직 입금 전')) && !texts('money').some((t) => /합계|총/.test(t)), texts('money'))
check('REP-02e 부탁드릴 것 — 다시 올릴 것 먼저 · 5개까지 · 내린 안내 0', texts('ask')[0] === '4대보험 명부 다시 올려 주세요' && texts('ask').length === ASK_MAX && !texts('ask').includes('보이면 안 됨'), texts('ask'))
check('REP-02f 다음 계획 — 30일 안만 · 가까운 것부터 · 4개까지 · 업무는 이름만(내부 글 0)', texts('next').length <= NEXT_MAX && texts('next').includes('수출지원 신청 마감') && !texts('next').some((t) => t.includes('먼 공고')) && texts('next').some((t) => t === '벤처인증 (혁신성장유형) 목표일' || t.endsWith('목표일')) && !texts('next').some((t) => t.includes('채무')), texts('next'))
check('REP-02g 요약 한 줄 — 기간 · 건수(내부 글은 세지 않음)', d.summary.startsWith('이번 기간(11/14 ~ 11/27)에 끝낸 일') && d.summary.includes('진행 중 2건') && d.summary.includes('부탁드릴 것이 5건'), d.summary)
const p = draftPayload(d)
check('REP-02h 발행 모양 — 켠 줄만(내부 글 0) · 빈 칸 빠짐 · 출처는 켠 줄만', !JSON.stringify(p.sections).includes('채무') && p.sections.every((s) => s.items.length > 0) && p.sourceRefs.length === p.lineCount, { n: p.lineCount, r: p.sourceRefs.length })
const sum = buildReportDraft({ record: rec, today, kind: 'consult_summary', period: { from: today, to: today }, docs, updates })
check('REP-02i 상담 요약 — 직원이 채울 빈 칸(이야기 · 정한 일) + 부탁 · 다음 일정', sum.sections.map((s) => s.key).join(',').startsWith('talk,agreed,ask') && sum.sections[0].lines.length === 0)
const empty = buildReportDraft({ record: base(), today, kind: 'progress', period: draftPeriod('2w', base(), today) })
check('REP-02j 기록 없는 업체 — 빈 칸만(없는 성과를 만들지 않음) · 자금 칸 없음', empty.sections.every((s) => s.lines.length === 0) && !empty.sections.some((s) => s.key === 'money') && draftPayload(empty).lineCount === 0)
const notice = reportNoticeText({ who: '김에이 대표님', kindLabel: '경과 보고', title: d.title, url: reportCustomerUrl('https://miraeailab.com/', 'rep-1') })
check('REP-02k 안내 문구 — 보고서 주소(로그인하면 그 보고서) · 금액 · 서류 이름 0', notice.includes('https://miraeailab.com/my-projects/reports/rep-1') && !/만원|재무제표|c1/.test(notice), notice)
const invite = portalInviteText({ who: '김에이 대표님', signupUrl: 'https://miraeailab.com/signup?next=%2Fmy-projects', email: 'a@x.kr' })
check('REP-02l 가입 안내 문구 — 가입 주소 · 그 이메일 · 내부 id 0 · 저절로 연결한다는 말 0', invite.includes('/signup?next=') && invite.includes('a@x.kr') && !invite.includes('c1') && invite.includes('담당자가 회사와 연결'))

// ---------------- 사용 상태 ----------------
const L = (id: string, status: 'active' | 'paused' | 'revoked', linkedAt = '2026-11-01T00:00:00Z') => ({ id, status, linkedAt })
const seen = (m: Record<string, PortalSeen>) => new Map(Object.entries(m))
check('USE-01 연결 0 · 안내 전 = 연결 전 / 안내 뒤 = 가입 안내함', portalUsage({ links: [], homeSeen: seen({}) }, today).state === 'none' && portalUsage({ links: [], homeSeen: seen({}), invitedAt: '2026-11-20' }, today).state === 'invited')
check('USE-02 연결 · 방문 0 = 연결됨(안 오심)', portalUsage({ links: [L('l1', 'active')], homeSeen: seen({}) }, today).state === 'linked_unvisited')
check('USE-03 방문 있음 = 사용 중 · 첫 · 최근 방문 날짜', (() => { const u = portalUsage({ links: [L('l1', 'active')], homeSeen: seen({ l1: { first: '2026-11-21T03:00:00Z', last: '2026-11-27T03:00:00Z' } }) }, today); return u.state === 'active' && u.lastVisit === '2026-11-27' && u.firstVisit === '2026-11-21' })())
check('USE-04 30일 넘게 안 오심', portalUsage({ links: [L('l1', 'active')], homeSeen: seen({ l1: { first: '2026-10-01T00:00:00Z', last: '2026-10-27T00:00:00Z' } }) }, today).state === 'dormant')
check('USE-05 멈춤 · 끊음 — 활성 연결이 없을 때만', portalUsage({ links: [L('l1', 'paused')], homeSeen: seen({}) }, today).state === 'paused' && portalUsage({ links: [L('l1', 'revoked')], homeSeen: seen({}) }, today).state === 'revoked' && portalUsage({ links: [L('l1', 'revoked'), L('l2', 'active')], homeSeen: seen({}) }, today).state === 'linked_unvisited')
check('USE-06 여러 계정 — 가장 최근 방문으로', portalUsage({ links: [L('l1', 'active'), L('l2', 'active')], homeSeen: seen({ l1: { first: '2026-10-01T00:00:00Z', last: '2026-10-02T00:00:00Z' }, l2: { first: '2026-11-25T00:00:00Z', last: '2026-11-26T00:00:00Z' } }) }, today).state === 'active')

// ---------------- 후속 업무 ----------------
const fu = (over: Partial<Parameters<typeof portalFollowUps>[0]> = {}, t = today) =>
  portalFollowUps({ clientId: 'c1', links: [], homeSeen: seen({}), reports: [], reportSeen: new Set(), activeWork: false, ...over }, t)
const rules = (xs: { rule: string }[]) => xs.map((x) => x.rule).join(',')
check('RULE-a 가입 안내 2일 = 0 · 3일 = 1(연결되면 0)', fu({ invitedAt: '2026-11-25' }).length === 0 && rules(fu({ invitedAt: '2026-11-24' })) === 'invite_pending' && fu({ invitedAt: '2026-11-20', links: [L('l1', 'active', '2026-11-26T00:00:00Z')] }).every((x) => x.rule !== 'invite_pending'))
check('RULE-b 연결 3일 · 방문 0 = 첫 방문 없음 · 방문하면 빠짐', rules(fu({ links: [L('l1', 'active', '2026-11-24T00:00:00Z')] })) === 'first_visit' && fu({ links: [L('l1', 'active', '2026-11-24T00:00:00Z')], homeSeen: seen({ l1: { first: '2026-11-26T00:00:00Z', last: '2026-11-26T00:00:00Z' } }) }).length === 0)
const rep = (id: string, publishedAt: string) => ({ id, status: 'published' as const, publishedAt })
const visited = seen({ l1: { first: '2026-11-20T00:00:00Z', last: '2026-11-26T00:00:00Z' } })
check('RULE-c 보고서 3일 안 열어 봄 = 1 · 열어 보면 빠짐 · 2일은 0', rules(fu({ links: [L('l1', 'active')], homeSeen: visited, reports: [rep('r1', '2026-11-24T01:00:00Z')] })) === 'report_unseen' && fu({ links: [L('l1', 'active')], homeSeen: visited, reports: [rep('r1', '2026-11-24T01:00:00Z')], reportSeen: new Set(['r1']) }).length === 0 && fu({ links: [L('l1', 'active')], homeSeen: visited, reports: [rep('r1', '2026-11-25T01:00:00Z')] }).length === 0)
check('RULE-d 새 보고서 = 새 열쇠(지난 것은 그대로 두고 새 주기)', fu({ links: [L('l1', 'active')], homeSeen: visited, reports: [rep('r1', '2026-11-01T00:00:00Z'), rep('r2', '2026-11-23T00:00:00Z')] }).find((x) => x.rule === 'report_unseen')?.key === 'c1:unseen:r2')
check('RULE-e 경과 보고 14일 공백 — 일하는 동안만 · 새 보고서 내면 빠짐', rules(fu({ links: [L('l1', 'active')], homeSeen: visited, reports: [rep('r1', '2026-11-12T00:00:00Z')], reportSeen: new Set(['r1']), activeWork: true })) === 'report_gap' && fu({ links: [L('l1', 'active')], homeSeen: visited, reports: [rep('r1', '2026-11-12T00:00:00Z')], reportSeen: new Set(['r1']), activeWork: false }).length === 0 && fu({ links: [L('l1', 'active')], homeSeen: visited, reports: [rep('r1', '2026-11-12T00:00:00Z'), rep('r2', '2026-11-26T00:00:00Z')], reportSeen: new Set(['r1', 'r2']), activeWork: true }).length === 0)
check('RULE-f 보고서 한 번도 없음 — 연결 14일부터 "아직 보고서가 없어요"', fu({ links: [L('l1', 'active', '2026-11-10T00:00:00Z')], homeSeen: visited, activeWork: true }).some((x) => x.rule === 'report_gap' && x.text.includes('아직 보고서가 없어요') && x.key === 'c1:gap:none'))
check('RULE-g 30일 안 오심 · 열쇠에 마지막 방문일(다시 오면 새 주기)', fu({ links: [L('l1', 'active')], homeSeen: seen({ l1: { first: '2026-10-01T00:00:00Z', last: '2026-10-20T00:00:00Z' } }) }).find((x) => x.rule === 'dormant')?.key === 'c1:dormant:l1:2026-10-20')
check('RULE-h 멈춘 · 끊은 연결은 세지 않음', fu({ links: [L('l1', 'paused', '2026-10-01T00:00:00Z')], reports: [rep('r1', '2026-11-01T00:00:00Z')], activeWork: true }).length === 0)
check('RULE-i 연습 모드(방문 기록 모름) — 방문 · 열람 규칙 건너뜀 · 보고 공백은 셈', rules(fu({ links: [L('l1', 'active', '2026-11-01T00:00:00Z')], reports: [rep('r1', '2026-11-01T00:00:00Z')], activeWork: true, visitsKnown: false })) === 'report_gap')
check('RULE-j 차례 — 안 열어 봄 > 보고 공백 > 첫 방문', rules(fu({ links: [L('l1', 'active', '2026-11-01T00:00:00Z'), L('l2', 'active', '2026-11-01T00:00:00Z')], homeSeen: seen({ l1: { first: '2026-11-02T00:00:00Z', last: '2026-11-26T00:00:00Z' } }), reports: [rep('r1', '2026-11-05T00:00:00Z')], activeWork: true })) === 'report_unseen,report_gap,first_visit')
check('RULE-k 일하는 중인지 — 진행 · 회신 대기만 · 보관한 업체는 아님', hasActiveWork(rec) && !hasActiveWork(base()) && !hasActiveWork({ ...rec, archivedAt: '2026-11-01T00:00:00Z' }))

// ---------------- 꺼짐 알아보기 ----------------
check('OFF-a 함수 없음(PGRST202) · 표 없음(42P01) · 실행 권한 · 표 읽기 권한 거둠(되돌리기) = 꺼짐',
  isGrowthOff({ code: 'PGRST202', message: 'Could not find the function public.portal_publish_report' }) && isGrowthOff({ code: '42P01', message: 'relation "public.portal_reports" does not exist' }) && isGrowthOff({ code: '42501', message: 'permission denied for function portal_preview_report' }) && isGrowthOff({ code: '42501', message: 'permission denied for table portal_reports' }))
check('OFF-b 다른 오류(로그인 만료 · 남의 업체 · 다른 함수 권한)는 꺼짐으로 숨기지 않음',
  !isGrowthOff({ code: 'PGRST301', message: 'JWT expired' }) && !isGrowthOff({ code: '42501', message: 'not allowed' }) && !isGrowthOff({ code: '42501', message: 'permission denied for function staff_find_customer_profile' }))
check('OFF-c 사람 말 — 한국어 글은 그대로 · 권한 · 없음은 정해진 글', growthErrorText({ message: '이미 정정했거나 내린 보고서입니다' }, 'x') === '이미 정정했거나 내린 보고서입니다' && growthErrorText({ code: '42501', message: 'not allowed' }, 'x').includes('권한') && growthErrorText({ code: 'P0002', message: 'not found' }, 'x').includes('찾지 못했어요') && growthErrorText(new Error('TypeError: x'), '기본') === '기본')

// ---------------- D-682 월간 · 연간 보고 · 월말 보고 챙기기 ----------------
const signed = base({ contract: { signedAt: '2026-03-15', kind: '', cashAmount: null, policies: [], note: '' } } as Partial<ClientOpsRecord>)
check('MON-01 이름이 홈페이지와 같음(월간 보고 · 연간 보고)', REPORT_KIND_LABEL.monthly === '월간 보고' && REPORT_KIND_LABEL.annual === '연간 보고')
check('MON-02 종류마다 기간 — 월간: 이번 달 · 지난달 / 연간: 계약일부터 · 최근 12개월 / 경과: 예전 넷', periodsFor('monthly').join() === 'this_month,last_month' && periodsFor('annual').join() === 'contract,last12' && periodsFor('progress').join() === '2w,1m,since_last,year')
check('MON-03 이번 달 = 1일 ~ 오늘 · 지난달 = 전달 1일 ~ 말일(3월 → 2월 28일 · 1월 → 전해 12월)',
  JSON.stringify(draftPeriod('this_month', base(), today)) === JSON.stringify({ from: '2026-11-01', to: today }) &&
  JSON.stringify(draftPeriod('last_month', base(), '2026-03-05')) === JSON.stringify({ from: '2026-02-01', to: '2026-02-28' }) &&
  JSON.stringify(draftPeriod('last_month', base(), '2026-01-03')) === JSON.stringify({ from: '2025-12-01', to: '2025-12-31' }))
check('MON-04 월간 먼저 고를 기간 — 1~7일은 지난달 · 그 뒤는 이번 달', defaultPeriod('monthly', base(), '2026-12-03') === 'last_month' && defaultPeriod('monthly', base(), '2026-12-08') === 'this_month')
check('ANN-01 계약일 = 서명일 · 비면 빈 칸(짐작 0)', contractStart(signed) === '2026-03-15' && contractStart(base()) === '')
check('ANN-02 계약일이 없으면 "계약일부터" 못 고름 · 먼저 고를 기간 = 최근 12개월 · 그래도 부르면 최근 12개월(만든 날로 짐작 0)',
  !periodUsable('contract', base(), today) && defaultPeriod('annual', base(), today) === 'last12' && draftPeriod('contract', base(), today).from === draftPeriod('last12', base(), today).from && draftPeriod('contract', base(), today).from !== '2026-01-05')
check('ANN-03 계약일이 있으면 계약일부터 · 앞날 계약일은 못 고름', periodUsable('contract', signed, today) && draftPeriod('contract', signed, today).from === '2026-03-15' && defaultPeriod('annual', signed, today) === 'contract' && !periodUsable('contract', base({ contract: { signedAt: '2027-01-01', kind: '', cashAmount: null, policies: [], note: '' } } as Partial<ClientOpsRecord>), today))
const yearRec = { ...rec, contract: signed.contract }
const ann = buildReportDraft({ record: yearRec, today, kind: 'annual', period: draftPeriod('contract', yearRec, today), docs, updates, picks: [{ key: 'employment', label: '고용지원금' }, { key: 'lab', label: '기업부설연구소' }, { key: 'policy', label: '정책자금' }, { key: 'x', label: '넷째' }], history: { reports: 5, reportsSeen: 3 } })
const annKeys = ann.sections.map((x) => x.key).join(',')
const annSec = (k: string) => ann.sections.find((x) => x.key === k)
check('ANN-04 연간 칸 차례 — 함께 한 일 · 진행 · 자금 · 함께 한 기록 · 다음 1년 검토 · 남은 것', annKeys === 'done,now,money,record,review,limits', annKeys)
check('ANN-05 함께 한 기록 = 숫자만(보낸 보고서 5편 · 열어 보신 것 3편 · 확인 마친 자료 1개)', (annSec('record')?.lines ?? []).map((l) => l.text).join('|') === '보내 드린 보고서 5편 · 열어 보신 것 3편|확인을 마친 자료 1개', annSec('record')?.lines.map((l) => l.text))
check('ANN-06 다음 1년 검토 — 먼저 제안할 것 3개까지 · 모두 꺼진 채(직원이 켜야 나감) · 금액 0 · 출처 = 판정 열쇠', (annSec('review')?.lines.length ?? 0) === 3 && annSec('review')!.lines.every((l) => !l.on && !/만원|억|원\b/.test(l.text) && l.source?.type === 'insight') && annSec('review')!.lines[0].text.startsWith('고용지원금'))
check('ANN-07 발행 모양 — 꺼진 검토 줄 · 빈 "남은 것" 칸은 안 나감', !JSON.stringify(draftPayload(ann).sections).includes('함께 검토해 볼 만해요') && !draftPayload(ann).sections.some((x) => x.key === 'limits'))
check('ANN-08 제목 · 요약 — 해까지 쓴 기간 · 자금은 건수만(합계 0)', ann.title === '연간 보고 (2026.3/15 ~ 2026.11/27)' && ann.summary.includes('확보한 자금 2건') && !/만원/.test(ann.summary), [ann.title, ann.summary])
check('ANN-09 수수료 · 메모 · 내부 글은 연간에도 0', !JSON.stringify(draftPayload(ann)).includes('300만원') && !JSON.stringify(draftPayload(ann)).includes('채무'))
const mon = buildReportDraft({ record: rec, today: '2026-12-03', kind: 'monthly', period: draftPeriod('last_month', rec, '2026-12-03'), docs, updates })
check('MON-05 지난달 월간 보고 — 이름은 그 달(11월 월간 보고) · 경과 보고와 같은 칸', mon.title === '11월 월간 보고' && mon.sections.map((x) => x.key).join(',').startsWith('now,done') && mon.periodEnd === '2026-11-30', [mon.title, mon.periodEnd])
const mfu = (over: Partial<Parameters<typeof portalFollowUps>[0]> = {}, t = '2026-11-25') =>
  portalFollowUps({ clientId: 'c1', links: [L('l1', 'active', '2026-11-01T00:00:00Z')], homeSeen: seen({ l1: { first: '2026-11-02T00:00:00Z', last: '2026-11-24T00:00:00Z' } }), reports: [rep('r1', '2026-11-20T03:00:00Z')], reportSeen: new Set(['r1']), activeWork: true, contracted: true, ...over }, t)
check('RULE-m1 월말 5일 전 · 이번 달 보고 있음 → 0', !mfu().some((x) => x.rule === 'monthly_review'))
check('RULE-m2 이번 달 보고 없음(지난달 것뿐) · 월말 5일 전 → "11월 보고를 아직 안 보냈어요" · 열쇠에 그 달', mfu({ reports: [rep('r0', '2026-10-30T03:00:00Z')], reportSeen: new Set(['r0']), activeWork: false }).find((x) => x.rule === 'monthly_review')?.key === 'c1:monthly:2026-11')
check('RULE-m3 월말 8일 전이면 아직 0 · 계약 전 고객 0 · 활성 계정 없으면 0',
  !mfu({ reports: [], activeWork: false }, '2026-11-22').some((x) => x.rule === 'monthly_review') && !mfu({ reports: [], activeWork: false, contracted: false }).some((x) => x.rule === 'monthly_review') && !mfu({ reports: [], activeWork: false, links: [L('l1', 'paused')] }).some((x) => x.rule === 'monthly_review'))
check('RULE-m4 보고 공백 줄이 이미 있으면 월말 줄은 안 띄움(같은 일 두 번 0)', (() => { const r = mfu({ reports: [rep('r0', '2026-10-30T03:00:00Z')], reportSeen: new Set(['r0']) }); return r.some((x) => x.rule === 'report_gap') && !r.some((x) => x.rule === 'monthly_review') })())
check('RULE-m5 2월 · 12월 말일 계산(2/23 = 5일 전 → 뜸 · 12/24 = 7일 전 → 0)', mfu({ reports: [], activeWork: false }, '2026-02-23').some((x) => x.rule === 'monthly_review' && x.key.endsWith('2026-02')) && !mfu({ reports: [], activeWork: false }, '2026-12-24').some((x) => x.rule === 'monthly_review'))

console.log(`\nportalGrowth: ${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
