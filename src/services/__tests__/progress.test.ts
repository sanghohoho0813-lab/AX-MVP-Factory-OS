/**
 * 프로젝트 진행상태 단일 기준(deriveProjectProgress) 단위 테스트.
 * 순수 함수만 검증하므로 localStorage·Repository 없이 node에서 실행된다.
 * 실행: npm run test:progress
 */

import {
  deriveProjectProgress,
  type ProgressInputs,
} from '../projectProgressService'

let passed = 0
let failed = 0

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    passed += 1
  } else {
    failed += 1
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function base(over: Partial<ProgressInputs> = {}): ProgressInputs {
  return {
    projectId: 'p1',
    projectType: 'ax',
    prepared: true,
    submittedResponseCount: 0,
    blueprintReady: false,
    assessmentExists: false,
    assessmentFinalized: false,
    selectionStarted: false,
    selectionFinalized: false,
    axDesignStarted: false,
    axDesignFinalized: false,
    websiteStarted: false,
    websiteFinalized: false,
    deliverableStarted: false,
    deliverableFinalized: false,
    isSample: false,
    ...over,
  }
}

/* 1. AX 초기 상태: 준비만 완료 → 1/5, 진단이 현재 단계 */
{
  const p = deriveProjectProgress(base())
  check('AX 초기: 1/5단계', p.stepText === '1 / 5단계', p.stepText)
  check('AX 초기: 20%', p.percent === 20, String(p.percent))
  check('AX 초기: 현재=기업 진단', p.currentStep.key === 'diagnosis')
  check('AX 초기: 진단은 시작 가능', p.steps[1].state === 'ready')
  check('AX 초기: 선택은 잠김', p.steps[2].state === 'blocked_by_prerequisite')
  check('AX 초기: 설계는 잠김', p.steps[3].state === 'blocked_by_prerequisite')
  check('AX 초기: 결과자료 잠김', p.steps[4].state === 'blocked_by_prerequisite')
  check('AX 초기: 다음 행동=설문 구성', p.nextAction.buttonLabel === '설문 구성하기')
  check('AX 초기: 잠긴 설계에 이유 존재', p.steps[3].detail.includes('확정'))
}

/* 2. 설문 준비만 됨(응답 0) → 진단 미완료 유지 */
{
  const p = deriveProjectProgress(base({ blueprintReady: true }))
  check('설문만 준비: 여전히 1/5', p.stepText === '1 / 5단계', p.stepText)
  check('설문만 준비: 진단 in_progress', p.steps[1].state === 'in_progress')
  check('설문만 준비: 다음 행동=응답 확인', p.nextAction.buttonLabel === '응답 확인하기')
}

/* 3. 응답 있어도 확정 전이면 미완료 */
{
  const p = deriveProjectProgress(base({ submittedResponseCount: 2, assessmentExists: true }))
  check('확정 전: 1/5 유지', p.completedCount === 1)
  check('확정 전: 다음 행동=진단 결과 만들기', p.nextAction.buttonLabel === '진단 결과 만들기')
}

/* 4. 진단 확정 → 2/5, 선택 시작 가능 */
{
  const p = deriveProjectProgress(
    base({ submittedResponseCount: 2, assessmentExists: true, assessmentFinalized: true }),
  )
  check('진단 확정: 2/5', p.stepText === '2 / 5단계', p.stepText)
  check('진단 확정: 40%', p.percent === 40)
  check('진단 확정: 선택 ready', p.steps[2].state === 'ready')
  check('진단 확정: 결과자료 열림(진단 확정 근거)', p.steps[4].state !== 'blocked_by_prerequisite')
}

/* 5. 응답 없이 Assessment만 있으면 진단 완료 아님 (모순 방지) */
{
  const p = deriveProjectProgress(base({ assessmentExists: true, assessmentFinalized: true }))
  check('응답 0 + 확정: 진단 완료 아님', p.steps[1].state !== 'completed')
}

/* 6. 후보만 있으면 선택 미완료 */
{
  const p = deriveProjectProgress(
    base({
      submittedResponseCount: 2,
      assessmentExists: true,
      assessmentFinalized: true,
      selectionStarted: true,
    }),
  )
  check('후보만: 선택 in_progress', p.steps[2].state === 'in_progress')
  check('후보만: 2/5 유지', p.completedCount === 2)
}

/* 7. 전체 완료 AX → 5/5, 100% */
{
  const p = deriveProjectProgress(
    base({
      submittedResponseCount: 2,
      assessmentExists: true,
      assessmentFinalized: true,
      selectionStarted: true,
      selectionFinalized: true,
      axDesignStarted: true,
      axDesignFinalized: true,
      deliverableStarted: true,
      deliverableFinalized: true,
    }),
  )
  check('AX 완료: 5/5', p.stepText === '5 / 5단계', p.stepText)
  check('AX 완료: 100%', p.percent === 100)
  check('AX 완료: allCompleted', p.allCompleted)
}

/* 8. 홈페이지 프로젝트: 진단 단계 없음, 3단계 */
{
  const p = deriveProjectProgress(base({ projectType: 'website' }))
  check('웹: 3단계', p.totalCount === 3, String(p.totalCount))
  check('웹: 진단 단계 없음', !p.steps.some((s) => s.key === 'diagnosis'))
  check('웹: 홈페이지 설계 ready', p.steps[1].state === 'ready')
  check('웹: 결과자료 잠김', p.steps[2].state === 'blocked_by_prerequisite')
}

/* 9. AX+홈페이지: 6단계, 홈페이지는 선택 확정 후 열림 */
{
  const p = deriveProjectProgress(base({ projectType: 'ax_website' }))
  check('AX+웹: 6단계', p.totalCount === 6, String(p.totalCount))
  check('AX+웹: 홈페이지 잠김', p.steps.find((s) => s.key === 'website_design')?.state === 'blocked_by_prerequisite')
  const p2 = deriveProjectProgress(
    base({
      projectType: 'ax_website',
      submittedResponseCount: 1,
      assessmentExists: true,
      assessmentFinalized: true,
      selectionStarted: true,
      selectionFinalized: true,
    }),
  )
  check('AX+웹 선택 확정: 홈페이지 열림', p2.steps.find((s) => s.key === 'website_design')?.state === 'ready')
}

/* 10. 샘플 표시 전달 */
{
  const p = deriveProjectProgress(base({ isSample: true }))
  check('샘플 플래그 유지', p.isSample)
}

console.log(`Progress 단위 테스트: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('PROGRESS_FAIL')
  process.exit(1)
}
console.log('PROGRESS_PASS')
