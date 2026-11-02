/**
 * D-497 오늘 대화창 — 업체 찾기 · 질문 종류 · 질문 세 줄 · 자료 묶기 · 규칙 답 · 쓰면서 배우기.
 *   npm run test:homeask
 */
import { ASSIST_PRESETS } from '../aiAssist/presets'
import { RefBook, type AssistBundle } from '../aiAssist/context'
import { DOWN_REASONS, EMPTY_FEEDBACK, docRequestText, isDocListItem, findClients, homeSuggestions, intentsOf, learnAliases, mergeBundles, nearNames, normName, parseFeedback, planChips, planSection, preferenceRules, priorTurnsSection, ruleAnswer, withFeedback, type PlanRunLite } from '../homeAsk/homeAsk'
import { runScenarios } from '../scenarios'
import { newFacts, talkAnswers } from '../homeAsk/homeTalk'
import { openedBy } from '../homeAsk/homeAsk'
import { scenarioAnswer, withScenarioAnswer } from '../scenarioFit'
import { parseTurns } from '../homeAsk/homeAskStore'
import { ASSISTS } from '../../../api/_ai/assists.js'
import { aiFactLines, defaultDocQuestion, docCompanyOf, previewWithDocs, readFactsLines, type ChatDoc } from '../homeAsk/homeDocs'
import { NEW_DOCS_TTL_MS, clearNewClientDocs, handNewClientDocs, peekNewClientDocs } from '../docHandoff'
import { normalizeClientOps } from '../clientOpsService'
import { DIAG_REQUEST_TTL_MS, clearDiagnosisRequest, diagnosisRequested, requestDiagnosis } from '../openDiagnosis'
import { guessNewClientFromDocs } from '../newClientFromDocs'
import { findClientForCretop } from '../salesCretop'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed += 1
  else failed += 1
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond || detail === undefined ? '' : ' ' + JSON.stringify(detail).slice(0, 300)}`)
}

const C = [
  { id: 'a', companyName: '㈜한솔테크' },
  { id: 'b', companyName: '한솔테크솔루션 주식회사' },
  { id: 'c', companyName: '다움에너지' },
  { id: 'd', companyName: '(주)선한식품' },
  { id: 'e', companyName: '선한물산' },
  { id: 'f', companyName: '미래정밀', archivedAt: '2026-01-01' },
]

// 1. 업체 찾기
check('이름 견주기: ㈜ · (주) · 주식회사 · 띄어쓰기 무시', normName('㈜ 한솔 테크') === '한솔테크' && normName('한솔테크솔루션 주식회사') === '한솔테크솔루션' && normName('(주)선한식품') === '선한식품')
check('전체 이름 — "오늘 다움에너지 1차 미팅" → 다움에너지', JSON.stringify(findClients('오늘 다움에너지 1차 미팅 가는데 정책자금 어떻게 제안할까', C)) === '["c"]')
check('긴 이름 안의 짧은 이름은 빼기 — "한솔테크솔루션" 은 b 만', JSON.stringify(findClients('한솔테크솔루션 서류 정리', C)) === '["b"]')
check('두 업체 — 나온 순서대로', JSON.stringify(findClients('선한식품이랑 다움에너지 비교', C)) === '["d","c"]')
check('앞부분만 쓴 이름 — "다움" 으로 시작하는 업체가 하나뿐이면 그 업체', JSON.stringify(findClients('다움 미팅 준비', C)) === '["c"]')
check('앞부분이 두 업체에 걸리면(선한식품 · 선한물산) 고르지 않음', findClients('선한 미팅 준비해 줘', C).length === 0)
check('흔한 말(오늘 · 미팅 · 정책자금)은 업체 이름으로 읽지 않음', findClients('오늘 미팅 정책자금 정리', C).length === 0)
check('조사 떼기 — "다움에게" 도 다움에너지', JSON.stringify(findClients('다움에게 뭐라고 말할까', C)) === '["c"]')
check('배운 별명 — "솔루션" → b', JSON.stringify(findClients('솔루션 쪽 서류', C, { 솔루션: 'b' })) === '["b"]')
check('없는 업체를 가리키는 별명은 버림', findClients('없는곳 미팅', C, { 없는곳: 'zz' }).length === 0)
check('보관한 업체도 이름으로 찾음(예전 업체를 물을 수 있게)', JSON.stringify(findClients('미래정밀 예전 계약', C)) === '["f"]')
check('최대 3곳', findClients('한솔테크 다움에너지 선한식품 선한물산', C).length === 3)
check('별명 배우기 — 질문 속 그 업체 이름의 일부만', JSON.stringify(learnAliases('솔루션 쪽 미팅 준비', '한솔테크솔루션 주식회사')) === '["솔루션"]' && learnAliases('오늘 미팅', '다움에너지').length === 0)
check('비슷한 이름 — "다음에너지" → 다움에너지', nearNames('다음에너지 미팅', C).includes('다움에너지'))

// 2. 질문 종류
const it = intentsOf('오늘 다움에너지 1차 미팅 가는데 사업자등록증 받았어, 정책자금 어떻게 제안할까')
check('질문 종류: 미팅 · 정책자금 · 서류 · 오늘', it.includes('meeting') && it.includes('policy') && it.includes('docs') && it.includes('today'), it)
check('질문 종류: 연구소 · 절세 · 돈', intentsOf('연구소 세우면 세액공제').includes('lab') && intentsOf('가지급금 정리 절세').includes('tax') && intentsOf('받을 돈 미수 정리').includes('money'))

// 3. 질문 세 줄
const s1 = homeSuggestions({
  appointments: [{ clientId: 'c', clientName: '다움에너지', daysLeft: 0 }],
  freshDocs: [{ clientId: 'c', clientName: '다움에너지' }, { clientId: 'd', clientName: '선한식품' }],
  recos: [{ clientId: 'a', clientName: '한솔테크', labels: ['정책자금', '고용지원금', '연구소'] }],
  overdueMoney: 2,
  hasTodos: true,
})
check('질문 세 줄: 오늘 약속 → 새 서류(다른 업체) → 추천 많은 업체', s1.length === 3 && s1[0].icon === 'meeting' && /오늘 다움에너지 미팅/.test(s1[0].text) && s1[1].icon === 'docs' && /선한식품/.test(s1[1].text) && s1[2].icon === 'reco' && /정책자금 · 고용지원금/.test(s1[2].text), s1)
const s2 = homeSuggestions({ appointments: [], freshDocs: [], recos: [], overdueMoney: 3, hasTodos: false })
check('자료가 없으면 오늘 · 돈 · 연락으로 채움(늘 세 줄)', s2.length === 3 && s2.map((x) => x.icon).join() === 'today,money,call', s2)
check('지난 약속(어제)은 미팅 질문으로 안 씀', homeSuggestions({ appointments: [{ clientId: 'c', clientName: '다움에너지', daysLeft: -1 }], freshDocs: [], recos: [], overdueMoney: 0, hasTodos: true })[0].icon !== 'meeting')

// 4. 자료 묶기 — ref 다시 붙이기 · 같은 이름 칸 합치기 · 12칸
function bundle(name: string, ids: string[]): AssistBundle {
  const book = new RefBook()
  return { links: book.links, ids: book.ids, context: { title: name, today: '11/2', sections: [{ name: '회사', rows: ids.map((id) => ({ ref: book.client({ id }), 업체: id })) }, { name: '서류함', rows: [{ 서류: `${name} 서류` }] }], facts: [`${name} 사실`] } }
}
const merged = mergeBundles(
  [
    { bundle: bundle('A', ['a']), rename: (n) => `물어본 업체 · ${n}` },
    { bundle: bundle('B', ['b']), rename: (n) => `물어본 업체 · ${n}` },
    { bundle: bundle('T', ['b', 'c']), take: (n) => n === '회사', rename: (n) => `오늘 · ${n}` },
  ],
  { title: '오늘 대화창', today: '11/2', purpose: '시험' },
)
const sec = merged.context.sections
check('같은 이름 칸은 합침(물어본 업체가 둘이어도 칸 수 그대로)', sec.length === 3 && sec[0].name === '물어본 업체 · 회사' && sec[0].rows.length === 2 && sec[1].name === '물어본 업체 · 서류함' && sec[1].rows.length === 2, sec.map((x) => `${x.name}:${x.rows.length}`))
check('ref 다시 붙이기 — 같은 업체는 같은 번호 · 주소도 따라옴', sec[0].rows[0].ref === 'c1' && sec[0].rows[1].ref === 'c2' && sec[2].rows[0].ref === 'c2' && sec[2].rows[1].ref === 'c3' && merged.links.c2 === '/ops/clients/b', merged.links)
check('take 로 고른 칸만(오늘 · 서류함 빠짐) · 사실은 겹치지 않게', !sec.some((x) => x.name === '오늘 · 서류함') && merged.context.facts?.length === 3)
const many = mergeBundles([{ bundle: { links: {}, context: { title: 'x', today: '', sections: Array.from({ length: 15 }, (_, i) => ({ name: `칸${i}`, rows: [{ a: i }] })) } } }], { title: 'x', today: '', purpose: '' })
check('서버가 읽는 12칸까지만(앞 칸이 먼저)', many.context.sections.length === 12 && many.context.sections[0].name === '칸0')
check('앞선 대화 — 답이 있는 것만 최근 3번', priorTurnsSection([{ q: '1', headline: 'a' }, { q: '2' }, { q: '3', headline: 'c' }, { q: '4', headline: 'd' }, { q: '5', headline: 'e' }])?.rows.length === 3 && priorTurnsSection([{ q: 'x' }]) === null)

// 5. 규칙 답 — 판정 그대로 · 질문 모듈 먼저 · AI 라고 안 씀
const pick = (key: string, label: string, tone = 'good', missing: string[] = []) => ({ key, label, tone, toneLabel: tone === 'good' ? '가능성 높음' : '검토해 볼 만함', headline: `${label} 맞음`, amount: key === 'employment' ? '1,440만원' : '', missing, openPath: '/x' })
const r1 = ruleAnswer({
  question: '다움에너지 미팅 정책자금 어떻게',
  intents: ['meeting', 'policy'],
  focus: [{ id: 'c', name: '다움에너지', picks: [pick('employment', '고용지원금'), pick('policy-funding', '정책자금', 'maybe', ['매출', '재무제표']), pick('labcare', '연구소')], missingDocs: ['재무제표', '4대보험 명부'] }],
  today: { overdue: 0, todos: [], hardDue: [], appointments: [] },
  nearNames: [],
})
check('규칙 답: 질문에 나온 정책자금이 맨 앞 · OS 금액 그대로', r1.items[0].tag === '정책자금' && r1.items.find((x) => x.tag === '고용지원금')?.amount === '1,440만원', r1.items.map((x) => x.title))
check('규칙 답: 미팅이면 확인할 것(모자란 것) · 받아 올 서류', r1.items.some((x) => /미팅에서 확인할 것/.test(x.title) && (x.outline ?? []).includes('매출')) && r1.items.some((x) => /받아 올 서류/.test(x.title) && (x.outline ?? []).includes('4대보험 명부')))
check('규칙 답: 업체 링크(맞춤 추천) · AI 라는 말 없음', r1.links.c1 === '/ops/clients/c?tab=smart' && !/AI/.test(JSON.stringify(r1)))
const r2 = ruleAnswer({ question: '다음에너지 미팅', intents: ['meeting'], focus: [], today: { overdue: 2, todos: ['전화'], hardDue: [], appointments: [] }, nearNames: ['다움에너지'] })
check('규칙 답: 못 찾은 이름 → 비슷한 업체를 되물음', /혹시 다움에너지/.test(r2.headline), r2.headline)
const r3 = ruleAnswer({ question: '오늘 뭐부터', intents: ['today'], focus: [], today: { overdue: 2, todos: ['한솔 전화'], hardDue: ['선한식품 · 신청 마감'], appointments: ['다움에너지 — 2차 미팅 (오늘)'] }, nearNames: [] })
check('규칙 답: 업체가 없으면 약속 · 기한 · 할 일 · 밀린 할 일 수', r3.items.length === 3 && r3.items[0].tag === '약속' && /밀린 할 일 2건/.test(r3.headline), r3)

// 6. 쓰면서 배우기
let fb = EMPTY_FEEDBACK
fb = withFeedback(fb, { up: false, reason: 'tooLong' })
fb = withFeedback(fb, { up: true, q: '다움에너지 미팅', headline: '정책자금부터' })
const rules = preferenceRules(fb)
check('👎 너무 길어요 → 짧게 규칙 · 👍 → 예시', rules.some((r) => /너무 길다/.test(r)) && rules.some((r) => /좋다고 한 답의 예/.test(r) && /정책자금부터/.test(r)) && !rules.some((r) => /구체적으로/.test(r)))
check('평가 저장 · 다시 읽기(모르는 값 버림 · 예시 최근 5개)', JSON.stringify(parseFeedback(JSON.stringify(fb))) === JSON.stringify(fb) && parseFeedback('{"down":{"tooLong":"x","hack":3},"liked":[1,{"q":"a","headline":"b"}]}').liked.length === 1 && parseFeedback('깨진').up === 0)
check('까닭 네 가지', DOWN_REASONS.map((r) => r.key).join() === 'wrongClient,wrongFact,tooLong,vague')

// 7. 저장된 대화 — 묻는 중에 닫은 것은 다시 묻기로
const turns = parseTurns(JSON.stringify([{ id: 'h1', at: 'x', q: '질문', clientIds: [], status: 'pending' }, { id: 'h2', at: 'x', q: '둘', clientIds: [], status: 'ai', answer: { headline: 'a', items: [] } }, { bad: 1 }]))
check('저장된 대화: 묻는 중이던 것은 "다시 물어봐 주세요" · 깨진 줄은 버림', turns.length === 2 && turns[0].status === 'rule' && /다시 물어봐/.test(turns[0].why ?? '') && turns[1].status === 'ai')

// 8. 화면 이름표 = 서버 지시문(같은 id · page · label)
const p = ASSIST_PRESETS.find((x) => x.id === 'home.chat')
const sv = (ASSISTS as Record<string, { page: string; label: string; instruction: string[] }>)['home.chat']
check('home.chat — 화면 · 서버 같은 page · label', !!p && !!sv && p.page === sv.page && p.label === sv.label && p.page === 'today', { p, sv: sv && { page: sv.page, label: sv.label } })
check('home.chat 지시문 — OS 판정 그대로 · 미팅 준비 순서 · 지어내지 않기', !!sv && /그대로 옮기고/.test(sv.instruction.join(' ')) && /먼저 제안할 것/.test(sv.instruction.join(' ')) && /추측하지 말고/.test(sv.instruction.join(' ')))

// 9. D-498 대화창 서류 — 회사 찾기 · 보낼 칸 거르기 · 새 업체 넘기기 · 임시 판정(저장 안 함)
{
  const recs = [normalizeClientOps({ id: 'm', companyName: '미래바이오랩', businessNumber: '124-81-00998' } as never), normalizeClientOps({ id: 'h', companyName: '한솔테크(주)' } as never)]
  const bizText = ['사업자등록증', '(법인사업자)', '등록번호 : 124-81-00998', '법인명(단체명) : 미래바이오랩', '대표자 : 이대표', '개업연월일 : 2023 년 01 월 10 일', '업태 : 제조업', '종목 : 바이오 시약'].join('\n')
  const g = guessNewClientFromDocs([{ fileName: '사업자등록증.txt', text: bizText, method: 'text' }]).guess
  const c1 = docCompanyOf(g, recs, findClientForCretop)
  check('D-498 서류의 회사 — 번호로 등록된 업체(미래바이오랩)', c1?.clientId === 'm' && c1.name === '미래바이오랩', c1)
  const g2 = guessNewClientFromDocs([{ fileName: '새봄.txt', text: bizText.replace('124-81-00998', '214-86-12303').replace('미래바이오랩', '새봄식품'), method: 'text' }]).guess
  const c2 = docCompanyOf(g2, recs, findClientForCretop)
  check('D-498 등록 안 된 회사 → clientId 없음 · 서류의 이름', c2?.clientId === null && c2.name === '새봄식품', c2)
  check('D-498 회사를 못 찾은 서류 → null', docCompanyOf({}, recs, findClientForCretop) === null)
  check('D-498 서류만 보낼 때 묻는 말', /사업자등록증 · 재무제표 받았어/.test(defaultDocQuestion(['사업자등록증', '재무제표', '사업자등록증', ''])) && /이 서류로/.test(defaultDocQuestion([''])))
  const summary = { entered: [{ key: 'representativeName', label: '대표자', display: '이대표', fileName: 'a' }, { key: 'businessNumber', label: '사업자등록번호', display: '124-81-00998', fileName: 'a' }, { key: 'establishedAt', label: '설립일', display: '2023-01-10', fileName: 'a' }, { key: 'businessCategory', label: '업태', display: '제조업', fileName: 'a' }, { key: 'businessAddress', label: '주소', display: '경기도 파주시', fileName: 'a' }], flagged: [{ key: 'representativeBirth', label: '대표 생년월일', display: '1980-01-01', fileName: 'a', note: '' }] }
  const ai = aiFactLines(summary)
  check('D-498 AI 에 보내는 읽은 것 — 이름 · 번호 · 주소 · 생년월일 빼고(설립일 · 업태만)', ai.length === 2 && ai.some((l) => l.includes('설립일')) && ai.some((l) => l.includes('업태')) && !ai.join().includes('이대표') && !ai.join().includes('124-81'), ai)
  check('D-498 화면에 보이는 읽은 것(이 기기 안) — 전부 · 확인 필요 표시', readFactsLines(summary).length === 6 && readFactsLines(summary).some((l) => /확인 필요/.test(l)))
  const f = { file: new File(['x'], 'a.txt'), text: 'x', method: 'text' as const }
  handNewClientDocs([f])
  check('D-498 새 업체 넘기기 — 등록 창이 봐도 남아 있음(두 번 그려져도)', peekNewClientDocs().length === 1 && peekNewClientDocs().length === 1)
  check('D-498 넘긴 지 2분 넘으면 안 받음(다른 길로 연 등록 창에 옛 서류가 끼지 않게)', peekNewClientDocs(Date.now() + NEW_DOCS_TTL_MS + 1000).length === 0)
  clearNewClientDocs()
  check('D-498 등록하면 지움', peekNewClientDocs().length === 0)
  const base = normalizeClientOps({ id: 'chat_new', companyName: '미래바이오랩' } as never)
  const doc: ChatDoc = { id: 'd1', file: new File([bizText], '사업자등록증.txt', { type: 'text/plain' }), status: 'done', text: bizText, method: 'text', label: '사업자등록증' }
  const prev = await previewWithDocs(base, [doc], { now: '2026-11-02T00:00:00Z', today: '2026-11-02', makeId: () => Math.random().toString(36).slice(2) })
  check('D-498 임시 판정 — 서류 칸 받음 · 읽은 값(설립일 · 업태) · 원래 기록은 그대로', prev.record.documents.businessRegistration?.received === true && prev.summary.entered.some((e) => e.key === 'establishedAt') && base.documents.businessRegistration?.received !== true, prev.summary.entered.map((e) => e.key))
}

// 10. D-499 서류 요청 문구 · 서류 목록 항목 알아보기
{
  const t = docRequestText('한솔테크(주)', ['재무제표 3년', '재무제표 3년', '국세 납세증명서 — 확인', ''])
  check('D-499 요청 문구 — 업체 이름 · 서류 줄(겹치면 한 번 · 끝의 "— 확인" 뺌)', /한솔테크\(주\) 상담 준비/.test(t) && (t.match(/- 재무제표 3년/g) ?? []).length === 1 && /- 국세 납세증명서$/m.test(t), t)
  check('D-499 서류가 없으면 빈 글', docRequestText('x', []) === '')
  check('D-499 받아 올 서류 항목만(목록이 있을 때)', isDocListItem('받아 올 서류', ['a']) && isDocListItem('한솔 · 받아 올 서류', ['a']) && !isDocListItem('받아 올 서류', []) && !isDocListItem('첫마디', ['a']))
}

// 11. D-499 [맞춤 진단서] 한 번 — 그 업체만 · 30초 · 닫으면 지움
{
  requestDiagnosis('cli_a')
  check('D-499 진단서 열기 요청 — 그 업체에만', diagnosisRequested('cli_a') && !diagnosisRequested('cli_b'))
  check('D-499 30초 지나면 안 염(나중에 그 업체를 열어도 진단서가 저절로 뜨지 않게)', !diagnosisRequested('cli_a', Date.now() + DIAG_REQUEST_TTL_MS + 1000))
  clearDiagnosisRequest()
  check('D-499 닫으면 지움', !diagnosisRequested('cli_a'))
}

// 12. D-501 답 아래 '상황 예시로 바로 설계' — 맞는 상황 · 결과 나온 것만 · 질문에 나온 모듈 먼저 · 최대 3 · 임시 업체 뺌
{
  const run = (id: string, module: string, kind: PlanRunLite['fit']['kind'], state: PlanRunLite['state'], path = `/tools/${module}?client=cli_a&preset=${id}`): PlanRunLite => ({ id, module, moduleLabel: module, title: `상황 ${id}`, amount: id === 'e1' ? '연 1,550만 원' : '', headline: `결과 ${id}`, openPath: path, state, fit: { kind } })
  const runs = [run('t1', 'tax', 'fit', 'ready'), run('e1', 'employment', 'fit', 'partial'), run('l1', 'labcare', 'ask', 'ready'), run('p1', 'policy-funding', 'fit', 'need'), run('s1', 'startup-tax', 'no', 'ready'), run('p2', 'policy-funding', 'fit', 'ready'), run('x1', 'tax', 'fit', 'ready', '/tools/tax?client=chat_new&preset=x1')]
  const plain = planChips(runs, [])
  check('D-501 맞는 상황 · 결과 나온 것만(물어볼 것 · 안 맞음 · 받으면 설계 · 임시 업체 뺌) · 최대 3', plain.map((p) => p.id).join(',') === 't1,e1,p2', plain.map((p) => p.id))
  const pol = planChips(runs, ['policy'])
  check('D-501 정책자금을 물으면 정책자금 상황이 먼저', pol[0]?.id === 'p2' && pol.length === 3, pol.map((p) => p.id))
  check('D-501 단추 주소는 모듈 화면 그대로 · 금액은 엔진 값 그대로', plain[1].path === '/tools/employment?client=cli_a&preset=e1' && plain[1].amount === '연 1,550만 원')
  const sec = planSection(plain, '한솔테크(주)')
  check('D-501 AI 자료 칸 — 상황 · 모듈 · 결과 · 금액(없으면 금액 없음)', !!sec && sec.rows.length === 3 && sec.rows[0].금액 === '금액 없음' && sec.rows[1].금액 === '연 1,550만 원' && sec.name.includes('한솔테크(주)'))
  check('D-501 맞는 상황이 없으면 칸도 없음', planSection([], 'x') === null && planChips([run('a', 'tax', 'no', 'ready')], []).length === 0)
  // 실제 엔진 — 매출 · 직원 · 업력이 있는 업체는 맞는 상황이 하나 이상 · 모듈 주소에 업체 id
  const rec = normalizeClientOps({ id: 'cli_plan', companyName: '플랜테크', businessNumber: '123-45-67890', establishedAt: '2019-03-02', employeeCount: '12명', industry: '소프트웨어 개발', businessCategory: '정보통신업', address: '서울특별시 강남구 테헤란로 1', annualRevenue: '3500000000' } as Parameters<typeof normalizeClientOps>[0])
  const real = planChips(runScenarios(rec, '2026-11-02', () => true, true) as unknown as PlanRunLite[], ['meeting'])
  check('D-501 실제 엔진 — 맞는 상황이 나오고 주소에 그 업체', real.length > 0 && real.every((p) => p.path.includes('cli_plan')), real.map((p) => `${p.module}:${p.title}`))
}

// 13. D-502 말한 업체 사정 → 상황 질문의 답(규칙) — 사실 · 없음 · 가정 · 안 읽을 말
{
  const ans = (t: string) => talkAnswers(t).map((a) => `${a.key}:${a.a}:${a.mode}`).sort().join(',')
  check('D-502 "청년 2명 뽑는대, 설비도 살 계획이래" → 청년 채용 있음 · 설비 있음(사실)', ans('한솔테크 대표님이 내년에 청년 2명 뽑는대, 설비도 살 계획이래') === 'facility:yes:fact,hireYouth:yes:fact', ans('한솔테크 대표님이 내년에 청년 2명 뽑는대, 설비도 살 계획이래'))
  check('D-502 "청년 채용 계획은 없대" → 없음', ans('청년 채용 계획은 없대') === 'hireYouth:no:fact')
  check('D-502 "청년 2명 채용하면 얼마 받아?" → 가정(기록하자고 안 함)', ans('청년 2명 채용하면 얼마 받아?') === 'hireYouth:yes:if')
  check('D-502 가지급금 있어 / 없어', ans('가지급금이 2억 정도 있어') === 'loan:yes:fact' && ans('가지급금은 없어요') === 'loan:no:fact')
  check('D-502 "청년 안 뽑고 경력직만 뽑는대" → 청년 없음(마디 나누기)', ans('청년 안 뽑고 경력직만 뽑는대') === 'hireYouth:no:fact', ans('청년 안 뽑고 경력직만 뽑는대'))
  check('D-502 연구원 · 자녀 지분 · 정년 앞둔 직원 · 매출 급감 · 재택', ans('연구원 3명 있어') === 'researchStaff:yes:fact' && ans('아들에게 지분 넘길 생각이래') === 'succession:yes:fact' && ans('정년 앞둔 직원이 2명이야') === 'retireKeep:yes:fact' && ans('올해 매출이 반토막 났어') === 'salesDrop:yes:fact' && ans('재택 근무 도입한대') === 'flexWork:yes:fact')
  check('D-502 안 읽을 말 — 매출 늘었어 · 청년 직원이 3명 있어(지금 직원 ≠ 채용 계획) · 법인 전환 검토 중 · 미팅 잘 했어', ans('매출이 작년보다 많이 늘었어') === '' && ans('청년 직원이 3명 있어') === '' && ans('법인 전환 검토 중이야') === '' && ans('오늘 미팅 잘 했어') === '' && ans('한솔테크 1차 미팅 가는데 정책자금 어떻게 제안할까?') === '')
  check('D-502 고쳐 말하면 마지막 말 — "청년 뽑는대. 아 아니다 청년은 안 뽑는대"', ans('청년 뽑는대. 아 아니다 청년은 안 뽑는대') === 'hireYouth:no:fact')
  const rec0 = normalizeClientOps({ id: 'cli_talk', companyName: '말테크', establishedAt: '2019-03-02', employeeCount: '12명', industry: '소프트웨어 개발', address: '서울특별시 강남구 테헤란로 1', annualRevenue: '3500000000' } as Parameters<typeof normalizeClientOps>[0])
  const stored = withScenarioAnswer(rec0, 'hireYouth', 'yes', '2026-11-02T00:00:00Z')
  const facts = newFacts(talkAnswers('청년 뽑는대, 가지급금도 있어'), (k) => scenarioAnswer(stored, k))
  check('D-502 이미 같은 답이 적힌 사정은 다시 기록하자고 안 함 · 가정은 기록 대상 아님', facts.map((f) => f.key).join(',') === 'loan' && newFacts(talkAnswers('청년 뽑으면 얼마?'), () => null).length === 0)
  // 실제 엔진 — 청년 채용 '예' 를 넣으면 전에 물어보던 상황이 맞음으로 열린다
  const before = runScenarios(rec0, '2026-11-02', () => true, true) as unknown as PlanRunLite[]
  const after = runScenarios(withScenarioAnswer(rec0, 'hireYouth', 'yes', '2026-11-02T00:00:00Z'), '2026-11-02', () => true, true) as unknown as PlanRunLite[]
  const opened = openedBy(before, after, 'talk')
  const chips = planChips(after, [], 3, 'chat_new', opened)
  check('D-502 실제 엔진 — 청년 채용 있음 → 새로 맞는 상황이 생기고 단추 맨 앞(방금 말한 것)', opened.size > 0 && chips[0]?.tag === 'talk' && chips[0].module === 'employment', { opened: [...opened.keys()], chips: chips.map((c) => `${c.module}:${c.tag ?? ''}`) })
}

console.log(`\nhomeAsk: ${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
