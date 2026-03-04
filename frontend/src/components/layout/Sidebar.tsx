import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Mic, ScanLine, FileSearch, Users, Calendar, Activity } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { path: '/voice', label: 'Voice Agent', icon: Mic },
  { path: '/imaging', label: 'Imaging AI', icon: ScanLine },
  { path: '/ocr', label: 'OCR Reports', icon: FileSearch },
  { path: '/patients', label: 'Patients', icon: Users },
  { path: '/appointments', label: 'Appointments', icon: Calendar },
  { path: '/sessions', label: 'Sessions', icon: Activity },
];

const Sidebar = ({ isOpen, onClose }: { isOpen?: boolean, onClose?: () => void }) => {
  const location = useLocation();

  return (
    <div className={`sidebar-container ${isOpen ? 'open' : ''}`} style={{
      width: 220,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      height: '100vh',
      position: 'fixed',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Logo */}
      <div style={{
        height: 64,
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="1.5">
          <polygon points="12 2 22 7 22 17 12 22 2 17 2 7 12 2" />
          <polyline points="6 12 10 12 12 6 14 18 16 12 18 12" stroke="var(--cyan)" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <span className="font-heading" style={{
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: '0.12em',
          color: 'var(--text)'
        }}>NEURAMED</span>
      </div>

      {/* Nav Items */}
      <nav style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '0 12px',
        marginTop: 24,
        flex: 1
      }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.path === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              data-cursor="hover"
              style={{
                height: 40,
                padding: '0 12px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                transition: 'all 200ms',
                textDecoration: 'none',
                color: isActive ? 'var(--text)' : 'var(--muted)',
                background: isActive ? 'rgba(0,229,255,0.07)' : 'transparent',
                boxShadow: isActive ? 'inset 2px 0 0 var(--cyan)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.color = 'var(--text)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--muted)';
                }
              }}
            >
              <Icon size={16} strokeWidth={1.5} style={{ color: isActive ? 'var(--cyan)' : 'currentColor' }} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Pinned */}
      <div style={{
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderTop: '1px solid var(--border)'
      }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--green)',
          animation: 'pulse-dot 2s infinite'
        }} />
        <span className="font-body" style={{
          fontSize: 10,
          color: 'var(--muted)',
          letterSpacing: '0.1em'
        }}>ALL SYSTEMS ONLINE</span>
      </div>
    </div>
  );
};

export default Sidebar;
