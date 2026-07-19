import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ToastProvider } from './components/ui/toast'
import { MODULE_PAGES } from './data/modules'
import { DashboardPage } from './pages/DashboardPage'
import { EmptyModulePage } from './pages/EmptyModulePage'

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            {MODULE_PAGES.map((config) => (
              <Route
                key={config.key}
                path={config.path}
                element={<EmptyModulePage config={config} />}
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
