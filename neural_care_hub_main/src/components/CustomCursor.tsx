import { useEffect, useRef } from 'react';

const CustomCursor = () => {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const ring = useRef({ x: 0, y: 0 });
  const isDown = useRef(false);
  const isHover = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${e.clientX - 3.5}px, ${e.clientY - 3.5}px)${isDown.current ? ' scale(0.6)' : ''}`;
      }
    };

    const onDown = () => {
      isDown.current = true;
      dotRef.current?.style.setProperty('transform', `translate(${mouse.current.x - 3.5}px, ${mouse.current.y - 3.5}px) scale(0.6)`);
      ringRef.current?.style.setProperty('transform', `translate(${ring.current.x - 15}px, ${ring.current.y - 15}px) scale(0.9)`);
    };

    const onUp = () => {
      isDown.current = false;
    };

    const onHoverIn = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-cursor="hover"]') || target.closest('button') || target.closest('a') || target.closest('input') || target.closest('textarea')) {
        isHover.current = true;
        ringRef.current?.classList.add('cursor-hover');
      }
    };

    const onHoverOut = () => {
      isHover.current = false;
      ringRef.current?.classList.remove('cursor-hover');
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('mouseover', onHoverIn);
    document.addEventListener('mouseout', onHoverOut);

    let raf: number;
    const loop = () => {
      ring.current.x += (mouse.current.x - ring.current.x) * 0.10;
      ring.current.y += (mouse.current.y - ring.current.y) * 0.10;
      if (ringRef.current) {
        const scale = isDown.current ? 0.9 : isHover.current ? 1.8 : 1;
        ringRef.current.style.transform = `translate(${ring.current.x - 15}px, ${ring.current.y - 15}px) scale(${scale})`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('mouseover', onHoverIn);
      document.removeEventListener('mouseout', onHoverOut);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div
        ref={dotRef}
        style={{
          position: 'fixed', top: 0, left: 0, width: 7, height: 7,
          background: 'var(--cyan)', borderRadius: '50%',
          pointerEvents: 'none', zIndex: 9999, transition: 'transform 100ms ease',
        }}
      />
      <div
        ref={ringRef}
        className="cursor-ring"
        style={{
          position: 'fixed', top: 0, left: 0, width: 30, height: 30,
          border: '1px solid var(--cyan)', borderRadius: '50%',
          pointerEvents: 'none', zIndex: 9998, transition: 'width 200ms ease, height 200ms ease, background 200ms ease',
        }}
      />
      <style>{`
        .cursor-ring.cursor-hover {
          background: rgba(0,229,255,0.07) !important;
        }
      `}</style>
    </>
  );
};

export default CustomCursor;
