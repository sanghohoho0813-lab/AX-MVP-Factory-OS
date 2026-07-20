import type { CollectedSources } from './sourceCollector'
import type { SectionSeed } from './sectionFactory'
import type { DeliverableRiskItem, DeliverableTrackType } from '../../types/deliverables'
import { BlockBuilder } from './contentBlocks'

let riskSeq = 0
function risk(
  track: DeliverableTrackType,
  title: string,
  description: string,
  severity: DeliverableRiskItem['severity'],
  source: string,
): DeliverableRiskItem {
  riskSeq += 1
  return {
    id: `risk-${riskSeq}`,
    track,
    title,
    description,
    severity,
    source,
    mitigation: '',
    owner: '',
    status: 'open',
    clientVisible: severity === 'low' || severity === 'medium',
  }
}

/** AX와 홈페이지 위험을 트랙별로 분리해 수집한다 (합산·혼합 금지). */
export function buildRisks(sources: CollectedSources): DeliverableRiskItem[] {
  riskSeq = 0
  const items: DeliverableRiskItem[] = []

  if (sources.mvpHandoff) {
    ;(sources.selectionHandoff?.risks ?? []).forEach((r) => items.push(risk('ax', r, r, 'medium', '과제선정 인계')))
    if (sources.axValidationHandoff) {
      sources.axValidationHandoff.unresolvedIssues.forEach((i) =>
        items.push(risk('ax', i, i, i.includes('critical') ? 'critical' : 'high', 'AX 실제 사용 테스트')),
      )
    } else {
      items.push(risk('ax', '실제 사용 테스트 전', 'AX MVP 설계안이 실제 사용 테스트로 검증되지 않았습니다.', 'medium', 'AX 트랙'))
    }
  }

  if (sources.websiteHandoff) {
    ;(sources.websiteHandoff.risks ?? []).forEach((r) => items.push(risk('website', r, r, 'medium', '홈페이지 설계')))
    if (sources.websiteValidationHandoff) {
      sources.websiteValidationHandoff.unresolvedIssues.forEach((i) =>
        items.push(risk('website', i, i, i.includes('critical') ? 'critical' : 'high', '홈페이지 테스트')),
      )
    } else {
      items.push(risk('website', '공개 전 테스트 전', '홈페이지 설계안이 공개 전 테스트로 검증되지 않았습니다.', 'medium', '홈페이지 트랙'))
    }
  }

  return items
}

const SEVERITY_LABEL: Record<DeliverableRiskItem['severity'], string> = {
  low: '낮음',
  medium: '보통',
  high: '높음',
  critical: '심각',
}

export function buildRiskSeed(risks: DeliverableRiskItem[]): SectionSeed {
  const b = new BlockBuilder('risk')
  b.paragraph('AX와 홈페이지의 위험은 트랙별로 분리해 관리하며, 하나의 지표로 합산하지 않습니다.')
  const ax = risks.filter((r) => r.track === 'ax')
  const web = risks.filter((r) => r.track === 'website')
  if (ax.length) {
    b.table(['위험', '심각도', '출처', '대응'], ax.map((r) => ({ cells: [r.title, SEVERITY_LABEL[r.severity], r.source, r.mitigation || '대응 방안 수립 필요'] })), { title: 'AX 위험' })
  }
  if (web.length) {
    b.table(['위험', '심각도', '출처', '대응'], web.map((r) => ({ cells: [r.title, SEVERITY_LABEL[r.severity], r.source, r.mitigation || '대응 방안 수립 필요'] })), { title: '홈페이지 위험' })
  }
  if (!ax.length && !web.length) b.paragraph('식별된 주요 위험이 없습니다. 실행 전 담당자가 재확인하세요.')
  return { type: 'risk_register', track: 'overview', title: '리스크와 대응', blocks: b.build(), visibility: 'internal_only' }
}
