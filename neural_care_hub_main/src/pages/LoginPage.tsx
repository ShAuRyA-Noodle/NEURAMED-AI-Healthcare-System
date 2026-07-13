import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin, register as apiRegister } from '../api/auth';
import LoginCursor from '../components/cursor/LoginCursor';
import { useToast } from '@/hooks/useToast';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

// ─── PASSWORD STRENGTH ───
const STRENGTH_LABELS = [
  'Insufficient — not suitable for medical data',
  'Weak — add uppercase and numbers',
  'Adequate — add special characters',
  'Strong — meets medical data standards',
];
const STRENGTH_COLORS = ['#FF3B5C', '#FF9500', '#00E5FF', '#00FF9D'];

const getStrength = (p: string) => {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  if (p.length >= 12 && s >= 3) s++;
  return s;
};

// ─── SPECIALIZATIONS ───
const SPECIALIZATIONS = [
  'General Practice', 'Internal Medicine', 'Cardiology', 'Neurology', 'Orthopedics',
  'Pediatrics', 'Dermatology', 'Radiology', 'Psychiatry', 'Surgery',
  'Ophthalmology', 'ENT', 'Oncology', 'Pulmonology', 'Gastroenterology',
  'Nephrology', 'Endocrinology', 'Rheumatology', 'Urology', 'Anesthesiology',
];

// ─── MINI THREE.JS SCENES FOR ROLE CARDS ───
const useMiniScene = (canvasRef: React.RefObject<HTMLCanvasElement | null>, type: 'doctor' | 'patient', isActive: boolean) => {
  const reducedMotion = usePrefersReducedMotion();
  // Track selection without re-creating the WebGL context on every toggle.
  const activeRef = useRef(isActive);
  useEffect(() => { activeRef.current = isActive; }, [isActive]);

  useEffect(() => {
    // Don't spin up a WebGL context on phones or when reduced motion is requested.
    if (typeof window !== 'undefined' && (window.innerWidth < 768 || reducedMotion)) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.z = 3;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    let mesh: THREE.Object3D;
    let material: THREE.Material;

    if (type === 'doctor') {
      // Wireframe Icosahedron
      const geo = new THREE.IcosahedronGeometry(0.9, 1);
      const mat = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true });
      material = mat;
      mesh = new THREE.Mesh(geo, mat);
    } else {
      // Heartbeat sine wave ring
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 120; i++) {
        const angle = (i / 120) * Math.PI * 2;
        const r = 0.8 + Math.sin(angle * 8) * 0.08;
        pts.push(new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle) * r, 0));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ transparent: true });
      material = mat;
      mesh = new THREE.Line(geo, mat);
    }

    scene.add(mesh);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      // Read the latest selection each frame so color/opacity update without
      // re-initialising the scene (isActive is intentionally out of the deps).
      const active = activeRef.current;
      if (type === 'doctor') {
        (material as THREE.MeshBasicMaterial).color.setHex(active ? 0x00FF9D : 0x00E5FF);
        material.opacity = active ? 0.6 : 0.25;
      } else {
        (material as THREE.LineBasicMaterial).color.setHex(0x00E5FF);
        material.opacity = active ? 0.7 : 0.25;
      }
      mesh.rotation.y += type === 'doctor' ? 0.008 : 0.004;
      mesh.rotation.x += type === 'doctor' ? 0.004 : 0.002;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      // Dispose every geometry + material in the scene, then the renderer, so
      // toggling / unmounting doesn't leak GPU buffers or WebGL contexts.
      scene.traverse((obj) => {
        const withGeo = obj as THREE.Mesh;
        if (withGeo.geometry) withGeo.geometry.dispose();
        const mat = (obj as THREE.Mesh).material;
        if (mat) {
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      renderer.dispose();
    };
  }, [canvasRef, type, reducedMotion]);
};

// ─── ROLE CARD ───
const RoleCard = ({ type, selected, onSelect }: { type: 'doctor' | 'patient'; selected: boolean; onSelect: () => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useMiniScene(canvasRef, type, selected);

  const isDoctor = type === 'doctor';
  return (
    <button onClick={onSelect} style={{
      flex: 1, padding: 0, borderRadius: 14, cursor: 'pointer', overflow: 'hidden',
      background: selected ? (isDoctor ? 'rgba(0,255,157,0.06)' : 'rgba(0,229,255,0.06)') : 'rgba(255,255,255,0.02)',
      border: selected ? `1.5px solid ${isDoctor ? '#00FF9D' : '#00E5FF'}` : '1px solid rgba(255,255,255,0.08)',
      textAlign: 'center', transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)', position: 'relative',
      boxShadow: selected ? `0 0 20px ${isDoctor ? 'rgba(0,255,157,0.15)' : 'rgba(0,229,255,0.15)'}` : 'none',
    }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: 80, display: 'block' }} width={200} height={80} />
      <div style={{ padding: '8px 12px 14px' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#EEF2F7' }}>
          {isDoctor ? 'Doctor' : 'Patient'}
        </div>
        <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: '#445566', marginTop: 2 }}>
          {isDoctor ? 'Full clinical access' : 'Access diagnosis tools'}
        </div>
      </div>
      {isDoctor && (
        <span style={{
          position: 'absolute', top: 6, right: 6,
          background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.3)',
          fontFamily: '"DM Mono", monospace', fontSize: 9, color: '#FF9500',
          padding: '2px 8px', borderRadius: 10,
        }}>INVITE</span>
      )}
    </button>
  );
};

// ─── BIOMETRIC SCAN ANIMATION ───
const BiometricLoader = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0' }}>
    <div style={{ position: 'relative', width: 80, height: 80 }}>
      {/* Outer spinning ring */}
      <svg width="80" height="80" viewBox="0 0 80 80" style={{ position: 'absolute', animation: 'biometric-spin 2s linear infinite' }}>
        <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(0,229,255,0.15)" strokeWidth="1.5" />
        <circle cx="40" cy="40" r="36" fill="none" stroke="#00E5FF" strokeWidth="1.5"
          strokeDasharray="60 166" strokeLinecap="round" />
      </svg>
      {/* Inner hexagon */}
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="1.2"
        style={{ position: 'absolute', top: 16, left: 16, animation: 'breathe-hex 2s ease-in-out infinite' }}>
        <polygon points="12 2 22 7 22 17 12 22 2 17 2 7 12 2" />
        <polyline points="6 12 10 12 12 6 14 18 16 12 18 12" stroke="#00E5FF" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
      {/* Scan line */}
      <div style={{
        position: 'absolute', left: 10, right: 10, height: 2,
        background: 'linear-gradient(90deg, transparent, #00E5FF, transparent)',
        animation: 'scan-sweep 1.5s ease-in-out infinite',
        boxShadow: '0 0 12px rgba(0,229,255,0.6)',
      }} />
    </div>
    <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: '#00E5FF', letterSpacing: '0.15em' }}>
      AUTHENTICATING...
    </span>
    <div style={{ display: 'flex', gap: 4 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{
          width: 4, height: 4, borderRadius: '50%', background: '#00E5FF',
          animation: `pulse-dot 1.2s ease-in-out ${i * 0.15}s infinite`,
        }} />
      ))}
    </div>
  </div>
);

// ─── DOCTOR CREDENTIALS STEP ───
const DoctorCredentialsStep = ({ credentials, setCredentials, onBack, onSubmit }: {
  credentials: { license: string; specialization: string; hospital: string; yearsOfPractice: number };
  setCredentials: (c: any) => void;
  onBack: () => void;
  onSubmit: () => void;
}) => {
  const inputStyle: React.CSSProperties = {
    width: '100%', height: 48, background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    fontFamily: '"DM Mono", monospace', fontSize: 13, padding: '0 16px', color: '#EEF2F7',
    outline: 'none', transition: 'all 200ms', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: '"DM Mono", monospace', fontSize: 11, color: '#445566', marginBottom: 6, display: 'block',
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 28 }}>🩺</div>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: '#EEF2F7', marginTop: 6, marginBottom: 4 }}>
          Verify your medical credentials
        </h3>
        <p style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: '#445566' }}>
          Required for clinical platform access
        </p>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Medical License Number</label>
        <input value={credentials.license} onChange={e => setCredentials({ ...credentials, license: e.target.value })}
          placeholder="e.g. MCI-12345"
          style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '0.08em' }}
          onFocus={e => { e.target.style.borderColor = '#00FF9D'; e.target.style.boxShadow = '0 0 0 3px rgba(0,255,157,0.1)'; }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Specialization</label>
        <select value={credentials.specialization}
          onChange={e => setCredentials({ ...credentials, specialization: e.target.value })}
          style={{
            ...inputStyle, cursor: 'pointer', appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23445566' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center',
          }}
          onFocus={e => { e.target.style.borderColor = '#00FF9D'; e.target.style.boxShadow = '0 0 0 3px rgba(0,255,157,0.1)'; }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
        >
          <option value="" style={{ background: '#0B1015', color: '#445566' }}>Select specialization</option>
          {SPECIALIZATIONS.map(s => (
            <option key={s} value={s} style={{ background: '#0B1015', color: '#EEF2F7' }}>{s}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Hospital / Clinic Name</label>
        <input value={credentials.hospital} onChange={e => setCredentials({ ...credentials, hospital: e.target.value })}
          style={inputStyle}
          onFocus={e => { e.target.style.borderColor = '#00FF9D'; e.target.style.boxShadow = '0 0 0 3px rgba(0,255,157,0.1)'; }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Years of Practice: <span style={{ color: '#00FF9D', fontWeight: 600 }}>{credentials.yearsOfPractice}</span></label>
        <input type="range" min={0} max={50} value={credentials.yearsOfPractice}
          onChange={e => setCredentials({ ...credentials, yearsOfPractice: parseInt(e.target.value) })}
          style={{ width: '100%', accentColor: '#00FF9D', height: 4, cursor: 'pointer' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: '"DM Mono", monospace', fontSize: 9, color: '#445566', marginTop: 4 }}>
          <span>0 yrs</span><span>25 yrs</span><span>50 yrs</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onBack} style={{
          flex: 1, height: 48, borderRadius: 10, cursor: 'pointer', transition: 'all 200ms',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: '#445566',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#00E5FF'; e.currentTarget.style.color = '#EEF2F7'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#445566'; }}
        >← Back</button>
        <button onClick={onSubmit} style={{
          flex: 2, height: 48, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #00FF9D 0%, #00E5FF 100%)',
          fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: '#020608',
          transition: 'all 200ms',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,255,157,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
        >Complete Registration →</button>
      </div>
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════
// MAIN LOGIN PAGE
// ════════════════════════════════════════════════════════════════
const LoginPage = () => {
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const { addToast } = useToast();
  const reducedMotion = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  // Form state
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'doctor' | 'patient' | ''>('');
  const [inviteCode, setInviteCode] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  // Doctor credentials step
  const [regStep, setRegStep] = useState<'basic' | 'credentials'>('basic');
  const [credentials, setCredentials] = useState({ license: '', specialization: '', hospital: '', yearsOfPractice: 0 });

  const strength = getStrength(password);

  // THREE.JS BACKGROUND
  useEffect(() => {
    // Don't initialise the full-screen DNA/particle scene on phones or when the
    // user requested reduced motion — the static CSS gradient fallback stands in.
    if (window.innerWidth < 768 || reducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x020608, 1);

    // DNA Helix
    const dnaPositions: number[] = [];
    const dnaColors: number[] = [];
    for (let i = 0; i < 300; i++) {
      const t = (i / 300) * Math.PI * 8;
      const strand = i % 2;
      const radius = 1.5;
      dnaPositions.push(Math.cos(t + strand * Math.PI) * radius, (i / 300) * 12 - 6, Math.sin(t + strand * Math.PI) * radius);
      if (strand === 0) dnaColors.push(0, 0.898, 1);
      else dnaColors.push(0, 1, 0.616);
    }
    const dnaGeo = new THREE.BufferGeometry();
    dnaGeo.setAttribute('position', new THREE.Float32BufferAttribute(dnaPositions, 3));
    dnaGeo.setAttribute('color', new THREE.Float32BufferAttribute(dnaColors, 3));
    const dna = new THREE.Points(dnaGeo, new THREE.PointsMaterial({ size: 0.04, vertexColors: true, transparent: true, opacity: 0.8 }));
    dna.position.x = -3;
    scene.add(dna);

    // Medical Cross
    const crossMat = new THREE.MeshBasicMaterial({ color: 0x00E5FF, wireframe: true, transparent: true, opacity: 0.3 });
    const crossGroup = new THREE.Group();
    crossGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 1, 0.15), crossMat));
    crossGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.15, 0.15), crossMat));
    crossGroup.position.set(3, 1, -2);
    scene.add(crossGroup);

    // Neural network nodes
    const nodes: { mesh: THREE.Mesh; vx: number; vy: number }[] = [];
    for (let i = 0; i < 20; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x00E5FF, transparent: true, opacity: 0.6 }),
      );
      mesh.position.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 5 - 3);
      scene.add(mesh);
      nodes.push({ mesh, vx: (Math.random() - 0.5) * 0.005, vy: (Math.random() - 0.5) * 0.005 });
    }
    const lineGeo = new THREE.BufferGeometry();
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00E5FF, transparent: true, opacity: 0.06 });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    // ECG Line
    const ecgPts: THREE.Vector3[] = [];
    for (let x = -8; x <= 8; x += 0.1) {
      let y = Math.sin(x * 2) * 0.1;
      if (x > -0.3 && x < 0) y = (x + 0.3) * 3;
      if (x >= 0 && x < 0.1) y = 1.0 - x * 10;
      if (x >= 0.1 && x < 0.3) y = -(x - 0.1) * 2;
      ecgPts.push(new THREE.Vector3(x, y - 2.5, -1));
    }
    const ecgLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ecgPts),
      new THREE.LineBasicMaterial({ color: 0x00FF9D, transparent: true, opacity: 0.4 }),
    );
    scene.add(ecgLine);

    // Ambient particles
    const ambPositions: number[] = [];
    const ambColors: number[] = [];
    for (let i = 0; i < 500; i++) {
      ambPositions.push((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 10 - 3);
      const c = Math.random() > 0.5 ? [0, 0.898, 1] : [1, 1, 1];
      ambColors.push(...c);
    }
    const ambGeo = new THREE.BufferGeometry();
    ambGeo.setAttribute('position', new THREE.Float32BufferAttribute(ambPositions, 3));
    ambGeo.setAttribute('color', new THREE.Float32BufferAttribute(ambColors, 3));
    const ambParticles = new THREE.Points(ambGeo, new THREE.PointsMaterial({ size: 0.02, vertexColors: true, transparent: true, opacity: 0.25 }));
    scene.add(ambParticles);

    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      dna.rotation.y += 0.003;
      crossGroup.rotation.x += 0.005;
      crossGroup.rotation.y += 0.007;
      crossGroup.position.y = 1 + Math.sin(t * 0.5) * 0.3;
      nodes.forEach(n => {
        n.mesh.position.x += n.vx;
        n.mesh.position.y += n.vy;
        if (Math.abs(n.mesh.position.x) > 5) n.vx *= -1;
        if (Math.abs(n.mesh.position.y) > 4) n.vy *= -1;
      });
      const linePositions: number[] = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          if (nodes[i].mesh.position.distanceTo(nodes[j].mesh.position) < 2.5) {
            linePositions.push(
              nodes[i].mesh.position.x, nodes[i].mesh.position.y, nodes[i].mesh.position.z,
              nodes[j].mesh.position.x, nodes[j].mesh.position.y, nodes[j].mesh.position.z,
            );
          }
        }
      }
      lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
      lineMat.opacity = 0.04 + Math.sin(t) * 0.04;
      ecgLine.position.x = ((ecgLine.position.x - 0.02) % 16) - 8;
      (ecgLine.material as THREE.LineBasicMaterial).opacity = 0.2 + Math.sin(t * 2) * 0.2;
      const ambPos = ambGeo.attributes.position;
      for (let i = 0; i < 500; i++) {
        const y = ambPos.getY(i) + 0.003;
        ambPos.setY(i, y > 7.5 ? -7.5 : y);
      }
      ambPos.needsUpdate = true;
      camera.position.x += (mouseRef.current.x * 0.3 - camera.position.x) * 0.05;
      camera.position.y += (-mouseRef.current.y * 0.3 - camera.position.y) * 0.05;
      camera.lookAt(scene.position);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    const handleMouse = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    document.addEventListener('mousemove', handleMouse);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousemove', handleMouse);
      renderer.dispose();
    };
  }, [reducedMotion]);

  // Form handlers
  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  const handleLogin = async () => {
    setError('');
    if (!email || !password) { setError('Please fill in all fields'); triggerShake(); return; }
    setLoading(true);
    try {
      const res = await apiLogin({ email, password });
      authLogin(res.access_token, res.user);
      // Small delay for biometric animation
      setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
    } catch (e: any) {
      setError(e.message || 'Login failed');
      triggerShake();
      setLoading(false);
    }
  };

  const handleRegisterBasic = () => {
    setError('');
    if (!email || !password || !fullName || !role) { setError('Please fill in all fields'); triggerShake(); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); triggerShake(); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); triggerShake(); return; }
    if (role === 'doctor' && !inviteCode) { setError('Doctor invite code is required'); triggerShake(); return; }

    // Doctor goes to credentials step
    if (role === 'doctor') {
      setRegStep('credentials');
      return;
    }

    // Patient registers immediately
    doRegister();
  };

  const doRegister = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRegister({
        email, full_name: fullName, password, role: role as 'doctor' | 'patient',
        invite_code: inviteCode || undefined,
      });
      authLogin(res.access_token, res.user);

      // If doctor, update profile with credentials
      if (role === 'doctor' && credentials.license) {
        try {
          const { default: api } = await import(/* @vite-ignore */ '../api/client');
          await api.patch('/api/auth/profile', {
            medical_license_number: credentials.license,
            specialization: credentials.specialization,
            hospital_name: credentials.hospital,
            years_of_practice: credentials.yearsOfPractice,
          });
        } catch (err) {
          addToast('error', 'Account created, but your professional details could not be saved. Please complete your profile from Settings.');
          console.error('Profile PATCH failed after registration:', err);
        }
      }

      setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
    } catch (e: any) {
      setError(e.message || 'Registration failed');
      triggerShake();
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 48, background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    fontFamily: '"DM Mono", monospace', fontSize: 13, padding: '0 16px', color: '#EEF2F7',
    outline: 'none', transition: 'all 200ms', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: '"DM Mono", monospace', fontSize: 11, color: '#445566', marginBottom: 6, display: 'block',
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <LoginCursor />
      <canvas ref={canvasRef} style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0,
        // Static themed fallback shown when the WebGL scene is skipped
        // (mobile / reduced motion). When the scene runs, its opaque clear
        // color paints over this.
        background:
          'radial-gradient(ellipse 800px 600px at 20% 30%, rgba(0,229,255,0.06), transparent 60%),' +
          'radial-gradient(ellipse 700px 500px at 80% 80%, rgba(0,255,157,0.05), transparent 60%),' +
          '#020608',
      }} />

      <div style={{
        position: 'fixed', inset: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 8vw', pointerEvents: 'none',
      }}>
        {/* LEFT — Branding */}
        <div className="login-branding" style={{ pointerEvents: 'none', maxWidth: 480 }}>
          <div style={{ fontSize: 72, marginBottom: 8, animation: 'float 3s ease-in-out infinite' }}>🏥</div>
          <h1 style={{
            fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 64,
            background: 'linear-gradient(135deg, #00E5FF 0%, #00FF9D 50%, #00E5FF 100%)',
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            animation: 'gradientShift 3s ease infinite', lineHeight: 1.1, margin: 0,
          }}>NEURAMED</h1>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 400, fontSize: 22, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>Clinical AI Diagnostic</p>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 28, color: '#EEF2F7', margin: 0 }}>Intelligence Platform</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 }}>
            {[
              ['🎤', 'Voice Diagnosis — LLaMA 3 70B'],
              ['🧠', 'Imaging AI — Groq Vision + ACR'],
              ['📄', 'OCR Reports — Document Intelligence'],
              ['💊', 'Drug Interactions — RxNorm AI'],
              ['🗣️', 'Indian Languages — Sarvam AI'],
            ].map(([emoji, text], i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.12, duration: 0.5 }}
                style={{
                  background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)',
                  borderRadius: 24, padding: '10px 20px',
                  fontFamily: '"DM Mono", monospace', fontSize: 13, color: '#00E5FF',
                  backdropFilter: 'blur(10px)', display: 'inline-flex', alignItems: 'center', gap: 8,
                }}>
                <span>{emoji}</span> {text}
              </motion.div>
            ))}
          </div>
          <p style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 48 }}>
            Trusted by clinicians. Powered by AI.
          </p>
        </div>

        {/* RIGHT — Auth Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: 440, maxWidth: 'calc(100vw - 32px)',
            background: 'rgba(11, 16, 21, 0.85)', backdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(0, 229, 255, 0.15)', borderRadius: 20, padding: '32px 36px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,229,255,0.05)',
            pointerEvents: 'all',
            animation: shake ? 'shake 0.5s ease-in-out' : 'none',
            overflowY: 'auto', maxHeight: '92vh',
          }}
        >
          {/* Biometric Loading */}
          {loading ? (
            <BiometricLoader />
          ) : (
            <>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="1.5"
                  style={{ animation: 'breathe-hex 3s ease-in-out infinite' }}>
                  <polygon points="12 2 22 7 22 17 12 22 2 17 2 7 12 2" />
                  <polyline points="6 12 10 12 12 6 14 18 16 12 18 12" stroke="#00E5FF" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
                <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: '#EEF2F7', marginTop: 8, marginBottom: 2 }}>Welcome to NEURAMED</h2>
                <p style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: '#445566' }}>
                  {tab === 'login' ? 'Sign in to your account' : regStep === 'credentials' ? 'Medical credential verification' : 'Create a new account'}
                </p>
              </div>

              {/* Tab Toggle — hidden during credentials step */}
              {regStep === 'basic' && (
                <div style={{ display: 'flex', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {(['login', 'register'] as const).map(t => (
                    <button key={t} onClick={() => { setTab(t); setError(''); setRegStep('basic'); }}
                      style={{
                        flex: 1, padding: '10px 0', cursor: 'pointer', transition: 'all 200ms',
                        fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14,
                        color: tab === t ? '#00E5FF' : '#445566',
                        background: tab === t ? 'rgba(0,229,255,0.1)' : 'transparent',
                        borderBottom: tab === t ? '2px solid #00E5FF' : '2px solid transparent',
                        border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                        textTransform: 'capitalize',
                      }}>{t === 'login' ? 'Sign In' : 'Register'}</button>
                  ))}
                </div>
              )}

              <AnimatePresence mode="wait">
                {/* ─── LOGIN ─── */}
                {tab === 'login' && (
                  <motion.div key="login" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>Email Address</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#00E5FF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,229,255,0.1)'; }}
                        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                    </div>
                    <div style={{ marginBottom: 20, position: 'relative' }}>
                      <label style={labelStyle}>Password</label>
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                        style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#00E5FF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,229,255,0.1)'; }}
                        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                      <button onClick={() => setShowPassword(!showPassword)} style={{
                        position: 'absolute', right: 12, top: 32, background: 'transparent', border: 'none', color: '#445566', cursor: 'pointer', fontSize: 16,
                      }}>{showPassword ? '🙈' : '👁️'}</button>
                    </div>
                    <button onClick={handleLogin} disabled={loading} style={{
                      width: '100%', height: 52, borderRadius: 12, border: 'none',
                      background: 'linear-gradient(135deg, #00E5FF 0%, #00FF9D 100%)',
                      color: '#020608', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15,
                      cursor: 'pointer', transition: 'all 200ms',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,229,255,0.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >Sign In</button>
                  </motion.div>
                )}

                {/* ─── REGISTER — Basic Step ─── */}
                {tab === 'register' && regStep === 'basic' && (
                  <motion.div key="register-basic" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>Full Name</label>
                      <input value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#00E5FF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,229,255,0.1)'; }}
                        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>Email Address</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#00E5FF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,229,255,0.1)'; }}
                        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
                    </div>

                    {/* Role Selector with Three.js cards */}
                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>I am a:</label>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <RoleCard type="patient" selected={role === 'patient'} onSelect={() => setRole('patient')} />
                        <RoleCard type="doctor" selected={role === 'doctor'} onSelect={() => setRole('doctor')} />
                      </div>
                    </div>

                    {/* Invite Code (doctor only) */}
                    <AnimatePresence>
                      {role === 'doctor' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ marginBottom: 14, overflow: 'hidden' }}>
                          <label style={labelStyle}>Doctor Invite Code</label>
                          <input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                            style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                            onFocus={e => { e.target.style.borderColor = '#00E5FF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,229,255,0.1)'; }}
                            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
                          <p style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: '#445566', marginTop: 4 }}>Contact admin for invite code</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>Password</label>
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#00E5FF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,229,255,0.1)'; }}
                        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
                      {password && (
                        <>
                          {/* Strength bars */}
                          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                            {[0, 1, 2, 3].map(i => (
                              <div key={i} style={{
                                flex: 1, height: 3, borderRadius: 2,
                                background: i < strength ? STRENGTH_COLORS[strength - 1] : 'rgba(255,255,255,0.08)',
                                transition: 'all 300ms',
                                boxShadow: i < strength ? `0 0 6px ${STRENGTH_COLORS[strength - 1]}40` : 'none',
                              }} />
                            ))}
                          </div>
                          {/* Clinical label */}
                          <p style={{
                            fontFamily: '"DM Mono", monospace', fontSize: 10, marginTop: 4,
                            color: STRENGTH_COLORS[Math.max(0, strength - 1)],
                          }}>
                            {strength > 0 ? STRENGTH_LABELS[strength - 1] : STRENGTH_LABELS[0]}
                          </p>
                        </>
                      )}
                    </div>

                    <div style={{ marginBottom: 18 }}>
                      <label style={labelStyle}>Confirm Password</label>
                      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#00E5FF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,229,255,0.1)'; }}
                        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                        onKeyDown={e => e.key === 'Enter' && handleRegisterBasic()} />
                    </div>

                    <button onClick={handleRegisterBasic} style={{
                      width: '100%', height: 52, borderRadius: 12, border: 'none',
                      background: 'linear-gradient(135deg, #00E5FF 0%, #00FF9D 100%)',
                      color: '#020608', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15,
                      cursor: 'pointer', transition: 'all 200ms',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,229,255,0.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >{role === 'doctor' ? 'Next — Verify Credentials →' : 'Create Account'}</button>
                  </motion.div>
                )}

                {/* ─── REGISTER — Doctor Credentials Step ─── */}
                {tab === 'register' && regStep === 'credentials' && (
                  <DoctorCredentialsStep
                    key="register-credentials"
                    credentials={credentials}
                    setCredentials={setCredentials}
                    onBack={() => setRegStep('basic')}
                    onSubmit={doRegister}
                  />
                )}
              </AnimatePresence>

              {/* Error */}
              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: '#FF3B5C', textAlign: 'center', marginTop: 12 }}>
                  {error}
                </motion.p>
              )}

              {/* Switch tab text */}
              {regStep === 'basic' && (
                <p style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: '#445566', textAlign: 'center', marginTop: 14 }}>
                  {tab === 'login' ? "Don't have an account? " : "Already have an account? "}
                  <span onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError(''); setRegStep('basic'); }}
                    style={{ color: '#00E5FF', cursor: 'pointer' }}>
                    {tab === 'login' ? 'Register →' : 'Sign in →'}
                  </span>
                </p>
              )}
            </>
          )}
        </motion.div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes shake { 0%,100% { transform: translateX(0); } 10%,30%,50%,70%,90% { transform: translateX(-4px); } 20%,40%,60%,80% { transform: translateX(4px); } }
        @keyframes breathe-hex { 0%,100% { transform: rotate(0deg) scale(1); } 25% { transform: rotate(2deg) scale(1.05); } 75% { transform: rotate(-2deg) scale(0.95); } }
        @keyframes biometric-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes scan-sweep { 0% { top: 10px; opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { top: 65px; opacity: 0; } }
        @keyframes pulse-dot { 0%,100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
        @media (max-width: 768px) {
          .login-branding { display: none !important; }
        }
        .login-branding + div { margin: 0 auto; }
      `}</style>
    </div>
  );
};

export default LoginPage;
