import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
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
import DrugInteractionPage from "./pages/DrugInteractionPage";
import SarvamVoicePage from "./pages/SarvamVoicePage";
import TimelinePage from "./pages/TimelinePage";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useKeepAlive } from "./hooks/useKeepAlive";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20000, retry: 1 },
  },
});

const Splash = () => (
  <div
    style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
      gap: 20,
    }}
  >
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        background:
          "linear-gradient(135deg, var(--accent) 0%, #FF8576 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow:
          "0 12px 32px -8px rgba(255, 107, 91, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.20)",
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4" />
        <path d="M12 18v4" />
        <path d="M4.93 4.93l2.83 2.83" />
        <path d="M16.24 16.24l2.83 2.83" />
        <path d="M2 12h4" />
        <path d="M18 12h4" />
        <path d="M4.93 19.07l2.83-2.83" />
        <path d="M16.24 7.76l2.83-2.83" />
      </svg>
    </div>
    <span
      className="font-heading"
      style={{
        color: "var(--text)",
        fontSize: 17,
        letterSpacing: "-0.01em",
        fontWeight: 600,
      }}
    >
      Neuramed
    </span>
  </div>
);

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
  useKeepAlive();

  useEffect(() => {
    const pageName = location.pathname.split("/")[1];
    const title = pageName
      ? `Neuramed — ${pageName.charAt(0).toUpperCase() + pageName.slice(1).replace("-", " ")}`
      : "Neuramed — Overview";
    document.title = title;
  }, [location.pathname]);

  if (showSplash || isLoading) return <Splash />;

  if (!isAuthenticated) {
    if (location.pathname === "/login") {
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
        <Routes>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </QueryClientProvider>
    );
  }

  if (location.pathname === "/login") {
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
      <TooltipProvider>
        <Sonner />
        <AppLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/voice" element={<VoiceAgent />} />
            <Route path="/imaging" element={<ImagingAI />} />
            <Route path="/ocr" element={<OCRReports />} />
            <Route path="/drug-interactions" element={<DrugInteractionPage />} />
            <Route path="/voice/vernacular" element={<SarvamVoicePage />} />
            <Route path="/patients" element={<ProtectedRoute requireRole="doctor"><Patients /></ProtectedRoute>} />
            <Route path="/patients/:id" element={<ProtectedRoute requireRole="doctor"><Patients /></ProtectedRoute>} />
            <Route path="/sessions" element={<ProtectedRoute requireRole="doctor"><Sessions /></ProtectedRoute>} />
            <Route path="/sessions/:id" element={<ProtectedRoute requireRole="doctor"><SessionDetail /></ProtectedRoute>} />
            <Route path="/patients/:patientId/timeline" element={<ProtectedRoute requireRole="doctor"><TimelinePage /></ProtectedRoute>} />
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
