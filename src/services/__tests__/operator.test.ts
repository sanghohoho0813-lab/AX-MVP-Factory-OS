/**
 * 운영자 레이어 계약 테스트 — 간단 모드가 실제로 간단한지 숫자로 확인한다.
 *   - resolveCurrentTask 결정성 · 단계별 흐름
 *   - applyTask 자동 부작용 · 자동 단계 전환
 *   - 구조화 반환 블록 파싱 (실패해도 원문 보존)
 *   - 클릭 수 목표 (§45) 실제 시뮬레이션
 * 실행: npm run test:operator
 */

import { resolveCurrentTask, overallPercent, activeStage, type TaskContext } from '../../domain/consulting/currentTask'
import { applyTask, type TaskSubmission } from '../../domain/consulting/applyTask'
import { parseReturnBlock, stripReturnBlock, returnBlockInstruction, RETURN_BEGIN } from '../../domain/consulting/returnBlock'
import { buildPromptPackage } from '../../domain/consulting/promptPackageBuilder'
import { normalizeProject } from '../../domain/consulting/projectModel'
import { seedFactsFromClient } from '../../domain/consulting/factsheetSchema'
import { CORE_PROBLEM_CHOICES } from '../../domain/consulting/operatorChoices'
import { normalizeClientOps } from '../clientOpsService'
import type { ConsultingArtifact, ConsultingProject, ConsultingPromptPackage } from '../../types/consulting'
import type { ClientOpsRecord } from '../../types/clientOps'

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

function client(p: Partial<ClientOpsRecord> = {}): ClientOpsRecord {
  return normalizeClientOps({
    id: 'c1', companyName: '하나정보통신', representativeName: '김대표', establishedAt: '2019-03-02',
    businessAddress: '경기도 남양주시 진접읍 1', businessNumber: '123-45-67890', businessCategory: '제조업', businessItem: '산업용 부품', employeeCount: '7', ...p,
  })
}

function project(over: Partial<ConsultingProject> = {}): ConsultingProject {
  return normalizeProject({ id: 'p1', clientId: 'c1', clientName: '하나정보통신', title: '특허 · 벤처 · MVP', createdAt: NOW, updatedAt: NOW, ...over })
}

/** 고객 기록에서 시드된, 실제로 새로 만든 것과 같은 프로젝트 */
function seeded(): ConsultingProject {
  const p = project({ factsheet: seedFactsFromClient({}, client(), NOW) })
  return { ...p, stages: { ...p.stages, S0: { ...p.stages.S0, status: 'in_progress' } } }
}

const emptyCtx: TaskContext = { artifacts: [], prompts: [], evidence: [], today: TODAY }

function artifact(over: Partial<ConsultingArtifact>): ConsultingArtifact {
  return {
    id: 'a1', workspaceId: null, projectId: 'p1', type: 'PATENT_IDEA', title: 't', stageKey: 'S3', version: 1,
    status: 'draft', content: '', source: 'llm_paste', promptPackageId: null, fileName: '', createdAt: NOW, updatedAt: NOW, ...over,
  }
}

function promptPkg(over: Partial<ConsultingPromptPackage>): ConsultingPromptPackage {
  return {
    id: 'q1', workspaceId: null, projectId: 'p1', type: 'PATENT_IDEA', target: 'chatgpt', stageKey: 'S3', title: 't',
    prompt: '', context: '', privacy: { rrn: 0, account: 0, password: 0, secret: 0, email: 0, phone: 0, total: 0 }, section: null, createdAt: NOW, ...over,
  }
}

/* ------------------------------------------------------------------ */
/* 1. 결정성 · 첫 화면                                                   */
/* ------------------------------------------------------------------ */
{
  const p = seeded()
  const a = resolveCurrentTask(p, emptyCtx)
  const b = resolveCurrentTask(p, emptyCtx)
  check('결정성: 같은 상태 → 같은 할 일(id 포함)', JSON.stringify(a) === JSON.stringify(b))
  check('첫 화면: 비어 있는 것만 묻는다', a.actionType === 'INPUT' && (a.inputs?.length ?? 0) > 0 && (a.inputs?.length ?? 0) <= 3, `${a.actionType} ${a.inputs?.length}`)
  check('첫 화면: 이미 아는 것은 안 묻는다 (회사명·대표자·번호는 시드됨)', !(a.inputs ?? []).some((i) => i.target.kind === 'fact' && ['companyName', 'representative', 'businessNumber'].includes(i.target.key)))
  check('첫 화면: 준비된 정보를 보여준다', a.ready.length > 0 && a.ready.some((r) => r.ok))
  check('첫 화면: 다음이 무엇인지 알려준다', a.nextPreview.includes('다음'))
  check('첫 화면: 버튼 글자가 한국어 행동', a.primaryAction === '저장하고 계속')
}

/* ------------------------------------------------------------------ */
/* 2. S0 → S1 → S2 흐름과 자동 전환                                       */
/* ------------------------------------------------------------------ */
{
  let p = seeded()
  let ctx = emptyCtx

  // S0: 비어 있는 것 채우기 (주요 제품)
  let t = resolveCurrentTask(p, ctx)
  p = applyTask(p, t, { values: (t.inputs ?? []).map(() => '산업용 부품 제조') }, ctx, NOW).project
  t = resolveCurrentTask(p, ctx)
  check('S0: 다 채우면 확인 화면', t.actionType === 'CONFIRM' && t.stageKey === 'S0', `${t.actionType} ${t.stageKey}`)
  check('S0: 확인 화면에 값이 나열된다', (t.confirmItems?.length ?? 0) >= 5)
  check('S0: 미확인 값에 표시가 붙는다', (t.confirmItems ?? []).some((c) => c.needsCheck === true))

  // 확인 → S0 완료 → S1
  const out0 = applyTask(p, t, {}, ctx, NOW)
  p = out0.project
  check('S0: 확인하면 완료되고 다음 단계로', p.stages.S0.status === 'completed' && p.currentStage === 'S1', p.currentStage)
  check('S0: 기록이 자동으로 남는다', out0.decisions.length > 0)

  // S1: 문제 고르기 → 고객수 → 진행 판단
  t = resolveCurrentTask(p, ctx)
  check('S1: 문제를 고르게 한다', t.actionType === 'SELECT' && (t.choices?.length ?? 0) >= 5, t.actionType)
  check('S1: 직접 입력도 열려 있다', t.allowFreeText === true)
  p = applyTask(p, t, { selected: [CORE_PROBLEM_CHOICES[1].value] }, ctx, NOW).project
  check('S1: 고른 값이 사실표에 확인됨으로 들어간다', p.factsheet.coreProblem?.value === CORE_PROBLEM_CHOICES[1].value && p.factsheet.coreProblem?.status === 'confirmed')
  check('S1: 핵심 줄기가 자동으로 따라온다', p.coreThread.fieldProblem === CORE_PROBLEM_CHOICES[1].value)

  t = resolveCurrentTask(p, ctx)
  check('S1: 이어서 고객수를 묻는다', t.id === 'S1:INPUT:customers', t.id)
  p = applyTask(p, t, { values: ['거래처 23곳'] }, ctx, NOW).project

  t = resolveCurrentTask(p, ctx)
  check('S1: 세 가지 중 고르기', t.actionType === 'SELECT' && (t.choices?.length ?? 0) === 3, t.actionType)
  check('S1: 화면에 GO/HOLD 같은 말이 없다', !(t.choices ?? []).some((c) => /GO|HOLD/i.test(c.label)))
  const out1 = applyTask(p, t, { selected: ['go'] }, ctx, NOW)
  p = out1.project
  check('S1: 고르면 판단이 저장되고 S2 로', p.gate.decision === 'go' && p.currentStage === 'S2', p.currentStage)
  check('S1: 결정 로그에 남는다', out1.decisions.some((d) => d.kind === 'gate'))

  // S2: 기존 방식
  t = resolveCurrentTask(p, ctx)
  check('S2: 기존 방식을 묻는다', t.id === 'S2:SELECT:currentMethod', t.id)
  p = applyTask(p, t, { selected: ['엑셀에 직접 적고 담당자가 눈으로 확인한다'] }, ctx, NOW).project
  check('S2: 다 채우면 자동으로 S3', p.stages.S2.status === 'completed' && p.currentStage === 'S3', p.currentStage)

  // S3: 핵심기술 한 줄 → 프롬프트
  t = resolveCurrentTask(p, ctx)
  check('S3: 핵심기술을 한 줄로 묻는다', t.actionType === 'INPUT' && t.id === 'S3:INPUT:coreTech', t.id)
  p = applyTask(p, t, { values: ['작업지연 위험분석 및 우선순위 추천'] }, ctx, NOW).project
  t = resolveCurrentTask(p, ctx)
  check('S3: 이제 프롬프트를 만들 차례', t.actionType === 'GENERATE_PROMPT' && t.promptType === 'PATENT_IDEA', `${t.actionType} ${t.promptType}`)
  check('S3: 종류를 사용자가 고르지 않는다 (시스템이 정함)', t.promptType !== undefined && t.choices === undefined)

  // 프롬프트를 만들면 결과 가져오기로 바뀐다
  ctx = { ...ctx, prompts: [promptPkg({ type: 'PATENT_IDEA' })] }
  t = resolveCurrentTask(p, ctx)
  check('S3: 프롬프트 후에는 결과 가져오기', t.actionType === 'IMPORT_RESULT' && t.artifactType === 'PATENT_IDEA', t.actionType)

  // 결과가 오면 후보 고르기
  const withOptions = `본문입니다.\n\n${RETURN_BEGIN}\nTYPE: PATENT_IDEA\nSUMMARY: 세 가지 방향\nDECISION_OPTIONS:\n1) 공정 데이터 정규화 후 위험 산출\n2) 작업자 배정 최적화\n3) 납기 예측\nMISSING_FACTS:\n- 최근 매출\nNEXT_RECOMMENDATION: 선행기술 검토\n--- END_MIRAE_OS_RETURN ---`
  ctx = { ...ctx, artifacts: [artifact({ type: 'PATENT_IDEA', content: withOptions })] }
  t = resolveCurrentTask(p, ctx)
  check('S3: 후보가 있으면 고르게 한다', t.actionType === 'SELECT' && (t.choices?.length ?? 0) === 3, `${t.actionType} ${t.choices?.length}`)
  p = applyTask(p, t, { selected: ['공정 데이터 정규화 후 위험 산출'] }, ctx, NOW).project
  check('S3: 고르면 권리화 포인트가 되고 S4 로 넘어간다', p.coreThread.patentPoint.includes('정규화') && p.stages.S3.status === 'completed' && p.currentStage === 'S4', p.currentStage)

  t = resolveCurrentTask(p, ctx)
  check('S4: 선행기술 프롬프트로 이어진다', t.stageKey === 'S4' && t.actionType === 'GENERATE_PROMPT' && t.promptType === 'PRIOR_ART_REVIEW', `${t.stageKey} ${t.promptType}`)
  check('진행률이 올라간다', overallPercent(p) > 0 && overallPercent(p) < 100)
}

/* ------------------------------------------------------------------ */
/* 3. 클릭 수 (§45) — 실제로 센다                                         */
/* ------------------------------------------------------------------ */
{
  // 새 프로젝트(고객정보 시드됨) → 첫 프롬프트가 나올 때까지 몇 번 누르나
  let p = seeded()
  const ctx = emptyCtx
  let clicks = 0
  let t = resolveCurrentTask(p, ctx)
  const answer = (task: typeof t): TaskSubmission => {
    if (task.actionType === 'INPUT') return { values: (task.inputs ?? []).map((i) => (i.target.kind === 'fact' && i.target.key === 'establishedAt' ? '2019-03-02' : '테스트 값')) }
    if (task.actionType === 'SELECT') return { selected: [task.choices?.[0]?.value ?? ''] }
    return {}
  }
  while (t.actionType !== 'GENERATE_PROMPT' && clicks < 20) {
    p = applyTask(p, t, answer(t), ctx, NOW).project
    clicks += 1
    t = resolveCurrentTask(p, ctx)
  }
  console.log(`  · 새 프로젝트 → 첫 프롬프트: ${clicks}회 (목표 5~8)`)
  check(`클릭 수: 새 프로젝트 → 첫 프롬프트 (목표 5~8)`, clicks >= 1 && clicks <= 8, `${clicks}회`)

  // 다음 단계 프롬프트 — 결과를 넣으면 몇 번 만에 다음 프롬프트가 나오나
  const ctx2: TaskContext = { ...ctx, prompts: [promptPkg({ type: 'PATENT_IDEA' })], artifacts: [artifact({ type: 'PATENT_IDEA', content: 'plain result' })] }
  let p2 = p
  let clicks2 = 0
  let t2 = resolveCurrentTask(p2, ctx2)
  while (t2.actionType !== 'GENERATE_PROMPT' && clicks2 < 10) {
    p2 = applyTask(p2, t2, answer(t2), ctx2, NOW).project
    clicks2 += 1
    t2 = resolveCurrentTask(p2, ctx2)
  }
  console.log(`  · 결과 저장 → 다음 프롬프트: ${clicks2}회 (목표 1~3)`)
  check(`클릭 수: 결과 저장 후 다음 프롬프트까지 (목표 1~3)`, clicks2 <= 3, `${clicks2}회`)
}

/* ------------------------------------------------------------------ */
/* 4. 구조화 반환 블록                                                    */
/* ------------------------------------------------------------------ */
{
  const text = `앞부분 설명\n\n${RETURN_BEGIN}\nTYPE: MVP_SPEC\nSUMMARY: 첫 줄\n두 번째 줄\nDECISION_OPTIONS:\n1) 가\n2) 나\nMISSING_FACTS:\n- 직원수\n- 최근 매출\nNEXT_RECOMMENDATION: 빌드 프롬프트\n--- END_MIRAE_OS_RETURN ---\n꼬리말`
  const r = parseReturnBlock(text)
  check('반환 블록: 찾는다', r.found && r.type === 'MVP_SPEC')
  check('반환 블록: 여러 줄 요약', r.summary.includes('첫 줄') && r.summary.includes('두 번째 줄'))
  check('반환 블록: 후보 2개', r.decisionOptions.length === 2 && r.decisionOptions[0] === '가')
  check('반환 블록: 부족한 사실 2개', r.missingFacts.length === 2 && r.missingFacts[1] === '최근 매출')
  check('반환 블록: 다음 추천', r.nextRecommendation === '빌드 프롬프트')
  const body = stripReturnBlock(text)
  check('반환 블록: 본문에서 블록을 뺀다', body.includes('앞부분 설명') && body.includes('꼬리말') && !body.includes('TYPE: MVP_SPEC'))

  const plain = '그냥 결과입니다. 형식이 없습니다.'
  const r2 = parseReturnBlock(plain)
  check('반환 블록: 없으면 없다고 한다', !r2.found && r2.type === null)
  check('반환 블록: 없어도 원문은 그대로 남는다', stripReturnBlock(plain) === plain)
  check('반환 블록: "없음" 은 목록에서 뺀다', parseReturnBlock(`${RETURN_BEGIN}\nMISSING_FACTS:\n- 없음\n--- END_MIRAE_OS_RETURN ---`).missingFacts.length === 0)
  check('반환 블록: 요구문에 후보를 넣고 뺄 수 있다', returnBlockInstruction('PATENT_IDEA', true).includes('DECISION_OPTIONS') && !returnBlockInstruction('QA_REPORT', false).includes('DECISION_OPTIONS'))
}

/* ------------------------------------------------------------------ */
/* 5. 프롬프트 품질 보존 (§14·§49)                                        */
/* ------------------------------------------------------------------ */
{
  const p = project({
    factsheet: { ...seedFactsFromClient({}, client(), NOW), coreTech: { value: '작업지연 위험분석', status: 'confirmed', source: '인터뷰', asOfDate: '2026-09-01', note: '', updatedAt: NOW } },
    coreThread: { fieldProblem: '납기 지연', existingMethod: '엑셀', coreTech: '작업지연 위험분석', patentPoint: '위험 산출 순서', axCore: '위험 점수', platformSurface: '거래처 포털', ventureSentence: '', keyEvidence: '' },
  })
  const built = buildPromptPackage({ project: p, type: 'PATENT_IDEA', target: 'chatgpt' })
  check('프롬프트: 회사 사실이 들어간다', built.prompt.includes('하나정보통신'))
  check('프롬프트: 핵심 줄기가 들어간다', built.prompt.includes('작업지연 위험분석'))
  check('프롬프트: 무결성 규칙이 들어간다', built.prompt.includes('특허출원 중') && built.prompt.includes('지어내지'))
  check('프롬프트: 단계 규칙이 들어간다', built.prompt.includes('5개 고정 질문'))
  check('프롬프트: 반환 블록을 요구한다', built.prompt.includes(RETURN_BEGIN) && built.prompt.includes('DECISION_OPTIONS'))
  check('프롬프트: 여전히 상한 안 (Master 통째로 넣지 않음)', built.prompt.length < 9000, String(built.prompt.length))
  check('프롬프트: 값의 상태를 함께 넘긴다', built.prompt.includes('(확정') || built.prompt.includes('(미확인'))
}

/* ------------------------------------------------------------------ */
/* 6. 안전장치                                                           */
/* ------------------------------------------------------------------ */
{
  const noGo = project({ gate: { items: {}, decision: 'no_go', reason: '기술 연결 안 됨', decidedAt: NOW } })
  check('NO-GO: 더 밀어붙이지 않는다', resolveCurrentTask(noGo, emptyCtx).finished === true)

  const done = project({ status: 'done' })
  check('끝난 프로젝트: 할 일을 만들지 않는다', resolveCurrentTask(done, emptyCtx).finished === true)

  // 출원 단계는 자동으로 넘어가지 않는다 (사실 확인이 필요하다)
  let p = project({ factsheet: seedFactsFromClient({}, client(), NOW) })
  p = { ...p, stages: { ...p.stages, S0: { ...p.stages.S0, status: 'completed' }, S1: { ...p.stages.S1, status: 'completed' }, S2: { ...p.stages.S2, status: 'completed' }, S3: { ...p.stages.S3, status: 'completed' }, S4: { ...p.stages.S4, status: 'completed' }, S5: { ...p.stages.S5, status: 'completed' }, S6: { ...p.stages.S6, status: 'completed' } }, currentStage: 'S7' }
  const t7 = resolveCurrentTask(p, emptyCtx)
  check('S7: 최신 서식 확인을 먼저 묻는다 (K9)', t7.actionType === 'CONFIRM' && t7.confirmKind === 'freshness_patent', t7.id)
  const afterFresh = applyTask(p, t7, {}, emptyCtx, NOW).project
  check('S7: 확인 기록이 남는다', afterFresh.freshness.some((f) => f.scope === 'patent_filing'))
  const t7b = resolveCurrentTask(afterFresh, emptyCtx)
  check('S7: 그 다음에 출원번호를 묻는다', t7b.actionType === 'INPUT' && t7b.id === 'S7:INPUT:filing', t7b.id)
  const filed = applyTask(afterFresh, t7b, { values: ['10-2026-0001234', '2026-09-05'] }, emptyCtx, NOW).project
  check('S7: 출원번호를 넣으면 상태가 출원 중이 된다', filed.patent.filingStatus === 'filed' && filed.factsheet.patent?.value.includes('출원 중'))
  check('S7: "등록" 이라고 쓰지 않는다', !JSON.stringify(filed.factsheet.patent).includes('등록'))

  // 자동 추정 금지 — 매출·직원수는 사람이 넣기 전까지 비어 있다
  const fresh = seeded()
  check('자동 추정 금지: 매출·거래처를 만들어 내지 않는다', fresh.factsheet.revenue3y === undefined && fresh.factsheet.customers === undefined)
  check('시드된 값은 미확인으로 표시', fresh.factsheet.companyName?.status === 'unverified')
}

/* ------------------------------------------------------------------ */
/* 7. activeStage                                                       */
/* ------------------------------------------------------------------ */
{
  const p = project()
  const done = { ...p, stages: { ...p.stages, S0: { ...p.stages.S0, status: 'completed' as const }, S1: { ...p.stages.S1, status: 'skipped' as const } } }
  check('activeStage: 끝난 단계는 건너뛴다', activeStage(done) === 'S2')
}

console.log(`\n운영자 레이어: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
