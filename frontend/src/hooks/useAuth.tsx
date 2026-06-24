import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { login as apiLogin, register as apiRegister, me as apiMe } from "../lib/api"
import axios from "axios"

export interface User {
  id: string
  email: string
  full_name: string
}

interface AuthContextType {
  isAuthenticated: boolean
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, full_name: string, organization_name: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Vérifier le token au mount — tenter un refresh via cookie
  useEffect(() => {
    const tryAuth = async () => {
      const token = localStorage.getItem("access_token")

      // Si on a un token, essayer /me d'abord (rapide)
      if (token) {
        try {
          const data = await apiMe()
          setUser(data)
          setLoading(false)
          return
        } catch {
          // Token expiré → tenter un refresh via le cookie
        }
      }

      // Tenter un refresh via le cookie HTTP-only (même sans token local)
      try {
        const res = await axios.post(
          `${import.meta.env.VITE_API_URL || "/api"}/auth/refresh`,
          {},
          { withCredentials: true },
        )
        localStorage.setItem("access_token", res.data.access_token)
        const data = await apiMe()
        setUser(data)
      } catch {
        // Refresh échoué
        localStorage.removeItem("access_token")
      }

      setLoading(false)
    }

    tryAuth()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password)
    localStorage.setItem("access_token", data.access_token)
    const meData = await apiMe()
    setUser(meData)
  }, [])

  const register = useCallback(
    async (email: string, password: string, full_name: string, organization_name: string) => {
      const data = await apiRegister(email, password, full_name, organization_name)
      localStorage.setItem("access_token", data.access_token)
      const meData = await apiMe()
      setUser(meData)
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      // Clear le cookie refresh côté serveur
      await axios.post(
        `${import.meta.env.VITE_API_URL || "/api"}/auth/logout`,
        {},
        { withCredentials: true },
      )
    } catch {
      // ignore
    }
    localStorage.removeItem("access_token")
    setUser(null)
  }, [])

  const isAuthenticated = !!user

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
