import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Mic, ScanLine, FileSearch, Users, Calendar, Activity, Power } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { useAuth } from '../../context/AuthContext';

const ALL_NAV_ITEMS = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard, roles: ['doctor', 'patient'] },
  { path: '/voice', label: 'Voice Agent', icon: Mic, roles: ['doctor', 'patient'] },
  { path: '/imaging', label: 'Imaging AI', icon: ScanLine, roles: ['doctor', 'patient'] },
  { path: '/ocr', label: 'OCR Reports', icon: FileSearch, roles: ['doctor', 'patient'] },
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
        style={{
          height: 40, padding: '0 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12,
          fontFamily: 'var(--font-body)', fontSize: 13, transition: 'all 200ms', textDecoration: 'none',
          color: isActive ? 'var(--text)' : 'var(--muted)',
          background: isActive ? 'rgba(0,229,255,0.07)' : 'transparent',
          boxShadow: isActive ? 'inset 2px 0 0 var(--cyan)' : 'none'
        }}
        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'var(--text)'; } }}
        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; } }}
      >
        <Icon size={16} strokeWidth={1.5} style={{ color: isActive ? 'var(--cyan)' : 'currentColor' }} />
        <span style={{ flex: 1 }}>{item.label}</span>
        {item.badge && sessionBadge > 0 && !isActive && (
          <span style={{
            minWidth: 18, height: 18, borderRadius: 9, background: 'var(--red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-number)', fontSize: 10, color: '#fff', padding: '0 4px'
          }}>
            {sessionBadge > 99 ? '99+' : sessionBadge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className={`sidebar-container ${isOpen ? 'open' : ''}`} style={{
      width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)',
      height: '100vh', position: 'fixed', display: 'flex', flexDirection: 'column', zIndex: 100,
      transition: 'transform 300ms ease'
    }}>
      {/* Logo */}
      <div style={{ height: 64, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="1.5">
          <polygon points="12 2 22 7 22 17 12 22 2 17 2 7 12 2" />
          <polyline points="6 12 10 12 12 6 14 18 16 12 18 12" stroke="var(--cyan)" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <span className="font-heading" style={{ fontWeight: 700, fontSize: 14, letterSpacing: '0.12em', color: 'var(--text)' }}>NEURAMED</span>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px', marginTop: 24, flex: 1 }}>
        {commonItems.map(renderNavItem)}

        {isDoctor && doctorItems.length > 0 && (
          <>
            <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
            <span className="font-body" style={{ fontSize: 9, color: 'var(--muted)', paddingLeft: 12, letterSpacing: '0.1em', marginBottom: 4 }}>
              CLINICAL MANAGEMENT
            </span>
            {doctorItems.map(renderNavItem)}
          </>
        )}
      </nav>

      {/* Bottom — User card */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        {user ? (
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0
            }}>
              {user.avatar_emoji || user.full_name.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="font-heading" style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                {user.full_name}
              </div>
              <span style={{
                fontFamily: '"DM Mono", monospace', fontSize: 9, padding: '2px 8px', borderRadius: 10,
                background: user.role === 'doctor' ? 'rgba(0,255,157,0.08)' : 'rgba(0,229,255,0.08)',
                color: user.role === 'doctor' ? 'var(--green)' : 'var(--cyan)',
                border: `1px solid ${user.role === 'doctor' ? 'rgba(0,255,157,0.2)' : 'rgba(0,229,255,0.2)'}`
              }}>
                {user.role === 'doctor' ? '👨‍⚕️ Doctor' : '🧑‍🦽 Patient'}
              </span>
            </div>
            <button onClick={logout} title="Sign out" data-cursor="hover" style={{
              width: 28, height: 28, borderRadius: 6, background: 'transparent', border: 'none',
              color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 200ms', flexShrink: 0
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,59,92,0.1)'; e.currentTarget.style.color = 'var(--red)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
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
    </div>
  );
};

export default Sidebar;
