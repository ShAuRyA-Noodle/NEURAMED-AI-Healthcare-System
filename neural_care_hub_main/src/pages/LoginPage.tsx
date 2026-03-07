import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin, register as apiRegister } from '../api/auth';
import LoginCursor from '../components/cursor/LoginCursor';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
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

  // Password strength
  const getStrength = (p: string) => {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p) && /\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    if (p.length >= 12 && s >= 3) s++;
    return s;
  };
  const strength = getStrength(password);
  const strengthColors = ['#FF3B5C', '#FF9500', '#00E5FF', '#00FF9D'];

  // THREE.JS BACKGROUND
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x020608, 1);

    // ELEMENT 1: DNA Helix
    const dnaPositions: number[] = [];
    const dnaColors: number[] = [];
    for (let i = 0; i < 300; i++) {
      const t = (i / 300) * Math.PI * 8;
      const strand = i % 2;
      const radius = 1.5;
      dnaPositions.push(
        Math.cos(t + strand * Math.PI) * radius,
        (i / 300) * 12 - 6,
        Math.sin(t + strand * Math.PI) * radius
      );
      if (strand === 0) dnaColors.push(0, 0.898, 1);
      else dnaColors.push(0, 1, 0.616);
    }
    const dnaGeo = new THREE.BufferGeometry();
    dnaGeo.setAttribute('position', new THREE.Float32BufferAttribute(dnaPositions, 3));
    dnaGeo.setAttribute('color', new THREE.Float32BufferAttribute(dnaColors, 3));
    const dnaMat = new THREE.PointsMaterial({ size: 0.04, vertexColors: true, transparent: true, opacity: 0.8 });
    const dna = new THREE.Points(dnaGeo, dnaMat);
    dna.position.x = -3;
    scene.add(dna);

    // ELEMENT 2: Medical Cross
    const crossMat = new THREE.MeshBasicMaterial({ color: 0x00E5FF, wireframe: true, transparent: true, opacity: 0.3 });
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1, 0.15), crossMat);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(1, 0.15, 0.15), crossMat);
    const crossGroup = new THREE.Group();
    crossGroup.add(cross1, cross2);
    crossGroup.position.set(3, 1, -2);
    scene.add(crossGroup);

    // ELEMENT 3: Neural network nodes
    const nodes: { mesh: THREE.Mesh; vx: number; vy: number }[] = [];
    for (let i = 0; i < 20; i++) {
      const geo = new THREE.SphereGeometry(0.04, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00E5FF, transparent: true, opacity: 0.6 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 5 - 3
      );
      scene.add(mesh);
      nodes.push({ mesh, vx: (Math.random() - 0.5) * 0.005, vy: (Math.random() - 0.5) * 0.005 });
    }

    // Lines for neural network
    const lineGeo = new THREE.BufferGeometry();
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00E5FF, transparent: true, opacity: 0.06 });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    // ELEMENT 4: ECG Line
    const ecgPts: THREE.Vector3[] = [];
    for (let x = -8; x <= 8; x += 0.1) {
      let y = Math.sin(x * 2) * 0.1;
      if (x > -0.3 && x < 0) y = (x + 0.3) * 3;
      if (x >= 0 && x < 0.1) y = 1.0 - x * 10;
      if (x >= 0.1 && x < 0.3) y = -(x - 0.1) * 2;
      ecgPts.push(new THREE.Vector3(x, y - 2.5, -1));
    }
    const ecgGeo = new THREE.BufferGeometry().setFromPoints(ecgPts);
    const ecgMat = new THREE.LineBasicMaterial({ color: 0x00FF9D, transparent: true, opacity: 0.4 });
    const ecgLine = new THREE.Line(ecgGeo, ecgMat);
    scene.add(ecgLine);

    // ELEMENT 5: Ambient particles
    const ambPositions: number[] = [];
    const ambColors: number[] = [];
    for (let i = 0; i < 500; i++) {
      ambPositions.push(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 10 - 3
      );
      const c = Math.random() > 0.5 ? [0, 0.898, 1] : [1, 1, 1];
      ambColors.push(...c);
    }
    const ambGeo = new THREE.BufferGeometry();
    ambGeo.setAttribute('position', new THREE.Float32BufferAttribute(ambPositions, 3));
    ambGeo.setAttribute('color', new THREE.Float32BufferAttribute(ambColors, 3));
    const ambMat = new THREE.PointsMaterial({ size: 0.02, vertexColors: true, transparent: true, opacity: 0.25 });
    const ambParticles = new THREE.Points(ambGeo, ambMat);
    scene.add(ambParticles);

    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // DNA rotation
      dna.rotation.y += 0.003;

      // Cross float + rotate
      crossGroup.rotation.x += 0.005;
      crossGroup.rotation.y += 0.007;
      crossGroup.position.y = 1 + Math.sin(t * 0.5) * 0.3;

      // Neural nodes drift
      nodes.forEach(n => {
        n.mesh.position.x += n.vx;
        n.mesh.position.y += n.vy;
        if (Math.abs(n.mesh.position.x) > 5) n.vx *= -1;
        if (Math.abs(n.mesh.position.y) > 4) n.vy *= -1;
      });

      // Rebuild neural connections
      const linePositions: number[] = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = nodes[i].mesh.position.distanceTo(nodes[j].mesh.position);
          if (d < 2.5) {
            linePositions.push(
              nodes[i].mesh.position.x, nodes[i].mesh.position.y, nodes[i].mesh.position.z,
              nodes[j].mesh.position.x, nodes[j].mesh.position.y, nodes[j].mesh.position.z
            );
          }
        }
      }
      lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
      lineMat.opacity = 0.04 + Math.sin(t) * 0.04;

      // ECG scroll
      ecgLine.position.x = ((ecgLine.position.x - 0.02) % 16) - 8;
      ecgMat.opacity = 0.2 + Math.sin(t * 2) * 0.2;

      // Ambient drift
      const ambPos = ambGeo.attributes.position;
      for (let i = 0; i < 500; i++) {
        const y = ambPos.getY(i) + 0.003;
        ambPos.setY(i, y > 7.5 ? -7.5 : y);
      }
      ambPos.needsUpdate = true;

      // Camera parallax
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
  }, []);

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
      navigate('/dashboard', { replace: true });
    } catch (e: any) {
      setError(e.message || 'Login failed');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    if (!email || !password || !fullName || !role) { setError('Please fill in all fields'); triggerShake(); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); triggerShake(); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); triggerShake(); return; }
    if (role === 'doctor' && !inviteCode) { setError('Doctor invite code is required'); triggerShake(); return; }
    setLoading(true);
    try {
      const res = await apiRegister({ email, full_name: fullName, password, role, invite_code: inviteCode || undefined });
      authLogin(res.access_token, res.user);
      navigate('/dashboard', { replace: true });
    } catch (e: any) {
      setError(e.message || 'Registration failed');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 48, background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    fontFamily: '"DM Mono", monospace', fontSize: 13, padding: '0 16px', color: '#EEF2F7',
    outline: 'none', transition: 'all 200ms', boxSizing: 'border-box'
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: '"DM Mono", monospace', fontSize: 11, color: '#445566', marginBottom: 6, display: 'block'
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <LoginCursor />
      {/* Three.js Canvas */}
      <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }} />

      {/* Overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 8vw', pointerEvents: 'none'
      }}>
        {/* LEFT — Branding */}
        <div className="login-branding" style={{ pointerEvents: 'none', maxWidth: 480 }}>
          <div style={{ fontSize: 72, marginBottom: 8, animation: 'float 3s ease-in-out infinite' }}>🏥</div>
          <h1 style={{
            fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 64,
            background: 'linear-gradient(135deg, #00E5FF 0%, #00FF9D 50%, #00E5FF 100%)',
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            animation: 'gradientShift 3s ease infinite', lineHeight: 1.1, margin: 0
          }}>NEURAMED</h1>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 400, fontSize: 22, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>Clinical AI Diagnostic</p>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 28, color: '#EEF2F7', margin: 0 }}>Intelligence Platform</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 }}>
            {[
              ['🎤', 'Voice Diagnosis — LLaMA 3 70B'],
              ['🧠', 'Imaging AI — OpenCV + ACR'],
              ['📄', 'OCR Reports — Document Intelligence'],
            ].map(([emoji, text], i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.15, duration: 0.5 }}
                style={{
                  background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)',
                  borderRadius: 24, padding: '10px 20px',
                  fontFamily: '"DM Mono", monospace', fontSize: 13, color: '#00E5FF',
                  backdropFilter: 'blur(10px)', display: 'inline-flex', alignItems: 'center', gap: 8
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
            width: 420, maxWidth: 'calc(100vw - 32px)',
            background: 'rgba(11, 16, 21, 0.85)', backdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(0, 229, 255, 0.15)', borderRadius: 20, padding: 40,
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,229,255,0.05)',
            pointerEvents: 'all',
            animation: shake ? 'shake 0.5s ease-in-out' : 'none',
            overflowY: 'auto', maxHeight: '90vh'
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 28 }}>🏥</div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: '#EEF2F7', marginTop: 8 }}>Welcome to NEURAMED</h2>
            <p style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: '#445566' }}>
              {tab === 'login' ? 'Sign in to your account' : 'Create a new account'}
            </p>
          </div>

          {/* Tab Toggle */}
          <div style={{ display: 'flex', marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {(['login', 'register'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); }}
                style={{
                  flex: 1, padding: '10px 0', cursor: 'pointer', transition: 'all 200ms',
                  fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14,
                  color: tab === t ? '#00E5FF' : '#445566',
                  background: tab === t ? 'rgba(0,229,255,0.1)' : 'transparent',
                  borderBottom: tab === t ? '2px solid #00E5FF' : '2px solid transparent',
                  border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                  textTransform: 'capitalize'
                }}>{t === 'login' ? 'Sign In' : 'Register'}</button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === 'login' ? (
              <motion.div key="login" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Email Address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder=""
                    style={inputStyle} onFocus={e => { e.target.style.borderColor = '#00E5FF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,229,255,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                </div>
                <div style={{ marginBottom: 20, position: 'relative' }}>
                  <label style={labelStyle}>Password</label>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder=""
                    style={inputStyle} onFocus={e => { e.target.style.borderColor = '#00E5FF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,229,255,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                  <button onClick={() => setShowPassword(!showPassword)} style={{
                    position: 'absolute', right: 12, top: 32, background: 'transparent', border: 'none', color: '#445566', cursor: 'pointer', fontSize: 16
                  }}>{showPassword ? '🙈' : '👁️'}</button>
                </div>

                <button onClick={handleLogin} disabled={loading} style={{
                  width: '100%', height: 52, borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #00E5FF 0%, #00FF9D 100%)',
                  color: '#020608', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15,
                  cursor: loading ? 'wait' : 'pointer', transition: 'all 200ms',
                  opacity: loading ? 0.7 : 1
                }}
                  onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,229,255,0.3)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                >{loading ? 'Signing in...' : 'Sign In'}</button>
              </motion.div>
            ) : (
              <motion.div key="register" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Full Name</label>
                  <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="" style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = '#00E5FF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,229,255,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Email Address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="" style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = '#00E5FF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,229,255,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
                </div>

                {/* Role Selector */}
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>I am a:</label>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {(['patient', 'doctor'] as const).map(r => (
                      <button key={r} onClick={() => setRole(r)} style={{
                        flex: 1, padding: 16, borderRadius: 12, cursor: 'pointer',
                        background: role === r ? 'rgba(0,229,255,0.08)' : 'rgba(0,229,255,0.04)',
                        border: role === r ? '1px solid #00E5FF' : '1px solid rgba(0,229,255,0.1)',
                        textAlign: 'center', transition: 'all 200ms', position: 'relative'
                      }}>
                        <div style={{ fontSize: 32 }}>{r === 'patient' ? '🧑‍🦽' : '👨‍⚕️'}</div>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#EEF2F7', marginTop: 6 }}>
                          {r === 'patient' ? 'Patient' : 'Doctor'}
                        </div>
                        <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: '#445566', marginTop: 4 }}>
                          {r === 'patient' ? 'Access diagnosis tools' : 'Full platform access'}
                        </div>
                        {r === 'doctor' && (
                          <span style={{
                            position: 'absolute', top: 6, right: 6,
                            background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.3)',
                            fontFamily: '"DM Mono", monospace', fontSize: 9, color: '#FF9500',
                            padding: '2px 8px', borderRadius: 10
                          }}>🔑 Invite</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Invite Code (doctor only) */}
                <AnimatePresence>
                  {role === 'doctor' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ marginBottom: 14, overflow: 'hidden' }}>
                      <label style={labelStyle}>Doctor Invite Code</label>
                      <input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} placeholder=""
                        style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                        onFocus={e => { e.target.style.borderColor = '#00E5FF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,229,255,0.1)'; }}
                        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
                      <p style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: '#445566', marginTop: 4 }}>Contact admin for invite code</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="" style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = '#00E5FF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,229,255,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
                  {password && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < strength ? strengthColors[strength - 1] : 'rgba(255,255,255,0.08)', transition: 'all 300ms' }} />
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Confirm Password</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="" style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = '#00E5FF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,229,255,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                    onKeyDown={e => e.key === 'Enter' && handleRegister()} />
                </div>

                <button onClick={handleRegister} disabled={loading} style={{
                  width: '100%', height: 52, borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #00E5FF 0%, #00FF9D 100%)',
                  color: '#020608', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15,
                  cursor: loading ? 'wait' : 'pointer', transition: 'all 200ms',
                  opacity: loading ? 0.7 : 1
                }}
                  onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,229,255,0.3)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                >{loading ? 'Creating Account...' : 'Create Account'}</button>
              </motion.div>
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
          <p style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: '#445566', textAlign: 'center', marginTop: 16 }}>
            {tab === 'login' ? "Don't have an account? " : "Already have an account? "}
            <span onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError(''); }}
              style={{ color: '#00E5FF', cursor: 'pointer' }}>
              {tab === 'login' ? 'Register →' : 'Sign in →'}
            </span>
          </p>

        </motion.div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes shake { 0%,100% { transform: translateX(0); } 10%,30%,50%,70%,90% { transform: translateX(-4px); } 20%,40%,60%,80% { transform: translateX(4px); } }
        @media (max-width: 768px) {
          .login-branding { display: none !important; }
        }
        .login-branding + div { margin: 0 auto; }
      `}</style>
    </div>
  );
};

export default LoginPage;
