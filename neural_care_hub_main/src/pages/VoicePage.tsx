import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Stethoscope, ChevronDown, ChevronUp, AlertTriangle, Clock, FileText, RotateCcw, Download, Activity, Shield, Pill, Heart, FlaskConical, Languages, Loader2, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sarvamTTS } from '@/api/sarvam';
import { useVoiceDiagnosis } from '@/hooks/useVoiceDiagnosis';
import { useToast } from '@/hooks/useToast';
import { ConfidenceMeter } from '@/components/shared/ConfidenceMeter';
import { UrgencyBadge } from '@/components/shared/UrgencyBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { ProvenanceChip } from '@/components/shared/ProvenanceChip';
import { CitationList } from '@/components/shared/CitationList';
import VoiceOrb from '@/components/three/VoiceOrb';
import type { DiagnosisResult, ConditionDetail } from '@/types';

// 12 clinical templates
const TEMPLATES = [
  { label: 'Chest Pain', text: 'Patient presents with substernal chest pain radiating to left arm, onset 2 hours ago, associated with diaphoresis and shortness of breath.' },
  { label: 'Shortness of Breath', text: 'Progressive dyspnea over 3 days, worse with exertion, orthopnea present, bilateral ankle edema noted.' },
  { label: 'Fever & Cough', text: 'High-grade fever 39.5°C for 4 days with productive cough, yellowish sputum, right-sided pleuritic chest pain.' },
  { label: 'Severe Headache', text: 'Sudden onset severe headache described as worst of life, photophobia, neck stiffness, nausea and vomiting.' },
  { label: 'Abdominal Pain', text: 'Sharp RLQ abdominal pain for 12 hours, initially periumbilical, now localized, with nausea, low-grade fever 38.1°C.' },
  { label: 'Dizziness & Syncope', text: 'Recurrent episodes of dizziness and near-syncope, worse on standing, palpitations, no chest pain.' },
  { label: 'Joint Pain', text: 'Bilateral knee and wrist pain with morning stiffness lasting over 1 hour, small joint swelling in hands, fatigue.' },
  { label: 'Back Pain + Weakness', text: 'Acute lower back pain after lifting, radiating to left leg, numbness in L5 dermatome, difficulty with dorsiflexion.' },
  { label: 'Skin Rash', text: 'Expanding erythematous rash on trunk with central clearing, preceded by tick bite 10 days ago, mild arthralgias.' },
  { label: 'Diabetic Emergency', text: 'Type 1 diabetic, polyuria and polydipsia for 2 days, fruity breath odor, blood glucose 450 mg/dL, abdominal pain.' },
  { label: 'Pediatric Fever', text: '3-year-old with fever 40°C for 5 days, bilateral conjunctival injection, strawberry tongue, peeling fingertips, irritability.' },
  { label: 'Trauma Assessment', text: 'MVC unrestrained driver, GCS 14, complains of neck pain and left rib pain, steering wheel deformity, hemodynamically stable.' },
];

const LANGUAGES = [
  { code: 'en-US', label: 'English', ttsCode: 'en' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)', ttsCode: 'hi' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)', ttsCode: 'ta' },
  { code: 'te-IN', label: 'తెలుగు (Telugu)', ttsCode: 'te' },
  { code: 'bn-IN', label: 'বাংলা (Bengali)', ttsCode: 'bn' },
  { code: 'mr-IN', label: 'मराठी (Marathi)', ttsCode: 'mr' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ (Kannada)', ttsCode: 'kn' },
  { code: 'ml-IN', label: 'മലയാളം (Malayalam)', ttsCode: 'ml' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ (Punjabi)', ttsCode: 'pa' },
];

const MEDICAL_TERMS = ['pain', 'fever', 'breath', 'chest', 'cough', 'fatigue', 'nausea', 'dizziness', 'swelling', 'infection', 'inflammation', 'cardiac', 'pulmonary', 'pneumonia', 'sputum', 'chills', 'crackles', 'hemoptysis', 'pleuritic', 'respiratory', 'temperature', 'auscultation', 'dyspnea', 'wheezing', 'bronchitis', 'edema', 'hypertension', 'diabetes', 'arrhythmia', 'anemia', 'fracture', 'antibiotic', 'diagnosis', 'symptoms', 'chronic', 'acute', 'syncope', 'palpitations', 'dermatome', 'arthralgias', 'conjunctival', 'polydipsia', 'polyuria'];

const highlightMedical = (text: string) => {
  if (!text) return null;
  const words = text.split(/\b/);
  return words.map((w, i) =>
    MEDICAL_TERMS.some(t => t.toLowerCase() === w.toLowerCase())
      ? <span key={i} style={{ color: 'var(--cyan)', fontWeight: 600 }}>{w}</span>
      : w
  );
};

const URGENCY_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  critical: { bg: 'linear-gradient(135deg, rgba(255,59,92,0.12) 0%, rgba(239,68,68,0.06) 100%)', border: '#FF3B5C', text: '#fca5a5', glow: '0 0 20px rgba(255,59,92,0.15)' },
  high: { bg: 'linear-gradient(135deg, rgba(255,149,0,0.12) 0%, rgba(249,115,22,0.06) 100%)', border: '#FF9500', text: '#fdba74', glow: '0 0 20px rgba(255,149,0,0.12)' },
  medium: { bg: 'linear-gradient(135deg, rgba(0,229,255,0.1) 0%, rgba(0,229,255,0.03) 100%)', border: '#00E5FF', text: '#00E5FF', glow: '0 0 20px rgba(0,229,255,0.1)' },
  low: { bg: 'linear-gradient(135deg, rgba(0,255,157,0.1) 0%, rgba(34,197,94,0.03) 100%)', border: '#00FF9D', text: '#86efac', glow: '0 0 20px rgba(0,255,157,0.1)' },
};

const VoicePage = () => {
  const { mutateAsync: diagnose, isPending } = useVoiceDiagnosis();
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const { addToast } = useToast();
  const { user } = useAuth();

  const [tab, setTab] = useState<'record' | 'type'>('type');
  const [transcript, setTranscript] = useState('');
  const [language, setLanguage] = useState('en-US');

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [duration, setDuration] = useState(0);
  const recognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef('');

  // Waveform state
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [waveData, setWaveData] = useState<number[]>(Array(24).fill(4));

  // TTS state
  const [listenLang, setListenLang] = useState('en');
  const [ttsLoading, setTtsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  const speakAnalysis = async (text: string, lang: string) => {
    if (isSpeaking) {
      ttsAudioRef.current?.pause();
      ttsAudioRef.current = null;
      setIsSpeaking(false);
      return;
    }
    ttsAudioRef.current?.pause();
    ttsAudioRef.current = null;
    setTtsLoading(true);
    setIsSpeaking(true);
    try {
      const blob = await sarvamTTS(text, lang);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      ttsAudioRef.current = audio;
      audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url); addToast('error', 'Audio playback failed'); };
      await audio.play();
    } catch (err: any) {
      setIsSpeaking(false);
      addToast('error', `TTS failed: ${err.message || 'Unknown error'}`);
    } finally {
      setTtsLoading(false);
    }
  };

  // Cleanup TTS on unmount
  useEffect(() => { return () => { ttsAudioRef.current?.pause(); }; }, []);

  // Collapsible states
  const [showTranscript, setShowTranscript] = useState(false);
  const [showDifferential, setShowDifferential] = useState(false);
  const [lifestyleChecked, setLifestyleChecked] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('neuramed-lifestyle-checks') || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
      interval = setInterval(() => setDuration(d => d + 1), 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    localStorage.setItem('neuramed-lifestyle-checks', JSON.stringify(lifestyleChecked));
  }, [lifestyleChecked]);

  const updateWaveform = useCallback(() => {
    if (analyserRef.current && dataArrayRef.current) {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      const newWave: number[] = [];
      for (let i = 0; i < 24; i++) {
        newWave.push(Math.max(4, (dataArrayRef.current[i] / 255) * 56));
      }
      setWaveData(newWave);
    }
    animationFrameRef.current = requestAnimationFrame(updateWaveform);
  }, []);

  const startRecording = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addToast('error', 'Speech recognition not supported. Use Chrome or Edge, or switch to Type tab.');
      setTab('type');
      return;
    }

    try {
      // Start audio stream for waveform visualization
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
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

      // Start speech recognition
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onresult = (event: any) => {
        let final = '';
        let interim = '';
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        const trimmed = final.trim();
        liveTranscriptRef.current = trimmed;
        setLiveTranscript(trimmed);
        setInterimTranscript(interim);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          addToast('error', 'Microphone access denied. Please allow microphone access.');
        }
      };

      recognition.onend = () => {
        // Chrome auto-stops after silence — restart if still recording
        if (recognitionRef.current) {
          try { recognitionRef.current.start(); } catch { /* already stopped */ }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      setLiveTranscript('');
      setInterimTranscript('');
    } catch (e) {
      console.error('Failed to start recording', e);
      addToast('error', 'Microphone access denied. Use the Type tab instead.');
      setTab('type');
    }
  };

  const stopRecording = async () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null; // Nullify first so onend doesn't restart
    if (recognition) {
      recognition.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) audioCtxRef.current.close().catch(console.error);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setWaveData(Array(24).fill(4));
    setIsRecording(false);

    // Auto-submit after 1s delay — read from ref to avoid stale closure
    setTimeout(async () => {
      const finalText = liveTranscriptRef.current;
      if (finalText && finalText.length >= 10) {
        try {
          const ttsCode = LANGUAGES.find(l => l.code === language)?.ttsCode || 'en';
          const res = await diagnose({ transcript: finalText, patient_id: undefined, language: ttsCode });
          setResult(res);
        } catch {
          addToast('error', 'Voice diagnosis failed');
        }
      } else if (finalText) {
        addToast('error', 'Please speak a bit more — at least a few words about your symptoms.');
      }
    }, 1000);
  };

  const toggleRecording = () => isRecording ? stopRecording() : startRecording();

  const handleTypeAnalysis = async () => {
    if (transcript.length < 10 || isPending) return;
    try {
      const ttsCode = LANGUAGES.find(l => l.code === language)?.ttsCode || 'en';
      const res = await diagnose({ transcript, patient_id: undefined, language: ttsCode });
      setResult(res);
    } catch {
      addToast('error', 'Text diagnosis failed');
    }
  };

  const reset = () => {
    setResult(null);
    setTranscript('');
    setLiveTranscript('');
    liveTranscriptRef.current = '';
    setInterimTranscript('');
    setDuration(0);
    setShowTranscript(false);
    setShowDifferential(false);
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
      a.download = `neuramed-voice-report-${sessionId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'PDF downloaded successfully');
    } catch {
      addToast('error', 'Failed to generate PDF');
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Extract typed conditions
  const conditions: ConditionDetail[] = result?.conditions ?? [];
  const urgency = result?.urgency ?? 'medium';
  const urgencyColor = URGENCY_COLORS[urgency] || URGENCY_COLORS.medium;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🎤</div>
          <div>
            <h1 className="font-heading" style={{ fontSize: 24, color: 'var(--text)', margin: 0 }}>Voice Diagnosis</h1>
            <p className="font-body" style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>AI-powered differential diagnosis from symptom descriptions</p>
          </div>
        </div>
      </div>

      <div className="split-workspace">
        {/* LEFT: Input Panel */}
        <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column' }}>
          {/* Tab Bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20, position: 'relative' }}>
            {(['type', 'record'] as const).map(t => (
              <button key={t} data-cursor="hover" onClick={() => setTab(t)} style={{
                flex: 1, padding: '12px 0', background: 'transparent', border: 'none',
                fontFamily: 'var(--font-body)', fontSize: 13, textTransform: 'capitalize',
                color: tab === t ? 'var(--text)' : 'var(--muted)', position: 'relative', cursor: 'pointer'
              }}>
                {t === 'type' ? '⌨ Type' : '🎙 Record'}
                {tab === t && (
                  <motion.div layoutId="voice-tab-underline"
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
                placeholder="Describe the patient's symptoms in detail. Include onset, duration, severity, associated symptoms, and relevant history..."
                data-cursor="hover"
                style={{
                  width: '100%', height: 180, background: 'var(--elevated)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: 16, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)',
                  outline: 'none', resize: 'none', marginBottom: 16, lineHeight: 1.6
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-glow)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />

              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, letterSpacing: '0.1em' }}>CLINICAL TEMPLATES</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20, maxHeight: 120, overflowY: 'auto' }}>
                {TEMPLATES.map(t => (
                  <button key={t.label} data-cursor="hover"
                    onClick={() => setTranscript(t.text)}
                    style={{
                      padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 11,
                      transition: 'all 200ms', cursor: 'pointer', whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(0,229,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(0,229,255,0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {transcript.length} characters {transcript.length < 10 && '(min 10)'}
                  </span>
                </div>
                <button data-cursor="hover" onClick={handleTypeAnalysis} disabled={transcript.length < 10 || isPending}
                  style={{
                    width: '100%', height: 44, borderRadius: 8, border: 'none',
                    background: (transcript.length < 10 || isPending) ? 'rgba(0,229,255,0.3)' : 'var(--cyan)',
                    color: '#000', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14,
                    opacity: (transcript.length < 10 || isPending) ? 0.5 : 1, transition: 'all 200ms',
                    cursor: (transcript.length < 10 || isPending) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                  }}>
                  {isPending ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing...</> : 'Analyze Symptoms →'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              {/* Language Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <Languages size={14} style={{ color: 'var(--muted)' }} />
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  style={{
                    background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 6,
                    padding: '4px 8px', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 12,
                    outline: 'none', cursor: 'pointer'
                  }}
                >
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>

              {/* VoiceOrb + Mic Button */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '10px 0' }}>
                {/* Three.js VoiceOrb */}
                <div data-cursor="hover" onClick={toggleRecording}
                  role="button" tabIndex={0}
                  aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                  aria-pressed={isRecording}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRecording(); } }}
                  style={{ cursor: 'pointer', position: 'relative' }}>
                  <VoiceOrb isRecording={isRecording} audioLevel={waveData.length > 0 ? Math.max(...waveData) / 56 : 0} />
                  {/* Overlay mic icon */}
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                  }}>
                    {isRecording
                      ? <MicOff size={28} style={{ color: 'var(--red)', filter: 'drop-shadow(0 0 8px rgba(255,59,92,0.5))' }} />
                      : <Mic size={28} style={{ color: 'var(--cyan)', filter: 'drop-shadow(0 0 8px rgba(0,229,255,0.5))' }} />
                    }
                  </div>
                </div>

                {/* Waveform */}
                <div style={{ height: 48, marginTop: 20, display: 'flex', alignItems: 'center', gap: 3 }}>
                  {isRecording ? (
                    waveData.map((h, i) => (
                      <motion.div key={i}
                        animate={{ height: `${h}px` }}
                        transition={{ type: 'tween', duration: 0.05 }}
                        style={{ width: 3, background: 'var(--cyan)', borderRadius: 2, opacity: 0.7 + (h / 56) * 0.3 }}
                      />
                    ))
                  ) : (
                    <span className="font-body" style={{ color: 'var(--muted)', fontSize: 13 }}>
                      {isPending ? 'Processing...' : 'Click to start recording'}
                    </span>
                  )}
                </div>

                {isRecording && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', animation: 'breathe 1.5s infinite' }} />
                    <span className="font-number" style={{ color: 'var(--red)', fontSize: 18 }}>
                      {formatDuration(duration)}
                    </span>
                  </div>
                )}

                {/* Live Transcript */}
                {(liveTranscript || interimTranscript) && (
                  <div style={{
                    marginTop: 20, width: '100%', padding: 16, background: 'var(--elevated)',
                    borderRadius: 8, border: '1px solid var(--border)', maxHeight: 160, overflowY: 'auto'
                  }}>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>LIVE TRANSCRIPT</span>
                    <p className="font-body" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
                      {liveTranscript}
                      {interimTranscript && <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}> {interimTranscript}</span>}
                    </p>
                  </div>
                )}

                {isPending && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
                    <Loader2 size={16} style={{ color: 'var(--cyan)', animation: 'spin 1s linear infinite' }} />
                    <span className="font-body" style={{ color: 'var(--cyan)', fontSize: 14 }}>Analyzing speech...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Results Panel */}
        <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!result && !isPending ? (
            <div style={{ padding: 24, flex: 1 }}>
              <EmptyState icon={Stethoscope} title="Run a diagnosis" subtitle="Describe symptoms or record speech to receive AI-powered differential diagnosis with ICD-10 codes" />
            </div>
          ) : isPending ? (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <SkeletonCard height={60} />
              <div className="form-grid-3" style={{ gap: 12 }}>
                <SkeletonCard height={160} />
                <SkeletonCard height={160} />
                <SkeletonCard height={160} />
              </div>
              <SkeletonCard height={120} />
              <SkeletonCard height={100} />
            </div>
          ) : result ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>

              {/* Urgency Banner */}
              <div style={{
                padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: urgencyColor.bg, borderBottom: `1px solid ${urgencyColor.border}30`,
                boxShadow: urgencyColor.glow, position: 'relative', overflow: 'hidden',
                animation: urgency === 'critical' ? 'border-breathe 2s ease-in-out infinite' : 'none',
              }}>
                {/* Pulsing dot for critical */}
                {urgency === 'critical' && (
                  <div style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    width: 8, height: 8, borderRadius: '50%', background: '#FF3B5C',
                    animation: 'pulse-red 1.5s ease-in-out infinite',
                  }} />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: urgency === 'critical' ? 16 : 0 }}>
                  <AlertTriangle size={18} style={{ color: urgencyColor.text, filter: `drop-shadow(0 0 4px ${urgencyColor.border}40)` }} />
                  <span className="font-number" style={{ fontSize: 13, color: urgencyColor.text, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                    {urgency}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Activity size={14} style={{ color: 'var(--muted)' }} />
                    <span className="font-number" style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {Math.round((result.overall_confidence ?? result.confidence ?? 0) * 100)}% confidence
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={14} style={{ color: 'var(--muted)' }} />
                    <span className="font-number" style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {result.processing_time_ms}ms
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, flex: 1, overflowY: 'auto' }}>
                {/* Provenance — what model produced this + how many real sources */}
                {result.provenance && <ProvenanceChip provenance={result.provenance} />}

                {/* Listen to Analysis */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                  background: 'var(--elevated)', borderRadius: 10, border: '1px solid var(--border)',
                }}>
                  <Volume2 size={15} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
                  <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Listen in</span>
                  <select value={listenLang} onChange={e => setListenLang(e.target.value)}
                    style={{
                      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
                      padding: '4px 8px', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 12,
                      cursor: 'pointer', outline: 'none',
                    }}>
                    {LANGUAGES.map(l => (
                      <option key={l.ttsCode} value={l.ttsCode}>{l.label}</option>
                    ))}
                  </select>
                  <button onClick={() => {
                    const parts: string[] = [];
                    if (conditions.length > 0) parts.push(`Primary diagnosis: ${conditions[0].name}. ${conditions[0].description || ''}`);
                    if (result.immediate_actions?.length) parts.push(`Immediate actions: ${result.immediate_actions.join('. ')}`);
                    if (result.follow_up) parts.push(`Follow up: ${result.follow_up}`);
                    if (result.when_to_go_to_er) parts.push(`Warning: ${result.when_to_go_to_er}`);
                    const summary = parts.join('. ') || 'No analysis available';
                    speakAnalysis(summary, listenLang);
                  }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                      borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
                      background: isSpeaking ? 'rgba(255,59,92,0.12)' : 'var(--cyan)',
                      border: isSpeaking ? '1px solid rgba(255,59,92,0.3)' : '1px solid transparent',
                      color: isSpeaking ? '#fca5a5' : '#000',
                      fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 700, transition: 'all 200ms',
                    }}>
                    {isSpeaking
                      ? (ttsLoading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading...</> : <><VolumeX size={14} /> Stop</>)
                      : <><Volume2 size={14} /> Play</>}
                  </button>
                </div>

                {/* Conditions + Right Column */}
                <div className="form-grid-2" style={{ gap: 20 }}>
                  {/* Left: Condition Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>DIFFERENTIAL DIAGNOSIS</span>
                    {conditions.length > 0 ? conditions.slice(0, 3).map((c, i) => {
                      const probPct = Math.round((c.probability ?? 0) * 100);
                      const barColor = i === 0 ? 'var(--cyan)' : i === 1 ? 'var(--green)' : 'var(--amber)';
                      return (
                        <motion.div key={c.name || i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }}
                          style={{
                            background: 'var(--elevated)', borderRadius: 10, padding: 16,
                            border: i === 0 ? '1px solid rgba(0,229,255,0.2)' : '1px solid var(--border)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                              <span className="font-heading" style={{ fontSize: 14, color: 'var(--text)', display: 'block' }}>{c.name}</span>
                              {c.icd_code && <span className="font-number" style={{ fontSize: 11, color: 'var(--cyan)', opacity: 0.8 }}>ICD-10: {c.icd_code}</span>}
                            </div>
                            <span className="font-number" style={{ fontSize: 18, color: barColor, fontWeight: 700 }}>{probPct}%</span>
                          </div>

                          {/* Probability bar */}
                          <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginBottom: 10 }}>
                            <motion.div initial={{ width: 0 }} animate={{ width: `${probPct}%` }} transition={{ duration: 1, delay: i * 0.15 }}
                              style={{ height: '100%', background: barColor, borderRadius: 2 }}
                            />
                          </div>

                          {c.description && (
                            <p className="font-body" style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 8px 0' }}>{c.description}</p>
                          )}

                          {/* Matching symptoms pills */}
                          {c.matching_symptoms?.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                              {c.matching_symptoms.map(s => (
                                <span key={s} style={{
                                  padding: '2px 8px', borderRadius: 12, fontSize: 10, fontFamily: 'var(--font-body)',
                                  background: 'rgba(0,229,255,0.08)', color: 'var(--cyan)', border: '1px solid rgba(0,229,255,0.15)'
                                }}>{s}</span>
                              ))}
                            </div>
                          )}

                          {/* Red flags */}
                          {c.red_flags?.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {c.red_flags.map(f => (
                                <span key={f} style={{
                                  padding: '2px 8px', borderRadius: 12, fontSize: 10, fontFamily: 'var(--font-body)',
                                  background: 'rgba(239,68,68,0.08)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.15)'
                                }}>⚠ {f}</span>
                              ))}
                            </div>
                          )}

                          {/* Real citations grounding this differential */}
                          {c.citations && c.citations.length > 0 && (
                            <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
                              <CitationList citations={c.citations} compact />
                            </div>
                          )}
                        </motion.div>
                      );
                    }) : (
                      <div style={{ background: 'var(--elevated)', borderRadius: 10, padding: 16 }}>
                        <span className="font-body" style={{ color: 'var(--muted)', fontSize: 13 }}>
                          {(result.conditions_detected ?? []).map((c: string) => c).join(', ') || 'No conditions detected'}
                        </span>
                      </div>
                    )}

                    {/* Differential reasoning collapsible */}
                    {result.differential_summary && (
                      <div>
                        <button data-cursor="hover" onClick={() => setShowDifferential(!showDifferential)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none',
                            color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer', padding: '4px 0'
                          }}>
                          {showDifferential ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          Differential Reasoning
                        </button>
                        <AnimatePresence>
                          {showDifferential && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              style={{ overflow: 'hidden' }}
                            >
                              <p className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7, background: 'var(--elevated)', padding: 12, borderRadius: 8, margin: '8px 0 0' }}>
                                {result.differential_summary}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* ER Warning */}
                    {result.when_to_go_to_er && (
                      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        style={{
                          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 14,
                          display: 'flex', alignItems: 'flex-start', gap: 10
                        }}
                      >
                        <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <span className="font-heading" style={{ fontSize: 12, color: '#fca5a5', display: 'block', marginBottom: 4 }}>When to Go to ER</span>
                          <p className="font-body" style={{ fontSize: 12, color: '#fca5a5', lineHeight: 1.5, margin: 0, opacity: 0.9 }}>{result.when_to_go_to_er}</p>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Right Column: Actions, Tests, Meds, Lifestyle */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Immediate Actions */}
                    {result.immediate_actions?.length > 0 && (
                      <div style={{ background: 'var(--elevated)', borderRadius: 10, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <Shield size={14} style={{ color: 'var(--cyan)' }} />
                          <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>IMMEDIATE ACTIONS</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {result.immediate_actions.map((a: string, i: number) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <span className="font-number" style={{ fontSize: 11, color: 'var(--cyan)', width: 18, flexShrink: 0 }}>{i + 1}.</span>
                              <span className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{a}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommended Tests */}
                    {result.recommended_tests?.length > 0 && (
                      <div style={{ background: 'var(--elevated)', borderRadius: 10, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <FlaskConical size={14} style={{ color: 'var(--green)' }} />
                          <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>RECOMMENDED TESTS</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {result.recommended_tests.map((t, i) => (
                            <div key={i} style={{ padding: '8px 10px', background: 'rgba(34,197,94,0.05)', borderRadius: 6, border: '1px solid rgba(34,197,94,0.1)' }}>
                              <span className="font-heading" style={{ fontSize: 12, color: 'var(--text)', display: 'block' }}>{t.test}</span>
                              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>{t.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Medications to Avoid */}
                    {result.medications_to_avoid?.length > 0 && (
                      <div style={{ background: 'var(--elevated)', borderRadius: 10, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <Pill size={14} style={{ color: 'var(--amber)' }} />
                          <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>MEDICATIONS TO AVOID</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {result.medications_to_avoid.map((m: string) => (
                            <span key={m} style={{
                              padding: '4px 10px', borderRadius: 16, fontSize: 11, fontFamily: 'var(--font-body)',
                              background: 'rgba(249,115,22,0.08)', color: 'var(--amber)', border: '1px solid rgba(249,115,22,0.15)'
                            }}>✕ {m}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lifestyle Advice (checklist) */}
                    {result.lifestyle_advice?.length > 0 && (
                      <div style={{ background: 'var(--elevated)', borderRadius: 10, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <Heart size={14} style={{ color: 'var(--green)' }} />
                          <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>LIFESTYLE ADVICE</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {result.lifestyle_advice.map((advice: string, i: number) => {
                            const key = `${result.session_id}-${i}`;
                            const checked = lifestyleChecked[key] || false;
                            return (
                              <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                                <input type="checkbox" checked={checked}
                                  onChange={() => setLifestyleChecked(prev => ({ ...prev, [key]: !prev[key] }))}
                                  style={{ marginTop: 3, accentColor: 'var(--cyan)' }}
                                />
                                <span className="font-body" style={{
                                  fontSize: 12, color: checked ? 'var(--muted)' : 'var(--text)', lineHeight: 1.5,
                                  textDecoration: checked ? 'line-through' : 'none'
                                }}>{advice}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Follow-up */}
                    {result.follow_up && (
                      <div style={{ background: 'rgba(0,229,255,0.05)', borderRadius: 10, padding: 14, border: '1px solid rgba(0,229,255,0.1)' }}>
                        <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>FOLLOW-UP</span>
                        <p className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, margin: 0 }}>{result.follow_up}</p>
                      </div>
                    )}

                    {/* Fallback: plain recommendations */}
                    {(!result.immediate_actions || result.immediate_actions.length === 0) && result.recommendations?.length > 0 && (
                      <div style={{ background: 'var(--elevated)', borderRadius: 10, padding: 14 }}>
                        <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 10 }}>RECOMMENDATIONS</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {result.recommendations.map((r: string, i: number) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <div style={{ width: 4, height: 4, background: 'var(--cyan)', marginTop: 7, flexShrink: 0, borderRadius: 2 }} />
                              <span className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{r}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transcript collapsible */}
                {result.transcript && (
                  <div>
                    <button data-cursor="hover" onClick={() => setShowTranscript(!showTranscript)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none',
                        color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer', padding: '4px 0'
                      }}>
                      {showTranscript ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      Analyzed Transcript
                    </button>
                    <AnimatePresence>
                      {showTranscript && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <p className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.8, background: 'var(--elevated)', padding: 16, borderRadius: 8, margin: '8px 0 0' }}>
                            {highlightMedical(result.transcript)}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Bottom Action Buttons */}
                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', gap: 10 }}>
                  <button data-cursor="hover" onClick={() => handleExportPdf(result.session_id)}
                    style={{
                      flex: 1, height: 38, borderRadius: 8, background: 'transparent',
                      border: '1px solid rgba(0,229,255,0.25)', color: 'var(--cyan)',
                      fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 200ms'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Download size={14} /> Export PDF
                  </button>
                  <button data-cursor="hover" onClick={reset}
                    style={{
                      flex: 1, height: 38, borderRadius: 8, background: 'transparent',
                      border: '1px solid rgba(0,229,255,0.25)', color: 'var(--cyan)',
                      fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 200ms'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <RotateCcw size={14} /> New Diagnosis
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default VoicePage;
