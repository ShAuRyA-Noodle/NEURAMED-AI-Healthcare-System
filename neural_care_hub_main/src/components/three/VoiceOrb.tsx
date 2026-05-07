import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface VoiceOrbProps {
  isRecording: boolean;
  audioLevel?: number;
}

/**
 * VoiceOrb — refined audio-reactive orb. Coral/warm palette.
 * Premium materials (clearcoat), sphere displacement reacts to audioLevel.
 * Pauses when tab hidden. Honors `prefers-reduced-motion`.
 * Drops per-frame computeVertexNormals (was the heaviest CPU hit per audit).
 */

const SIZE = 200;

const VoiceOrb = ({ isRecording, audioLevel = 0 }: VoiceOrbProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const recordingRef = useRef(isRecording);
  const audioRef = useRef(audioLevel);

  useEffect(() => { recordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { audioRef.current = audioLevel; }, [audioLevel]);

  useEffect(() => {
    if (window.innerWidth < 768) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const container = containerRef.current;
    if (!container) return;

    let alive = true;
    let renderer: THREE.WebGLRenderer | null = null;
    let rafId = 0;

    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
      camera.position.z = 4.2;

      const canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      container.appendChild(canvas);

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setSize(SIZE, SIZE);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);

      // ─── ORB — premium clearcoat, displaceable ───
      const orbGeo = new THREE.IcosahedronGeometry(1, 48);
      const orbMat = new THREE.MeshPhysicalMaterial({
        color: 0xFF6B5B,
        emissive: 0xFF8576,
        emissiveIntensity: 0.18,
        roughness: 0.30,
        metalness: 0.10,
        clearcoat: 0.95,
        clearcoatRoughness: 0.12,
        transparent: true,
        opacity: 0.94,
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      scene.add(orb);

      const basePositions = new Float32Array(orbGeo.attributes.position.array);

      // ─── HALO — soft coral rim ───
      const haloGeo = new THREE.SphereGeometry(1.18, 32, 32);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xFFC2B6,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      scene.add(halo);

      // ─── ORBIT RINGS — tasteful, dual-axis ───
      const ringGeo = new THREE.TorusGeometry(1.42, 0.006, 8, 96);
      const ringMatA = new THREE.MeshBasicMaterial({ color: 0xFF6B5B, transparent: true, opacity: 0.30 });
      const ringMatB = ringMatA.clone();
      ringMatB.opacity = 0.18;
      ringMatB.color = new THREE.Color(0xFFC2B6);
      const ringA = new THREE.Mesh(ringGeo, ringMatA);
      const ringB = new THREE.Mesh(ringGeo, ringMatB);
      ringB.rotation.x = Math.PI * 0.32;
      ringB.rotation.z = Math.PI * 0.18;
      scene.add(ringA, ringB);

      // ─── SHELL PARTICLES (orbit dust) ───
      const SHELL_COUNT = 56;
      const shellPos = new Float32Array(SHELL_COUNT * 3);
      const angles = new Float32Array(SHELL_COUNT);
      const speeds = new Float32Array(SHELL_COUNT);
      const incl = new Float32Array(SHELL_COUNT);

      for (let i = 0; i < SHELL_COUNT; i++) {
        angles[i] = Math.random() * Math.PI * 2;
        speeds[i] = 0.0035 + Math.random() * 0.008;
        incl[i] = Math.random() * Math.PI;
        const r = 1.85;
        shellPos[i * 3]     = r * Math.sin(incl[i]) * Math.cos(angles[i]);
        shellPos[i * 3 + 1] = r * Math.cos(incl[i]);
        shellPos[i * 3 + 2] = r * Math.sin(incl[i]) * Math.sin(angles[i]);
      }

      const shellGeo = new THREE.BufferGeometry();
      shellGeo.setAttribute('position', new THREE.BufferAttribute(shellPos, 3));
      const shellMat = new THREE.PointsMaterial({
        size: 0.034,
        color: 0xFFC2B6,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const shell = new THREE.Points(shellGeo, shellMat);
      scene.add(shell);

      // ─── LIGHTS ───
      scene.add(new THREE.AmbientLight(0xFFFFFF, 0.4));
      const key = new THREE.PointLight(0xFFC2B6, 1.8, 10);
      key.position.set(2.5, 2.5, 3);
      scene.add(key);
      const fill = new THREE.PointLight(0xFF6B5B, 0.8, 9);
      fill.position.set(-2, -1.5, 2);
      scene.add(fill);

      // ─── VISIBILITY GATE ───
      let paused = false;
      const onVis = () => { paused = document.hidden; };
      document.addEventListener('visibilitychange', onVis);

      // ─── LOOP ───
      const clock = new THREE.Clock();
      let displacement = 0.01;
      const orbPosAttr = orbGeo.attributes.position as THREE.BufferAttribute;
      const shellPosAttr = shellGeo.attributes.position as THREE.BufferAttribute;

      const animate = () => {
        if (!alive) return;
        rafId = requestAnimationFrame(animate);
        if (paused) return;

        const t = clock.getElapsedTime();
        const recording = recordingRef.current;
        const audio = audioRef.current;

        // Smooth displacement target
        const target = recording ? 0.05 + audio * 0.16 : 0.012;
        displacement += (target - displacement) * 0.10;

        // Orb breathing displacement
        for (let i = 0; i < orbPosAttr.count; i++) {
          const i3 = i * 3;
          const ox = basePositions[i3];
          const oy = basePositions[i3 + 1];
          const oz = basePositions[i3 + 2];
          const noise = Math.sin(ox * 4 + t * 2) * Math.cos(oy * 4 + t * 1.5) * Math.sin(oz * 4 + t);
          const k = 1 + noise * displacement;
          orbPosAttr.setXYZ(i, ox * k, oy * k, oz * k);
        }
        orbPosAttr.needsUpdate = true;
        // computeVertexNormals deliberately skipped — saves significant CPU per audit

        // Material reactivity
        orbMat.emissiveIntensity = recording ? 0.30 + audio * 0.30 : 0.16 + Math.sin(t * 0.9) * 0.04;
        orbMat.opacity = recording ? 0.99 : 0.94;

        // Rings rotate (faster while recording)
        ringA.rotation.y += recording ? 0.018 : 0.005;
        ringB.rotation.x += recording ? 0.013 : 0.004;
        ringMatA.opacity = recording ? 0.45 : 0.30;
        ringMatB.opacity = recording ? 0.30 : 0.18;

        // Shell particles orbit
        const speedMult = recording ? 1.0 + audio * 2.4 : 0.30;
        for (let i = 0; i < SHELL_COUNT; i++) {
          angles[i] += speeds[i] * speedMult;
          const r = 1.85 + Math.sin(t * 0.6 + i) * 0.04;
          shellPos[i * 3]     = r * Math.sin(incl[i]) * Math.cos(angles[i]);
          shellPos[i * 3 + 1] = r * Math.cos(incl[i]);
          shellPos[i * 3 + 2] = r * Math.sin(incl[i]) * Math.sin(angles[i]);
        }
        shellPosAttr.needsUpdate = true;

        // Halo pulse
        haloMat.opacity = recording ? 0.18 + audio * 0.08 : 0.10 + Math.sin(t * 0.8) * 0.02;

        // Light pulse
        key.intensity = recording ? 1.8 + audio * 1.6 : 1.5 + Math.sin(t * 0.9) * 0.25;

        renderer!.render(scene, camera);
      };
      animate();

      return () => {
        alive = false;
        cancelAnimationFrame(rafId);
        document.removeEventListener('visibilitychange', onVis);
        orbGeo.dispose();
        orbMat.dispose();
        haloGeo.dispose();
        haloMat.dispose();
        ringGeo.dispose();
        ringMatA.dispose();
        ringMatB.dispose();
        shellGeo.dispose();
        shellMat.dispose();
        renderer?.dispose();
        renderer?.forceContextLoss();
        if (canvas.parentNode) canvas.remove();
      };
    } catch {
      return;
    }
  }, []);

  // CSS fallback for mobile / reduced-motion
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    return (
      <div
        style={{
          width: 140,
          height: 140,
          borderRadius: '50%',
          margin: '0 auto',
          background: `radial-gradient(circle, ${isRecording ? 'rgba(255, 107, 91, 0.40)' : 'rgba(255, 107, 91, 0.22)'}, transparent 70%)`,
          border: `2px solid ${isRecording ? 'rgba(255, 107, 91, 0.60)' : 'rgba(255, 107, 91, 0.30)'}`,
          animation: `breathe ${isRecording ? '0.9s' : '2.4s'} ease-in-out infinite`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 70,
            height: 70,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 107, 91, 0.55) 0%, rgba(255, 133, 118, 0.10) 100%)',
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: SIZE,
        height: SIZE,
        margin: '0 auto',
        borderRadius: '50%',
        overflow: 'hidden',
      }}
    />
  );
};

export default VoiceOrb;
