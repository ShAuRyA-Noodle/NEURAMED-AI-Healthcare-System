import { useEffect, useRef, ReactNode } from 'react';
import * as THREE from 'three';

interface DashboardHeroProps {
  children?: ReactNode;
}

/**
 * DashboardHero — refined liquid sphere with rim light, slow drift, subtle ECG.
 * Replaces the previous torus-knot/grid/wireframe-cross composition.
 * Coral-cream palette, soft-skill compliant. Pauses when tab hidden.
 */

const HERO_HEIGHT = 220;

const DashboardHero = ({ children }: DashboardHeroProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.innerWidth < 768) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const container = containerRef.current;
    if (!container) return;

    let alive = true;
    let renderer: THREE.WebGLRenderer | null = null;
    let rafId = 0;

    try {
      const w = container.clientWidth;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, w / HERO_HEIGHT, 0.1, 100);
      camera.position.set(0, 0.4, 6);

      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.inset = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.zIndex = '0';
      canvas.style.borderRadius = 'inherit';
      container.insertBefore(canvas, container.firstChild);

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setSize(w, HERO_HEIGHT);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);

      // ─── PRIMARY ORB — physical material, clearcoat ───
      const orbGeo = new THREE.IcosahedronGeometry(1.05, 64);
      const orbMat = new THREE.MeshPhysicalMaterial({
        color: 0xFF6B5B,
        roughness: 0.22,
        metalness: 0.12,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        emissive: 0xFF8576,
        emissiveIntensity: 0.10,
        transparent: true,
        opacity: 0.96,
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.set(2.6, 0.1, 0);
      scene.add(orb);

      // Save base vertex positions for breathing displacement
      const basePositions = new Float32Array(orbGeo.attributes.position.array);

      // Soft rim — slightly larger, very transparent shell for halo
      const rimGeo = new THREE.SphereGeometry(1.18, 48, 48);
      const rimMat = new THREE.MeshBasicMaterial({
        color: 0xFF8576,
        transparent: true,
        opacity: 0.05,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.position.copy(orb.position);
      scene.add(rim);

      // ─── SECONDARY ORBITERS — small accent satellites ───
      const sat1Geo = new THREE.SphereGeometry(0.13, 24, 24);
      const sat1Mat = new THREE.MeshStandardMaterial({
        color: 0xFFC2B6,
        roughness: 0.4,
        metalness: 0.1,
        emissive: 0xFFC2B6,
        emissiveIntensity: 0.25,
      });
      const sat1 = new THREE.Mesh(sat1Geo, sat1Mat);
      scene.add(sat1);

      const sat2Geo = new THREE.SphereGeometry(0.085, 20, 20);
      const sat2Mat = new THREE.MeshStandardMaterial({
        color: 0xF4F3F0,
        roughness: 0.55,
        metalness: 0.0,
      });
      const sat2 = new THREE.Mesh(sat2Geo, sat2Mat);
      scene.add(sat2);

      // ─── HORIZON LINE — soft warm glow at lower edge ───
      const horizonGeo = new THREE.PlaneGeometry(20, 0.4);
      const horizonMat = new THREE.MeshBasicMaterial({
        color: 0xFF6B5B,
        transparent: true,
        opacity: 0.10,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const horizon = new THREE.Mesh(horizonGeo, horizonMat);
      horizon.position.set(0, -1.6, -2);
      scene.add(horizon);

      // ─── ECG SIGNATURE — sparse, low-opacity ───
      const ecgPts: THREE.Vector3[] = [];
      for (let x = -10; x <= 10; x += 0.10) {
        let y = Math.sin(x * 1.7) * 0.04;
        if (x > -0.3 && x < 0)   y = (x + 0.3) * 1.4;
        if (x >= 0  && x < 0.1)  y = 0.45 - x * 4.5;
        if (x >= 0.1 && x < 0.3) y = -(x - 0.1) * 1.0;
        ecgPts.push(new THREE.Vector3(x, y - 1.0, -1));
      }
      const ecgGeo = new THREE.BufferGeometry().setFromPoints(ecgPts);
      const ecgMat = new THREE.LineBasicMaterial({
        color: 0xFF8576,
        transparent: true,
        opacity: 0.18,
      });
      const ecg = new THREE.Line(ecgGeo, ecgMat);
      scene.add(ecg);

      // ─── LIGHTS ───
      scene.add(new THREE.AmbientLight(0xFFFFFF, 0.35));
      const key = new THREE.DirectionalLight(0xFFC2B6, 1.4);
      key.position.set(3, 4, 5);
      scene.add(key);
      const fill = new THREE.PointLight(0xFF6B5B, 1.6, 10);
      fill.position.set(2.6, 0.1, 1.5);
      scene.add(fill);
      const back = new THREE.PointLight(0xFFFFFF, 0.5, 8);
      back.position.set(-2, -1, 2);
      scene.add(back);

      // ─── MOUSE PARALLAX ───
      const mouse = { x: 0, y: 0 };
      const onMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      };
      container.addEventListener('mousemove', onMove, { passive: true });

      // ─── RESIZE ───
      let rt: ReturnType<typeof setTimeout>;
      const onResize = () => {
        clearTimeout(rt);
        rt = setTimeout(() => {
          if (!alive || !renderer) return;
          const nw = container.clientWidth;
          camera.aspect = nw / HERO_HEIGHT;
          camera.updateProjectionMatrix();
          renderer.setSize(nw, HERO_HEIGHT);
        }, 120);
      };
      window.addEventListener('resize', onResize);

      // ─── VISIBILITY ───
      let paused = false;
      const onVis = () => { paused = document.hidden; };
      document.addEventListener('visibilitychange', onVis);

      // ─── LOOP ───
      const clock = new THREE.Clock();
      const orbPosAttr = orbGeo.attributes.position as THREE.BufferAttribute;

      const animate = () => {
        if (!alive) return;
        rafId = requestAnimationFrame(animate);
        if (paused) return;

        const t = clock.getElapsedTime();

        // Orb breathing displacement (very subtle, premium feel)
        const amp = 0.018;
        for (let i = 0; i < orbPosAttr.count; i++) {
          const i3 = i * 3;
          const ox = basePositions[i3];
          const oy = basePositions[i3 + 1];
          const oz = basePositions[i3 + 2];
          const noise = Math.sin(ox * 3 + t * 0.9) * Math.cos(oy * 3 + t * 0.7) * Math.sin(oz * 3 + t * 0.5);
          const k = 1 + noise * amp;
          orbPosAttr.setXYZ(i, ox * k, oy * k, oz * k);
        }
        orbPosAttr.needsUpdate = true;
        // Skip computeVertexNormals — perf, displacement is small enough

        // Slow rotation
        orb.rotation.y += 0.0028;
        orb.rotation.x += 0.0014;
        rim.rotation.copy(orb.rotation);

        // Satellites orbit primary orb
        const r1 = 1.55;
        sat1.position.set(2.6 + Math.cos(t * 0.6) * r1, Math.sin(t * 0.6) * 0.45 + 0.1, Math.sin(t * 0.6) * r1);
        const r2 = 1.85;
        sat2.position.set(2.6 + Math.cos(t * 0.4 + 1.5) * r2, Math.sin(t * 0.4 + 1.5) * 0.55 + 0.1, Math.sin(t * 0.4 + 1.5) * -r2);

        // ECG slow drift
        ecg.position.x = ((ecg.position.x - 0.012 + 20) % 20) - 10;
        ecgMat.opacity = 0.14 + Math.sin(t * 1.5) * 0.05;

        // Horizon glow pulse
        horizonMat.opacity = 0.08 + Math.sin(t * 0.6) * 0.025;

        // Camera parallax
        camera.position.x += (mouse.x * 0.25 - camera.position.x) * 0.030;
        camera.position.y += (-mouse.y * 0.18 + 0.4 - camera.position.y) * 0.030;
        camera.lookAt(0, 0, 0);

        renderer!.render(scene, camera);
      };
      animate();

      return () => {
        alive = false;
        cancelAnimationFrame(rafId);
        clearTimeout(rt);
        container.removeEventListener('mousemove', onMove);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVis);
        orbGeo.dispose();
        orbMat.dispose();
        rimGeo.dispose();
        rimMat.dispose();
        sat1Geo.dispose();
        sat1Mat.dispose();
        sat2Geo.dispose();
        sat2Mat.dispose();
        horizonGeo.dispose();
        horizonMat.dispose();
        ecgGeo.dispose();
        ecgMat.dispose();
        renderer?.dispose();
        renderer?.forceContextLoss();
        if (canvas.parentNode) canvas.remove();
      };
    } catch {
      return;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: HERO_HEIGHT,
        borderRadius: 'var(--radius-xl, 20px)',
        overflow: 'hidden',
        background:
          'radial-gradient(ellipse at 70% 50%, rgba(255, 107, 91, 0.10), transparent 60%), linear-gradient(180deg, var(--surface) 0%, var(--canvas) 100%)',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ position: 'relative', zIndex: 2, height: '100%', pointerEvents: 'all' }}>
        {children}
      </div>
    </div>
  );
};

export default DashboardHero;
