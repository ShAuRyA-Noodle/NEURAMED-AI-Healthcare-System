import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Copy, ShieldCheck, AlertTriangle, Heart, Pill, ClipboardList,
  Search, Loader2, Download, RotateCcw, Volume2, VolumeX, Activity,
  Stethoscope, User, Calendar, ChevronDown, ChevronUp, Zap, Star
} from 'lucide-react';
import { useOcrAnalysis } from '@/hooks/useOcrAnalysis';
import { useToast } from '@/hooks/useToast';
import type {
  ReportAnalysisResult, RichAbnormalValue, MedicationDetail,
  CriticalAlert, ActionItem, RichMedication
} from '@/types';

const MEDICAL_TERMS = ['WBC', 'CRP', 'ABG', 'COPD', 'pneumonia', 'dyspnea', 'sputum', 'fever', 'antibiotic', 'prednisone', 'azithromycin', 'albuterol', 'ipratropium', 'leukocytosis', 'hypercapnia', 'exacerbation', 'Haemophilus', 'influenzae', 'acidosis', 'hyperinflation', 'hemoglobin', 'platelet', 'creatinine', 'glucose', 'cholesterol', 'triglyceride'];

const highlightMedical = (text: string) => {
  if (!text) return null;
  const regex = new RegExp(`\\b(${MEDICAL_TERMS.join('|')})\\b`, 'gi');
  return text.split(regex).map((part, i) =>
    MEDICAL_TERMS.some(t => t.toLowerCase() === part.toLowerCase())
      ? <span key={i} style={{ color: 'var(--cyan)', fontWeight: 600 }}>{part}</span>
      : part
  );
};

const SEVERITY_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  critical: { bg: 'rgba(255,59,92,0.08)', border: 'rgba(255,59,92,0.3)', text: '#fca5a5', glow: '0 0 16px rgba(255,59,92,0.12)' },
  high: { bg: 'rgba(255,149,0,0.08)', border: 'rgba(255,149,0,0.3)', text: '#fdba74', glow: '0 0 16px rgba(255,149,0,0.1)' },
  medium: { bg: 'rgba(0,229,255,0.06)', border: 'rgba(0,229,255,0.2)', text: '#00E5FF', glow: '0 0 12px rgba(0,229,255,0.08)' },
  low: { bg: 'rgba(0,255,157,0.06)', border: 'rgba(0,255,157,0.2)', text: '#86efac', glow: '0 0 12px rgba(0,255,157,0.08)' },
};

const URGENCY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  immediate: { bg: 'rgba(255,59,92,0.1)', border: 'rgba(255,59,92,0.3)', text: '#fca5a5' },
  soon: { bg: 'rgba(255,149,0,0.1)', border: 'rgba(255,149,0,0.3)', text: '#fdba74' },
  routine: { bg: 'rgba(0,229,255,0.08)', border: 'rgba(0,229,255,0.2)', text: '#00E5FF' },
};

const TTS_LANGUAGES: Record<string, { label: string; bcp47: string }> = {
  en: { label: 'English', bcp47: 'en-US' },
  hi: { label: 'Hindi', bcp47: 'hi-IN' },
  ta: { label: 'Tamil', bcp47: 'ta-IN' },
  te: { label: 'Telugu', bcp47: 'te-IN' },
  bn: { label: 'Bengali', bcp47: 'bn-IN' },
  mr: { label: 'Marathi', bcp47: 'mr-IN' },
  kn: { label: 'Kannada', bcp47: 'kn-IN' },
  ml: { label: 'Malayalam', bcp47: 'ml-IN' },
  pa: { label: 'Punjabi', bcp47: 'pa-IN' },
};

const REPORT_TYPES = ['Auto-Detect', 'Blood Work', 'Radiology', 'Pathology', 'Discharge Summary', 'Prescription'];

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const getScoreColor = (score: number): string => {
  if (score > 80) return 'var(--green)';
  if (score > 60) return 'var(--amber)';
  if (score > 40) return '#ef4444';
  return '#991b1b';
};

const HealthScoreGauge = ({ score }: { score: number }) => {
  const color = getScoreColor(score);
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={120} height={120} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={60} cy={60} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
        <motion.circle
          cx={60} cy={60} r={radius} fill="none" stroke={color} strokeWidth={8}
          strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span className="font-number" style={{ fontSize: 28, color, fontWeight: 700 }}>{score}</span>
        <span className="font-body" style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em' }}>HEALTH</span>
      </div>
    </div>
  );
};

const OCRReports = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [patientId, setPatientId] = useState('');
  const [reportTypeHint, setReportTypeHint] = useState('Auto-Detect');
  const [result, setResult] = useState<ReportAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'labs' | 'medications' | 'actions' | 'plain' | 'clinician'>('overview');
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedClinician, setCopiedClinician] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [expandedLabs, setExpandedLabs] = useState<Set<number>>(new Set());
  const [showNormal, setShowNormal] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsLanguage, setTtsLanguage] = useState('en');
  const inputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  const { mutateAsync: analyze, isPending } = useOcrAnalysis();

  const handleFile = useCallback((f: File) => {
    setFile(f);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
    setResult(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleAnalyze = async () => {
    if (!file) return;
    try {
      const parsedId = patientId ? parseInt(patientId.replace(/[^0-9]/g, ''), 10) : undefined;
      const res = await analyze({ file, patientId: parsedId || undefined });
      setResult(res);
      setActiveTab('overview');
    } catch {
      addToast('error', 'OCR analysis failed');
    }
  };

  const handleExportPdf = async (sessionId: number) => {
    addToast('success', 'Generating PDF...');
    try {
      const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const token = localStorage.getItem('neuramed_token');
      const response = await fetch(`${base}/api/sessions/${sessionId}/export-pdf`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `neuramed-ocr-${sessionId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'PDF downloaded successfully');
    } catch {
      addToast('error', 'Failed to generate PDF');
    }
  };

  const toggleLabRow = (index: number) => {
    setExpandedLabs(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleReadAloud = (text: string) => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = TTS_LANGUAGES[ttsLanguage]?.bcp47 || 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const copyToClipboard = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const tabs = ['overview', 'labs', 'medications', 'actions', 'plain', 'clinician'] as const;
  const tabLabels: Record<string, string> = {
    overview: 'Overview',
    labs: 'Lab Values',
    medications: 'Medications',
    actions: 'Action Plan',
    plain: 'Plain Language',
    clinician: 'Clinician'
  };

  const sortedAbnormals = (result?.abnormal_values || []).slice().sort((a, b) => {
    return (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
  });

  const getMedications = (): RichMedication[] => {
    if (!result) return [];
    if (result.medications_mentioned && result.medications_mentioned.length > 0) {
      return result.medications_mentioned;
    }
    if (result.medications && result.medications.length > 0) {
      return result.medications.map(m => {
        if (typeof m === 'string') return { name: m };
        return { name: m.name, dose: m.dose, frequency: m.frequency, purpose: m.purpose };
      });
    }
    return [];
  };

  const getCriticalAlerts = (): CriticalAlert[] => {
    if (!result?.critical_alerts || result.critical_alerts.length === 0) return [];
    return result.critical_alerts.map(a => {
      if (typeof a === 'string') return { parameter: '', value: '', reason: a, immediate_action: '', severity: 'critical' };
      return a;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>📄</div>
        <div>
          <h1 className="font-heading" style={{ fontSize: 24, color: 'var(--text)', margin: 0 }}>OCR Reports</h1>
          <p className="font-body" style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Extract and analyze medical documents with AI-powered OCR</p>
        </div>
      </div>

      <div className="split-workspace">
        {/* LEFT */}
        <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column' }}>
          {/* Drop zone */}
          {!file ? (
            <div
              role="button" tabIndex={0}
              aria-label="Upload medical document"
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!isPending) inputRef.current?.click(); } }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !isPending && inputRef.current?.click()}
              data-cursor={isPending ? "default" : "hover"}
              style={{
                height: 220, border: `1.5px dashed ${dragOver ? 'var(--cyan)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 12, background: dragOver ? 'rgba(0,229,255,0.05)' : 'var(--elevated)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
                transition: 'all 200ms', cursor: 'pointer'
              }}
            >
              <FileText size={36} style={{ color: 'var(--muted)', transition: 'transform 200ms', transform: dragOver ? 'scale(1.15)' : 'scale(1)' }} strokeWidth={1.5} />
              <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)' }}>Drop medical document</span>
              <span className="font-body" style={{ fontSize: 12, color: 'var(--dim)' }}>PDF · PNG · JPEG · TIFF · BMP</span>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {preview ? (
                <img src={preview} alt="Report" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 8, opacity: isPending ? 0.3 : 1, cursor: 'pointer' }}
                  onClick={() => !isPending && inputRef.current?.click()} />
              ) : (
                <div onClick={() => !isPending && inputRef.current?.click()}
                  role="button" tabIndex={0}
                  aria-label="Replace document"
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!isPending) inputRef.current?.click(); } }}
                  style={{ height: 160, background: 'var(--elevated)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, opacity: isPending ? 0.3 : 1, cursor: 'pointer' }}>
                  <FileText size={32} style={{ color: 'var(--muted)' }} />
                  <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>{file.name}</span>
                  <span className="font-body" style={{ fontSize: 10, color: 'var(--dim)' }}>{(file.size / 1024).toFixed(0)}KB</span>
                </div>
              )}
              {isPending && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={32} style={{ color: 'var(--cyan)', animation: 'spin 1s linear infinite' }} />
                </div>
              )}
            </div>
          )}
          <input ref={inputRef} type="file" accept="image/*,.pdf,.tiff,.bmp" hidden onChange={e => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
            e.target.value = '';
          }} />

          {/* Report Type Hint */}
          <div style={{ marginTop: 20 }}>
            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>REPORT TYPE</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {REPORT_TYPES.map(t => (
                <button key={t} data-cursor="hover" onClick={() => setReportTypeHint(t)} style={{
                  padding: '5px 12px', borderRadius: 16, fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer',
                  background: reportTypeHint === t ? 'var(--cyan)' : 'transparent',
                  color: reportTypeHint === t ? '#000' : 'var(--muted)',
                  border: reportTypeHint === t ? '1px solid var(--cyan)' : '1px solid var(--border)', transition: 'all 200ms'
                }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Patient ID */}
          <div style={{ marginTop: 16 }}>
            <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>PATIENT ID</label>
            <input value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="e.g. 104"
              style={{
                width: '100%', height: 36, background: 'var(--elevated)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '0 14px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none'
              }}
            />
          </div>

          <button data-cursor="hover" onClick={handleAnalyze} disabled={!file || isPending}
            style={{
              marginTop: 20, width: '100%', height: 44,
              background: (!file || isPending) ? 'rgba(0,229,255,0.3)' : 'var(--cyan)',
              color: '#000', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14,
              borderRadius: 8, border: 'none', opacity: (!file || isPending) ? 0.4 : 1, transition: 'all 200ms',
              cursor: (!file || isPending) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}>
            {isPending ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Extracting...</> : 'Extract & Analyze'}
          </button>
        </div>

        {/* RIGHT */}
        <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!result ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
              <FileText size={48} style={{ color: 'var(--dim)' }} strokeWidth={1} />
              <span className="font-heading" style={{ fontSize: 18, color: 'var(--muted)' }}>No report loaded</span>
              <span className="font-body" style={{ fontSize: 13, color: 'var(--dim)', maxWidth: 280, textAlign: 'center' }}>
                Upload a document to extract text and analyze findings with clinical OCR.
              </span>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>

              {/* Top banner: report type + health score */}
              <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--elevated)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {result.report_type && (
                    <span style={{
                      padding: '4px 10px', borderRadius: 12, fontSize: 11, fontFamily: 'var(--font-body)',
                      background: 'rgba(0,229,255,0.1)', color: 'var(--cyan)', border: '1px solid rgba(0,229,255,0.2)'
                    }}>{result.report_type}</span>
                  )}
                  {result.urgency && (
                    <span style={{
                      padding: '4px 10px', borderRadius: 12, fontSize: 11, fontFamily: 'var(--font-body)',
                      background: (SEVERITY_COLORS[result.urgency]?.bg || 'rgba(255,255,255,0.05)'),
                      color: (SEVERITY_COLORS[result.urgency]?.text || 'var(--muted)'),
                      border: `1px solid ${SEVERITY_COLORS[result.urgency]?.border || 'var(--border)'}`, textTransform: 'capitalize'
                    }}>{result.urgency} urgency</span>
                  )}
                </div>
                {result.extraction_method && (
                  <span className="font-body" style={{ fontSize: 10, color: 'var(--dim)' }}>Extracted via: {result.extraction_method}</span>
                )}
              </div>

              {/* 6 Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', position: 'relative', padding: '0 24px' }}>
                {tabs.map(t => (
                  <button key={t} data-cursor="hover" onClick={() => setActiveTab(t)} style={{
                    flex: 1, padding: '10px 0', background: 'transparent', border: 'none',
                    fontFamily: 'var(--font-body)', fontSize: 11,
                    color: activeTab === t ? 'var(--text)' : 'var(--muted)', position: 'relative', cursor: 'pointer'
                  }}>
                    {tabLabels[t]}
                    {activeTab === t && (
                      <motion.div layoutId="ocr-tab-underline"
                        style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, background: 'var(--cyan)' }}
                      />
                    )}
                  </button>
                ))}
              </div>

              <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
                <AnimatePresence mode="wait">
                  <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* ====== TAB 1: OVERVIEW ====== */}
                    {activeTab === 'overview' && (
                      <>
                        {/* Critical Alerts - pulsing red at TOP */}
                        {getCriticalAlerts().length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {getCriticalAlerts().map((alert, i) => (
                              <motion.div
                                key={i}
                                animate={{ boxShadow: ['0 0 0px rgba(239,68,68,0)', '0 0 16px rgba(239,68,68,0.3)', '0 0 0px rgba(239,68,68,0)'] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                style={{
                                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                                  borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10
                                }}
                              >
                                <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <motion.span
                                      animate={{ opacity: [1, 0.5, 1] }}
                                      transition={{ duration: 1.5, repeat: Infinity }}
                                      style={{
                                        fontSize: 9, fontFamily: 'var(--font-heading)', padding: '2px 6px',
                                        borderRadius: 4, background: 'rgba(239,68,68,0.2)', color: '#fca5a5',
                                        border: '1px solid rgba(239,68,68,0.4)', letterSpacing: '0.15em'
                                      }}
                                    >CRITICAL</motion.span>
                                    {alert.parameter && (
                                      <span className="font-heading" style={{ fontSize: 12, color: '#fca5a5' }}>{alert.parameter}: {alert.value}</span>
                                    )}
                                  </div>
                                  <span className="font-body" style={{ fontSize: 12, color: '#fca5a5', lineHeight: 1.5, display: 'block' }}>{alert.reason}</span>
                                  {alert.immediate_action && (
                                    <span className="font-body" style={{ fontSize: 11, color: 'var(--amber)', display: 'block', marginTop: 4 }}>
                                      Action: {alert.immediate_action}
                                    </span>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}

                        {/* Health Score + Executive Summary row */}
                        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                          {/* Health Score Gauge */}
                          {result.overall_health_score_numeric != null && (
                            <div style={{
                              background: 'var(--elevated)', borderRadius: 12, padding: 20,
                              border: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
                              alignItems: 'center', gap: 8, flexShrink: 0
                            }}>
                              <HealthScoreGauge score={result.overall_health_score_numeric} />
                            </div>
                          )}

                          {/* Executive Summary */}
                          <div style={{
                            flex: 1, background: 'var(--elevated)', borderRadius: 10, padding: 20,
                            borderLeft: '2px solid var(--cyan)'
                          }}>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>EXECUTIVE SUMMARY</span>
                            <p className="font-body" style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.8, margin: 0 }}>
                              {result.executive_summary || result.summary}
                            </p>
                          </div>
                        </div>

                        {/* Metadata row: report type badge, report_date, doctor_info, overall_status */}
                        <div style={{
                          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
                          padding: '10px 14px', background: 'var(--elevated)', borderRadius: 8,
                          border: '1px solid var(--border)'
                        }}>
                          {result.report_type && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
                              padding: '3px 10px', borderRadius: 12, fontFamily: 'var(--font-body)',
                              background: 'rgba(0,229,255,0.1)', color: 'var(--cyan)', border: '1px solid rgba(0,229,255,0.2)'
                            }}>
                              <FileText size={10} /> {result.report_type}
                            </span>
                          )}
                          {result.report_date && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
                              <Calendar size={10} /> {result.report_date}
                            </span>
                          )}
                          {result.doctor_info && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
                              <Stethoscope size={10} /> {result.doctor_info}
                            </span>
                          )}
                          {result.overall_status && (
                            <span style={{
                              marginLeft: 'auto', fontSize: 11, padding: '3px 10px', borderRadius: 12,
                              fontFamily: 'var(--font-heading)',
                              background: result.overall_status.toLowerCase().includes('normal') ? 'rgba(0,255,157,0.1)' :
                                result.overall_status.toLowerCase().includes('critical') ? 'rgba(255,59,92,0.1)' : 'rgba(255,149,0,0.1)',
                              color: result.overall_status.toLowerCase().includes('normal') ? 'var(--green)' :
                                result.overall_status.toLowerCase().includes('critical') ? '#fca5a5' : 'var(--amber)',
                              border: `1px solid ${result.overall_status.toLowerCase().includes('normal') ? 'rgba(0,255,157,0.2)' :
                                result.overall_status.toLowerCase().includes('critical') ? 'rgba(255,59,92,0.3)' : 'rgba(255,149,0,0.3)'}`
                            }}>{result.overall_status}</span>
                          )}
                        </div>

                        {/* Extraction method */}
                        {result.extraction_method && (
                          <span className="font-body" style={{ fontSize: 11, color: 'var(--dim)', fontStyle: 'italic' }}>
                            Extracted via: {result.extraction_method}
                          </span>
                        )}

                        {/* Conditions + Diagnoses */}
                        {(result.conditions?.length || result.diagnoses?.length) ? (
                          <div>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>DIAGNOSES / CONDITIONS</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {[...(result.conditions || []), ...(result.diagnoses || [])].map(c => (
                                <span key={c} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 4, border: '1px solid rgba(0,229,255,0.2)', color: 'var(--cyan)', background: 'rgba(0,229,255,0.05)', fontFamily: 'var(--font-body)' }}>{c}</span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {/* Key Findings */}
                        {result.key_findings?.length > 0 && (
                          <div>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>KEY FINDINGS</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {result.key_findings.map((f, i) => (
                                <div key={i} style={{ background: 'var(--elevated)', borderRadius: 6, padding: '10px 14px', border: '1px solid var(--border)' }}>
                                  <span className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{typeof f === 'string' ? f : (f as any).finding || JSON.stringify(f)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* ====== TAB 2: LAB VALUES ====== */}
                    {activeTab === 'labs' && (
                      <>
                        {sortedAbnormals.length > 0 ? (
                          <div>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 10 }}>
                              ABNORMAL VALUES ({sortedAbnormals.length})
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {sortedAbnormals.map((v: RichAbnormalValue, i: number) => {
                                const sev = SEVERITY_COLORS[v.severity] || SEVERITY_COLORS.low;
                                const isExpanded = expandedLabs.has(i);
                                const paramName = v.parameter || v.test || 'Unknown';
                                const refRange = v.reference_range || v.normal_range || '-';
                                const hasDetails = v.clinical_meaning || v.contributing_factors?.length || v.what_to_do;

                                return (
                                  <div key={i} style={{
                                    background: 'var(--elevated)', border: `1px solid ${sev.border}`,
                                    borderRadius: 8, overflow: 'hidden', boxShadow: sev.glow,
                                    cursor: hasDetails ? 'pointer' : 'default'
                                  }}>
                                    {/* Collapsed row */}
                                    <div
                                      onClick={() => hasDetails && toggleLabRow(i)}
                                      style={{
                                        display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.5fr 0.8fr 0.8fr 24px',
                                        alignItems: 'center', padding: '10px 14px', gap: 8
                                      }}
                                    >
                                      <span className="font-heading" style={{ fontSize: 12, color: 'var(--text)' }}>{paramName}</span>
                                      <span className="font-number" style={{ fontSize: 12, color: sev.text, fontWeight: 600 }}>
                                        {v.value}{v.unit ? ` ${v.unit}` : ''}
                                      </span>
                                      <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>{refRange}</span>
                                      <span className="font-number" style={{ fontSize: 11, color: sev.text }}>
                                        {v.deviation_percent != null ? `${v.deviation_direction === 'low' ? '-' : '+'}${v.deviation_percent}%` : '-'}
                                      </span>
                                      <span style={{
                                        fontSize: 9, padding: '2px 6px', borderRadius: 4, background: sev.bg,
                                        color: sev.text, border: `1px solid ${sev.border}`, fontFamily: 'var(--font-body)',
                                        textTransform: 'capitalize', textAlign: 'center'
                                      }}>{v.severity}</span>
                                      {hasDetails && (
                                        isExpanded ? <ChevronUp size={12} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={12} style={{ color: 'var(--muted)' }} />
                                      )}
                                    </div>

                                    {/* Expanded details */}
                                    {isExpanded && hasDetails && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        style={{
                                          borderTop: `1px solid ${sev.border}`, padding: '12px 14px',
                                          background: sev.bg, display: 'flex', flexDirection: 'column', gap: 8
                                        }}
                                      >
                                        {v.clinical_meaning && (
                                          <div>
                                            <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>CLINICAL MEANING</span>
                                            <span className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>{v.clinical_meaning}</span>
                                          </div>
                                        )}
                                        {v.contributing_factors && v.contributing_factors.length > 0 && (
                                          <div>
                                            <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>CONTRIBUTING FACTORS</span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                              {v.contributing_factors.map((f, fi) => (
                                                <span key={fi} style={{
                                                  fontSize: 10, padding: '2px 8px', borderRadius: 12,
                                                  background: 'rgba(0,229,255,0.08)', color: 'var(--cyan)',
                                                  border: '1px solid rgba(0,229,255,0.15)', fontFamily: 'var(--font-body)'
                                                }}>{f}</span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        {v.what_to_do && (
                                          <div>
                                            <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>WHAT TO DO</span>
                                            <span className="font-body" style={{ fontSize: 12, color: 'var(--green)', lineHeight: 1.6 }}>{v.what_to_do}</span>
                                          </div>
                                        )}
                                      </motion.div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 40, border: '1px dashed rgba(0,255,157,0.3)', borderRadius: 12, background: 'rgba(0,255,157,0.02)' }}>
                            <ShieldCheck size={48} style={{ color: 'var(--green)' }} strokeWidth={1} />
                            <span className="font-heading" style={{ fontSize: 16, color: 'var(--green)' }}>All values normal</span>
                            <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)' }}>No abnormal values detected in this report</span>
                          </div>
                        )}

                        {/* Normal Values - collapsible */}
                        {result.normal_values && result.normal_values.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <button
                              data-cursor="hover"
                              onClick={() => setShowNormal(!showNormal)}
                              style={{
                                background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
                                color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 12,
                                cursor: 'pointer', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6,
                                width: '100%', justifyContent: 'space-between'
                              }}
                            >
                              <span>Normal Values ({result.normal_values.length})</span>
                              {showNormal ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {showNormal && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                style={{ marginTop: 8 }}
                              >
                                <div style={{ background: 'var(--elevated)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr>
                                        {['Test', 'Value', 'Normal Range'].map(h => (
                                          <th key={h} className="font-body" style={{ fontSize: 10, color: 'var(--muted)', padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {result.normal_values.map((v, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                          <td className="font-body" style={{ fontSize: 12, color: 'var(--text)', padding: '6px 10px' }}>{v.test}</td>
                                          <td className="font-number" style={{ fontSize: 12, color: 'var(--green)', padding: '6px 10px' }}>{v.value}</td>
                                          <td className="font-body" style={{ fontSize: 11, color: 'var(--muted)', padding: '6px 10px' }}>{v.normal_range}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </motion.div>
                            )}
                          </div>
                        )}

                        {/* Abnormal Flags fallback */}
                        {sortedAbnormals.length === 0 && result.abnormal_flags?.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>FLAGGED ITEMS</span>
                            {result.abnormal_flags.map((flag, i) => (
                              <div key={i} style={{ background: 'var(--elevated)', border: '1px solid rgba(255,149,0,0.3)', borderRadius: 8, padding: '12px 16px', borderLeft: '4px solid var(--amber)', display: 'flex', alignItems: 'start', gap: 10 }}>
                                <AlertTriangle size={16} style={{ color: 'var(--amber)', marginTop: 2, flexShrink: 0 }} />
                                <span className="font-body" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{flag}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* ====== TAB 3: MEDICATIONS ====== */}
                    {activeTab === 'medications' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {getMedications().length > 0 ? getMedications().map((med: RichMedication, i: number) => (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: med.drug_lab_flags?.length ? '10px 10px 0 0' : 10, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                              <Pill size={18} style={{ color: 'var(--green)', marginTop: 2, flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <span className="font-heading" style={{ fontSize: 14, color: 'var(--text)', display: 'block' }}>{med.name}</span>
                                {med.dose && (
                                  <span className="font-body" style={{ fontSize: 12, color: 'var(--cyan)', display: 'block', marginTop: 2 }}>
                                    {med.dose}{med.frequency ? ` — ${med.frequency}` : ''}
                                  </span>
                                )}
                                {med.purpose && <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginTop: 4 }}>{med.purpose}</span>}
                              </div>
                            </div>
                            {/* Drug-Lab Flags */}
                            {med.drug_lab_flags && med.drug_lab_flags.length > 0 && (
                              <div style={{
                                background: 'rgba(255,59,92,0.06)', border: '1px solid rgba(255,59,92,0.2)',
                                borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '8px 14px',
                                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'
                              }}>
                                <AlertTriangle size={12} style={{ color: '#ef4444', flexShrink: 0 }} />
                                {med.drug_lab_flags.map((flag, fi) => (
                                  <span key={fi} className="font-body" style={{ fontSize: 11, color: '#fca5a5' }}>{flag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        )) : (
                          <span className="font-body" style={{ fontSize: 13, color: 'var(--muted)' }}>No medications found in document.</span>
                        )}

                        {/* Drug-Lab Interactions section */}
                        {result.drug_lab_interactions && result.drug_lab_interactions.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                              <Zap size={14} style={{ color: 'var(--amber)' }} />
                              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>DRUG-LAB INTERACTIONS</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {result.drug_lab_interactions.map((interaction, i) => (
                                <div key={i} style={{
                                  background: 'rgba(255,149,0,0.05)', border: '1px solid rgba(255,149,0,0.2)',
                                  borderRadius: 8, padding: '12px 14px', borderLeft: '3px solid var(--amber)'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                    <span className="font-heading" style={{ fontSize: 12, color: 'var(--amber)' }}>{interaction.drug}</span>
                                    <span className="font-body" style={{ fontSize: 10, color: 'var(--dim)' }}>affects</span>
                                    <span className="font-heading" style={{ fontSize: 12, color: 'var(--cyan)' }}>{interaction.lab_finding}</span>
                                  </div>
                                  <span className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, display: 'block' }}>{interaction.interaction}</span>
                                  {interaction.action && (
                                    <span className="font-body" style={{ fontSize: 11, color: 'var(--green)', display: 'block', marginTop: 4 }}>
                                      Action: {interaction.action}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ====== TAB 4: ACTION PLAN ====== */}
                    {activeTab === 'actions' && (
                      <>
                        {/* Action Items */}
                        {result.action_items && result.action_items.length > 0 ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                              <ClipboardList size={14} style={{ color: 'var(--cyan)' }} />
                              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>ACTION ITEMS</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {(result.action_items as ActionItem[]).sort((a, b) => a.priority - b.priority).map((item, i) => {
                                const urgColor = URGENCY_COLORS[item.urgency] || URGENCY_COLORS.routine;
                                return (
                                  <div key={i} style={{
                                    background: 'var(--elevated)', border: '1px solid var(--border)',
                                    borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12,
                                    borderLeft: `3px solid ${urgColor.text}`
                                  }}>
                                    <div style={{
                                      width: 24, height: 24, borderRadius: '50%', background: urgColor.bg,
                                      border: `1px solid ${urgColor.border}`, display: 'flex', alignItems: 'center',
                                      justifyContent: 'center', flexShrink: 0
                                    }}>
                                      <span className="font-number" style={{ fontSize: 11, color: urgColor.text, fontWeight: 700 }}>{item.priority}</span>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{
                                          fontSize: 9, padding: '2px 6px', borderRadius: 4, background: urgColor.bg,
                                          color: urgColor.text, border: `1px solid ${urgColor.border}`,
                                          fontFamily: 'var(--font-body)', textTransform: 'capitalize', letterSpacing: '0.05em'
                                        }}>{item.urgency}</span>
                                        {item.timeframe && (
                                          <span className="font-body" style={{ fontSize: 10, color: 'var(--dim)' }}>{item.timeframe}</span>
                                        )}
                                      </div>
                                      <span className="font-body" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{item.action}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 32 }}>
                            <ClipboardList size={36} style={{ color: 'var(--dim)' }} strokeWidth={1} />
                            <span className="font-body" style={{ fontSize: 13, color: 'var(--muted)' }}>No action items generated for this report.</span>
                          </div>
                        )}

                        {/* Specialist Referrals */}
                        {result.specialist_referrals && result.specialist_referrals.length > 0 && (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                              <Stethoscope size={14} style={{ color: 'var(--amber)' }} />
                              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>SPECIALIST REFERRALS</span>
                            </div>
                            <div className="form-grid-2" style={{ gap: 8 }}>
                              {result.specialist_referrals.map((ref, i) => {
                                const urgColor = URGENCY_COLORS[ref.urgency] || URGENCY_COLORS.routine;
                                return (
                                  <div key={i} style={{
                                    background: 'var(--elevated)', border: '1px solid var(--border)',
                                    borderRadius: 8, padding: '12px 14px'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                      <span className="font-heading" style={{ fontSize: 13, color: 'var(--text)' }}>{ref.specialty}</span>
                                      <span style={{
                                        fontSize: 9, padding: '2px 6px', borderRadius: 4, background: urgColor.bg,
                                        color: urgColor.text, border: `1px solid ${urgColor.border}`,
                                        fontFamily: 'var(--font-body)', textTransform: 'capitalize'
                                      }}>{ref.urgency}</span>
                                    </div>
                                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{ref.reason}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Follow-up Tests */}
                        {result.follow_up_tests && result.follow_up_tests.length > 0 && (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                              <Activity size={14} style={{ color: 'var(--cyan)' }} />
                              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>FOLLOW-UP TESTS</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {result.follow_up_tests.map((test, i) => (
                                <div key={i} style={{
                                  background: 'var(--elevated)', border: '1px solid var(--border)',
                                  borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10
                                }}>
                                  <Search size={12} style={{ color: 'var(--cyan)', marginTop: 3, flexShrink: 0 }} />
                                  <div style={{ flex: 1 }}>
                                    <span className="font-heading" style={{ fontSize: 12, color: 'var(--text)', display: 'block' }}>{test.test}</span>
                                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 2 }}>{test.reason}</span>
                                    {test.timeframe && (
                                      <span className="font-body" style={{ fontSize: 10, color: 'var(--dim)', display: 'block', marginTop: 2 }}>Timeframe: {test.timeframe}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Lifestyle Recommendations */}
                        {result.lifestyle_recommendations && result.lifestyle_recommendations.length > 0 && (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                              <Heart size={14} style={{ color: 'var(--green)' }} />
                              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>LIFESTYLE RECOMMENDATIONS</span>
                            </div>
                            <div style={{
                              background: 'var(--elevated)', border: '1px solid var(--border)',
                              borderRadius: 8, padding: '14px 18px'
                            }}>
                              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {result.lifestyle_recommendations.map((rec, i) => (
                                  <li key={i} className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
                                    {rec}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}

                        {/* Legacy patient_action_items fallback */}
                        {(!result.action_items || result.action_items.length === 0) && result.patient_action_items && result.patient_action_items.length > 0 && (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <ClipboardList size={14} style={{ color: 'var(--green)' }} />
                              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>PATIENT ACTION ITEMS</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {result.patient_action_items.map((item, i) => (
                                <div key={i} style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.1)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                  <span className="font-number" style={{ fontSize: 11, color: 'var(--green)', width: 18, flexShrink: 0 }}>{i + 1}.</span>
                                  <span className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* ====== TAB 5: PLAIN LANGUAGE ====== */}
                    {activeTab === 'plain' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            data-cursor="hover"
                            onClick={() => handleReadAloud(result.patient_plain_language_summary || result.summary || '')}
                            style={{
                              background: isSpeaking ? 'rgba(255,59,92,0.1)' : 'rgba(0,229,255,0.08)',
                              border: `1px solid ${isSpeaking ? 'rgba(255,59,92,0.3)' : 'rgba(0,229,255,0.2)'}`,
                              borderRadius: 8, color: isSpeaking ? '#fca5a5' : 'var(--cyan)',
                              fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer',
                              padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 200ms'
                            }}
                          >
                            {isSpeaking ? <><VolumeX size={14} /> Stop Reading</> : <><Volume2 size={14} /> Read Aloud</>}
                          </button>
                          <select
                            value={ttsLanguage}
                            onChange={(e) => setTtsLanguage(e.target.value)}
                            style={{
                              background: 'var(--elevated)', border: '1px solid var(--border)',
                              borderRadius: 8, color: 'var(--cyan)', fontFamily: 'var(--font-body)', fontSize: 11,
                              cursor: 'pointer', padding: '6px 8px', outline: 'none', appearance: 'none',
                              WebkitAppearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\'%3E%3Cpath d=\'M0 0l5 6 5-6z\' fill=\'%2300E5FF\'/%3E%3C/svg%3E")',
                              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', paddingRight: 20,
                              minWidth: 90, transition: 'all 200ms'
                            }}
                          >
                            {Object.entries(TTS_LANGUAGES).map(([code, { label }]) => (
                              <option key={code} value={code} style={{ background: '#0a0a14', color: '#e0e0e0' }}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <button
                            data-cursor="hover"
                            onClick={() => copyToClipboard(result.patient_plain_language_summary || result.summary || '', setCopied)}
                            style={{
                              background: 'var(--elevated)', border: '1px solid var(--border)',
                              borderRadius: 8, color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 12,
                              cursor: 'pointer', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6
                            }}
                          >
                            <Copy size={12} /> {copied ? 'COPIED!' : 'Copy'}
                          </button>
                        </div>

                        {/* Plain language text */}
                        <div style={{
                          background: 'var(--elevated)', borderRadius: 12, padding: '28px 24px',
                          border: '1px solid var(--border)', borderLeft: '3px solid var(--green)'
                        }}>
                          {result.patient_plain_language_summary ? (
                            <p className="font-body" style={{
                              fontSize: 15, color: 'var(--text)', lineHeight: 2.0, margin: 0
                            }}>
                              {result.patient_plain_language_summary}
                            </p>
                          ) : result.summary ? (
                            <p className="font-body" style={{
                              fontSize: 15, color: 'var(--text)', lineHeight: 2.0, margin: 0
                            }}>
                              {result.summary}
                            </p>
                          ) : (
                            <span className="font-body" style={{ fontSize: 14, color: 'var(--muted)' }}>
                              No plain language summary available for this report.
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ====== TAB 6: CLINICIAN SUMMARY ====== */}
                    {activeTab === 'clinician' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Copy button */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            data-cursor="hover"
                            onClick={() => copyToClipboard(result.clinician_summary || result.summary || '', setCopiedClinician)}
                            style={{
                              background: 'var(--elevated)', border: '1px solid var(--border)',
                              borderRadius: 8, color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 12,
                              cursor: 'pointer', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6
                            }}
                          >
                            <Copy size={12} /> {copiedClinician ? 'COPIED!' : 'Copy to Clipboard'}
                          </button>
                        </div>

                        {/* Clinician summary in monospace */}
                        <div style={{
                          background: 'var(--elevated)', borderRadius: 12, padding: '20px 18px',
                          border: '1px solid var(--border)'
                        }}>
                          {result.clinician_summary ? (
                            <pre style={{
                              fontSize: 12, color: 'var(--text)', lineHeight: 1.8,
                              whiteSpace: 'pre-wrap', margin: 0,
                              fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace'
                            }}>
                              {result.clinician_summary}
                            </pre>
                          ) : result.summary ? (
                            <pre style={{
                              fontSize: 12, color: 'var(--text)', lineHeight: 1.8,
                              whiteSpace: 'pre-wrap', margin: 0,
                              fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace'
                            }}>
                              {result.summary}
                            </pre>
                          ) : (
                            <span className="font-body" style={{ fontSize: 14, color: 'var(--muted)' }}>
                              No clinician summary available for this report.
                            </span>
                          )}
                        </div>

                        {/* ICD-10 Codes */}
                        {result.icd10_codes && result.icd10_codes.length > 0 && (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                              <Star size={14} style={{ color: 'var(--amber)' }} />
                              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>ICD-10 CODES</span>
                            </div>
                            <div style={{ background: 'var(--elevated)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr>
                                    <th className="font-body" style={{ fontSize: 10, color: 'var(--muted)', padding: '8px 14px', textAlign: 'left', borderBottom: '1px solid var(--border)', width: 100 }}>CODE</th>
                                    <th className="font-body" style={{ fontSize: 10, color: 'var(--muted)', padding: '8px 14px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>DESCRIPTION</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {result.icd10_codes.map((code, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                      <td style={{ padding: '8px 14px' }}>
                                        <span style={{
                                          fontSize: 11, padding: '2px 8px', borderRadius: 4,
                                          background: 'rgba(0,229,255,0.08)', color: 'var(--cyan)',
                                          border: '1px solid rgba(0,229,255,0.15)',
                                          fontFamily: '"JetBrains Mono", monospace', fontWeight: 600
                                        }}>{code.code}</span>
                                      </td>
                                      <td className="font-body" style={{ fontSize: 12, color: 'var(--text)', padding: '8px 14px' }}>{code.description}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
                <button data-cursor="hover" onClick={() => handleExportPdf(result.session_id)} style={{
                  flex: 1, height: 36, borderRadius: 8, background: 'transparent',
                  border: '1px solid rgba(0,229,255,0.25)', color: 'var(--cyan)',
                  fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 200ms'
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                ><Download size={14} /> Export PDF</button>
                <button data-cursor="hover" onClick={() => { setResult(null); setFile(null); setPreview(null); }} style={{
                  flex: 1, height: 36, borderRadius: 8, background: 'transparent',
                  border: '1px solid rgba(0,229,255,0.25)', color: 'var(--cyan)',
                  fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 200ms'
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                ><RotateCcw size={14} /> New Report</button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OCRReports;
