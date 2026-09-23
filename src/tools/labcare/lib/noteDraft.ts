/**
 * 연구노트 초안 만들기 (D-91).
 *
 * 원본(ccs-post-management · lib/noteDraft.ts)의 글 짜는 규칙을 그대로 옮겼다.
 * **AI 를 부르지 않는다.** 대표가 적은 것을 실사에서 읽히는 순서로 다시 놓아 주는 것이 전부다.
 * 원본도 그랬다 — 이름만 '초안 생성' 이었을 뿐 규칙 기반이었다.
 */

export interface ResearcherRole {
  name: string
  role: string
}

export interface NoteInput {
  /** YYYY-MM */
  month: string
  activities: string
  tests: string
  problems: string
  nextPlan: string
  roles: ResearcherRole[]
  relevance: string
}

export interface NoteProject {
  name: string
  /** 업종·제품·서비스와의 연결 (실사 대응의 핵심) */
  productService: string
}

/** 입력값 → 연구노트 초안 본문 */
export function generateNoteDraft(input: NoteInput, companyName: string, project: NoteProject): string {
  const monthLabel = `${input.month.replace('-', '년 ')}월`
  const roleLines =
    input.roles.length > 0
      ? input.roles.map((r) => `  - ${r.name || '(미입력)'}: ${r.role || '(역할 미입력)'}`).join('\n')
      : '  - (참여 연구원 미입력)'

  return [
    `[${monthLabel} 연구노트] ${project.name}`,
    `과제 대상: ${companyName} · ${project.productService || '제품/서비스 미입력'}`,
    '',
    '1. 이번 달 연구개발 활동',
    input.activities || '(연구활동 미입력)',
    '',
    '2. 테스트 및 개선',
    input.tests || '(테스트/개선 미입력)',
    '',
    '3. 확인된 문제점',
    input.problems || '(문제점 미입력)',
    '',
    '4. 참여 연구원별 역할',
    roleLines,
    '',
    '5. 업종·제품·서비스와의 직접 관련성',
    input.relevance || '(관련성 미입력)',
    '',
    '6. 다음 달 연구 계획',
    input.nextPlan || '(다음 계획 미입력)',
  ].join('\n')
}

/** 실사 대응 관점 보완 문구를 초안 뒤에 덧붙인다 */
export function enhanceForAudit(draft: string, project: NoteProject): string {
  return [
    draft,
    '',
    '─────────────────────────────',
    '[실사 대응 보완]',
    `· 본 연구활동은 '${project.productService || '당사 제품/서비스'}'의 기술적 개선과 직접 연결됩니다.`,
    '· 단순 생산·영업 활동이 아닌, 신규성·진보성이 있는 연구개발 활동임을 기록으로 뒷받침합니다.',
    '· 활동 결과는 시험성적서·설계문서·회의록 등 객관적 증빙과 함께 보관할 것을 권장합니다.',
  ].join('\n')
}

/**
 * 초안이 '업종·제품·서비스와 직접 연결되는지' 를 점검한다.
 * 실사에서 일반적인 서술은 지적 대상이 된다 — 구체성 신호를 본다.
 */
export function checkRelevance(
  input: Pick<NoteInput, 'activities' | 'relevance'>,
  project: NoteProject,
): { ok: boolean; hints: string[] } {
  const hints: string[] = []
  const text = `${input.activities} ${input.relevance}`.trim()

  if (input.relevance.trim().length < 10) {
    hints.push('업종·제품·서비스와의 직접 관련성 설명이 짧습니다. 구체적으로 보완하세요.')
  }
  const keyword = (project.productService || '').split(/[\s,/·]+/).filter((w) => w.length >= 2)[0]
  if (keyword && !text.includes(keyword)) {
    hints.push(`연구활동에 제품/서비스 키워드('${keyword}')가 드러나지 않습니다. 직접 연결을 명시하세요.`)
  }
  if (input.activities.trim().length < 20) {
    hints.push('연구활동 서술이 일반적입니다. 무엇을·어떻게·왜 했는지 구체적으로 적으세요.')
  }

  return { ok: hints.length === 0, hints }
}

export type NoteStatus = '작성 필요' | '작성중' | '초안 완료' | '실사보완 완료' | '저장 완료'

export const NOTE_STATUSES: readonly NoteStatus[] = ['작성 필요', '작성중', '초안 완료', '실사보완 완료', '저장 완료']

/** 이번 달 (YYYY-MM) */
export function currentMonth(at: Date = new Date()): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`
}
