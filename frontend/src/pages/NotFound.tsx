import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
      <span className="font-heading" style={{ fontSize: 48, color: 'var(--text)', textAlign: 'center', fontWeight: 800, textShadow: '0 0 20px rgba(0,229,255,0.2)' }}>
        404 — PAGE NOT FOUND
      </span>
      <span className="font-body" style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center', maxWidth: 400 }}>
        The terminal route you specified does not exist in the mainframe.
      </span>
      <button data-cursor="hover" onClick={() => navigate('/dashboard')} style={{
        height: 44, padding: '0 24px', borderRadius: 8, background: 'var(--cyan)', color: '#000', border: 'none',
        fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, marginTop: 16
      }}>
        Return to Dashboard
      </button>
    </div>
  );
};

export default NotFound;
