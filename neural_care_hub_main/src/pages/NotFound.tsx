import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 160px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: 40,
      }}
    >
      <span className="eyebrow" style={{ fontSize: 11 }}>Error 404</span>
      <h1
        className="font-heading"
        style={{
          fontSize: 56,
          fontWeight: 600,
          color: 'var(--text)',
          margin: 0,
          letterSpacing: '-0.04em',
        }}
      >
        Page not found.
      </h1>
      <p
        style={{
          fontSize: 14,
          color: 'var(--muted)',
          textAlign: 'center',
          maxWidth: 460,
          lineHeight: 1.55,
          margin: 0,
        }}
      >
        The route you are looking for has moved, been renamed, or never existed.
      </p>
      <button
        onClick={() => navigate('/dashboard')}
        className="btn-primary"
        style={{
          marginTop: 8,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
        }}
      >
        <ArrowLeft size={14} strokeWidth={2} />
        Back to dashboard
      </button>
    </div>
  );
};

export default NotFound;
