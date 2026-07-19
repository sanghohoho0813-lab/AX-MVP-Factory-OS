import type { RespondentRole } from '../../types'
import type {
  AnalysisIssueInput,
  InterviewQuestionInput,
  InterviewQuestionPriority,
  ResponseComparisonItem,
} from '../../types/assessment'
import type { AnalysisDataset } from './analysisData'

interface Template {
  targetRole: RespondentRole
  priority: InterviewQuestionPriority
  build: (ctx: TemplateContext) => { question: string; expectedEvidence: string }
}

interface TemplateContext {
  comparison?: ResponseComparisonItem
  issue: AnalysisIssueInput
}

function comparisonValues(item?: ResponseComparisonItem): {
  a: string
  b: string
} {
  if (!item || item.respondentValues.length < 2) return { a: '-', b: '-' }
  return {
    a: item.respondentValues[0].displayValue,
    b: item.respondentValues[1].displayValue,
  }
}

/** issue.ruleKey → 인터뷰 질문 템플릿 */
const TEMPLATES: Record<string, Template> = {
  conflict_usage_will: {
    targetRole: 'worker',
    priority: 'critical',
    build: () => ({
      question:
        '대표자는 도구 사용 의지가 높다고 응답했으나 현장 담당자는 낮게 응답했습니다. 실제 사용 담당자와 주간 피드백 가능 시간을 확정할 수 있습니까?',
      expectedEvidence: '실제 사용 담당자, 주간 피드백 가능 시간',
    }),
  },
  conflict_workload: {
    targetRole: 'manager',
    priority: 'high',
    build: (ctx) => {
      const { a, b } = comparisonValues(ctx.comparison)
      return {
        question: `월 업무량 응답이 응답자마다 ${a} · ${b}로 다릅니다. 어떤 업무 범위를 기준으로 산정한 수치인지 설명해주세요.`,
        expectedEvidence: '업무 범위 정의, 월 처리량 산정 기준',
      }
    },
  },
  conflict_data_holding: {
    targetRole: 'worker',
    priority: 'high',
    build: () => ({
      question:
        '데이터 보관 형태에 대한 응답이 응답자마다 다릅니다. 실제 사용 중인 데이터 샘플 3건을 확인할 수 있습니까?',
      expectedEvidence: '실제 데이터 샘플 3건, 보관 위치',
    }),
  },
  conflict_test_owner: {
    targetRole: 'manager',
    priority: 'high',
    build: () => ({
      question:
        '테스트 담당자 지정 가능 여부에 대한 응답이 다릅니다. 실제 테스트 담당자와 참여 가능 시간을 확정할 수 있습니까?',
      expectedEvidence: '테스트 담당자 지정, 참여 가능 시간',
    }),
  },
  conflict_data_provision: {
    targetRole: 'manager',
    priority: 'high',
    build: () => ({
      question:
        '자료 제공 가능 여부에 대한 응답이 다릅니다. 실제 제공 가능한 자료와 정리 소요 기간을 알려주실 수 있습니까?',
      expectedEvidence: '제공 가능 자료 목록, 정리 소요 기간',
    }),
  },
  missing_kpi: {
    targetRole: 'manager',
    priority: 'high',
    build: () => ({
      question:
        '개선 전후를 비교하기 위해 현재 건당 처리시간, 월 처리건수, 오류 건수 중 측정 가능한 항목은 무엇입니까?',
      expectedEvidence: '측정 가능한 KPI 항목, 현재 수치',
    }),
  },
  missing_workload: {
    targetRole: 'worker',
    priority: 'high',
    build: () => ({
      question:
        '자동화를 검토 중인 핵심 업무의 월 처리건수와 건당 소요시간을 대략이라도 알려주실 수 있습니까?',
      expectedEvidence: '핵심 업무별 월 처리건수·소요시간',
    }),
  },
  missing_data_provision: {
    targetRole: 'manager',
    priority: 'high',
    build: () => ({
      question:
        '현재 업무에 사용하는 엑셀·종이문서·메신저 자료 중 실제 샘플 3건을 제공할 수 있습니까?',
      expectedEvidence: '실제 업무 자료 샘플 3건',
    }),
  },
  risk_privacy: {
    targetRole: 'manager',
    priority: 'high',
    build: () => ({
      question:
        '개인정보·민감정보의 처리 주체와 보관 방식은 어떻게 됩니까? 외부 위탁이나 별도 동의 절차가 있습니까?',
      expectedEvidence: '개인정보 처리 주체·범위, 동의 절차',
    }),
  },
  expert_human_review: {
    targetRole: 'manager',
    priority: 'high',
    build: () => ({
      question:
        '업무 결과에 대한 최종 판단은 누가, 어떤 기준으로 합니까? 자동화가 지원할 수 있는 범위는 어디까지입니까?',
      expectedEvidence: '최종 판단 주체·기준, 자동화 가능 범위',
    }),
  },
  insufficient_no_worker: {
    targetRole: 'worker',
    priority: 'high',
    build: () => ({
      question:
        '실제 현장에서 이 업무를 수행하는 담당자와 인터뷰 또는 설문이 가능합니까? 가능한 일정을 알려주세요.',
      expectedEvidence: '현장 담당자 인터뷰 가능 일정',
    }),
  },
  low_adoption_will: {
    targetRole: 'owner',
    priority: 'critical',
    build: () => ({
      question:
        '새 도구 도입의 목적과 실제 운영 적용 계획을 구체적으로 설명해주실 수 있습니까? 사용을 담당할 직원이 있습니까?',
      expectedEvidence: '도입 목적, 운영 적용 계획, 사용 담당자',
    }),
  },
}

const REASON_BY_TYPE: Record<string, string> = {
  perception_gap: '응답자 간 인식 차이를 확인하기 위해 필요합니다.',
  contradiction: '응답 간 모순을 확인하기 위해 필요합니다.',
  missing_data: '설문에서 확인되지 않은 정보를 보완하기 위해 필요합니다.',
  risk_signal: '위험 요소를 구체적으로 확인하기 위해 필요합니다.',
  expert_review: '전문 판단이 필요한 범위를 확인하기 위해 필요합니다.',
  insufficient_response: '응답 부족을 보완하기 위해 필요합니다.',
  invalid_answer: '해석이 어려운 응답을 명확히 하기 위해 필요합니다.',
  outlier: '극단값의 배경을 확인하기 위해 필요합니다.',
}

/**
 * 이슈 기반 추가 인터뷰 질문을 규칙 템플릿으로 생성한다. (순수 함수)
 * AI 없이 사전 정의 템플릿으로만 생성한다.
 */
export function generateInterviewQuestions(
  dataset: AnalysisDataset,
  issues: AnalysisIssueInput[],
  comparisons: ResponseComparisonItem[],
): InterviewQuestionInput[] {
  const out: InterviewQuestionInput[] = []
  const seen = new Set<string>()

  for (const issue of issues) {
    const template = TEMPLATES[issue.ruleKey]
    const ruleKey = `iq_${issue.ruleKey}`
    if (seen.has(ruleKey)) continue
    seen.add(ruleKey)

    if (template) {
      const comparison = comparisons.find((c) =>
        issue.ruleKey.includes(c.topicKey),
      )
      const built = template.build({ comparison, issue })
      out.push({
        projectId: dataset.project.id,
        sourceIssueIds: [],
        targetRespondentRole: template.targetRole,
        priority: template.priority,
        question: built.question,
        reason: `${issue.title} — ${REASON_BY_TYPE[issue.type] ?? ''}`,
        expectedEvidence: built.expectedEvidence,
        status: 'suggested',
        manual: false,
        answer: '',
        answeredAt: null,
        ruleKey,
      })
    } else if (issue.severity !== 'info') {
      // 템플릿이 없는 주의·중대 이슈에 대한 일반 후속 질문
      out.push({
        projectId: dataset.project.id,
        sourceIssueIds: [],
        targetRespondentRole: 'manager',
        priority: issue.severity === 'critical' ? 'high' : 'medium',
        question: `${issue.title}과 관련해, 실제 상황을 구체적으로 설명해주실 수 있습니까?`,
        reason: `${issue.title} — ${REASON_BY_TYPE[issue.type] ?? ''}`,
        expectedEvidence: issue.suggestedAction,
        status: 'suggested',
        manual: false,
        answer: '',
        answeredAt: null,
        ruleKey,
      })
    }
  }

  return out
}
