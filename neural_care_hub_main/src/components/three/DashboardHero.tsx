import { useEffect, useRef, ReactNode } from 'react';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface DashboardHeroProps {
  children?: ReactNode;
}

const DashboardHero = ({ children }: DashboardHeroProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    // Skip on mobile or when reduced motion is requested — CSS fallback handles it
    if (window.innerWidth < 768 || reducedMotion) return;

    const container = containerRef.current;
    if (!container) return;
    mountedRef.current = true;

    let renderer: THREE.WebGLRenderer;
    let rafId: number;

    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, container.clientWidth / 200, 0.1, 100);
      camera.position.z = 6;
      camera.position.y = 0.5;

      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.inset = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.zIndex = '0';
      canvas.style.borderRadius = '14px';
      container.insertBefore(canvas, container.firstChild);

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setSize(container.clientWidth, 200);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x020608, 1);

      // ─── TORUS KNOT ──────────────────────────────────
      const torusGeo = new THREE.TorusKnotGeometry(0.8, 0.25, 128, 32, 2, 3);
      const torusMat = new THREE.MeshStandardMaterial({
        color: 0x00E5FF,
        metalness: 0.9,
        roughness: 0.15,
        transparent: true,
        opacity: 0.7,
      });
      const torusKnot = new THREE.Mesh(torusGeo, torusMat);
      torusKnot.position.set(2.5, 0, 0);
      scene.add(torusKnot);

      // Point light following torus
      const torusLight = new THREE.PointLight(0x00E5FF, 1.5, 8);
      torusLight.position.set(2.5, 0, 2);
      scene.add(torusLight);

      // ─── WIREFRAME CROSS ──────────────────────────────
      const crossMat = new THREE.MeshBasicMaterial({
        color: 0x00FF9D, wireframe: true, transparent: true, opacity: 0.2,
      });
      const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), crossMat);
      const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.12), crossMat);
      const crossGroup = new THREE.Group();
      crossGroup.add(cross1, cross2);
      crossGroup.position.set(-2, -0.3, -2);
      scene.add(crossGroup);

      // ─── GRID FLOOR ───────────────────────────────────
      const gridHelper = new THREE.GridHelper(20, 40, 0x00E5FF, 0x00E5FF);
      gridHelper.position.y = -1.5;
      (gridHelper.material as THREE.Material).transparent = true;
      (gridHelper.material as THREE.Material).opacity = 0.04;
      scene.add(gridHelper);

      // ─── ECG LINE ─────────────────────────────────────
      const ecgPts: THREE.Vector3[] = [];
      for (let x = -10; x <= 10; x += 0.08) {
        let y = Math.sin(x * 2) * 0.06;
        if (x > -0.3 && x < 0) y = (x + 0.3) * 2.5;
        if (x >= 0 && x < 0.1) y = 0.8 - x * 8;
        if (x >= 0.1 && x < 0.3) y = -(x - 0.1) * 1.5;
        ecgPts.push(new THREE.Vector3(x, y - 1.2, 0));
      }
      const ecgGeo = new THREE.BufferGeometry().setFromPoints(ecgPts);
      const ecgMat = new THREE.LineBasicMaterial({
        color: 0x00FF9D, transparent: true, opacity: 0.3,
      });
      const ecgLine = new THREE.Line(ecgGeo, ecgMat);
      scene.add(ecgLine);

      // Ambient light
      scene.add(new THREE.AmbientLight(0xffffff, 0.2));
      const dirLight = new THREE.DirectionalLight(0x00E5FF, 0.5);
      dirLight.position.set(2, 3, 4);
      scene.add(dirLight);

      // ─── MOUSE TRACKING ───────────────────────────────
      const mouse = { x: 0, y: 0 };
      const onMouseMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      };
      container.addEventListener('mousemove', onMouseMove);

      // ─── RESIZE ───────────────────────────────────────
      let resizeTimeout: ReturnType<typeof setTimeout>;
      const onResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (!mountedRef.current || !container) return;
          const w = container.clientWidth;
          camera.aspect = w / 200;
          camera.updateProjectionMatrix();
          renderer.setSize(w, 200);
        }, 150);
      };
      window.addEventListener('resize', onResize);

      // ─── ANIMATE ──────────────────────────────────────
      const clock = new THREE.Clock();

      const animate = () => {
        if (!mountedRef.current) return;
        rafId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        // Torus rotation
        torusKnot.rotation.x += 0.004;
        torusKnot.rotation.y += 0.006;
        torusLight.position.x = 2.5 + Math.sin(t) * 0.5;
        torusLight.position.z = 2 + Math.cos(t) * 0.3;

        // Cross float + rotate
        crossGroup.rotation.y += 0.003;
        crossGroup.position.y = -0.3 + Math.sin(t * 0.5) * 0.2;

        // ECG scroll
        ecgLine.position.x = ((ecgLine.position.x - 0.015 + 20) % 20) - 10;
        ecgMat.opacity = 0.2 + Math.sin(t * 2) * 0.1;

        // Camera parallax
        camera.position.x += (mouse.x * 0.3 - camera.position.x) * 0.03;
        camera.position.y += (-mouse.y * 0.2 + 0.5 - camera.position.y) * 0.03;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
      };
      animate();

      return () => {
        mountedRef.current = false;
        cancelAnimationFrame(rafId);
        clearTimeout(resizeTimeout);
        container.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
        renderer.forceContextLoss();
        torusGeo.dispose();
        torusMat.dispose();
        crossMat.dispose();
        cross1.geometry.dispose();
        cross2.geometry.dispose();
        ecgGeo.dispose();
        ecgMat.dispose();
        if (canvas.parentNode) canvas.remove();
      };
    } catch {
      return;
    }
  }, [reducedMotion]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: 200,
        borderRadius: 14,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #020608 0%, #0a1520 50%, #020608 100%)',
      }}
    >
      {/* Text overlay */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        height: '100%',
        pointerEvents: 'all',
      }}>
        {children}
      </div>
    </div>
  );
};

export default DashboardHero;
