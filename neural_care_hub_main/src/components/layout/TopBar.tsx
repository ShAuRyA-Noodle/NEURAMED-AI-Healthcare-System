import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, Menu, X } from 'lucide-react';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';

const formatBreadcrumb = (path: string) => {
  if (!path) return 'Overview';
  return path.charAt(0).toUpperCase() + path.slice(1).replace('-', ' ');
};

const TopBar = ({ onMenuClick }: { onMenuClick?: () => void }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: searchResults, isLoading: isSearching } = useGlobalSearch(searchQuery);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowResults(false);
        setSearchQuery('');
      }
      // Cmd/Ctrl-K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const input = searchRef.current?.querySelector('input');
        input?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    setShowResults(false);
    setSearchQuery('');
  }, [location.pathname]);

  const pathParts = location.pathname.split('/').filter(Boolean);
  const pageName = formatBreadcrumb(pathParts[0] || '');

  const hasResults =
    searchResults &&
    (searchResults.patients.length > 0 ||
      searchResults.sessions.length > 0 ||
      searchResults.appointments.length > 0);

  return (
    <header
      style={{
        height: 56,
        background: 'rgba(10, 10, 11, 0.78)',
        backdropFilter: 'saturate(160%) blur(14px)',
        WebkitBackdropFilter: 'saturate(160%) blur(14px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 80,
      }}
    >
      {/* Left — breadcrumb + mobile menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          className="hamburger-btn"
          onClick={onMenuClick}
          aria-label="Open menu"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text)',
            width: 32,
            height: 32,
            borderRadius: 8,
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Menu size={18} strokeWidth={1.75} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span style={{ color: 'var(--muted)', letterSpacing: '-0.005em' }}>Neuramed</span>
          <span style={{ color: 'var(--dim)', fontSize: 11 }}>/</span>
          <span style={{ color: 'var(--text)', fontWeight: 500, letterSpacing: '-0.005em' }}>{pageName}</span>
        </div>
      </div>

      {/* Center — global search */}
      <div ref={searchRef} className="search-desktop" style={{ position: 'relative', flex: '1 1 480px', maxWidth: 480, margin: '0 24px' }}>
        <Search
          size={14}
          strokeWidth={1.75}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: searchFocused ? 'var(--accent)' : 'var(--muted)',
            transition: 'color 180ms var(--spring)',
            pointerEvents: 'none',
          }}
        />
        <input
          value={searchQuery}
          onChange={e => {
            setSearchQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => {
            if (searchQuery.length >= 2) setShowResults(true);
            setSearchFocused(true);
          }}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search patients, sessions, appointments…"
          style={{
            width: '100%',
            height: 36,
            background: 'var(--elevated)',
            border: `1px solid ${searchFocused ? 'rgba(255, 107, 91, 0.40)' : 'var(--border)'}`,
            borderRadius: showResults && hasResults ? '12px 12px 0 0' : 12,
            padding: '0 80px 0 36px',
            fontSize: 13,
            fontFamily: 'inherit',
            color: 'var(--text)',
            outline: 'none',
            boxShadow: searchFocused ? '0 0 0 4px rgba(255, 107, 91, 0.12)' : 'none',
            transition: 'border-color 180ms var(--spring), box-shadow 180ms var(--spring), border-radius 180ms var(--spring)',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setShowResults(false);
            }}
            aria-label="Clear search"
            style={{
              position: 'absolute',
              right: 38,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 22,
              height: 22,
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={13} strokeWidth={2} />
          </button>
        )}
        <kbd
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 10.5,
            fontFamily: 'var(--font-mono, "Geist Mono"), monospace',
            color: 'var(--muted)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 5,
            padding: '2px 5px',
            pointerEvents: 'none',
          }}
        >
          ⌘K
        </kbd>

        {/* Results */}
        {showResults && searchQuery.length >= 2 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderTop: 'none',
              borderRadius: '0 0 12px 12px',
              maxHeight: 420,
              overflowY: 'auto',
              boxShadow: 'var(--shadow-z3)',
              zIndex: 90,
            }}
          >
            {isSearching ? (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Searching…</span>
              </div>
            ) : !hasResults ? (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>No results.</span>
              </div>
            ) : (
              <>
                {searchResults!.patients.length > 0 && (
                  <SearchSection title="Patients">
                    {searchResults!.patients.map((p: any) => (
                      <SearchRow
                        key={p.id}
                        onClick={() => {
                          navigate('/patients');
                          setShowResults(false);
                          setSearchQuery('');
                        }}
                        left={<span className="font-mono" style={{ fontSize: 12.5, color: 'var(--accent)' }}>{p.patient_code}</span>}
                        right={<span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{p.age}yo · {p.gender}</span>}
                      />
                    ))}
                  </SearchSection>
                )}
                {searchResults!.sessions.length > 0 && (
                  <SearchSection title="Sessions">
                    {searchResults!.sessions.map((s: any) => (
                      <SearchRow
                        key={s.id}
                        onClick={() => {
                          navigate(`/sessions/${s.id}`);
                          setShowResults(false);
                          setSearchQuery('');
                        }}
                        left={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="font-mono" style={{ fontSize: 11.5, color: 'var(--dim)' }}>#{s.id}</span>
                            <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{s.patient_code}</span>
                            <span
                              style={{
                                fontSize: 10,
                                padding: '1px 7px',
                                borderRadius: 4,
                                background: 'var(--accent-soft)',
                                color: 'var(--accent)',
                                textTransform: 'capitalize',
                                fontFamily: 'var(--font-mono, "Geist Mono"), monospace',
                              }}
                            >
                              {s.agent_type}
                            </span>
                          </div>
                        }
                      />
                    ))}
                  </SearchSection>
                )}
                {searchResults!.appointments.length > 0 && (
                  <SearchSection title="Appointments">
                    {searchResults!.appointments.map((a: any) => (
                      <SearchRow
                        key={a.id}
                        onClick={() => {
                          navigate('/appointments');
                          setShowResults(false);
                          setSearchQuery('');
                        }}
                        left={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="font-mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{a.patient_code}</span>
                            <span style={{ fontSize: 12.5, color: 'var(--text)' }}>Dr. {a.doctor_name}</span>
                          </div>
                        }
                        right={
                          <span
                            style={{
                              fontSize: 10,
                              padding: '1px 7px',
                              borderRadius: 4,
                              background: a.status === 'scheduled' ? 'var(--accent-soft)' : 'rgba(63, 168, 108, 0.10)',
                              color: a.status === 'scheduled' ? 'var(--accent)' : 'var(--green)',
                              textTransform: 'capitalize',
                              fontFamily: 'var(--font-mono, "Geist Mono"), monospace',
                            }}
                          >
                            {a.status}
                          </span>
                        }
                      />
                    ))}
                  </SearchSection>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Right — bell + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          aria-label="Notifications"
          style={{
            position: 'relative',
            width: 34,
            height: 34,
            borderRadius: 9,
            background: 'transparent',
            border: '1px solid transparent',
            color: 'var(--muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 180ms var(--spring)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--elevated)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.color = 'var(--muted)';
          }}
        >
          <Bell size={16} strokeWidth={1.75} />
          <span
            style={{
              position: 'absolute',
              top: 7,
              right: 8,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent)',
              border: '2px solid var(--bg)',
            }}
          />
        </button>
        <div
          className="hide-mobile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 10px 5px 8px',
            borderRadius: 999,
            background: 'rgba(63, 168, 108, 0.08)',
            border: '1px solid rgba(63, 168, 108, 0.18)',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--green)',
              boxShadow: '0 0 0 3px rgba(63, 168, 108, 0.20)',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--green)', letterSpacing: '-0.005em', fontWeight: 500 }}>Live</span>
        </div>
      </div>
    </header>
  );
};

const SearchSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
      <span className="eyebrow" style={{ fontSize: 9.5 }}>{title}</span>
    </div>
    {children}
  </div>
);

const SearchRow = ({ onClick, left, right }: { onClick: () => void; left: React.ReactNode; right?: React.ReactNode }) => (
  <button
    onClick={onClick}
    style={{
      width: '100%',
      padding: '9px 14px',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      transition: 'background 140ms ease',
      color: 'inherit',
      textAlign: 'left',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-soft)')}
    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
  >
    <div style={{ minWidth: 0, flex: 1 }}>{left}</div>
    {right}
  </button>
);

export default TopBar;
