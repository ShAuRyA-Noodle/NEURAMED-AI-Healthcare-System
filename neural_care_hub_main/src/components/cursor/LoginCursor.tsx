import { useEffect, useRef } from 'react';
import { useFinePointer } from '../../hooks/useFinePointer';

const TRAIL_COUNT = 8;
const LERP_RING = 0.12;

const LoginCursor = () => {
  const fine = useFinePointer();
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<(HTMLDivElement | null)[]>([]);

  const mouse = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const ring = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const trails = useRef(
    Array.from({ length: TRAIL_COUNT }, () => ({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }))
  );
  const isHovering = useRef(false);
  const isClicking = useRef(false);

  useEffect(() => {
    // Never hide the native cursor / run rAF on touch devices.
    if (!fine) return;

    // Scoped cursor hide via body class (see index.css) instead of a global
    // `* { cursor: none !important }` — keeps not-allowed / I-beam affordances
    // and restores the native cursor if this JS ever throws.
    document.body.classList.add('custom-cursor-active');

    const onMouseMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };

      // Instant dot follow
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }

      // Check hover on interactive elements
      const target = e.target as HTMLElement;
      isHovering.current = !!target?.closest(
        'button, a, input, [data-cursor="hover"], select, textarea, label[style*="cursor"]'
      );
    };

    const onMouseDown = () => {
      isClicking.current = true;
      // Click burst — scale ring 2x then reset
      if (ringRef.current) {
        ringRef.current.style.transition = 'transform 80ms ease-out';
      }
      setTimeout(() => {
        isClicking.current = false;
        if (ringRef.current) {
          ringRef.current.style.transition = '';
        }
      }, 150);
    };

    const animate = () => {
      // Ring lerp follow
      ring.current.x += (mouse.current.x - ring.current.x) * LERP_RING;
      ring.current.y += (mouse.current.y - ring.current.y) * LERP_RING;

      if (ringRef.current) {
        const hoverScale = isHovering.current ? 1.55 : 1; // 36 * 1.55 ≈ 56px
        const clickScale = isClicking.current ? 2 : 1;
        const scale = hoverScale * clickScale;
        ringRef.current.style.transform = `translate3d(${ring.current.x}px, ${ring.current.y}px, 0) scale(${scale})`;
      }

      // Dot color on hover
      if (dotRef.current) {
        dotRef.current.style.background = isHovering.current ? '#00FF9D' : '#00E5FF';
      }

      // Trails — cascade lerp (each follows the previous)
      for (let i = 0; i < TRAIL_COUNT; i++) {
        const leader = i === 0 ? ring.current : trails.current[i - 1];
        const lerpFactor = LERP_RING * (1 - i * 0.08);
        trails.current[i].x += (leader.x - trails.current[i].x) * lerpFactor;
        trails.current[i].y += (leader.y - trails.current[i].y) * lerpFactor;

        const el = trailRefs.current[i];
        if (el) {
          const opacity = 0.25 - i * 0.028;
          const size = 36 - i * 2;
          el.style.transform = `translate3d(${trails.current[i].x}px, ${trails.current[i].y}px, 0)`;
          el.style.width = `${size}px`;
          el.style.height = `${size}px`;
          el.style.marginLeft = `${-size / 2}px`;
          el.style.marginTop = `${-size / 2}px`;
          el.style.opacity = `${Math.max(opacity, 0)}`;
        }
      }

      requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    const animId = requestAnimationFrame(animate);

    return () => {
      document.body.classList.remove('custom-cursor-active');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      cancelAnimationFrame(animId);
    };
  }, [fine]);

  // Touch devices: render nothing so no static cyan artifacts remain.
  if (!fine) return null;

  return (
    <>
      {/* Dot — 6px, instant follow */}
      <div
        ref={dotRef}
        style={{
          position: 'fixed', top: 0, left: 0, width: 6, height: 6,
          background: '#00E5FF', borderRadius: '50%',
          pointerEvents: 'none', zIndex: 10000,
          marginLeft: -3, marginTop: -3,
          willChange: 'transform', transition: 'background 150ms',
        }}
      />

      {/* Ring — 36px, lerp follow */}
      <div
        ref={ringRef}
        style={{
          position: 'fixed', top: 0, left: 0, width: 36, height: 36,
          border: '1.5px solid rgba(0, 229, 255, 0.5)', borderRadius: '50%',
          pointerEvents: 'none', zIndex: 9999,
          marginLeft: -18, marginTop: -18,
          willChange: 'transform',
        }}
      />

      {/* Trail ghost rings */}
      {Array.from({ length: TRAIL_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={el => { trailRefs.current[i] = el; }}
          style={{
            position: 'fixed', top: 0, left: 0,
            width: 36 - i * 2, height: 36 - i * 2,
            border: '1px solid rgba(0, 229, 255, 0.25)',
            borderRadius: '50%', pointerEvents: 'none',
            zIndex: 9998 - i,
            marginLeft: -(36 - i * 2) / 2,
            marginTop: -(36 - i * 2) / 2,
            willChange: 'transform', opacity: 0.25 - i * 0.028,
          }}
        />
      ))}
    </>
  );
};

export default LoginCursor;
