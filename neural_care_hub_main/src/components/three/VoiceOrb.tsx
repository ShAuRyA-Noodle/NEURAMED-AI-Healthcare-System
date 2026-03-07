import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface VoiceOrbProps {
  isRecording: boolean;
  audioLevel?: number;
}

const VoiceOrb = ({ isRecording, audioLevel = 0 }: VoiceOrbProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const recordingRef = useRef(isRecording);
  const audioRef = useRef(audioLevel);

  // Update refs without re-mounting
  useEffect(() => { recordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { audioRef.current = audioLevel; }, [audioLevel]);

  useEffect(() => {
    if (window.innerWidth < 768) return;

    const container = containerRef.current;
    if (!container) return;
    mountedRef.current = true;

    let renderer: THREE.WebGLRenderer;
    let rafId: number;

    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.z = 4;

      const canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      container.appendChild(canvas);

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setSize(180, 180);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);

      // ─── THE SPHERE with Fresnel-like glow ──────────
      const sphereGeo = new THREE.SphereGeometry(1, 64, 64);
      const sphereMat = new THREE.MeshPhongMaterial({
        color: 0x00E5FF,
        emissive: 0x00E5FF,
        emissiveIntensity: 0.15,
        transparent: true,
        opacity: 0.7,
        shininess: 100,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      scene.add(sphere);

      // Store original positions for displacement
      const originalPositions = new Float32Array(sphereGeo.attributes.position.array);

      // ─── ORBIT RINGS ──────────────────────────────────
      const ringGeo = new THREE.TorusGeometry(1.3, 0.008, 8, 80);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00E5FF, transparent: true, opacity: 0.25,
      });
      const ring1 = new THREE.Mesh(ringGeo, ringMat);
      scene.add(ring1);

      const ring2 = new THREE.Mesh(ringGeo, ringMat.clone());
      ring2.rotation.x = Math.PI * 0.25;
      scene.add(ring2);

      // ─── PARTICLE SHELL ───────────────────────────────
      const shellCount = 40;
      const shellPositions = new Float32Array(shellCount * 3);
      const shellAngles = new Float32Array(shellCount);
      const shellSpeeds = new Float32Array(shellCount);
      const shellAxes = new Float32Array(shellCount);

      for (let i = 0; i < shellCount; i++) {
        shellAngles[i] = Math.random() * Math.PI * 2;
        shellSpeeds[i] = 0.005 + Math.random() * 0.01;
        shellAxes[i] = Math.random() * Math.PI; // Orbit inclination
        const r = 1.8;
        const theta = shellAngles[i];
        const phi = shellAxes[i];
        shellPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        shellPositions[i * 3 + 1] = r * Math.cos(phi);
        shellPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }

      const shellGeo = new THREE.BufferGeometry();
      shellGeo.setAttribute('position', new THREE.BufferAttribute(shellPositions, 3));
      const shellMat = new THREE.PointsMaterial({
        size: 0.04,
        color: 0x00E5FF,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const shellParticles = new THREE.Points(shellGeo, shellMat);
      scene.add(shellParticles);

      // ─── LIGHTS ───────────────────────────────────────
      scene.add(new THREE.AmbientLight(0xffffff, 0.3));
      const pointLight = new THREE.PointLight(0x00E5FF, 2, 10);
      pointLight.position.set(2, 2, 3);
      scene.add(pointLight);

      const greenLight = new THREE.PointLight(0x00FF9D, 0.5, 8);
      greenLight.position.set(-2, -1, 2);
      scene.add(greenLight);

      // ─── ANIMATION ────────────────────────────────────
      const clock = new THREE.Clock();
      let targetDisplacement = 0;
      let currentDisplacement = 0;

      const animate = () => {
        if (!mountedRef.current) return;
        rafId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        const recording = recordingRef.current;
        const audio = audioRef.current;

        // Sphere displacement — react to audio
        targetDisplacement = recording ? 0.05 + audio * 0.15 : 0.01;
        currentDisplacement += (targetDisplacement - currentDisplacement) * 0.08;

        const posAttr = sphereGeo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const i3 = i * 3;
          const ox = originalPositions[i3];
          const oy = originalPositions[i3 + 1];
          const oz = originalPositions[i3 + 2];
          const noise = Math.sin(ox * 4 + t * 2) * Math.cos(oy * 4 + t * 1.5) * Math.sin(oz * 4 + t);
          const displacement = 1 + noise * currentDisplacement;
          posAttr.setXYZ(i, ox * displacement, oy * displacement, oz * displacement);
        }
        posAttr.needsUpdate = true;
        sphereGeo.computeVertexNormals();

        // Color oscillation
        const colorMix = (Math.sin(t * 0.5) + 1) / 2;
        const r = colorMix * 0;
        const g = 0.898 + colorMix * 0.102;
        const b = 1 - colorMix * 0.384;
        sphereMat.color.setRGB(r, g, b);
        sphereMat.emissive.setRGB(r * 0.3, g * 0.3, b * 0.3);
        sphereMat.emissiveIntensity = recording ? 0.3 + audio * 0.2 : 0.15;
        sphereMat.opacity = recording ? 0.85 : 0.7;

        // Rings rotation
        ring1.rotation.y += recording ? 0.02 : 0.005;
        ring2.rotation.x += recording ? 0.015 : 0.003;

        // Particle shell — orbit
        const speedMult = recording ? 1 + audio * 3 : 0.3;
        for (let i = 0; i < shellCount; i++) {
          shellAngles[i] += shellSpeeds[i] * speedMult;
          const r2 = 1.8;
          const theta = shellAngles[i];
          const phi = shellAxes[i];
          shellPositions[i * 3] = r2 * Math.sin(phi) * Math.cos(theta);
          shellPositions[i * 3 + 1] = r2 * Math.cos(phi);
          shellPositions[i * 3 + 2] = r2 * Math.sin(phi) * Math.sin(theta);
        }
        (shellGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;

        // Point light pulsing
        pointLight.intensity = recording ? 2 + audio * 2 : 1.5 + Math.sin(t) * 0.3;

        renderer.render(scene, camera);
      };
      animate();

      return () => {
        mountedRef.current = false;
        cancelAnimationFrame(rafId);
        renderer.dispose();
        renderer.forceContextLoss();
        sphereGeo.dispose();
        sphereMat.dispose();
        ringGeo.dispose();
        ringMat.dispose();
        shellGeo.dispose();
        shellMat.dispose();
        if (canvas.parentNode) canvas.remove();
      };
    } catch {
      return;
    }
  }, []);

  // CSS fallback for mobile
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    return (
      <div style={{
        width: 120, height: 120, borderRadius: '50%', margin: '0 auto',
        background: `radial-gradient(circle, ${isRecording ? '#00FF9D' : '#00E5FF'}30, transparent 70%)`,
        border: `2px solid ${isRecording ? '#00FF9D' : '#00E5FF'}40`,
        animation: `glow-pulse ${isRecording ? '0.8s' : '2s'} ease-in-out infinite`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: `radial-gradient(circle, ${isRecording ? '#00FF9D' : '#00E5FF'}50, ${isRecording ? '#00FF9D' : '#00E5FF'}10)`,
        }} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: 180,
        height: 180,
        margin: '0 auto',
        borderRadius: '50%',
        overflow: 'hidden',
      }}
    />
  );
};

export default VoiceOrb;
