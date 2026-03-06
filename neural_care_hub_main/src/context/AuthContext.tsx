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
    const savedToken = localStorage.getItem('neuramed_token')
    const savedUser = localStorage.getItem('neuramed_user')
    if (savedToken && savedUser) {
      setToken(savedToken)
      try { setUser(JSON.parse(savedUser)) } catch { /* ignore */ }
      // Verify token still valid
      getMe().then(u => {
        setUser(u)
        localStorage.setItem('neuramed_user', JSON.stringify(u))
      }).catch(() => {
        localStorage.removeItem('neuramed_token')
        localStorage.removeItem('neuramed_user')
        setToken(null)
        setUser(null)
      }).finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const loginFn = (newToken: string, newUser: User) => {
    localStorage.setItem('neuramed_token', newToken)
    localStorage.setItem('neuramed_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem('neuramed_token')
    localStorage.removeItem('neuramed_user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user, token, isLoading,
      isAuthenticated: !!token && !!user,
      isDoctor: user?.role === 'doctor',
      isPatient: user?.role === 'patient',
      login: loginFn, logout
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
