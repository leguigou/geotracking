import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useEffect, useState } from "react"
import { useAuth } from "../hooks/useAuth"
import { useProjects } from "../hooks/useApi"

const navItems = [
  { to: "/", icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z", i18n: "nav.dashboard" },
  { to: "/project/new", icon: "M12 4.5v15m7.5-7.5h-15", i18n: "nav.create" },
  { to: "/geo-audit", icon: "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.57-.598-3.75A11.959 11.959 0 0012 2.714z", i18n: "nav.geoAudit" },
  { to: "/settings", icon: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281zM15 12a3 3 0 11-6 0 3 3 0 016 0z", i18n: "nav.settings" },
  { to: "/audit", icon: "M4.75 6.75h14.5M4.75 12h14.5m-14.5 5.25h14.5", i18n: "nav.audit" },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { data: projects } = useProjects()
  const [showProjects, setShowProjects] = useState(false)
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("theme")
    if (saved === "dark") { document.documentElement.classList.add("dark"); return true }
    if (saved === "light") return false
    document.documentElement.classList.remove("dark")
    return false
  })

  const toggleTheme = () => {
    const next = !dark
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("theme", next ? "dark" : "light")
    setDark(next)
  }

  useEffect(() => {
    if (location.pathname.startsWith("/project/") && location.pathname !== "/project/new") {
      setShowProjects(true)
    }
  }, [location.pathname])

  const setLang = (lang: "fr" | "en") => {
    i18n.changeLanguage(lang)
    document.documentElement.lang = lang
  }

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??"

  const navLink = (item: typeof navItems[0]) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === "/"}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
          isActive
            ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
        }`
      }
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
      </svg>
      <span>{t(item.i18n)}</span>
    </NavLink>
  )

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen w-60 flex flex-col z-40 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-blue-500/20">
            G
          </div>
          <div>
            <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight">GEOTrack</span>
            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 ml-1 uppercase tracking-widest">AI</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map(navLink)}

          {/* Projects list */}
          <div className="pt-3">
            <button
              onClick={() => setShowProjects(!showProjects)}
              className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                location.pathname.startsWith("/project/") && location.pathname !== "/project/new"
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
                <span>{t('nav.projects')}</span>
              </span>
              <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${showProjects ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
            {showProjects && (
              <div className="ml-2 mt-1 space-y-0.5 border-l-2 border-slate-200 dark:border-slate-700 pl-2">
                {!projects || projects.length === 0 ? (
                  <p className="text-xs text-slate-400 px-2 py-1.5">Aucun projet</p>
                ) : (
                  projects.map((p) => {
                    const projectPath = `/project/${p.id}`
                    const isActive = location.pathname === projectPath || location.pathname.startsWith(`${projectPath}/`)
                    return (
                      <button
                        key={p.id}
                        onClick={() => { navigate(projectPath); onClose(); }}
                        aria-current={isActive ? "page" : undefined}
                        className={`relative w-full truncate rounded-md px-2.5 py-2 text-left text-xs transition-all ${
                          isActive
                            ? "bg-blue-100 font-semibold text-blue-800 shadow-sm ring-1 ring-inset ring-blue-200 dark:bg-blue-500/20 dark:text-blue-200 dark:ring-blue-500/30"
                            : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
                        }`}
                      >
                        {isActive && <span className="absolute -left-[11px] inset-y-1 w-1 rounded-r-full bg-blue-600 dark:bg-blue-400" />}
                        <span className="block truncate">{p.name}</span>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t("theme")}</span>
            <button onClick={toggleTheme} className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${dark ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"}`}>
              <span className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 flex items-center justify-center text-[10px] ${dark ? "translate-x-4" : ""}`}>
                {dark ? "🌙" : "☀️"}
              </span>
            </button>
          </div>
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Lang</span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
              <button onClick={() => setLang("fr")} className={`px-2 py-0.5 text-xs font-medium rounded-md transition-all ${i18n.language === "fr" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>FR</button>
              <button onClick={() => setLang("en")} className={`px-2 py-0.5 text-xs font-medium rounded-md transition-all ${i18n.language === "en" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>EN</button>
            </div>
          </div>
          <button onClick={() => navigate("/settings")} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer transition-colors text-left">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">{initials}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user?.full_name ?? "..."}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email ?? ""}</p>
            </div>
          </button>
          <button onClick={() => { logout(); navigate("/login", { replace: true }) }} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            <span>{t("nav.logout")}</span>
          </button>
        </div>
      </aside>
    </>
  )
}
