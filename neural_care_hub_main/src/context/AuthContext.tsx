import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User } from '../types'
import { getMe } from '../api/auth'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  isDoctor: boolean
  isPatient: boolean
  login: (token: string, user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Always verify session via server — httpOnly cookie is sent automatically.
    // sessionStorage token is a fallback for cross-origin dev (no proxy).
    getMe()
      .then(u => {
        const saved = sessionStorage.getItem('neuramed_token')
        setToken(saved)
        setUser(u)
      })
      .catch(() => {
        sessionStorage.removeItem('neuramed_token')
        sessionStorage.removeItem('neuramed_user')
        setToken(null)
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = (newToken: string, newUser: User) => {
    // sessionStorage — cleared on tab close, not shared across tabs
    sessionStorage.setItem('neuramed_token', newToken)
    sessionStorage.setItem('neuramed_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    sessionStorage.removeItem('neuramed_token')
    sessionStorage.removeItem('neuramed_user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user, token, isLoading,
      isAuthenticated: !!user,
      isDoctor: user?.role === 'doctor',
      isPatient: user?.role === 'patient',
      login, logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
