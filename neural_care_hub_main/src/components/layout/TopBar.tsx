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

  return (
    <div style={{
      height: 56, background: 'var(--bg)', borderBottom: '1px solid var(--border)',
      padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button className="hamburger-btn" onClick={onMenuClick} style={{
          background: 'transparent', border: 'none', color: 'var(--text)', marginRight: 16, padding: 4, cursor: 'pointer',
          display: 'none' /* shown via CSS media query */
        }}>
          <Menu size={20} />
        </button>
        <div className="font-body" style={{ fontSize: 12 }}>
          <span style={{ color: 'var(--muted)' }}>NEURAMED / </span>
          <span style={{ color: 'var(--text)' }}>{pageName}</span>
        </div>
      </div>

      {/* Center: Global Search (hidden on mobile) */}
      <div ref={searchRef} className="search-desktop" style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', zIndex: 1 }} />
        <input
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setShowResults(true); }}
          onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
          placeholder="Search patients, sessions, appointments..."
          data-cursor="hover"
          style={{
            width: 360, height: 36, background: 'var(--elevated)', border: '1px solid var(--border)',
            borderRadius: showResults && hasResults ? '8px 8px 0 0' : 8,
            padding: '0 14px 0 38px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', transition: 'all 200ms'
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
            position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)',
            border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px',
            maxHeight: 400, overflowY: 'auto', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
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
                    <div style={{ padding: '8px 14px', background: 'var(--elevated)' }}>
                      <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em' }}>PATIENTS</span>
                    </div>
                    {searchResults.patients.map((p: any) => (
                      <div key={p.id} data-cursor="hover"
                        onClick={() => { navigate('/patients'); setShowResults(false); setSearchQuery(''); }}
                        style={{ padding: '10px 14px', cursor: 'pointer', transition: 'background 150ms', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span className="font-number" style={{ fontSize: 13, color: 'var(--cyan)' }}>{p.patient_code}</span>
                        <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>{p.age}yo · {p.gender}</span>
                      </div>
                    ))}
                  </div>
                )}
                {searchResults.sessions.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 14px', background: 'var(--elevated)' }}>
                      <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em' }}>SESSIONS</span>
                    </div>
                    {searchResults.sessions.map((s: any) => (
                      <div key={s.id} data-cursor="hover"
                        onClick={() => { navigate(`/sessions/${s.id}`); setShowResults(false); setSearchQuery(''); }}
                        style={{ padding: '10px 14px', cursor: 'pointer', transition: 'background 150ms', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="font-number" style={{ fontSize: 12, color: 'var(--dim)' }}>#{s.id}</span>
                          <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>{s.patient_code}</span>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(0,229,255,0.08)', color: 'var(--cyan)', fontFamily: 'var(--font-body)', textTransform: 'capitalize' }}>{s.agent_type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {searchResults.appointments.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 14px', background: 'var(--elevated)' }}>
                      <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em' }}>APPOINTMENTS</span>
                    </div>
                    {searchResults.appointments.map((a: any) => (
                      <div key={a.id} data-cursor="hover"
                        onClick={() => { navigate('/appointments'); setShowResults(false); setSearchQuery(''); }}
                        style={{ padding: '10px 14px', cursor: 'pointer', transition: 'background 150ms', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="font-number" style={{ fontSize: 12, color: 'var(--cyan)' }}>{a.patient_code}</span>
                          <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>Dr. {a.doctor_name}</span>
                        </div>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: a.status === 'scheduled' ? 'rgba(0,229,255,0.08)' : 'rgba(0,255,157,0.08)', color: a.status === 'scheduled' ? 'var(--cyan)' : 'var(--green)', fontFamily: 'var(--font-body)', textTransform: 'capitalize' }}>{a.status}</span>
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
        <span className="font-body hide-mobile" style={{ fontSize: 12, color: 'var(--muted)' }}>
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <div data-cursor="hover" style={{ position: 'relative', cursor: 'pointer' }}>
          <Bell size={18} style={{ color: 'var(--muted)' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', position: 'absolute', top: -2, right: -2, border: '2px solid var(--bg)' }} />
        </div>
        <div className="hide-mobile" style={{
          background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.25)',
          color: 'var(--green)', fontFamily: 'var(--font-body)', fontSize: 10,
          padding: '4px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', animation: 'pulse-dot 2s infinite' }} />
          LIVE
        </div>
      </div>
    </div>
  );
};

export default TopBar;
