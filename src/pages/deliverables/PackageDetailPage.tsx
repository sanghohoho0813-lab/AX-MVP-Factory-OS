import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  ClipboardCheck,
  Code2,
  Eye,
  FileText,
  ListChecks,
  Pencil,
  Route,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { DeliverablePackage } from '../../types/deliverables'
import { summarizePackage } from '../../services/deliverableService'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { DeliverableQualityBadge, DeliverableTrackBadge } from '../../components/deliverables/badges'
import { PackageSectionFrame, ReadOnlyNotice } from './deliverableShared'

interface NextStep {
  title: string
  description: string
  label: string
  path: string
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
      <p className="text-[0.9rem] text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-[0.9rem] break-keep text-slate-400">{hint}</p>}
    </div>
  )
}

function DetailBody({ pkg, projectId, packageId }: { pkg: DeliverablePackage; projectId: string; packageId: string }) {
  const navigate = useNavigate()
  const base = `/deliverables/projects/${projectId}/packages/${packageId}`
  const summary = summarizePackage(pkg)
  const blockingQuality = pkg.qualityChecks.filter((c) => c.severity === 'error' && !c.passed)
  const readOnly =
    pkg.status === 'finalized' || pkg.status === 'superseded' || pkg.status === 'archived'

  const nextStep: NextStep = (() => {
    if (summary.blockingErrorCount > 0) {
      return {
        title: '확정 전 오류를 해결하세요.',
        description: `검토·확정 화면에서 해결할 오류 ${summary.blockingErrorCount}건을 처리해야 확정할 수 있습니다.`,
        label: '검토·확정으로 이동',
        path: `${base}/review`,
      }
    }
    if (summary.stale) {
      return {
        title: '출처 원본이 변경되었습니다.',
        description: '확정된 자료는 그대로 보존됩니다. 최신 결과를 반영하려면 새 버전을 만드세요.',
        label: '검토·확정으로 이동',
        path: `${base}/review`,
      }
    }
    if (!pkg.finalSummary.trim()) {
      return {
        title: '최종 요약을 작성하세요.',
        description: '자료 전체를 한눈에 설명하는 최종 요약이 아직 비어 있습니다.',
        label: '검토·확정으로 이동',
        path: `${base}/review`,
      }
    }
    return {
      title: '미리보기로 확인하고 확정하세요.',
      description: '대상 독자별 미리보기로 최종 확인한 뒤 자료를 확정할 수 있습니다.',
      label: '미리보기로 이동',
      path: `${base}/preview`,
    }
  })()

  const quickLinks = [
    { to: `${base}/contents`, label: '포함 자료', icon: ListChecks },
    { to: `${base}/reports`, label: '보고서', icon: FileText },
    { to: `${base}/specification`, label: '개발명세', icon: Code2 },
    { to: `${base}/roadmap`, label: '실행 로드맵', icon: Route },
    { to: `${base}/prompts`, label: '개발 프롬프트', icon: Sparkles },
    { to: `${base}/evidence`, label: '근거', icon: ClipboardCheck },
    { to: `${base}/preview`, label: '미리보기', icon: Eye },
    { to: `${base}/review`, label: '검토·확정', icon: ShieldCheck },
  ]

  return (
    <>
      <ReadOnlyNotice pkg={pkg} />

      {!summary.includesValidation && (
        <div className="rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3 text-[0.9rem] break-keep text-warning-700">
          이 자료에는 실제 사용 테스트(검증) 결과가 포함되어 있지 않습니다. &lsquo;검증 완료&rsquo;가 아닌 <span className="font-semibold">검증 전 설계안</span>으로 다뤄야 합니다.
        </div>
      )}

      {/* 지금 해야 할 일 */}
      <section aria-label="지금 해야 할 일" className="rounded-(--radius-panel) border border-brand-200 bg-brand-50/50 p-5">
        <p className="text-[0.9rem] font-semibold tracking-wide text-brand-700 uppercase">지금 해야 할 일</p>
        <p className="mt-1.5 text-base font-semibold break-keep text-slate-900">{nextStep.title}</p>
        <p className="mt-1 text-[0.9rem] break-keep text-slate-600">{nextStep.description}</p>
        <div className="mt-3">
          <Button variant="primary" onClick={() => navigate(nextStep.path)}>
            {nextStep.label}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
          <Panel title="자료 요약">
            <p className="text-[0.9rem] leading-relaxed break-keep text-slate-700">{summary.headline}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard
                label="포함 Section"
                value={`${summary.activeSectionCount}/${summary.sectionCount}`}
                hint="포함/전체"
              />
              <StatCard label="개발 프롬프트" value={`${summary.promptCount}개`} />
              <StatCard label="로드맵 단계" value={`${summary.roadmapPhaseCount}개`} />
              <StatCard label="근거" value={`${summary.evidenceCount}건`} />
              <StatCard label="수동 편집" value={`${summary.manualEditedCount}개`} />
              <StatCard label="고객 공개" value={`${summary.clientVisibleCount}개`} />
            </div>
          </Panel>

          <Panel title="포함 트랙">
            <p className="mb-3 text-[0.9rem] break-keep text-slate-500">
              AX와 홈페이지는 별도 트랙이며 하나의 점수로 합산하지 않습니다.
            </p>
            {pkg.includedTracks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {pkg.includedTracks.map((track) => (
                  <DeliverableTrackBadge key={track} track={track} />
                ))}
              </div>
            ) : (
              <p className="text-[0.9rem] break-keep text-slate-400">포함된 트랙이 없습니다.</p>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="점검 상태">
            <div className="flex items-center justify-between text-[0.9rem]">
              <span className="text-slate-600">해결할 오류</span>
              <span className={blockingQuality.length > 0 ? 'font-semibold text-danger-600' : 'text-slate-400'}>
                {blockingQuality.length}건
              </span>
            </div>
            {blockingQuality.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2.5">
                {blockingQuality.map((c) => (
                  <li key={c.id} className="flex items-start gap-2">
                    <DeliverableQualityBadge severity={c.severity} />
                    <span className="min-w-0 text-[0.9rem] break-keep text-slate-600">{c.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[0.9rem] break-keep text-slate-500">해결해야 할 오류가 없습니다.</p>
            )}
          </Panel>

          <Panel title="빠른 이동">
            <div className="flex flex-col gap-2">
              {quickLinks.map((item) => (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className="flex items-center gap-2.5 rounded-(--radius-control) border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                >
                  <item.icon aria-hidden="true" className="size-4 text-slate-400" />
                  {item.label}
                  <ArrowRight aria-hidden="true" className="ml-auto size-4 text-slate-300" />
                </button>
              ))}
            </div>
          </Panel>

          {!readOnly && (
            <Panel title="자료 구성">
              <p className="mb-3 text-[0.9rem] break-keep text-slate-500">
                포함 자료·본문을 편집하려면 각 화면으로 이동하세요.
              </p>
              <Button variant="secondary" onClick={() => navigate(`${base}/contents`)}>
                <Pencil aria-hidden="true" className="size-4" />
                포함 자료 편집
              </Button>
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}

export function PackageDetailPage() {
  const { projectId = '', packageId = '' } = useParams()
  return (
    <PackageSectionFrame
      projectId={projectId}
      packageId={packageId}
      render={(pkg) => <DetailBody pkg={pkg} projectId={projectId} packageId={packageId} />}
    />
  )
}
