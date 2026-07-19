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
      ...MODULE_PAGES.filter((config) => config.key !== 'clients').map(
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
