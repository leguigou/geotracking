import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login, register } = useAuth()
  const [tab, setTab] = useState<"login" | "register">("login")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Login form state
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  // Register form state
  const [regFirstName, setRegFirstName] = useState("")
  const [regLastName, setRegLastName] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regCompany, setRegCompany] = useState("")
  const [regPassword, setRegPassword] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      await login(loginEmail, loginPassword)
      navigate("/", { replace: true })
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data?: { detail?: string } } }).response?.data?.detail || t("login.error")
          : t("login.error")
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      await register(regEmail, regPassword, `${regFirstName} ${regLastName}`.trim(), regCompany)
      navigate("/", { replace: true })
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data?: { detail?: string } } }).response?.data?.detail || t("login.error")
          : t("login.error")
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white text-xl font-bold shadow-xl shadow-blue-500/20 mb-4">
            G
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            GEOTrack <span className="text-blue-600 dark:text-blue-400">AI</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("login.subtitle")}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex mb-6 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          <button
            onClick={() => setTab("login")}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              tab === "login"
                ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {t("login.tabLogin")}
          </button>
          <button
            onClick={() => setTab("register")}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              tab === "register"
                ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {t("login.tabRegister")}
          </button>
        </div>

        {/* Login Form */}
        {tab === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {t("login.email")}
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="vous@agence.fr"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {t("login.password")}
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                  defaultChecked
                />
                <span>{t("login.remember")}</span>
              </label>
              <a
                href="#"
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                {t("login.forgot")}
              </a>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-3 text-base disabled:opacity-60"
            >
              {submitting ? "..." : t("login.btnLogin")}
            </button>
          </form>
        )}

        {/* Register Form */}
        {tab === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("login.firstName")}
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Alex"
                  value={regFirstName}
                  onChange={(e) => setRegFirstName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("login.lastName")}
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Chen"
                  value={regLastName}
                  onChange={(e) => setRegLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {t("login.email")}
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="vous@agence.fr"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {t("login.company")}
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Agence Digitale"
                value={regCompany}
                onChange={(e) => setRegCompany(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {t("login.password")}
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-3 text-base disabled:opacity-60"
            >
              {submitting ? "..." : t("login.btnRegister")}
            </button>
            <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-4">
              {t("login.terms")}
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
