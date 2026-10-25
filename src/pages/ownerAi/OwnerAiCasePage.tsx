/**
 * /ai/cases/:caseId — 업체 작업실 한 장(대표 전용).
 * UXS-1 '← AI 전략실' 은 화면 공통 머리(PageHero) 안 맨 위로 옮겼다(CaseWorkspace).
 */
import { useParams } from 'react-router-dom'
import { CaseWorkspace } from './CaseWorkspace'
import { OwnerAiGate } from './shared'

export default function OwnerAiCasePage() {
  const { caseId = '' } = useParams()
  return (
    <OwnerAiGate>
      <CaseWorkspace key={caseId} caseId={caseId} />
    </OwnerAiGate>
  )
}
