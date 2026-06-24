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

  // Vérifier le token au mount — tenter un refresh si besoin
  useEffect(() => {
    const token = localStorage.getItem("access_token")
    const refreshToken = localStorage.getItem("refresh_token")

    if (!token && !refreshToken) {
      setLoading(false)
      return
    }

    const tryAuth = async () => {
      // Si on a un token, essayer /me
      if (token) {
        try {
          const data = await apiMe()
          setUser(data)
          setLoading(false)
          return
        } catch {
          // Token expiré → on continue pour tenter le refresh
        }
      }

      // Tenter un refresh avec le refresh_token
      if (refreshToken) {
        try {
          const res = await axios.post(
            "https://geotrack.deloffre.fr/api/auth/refresh",
            { refresh_token: refreshToken },
          )
          const { access_token, refresh_token: newRefresh } = res.data
          localStorage.setItem("access_token", access_token)
          if (newRefresh) localStorage.setItem("refresh_token", newRefresh)

          const data = await apiMe()
          setUser(data)
        } catch {
          // Refresh échoué → nettoyage
          localStorage.removeItem("access_token")
          localStorage.removeItem("refresh_token")
        }
      } else {
        localStorage.removeItem("access_token")
      }

      setLoading(false)
    }

    tryAuth()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password)
    localStorage.setItem("access_token", data.access_token)
    localStorage.setItem("refresh_token", data.refresh_token)
    const meData = await apiMe()
    setUser(meData)
  }, [])

  const register = useCallback(
    async (email: string, password: string, full_name: string, organization_name: string) => {
      const data = await apiRegister(email, password, full_name, organization_name)
      localStorage.setItem("access_token", data.access_token)
      localStorage.setItem("refresh_token", data.refresh_token)
      const meData = await apiMe()
      setUser(meData)
    },
    [],
  )

  const logout = useCallback(() => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    setUser(null)
  }, [])

  const isAuthenticated = !!user

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
