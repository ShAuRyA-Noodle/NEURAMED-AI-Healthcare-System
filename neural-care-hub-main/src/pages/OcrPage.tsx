import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Copy, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useOcrAnalysis } from '@/hooks/useOcrAnalysis';
import { useToast } from '@/hooks/useToast';

const MEDICAL_TERMS = ['WBC', 'CRP', 'ABG', 'COPD', 'pneumonia', 'dyspnea', 'sputum', 'fever', 'antibiotic', 'prednisone', 'azithromycin', 'albuterol', 'ipratropium', 'leukocytosis', 'hypercapnia', 'exacerbation', 'Haemophilus', 'influenzae', 'acidosis', 'hyperinflation'];

const highlightMedical = (text: string) => {
  const regex = new RegExp(`\\b(${MEDICAL_TERMS.join('|')})\\b`, 'gi');
  return text.split(regex).map((part, i) =>
    MEDICAL_TERMS.some(t => t.toLowerCase() === part.toLowerCase())
      ? <span key={i} style={{ color: 'var(--cyan)', fontWeight: 600 }}>{part}</span>
      : part
  );
};

const SECTIONS = ['Chief Complaint', 'History', 'Findings', 'Impression', 'Recommendations'];

const OCRReports = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [patientId, setPatientId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'raw' | 'findings' | 'flags'>('summary');
  const [activeSection, setActiveSection] = useState(SECTIONS[0]);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
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
      setActiveTab('summary');
    } catch (e) {
      console.error('OCR failed', e);
    }
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

  const tabs: ('summary' | 'raw' | 'findings' | 'flags')[] = ['summary', 'raw', 'findings', 'flags'];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 24 }}>
      {/* LEFT */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' }}>
        <span className="font-heading" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 20 }}>OCR Reports</span>

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
              transition: 'all 200ms', position: 'relative', overflow: 'hidden'
            }}
          >
            <FileText size={36} style={{ color: 'var(--muted)', transition: 'transform 200ms', transform: dragOver ? 'scale(1.15)' : 'scale(1)' }} strokeWidth={1.5} />
            <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)' }}>Drop medical document</span>
            <span className="font-body" style={{ fontSize: 12, color: 'var(--dim)' }}>PDF · PNG · JPEG · TIFF</span>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {preview ? (
              <img src={preview} alt="Report" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 8, opacity: isPending ? 0.3 : 1 }} />
            ) : (
              <div style={{ height: 160, background: 'var(--elevated)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, opacity: isPending ? 0.3 : 1 }}>
                <FileText size={32} style={{ color: 'var(--muted)' }} />
                <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>{file.name}</span>
                <span className="font-body" style={{ fontSize: 10, color: 'var(--dim)' }}>{(file.size / 1024).toFixed(0)}KB</span>
              </div>
            )}

            {isPending && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'relative', width: 60, height: 80 }}>
                  <svg viewBox="0 0 60 80" fill="none">
                    <rect x={4} y={4} width={52} height={72} rx={4} stroke="var(--cyan)" strokeWidth={1} fill="none" opacity={0.5} />
                    <motion.line x1={8} x2={52} y1={20} y2={20} stroke="var(--cyan)" strokeWidth={2}
                      animate={{ y1: [10, 70, 10], y2: [10, 70, 10] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      style={{ filter: 'blur(1px) brightness(1.5)', boxShadow: '0 0 10px 2px var(--cyan)' }} />
                  </svg>
                </div>
              </div>
            )}
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*,.pdf,.tiff" hidden onChange={e => {
          if (e.target.files?.[0]) handleFile(e.target.files[0]);
          e.target.value = '';
        }} />

        <div style={{ marginTop: 24, flex: 1 }}>
          <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>PATIENT ID</label>
          <input value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="e.g. 104"
            data-cursor="hover"
            style={{
              width: '100%', height: 40, background: 'var(--elevated)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '0 14px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none',
              transition: 'all 200ms'
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--border-glow)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
          />
        </div>

        <button data-cursor="hover" onClick={handleAnalyze} disabled={!file || isPending}
          style={{
            marginTop: 24, width: '100%', height: 44,
            background: (!file || isPending) ? 'rgba(0,229,255,0.3)' : 'var(--cyan)',
            color: '#000', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14,
            borderRadius: 8, border: 'none', opacity: (!file || isPending) ? 0.4 : 1, transition: 'all 200ms'
          }}>
          {isPending ? 'Extracting Text...' : 'Extract & Analyze'}
        </button>
      </div>

      {/* RIGHT */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' }}>
        {!result ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <FileText size={48} style={{ color: 'var(--dim)' }} strokeWidth={1} />
            <span className="font-heading" style={{ fontSize: 18, color: 'var(--muted)' }}>No report loaded</span>
            <span className="font-body" style={{ fontSize: 13, color: 'var(--dim)', maxWidth: 280, textAlign: 'center' }}>
              Upload a document to extract text and analyze findings with our clinical OCR engine.
            </span>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20, position: 'relative' }}>
              {tabs.map(t => (
                <button key={t} data-cursor="hover" onClick={() => setActiveTab(t)} style={{
                  flex: 1, padding: '12px 0', background: 'transparent', border: 'none',
                  fontFamily: 'var(--font-body)', fontSize: 13, textTransform: 'capitalize',
                  color: activeTab === t ? 'var(--text)' : 'var(--muted)', position: 'relative', transition: 'color 200ms'
                }}>
                  {t === 'raw' ? 'Raw Text' : t === 'findings' ? 'Key Findings' : t}
                  {activeTab === t && (
                    <motion.div layoutId="ocr-tab-underline"
                      style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, background: 'var(--cyan)' }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {activeTab === 'summary' && (
                    <>
                      <div style={{ background: 'var(--elevated)', borderRadius: 10, padding: 20, borderLeft: '2px solid var(--cyan)' }}>
                        <p className="font-heading" style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.8, margin: 0 }}>{result.summary}</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                          <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>DIAGNOSES / CONDITIONS</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {result.conditions?.map((c: string) => (
                              <span key={c} className="font-body" style={{ fontSize: 12, padding: '4px 12px', borderRadius: 4, border: '1px solid rgba(0,229,255,0.2)', color: 'var(--cyan)', background: 'rgba(0,229,255,0.05)' }}>{c}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>MEDICATIONS</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {result.medications?.map((m: string) => (
                              <span key={m} className="font-body" style={{ fontSize: 12, padding: '4px 12px', borderRadius: 4, border: '1px solid rgba(0,255,157,0.2)', color: 'var(--green)', background: 'rgba(0,255,157,0.05)' }}>{m}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {activeTab === 'raw' && (
                    <div style={{ position: 'relative' }}>
                      <button data-cursor="hover" onClick={() => {
                        navigator.clipboard.writeText(result.extracted_text || ''); setCopied(true); setTimeout(() => setCopied(false), 2000);
                      }} style={{
                        position: 'absolute', top: 8, right: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--muted)',
                        display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)', fontSize: 11, padding: '6px 12px', transition: 'all 200ms', zIndex: 1
                      }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}>
                        <Copy size={14} /> {copied ? 'COPIED!' : 'COPY TEXT'}
                      </button>
                      <div style={{ background: 'var(--elevated)', borderRadius: 10, padding: '20px 16px', border: '1px solid var(--border)' }}>
                        {result.extracted_text ? (
                          <pre className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>
                            {highlightMedical(result.extracted_text)}
                          </pre>
                        ) : (
                          <span className="font-body" style={{ fontSize: 13, color: 'var(--muted)' }}>
                            No text could be extracted. Ensure file is not password protected and contains readable text.
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'findings' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {result.key_findings?.length > 0 ? result.key_findings.map((f: string, i: number) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                          style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px' }}>
                          <span className="font-body" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{f}</span>
                        </motion.div>
                      )) : (
                        <span className="font-body" style={{ fontSize: 13, color: 'var(--muted)' }}>No key findings extracted.</span>
                      )}
                    </div>
                  )}

                  {activeTab === 'flags' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {!result.abnormal_flags?.length ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 40, border: '1px dashed rgba(0,255,157,0.3)', borderRadius: 12, background: 'rgba(0,255,157,0.02)' }}>
                          <ShieldCheck size={48} style={{ color: 'var(--green)' }} strokeWidth={1} />
                          <span className="font-heading" style={{ fontSize: 16, color: 'var(--green)' }}>No critical flags detected</span>
                        </div>
                      ) : (
                        result.abnormal_flags.map((flag: string, i: number) => (
                          <div key={i} style={{ background: 'var(--elevated)', border: '1px solid rgba(255,149,0,0.3)', borderRadius: 8, padding: '16px 20px', borderLeft: '4px solid var(--amber)' }}>
                            <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                              <AlertTriangle size={18} style={{ color: 'var(--amber)', marginTop: 2, flexShrink: 0 }} />
                              <span className="font-body" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{flag}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Timeline - from actual result sections */}
            <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ display: 'flex', gap: 0, justifyContent: 'space-between', alignItems: 'center' }}>
                {(result.sections ? Object.keys(result.sections) : SECTIONS).map((s: string, i: number, arr: string[]) => (
                  <div key={s} data-cursor="hover" onClick={() => setActiveSection(s)} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: activeSection === s ? 'var(--cyan)' : arr.indexOf(activeSection) > i ? 'var(--cyan)' : 'var(--dim)',
                      transition: 'background 300ms'
                    }} />
                    <span className="font-body" style={{ fontSize: 10, color: activeSection === s ? 'var(--text)' : 'var(--dim)', transition: 'color 300ms', whiteSpace: 'nowrap' }}>{s}</span>
                    {i < arr.length - 1 && <div style={{ height: 1, flex: 1, background: arr.indexOf(activeSection) > i ? 'var(--cyan)' : 'var(--border)', margin: '0 8px', transition: 'background 300ms' }} />}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions Footer */}
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
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

export default OCRReports;
