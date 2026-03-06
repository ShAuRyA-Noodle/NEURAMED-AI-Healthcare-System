import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import { CustomCursor } from "./components/cursor/CustomCursor";
import { Toast } from "./components/shared/Toast";
import Dashboard from "./pages/DashboardPage";
import VoiceAgent from "./pages/VoicePage";
import ImagingAI from "./pages/ImagingPage";
import OCRReports from "./pages/OcrPage";
import Patients from "./pages/PatientsPage";
import Appointments from "./pages/AppointmentsPage";
import NotFound from "./pages/NotFound";
import Sessions from "./pages/SessionsPage";
import SessionDetail from "./pages/SessionDetailPage";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20000, retry: 1 },
  },
});

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <BrowserRouter>
      <AppRoutes showSplash={showSplash} />
    </BrowserRouter>
  );
};

const AppRoutes = ({ showSplash }: { showSplash: boolean }) => {
  const location = useLocation();

  useEffect(() => {
    const pageName = location.pathname.split('/')[1];
    const title = pageName
      ? `NEURAMED — ${pageName.charAt(0).toUpperCase() + pageName.slice(1).replace('-', ' ')}`
      : 'NEURAMED — Dashboard';
    document.title = title;
  }, [location.pathname]);

  if (showSplash) {
    return (
      <>
        <CustomCursor />
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 24 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="1.5">
            <polygon points="12 2 22 7 22 17 12 22 2 17 2 7 12 2" />
            <polyline points="6 12 10 12 12 6 14 18 16 12 18 12" stroke="var(--cyan)" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <span className="font-heading" style={{ color: 'var(--text)', fontSize: 24, letterSpacing: '0.2em', fontWeight: 700 }}>NEURAMED</span>
        </div>
      </>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <CustomCursor />
      <TooltipProvider>
        <Sonner />
        <AppLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/voice" element={<VoiceAgent />} />
            <Route path="/imaging" element={<ImagingAI />} />
            <Route path="/ocr" element={<OCRReports />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:id" element={<Patients />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/sessions/:id" element={<SessionDetail />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </TooltipProvider>
      <Toast />
    </QueryClientProvider>
  );
};

export default App;
