import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Bell, Menu } from 'lucide-react';

const TopBar = ({ onMenuClick }: { onMenuClick?: () => void }) => {
  const location = useLocation();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format page name from pathname
  const pathParts = location.pathname.split('/').filter(Boolean);
  const pageName = pathParts.length > 0
    ? pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1).replace('-', ' ')
    : 'Overview';

  return (
    <div style={{
      height: 56,
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
      padding: '0 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      {/* Left: Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button className="hamburger-btn" onClick={onMenuClick} style={{ display: 'none', background: 'transparent', border: 'none', color: 'var(--text)', marginRight: 16, padding: 0 }}>
          <Menu size={20} />
        </button>
        <div className="font-body" style={{ fontSize: 12 }}>
          <span style={{ color: 'var(--muted)' }}>NEURAMED / </span>
          <span style={{ color: 'var(--text)' }}>{pageName}</span>
        </div>
      </div>

      {/* Center: Search input */}
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--muted)'
        }} />
        <input
          placeholder="Search patient ID, conditions..."
          data-cursor="hover"
          style={{
            width: 320,
            height: 36,
            background: 'var(--elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '0 14px 0 38px',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--text)',
            outline: 'none',
            transition: 'all 200ms'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-glow)';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,229,255,0.08)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* Clock */}
        <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)' }}>
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>

        {/* Bell */}
        <div data-cursor="hover" style={{ position: 'relative', cursor: 'pointer' }}>
          <Bell size={18} style={{ color: 'var(--muted)' }} />
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--red)',
            position: 'absolute',
            top: -2,
            right: -2,
            border: '2px solid var(--bg)'
          }} />
        </div>

        {/* Live Pill */}
        <div style={{
          background: 'rgba(0,255,157,0.08)',
          border: '1px solid rgba(0,255,157,0.25)',
          color: 'var(--green)',
          fontFamily: 'var(--font-body)',
          fontSize: 10,
          padding: '4px 10px',
          borderRadius: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--green)',
            animation: 'pulse-dot 2s infinite'
          }} />
          LIVE
        </div>
      </div>
    </div>
  );
};

export default TopBar;
