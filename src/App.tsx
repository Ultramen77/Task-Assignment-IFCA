import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import DashboardPage from './pages/DashboardPage'
import TasksPage from './pages/TasksPage'
import ClientsPage from './pages/ClientsPage'
import ConsultantsPage from './pages/ConsultantsPage'
import ProgrammersPage from './pages/ProgrammersPage'
import SettingsPage from './pages/SettingsPage'
import ImportPage from './pages/ImportPage'
import GuidePage from './pages/GuidePage'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage, { ResetPasswordPage } from './pages/ForgotPasswordPage'
import AdminPage from './pages/AdminPage'
import { authClient } from './lib/auth-client'
import { TaskProvider } from './context/TaskContext'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedApp />}>
        <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="master/clients" element={<ClientsPage />} />
        <Route path="master/consultants" element={<ConsultantsPage />} />
        <Route path="master/programmers" element={<ProgrammersPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="guide" element={<GuidePage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}

function ProtectedApp() {
  const location = useLocation()
  const session = authClient.useSession()

  if (session.isPending) {
    return <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--bg-primary)' }}><div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" aria-label="Memuat sesi" /></div>
  }

  if (!session.data) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  return <TaskProvider><Outlet /></TaskProvider>
}
