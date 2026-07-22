import type {
  DeliverableContentBlock,
  DeliverableSection,
  DeliverableSectionType,
  DeliverableSectionVisibility,
  DeliverableTrackType,
} from '../../types/deliverables'
import { DELIVERABLE_ISO, blocksToText } from './contentBlocks'

export interface SectionSeed {
  type: DeliverableSectionType
  track: DeliverableTrackType
  title: string
  subtitle?: string
  summary?: string
  blocks: DeliverableContentBlock[]
  sourceReferences?: string[]
  visibility?: DeliverableSectionVisibility
  required?: boolean
}

/**
 * SectionSeed로부터 DeliverableSection을 만든다. 자동 생성 본문은 originalBody에 보존한다.
 * orderIndex/packageId는 orchestrator가 채운다.
 */
export function makeSection(seed: SectionSeed, index: number): DeliverableSection {
  const body = blocksToText(seed.blocks)
  return {
    id: `sec-${seed.type}-${index}`,
    packageId: '',
    type: seed.type,
    track: seed.track,
    title: seed.title,
    subtitle: seed.subtitle ?? '',
    summary: seed.summary ?? '',
    body,
    structuredContent: seed.blocks,
    sourceReferences: seed.sourceReferences ?? [],
    visibility: seed.visibility ?? 'shared',
    status: 'auto_generated',
    required: seed.required ?? false,
    manuallyEdited: false,
    originalBody: body,
    originalStructuredContent: seed.blocks,
    editNotes: '',
    editedBy: '',
    editedAt: null,
    qualityChecks: [],
    orderIndex: index,
    createdAt: DELIVERABLE_ISO,
    updatedAt: DELIVERABLE_ISO,
  }
}
