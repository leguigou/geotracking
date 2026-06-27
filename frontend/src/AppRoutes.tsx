import { lazy, Suspense } from "react"
import { Navigate, Outlet, Route, Routes } from "react-router-dom"

import Layout from "./components/Layout"
import { useAuth } from "./hooks/useAuth"

const LoginPage = lazy(() => import("./pages/LoginPage"))
const DashboardGlobal = lazy(() => import("./pages/DashboardGlobal"))
const DashboardProject = lazy(() => import("./pages/DashboardProject"))
const CreateProject = lazy(() => import("./pages/CreateProject"))
const SettingsPage = lazy(() => import("./pages/SettingsPage"))
const AuditLogsPage = lazy(() => import("./pages/AuditLogsPage"))
const GeoAuditPage = lazy(() => import("./pages/GeoAuditPage"))
const NotFound = lazy(() => import("./pages/NotFound"))

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  )
}

function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardGlobal />} />
            <Route path="/project/new" element={<CreateProject />} />
            <Route path="/project/:id" element={<DashboardProject />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/audit" element={<AuditLogsPage />} />
            <Route path="/geo-audit" element={<GeoAuditPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
