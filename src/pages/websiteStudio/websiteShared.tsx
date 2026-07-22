import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Palette, Sparkles } from 'lucide-react'
import type { WebsiteDesign } from '../../types/websiteDesign'
import type { ProjectWebsiteContext } from '../../services/websiteDesignService'
import { Button } from '../../components/ui/Button'
import { NotFoundState } from '../../components/ui/NotFoundState'
import {
  WorkspaceHeader,
  WorkspaceStepNav,
  type WorkspaceStep,
} from '../../components/workspace/WorkspaceShell'
import { useWebsiteData } from './useWebsiteData'

export const WEBSITE_MODULE_NAME = '홈페이지 설계'
export const WEBSITE_MODULE_DESC =
  '홈페이지 목적과 고객 행동을 기준으로 사이트 구조·콘텐츠·디자인 방향을 정합니다.'

/** 홈페이지 설계 내부 단계 (실제 라우트 연결) */
export function websiteSteps(projectId: string): WorkspaceStep[] {
  const base = `/website-studio/projects/${projectId}`
  return [
    { key: 'overview', label: '개요', path: base },
    { key: 'strategy', label: '목표·고객', path: `${base}/strategy` },
    { key: 'sitemap', label: '사이트 구조', path: `${base}/sitemap` },
    { key: 'pages', label: '페이지·섹션', path: `${base}/pages` },
    { key: 'content', label: '콘텐츠·자료', path: `${base}/content` },
    { key: 'design', label: '디자인 방향', path: `${base}/design` },
    { key: 'prompt', label: '개발 지시문', path: `${base}/prompt` },
    { key: 'review', label: '설계 확정', path: `${base}/review` },
  ]
}

export function WebsiteHeader({ saveStatus }: { saveStatus?: 'idle' | 'saving' | 'saved' | 'local' | 'error' }) {
  return (
    <WorkspaceHeader moduleName={WEBSITE_MODULE_NAME} moduleDescription={WEBSITE_MODULE_DESC} saveStatus={saveStatus} />
  )
}

export function WebsiteNav({ projectId }: { projectId: string }) {
  return <WorkspaceStepNav steps={websiteSteps(projectId)} />
}

export function WebsiteProjectNotFound() {
  return (
    <NotFoundState
      title="프로젝트를 찾을 수 없습니다"
      description="주소가 잘못되었거나 이미 삭제·이동된 프로젝트입니다."
      backTo="/website-studio/results"
      backLabel="홈페이지 설계 결과로"
    />
  )
}

/** AX 전용 프로젝트 등 진입 차단 안내 */
export function WebsiteGateNotice({ context }: { context: ProjectWebsiteContext }) {
  const navigate = useNavigate()
  if (context.eligibility.axOnly) {
    return (
      <div className="rounded-(--radius-panel) border border-slate-200 bg-white p-6 shadow-(--shadow-card)">
        <div className="flex items-start gap-3">
          <Palette aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p className="text-[1.05rem] font-semibold text-slate-800">AX 전용 프로젝트입니다</p>
            <p className="mt-1 text-[0.95rem] break-keep text-slate-600">
              이 프로젝트에는 홈페이지 트랙이 없어 홈페이지 설계 대상이 아닙니다. AX 설계로 이동하거나, 홈페이지가
              필요하면 프로젝트 유형을 변경하거나 별도 홈페이지 프로젝트를 만드세요.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={() => navigate(`/mvp-design/projects/${context.project.id}`)}>
                AX 설계로 이동
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate(`/projects/${context.project.id}/edit`)}>
                프로젝트 유형 변경
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-(--radius-panel) border border-slate-200 bg-white p-6 shadow-(--shadow-card)">
      <p className="text-[1.05rem] font-semibold text-slate-800">홈페이지 설계를 시작할 수 있습니다</p>
      <p className="mt-1 text-[0.95rem] break-keep text-slate-600">
        개요 화면에서 설계를 생성하세요.
      </p>
    </div>
  )
}

/** 홈페이지 준비도 미확정 안내 */
export function ReadinessNotice({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="flex items-start gap-2 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3">
      <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-600" />
      <p className="text-[0.95rem] break-keep text-warning-800">
        홈페이지 준비도 분석을 먼저 확정하면 더 정확한 설계를 만들 수 있습니다. 지금은 기본 가정으로 초안을 생성합니다.
      </p>
    </div>
  )
}

export function RedesignBanner({ show, onRun }: { show: boolean; onRun: () => void }) {
  if (!show) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3">
      <Sparkles aria-hidden="true" className="size-4 shrink-0 text-warning-600" />
      <p className="min-w-0 flex-1 text-[0.95rem] break-keep text-warning-800">
        홈페이지 진단 결과가 변경되어 재설계가 필요합니다. 확정된 설계는 그대로 보존됩니다.
      </p>
      <Button variant="secondary" size="sm" onClick={onRun}>새 버전 설계</Button>
    </div>
  )
}

/** 하위 화면 공통 프레임 — 헤더·탭·차단 처리 후 설계를 전달한다 */
export function WebsiteSectionFrame({
  projectId,
  render,
}: {
  projectId: string
  render: (design: WebsiteDesign, context: ProjectWebsiteContext) => ReactNode
}) {
  const { context } = useWebsiteData(projectId)
  if (!context) return <WebsiteProjectNotFound />
  const { eligibility, design } = context
  return (
    <div className="flex flex-col gap-5">
      <WebsiteHeader />
      {eligibility.canDesign && <WebsiteNav projectId={projectId} />}
      {!eligibility.canDesign ? (
        <WebsiteGateNotice context={context} />
      ) : !design ? (
        <div className="flex flex-wrap items-center gap-3 rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-3 text-[0.95rem] text-slate-500">
          <span className="min-w-0 flex-1">아직 설계 초안이 없습니다. 개요 화면에서 설계를 생성하세요.</span>
        </div>
      ) : (
        render(design, context)
      )}
    </div>
  )
}
