import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Mic, ScanLine, FileSearch, Users, Calendar, Activity, Power, Pill, Globe } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { useAuth } from '../../context/AuthContext';

const ALL_NAV_ITEMS = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard, roles: ['doctor', 'patient'] },
  { path: '/voice', label: 'Voice Agent', icon: Mic, roles: ['doctor', 'patient'] },
  { path: '/voice/vernacular', label: 'Indian Languages', icon: Globe, roles: ['doctor', 'patient'] },
  { path: '/imaging', label: 'Imaging AI', icon: ScanLine, roles: ['doctor', 'patient'] },
  { path: '/ocr', label: 'OCR Reports', icon: FileSearch, roles: ['doctor', 'patient'] },
  { path: '/drug-interactions', label: 'Drug Interactions', icon: Pill, roles: ['doctor', 'patient'] },
  { path: '/patients', label: 'Patients', icon: Users, roles: ['doctor'] },
  { path: '/appointments', label: 'Appointments', icon: Calendar, roles: ['doctor'] },
  { path: '/sessions', label: 'Sessions', icon: Activity, roles: ['doctor'], badge: true },
];

const Sidebar = ({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) => {
  const location = useLocation();
  const { user, logout, isDoctor } = useAuth();

  // Session count badge
  useEffect(() => {
    if (location.pathname.startsWith('/sessions')) {
      localStorage.setItem('neuramed-last-sessions-visit', new Date().toISOString());
    }
  }, [location.pathname]);

  const { data: sessionStats } = useQuery({
    queryKey: ['session-stats-badge'],
    queryFn: () => api.get('/api/sessions/stats').then(r => r.data),
    refetchInterval: 30000,
    enabled: isDoctor,
  });

  const sessionBadge = sessionStats?.today || 0;
  const navItems = ALL_NAV_ITEMS.filter(item => user && item.roles.includes(user.role));
  const commonItems = navItems.filter(item => item.roles.includes('patient'));
  const doctorItems = navItems.filter(item => !item.roles.includes('patient'));

  const renderNavItem = (item: typeof ALL_NAV_ITEMS[0]) => {
    const isActive = item.path === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(item.path);
    const Icon = item.icon;
    return (
      <Link key={item.path} to={item.path} onClick={onClose} data-cursor="hover"
        aria-current={isActive ? 'page' : undefined}
        style={{
          height: 42, padding: '0 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12,
          fontFamily: '"DM Mono", monospace', fontSize: 13, transition: 'all 250ms cubic-bezier(0.16, 1, 0.3, 1)',
          textDecoration: 'none', position: 'relative', overflow: 'hidden',
          color: isActive ? 'var(--text)' : 'var(--muted)',
          background: isActive ? 'linear-gradient(90deg, rgba(0,229,255,0.1) 0%, rgba(0,229,255,0.02) 100%)' : 'transparent',
        }}
        onMouseEnter={e => {
          if (!isActive) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
            e.currentTarget.style.color = 'var(--text)';
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--muted)';
          }
        }}
      >
        {/* Active left edge glow */}
        <div style={{
          position: 'absolute', left: 0, top: '15%', bottom: '15%', width: 2, borderRadius: 2,
          background: isActive ? 'var(--cyan)' : 'transparent',
          boxShadow: isActive ? '0 0 8px rgba(0,229,255,0.5)' : 'none',
          transition: 'all 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        }} />

        {/* Active shimmer sweep */}
        {isActive && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, transparent 0%, rgba(0,229,255,0.04) 50%, transparent 100%)',
            animation: 'shimmer-sweep 3s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}

        <Icon size={16} strokeWidth={1.5} style={{
          color: isActive ? 'var(--cyan)' : 'currentColor',
          filter: isActive ? 'drop-shadow(0 0 4px rgba(0,229,255,0.4))' : 'none',
          transition: 'all 250ms',
        }} />
        <span style={{ flex: 1 }}>{item.label}</span>

        {/* Active pulsing dot */}
        {isActive && (
          <div style={{
            width: 4, height: 4, borderRadius: '50%', background: 'var(--cyan)',
            animation: 'glow-pulse 2s ease-in-out infinite',
            boxShadow: '0 0 6px rgba(0,229,255,0.5)',
          }} />
        )}

        {item.badge && sessionBadge > 0 && !isActive && (
          <span style={{
            minWidth: 18, height: 18, borderRadius: 9, background: 'var(--red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: '#fff', padding: '0 4px',
            boxShadow: '0 0 8px rgba(255,59,92,0.3)',
          }}>
            {sessionBadge > 99 ? '99+' : sessionBadge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className={`sidebar-container ${isOpen ? 'open' : ''}`} style={{
      width: 220,
      background: 'linear-gradient(180deg, rgba(11,16,21,0.95) 0%, rgba(6,10,14,0.98) 100%)',
      backdropFilter: 'blur(20px) saturate(150%)',
      height: '100vh', position: 'fixed', display: 'flex', flexDirection: 'column', zIndex: 100,
      transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      {/* Right edge gradient glow line */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 1,
        background: 'linear-gradient(180deg, transparent 5%, rgba(0,229,255,0.15) 50%, transparent 95%)',
        animation: 'glow-pulse 3s ease-in-out infinite',
      }} />

      {/* Data stream dots on left edge */}
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{
          position: 'absolute', left: 0, top: 0, width: 2, height: 2, borderRadius: '50%',
          background: 'rgba(0,229,255,0.6)',
          animation: `data-stream ${3 + i * 0.7}s linear ${i * 0.6}s infinite`,
          zIndex: 1,
        }} />
      ))}

      {/* Logo */}
      <div style={{ height: 64, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="1.5"
          style={{ animation: 'breathe-hex 4s ease-in-out infinite' }}>
          <polygon points="12 2 22 7 22 17 12 22 2 17 2 7 12 2" />
          <polyline points="6 12 10 12 12 6 14 18 16 12 18 12" stroke="var(--cyan)" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <div>
          <span className="font-heading" style={{
            fontWeight: 700, fontSize: 14, letterSpacing: '0.12em',
            background: 'linear-gradient(135deg, #00E5FF 0%, #00FF9D 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>NEURAMED</span>
          <div style={{
            fontFamily: '"DM Mono", monospace', fontSize: 8, color: 'var(--dim)',
            letterSpacing: '0.25em', marginTop: 1,
          }}>AI CLINICAL</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px', marginTop: 24, flex: 1 }}>
        {commonItems.map(renderNavItem)}

        {isDoctor && doctorItems.length > 0 && (
          <>
            {/* Section separator with gradient */}
            <div style={{ margin: '14px 0 6px', position: 'relative' }}>
              <div style={{
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.15), transparent)',
              }} />
              <span style={{
                fontFamily: '"DM Mono", monospace', fontSize: 8, color: 'var(--dim)',
                letterSpacing: '0.18em', display: 'block', marginTop: 8, paddingLeft: 12,
              }}>
                CLINICAL MANAGEMENT
              </span>
            </div>
            {doctorItems.map(renderNavItem)}
          </>
        )}
      </nav>

      {/* Bottom — User card */}
      <div style={{
        borderTop: 'none',
        background: 'linear-gradient(180deg, transparent, rgba(0,229,255,0.02))',
      }}>
        {/* Full-width gradient separator */}
        <div style={{
          height: 1,
          background: 'linear-gradient(90deg, transparent 5%, rgba(0,229,255,0.2) 50%, transparent 95%)',
        }} />

        {user ? (
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Avatar with conic-gradient ring */}
            <div style={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
              background: `conic-gradient(from 0deg, ${user.role === 'doctor' ? 'var(--green)' : 'var(--cyan)'} 0%, ${user.role === 'doctor' ? 'var(--green)' : 'var(--cyan)'} 70%, rgba(255,255,255,0.05) 70%, rgba(255,255,255,0.05) 100%)`,
              padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 12px ${user.role === 'doctor' ? 'rgba(0,255,157,0.15)' : 'rgba(0,229,255,0.15)'}`,
            }}>
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%',
                background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16,
              }}>
                {user.avatar_emoji || user.full_name.charAt(0)}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="font-heading" style={{
                fontSize: 13, color: 'var(--text)', fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110,
              }}>
                {user.full_name}
              </div>
              <span style={{
                fontFamily: '"DM Mono", monospace', fontSize: 9, padding: '2px 8px', borderRadius: 10,
                background: user.role === 'doctor' ? 'rgba(0,255,157,0.08)' : 'rgba(0,229,255,0.08)',
                color: user.role === 'doctor' ? 'var(--green)' : 'var(--cyan)',
                border: `1px solid ${user.role === 'doctor' ? 'rgba(0,255,157,0.2)' : 'rgba(0,229,255,0.2)'}`,
              }}>
                {user.role === 'doctor' ? '👨‍⚕️ Doctor' : '🧑‍🦽 Patient'}
              </span>
            </div>
            <button onClick={logout} title="Sign out" aria-label="Log out" data-cursor="hover" style={{
              width: 44, height: 44, borderRadius: 6, background: 'transparent', border: 'none',
              color: 'rgba(255,255,255,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)', flexShrink: 0,
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,59,92,0.12)'; e.currentTarget.style.color = 'var(--red)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
            >
              <Power size={14} />
            </button>
          </div>
        ) : (
          <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse-dot 2s infinite' }} />
            <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em' }}>ALL SYSTEMS ONLINE</span>
          </div>
        )}
      </div>

      {/* Hex breathe keyframe — injected once */}
      <style>{`
        @keyframes breathe-hex {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(2deg); }
          75% { transform: rotate(-2deg); }
        }
      `}</style>
    </div>
  );
};

export default Sidebar;
