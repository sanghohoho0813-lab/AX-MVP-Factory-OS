import {
  Ban,
  Copy,
  ExternalLink,
  FolderOpen,
  RefreshCw,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { formatDate, formatDateTime } from '../../lib/format'
import { RESPONDENT_ROLE_META } from '../../lib/surveyMeta'
import {
  organizationRepository,
  projectRepository,
  surveyDistributionRepository,
  surveyResponseRepository,
} from '../../repositories'
import {
  buildSurveyUrl,
  generateUniqueAccessToken,
} from '../../services/surveyTokenService'
import { logDistributionActivity } from '../../services/surveyRuntimeService'
import { PROJECT_STAGE_META } from '../../lib/statusMeta'
import { DetailHeader } from '../../components/ui/DetailHeader'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { DropdownMenu } from '../../components/ui/DropdownMenu'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { Panel } from '../../components/ui/Panel'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { LocalTestModeBanner } from '../../components/runtime/LocalTestModeBanner'
import { SurveyLinkCopyField } from '../../components/runtime/SurveyLinkCopyField'
import {
  SurveyDistributionStatusBadge,
  SurveyResponseStatusBadge,
} from '../../components/runtime/badges'
import { RespondentRoleBadge } from '../../components/diagnosis/badges'
import { useToast } from '../../components/ui/toastContext'

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm break-keep text-slate-700">{value || '-'}</dd>
    </div>
  )
}

export function DistributionDetailPage() {
  const { distributionId = '' } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const version = useStoreVersion()
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [regenOpen, setRegenOpen] = useState(false)

  const distribution = useMemo(
    () => surveyDistributionRepository.getById(distributionId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [distributionId, version],
  )
  const response = useMemo(
    () =>
      distribution
        ? surveyResponseRepository.getByDistributionId(distribution.id)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [distribution?.id, version],
  )
  const organization = distribution
    ? organizationRepository.getById(distribution.organizationId)
    : null
  const project = distribution
    ? projectRepository.getById(distribution.projectId)
    : null

  if (!distribution) {
    return (
      <NotFoundState
        title="설문 링크를 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제·이동된 링크입니다."
        backTo="/diagnosis/surveys"
        backLabel="설문 관리로 돌아가기"
      />
    )
  }

  const url = buildSurveyUrl(distribution.accessToken)
  const questionCount = distribution.blueprintSnapshot.reduce(
    (n, s) => n + s.placements.length,
    0,
  )
  const inProgress = response?.status === 'in_progress'
  const isActive =
    distribution.status !== 'revoked' && distribution.status !== 'expired'

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(url)
      showToast('테스트 링크를 복사했습니다.')
    } catch {
      showToast('복사에 실패했습니다. 아래 링크를 직접 선택해 주세요.')
    }
  }

  const handleRevoke = () => {
    try {
      surveyDistributionRepository.revoke(distribution.id)
      logDistributionActivity(distribution, '진단 설문 테스트 링크가 회수되었습니다.')
      showToast('링크를 회수했습니다.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '회수에 실패했습니다.')
    }
    setRevokeOpen(false)
  }

  const handleRegenerate = () => {
    try {
      const token = generateUniqueAccessToken((t) =>
        surveyDistributionRepository.isTokenTaken(t),
      )
      surveyDistributionRepository.regenerateToken(distribution.id, token)
      logDistributionActivity(distribution, '진단 설문 링크 토큰이 재발급되었습니다.')
      showToast('토큰을 재발급했습니다. 이전 링크는 더 이상 열리지 않습니다.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '재발급에 실패했습니다.')
    }
    setRegenOpen(false)
  }

  // 활동 이력 (distribution·response 타임스탬프 기반)
  const timeline: Array<{ label: string; at: string }> = [
    { label: '링크 생성', at: distribution.issuedAt },
    ...(distribution.firstOpenedAt
      ? [{ label: '최초 열람', at: distribution.firstOpenedAt }]
      : []),
    ...(response?.startedAt ? [{ label: '작성 시작', at: response.startedAt }] : []),
    ...(distribution.submittedAt
      ? [{ label: '제출 완료', at: distribution.submittedAt }]
      : []),
    ...(distribution.revokedAt
      ? [{ label: '링크 회수', at: distribution.revokedAt }]
      : []),
  ].sort((a, b) => a.at.localeCompare(b.at))

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        backTo="/diagnosis/surveys"
        backLabel="설문 발급·응답관리"
        title={distribution.surveyTitle}
        badges={
          <>
            <SurveyDistributionStatusBadge status={distribution.status} />
            <RespondentRoleBadge role={distribution.respondentRole} />
          </>
        }
        meta={
          <>
            <span>{organization?.name}</span>
            <span>{project?.name}</span>
            <span>응답자 {distribution.recipientName}</span>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => window.open(url, '_blank')}
              disabled={!isActive}
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              응답자 화면 열기
            </Button>
            <Button variant="secondary" onClick={handleCopy} disabled={!isActive}>
              <Copy aria-hidden="true" className="size-4" />
              테스트 링크 복사
            </Button>
            {response?.status === 'submitted' && (
              <Button
                variant="primary"
                onClick={() =>
                  navigate(`/diagnosis/surveys/${distribution.id}/response`)
                }
              >
                응답 상세 보기
              </Button>
            )}
            <DropdownMenu
              ariaLabel="링크 더보기 메뉴"
              items={[
                {
                  key: 'project',
                  label: '프로젝트로 이동',
                  icon: FolderOpen,
                  onSelect: () => navigate(`/projects/${distribution.projectId}`),
                },
                {
                  key: 'regen',
                  label: '토큰 재발급',
                  icon: RefreshCw,
                  onSelect: () => setRegenOpen(true),
                },
                {
                  key: 'revoke',
                  label: '링크 회수',
                  icon: Ban,
                  danger: true,
                  onSelect: () => setRevokeOpen(true),
                },
              ]}
            />
          </>
        }
      />

      <LocalTestModeBanner />

      {isActive && <SurveyLinkCopyField url={url} onOpen={() => window.open(url, '_blank')} />}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
          <Panel title="링크 정보">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
              <Info label="발급일" value={formatDateTime(distribution.issuedAt)} />
              <Info
                label="만료일"
                value={distribution.expiresAt ? formatDate(distribution.expiresAt) : '만료 없음'}
              />
              <Info
                label="최초 열람"
                value={distribution.firstOpenedAt ? formatDateTime(distribution.firstOpenedAt) : '-'}
              />
              <Info
                label="최근 열람"
                value={distribution.lastOpenedAt ? formatDateTime(distribution.lastOpenedAt) : '-'}
              />
              <Info
                label="제출일"
                value={distribution.submittedAt ? formatDateTime(distribution.submittedAt) : '-'}
              />
            </dl>
          </Panel>

          <Panel title="응답 진행 현황">
            {response ? (
              <>
                <div className="flex items-center gap-3">
                  <SurveyResponseStatusBadge status={response.status} />
                  <div className="flex flex-1 items-center gap-2">
                    <ProgressBar value={response.progressPercent} tone="info" label="응답 진행률" />
                    <span className="w-9 shrink-0 text-right text-sm font-semibold text-slate-700">
                      {response.progressPercent}%
                    </span>
                  </div>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
                  <Info label="응답 문항" value={`${response.answeredVisibleCount}개`} />
                  <Info
                    label="필수 완료"
                    value={`${response.requiredAnsweredCount} / ${response.requiredVisibleCount}`}
                  />
                  <Info
                    label="마지막 저장"
                    value={response.lastSavedAt ? formatDateTime(response.lastSavedAt) : '-'}
                  />
                </dl>
              </>
            ) : (
              <p className="text-[13px] text-slate-500">아직 응답이 시작되지 않았습니다.</p>
            )}
          </Panel>

          <Panel title="응답자 정보">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
              <Info label="이름" value={response?.respondentProfile.name ?? distribution.recipientName} />
              <Info label="직책" value={response?.respondentProfile.position ?? distribution.recipientPosition} />
              <Info label="부서" value={response?.respondentProfile.department ?? ''} />
              <Info label="이메일" value={response?.respondentProfile.email ?? distribution.recipientEmail} />
              <Info label="전화번호" value={response?.respondentProfile.phone ?? distribution.recipientPhone} />
            </dl>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="설문 정보">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Info label="문항 수" value={`${questionCount}개`} />
              <Info label="섹션 수" value={`${distribution.blueprintSnapshot.length}개`} />
              <Info
                label="응답자 역할"
                value={RESPONDENT_ROLE_META[distribution.respondentRole].label}
              />
              <Info
                label="현재 단계"
                value={project ? PROJECT_STAGE_META[project.currentStage].label : '-'}
              />
            </dl>
          </Panel>

          <Panel title="활동 이력">
            <ol className="flex flex-col gap-3">
              {timeline.map((event, index) => (
                <li key={index} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500"
                  />
                  <div>
                    <p className="text-[13px] font-medium text-slate-700">{event.label}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(event.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      <ConfirmModal
        open={revokeOpen}
        title="링크 회수"
        message="이 테스트 링크를 회수하면 응답자 화면에서 더 이상 열 수 없습니다. 기존 응답 데이터는 삭제되지 않습니다."
        confirmLabel="링크 회수"
        danger
        onConfirm={handleRevoke}
        onCancel={() => setRevokeOpen(false)}
      />

      <ConfirmModal
        open={regenOpen}
        title="토큰 재발급"
        message="토큰을 재발급하면 기존 테스트 링크는 사용할 수 없습니다. 새 링크로 다시 공유해야 합니다."
        warning={
          inProgress
            ? '현재 작성 중인 임시 응답은 새 토큰에 연결된 상태로 유지됩니다.'
            : undefined
        }
        confirmLabel="토큰 재발급"
        onConfirm={handleRegenerate}
        onCancel={() => setRegenOpen(false)}
      />
    </div>
  )
}
