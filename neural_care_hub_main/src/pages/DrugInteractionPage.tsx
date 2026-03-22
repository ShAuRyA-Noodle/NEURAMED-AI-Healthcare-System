import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pill, X, AlertTriangle, CheckCircle, Loader2, Search, ChevronRight } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { checkDrugInteractions } from '@/api/drugs';
import { useToast } from '@/hooks/useToast';
import type { DrugInteractionResult, DrugInteraction } from '@/types';

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
  none: { bg: 'rgba(0,255,157,0.06)', border: 'rgba(0,255,157,0.2)', text: '#86efac', icon: '✓' },
};

const RISK_BANNER: Record<string, { bg: string; border: string; text: string; label: string }> = {
  safe: { bg: 'rgba(0,255,157,0.08)', border: 'rgba(0,255,157,0.3)', text: '#86efac', label: 'No significant interactions detected' },
  caution: { bg: 'rgba(255,149,0,0.1)', border: 'rgba(255,149,0,0.3)', text: '#fdba74', label: 'Monitor carefully — interactions present' },
  avoid: { bg: 'rgba(255,59,92,0.1)', border: 'rgba(255,59,92,0.3)', text: '#fca5a5', label: 'High-risk combination — physician review required' },
  contraindicated: { bg: 'rgba(255,59,92,0.15)', border: 'rgba(255,59,92,0.4)', text: '#fca5a5', label: 'CONTRAINDICATED — do not combine' },
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

  const risk = result ? RISK_BANNER[result.overall_risk] || RISK_BANNER.safe : null;

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
              padding: '16px 24px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12,
              background: risk.bg, border: `1px solid ${risk.border}`,
              animation: result.overall_risk === 'contraindicated' ? 'pulse-dot 2s ease-in-out infinite' : 'none'
            }}>
              {result.overall_risk === 'safe' ? <CheckCircle size={20} style={{ color: risk.text }} /> : <AlertTriangle size={20} style={{ color: risk.text }} />}
              <span className="font-heading" style={{ fontSize: 15, color: risk.text }}>{risk.label}</span>
            </div>
          )}

          {/* Interaction Matrix */}
          {drugs.length <= 8 && (
            <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 16 }}>INTERACTION MATRIX</span>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: 8, border: '1px solid var(--border)' }}></th>
                      {drugs.map(d => (
                        <th key={d} className="font-body" style={{ padding: '6px 8px', fontSize: 10, color: 'var(--muted)', border: '1px solid var(--border)', textAlign: 'center', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {drugs.map((rowDrug, ri) => (
                      <tr key={rowDrug}>
                        <td className="font-body" style={{ padding: '6px 8px', fontSize: 10, color: 'var(--muted)', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{rowDrug}</td>
                        {drugs.map((colDrug, ci) => {
                          if (ri === ci) return <td key={colDrug} style={{ padding: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', textAlign: 'center', color: 'var(--dim)', fontSize: 12 }}>—</td>;
                          const interaction = result.interactions?.find(
                            i => (i.drug_a === rowDrug && i.drug_b === colDrug) || (i.drug_a === colDrug && i.drug_b === rowDrug)
                          );
                          const sev = interaction ? (SEVERITY_CONFIG[interaction.severity] || SEVERITY_CONFIG.none) : SEVERITY_CONFIG.none;
                          return (
                            <td key={colDrug} style={{
                              padding: 8, textAlign: 'center', border: '1px solid var(--border)',
                              background: sev.bg, cursor: interaction ? 'pointer' : 'default'
                            }}
                              onClick={() => {
                                if (interaction) {
                                  const idx = result.interactions.indexOf(interaction);
                                  setExpandedInteraction(expandedInteraction === idx ? null : idx);
                                }
                              }}
                            >
                              <span style={{ fontSize: 14, color: sev.text, fontWeight: 700 }}>{sev.icon}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Interactions List */}
          {result.interactions?.length > 0 && (
            <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 16 }}>
                INTERACTIONS ({result.interactions.length})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.interactions.sort((a, b) => {
                  const order = ['contraindicated', 'major', 'moderate', 'minor'];
                  return order.indexOf(a.severity) - order.indexOf(b.severity);
                }).map((interaction: DrugInteraction, idx: number) => {
                  const sev = SEVERITY_CONFIG[interaction.severity] || SEVERITY_CONFIG.minor;
                  const isExpanded = expandedInteraction === idx;
                  return (
                    <div key={idx} style={{
                      background: 'var(--elevated)', border: `1px solid ${sev.border}`, borderRadius: 10,
                      overflow: 'hidden', cursor: 'pointer'
                    }} onClick={() => setExpandedInteraction(isExpanded ? null : idx)}>
                      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{
                          fontSize: 9, padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase',
                          background: sev.bg, color: sev.text, border: `1px solid ${sev.border}`,
                          fontFamily: 'var(--font-body)', fontWeight: 600
                        }}>{interaction.severity}</span>
                        <span className="font-heading" style={{ fontSize: 13, color: 'var(--text)' }}>
                          {interaction.drug_a} <span style={{ color: 'var(--dim)', fontSize: 11 }}>×</span> {interaction.drug_b}
                        </span>
                        <div style={{ marginLeft: 'auto' }}>
                          <ChevronRight size={14} style={{ color: 'var(--muted)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 200ms' }} />
                        </div>
                      </div>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            style={{ overflow: 'hidden' }}>
                            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div>
                                <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em' }}>MECHANISM</span>
                                <p className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, margin: '4px 0 0' }}>{interaction.mechanism}</p>
                              </div>
                              <div>
                                <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em' }}>CLINICAL EFFECT</span>
                                <p className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, margin: '4px 0 0' }}>{interaction.clinical_effect}</p>
                              </div>
                              <div>
                                <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em' }}>MANAGEMENT</span>
                                <p className="font-body" style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, margin: '4px 0 0' }}>{interaction.management}</p>
                              </div>
                              {interaction.alternatives && interaction.alternatives.length > 0 && (
                                <div>
                                  <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em' }}>ALTERNATIVES</span>
                                  {interaction.alternatives.map((alt, ai) => (
                                    <div key={ai} style={{ marginTop: 6, padding: '8px 12px', background: 'rgba(0,255,157,0.05)', border: '1px solid rgba(0,255,157,0.15)', borderRadius: 6 }}>
                                      <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>
                                        Replace <b style={{ color: 'var(--amber)' }}>{alt.replace}</b> with <b style={{ color: 'var(--green)' }}>{alt.with}</b>
                                      </span>
                                      {alt.note && <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 2 }}>{alt.note}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {interaction.onset && (
                                <div style={{ display: 'flex', gap: 16 }}>
                                  <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>Onset: <span style={{ color: 'var(--text)' }}>{interaction.onset}</span></span>
                                  {interaction.documentation && <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>Documentation: <span style={{ color: 'var(--text)' }}>{interaction.documentation}</span></span>}
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

          {/* Safe Pairs */}
          {result.safe_pairs?.length > 0 && (
            <details style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
              <summary className="font-body" style={{ fontSize: 12, color: 'var(--green)', cursor: 'pointer' }}>
                Safe Pairs ({result.safe_pairs.length})
              </summary>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.safe_pairs.map((pair, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle size={12} style={{ color: 'var(--green)' }} />
                    <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>
                      {pair.drug_a} and {pair.drug_b}
                    </span>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>— {pair.note}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Overall Recommendations */}
          {result.overall_recommendations?.length > 0 && (
            <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 12 }}>RECOMMENDATIONS</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.overall_recommendations.map((rec, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span className="font-number" style={{ fontSize: 12, color: 'var(--cyan)', width: 20, flexShrink: 0 }}>{i + 1}.</span>
                    <span className="font-body" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default DrugInteractionPage;
