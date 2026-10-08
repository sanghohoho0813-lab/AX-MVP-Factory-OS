/**
 * 기업인증 Core 시험 (D-170) — 실행: npm run test:cert
 *  - 테스트 업체 5종(업력 짧은 스타트업 · 연구소/특허 기술기업 · 업력 긴 서비스 · 제조 B2B · 정보 거의 없는 신규)마다 추천이 합리적으로 다르다
 *  - 준비도는 5단계 + 추가 확인 필요뿐(퍼센트 · 점수 없음) · 근거가 늘 붙는다
 *  - 공식 점수(650/700 · 600/700)는 규칙 데이터에만 · 자체 판정과 섞지 않는다
 *  - 모르는 값은 추측하지 않는다 · 실사 답변 초안은 근거 없으면 '대표 확인 필요'
 *  - Core 는 OS 를 import 하지 않는다(추출 가능)
 *  - 어댑터: 업체 기록(인증서 칸 · 서류함 · 사실 창고) → 맥락
 */
import { assessAll, assessInnobiz, assessMainbiz, assessVenture, assessLab, labResearchersNeeded } from '../core/assess'
import { buildRoadmap } from '../core/roadmap'
import { runSelfCheck } from '../core/selfCheck'
import { inspectionCards, mockInspection } from '../core/inspection'
import { explainFor } from '../core/explain'
import { READINESS_LABEL, type CertificationClientContext, type CertificationAssessment } from '../core/types'
import { CERT_RULES, rulesStale } from '../rules/officialRules'
import { INNOBIZ_CHECK, INNOBIZ_INSPECTION } from '../innobiz/innobizCheck'
import { MAINBIZ_CHECK } from '../mainbiz/mainbizCheck'
import { isoConsultSummary } from '../iso/isoAdvice'
import { certContextOf, heldCertifications, industryGroupOf, normalizeCertProfile } from '../integration/clientContext'
import { normalizeClientOps } from '../../services/clientOpsService'
import { completionProblems, emptyLifecycle, normalizeLifecycle, validUntilByYears, withCertStatus, withCompletion } from '../core/lifecycle'
import { renewalDeadlines, renewalPlan } from '../core/renewal'
import { nextAfterCertified } from '../core/nextAfter'
import { preInspectionSummary, preInspectionText } from '../core/preInspection'
import { basisFor } from '../core/basis'
import { ventureRndRatio } from '../rules/officialRules'
import { labcareFactsOf } from '../integration/labcareAdapter'
import { legacyVentureFactsOf } from '../integration/legacyConsulting'
import { factPatchOf, withCertCompletion } from '../integration/useCertData'
import { factCandidatesFromDocText } from '../../services/docFacts'
import { withFactCandidates, withFactDecisions } from '../../services/customerFacts'
import { buildInspectionPackage, inspectionPackageText, ownerKey, ownerQuestionMessage } from '../core/inspectionPackage'
import { BANNED_WORDS } from '../core/answerGuide'
import { buildSubmitGate, gateFirst, gateRows, missingDocsRequest, submissionDocs } from '../core/submitGate'
import { buildVenturePack, VENTURE_OWNER_SECTIONS, VENTURE_REVIEWED_KEY, ventureProgress, ventureRoutes, ventureSubmitCheck } from '../core/venturePack'
import { buildClientSummary, clientSummaryText } from '../core/clientSummary'
import { handoffText, HANDOFF_RULES, inspectionHandoff, ventureHandoff } from '../core/handoff'
import { companyFitLine } from '../core/explain'
import { INNOBIZ_BANK } from '../innobiz/innobizGuides'
import { MAINBIZ_BANK } from '../mainbiz/mainbizGuides'
import { RULE_CHANGES } from '../rules/ruleChanges'
import type { BasisItem } from '../core/types'
import { FIELD_COS } from './fieldFixtures'
import { eunNeun, euroRo, iGa } from '../core/josa'
import { evidenceAsk, EVIDENCE_CLASS, evidenceClassOf } from '../rules/officialRules'
import { innobizSectorOfKsic } from '../rules/industryMap'

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) pass += 1
  else {
    fail += 1
    console.log('FAIL', name, detail === undefined ? '' : JSON.stringify(detail))
  }
}

const TODAY = '2026-10-07'
const base: CertificationClientContext = {
  companyName: '',
  entity: 'corporation',
  years: null,
  months: null,
  industryText: '',
  industryGroup: '',
  employees: null,
  size: null,
  revenue: null,
  operatingProfit: null,
  netIncome: null,
  totalAssets: null,
  totalLiabilities: null,
  rndExpense: null,
  researchUnit: null,
  researchers: null,
  patents: null,
  held: [],
  b2b: null,
  procurement: null,
  exportPlan: null,
  policyFundPlan: null,
  rndPlan: null,
  exclusionFlags: [],
  evidence: [],
  today: TODAY,
}
const ctx = (o: Partial<CertificationClientContext>): CertificationClientContext => ({ ...base, ...o })
const ev = (...ids: string[]) => ids.map((id) => ({ id, label: id, have: true }))
const by = (list: CertificationAssessment[]) => Object.fromEntries(list.map((a) => [a.key, a])) as Record<string, CertificationAssessment>

// 1. 업력 짧은 스타트업(SW · 1년 · 개발자 2명 · 특허 출원 1)
const startup = ctx({ companyName: '새싹랩', years: 1, months: 14, industryText: '소프트웨어 개발', industryGroup: 'software', employees: 4, size: 'small', revenue: 120_000_000, operatingProfit: -30_000_000, researchUnit: 'none', researchers: 2, patents: 1, rndExpense: 60_000_000, rndPlan: true, policyFundPlan: true, evidence: ev('biz_reg') })
// 2. 연구소 · 특허 기술기업(제조 · 7년 · 연구소 · 특허 3)
const tech = ctx({ companyName: '한빛정밀', years: 7, months: 88, industryText: '정밀기계 부품 제조', industryGroup: 'manufacturing', employees: 35, size: 'small', revenue: 9_000_000_000, operatingProfit: 700_000_000, netIncome: 500_000_000, totalAssets: 6_000_000_000, totalLiabilities: 2_500_000_000, researchUnit: 'lab', researchers: 4, patents: 3, rndExpense: 450_000_000, b2b: true, procurement: true, policyFundPlan: true, evidence: ev('fin3', 'biz_reg', 'lab_cert', 'patent', 'org_chart', 'biz_plan', 'rnd_records') })
// 3. 업력 긴 일반 서비스기업(12년 · 연구조직 · 특허 없음)
const service = ctx({ companyName: '정성교육컨설팅', years: 12, months: 150, industryText: '교육 서비스', industryGroup: 'service', employees: 18, size: 'small', revenue: 3_000_000_000, operatingProfit: 200_000_000, totalAssets: 1_500_000_000, totalLiabilities: 600_000_000, researchUnit: 'none', researchers: 0, patents: 0, rndExpense: 0, rndPlan: false, b2b: false, evidence: ev('fin3', 'biz_reg', 'hr_rules', 'org_chart') })
// 4. 제조 · B2B(5년 · 연구조직 모름 · 특허 0 · 납품)
const factory = ctx({ companyName: '동진산업', years: 5, months: 64, industryText: '자동차 부품 금속 가공', industryGroup: 'manufacturing', employees: 60, size: 'medium', revenue: 25_000_000_000, operatingProfit: 1_200_000_000, totalAssets: 18_000_000_000, totalLiabilities: 9_000_000_000, patents: 0, b2b: true, procurement: false, exportPlan: true, evidence: ev('fin3', 'biz_reg') })
// 5. 정보가 거의 없는 신규 상담 업체
const blank = ctx({ companyName: '처음상사' })

const S = by(assessAll(startup))
const T = by(assessAll(tech))
const V = by(assessAll(service))
const F = by(assessAll(factory))
const B = by(assessAll(blank))

check('스타트업: 이노비즈 · 메인비즈는 아직 이르다(업력 3년)', S.innobiz.recommendation === 'too_early' && S.mainbiz.recommendation === 'too_early', [S.innobiz.recommendation, S.mainbiz.recommendation])
check('스타트업: 이노비즈 이유에 가능해지는 달', /부터/.test(S.innobiz.oneLine), S.innobiz.oneLine)
check('스타트업: 연구소는 창업 3년 미만 소기업 2명 기준으로 지금 추천', S.lab.recommendation === 'now' && labResearchersNeeded(startup) === 2, [S.lab.recommendation, labResearchersNeeded(startup)])
check('스타트업: 벤처는 연구개발유형이 아니라 혁신성장유형 검토(특허 · R&D 계획) · 매우 높음까지는 아님', S.venture.recommendation === 'possible' && /혁신성장유형/.test(S.venture.oneLine) && S.venture.readiness !== 'very_high', S.venture)
const rS = buildRoadmap(assessAll(startup), startup)
check('스타트업 로드맵: 연구소 → 벤처 · 이노비즈는 나중', rS.steps[0]?.id === 'lab' && rS.steps.some((s) => s.id === 'venture') && rS.later.some((l) => l.label === '이노비즈'), rS)

check('기술기업: 연구소 보유(보유 중)', T.lab.recommendation === 'held', T.lab.recommendation)
check('기술기업: 이노비즈 지금 추천 · 준비도 높음 이상', T.innobiz.recommendation === 'now' && ['high', 'very_high'].includes(T.innobiz.readiness), [T.innobiz.recommendation, T.innobiz.readiness])
check('기술기업: 메인비즈는 우선순위 낮음(이노비즈 먼저)', T.mainbiz.recommendation === 'low_priority', T.mainbiz.recommendation)
check('기술기업: 벤처 연구개발유형 지금 추천', T.venture.recommendation === 'now' && /연구개발유형/.test(T.venture.oneLine), T.venture.oneLine)
check('기술기업: ISO 9001 검토(B2B)', T.iso9001.recommendation === 'possible')
check('기술기업: 이노비즈 특히 유용한 혜택에 보증 · 조달 · R&D', T.innobiz.benefits.length >= 3 && T.innobiz.benefits.some((b) => b.id === 'kibo') && T.innobiz.benefits.some((b) => b.id === 'procurement'), T.innobiz.benefits.map((b) => b.id))
check('기술기업: 혜택마다 왜 추천했는지 한 줄', T.innobiz.benefits.every((b) => b.why.length > 5))
const rT = buildRoadmap(assessAll(tech), tech)
check('기술기업 로드맵: 벤처 → 이노비즈 → 정책자금 → ISO 9001', rT.steps.map((s) => s.id).join() === 'venture,innobiz,policy_fund,iso9001', rT.steps.map((s) => s.id))

check('서비스기업: 이노비즈는 우선순위 낮음 · 메인비즈 추천', V.innobiz.recommendation === 'low_priority' && ['now', 'possible'].includes(V.mainbiz.recommendation), [V.innobiz.recommendation, V.mainbiz.recommendation])
check('서비스기업: ISO 14001 · 45001 굳이 필요 없음', V.iso14001.recommendation === 'not_needed' && V.iso45001.recommendation === 'not_needed')
// FV: 연구 인력도 연구개발 계획도 없는 서비스기업에 연구소를 '보완 후 추천' 하지 않는다 — 지금은 필요 없음
check('서비스기업: 연구 인력 · 연구개발 계획 없음 → 연구소는 지금 필요 없음', V.lab.recommendation === 'not_needed', V.lab)
check('연구 인력은 없지만 연구개발 계획이 있으면 → 연구소 보완 후 추천(예전 길 유지)', assessLab(ctx({ ...service, rndPlan: true })).recommendation === 'after_fix')
const rV = buildRoadmap(assessAll(service), service)
check('서비스기업 로드맵: 메인비즈가 들어 있고 이노비즈는 없다', rV.steps.some((s) => s.id === 'mainbiz') && !rV.steps.some((s) => s.id === 'innobiz'), rV.steps)

check('제조 B2B: ISO 9001 · 14001 · 45001 모두 검토', F.iso9001.recommendation === 'possible' && F.iso14001.recommendation === 'possible' && F.iso45001.recommendation === 'possible')
check('제조 B2B: 연구조직을 모르면 이노비즈는 근거에 ? 가 남는다', F.innobiz.reasons.some((r) => r.state === 'unknown' && /연구조직/.test(r.text)))
check('제조 B2B: 연구소 기준은 중기업 5명', labResearchersNeeded(factory) === 5)
check('제조 B2B: 특허 0 + 기술형 인증 → 로드맵에 특허 보강', buildRoadmap(assessAll(factory), factory).steps.some((s) => s.id === 'patent') || !['now', 'possible', 'after_fix'].includes(F.innobiz.recommendation))

check('신규(정보 없음): 이노비즈 · 메인비즈 · 벤처 · 연구소 모두 추가 확인 필요', ['innobiz', 'mainbiz', 'venture', 'lab'].every((k) => B[k].recommendation === 'need_info' && B[k].readiness === 'unknown'), ['innobiz', 'mainbiz', 'venture', 'lab'].map((k) => [k, B[k].recommendation, B[k].readiness]))
check('신규: 모자란 사실이 나열된다(추측 없음)', B.innobiz.missingFacts.length >= 2 && B.innobiz.missingFacts.some((m) => /업력/.test(m)), B.innobiz.missingFacts)
check('신규: 로드맵이 비어 있다(근거 없이 순서를 만들지 않는다)', buildRoadmap(assessAll(blank), blank).steps.length === 0)

// 다섯 업체의 추천이 서로 다르다
const sig = [S, T, V, F, B].map((x) => ['lab', 'venture', 'innobiz', 'mainbiz', 'iso9001'].map((k) => x[k].recommendation).join('/'))
check('5개 업체 추천이 모두 다르다', new Set(sig).size === 5, sig)

// 준비도 · 숫자
const all = [S, T, V, F, B].flatMap((x) => Object.values(x))
check('준비도는 5단계 + 추가 확인 필요뿐', all.every((a) => a.readiness in READINESS_LABEL))
check('판정 문구에 퍼센트 · 자체 점수 없음(매출 대비 연구개발비 비율만 예외)', all.every((a) => !/(준비도|점수)\s*\d|\d+\s*점/.test(`${a.oneLine} ${a.timing}`) && a.reasons.every((r) => !/\d+\s*점/.test(r.text))))
check('등급마다 근거가 붙는다', all.every((a) => a.reasons.length > 0))
check('공식 점수는 규칙 데이터에만 — 이노비즈 650 · 700 · B등급 / 메인비즈 600 · 700', JSON.stringify(CERT_RULES.innobiz.officialScores).includes('650') && JSON.stringify(CERT_RULES.innobiz.officialScores).includes('B등급') && JSON.stringify(CERT_RULES.mainbiz.officialScores).includes('600점') && JSON.stringify(CERT_RULES.mainbiz.officialScores).includes('700'))

// 보유 · 갱신
const heldCtx = ctx({ ...tech, held: [{ key: 'innobiz', validUntil: '2026-12-01', note: '' }] })
const heldI = assessInnobiz(heldCtx)
check('보유 이노비즈: 갱신 임박(90일 안) → 갱신 준비 · 갱신 준비 시기는 D-120(P1)', heldI.recommendation === 'held' && heldI.nextAction.kind === 'renew' && heldI.renewal?.prepareFrom === '2026-08-03', heldI)
const expired = assessAll(ctx({ ...service, held: [{ key: 'mainbiz', validUntil: '2026-09-01', note: '' }] })).find((x) => x.key === 'mainbiz')!
check('만료된 메인비즈(연장 30일도 지남): 보유 중 아님 · 새로 판정 + 이전 인증 만료(P1)', expired.recommendation !== 'held' && expired.expired === true && expired.oneLine.includes('이전 인증 만료'), expired.oneLine)

// 제외 사유 · 부채비율
check('제외 사유 → 지금은 필요 없음(이유 그대로)', assessInnobiz(ctx({ ...tech, exclusionFlags: ['체납'] })).recommendation === 'not_needed')
check('메인비즈: 완전자본잠식 → 제외', assessMainbiz(ctx({ ...service, totalAssets: 100, totalLiabilities: 200 })).reasons.some((r) => r.state === 'no' && /자본잠식/.test(r.text)))
check('메인비즈: 낱말(게임장)만으로는 제외하지 않음 — 세부 업종 확인 필요(AX)', (() => { const m = assessMainbiz(ctx({ ...service, industryText: '게임장 운영' })); return m.recommendation !== 'not_needed' && m.reasons.some((r) => r.state === 'warn' && r.text.includes('세부 업종 확인 필요')) })())
check('메인비즈: KSIC 56211(주점) 확인되면 제외(AX)', assessMainbiz(ctx({ ...service, industryText: '게임장 운영', ksic: '56211' })).recommendation === 'not_needed')
check('벤처: 창업 3년 미만은 매출 대비 비율 미적용', assessVenture(startup).reasons.some((r) => /비율 미적용/.test(r.text)))
check('연구소: 인원이 기준 미만이면 전담부서부터', /전담부서/.test(assessLab(ctx({ ...factory, researchers: 2 })).oneLine))

// 자가진단
const scT = runSelfCheck(INNOBIZ_CHECK, tech, {})
check('이노비즈 자가진단: 업체 기록으로 답을 미리 고른다(연구조직 · 특허 · 연구개발비)', ['ib_org', 'ib_ip', 'ib_rnd_cost'].every((id) => scT.items.find((i) => i.item.id === id)?.suggested && scT.items.find((i) => i.item.id === id)?.answer === 'yes'))
check('이노비즈 자가진단: 기록에 없는 것은 대표 확인 필요', scT.items.find((i) => i.item.id === 'ib_ceo')?.verdict === 'confirm')
const scT2 = runSelfCheck(INNOBIZ_CHECK, tech, { ib_records: 'yes', ib_ceo: 'yes', ib_people: 'partly', ib_quality: 'no' })
check('이노비즈 자가진단: 증빙까지 있으면 충분 · 답만 있고 증빙 없으면 추가 증빙 권장', scT2.items.find((i) => i.item.id === 'ib_records')?.verdict === 'enough' && scT2.items.find((i) => i.item.id === 'ib_quality')?.verdict === 'fix')
check('자가진단 결과: 5단계 + 실사 전 준비할 자료', scT2.readiness in READINESS_LABEL && Array.isArray(scT2.prepare))
check('자가진단: 답 \'있음\' 이어도 증빙이 없으면 \'준비 완료\' 가 아니다', runSelfCheck(INNOBIZ_CHECK, blank, Object.fromEntries(INNOBIZ_CHECK.map((i) => [i.id, 'yes']))).items.every((i) => i.verdict !== 'enough' || i.item.evidence.length === 0))
const scM = runSelfCheck(MAINBIZ_CHECK, service, {})
check('메인비즈 자가진단: 이노비즈와 문항이 다르다(같은 엔진 · 다른 규칙)', MAINBIZ_CHECK.every((m) => !INNOBIZ_CHECK.some((i) => i.id === m.id)) && scM.items.length === MAINBIZ_CHECK.length)
check('메인비즈 자가진단: 영업이익 있음 → 미리 있음', scM.items.find((i) => i.item.id === 'mb_finance')?.answer === 'yes')

// 실사 대비
const label = (id: string) => id
const cardsT = inspectionCards(INNOBIZ_INSPECTION, tech, label)
check('실사: 질문마다 의도 · 기록 · 증빙 · 초안', cardsT.every((k) => k.q.intent && Array.isArray(k.facts)) && cardsT.find((k) => k.q.id === 'q_org')?.draft?.includes('기업부설연구소'))
const cardsB = inspectionCards(INNOBIZ_INSPECTION, blank, label)
check('실사: 근거가 없으면 초안 없이 대표 확인 필요(없는 사실을 만들지 않는다)', cardsB.every((k) => k.needsOwner && k.draft === null))
const mock = mockInspection(cardsT, { q_tech: { state: 'ok' }, q_org: { state: 'ok' }, q_records: { state: 'confirm' } })
check('모의 실사: 점수 없이 5단계 + 강점 · 보완 · 대표 확인', mock.readiness in READINESS_LABEL && mock.strengths.length >= 1 && mock.ownerConfirm.length >= 1 && !('score' in mock), mock)
check('모의 실사: 아직 아무것도 안 했으면 추가 확인 필요', mockInspection(cardsT, {}).readiness === 'unknown')

// 설명
const ex = explainFor(T.innobiz, tech, '김상호 대표')
check('설명: 30초 · 카톡 · 준비서류 · 미팅 네 가지', !!ex.thirty && /김상호 대표/.test(ex.kakao) && !!ex.docRequest && /공식 기준/.test(ex.meeting))
check('설명: 이미 받은 자료는 다시 달라고 하지 않는다', !T.innobiz.missingEvidence.includes('최근 3년 재무제표') && !ex.docRequest.includes('1. 최근 3년 재무제표'))
check('설명: 조건부 혜택은 확인 필요라고 말한다', /확인/.test(ex.thirty))

// ISO 상담 요약
const iso = isoConsultSummary(factory, ['iso9001', 'iso45001'])
check('ISO 상담 요청: 업체명 · 업종 · 직원 수 · 관심 ISO · 보유 자료만', /동진산업/.test(iso) && /자동차 부품/.test(iso) && /60명/.test(iso) && /ISO 9001 · ISO 45001/.test(iso) && !/대표자|전화|사업자번호/.test(iso), iso)
check('ISO: 발급 · 자동 인증처럼 말하지 않는다', Object.values(CERT_RULES).every((r) => !/자동\s*(발급|인증)|OS\s*가\s*발급/.test(JSON.stringify(r))))

// 공식 기준 신선도
check('공식 기준: 마지막 확인 2026-10-07 · 출처 URL 이 공식 기관', Object.values(CERT_RULES).every((r) => r.checkedAt === '2026-10-07' && r.sources.every((s) => /law\.go\.kr|innobiz\.net|smes\.go\.kr|iso\.org|kab\.or\.kr|global-aci\.org/.test(s.url))))
check('공식 기준: 180일 지나면 최신 기준 확인 필요', !rulesStale(CERT_RULES.innobiz, '2026-12-01') && rulesStale(CERT_RULES.innobiz, '2027-05-01'))

// 어댑터
check('업종 대분류', industryGroupOf('소프트웨어 개발 및 공급') === 'software' && industryGroupOf('자동차 부품 제조') === 'manufacturing' && industryGroupOf('') === '')
const rec = normalizeClientOps({
  id: 'c1',
  companyName: '한빛정밀(주)',
  establishedAt: '2019-03-02',
  industry: '정밀기계 부품 제조',
  employeeCount: '35',
  customFields: [
    { id: 'f1', group: 'credential', label: '이노비즈', value: '확인번호 R-1234 · 2027-01-31까지 · 중소벤처기업부' },
    { id: 'f2', group: 'credential', label: '기업부설연구소', value: '인정번호 2021-1 · 한국산업기술진흥협회' },
  ],
} as never)
const held = heldCertifications(rec)
check('어댑터: 인증서 칸 → 보유 인증 · 유효기간', held.some((h) => h.key === 'innobiz' && h.validUntil === '2027-01-31') && held.some((h) => h.key === 'lab'), held)
const rc = certContextOf(rec, TODAY, normalizeCertProfile({ b2b: true, researchers: 4 }))
check('어댑터: 업력 · 업종 · 직원 · 연구조직(인증서 칸) · 컨설턴트가 고른 B2B', rc.years === 7 && rc.industryGroup === 'manufacturing' && rc.employees === 35 && rc.researchUnit === 'lab' && rc.b2b === true && rc.researchers === 4, rc)
check('어댑터: 연구소 인정서 증빙 = 인증서 칸으로 있음', rc.evidence.find((e) => e.id === 'lab_cert')?.have === true)
check('어댑터: 모르는 것은 null(매출 · 특허 · 조달)', rc.revenue === null && rc.patents === null && rc.procurement === null)
check('어댑터: 설정 읽기 — 이상한 값은 모름', JSON.stringify(normalizeCertProfile({ b2b: 'yes', researchers: -1, size: 'huge' })) === JSON.stringify(normalizeCertProfile({})))


/* ================= P1 ================= */
{
  // 진행 기록
  const l0 = emptyLifecycle('innobiz')
  const l1 = withCertStatus(l0, 'applied', '2026-10-01T00:00:00Z')
  check('P1 진행: 상태 바꾸면 기록 · 같은 상태면 그대로', l1.status === 'applied' && l1.history.length === 1 && withCertStatus(l1, 'applied', 'x') === l1)
  const done = withCompletion(l1, { number: ' 260101-00123 ', certifiedAt: '2026-03-15', validUntil: '2029-03-14' }, '2026-10-02T00:00:00Z')
  check('P1 완료 기록: 번호 · 인증일 · 유효기간만', done.status === 'certified' && done.number === '260101-00123' && done.certifiedAt === '2026-03-15' && done.validUntil === '2029-03-14')
  check('P1 완료 기록: 이상한 날짜는 비운다(만들지 않는다)', withCompletion(l0, { number: '', certifiedAt: '2026-13-40', validUntil: 'abc' }, 'x').certifiedAt === '' && withCompletion(l0, { number: '', certifiedAt: '2026-13-40', validUntil: 'abc' }, 'x').validUntil === '')
  check('P1 완료 기록: 인증일 없음 · 미래 · 끝날짜가 앞 → 고치라고만', completionProblems({ number: '', certifiedAt: '', validUntil: '' }, TODAY, true).join() === 'certified_missing' && completionProblems({ number: '', certifiedAt: '2027-01-01', validUntil: '' }, TODAY, true).includes('certified_in_future') && completionProblems({ number: '', certifiedAt: '2026-01-01', validUntil: '2025-12-31' }, TODAY, true).includes('valid_before_certified'))
  check('P1 완료 기록: 인증일 + 3년은 누를 때만 계산(2026-03-15 → 2029-03-14)', validUntilByYears('2026-03-15', 3) === '2029-03-14' && validUntilByYears('', 3) === '')
  check('P1 진행: 저장값 읽기 — 모르는 상태는 준비 중', normalizeLifecycle({ status: 'weird', number: 1 }, 'mainbiz').status === 'preparing' && normalizeLifecycle(JSON.parse(JSON.stringify(done)), 'innobiz').validUntil === '2029-03-14')

  // 갱신 일정 — D-120 알림 · D-90 할 일 · 만료 · 연장 기간
  const far = renewalPlan('innobiz', '2027-06-30', TODAY)!
  check('P1 갱신: 아직 멀면 유효 · 알림 D-120 · 할 일 D-90', far.phase === 'ok' && far.noticeOn === '2027-03-02' && far.todoOn === '2027-04-01', far)
  check('P1 갱신: D-120 안이면 갱신 준비 시기', renewalPlan('innobiz', '2027-01-20', TODAY)!.phase === 'notice')
  check('P1 갱신: D-90 안이면 진짜 할 일', renewalPlan('mainbiz', '2026-12-01', TODAY)!.phase === 'todo')
  const grace = renewalPlan('innobiz', '2026-09-20', TODAY)!
  check('P1 갱신: 만료 후 30일 안 = 연장 신청 가능(이노비즈 제15조①)', grace.phase === 'grace' && grace.graceUntil === '2026-10-20' && renewalDeadlines(grace, '이노비즈').length === 1 && renewalDeadlines(grace, '이노비즈')[0].hard === true)
  check('HF 갱신: 벤처 — 2026-10 판정은 지금 고시(만료 2개월 전 할 일 · 만료 후 1개월까지) · 만료가 2027-02-21 뒤면 새 기준 안내 한 줄', renewalPlan('venture', '2027-06-30', TODAY)!.todoOn === '2027-05-01' && renewalPlan('venture', '2027-06-30', TODAY)!.graceUntil === '2027-07-30' && renewalPlan('venture', '2027-06-30', TODAY)!.why.includes('2027-02-21부터는 새 기준') && !renewalPlan('venture', '2026-12-31', TODAY)!.why.includes('새 기준'))
  check('HF 갱신: 벤처 — 2027-03 판정은 새 기준(6개월 전 알림 · 150일 전 할 일 · 만료 뒤 연장 없음)', renewalPlan('venture', '2027-09-30', '2027-03-10')!.noticeOn === '2027-04-03' && renewalPlan('venture', '2027-09-30', '2027-03-10')!.todoOn === '2027-05-03' && renewalPlan('venture', '2027-09-30', '2027-03-10')!.graceUntil === '' && renewalPlan('venture', '2027-09-30', '2027-03-10')!.why.includes('140일'))
  check('P1 갱신: 연구소(유효기간 없음) · 날짜 모름 → 일정 안 만듦', renewalPlan('lab', '2027-01-01', TODAY) === null && renewalPlan('innobiz', '', TODAY) === null)
  const dl = renewalDeadlines(far, '이노비즈')
  check('P1 갱신 일정: 알림 · 할 일(todo) · 만료(hard) 세 줄', dl.length === 3 && dl[0].title.includes('갱신 준비 시기') && !dl[0].todo && dl[1].todo === true && dl[2].hard === true && dl[2].date === '2027-06-30', dl)
  check('P1 갱신 일정: 만료(연장 기간도 지남)면 만들지 않음', renewalDeadlines(renewalPlan('venture', '2025-01-01', TODAY)!, '벤처').length === 0)

  // 시나리오 A — 연구소 관리 기록이 있으면 묻지 않고 인정으로
  const labRows = [{ data: { key: 'pmsaas:clients:v1', value: [{ id: 'c1', labType: '기업부설연구소', certifiedDate: '2024-05-10', labRegistrationNumber: '2024-123', labName: '한빛연구소', researcherCount: 4 }, { id: 'c2', labType: '기업부설연구소', certifiedDate: '', researcherCount: 2 }, { id: 'c3', isSample: true, certifiedDate: '2020-01-01' }] } }]
  const lf = labcareFactsOf(labRows, 'c1')
  check('A 연구소 관리 → 인정 · 연구전담요원 4명', !!lf && lf.unit === 'lab' && lf.recognizedAt === '2024-05-10' && lf.researchers === 4 && lf.number === '2024-123', lf)
  check('A 인정일 없음 · 예시 업체는 인정으로 보지 않음', labcareFactsOf(labRows, 'c2') === null && labcareFactsOf(labRows, 'c3') === null && labcareFactsOf(null, 'c1') === null)
  const recA = normalizeClientOps({ id: 'c1', companyName: '한빛(주)', establishedAt: '2018-01-01', industry: '소프트웨어 개발', employeeCount: '20' } as never)
  const ctxA = certContextOf(recA, TODAY, normalizeCertProfile({}), { lab: lf })
  const labA = assessAll(ctxA).find((x) => x.key === 'lab')!
  check('A 연구소: 다시 묻지 않고 보유 중 · 연구전담요원 4명 · 근거 ✓ 연구소 관리 기록', labA.recommendation === 'held' && ctxA.researchUnit === 'lab' && ctxA.researchers === 4 && basisFor('lab', ctxA).some((b) => b.field === 'researchUnit' && b.state === 'confirmed' && b.from.includes('연구소 관리')), { rec: labA.recommendation, basis: basisFor('lab', ctxA) })
  check('A 연구소 → 이노비즈 판정에 연구조직 ✓', assessAll(ctxA).find((x) => x.key === 'innobiz')!.reasons.some((r) => r.state === 'ok' && r.text.includes('기업부설연구소')))

  // 시나리오 B — 특허를 칩으로 고르면 판정엔 바로, 회사 정보에는 [확인 저장]을 눌러야
  const pB = normalizeCertProfile({ patents: 2, researchUnit: 'dept' })
  const ctxB = certContextOf(recA, TODAY, pB)
  check('B 칩: 판정엔 바로 반영(특허 2건) · 근거는 △ 컨설턴트 선택', ctxB.patents === 2 && basisFor('innobiz', ctxB).some((b) => b.field === 'patents' && b.state === 'estimated' && b.from.includes('컨설턴트 선택')))
  const fp = factPatchOf(pB)
  check('B 확인 저장 대상: 특허 2건 · 연구소 = 연구개발전담부서(사실 창고 칸이 있는 것만)', fp.map((f) => `${f.key}=${f.value}`).join() === 'patents=2건,researchLab=연구개발전담부서', fp)

  // 시나리오 C — 이노비즈 전체 흐름 → 인증 완료 → 갱신 → 정책자금 다음
  const ctxC = { ...base, years: 7, months: 84, industryGroup: 'manufacturing' as const, industryText: '정밀기계 제조', size: 'small' as const, employees: 30, researchUnit: 'lab' as const, patents: 3, rndExpense: 200_000_000, revenue: 5_000_000_000, operatingProfit: 300_000_000, policyFundPlan: true, procurement: true }
  check('C 이노비즈: 지금 추천', assessInnobiz(ctxC).recommendation === 'now')
  const heldC = { ...ctxC, held: [{ key: 'innobiz' as const, validUntil: '2029-03-14', note: '번호 260101-00123' }] }
  const aC = assessAll(heldC).find((x) => x.key === 'innobiz')!
  check('C 완료 뒤: 보유 중 · 갱신 준비 2028-11-14부터', aC.recommendation === 'held' && aC.renewal?.prepareFrom === '2028-11-14', aC.renewal)
  const afterC = nextAfterCertified('innobiz', heldC)
  check('C 다음 할 일: 정책자금 · 조달 가점(1~3개)', afterC.length >= 1 && afterC.length <= 3 && afterC[0].kind === 'policy_fund' && afterC.some((x) => x.kind === 'procurement'), afterC)
  check('C 다음 할 일: 연구소는 세액공제 · 벤처 · 유지', nextAfterCertified('lab', { ...ctxC, held: [] }).map((x) => x.kind).join() === 'tax_credit,venture,lab_keep')
  check('C 다음 할 일: 정책자금 계획 없음(false)이면 빼고, 3개를 넘지 않음', !nextAfterCertified('mainbiz', { ...ctxC, policyFundPlan: false }).some((x) => x.kind === 'policy_fund') && ['innobiz', 'mainbiz', 'venture', 'lab', 'iso9001'].every((k) => nextAfterCertified(k as never, ctxC).length <= 3))

  // 시나리오 D — 메인비즈 실사 직전 요약(대표 확인 필요가 '물어볼 것' 으로)
  const cardsD = inspectionCards(INNOBIZ_INSPECTION, { ...ctxC, patents: 0, evidence: [{ id: 'patent', label: '특허', have: true }] }, (id) => id)
  const sumD = preInspectionSummary(cardsD, { [cardsD[0].q.id]: { state: 'confirm' }, [cardsD[1].q.id]: { state: 'edited', text: '연구소에서 4명이' } })
  check('D 실사 요약: 대표 확인 필요 → 물어볼 것 · 고친 답 → 준비/보완 · 안 본 질문 수', sumD.ask.includes(cardsD[0].q.question) && (sumD.ready.includes(cardsD[1].q.question) || sumD.fix.some((x) => x.startsWith(cardsD[1].q.question))) && sumD.untouched === cardsD.length - 2, sumD)
  check('D 실사 요약: 가져갈 자료 = 서류함에 있는 증빙 · 글 한 장', sumD.bring.includes('patent') && preInspectionText('한빛 이노비즈', sumD).includes('■ 대표에게 물어볼 것'))

  // 시나리오 E — 만료된 인증은 보유 중으로 안 보인다
  const expC = { ...ctxC, held: [{ key: 'innobiz' as const, validUntil: '2025-12-31', note: '' }] }
  const aE = assessAll(expC).find((x) => x.key === 'innobiz')!
  check('E 만료(연장 기간도 지남): 보유 중 아님 · 이전 인증 만료 표시 · 근거 첫 줄 ✗', aE.recommendation !== 'held' && aE.expired === true && aE.reasons[0].state === 'no' && aE.oneLine.includes('이전 인증 만료') && aE.renewal!.daysLeft < 0, aE)
  const graceC = { ...ctxC, held: [{ key: 'innobiz' as const, validUntil: '2026-09-25', note: '' }] }
  const aG = assessAll(graceC).find((x) => x.key === 'innobiz')!
  check('E 만료 30일 안: 지금 연장 신청(보유로 보되 경고)', aG.recommendation === 'now' && !aG.expired && aG.oneLine.includes('연장 신청'), aG)
  const expV = assessAll({ ...ctxC, held: [{ key: 'venture' as const, validUntil: '2026-01-01', note: '' }] }).find((x) => x.key === 'venture')!
  check('E 벤처 만료: 다시 판정 + 만료 표시', expV.expired === true && expV.recommendation !== 'held')

  // 시나리오 F — 빈 업체: 날짜 · 사실을 만들지 않는다
  const recF = normalizeClientOps({ id: 'f', companyName: '빈상사' } as never)
  const ctxF = certContextOf(recF, TODAY)
  const allF = assessAll(ctxF)
  check('F 빈 업체: 보유 인증 0 · 갱신 정보 0 · 근거는 모름', ctxF.held.length === 0 && allF.every((x) => !x.renewal && !x.expired) && basisFor('innobiz', ctxF).every((b) => b.state === 'missing'))
  check('F 빈 업체: 퍼센트 · 점수 없음', allF.every((x) => !/%|점(?!검)/.test(x.oneLine)))

  // 벤처 연구개발유형 별표1
  check('별표1(AX): SW(58221) 30억 → 10% · 80억 → 8% · 기계(29199) → 7% · KSIC 없음 · 갈리는 코드(29) → 고르지 않음', ventureRndRatio('58221', 3e9)?.ratio === 0.1 && ventureRndRatio('58221', 8e9)?.ratio === 0.08 && ventureRndRatio('29199', 2e9)?.ratio === 0.07 && ventureRndRatio('', null) === null && ventureRndRatio(null, 3e9) === null && ventureRndRatio('29', 3e9) === null)
  const vSW = assessVenture({ ...base, years: 5, months: 60, industryGroup: 'software', ksic: '58221', researchUnit: 'lab', rndExpense: 200_000_000, revenue: 3_000_000_000, patents: 1 })
  check('벤처 SW 연구개발비 6.7% → 기준 10% 미만(별표1)', vSW.reasons.some((r) => r.state === 'warn' && r.text.includes('기준 10%')), vSW.reasons)

  // 공식 기준 재확인 반영
  check('공식 재확인(HF): 메인비즈 3영역 350/400/250 · 연장 기간 · 미확인 = 혜택 원문 대조 · 음식점업 제외 여부', CERT_RULES.mainbiz.unverified.length === 2 && CERT_RULES.mainbiz.unverified[0].includes('혜택') && CERT_RULES.mainbiz.unverified[1].includes('음식점업') && (CERT_RULES.mainbiz.officialScores ?? []).some((x) => x.value.includes('350')) && CERT_RULES.mainbiz.renewalNote.includes('만료 90일 전부터 만료 후 30일'))
  check('공식 재확인(AX): 연구소 50㎡ 칸막이 · 30일 변경 신고 · 남은 미확인(번호 형식 · 인터넷산업 코드 · Kibo 배점 · 혜택 원문 · SW/바이오/환경 범위 · ISO 45001 일정)', JSON.stringify(CERT_RULES.lab).includes('50㎡') && CERT_RULES.lab.renewalNote.includes('30일') && CERT_RULES.venture.unverified.length === 3 && CERT_RULES.innobiz.unverified.length === 2 && CERT_RULES.iso45001.unverified.length === 1)
  check('공식 재확인(HF): 공식 안내 상이는 벤처 재확인 시기 하나뿐(메인비즈 제외 업종은 운영규정 본문 표로 확인 — 상이 아님)', Object.values(CERT_RULES).filter((r) => (r.conflicts ?? []).length > 0).map((r) => r.key).join() === 'venture')
}


/* ================= P1 릴리스 확인 — 확인서 PDF ↔ 진행 기록 중복 없음 ================= */
{
  const NOW = '2026-10-07T00:00:00Z'
  let n = 0
  const mk = () => `cand_${++n}`
  const pdf = ['기술혁신형 중소기업(INNO-BIZ) 확인서', '확인번호 : 260315-00123', '확인일자 : 2026년 03월 15일', '유효기간 : 2026.03.15 ~ 2029.03.14', '중소벤처기업부'].join('\n')
  const acceptPdf = (r: ReturnType<typeof normalizeClientOps>) => {
    const found = factCandidatesFromDocText('custom_doc' as never, pdf, 'file1')
    const withInbox = withFactCandidates(r, found, NOW, mk)
    return withFactDecisions(withInbox, (withInbox.factInbox ?? []).map((c) => ({ id: c.id, action: 'accept' as const })), NOW)
  }
  const innoFields = (r: ReturnType<typeof normalizeClientOps>) => (r.customFields ?? []).filter((f) => f.group === 'credential' && /이노비즈/.test(f.label))
  const life = withCompletion(emptyLifecycle('innobiz'), { number: '260315-00123', certifiedAt: '2026-03-15', validUntil: '2029-03-14' }, NOW)
  // PDF 먼저 → 진행 기록
  const r0 = normalizeClientOps({ id: 'pdf1', companyName: '확인서상사' } as never)
  const r1 = acceptPdf(r0)
  check('릴리스: 확인서 PDF → 회사 정보 인증서 칸 1개(이노비즈 · 2029-03-14까지 · 기관)', innoFields(r1).length === 1 && innoFields(r1)[0].value.includes('2029-03-14까지') && innoFields(r1)[0].value.includes('중소벤처기업부'), innoFields(r1))
  check('릴리스: PDF 만 있어도 보유 인증(유효기간)으로 읽힌다', heldCertifications(r1).some((h) => h.key === 'innobiz' && h.validUntil === '2029-03-14'))
  const r2 = withCertCompletion(r1, 'innobiz', life, { toProfile: true, today: TODAY, clientId: 'pdf1' })
  check('릴리스: PDF 뒤 인증 완료 기록 → 칸 그대로 1개 · 기관 조각 남음', innoFields(r2).length === 1 && innoFields(r2)[0].value.includes('중소벤처기업부') && innoFields(r2)[0].value.includes('260315-00123'), innoFields(r2))
  // 진행 기록 먼저 → PDF
  const r3 = withCertCompletion(r0, 'innobiz', life, { toProfile: true, today: TODAY, clientId: 'pdf1' })
  const r4 = acceptPdf(r3)
  check('릴리스: 진행 기록 먼저 → PDF 받아도 칸 1개(서류 읽기와 같은 이름 "이노비즈")', innoFields(r3).length === 1 && innoFields(r3)[0].label === '이노비즈' && innoFields(r4).length === 1, innoFields(r4))
  // 예전 이름('이노비즈 확인서') 칸이 있어도 PDF 가 같은 칸으로
  const legacy = normalizeClientOps({ id: 'lg', companyName: '예전상사', customFields: [{ id: 'cf1', group: 'credential', label: '이노비즈 확인서', value: '인증번호 1 · 2027-01-01까지' }] } as never)
  check('릴리스: 예전 이름 칸 + PDF → 한 칸으로', innoFields(acceptPdf(legacy)).length === 1)
  check('릴리스: 갱신 일정은 같은 인증 다시 기록해도 한 묶음(겹치지 않음)', (withCertCompletion(r2, 'innobiz', life, { toProfile: true, today: TODAY, clientId: 'pdf1' }).toolResults ?? []).filter((t) => t.toolKey === 'cert-os').length === 1)
}


// ---------------- P2 — 실사 준비 패키지 · 대표 확인 · 제출 전 확인 · 벤처 패키지 · AI 넘기기 · 고객 요약 ----------------
{
  const B = (field: BasisItem['field'], label: string, value: string, from = '회사 정보(확인)'): BasisItem => ({ field, label, value, state: 'confirmed', from })
  const richBasis: BasisItem[] = [
    B('years', '업력', '7년(설립 2019-03-02)', '사업자등록증'),
    B('industry', '업종', '정밀기계 부품 제조', '사업자등록증'),
    B('employees', '직원', '35명'),
    B('revenue', '매출', '90억원', '재무제표(2025)'),
    B('researchUnit', '연구조직', '기업부설연구소', '연구소 관리 기록(인정 2021-05-10)'),
    B('researchers', '연구전담요원', '4명', '연구소 관리 기록'),
    B('patents', '특허', '3건', '회사 정보 인증서 칸(특허증)'),
    { field: 'exclusion', label: '제외 사유', value: '없음', state: 'estimated', from: '컨설턴트 확인(신청 전 증명서로 최종 확인)' },
    { field: 'size', label: '규모', value: '소기업', state: 'estimated', from: '컨설턴트 선택(회사 정보 미확인)' },
  ]
  const rich = ctx({ ...tech, basis: richBasis, held: [{ key: 'venture', validUntil: '2027-05-01', note: '' }] })
  const richPkg = buildInspectionPackage({ cert: 'innobiz', bank: INNOBIZ_BANK, selfCheck: INNOBIZ_CHECK, answers: {}, ctx: rich, prep: {}, labelOf: label })
  const allSourced = [...richPkg.company, ...richPkg.strengths, ...richPkg.questions.flatMap((x) => [...x.guide.core, ...x.guide.points])]
  const basisText = richBasis.map((b) => b.value).join(' ') + ' ' + rich.companyName
  const numbersOk = allSourced.every((x) => (x.text.match(/\d[\d,.]*/g) ?? []).every((n) => basisText.includes(n)))
  // G 사실 많은 이노비즈 업체
  check('G 사실 많은 업체: 예상 질문 5~8개 · 핵심 답 초안이 생긴다', richPkg.questions.length >= 5 && richPkg.questions.length <= 8 && richPkg.questions.filter((x) => x.guide.core.length > 0).length >= 3, richPkg.questions.map((x) => [x.q.id, x.guide.core.length]))
  check('G 모든 문장에 근거가 붙는다(빈 근거 0)', allSourced.length > 0 && allSourced.every((x) => x.basis.trim().length > 0), allSourced.filter((x) => !x.basis))
  check('G 숫자는 근거 값에 있는 것만(지어낸 수치 0)', numbersOk, allSourced.map((x) => x.text))
  check('G 금지 말 0(업계 최고 · 유일 · 1위 …)', !allSourced.some((x) => BANNED_WORDS.test(x.text)) && !BANNED_WORDS.test(inspectionPackageText(richPkg)))
  check('G 업체 핵심정보: 회사명 · 업력 · 매출 · 연구소 · 특허 · 인증', ['한빛정밀', '7년', '90억원', '기업부설연구소', '3건', '벤처기업'].every((w) => richPkg.company.some((x) => x.text.includes(w))), richPkg.company)
  check('G 강점: 연구소 · 특허 · 보유 인증', richPkg.strengths.length >= 3)
  check('G 질문마다 묻는 이유 한 줄 · 처음 3개는 늘 묻는 질문', richPkg.questions.every((x) => x.why.length > 0) && richPkg.questions.slice(0, 3).every((x) => (x.q.weight ?? 2) === 3))
  check('G 가져갈 자료 ✓/△/? · 실사 전날 체크 5개 이하', richPkg.bring.some((b) => b.state === 'ready') && richPkg.dayBefore.length >= 1 && richPkg.dayBefore.length <= 5)
  check('G 30초 설명이 이 업체 사실로(연구조직과 특허)', companyFitLine('innobiz', rich) === '귀사는 연구조직과 특허가 이미 확보되어 있어 이노비즈 준비에서 기술혁신 근거를 만들기 유리한 상태입니다.' && explainFor(T.innobiz, rich, 'X').thirty.startsWith('귀사는 연구조직과 특허가'))
  check('G 추정 · 칩 값으로는 고객 맞춤 문장을 만들지 않는다', companyFitLine('innobiz', ctx({ ...tech, basis: [{ ...richBasis[4], state: 'estimated', from: '컨설턴트 선택(회사 정보 미확인)' }] })) === '')

  // H 정보 거의 없는 업체
  const sparse = ctx({ companyName: '처음상사', basis: [] })
  const sp = buildInspectionPackage({ cert: 'innobiz', bank: INNOBIZ_BANK, selfCheck: INNOBIZ_CHECK, answers: {}, ctx: sparse, prep: {}, labelOf: label })
  check('H 빈 업체: 지어낸 답 0(핵심 답 전부 비어 대표 확인)', sp.questions.every((x) => x.guide.core.length === 0 && x.guide.needsOwner))
  check('H 빈 업체: 업체 핵심정보는 회사명뿐 · 강점 0', sp.company.length === 1 && sp.strengths.length === 0, sp.company)
  check('H 빈 업체: 대표 확인 질문이 생긴다(3~8개 · 중복 없음)', sp.ownerQuestions.length >= 3 && sp.ownerQuestions.length <= 8 && new Set(sp.ownerQuestions.map(ownerKey)).size === sp.ownerQuestions.length, sp.ownerQuestions)
  check('H 빈 업체: 제외 사유 · 중소기업 여부를 묻는다', sp.ownerQuestions.some((q) => /체납/.test(q)) && sp.ownerQuestions.some((q) => /중소기업확인서/.test(q)))
  check("H 글에도 '대표 확인 후 보완이 필요합니다'", /대표 확인 후 보완이 필요합니다/.test(inspectionPackageText(sp)))
  const msg = ownerQuestionMessage('처음상사', '이노비즈', sp.ownerQuestions, '홍길동 팀장')
  check('H 대표에게 질문 보내기: □ 목록 카톡 문구 · 보낸 사람', msg.startsWith('대표님, 홍길동 팀장입니다.') && msg.split('\n').filter((l) => l.startsWith('□ ')).length === sp.ownerQuestions.length)
  // 대표 답을 적으면 질문이 빠지고 '대표 답' 근거 문장이 된다
  const q1 = sp.questions[0].guide.ownerAsk[0]
  const sp2 = buildInspectionPackage({ cert: 'innobiz', bank: INNOBIZ_BANK, selfCheck: INNOBIZ_CHECK, answers: {}, ctx: sparse, prep: {}, labelOf: label, notes: { [ownerKey(q1)]: '금형 냉각 설계를 자체 개발' } })
  check('H 대표 답 적기 → 그 질문은 목록에서 빠지고 핵심 답(근거: 대표 답)', !sp2.ownerQuestions.includes(q1) && sp2.questions.some((x) => x.guide.core.some((c) => c.text === '금형 냉각 설계를 자체 개발' && c.basis.startsWith('대표 답'))))
  const gateSp = buildSubmitGate({ cert: 'innobiz', ctx: sparse, selfCheck: INNOBIZ_CHECK, answers: {}, pkg: sp })
  check("H 제출 전 확인: '먼저 확인 필요' · 퍼센트 없음 · 공식 점수는 따로", gateSp.verdict === 'check_first' && !gateSp.items.some((x) => /%|점/.test(x.text)) && gateSp.official.some((o) => /650/.test(o.value)))

  // I 이미 있는 자료는 요청에서 빠진다
  const docs = submissionDocs('innobiz', tech)
  const req = missingDocsRequest('한빛정밀', 'innobiz', docs, '김상호 대표')
  check('I 제출자료 정리: 서류함에 있는 7개는 ✓, 없는 것만 △', docs.have.length === 7 && docs.need.map((d) => d.label).join() === '품질 · 인증 현황(ISO 등)', docs)
  check('I 요청 문구: 없는 것만 번호(고객이 알아듣는 말) · 이미 받은 것은 다시 안 주셔도 됨 · 없는 자료는 만들지 않아도 됨', /1\. 품질 관련 인증서/.test(req) && !/2\. /.test(req) && /다시 안 주셔도/.test(req) && /새로 만드실 필요는 없습니다/.test(req), req)
  const staleDocs = submissionDocs('innobiz', ctx({ ...tech, evidence: [...tech.evidence.filter((e) => e.id !== 'fin3'), { id: 'fin3', label: 'fin3', have: true, stale: true }] }))
  check('I 기간 지난 자료는 새로 발급 요청', staleDocs.need.some((d) => d.label === '최근 3년 재무제표' && d.stale))
  const gateRich = buildSubmitGate({ cert: 'innobiz', ctx: rich, selfCheck: INNOBIZ_CHECK, answers: Object.fromEntries(INNOBIZ_CHECK.map((i) => [i.id, 'yes' as const])), pkg: richPkg })
  check('I 제출 전 확인 항목은 ✓/△ 한 줄씩(반드시 4 · 권장 4) · 판정은 두 가지뿐', gateRich.items.length === 8 && gateRich.items.filter((x) => x.level === 'must').length === 4 && ['ready', 'check_first'].includes(gateRich.verdict), gateRich.items)

  // J 벤처 준비 패키지
  const vp = buildVenturePack(rich)
  const vpBlank = buildVenturePack(sparse)
  check('J 벤처 패키지: 9칸', vp.length === 9 && vp.map((x) => x.title).join('|') === '회사 기본정보|해결하려는 문제|제품 · 서비스|기술 · 차별성|시장|매출 · 성장|연구개발|지식재산|실증 · 성과')
  check('J 사실 많은 업체: 기본정보 · 기술 · 연구개발 · 지식재산 ✓, 문제 · 시장은 ? 대표 확인', ['basic', 'tech', 'rnd', 'ip'].every((id) => vp.find((x) => x.id === id)!.state === 'ok') && ['problem', 'market'].every((id) => vp.find((x) => x.id === id)!.state === 'ask'), vp.map((x) => [x.id, x.state]))
  check('J 빈 업체: 지어낸 내용 0 — 회사명 말고는 줄이 없다', vpBlank.flatMap((x) => x.lines).every((l) => l.text === '회사명 처음상사') && vpBlank.filter((x) => x.state === 'ask').length === 8)
  check('J 대표 답을 적으면 그 칸은 ✓(근거: 대표 답)', buildVenturePack(sparse, { 'venture:problem': '중소 제조사의 불량 검사 시간을 줄임' }).find((x) => x.id === 'problem')!.state === 'ok')
  const vh = ventureHandoff('처음상사', vpBlank, null, { have: [], missing: [] })
  check('J AI 넘기기(벤처): 빈 칸은 대표 확인 필요로 · 지어내지 말라는 지시', /\[대표 확인 필요: 어떤 고객의/.test(handoffText(vh)) && HANDOFF_RULES.every((r) => handoffText(vh).includes(r)))

  // K 인증 받은 업체 → 다음 할 일 3개 이하 · 이유 한 줄
  for (const [k, c] of [['innobiz', tech], ['venture', service], ['lab', startup], ['mainbiz', service], ['iso9001', factory]] as const) {
    const after = nextAfterCertified(k, c)
    check(`K ${k} 취득 뒤 다음 할 일 3개 이하 · 이유 한 줄('취득 완료')`, after.length >= 1 && after.length <= 3 && after.every((x) => x.because.startsWith(`${{ innobiz: '이노비즈', venture: '벤처', lab: '연구소', mainbiz: '메인비즈', iso9001: 'ISO 9001' }[k]} 취득 완료`) && !x.because.includes('\n')), after)
  }
  check("K 정책자금 이유: '이노비즈 취득 완료 + 정책자금 계획 있음'", nextAfterCertified('innobiz', tech)[0].because === '이노비즈 취득 완료 + 정책자금 계획 있음')
  check('K 모르는 특허 수는 0건이라고 쓰지 않는다', !nextAfterCertified('innobiz', ctx({ ...service, patents: null })).some((x) => x.because.includes('0건')))

  // L 고객 요약에 내부 정보 없음
  const secret = ctx({ ...rich, exclusionFlags: ['국세 체납'] })
  const listL = assessAll(secret)
  const sum = buildClientSummary(listL, secret, buildRoadmap(listL, secret))
  const sumText = clientSummaryText(sum, '미래경영 홍길동 대표')
  check('L 고객 요약: 8칸 이내(검토 · 추천 · 이유 · 준비 · 자료 · 혜택 · 순서 · 유의)', sum.sections.length >= 5 && sum.sections.length <= 8 && sum.sections.some((x) => x.id === 'notice'))
  check('L 고객 요약: 실사 질문 · 대표 답 · 체납 · 내부 · 공식 점수 숫자 없음', !/체납|실사|대표 답|내부|컨설턴트 메모|650|700점|%|점수/.test(sumText), sumText)
  check('L 고객 요약: 인증은 기관 심사로 정해진다는 유의사항(짧게)', /기관의 심사로 정해집니다/.test(sumText))
  const ih = inspectionHandoff(richPkg, T.innobiz, runSelfCheck(INNOBIZ_CHECK, rich, {}))
  check('AI 넘기기: 구조 묶음(버전 · 사실 · 판정 · 자가진단 · 증빙 · 질문 · 금지 지시)', ih.version === 'cert-handoff/1' && ih.facts.length > 0 && !!ih.judgment && ih.selfCheck.length > 0 && ih.questions.length === richPkg.questions.length && ih.rules === HANDOFF_RULES)
  check('AI 넘기기: 다른 업체 이름이 섞이지 않는다', !handoffText(ih).includes('처음상사') && handoffText(ih).includes('한빛정밀'))

  // 메인비즈도 같은 틀
  const mPkg = buildInspectionPackage({ cert: 'mainbiz', bank: MAINBIZ_BANK, selfCheck: MAINBIZ_CHECK, answers: {}, ctx: rich, prep: {}, labelOf: label })
  check('메인비즈 패키지: 질문 5~8개 · 문장마다 근거', mPkg.questions.length >= 5 && mPkg.questions.length <= 8 && mPkg.questions.flatMap((x) => [...x.guide.core, ...x.guide.points]).every((x) => x.basis.length > 0))
  check('질문 은행: 이노비즈 10 · 메인비즈 10 · 가이드 전부 있음', INNOBIZ_BANK.length === 10 && MAINBIZ_BANK.length === 10 && [...INNOBIZ_BANK, ...MAINBIZ_BANK].every((q) => !!q.guide && !!q.topic))
  check('기준 바뀐 기록: 인증 · 기준 · 확인일 · 바뀐 것', RULE_CHANGES.length >= 4 && RULE_CHANGES.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.checkedAt) && r.rule && r.change && CERT_RULES[r.cert]))
}


// ---------------- FV — 현장 검증(업체 5유형 · 공통 규칙만 · 업체 이름 예외 없음) ----------------
{
  const R = (k: keyof typeof FIELD_COS) => by(assessAll(FIELD_COS[k]))
  const A = R('A'), Bs = R('B'), C = R('C'), D = R('D'), E = R('E')
  const ACTIVE = ['now', 'possible']
  // A 기술기업 — 벤처 · 이노비즈가 먼저, 메인비즈는 뒤로
  check('FV A 기술기업: 벤처 · 이노비즈 지금 추천 · 메인비즈 우선순위 낮음 · 연구소 보유', A.venture.recommendation === 'now' && A.innobiz.recommendation === 'now' && A.mainbiz.recommendation === 'low_priority' && A.lab.recommendation === 'held')
  check('FV A 자료 절반(4/8)이면 이노비즈 준비도는 높음까지(매우 높음 아님) · 이유 한 줄', A.innobiz.readiness === 'high' && A.innobiz.reasons.some((r) => /제출 자료 4\/8/.test(r.text)), A.innobiz.readiness)
  check('FV A 제조 28명: ISO 14001 · 45001 은 업종만으로 추천하지 않음', !ACTIVE.includes(A.iso14001.recommendation) && !ACTIVE.includes(A.iso45001.recommendation))
  // B 서비스 — 이노비즈를 밀지 않고 메인비즈
  check('FV B 서비스: 메인비즈 지금 추천 · 이노비즈 우선순위 낮음(준비도 낮음 이하)', Bs.mainbiz.recommendation === 'now' && Bs.innobiz.recommendation === 'low_priority' && ['low', 'very_low'].includes(Bs.innobiz.readiness))
  check('FV B 서비스: 연구소 지금 필요 없음 · 벤처 우선순위 낮음(연구소를 밀지 않음)', Bs.lab.recommendation === 'not_needed' && Bs.venture.recommendation === 'low_priority')
  check('FV B B2B 서비스: ISO 9001 자동 추천 안 함', !ACTIVE.includes(Bs.iso9001.recommendation))
  // C 정보 부족 — 아는 척하지 않음
  check('FV C 정보 부족: 인증 7개 전부 추가 확인 필요', Object.values(C).every((a) => a.recommendation === 'need_info'), Object.values(C).map((a) => a.recommendation))
  check('FV C 아무도 확인 안 한 제외 사유를 ✓ 로 보이지 않음', !C.innobiz.reasons.some((r) => r.state === 'ok' && /제외 사유/.test(r.text)))
  check('FV C ISO 한 줄이 판정과 같은 말(추가 확인 필요인데 "필요 없음" 이라고 하지 않음)', !/필요 없음/.test(C.iso14001.oneLine + C.iso45001.oneLine))
  // D 제조 B2B — 기술 근거 없으면 이노비즈 대신 메인비즈 · ISO 는 이유가 있어 추천
  check('FV D 제조 B2B(연구조직 · 특허 · R&D 없음): 이노비즈 업력만으로 추천 안 함 · 메인비즈 지금', D.innobiz.recommendation === 'low_priority' && ['low', 'very_low'].includes(D.innobiz.readiness) && D.mainbiz.recommendation === 'now')
  check('FV D 조달 · 금속 가공 · 60명: ISO 9001 · 14001 · 45001 검토(이유 있음)', D.iso9001.recommendation === 'possible' && D.iso14001.recommendation === 'possible' && D.iso45001.recommendation === 'possible')
  check('FV D 문서 0~1개: ISO 준비도 매우 높음 아님', [D.iso9001, D.iso14001, D.iso45001].every((a) => a.readiness !== 'very_high'))
  // E 보유 · 만료 — 유지 · 갱신이 먼저
  check('FV E 보유: 벤처 · 연구소 보유 중 · 이노비즈는 만료 표시 + 다시 신청(보유 중 아님)', E.venture.recommendation === 'held' && E.lab.recommendation === 'held' && E.innobiz.recommendation !== 'held' && E.innobiz.expired === true)
  // 다섯 유형의 추천이 서로 다르다
  const sigs = Object.keys(FIELD_COS).map((k) => ['lab', 'venture', 'innobiz', 'mainbiz', 'iso9001'].map((x) => R(k as keyof typeof FIELD_COS)[x].recommendation).join('/'))
  check('FV 다섯 유형의 추천 조합이 모두 다름', new Set(sigs).size === 5, sigs)
  // 패키지 · 질문 · 요청 품질
  const pkgOf = (k: keyof typeof FIELD_COS, cert: 'innobiz' | 'mainbiz') => buildInspectionPackage({ cert, bank: cert === 'innobiz' ? INNOBIZ_BANK : MAINBIZ_BANK, selfCheck: cert === 'innobiz' ? INNOBIZ_CHECK : MAINBIZ_CHECK, answers: {}, ctx: FIELD_COS[k], prep: {}, labelOf: label })
  const pB = pkgOf('B', 'mainbiz')
  check("FV B 강점에 '특허 0건' · '연구조직 없음' 같은 없는 것을 내세우지 않음", !pB.strengths.some((x) => /0건|없음/.test(x.text)) && !pB.company.some((x) => /0건|없음/.test(x.text)), pB.strengths)
  const allOwner = [...pkgOf('A', 'innobiz').ownerQuestions, ...pB.ownerQuestions, ...pkgOf('C', 'innobiz').ownerQuestions, ...pkgOf('D', 'mainbiz').ownerQuestions]
  check('FV 대표 질문은 모두 물음표로 끝나는 질문(조각 말 아님)', allOwner.every((q) => /\?(\(.*\))?$/.test(q)), allOwner.filter((q) => !/\?(\(.*\))?$/.test(q)))
  check('FV 대표 질문에 체불 질문이 두 번 나오지 않음', pB.ownerQuestions.filter((q) => /체불/.test(q)).length <= 1, pB.ownerQuestions)
  check('FV 크기를 아는 업체(A)에는 중소기업확인서를 묻지 않음', !pkgOf('A', 'innobiz').ownerQuestions.some((q) => /중소기업확인서/.test(q)))
  const dPkg = pkgOf('D', 'mainbiz')
  check('FV D 납품 제조업: 고객 관리 질문이 이유와 함께 올라옴', dPkg.questions.some((x) => x.q.id === 'q_customer' && /납품/.test(x.why)))
  const aPkg = pkgOf('A', 'innobiz')
  check('FV A 제조: 품질 · 공정 질문이 이유와 함께 들어옴', aPkg.questions.some((x) => x.q.id === 'q_quality' && /제조업/.test(x.why)))
  check("FV 말하기 가이드에 '업종: …' 같은 채움 말 없음", !aPkg.questions.some((x) => x.guide.points.some((p) => /^업종:/.test(p.text))))
  const txt = [inspectionPackageText(aPkg), inspectionPackageText(pB), explainFor(A.innobiz, FIELD_COS.A, 'X').thirty, explainFor(Bs.mainbiz, FIELD_COS.B, 'X').thirty].join('\n')
  check("FV '은(는)' 같은 기계 조사 없음", !/은\(는\)|이\(가\)/.test(txt))
  check('FV 조사: 이노비즈는 · 메인비즈는 · 연구소는 · 업력 9년으로 · 특허가', eunNeun('이노비즈') === '이노비즈는' && eunNeun('기업부설연구소') === '기업부설연구소는' && eunNeun('최근 개발 과제 · 기록') === '최근 개발 과제 · 기록은' && euroRo('업력 9년') === '업력 9년으로' && euroRo('업력 7년') === '업력 7년으로' && iGa('특허') === '특허가')
  // 자료 요청 · 제출 전 확인
  const reqD = missingDocsRequest('대성정밀', 'mainbiz', submissionDocs('mainbiz', FIELD_COS.D), 'X')
  check('FV 자료 요청: 고객이 알아듣는 말(예: …) · 없는 자료는 만들 필요 없음', /예: 월간 회의록/.test(reqD) && /새로 만드실 필요는 없습니다/.test(reqD) && !/성과 관리 기록\(목표/.test(reqD), reqD)
  // FV Final: 공식 제출서류는 요청 맨 앞(없는 업체 C 로 확인 — D 는 공식 제출서류를 이미 가짐)
  const needC = submissionDocs('innobiz', FIELD_COS.C).need
  check('FV 공식 제출서류는 요청 맨 앞', needC.length > 0 && needC[0].required === true && needC[0].basis === 'official', needC.map((d) => [d.id, d.basis]))
  // ---- FV Final: 공식 필수자료 vs MIRAE 실무 준비자료 ----
  const yesI = Object.fromEntries(INNOBIZ_CHECK.map((i) => [i.id, 'yes' as const]))
  const exOk: BasisItem = { field: 'exclusion', label: '제외 사유', value: '없음', state: 'confirmed', from: '납세증명서' }
  const gateFor = (cert: 'innobiz' | 'mainbiz', c: typeof FIELD_COS.A) => {
    const sc = cert === 'innobiz' ? INNOBIZ_CHECK : MAINBIZ_CHECK
    const ans = Object.fromEntries(sc.map((i) => [i.id, 'yes' as const]))
    const pk = buildInspectionPackage({ cert, bank: cert === 'innobiz' ? INNOBIZ_BANK : MAINBIZ_BANK, selfCheck: sc, answers: ans, ctx: c, prep: {}, labelOf: label })
    return buildSubmitGate({ cert, ctx: c, selfCheck: sc, answers: ans, pkg: pk })
  }
  // Case A — 공식 제출서류(이노비즈 사업자등록증)가 없으면 반드시 확인
  const caseA = { ...FIELD_COS.A, basis: [...(FIELD_COS.A.basis ?? []), exOk], evidence: [...FIELD_COS.A.evidence.filter((e) => e.id !== 'biz_reg'), { id: 'org_chart', label: 'org_chart', have: true }] }
  const gA = gateFor('innobiz', caseA)
  check('Final Case A: 공식 제출서류(사업자등록증) 없음 → 반드시 확인 · 먼저 확인 필요', gA.verdict === 'check_first' && gA.items.some((x) => x.id === 'docs_required' && x.level === 'must' && !x.ok && /공식 제출서류/.test(x.text)), gA.items)
  // Case B — 공식 서류는 다 있고 MIRAE 실무 준비자료(연구노트 · 기술사업계획서 파일 등)만 없음 → 보완 권장, 제출 준비는 막지 않음
  const caseB = { ...caseA, evidence: [...caseA.evidence, { id: 'biz_reg', label: 'biz_reg', have: true }] }
  const gB = gateFor('innobiz', caseB)
  check('Final Case B: MIRAE 실무 준비자료만 없음 → 보완 권장 · 제출 준비 가능', gB.verdict === 'ready' && gB.items.some((x) => x.id === 'docs' && x.level === 'recommend' && !x.ok) && gB.docs.need.every((d) => !d.required), gB.items)
  check('Final Case B: 기술사업계획서 파일이 없어도 막지 않음(이노비즈넷에서 작성하는 공식 절차)', gB.docs.need.some((d) => d.id === 'biz_plan' && d.basis === 'process' && !d.required))
  // Case C — 자료가 거의 없는 업체는 제출 준비 가능이 되지 않음
  check('Final Case C: 정보 · 자료 없는 업체 → 먼저 확인 필요', gateFor('innobiz', FIELD_COS.C).verdict === 'check_first' && gateFor('mainbiz', FIELD_COS.C).verdict === 'check_first')
  // Case D — 공식 필수 여부를 확인 못 한 자료(메인비즈 사업자등록증)는 '공식' 이라고 하지 않음
  const mBiz = evidenceClassOf('mainbiz', 'biz_reg')
  const reqDmain = missingDocsRequest('대성정밀', 'mainbiz', submissionDocs('mainbiz', { ...FIELD_COS.D, evidence: FIELD_COS.D.evidence.filter((e) => e.id !== 'biz_reg') }), 'X')
  check('Final Case D: 메인비즈 사업자등록증 = 공식 필수 여부 확인 필요(필수 아님 · 막지 않음)', mBiz.basis === 'unverified' && !submissionDocs('mainbiz', { ...FIELD_COS.D, evidence: [] }).need.find((d) => d.id === 'biz_reg')!.required && !/필수/.test(reqDmain), reqDmain)
  check("Final: '공식 제출서류' 로 분류한 자료는 모두 공식 운영기관 출처가 붙어 있음", Object.values(EVIDENCE_CLASS).flatMap((m) => Object.values(m ?? {})).filter((x) => x.basis === 'official').every((x) => /innobiz\.net|smes\.go\.kr/.test(x.source)))
  check('Final: 메인비즈에서 반드시 확인으로 막는 자료는 재무제표 하나뿐(사업자등록증 · 사업계획은 막지 않음)', Object.entries(EVIDENCE_CLASS.mainbiz ?? {}).filter(([, v]) => v.basis === 'official').map(([k]) => k).join() === 'fin3')
  check("Final: 화면 · 요청 글에 '신청에 꼭' · '필수서류' 같은 말 없음", ![gA, gB].some((g) => g.items.some((x) => /신청에 꼭|필수서류|반드시 제출|신청 불가/.test(x.text))))
  void yesI
  // 반드시 확인이 다 되면 보완 권장이 남아도 '제출 준비 가능'
  const readyCtx = { ...FIELD_COS.B, basis: [...(FIELD_COS.B.basis ?? []), { field: 'exclusion' as const, label: '제외 사유', value: '없음', state: 'confirmed' as const, from: '납세증명서' }] }
  const allYes = Object.fromEntries(MAINBIZ_CHECK.map((i) => [i.id, 'yes' as const]))
  const readyPkg = buildInspectionPackage({ cert: 'mainbiz', bank: MAINBIZ_BANK, selfCheck: MAINBIZ_CHECK, answers: allYes, ctx: readyCtx, prep: {}, labelOf: label })
  const readyGate = buildSubmitGate({ cert: 'mainbiz', ctx: readyCtx, selfCheck: MAINBIZ_CHECK, answers: allYes, pkg: readyPkg })
  check('FV 제출 전 확인: 자격 · 제외 사유 · 꼭 쓰는 자료 · 자가진단 OK 면 보완 권장이 남아도 제출 준비 가능', readyGate.verdict === 'ready' && readyGate.items.some((x) => x.level === 'recommend' && !x.ok), readyGate.items)
  check('FV 제출 전 확인: 꼭 쓰는 자료가 없으면 먼저 확인 필요', buildSubmitGate({ cert: 'mainbiz', ctx: { ...readyCtx, evidence: readyCtx.evidence.filter((e) => e.id !== 'fin3') }, selfCheck: MAINBIZ_CHECK, answers: allYes, pkg: readyPkg }).verdict === 'check_first')
  check('FV 제출 전 확인: 제외 사유가 있으면 먼저 확인 필요', buildSubmitGate({ cert: 'mainbiz', ctx: { ...readyCtx, exclusionFlags: ['국세 체납'] }, selfCheck: MAINBIZ_CHECK, answers: allYes, pkg: readyPkg }).verdict === 'check_first')
  // 고객 요약
  const sumC = clientSummaryText(buildClientSummary(assessAll(FIELD_COS.C), FIELD_COS.C, buildRoadmap(assessAll(FIELD_COS.C), FIELD_COS.C)), 'X')
  check("FV C 고객 요약: 아무것도 안 받았는데 '다 받아 두었습니다' 라고 하지 않음 · 기본 자료부터", !/다 받아 두었습니다/.test(sumC) && /사업자등록증/.test(sumC), sumC)
  const listA = assessAll(FIELD_COS.A)
  const sumA = buildClientSummary(listA, FIELD_COS.A, buildRoadmap(listA, FIELD_COS.A))
  check('FV 고객 요약 첫 다섯 칸: 추천 · 이유 · 지금 준비할 자료 · 기대 혜택 · 다음 순서', sumA.sections.slice(0, 5).map((x) => x.id).join() === 'recommend,why,docs,benefits,next', sumA.sections.map((x) => x.id))
  const docLines = sumA.sections.find((x) => x.id === 'docs')!.lines.filter((l) => l.startsWith('□'))
  check('FV 고객 요약: 같은 자료가 이름만 달리 두 번 나오지 않음(조직도 · 사업계획서)', docLines.filter((l) => /조직도/.test(l)).length <= 1 && docLines.filter((l) => /사업계획서|소개서/.test(l)).length <= 1, docLines)
  check('FV 고객 요약: 맞춤 한 줄은 한 번만', (clientSummaryText(sumA, 'X').match(/귀사는/g) ?? []).length === 1)
  // AI 묶음 — 짧고, 금지 지시 포함, 민감 정보 없음
  const hA = handoffText(inspectionHandoff(aPkg, A.innobiz, runSelfCheck(INNOBIZ_CHECK, FIELD_COS.A, {})))
  check('FV AI 묶음: 3,000자 안 · 금지 지시 포함 · 주민번호 꼴 없음', hA.length < 3000 && /만들지 마세요/.test(hA) && !/\d{6}-\d{7}/.test(hA), hA.length)
  check('FV 자료 부탁 말이 모든 인증 자료에 있음', Object.values(CERT_RULES).flatMap((r) => r.evidence).every((e) => evidenceAsk(e.id) !== e.id))
}

/* ================= AX — 판단 정확도(중소기업 · 업종 · 벤처 R&D · 범위값 · 사실 우선순위 · 공식 문구) ================= */
{
  const mature = ctx({ companyName: '정확상사', years: 6, months: 75, industryText: '산업용 기계 제조', industryGroup: 'manufacturing', employees: 20, revenue: 3_000_000_000, operatingProfit: 200_000_000, totalAssets: 2_000_000_000, totalLiabilities: 800_000_000, researchUnit: 'lab', researchers: 3, patents: 2, rndExpense: 180_000_000, evidence: ev('fin3', 'biz_reg', 'lab_cert', 'patent', 'org_chart', 'rnd_records') })
  // 중소기업 — 직원 20명만으로 '충족' 확정 금지
  const ib = assessInnobiz(mature)
  check('AX 중소기업: 직원 20명 · 확인서 없음 → 신청자격 확정 안 함(must 모름 → 추가 확인 필요)', ib.recommendation === 'need_info' && ib.reasons.some((r) => r.state === 'unknown' && r.text.startsWith('중소기업 여부 · 확인 필요')) && !ib.reasons.some((r) => r.state === 'ok' && /중소기업/.test(r.text)), ib.reasons)
  check('AX 중소기업: 메인비즈도 같은 기준', assessMainbiz(mature).recommendation === 'need_info')
  check('AX 중소기업: 확인서가 있으면 ✓', assessInnobiz({ ...mature, smeDoc: true }).reasons.some((r) => r.state === 'ok' && r.text.includes('중소기업확인서 있음')))
  check('AX 중소기업: 확인서 기준으로 고른 규모(소기업)면 ✓ · 중견이면 ✗', assessInnobiz({ ...mature, size: 'small' }).recommendation !== 'need_info' && assessInnobiz({ ...mature, size: 'mid_large' }).recommendation === 'not_needed')
  const recSme = normalizeClientOps({ id: 's1', companyName: '확인서상사', customFields: [{ id: 'c', group: 'credential', label: '중소기업확인서', value: '2026.04.01 ~ 2027.03.31' }] } as never)
  check('AX 중소기업: 인증서 칸의 중소기업확인서 → 확인됨 · 근거 ✓', certContextOf(recSme, TODAY).smeDoc === true && basisFor('innobiz', certContextOf(recSme, TODAY)).some((b) => b.field === 'size' && b.state === 'confirmed'))
  const recEmp = normalizeClientOps({ id: 's2', companyName: '직원만', employeeCount: '20' } as never)
  check("AX 중소기업: 직원 수만 있으면 근거는 △ '확정 아님'", basisFor('innobiz', certContextOf(recEmp, TODAY)).some((b) => b.field === 'size' && b.state === 'estimated' && b.value.includes('확정 아님')))
  const gSme = buildSubmitGate({ cert: 'innobiz', ctx: mature, selfCheck: INNOBIZ_CHECK, answers: {}, pkg: buildInspectionPackage({ cert: 'innobiz', bank: INNOBIZ_BANK, selfCheck: INNOBIZ_CHECK, answers: {}, ctx: mature, prep: {}, labelOf: (x) => x }) })
  check('AX 제출 전 확인: 확인서 없으면 중소기업 ✗ · 대표 질문에 확인서', gSme.items.some((x) => x.id === 'size' && !x.ok) && buildInspectionPackage({ cert: 'innobiz', bank: INNOBIZ_BANK, selfCheck: INNOBIZ_CHECK, answers: {}, ctx: mature, prep: {}, labelOf: (x) => x }).ownerQuestions.some((q) => q.includes('중소기업확인서')))
  // 이노비즈 업종 — 도소매 · 서비스 자동 탈락 금지, 농업 처리, 별표2 는 KSIC 로만
  const sm = { ...mature, size: 'small' as const }
  const retail = assessInnobiz({ ...sm, industryText: '전자부품 도매', industryGroup: 'retail' })
  check('AX 이노비즈: 도소매 → 탈락 · 경고 아님(세부 업종 확인 필요 · 비제조업 평가표)', retail.recommendation !== 'not_needed' && !retail.reasons.some((r) => /거리가 있음/.test(r.text)) && retail.reasons.some((r) => r.text.includes('세부 업종 확인 필요') && r.text.includes('비제조업')), retail.reasons)
  const svc = assessInnobiz({ ...sm, industryText: '교육 서비스', industryGroup: 'service', ksic: '85501' })
  check('AX 이노비즈: 서비스(KSIC 85501) → 비제조업 평가표로 신청 가능', svc.reasons.some((r) => r.state === 'ok' && r.text.includes('비제조업 평가표')))
  check("AX 이노비즈: 농업 — '작물 재배' 는 농업 · KSIC 01110 → 신청 가능 · 평가표는 농업 또는 바이오(별표1 A01) 확인 필요", industryGroupOf('작물 재배업') === 'agriculture' && assessInnobiz({ ...sm, industryText: '작물 재배업', industryGroup: 'agriculture', ksic: '01110' }).reasons.some((r) => r.state === 'ok' && r.text.includes('업종 평가표 추가 확인 필요') && r.text.includes('농업') && r.text.includes('바이오업')))
  check('HF 이노비즈: 소프트웨어업은 세세분류 7개(58222 → 소프트웨어 평가표) · J631 은 소프트웨어업 아님', innobizSectorOfKsic('58222').sector === 'software' && innobizSectorOfKsic('63120').sector !== 'software' && innobizSectorOfKsic('62090').sector === null && innobizSectorOfKsic('62090').candidates.includes('bio'))
  check('HF 이노비즈: 바이오 · 환경 후보 코드(C21 의약품 · E38 폐기물)는 평가표 확정 안 함 — 미확인을 비제조업으로 임의 확정 X', innobizSectorOfKsic('21210').sector === null && innobizSectorOfKsic('21210').candidates.join() === 'bio,environment,manufacturing' && innobizSectorOfKsic('38220').sector === null && innobizSectorOfKsic('38220').candidates.includes('environment'))
  check('HF 이노비즈: 후보 아닌 코드는 일반 업종 확정(C25 → 제조 · F42 → 건설 · G46 → 비제조 · M732 → 전문디자인)', innobizSectorOfKsic('25920').sector === 'manufacturing' && innobizSectorOfKsic('42201').sector === 'construction' && innobizSectorOfKsic('46510').sector === 'non_manufacturing' && innobizSectorOfKsic('73201').sector === 'design')
  check('AX 이노비즈: 별표2(KSIC 56111 음식점) 확인되면 제외 · 낱말(식당)만이면 확인 필요', assessInnobiz({ ...sm, industryText: '한식 음식점', industryGroup: 'service', ksic: '56111' }).recommendation === 'not_needed' && assessInnobiz({ ...sm, industryText: '한식 식당', industryGroup: 'service' }).recommendation !== 'not_needed')
  check('AX 이노비즈: KSIC 없으면 제외업종 여부 확인 필요 문구', assessInnobiz(sm).reasons.some((r) => r.text.includes('제외 업종(별표2) 여부는 KSIC')))
  // 메인비즈 — 낱말 신호 · 일부만 제외 코드
  check("AX 메인비즈: KSIC 33402('중' 일부만 제외) → 확정 제외 아님 · 세부 업종 확인", (() => { const m = assessMainbiz({ ...sm, ksic: '33402' }); return m.recommendation !== 'not_needed' && m.reasons.some((r) => r.text.includes('세부 사업내용 확인 필요')) })())
  // 벤처 — 세부 업종 · 범위값 · 3년 미만
  const vMach = assessVenture({ ...sm, ksic: '29199', rndExpense: 180_000_000, revenue: 3_000_000_000 })
  check('AX 벤처: 기계 제조(29199) 매출 30억 · 연구개발비 6% → 기준 7% 미만(기타 제조 5% 로 보지 않음)', vMach.reasons.some((r) => r.state === 'warn' && r.text.includes('기준 7%')) && !vMach.reasons.some((r) => r.text.includes('기준 5%')), vMach.reasons)
  const vNoKsic = assessVenture({ ...sm, rndExpense: 180_000_000, revenue: 3_000_000_000 })
  check("AX 벤처: KSIC 없으면 '제조업 5%' 기본값 없이 세부 업종 확인 필요", vNoKsic.reasons.some((r) => r.state === 'unknown' && r.text.startsWith('세부 업종 확인 필요')) && !vNoKsic.reasons.some((r) => /기준 5(\.0)?%/.test(r.text)), vNoKsic.reasons)
  const pRange = normalizeCertProfile({ rndRange: '50m_100m', researchUnit: 'lab', patents: 1 })
  const cRange = certContextOf(normalizeClientOps({ id: 'r1', companyName: '범위상사', establishedAt: '2018-01-01', industry: '산업용 기계 제조' } as never), TODAY, pRange)
  const vRange = assessVenture(cRange)
  check("AX 범위값: '5천만~1억' 은 7천만원으로 계산하지 않는다(정확한 금액 null · 범위만)", cRange.rndExpense === null && cRange.rndRange === '50m_100m' && !JSON.stringify(vRange).includes('7,000만원') && !JSON.stringify(cRange.basis).includes('7,000'), cRange.basis)
  check('AX 범위값: 벤처는 정확한 연구개발비 확인 필요 · 연구개발유형 가능성(지금 추천 아님)', vRange.reasons.some((r) => r.state === 'unknown' && r.text.startsWith('정확한 연구개발비 확인 필요')) && vRange.recommendation === 'possible' && vRange.oneLine.includes('정확한 연구개발비'), { rec: vRange.recommendation, reasons: vRange.reasons })
  check("AX 범위값: 예전 저장값(rndExpenseMan 7000)은 범위로만 옮김", normalizeCertProfile({ rndExpenseMan: 7000 }).rndRange === '50m_100m' && normalizeCertProfile({ rndExpenseMan: 7000 }).rndExactMan === null && normalizeCertProfile({ rndExpenseMan: 0 }).rndRange === 'none')
  check('AX 범위값: 정확한 금액(6,200만원)을 적으면 그 금액으로 판단', certContextOf(normalizeClientOps({ id: 'r2', companyName: 'x' } as never), TODAY, normalizeCertProfile({ rndRange: '50m_100m', rndExactMan: 6200 })).rndExpense === 62_000_000)
  check('AX 범위값: 5천만원 미만 범위는 기준 미달(정확한 금액 없이도 분명)', assessVenture({ ...sm, rndExpense: null, rndRange: 'under_50m' }).reasons.some((r) => r.state === 'warn' && r.text.includes('5천만원 미만')))
  const young = assessVenture({ ...sm, years: 2, months: 26, ksic: '29199', rndExpense: 60_000_000, revenue: 4_000_000_000 })
  check('AX 벤처: 창업 3년 미만은 매출 대비 비율 미적용(5천만원 이상은 그대로)', young.reasons.some((r) => r.state === 'ok' && r.text.includes('비율 미적용')) && !young.reasons.some((r) => r.text.includes('매출 대비 연구개발비')) && assessVenture({ ...sm, years: 2, months: 26, rndExpense: 40_000_000 }).reasons.some((r) => r.state === 'warn' && r.text.includes('미만')))
  // 사실 우선순위 — 확인된 연구소 기록이 예전 '연구소 없음' 칩을 이긴다
  const labRows = [{ data: { key: 'pmsaas:clients:v1', value: [{ id: 'p1', labType: '기업부설연구소', certifiedDate: '2025-02-01', researcherCount: 3 }] } }]
  const recP = normalizeClientOps({ id: 'p1', companyName: '우선상사', establishedAt: '2018-01-01' } as never)
  const cP = certContextOf(recP, TODAY, normalizeCertProfile({ researchUnit: 'none', researchers: 0 }), { lab: labcareFactsOf(labRows, 'p1') })
  check("AX 사실 우선: 연구소 관리 기록(인정) > 예전 칩 '없음' · 다르면 안내", cP.researchUnit === 'lab' && cP.researchers === 3 && (cP.conflicts ?? []).length === 2 && basisFor('lab', cP).some((b) => b.field === 'researchUnit' && b.state === 'confirmed'), { unit: cP.researchUnit, conflicts: cP.conflicts })
  check('AX 사실 우선: 확인된 사실이 없을 때만 칩', certContextOf(recP, TODAY, normalizeCertProfile({ researchUnit: 'none' })).researchUnit === 'none' && !certContextOf(recP, TODAY, normalizeCertProfile({ researchUnit: 'none' })).conflicts)
  const recPat = normalizeClientOps({ id: 'p2', companyName: '특허상사', customFields: [{ id: 'a', group: 'credential', label: '특허증 1', value: '' }, { id: 'b', group: 'credential', label: '특허증 2', value: '' }] } as never)
  check('AX 사실 우선: 특허증 2건이 칩 0건을 이김 · 칩 3건이면(더 많음) 칩', certContextOf(recPat, TODAY, normalizeCertProfile({ patents: 0 })).patents === 2 && certContextOf(recPat, TODAY, normalizeCertProfile({ patents: 3 })).patents === 3)
  // 공식 문구
  check('AX ISO 14001: 발행일 2026-04-15 · "발행일 확인 못 함" 모순 없음', CERT_RULES.iso14001.unverified.length === 0 && CERT_RULES.iso14001.sources[0].effective === '2026-04-15' && !JSON.stringify(CERT_RULES.iso14001).includes('확인 못'))
  check('AX ISO 45001: 지금 판 2018 + Amd 1:2024 · 개정 과정 날짜(DIS 투표일) 없음 · 2027 상반기 예상', CERT_RULES.iso45001.sources[0].name.includes('Amd 1:2024') && !JSON.stringify(CERT_RULES.iso45001).includes('2026-08-09') && !JSON.stringify(CERT_RULES.iso45001).includes('DIS 투표') && CERT_RULES.iso45001.unverified[0].includes('2027년 상반기'))
  check('AX ISO 9001: 2026-09-16 발행 · 전환 2028-03-31 / 2029-09-30 · KAB 전환지침', CERT_RULES.iso9001.sources[0].effective === '2026-09-16' && CERT_RULES.iso9001.renewalNote.includes('2028-03-31') && CERT_RULES.iso9001.renewalNote.includes('2029-09-30') && CERT_RULES.iso9001.sources.some((x) => x.version.includes('KAB-TR-QMS')))
  check('AX 혜택: 설명에 출처 없는 숫자(%p · 점) 없음 · 숫자는 출처와 함께만', Object.values(CERT_RULES).every((r) => r.benefits.every((b) => !/\d\s*(%p|점)/.test(b.detail) && (!b.figure || !!b.source))), Object.values(CERT_RULES).flatMap((r) => r.benefits.filter((b) => /\d\s*(%p|점)/.test(b.detail)).map((b) => b.id)))
  check('AX 벤처 재확인: 지금(2027-02-20까지) 2개월 전 ~ 1개월 후 · 2027-02-21부터 140일 전 · 시스템 공지(2026-09-28)와 고시 부칙 상이는 화면에 따로', CERT_RULES.venture.renewalNote.includes('2027-02-20까지') && CERT_RULES.venture.renewalNote.includes('2027-02-21') && CERT_RULES.venture.renewalNote.includes('140일') && (CERT_RULES.venture.conflicts ?? []).some((x) => x.includes('2026-09-28')))
  check('HF 메인비즈 2026 평가지표: 출처 2026-06-22 개편 · 업종별 지표 수(제조 · 건설 45 · 도소매 · 지식서비스 44 · 일반서비스 43) · 상이 표시 없음', CERT_RULES.mainbiz.sources.some((x) => x.effective === '2026-06-22' && x.name.includes('<개정 2026. 06. 22.>')) && ['제조업:45', '건설업:45', '도소매업:44', '지식서비스업:44', '일반서비스업:43'].every((k) => { const [l, n] = k.split(':'); return CERT_RULES.mainbiz.officialStructure!.rows.some((r) => r.label === l && r.value.startsWith(`${n}개`)) }) && !(CERT_RULES.mainbiz.conflicts ?? []).length)
  check('HF 메인비즈 제외: 주점(56211) · 주류도매(46331) 확정 제외 · 숙박(55101) · 음식점(56111) · 게임SW(58211)는 세부 사업내용 확인(자동 탈락 X)', assessMainbiz({ ...sm, ksic: '56211' }).recommendation === 'not_needed' && assessMainbiz({ ...sm, ksic: '46331' }).recommendation === 'not_needed' && ['55101', '56111', '58211'].every((k) => assessMainbiz({ ...sm, ksic: k }).recommendation !== 'not_needed' && assessMainbiz({ ...sm, ksic: k }).reasons.some((r) => r.text.includes('세부 사업내용 확인 필요'))))
  check('HF 메인비즈 제외: 낱말(숙박 · 담배)만으로 탈락 X', ['모텔 숙박업', '담배 소매'].every((t) => assessMainbiz({ ...sm, industryText: t }).recommendation !== 'not_needed'))
  check('HF 신청 제외(2026-06-22 신설): 이노비즈 · 메인비즈 공식 기준에 최근 3년 · 명단 공개 · 공표 · 시정명령 · 참여제한', ['innobiz', 'mainbiz'].every((k) => (CERT_RULES[k as 'innobiz'].officialScores ?? []).some((x) => x.label.startsWith('신청 제외') && ['최근 3년', '명단 공개', '공표', '시정명령', '참여제한'].every((w) => x.value.includes(w)))))
  // 진행 순서 — 전담부서가 이미 있어 '연구소 전환 검토' 이면 연구소를 맨 앞에 두지 않는다
  const deptCo = { ...sm, researchUnit: 'dept' as const, researchers: 2, rndPlan: true, ksic: '29199' }
  const rmDept = buildRoadmap(assessAll(deptCo), deptCo)
  check('AX 진행 순서: 전담부서 보유 → 연구소는 뒤(바탕일 때만 맨 앞)', rmDept.steps[0]?.id !== 'lab', rmDept.steps.map((x) => x.id))
  const noLabCo = { ...sm, researchUnit: 'none' as const, researchers: 3, rndPlan: true }
  check('AX 진행 순서: 연구조직이 없고 기술 인증을 노리면 연구소가 먼저', buildRoadmap(assessAll(noLabCo), noLabCo).steps[0]?.id === 'lab', buildRoadmap(assessAll(noLabCo), noLabCo).steps.map((x) => x.id))
  // 짧은 제출 전 확인
  const rows = gateRows(gSme)
  check('AX 제출 전 확인 요약: 네 줄(신청자격 · 공식 필수자료 · 대표 확인 · 보강) · 먼저 확인할 것은 반드시 확인부터', rows.map((r) => r.label).join() === '신청자격,공식 필수자료,대표 확인,보강' && rows[0].mark === 'check' && gateFirst(gSme)?.level === 'must')
}

/* ================= AX Hotfix — 벤처는 기업인증 안에서(유형별 길 · 진행 단계 · 제출 전 확인) ================= */
{
  const vc = ctx({ companyName: '벤처랩', years: 4, months: 50, industryText: '산업용 기계 제조', industryGroup: 'manufacturing', employees: 15, size: 'small', revenue: 2_000_000_000, researchUnit: 'lab', researchers: 3, patents: 2, rndRange: '50m_100m', evidence: ev('biz_reg', 'fin3', 'lab_cert', 'patent') })
  const routes = ventureRoutes(vc)
  check('HF 벤처 유형: 연구조직 · 범위만 → 연구개발유형은 확인 필요(확정 안 함) · 특허/연구소 → 혁신성장 검토 · 예비벤처 해당 없음', routes.find((r) => r.type === 'rnd')?.state === 'check' && routes.find((r) => r.type === 'growth')?.state === 'fit' && routes.find((r) => r.type === 'pre')?.state === 'no' && routes.find((r) => r.type === 'investment')?.state === 'check', routes)
  check('HF 벤처 유형: 연구조직 없음 → 연구개발유형 해당 없음 · 정보 없음 → 확인 필요', ventureRoutes({ ...vc, researchUnit: 'none' }).find((r) => r.type === 'rnd')?.state === 'no' && ventureRoutes(ctx({})).every((r) => r.state === 'check'))
  const sections = buildVenturePack(vc, {})
  check('HF 벤처 준비: 연구소 · 특허 · 재무가 회사 기록에서 칸에 들어감(다시 받지 않음)', sections.find((x) => x.id === 'ip')!.lines.some((l) => /특허/.test(l.text)) && sections.find((x) => x.id === 'rnd')!.lines.some((l) => /연구조직|인정서/.test(l.text)) && sections.find((x) => x.id === 'growth')!.lines.some((l) => /매출|재무제표/.test(l.text)))
  const p0 = ventureProgress({ sections, notes: {}, hasBizPlan: false, status: 'preparing' })
  const p1 = ventureProgress({ sections, notes: { [VENTURE_REVIEWED_KEY]: TODAY }, hasBizPlan: false, status: 'preparing' })
  const allOwner = Object.fromEntries(VENTURE_OWNER_SECTIONS.map((id) => [`venture:${id}`, '대표 답']))
  const p2 = ventureProgress({ sections: buildVenturePack(vc, allOwner), notes: { [VENTURE_REVIEWED_KEY]: TODAY, ...allOwner }, hasBizPlan: false, status: 'preparing' })
  const p3 = ventureProgress({ sections: buildVenturePack(vc, allOwner), notes: { [VENTURE_REVIEWED_KEY]: TODAY, ...allOwner }, hasBizPlan: true, status: 'preparing' })
  check('HF 벤처 단계: 준비 확인 → 대표 확인 → 사업계획 준비 → 제출 전 확인 → 신청 · 평가 → 완료', p0.stage === 'check' && p1.stage === 'owner' && p1.ownerLeft === 4 && p2.stage === 'plan' && p3.stage === 'submit' && ventureProgress({ sections, notes: {}, hasBizPlan: true, status: 'submitted' }).stage === 'applied' && ventureProgress({ sections, notes: {}, hasBizPlan: true, status: 'done' }).stage === 'done', [p0.stage, p1.stage, p2.stage, p3.stage])
  const rows = ventureSubmitCheck({ routes, progress: p1, missingEvidence: ['사업계획서'], haveEvidence: ['사업자등록증', '최근 재무제표'] })
  check('HF 벤처 제출 전 확인: 네 줄(신청 유형 · 기본 자료 · 대표 확인 · 사업계획) · 점수 · 확률 없음', rows.map((r) => r.label).join() === '신청 유형,기본 자료,대표 확인,사업계획' && rows[0].mark === 'ok' && rows[2].mark === 'todo' && rows[3].mark === 'todo' && !rows.some((r) => /%|점/.test(r.text)))
  check('HF 벤처 다음 행동: 판정의 다음 행동도 기업인증 안(옛 화면 열기 아님)', assessVenture(vc).nextAction.label === '벤처 준비 확인' && assessVenture(vc).nextAction.kind !== 'open_tool')

  // LEGACY 어댑터 — 예전 '특허+벤처' 프로젝트는 읽기만 · 출원 중은 보유로 세지 않음
  const proj = (over: Record<string, unknown>) => ({ id: 'p', clientId: 'c1', title: '예전 특허 · 벤처', status: 'active', updatedAt: '2026-09-01T00:00:00.000Z', factsheet: {}, patent: { filingStatus: 'none' }, venture: { sections: {} }, ...over }) as never
  const filedProj = proj({ patent: { filingStatus: 'filed', applicationNumber: '10-2026-0000001', filedAt: '2026-08-01' }, venture: { sections: { 1: { done: true }, 2: { done: true } }, submittedAt: '' } })
  const snapshot = JSON.stringify(filedProj)
  const lf = legacyVentureFactsOf([proj({ id: 'other', clientId: 'c2' }), proj({ id: 'empty' }), filedProj, proj({ id: 'arch', status: 'archived', patent: { filingStatus: 'registered' } })], 'c1')
  check('HF legacy 읽기: 같은 업체 · 보관 제외 · 기록 많은 것 하나(출원 중 · 초안 2칸)', lf?.patentStatus === 'filed' && lf.applicationNumber === '10-2026-0000001' && lf.planDone === 2 && lf.projectTitle === '예전 특허 · 벤처', lf)
  check('HF legacy 읽기: 원본을 고치지 않음 · 빈 프로젝트만 있으면 null', JSON.stringify(filedProj) === snapshot && legacyVentureFactsOf([proj({})], 'c1') === null && legacyVentureFactsOf(null, 'c1') === null)
  const recL = normalizeClientOps({ id: 'c1', companyName: '예전상사', establishedAt: '2020-01-01', industry: '소프트웨어 개발' } as never)
  const cFiled = certContextOf(recL, TODAY, normalizeCertProfile({}), { legacy: lf })
  check('HF 출원 중은 특허 보유로 세지 않음(patents null) · 벤처 판단은 등록 확인 필요', cFiled.patents === null && assessVenture(cFiled).reasons.some((x) => x.state === 'unknown' && /^특허 등록 여부 — 특허 출원 중\(10-2026-0000001\) · 등록 확인 필요/.test(x.text)) && !assessVenture(cFiled).reasons.some((x) => /특허 1건/.test(x.text)), assessVenture(cFiled).reasons)
  const packL = buildVenturePack(cFiled, {})
  check('HF 출원 중 → 벤처 준비 지식재산 · 기술 칸에 출처와 함께(다시 묻지 않음) · 혁신성장유형 검토', packL.find((x) => x.id === 'ip')!.lines.some((l) => /출원 중/.test(l.text) && /이전 컨설팅/.test(l.basis)) && packL.find((x) => x.id === 'tech')!.lines.some((l) => /출원 중/.test(l.text)) && ventureRoutes(cFiled).find((r) => r.type === 'growth')?.state === 'fit')
  const lfReg = { ...lf!, patentStatus: 'registered' as const }
  const cReg = certContextOf(recL, TODAY, normalizeCertProfile({}), { legacy: lfReg })
  const cRegChip0 = certContextOf(recL, TODAY, normalizeCertProfile({ patents: 0 }), { legacy: lfReg })
  check('HF 등록 기록은 확인된 전문 기록(1건 이상) · 칩 \'없음\' 과 다르면 충돌로 보여 줌', cReg.patents === 1 && cRegChip0.patents === 1 && cRegChip0.conflicts.some((x) => /이전 컨설팅 프로젝트 기록/.test(x)))
}

// Core 는 OS 를 모른다 — core · rules · innobiz · mainbiz · iso 는 그 밖(services · pages · components · tools · types)을 import 하지 않는다
{
  const files = import.meta.glob(['../core/*.ts', '../rules/*.ts', '../innobiz/*.ts', '../mainbiz/*.ts', '../iso/*.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
  const bad = Object.entries(files).filter(([, src]) => /from\s+'\.\.\/\.\.\//.test(src)).map(([f]) => f)
  check(`Core 독립: ${Object.keys(files).length}개 파일이 OS 를 import 하지 않는다`, Object.keys(files).length >= 14 && bad.length === 0, bad)
}

console.log(`\ncert: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
