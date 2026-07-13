// Decorative WebGL / Three.js backgrounds are OFF by default.
//
// They are pure decoration (ambient particle field, dashboard hero, voice orb),
// they are GPU-heavy, and on some real hardware they caused the app surface to
// render blank / interactions to feel unresponsive (issues that never reproduce
// under software-rendered/headless WebGL). A clean CSS gradient fallback is used
// instead. Set VITE_ENABLE_3D=true in the frontend .env to opt back in.
export const ENABLE_3D = import.meta.env.VITE_ENABLE_3D === 'true';
