import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Mic,
  ScanLine,
  FileSearch,
  Users,
  Calendar,
  Activity,
  Power,
  Pill,
  Globe,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { useAuth } from '../../context/AuthContext';

type NavItem = {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: ('doctor' | 'patient')[];
  badge?: boolean;
};

const ALL_NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard, roles: ['doctor', 'patient'] },
  { path: '/voice', label: 'Voice agent', icon: Mic, roles: ['doctor', 'patient'] },
  { path: '/voice/vernacular', label: 'Indian languages', icon: Globe, roles: ['doctor', 'patient'] },
  { path: '/imaging', label: 'Imaging AI', icon: ScanLine, roles: ['doctor', 'patient'] },
  { path: '/ocr', label: 'OCR reports', icon: FileSearch, roles: ['doctor', 'patient'] },
  { path: '/drug-interactions', label: 'Drug interactions', icon: Pill, roles: ['doctor', 'patient'] },
  { path: '/patients', label: 'Patients', icon: Users, roles: ['doctor'] },
  { path: '/appointments', label: 'Appointments', icon: Calendar, roles: ['doctor'] },
  { path: '/sessions', label: 'Sessions', icon: Activity, roles: ['doctor'], badge: true },
];

const Sidebar = ({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) => {
  const location = useLocation();
  const { user, logout, isDoctor } = useAuth();

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

  const renderNavItem = (item: NavItem) => {
    const isActive = item.path === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname.startsWith(item.path);
    const Icon = item.icon;
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={onClose}
        style={{
          height: 38,
          padding: '0 12px',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: 'inherit',
          fontSize: 13.5,
          fontWeight: isActive ? 500 : 400,
          letterSpacing: '-0.005em',
          textDecoration: 'none',
          position: 'relative',
          color: isActive ? 'var(--text)' : 'var(--muted)',
          background: isActive ? 'var(--accent-soft)' : 'transparent',
          transition: 'background 200ms var(--spring), color 200ms var(--spring)',
        }}
        onMouseEnter={e => {
          if (!isActive) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
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
        {/* Active accent rail — coral 2px stripe */}
        {isActive && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: -2,
              top: 8,
              bottom: 8,
              width: 2,
              borderRadius: 2,
              background: 'var(--accent)',
            }}
          />
        )}
        <Icon size={16} strokeWidth={1.75} style={{ color: isActive ? 'var(--accent)' : 'currentColor', flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{item.label}</span>
        {item.badge && sessionBadge > 0 && (
          <span
            style={{
              minWidth: 20,
              height: 18,
              padding: '0 6px',
              borderRadius: 999,
              background: isActive ? 'var(--accent)' : 'var(--elevated)',
              color: isActive ? 'var(--accent-on)' : 'var(--text)',
              border: isActive ? 'none' : '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono, "Geist Mono"), monospace',
              fontSize: 10,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {sessionBadge > 99 ? '99+' : sessionBadge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={`sidebar-container ${isOpen ? 'open' : ''}`}
      style={{
        width: 240,
        background: 'var(--canvas)',
        borderRight: '1px solid var(--border)',
        height: '100vh',
        position: 'fixed',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        transition: 'transform 320ms var(--spring)',
      }}
    >
      {/* Logo */}
      <div style={{ height: 64, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent) 0%, #FF8576 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px -4px rgba(255, 107, 91, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.20)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h4l3-9 4 18 3-9h4" />
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="font-heading" style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)' }}>
            Neuramed
          </span>
          <span style={{ fontSize: 10.5, color: 'var(--dim)', letterSpacing: '-0.01em' }}>Clinical AI</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 12px', flex: 1, overflowY: 'auto' }}>
        {commonItems.map(renderNavItem)}
        {isDoctor && doctorItems.length > 0 && (
          <>
            <div style={{ padding: '14px 12px 6px' }}>
              <span className="eyebrow" style={{ fontSize: 10 }}>Clinical</span>
            </div>
            {doctorItems.map(renderNavItem)}
          </>
        )}
      </nav>

      {/* User card / status */}
      <div style={{ borderTop: '1px solid var(--border)', padding: 12 }}>
        {user ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 12,
              background: 'var(--elevated)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              aria-hidden
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background:
                  user.role === 'doctor'
                    ? 'linear-gradient(135deg, var(--accent) 0%, #FF8576 100%)'
                    : 'linear-gradient(135deg, #4B5563 0%, #6B7280 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
              }}
            >
              {user.role === 'doctor' ? <Stethoscope size={15} strokeWidth={2} /> : <UserRound size={15} strokeWidth={2} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  letterSpacing: '-0.005em',
                }}
              >
                {user.full_name}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'capitalize' }}>{user.role}</div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'transparent',
                border: '1px solid transparent',
                color: 'var(--muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 180ms var(--spring)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(220, 77, 77, 0.10)';
                e.currentTarget.style.color = 'var(--red)';
                e.currentTarget.style.borderColor = 'rgba(220, 77, 77, 0.20)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--muted)';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              <Power size={13} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px' }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--green)',
                boxShadow: '0 0 0 3px rgba(63, 168, 108, 0.18)',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '-0.005em' }}>All systems online</span>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
