import { Suspense, lazy } from 'react'
import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
} from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ToastProvider } from './components/ui/toast'
import { TextScaleProvider } from './components/ui/TextScaleProvider'
import { MODULE_PAGES } from './data/modules'
import { DashboardPage } from './pages/DashboardPage'
import { EmptyModulePage } from './pages/EmptyModulePage'

// 초기 진입(대시보드) 외 화면은 route-level lazy loading으로 entry 번들을 줄인다.
const ClientsListPage = lazy(() =>
  import('./pages/ClientsListPage').then((m) => ({ default: m.ClientsListPage })),
)
const OrganizationDetailPage = lazy(() =>
  import('./pages/OrganizationDetailPage').then((m) => ({ default: m.OrganizationDetailPage })),
)
const OrganizationFormPage = lazy(() =>
  import('./pages/OrganizationFormPage').then((m) => ({ default: m.OrganizationFormPage })),
)
const ProjectDetailPage = lazy(() =>
  import('./pages/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })),
)
const ProjectFormPage = lazy(() =>
  import('./pages/ProjectFormPage').then((m) => ({ default: m.ProjectFormPage })),
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

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
const SelectionMainPage = lazy(() =>
  import('./pages/selection/SelectionMainPage').then((m) => ({ default: m.SelectionMainPage })),
)
const SelectionProjectPage = lazy(() =>
  import('./pages/selection/SelectionProjectPage').then((m) => ({ default: m.SelectionProjectPage })),
)
const CandidateBoardPage = lazy(() =>
  import('./pages/selection/CandidateBoardPage').then((m) => ({ default: m.CandidateBoardPage })),
)
const CandidateDetailPage = lazy(() =>
  import('./pages/selection/CandidateDetailPage').then((m) => ({ default: m.CandidateDetailPage })),
)
const PriorityMatrixPage = lazy(() =>
  import('./pages/selection/PriorityMatrixPage').then((m) => ({ default: m.PriorityMatrixPage })),
)
const SelectionDecisionPage = lazy(() =>
  import('./pages/selection/SelectionDecisionPage').then((m) => ({ default: m.SelectionDecisionPage })),
)
const SelectionResultsPage = lazy(() =>
  import('./pages/selection/SelectionResultsPage').then((m) => ({ default: m.SelectionResultsPage })),
)
const MvpDesignMainPage = lazy(() =>
  import('./pages/mvpDesign/MvpDesignMainPage').then((m) => ({ default: m.MvpDesignMainPage })),
)
const MvpDesignResultsPage = lazy(() =>
  import('./pages/mvpDesign/MvpDesignResultsPage').then((m) => ({ default: m.MvpDesignResultsPage })),
)
const DesignProjectPage = lazy(() =>
  import('./pages/mvpDesign/DesignProjectPage').then((m) => ({ default: m.DesignProjectPage })),
)
const DesignWorkflowPage = lazy(() =>
  import('./pages/mvpDesign/DesignWorkflowPage').then((m) => ({ default: m.DesignWorkflowPage })),
)
const DesignFeaturesPage = lazy(() =>
  import('./pages/mvpDesign/DesignFeaturesPage').then((m) => ({ default: m.DesignFeaturesPage })),
)
const DesignScreensPage = lazy(() =>
  import('./pages/mvpDesign/DesignScreensPage').then((m) => ({ default: m.DesignScreensPage })),
)
const DesignDataPage = lazy(() =>
  import('./pages/mvpDesign/DesignDataPage').then((m) => ({ default: m.DesignDataPage })),
)
const DesignPermissionsPage = lazy(() =>
  import('./pages/mvpDesign/DesignPermissionsPage').then((m) => ({ default: m.DesignPermissionsPage })),
)
const DesignRulesPage = lazy(() =>
  import('./pages/mvpDesign/DesignRulesPage').then((m) => ({ default: m.DesignRulesPage })),
)
const DesignValidationPage = lazy(() =>
  import('./pages/mvpDesign/DesignValidationPage').then((m) => ({ default: m.DesignValidationPage })),
)
const DesignReviewPage = lazy(() =>
  import('./pages/mvpDesign/DesignReviewPage').then((m) => ({ default: m.DesignReviewPage })),
)
const WebsiteStudioMainPage = lazy(() =>
  import('./pages/websiteStudio/WebsiteStudioMainPage').then((m) => ({ default: m.WebsiteStudioMainPage })),
)
const WebsiteResultsPage = lazy(() =>
  import('./pages/websiteStudio/WebsiteResultsPage').then((m) => ({ default: m.WebsiteResultsPage })),
)
const WebsiteProjectPage = lazy(() =>
  import('./pages/websiteStudio/WebsiteProjectPage').then((m) => ({ default: m.WebsiteProjectPage })),
)
const WebsiteStrategyPage = lazy(() =>
  import('./pages/websiteStudio/WebsiteStrategyPage').then((m) => ({ default: m.WebsiteStrategyPage })),
)
const WebsiteSitemapPage = lazy(() =>
  import('./pages/websiteStudio/WebsiteSitemapPage').then((m) => ({ default: m.WebsiteSitemapPage })),
)
const WebsitePagesPage = lazy(() =>
  import('./pages/websiteStudio/WebsitePagesPage').then((m) => ({ default: m.WebsitePagesPage })),
)
const WebsiteContentPage = lazy(() =>
  import('./pages/websiteStudio/WebsiteContentPage').then((m) => ({ default: m.WebsiteContentPage })),
)
const WebsiteDesignDirectionPage = lazy(() =>
  import('./pages/websiteStudio/WebsiteDesignDirectionPage').then((m) => ({ default: m.WebsiteDesignDirectionPage })),
)
const WebsitePromptPage = lazy(() =>
  import('./pages/websiteStudio/WebsitePromptPage').then((m) => ({ default: m.WebsitePromptPage })),
)
const WebsiteReviewPage = lazy(() =>
  import('./pages/websiteStudio/WebsiteReviewPage').then((m) => ({ default: m.WebsiteReviewPage })),
)
const ValidationMainPage = lazy(() =>
  import('./pages/validation/ValidationMainPage').then((m) => ({ default: m.ValidationMainPage })),
)
const ValidationResultsPage = lazy(() =>
  import('./pages/validation/ValidationResultsPage').then((m) => ({ default: m.ValidationResultsPage })),
)
const ValidationProjectPage = lazy(() =>
  import('./pages/validation/ValidationProjectPage').then((m) => ({ default: m.ValidationProjectPage })),
)
const TrackOverviewPage = lazy(() =>
  import('./pages/validation/TrackOverviewPage').then((m) => ({ default: m.TrackOverviewPage })),
)
const TrackPlanPage = lazy(() =>
  import('./pages/validation/TrackPlanPage').then((m) => ({ default: m.TrackPlanPage })),
)
const TrackBuildPage = lazy(() =>
  import('./pages/validation/TrackBuildPage').then((m) => ({ default: m.TrackBuildPage })),
)
const TrackScenariosPage = lazy(() =>
  import('./pages/validation/TrackScenariosPage').then((m) => ({ default: m.TrackScenariosPage })),
)
const TrackRoundsPage = lazy(() =>
  import('./pages/validation/TrackRoundsPage').then((m) => ({ default: m.TrackRoundsPage })),
)
const RoundDetailPage = lazy(() =>
  import('./pages/validation/RoundDetailPage').then((m) => ({ default: m.RoundDetailPage })),
)
const TrackFeedbackPage = lazy(() =>
  import('./pages/validation/TrackFeedbackPage').then((m) => ({ default: m.TrackFeedbackPage })),
)
const TrackMetricsPage = lazy(() =>
  import('./pages/validation/TrackMetricsPage').then((m) => ({ default: m.TrackMetricsPage })),
)
const TrackGatesPage = lazy(() =>
  import('./pages/validation/TrackGatesPage').then((m) => ({ default: m.TrackGatesPage })),
)
const TrackDecisionPage = lazy(() =>
  import('./pages/validation/TrackDecisionPage').then((m) => ({ default: m.TrackDecisionPage })),
)
const LocalTestPage = lazy(() =>
  import('./pages/validation/LocalTestPage').then((m) => ({ default: m.LocalTestPage })),
)
const DeliverablesMainPage = lazy(() =>
  import('./pages/deliverables/DeliverablesMainPage').then((m) => ({ default: m.DeliverablesMainPage })),
)
const DeliverableResultsPage = lazy(() =>
  import('./pages/deliverables/DeliverableResultsPage').then((m) => ({ default: m.DeliverableResultsPage })),
)
const ProjectDeliverablesPage = lazy(() =>
  import('./pages/deliverables/ProjectDeliverablesPage').then((m) => ({ default: m.ProjectDeliverablesPage })),
)
const CreatePackagePage = lazy(() =>
  import('./pages/deliverables/CreatePackagePage').then((m) => ({ default: m.CreatePackagePage })),
)
const PackageDetailPage = lazy(() =>
  import('./pages/deliverables/PackageDetailPage').then((m) => ({ default: m.PackageDetailPage })),
)
const PackageContentsPage = lazy(() =>
  import('./pages/deliverables/PackageContentsPage').then((m) => ({ default: m.PackageContentsPage })),
)
const PackageReportsPage = lazy(() =>
  import('./pages/deliverables/PackageReportsPage').then((m) => ({ default: m.PackageReportsPage })),
)
const PackageSpecificationPage = lazy(() =>
  import('./pages/deliverables/PackageSpecificationPage').then((m) => ({ default: m.PackageSpecificationPage })),
)
const PackageRoadmapPage = lazy(() =>
  import('./pages/deliverables/PackageRoadmapPage').then((m) => ({ default: m.PackageRoadmapPage })),
)
const PackagePromptsPage = lazy(() =>
  import('./pages/deliverables/PackagePromptsPage').then((m) => ({ default: m.PackagePromptsPage })),
)
const PackageEvidencePage = lazy(() =>
  import('./pages/deliverables/PackageEvidencePage').then((m) => ({ default: m.PackageEvidencePage })),
)
const PackagePreviewPage = lazy(() =>
  import('./pages/deliverables/PackagePreviewPage').then((m) => ({ default: m.PackagePreviewPage })),
)
const PackageReviewPage = lazy(() =>
  import('./pages/deliverables/PackageReviewPage').then((m) => ({ default: m.PackageReviewPage })),
)
const FundingMainPage = lazy(() =>
  import('./pages/funding/FundingMainPage').then((m) => ({ default: m.FundingMainPage })),
)
const FundingCatalogPage = lazy(() =>
  import('./pages/funding/FundingCatalogPage').then((m) => ({ default: m.FundingCatalogPage })),
)
const InstitutionDetailPage = lazy(() =>
  import('./pages/funding/InstitutionDetailPage').then((m) => ({ default: m.InstitutionDetailPage })),
)
const ProgramDetailPage = lazy(() =>
  import('./pages/funding/ProgramDetailPage').then((m) => ({ default: m.ProgramDetailPage })),
)
const FundingResultsPage = lazy(() =>
  import('./pages/funding/FundingResultsPage').then((m) => ({ default: m.FundingResultsPage })),
)
const ProjectFundingPage = lazy(() =>
  import('./pages/funding/ProjectFundingPage').then((m) => ({ default: m.ProjectFundingPage })),
)
const FundingMatchesPage = lazy(() =>
  import('./pages/funding/FundingMatchesPage').then((m) => ({ default: m.FundingMatchesPage })),
)
const FundingGapsPage = lazy(() =>
  import('./pages/funding/FundingGapsPage').then((m) => ({ default: m.FundingGapsPage })),
)
const FundingOutreachPage = lazy(() =>
  import('./pages/funding/FundingOutreachPage').then((m) => ({ default: m.FundingOutreachPage })),
)
const FundingChecklistPage = lazy(() =>
  import('./pages/funding/FundingChecklistPage').then((m) => ({ default: m.FundingChecklistPage })),
)
const FundingPipelinePage = lazy(() =>
  import('./pages/funding/FundingPipelinePage').then((m) => ({ default: m.FundingPipelinePage })),
)
const FundingOutcomePage = lazy(() =>
  import('./pages/funding/FundingOutcomePage').then((m) => ({ default: m.FundingOutcomePage })),
)
const FundingCasePage = lazy(() =>
  import('./pages/funding/FundingCasePage').then((m) => ({ default: m.FundingCasePage })),
)
const FundingReviewPage = lazy(() =>
  import('./pages/funding/FundingReviewPage').then((m) => ({ default: m.FundingReviewPage })),
)
const CasesLibraryPage = lazy(() =>
  import('./pages/funding/CasesLibraryPage').then((m) => ({ default: m.CasesLibraryPage })),
)
const CaseDetailPage = lazy(() =>
  import('./pages/funding/CaseDetailPage').then((m) => ({ default: m.CaseDetailPage })),
)

/** 진단 스튜디오는 실제 기능으로 대체되므로 빈 상태 페이지에서 제외 */
const EMPTY_MODULE_KEYS = new Set(['clients', 'diagnosis', 'selection', 'mvp-design', 'website-studio', 'validation', 'deliverables', 'settings'])

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
      { path: 'settings', element: <SettingsPage /> },

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

      { path: 'selection', element: <SelectionMainPage /> },
      { path: 'selection/results', element: <SelectionResultsPage /> },
      { path: 'selection/projects/:projectId', element: <SelectionProjectPage /> },
      { path: 'selection/projects/:projectId/candidates', element: <CandidateBoardPage /> },
      { path: 'selection/projects/:projectId/candidates/:candidateId', element: <CandidateDetailPage /> },
      { path: 'selection/projects/:projectId/matrix', element: <PriorityMatrixPage /> },
      { path: 'selection/projects/:projectId/decision', element: <SelectionDecisionPage /> },

      { path: 'mvp-design', element: <MvpDesignMainPage /> },
      { path: 'mvp-design/results', element: <MvpDesignResultsPage /> },
      { path: 'mvp-design/projects/:projectId', element: <DesignProjectPage /> },
      { path: 'mvp-design/projects/:projectId/workflow', element: <DesignWorkflowPage /> },
      { path: 'mvp-design/projects/:projectId/features', element: <DesignFeaturesPage /> },
      { path: 'mvp-design/projects/:projectId/screens', element: <DesignScreensPage /> },
      { path: 'mvp-design/projects/:projectId/data', element: <DesignDataPage /> },
      { path: 'mvp-design/projects/:projectId/permissions', element: <DesignPermissionsPage /> },
      { path: 'mvp-design/projects/:projectId/rules', element: <DesignRulesPage /> },
      { path: 'mvp-design/projects/:projectId/validation', element: <DesignValidationPage /> },
      { path: 'mvp-design/projects/:projectId/review', element: <DesignReviewPage /> },

      { path: 'website-studio', element: <WebsiteStudioMainPage /> },
      { path: 'website-studio/results', element: <WebsiteResultsPage /> },
      { path: 'website-studio/projects/:projectId', element: <WebsiteProjectPage /> },
      { path: 'website-studio/projects/:projectId/strategy', element: <WebsiteStrategyPage /> },
      { path: 'website-studio/projects/:projectId/sitemap', element: <WebsiteSitemapPage /> },
      { path: 'website-studio/projects/:projectId/pages', element: <WebsitePagesPage /> },
      { path: 'website-studio/projects/:projectId/content', element: <WebsiteContentPage /> },
      { path: 'website-studio/projects/:projectId/design', element: <WebsiteDesignDirectionPage /> },
      { path: 'website-studio/projects/:projectId/prompt', element: <WebsitePromptPage /> },
      { path: 'website-studio/projects/:projectId/review', element: <WebsiteReviewPage /> },

      { path: 'validation', element: <ValidationMainPage /> },
      { path: 'validation/results', element: <ValidationResultsPage /> },
      { path: 'validation/projects/:projectId', element: <ValidationProjectPage /> },
      { path: 'validation/projects/:projectId/:trackType', element: <TrackOverviewPage /> },
      { path: 'validation/projects/:projectId/:trackType/plan', element: <TrackPlanPage /> },
      { path: 'validation/projects/:projectId/:trackType/build', element: <TrackBuildPage /> },
      { path: 'validation/projects/:projectId/:trackType/scenarios', element: <TrackScenariosPage /> },
      { path: 'validation/projects/:projectId/:trackType/rounds', element: <TrackRoundsPage /> },
      { path: 'validation/projects/:projectId/:trackType/rounds/:roundId', element: <RoundDetailPage /> },
      { path: 'validation/projects/:projectId/:trackType/feedback', element: <TrackFeedbackPage /> },
      { path: 'validation/projects/:projectId/:trackType/metrics', element: <TrackMetricsPage /> },
      { path: 'validation/projects/:projectId/:trackType/gates', element: <TrackGatesPage /> },
      { path: 'validation/projects/:projectId/:trackType/decision', element: <TrackDecisionPage /> },

      { path: 'deliverables', element: <DeliverablesMainPage /> },
      { path: 'deliverables/results', element: <DeliverableResultsPage /> },
      { path: 'deliverables/projects/:projectId', element: <ProjectDeliverablesPage /> },
      { path: 'deliverables/projects/:projectId/create', element: <CreatePackagePage /> },
      { path: 'deliverables/projects/:projectId/packages/:packageId', element: <PackageDetailPage /> },
      { path: 'deliverables/projects/:projectId/packages/:packageId/contents', element: <PackageContentsPage /> },
      { path: 'deliverables/projects/:projectId/packages/:packageId/reports', element: <PackageReportsPage /> },
      { path: 'deliverables/projects/:projectId/packages/:packageId/specification', element: <PackageSpecificationPage /> },
      { path: 'deliverables/projects/:projectId/packages/:packageId/roadmap', element: <PackageRoadmapPage /> },
      { path: 'deliverables/projects/:projectId/packages/:packageId/prompts', element: <PackagePromptsPage /> },
      { path: 'deliverables/projects/:projectId/packages/:packageId/evidence', element: <PackageEvidencePage /> },
      { path: 'deliverables/projects/:projectId/packages/:packageId/preview', element: <PackagePreviewPage /> },
      { path: 'deliverables/projects/:projectId/packages/:packageId/review', element: <PackageReviewPage /> },

      { path: 'funding', element: <FundingMainPage /> },
      { path: 'funding/catalog', element: <FundingCatalogPage /> },
      { path: 'funding/catalog/institutions/:institutionId', element: <InstitutionDetailPage /> },
      { path: 'funding/catalog/programs/:programId', element: <ProgramDetailPage /> },
      { path: 'funding/results', element: <FundingResultsPage /> },
      { path: 'funding/projects/:projectId', element: <ProjectFundingPage /> },
      { path: 'funding/projects/:projectId/matches', element: <FundingMatchesPage /> },
      { path: 'funding/projects/:projectId/gaps', element: <FundingGapsPage /> },
      { path: 'funding/projects/:projectId/outreach', element: <FundingOutreachPage /> },
      { path: 'funding/projects/:projectId/checklist', element: <FundingChecklistPage /> },
      { path: 'funding/projects/:projectId/pipeline', element: <FundingPipelinePage /> },
      { path: 'funding/projects/:projectId/outcome', element: <FundingOutcomePage /> },
      { path: 'funding/projects/:projectId/case', element: <FundingCasePage /> },
      { path: 'funding/projects/:projectId/review', element: <FundingReviewPage /> },
      { path: 'cases', element: <CasesLibraryPage /> },
      { path: 'cases/:caseId', element: <CaseDetailPage /> },

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
  {
    // 로컬 테스트 런타임 — 내부 AppShell과 완전히 분리 (localStorage 로컬 전용)
    path: '/test/:accessToken',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <LocalTestPage />
      </Suspense>
    ),
  },
])

function App() {
  return (
    <TextScaleProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </TextScaleProvider>
  )
}

export default App
