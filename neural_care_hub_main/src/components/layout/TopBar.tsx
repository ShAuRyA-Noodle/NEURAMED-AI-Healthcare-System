import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, Menu, X } from 'lucide-react';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';

const TopBar = ({ onMenuClick }: { onMenuClick?: () => void }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: searchResults, isLoading: isSearching } = useGlobalSearch(searchQuery);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowResults(false); setSearchQuery(''); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    setShowResults(false);
    setSearchQuery('');
  }, [location.pathname]);

  const pathParts = location.pathname.split('/').filter(Boolean);
  const pageName = pathParts.length > 0
    ? pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1).replace('-', ' ')
    : 'Overview';

  const hasResults = searchResults && (
    searchResults.patients.length > 0 ||
    searchResults.sessions.length > 0 ||
    searchResults.appointments.length > 0
  );

  // Clock with blinking colon
  const hours = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).split(':')[0];
  const minutes = time.toLocaleTimeString([], { minute: '2-digit' }).padStart(2, '0');
  const seconds = time.getSeconds().toString().padStart(2, '0');
  const colonVisible = time.getMilliseconds() < 500;

  return (
    <div style={{
      height: 56,
      background: 'rgba(2, 6, 8, 0.85)',
      backdropFilter: 'blur(20px) saturate(160%)',
      padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'relative',
    }}>
      {/* Bottom gradient edge */}
      <div style={{
        position: 'absolute', bottom: 0, left: '10%', right: '10%', height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.12), transparent)',
      }} />

      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button className="hamburger-btn" onClick={onMenuClick} style={{
          background: 'transparent', border: 'none', color: 'var(--text)', marginRight: 16, padding: 4, cursor: 'pointer',
          display: 'none' /* shown via CSS media query */
        }}>
          <Menu size={20} />
        </button>
        <div className="font-body" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'var(--dim)' }}>NEURAMED</span>
          <span style={{ color: 'var(--dim)', fontSize: 10 }}>›</span>
          <span style={{ color: 'var(--text)', letterSpacing: '0.05em' }}>{pageName}</span>
        </div>
      </div>

      {/* Center: Global Search (hidden on mobile) */}
      <div ref={searchRef} className="search-desktop" style={{ position: 'relative' }}>
        <Search size={14} style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          color: searchFocused ? 'var(--cyan)' : 'var(--muted)', zIndex: 1,
          transition: 'color 200ms',
        }} />
        <input
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setShowResults(true); }}
          onFocus={() => { searchQuery.length >= 2 && setShowResults(true); setSearchFocused(true); }}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search patients, sessions, appointments..."
          data-cursor="hover"
          style={{
            width: searchFocused ? 440 : 360,
            height: 36,
            background: 'rgba(19, 28, 34, 0.6)',
            border: `1px solid ${searchFocused ? 'rgba(0,229,255,0.25)' : 'var(--border)'}`,
            borderRadius: showResults && hasResults ? '18px 18px 0 0' : 18,
            padding: '0 14px 0 38px', fontFamily: '"DM Mono", monospace', fontSize: 12,
            color: 'var(--text)', outline: 'none',
            transition: 'all 250ms cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: searchFocused ? '0 0 0 3px rgba(0,229,255,0.06), inset 0 1px 4px rgba(0,0,0,0.3)' : 'none',
          }}
          onKeyDown={e => { if (e.key === 'Escape') { setShowResults(false); setSearchQuery(''); (e.target as HTMLInputElement).blur(); } }}
        />
        {searchQuery && (
          <button onClick={() => { setSearchQuery(''); setShowResults(false); }} style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 2
          }}>
            <X size={14} />
          </button>
        )}

        {/* Search Results Dropdown */}
        {showResults && searchQuery.length >= 2 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: 'rgba(11, 16, 21, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(0,229,255,0.1)', borderTop: 'none',
            borderRadius: '0 0 12px 12px',
            maxHeight: 400, overflowY: 'auto', zIndex: 100,
            boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,229,255,0.03)',
          }}>
            {isSearching ? (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)' }}>Searching...</span>
              </div>
            ) : !hasResults ? (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)' }}>No results found</span>
              </div>
            ) : (
              <>
                {searchResults.patients.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 14px', background: 'rgba(19,28,34,0.5)' }}>
                      <span className="font-body" style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '0.15em' }}>PATIENTS</span>
                    </div>
                    {searchResults.patients.map((p: any) => (
                      <div key={p.id} data-cursor="hover"
                        onClick={() => { navigate('/patients'); setShowResults(false); setSearchQuery(''); }}
                        style={{ padding: '10px 14px', cursor: 'pointer', transition: 'background 150ms', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span className="font-number" style={{ fontSize: 13, color: 'var(--cyan)' }}>{p.patient_code}</span>
                        <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>{p.age}yo · {p.gender}</span>
                      </div>
                    ))}
                  </div>
                )}
                {searchResults.sessions.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 14px', background: 'rgba(19,28,34,0.5)' }}>
                      <span className="font-body" style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '0.15em' }}>SESSIONS</span>
                    </div>
                    {searchResults.sessions.map((s: any) => (
                      <div key={s.id} data-cursor="hover"
                        onClick={() => { navigate(`/sessions/${s.id}`); setShowResults(false); setSearchQuery(''); }}
                        style={{ padding: '10px 14px', cursor: 'pointer', transition: 'background 150ms', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="font-number" style={{ fontSize: 12, color: 'var(--dim)' }}>#{s.id}</span>
                          <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>{s.patient_code}</span>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(0,229,255,0.08)', color: 'var(--cyan)', fontFamily: '"DM Mono", monospace', textTransform: 'capitalize' }}>{s.agent_type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {searchResults.appointments.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 14px', background: 'rgba(19,28,34,0.5)' }}>
                      <span className="font-body" style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '0.15em' }}>APPOINTMENTS</span>
                    </div>
                    {searchResults.appointments.map((a: any) => (
                      <div key={a.id} data-cursor="hover"
                        onClick={() => { navigate('/appointments'); setShowResults(false); setSearchQuery(''); }}
                        style={{ padding: '10px 14px', cursor: 'pointer', transition: 'background 150ms', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="font-number" style={{ fontSize: 12, color: 'var(--cyan)' }}>{a.patient_code}</span>
                          <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>Dr. {a.doctor_name}</span>
                        </div>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: a.status === 'scheduled' ? 'rgba(0,229,255,0.08)' : 'rgba(0,255,157,0.08)', color: a.status === 'scheduled' ? 'var(--cyan)' : 'var(--green)', fontFamily: '"DM Mono", monospace', textTransform: 'capitalize' }}>{a.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* Clock with blinking colon */}
        <span className="font-number hide-mobile" style={{ fontSize: 13, color: 'rgba(0,229,255,0.6)', letterSpacing: '0.05em' }}>
          {hours}<span style={{ opacity: colonVisible ? 1 : 0 }}>:</span>{minutes}<span style={{ opacity: colonVisible ? 0.5 : 0, fontSize: 11 }}>:{seconds}</span>
        </span>

        <div data-cursor="hover" style={{ position: 'relative', cursor: 'pointer' }}>
          <Bell size={18} style={{ color: 'var(--muted)', transition: 'color 200ms' }} />
          <div style={{
            width: 7, height: 7, borderRadius: '50%', background: 'var(--red)',
            position: 'absolute', top: -2, right: -2, border: '2px solid var(--bg)',
            boxShadow: '0 0 6px rgba(255,59,92,0.4)',
          }} />
        </div>

        {/* LIVE pill with pulsing dot */}
        <div className="hide-mobile" style={{
          background: 'rgba(0,255,157,0.06)',
          border: '1px solid rgba(0,255,157,0.2)',
          color: 'var(--green)', fontFamily: '"DM Mono", monospace', fontSize: 10,
          padding: '4px 12px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6,
          animation: 'border-breathe-green 1.5s ease-in-out infinite',
          letterSpacing: '0.1em',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--green)',
            animation: 'glow-pulse 1.5s ease-in-out infinite',
            boxShadow: '0 0 6px rgba(0,255,157,0.5)',
          }} />
          LIVE
        </div>
      </div>

      <style>{`
        @keyframes border-breathe-green {
          0%, 100% { border-color: rgba(0,255,157,0.15); }
          50% { border-color: rgba(0,255,157,0.35); }
        }
      `}</style>
    </div>
  );
};

export default TopBar;
