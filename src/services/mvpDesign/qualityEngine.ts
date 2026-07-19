import type {
  GuardrailKey,
  MvpDesign,
  MvpDesignQualityCheck,
  QualityCheckCode,
  ScopeGuardrailCheck,
} from '../../types/mvpDesign'
import { BLOCKING_GUARDRAILS, MVP_LEVEL_WARNING_THRESHOLD } from './scoringConfig'

const GUARDRAIL_TO_CODE: Partial<Record<GuardrailKey, QualityCheckCode>> = {
  max_roles: 'role_over_limit',
  max_screens: 'screen_over_limit',
  max_forms: 'form_over_limit',
  max_ai_features: 'ai_over_limit',
  max_reports: 'report_over_limit',
  max_external_api: 'api_over_limit',
}

type QualityInput = Pick<
  MvpDesign,
  | 'features'
  | 'screens'
  | 'roles'
  | 'aiFeatures'
  | 'integrations'
  | 'businessRules'
  | 'acceptanceCriteria'
  | 'kpis'
  | 'levelDecision'
  | 'hasWebsiteTrack'
  | 'websiteStudioRecommended'
>

/**
 * 설계 품질 점검. error 심각도는 확정을 막는다.
 * 결정적: 동일 설계면 동일 결과.
 */
export function runQualityChecks(
  design: QualityInput,
  guardrails: ScopeGuardrailCheck[],
): MvpDesignQualityCheck[] {
  const checks: MvpDesignQualityCheck[] = []
  const push = (code: QualityCheckCode, severity: MvpDesignQualityCheck['severity'], message: string, relatedId = '') =>
    checks.push({ code, severity, message, relatedId })

  const mustFeatures = design.features.filter((f) => f.scope === 'must')

  if (mustFeatures.length === 0) {
    push('no_must_feature', 'error', '1차 필수(Must) 기능이 하나도 없습니다. 최소 1개를 지정하세요.')
  }

  design.features
    .filter((f) => f.scope === 'must' || f.scope === 'should')
    .forEach((f) => {
      if (!f.input.trim() || !f.processing.trim() || !f.output.trim()) {
        push('feature_missing_io', 'error', `'${f.name}'에 입력·처리·출력 정의가 비어 있습니다.`, f.id)
      }
      if (f.evidence.length === 0) {
        push('feature_missing_evidence', 'warning', `'${f.name}'에 근거(출처) 연결이 없습니다.`, f.id)
      }
    })

  mustFeatures.forEach((f) => {
    if (!design.acceptanceCriteria.some((a) => a.featureId === f.id)) {
      push('must_without_acceptance', 'error', `'${f.name}'에 수용 기준이 없습니다. 검증 기준을 정의하세요.`, f.id)
    }
  })

  // 가드레일 초과 → 확정 차단 오류
  guardrails.forEach((g) => {
    if (g.status === 'exceeded' && BLOCKING_GUARDRAILS.includes(g.key)) {
      const code = GUARDRAIL_TO_CODE[g.key]
      if (code) push(code, 'error', `${g.label}: ${g.message}`)
    }
  })

  // AI 정당성
  design.aiFeatures.forEach((ai) => {
    if (!ai.justification.trim()) {
      push('ai_without_justification', 'error', `AI 기능 '${ai.name}'에 도입 사유가 없습니다. 불필요하면 제거하세요.`, ai.id)
    }
  })

  // 전문가 판단 경계 표시 확인
  design.features
    .filter((f) => (f.scope === 'must' || f.scope === 'should') && f.expertJudgmentBoundary)
    .forEach((f) => {
      if (!f.humanReviewRequired) {
        push('expert_boundary_missing', 'error', `'${f.name}'은 전문가 최종판단 영역이므로 사람 확정이 필수입니다.`, f.id)
      }
    })

  // 미해결 필수 의존성
  design.integrations
    .filter((i) => i.requiredBeforeMvp && (i.readiness === 'needs_setup' || i.readiness === 'blocked'))
    .forEach((i) => {
      push('unmet_dependency', 'warning', `외부 연동 '${i.name}'이 준비되지 않았습니다. 대체 방식 또는 2차 연기를 확인하세요.`, i.id)
    })

  // 규칙 확인 필요
  design.businessRules
    .filter((r) => r.needsConfirmation)
    .forEach((r) => {
      push('rule_needs_confirmation', 'info', `규칙 '${r.name}'은 담당자 확인이 필요합니다.`, r.id)
    })

  if (design.kpis.length === 0) {
    push('no_kpi', 'warning', '검증에 사용할 KPI가 없습니다. 최소 1개를 정의하세요.')
  }

  if (design.levelDecision.selectedLevel > MVP_LEVEL_WARNING_THRESHOLD) {
    push('mvp_level_high', 'warning', `선택한 MVP 수준(Level ${design.levelDecision.selectedLevel})이 1차 범위로는 큽니다. 축소를 검토하세요.`)
  }

  if (design.hasWebsiteTrack && design.websiteStudioRecommended) {
    push('website_track_pending', 'info', '홈페이지 트랙이 포함된 프로젝트입니다. 홈페이지 설계는 웹사이트 스튜디오에서 진행하세요.')
  }

  return checks
}

export function hasBlockingErrors(checks: MvpDesignQualityCheck[]): boolean {
  return checks.some((c) => c.severity === 'error')
}
