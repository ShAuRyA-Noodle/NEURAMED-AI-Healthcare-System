import { useEffect, useState } from 'react';

/**
 * True only on devices with a fine (mouse-like) pointer. Touch-only devices
 * report `coarse`, so this returns false there — used to gate the custom
 * cursor so it never mounts (and never leaves static artifacts) on touch.
 */
export function useFinePointer(): boolean {
  const [fine, setFine] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(pointer: fine)');
    const on = () => setFine(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return fine;
}
