import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { surveyTemplateRepository } from '../../repositories'
import { resolveTemplate } from '../../services/surveyTemplateService'
import { DetailHeader } from '../../components/ui/DetailHeader'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { SurveyPreviewShell } from '../../components/diagnosis/SurveyPreviewShell'
import { TemplateStatusBadge, RespondentRoleBadge } from '../../components/diagnosis/badges'

export function TemplatePreviewPage() {
  const { templateId = '' } = useParams()
  const navigate = useNavigate()

  const template = useMemo(
    () => surveyTemplateRepository.getById(templateId),
    [templateId],
  )
  const sections = useMemo(
    () => (template ? resolveTemplate(template) : []),
    [template],
  )

  if (!template) {
    return (
      <NotFoundState
        title="템플릿을 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제·이동된 템플릿입니다."
        backTo="/diagnosis/templates"
        backLabel="템플릿 목록으로 돌아가기"
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        backTo="/diagnosis/templates"
        backLabel="설문 템플릿"
        title={template.name}
        badges={
          <>
            <RespondentRoleBadge role={template.respondentRole} />
            <TemplateStatusBadge status={template.status} />
            <span className="text-[0.875rem] text-slate-400">v{template.version}</span>
          </>
        }
        meta={
          <>
            <span>{template.description}</span>
          </>
        }
      />

      <p className="rounded-(--radius-card) border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] break-keep text-slate-600">
        내부 검수용 미리보기입니다. 입력값은 저장되지 않으며, 고객용 설문 발급은 다음
        개발 단계에서 제공됩니다.
      </p>

      <SurveyPreviewShell
        sections={sections}
        respondentRole={template.respondentRole}
        estimatedMinutes={template.estimatedMinutes}
        title={template.name}
        onExit={() => navigate('/diagnosis/templates')}
      />
    </div>
  )
}
