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
import { DiagnosisStudioPage } from './pages/diagnosis/DiagnosisStudioPage'
import { QuestionBankPage } from './pages/diagnosis/QuestionBankPage'
import { QuestionFormPage } from './pages/diagnosis/QuestionFormPage'
import { ModulesPage } from './pages/diagnosis/ModulesPage'
import { ModuleFormPage } from './pages/diagnosis/ModuleFormPage'
import { TemplatesPage } from './pages/diagnosis/TemplatesPage'
import { TemplateBuilderPage } from './pages/diagnosis/TemplateBuilderPage'
import { TemplatePreviewPage } from './pages/diagnosis/TemplatePreviewPage'
import { ProjectSurveySetupPage } from './pages/diagnosis/ProjectSurveySetupPage'

/** 진단 스튜디오는 실제 기능으로 대체되므로 빈 상태 페이지에서 제외 */
const EMPTY_MODULE_KEYS = new Set(['clients', 'diagnosis'])

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
      { path: 'diagnosis/projects/:projectId/setup', element: <ProjectSurveySetupPage /> },

      ...MODULE_PAGES.filter((config) => !EMPTY_MODULE_KEYS.has(config.key)).map(
        (config) => ({
          path: config.path,
          element: <EmptyModulePage config={config} />,
        }),
      ),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
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
