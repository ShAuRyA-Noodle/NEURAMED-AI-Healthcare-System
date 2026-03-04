import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Stethoscope } from 'lucide-react';
import { useVoiceDiagnosis } from '@/hooks/useVoiceDiagnosis';
import { useToast } from '@/hooks/useToast';
import { ConfidenceMeter } from '@/components/shared/ConfidenceMeter';
import { UrgencyBadge } from '@/components/shared/UrgencyBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonCard } from '@/components/shared/SkeletonCard';

const TEMPLATES = ['Chest pain', 'Shortness of breath', 'Fever & cough', 'Headache', 'Fatigue', 'Joint pain'];
const MEDICAL_TERMS = ['pain', 'fever', 'breath', 'chest', 'cough', 'fatigue', 'nausea', 'dizziness', 'swelling', 'infection', 'inflammation', 'cardiac', 'pulmonary', 'pneumonia', 'sputum', 'chills', 'crackles', 'hemoptysis', 'pleuritic', 'respiratory', 'temperature', 'auscultation', 'dyspnea', 'wheezing', 'bronchitis', 'edema', 'hypertension', 'diabetes', 'arrhythmia', 'anemia', 'fracture', 'antibiotic', 'diagnosis', 'symptoms', 'chronic', 'acute'];

const highlightMedical = (text: string) => {
  const words = text.split(/\b/);
  return words.map((w, i) =>
    MEDICAL_TERMS.some(t => t.toLowerCase() === w.toLowerCase())
      ? <span key={i} style={{ color: 'var(--cyan)', fontWeight: 600 }}>{w}</span>
      : w
  );
};

const VoicePage = () => {
  const { mutateAsync: diagnose, isPending, data: resultData } = useVoiceDiagnosis();
  const [result, setResult] = useState<any>(null);
  const { addToast } = useToast();

  const [tab, setTab] = useState<'record' | 'type'>('type');
  const [transcript, setTranscript] = useState('');

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Waveform State
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [waveData, setWaveData] = useState<number[]>(Array(20).fill(4));

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => setDuration(d => d + 1), 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    if (resultData) setResult(resultData);
  }, [resultData]);

  const updateWaveform = () => {
    if (analyserRef.current && dataArrayRef.current) {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);
      const currentData = dataArrayRef.current;
      const newWave: number[] = [];
      for (let i = 0; i < 20; i++) {
        newWave.push(Math.max(4, (currentData[i] / 255) * 48));
      }
      setWaveData(newWave);
    }
    animationFrameRef.current = requestAnimationFrame(updateWaveform);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      addToast('error', 'Recording not supported in this browser. Use Type tab.');
      setTab('type');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let options: any = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/ogg' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = undefined;
        }
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      // Audio Context for Waveform
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;
      animationFrameRef.current = requestAnimationFrame(updateWaveform);

      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const b64 = base64data.split(',')[1];
          try {
            const res = await diagnose({ audio_base64: b64, patient_id: 1 });
            setResult(res);
          } catch (e) {
            console.error('Audio diagnosis failed', e);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error('Failed to start recording', e);
      addToast('error', 'Microphone access denied. Use the Type tab instead.');
      setTab('type');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (audioCtxRef.current) audioCtxRef.current.close().catch(console.error);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setWaveData(Array(20).fill(4));
    }
  };

  const toggleRecording = () => isRecording ? stopRecording() : startRecording();

  const handleTypeAnalysis = async () => {
    if (transcript.length < 10 || isPending) return;
    try {
      const res = await diagnose({ transcript, patient_id: 1 });
      setResult(res);
    } catch {
      console.error('Text diagnosis failed');
    }
  };

  const reset = () => {
    setResult(null);
    setTranscript('');
    setDuration(0);
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
      a.download = `neuramed-report-${sessionId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'PDF downloaded successfully');
    } catch {
      addToast('error', 'Failed to generate PDF');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 24 }}>
      {/* LEFT: Input Panel */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' }}>
        <span className="font-heading" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 20 }}>Voice Diagnosis</span>

        {/* Tab Bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20, position: 'relative' }}>
          {(['type', 'record'] as const).map(t => (
            <button key={t} data-cursor="hover" onClick={() => setTab(t)} style={{
              flex: 1, padding: '12px 0', background: 'transparent', border: 'none',
              fontFamily: 'var(--font-body)', fontSize: 13, textTransform: 'capitalize',
              color: tab === t ? 'var(--text)' : 'var(--muted)', position: 'relative'
            }}>
              {t}
              {tab === t && (
                <motion.div layoutId="tab-underline"
                  style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, background: 'var(--cyan)' }}
                />
              )}
            </button>
          ))}
        </div>

        {tab === 'type' ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Describe the patient's symptoms here..."
              data-cursor="hover"
              style={{
                width: '100%', height: 160, background: 'var(--elevated)', border: '1px solid var(--border)',
                borderRadius: 8, padding: 16, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)',
                outline: 'none', resize: 'none', marginBottom: 16, lineHeight: 1.6
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-glow)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />

            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>QUICK TEMPLATES</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {TEMPLATES.map(t => (
                <button key={t} data-cursor="hover"
                  onClick={() => setTranscript(prev => (prev ? prev + ' ' : '') + t)}
                  style={{
                    padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 11,
                    transition: 'all 200ms'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  {t}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 'auto' }}>
              <button data-cursor="hover" onClick={handleTypeAnalysis} disabled={transcript.length < 10 || isPending}
                style={{
                  width: '100%', height: 44, borderRadius: 8, border: 'none',
                  background: (transcript.length < 10 || isPending) ? 'rgba(0,229,255,0.3)' : 'var(--cyan)',
                  color: '#000', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14,
                  opacity: (transcript.length < 10 || isPending) ? 0.5 : 1, transition: 'all 200ms'
                }}>
                {isPending ? 'Analyzing...' : 'Analyze Symptoms →'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px 0' }}>
            <div
              data-cursor="hover"
              onClick={toggleRecording}
              style={{
                width: 88, height: 88, borderRadius: '50%',
                background: isRecording ? 'rgba(255,59,92,0.1)' : 'rgba(0,229,255,0.1)',
                border: `2px solid ${isRecording ? 'var(--red)' : 'var(--cyan)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isRecording ? '0 0 0 8px rgba(255,59,92,0.05)' : 'none',
                transition: 'all 300ms'
              }}
            >
              {isRecording
                ? <MicOff size={32} style={{ color: 'var(--red)' }} />
                : <Mic size={32} style={{ color: 'var(--cyan)' }} />
              }
            </div>

            <div style={{ height: 40, marginTop: 24, display: 'flex', alignItems: 'center', gap: 4 }}>
              {isRecording ? (
                waveData.map((h, i) => (
                  <motion.div key={i}
                    animate={{ height: `${h}px` }}
                    transition={{ type: 'tween', duration: 0.05 }}
                    style={{ width: 3, background: 'var(--cyan)', borderRadius: 2 }}
                  />
                ))
              ) : (
                <span className="font-body" style={{ color: 'var(--muted)', fontSize: 13 }}>Click to start recording</span>
              )}
            </div>

            {isRecording && (
              <span className="font-number" style={{ color: 'var(--red)', fontSize: 16, marginTop: 16 }}>
                00:{duration.toString().padStart(2, '0')}
              </span>
            )}

            {isPending && (
              <span className="font-body" style={{ color: 'var(--cyan)', fontSize: 14, marginTop: 24, animation: 'breathe 2s infinite' }}>
                Analyzing Audio...
              </span>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: Results Panel */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' }}>
        {!result && !isPending ? (
          <EmptyState icon={Stethoscope} title="Run a diagnosis" subtitle="Diagnostic results will appear here" />
        ) : isPending ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ width: 120, height: 120, borderRadius: '50%', overflow: 'hidden' }}>
                <SkeletonCard height={120} />
              </div>
              <div style={{ flex: 1 }}>
                <SkeletonCard height={120} />
              </div>
            </div>
            <SkeletonCard height={200} />
            <SkeletonCard height={100} />
          </div>
        ) : result ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>

            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <ConfidenceMeter value={result.confidence ?? result.confidence_score ?? 0} size={120} />
                <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em' }}>CONFIDENCE</span>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ width: '100%', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UrgencyBadge urgency={result.urgency ?? result.urgency_level ?? 'medium'} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>DETECTED CONDITIONS</span>
                  {(result.conditions ?? result.conditions_detected ?? []).map((c: any, i: number) => {
                    const name = typeof c === 'string' ? c : c.name;
                    const baseConf = result.confidence ?? result.confidence_score ?? 0.5;
                    const prob = i === 0 ? Math.round(baseConf * 100) :
                      i === 1 ? Math.round(baseConf * 80) :
                        Math.round(baseConf * 60);
                    const color = i === 0 ? 'var(--cyan)' : i === 1 ? 'var(--green)' : 'var(--amber)';
                    return (
                      <motion.div key={name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                      >
                        <span className="font-heading" style={{ fontSize: 15, color: 'var(--text)', width: 140 }}>{name}</span>
                        <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${prob}%` }} transition={{ duration: 1 }} style={{ height: '100%', background: color }} />
                        </div>
                        <span className="font-number" style={{ fontSize: 13, color }}>{prob}%</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--elevated)', borderRadius: 8, padding: 20 }}>
              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 12 }}>RECOMMENDATIONS</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.recommendations?.map((r: string, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 4, height: 4, background: 'var(--cyan)', marginTop: 8, flexShrink: 0 }} />
                    <span className="font-body" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{r}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>ANALYZED TRANSCRIPT</span>
              <p className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.8, background: 'var(--elevated)', padding: 16, borderRadius: 8, margin: 0 }}>
                {highlightMedical(result.transcript)}
              </p>
            </div>

            <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', gap: 12 }}>
              {['Save Session', 'Export PDF', 'New Diagnosis'].map(label => (
                <button key={label} data-cursor="hover" onClick={() => {
                  if (label === 'New Diagnosis') reset();
                  else if (label === 'Export PDF') handleExportPdf(result.session_id);
                }} style={{
                  flex: 1, height: 36, borderRadius: 8, background: 'transparent',
                  border: '1px solid rgba(0,229,255,0.25)', color: 'var(--cyan)',
                  fontFamily: 'var(--font-body)', fontSize: 12, transition: 'all 200ms'
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >{label}</button>
              ))}
            </div>

          </motion.div>
        ) : null}
      </div>
    </div>
  );
};

export default VoicePage;
