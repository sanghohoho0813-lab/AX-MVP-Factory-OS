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
import { CORE_PROBLEM_CHOICES, CUSTOMER_COUNT_CHOICES } from '../../domain/consulting/operatorChoices'
import { recommendGate, recommendKipo } from '../../domain/consulting/recommendations'
import { composeProblemSentence, suggestCoreTech, suggestJourney } from '../../domain/consulting/suggestions'
import { objectParticle, subjectParticle, toPhrase } from '../../domain/consulting/koreanText'
import { documentsSummary, factsFromDocuments } from '../../domain/consulting/companyDocFacts'
import { parseKoreanBusinessDocument } from '../koreanDocParser'
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
  // 개발·업무 용어가 기본 화면으로 새지 않는다 (§16·§59)
  check('첫 화면: 다음 단계 이름이 쉬운 한국어', !/GO|HOLD|NO-GO|Judge|Devil|슬롯|잠금/.test(a.nextPreview), a.nextPreview)
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
  check('S1: 고르면 무엇이 저장될지 미리 보여 준다', t.composeKind === 'coreProblem')
  p = applyTask(p, t, { selected: [CORE_PROBLEM_CHOICES[1].value] }, ctx, NOW).project
  // 고른 보기를 그대로 넣지 않고 회사명·업종을 붙인 문장으로 늘려 저장한다 (§9)
  check('S1: 고른 값이 문장으로 저장된다', (p.factsheet.coreProblem?.value ?? '').includes('하나정보통신') && p.factsheet.coreProblem?.status === 'confirmed', p.factsheet.coreProblem?.value)
  check('S1: 고른 내용이 문장 안에 그대로 남는다', (p.factsheet.coreProblem?.value ?? '').includes(CORE_PROBLEM_CHOICES[1].value.slice(0, 8)), p.factsheet.coreProblem?.value)
  // 줄기에는 늘린 문장이 아니라 고른 그대로의 짧은 이름이 들어간다 (뒤의 초안이 말을 겹치지 않게)
  check('S1: 핵심 줄기에는 짧은 이름이 들어간다', p.coreThread.fieldProblem === CORE_PROBLEM_CHOICES[1].value, p.coreThread.fieldProblem)
  check('S1: 사실표에는 늘린 문장이 남는다', (p.factsheet.coreProblem?.value ?? '').length > p.coreThread.fieldProblem.length)

  t = resolveCurrentTask(p, ctx)
  check('S1: 이어서 거래처 수를 고르게 한다 (타이핑 없이)', t.id === 'S1:SELECT:customers' && t.actionType === 'SELECT', t.id)
  check('S1: 거래처 수는 몰라도 넘어갈 수 있다', t.deferrable === true)
  p = applyTask(p, t, { selected: [CUSTOMER_COUNT_CHOICES[2].value] }, ctx, NOW).project

  t = resolveCurrentTask(p, ctx)
  check('S1: 세 가지 중 고르기', t.actionType === 'SELECT' && (t.choices?.length ?? 0) === 3, t.actionType)
  check('S1: 화면에 GO/HOLD 같은 말이 없다', !(t.choices ?? []).some((c) => /GO|HOLD/i.test(c.label)))
  check('S1: 시스템이 먼저 의견을 낸다', t.recommend !== undefined && (t.recommend?.reasons.length ?? 0) > 0, JSON.stringify(t.recommend))
  check('S1: 추천 버튼 글자가 "추천대로 진행"', t.primaryAction === '추천대로 진행', t.primaryAction)
  check('S1: 진행 판단이 무엇인지 설명이 붙는다', (t.helpKeys ?? []).includes('gate'))
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
  check('S3: 빈 칸으로 두지 않고 초안을 만들어 준다', (t.inputs?.[0].suggestion ?? '') !== '', t.inputs?.[0].suggestion)
  check('S3: 초안의 근거를 밝힌다', (t.inputs?.[0].suggestionBasedOn ?? []).length > 0)
  check('S3: 초안이 있으면 버튼도 "이대로"', t.primaryAction === '이대로 저장하고 계속', t.primaryAction)
  check('S3: 무엇을 쓰면 되는지 예시가 있다', (t.inputs?.[0].example ?? '') !== '')
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
/* 3-2. 타이핑 예산 (§49) — 몇 번이나 직접 쳐야 하는가                      */
/* ------------------------------------------------------------------ */
{
  /*
   * 새 프로젝트를 만들어 첫 프롬프트까지 가는 동안, "사람이 자판을 두드려야만 넘어가는" 화면이
   * 몇 개인지 센다. 고르기 · 추천 확인 · 초안 확인은 타이핑이 아니다.
   * (S0 회사 기본정보는 서류 한 장으로 채울 수 있으므로 서류를 올린 것으로 친다.)
   */
  const REGISTRATION = [
    '사업자등록증 ( 법인사업자 )', '등록번호 : 214-88-01234', '법인명(단체명) : 주식회사 대한정밀',
    '대표자 : 박정밀', '개업연월일 : 2018 년 05 월 14 일', '사업장 소재지 : 경기도 화성시 동탄산단6길 22',
    '업태 : 제조업', '종목 : 자동차부품 제조',
  ].join('\n')
  let p = { ...project(), stages: { ...project().stages, S0: { ...project().stages.S0, status: 'in_progress' as const } } }
  const ctx = emptyCtx
  let typed = 0
  let steps = 0

  // 서류 한 장 = 클릭 몇 번, 타이핑 0
  let t = resolveCurrentTask(p, ctx)
  p = applyTask(p, t, { facts: factsFromDocuments([parseKoreanBusinessDocument(REGISTRATION)]) }, ctx, NOW).project

  t = resolveCurrentTask(p, ctx)
  while (t.actionType !== 'GENERATE_PROMPT' && steps < 20) {
    steps += 1
    let sub: TaskSubmission = {}
    if (t.actionType === 'SELECT') sub = { selected: t.recommend ? t.recommend.values : [t.choices?.[0]?.value ?? ''] }
    else if (t.actionType === 'INPUT') {
      const draft = (t.inputs ?? []).map((i) => i.suggestion ?? '')
      const allDrafted = draft.length > 0 && draft.every((d) => d.trim() !== '')
      if (!allDrafted) typed += 1
      sub = { values: allDrafted ? draft : (t.inputs ?? []).map((i) => (i.target.kind === 'fact' && i.target.key === 'establishedAt' ? '2019-03-02' : '테스트 값')) }
    }
    p = applyTask(p, t, sub, ctx, NOW).project
    t = resolveCurrentTask(p, ctx)
  }
  const ratio = steps === 0 ? 1 : (steps - typed) / steps
  console.log(`  · 첫 프롬프트까지 ${steps}단계 중 타이핑이 필요한 화면 ${typed}개 (타이핑 없이 ${Math.round(ratio * 100)}%)`)
  check(`타이핑 예산: 80% 이상을 타이핑 없이 (실측 ${Math.round(ratio * 100)}%)`, ratio >= 0.8, `${typed}/${steps}`)
}

/* ------------------------------------------------------------------ */
/* 3-3. 몰라도 멈추지 않는다 (§6·§7·§8)                                    */
/* ------------------------------------------------------------------ */
{
  let p = seeded()
  const ctx = emptyCtx
  let t = resolveCurrentTask(p, ctx)
  check('모름: 회사 기본정보 화면에 "나중에" 가 있다', t.deferrable === true && (t.deferKeys?.length ?? 0) > 0)

  const beforeId = t.id
  const out = applyTask(p, t, { defer: true }, ctx, NOW)
  p = out.project
  check('모름: 미룬 것이 목록에 남는다', p.deferred.length > 0, JSON.stringify(p.deferred))
  check('모름: 미뤘다는 사실이 자동 기록된다', out.decisions.some((d) => d.summary.includes('나중에 확인')))
  const after = resolveCurrentTask(p, ctx)
  check('모름: 같은 것을 다시 묻지 않는다', after.id !== beforeId, `${beforeId} → ${after.id}`)
  check('모름: 그래도 일은 계속 이어진다', after.finished !== true)

  // 값이 들어오면 미룬 목록에서 빠진다
  const key = p.deferred[0].key
  let q = p
  let tq = resolveCurrentTask(q, ctx)
  let guard = 0
  while (q.deferred.some((d) => d.key === key) && guard < 12) {
    guard += 1
    if (tq.actionType === 'CONFIRM') { q = applyTask(q, tq, {}, ctx, NOW).project }
    else if (tq.actionType === 'SELECT') { q = applyTask(q, tq, { selected: [tq.choices?.[0]?.value ?? ''] }, ctx, NOW).project }
    else if (tq.actionType === 'INPUT') { q = applyTask(q, tq, { values: (tq.inputs ?? []).map((i) => i.suggestion || '채운 값') }, ctx, NOW).project }
    else break
    tq = resolveCurrentTask(q, ctx)
  }

  // 제출에 가까운 단계에서는 다시 묻는다 (§7)
  const nearSubmit = {
    ...seeded(),
    currentStage: 'S10' as const,
    deferred: [{ key: 'som', label: '3년 내 확보 가능 시장(SOM)', stageKey: 'S1' as const, deferredAt: NOW }],
    stages: { ...seeded().stages, S10: { ...seeded().stages.S10, status: 'in_progress' as const } },
  }
  const t10 = resolveCurrentTask(nearSubmit, ctx)
  check('모름: 제출 단계에서는 미뤄 둔 숫자를 다시 묻는다', t10.stageKey === 'S10' && (t10.inputs ?? []).some((i) => i.target.kind === 'fact'), `${t10.stageKey} ${t10.id}`)
  check('모름: 제출 단계에는 "나중에" 를 주지 않는다', t10.deferrable !== true)
}

/* ------------------------------------------------------------------ */
/* 3-4. 시스템이 먼저 추천한다 (§5·§27)                                    */
/* ------------------------------------------------------------------ */
{
  const base = seeded()
  const withProblem = {
    ...base,
    factsheet: {
      ...base.factsheet,
      coreProblem: { value: '견적 요청이 카톡·전화·메일에 흩어져 담당자가 매번 확인한다', status: 'confirmed' as const, source: '인터뷰', asOfDate: TODAY, note: '', updatedAt: NOW },
      coreTech: { value: '공정 데이터를 모아 작업지연 위험을 계산하고 처리 순서를 추천', status: 'confirmed' as const, source: '기술기획', asOfDate: TODAY, note: '', updatedAt: NOW },
    },
  }
  const g = recommendGate(withProblem)
  check('추천: 근거와 함께 의견을 낸다', g !== null && g.reasons.length >= 2, JSON.stringify(g))
  check('추천: 진행 어려움(NO-GO)을 시스템이 만들지 않는다', g?.value !== 'no_go')
  check('추천: 문제가 없으면 추천하지 않는다', recommendGate(base) === null)

  const k = recommendKipo(withProblem, 2)
  check('추천: 참고자료 2개를 골라 준다', k !== null && k.value.length === 2, JSON.stringify(k?.value))
  check('추천: 왜 골랐는지 함께 말한다', (k?.reasons.length ?? 0) === 2 && (k?.reasons[0] ?? '').length > 8)
  check('추천: 118종을 사람이 뒤지게 하지 않는다', (k?.value ?? []).every((c) => typeof c === 'string' && c.length === 4))
}

/* ------------------------------------------------------------------ */
/* 3-5. 시스템이 먼저 문장을 쓴다 (§9·§18)                                 */
/* ------------------------------------------------------------------ */
{
  const base = seeded()
  const withProblem = {
    ...base,
    factsheet: {
      ...base.factsheet,
      coreProblem: { value: '작업지시가 카톡·엑셀에 흩어져 납기 지연을 늦게 안다', status: 'confirmed' as const, source: '인터뷰', asOfDate: TODAY, note: '', updatedAt: NOW },
      currentMethod: { value: '담당자가 매일 아침 엑셀을 열어 눈으로 확인한다', status: 'confirmed' as const, source: '인터뷰', asOfDate: TODAY, note: '', updatedAt: NOW },
    },
  }
  const tech = suggestCoreTech(withProblem)
  check('초안: 핵심기술 한 줄을 만들어 준다', tech.text.length > 20, tech.text)
  // 조사·어미가 틀리면 사용자는 그 순간 시스템을 믿지 않는다
  check('초안: 조사가 맞는다 (…한다을 같은 말이 없다)', !/[한된는]다[을를이가은는]/.test(tech.text), tech.text)
  check('초안: 초안이 문단이 되지 않는다', tech.text.length <= 160, `${tech.text.length}자`)
  check('초안: 무엇을 보고 만들었는지 밝힌다', tech.basedOn.length > 0)
  check('초안: 근거가 없으면 만들지 않는다', suggestCoreTech(base).text === '')

  const sentence = composeProblemSentence('견적 요청이 여러 곳에 흩어진다', withProblem)
  check('초안: 고른 보기를 문장으로 늘린다', sentence.text.includes('견적') && sentence.text.endsWith('있습니다'), sentence.text)

  const journey = suggestJourney({ ...withProblem, mvp: { ...withProblem.mvp, targetUser: '견적·수주 담당자' } })
  check('초안: MVP 흐름을 화살표로 제안한다', journey.text.includes('→') && journey.text.includes('견적'), journey.text)

  // 조사 붙이기 — 받침 유무에 따라 갈린다
  check('조사: 받침 있는 말에는 을/이/은', objectParticle('담당자') === '담당자를' && objectParticle('작업') === '작업을', `${objectParticle('담당자')} ${objectParticle('작업')}`)
  check('조사: 주격도 맞춘다', subjectParticle('공정') === '공정이' && subjectParticle('담당자') === '담당자가')
  check('조사: 판단할 수 없으면 둘 다 적는다', objectParticle('MVP').includes('(') , objectParticle('MVP'))
  check('어미: 종결어미를 떼어 낸다', toPhrase('담당자가 눈으로 확인한다') === '담당자가 눈으로 확인', toPhrase('담당자가 눈으로 확인한다'))
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
/* 6-2. 서류에서 회사 기본정보 채우기                                     */
/* ------------------------------------------------------------------ */
{
  const REGISTRATION = [
    '사업자등록증',
    '( 법인사업자 )',
    '등록번호 : 214-88-01234',
    '법인명(단체명) : 주식회사 대한정밀',
    '대표자 : 박정밀',
    '개업연월일 : 2018 년 05 월 14 일',
    '사업장 소재지 : 경기도 화성시 동탄산단6길 22',
    '업태 : 제조업',
    '종목 : 자동차부품 제조, 금형',
  ].join('\n')

  const REGISTRY = [
    '등기사항전부증명서(말소사항 포함) - 주식회사',
    '등기번호 111111',
    '등록번호 110111-1234567',
    '상 호 주식회사 대한정밀',
    '본 점 경기도 화성시 동탄산단6길 22, 3층',
    '회사성립연월일 2018 년 03 월 02 일',
    '사내이사 박정밀',
    '대표이사 박정밀',
  ].join('\n')

  const fromReg = parseKoreanBusinessDocument(REGISTRATION)
  const fromRegistry = parseKoreanBusinessDocument(REGISTRY)

  check('서류: 사업자등록증을 알아본다', fromReg.source === 'business_registration', fromReg.source)
  check('서류: 법인등기부등본을 알아본다', fromRegistry.source === 'corporate_registry', fromRegistry.source)

  // 한 장만 올려도 채워진다 (사용자 요구: "사업자등록증이나 법인등기부등본만 업로드해도")
  const onlyReg = factsFromDocuments([fromReg])
  const keys = onlyReg.map((f) => f.key)
  check('서류 한 장(사업자등록증)만으로 채워진다', keys.includes('companyName') && keys.includes('businessNumber') && keys.includes('representative'), keys.join(','))
  check('서류: 업태·종목을 업종으로 합친다', onlyReg.find((f) => f.key === 'industry')?.value === '제조업 · 자동차부품 제조, 금형', JSON.stringify(onlyReg.find((f) => f.key === 'industry')))
  check('서류: 출처가 서류 이름으로 남는다', onlyReg.every((f) => f.source.includes('사업자등록증')), JSON.stringify(onlyReg.map((f) => f.source)))
  check('서류: 종목에서 옮긴 주요제품은 미확인으로 둔다', onlyReg.find((f) => f.key === 'mainProducts')?.status === 'unverified')

  const onlyRegistry = factsFromDocuments([fromRegistry])
  check('서류 한 장(법인등기부등본)만으로도 채워진다', onlyRegistry.some((f) => f.key === 'corporateNumber') && onlyRegistry.some((f) => f.key === 'headOffice'), onlyRegistry.map((f) => f.key).join(','))

  // 두 장을 함께 올리면 항목마다 더 믿을 만한 쪽을 쓴다
  const both = factsFromDocuments([fromReg, fromRegistry])
  const val = (k: string) => both.find((f) => f.key === k)?.value
  const src = (k: string) => both.find((f) => f.key === k)?.source
  check('두 장: 본점은 등기부 것을 쓴다', val('headOffice')?.includes('3층') === true, val('headOffice'))
  check('두 장: 설립일은 등기부의 회사성립연월일', val('establishedAt') === '2018-03-02', val('establishedAt'))
  check('두 장: 사업자등록번호는 등록증 것을 쓴다', val('businessNumber') === '214-88-01234' && src('businessNumber') === '사업자등록증', `${val('businessNumber')} / ${src('businessNumber')}`)
  check('두 장: 법인등록번호도 함께 채워진다', val('corporateNumber') === '110111-1234567', val('corporateNumber'))
  check('두 장: 사람이 읽을 출처 한 줄', documentsSummary([fromReg, fromRegistry]) === '사업자등록증 · 법인등기부등본', documentsSummary([fromReg, fromRegistry]))

  // 없는 것을 만들어 내지 않는다 (§31)
  check('서류: 매출·직원수를 지어내지 않는다', !both.some((f) => ['revenue3y', 'employees', 'customers'].includes(f.key)))

  // 실제로 프로젝트에 적용된다
  const blank = { ...project(), stages: { ...project().stages, S0: { ...project().stages.S0, status: 'in_progress' as const } } }
  const t0 = resolveCurrentTask(blank, emptyCtx)
  check('S0: 서류로 채우기를 안내한다', t0.docImport === true && t0.actionType === 'INPUT', `${t0.actionType} ${String(t0.docImport)}`)
  const afterDoc = applyTask(blank, t0, { facts: both }, emptyCtx, NOW)
  check('서류 적용: 사실표에 들어간다', afterDoc.project.factsheet.companyName?.value === '주식회사 대한정밀', afterDoc.project.factsheet.companyName?.value)
  check('서류 적용: 출처가 남는다', afterDoc.project.factsheet.headOffice?.source === '법인등기부등본', afterDoc.project.factsheet.headOffice?.source)
  check('서류 적용: 자동으로 기록된다', afterDoc.decisions.some((d) => d.kind === 'fact' && d.summary.includes('서류에서')))
  check('서류 적용: 단계를 끝내 버리지 않는다', afterDoc.project.stages.S0.status !== 'completed', afterDoc.project.stages.S0.status)

  // 확인 화면에서 올려도 '맞아요' 를 누른 것으로 치지 않는다
  const t1 = resolveCurrentTask(afterDoc.project, emptyCtx)
  check('S0: 서류로 다 채우면 확인 화면으로 넘어간다', t1.actionType === 'CONFIRM' && t1.docImport === true, t1.actionType)
  const reDoc = applyTask(afterDoc.project, t1, { facts: [both[0]] }, emptyCtx, NOW)
  check('확인 화면에서 서류를 다시 올려도 단계가 끝나지 않는다', reDoc.project.stages.S0.status !== 'completed', reDoc.project.stages.S0.status)
  const confirmed = applyTask(afterDoc.project, t1, {}, emptyCtx, NOW)
  check('확인 버튼을 눌러야 단계가 끝난다', confirmed.project.stages.S0.status === 'completed')

  // 아무것도 못 읽은 서류
  check('서류: 못 알아봐도 빈 목록만 돌려준다', factsFromDocuments([parseKoreanBusinessDocument('그냥 아무 글자')]).length === 0)
}

/* ------------------------------------------------------------------ */
/* 6-3. 쉬운 한국어 — 개발·업무 용어가 새지 않는가 (§16·§59)               */
/* ------------------------------------------------------------------ */
{
  const BANNED = /GO \/ HOLD|NO-GO|Judge|Devil|Artifact|Payload|Blocker|Resolver|Stage |Core Thread|Prompt Package|슬롯|잠금/
  let p = seeded()
  const ctx = emptyCtx
  const seen: string[] = []
  let t = resolveCurrentTask(p, ctx)
  for (let i = 0; i < 25; i += 1) {
    seen.push(`${t.headline} | ${t.detail} | ${t.primaryAction} | ${t.nextPreview}`)
    for (const c of t.choices ?? []) seen.push(`${c.label} | ${c.hint ?? ''}`)
    for (const inp of t.inputs ?? []) seen.push(`${inp.label} | ${inp.placeholder} | ${inp.example ?? ''}`)
    for (const r of t.recommend?.reasons ?? []) seen.push(r)
    if (t.finished) break
    let sub: TaskSubmission = {}
    if (t.actionType === 'SELECT') sub = { selected: t.recommend ? t.recommend.values : (t.choices ?? []).slice(0, t.multi?.min ?? 1).map((c) => c.value) }
    else if (t.actionType === 'INPUT') sub = { values: (t.inputs ?? []).map((x) => x.suggestion || (x.target.kind === 'fact' && x.target.key === 'establishedAt' ? '2019-03-02' : '값')) }
    const before = t.id
    p = applyTask(p, t, sub, ctx, NOW).project
    t = resolveCurrentTask(p, ctx)
    if (t.id === before) break // 프롬프트·결과 대기 등 더 진행할 수 없는 자리
  }
  const bad = seen.filter((line) => BANNED.test(line))
  check(`쉬운 한국어: 화면 문구 ${seen.length}줄에 개발·업무 용어 없음`, bad.length === 0, bad.slice(0, 3).join(' // '))
  check('쉬운 한국어: 실제로 여러 화면을 지났다', seen.length >= 10, `${seen.length}줄`)
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
