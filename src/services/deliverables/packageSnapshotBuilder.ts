import type {
  DeliverablePackage,
  DeliverablePackageSnapshotInput,
} from '../../types/deliverables'

/**
 * 확정 시점의 패키지 상태를 동결한 스냅샷 입력을 만든다.
 * 스냅샷은 이후 원본 데이터·패키지 수정과 무관하게 보존된다.
 */
export function buildPackageSnapshot(
  pkg: DeliverablePackage,
  generatedAt: string,
): DeliverablePackageSnapshotInput {
  return {
    packageId: pkg.id,
    projectId: pkg.projectId,
    organizationId: pkg.organizationId,
    version: pkg.version,
    type: pkg.type,
    audience: pkg.audience,
    sourceReferences: pkg.sourceReferences.map((r) => ({ ...r })),
    sections: pkg.sections.map((s) => ({ ...s, structuredContent: s.structuredContent.map((b) => ({ ...b })), originalStructuredContent: s.originalStructuredContent.map((b) => ({ ...b })) })),
    prompts: pkg.prompts.map((p) => ({ ...p })),
    roadmap: pkg.roadmap.map((r) => ({ ...r })),
    risks: pkg.risks.map((r) => ({ ...r })),
    evidenceIndex: pkg.evidenceIndex.map((e) => ({ ...e })),
    redactionRules: pkg.redactionRules.map((r) => ({ ...r })),
    finalSummary: pkg.finalSummary,
    assumptions: [...pkg.assumptions],
    openQuestions: [...pkg.openQuestions],
    generatedAt,
  }
}
