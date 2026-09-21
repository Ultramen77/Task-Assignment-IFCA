import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import AppLayout from './layouts/AppLayout'
import DashboardPage from './pages/DashboardPage'
import TasksPage from './pages/TasksPage'
import ClientsPage from './pages/ClientsPage'
import ConsultantsPage from './pages/ConsultantsPage'
import ProgrammersPage from './pages/ProgrammersPage'
import SettingsPage from './pages/SettingsPage'
import ImportPage from './pages/ImportPage'
import GuidePage from './pages/GuidePage'
import { flushSheetsQueue } from './lib/sheetSync'

export default function App() {
  useEffect(() => { flushSheetsQueue() }, [])
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="master/clients" element={<ClientsPage />} />
        <Route path="master/consultants" element={<ConsultantsPage />} />
        <Route path="master/programmers" element={<ProgrammersPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="guide" element={<GuidePage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
