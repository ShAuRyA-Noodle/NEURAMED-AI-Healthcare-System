import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Copy, ShieldCheck, AlertTriangle, Heart, Pill, ClipboardList, Search, Loader2, Download, RotateCcw } from 'lucide-react';
import { useOcrAnalysis } from '@/hooks/useOcrAnalysis';
import { useToast } from '@/hooks/useToast';
import type { ReportAnalysisResult, AbnormalValue, MedicationDetail } from '@/types';

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

const SEVERITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  critical: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#fca5a5' },
  high: { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', text: '#fdba74' },
  medium: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)', text: '#fde047' },
  low: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: '#86efac' },
};

const REPORT_TYPES = ['Auto-Detect', 'Blood Work', 'Radiology', 'Pathology', 'Discharge Summary', 'Prescription'];

const OCRReports = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [patientId, setPatientId] = useState('');
  const [reportTypeHint, setReportTypeHint] = useState('Auto-Detect');
  const [result, setResult] = useState<ReportAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'labs' | 'medications' | 'raw' | 'summary'>('overview');
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchText, setSearchText] = useState('');
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
      const response = await fetch(`${base}/api/sessions/${sessionId}/export-pdf`);
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

  const tabs = ['overview', 'labs', 'medications', 'raw', 'summary'] as const;
  const tabLabels = { overview: 'Overview', labs: 'Lab Values', medications: 'Medications', raw: 'Full Report', summary: 'Summary Card' };
  const healthScore = result?.overall_health_score;

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

      <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 24 }}>
        {/* LEFT */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' }}>
          {/* Drop zone */}
          {!file ? (
            <div
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
                <div onClick={() => !isPending && inputRef.current?.click()} style={{ height: 160, background: 'var(--elevated)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, opacity: isPending ? 0.3 : 1, cursor: 'pointer' }}>
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
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                {healthScore && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Heart size={14} style={{ color: 'var(--green)' }} />
                    <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>Health Score: </span>
                    <span className="font-heading" style={{ fontSize: 14, color: 'var(--green)' }}>{healthScore}</span>
                  </div>
                )}
              </div>

              {/* 5 Tabs */}
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

                    {activeTab === 'overview' && (
                      <>
                        {/* Critical Alerts */}
                        {result.critical_alerts && result.critical_alerts.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {result.critical_alerts.map((alert, i) => (
                              <div key={i} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                                <span className="font-body" style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.5 }}>{alert}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Summary */}
                        <div style={{ background: 'var(--elevated)', borderRadius: 10, padding: 20, borderLeft: '2px solid var(--cyan)' }}>
                          <p className="font-body" style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.8, margin: 0 }}>{result.summary}</p>
                        </div>

                        {/* Conditions + Diagnoses */}
                        {(result.conditions?.length || result.diagnoses?.length) && (
                          <div>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>DIAGNOSES / CONDITIONS</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {[...(result.conditions || []), ...(result.diagnoses || [])].map(c => (
                                <span key={c} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 4, border: '1px solid rgba(0,229,255,0.2)', color: 'var(--cyan)', background: 'rgba(0,229,255,0.05)', fontFamily: 'var(--font-body)' }}>{c}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Patient Action Items */}
                        {result.patient_action_items && result.patient_action_items.length > 0 && (
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

                    {activeTab === 'labs' && (
                      <>
                        {/* Abnormal Values */}
                        {result.abnormal_values && result.abnormal_values.length > 0 ? (
                          <div>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 10 }}>ABNORMAL VALUES</span>
                            <div style={{ background: 'var(--elevated)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr>
                                    {['Test', 'Value', 'Normal Range', 'Interpretation', 'Severity'].map(h => (
                                      <th key={h} className="font-body" style={{ fontSize: 10, color: 'var(--muted)', padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(result.abnormal_values as AbnormalValue[]).map((v, i) => {
                                    const sev = SEVERITY_COLORS[v.severity] || SEVERITY_COLORS.low;
                                    return (
                                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td className="font-body" style={{ fontSize: 12, color: 'var(--text)', padding: '8px 10px', fontWeight: 600 }}>{v.test}</td>
                                        <td className="font-number" style={{ fontSize: 12, color: sev.text, padding: '8px 10px' }}>{v.value}</td>
                                        <td className="font-body" style={{ fontSize: 11, color: 'var(--muted)', padding: '8px 10px' }}>{v.normal_range}</td>
                                        <td className="font-body" style={{ fontSize: 11, color: 'var(--text)', padding: '8px 10px' }}>{v.interpretation}</td>
                                        <td style={{ padding: '8px 10px' }}>
                                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: sev.bg, color: sev.text, border: `1px solid ${sev.border}`, fontFamily: 'var(--font-body)', textTransform: 'capitalize' }}>{v.severity}</span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 40, border: '1px dashed rgba(0,255,157,0.3)', borderRadius: 12, background: 'rgba(0,255,157,0.02)' }}>
                            <ShieldCheck size={48} style={{ color: 'var(--green)' }} strokeWidth={1} />
                            <span className="font-heading" style={{ fontSize: 16, color: 'var(--green)' }}>No abnormal values detected</span>
                          </div>
                        )}

                        {/* Normal Values */}
                        {result.normal_values && result.normal_values.length > 0 && (
                          <details style={{ marginTop: 8 }}>
                            <summary className="font-body" style={{ fontSize: 12, color: 'var(--muted)', cursor: 'pointer', padding: '8px 0' }}>
                              Normal Values ({result.normal_values.length})
                            </summary>
                            <div style={{ background: 'var(--elevated)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', marginTop: 8 }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                          </details>
                        )}

                        {/* Abnormal Flags fallback */}
                        {(!result.abnormal_values || result.abnormal_values.length === 0) && result.abnormal_flags?.length > 0 && (
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

                    {activeTab === 'medications' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {result.medications?.length > 0 ? result.medications.map((m, i) => {
                          const med: MedicationDetail = typeof m === 'string' ? { name: m, dose: '', frequency: '', purpose: '' } : m;
                          return (
                            <div key={i} style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                              <Pill size={18} style={{ color: 'var(--green)', marginTop: 2, flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <span className="font-heading" style={{ fontSize: 14, color: 'var(--text)', display: 'block' }}>{med.name}</span>
                                {med.dose && <span className="font-body" style={{ fontSize: 12, color: 'var(--cyan)', display: 'block', marginTop: 2 }}>{med.dose} — {med.frequency}</span>}
                                {med.purpose && <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginTop: 4 }}>{med.purpose}</span>}
                              </div>
                            </div>
                          );
                        }) : (
                          <span className="font-body" style={{ fontSize: 13, color: 'var(--muted)' }}>No medications found in document.</span>
                        )}
                      </div>
                    )}

                    {activeTab === 'raw' && (
                      <div style={{ position: 'relative' }}>
                        {/* Search + Copy */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                            <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search in text..."
                              style={{ width: '100%', height: 32, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px 0 30px', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text)', outline: 'none' }}
                            />
                          </div>
                          <button data-cursor="hover" onClick={() => { navigator.clipboard.writeText(result.extracted_text || ''); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                            style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)', fontSize: 11, padding: '0 12px', cursor: 'pointer' }}>
                            <Copy size={12} /> {copied ? 'COPIED!' : 'COPY'}
                          </button>
                        </div>
                        <div style={{ background: 'var(--elevated)', borderRadius: 10, padding: '20px 16px', border: '1px solid var(--border)', maxHeight: 400, overflowY: 'auto' }}>
                          {result.extracted_text ? (
                            <pre className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>
                              {searchText ? result.extracted_text.split(new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part: string, i: number) =>
                                part.toLowerCase() === searchText.toLowerCase() ? <mark key={i} style={{ background: 'rgba(0,229,255,0.3)', color: 'var(--text)' }}>{part}</mark> : part
                              ) : highlightMedical(result.extracted_text)}
                            </pre>
                          ) : (
                            <span className="font-body" style={{ fontSize: 13, color: 'var(--muted)' }}>No text could be extracted.</span>
                          )}
                        </div>
                      </div>
                    )}

                    {activeTab === 'summary' && (
                      <div style={{ background: 'var(--elevated)', borderRadius: 12, padding: 24, border: '1px solid var(--border)' }}>
                        <div style={{ textAlign: 'center', marginBottom: 20 }}>
                          <span className="font-heading" style={{ fontSize: 18, color: 'var(--cyan)', display: 'block' }}>Patient Health Summary</span>
                          <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)' }}>Generated by NEURAMED AI</span>
                        </div>

                        {healthScore && (
                          <div style={{ textAlign: 'center', marginBottom: 20 }}>
                            <span className="font-number" style={{ fontSize: 36, color: 'var(--green)' }}>{healthScore}</span>
                            <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)', display: 'block' }}>Overall Health Score</span>
                          </div>
                        )}

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                          <p className="font-body" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8, margin: 0 }}>{result.summary}</p>
                        </div>

                        {result.follow_up_instructions && result.follow_up_instructions.length > 0 && (
                          <div style={{ marginTop: 16 }}>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>FOLLOW-UP INSTRUCTIONS</span>
                            <ul style={{ margin: 0, paddingLeft: 20 }}>
                              {result.follow_up_instructions.map((inst, i) => (
                                <li key={i} className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, marginBottom: 4 }}>{inst}</li>
                              ))}
                            </ul>
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
