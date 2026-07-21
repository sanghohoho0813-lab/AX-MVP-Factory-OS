import {
  Archive,
  FolderKanban,
  FolderPlus,
  Pencil,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Project } from '../types/domain'
import { HEALTH_META } from '../lib/statusMeta'
import { ORG_STATUS_META, mvpLevelLabel } from '../lib/domainMeta'
import {
  formatDate,
  formatKrw,
  formatKrwCompact,
} from '../lib/format'
import { memberName } from '../data/members'
import { useStoreVersion } from '../lib/useStoreVersion'
import {
  activityRepository,
  organizationRepository,
  projectRepository,
} from '../repositories'
import { archiveOrganization, pickPrimaryProject } from '../services/organizationService'
import { computeProjectJourney } from '../services/journeyService'
import { useActiveProject } from '../context/activeProject'
import { ProjectTypeBadge } from '../components/domain/ProjectTypeBadge'
import { ActivityTimeline } from '../components/ui/ActivityTimeline'
import { Button } from '../components/ui/Button'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { DetailHeader } from '../components/ui/DetailHeader'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { EmptyState } from '../components/ui/EmptyState'
import { NotFoundState } from '../components/ui/NotFoundState'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useToast } from '../components/ui/toastContext'

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm break-keep text-slate-700">{value || '-'}</dd>
    </div>
  )
}

const OPEN_STATUSES = new Set(['planned', 'active', 'waiting_client', 'on_hold'])

export function OrganizationDetailPage() {
  const { organizationId = '' } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { setActiveProject } = useActiveProject()
  const version = useStoreVersion()
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [tab, setTab] = useState<'overview' | 'projects' | 'info' | 'activity'>('overview')

  const organization = useMemo(
    () => organizationRepository.getById(organizationId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organizationId, version],
  )
  const projects = useMemo(
    () => projectRepository.getByOrganizationId(organizationId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organizationId, version],
  )
  const activities = useMemo(
    () => activityRepository.getByOrganizationId(organizationId, 10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organizationId, version],
  )

  if (!organization) {
    return (
      <NotFoundState
        title="고객사를 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제·이동된 고객사입니다."
        backTo="/clients"
        backLabel="고객사 목록으로 돌아가기"
      />
    )
  }

  const activeProjects = projects.filter((p) => OPEN_STATUSES.has(p.status))
  const primaryProject = pickPrimaryProject(projects)

  const summaryCounts = {
    total: projects.length,
    active: projects.filter((p) => p.status === 'active').length,
    waiting: projects.filter((p) => p.status === 'waiting_client').length,
    completed: projects.filter((p) => p.status === 'completed').length,
    onHold: projects.filter((p) => p.status === 'on_hold').length,
  }

  const handleArchive = () => {
    try {
      archiveOrganization(organization.id)
      showToast(`${organization.name} 고객사를 보관 처리했습니다.`)
      setArchiveOpen(false)
      navigate('/clients')
    } catch (error) {
      setArchiveOpen(false)
      showToast(
        error instanceof Error ? error.message : '보관 처리에 실패했습니다.',
      )
    }
  }

  const projectRow = (project: Project) => {
    const progress = computeProjectJourney(project).progress
    return (
      <li key={project.id}>
        <Link
          to={`/projects/${project.id}`}
          className="block px-5 py-4 transition-colors hover:bg-slate-50"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-wide text-slate-400">
              {project.projectCode}
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
              {project.name}
            </p>
            <ProjectTypeBadge type={project.projectType} compact />
            {progress.isSample && (
              <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[0.78rem] font-medium text-brand-700">
                샘플
              </span>
            )}
            <StatusBadge tone="info">{progress.currentStep.label}</StatusBadge>
            <StatusBadge tone={HEALTH_META[project.healthStatus].tone} withDot>
              {HEALTH_META[project.healthStatus].label}
            </StatusBadge>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.875rem] text-slate-500">
            <span>
              수준: {mvpLevelLabel(project.currentMvpLevel, project.projectType)} →{' '}
              {mvpLevelLabel(project.targetMvpLevel, project.projectType)}
            </span>
            <span>담당 {memberName(project.ownerId)}</span>
            <span>마감 {formatDate(project.dueDate)}</span>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <ProgressBar
              value={progress.percent}
              tone={HEALTH_META[project.healthStatus].tone}
              label={`${project.name} 진행 단계`}
            />
            <span className="shrink-0 text-[0.875rem] font-semibold text-slate-600">
              {progress.stepText}
            </span>
          </div>
          <p className="mt-2 truncate text-[0.875rem] break-keep text-slate-500">
            다음 행동: {progress.nextAction.title}
          </p>
        </Link>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        backTo="/clients"
        backLabel="고객사 목록"
        title={organization.name}
        badges={
          <>
            <StatusBadge tone={ORG_STATUS_META[organization.status].tone}>
              {ORG_STATUS_META[organization.status].label}
            </StatusBadge>
            <StatusBadge tone={HEALTH_META[organization.healthStatus].tone} withDot>
              {HEALTH_META[organization.healthStatus].label}
            </StatusBadge>
          </>
        }
        meta={
          <>
            <span>{organization.industry}</span>
            <span>
              담당자 {organization.primaryContact.name}
              {organization.primaryContact.position &&
                ` ${organization.primaryContact.position}`}
            </span>
            <span>최근 수정 {formatDate(organization.updatedAt)}</span>
          </>
        }
        actions={
          <>
            <Button
              variant="primary"
              onClick={() =>
                navigate(`/projects/new?organizationId=${organization.id}`)
              }
            >
              <FolderPlus aria-hidden="true" className="size-4" />새 프로젝트 등록
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(`/clients/${organization.id}/edit`)}
            >
              <Pencil aria-hidden="true" className="size-4" />
              고객사 수정
            </Button>
            <DropdownMenu
              ariaLabel="고객사 더보기 메뉴"
              items={[
                {
                  key: 'archive',
                  label: '보관 처리',
                  icon: Archive,
                  danger: true,
                  onSelect: () => setArchiveOpen(true),
                },
              ]}
            />
          </>
        }
      />

      {organization.archivedAt && (
        <p className="rounded-(--radius-card) border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] break-keep text-slate-600">
          {formatDate(organization.archivedAt)}에 보관 처리된 고객사입니다. 기본
          목록에는 표시되지 않지만 데이터는 유지됩니다.
        </p>
      )}

      {/* 탭 */}
      <nav aria-label="고객사 상세 메뉴" className="flex min-w-0 gap-1 overflow-x-auto border-b border-slate-200">
        {([['overview', '개요'], ['projects', `프로젝트 (${projects.length})`], ['info', '기업정보'], ['activity', '활동이력']] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            aria-current={tab === k ? 'page' : undefined}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-[0.95rem] font-medium transition-colors ${tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {label}
          </button>
        ))}
      </nav>

      {/* 개요 */}
      {tab === 'overview' && (
        <div className="flex flex-col gap-5">
          {primaryProject ? (
            (() => {
              const j = computeProjectJourney(primaryProject)
              return (
                <section className="rounded-(--radius-panel) border border-brand-100 bg-brand-50/50 p-5 sm:p-6">
                  <p className="text-[0.9rem] font-semibold text-brand-700">현재 가장 중요한 일</p>
                  <p className="mt-1.5 text-[1.3rem] leading-snug font-bold break-keep text-slate-900">{primaryProject.name} · {j.actionText}</p>
                  <p className="mt-2 text-[1rem] break-keep text-slate-600">{j.reason}</p>
                  <Button variant="primary" className="mt-4" onClick={() => { setActiveProject(primaryProject.id); navigate(j.actionPath) }}>{j.actionLabel}</Button>
                </section>
              )
            })()
          ) : (
            <EmptyState icon={FolderKanban} title="연결된 프로젝트가 없습니다" description="새 프로젝트를 등록해 진단부터 자료 패키지까지 흐름을 시작하세요."
              action={<Button variant="primary" size="sm" onClick={() => navigate(`/projects/new?organizationId=${organization.id}`)}><FolderPlus aria-hidden="true" className="size-4" />새 프로젝트 만들기</Button>} />
          )}

          {activeProjects.length > 0 && (
            <Panel title="진행 중 프로젝트" flush>
              <ul className="divide-y divide-slate-100">{activeProjects.slice(0, 3).map(projectRow)}</ul>
            </Panel>
          )}

          <Panel title="최근 활동">
            <ActivityTimeline activities={activities.slice(0, 5)} />
          </Panel>
        </div>
      )}

      {/* 프로젝트 */}
      {tab === 'projects' && (
        <Panel title={`전체 프로젝트 (${projects.length})`} flush>
          {projects.length === 0 ? (
            <EmptyState icon={FolderKanban} title="연결된 프로젝트가 없습니다" description="새 프로젝트를 등록해 흐름을 시작하세요."
              action={<Button variant="primary" size="sm" onClick={() => navigate(`/projects/new?organizationId=${organization.id}`)}><FolderPlus aria-hidden="true" className="size-4" />새 프로젝트 만들기</Button>} />
          ) : (
            <ul className="divide-y divide-slate-100">{projects.map(projectRow)}</ul>
          )}
        </Panel>
      )}

      {/* 기업정보 */}
      {tab === 'info' && (
        <div className="flex flex-col gap-5">
          <Panel title="기업 기본정보">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
              <InfoItem label="사업자등록번호" value={organization.businessRegistrationNumber} />
              <InfoItem label="세부 업종" value={organization.subIndustry} />
              <InfoItem label="설립일" value={formatDate(organization.foundedAt)} />
              <InfoItem label="직원 수" value={organization.employeeCount !== null ? `${organization.employeeCount}명` : '-'} />
              <InfoItem label="연매출" value={organization.annualRevenue !== null ? `${formatKrw(organization.annualRevenue)} (${formatKrwCompact(organization.annualRevenue)})` : '-'} />
              <InfoItem label="지역" value={organization.region} />
              <InfoItem label="주소" value={organization.address} />
              <InfoItem label="홈페이지" value={organization.website} />
              <InfoItem label="담당자 연락처" value={[organization.primaryContact.phone, organization.primaryContact.email].filter(Boolean).join(' · ')} />
            </dl>
            {organization.notes && (
              <p className="mt-5 rounded-(--radius-card) border border-slate-200 bg-slate-50 px-4 py-3 text-[0.95rem] break-keep text-slate-600">{organization.notes}</p>
            )}
          </Panel>
          <Panel title="운영 요약">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-3">
              <InfoItem label="총 프로젝트" value={`${summaryCounts.total}건`} />
              <InfoItem label="진행 중" value={`${summaryCounts.active}건`} />
              <InfoItem label="고객 응답 대기" value={`${summaryCounts.waiting}건`} />
              <InfoItem label="완료" value={`${summaryCounts.completed}건`} />
              <InfoItem label="보류" value={`${summaryCounts.onHold}건`} />
            </dl>
          </Panel>
        </div>
      )}

      {/* 활동이력 */}
      {tab === 'activity' && (
        <Panel title="활동 이력">
          <ActivityTimeline activities={activities} />
        </Panel>
      )}

      <ConfirmModal
        open={archiveOpen}
        title="고객사 보관"
        message={`${organization.name} 고객사를 보관할까요? 보관된 고객사는 기본 목록에서 숨겨집니다.`}
        warning={
          activeProjects.length > 0
            ? '진행 중인 프로젝트가 있습니다. 고객사를 보관해도 프로젝트 데이터는 삭제되지 않지만 기본 목록에서 숨겨집니다.'
            : undefined
        }
        confirmLabel="보관 처리"
        danger
        onConfirm={handleArchive}
        onCancel={() => setArchiveOpen(false)}
      />
    </div>
  )
}
