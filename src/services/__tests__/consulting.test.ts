/**
 * 컨설팅 워크플로 엔진 · 계약 테스트
 *  - 단계 정의 S0~S16 · 사실표 스키마 · 핵심 줄기 경고 · 게이트 · 다음 행동 결정성
 *  - 프롬프트 꾸러미 결정성(같은 입력 → 같은 출력) · 개인정보 필터 · 결과 들여오기
 *  - KIPO 118종 · 금지어 · 저장 모델 정규화 · 모듈 레지스트리 항목
 * 실행: npm run test:consulting
 */

import { STAGES, STAGE_ORDER, stageDef, nextStageKey, prevStageKey, stagesByGroup } from '../../domain/consulting/workflowDefinition'
import { FACTS, factCompleteness, factsheetToText, missingFacts, seedFactsFromClient } from '../../domain/consulting/factsheetSchema'
import { normalizeProject, projectProgress, emptyStages, CORE_THREAD_KEYS } from '../../domain/consulting/projectModel'
import { coreThreadWarnings, sharedWords } from '../../domain/consulting/coreThread'
import { canCompleteStage, canSkipStage, freshnessOk, gateCheckedCount } from '../../domain/consulting/gateEngine'
import { resolveNextActions, nextOpenStage } from '../../domain/consulting/nextActionResolver'
import { buildPromptPackage, PROMPT_TYPES, PROMPT_DEFAULT_STAGE } from '../../domain/consulting/promptPackageBuilder'
import { redactSensitive } from '../../domain/consulting/privacyFilter'
import { parsePastedResult, artifactHeaderLine } from '../../domain/consulting/resultImport'
import { KIPO_REFERENCES, kipoSelectionIssues, searchKipo, kipoPdfUrl } from '../../domain/consulting/kipoReferences'
import { RED_FLAGS, JUDGE_AXES, EVIDENCE_SLOTS, PLAN_SECTIONS, findForbiddenPhrases, judgeTotal, judgeVerdict } from '../../domain/consulting/qaRules'
import { artifactTypeForPrompt } from '../../domain/consulting/artifactDefinitions'
import { nextVersion } from '../consultingStudioService'
import { MODULES, MODULE_GROUPS, moduleForPath } from '../../config/moduleRegistry'
import type { ConsultingArtifact, ConsultingProject } from '../../types/consulting'
import type { ClientOpsRecord } from '../../types/clientOps'
import { normalizeClientOps } from '../clientOpsService'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const TODAY = '2026-09-08'
const NOW = '2026-09-08T09:00:00.000Z'

function project(p: Partial<ConsultingProject> = {}): ConsultingProject {
  return normalizeProject({ id: 'p1', clientId: 'c1', clientName: '한솔테크', title: '특허·벤처', createdAt: NOW, updatedAt: NOW, ...p })
}

function client(p: Partial<ClientOpsRecord> = {}): ClientOpsRecord {
  return normalizeClientOps({ id: 'c1', companyName: '한솔테크', representativeName: '김대표', establishedAt: '2019-03-02', businessAddress: '경기도 남양주시 진접읍 1', businessNumber: '123-45-67890', corporateNumber: '110111-1234567', businessCategory: '제조업', businessItem: '간판', employeeCount: '7', ...p })
}

/* ------------------------------------------------------------------ */
/* 1. 단계 정의                                                          */
/* ------------------------------------------------------------------ */
check('stages: S0~S16 17개', STAGES.length === 17 && STAGE_ORDER[0] === 'S0' && STAGE_ORDER[16] === 'S16')
check('stages: 키 중복 없음', new Set(STAGE_ORDER).size === 17)
check('stages: 다섯 묶음 순서', stagesByGroup().map((g) => g.group).join() === 'understand,patent,mvp,venture,submit')
check('stages: 특허 묶음 = S3~S7', stagesByGroup()[1].stages.map((s) => s.key).join() === 'S3,S4,S5,S6,S7')
check('stages: 모든 단계에 목적·exit checklist', STAGES.every((s) => s.purpose.length > 10 && s.exitChecklist.length >= 2))
check('stages: next/prev', nextStageKey('S0') === 'S1' && nextStageKey('S16') === null && prevStageKey('S0') === null && prevStageKey('S9') === 'S8')
check('stages: 특허 단계는 건너뛸 수 있고 MVP 잠금은 못 건너뛴다', stageDef('S3').skippable && !stageDef('S8').skippable)
check('stages: 필요 사실 키가 모두 스키마에 있다', STAGES.every((s) => s.requiredFacts.every((k) => FACTS.some((f) => f.key === k))))
check('stages: 프롬프트 종류가 정의된 것만', STAGES.every((s) => s.promptTypes.every((t) => PROMPT_TYPES.includes(t))))

/* ------------------------------------------------------------------ */
/* 2. 사실표                                                             */
/* ------------------------------------------------------------------ */
check('facts: 45항목 · 7묶음', FACTS.length === 45 && new Set(FACTS.map((f) => f.section)).size === 7)
check('facts: 키 중복 없음', new Set(FACTS.map((f) => f.key)).size === FACTS.length)
check('facts: 주민번호·비밀번호·계좌 항목이 없다', !FACTS.some((f) => /주민|비밀번호|계좌|password/i.test(f.label + f.key)))
{
  const seeded = seedFactsFromClient({}, client(), NOW)
  check('facts: 고객 기록에서 회사 기본값을 가져온다', seeded.companyName?.value === '한솔테크' && seeded.representative?.value === '김대표' && seeded.employees?.value === '7')
  check('facts: 가져온 값은 미확인 · 출처 표시', seeded.companyName?.status === 'unverified' && seeded.companyName?.source === '고객 운영 기록')
  check('facts: 업태·종목을 합쳐 업종으로', seeded.industry?.value === '제조업 · 간판')
  const twice = seedFactsFromClient({ companyName: { value: '이미 확정', status: 'confirmed', source: '등기', asOfDate: '', note: '', updatedAt: null } }, client(), NOW)
  check('facts: 이미 있는 값은 덮지 않는다', twice.companyName?.value === '이미 확정')
  const c = factCompleteness(seeded)
  check('facts: 완성도 계산', c.total === 45 && c.filled === 8 && c.bySection.company.filled === 7)
  check('facts: 빈 필수 항목', missingFacts(seeded, ['companyName', 'coreProblem']).join() === 'coreProblem')
  const text = factsheetToText(seeded)
  check('facts: 텍스트에 묶음 제목과 상태', text.includes('[회사 기본]') && text.includes('회사명: 한솔테크 (미확인'))
}

/* ------------------------------------------------------------------ */
/* 3. 핵심 줄기 경고                                                     */
/* ------------------------------------------------------------------ */
check('thread: 8칸', CORE_THREAD_KEYS.length === 8)
check('thread: 낱말 겹침 — 작업지연 위험분석 vs 작업지연 위험도 예측', sharedWords('작업지연 위험분석 시스템', '작업지연 위험도를 예측한다').length > 0)
check('thread: 낱말 겹침 없음 — 예약 플랫폼 vs 재고 최적화', sharedWords('고객 예약 플랫폼', '재고 최적화').length === 0)
{
  const p = project({
    coreThread: { fieldProblem: 'x', existingMethod: 'y', coreTech: '작업지연 위험분석', patentPoint: '고객 예약 플랫폼', axCore: '재고 최적화', platformSurface: '', ventureSentence: '', keyEvidence: '' },
  })
  const w = coreThreadWarnings(p)
  check('thread: 다른 기술로 읽히면 p1 두 건', w.filter((x) => x.severity === 'p1' && x.code.startsWith('thread_drift')).length === 2)
  const ok = project({ coreThread: { ...p.coreThread, patentPoint: '작업지연 위험 산출 순서', axCore: '작업지연 위험 점수' } })
  check('thread: 같은 낱말이면 경고 없음', coreThreadWarnings(ok).filter((x) => x.code.startsWith('thread_drift')).length === 0)
  const reg = project({ coreThread: { ...ok.coreThread, ventureSentence: '당사는 특허 등록 완료한 작업지연 기술로…' } })
  check('thread: 출원 상태에서 "등록" 은 p0', coreThreadWarnings(reg).some((x) => x.code === 'patent_registered_wording' && x.severity === 'p0'))
  const regOk = project({ ...reg, patent: { ...reg.patent, filingStatus: 'registered' } })
  check('thread: 실제 등록이면 경고 없음', !coreThreadWarnings(regOk).some((x) => x.code === 'patent_registered_wording'))
  const ai = project({ coreThread: { ...ok.coreThread, axCore: 'AI가 작업지연을 판단' }, mvp: { ...ok.mvp, axMode: 'rule' } })
  check('thread: Rule 인데 AI 라 부르면 p1', coreThreadWarnings(ai).some((x) => x.code === 'ax_called_ai'))
  const demo = project({ factsheet: { som: { value: '300억', status: 'demo', source: '', asOfDate: '', note: '', updatedAt: null } }, fieldReview: { ...ok.fieldReview, numbersToMemorize: ['som'] } })
  check('thread: 시연용 숫자를 외우게 하면 p0', coreThreadWarnings(demo).some((x) => x.code.startsWith('demo_number_memorized') && x.severity === 'p0'))
}

/* ------------------------------------------------------------------ */
/* 4. 게이트                                                             */
/* ------------------------------------------------------------------ */
{
  const base = project()
  const ctx = { artifacts: [] as ConsultingArtifact[], evidence: [], today: TODAY }
  const s0 = canCompleteStage(base, 'S0', ctx)
  check('gate: S0 는 회사 기본 사실이 없으면 막힌다', !s0.ok && s0.blockers[0].includes('사실표'))
  const seeded = project({ factsheet: seedFactsFromClient({}, client(), NOW) })
  const s0b = canCompleteStage(seeded, 'S0', { ...ctx })
  check('gate: 회사 기본 8항목 중 주요제품이 비어 있으면 아직 막힘', !s0b.ok && s0b.blockers[0].includes('주요 제품'))
  const s1 = canCompleteStage(seeded, 'S1', ctx)
  check('gate: S1 은 결정이 없으면 막힌다', s1.blockers.some((b) => b.includes('GO / HOLD / NO-GO')))
  check('gate: GO 체크 수', gateCheckedCount(project({ gate: { items: { knowsProblem: true, mvpShowable: true }, decision: null, reason: '', decidedAt: null } })) === 2)
  const s3 = canCompleteStage(project({ factsheet: { coreTech: { value: 'x', status: 'confirmed', source: '', asOfDate: '', note: '', updatedAt: null } } }), 'S3', ctx)
  check('gate: S3 는 산출물(PATENT_IDEA)이 없으면 막힌다', s3.blockers.some((b) => b.includes('PATENT_IDEA')))
  const art: ConsultingArtifact = { id: 'a1', workspaceId: null, projectId: 'p1', type: 'PATENT_IDEA', title: 't', stageKey: 'S3', version: 1, status: 'draft', content: 'c', source: 'llm_paste', promptPackageId: null, fileName: '', createdAt: NOW, updatedAt: NOW }
  const s3ok = canCompleteStage(project({ factsheet: { coreTech: { value: 'x', status: 'confirmed', source: '', asOfDate: '', note: '', updatedAt: null } } }), 'S3', { ...ctx, artifacts: [art] })
  check('gate: 산출물이 있으면 S3 통과', s3ok.ok, s3ok.blockers.join(' | '))
  check('gate: 대체된 산출물은 세지 않는다', !canCompleteStage(project({ factsheet: { coreTech: { value: 'x', status: 'confirmed', source: '', asOfDate: '', note: '', updatedAt: null } } }), 'S3', { ...ctx, artifacts: [{ ...art, status: 'superseded' }] }).ok)
  const s7 = canCompleteStage(project({ patent: { ...base.patent, filingStatus: 'filed', applicationNumber: '10-2026-0001', filedAt: '2026-09-01' }, factsheet: { patent: { value: '출원 중', status: 'confirmed', source: '', asOfDate: '', note: '', updatedAt: null } } }), 'S7', { ...ctx, artifacts: [{ ...art, type: 'PATENT_FILING_RECORD' }] })
  check('gate: S7 은 최신 기준 확인이 없으면 막힌다 (K9)', s7.blockers.some((b) => b.includes('최신 공식 기준')))
  const fresh = project({ freshness: [{ scope: 'patent_filing', checkedAt: '2026-08-20', source: '특허로', differences: '' }] })
  check('gate: 30일 이내 확인은 유효', freshnessOk(fresh, 'patent_filing', TODAY) && !freshnessOk(fresh, 'venture_application', TODAY))
  const stale = project({ freshness: [{ scope: 'patent_filing', checkedAt: '2026-07-01', source: '특허로', differences: '' }] })
  check('gate: 30일 지난 확인은 무효', !freshnessOk(stale, 'patent_filing', TODAY))
  const s13 = canCompleteStage(project(), 'S13', { ...ctx, artifacts: [{ ...art, type: 'QA_REPORT' }] })
  check('gate: S13 은 P0 12개 확인 없이는 막힌다', s13.blockers.some((b) => b.includes('P0 Red Flag 미확인 12개')))
  const s12 = canCompleteStage(project(), 'S12', { ...ctx, artifacts: [{ ...art, type: 'CLAIM_EVIDENCE_MATRIX' }] })
  check('gate: S12 는 빈 슬롯을 알려 준다', s12.blockers.some((b) => b.includes('비어 있는 첨부 슬롯: 1, 2, 3')))
  check('skip: 이유 없이 못 건너뛴다', !canSkipStage('S3', '').ok && canSkipStage('S3', '이미 등록 특허 보유').ok)
  check('skip: 못 건너뛰는 단계', !canSkipStage('S8', '이유').ok)
}

/* ------------------------------------------------------------------ */
/* 5. 다음 행동 — 결정성                                                  */
/* ------------------------------------------------------------------ */
{
  const ctx = { artifacts: [], prompts: [], evidence: [], today: TODAY }
  const p = project()
  const a = resolveNextActions(p, ctx)
  const b = resolveNextActions(p, ctx)
  check('next: 같은 입력 → 같은 출력', JSON.stringify(a) === JSON.stringify(b))
  check('next: 최대 3개', a.length <= 3 && a.length > 0)
  check('next: 빈 프로젝트의 첫 행동은 사실표 채우기', a[0].kind === 'fill_fact' && a[0].tab === 'factsheet')
  const stages = emptyStages()
  stages.S4 = { ...stages.S4, status: 'blocked', blockedBy: 'KIPRIS 접속 불가' }
  const blocked = resolveNextActions(project({ stages, currentStage: 'S4' }), ctx)
  check('next: 막힘이 있으면 맨 앞', blocked[0].kind === 'resolve_block' && blocked[0].why.includes('KIPRIS'))
  const s3 = project({ currentStage: 'S3', gate: { items: {}, decision: 'go', reason: 'ok', decidedAt: NOW }, factsheet: { coreTech: { value: '작업지연 위험분석', status: 'confirmed', source: '', asOfDate: '', note: '', updatedAt: null } }, coreThread: { fieldProblem: 'a', existingMethod: 'b', coreTech: 'c', patentPoint: '', axCore: '', platformSurface: '', ventureSentence: '', keyEvidence: '' } })
  const n3 = resolveNextActions(s3, ctx)
  check('next: S3 에서 산출물이 없으면 프롬프트 만들기', n3.some((x) => x.kind === 'generate_prompt' && x.focus === 'PATENT_IDEA'))
  const withPrompt = resolveNextActions(s3, { ...ctx, prompts: [{ id: 'q', workspaceId: null, projectId: 'p1', type: 'PATENT_IDEA', target: 'general', stageKey: 'S3', title: '', prompt: '', context: '', privacy: { rrn: 0, account: 0, password: 0, secret: 0, email: 0, phone: 0, total: 0 }, section: null, createdAt: NOW }] })
  check('next: 프롬프트는 있고 결과가 없으면 들여오기', withPrompt.some((x) => x.kind === 'import_result' && x.focus === 'PATENT_IDEA'))
  const noGate = resolveNextActions(project({ currentStage: 'S3' }), ctx)
  check('next: 게이트 미결이면 GO/HOLD 먼저', noGate[0].kind === 'answer_gate')
  check('next: 완료된 프로젝트는 행동 없음', resolveNextActions(project({ status: 'done' }), ctx).length === 0)
  const st = emptyStages()
  st.S0.status = 'completed'; st.S1.status = 'completed'; st.S2.status = 'skipped'
  check('next: 다음 미완료 단계', nextOpenStage(project({ stages: st }), 'S0') === 'S3')
}

/* ------------------------------------------------------------------ */
/* 6. 프롬프트 꾸러미 — 결정성 · 범위 · 필터                                */
/* ------------------------------------------------------------------ */
{
  const p = project({
    factsheet: {
      ...seedFactsFromClient({}, client(), NOW),
      coreTech: { value: '작업지연 위험분석', status: 'confirmed', source: '인터뷰', asOfDate: '2026-09-01', note: '', updatedAt: NOW },
      som: { value: '300억원', status: 'planned', source: '통계청', asOfDate: '2025', note: '2,800개 × 3% × 360만원', updatedAt: NOW },
    },
    coreThread: { fieldProblem: '납기 지연', existingMethod: '엑셀', coreTech: '작업지연 위험분석', patentPoint: '위험 산출 순서', axCore: '위험 점수', platformSurface: '거래처 포털', ventureSentence: '작업지연 위험분석 기반 …', keyEvidence: 'MVP 화면' },
  })
  for (const type of PROMPT_TYPES) {
    const x = buildPromptPackage({ project: p, type, target: 'general', section: 4, slot: 6 })
    const y = buildPromptPackage({ project: p, type, target: 'general', section: 4, slot: 6 })
    check(`prompt ${type}: 결정성`, x.prompt === y.prompt && x.context === y.context)
    check(`prompt ${type}: 머리줄 요구`, x.prompt.includes(`[ARTIFACT] type=${artifactTypeForPrompt(type)} stage=${PROMPT_DEFAULT_STAGE[type]}`))
    check(`prompt ${type}: 크기 상한 (Master 통째로 넣지 않음)`, x.prompt.length < 9000, String(x.prompt.length))
    check(`prompt ${type}: 항상 지킬 것 포함`, x.prompt.includes('특허출원 중') && x.prompt.includes('AI'))
  }
  const g = buildPromptPackage({ project: p, type: 'PATENT_IDEA', target: 'general' })
  check('prompt: 사실표 발췌에 상태·출처', g.prompt.includes('핵심 해결기술: 작업지연 위험분석 (확정 · 2026-09-01 · 출처: 인터뷰)'))
  check('prompt: PATENT_IDEA 는 시장 숫자를 싣지 않는다 (SCOPED)', !g.prompt.includes('SOM: 300억원'))
  check('prompt: Context 에는 사실표 전체', g.context.includes('SOM: 300억원') && g.context.includes('산식/비고: 2,800개'))
  const v4 = buildPromptPackage({ project: p, type: 'VENTURE_PLAN_SECTION', target: 'chatgpt', section: 4 })
  check('prompt: 사업계획서 4 = 목표시장', v4.title.includes('4. 목표시장') && v4.prompt.includes('TAM(전체 잠재)') && v4.section === 4)
  const cc = buildPromptPackage({ project: p, type: 'MVP_CLAUDE_CODE_BUILD', target: 'claude_code' })
  check('prompt: Claude Code 대상은 세션 안내로 시작', cc.prompt.startsWith('[이 프롬프트는 Claude Code'))
  check('prompt: 개인정보 없음이면 가림 0', g.privacy.total === 0)

  // 필터 — 사실표에 위험 값이 있어도 밖으로 나가지 않는다
  const leaky = project({ factsheet: { ceoCareer: { value: '주민 900101-1234567, 계좌번호 110-123-456789, 비밀번호: abcd1234, 연락 010-1234-5678, kim@example.com, key sk-abcdefghijklmnop', status: 'confirmed', source: '', asOfDate: '', note: '', updatedAt: null } } })
  const lp = buildPromptPackage({ project: leaky, type: 'GENERAL_PROJECT_REVIEW', target: 'general' })
  check('privacy: 주민번호가 나가지 않는다', !lp.prompt.includes('900101-1234567') && !lp.context.includes('900101-1234567'))
  check('privacy: 계좌·비밀번호·휴대폰·이메일·API키 가림', !/110-123-456789|abcd1234|010-1234-5678|kim@example\.com|sk-abcdefghijklmnop/.test(lp.prompt + lp.context))
  check('privacy: 보고서 합계 (본문+맥락)', lp.privacy.rrn >= 1 && lp.privacy.account >= 1 && lp.privacy.password >= 1 && lp.privacy.phone >= 1 && lp.privacy.email >= 1 && lp.privacy.secret >= 1)
  const r = redactSensitive('사업자등록번호 123-45-67890 은 그대로, 법인 110111-1234567 도 그대로')
  check('privacy: 사업자·법인번호는 가리지 않는다', r.report.total === 0 && r.text.includes('123-45-67890') && r.text.includes('110111-1234567'))
  const r2 = redactSensitive('인증서 비밀번호 Qwer!234 를 전달')
  check('privacy: 인증서 비밀번호 값만 가림', r2.text.includes('[가림:비밀번호]') && !r2.text.includes('Qwer!234'))
  const r3 = redactSensitive('service_role=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnopqrstuvwxyz')
  check('privacy: JWT 형태 비밀 가림', !r3.text.includes('eyJhbGci'))
}

/* ------------------------------------------------------------------ */
/* 7. 결과 들여오기                                                       */
/* ------------------------------------------------------------------ */
{
  const head = artifactHeaderLine('PATENT_IDEA', 'S3', '특허 아이디어 "1차"')
  const parsed = parsePastedResult(`${head}\n\n# 결과\n본문`)
  check('import: 머리줄 인식', parsed.hadHeader && parsed.type === 'PATENT_IDEA' && parsed.stage === 'S3' && parsed.title === "특허 아이디어 '1차'")
  check('import: 본문에서 머리줄 제거', parsed.body.startsWith('# 결과'))
  const noHead = parsePastedResult('## 선행기술 검토 결과\n내용')
  check('import: 머리줄 없으면 제목만 추출', !noHead.hadHeader && noHead.type === null && noHead.title === '선행기술 검토 결과')
  const bad = parsePastedResult('[ARTIFACT] type=NOPE stage=S99\n본문')
  check('import: 모르는 종류·단계는 null', bad.hadHeader && bad.type === null && bad.stage === null)
  const arts: ConsultingArtifact[] = [
    { id: '1', workspaceId: null, projectId: 'p1', type: 'PATENT_IDEA', title: '', stageKey: 'S3', version: 1, status: 'superseded', content: '', source: 'manual', promptPackageId: null, fileName: '', createdAt: NOW, updatedAt: NOW },
    { id: '2', workspaceId: null, projectId: 'p1', type: 'PATENT_IDEA', title: '', stageKey: 'S3', version: 2, status: 'draft', content: '', source: 'manual', promptPackageId: null, fileName: '', createdAt: NOW, updatedAt: NOW },
    { id: '3', workspaceId: null, projectId: 'p2', type: 'PATENT_IDEA', title: '', stageKey: 'S3', version: 7, status: 'draft', content: '', source: 'manual', promptPackageId: null, fileName: '', createdAt: NOW, updatedAt: NOW },
  ]
  check('version: 같은 프로젝트·같은 종류에서만 +1', nextVersion(arts, 'p1', 'PATENT_IDEA') === 3 && nextVersion(arts, 'p1', 'MVP_SPEC') === 1)
}

/* ------------------------------------------------------------------ */
/* 8. KIPO · QA 규칙                                                     */
/* ------------------------------------------------------------------ */
check('kipo: 118종', KIPO_REFERENCES.length === 118 && new Set(KIPO_REFERENCES.map((r) => r.code)).size === 118)
check('kipo: 분야별 수 9/18/16/22/32/21', ['living', 'digital', 'electric', 'chem', 'mech', 'semi'].map((c) => KIPO_REFERENCES.filter((r) => r.category === c).length).join() === '9,18,16,22,32,21')
check('kipo: PDF 주소 규칙', kipoPdfUrl('0217') === 'https://www.patent.go.kr/smart/jsp/kiponet/common/AllRouteDown.do?fn=example/02/0217&fh=pdf')
check('kipo: 검색 (머신 러닝)', searchKipo('머신 러닝').some((r) => r.code === '0304'))
check('kipo: 검색 분야 제한', searchKipo('', 'semi').length === 21)
check('kipo: 1종은 부족', kipoSelectionIssues([{ code: '0208', reason: 'r', pdfAttached: true }]).some((i) => i.includes('최소 2종')))
check('kipo: 6종은 초과', kipoSelectionIssues(['0208', '0217', '0304', '0306', '0201', '0202'].map((c) => ({ code: c, reason: 'r', pdfAttached: true }))).some((i) => i.includes('최대 5종')))
check('kipo: PDF 미첨부 안내', kipoSelectionIssues([{ code: '0208', reason: 'r', pdfAttached: false }, { code: '0217', reason: 'r', pdfAttached: true }]).some((i) => i.includes('PDF')))
check('kipo: 2종 · 이유 · PDF 면 통과', kipoSelectionIssues([{ code: '0208', reason: 'r', pdfAttached: true }, { code: '0217', reason: 'r', pdfAttached: true }]).length === 0)
check('qa: P0 12 · Judge 10 · 슬롯 10 · 항목 7', RED_FLAGS.length === 12 && JUDGE_AXES.length === 10 && EVIDENCE_SLOTS.length === 10 && PLAN_SECTIONS.length === 7)
check('qa: 금지어 탐지', findForbiddenPhrases('국내 최초로 특허 등록 완료한 유일한').length === 3)
check('qa: judge 합계는 10축 다 있어야', judgeTotal({ A: 9 }) === null && judgeTotal({ A: 9, B: 9, C: 9, D: 9, E: 9, F: 9, G: 9, H: 9, I: 9, J: 9 }) === 90 && judgeVerdict(90) === '제출 권장' && judgeVerdict(69) === 'HOLD 재검토')

/* ------------------------------------------------------------------ */
/* 9. 저장 모델 · 진행도 · 레지스트리                                       */
/* ------------------------------------------------------------------ */
{
  const raw = normalizeProject({ id: 'x', clientId: 'c', createdAt: NOW, updatedAt: NOW, currentStage: 'S99' as never, stages: { S3: { status: 'completed' } } as never })
  check('model: 잘못된 단계는 S0 로, 일부 단계만 있어도 17개 채움', raw.currentStage === 'S0' && Object.keys(raw.stages).length === 17 && raw.stages.S3.status === 'completed')
  check('model: 진행도', projectProgress(raw).done === 1 && projectProgress(raw).total === 17)
  check('model: 기본 제출서류 8종', Object.keys(raw.venture.documents).length === 8)
}
check('registry: 컨설팅 작업실 모듈이 /studio 로 켜져 있다', MODULES.some((m) => m.path === '/studio' && m.enabled))
check('registry: 그룹 정의', MODULE_GROUPS.some((g) => g.key === 'consulting'))
check('registry: /studio/abc → 컨설팅 작업실', moduleForPath('/studio/abc')?.path === '/studio')

console.log(`\n컨설팅 엔진: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
