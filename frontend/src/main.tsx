import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom"
import "./index.css"
import "./i18n/config"
import { AuthProvider, useAuth } from "./hooks/useAuth"
import Layout from "./components/Layout"
import LoginPage from "./pages/LoginPage"
import DashboardGlobal from "./pages/DashboardGlobal"
import DashboardProject from "./pages/DashboardProject"
import CreateProject from "./pages/CreateProject"
import SettingsPage from "./pages/SettingsPage"

/** Guarde les routes qui nécessitent une authentification */
function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardGlobal />} />
          <Route path="/project/new" element={<CreateProject />} />
          <Route path="/project/:id" element={<DashboardProject />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
