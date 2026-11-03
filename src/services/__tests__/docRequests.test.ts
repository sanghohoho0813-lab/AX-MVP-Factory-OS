/**
 * D-512 서류 요청 → 회신 대기 → 받으면 줄어든다.
 * 요청 문구 세 가지(서류 요청 · 받을 자료 · 정책자금 신청 서류)를 줄로 읽기 · 서류함 칸 짝 · 받음(새 발급본은 보낸 뒤 올린 파일만) ·
 * 사람이 [받았어요] · 다시 보냄 · 끝내기 · 남은 것만 다시 요청 문구 · 저장 모양 다듬기 · 고객 관리 · 오늘 한 줄.
 * D-518 서류 단계 — 받음 · 요청함 · 확인할 정보(받은 서류에서 읽었지만 확인 전) · 칸마다 확인할 정보 수.
 * D-519 처음 시작 — 업체 · 서류 · 할 일 · (마케팅) 첫 콘텐츠 단계 · 다음 단계 · 언제 띄우나.
 */
import { normalizeClientOps, withCustomDocument, withDocument } from '../clientOpsService'
import { buildDocumentRequestMessage } from '../clientOpsMessages'
import { requestMessage } from '../recoRequest'
import { policyApplyMessage } from '../policyApply'
import { requestFollowUpText } from '../recoFollowUp'
import {
  itemView,
  newDocRequest,
  normalizeDocRequests,
  openRequests,
  pendingDocKeys,
  requestLinesOf,
  requestProgress,
  requestSummary,
  resendText,
  slotsFor,
  todoRequestProgress,
  withDocRequest,
  withItemDone,
  withRequestClosed,
  withRequestResent,
} from '../docRequests'
import type { ClientOpsRecord, DocRequest } from '../../types/clientOps'
import { docReviewCounts, docShelfSummary } from '../docShelf'
import { firstUseNext, firstUseSteps, firstUseVisible, isNewAccount } from '../firstUse'
import type { JournalEntry } from '../../types/bridge'

let passed = 0
let failed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1
    console.log('PASS ', name)
  } else {
    failed += 1
    console.log('FAIL ', name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 700))
  }
}

const today = '2026-11-03'
const base = (over: Partial<ClientOpsRecord> = {}): ClientOpsRecord =>
  normalizeClientOps({ id: 'c1', workspaceId: null, companyName: '한솔정밀(주)', representativeName: '김한솔', status: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...over })

/* R1 문구 → 줄 */
{
  // 받을 자료(D-191)
  const t1 = requestMessage({ contactName: '', representativeName: '김한솔', companyName: '한솔정밀(주)' }, [
    { label: '4대보험 사업장 가입자 명부', where: '4대사회보험 정보연계센터 › 사업장 가입자 명부 출력(PDF)', for: ['고용지원금'] },
    { label: '대표님 생년월일', where: '날짜만 알려 주셔도 됩니다(주민등록번호는 받지 않습니다)', for: ['정책자금'] },
  ])
  const l1 = requestLinesOf(t1)
  check('R1a 받을 자료 문구 → 줄 2 · 이름에서 "— 고용지원금 확인용" 은 뺌 · 어디서 줄을 붙임', l1.length === 2 && l1[0].label === '4대보험 사업장 가입자 명부' && l1[0].where.startsWith('4대사회보험') && l1[1].label === '대표님 생년월일' && !l1[0].renew, l1)
  // 정책자금 신청 서류(D-313) — 국세 · 지방세 · 4대보험이 한 줄이면 셋으로
  const t2 = policyApplyMessage({ contactName: '', representativeName: '김한솔', companyName: '한솔정밀(주)' }, { items: [{ label: '표준재무제표증명(최근 3년)', where: '홈택스 › 표준재무제표증명(PDF)' }, { label: '국세 · 지방세 납세증명서 · 4대보험 완납증명서', where: '홈택스 · 위택스 · 4대사회보험 정보연계센터' }], ours: ['사업계획서'] }, '중진공')
  const l2 = requestLinesOf(t2)
  check('R1b 정책자금 문구 → 재무제표 + 국세 · 지방세 · 4대보험 셋으로 나눔 · 사업계획서(저희가 씀) 줄은 없음', l2.map((x) => x.label).join('|') === '표준재무제표증명(최근 3년)|국세 납세증명서|지방세 납세증명서|4대보험 완납증명서' && l2.every((x) => x.where), l2)
  // 서류 요청(clientOpsMessages) — 만료된 서류는 '(기존 서류는 …)' → 새 발급본
  let r = base()
  r = { ...r, services: { ...r.services, policyFund: { ...r.services.policyFund, status: 'in_progress' } } }
  r = withDocument(r, 'smeCertificate', { received: true, issuedAt: '2024-01-01' })
  const t3 = buildDocumentRequestMessage(r, today)
  const l3 = requestLinesOf(t3)
  check('R1c 서류 요청 문구 → 줄 여럿 · 만료된 중소기업 확인서는 새 발급본(renew)', l3.length >= 2 && l3.some((x) => /중소기업/.test(x.label) && x.renew) && l3.some((x) => !x.renew), l3)
  check('R1d 줄이 없는 문구(진행 상황 보고 · 빈 글) → []', requestLinesOf('안녕하세요. 진행 상황 공유드립니다.\n- 정책자금: 진행 중').length === 0 && requestLinesOf('').length === 0)
  check('R1e D-314 할 일 글은 그대로(요청 문구 → \'자료 받았는지 확인 — …\')', requestFollowUpText(t2).startsWith('자료 받았는지 확인 — 표준재무제표증명(최근 3년)'), requestFollowUpText(t2))
}

/* R2 줄 → 서류함 칸 */
{
  let r = base()
  check('R2a 표준재무제표증명 → 기본 칸 최근 3개년 재무제표', slotsFor(r, '표준재무제표증명(최근 3년)').includes('financialStatements'))
  check('R2b 사업자등록증 사본 → 사업자등록증 칸', slotsFor(r, '사업자등록증 사본').includes('businessRegistration'))
  check('R2c 법인 등기사항전부증명서 → 법인등기부등본 칸', slotsFor(r, '법인 등기사항전부증명서').includes('corporateRegistry'))
  check('R2d 대표님 생년월일 → 칸 없음(사람이 체크)', slotsFor(r, '대표님 생년월일').length === 0)
  check('R2e 공동인증서 전달 → 이름이 같은 기본 칸', slotsFor(r, '공동인증서 전달').includes('jointCertificate'))
  r = withCustomDocument(r, { label: '납세증명서' })
  r = withCustomDocument(r, { label: '지방세 납세증명서' })
  const tax = r.customDocuments.find((d) => d.label === '납세증명서')!.key
  const local = r.customDocuments.find((d) => d.label === '지방세 납세증명서')!.key
  const k1 = slotsFor(r, '국세 납세증명서')
  const k2 = slotsFor(r, '지방세 납세증명서')
  check('R2f 국세 납세증명서 → \'납세증명서\' 칸만(지방세 칸 아님) · 지방세 → 지방세 칸', k1.includes(tax) && !k1.includes(local) && k2.includes(local) && !k2.includes(tax), { k1, k2 })
  check('R2g 서류를 올리며 새로 생긴 칸(\'(2)\' 겹침 칸 포함)도 짝', (() => {
    const r2 = withCustomDocument(r, { label: '주주명부 (2)' })
    return slotsFor(r2, '주주명부(최근 것)').length === 1
  })())
}

/* R3~R6 기록 · 받음 · 체크 · 다시 보냄 · 끝내기 */
const text = [
  '안녕하세요, 김한솔 대표님.',
  '',
  '아래 서류를 보내 주시면 바로 검토해 드리겠습니다.',
  '',
  '1. 표준재무제표증명(최근 3년)',
  '   - 홈택스 › 표준재무제표증명(PDF)',
  '2. 중소기업 확인서 (기존 서류는 유효기간이 지나 새 발급본이 필요합니다)',
  '   - 중소기업현황정보시스템',
  '3. 대표님 생년월일',
  '   - 날짜만 알려 주셔도 됩니다',
].join('\n')
// 옛 파일은 2년 전에 올린 것 — 보낸 시각은 지금 바로 전(그 뒤 이 시험에서 올리는 파일은 '보낸 뒤')
let rec = withDocument(base(), 'smeCertificate', { received: true, issuedAt: '2024-01-01', fileName: 'old.pdf', storagePath: 'w/c1/old.pdf', uploadedAt: '2024-01-02T00:00:00.000Z' })
const sentIso = new Date(Date.now() - 1000).toISOString()
const req = newDocRequest(rec, { id: 'q1', title: '서류 요청 문구', text, today, nowIso: sentIso, todoId: 't1' }) as DocRequest
check('R3a [보냈어요] → 요청 기록 · 줄 3 · 보낸 날 · 할 일 id', !!req && req.items.length === 3 && req.sentAt === today && req.todoId === 't1' && req.title === '서류 요청 문구', req)
check('R3b 이미 받은 칸(만료 중소기업 확인서)은 had · 재무제표 · 생년월일은 had 없음', req.items[1].had === true && !req.items[0].had && !req.items[2].had, req.items)
rec = withDocRequest(rec, req)
check('R3c 업체 기록에 붙음 · 끝내지 않은 요청 1', openRequests(rec).length === 1 && rec.docRequests?.[0].id === 'q1')
{
  const p = requestProgress(rec, req, today)
  check('R4a 보낸 날 — 0/3 받음 · 오늘 보냄(0일)', p.got === 0 && p.total === 3 && p.waitingDays === 0 && !p.done, p)
  const keys = pendingDocKeys(rec, today)
  check('R4b 서류함 칸 알약 — 재무제표 · 중소기업 확인서(새 발급본) 칸이 \'요청함\'', keys.has('financialStatements') && keys.get('smeCertificate')?.renew === true && !keys.has('businessRegistration'), [...keys])
}
{
  // 재무제표 받음(새 파일)
  const r2 = withDocument(rec, 'financialStatements', { received: true, fileName: 'fs.pdf', storagePath: 'w/c1/fs.pdf' })
  const v = itemView(r2, req, req.items[0])
  check('R4c 재무제표 칸에 파일이 들어오면 그 줄은 저절로 받음(서류)', v.got && v.byDoc && v.gotAt.length === 10, v)
  // 만료 서류 칸은 메모만 고치면 받음이 아님(올린 때가 보낸 뒤가 아님)
  const r3 = withDocument(r2, 'smeCertificate', { note: '메모만' })
  check('R4d 새 발급본 줄 — 옛 파일 칸의 메모만 고치면 받음이 아님', !itemView(r3, req, req.items[1]).got)
  // 새 파일을 올리면(보낸 뒤) 받음
  const r4 = withDocument(r3, 'smeCertificate', { received: true, fileName: 'new.pdf', storagePath: 'w/c1/new.pdf', issuedAt: today })
  check('R4e 새 발급본을 올리면(보낸 뒤 올린 파일) 받음', itemView(r4, req, req.items[1]).got)
  const p4 = requestProgress(r4, req, '2026-11-06')
  check('R4f 3일 뒤 — 2/3 받음 · 3일째 · 남은 것 생년월일', p4.got === 2 && p4.waitingDays === 3 && p4.pending.length === 1 && p4.pending[0].item.label === '대표님 생년월일', p4)
  // 칸이 없는 줄은 사람이 [받았어요] · 되돌리기
  const r5 = withItemDone(r4, 'q1', '대표님 생년월일', '2026-11-06')
  const p5 = requestProgress(r5, r5.docRequests![0], '2026-11-06')
  check('R5a [받았어요] → 3/3 다 받음', p5.done && p5.got === 3 && p5.items[2].got && !p5.items[2].byDoc && p5.items[2].gotAt === '2026-11-06', p5.items[2])
  const r6 = withItemDone(r5, 'q1', '대표님 생년월일', null)
  check('R5b [되돌리기] → 다시 2/3', requestProgress(r6, r6.docRequests![0], '2026-11-06').got === 2 && !('doneAt' in r6.docRequests![0].items[2]))
  check('R5c 다 받으면 칸 알약 0 · 고객 관리 한 줄 \'다 받음\'', pendingDocKeys(r5, '2026-11-06').size === 0 && requestSummary(r5, '2026-11-06')?.done === true)
  check('R5d 오늘 할 일 줄 — 할 일 id → 3/3 다 받음', JSON.stringify(todoRequestProgress([r5], '2026-11-06').get('t1')) === JSON.stringify({ got: 3, total: 3, done: true }))
  const r7 = withRequestClosed(r5, 'q1', '2026-11-06')
  check('R6a [끝내기] → 끝낸 날 · 끝내지 않은 요청 0 · 고객 관리 한 줄 없음 · 할 일 줄 없음', r7.docRequests![0].closedAt === '2026-11-06' && openRequests(r7).length === 0 && requestSummary(r7, today) === null && todoRequestProgress([r7], today).size === 0)
}
{
  // 다시 보냄 — 기다린 날을 새로 센다 · 남은 것만 문구
  const r2 = withDocument(rec, 'financialStatements', { received: true, fileName: 'fs.pdf', storagePath: 'w/c1/fs.pdf' })
  const again = resendText(r2, req, '2026-11-07')
  const lines = requestLinesOf(again)
  check('R6b 아직 안 온 것만 다시 요청 문구 — 2가지 · 11월 3일에 부탁 · 같은 \'1. 이름 / - 어디서\' 모양(다시 읽힘)', /11월 3일에 부탁드린 자료 중 아래 2가지/.test(again) && lines.length === 2 && lines[0].label.startsWith('중소기업') && lines[0].where === '중소기업현황정보시스템' && /김한솔 대표님/.test(again), again)
  const r3 = withRequestResent(r2, 'q1', '2026-11-07')
  check('R6c [다시 보냈어요] → 다시 보낸 날부터 셈(11/9 = 2일째)', requestProgress(r3, r3.docRequests![0], '2026-11-09').waitingDays === 2 && r3.docRequests![0].resentAt === '2026-11-07')
  const all = withItemDone(withDocument(r2, 'smeCertificate', { received: true, fileName: 'n.pdf', storagePath: 'w/c1/n.pdf' }), 'q1', '대표님 생년월일', today)
  check('R6d 다 받았으면 다시 요청 문구 없음', resendText(all, all.docRequests![0], today) === '')
}

/* R7 고객 관리 한 줄 · 여러 요청 */
{
  const reqB = newDocRequest(rec, { id: 'q2', title: '받을 자료 요청 문구', text: '1. 주주명부(최근 것)\n   - 회사에 보관 중인 주주명부', today: '2026-10-28', nowIso: '2026-10-28T01:00:00.000Z' }) as DocRequest
  const r2 = withDocRequest(rec, reqB)
  const s = requestSummary(r2, today)
  check('R7a 요청 둘 — 고객 관리 한 줄은 합계(0/4) · 기다린 날은 가장 오래된 것(6일째)', s?.got === 0 && s?.total === 4 && s?.waitingDays === 6 && s?.done === false, s)
  check('R7b 최근 것이 앞 · 같은 id 는 하나로', r2.docRequests![0].id === 'q2' && withDocRequest(r2, reqB).docRequests!.length === 2)
  check('R7c 요청 줄이 없는 문구 → 기록 안 함(null)', newDocRequest(rec, { id: 'x', title: '진행 상황 보고 문구', text: '진행 상황 공유드립니다.', today, nowIso: sentIso }) === null)
}

/* R8 저장 모양 다듬기 */
{
  const n = normalizeDocRequests([
    { id: 'ok', sentAt: '2026-11-01', sentAtIso: '2026-11-01T00:00:00.000Z', title: 'T', items: [{ label: 'A', where: 'w', had: true, doneAt: '2026-11-02' }, { label: '' }, 3], todoId: 't9', resentAt: 'bad', closedAt: '2026-11-03' },
    { id: 'nodate', sentAt: '11/1', items: [{ label: 'A' }] },
    { id: 'noitems', sentAt: '2026-11-01', items: [] },
    null,
  ])
  const d = n.docRequests ?? []
  check('R8a 모양이 맞는 것만 — 날짜 · 줄 없는 기록 · 빈 이름 줄 · 틀린 다시 보낸 날은 버림', d.length === 1 && d[0].items.length === 1 && d[0].items[0].had === true && d[0].items[0].doneAt === '2026-11-02' && d[0].todoId === 't9' && !('resentAt' in d[0]) && d[0].closedAt === '2026-11-03', d)
  check('R8b 배열이 아니면 칸 없음', Object.keys(normalizeDocRequests(undefined)).length === 0 && Object.keys(normalizeDocRequests('x')).length === 0)
  const round = normalizeClientOps({ ...rec } as Partial<ClientOpsRecord>)
  check('R8c 업체 기록을 다시 읽어도(저장 → 불러오기) 요청 기록이 남음', round.docRequests?.length === 1 && round.docRequests[0].items.length === 3 && round.docRequests[0].sentAtIso === sentIso)
  const old = normalizeClientOps({ id: 'old', companyName: '옛 업체' })
  check('R8d 예전 업체 기록(요청 칸 없음)은 칸이 생기지 않음 · 화면 한 줄 없음', !('docRequests' in old) && requestSummary(old, today) === null && pendingDocKeys(old, today).size === 0)
}

/* U D-518 서류 단계 */
{
  let r = base()
  r = withDocument(r, 'businessRegistration', { received: true, fileName: '사업자등록증.pdf' })
  r = withDocument(r, 'corporateRegistry', { received: true, fileName: '등기부.pdf' })
  r = { ...r, factInbox: [
    { id: 'f1', key: 'establishedAt', value: '2019-03-02', source: 'businessRegistration', asOf: '', ref: 'doc:businessRegistration:1', foundAt: '2026-11-03T00:00:00Z', note: '사진 글자라 확인 필요' },
    { id: 'f2', key: 'representativeName', value: '김한솔2', source: 'businessRegistration', asOf: '', ref: 'doc:businessRegistration:1', foundAt: '2026-11-03T00:00:00Z' },
    { id: 'f3', key: 'employeeCount', value: '7', source: 'cretop', asOf: '', ref: 'cretop:x', foundAt: '2026-11-03T00:00:00Z' },
  ] }
  const counts = docReviewCounts(r)
  check('U1 칸마다 확인할 정보 — 사업자등록증 2 · 등기부 0 · 서류 표지 없는 후보(크레탑)는 안 셈', counts.get('businessRegistration') === 2 && !counts.has('corporateRegistry') && counts.size === 1, [...counts])
  const req = newDocRequest(r, { id: 'qU', title: '서류 요청 문구', text: '아래 서류를 보내 주시면 바로 검토해 드리겠습니다.\n\n1. 표준재무제표증명(최근 3년)\n   - 홈택스 › 표준재무제표증명(PDF)', today: '2026-10-31', nowIso: '2026-10-31T09:00:00.000Z' })
  const r2 = req ? withDocRequest(r, req) : r
  const sum = docShelfSummary(r2, today, new Set())
  check('U2 단계 한 줄 — 받음 2 · 확인할 정보 2(칸 1) · 손볼 것에 그 칸', sum.stages.received === 2 && sum.stages.review === 1 && sum.stages.reviewFacts === 2 && sum.review.join() === 'businessRegistration', sum.stages)
  check('U3 요청한 서류(아직 안 옴 · 서류함 칸이 있는 것)는 요청함으로 셈', !!req && sum.stages.requested === pendingDocKeys(r2, today).size && sum.stages.requested >= 1, { requested: sum.stages.requested, keys: [...pendingDocKeys(r2, today).keys()] })
  const none = docShelfSummary(base(), today, new Set())
  check('U4 빈 업체 — 받음 0 · 요청함 0 · 확인할 정보 0', none.stages.received === 0 && none.stages.requested === 0 && none.review.length === 0)
}

/* F D-519 처음 시작 */
{
  const fresh = base({ id: 'n1', createdAt: '2026-11-02T00:00:00Z' })
  const todo = (over: Partial<JournalEntry>): JournalEntry => ({ id: 'j', workspaceId: null, ownerId: null, entryDate: today, entryType: 'note', content: 'x', clientId: null, projectId: null, serviceKey: null, dueDate: '', pinned: false, completed: false, completedAt: null, createdAt: '', updatedAt: '', ...over })
  const s0 = firstUseSteps({ clients: [], journal: [], ideas: 0, marketing: true })
  check('F1 업체 0곳 — 네 단계 · 다음 = 첫 업체 등록(새 업체 창) · 오늘 한 줄은 띄우지 않음(빈 화면 안내가 대신)', s0.length === 4 && firstUseNext(s0)?.key === 'client' && firstUseNext(s0)?.href === '/ops/clients?new=1' && !firstUseVisible(s0, [], today))
  const s1 = firstUseSteps({ clients: [fresh], journal: [], ideas: 0, marketing: true })
  check('F2 첫 업체만 — 다음 = 서류 올리기 · 그 업체 서류함으로 · 띄움', firstUseNext(s1)?.key === 'doc' && firstUseNext(s1)?.href === '/ops/clients/n1?tab=docs' && firstUseVisible(s1, [fresh], today))
  const withDoc = withDocument(fresh, 'businessRegistration', { received: true })
  const s2 = firstUseSteps({ clients: [withDoc], journal: [todo({ entryType: 'call', clientId: 'n1' })], ideas: 0, marketing: true })
  check('F3 서류 하나 — 다음 = 맞춤 추천 · 할 일(통화 기록은 할 일 아님) · 맞춤 추천 탭으로', firstUseNext(s2)?.key === 'todo' && firstUseNext(s2)?.href === '/ops/clients/n1?tab=smart')
  const s3 = firstUseSteps({ clients: [withDoc], journal: [todo({ entryType: 'follow_up', clientId: 'n1', dueDate: '2026-11-05' })], ideas: 0, marketing: true })
  check('F4 할 일 하나 — 다음 = 첫 콘텐츠(마케팅) · 새 계정(30일 안)이면 띄움', firstUseNext(s3)?.key === 'content' && firstUseVisible(s3, [withDoc], today) && isNewAccount([withDoc], today))
  const old = { ...withDoc, createdAt: '2026-08-01T00:00:00Z' }
  check('F5 오래 써 온 계정 — 첫 콘텐츠만 남았으면 띄우지 않음(매일 조르지 않게)', !isNewAccount([old], today) && !firstUseVisible(s3, [old], today))
  const many = [1, 2, 3, 4].map((i) => ({ ...withDoc, id: `m${i}` }))
  check('F5b 업체가 4곳 넘으면(이미 쓰는 계정) — 첫 콘텐츠만 남았어도 띄우지 않음', !isNewAccount(many, today) && !firstUseVisible(s3, many, today))
  const s4 = firstUseSteps({ clients: [withDoc], journal: [todo({ entryType: 'follow_up', clientId: 'n1' })], ideas: 2, marketing: true })
  check('F6 다 함 — 다음 없음 · 안 띄움', firstUseNext(s4) === null && !firstUseVisible(s4, [withDoc], today))
  const s5 = firstUseSteps({ clients: [withDoc], journal: [todo({ entryType: 'follow_up', clientId: 'n1' })], ideas: 0, marketing: false })
  check('F7 마케팅이 닫힌 계정(팀장) — 세 단계 · 다 했으면 안 띄움', s5.length === 3 && firstUseNext(s5) === null && !firstUseVisible(s5, [withDoc], today))
}

console.log(`\ndocRequests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
