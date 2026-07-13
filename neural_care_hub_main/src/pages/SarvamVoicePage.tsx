import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Mic, Send, Loader2, AlertTriangle, CheckCircle, WifiOff, Wifi, Volume2, VolumeX } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getSarvamHealth, sarvamDiagnose, sarvamTTS } from '@/api/sarvam';
import { useToast } from '@/hooks/useToast';
import type { SarvamDiagnoseResult, SarvamHealthStatus } from '@/types';

const LANGUAGES = [
  { code: 'hi', name: 'Hindi', native: '\u0939\u093f\u0928\u094d\u0926\u0940', flag: '\ud83c\uddee\ud83c\uddf3' },
  { code: 'ta', name: 'Tamil', native: '\u0ba4\u0bae\u0bbf\u0bb4\u0bcd', flag: '\ud83c\uddee\ud83c\uddf3' },
  { code: 'te', name: 'Telugu', native: '\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41', flag: '\ud83c\uddee\ud83c\uddf3' },
  { code: 'bn', name: 'Bengali', native: '\u09ac\u09be\u0982\u09b2\u09be', flag: '\ud83c\uddee\ud83c\uddf3' },
  { code: 'mr', name: 'Marathi', native: '\u092e\u0930\u093e\u0920\u0940', flag: '\ud83c\uddee\ud83c\uddf3' },
  { code: 'kn', name: 'Kannada', native: '\u0c95\u0ca8\u0ccd\u0ca8\u0ca1', flag: '\ud83c\uddee\ud83c\uddf3' },
  { code: 'ml', name: 'Malayalam', native: '\u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02', flag: '\ud83c\uddee\ud83c\uddf3' },
  { code: 'pa', name: 'Punjabi', native: '\u0a2a\u0a70\u0a1c\u0a3e\u0a2c\u0a40', flag: '\ud83c\uddee\ud83c\uddf3' },
  { code: 'en', name: 'English', native: 'English', flag: '\ud83c\uddec\ud83c\udde7' },
];

const URGENCY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  critical: { bg: 'rgba(255,59,92,0.12)', border: 'rgba(255,59,92,0.4)', text: '#fca5a5' },
  high: { bg: 'rgba(255,149,0,0.1)', border: 'rgba(255,149,0,0.3)', text: '#fdba74' },
  medium: { bg: 'rgba(0,229,255,0.08)', border: 'rgba(0,229,255,0.2)', text: '#00E5FF' },
  low: { bg: 'rgba(0,255,157,0.06)', border: 'rgba(0,255,157,0.2)', text: '#86efac' },
};

const SarvamVoicePage = () => {
  const [language, setLanguage] = useState('hi');
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<SarvamDiagnoseResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string; lang?: string }[]>([]);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [listenLang, setListenLang] = useState(language);
  const recognitionRef = useRef<any>(null);
  const { addToast } = useToast();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);

  const speakText = async (text: string, lang: string, index: number) => {
    // If already speaking this message, stop it
    if (speakingIndex === index) {
      audioRef.current?.pause();
      audioRef.current = null;
      setSpeakingIndex(null);
      return;
    }
    // Stop any current playback
    audioRef.current?.pause();
    audioRef.current = null;

    setTtsLoading(true);
    setSpeakingIndex(index);
    try {
      const blob = await sarvamTTS(text, lang);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setSpeakingIndex(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setSpeakingIndex(null);
        URL.revokeObjectURL(url);
        addToast('error', 'Audio playback failed');
      };
      await audio.play();
    } catch (err: any) {
      setSpeakingIndex(null);
      addToast('error', `TTS failed: ${err.message || 'Unknown error'}`);
    } finally {
      setTtsLoading(false);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  const { data: health } = useQuery<SarvamHealthStatus>({
    queryKey: ['sarvam-health'],
    queryFn: getSarvamHealth,
    refetchInterval: 30000,
  });

  const { mutateAsync: diagnose, isPending } = useMutation({
    mutationFn: ({ text, lang }: { text: string; lang: string }) => sarvamDiagnose(text, lang),
    onError: (err: any) => addToast('error', `Diagnosis failed: ${err.message}`),
  });

  const handleSubmit = async () => {
    if (!transcript.trim()) return;
    const text = transcript.trim();
    setConversationHistory(prev => [...prev, { role: 'user', content: text, lang: language }]);
    setTranscript('');
    try {
      const res = await diagnose({ text, lang: language });
      setResult(res);
      setConversationHistory(prev => [...prev, {
        role: 'assistant',
        content: res.response_native || res.response_english,
        lang: language
      }]);
    } catch { /* handled */ }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addToast('error', 'Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    const langMap: Record<string, string> = {
      hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', bn: 'bn-IN',
      mr: 'mr-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN', en: 'en-US'
    };
    recognition.lang = langMap[language] || 'hi-IN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t + ' ';
        } else {
          interimTranscript += t;
        }
      }
      setTranscript((finalTranscript + interimTranscript).trim());
    };

    recognition.onerror = (event: any) => {
      setIsRecording(false);
      const msg = event.error === 'not-allowed' ? 'Microphone access denied — allow mic in browser settings'
        : event.error === 'no-speech' ? 'No speech detected — try again'
        : `Speech error: ${event.error}`;
      addToast('error', msg);
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsRecording(true);
    } catch {
      addToast('error', 'Could not start mic — check browser permissions');
    }
  };

  const selectedLang = LANGUAGES.find(l => l.code === language)!;
  const urgencyStyle = result ? URGENCY_COLORS[result.urgency] || URGENCY_COLORS.medium : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Globe size={32} style={{ color: 'var(--cyan)' }} />
          <div>
            <h1 className="font-heading" style={{ fontSize: 24, color: 'var(--text)', margin: 0 }}>
              NEURAMED — Indian Language Assistant
            </h1>
            <p className="font-body" style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
              AI-powered medical assistant in Indian languages
            </p>
          </div>
        </div>
        {/* Availability — Groq is the primary engine; a local Ollama Sarvam
            model is an optional enhancement, NOT a requirement. */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20,
          background: health?.available ? 'rgba(0,255,157,0.08)' : 'rgba(255,59,92,0.08)',
          border: `1px solid ${health?.available ? 'rgba(0,255,157,0.25)' : 'rgba(255,59,92,0.25)'}`,
        }}>
          {health?.available
            ? <><Wifi size={12} style={{ color: 'var(--green)' }} /><span className="font-body" style={{ fontSize: 11, color: 'var(--green)' }}>Ready · {health.sarvam_available ? 'Sarvam (native)' : 'Groq'}</span></>
            : <><WifiOff size={12} style={{ color: 'var(--red)' }} /><span className="font-body" style={{ fontSize: 11, color: 'var(--red)' }}>Unavailable — set GROQ_API_KEY</span></>
          }
        </div>
      </div>

      <div className="form-grid-2" style={{ gap: 24 }}>
        {/* LEFT — Input */}
        <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Language Selector */}
          <div>
            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 10 }}>SELECT LANGUAGE</span>
            <div className="form-grid-3" style={{ gap: 8 }}>
              {LANGUAGES.map(lang => (
                <button key={lang.code} onClick={() => setLanguage(lang.code)} style={{
                  padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
                  background: language === lang.code ? 'rgba(0,229,255,0.1)' : 'var(--elevated)',
                  border: `1px solid ${language === lang.code ? 'var(--cyan)' : 'var(--border)'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 200ms'
                }}>
                  <span style={{ fontSize: 16 }}>{lang.flag}</span>
                  <span className="font-body" style={{ fontSize: 11, color: language === lang.code ? 'var(--cyan)' : 'var(--text)' }}>{lang.native}</span>
                  <span className="font-body" style={{ fontSize: 9, color: 'var(--dim)' }}>{lang.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Text Input */}
          <div>
            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>
              DESCRIBE YOUR SYMPTOMS IN {selectedLang.name.toUpperCase()}
            </span>
            <textarea value={transcript} onChange={e => setTranscript(e.target.value)}
              placeholder={`Type or speak in ${selectedLang.name}...`}
              style={{
                width: '100%', height: 120, background: 'var(--elevated)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '12px 14px', fontFamily: 'var(--font-body)', fontSize: 14,
                color: 'var(--text)', outline: 'none', resize: 'none', lineHeight: 1.8
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={toggleRecording} style={{
              flex: '0 0 48px', height: 48, borderRadius: 12,
              background: isRecording ? 'rgba(255,59,92,0.15)' : 'var(--elevated)',
              border: `1px solid ${isRecording ? 'rgba(255,59,92,0.4)' : 'var(--border)'}`,
              color: isRecording ? 'var(--red)' : 'var(--muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms',
              animation: isRecording ? 'pulse-dot 1.5s ease-in-out infinite' : 'none'
            }}>
              <Mic size={20} />
            </button>
            <button onClick={handleSubmit} disabled={!transcript.trim() || isPending} style={{
              flex: 1, height: 48, borderRadius: 12,
              background: !transcript.trim() || isPending ? 'rgba(0,229,255,0.3)' : 'var(--cyan)',
              color: '#000', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14,
              border: 'none', opacity: !transcript.trim() || isPending ? 0.4 : 1,
              cursor: !transcript.trim() || isPending ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 200ms'
            }}>
              {isPending ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Consulting...</> : <><Send size={16} /> Get Advice</>}
            </button>
          </div>
        </div>

        {/* RIGHT — Response */}
        <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column' }}>
          {!result && conversationHistory.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <Globe size={48} style={{ color: 'var(--dim)' }} strokeWidth={1} />
              <span className="font-heading" style={{ fontSize: 18, color: 'var(--muted)' }}>Start a conversation</span>
              <span className="font-body" style={{ fontSize: 13, color: 'var(--dim)', textAlign: 'center', maxWidth: 300 }}>
                Describe your symptoms in any Indian language. The AI will respond in your chosen language.
              </span>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
              {/* Conversation History */}
              {conversationHistory.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%', padding: '12px 16px', borderRadius: 12,
                    background: msg.role === 'user' ? 'rgba(0,229,255,0.1)' : 'var(--elevated)',
                    border: `1px solid ${msg.role === 'user' ? 'rgba(0,229,255,0.2)' : 'var(--border)'}`,
                  }}>
                  <p className="font-body" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8, margin: 0 }}>{msg.content}</p>
                  {msg.role === 'assistant' && (
                    <button onClick={() => speakText(msg.content, msg.lang || language, i)}
                      title={speakingIndex === i ? 'Stop listening' : `Listen in ${LANGUAGES.find(l => l.code === (msg.lang || language))?.name || 'selected language'}`}
                      style={{
                        marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                        background: speakingIndex === i ? 'rgba(0,229,255,0.15)' : 'rgba(0,229,255,0.06)',
                        border: `1px solid ${speakingIndex === i ? 'var(--cyan)' : 'rgba(0,229,255,0.15)'}`,
                        color: speakingIndex === i ? 'var(--cyan)' : 'var(--muted)',
                        transition: 'all 200ms', fontSize: 11, fontFamily: 'var(--font-body)',
                      }}>
                      {speakingIndex === i
                        ? (ttsLoading ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading...</> : <><VolumeX size={13} /> Stop</>)
                        : <><Volume2 size={13} /> Listen</>}
                    </button>
                  )}
                </motion.div>
              ))}

              {isPending && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <Loader2 size={14} style={{ color: 'var(--cyan)', animation: 'spin 1s linear infinite' }} />
                  <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)' }}>AI is thinking...</span>
                </div>
              )}

              {/* Latest Result Details */}
              {result && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>

                  {/* Urgency + Concern */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {urgencyStyle && (
                      <span style={{
                        padding: '4px 12px', borderRadius: 12, fontSize: 11, fontFamily: 'var(--font-body)',
                        background: urgencyStyle.bg, color: urgencyStyle.text, border: `1px solid ${urgencyStyle.border}`,
                        textTransform: 'capitalize'
                      }}>{result.urgency} urgency</span>
                    )}
                    {result.see_doctor_urgency && (
                      <span style={{
                        padding: '4px 12px', borderRadius: 12, fontSize: 11, fontFamily: 'var(--font-body)',
                        background: 'rgba(0,229,255,0.08)', color: 'var(--cyan)', border: '1px solid rgba(0,229,255,0.2)'
                      }}>See doctor: {result.see_doctor_urgency}</span>
                    )}
                  </div>

                  {/* Listen to analysis with language choice */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                    background: 'var(--elevated)', borderRadius: 10,
                    border: '1px solid var(--border)',
                  }}>
                    <Volume2 size={15} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Listen in</span>
                    <select
                      value={listenLang}
                      onChange={e => setListenLang(e.target.value)}
                      style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '4px 8px', color: 'var(--text)',
                        fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer',
                        outline: 'none',
                      }}>
                      {LANGUAGES.map(l => (
                        <option key={l.code} value={l.code}>{l.flag} {l.native} ({l.name})</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const text = result.response_english || result.response_native;
                        speakText(text, listenLang, -1);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                        borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
                        background: speakingIndex === -1 ? 'rgba(255,59,92,0.12)' : 'var(--cyan)',
                        border: speakingIndex === -1 ? '1px solid rgba(255,59,92,0.3)' : '1px solid transparent',
                        color: speakingIndex === -1 ? '#fca5a5' : '#000',
                        fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 700,
                        transition: 'all 200ms',
                      }}>
                      {speakingIndex === -1
                        ? (ttsLoading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading...</> : <><VolumeX size={14} /> Stop</>)
                        : <><Volume2 size={14} /> Play</>}
                    </button>
                  </div>

                  {result.primary_concern && (
                    <div style={{ background: 'var(--elevated)', borderRadius: 8, padding: '12px 16px', borderLeft: '2px solid var(--cyan)' }}>
                      <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>PRIMARY CONCERN</span>
                      <span className="font-heading" style={{ fontSize: 14, color: 'var(--text)' }}>{result.primary_concern}</span>
                    </div>
                  )}

                  {/* Medical Terms */}
                  {result.medical_terms_explained && result.medical_terms_explained.length > 0 && (
                    <div>
                      <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>MEDICAL TERMS</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {result.medical_terms_explained.map((term, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 10px', background: 'var(--elevated)', borderRadius: 6, border: '1px solid var(--border)' }}>
                            <span className="font-heading" style={{ fontSize: 12, color: 'var(--cyan)' }}>{term.term}</span>
                            <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>{term.native_explanation}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* English Translation */}
                  {result.response_english && result.response_english !== result.response_native && (
                    <details style={{ marginTop: 4 }}>
                      <summary className="font-body" style={{ fontSize: 11, color: 'var(--muted)', cursor: 'pointer' }}>View English translation</summary>
                      <p className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7, marginTop: 8, padding: '12px 14px', background: 'var(--elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        {result.response_english}
                      </p>
                    </details>
                  )}
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SarvamVoicePage;
