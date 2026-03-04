import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, Brain, AlertTriangle, CheckCircle, UploadCloud } from 'lucide-react';
import { useImageAnalysis } from '@/hooks/useImageAnalysis';
import { useToast } from '@/hooks/useToast';

const MEDICAL_TERMS = ['opacity', 'consolidation', 'pneumonia', 'effusion', 'cardiac', 'lobe', 'infiltrate', 'nodule', 'edema', 'fracture', 'lesion', 'mass', 'density', 'calcification'];

const highlightMedical = (text: string) => {
  const regex = new RegExp(`\\b(${MEDICAL_TERMS.join('|')})\\b`, 'gi');
  return text.split(regex).map((part, i) =>
    MEDICAL_TERMS.some(t => t.toLowerCase() === part.toLowerCase())
      ? <span key={i} style={{ color: 'var(--cyan)', fontWeight: 600 }}>{part}</span>
      : part
  );
};

const ImagingAI = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanType, setScanType] = useState('CT Scan');
  const [modules, setModules] = useState({ anomaly: true, segmentation: true, density: false, nodule: false });
  const [result, setResult] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);
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
    setResult(null); // Clear previous result on new file
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
      setSliderPos(50); // Reset slider
    } catch (e) {
      console.error('Imaging analysis failed', e);
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
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sessions/${sessionId}/export-pdf`);
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `neuramed-report-${sessionId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'PDF downloaded successfully');
    } catch {
      addToast('error', 'Failed to generate PDF');
    }
  };

  const scanTypes = ['CT Scan', 'MRI', 'X-Ray', 'Ultrasound'];
  const confColor = (v: number) => v > 80 ? 'var(--green)' : v > 60 ? 'var(--cyan)' : 'var(--amber)';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 24 }}>
      {/* LEFT */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' }}>
        <span className="font-heading" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 20 }}>Medical Imaging</span>

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
            transition: 'all 200ms', position: 'relative', overflow: 'hidden'
          }}
        >
          {preview ? (
            <>
              <img src={preview} alt="Scan" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: isPending ? 0.3 : 1 }} />
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
              <span className="font-body" style={{ fontSize: 12, color: 'var(--dim)' }}>CT · MRI · X-Ray · PNG · JPEG</span>
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

        {/* Scan Type */}
        <div style={{ marginTop: 24 }}>
          <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 12 }}>SCAN TYPE</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {scanTypes.map(t => (
              <button key={t} data-cursor="hover" onClick={() => setScanType(t)} style={{
                fontFamily: 'var(--font-body)', fontSize: 12, borderRadius: 20, padding: '6px 14px',
                background: scanType === t ? 'var(--cyan)' : 'transparent',
                color: scanType === t ? '#000' : 'var(--muted)',
                border: scanType === t ? '1px solid var(--cyan)' : '1px solid var(--border)', transition: 'all 200ms',
              }}>{t}</button>
            ))}
          </div>
        </div>

        {/* Modules */}
        <div style={{ marginTop: 24, flex: 1 }}>
          <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 12 }}>DETECTION MODULES</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { key: 'anomaly', label: 'Anomaly Detection' },
              { key: 'segmentation', label: 'Region Segmentation' },
              { key: 'density', label: 'Density Mapping' },
              { key: 'nodule', label: 'Nodule Sizing' },
            ].map(m => (
              <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--elevated)', padding: '10px 16px', borderRadius: 8 }}>
                <span className="font-body" style={{ fontSize: 13, color: 'var(--text)' }}>{m.label}</span>
                <div
                  data-cursor="hover"
                  onClick={() => setModules(prev => ({ ...prev, [m.key]: !prev[m.key as keyof typeof prev] }))}
                  style={{
                    width: 36, height: 20, borderRadius: 10, cursor: 'none',
                    background: modules[m.key as keyof typeof modules] ? 'var(--cyan)' : 'var(--border)',
                    position: 'relative', transition: 'background 200ms',
                  }}
                >
                  <motion.div
                    animate={{ x: modules[m.key as keyof typeof modules] ? 16 : 0 }}
                    style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <button data-cursor="hover" onClick={handleAnalyze} disabled={!file || isPending}
          style={{
            marginTop: 24, width: '100%', height: 44,
            background: (!file || isPending) ? 'rgba(0,229,255,0.3)' : 'var(--cyan)',
            color: '#000', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14,
            borderRadius: 8, border: 'none', opacity: (!file || isPending) ? 0.4 : 1,
            transition: 'all 200ms'
          }}>
          {isPending ? 'Processing Scan...' : 'Run Full Analysis'}
        </button>
      </div>

      {/* RIGHT */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' }}>
        {!result ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <Brain size={48} style={{ color: 'var(--dim)' }} strokeWidth={1} />
            <span className="font-heading" style={{ fontSize: 18, color: 'var(--muted)' }}>Upload a scan to begin</span>
            <span className="font-body" style={{ fontSize: 13, color: 'var(--dim)', maxWidth: 280, textAlign: 'center' }}>
              Our AI vision models will detect anomalies, segment regions, and measure precise densities.
            </span>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>

            {/* Image Before/After slider */}
            <div
              ref={sliderRef}
              onMouseMove={handleMouseMove}
              onTouchMove={handleMouseMove}
              style={{ height: 260, borderRadius: 10, overflow: 'hidden', position: 'relative', background: '#000', cursor: 'ew-resize', userSelect: 'none' }}
            >
              {/* Original (Left) */}
              <img src={preview!} alt="Original" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} />

              {/* Annotated (Right) - Clipped */}
              {result.annotated_image_b64 && (
                <div style={{ position: 'absolute', inset: 0, clipPath: `polygon(${sliderPos}% 0, 100% 0, 100% 100%, ${sliderPos}% 100%)` }}>
                  <img src={`data:image/jpeg;base64,${result.annotated_image_b64}`} alt="Annotated" style={{ width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} />
                </div>
              )}

              {/* Slider Handle */}
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`, width: 2, background: 'var(--cyan)', transform: 'translateX(-50%)' }}>
                <div style={{ width: 16, height: 32, background: 'var(--cyan)', borderRadius: 4, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 2, height: 12, background: '#000', borderRadius: 1 }} />
                </div>
              </div>

              <span className="font-body" style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4, pointerEvents: 'none' }}>ORIGINAL</span>
              <span className="font-body" style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, color: 'var(--cyan)', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4, pointerEvents: 'none' }}>AI ANNOTATED</span>
            </div>

            {/* Detection banner */}
            <div style={{
              padding: '12px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10,
              background: result.anomaly_detected ? 'rgba(255,59,92,0.1)' : 'rgba(0,255,157,0.08)',
              border: `1px solid ${result.anomaly_detected ? 'rgba(255,59,92,0.25)' : 'rgba(0,255,157,0.25)'}`,
            }}>
              {result.anomaly_detected
                ? <><AlertTriangle size={18} style={{ color: 'var(--red)' }} /><span className="font-heading" style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>ANOMALY DETECTED</span></>
                : <><CheckCircle size={18} style={{ color: 'var(--green)' }} /><span className="font-heading" style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>NO ANOMALIES FOUND</span></>
              }
            </div>

            {/* Confidence gauge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>AI CONFIDENCE</span>
                  <span className="font-number" style={{ fontSize: 13, color: 'var(--text)' }}>{Math.round(result.confidence * 100)}%</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${result.confidence * 100}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    style={{ height: '100%', background: 'linear-gradient(90deg, var(--cyan), var(--green))', borderRadius: 3 }} />
                </div>
              </div>
            </div>

            {/* Regions list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>DETECTED REGIONS</span>
              {result.anomaly_regions?.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
                  {result.anomaly_regions.map((r: any) => (
                    <motion.div key={r.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span className="font-body" style={{ fontSize: 13, color: 'var(--text)' }}>{r.location || `Region ${r.id}`}</span>
                        <span className="font-number" style={{ fontSize: 12, color: confColor(r.confidence * 100) }}>{Math.round(r.confidence * 100)}%</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        <span className="font-body" style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(0,0,0,0.2)', borderRadius: 4, color: 'var(--muted)' }}>Area: {r.area}px²</span>
                        <span className="font-body" style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(0,0,0,0.2)', borderRadius: 4, color: 'var(--muted)' }}>Inten: {Math.round(r.mean_intensity)}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)' }}>No distinct anomaly regions identified</span>
              )}
            </div>

            {/* Findings */}
            <div style={{ marginTop: 'auto' }}>
              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>AI FINDINGS</span>
              <div style={{ background: 'var(--elevated)', padding: 16, borderRadius: 8, borderLeft: '2px solid var(--cyan)' }}>
                <p className="font-body" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>
                  {highlightMedical(result.findings)}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              {['Save Report', 'Send to Specialist', 'Export PDF'].map(label => (
                <button key={label} data-cursor="hover" onClick={() => {
                  if (label === 'Export PDF') handleExportPdf(result.session_id);
                }} style={{
                  flex: 1, height: 36, borderRadius: 8, background: 'transparent',
                  border: '1px solid rgba(0,229,255,0.25)', color: 'var(--cyan)',
                  fontFamily: 'var(--font-body)', fontSize: 12, transition: 'background 200ms'
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >{label}</button>
              ))}
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ImagingAI;
