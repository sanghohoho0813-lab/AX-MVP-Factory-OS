import type {
  DeliverableEvidenceIndexItem,
  DeliverableEvidenceType,
  DeliverableSourceReference,
  DeliverableSourceType,
} from '../../types/deliverables'
import type { CollectedSources } from './sourceCollector'
import type { SectionSeed } from './sectionFactory'
import { BlockBuilder, NEEDS } from './contentBlocks'

/* ------------------------------------------------------------------ */
/* 증거 인덱스 빌더 (Stage 10)                                           */
/*                                                                     */
/* 확정 출처와 검증 인계 스냅샷의 증거 목록을 결정적 증거 인덱스로 만든다.  */
/* 근거 없는 수동 문장은 별도로 표시하며 외부 URL은 메타데이터로만 둔다.    */
/* ------------------------------------------------------------------ */

const EVIDENCE_TYPE_LABEL: Record<DeliverableEvidenceType, string> = {
  survey: '설문',
  assessment: '진단',
  selection: '과제선정',
  design: '설계',
  validation: '실제 사용 테스트',
  metric: 'KPI',
  document: '문서',
  link: '링크',
  manual: '수동 작성',
}

/** 출처 유형에서 증거 유형을 파생한다. */
function evidenceTypeFromSource(sourceType: DeliverableSourceType): DeliverableEvidenceType {
  if (sourceType === 'survey_response') return 'survey'
  if (sourceType === 'assessment') return 'assessment'
  if (sourceType.startsWith('selection')) return 'selection'
  if (sourceType.includes('design')) return 'design'
  if (sourceType.includes('validation')) return 'validation'
  return 'document'
}

function refToItem(ref: DeliverableSourceReference, id: string): DeliverableEvidenceIndexItem {
  return {
    id,
    sourceType: ref.sourceType,
    sourceId: ref.sourceId,
    title: ref.label,
    description: ref.notes,
    relatedSectionIds: [],
    evidenceType: evidenceTypeFromSource(ref.sourceType),
    capturedAt: ref.capturedAt,
    verified: ref.available && !ref.stale,
    externalUrl: '',
    internalOnly: false,
  }
}

/** 확정 출처와 검증 증거 목록에서 증거 인덱스와 렌더링 시드를 만든다. */
export function buildEvidenceIndex(
  sources: CollectedSources,
  sections: { id: string; type: string; track: string }[],
): { items: DeliverableEvidenceIndexItem[]; seed: SectionSeed } {
  const items: DeliverableEvidenceIndexItem[] = []
  let seq = 0
  const nextId = (): string => `ev-${seq++}`

  for (const ref of sources.references) {
    if (!ref.available) continue
    items.push(refToItem(ref, nextId()))
  }

  const axEvidence = sources.axValidationHandoff?.evidenceIndex ?? []
  for (const entry of axEvidence) {
    if (!entry.trim()) continue
    items.push({
      id: nextId(),
      sourceType: 'validation_handoff',
      sourceId: sources.axValidationHandoff?.id ?? '',
      title: entry,
      description: 'AX 실제 사용 테스트 증거',
      relatedSectionIds: [],
      evidenceType: 'validation',
      capturedAt: sources.axValidationHandoff?.generatedAt ?? '',
      verified: true,
      externalUrl: '',
      internalOnly: false,
    })
  }

  const webEvidence = sources.websiteValidationHandoff?.evidenceIndex ?? []
  for (const entry of webEvidence) {
    if (!entry.trim()) continue
    items.push({
      id: nextId(),
      sourceType: 'validation_handoff',
      sourceId: sources.websiteValidationHandoff?.id ?? '',
      title: entry,
      description: '홈페이지 실제 사용 테스트 증거',
      relatedSectionIds: [],
      evidenceType: 'validation',
      capturedAt: sources.websiteValidationHandoff?.generatedAt ?? '',
      verified: true,
      externalUrl: '',
      internalOnly: false,
    })
  }

  const builder = new BlockBuilder('evidence')
  builder.callout(
    `이 자료의 모든 서술은 아래 출처에 연결됩니다. 증거 없는 수동 문장은 "${NEEDS.manualEvidence}"로 표시하며, 외부 URL은 본문에 노출하지 않고 메타데이터로만 저장합니다.`,
    { title: '증거 표기 원칙', tone: 'info' },
  )
  if (items.length > 0) {
    builder.table(
      ['출처', '유형', '설명', '검증여부'],
      items.map((it) => ({
        cells: [
          it.title,
          EVIDENCE_TYPE_LABEL[it.evidenceType],
          it.description || '-',
          it.verified ? '검증됨' : NEEDS.manualEvidence,
        ],
      })),
      { title: `증거 목록 (총 ${items.length}건, 연결 가능 섹션 ${sections.length}개)` },
    )
  } else {
    builder.paragraph('연결 가능한 확정 출처가 없습니다. 진단·설계·검증을 확정하면 증거가 채워집니다.')
  }

  const seed: SectionSeed = {
    type: 'evidence_index',
    track: 'evidence',
    title: '증거 인덱스',
    subtitle: '출처 · 유형 · 검증 여부',
    summary: '자료의 서술을 뒷받침하는 확정 출처와 테스트 증거 목록입니다.',
    blocks: builder.build(),
    sourceReferences: [],
    visibility: 'shared',
    required: false,
  }

  return { items, seed }
}
