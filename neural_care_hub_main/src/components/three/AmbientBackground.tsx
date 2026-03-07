import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const PARTICLE_COUNT = 300;
const NODE_COUNT = 25;
const CONNECTION_DISTANCE = 2.5;

const AmbientBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    // Skip on mobile
    if (window.innerWidth < 768) return;

    const container = containerRef.current;
    if (!container) return;
    mountedRef.current = true;

    let renderer: THREE.WebGLRenderer;
    let rafId: number;

    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
      camera.position.z = 8;

      const canvas = document.createElement('canvas');
      container.appendChild(canvas);

      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setClearColor(0x000000, 0);

      // ─── PARTICLES ───────────────────────────────────────
      const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
      const particleColors = new Float32Array(PARTICLE_COUNT * 3);
      const particleSpeeds = new Float32Array(PARTICLE_COUNT);
      const particlePhases = new Float32Array(PARTICLE_COUNT);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        particlePositions[i3] = (Math.random() - 0.5) * 20;
        particlePositions[i3 + 1] = (Math.random() - 0.5) * 15;
        particlePositions[i3 + 2] = (Math.random() - 0.5) * 8 - 4;
        particleSpeeds[i] = 0.003 + Math.random() * 0.006;
        particlePhases[i] = Math.random() * Math.PI * 2;

        if (Math.random() > 0.3) {
          // 70% cyan
          particleColors[i3] = 0;
          particleColors[i3 + 1] = 0.898;
          particleColors[i3 + 2] = 1;
        } else {
          // 30% green
          particleColors[i3] = 0;
          particleColors[i3 + 1] = 1;
          particleColors[i3 + 2] = 0.616;
        }
      }

      const particleGeo = new THREE.BufferGeometry();
      particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
      const particleMat = new THREE.PointsMaterial({
        size: 0.03,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const particles = new THREE.Points(particleGeo, particleMat);
      scene.add(particles);

      // ─── CONSTELLATION NODES ──────────────────────────────
      const nodePositions: THREE.Vector3[] = [];
      const nodeVelocities: THREE.Vector3[] = [];
      const nodeMeshes: THREE.Mesh[] = [];

      const nodeGeo = new THREE.SphereGeometry(0.03, 6, 6);
      const nodeMat = new THREE.MeshBasicMaterial({
        color: 0x00E5FF,
        transparent: true,
        opacity: 0.5,
      });

      for (let i = 0; i < NODE_COUNT; i++) {
        const mesh = new THREE.Mesh(nodeGeo, nodeMat.clone());
        const pos = new THREE.Vector3(
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 4 - 6
        );
        mesh.position.copy(pos);
        scene.add(mesh);
        nodeMeshes.push(mesh);
        nodePositions.push(pos);
        nodeVelocities.push(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.004,
            (Math.random() - 0.5) * 0.004,
            0
          )
        );
      }

      // Connection lines
      const lineGeo = new THREE.BufferGeometry();
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x00E5FF,
        transparent: true,
        opacity: 0.06,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const connectionLines = new THREE.LineSegments(lineGeo, lineMat);
      scene.add(connectionLines);

      // ─── NEBULA PLANES ────────────────────────────────────
      const createNebula = (color: THREE.Color, pos: THREE.Vector3, scale: number) => {
        const geo = new THREE.PlaneGeometry(scale, scale);
        const mat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.03,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        scene.add(mesh);
        return mesh;
      };

      const nebulaCyan = createNebula(new THREE.Color(0x00E5FF), new THREE.Vector3(-4, 3, -12), 12);
      const nebulaGreen = createNebula(new THREE.Color(0x00FF9D), new THREE.Vector3(4, -3, -14), 10);
      const nebulaPurple = createNebula(new THREE.Color(0x6B3FA0), new THREE.Vector3(0, 0, -16), 14);

      // ─── MOUSE PARALLAX ───────────────────────────────────
      const mouse = { x: 0, y: 0 };
      const onMouseMove = (e: MouseEvent) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
      };
      window.addEventListener('mousemove', onMouseMove);

      // ─── RESIZE ───────────────────────────────────────────
      let resizeTimeout: ReturnType<typeof setTimeout>;
      const onResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (!mountedRef.current) return;
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
        }, 150);
      };
      window.addEventListener('resize', onResize);

      // ─── ANIMATION LOOP ──────────────────────────────────
      const clock = new THREE.Clock();

      const animate = () => {
        if (!mountedRef.current) return;
        rafId = requestAnimationFrame(animate);

        const t = clock.getElapsedTime();

        // Animate particles — drift upward with sine wave
        const posAttr = particleGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const i3 = i * 3;
          let y = posAttr.getY(i) + particleSpeeds[i];
          if (y > 7.5) y = -7.5;
          posAttr.setY(i, y);
          // Gentle sine side-drift
          const x = posAttr.getX(i) + Math.sin(t * 0.5 + particlePhases[i]) * 0.001;
          posAttr.setX(i, x);
        }
        posAttr.needsUpdate = true;

        // Animate constellation nodes
        for (let i = 0; i < NODE_COUNT; i++) {
          nodePositions[i].add(nodeVelocities[i]);
          if (Math.abs(nodePositions[i].x) > 7) nodeVelocities[i].x *= -1;
          if (Math.abs(nodePositions[i].y) > 5) nodeVelocities[i].y *= -1;
          nodeMeshes[i].position.copy(nodePositions[i]);
        }

        // Rebuild connections
        const linePositions: number[] = [];
        for (let i = 0; i < NODE_COUNT; i++) {
          for (let j = i + 1; j < NODE_COUNT; j++) {
            const d = nodePositions[i].distanceTo(nodePositions[j]);
            if (d < CONNECTION_DISTANCE) {
              linePositions.push(
                nodePositions[i].x, nodePositions[i].y, nodePositions[i].z,
                nodePositions[j].x, nodePositions[j].y, nodePositions[j].z
              );
            }
          }
        }
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));

        // Animate nebula — breathing
        const breathe1 = 1 + Math.sin(t * 0.3) * 0.08;
        const breathe2 = 1 + Math.sin(t * 0.25 + 1) * 0.06;
        const breathe3 = 1 + Math.sin(t * 0.2 + 2) * 0.07;

        nebulaCyan.scale.setScalar(breathe1);
        (nebulaCyan.material as THREE.MeshBasicMaterial).opacity = 0.025 + Math.sin(t * 0.3) * 0.01;
        nebulaGreen.scale.setScalar(breathe2);
        (nebulaGreen.material as THREE.MeshBasicMaterial).opacity = 0.02 + Math.sin(t * 0.25) * 0.008;
        nebulaPurple.scale.setScalar(breathe3);
        (nebulaPurple.material as THREE.MeshBasicMaterial).opacity = 0.015 + Math.sin(t * 0.2) * 0.006;

        // Mouse parallax — camera drifts toward mouse
        camera.position.x += (mouse.x * 0.5 - camera.position.x) * 0.02;
        camera.position.y += (-mouse.y * 0.5 - camera.position.y) * 0.02;
        camera.lookAt(0, 0, -4);

        renderer.render(scene, camera);
      };

      animate();

      // ─── CLEANUP ──────────────────────────────────────────
      return () => {
        mountedRef.current = false;
        cancelAnimationFrame(rafId);
        clearTimeout(resizeTimeout);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
        renderer.forceContextLoss();
        particleGeo.dispose();
        particleMat.dispose();
        nodeGeo.dispose();
        nodeMat.dispose();
        lineGeo.dispose();
        lineMat.dispose();
        nodeMeshes.forEach(m => (m.material as THREE.Material).dispose());
        [nebulaCyan, nebulaGreen, nebulaPurple].forEach(n => {
          (n.geometry as THREE.BufferGeometry).dispose();
          (n.material as THREE.Material).dispose();
        });
        if (canvas.parentNode) canvas.remove();
      };
    } catch {
      // WebGL not available — fail silently, CSS fallback handles it
      return;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.55,
      }}
    />
  );
};

export default AmbientBackground;
