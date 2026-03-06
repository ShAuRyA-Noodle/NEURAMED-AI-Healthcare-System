import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import { CustomCursor } from "./components/cursor/CustomCursor";
import { Toast } from "./components/shared/Toast";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import Dashboard from "./pages/DashboardPage";
import VoiceAgent from "./pages/VoicePage";
import ImagingAI from "./pages/ImagingPage";
import OCRReports from "./pages/OcrPage";
import Patients from "./pages/PatientsPage";
import Appointments from "./pages/AppointmentsPage";
import NotFound from "./pages/NotFound";
import Sessions from "./pages/SessionsPage";
import SessionDetail from "./pages/SessionDetailPage";
import LoginPage from "./pages/LoginPage";
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
  const { isAuthenticated, isLoading } = useAuth();

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

  // Login page — no layout, no protection
  if (location.pathname === '/login') {
    if (!isLoading && isAuthenticated) {
      return (
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </QueryClientProvider>
      );
    }
    return (
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </QueryClientProvider>
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
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/voice" element={<ProtectedRoute><VoiceAgent /></ProtectedRoute>} />
            <Route path="/imaging" element={<ProtectedRoute><ImagingAI /></ProtectedRoute>} />
            <Route path="/ocr" element={<ProtectedRoute><OCRReports /></ProtectedRoute>} />
            <Route path="/patients" element={<ProtectedRoute requireRole="doctor"><Patients /></ProtectedRoute>} />
            <Route path="/patients/:id" element={<ProtectedRoute requireRole="doctor"><Patients /></ProtectedRoute>} />
            <Route path="/sessions" element={<ProtectedRoute requireRole="doctor"><Sessions /></ProtectedRoute>} />
            <Route path="/sessions/:id" element={<ProtectedRoute requireRole="doctor"><SessionDetail /></ProtectedRoute>} />
            <Route path="/appointments" element={<ProtectedRoute requireRole="doctor"><Appointments /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </TooltipProvider>
      <Toast />
    </QueryClientProvider>
  );
};

export default App;
