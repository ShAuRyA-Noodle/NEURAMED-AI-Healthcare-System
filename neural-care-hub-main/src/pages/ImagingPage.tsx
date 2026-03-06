import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, Brain, AlertTriangle, CheckCircle, UploadCloud, Download, RotateCcw, ZoomIn, X, Loader2 } from 'lucide-react';
import { useImageAnalysis } from '@/hooks/useImageAnalysis';
import { useToast } from '@/hooks/useToast';
import type { ScanAnalysisResult, AnomalyRegion } from '@/types';

const MEDICAL_TERMS = ['opacity', 'consolidation', 'pneumonia', 'effusion', 'cardiac', 'lobe', 'infiltrate', 'nodule', 'edema', 'fracture', 'lesion', 'mass', 'density', 'calcification', 'atelectasis', 'cardiomegaly', 'pleural', 'mediastinal', 'parenchymal', 'interstitial'];

const highlightMedical = (text: string) => {
  if (!text) return null;
  const regex = new RegExp(`\\b(${MEDICAL_TERMS.join('|')})\\b`, 'gi');
  return text.split(regex).map((part, i) =>
    MEDICAL_TERMS.some(t => t.toLowerCase() === part.toLowerCase())
      ? <span key={i} style={{ color: 'var(--cyan)', fontWeight: 600 }}>{part}</span>
      : part
  );
};

const ACR_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  '1': { bg: 'rgba(34,197,94,0.12)', border: '#22c55e', text: '#86efac', label: 'ACR 1 — Negative' },
  '2': { bg: 'rgba(34,197,94,0.08)', border: '#4ade80', text: '#86efac', label: 'ACR 2 — Benign' },
  '3': { bg: 'rgba(234,179,8,0.12)', border: '#eab308', text: '#fde047', label: 'ACR 3 — Probably Benign' },
  '4': { bg: 'rgba(249,115,22,0.12)', border: '#f97316', text: '#fdba74', label: 'ACR 4 — Suspicious' },
  '5': { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', text: '#fca5a5', label: 'ACR 5 — Highly Suggestive' },
};

const ImagingAI = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanType, setScanType] = useState('CT Scan');
  const [patientAge, setPatientAge] = useState('');
  const [clinicalIndication, setClinicalIndication] = useState('');
  const [result, setResult] = useState<ScanAnalysisResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState<'report' | 'differentials' | 'recommendations' | 'data'>('report');
  const [showZoom, setShowZoom] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Slider state
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  const { mutateAsync: analyze, isPending } = useImageAnalysis();

  const handleFile = useCallback((f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
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
      const res = await analyze({ file, scanType });
      setResult(res);
      setSliderPos(50);
      setActiveTab('report');
    } catch {
      addToast('error', 'Imaging analysis failed');
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!sliderRef.current || !result) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const pos = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
    setSliderPos(pos);
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
      a.download = `neuramed-imaging-${sessionId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'PDF downloaded successfully');
    } catch {
      addToast('error', 'Failed to generate PDF');
    }
  };

  const handleDownloadAnnotated = () => {
    if (!result?.annotated_image_b64) return;
    const a = document.createElement('a');
    a.href = `data:image/jpeg;base64,${result.annotated_image_b64}`;
    a.download = `annotated-scan-${result.session_id}.jpg`;
    a.click();
  };

  const scanTypes = ['CT Scan', 'MRI', 'X-Ray', 'Ultrasound'];
  const confColor = (v: number) => v > 80 ? 'var(--green)' : v > 60 ? 'var(--cyan)' : 'var(--amber)';
  const acr = result?.acr_category?.replace(/[^1-5]/g, '') || '';
  const acrInfo = ACR_COLORS[acr];

  const tabs = ['report', 'differentials', 'recommendations', 'data'] as const;
  const tabLabels = { report: 'Report', differentials: 'Differentials', recommendations: 'Recommendations', data: 'Analysis Data' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🧠</div>
        <div>
          <h1 className="font-heading" style={{ fontSize: 24, color: 'var(--text)', margin: 0 }}>Medical Imaging AI</h1>
          <p className="font-body" style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>AI-powered radiological analysis with ACR classification</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 24 }}>
        {/* LEFT */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' }}>
          {/* Drop zone */}
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
              transition: 'all 200ms', position: 'relative', overflow: 'hidden', cursor: isPending ? 'default' : 'pointer'
            }}
          >
            {preview ? (
              <>
                <img src={preview} alt="Scan" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: isPending ? 0.3 : 1 }} />
                {/* DICOM-style corner annotations */}
                <span className="font-number" style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, color: 'var(--cyan)', opacity: 0.6 }}>{scanType.toUpperCase()}</span>
                <span className="font-number" style={{ position: 'absolute', top: 8, right: 8, fontSize: 9, color: 'var(--cyan)', opacity: 0.6 }}>NEURAMED AI</span>
                <span className="font-number" style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 9, color: 'var(--cyan)', opacity: 0.6 }}>{patientAge ? `Age: ${patientAge}` : ''}</span>
                {!isPending && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 200ms' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                    <span className="font-body" style={{ color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><UploadCloud size={16} /> Replace Scan</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <ScanLine size={36} style={{ color: 'var(--muted)', transform: dragOver ? 'scale(1.15)' : 'scale(1)', transition: 'all 200ms' }} strokeWidth={1.5} />
                <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)' }}>Drop scan here</span>
                <span className="font-body" style={{ fontSize: 12, color: 'var(--dim)' }}>CT · MRI · X-Ray · Ultrasound · PNG · JPEG</span>
              </>
            )}

            {isPending && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <motion.div
                  animate={{ y: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  style={{ width: '100%', height: 2, background: 'var(--cyan)', boxShadow: '0 0 10px 2px var(--cyan)', filter: 'blur(1px)' }}
                />
                <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center' }}>
                  <span className="font-number" style={{ color: 'var(--cyan)', fontSize: 14 }}>ANALYZING SCAN...</span>
                </div>
              </div>
            )}
          </div>

          {file && (
            <div className="font-body" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
              {file.name} — {(file.size / 1024).toFixed(0)}KB
            </div>
          )}
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

          {/* Scan Type Pills */}
          <div style={{ marginTop: 20 }}>
            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 10 }}>SCAN TYPE</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {scanTypes.map(t => (
                <button key={t} data-cursor="hover" onClick={() => setScanType(t)} style={{
                  fontFamily: 'var(--font-body)', fontSize: 12, borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
                  background: scanType === t ? 'var(--cyan)' : 'transparent',
                  color: scanType === t ? '#000' : 'var(--muted)',
                  border: scanType === t ? '1px solid var(--cyan)' : '1px solid var(--border)', transition: 'all 200ms',
                }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Patient Age + Clinical Indication */}
          <div style={{ marginTop: 16 }}>
            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>PATIENT AGE</span>
            <input value={patientAge} onChange={e => setPatientAge(e.target.value)} placeholder="e.g. 45"
              style={{
                width: '100%', height: 36, background: 'var(--elevated)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none'
              }}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>CLINICAL INDICATION</span>
            <textarea value={clinicalIndication} onChange={e => setClinicalIndication(e.target.value)} placeholder="e.g. Rule out pneumonia, persistent cough..."
              style={{
                width: '100%', height: 60, background: 'var(--elevated)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text)', outline: 'none', resize: 'none'
              }}
            />
          </div>

          <button data-cursor="hover" onClick={handleAnalyze} disabled={!file || isPending}
            style={{
              marginTop: 20, width: '100%', height: 44,
              background: (!file || isPending) ? 'rgba(0,229,255,0.3)' : 'var(--cyan)',
              color: '#000', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14,
              borderRadius: 8, border: 'none', opacity: (!file || isPending) ? 0.4 : 1,
              transition: 'all 200ms', cursor: (!file || isPending) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}>
            {isPending ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</> : 'Run Full Analysis'}
          </button>
        </div>

        {/* RIGHT */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!result ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
              <Brain size={48} style={{ color: 'var(--dim)' }} strokeWidth={1} />
              <span className="font-heading" style={{ fontSize: 18, color: 'var(--muted)' }}>Upload a scan to begin</span>
              <span className="font-body" style={{ fontSize: 13, color: 'var(--dim)', maxWidth: 280, textAlign: 'center' }}>
                AI vision models detect anomalies, segment regions, and provide ACR classifications.
              </span>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>

              {/* ACR Category Banner */}
              {acrInfo && (
                <div style={{
                  padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: acrInfo.bg, borderBottom: `1px solid ${acrInfo.border}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="font-heading" style={{ fontSize: 14, color: acrInfo.text }}>{acrInfo.label}</span>
                  </div>
                  {result.acr_description && (
                    <span className="font-body" style={{ fontSize: 11, color: acrInfo.text, opacity: 0.8 }}>{result.acr_description}</span>
                  )}
                </div>
              )}

              {/* Primary Finding */}
              {result.primary_finding && (
                <div style={{ padding: '12px 24px', background: 'rgba(0,229,255,0.05)', borderBottom: '1px solid var(--border)' }}>
                  <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>PRIMARY FINDING: </span>
                  <span className="font-heading" style={{ fontSize: 13, color: 'var(--cyan)' }}>{result.primary_finding}</span>
                </div>
              )}

              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflowY: 'auto' }}>
                {/* Image Before/After slider */}
                <div
                  ref={sliderRef}
                  onMouseMove={handleMouseMove}
                  onTouchMove={handleMouseMove}
                  style={{ height: 240, borderRadius: 10, overflow: 'hidden', position: 'relative', background: '#000', cursor: 'ew-resize', userSelect: 'none' }}
                >
                  <img src={preview!} alt="Original" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} />
                  {result.annotated_image_b64 && (
                    <div style={{ position: 'absolute', inset: 0, clipPath: `polygon(${sliderPos}% 0, 100% 0, 100% 100%, ${sliderPos}% 100%)` }}>
                      <img src={`data:image/jpeg;base64,${result.annotated_image_b64}`} alt="Annotated" style={{ width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} />
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`, width: 2, background: 'var(--cyan)', transform: 'translateX(-50%)' }}>
                    <div style={{ width: 16, height: 32, background: 'var(--cyan)', borderRadius: 4, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 2, height: 12, background: '#000', borderRadius: 1 }} />
                    </div>
                  </div>
                  <span className="font-body" style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4, pointerEvents: 'none' }}>ORIGINAL</span>
                  <span className="font-body" style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, color: 'var(--cyan)', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4, pointerEvents: 'none' }}>AI ANNOTATED</span>
                  {/* Zoom button */}
                  <button onClick={(e) => { e.stopPropagation(); setShowZoom(true); }} style={{
                    position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 6, padding: '4px 8px', color: '#fff', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, cursor: 'pointer'
                  }}>
                    <ZoomIn size={12} /> Zoom
                  </button>
                </div>

                {/* Detection + Confidence Row */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{
                    flex: 1, padding: '12px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10,
                    background: result.anomaly_detected ? 'rgba(255,59,92,0.1)' : 'rgba(0,255,157,0.08)',
                    border: `1px solid ${result.anomaly_detected ? 'rgba(255,59,92,0.25)' : 'rgba(0,255,157,0.25)'}`,
                  }}>
                    {result.anomaly_detected
                      ? <><AlertTriangle size={16} style={{ color: 'var(--red)' }} /><span className="font-heading" style={{ fontSize: 13, color: 'var(--red)' }}>ANOMALY DETECTED</span></>
                      : <><CheckCircle size={16} style={{ color: 'var(--green)' }} /><span className="font-heading" style={{ fontSize: 13, color: 'var(--green)' }}>NO ANOMALIES</span></>
                    }
                  </div>
                  <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>CONFIDENCE</span>
                    <span className="font-number" style={{ fontSize: 16, color: confColor(result.confidence * 100) }}>{Math.round(result.confidence * 100)}%</span>
                  </div>
                </div>

                {/* Anomaly Regions Table */}
                {result.anomaly_regions?.length > 0 && (
                  <div>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>DETECTED REGIONS</span>
                    <div style={{ background: 'var(--elevated)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {['Region', 'Area', 'Intensity', 'Confidence', 'Size'].map(h => (
                              <th key={h} className="font-body" style={{ fontSize: 10, color: 'var(--muted)', padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.anomaly_regions.map((r: AnomalyRegion) => (
                            <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td className="font-body" style={{ fontSize: 12, color: 'var(--text)', padding: '8px 12px' }}>{r.location || `Region ${r.id}`}</td>
                              <td className="font-number" style={{ fontSize: 11, color: 'var(--muted)', padding: '8px 12px' }}>{r.area}px²</td>
                              <td className="font-number" style={{ fontSize: 11, color: 'var(--muted)', padding: '8px 12px' }}>{Math.round(r.mean_intensity)}</td>
                              <td className="font-number" style={{ fontSize: 11, color: confColor(r.confidence * 100), padding: '8px 12px' }}>{Math.round(r.confidence * 100)}%</td>
                              <td className="font-number" style={{ fontSize: 11, color: 'var(--muted)', padding: '8px 12px' }}>{r.size_mm || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4 Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', position: 'relative' }}>
                  {tabs.map(t => (
                    <button key={t} data-cursor="hover" onClick={() => setActiveTab(t)} style={{
                      flex: 1, padding: '10px 0', background: 'transparent', border: 'none',
                      fontFamily: 'var(--font-body)', fontSize: 12,
                      color: activeTab === t ? 'var(--text)' : 'var(--muted)', position: 'relative', cursor: 'pointer'
                    }}>
                      {tabLabels[t]}
                      {activeTab === t && (
                        <motion.div layoutId="imaging-tab-underline"
                          style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, background: 'var(--cyan)' }}
                        />
                      )}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
                    {activeTab === 'report' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ background: 'var(--elevated)', padding: 16, borderRadius: 8, borderLeft: '2px solid var(--cyan)' }}>
                          <p className="font-body" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>
                            {highlightMedical(result.findings)}
                          </p>
                        </div>
                        {result.clinical_correlation && (
                          <div style={{ background: 'var(--elevated)', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>CLINICAL CORRELATION</span>
                            <p className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>{result.clinical_correlation}</p>
                          </div>
                        )}
                        {result.measurements && (
                          <div style={{ background: 'var(--elevated)', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>MEASUREMENTS</span>
                            <p className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>{result.measurements}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'differentials' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {result.differential_diagnoses?.length ? result.differential_diagnoses.map((d, i) => (
                          <div key={i} style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="font-number" style={{ fontSize: 16, color: 'var(--cyan)', width: 24 }}>{i + 1}</span>
                            <span className="font-body" style={{ fontSize: 13, color: 'var(--text)' }}>{d}</span>
                          </div>
                        )) : (
                          <span className="font-body" style={{ fontSize: 13, color: 'var(--muted)' }}>No differential diagnoses available</span>
                        )}
                      </div>
                    )}

                    {activeTab === 'recommendations' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {result.recommendations?.map((r, i) => {
                          const rec = typeof r === 'string' ? { action: r, priority: 'routine' as const } : r;
                          const priorityColors: Record<string, string> = { immediate: 'var(--red)', routine: 'var(--cyan)', optional: 'var(--muted)' };
                          return (
                            <div key={i} style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              <span style={{
                                fontSize: 9, fontFamily: 'var(--font-body)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase',
                                background: `${priorityColors[rec.priority] || 'var(--muted)'}20`, color: priorityColors[rec.priority] || 'var(--muted)',
                                border: `1px solid ${priorityColors[rec.priority] || 'var(--muted)'}40`, whiteSpace: 'nowrap', marginTop: 2
                              }}>{rec.priority}</span>
                              <span className="font-body" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{rec.action}</span>
                            </div>
                          );
                        }) || <span className="font-body" style={{ fontSize: 13, color: 'var(--muted)' }}>No recommendations</span>}
                        {result.follow_up_imaging && (
                          <div style={{ background: 'rgba(0,229,255,0.05)', padding: 14, borderRadius: 8, border: '1px solid rgba(0,229,255,0.15)', marginTop: 4 }}>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>FOLLOW-UP IMAGING</span>
                            <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>{result.follow_up_imaging}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'data' && (
                      <div style={{ background: 'var(--elevated)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                        <pre className="font-body" style={{ fontSize: 11, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 }}>
                          {JSON.stringify({
                            scan_type: result.scan_type,
                            anomaly_detected: result.anomaly_detected,
                            confidence: result.confidence,
                            acr_category: result.acr_category,
                            primary_finding: result.primary_finding,
                            distribution: result.distribution,
                            anomaly_type: result.anomaly_type,
                            regions_count: result.anomaly_regions?.length,
                          }, null, 2)}
                        </pre>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <button data-cursor="hover" onClick={() => handleExportPdf(result.session_id)} style={{
                    flex: 1, height: 36, borderRadius: 8, background: 'transparent',
                    border: '1px solid rgba(0,229,255,0.25)', color: 'var(--cyan)',
                    fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 200ms'
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  ><Download size={14} /> PDF Report</button>
                  <button data-cursor="hover" onClick={handleDownloadAnnotated} style={{
                    flex: 1, height: 36, borderRadius: 8, background: 'transparent',
                    border: '1px solid rgba(0,229,255,0.25)', color: 'var(--cyan)',
                    fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 200ms'
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  ><Download size={14} /> Annotated</button>
                  <button data-cursor="hover" onClick={() => { setResult(null); setFile(null); setPreview(null); }} style={{
                    flex: 1, height: 36, borderRadius: 8, background: 'transparent',
                    border: '1px solid rgba(0,229,255,0.25)', color: 'var(--cyan)',
                    fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 200ms'
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  ><RotateCcw size={14} /> New Scan</button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Zoom Modal */}
      <AnimatePresence>
        {showZoom && result?.annotated_image_b64 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowZoom(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <button onClick={() => setShowZoom(false)} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <X size={24} />
            </button>
            <img src={`data:image/jpeg;base64,${result.annotated_image_b64}`} alt="Zoomed" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ImagingAI;
