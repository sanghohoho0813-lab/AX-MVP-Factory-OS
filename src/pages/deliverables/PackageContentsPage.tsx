import { useParams } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type {
  DeliverablePackage,
  DeliverableSection,
  DeliverableTrackType,
} from '../../types/deliverables'
import {
  moveSection,
  setSectionIncluded,
  setSectionVisibility,
} from '../../services/deliverableService'
import { VISIBILITIES, VISIBILITY_META } from '../../lib/deliverableMeta'
import { HelpNote } from '../../components/ui/HelpNote'
import {
  DeliverableTrackBadge,
  SectionStatusBadge,
  VisibilityBadge,
} from '../../components/deliverables/badges'
import { useToast } from '../../components/ui/toastContext'
import { PackageSectionFrame, ReadOnlyNotice } from './deliverableShared'

function ContentsBody({ pkg, packageId }: { pkg: DeliverablePackage; packageId: string }) {
  const { showToast } = useToast()
  const readOnly =
    pkg.status === 'finalized' || pkg.status === 'superseded' || pkg.status === 'archived'

  const sorted = [...pkg.sections].sort((a, b) => a.orderIndex - b.orderIndex)

  // 트랙별 그룹화 (등장 순서 유지)
  const trackOrder: DeliverableTrackType[] = []
  for (const s of sorted) {
    if (!trackOrder.includes(s.track)) trackOrder.push(s.track)
  }

  const audienceRestricted = pkg.audience === 'client' || pkg.audience === 'institution'
  const leakingSections = sorted.filter(
    (s) => s.status !== 'excluded' && s.visibility === 'internal_only',
  )
  const showLeakWarning = audienceRestricted && leakingSections.length > 0

  function handleIncluded(section: DeliverableSection, included: boolean) {
    try {
      setSectionIncluded(packageId, section.id, included)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '처리에 실패했습니다.')
    }
  }

  function handleVisibility(section: DeliverableSection, visibility: string) {
    try {
      setSectionVisibility(packageId, section.id, visibility as DeliverableSection['visibility'])
    } catch (err) {
      showToast(err instanceof Error ? err.message : '처리에 실패했습니다.')
    }
  }

  function handleMove(section: DeliverableSection, direction: 'up' | 'down') {
    try {
      moveSection(packageId, section.id, direction)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '이동에 실패했습니다.')
    }
  }

  return (
    <>
      <HelpNote
        summary="자료에 포함할 Section과 각 Section의 공개 범위를 관리합니다."
        what="포함 여부는 자료에 실릴지 결정하고, 공개 범위는 대상 독자에게 보일지(내부 전용·고객 공개 등)를 결정합니다."
        when="자료를 확정하기 전에 대상 독자에 맞게 구성할 때 사용합니다."
        next="본문 내용은 보고서·개발명세 화면에서 편집하고, 미리보기로 대상별 노출을 확인하세요."
      />

      <ReadOnlyNotice pkg={pkg} />

      {showLeakWarning && (
        <div className="rounded-(--radius-card) border border-danger-200 bg-danger-50/60 px-4 py-3 text-[0.9rem] break-keep text-danger-700">
          대상이 {pkg.audience === 'client' ? '고객용' : '기관 준비용'}인데 <span className="font-semibold">내부 전용</span> Section {leakingSections.length}개가 포함되어 있습니다. 공개 범위를 조정하거나 제외하세요.
        </div>
      )}

      {trackOrder.map((track) => {
        const rows = sorted.filter((s) => s.track === track)
        return (
          <section
            key={track}
            className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
              <DeliverableTrackBadge track={track} />
              <span className="text-[0.82rem] text-slate-400">{rows.length}개</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {rows.map((section) => {
                const excluded = section.status === 'excluded'
                const globalIdx = sorted.findIndex((s) => s.id === section.id)
                const isFirst = globalIdx === 0
                const isLast = globalIdx === sorted.length - 1
                return (
                  <li
                    key={section.id}
                    className={`flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between ${
                      excluded ? 'opacity-55' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium break-keep text-slate-800">{section.title}</p>
                        <SectionStatusBadge status={section.status} />
                        {!excluded && <VisibilityBadge visibility={section.visibility} />}
                        {section.manuallyEdited && (
                          <span className="rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-[0.82rem] font-medium text-warning-700">
                            수동 수정됨
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-[0.82rem] text-slate-400">{section.type}</p>
                    </div>

                    {!readOnly && (
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1.5 text-[0.9rem] text-slate-600">
                          <input
                            type="checkbox"
                            checked={!excluded}
                            onChange={(e) => handleIncluded(section, e.target.checked)}
                            className="size-4 rounded border-slate-300"
                          />
                          포함
                        </label>
                        <select
                          value={section.visibility}
                          onChange={(e) => handleVisibility(section, e.target.value)}
                          disabled={excluded}
                          aria-label={`${section.title} 공개 범위`}
                          className="rounded-(--radius-control) border border-slate-200 px-2.5 py-1.5 text-[0.9rem] disabled:opacity-50"
                        >
                          {VISIBILITIES.map((v) => (
                            <option key={v} value={v}>
                              {VISIBILITY_META[v].label}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="위로 이동"
                            onClick={() => handleMove(section, 'up')}
                            disabled={isFirst}
                            className="flex size-8 items-center justify-center rounded-(--radius-control) border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                          >
                            <ChevronUp aria-hidden="true" className="size-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="아래로 이동"
                            onClick={() => handleMove(section, 'down')}
                            disabled={isLast}
                            className="flex size-8 items-center justify-center rounded-(--radius-control) border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                          >
                            <ChevronDown aria-hidden="true" className="size-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </>
  )
}

export function PackageContentsPage() {
  const { projectId = '', packageId = '' } = useParams()
  return (
    <PackageSectionFrame
      projectId={projectId}
      packageId={packageId}
      render={(pkg) => <ContentsBody pkg={pkg} packageId={packageId} />}
    />
  )
}
