import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, Brain, AlertTriangle, CheckCircle, UploadCloud, Download, RotateCcw, ZoomIn, X, Loader2, ChevronDown, ChevronRight, Copy, Shield } from 'lucide-react';
import { useImageAnalysis } from '@/hooks/useImageAnalysis';
import { useToast } from '@/hooks/useToast';
import { getSecondOpinion } from '@/api/imaging';
import type { ScanAnalysisResult, AnomalyRegion, SecondOpinionResult } from '@/types';

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

const ACR_COLORS: Record<string, { bg: string; border: string; text: string; label: string; glow: string }> = {
  '1': { bg: 'linear-gradient(135deg, rgba(0,255,157,0.08) 0%, rgba(0,255,157,0.02) 100%)', border: '#00FF9D', text: '#86efac', label: 'ACR 1 — Negative', glow: '0 0 16px rgba(0,255,157,0.1)' },
  '2': { bg: 'linear-gradient(135deg, rgba(0,255,157,0.06) 0%, rgba(0,255,157,0.02) 100%)', border: '#00FF9D', text: '#86efac', label: 'ACR 2 — Benign', glow: '0 0 16px rgba(0,255,157,0.08)' },
  '3': { bg: 'linear-gradient(135deg, rgba(255,149,0,0.1) 0%, rgba(255,149,0,0.03) 100%)', border: '#FF9500', text: '#fde047', label: 'ACR 3 — Probably Benign', glow: '0 0 16px rgba(255,149,0,0.1)' },
  '4': { bg: 'linear-gradient(135deg, rgba(255,149,0,0.12) 0%, rgba(249,115,22,0.04) 100%)', border: '#f97316', text: '#fdba74', label: 'ACR 4 — Suspicious', glow: '0 0 20px rgba(249,115,22,0.12)' },
  '5': { bg: 'linear-gradient(135deg, rgba(255,59,92,0.15) 0%, rgba(239,68,68,0.05) 100%)', border: '#FF3B5C', text: '#fca5a5', label: 'ACR 5 — Highly Suggestive', glow: '0 0 24px rgba(255,59,92,0.15)' },
};

const ImagingAI = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanType, setScanType] = useState('CT Scan');
  const [bodyRegion, setBodyRegion] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [clinicalIndication, setClinicalIndication] = useState('');
  const [clinicalIndicationError, setClinicalIndicationError] = useState('');
  const [result, setResult] = useState<ScanAnalysisResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState<'impression' | 'systematic' | 'differentials' | 'recommendations' | 'data'>('impression');
  const [showZoom, setShowZoom] = useState(false);
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [secondOpinionLoading, setSecondOpinionLoading] = useState(false);
  const [secondOpinionResult, setSecondOpinionResult] = useState<SecondOpinionResult | null>(null);
  const [showSecondOpinionModal, setShowSecondOpinionModal] = useState(false);
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
    if (!clinicalIndication.trim()) {
      setClinicalIndicationError('Clinical indication is required');
      addToast('error', 'Please provide a clinical indication before analyzing');
      return;
    }
    setClinicalIndicationError('');
    try {
      const res = await analyze({
        file,
        scanType,
        bodyRegion: bodyRegion || undefined,
        clinicalIndication,
        patientAge: patientAge ? parseInt(patientAge) : undefined,
        patientGender: patientGender || undefined,
      });
      setResult(res);
      setSliderPos(50);
      setActiveTab('impression');
      // Auto-expand abnormal findings
      if (res.systematic_findings) {
        const abnormals = new Set<string>();
        Object.entries(res.systematic_findings).forEach(([key, val]) => {
          if (val.status === 'abnormal') abnormals.add(key);
        });
        setExpandedFindings(abnormals);
      }
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
      const token = localStorage.getItem('neuramed_token');
      const response = await fetch(`${base}/api/sessions/${sessionId}/export-pdf`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
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

  const handleSecondOpinion = async () => {
    if (!result) return;
    setSecondOpinionLoading(true);
    try {
      const res = await getSecondOpinion(result.session_id);
      setSecondOpinionResult(res);
      setShowSecondOpinionModal(true);
    } catch {
      addToast('error', 'Failed to get second opinion');
    } finally {
      setSecondOpinionLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addToast('success', 'Copied to clipboard');
    }).catch(() => {
      addToast('error', 'Failed to copy');
    });
  };

  const toggleFinding = (key: string) => {
    setExpandedFindings(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const scanTypes = ['CT Scan', 'MRI', 'X-Ray', 'Ultrasound'];
  const bodyRegions = ['Brain', 'Chest', 'Abdomen', 'Spine', 'Pelvis', 'Extremity', 'Neck'];
  const genderOptions = ['Male', 'Female', 'Other'];
  const confColor = (v: number) => v > 80 ? 'var(--green)' : v > 60 ? 'var(--cyan)' : 'var(--amber)';
  // Pathology probability -> color (higher = more concerning)
  const pathColor = (p: number) => p > 0.7 ? 'var(--red)' : p > 0.5 ? 'var(--amber)' : p > 0.25 ? 'var(--cyan)' : 'var(--green)';
  const MEASUREMENTS_UNAVAILABLE = 'Measurements unavailable — no DICOM calibration (upload DICOM for physical measurements)';
  const acr = result?.acr_category?.replace(/[^1-5]/g, '') || '';
  const acrInfo = ACR_COLORS[acr];

  const tabs = ['impression', 'systematic', 'differentials', 'recommendations', 'data'] as const;
  const tabLabels = { impression: 'Impression', systematic: 'Findings', differentials: 'Differentials', recommendations: 'Recommendations', data: 'Raw Data' };

  // Confidence gauge SVG
  const ConfidenceGauge = ({ value, reasoning }: { value: number; reasoning?: string }) => {
    const pct = Math.round(value * 100);
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (pct / 100) * circumference;
    const color = confColor(pct);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <svg width={100} height={100} viewBox="0 0 100 100">
          <circle cx={50} cy={50} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
          <circle cx={50} cy={50} r={radius} fill="none" stroke={color} strokeWidth={6}
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
          <text x={50} y={46} textAnchor="middle" fill={color} fontSize={20} fontFamily="var(--font-number)" fontWeight={700}>{pct}%</text>
          <text x={50} y={62} textAnchor="middle" fill="var(--muted)" fontSize={8} fontFamily="var(--font-body)">CONFIDENCE</text>
        </svg>
        {reasoning && (
          <p className="font-body" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: 0, flex: 1 }}>{reasoning}</p>
        )}
      </div>
    );
  };

  // Assessment color mapping
  const assessmentColor = (assessment: string) => {
    const lower = (assessment || '').toLowerCase();
    if (lower.includes('normal') || lower.includes('benign') || lower.includes('negative')) return 'var(--green)';
    if (lower.includes('suspicious') || lower.includes('abnormal') || lower.includes('concern')) return 'var(--amber)';
    if (lower.includes('malignant') || lower.includes('critical') || lower.includes('urgent')) return 'var(--red)';
    return 'var(--cyan)';
  };

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

      <div className="split-workspace">
        {/* LEFT */}
        <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column' }}>
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
                {bodyRegion && <span className="font-number" style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 9, color: 'var(--cyan)', opacity: 0.6 }}>{bodyRegion.toUpperCase()}</span>}
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

          {/* Body Region Pills */}
          <div style={{ marginTop: 16 }}>
            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 10 }}>BODY REGION</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {bodyRegions.map(r => (
                <button key={r} data-cursor="hover" onClick={() => setBodyRegion(bodyRegion === r ? '' : r)} style={{
                  fontFamily: 'var(--font-body)', fontSize: 12, borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
                  background: bodyRegion === r ? 'var(--cyan)' : 'transparent',
                  color: bodyRegion === r ? '#000' : 'var(--muted)',
                  border: bodyRegion === r ? '1px solid var(--cyan)' : '1px solid var(--border)', transition: 'all 200ms',
                }}>{r}</button>
              ))}
            </div>
          </div>

          {/* Patient Age */}
          <div style={{ marginTop: 16 }}>
            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>PATIENT AGE</span>
            <input value={patientAge} onChange={e => setPatientAge(e.target.value)} placeholder="e.g. 45"
              style={{
                width: '100%', height: 36, background: 'var(--elevated)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none'
              }}
            />
          </div>

          {/* Patient Gender Pills */}
          <div style={{ marginTop: 12 }}>
            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>PATIENT GENDER</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {genderOptions.map(g => (
                <button key={g} data-cursor="hover" onClick={() => setPatientGender(patientGender === g ? '' : g)} style={{
                  fontFamily: 'var(--font-body)', fontSize: 12, borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
                  background: patientGender === g ? 'var(--cyan)' : 'transparent',
                  color: patientGender === g ? '#000' : 'var(--muted)',
                  border: patientGender === g ? '1px solid var(--cyan)' : '1px solid var(--border)', transition: 'all 200ms',
                }}>{g}</button>
              ))}
            </div>
          </div>

          {/* Clinical Indication (required) */}
          <div style={{ marginTop: 12 }}>
            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>
              CLINICAL INDICATION <span style={{ color: 'var(--red)' }}>*</span>
            </span>
            <textarea value={clinicalIndication} onChange={e => { setClinicalIndication(e.target.value); if (e.target.value.trim()) setClinicalIndicationError(''); }} placeholder="e.g. Rule out pneumonia, persistent cough..."
              style={{
                width: '100%', height: 60, background: 'var(--elevated)',
                border: `1px solid ${clinicalIndicationError ? 'var(--red)' : 'var(--border)'}`,
                borderRadius: 8, padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text)', outline: 'none', resize: 'none'
              }}
            />
            {clinicalIndicationError && (
              <span className="font-body" style={{ fontSize: 11, color: 'var(--red)', marginTop: 4, display: 'block' }}>{clinicalIndicationError}</span>
            )}
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
        <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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

                {/* Provenance chip + Pathology scores + Disclaimer */}
                {(() => {
                  const scores = result.pathology_scores || {};
                  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
                  const prov = result.provenance;
                  const provOk = !prov || prov.status === 'ok';
                  return (
                    <>
                      {/* Provenance chip */}
                      {prov && (prov.model || prov.vendor) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{
                            fontFamily: 'var(--font-body)', fontSize: 10, padding: '4px 10px', borderRadius: 12,
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: provOk ? 'rgba(0,229,255,0.08)' : 'rgba(255,149,0,0.1)',
                            color: provOk ? 'var(--cyan)' : 'var(--amber)',
                            border: `1px solid ${provOk ? 'rgba(0,229,255,0.2)' : 'rgba(255,149,0,0.3)'}`,
                          }}>
                            <Shield size={11} />
                            {[prov.model, prov.vendor].filter(Boolean).join(' · ')}
                          </span>
                          {!provOk && (
                            <span className="font-body" style={{ fontSize: 10, color: 'var(--amber)' }}>
                              {prov.status}{prov.reason ? ` — ${prov.reason}` : ''}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Pathology scores panel (chest X-ray classifier) */}
                      {result.classifier_available && sorted.length > 0 ? (
                        <div style={{ background: 'var(--elevated)', borderRadius: 8, border: '1px solid var(--border)', padding: 16 }}>
                          <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 12 }}>
                            CLASSIFIER FINDINGS — TORCHXRAYVISION (RESEARCH SIGNAL)
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {sorted.map(([name, prob], i) => {
                              const pct = Math.round(prob * 100);
                              const c = pathColor(prob);
                              return (
                                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span className="font-body" style={{ fontSize: 12, color: 'var(--text)', width: 132, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{name}</span>
                                  <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: i * 0.04 }}
                                      style={{ height: '100%', borderRadius: 3, background: c }} />
                                  </div>
                                  <span className="font-number" style={{ fontSize: 12, color: c, minWidth: 38, textAlign: 'right' }}>{pct}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : result.classifier_available === false ? (
                        <div style={{ background: 'var(--elevated)', borderRadius: 8, border: '1px solid var(--border)', padding: '10px 14px' }}>
                          <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
                            Pathology classifier available for chest X-ray only; this analysis is from the vision model.
                          </span>
                        </div>
                      ) : null}

                      {/* Honest disclaimer */}
                      {result.disclaimer && (
                        <p className="font-body" style={{ fontSize: 10, color: 'var(--dim)', lineHeight: 1.5, margin: '-4px 0 0 0' }}>
                          {result.disclaimer}
                        </p>
                      )}
                    </>
                  );
                })()}

                {/* Anomaly Regions Table */}
                {result.anomaly_regions?.length > 0 && (
                  <div>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>DETECTED REGIONS</span>
                    <div style={{ background: 'var(--elevated)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {['Region', 'Area', 'Intensity'].map(h => (
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
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 5 Tabs */}
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

                    {/* TAB 1 — IMPRESSION */}
                    {activeTab === 'impression' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Clinical Impression */}
                        <div style={{ background: 'var(--elevated)', padding: 16, borderRadius: 8, borderLeft: '2px solid var(--cyan)' }}>
                          <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>CLINICAL IMPRESSION</span>
                          <p className="font-heading" style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>
                            {highlightMedical(result.clinical_impression || result.impression || result.findings)}
                          </p>
                        </div>

                        {/* Confidence Gauge */}
                        <div style={{ background: 'var(--elevated)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                          <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 12 }}>ANALYSIS CONFIDENCE</span>
                          <ConfidenceGauge value={result.confidence} reasoning={result.confidence_reasoning} />
                        </div>

                        {/* Overall Assessment Badge */}
                        {result.overall_assessment && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>OVERALL ASSESSMENT</span>
                            <span style={{
                              fontFamily: 'var(--font-heading)', fontSize: 12, padding: '5px 14px', borderRadius: 20,
                              background: `${assessmentColor(result.overall_assessment)}15`,
                              color: assessmentColor(result.overall_assessment),
                              border: `1px solid ${assessmentColor(result.overall_assessment)}40`,
                            }}>{result.overall_assessment}</span>
                          </div>
                        )}

                        {/* Primary Finding Detail Card */}
                        {(result.primary_finding_detail || result.primary_finding) && (
                          <div style={{ background: 'var(--elevated)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 10 }}>PRIMARY FINDING DETAIL</span>
                            {result.primary_finding_detail ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {result.primary_finding_detail.description && (
                                  <p className="font-body" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
                                    {highlightMedical(result.primary_finding_detail.description)}
                                  </p>
                                )}
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  {result.primary_finding_detail.location && (
                                    <span style={{
                                      fontFamily: 'var(--font-body)', fontSize: 11, padding: '4px 10px', borderRadius: 12,
                                      background: 'rgba(0,229,255,0.1)', color: 'var(--cyan)', border: '1px solid rgba(0,229,255,0.2)',
                                    }}>Location: {result.primary_finding_detail.location}</span>
                                  )}
                                  {result.measurements_enabled !== false && result.primary_finding_detail.size_mm && result.primary_finding_detail.size_mm.length > 0 && (
                                    <span style={{
                                      fontFamily: 'var(--font-body)', fontSize: 11, padding: '4px 10px', borderRadius: 12,
                                      background: 'rgba(0,229,255,0.1)', color: 'var(--cyan)', border: '1px solid rgba(0,229,255,0.2)',
                                    }}>Size: {result.primary_finding_detail.size_mm.join(' x ')} mm</span>
                                  )}
                                  {result.primary_finding_detail.characteristics?.map((c, i) => (
                                    <span key={i} style={{
                                      fontFamily: 'var(--font-body)', fontSize: 11, padding: '4px 10px', borderRadius: 12,
                                      background: 'rgba(0,229,255,0.1)', color: 'var(--cyan)', border: '1px solid rgba(0,229,255,0.2)',
                                    }}>{c}</span>
                                  ))}
                                  {result.primary_finding_detail.acr_lung_rads && (
                                    <span style={{
                                      fontFamily: 'var(--font-body)', fontSize: 11, padding: '4px 10px', borderRadius: 12,
                                      background: 'rgba(255,149,0,0.1)', color: 'var(--amber)', border: '1px solid rgba(255,149,0,0.2)',
                                    }}>Lung-RADS: {result.primary_finding_detail.acr_lung_rads}</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <p className="font-body" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
                                {highlightMedical(result.primary_finding || '')}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Clinical Correlation */}
                        {result.clinical_correlation && (
                          <div style={{ background: 'var(--elevated)', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>CLINICAL CORRELATION</span>
                            <p className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>{result.clinical_correlation}</p>
                          </div>
                        )}

                        {/* Measurements */}
                        {result.measurements_enabled === false ? (
                          <div style={{ background: 'var(--elevated)', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>MEASUREMENTS</span>
                            <p className="font-body" style={{ fontSize: 12, color: 'var(--amber)', lineHeight: 1.6, margin: 0 }}>{MEASUREMENTS_UNAVAILABLE}</p>
                          </div>
                        ) : result.measurements ? (
                          <div style={{ background: 'var(--elevated)', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>MEASUREMENTS</span>
                            <p className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>{result.measurements}</p>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* TAB 2 — SYSTEMATIC FINDINGS */}
                    {activeTab === 'systematic' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {result.systematic_findings && Object.keys(result.systematic_findings).length > 0 ? (
                          Object.entries(result.systematic_findings).map(([key, finding]) => {
                            const isExpanded = expandedFindings.has(key);
                            const isAbnormal = finding.status === 'abnormal';
                            const statusColor = isAbnormal ? 'var(--amber)' : 'var(--green)';
                            const statusBg = isAbnormal ? 'rgba(255,149,0,0.1)' : 'rgba(0,255,157,0.06)';
                            const statusBorder = isAbnormal ? 'rgba(255,149,0,0.25)' : 'rgba(0,255,157,0.15)';
                            return (
                              <div key={key} style={{ background: 'var(--elevated)', borderRadius: 8, border: `1px solid ${statusBorder}`, overflow: 'hidden' }}>
                                <button data-cursor="hover" onClick={() => toggleFinding(key)} style={{
                                  width: '100%', padding: '12px 16px', background: statusBg, border: 'none',
                                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left',
                                }}>
                                  {isExpanded ? <ChevronDown size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />}
                                  <span className="font-heading" style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{finding.name || key}</span>
                                  <span style={{
                                    fontFamily: 'var(--font-body)', fontSize: 10, padding: '2px 8px', borderRadius: 10,
                                    background: `${statusColor}20`, color: statusColor,
                                    border: `1px solid ${statusColor}40`, textTransform: 'uppercase', letterSpacing: '0.05em',
                                  }}>{finding.status}</span>
                                </button>
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                                      style={{ overflow: 'hidden' }}>
                                      <div style={{ padding: '12px 16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {finding.finding && (
                                          <p className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
                                            {highlightMedical(finding.finding)}
                                          </p>
                                        )}
                                        {finding.significance && (
                                          <div>
                                            <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em' }}>SIGNIFICANCE: </span>
                                            <span className="font-body" style={{ fontSize: 12, color: isAbnormal ? 'var(--amber)' : 'var(--text)' }}>{finding.significance}</span>
                                          </div>
                                        )}
                                        {finding.measurement && result.measurements_enabled !== false && (
                                          <div>
                                            <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em' }}>MEASUREMENT: </span>
                                            <span className="font-number" style={{ fontSize: 12, color: 'var(--cyan)' }}>{finding.measurement}</span>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ background: 'var(--elevated)', padding: 24, borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center' }}>
                            <span className="font-body" style={{ fontSize: 13, color: 'var(--muted)' }}>No systematic findings data available for this scan.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 3 — DIFFERENTIALS */}
                    {activeTab === 'differentials' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {result.differential_diagnoses_detail && result.differential_diagnoses_detail.length > 0 ? (
                          result.differential_diagnoses_detail.map((d, i) => {
                            const prob = Math.round((d.probability || 0) * (d.probability > 1 ? 1 : 100));
                            const barColor = prob > 70 ? 'var(--red)' : prob > 40 ? 'var(--amber)' : 'var(--cyan)';
                            return (
                              <div key={i} style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                                    <span className="font-number" style={{ fontSize: 18, color: 'var(--cyan)', width: 28, textAlign: 'center' }}>{i + 1}</span>
                                    <span className="font-heading" style={{ fontSize: 14, color: 'var(--text)' }}>{d.diagnosis}</span>
                                  </div>
                                  {d.icd10 && (
                                    <span style={{
                                      fontFamily: 'var(--font-number)', fontSize: 10, padding: '3px 8px', borderRadius: 6,
                                      background: 'rgba(0,229,255,0.08)', color: 'var(--cyan)', border: '1px solid rgba(0,229,255,0.2)',
                                    }}>{d.icd10}</span>
                                  )}
                                </div>
                                {/* Probability bar */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${prob}%` }} transition={{ duration: 0.6, delay: i * 0.1 }}
                                      style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, var(--cyan), ${barColor})` }} />
                                  </div>
                                  <span className="font-number" style={{ fontSize: 13, color: barColor, minWidth: 38, textAlign: 'right' }}>{prob}%</span>
                                </div>
                                {/* Supporting / Against features */}
                                {d.supporting_features && d.supporting_features.length > 0 && (
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {d.supporting_features.map((f, fi) => (
                                      <span key={fi} style={{
                                        fontFamily: 'var(--font-body)', fontSize: 10, padding: '3px 8px', borderRadius: 10,
                                        background: 'rgba(0,255,157,0.1)', color: 'var(--green)', border: '1px solid rgba(0,255,157,0.2)',
                                      }}>{f}</span>
                                    ))}
                                  </div>
                                )}
                                {d.against_features && d.against_features.length > 0 && (
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {d.against_features.map((f, fi) => (
                                      <span key={fi} style={{
                                        fontFamily: 'var(--font-body)', fontSize: 10, padding: '3px 8px', borderRadius: 10,
                                        background: 'rgba(255,59,92,0.1)', color: 'var(--red)', border: '1px solid rgba(255,59,92,0.2)',
                                      }}>{f}</span>
                                    ))}
                                  </div>
                                )}
                                {d.next_step && (
                                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 2 }}>
                                    <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em' }}>NEXT STEP: </span>
                                    <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>{d.next_step}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : result.differential_diagnoses?.length ? (
                          result.differential_diagnoses.map((d, i) => (
                            <div key={i} style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span className="font-number" style={{ fontSize: 16, color: 'var(--cyan)', width: 24 }}>{i + 1}</span>
                              <span className="font-body" style={{ fontSize: 13, color: 'var(--text)' }}>{d}</span>
                            </div>
                          ))
                        ) : (
                          <span className="font-body" style={{ fontSize: 13, color: 'var(--muted)' }}>No differential diagnoses available</span>
                        )}
                      </div>
                    )}

                    {/* TAB 4 — RECOMMENDATIONS */}
                    {activeTab === 'recommendations' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Recommendations */}
                        {result.recommendations && result.recommendations.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {result.recommendations.map((r, i) => {
                              if (typeof r === 'string') {
                                return (
                                  <div key={i} style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                    <span style={{
                                      fontSize: 9, fontFamily: 'var(--font-body)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase',
                                      background: 'rgba(0,229,255,0.1)', color: 'var(--cyan)',
                                      border: '1px solid rgba(0,229,255,0.2)', whiteSpace: 'nowrap', marginTop: 2
                                    }}>routine</span>
                                    <span className="font-body" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{r}</span>
                                  </div>
                                );
                              }
                              // RichRecommendation or RecommendationItem
                              const isRich = typeof r === 'object' && r !== null;
                              const rec = isRich ? r : { action: '', priority: 'routine' };
                              const priorityVal = typeof rec.priority === 'number' ? rec.priority : rec.priority;
                              const priorityLabel = typeof priorityVal === 'number'
                                ? (priorityVal <= 1 ? 'immediate' : priorityVal <= 3 ? 'routine' : 'optional')
                                : (priorityVal as string) || 'routine';
                              const priorityColors: Record<string, string> = { immediate: 'var(--red)', routine: 'var(--cyan)', optional: 'var(--muted)' };
                              const pColor = priorityColors[priorityLabel] || 'var(--cyan)';
                              return (
                                <div key={i} style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                    <span style={{
                                      fontSize: 9, fontFamily: 'var(--font-body)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase',
                                      background: `${pColor}20`, color: pColor,
                                      border: `1px solid ${pColor}40`, whiteSpace: 'nowrap', marginTop: 2
                                    }}>
                                      {typeof priorityVal === 'number' ? `P${priorityVal}` : priorityLabel}
                                    </span>
                                    <span className="font-body" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{rec.action}</span>
                                  </div>
                                  {(('timeframe' in rec && rec.timeframe) || ('guideline_reference' in rec && rec.guideline_reference)) && (
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: 36 }}>
                                      {'timeframe' in rec && rec.timeframe && (
                                        <span style={{
                                          fontFamily: 'var(--font-body)', fontSize: 10, padding: '3px 8px', borderRadius: 10,
                                          background: 'rgba(0,229,255,0.08)', color: 'var(--cyan)', border: '1px solid rgba(0,229,255,0.15)',
                                        }}>Timeframe: {rec.timeframe}</span>
                                      )}
                                      {'guideline_reference' in rec && rec.guideline_reference && (
                                        <span style={{
                                          fontFamily: 'var(--font-body)', fontSize: 10, padding: '3px 8px', borderRadius: 10,
                                          background: 'rgba(255,149,0,0.08)', color: 'var(--amber)', border: '1px solid rgba(255,149,0,0.15)',
                                        }}>Ref: {rec.guideline_reference}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="font-body" style={{ fontSize: 13, color: 'var(--muted)' }}>No recommendations</span>
                        )}

                        {/* Follow-up imaging */}
                        {result.follow_up_imaging && (
                          <div style={{ background: 'rgba(0,229,255,0.05)', padding: 14, borderRadius: 8, border: '1px solid rgba(0,229,255,0.15)' }}>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>FOLLOW-UP IMAGING</span>
                            <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>{result.follow_up_imaging}</span>
                          </div>
                        )}

                        {/* Red Flags */}
                        {result.red_flags && result.red_flags.length > 0 && (
                          <div>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--red)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>RED FLAGS</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {result.red_flags.map((rf, i) => (
                                <motion.div key={i}
                                  animate={{ boxShadow: ['0 0 0px rgba(255,59,92,0)', '0 0 12px rgba(255,59,92,0.3)', '0 0 0px rgba(255,59,92,0)'] }}
                                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                                  style={{
                                    background: 'rgba(255,59,92,0.08)', border: '1px solid rgba(255,59,92,0.3)', borderRadius: 8,
                                    padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6,
                                  }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <AlertTriangle size={14} style={{ color: 'var(--red)', flexShrink: 0 }} />
                                    <span className="font-heading" style={{ fontSize: 13, color: 'var(--red)' }}>{rf.finding}</span>
                                    <span style={{
                                      fontFamily: 'var(--font-body)', fontSize: 9, padding: '2px 6px', borderRadius: 4,
                                      background: 'rgba(255,59,92,0.15)', color: 'var(--red)', border: '1px solid rgba(255,59,92,0.3)',
                                      textTransform: 'uppercase', marginLeft: 'auto',
                                    }}>{rf.urgency}</span>
                                  </div>
                                  <span className="font-body" style={{ fontSize: 12, color: 'var(--text)', paddingLeft: 22 }}>{rf.action}</span>
                                  {rf.guideline && (
                                    <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', paddingLeft: 22 }}>Guideline: {rf.guideline}</span>
                                  )}
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Report Text */}
                        {result.report_text && (
                          <div style={{ marginTop: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>FORMAL REPORT</span>
                              <button data-cursor="hover" onClick={() => copyToClipboard(result.report_text || '')} style={{
                                background: 'transparent', border: '1px solid rgba(0,229,255,0.2)', borderRadius: 6,
                                padding: '4px 10px', color: 'var(--cyan)', fontFamily: 'var(--font-body)', fontSize: 11,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 200ms',
                              }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.05)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                              ><Copy size={12} /> Copy Report</button>
                            </div>
                            <div style={{
                              background: 'var(--elevated)', padding: 16, borderRadius: 8,
                              border: '1px solid var(--border)', borderLeft: '3px solid var(--cyan)',
                            }}>
                              <pre className="font-body" style={{
                                fontSize: 11, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0,
                                fontFamily: 'monospace',
                              }}>{result.report_text}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 5 — RAW DATA */}
                    {activeTab === 'data' && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                          <button data-cursor="hover" onClick={() => copyToClipboard(JSON.stringify(result, null, 2))} style={{
                            background: 'transparent', border: '1px solid rgba(0,229,255,0.2)', borderRadius: 6,
                            padding: '4px 10px', color: 'var(--cyan)', fontFamily: 'var(--font-body)', fontSize: 11,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 200ms',
                          }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.05)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                          ><Copy size={12} /> Copy JSON</button>
                        </div>
                        <div style={{ background: 'var(--elevated)', padding: 16, borderRadius: 8, border: '1px solid var(--border)', maxHeight: 400, overflowY: 'auto' }}>
                          <pre className="font-body" style={{ fontSize: 11, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 }}>
                            {JSON.stringify(result, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}

                  </motion.div>
                </AnimatePresence>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 16, flexWrap: 'wrap' }}>
                  <button data-cursor="hover" onClick={() => handleExportPdf(result.session_id)} style={{
                    flex: 1, height: 36, borderRadius: 8, background: 'transparent',
                    border: '1px solid rgba(0,229,255,0.25)', color: 'var(--cyan)',
                    fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 200ms',
                    minWidth: 100,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  ><Download size={14} /> PDF Report</button>
                  <button data-cursor="hover" onClick={handleDownloadAnnotated} style={{
                    flex: 1, height: 36, borderRadius: 8, background: 'transparent',
                    border: '1px solid rgba(0,229,255,0.25)', color: 'var(--cyan)',
                    fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 200ms',
                    minWidth: 100,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  ><Download size={14} /> Annotated</button>
                  <button data-cursor="hover" onClick={() => { setResult(null); setFile(null); setPreview(null); }} style={{
                    flex: 1, height: 36, borderRadius: 8, background: 'transparent',
                    border: '1px solid rgba(0,229,255,0.25)', color: 'var(--cyan)',
                    fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 200ms',
                    minWidth: 100,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  ><RotateCcw size={14} /> New Scan</button>
                  <button data-cursor="hover" onClick={handleSecondOpinion} disabled={secondOpinionLoading} style={{
                    flex: 1, height: 36, borderRadius: 8, background: 'transparent',
                    border: '1px solid rgba(255,149,0,0.35)', color: 'var(--amber)',
                    fontFamily: 'var(--font-body)', fontSize: 12,
                    cursor: secondOpinionLoading ? 'not-allowed' : 'pointer',
                    opacity: secondOpinionLoading ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 200ms',
                    minWidth: 100,
                  }}
                    onMouseEnter={e => { if (!secondOpinionLoading) e.currentTarget.style.background = 'rgba(255,149,0,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {secondOpinionLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Shield size={14} />}
                    {secondOpinionLoading ? 'Loading...' : '2nd Opinion'}
                  </button>
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

      {/* Second Opinion Modal */}
      <AnimatePresence>
        {showSecondOpinionModal && secondOpinionResult && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowSecondOpinionModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          >
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14,
                maxWidth: 800, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 0,
              }}
            >
              {/* Modal Header */}
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--elevated)', borderRadius: '14px 14px 0 0', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Shield size={18} style={{ color: 'var(--amber)' }} />
                  <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)' }}>Second Opinion Panel</span>
                </div>
                <button onClick={() => setShowSecondOpinionModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Synthesis */}
                {secondOpinionResult.synthesis && (
                  <div style={{ background: 'rgba(0,229,255,0.05)', padding: 16, borderRadius: 10, border: '1px solid rgba(0,229,255,0.15)' }}>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>SYNTHESIS</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <span style={{
                        fontFamily: 'var(--font-heading)', fontSize: 12, padding: '4px 12px', borderRadius: 20,
                        background: 'rgba(0,229,255,0.1)', color: 'var(--cyan)', border: '1px solid rgba(0,229,255,0.25)',
                      }}>Consensus: {secondOpinionResult.synthesis.consensus_level}</span>
                      {secondOpinionResult.synthesis.consensus_diagnosis && (
                        <span className="font-body" style={{ fontSize: 13, color: 'var(--text)' }}>{secondOpinionResult.synthesis.consensus_diagnosis}</span>
                      )}
                      {!secondOpinionResult.synthesis.consensus_diagnosis && secondOpinionResult.synthesis.majority_diagnosis && (
                        <span className="font-body" style={{ fontSize: 13, color: 'var(--text)' }}>Majority: {secondOpinionResult.synthesis.majority_diagnosis}</span>
                      )}
                    </div>
                    <p className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>{secondOpinionResult.synthesis.synthesized_recommendation}</p>
                    {secondOpinionResult.synthesis.clinical_note && (
                      <p className="font-body" style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, margin: '8px 0 0 0' }}>{secondOpinionResult.synthesis.clinical_note}</p>
                    )}
                    {secondOpinionResult.synthesis.agreement_areas.length > 0 && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span className="font-body" style={{ fontSize: 10, color: 'var(--green)', letterSpacing: '0.05em' }}>AGREE: </span>
                        {secondOpinionResult.synthesis.agreement_areas.map((a, i) => (
                          <span key={i} style={{
                            fontFamily: 'var(--font-body)', fontSize: 10, padding: '2px 8px', borderRadius: 8,
                            background: 'rgba(0,255,157,0.08)', color: 'var(--green)', border: '1px solid rgba(0,255,157,0.15)',
                          }}>{a}</span>
                        ))}
                      </div>
                    )}
                    {secondOpinionResult.synthesis.dispute_areas.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span className="font-body" style={{ fontSize: 10, color: 'var(--amber)', letterSpacing: '0.05em' }}>DISPUTE: </span>
                        {secondOpinionResult.synthesis.dispute_areas.map((d, i) => (
                          <span key={i} style={{
                            fontFamily: 'var(--font-body)', fontSize: 10, padding: '2px 8px', borderRadius: 8,
                            background: 'rgba(255,149,0,0.08)', color: 'var(--amber)', border: '1px solid rgba(255,149,0,0.15)',
                          }}>{d}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Individual Opinions */}
                {Object.entries(secondOpinionResult.opinions).map(([perspective, opinion]) => {
                  const perspectiveColors: Record<string, string> = {
                    conservative: 'var(--green)', balanced: 'var(--cyan)', differential: 'var(--amber)',
                  };
                  const color = perspectiveColors[perspective] || 'var(--cyan)';
                  return (
                    <div key={perspective} style={{ background: 'var(--elevated)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{
                            fontFamily: 'var(--font-heading)', fontSize: 11, padding: '3px 10px', borderRadius: 12,
                            background: `${color}15`, color: color, border: `1px solid ${color}30`,
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}>{perspective}</span>
                          <span className="font-heading" style={{ fontSize: 13, color: 'var(--text)' }}>{opinion.primary_diagnosis}</span>
                        </div>
                        <span className="font-number" style={{ fontSize: 13, color: confColor(opinion.confidence * 100) }}>{Math.round(opinion.confidence * 100)}%</span>
                      </div>
                      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <p className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>{opinion.reasoning}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontFamily: 'var(--font-body)', fontSize: 10, padding: '2px 8px', borderRadius: 8,
                            background: 'rgba(255,149,0,0.08)', color: 'var(--amber)', border: '1px solid rgba(255,149,0,0.15)',
                          }}>Urgency: {opinion.urgency_assessment}</span>
                        </div>
                        <p className="font-body" style={{ fontSize: 11, color: 'var(--cyan)', margin: 0 }}>{opinion.key_message}</p>
                        {opinion.agreed_findings.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {opinion.agreed_findings.map((f, i) => (
                              <span key={i} style={{
                                fontFamily: 'var(--font-body)', fontSize: 9, padding: '2px 6px', borderRadius: 6,
                                background: 'rgba(0,255,157,0.08)', color: 'var(--green)', border: '1px solid rgba(0,255,157,0.15)',
                              }}>{f}</span>
                            ))}
                          </div>
                        )}
                        {opinion.disputed_findings.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {opinion.disputed_findings.map((f, i) => (
                              <span key={i} style={{
                                fontFamily: 'var(--font-body)', fontSize: 9, padding: '2px 6px', borderRadius: 6,
                                background: 'rgba(255,59,92,0.08)', color: 'var(--red)', border: '1px solid rgba(255,59,92,0.15)',
                              }}>{f}</span>
                            ))}
                          </div>
                        )}
                        {opinion.recommended_tests.length > 0 && (
                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                            <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.05em' }}>RECOMMENDED TESTS: </span>
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--text)' }}>{opinion.recommended_tests.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ImagingAI;
