import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pill, X, AlertTriangle, CheckCircle, Loader2, Search, ChevronRight, ExternalLink } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { checkDrugInteractions } from '@/api/drugs';
import { useToast } from '@/hooks/useToast';
import { ProvenanceChip } from '@/components/shared/ProvenanceChip';
import type { DrugInteractionResult, DrugPair } from '@/types';

const COMMON_DRUGS = [
  'Warfarin', 'Aspirin', 'Metformin', 'Lisinopril', 'Atorvastatin', 'Metoprolol',
  'Amlodipine', 'Omeprazole', 'Levothyroxine', 'Clopidogrel', 'Furosemide',
  'Prednisone', 'Ibuprofen', 'Acetaminophen', 'Amoxicillin', 'Azithromycin',
  'Ciprofloxacin', 'Gabapentin', 'Losartan', 'Hydrochlorothiazide', 'Simvastatin',
  'Pantoprazole', 'Sertraline', 'Fluoxetine', 'Alprazolam', 'Diazepam',
  'Tramadol', 'Codeine', 'Morphine', 'Insulin', 'Glipizide', 'Pioglitazone',
  'Rosuvastatin', 'Diltiazem', 'Verapamil', 'Digoxin', 'Spironolactone',
  'Carvedilol', 'Enalapril', 'Ramipril', 'Candesartan', 'Doxycycline',
  'Metronidazole', 'Fluconazole', 'Ketoconazole', 'Rifampin', 'Phenytoin',
  'Carbamazepine', 'Valproic Acid', 'Lithium', 'Clonazepam',
];

const SEVERITY_CONFIG: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  contraindicated: { bg: 'rgba(255,59,92,0.12)', border: 'rgba(255,59,92,0.4)', text: '#fca5a5', icon: '×' },
  major: { bg: 'rgba(255,59,92,0.08)', border: 'rgba(255,59,92,0.3)', text: '#fca5a5', icon: '!!' },
  moderate: { bg: 'rgba(255,149,0,0.08)', border: 'rgba(255,149,0,0.3)', text: '#fdba74', icon: '!' },
  minor: { bg: 'rgba(253,224,71,0.06)', border: 'rgba(253,224,71,0.2)', text: '#fde047', icon: '~' },
  unspecified: { bg: 'rgba(0,229,255,0.06)', border: 'rgba(0,229,255,0.2)', text: 'var(--cyan)', icon: '?' },
  none: { bg: 'rgba(0,255,157,0.06)', border: 'rgba(0,255,157,0.2)', text: '#86efac', icon: '✓' },
};

const SEVERITY_RANK = ['contraindicated', 'major', 'moderate', 'minor', 'unspecified'];

const RISK_BANNER: Record<string, { bg: string; border: string; text: string; label: string }> = {
  contraindicated: { bg: 'rgba(255,59,92,0.15)', border: 'rgba(255,59,92,0.4)', text: '#fca5a5', label: 'CONTRAINDICATED — do not combine' },
  major: { bg: 'rgba(255,59,92,0.1)', border: 'rgba(255,59,92,0.3)', text: '#fca5a5', label: 'Major interaction — physician review required' },
  moderate: { bg: 'rgba(255,149,0,0.1)', border: 'rgba(255,149,0,0.3)', text: '#fdba74', label: 'Moderate interaction — monitor carefully' },
  minor: { bg: 'rgba(253,224,71,0.08)', border: 'rgba(253,224,71,0.25)', text: '#fde047', label: 'Minor interaction present' },
  unspecified: { bg: 'rgba(0,229,255,0.08)', border: 'rgba(0,229,255,0.3)', text: 'var(--cyan)', label: 'Interaction found — severity unspecified in labels' },
  no_known_interaction_in_sources: { bg: 'rgba(0,255,157,0.08)', border: 'rgba(0,255,157,0.3)', text: '#86efac', label: 'No interaction found in the FDA labels we checked' },
};

const labelHost = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'FDA label'; }
};

const DrugInteractionPage = () => {
  const [drugs, setDrugs] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [result, setResult] = useState<DrugInteractionResult | null>(null);
  const [expandedInteraction, setExpandedInteraction] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  const { mutateAsync: analyze, isPending } = useMutation({
    mutationFn: checkDrugInteractions,
    onError: (err: any) => addToast('error', `Analysis failed: ${err.message}`),
  });

  const handleInputChange = useCallback((val: string) => {
    setInput(val);
    if (val.length >= 2) {
      const filtered = COMMON_DRUGS.filter(d =>
        d.toLowerCase().includes(val.toLowerCase()) && !drugs.includes(d)
      ).slice(0, 6);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [drugs]);

  const addDrug = useCallback((drug: string) => {
    const name = drug.trim();
    if (!name || drugs.includes(name) || drugs.length >= 10) return;
    setDrugs(prev => [...prev, name]);
    setInput('');
    setSuggestions([]);
    inputRef.current?.focus();
  }, [drugs]);

  const removeDrug = useCallback((drug: string) => {
    setDrugs(prev => prev.filter(d => d !== drug));
    setResult(null);
  }, []);

  const handleAnalyze = async () => {
    if (drugs.length < 2) return;
    try {
      const res = await analyze(drugs);
      setResult(res);
    } catch { /* handled by mutation */ }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      addDrug(suggestions[0] || input);
    }
  };

  const risk = result ? (RISK_BANNER[result.overall_risk] || RISK_BANNER.unspecified) : null;
  const orderedPairs: DrugPair[] = result
    ? [...result.pairs].sort((a, b) => {
        const ra = a.status === 'evidence' ? SEVERITY_RANK.indexOf(a.severity || 'unspecified') : 99;
        const rb = b.status === 'evidence' ? SEVERITY_RANK.indexOf(b.severity || 'unspecified') : 99;
        return ra - rb;
      })
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
          <Pill size={32} style={{ color: 'var(--green)' }} />
        </div>
        <div>
          <h1 className="font-heading" style={{ fontSize: 24, color: 'var(--text)', margin: 0 }}>Drug Interaction Checker</h1>
          <p className="font-body" style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Enter your medications to check for interactions</p>
        </div>
      </div>

      {/* Drug Input Section */}
      <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 12 }}>
          MEDICATIONS ({drugs.length}/10)
        </span>

        {/* Drug pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, minHeight: 36 }}>
          <AnimatePresence>
            {drugs.map(drug => (
              <motion.div key={drug} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  borderRadius: 20, background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.25)',
                  fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--cyan)'
                }}>
                <Pill size={12} />
                {drug}
                <button onClick={() => removeDrug(drug)} style={{
                  background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
                  padding: 0, display: 'flex', alignItems: 'center'
                }}>
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Input with autocomplete */}
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input ref={inputRef} value={input} onChange={e => handleInputChange(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={drugs.length >= 10 ? 'Maximum 10 drugs reached' : 'Type a drug name and press Enter...'}
              disabled={drugs.length >= 10}
              style={{
                width: '100%', height: 40, background: 'var(--elevated)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '0 12px 0 34px', fontFamily: 'var(--font-body)', fontSize: 13,
                color: 'var(--text)', outline: 'none'
              }}
            />
          </div>
          {suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 4,
              background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden'
            }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => addDrug(s)} style={{
                  width: '100%', padding: '8px 14px', background: 'transparent', border: 'none',
                  textAlign: 'left', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Pill size={12} style={{ color: 'var(--muted)' }} />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={handleAnalyze} disabled={drugs.length < 2 || isPending}
          style={{
            marginTop: 16, width: '100%', height: 44,
            background: drugs.length < 2 || isPending ? 'rgba(0,229,255,0.3)' : 'var(--cyan)',
            color: '#000', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14,
            borderRadius: 8, border: 'none', opacity: drugs.length < 2 || isPending ? 0.4 : 1,
            cursor: drugs.length < 2 || isPending ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 200ms'
          }}>
          {isPending ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing...</> : 'Analyze Interactions'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Risk Banner */}
          {risk && (
            <div style={{
              padding: '16px 24px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
              background: risk.bg, border: `1px solid ${risk.border}`,
              animation: result.overall_risk === 'contraindicated' ? 'pulse-dot 2s ease-in-out infinite' : 'none'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {result.overall_risk === 'no_known_interaction_in_sources'
                  ? <CheckCircle size={20} style={{ color: risk.text }} />
                  : <AlertTriangle size={20} style={{ color: risk.text }} />}
                <span className="font-heading" style={{ fontSize: 15, color: risk.text }}>{risk.label}</span>
              </div>
              {/* Provenance — real model + real sources that produced this */}
              {result.provenance && <ProvenanceChip provenance={result.provenance} />}
            </div>
          )}

          {/* Pairs — cite-or-abstain, one card per drug pair */}
          {orderedPairs.length > 0 && (
            <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 16 }}>
                PAIRWISE ANALYSIS ({orderedPairs.length})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {orderedPairs.map((p, idx) => {
                  const [a, b] = p.pair;
                  if (p.status !== 'evidence') {
                    // Honest "no evidence" — never fabricated as safe
                    return (
                      <div key={idx} style={{
                        background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 10,
                        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12
                      }}>
                        <span style={{
                          fontSize: 9, padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase',
                          background: 'rgba(255,255,255,0.04)', color: 'var(--muted)', border: '1px solid var(--border)',
                          fontFamily: 'var(--font-body)', fontWeight: 600, whiteSpace: 'nowrap'
                        }}>No evidence</span>
                        <span className="font-heading" style={{ fontSize: 13, color: 'var(--text)' }}>
                          {a} <span style={{ color: 'var(--dim)', fontSize: 11 }}>×</span> {b}
                        </span>
                        <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto', textAlign: 'right' }}>
                          {p.note || 'No interaction found in the FDA labels we checked.'}
                        </span>
                      </div>
                    );
                  }
                  const sev = SEVERITY_CONFIG[p.severity || 'unspecified'] || SEVERITY_CONFIG.unspecified;
                  const isExpanded = expandedInteraction === idx;
                  const citationUrls = p.citations && p.citations.length > 0
                    ? p.citations
                    : (p.evidence || []).map(e => e.citation_url).filter(Boolean);
                  return (
                    <div key={idx} style={{
                      background: 'var(--elevated)', border: `1px solid ${sev.border}`, borderRadius: 10, overflow: 'hidden'
                    }}>
                      <div data-cursor="hover" onClick={() => setExpandedInteraction(isExpanded ? null : idx)}
                        style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                        <span style={{
                          fontSize: 9, padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase',
                          background: sev.bg, color: sev.text, border: `1px solid ${sev.border}`,
                          fontFamily: 'var(--font-body)', fontWeight: 600
                        }}>{p.severity}</span>
                        <span className="font-heading" style={{ fontSize: 13, color: 'var(--text)' }}>
                          {a} <span style={{ color: 'var(--dim)', fontSize: 11 }}>×</span> {b}
                        </span>
                        <ChevronRight size={14} style={{ marginLeft: 'auto', color: 'var(--muted)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 200ms' }} />
                      </div>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            style={{ overflow: 'hidden' }}>
                            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {p.summary && (
                                <div>
                                  <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em' }}>WHAT THE LABEL SAYS</span>
                                  <p className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, margin: '4px 0 0' }}>{p.summary}</p>
                                </div>
                              )}
                              {p.clinical_management && (
                                <div>
                                  <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em' }}>CLINICAL MANAGEMENT</span>
                                  <p className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, margin: '4px 0 0' }}>{p.clinical_management}</p>
                                </div>
                              )}
                              {/* Attributed snippets straight from the FDA label */}
                              {p.evidence && p.evidence.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em' }}>FDA LABEL EXCERPTS</span>
                                  {p.evidence.map((e, ei) => (
                                    <div key={ei} style={{ padding: '8px 12px', background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.12)', borderRadius: 6 }}>
                                      <p className="font-body" style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>“{e.snippet}”</p>
                                      <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginTop: 4 }}>— {e.source_drug} label</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* Citation links */}
                              {citationUrls.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                  {citationUrls.map((url, ci) => (
                                    <a key={ci} href={url} target="_blank" rel="noreferrer" data-cursor="hover"
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 12,
                                        background: 'rgba(0,255,157,0.06)', color: 'var(--green)', border: '1px solid rgba(0,255,157,0.15)',
                                        fontFamily: 'var(--font-body)', fontSize: 10, textDecoration: 'none'
                                      }}>
                                      <ExternalLink size={10} /> FDA label · {labelHost(url)}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sources checked — every FDA label consulted */}
          {result.sources_checked?.length > 0 && (
            <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 12 }}>
                SOURCES CHECKED ({result.sources_checked.length})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.sources_checked.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" data-cursor="hover"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--cyan)', textDecoration: 'none', fontFamily: 'var(--font-body)', fontSize: 11 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                    <ExternalLink size={11} style={{ flexShrink: 0 }} /> {url}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Honest disclaimer */}
          {result.disclaimer && (
            <p className="font-body" style={{ fontSize: 10, color: 'var(--dim)', lineHeight: 1.5, margin: 0 }}>
              {result.disclaimer}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default DrugInteractionPage;
