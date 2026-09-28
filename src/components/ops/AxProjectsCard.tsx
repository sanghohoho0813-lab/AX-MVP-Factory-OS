/**
 * 업체 상세 > AX 프로젝트 (D-135).
 *
 * 이 업체와 이어진 AX 스튜디오 고객사의 프로젝트를 여기서 본다 — 이름 · 지금 단계 · 진행 · 다음 할 일.
 * 누르면 그 프로젝트로. 이어진 고객사가 없으면 그리지 않는다(모듈 입구 'AX 프로젝트 열기' 로 만든다).
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { projectRepository } from '../../repositories'
import { linkedOrgOf } from '../../services/axClientLink'
import { computeProjectJourney } from '../../services/journeyService'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { Section, Surface } from '../ui/primitives'
import { ProgressBar } from '../ui/ProgressBar'
import { HEALTH_META } from '../../lib/statusMeta'

export function AxProjectsCard({ record }: { record: ClientOpsRecord }) {
  const version = useStoreVersion()
  const org = useMemo(
    () => linkedOrgOf(record),
    // 고객사 · 프로젝트가 바뀌면(version) 다시 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [record.id, record.businessNumber, version],
  )
  const projects = useMemo(
    () => (org ? projectRepository.getByOrganizationId(org.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, version],
  )
  if (!org) return null
  return (
    <Section title="AX 프로젝트" count={projects.length}>
      <div className="flex flex-col gap-2" data-testid="ax-projects">
        {projects.length === 0 ? (
          <Surface className="t-sub flex flex-wrap items-center gap-2 p-4 break-keep text-slate-600">
            AX 고객사 <b className="text-slate-800">{org.name}</b> 와 이어져 있습니다. 아직 프로젝트가 없습니다.
            <Link to={`/projects/new?organizationId=${encodeURIComponent(org.id)}`} className="tap ml-auto inline-flex items-center font-semibold text-brand-700 hover:underline">
              새 프로젝트 만들기
            </Link>
          </Surface>
        ) : (
          projects.map((p) => {
            const progress = computeProjectJourney(p).progress
            return (
              <Link key={p.id} to={`/projects/${p.id}`} data-ax-project={p.id} className="tap block rounded-(--radius-panel) border border-slate-200 bg-white p-4 hover:border-brand-400">
                <div className="flex flex-wrap items-center gap-2">
                  <Sparkles aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                  <span className="t-body min-w-0 flex-[1_1_12rem] font-bold break-keep text-slate-900">{p.name}</span>
                  <span className="t-sub rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 font-semibold whitespace-nowrap text-brand-800">{progress.currentStep.label}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar value={progress.percent} tone={HEALTH_META[p.healthStatus].tone} label={`${p.name} 진행`} />
                  <span className="t-meta shrink-0 whitespace-nowrap text-slate-500">{progress.stepText}</span>
                </div>
                <p className="t-sub mt-1.5 flex items-start gap-1 break-keep text-slate-700">
                  <ArrowRight aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                  다음: {progress.nextAction.title}
                </p>
              </Link>
            )
          })
        )}
        <Link to={`/clients/${encodeURIComponent(org.id)}`} className="tap t-sub inline-flex items-center gap-1 self-start font-semibold text-brand-700 hover:underline" data-testid="ax-org-open">
          AX 스튜디오 고객사 열기 <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </Section>
  )
}
