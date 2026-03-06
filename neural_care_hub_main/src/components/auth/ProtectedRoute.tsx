import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

interface Props {
  children: React.ReactNode
  requireRole?: 'doctor' | 'patient' | 'any'
}

export default function ProtectedRoute({ children, requireRole = 'any' }: Props) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#020608'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏥</div>
          <p style={{ fontFamily: 'Orbitron, sans-serif', color: '#00E5FF', fontSize: 14, letterSpacing: '0.2em' }}>NEURAMED</p>
          <p style={{ fontFamily: '"DM Mono", monospace', color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 8 }}>Authenticating...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireRole === 'doctor' && user?.role !== 'doctor') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
