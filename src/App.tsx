import { Suspense, lazy } from 'react'
import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
} from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ToastProvider } from './components/ui/toast'
import { MODULE_PAGES } from './data/modules'
import { ClientsListPage } from './pages/ClientsListPage'
import { DashboardPage } from './pages/DashboardPage'
import { EmptyModulePage } from './pages/EmptyModulePage'
import { OrganizationDetailPage } from './pages/OrganizationDetailPage'
import { OrganizationFormPage } from './pages/OrganizationFormPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ProjectFormPage } from './pages/ProjectFormPage'

// 진단 관리·공개 설문은 route-level lazy loading으로 초기 번들을 줄인다
const DiagnosisStudioPage = lazy(() =>
  import('./pages/diagnosis/DiagnosisStudioPage').then((m) => ({ default: m.DiagnosisStudioPage })),
)
const QuestionBankPage = lazy(() =>
  import('./pages/diagnosis/QuestionBankPage').then((m) => ({ default: m.QuestionBankPage })),
)
const QuestionFormPage = lazy(() =>
  import('./pages/diagnosis/QuestionFormPage').then((m) => ({ default: m.QuestionFormPage })),
)
const ModulesPage = lazy(() =>
  import('./pages/diagnosis/ModulesPage').then((m) => ({ default: m.ModulesPage })),
)
const ModuleFormPage = lazy(() =>
  import('./pages/diagnosis/ModuleFormPage').then((m) => ({ default: m.ModuleFormPage })),
)
const TemplatesPage = lazy(() =>
  import('./pages/diagnosis/TemplatesPage').then((m) => ({ default: m.TemplatesPage })),
)
const TemplateBuilderPage = lazy(() =>
  import('./pages/diagnosis/TemplateBuilderPage').then((m) => ({ default: m.TemplateBuilderPage })),
)
const TemplatePreviewPage = lazy(() =>
  import('./pages/diagnosis/TemplatePreviewPage').then((m) => ({ default: m.TemplatePreviewPage })),
)
const ProjectSurveySetupPage = lazy(() =>
  import('./pages/diagnosis/ProjectSurveySetupPage').then((m) => ({ default: m.ProjectSurveySetupPage })),
)
const SurveysMainPage = lazy(() =>
  import('./pages/diagnosis/SurveysMainPage').then((m) => ({ default: m.SurveysMainPage })),
)
const ProjectSurveysPage = lazy(() =>
  import('./pages/diagnosis/ProjectSurveysPage').then((m) => ({ default: m.ProjectSurveysPage })),
)
const DistributionDetailPage = lazy(() =>
  import('./pages/diagnosis/DistributionDetailPage').then((m) => ({ default: m.DistributionDetailPage })),
)
const ResponseDetailPage = lazy(() =>
  import('./pages/diagnosis/ResponseDetailPage').then((m) => ({ default: m.ResponseDetailPage })),
)
const PublicSurveyPage = lazy(() =>
  import('./pages/public/PublicSurveyPage').then((m) => ({ default: m.PublicSurveyPage })),
)
const AssessmentsListPage = lazy(() =>
  import('./pages/diagnosis/AssessmentsListPage').then((m) => ({ default: m.AssessmentsListPage })),
)
const AnalysisMainPage = lazy(() =>
  import('./pages/diagnosis/analysis/AnalysisMainPage').then((m) => ({ default: m.AnalysisMainPage })),
)
const ResponseComparePage = lazy(() =>
  import('./pages/diagnosis/analysis/ResponseComparePage').then((m) => ({ default: m.ResponseComparePage })),
)
const AnalysisIssuesPage = lazy(() =>
  import('./pages/diagnosis/analysis/AnalysisIssuesPage').then((m) => ({ default: m.AnalysisIssuesPage })),
)
const InterviewQuestionsPage = lazy(() =>
  import('./pages/diagnosis/analysis/InterviewQuestionsPage').then((m) => ({ default: m.InterviewQuestionsPage })),
)
const ScoreDetailPage = lazy(() =>
  import('./pages/diagnosis/analysis/ScoreDetailPage').then((m) => ({ default: m.ScoreDetailPage })),
)
const AssessmentResultPage = lazy(() =>
  import('./pages/diagnosis/analysis/AssessmentResultPage').then((m) => ({ default: m.AssessmentResultPage })),
)

/** 진단 스튜디오는 실제 기능으로 대체되므로 빈 상태 페이지에서 제외 */
const EMPTY_MODULE_KEYS = new Set(['clients', 'diagnosis'])

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <span className="text-sm text-slate-400">불러오는 중…</span>
    </div>
  )
}

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'clients', element: <ClientsListPage /> },
      { path: 'clients/new', element: <OrganizationFormPage /> },
      { path: 'clients/:organizationId', element: <OrganizationDetailPage /> },
      { path: 'clients/:organizationId/edit', element: <OrganizationFormPage /> },
      { path: 'projects/new', element: <ProjectFormPage /> },
      { path: 'projects/:projectId', element: <ProjectDetailPage /> },
      { path: 'projects/:projectId/edit', element: <ProjectFormPage /> },

      { path: 'diagnosis', element: <DiagnosisStudioPage /> },
      { path: 'diagnosis/questions', element: <QuestionBankPage /> },
      { path: 'diagnosis/questions/new', element: <QuestionFormPage /> },
      { path: 'diagnosis/questions/:questionId/edit', element: <QuestionFormPage /> },
      { path: 'diagnosis/modules', element: <ModulesPage /> },
      { path: 'diagnosis/modules/new', element: <ModuleFormPage /> },
      { path: 'diagnosis/modules/:moduleId/edit', element: <ModuleFormPage /> },
      { path: 'diagnosis/templates', element: <TemplatesPage /> },
      { path: 'diagnosis/templates/new', element: <TemplateBuilderPage /> },
      { path: 'diagnosis/templates/:templateId/edit', element: <TemplateBuilderPage /> },
      { path: 'diagnosis/templates/:templateId/preview', element: <TemplatePreviewPage /> },
      { path: 'diagnosis/surveys', element: <SurveysMainPage /> },
      { path: 'diagnosis/surveys/:distributionId', element: <DistributionDetailPage /> },
      { path: 'diagnosis/surveys/:distributionId/response', element: <ResponseDetailPage /> },
      { path: 'diagnosis/assessments', element: <AssessmentsListPage /> },
      { path: 'diagnosis/projects/:projectId/setup', element: <ProjectSurveySetupPage /> },
      { path: 'diagnosis/projects/:projectId/surveys', element: <ProjectSurveysPage /> },
      { path: 'diagnosis/projects/:projectId/analysis', element: <AnalysisMainPage /> },
      { path: 'diagnosis/projects/:projectId/analysis/compare', element: <ResponseComparePage /> },
      { path: 'diagnosis/projects/:projectId/analysis/issues', element: <AnalysisIssuesPage /> },
      { path: 'diagnosis/projects/:projectId/analysis/interview', element: <InterviewQuestionsPage /> },
      { path: 'diagnosis/projects/:projectId/analysis/score', element: <ScoreDetailPage /> },
      { path: 'diagnosis/projects/:projectId/analysis/result', element: <AssessmentResultPage /> },

      ...MODULE_PAGES.filter((config) => !EMPTY_MODULE_KEYS.has(config.key)).map(
        (config) => ({
          path: config.path,
          element: <EmptyModulePage config={config} />,
        }),
      ),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
  {
    // 공개 설문 — 내부 AppShell과 완전히 분리
    path: '/survey/:accessToken',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <PublicSurveyPage />
      </Suspense>
    ),
  },
])

function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  )
}

export default App
