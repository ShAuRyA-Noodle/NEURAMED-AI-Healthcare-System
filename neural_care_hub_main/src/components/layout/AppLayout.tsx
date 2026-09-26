import { ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import AmbientBackground from '../three/AmbientBackground';
import PatientOnboarding from '../onboarding/PatientOnboarding';
import { useAuth } from '../../context/AuthContext';

const AppLayout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { user } = useAuth();
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const [dismissedOnboardingFor, setDismissedOnboardingFor] = useState<number | null>(null);
  const isSidebarOpen = openOnPath === location.pathname;
  const showOnboarding = user?.role === 'patient' && !user.onboarding_completed && dismissedOnboardingFor !== user.id;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', overflow: 'hidden' }}>
      <AmbientBackground />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setOpenOnPath(null)} />
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setOpenOnPath(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }} />
      )}
      <div className="main-content" style={{ marginLeft: 220, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar key={location.pathname} onMenuClick={() => setOpenOnPath(isSidebarOpen ? null : location.pathname)} />
        <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {showOnboarding && (
        <PatientOnboarding onComplete={() => setDismissedOnboardingFor(user.id)} />
      )}
    </div>
  );
};

export default AppLayout;
