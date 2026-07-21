import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  EyeOff,
  Layers,
} from 'lucide-react'
import type { DeliverableEligibility } from '../../services/deliverables/sourceCollector'
import { needsRefresh, summarizePackage } from '../../services/deliverableService'
import { PACKAGE_TYPE_META } from '../../lib/deliverableMeta'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { EmptyState } from '../../components/ui/EmptyState'
import { AudienceBadge, PackageStatusBadge, PackageTypeBadge } from '../../components/deliverables/badges'
import {
  WorkspaceShell,
  WorkspaceNextAction,
  WorkspaceSummaryLine,
  WorkspaceCompletionChecklist,
  WorkspaceWarningPanel,
  WorkspaceNextStep,
  type WorkspaceWarning,
} from '../../components/workspace/WorkspaceShell'
import {
  DELIVERABLE_MODULE_DESC,
  DELIVERABLE_MODULE_NAME,
  DeliverableNotFound,
} from './deliverableShared'
import { useDeliverableData } from './useDeliverableData'

/** 확정 결과 준비 상태 — 쉬운 말로 */
interface ReadinessRow {
  key: string
  label: string
  ready: boolean
}
function readinessRows(e: DeliverableEligibility): ReadinessRow[] {
  return [
    { key: 'diagnosis', label: '진단 결과', ready: e.hasDiagnosis },
    { key: 'selection', label: '핵심 과제 선정', ready: e.hasSelection },
    { key: 'ax', label: 'AX 기능·화면 설계', ready: e.hasAx },
    { key: 'website', label: '홈페이지 설계', ready: e.hasWebsite },
    { key: 'validation', label: '실제 사용 테스트 결과', ready: e.hasValidation },
  ]
}

/** 자료 유형 안내 카드 (쉬운 이름 우선) — 어떤 자료를 누구에게 만들지 */
const TYPE_CARDS: { type: keyof typeof PACKAGE_TYPE_META; easyLabel: string }[] = [
  { type: 'client_proposal', easyLabel: '고객 설명자료' },
  { type: 'development_handoff', easyLabel: '개발자 전달자료' },
  { type: 'validation_report', easyLabel: '테스트 결과자료' },
  { type: 'institution_preparation', easyLabel: '기관 검토자료' },
  { type: 'internal_master', easyLabel: '내부 종합자료' },
]

export function ProjectDeliverablesPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { context } = useDeliverableData(projectId)
  const [showExpert, setShowExpert] = useState(false)

  if (!context) return <DeliverableNotFound />

  const { project, eligibility, packages, latest, latestStale } = context
  const canCreate = eligibility.canCreate
  const createPath = `/deliverables/projects/${projectId}/create`
  const rows = readinessRows(eligibility)
  const readyCount = rows.filter((r) => r.ready).length
  const latestSummary = latest ? summarizePackage(latest) : null
  const latestBase = latest ? `/deliverables/projects/${projectId}/packages/${latest.id}` : ''
  const redactionRules = latest ? latest.redactionRules.filter((r) => r.enabled) : []
  const finalizedCount = packages.filter((p) => p.status === 'finalized').length

  // 지금 해야 할 일 (한 화면에 핵심 행동 하나)
  const next = (() => {
    if (!canCreate) {
      return {
        title: '먼저 선행 결과를 확정하세요',
        why: eligibility.reasons[0] ?? '확정된 진단 결과 또는 확정된 설계가 있어야 자료를 만들 수 있습니다.',
        label: '새 자료 만들기',
        disabled: true,
        disabledReason: '선행 결과가 확정되면 바로 만들 수 있습니다.',
      }
    }
    if (!latest) {
      return {
        title: '어떤 자료를 만들지 정하세요',
        why: '확정된 결과를 누구에게 보여줄 자료로 만들지 유형을 정하면 초안이 자동으로 준비됩니다.',
        label: '새 자료 만들기',
        path: createPath,
      }
    }
    if (latestStale) {
      return {
        title: '원본이 바뀌었습니다 — 새 버전을 검토하세요',
        why: '확정된 자료는 그대로 보존됩니다. 최신 결과를 반영하려면 자료 확정 화면에서 새 버전을 만드세요.',
        label: '자료 확정 화면으로',
        path: `${latestBase}/review`,
      }
    }
    if (latest.status === 'draft' || latest.status === 'reviewed') {
      return {
        title: '작성 중인 자료를 확정하세요',
        why: '보여줄 범위를 정리하고 점검을 통과하면 자료를 확정할 수 있습니다.',
        label: '검토하고 자료 확정하기',
        path: `${latestBase}/review`,
      }
    }
    return {
      title: '확정한 자료를 전달하세요',
      why: '대상별로 미리보고 인쇄하거나 파일로 내보낼 수 있습니다.',
      label: '미리보기·내보내기',
      path: `${latestBase}/preview`,
      tone: 'success' as const,
    }
  })()

  const checklist = [
    { ok: eligibility.hasDiagnosis, label: '진단 결과가 확정됨' },
    { ok: eligibility.hasAx || eligibility.hasWebsite, label: 'AX 설계 또는 홈페이지 설계가 확정됨' },
    { ok: eligibility.hasValidation, label: '실제 사용 테스트 결과가 있음 (없으면 검증 전 설계안)' },
    { ok: packages.length > 0, label: '자료 묶음 1개 이상 만듦', actionPath: canCreate ? createPath : undefined, actionLabel: '자료 만들기' },
    { ok: finalizedCount > 0, label: '자료 확정 완료', actionPath: latest ? `${latestBase}/review` : undefined, actionLabel: '확정하기' },
  ]

  const warns: WorkspaceWarning[] = [
    ...(!canCreate ? eligibility.reasons.map((r) => ({ tone: 'warn' as const, message: r })) : []),
    ...(latestStale ? [{ tone: 'warn' as const, message: '최근 자료의 출처 원본이 변경되었습니다. 새 버전 검토가 필요합니다.', actionPath: `${latestBase}/review`, actionLabel: '자료 확정 화면으로' }] : []),
    ...(latestSummary && latestSummary.blockingErrorCount > 0 ? [{ tone: 'error' as const, message: `최근 자료에 확정 전 해결할 오류 ${latestSummary.blockingErrorCount}건이 있습니다.`, actionPath: `${latestBase}/review`, actionLabel: '오류 확인하기' }] : []),
  ]

  const summary = (
    <>
      <div>
        <WorkspaceSummaryLine label="만든 자료 묶음" value={`${packages.length}개`} />
        <WorkspaceSummaryLine label="최근 자료 상태" value={latestSummary ? latestSummary.headline : '아직 없음'} tone={finalizedCount > 0 ? 'ok' : 'default'} />
        <WorkspaceSummaryLine label="포함할 결과" value={`${readyCount}/5 준비됨`} tone={readyCount === 0 ? 'warn' : 'default'} />
        <WorkspaceSummaryLine label="민감정보 가림" value={redactionRules.length > 0 ? `${redactionRules.length}개 적용` : '설정 없음'} tone={redactionRules.length > 0 ? 'ok' : 'default'} />
      </div>
      <WorkspaceCompletionChecklist items={checklist} />
      <WorkspaceWarningPanel warnings={warns} />
      {finalizedCount > 0 && latest && <WorkspaceNextStep label="미리보기·내보내기로 전달하기" path={`${latestBase}/preview`} />}
    </>
  )

  return (
    <WorkspaceShell
      moduleName={DELIVERABLE_MODULE_NAME}
      moduleDescription={DELIVERABLE_MODULE_DESC}
      saveStatus="local"
      nextAction={
        <WorkspaceNextAction
          title={next.title}
          why={next.why}
          actionLabel={next.label}
          actionPath={next.path}
          tone={next.tone}
          disabled={next.disabled}
          disabledReason={next.disabledReason}
        />
      }
      summary={summary}
    >
      <div className="flex flex-col gap-5">
        {project.projectType === 'ax_website' && (
          <div className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-3 text-[0.9rem] break-keep text-slate-600">
            AX와 홈페이지는 별도 트랙으로 관리되며 결과를 하나의 점수로 합산하지 않습니다. 각 트랙의 결과는 자료에서 구분되어 표시됩니다.
          </div>
        )}

        {/* 누구에게 보여줄 자료인지 — 자료 유형 선택 */}
        <Panel title="누구에게 보여줄 자료인가요?">
          <p className="mb-3 text-[0.9rem] break-keep text-slate-500">
            보여줄 대상에 맞춰 자료를 만듭니다. 유형을 고르면 확정된 결과로 초안이 자동으로 준비됩니다.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TYPE_CARDS.map(({ type, easyLabel }) => {
              const meta = PACKAGE_TYPE_META[type]
              return (
                <button
                  key={type}
                  type="button"
                  disabled={!canCreate}
                  onClick={() => navigate(createPath)}
                  className="flex h-full flex-col gap-1.5 rounded-(--radius-panel) border border-slate-200 bg-white p-4 text-left transition-colors hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex items-center gap-2 text-[1.05rem] font-semibold break-keep text-slate-900">
                    <meta.icon aria-hidden="true" className="size-5 shrink-0 text-brand-500" />
                    {easyLabel}
                  </span>
                  <span className="text-[0.9rem] leading-relaxed break-keep text-slate-500">{meta.description}</span>
                </button>
              )
            })}
          </div>
          {!canCreate && (
            <p className="mt-3 text-[0.9rem] break-keep text-slate-400">
              먼저 진단 또는 설계를 확정하면 자료를 만들 수 있습니다.
            </p>
          )}
        </Panel>

        {/* 포함하는 프로젝트 결과 */}
        <Panel title="자료에 담을 수 있는 프로젝트 결과">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {rows.map((row) => (
              <li key={row.key} className="flex items-center gap-2.5 rounded-(--radius-card) border border-slate-200 px-3.5 py-2.5">
                {row.ready ? (
                  <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success-500" />
                ) : (
                  <CircleDashed aria-hidden="true" className="size-4 shrink-0 text-slate-300" />
                )}
                <span className="min-w-0 flex-1 truncate text-[0.9rem] font-medium text-slate-700">{row.label}</span>
                <span className={`shrink-0 text-[0.85rem] font-medium ${row.ready ? 'text-success-600' : 'text-slate-400'}`}>
                  {row.ready ? '사용 가능' : '아직 없음'}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        {/* 개인정보 가림 상태 */}
        <Panel title="개인정보 가림 상태">
          {!latest ? (
            <p className="text-[0.9rem] break-keep text-slate-500">
              자료를 만들면 담당자 연락처·내부 메모 등 민감정보를 가릴 수 있습니다.
            </p>
          ) : redactionRules.length === 0 ? (
            <p className="text-[0.9rem] break-keep text-slate-500">
              최근 자료에는 가림 설정이 없습니다. 고객·기관에 보내는 자료라면 자료 확정 화면에서 민감정보 가림을 확인하세요.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {redactionRules.slice(0, 4).map((rule) => (
                <li key={rule.id} className="flex items-start gap-2 text-[0.9rem] break-keep text-slate-700">
                  <EyeOff aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
                  <span className="min-w-0">{rule.description}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* 준비된 자료 (자료 묶음 목록) */}
        <Panel title={`준비된 자료 (${packages.length})`} flush>
          {packages.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="아직 만든 자료가 없습니다"
              description={canCreate ? '위에서 자료 유형을 골라 첫 초안을 만드세요.' : '진단 또는 설계를 먼저 확정하면 자료를 만들 수 있습니다.'}
              action={canCreate ? <Button variant="primary" onClick={() => navigate(createPath)}>새 자료 만들기</Button> : undefined}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              {packages.map((pkg) => {
                const s = summarizePackage(pkg)
                const stale = needsRefresh(pkg)
                return (
                  <li key={pkg.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/deliverables/projects/${projectId}/packages/${pkg.id}`)}
                      className="flex h-full w-full flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 text-left hover:border-slate-300"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[1.05rem] font-semibold text-slate-900">{pkg.name}</p>
                          <p className="mt-0.5 text-[0.82rem] text-slate-400">확정 당시 내용 v{pkg.version}</p>
                        </div>
                        <PackageStatusBadge status={pkg.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <PackageTypeBadge type={pkg.type} />
                        <AudienceBadge audience={pkg.audience} />
                      </div>
                      <p className="text-[0.9rem] break-keep text-slate-600">{s.headline}</p>
                      {stale && (
                        <span className="w-fit rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-[0.82rem] font-medium text-warning-700">
                          출처 원본 변경됨 · 새 버전 검토 필요
                        </span>
                      )}
                      <span className="mt-auto inline-flex items-center gap-1 text-[0.9rem] font-semibold text-brand-600">
                        열기
                        <ArrowRight aria-hidden="true" className="size-3.5" />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        {/* 전문가·시스템 정보 (기본 접힘) */}
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setShowExpert((v) => !v)}
            aria-expanded={showExpert}
            className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left text-[1rem] font-semibold text-slate-700"
          >
            전문가·시스템 정보 (자료 묶음·확정 스냅샷·규칙 버전)
            <ChevronDown aria-hidden="true" className={`size-5 transition-transform ${showExpert ? 'rotate-180' : ''}`} />
          </button>
          {showExpert && (
            <div className="flex flex-col gap-4 border-t border-slate-100 px-5 py-5 text-[0.85rem] text-slate-500">
              <p className="break-keep">
                내부에서 &lsquo;자료 묶음(Package)&rsquo;은 확정 스냅샷(Snapshot)과 규칙 버전(Rule Version)을 기준으로 관리됩니다. 아래는 시스템 식별용 정보입니다.
              </p>
              {latest ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <div>
                    <dt className="text-slate-400">자료 유형 (Preset)</dt>
                    <dd className="font-medium text-slate-700">{PACKAGE_TYPE_META[latest.type].label}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">규칙 버전 (Rule Version)</dt>
                    <dd className="font-medium text-slate-700">{latest.ruleVersion || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">출처 스냅샷 (Source Hash)</dt>
                    <dd className="truncate font-mono text-slate-700">{latest.sourceSnapshotHash || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">출처 참조 수</dt>
                    <dd className="font-medium text-slate-700">{latest.sourceReferences.length}건</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">가림 규칙 (Redaction)</dt>
                    <dd className="font-medium text-slate-700">{redactionRules.length}개 적용 / 전체 {latest.redactionRules.length}개</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">확정 스냅샷 (Snapshot)</dt>
                    <dd className="font-medium text-slate-700">{latest.finalizedAt ? '동결됨' : '없음'}</dd>
                  </div>
                </dl>
              ) : (
                <p className="break-keep text-slate-400">아직 만든 자료 묶음이 없어 표시할 시스템 정보가 없습니다.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </WorkspaceShell>
  )
}
