/**
 * 설문 저장 신뢰성 단위 테스트 (Stage 12C).
 * - 직렬 저장 큐: 순서 역전 방지·중복 건너뛰기·제출 후 차단
 * - 숨김 조건부 답변 sanitizer: 단일·중첩 조건 모두 제출 데이터에서 제외
 * - emergency draft 최신성 비교: 오래된 draft 가 최신 정상 저장을 덮어쓰지 않음
 * 실행: npm run test:persistence
 */

import { createSerialSaveQueue } from '../../lib/serialSaveQueue'
import {
  evaluateVisibleSnapshotQuestions,
  sanitizeAnswersForSubmission,
} from '../surveyRuntimeService'
import { isDraftNewer } from '../../storage/surveyDraftCache'
import type { SnapshotPlacement, SnapshotSection } from '../../types/survey'
import type { SurveyAnswer } from '../../types/surveyRuntime'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/* ------------------------------------------------------------------ */
/* 1. 직렬 저장 큐                                                       */
/* ------------------------------------------------------------------ */

async function testQueue(): Promise<void> {
  // (a) 느린 저장 → 빠른 저장 순서 보존 (완료 순서 역전 방지)
  {
    const q = createSerialSaveQueue()
    const done: string[] = []
    const p1 = q.enqueue(async () => {
      await wait(40)
      done.push('slow-old')
    })
    const p2 = q.enqueue(async () => {
      done.push('fast-new')
    })
    await Promise.all([p1, p2])
    check('큐: 완료 순서 보존', done.join(',') === 'slow-old,fast-new', done.join(','))
  }
  // (b) seq 로 오래된 비최종 요청 건너뛰기 (중복 방지)
  {
    const q = createSerialSaveQueue()
    const sent: number[] = []
    const enqueueSave = (seq: number) =>
      q.enqueue(async () => {
        if (seq !== q.currentSeq()) return // 더 최신 요청 대기 중 → 건너뜀
        sent.push(seq)
      })
    const s1 = q.nextSeq()
    const p1 = enqueueSave(s1)
    const s2 = q.nextSeq()
    const p2 = enqueueSave(s2)
    await Promise.all([p1, p2])
    check('큐: 오래된 요청 건너뜀', sent.length === 1 && sent[0] === s2, JSON.stringify(sent))
  }
  // (c) 실패해도 체인이 계속됨
  {
    const q = createSerialSaveQueue()
    const done: string[] = []
    const p1 = q
      .enqueue(async () => {
        throw new Error('network')
      })
      .catch(() => done.push('failed'))
    const p2 = q.enqueue(async () => {
      done.push('after-failure')
    })
    await Promise.all([p1, p2])
    check('큐: 실패 후 재시도 가능', done.includes('after-failure'))
  }
  // (d) close 후 저장 차단 (submitted read-only)
  {
    const q = createSerialSaveQueue()
    const done: string[] = []
    await q.enqueue(async () => {
      done.push('final')
      q.close()
    })
    await q.enqueue(async () => {
      done.push('late-autosave')
    })
    check('큐: 제출 후 draft 저장 차단', done.join(',') === 'final', done.join(','))
    check('큐: closed 상태 노출', q.isClosed())
  }
}

/* ------------------------------------------------------------------ */
/* 2. 숨김 조건부 답변 sanitizer (단일·중첩)                              */
/* ------------------------------------------------------------------ */

function placement(over: Partial<SnapshotPlacement> & { questionId: string }): SnapshotPlacement {
  return {
    id: `pl-${over.questionId}`,
    questionCode: over.questionId.toUpperCase(),
    questionText: over.questionId,
    helpText: '',
    example: '',
    type: 'short_text',
    category: 'basic',
    scope: 'common',
    scoringDomain: 'none',
    expertRiskGrade: 'green',
    options: [],
    repeatTableColumns: [],
    required: false,
    condition: null,
    sourceScope: 'common',
    orderIndex: 0,
    ...over,
  } as SnapshotPlacement
}

function answer(questionId: string, value: string): SurveyAnswer {
  const now = new Date().toISOString()
  return { questionId, questionCode: questionId.toUpperCase(), value, answeredAt: now, updatedAt: now }
}

function testSanitizer(): void {
  // q1(무조건) → q2(q1==='yes') → q3(q2==='deep')  — 중첩 조건 체인
  const sections: SnapshotSection[] = [
    {
      id: 'sec-1',
      title: 't',
      description: '',
      orderIndex: 0,
      placements: [
        placement({ questionId: 'q1' }),
        placement({
          questionId: 'q2',
          condition: { sourceQuestionId: 'q1', operator: 'equals', comparisonValue: 'yes' },
        }),
        placement({
          questionId: 'q3',
          condition: { sourceQuestionId: 'q2', operator: 'equals', comparisonValue: 'deep' },
        }),
      ],
    },
  ]

  // (a) 조건 충족 시 모두 보임·모두 유지
  {
    const answers = [answer('q1', 'yes'), answer('q2', 'deep'), answer('q3', 'kept')]
    const visible = evaluateVisibleSnapshotQuestions(
      sections,
      new Map(answers.map((a) => [a.questionId, a.value])),
    )
    check('조건 충족: 3개 모두 보임', visible.length === 3, String(visible.length))
    const out = sanitizeAnswersForSubmission(sections, answers)
    check('조건 충족: 답변 3개 유지', out.length === 3, String(out.length))
  }
  // (b) 상위 답변 변경 → 직접 숨김 질문 답변 제거
  {
    const answers = [answer('q1', 'no'), answer('q2', 'deep'), answer('q3', 'stale')]
    const out = sanitizeAnswersForSubmission(sections, answers)
    check('직접 숨김: q2 답변 제거', !out.some((a) => a.questionId === 'q2'))
    // (c) 중첩: q2 가 숨겨졌으므로 남아 있는 q2 답변을 근거로 q3 을 살리면 안 됨
    check('중첩 숨김: q3 답변도 제거', !out.some((a) => a.questionId === 'q3'), JSON.stringify(out.map((a) => a.questionId)))
    check('보이는 q1 은 유지', out.some((a) => a.questionId === 'q1'))
  }
  // (d) 손상된 조건(source 없음) → 숨김 유지
  {
    const broken: SnapshotSection[] = [
      {
        id: 'sec-2',
        title: 't',
        description: '',
        orderIndex: 0,
        placements: [
          placement({
            questionId: 'q9',
            condition: { sourceQuestionId: 'missing', operator: 'equals', comparisonValue: 'x' },
          }),
        ],
      },
    ]
    const out = sanitizeAnswersForSubmission(broken, [answer('q9', 'zzz')])
    check('손상 조건: 답변 제외', out.length === 0, String(out.length))
  }
}

/* ------------------------------------------------------------------ */
/* 3. emergency draft 최신성 비교                                        */
/* ------------------------------------------------------------------ */

function testDraftFreshness(): void {
  const draft = {
    responseId: 'r1',
    answers: {},
    profile: { name: '', position: '', department: '', email: '', phone: '' },
    consented: false,
    currentPageIndex: 0,
    updatedAt: '2026-07-22T10:00:00.000Z',
  }
  check('draft 가 더 최신이면 복구', isDraftNewer(draft, '2026-07-22T09:59:59.000Z'))
  check('정상 저장이 더 최신이면 draft 무시', !isDraftNewer(draft, '2026-07-22T10:00:01.000Z'))
  check('정상 저장 기록이 없으면 draft 사용', isDraftNewer(draft, null))
}

/* ------------------------------------------------------------------ */

;(async () => {
  await testQueue()
  testSanitizer()
  testDraftFreshness()
  console.log(`Persistence 단위 테스트: ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    console.log('PERSISTENCE_FAIL')
    process.exit(1)
  }
  console.log('PERSISTENCE_PASS')
})()
