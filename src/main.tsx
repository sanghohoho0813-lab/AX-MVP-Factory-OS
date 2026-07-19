import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { AuthProvider, useAuth } from './lib/auth'
import AppShell from './components/AppShell'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CompaniesPage from './pages/CompaniesPage'
import CompanyFormPage from './pages/CompanyFormPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectNewPage from './pages/ProjectNewPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import SettingsPage from './pages/SettingsPage'

// 로그인 필수 + 앱 셸 래핑
function Protected({ children }: { children: ReactNode }) {
  const { loading, profile } = useAuth()
  if (loading) return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-400">불러오는 중…</div>
  if (!profile) return <Navigate to="/login" replace />
  return <AppShell>{children}</AppShell>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Protected><DashboardPage /></Protected>} />
          <Route path="/companies" element={<Protected><CompaniesPage /></Protected>} />
          <Route path="/companies/new" element={<Protected><CompanyFormPage /></Protected>} />
          <Route path="/companies/:id" element={<Protected><CompanyFormPage /></Protected>} />
          <Route path="/projects" element={<Protected><ProjectsPage /></Protected>} />
          <Route path="/projects/new" element={<Protected><ProjectNewPage /></Protected>} />
          <Route path="/projects/:id" element={<Protected><ProjectDetailPage /></Protected>} />
          <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
