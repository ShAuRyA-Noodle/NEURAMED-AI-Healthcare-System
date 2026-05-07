import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * AmbientBackground
 * Soft, restrained background field. Inspired by Apple/Linear marketing —
 * sparse luminous particles + slow nebula breathing. Coral palette,
 * paused when tab hidden or `prefers-reduced-motion` is set.
 */

const PARTICLE_COUNT = 180;     // reduced from 300

const AmbientBackground = () => {
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
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
      camera.position.z = 10;

      const canvas = document.createElement('canvas');
      container.appendChild(canvas);

      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
      renderer.setClearColor(0x000000, 0);

      // ─── PARTICLES — coral / cream dust drifting upward ───
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);
      const speeds = new Float32Array(PARTICLE_COUNT);
      const phases = new Float32Array(PARTICLE_COUNT);

      const coral = new THREE.Color(0xFF6B5B);
      const peach = new THREE.Color(0xFFC2B6);
      const cream = new THREE.Color(0xF4F3F0);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        // Distribute in horizontal band, deeper into z to suggest depth
        positions[i3]     = (Math.random() - 0.5) * 28;
        positions[i3 + 1] = (Math.random() - 0.5) * 20;
        positions[i3 + 2] = -2 - Math.random() * 14; // depth field
        speeds[i] = 0.0018 + Math.random() * 0.0042;
        phases[i] = Math.random() * Math.PI * 2;

        // Distribution: 55% coral, 30% peach, 15% cream
        const r = Math.random();
        const c = r < 0.55 ? coral : r < 0.85 ? peach : cream;
        colors[i3]     = c.r;
        colors[i3 + 1] = c.g;
        colors[i3 + 2] = c.b;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

      const mat = new THREE.PointsMaterial({
        size: 0.022,
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const particles = new THREE.Points(geo, mat);
      scene.add(particles);

      // ─── NEBULA — two soft volumes, very slow breathing ───
      const makeNebula = (color: number, pos: THREE.Vector3, scale: number, baseOpacity: number) => {
        const g = new THREE.PlaneGeometry(scale, scale);
        const m = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: baseOpacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(g, m);
        mesh.position.copy(pos);
        scene.add(mesh);
        return { mesh, baseOpacity };
      };

      const nebA = makeNebula(0xFF6B5B, new THREE.Vector3(-6,  3, -16), 18, 0.030);
      const nebB = makeNebula(0xFFA191, new THREE.Vector3( 6, -3, -18), 16, 0.022);

      // ─── MOUSE PARALLAX (very subtle) ───
      const mouse = { x: 0, y: 0 };
      const onMove = (e: MouseEvent) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
      };
      window.addEventListener('mousemove', onMove, { passive: true });

      // ─── RESIZE (debounced) ───
      let rt: ReturnType<typeof setTimeout>;
      const onResize = () => {
        clearTimeout(rt);
        rt = setTimeout(() => {
          if (!alive || !renderer) return;
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
        }, 150);
      };
      window.addEventListener('resize', onResize);

      // ─── VISIBILITY GATE ───
      let paused = false;
      const onVis = () => { paused = document.hidden; };
      document.addEventListener('visibilitychange', onVis);

      // ─── LOOP ───
      const clock = new THREE.Clock();
      const posAttr = geo.attributes.position as THREE.BufferAttribute;

      const animate = () => {
        if (!alive) return;
        rafId = requestAnimationFrame(animate);
        if (paused) return;

        const t = clock.getElapsedTime();

        // particle drift
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          let y = posAttr.getY(i) + speeds[i];
          if (y > 10) y = -10;
          posAttr.setY(i, y);
          const x = posAttr.getX(i) + Math.sin(t * 0.4 + phases[i]) * 0.0008;
          posAttr.setX(i, x);
        }
        posAttr.needsUpdate = true;

        // nebula breathing
        const breatheA = 1 + Math.sin(t * 0.18) * 0.05;
        const breatheB = 1 + Math.sin(t * 0.14 + 1.5) * 0.04;
        nebA.mesh.scale.setScalar(breatheA);
        nebB.mesh.scale.setScalar(breatheB);
        (nebA.mesh.material as THREE.MeshBasicMaterial).opacity = nebA.baseOpacity + Math.sin(t * 0.18) * 0.012;
        (nebB.mesh.material as THREE.MeshBasicMaterial).opacity = nebB.baseOpacity + Math.sin(t * 0.14) * 0.010;

        // camera parallax (low intensity)
        camera.position.x += (mouse.x * 0.35 - camera.position.x) * 0.018;
        camera.position.y += (-mouse.y * 0.35 - camera.position.y) * 0.018;
        camera.lookAt(0, 0, -6);

        renderer!.render(scene, camera);
      };
      animate();

      return () => {
        alive = false;
        cancelAnimationFrame(rafId);
        clearTimeout(rt);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVis);
        geo.dispose();
        mat.dispose();
        (nebA.mesh.geometry as THREE.BufferGeometry).dispose();
        (nebA.mesh.material as THREE.Material).dispose();
        (nebB.mesh.geometry as THREE.BufferGeometry).dispose();
        (nebB.mesh.material as THREE.Material).dispose();
        renderer?.dispose();
        renderer?.forceContextLoss();
        if (canvas.parentNode) canvas.remove();
      };
    } catch {
      // WebGL unavailable — silently degrade
      return;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.45,
      }}
    />
  );
};

export default AmbientBackground;
