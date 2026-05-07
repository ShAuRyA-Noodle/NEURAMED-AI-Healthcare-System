import { ReactNode, useState, useEffect } from 'react';
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
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Show onboarding for patients who haven't completed it
  useEffect(() => {
    if (user && user.role === 'patient' && !user.onboarding_completed) {
      setShowOnboarding(true);
    }
  }, [user]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', overflow: 'hidden' }}>
      <AmbientBackground />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }} />
      )}
      <div className="main-content" style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar onMenuClick={() => setSidebarOpen(prev => !prev)} />
        <main style={{ flex: 1, padding: '28px 32px 56px', overflowY: 'auto', position: 'relative' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {showOnboarding && (
        <PatientOnboarding onComplete={() => setShowOnboarding(false)} />
      )}
    </div>
  );
};

export default AppLayout;
