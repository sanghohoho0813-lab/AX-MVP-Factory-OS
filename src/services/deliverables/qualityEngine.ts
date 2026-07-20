import type {
  DeliverablePackage,
  DeliverableQualityCheck,
  DeliverableSection,
} from '../../types/deliverables'
import { hasLeakedInternalContent } from './redactionEngine'

let seq = 0
function mk(
  severity: DeliverableQualityCheck['severity'],
  title: string,
  description: string,
  passed: boolean,
  relatedSectionIds: string[] = [],
  relatedSourceIds: string[] = [],
): DeliverableQualityCheck {
  seq += 1
  return { id: `dq-${seq}`, severity, title, description, passed, relatedSectionIds, relatedSourceIds }
}

function activeSections(pkg: DeliverablePackage): DeliverableSection[] {
  return pkg.sections.filter((s) => s.status !== 'excluded')
}
function hasType(pkg: DeliverablePackage, type: DeliverableSection['type']): boolean {
  return activeSections(pkg).some((s) => s.type === type)
}

const PHONE = /01[016-9][-\s]?\d{3,4}[-\s]?\d{4}/
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/

/**
 * 제출자료 품질검사. error + passed=false 는 확정을 막는다. 결정적.
 */
export function runDeliverableQuality(pkg: DeliverablePackage, opts: { stale: boolean }): DeliverableQualityCheck[] {
  seq = 0
  const checks: DeliverableQualityCheck[] = []
  const active = activeSections(pkg)
  const availableRefs = pkg.sourceReferences.filter((r) => r.available)
  const clientLike = pkg.audience === 'client' || pkg.audience === 'institution'
  const includesAx = pkg.includedTracks.includes('ax')
  const includesWebsite = pkg.includedTracks.includes('website')
  const includesValidation = pkg.includedTracks.includes('validation')

  /* 오류 */
  checks.push(mk('error', '출처 스냅샷', '확정된 출처가 1개 이상 있어야 합니다.', availableRefs.length > 0))
  checks.push(mk('error', '패키지 이름', '자료 패키지 이름이 필요합니다.', pkg.name.trim() !== ''))
  checks.push(mk('error', '포함 자료', '포함된 자료(Section)가 1개 이상 있어야 합니다.', active.length > 0))
  checks.push(mk('error', '1페이지 요약', '프로젝트 한눈에 보기(1페이지 요약)가 포함되어야 합니다.', hasType(pkg, 'executive_summary')))
  checks.push(mk('error', '최종 요약', '최종 요약이 작성되어야 합니다.', pkg.finalSummary.trim() !== ''))
  if (clientLike) {
    const leaked = active.filter((s) => s.visibility === 'internal_only')
    checks.push(mk('error', '내부 전용 노출', '고객·기관용 자료에 내부 전용 Section이 포함되면 안 됩니다.', !hasLeakedInternalContent(pkg, pkg.audience), leaked.map((s) => s.id)))
    // 개인정보 노출 (가림 규칙 미적용 상태에서 고객 공개 Section의 연락처)
    const contactRule = pkg.redactionRules.find((r) => r.type === 'remove_personal_contact' && r.enabled)
    const exposed = active.filter((s) => s.visibility !== 'internal_only' && s.structuredContent.some((b) => !b.internalOnly && (PHONE.test(b.text) || EMAIL.test(b.text) || b.keyValues.some((kv) => PHONE.test(kv.value) || EMAIL.test(kv.value)))))
    checks.push(mk('error', '개인정보 노출', '고객·기관용 자료에서 개인 연락처가 노출되면 안 됩니다.', contactRule !== undefined || exposed.length === 0, exposed.map((s) => s.id)))
  }
  if (pkg.type === 'development_handoff') {
    checks.push(mk('error', '기능 범위', '개발 전달자료에는 기능 명세가 필요합니다.', hasType(pkg, 'feature_specification')))
    checks.push(mk('error', '화면 명세', '개발 전달자료에는 화면 명세가 필요합니다.', hasType(pkg, 'screen_specification')))
    checks.push(mk('error', '데이터 명세', '개발 전달자료에는 데이터 명세가 필요합니다.', hasType(pkg, 'data_specification')))
    checks.push(mk('error', '개발 프롬프트', '개발 전달자료에는 개발 프롬프트가 필요합니다.', pkg.prompts.length > 0))
  }
  if (includesWebsite) {
    checks.push(mk('error', '사이트맵', '홈페이지 자료에는 사이트맵이 필요합니다.', hasType(pkg, 'sitemap') || hasType(pkg, 'website_strategy')))
  }
  if (includesAx) {
    checks.push(mk('error', 'AX 핵심 과제', 'AX 자료에는 핵심 과제·범위가 필요합니다.', hasType(pkg, 'selected_task') || hasType(pkg, 'mvp_scope')))
  }
  if (pkg.type === 'validation_report') {
    checks.push(mk('error', '검증 근거', '테스트 결과자료는 실제 검증 결과가 있어야 합니다.', includesValidation && hasType(pkg, 'validation_summary')))
  }
  checks.push(mk('error', '출처 손상', '모든 출처 참조가 손상되면 자료를 확정할 수 없습니다.', pkg.sourceReferences.length === 0 || availableRefs.length > 0))
  if (opts.stale) {
    checks.push(mk('error', '원본 변경 미확인', '출처 원본이 변경되었습니다. 새 버전 생성을 검토하거나 변경을 확인하세요.', false))
  }

  /* 경고 */
  const hasValidationSummary = hasType(pkg, 'validation_summary')
  if (!includesValidation) checks.push(mk('warning', '테스트 전', '실제 사용 테스트 전 자료입니다. 검증 완료로 표현하지 마세요.', false))
  const manualCount = active.filter((s) => s.manuallyEdited).length
  checks.push(mk('warning', '수동 수정 사유', '수동 수정한 Section에는 수정 사유를 남기는 것이 좋습니다.', active.every((s) => !s.manuallyEdited || s.editNotes.trim() !== '')))
  checks.push(mk('warning', 'openQuestions', '미확인 질문이 남아 있습니다. 확정 전 확인하세요.', pkg.openQuestions.length === 0))
  checks.push(mk('warning', 'critical 위험', 'critical 위험이 있습니다. 대응을 확인하세요.', !pkg.risks.some((r) => r.severity === 'critical')))
  if (pkg.type === 'client_proposal') {
    const techHeavy = active.filter((s) => s.track === 'ax' && (s.type === 'feature_specification' || s.type === 'data_specification'))
    checks.push(mk('warning', '고객용 기술 설명 과다', '고객용 자료에 개발 상세가 많습니다. 눈높이를 확인하세요.', techHeavy.length === 0))
  }
  if (pkg.type === 'institution_preparation') {
    checks.push(mk('warning', '공식 서식 확인', '기관 제출 준비자료입니다. 실제 공고문·신청서식을 별도 확인하세요.', false))
  }
  const shortPrompts = pkg.prompts.filter((p) => p.content.trim().length < 200)
  if (pkg.prompts.length > 0) checks.push(mk('warning', '프롬프트 길이', '지나치게 짧은 개발 프롬프트가 있습니다.', shortPrompts.length === 0, [], shortPrompts.map((p) => p.id)))
  const stagedMissingPrereq = pkg.prompts.filter((p) => p.type === 'ax_staged_build' && p.sequenceNumber > 1 && p.prerequisites.length === 0)
  if (stagedMissingPrereq.length > 0) checks.push(mk('warning', '단계별 프롬프트 선행조건', '단계별 프롬프트에 선행조건이 없습니다.', false))

  /* 안내 */
  checks.push(mk('info', '포함 Section 수', `${active.length}개 Section이 포함되었습니다.`, true))
  const withSources = active.filter((s) => s.sourceReferences.length > 0 || s.structuredContent.some((b) => b.sourceReferenceIds.length > 0)).length
  checks.push(mk('info', '근거 연결률', `${active.length > 0 ? Math.round((withSources / active.length) * 100) : 0}% Section이 근거에 연결됨`, true))
  checks.push(mk('info', '수동 편집률', `${active.length > 0 ? Math.round((manualCount / active.length) * 100) : 0}% Section이 수동 편집됨`, true))
  const clientVisible = active.filter((s) => s.visibility === 'client_visible' || s.visibility === 'shared').length
  checks.push(mk('info', '고객 공개 비율', `${active.length > 0 ? Math.round((clientVisible / active.length) * 100) : 0}% Section이 고객 공개 범위`, true))
  checks.push(mk('info', '검증 포함 여부', includesValidation && hasValidationSummary ? '실제 사용 테스트 결과 포함' : '검증 전 설계안', true))
  checks.push(mk('info', '개발 프롬프트', `${pkg.prompts.length}개 프롬프트 포함`, true))
  checks.push(mk('info', '자료 최신성', opts.stale ? '출처 원본 변경됨 (오래된 스냅샷)' : '최신 출처 반영', true))

  return checks
}

export function hasBlockingErrors(checks: DeliverableQualityCheck[]): boolean {
  return checks.some((c) => c.severity === 'error' && !c.passed)
}
