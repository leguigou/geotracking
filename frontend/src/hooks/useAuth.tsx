import { createContext, useContext, useState, type ReactNode } from "react"

interface AuthContextType {
  isAuthenticated: boolean
  user: { name: string; email: string } | null
  login: (email: string, password: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ name: string; email: string } | null>({
    name: "Alex Chen",
    email: "alex@agence.fr",
  })

  const isAuthenticated = !!user

  const login = (email: string, _password: string) => {
    setUser({ name: "Alex Chen", email })
  }

  const logout = () => {
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
