import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import "./index.css"
import "./i18n/config"
import Layout from "./components/Layout"
import LoginPage from "./pages/LoginPage"
import DashboardGlobal from "./pages/DashboardGlobal"
import DashboardProject from "./pages/DashboardProject"
import CreateProject from "./pages/CreateProject"
import SettingsPage from "./pages/SettingsPage"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardGlobal />} />
          <Route path="/project/:id" element={<DashboardProject />} />
          <Route path="/project/new" element={<CreateProject />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
