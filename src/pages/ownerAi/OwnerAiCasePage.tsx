/**
 * /ai/cases/:caseId — 업체 작업실 한 장(대표 전용).
 */
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { CaseWorkspace } from './CaseWorkspace'
import { OwnerAiGate } from './shared'

export default function OwnerAiCasePage() {
  const { caseId = '' } = useParams()
  return (
    <OwnerAiGate>
      <div className="flex flex-col gap-3">
        <Link to="/ai" className="t-sub tap inline-flex min-h-11 items-center gap-1 self-start font-semibold text-slate-600 hover:text-slate-900">
          <ChevronLeft aria-hidden="true" className="size-4" />
          AI 전략실
        </Link>
        <CaseWorkspace key={caseId} caseId={caseId} />
      </div>
    </OwnerAiGate>
  )
}
