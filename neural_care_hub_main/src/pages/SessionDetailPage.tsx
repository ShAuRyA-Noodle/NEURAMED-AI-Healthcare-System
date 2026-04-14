import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Activity, FileText, Mic, ScanLine, AlertTriangle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { UrgencyBadge } from '@/components/shared/UrgencyBadge';
import { AgentBadge } from '@/components/shared/AgentBadge';
import { ConfidenceMeter } from '@/components/shared/ConfidenceMeter';
import { useToast } from '@/hooks/useToast';

const URGENCY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  critical: { bg: 'rgba(239,68,68,0.1)', border: '#ef4444', text: '#fca5a5' },
  high: { bg: 'rgba(249,115,22,0.1)', border: '#f97316', text: '#fdba74' },
  medium: { bg: 'rgba(234,179,8,0.1)', border: '#eab308', text: '#fde047' },
  low: { bg: 'rgba(34,197,94,0.1)', border: '#22c55e', text: '#86efac' },
};

const SessionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    document.title = 'NEURAMED — Session Details';
    const fetchSession = async () => {
      try {
        const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const token = localStorage.getItem('neuramed_token');
        const res = await fetch(`${base}/api/sessions/${id}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Not found');
        setSession(await res.json());
      } catch {
        addToast('error', 'Failed to load session');
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [id, addToast]);

  const handleExportPdf = async () => {
    addToast('success', 'Generating PDF...');
    try {
      const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const token = localStorage.getItem('neuramed_token');
      const response = await fetch(`${base}/api/sessions/${id}/export-pdf`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `neuramed-report-${id}.pdf`; a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'PDF downloaded');
    } catch {
      addToast('error', 'Failed to generate PDF');
    }
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>Loading session...</div>;
  if (!session) return <div style={{ padding: 40, color: 'var(--red)', fontFamily: 'var(--font-body)' }}>Session not found.</div>;

  const resultJson = session.result_json || {};
  const urgency = session.urgency_level || 'low';
  const urgCol = URGENCY_COLORS[urgency] || URGENCY_COLORS.low;
  const agentType = session.agent_type;
  const conditions = resultJson.conditions || session.conditions_detected || [];
  const recommendations = resultJson.recommendations || session.recommendations || [];
  const abnormalValues = resultJson.abnormal_values || [];
  const medications = resultJson.medications || [];

  const tabs = agentType === 'voice'
    ? ['overview', 'conditions', 'actions', 'transcript']
    : agentType === 'imaging'
      ? ['overview', 'findings', 'regions', 'data']
      : ['overview', 'findings', 'labs', 'medications'];

  const tabLabels: Record<string, string> = {
    overview: 'Overview', conditions: 'Conditions', actions: 'Actions & Tests',
    transcript: 'Transcript', findings: 'Findings', regions: 'Regions',
    data: 'Raw Data', labs: 'Lab Values', medications: 'Medications'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button data-cursor="hover" onClick={() => navigate(-1)} style={{
            width: 40, height: 40, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}><ArrowLeft size={20} /></button>
          <div>
            <span className="font-heading" style={{ fontSize: 22, color: 'var(--text)', display: 'block' }}>Session #{id}</span>
            <span className="font-body" style={{ fontSize: 13, color: 'var(--muted)' }}>
              {session.created_at ? format(new Date(session.created_at), 'MMM d, yyyy HH:mm') : '—'} · {session.patient_code}
            </span>
          </div>
        </div>
        <button data-cursor="hover" onClick={handleExportPdf} style={{
          height: 40, padding: '0 16px', borderRadius: 8, background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.25)',
          color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 700, cursor: 'pointer'
        }}><Download size={16} /> Export PDF</button>
      </div>

      {/* Urgency Banner */}
      <div style={{ padding: '14px 24px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: urgCol.bg, border: `1px solid ${urgCol.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={18} style={{ color: urgCol.text }} />
          <span className="font-heading" style={{ fontSize: 14, color: urgCol.text, textTransform: 'uppercase' }}>{urgency} Urgency</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <AgentBadge agent={agentType} />
          {session.processing_time_ms && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={14} style={{ color: 'var(--muted)' }} />
              <span className="font-number" style={{ fontSize: 12, color: 'var(--muted)' }}>{session.processing_time_ms}ms</span>
            </div>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, textAlign: 'center' }}>
          <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 12 }}>CONFIDENCE</span>
          <ConfidenceMeter value={session.confidence_score || 0} size={80} />
        </div>
        <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>PATIENT</span>
          <span className="font-number" style={{ fontSize: 20, color: 'var(--cyan)', display: 'block' }}>{session.patient_code}</span>
        </div>
        <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>CONDITIONS</span>
          <span className="font-number" style={{ fontSize: 20, color: 'var(--text)', display: 'block' }}>{(session.conditions_detected || []).length}</span>
        </div>
        <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>AGENT</span>
          <span className="font-body" style={{ fontSize: 20, color: 'var(--cyan)', textTransform: 'capitalize' }}>{agentType}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {tabs.map(t => (
          <button key={t} data-cursor="hover" onClick={() => setActiveTab(t)} style={{
            flex: 1, padding: '12px 0', background: 'transparent', border: 'none',
            fontFamily: 'var(--font-body)', fontSize: 13, color: activeTab === t ? 'var(--text)' : 'var(--muted)',
            position: 'relative', cursor: 'pointer'
          }}>
            {tabLabels[t] || t}
            {activeTab === t && <motion.div layoutId="sd-tab" style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, background: 'var(--cyan)' }} />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ display: 'grid', gridTemplateColumns: session.related_sessions?.length ? '2fr 1fr' : '1fr', gap: 24 }}>
        <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={18} style={{ color: 'var(--cyan)' }} />
                <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)' }}>Conditions & Findings</span>
              </div>
              {(session.conditions_detected || []).map((c: string, i: number) => (
                <div key={i} style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 20px' }}>
                  <span className="font-body" style={{ fontSize: 14, color: 'var(--text)' }}>{c}</span>
                </div>
              ))}
              {session.transcript_or_findings && (
                <div style={{ background: 'var(--elevated)', borderRadius: 8, padding: 16, borderLeft: '2px solid var(--cyan)' }}>
                  <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>
                    {agentType === 'voice' ? 'TRANSCRIPT' : agentType === 'imaging' ? 'FINDINGS' : 'SUMMARY'}
                  </span>
                  <p className="font-body" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>{session.transcript_or_findings}</p>
                </div>
              )}
              {recommendations.length > 0 && (
                <div>
                  <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>RECOMMENDATIONS</span>
                  {recommendations.map((r: any, i: number) => (
                    <div key={i} style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', marginBottom: 8 }}>
                      <span className="font-body" style={{ fontSize: 13, color: 'var(--text)' }}>{typeof r === 'string' ? r : r.action || JSON.stringify(r)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'conditions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {conditions.map((c: any, i: number) => {
                const isObj = typeof c === 'object';
                return (
                  <div key={i} style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span className="font-heading" style={{ fontSize: 14, color: 'var(--text)' }}>{isObj ? c.name : c}</span>
                      {isObj && c.probability && <span className="font-number" style={{ fontSize: 16, color: 'var(--cyan)' }}>{Math.round(c.probability * 100)}%</span>}
                    </div>
                    {isObj && c.icd_code && <span className="font-number" style={{ fontSize: 11, color: 'var(--cyan)', opacity: 0.7 }}>ICD-10: {c.icd_code}</span>}
                    {isObj && c.description && <p className="font-body" style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 0', lineHeight: 1.5 }}>{c.description}</p>}
                    {isObj && c.matching_symptoms?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                        {c.matching_symptoms.map((s: string) => (
                          <span key={s} style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontFamily: 'var(--font-body)', background: 'rgba(0,229,255,0.08)', color: 'var(--cyan)' }}>{s}</span>
                        ))}
                      </div>
                    )}
                    {isObj && c.red_flags?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {c.red_flags.map((f: string) => (
                          <span key={f} style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontFamily: 'var(--font-body)', background: 'rgba(239,68,68,0.08)', color: '#fca5a5' }}>⚠ {f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {conditions.length === 0 && <span className="font-body" style={{ color: 'var(--muted)' }}>No conditions data</span>}
            </div>
          )}

          {activeTab === 'actions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {resultJson.immediate_actions?.length > 0 && (
                <div>
                  <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>IMMEDIATE ACTIONS</span>
                  {resultJson.immediate_actions.map((a: string, i: number) => (
                    <div key={i} style={{ background: 'var(--elevated)', borderRadius: 8, padding: '10px 14px', marginBottom: 6, display: 'flex', gap: 8 }}>
                      <span className="font-number" style={{ color: 'var(--cyan)', width: 20, flexShrink: 0 }}>{i + 1}.</span>
                      <span className="font-body" style={{ fontSize: 13, color: 'var(--text)' }}>{a}</span>
                    </div>
                  ))}
                </div>
              )}
              {resultJson.recommended_tests?.length > 0 && (
                <div>
                  <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>RECOMMENDED TESTS</span>
                  {resultJson.recommended_tests.map((t: any, i: number) => (
                    <div key={i} style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.1)', borderRadius: 8, padding: '10px 14px', marginBottom: 6 }}>
                      <span className="font-heading" style={{ fontSize: 13, color: 'var(--text)' }}>{t.test || t}</span>
                      {t.reason && <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 2 }}>{t.reason}</span>}
                    </div>
                  ))}
                </div>
              )}
              {resultJson.when_to_go_to_er && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 14, display: 'flex', gap: 10 }}>
                  <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <span className="font-heading" style={{ fontSize: 12, color: '#fca5a5', display: 'block', marginBottom: 4 }}>When to Go to ER</span>
                    <p className="font-body" style={{ fontSize: 12, color: '#fca5a5', margin: 0, lineHeight: 1.5 }}>{resultJson.when_to_go_to_er}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'transcript' && (
            <div style={{ background: 'var(--elevated)', borderRadius: 8, padding: 20, border: '1px solid var(--border)' }}>
              <pre className="font-body" style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0 }}>
                {session.transcript_or_findings || resultJson.transcript || 'No transcript available.'}
              </pre>
            </div>
          )}

          {activeTab === 'findings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {resultJson.primary_finding && (
                <div style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.15)', borderRadius: 8, padding: 14 }}>
                  <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>PRIMARY FINDING</span>
                  <p className="font-heading" style={{ fontSize: 14, color: 'var(--cyan)', margin: '6px 0 0' }}>{resultJson.primary_finding}</p>
                </div>
              )}
              <div style={{ background: 'var(--elevated)', borderRadius: 8, padding: 16, borderLeft: '2px solid var(--cyan)' }}>
                <p className="font-body" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>
                  {session.transcript_or_findings || resultJson.findings || resultJson.summary || 'No findings.'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'regions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {resultJson.anomaly_regions?.map((r: any, i: number) => (
                <div key={i} style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between' }}>
                  <span className="font-body" style={{ fontSize: 13, color: 'var(--text)' }}>{r.location || `Region ${r.id}`}</span>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span className="font-number" style={{ fontSize: 12, color: 'var(--muted)' }}>{r.area}px²</span>
                    <span className="font-number" style={{ fontSize: 12, color: 'var(--cyan)' }}>{Math.round((r.confidence || 0) * 100)}%</span>
                  </div>
                </div>
              )) || <span className="font-body" style={{ color: 'var(--muted)' }}>No region data</span>}
            </div>
          )}

          {activeTab === 'data' && (
            <div style={{ background: 'var(--elevated)', borderRadius: 8, padding: 16, border: '1px solid var(--border)' }}>
              <pre className="font-body" style={{ fontSize: 11, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 }}>
                {JSON.stringify(resultJson, null, 2)}
              </pre>
            </div>
          )}

          {activeTab === 'labs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {abnormalValues.length > 0 ? abnormalValues.map((v: any, i: number) => (
                <div key={i} style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="font-body" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{v.test}</span>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span className="font-number" style={{ fontSize: 12, color: 'var(--amber)' }}>{v.value}</span>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>({v.normal_range})</span>
                  </div>
                </div>
              )) : <span className="font-body" style={{ color: 'var(--muted)' }}>No lab values</span>}
            </div>
          )}

          {activeTab === 'medications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {medications.length > 0 ? medications.map((m: any, i: number) => {
                const med = typeof m === 'string' ? { name: m } : m;
                return (
                  <div key={i} style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
                    <span className="font-heading" style={{ fontSize: 14, color: 'var(--text)' }}>{med.name}</span>
                    {med.dose && <span className="font-body" style={{ fontSize: 12, color: 'var(--cyan)', display: 'block', marginTop: 2 }}>{med.dose} — {med.frequency}</span>}
                    {med.purpose && <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginTop: 2 }}>{med.purpose}</span>}
                  </div>
                );
              }) : <span className="font-body" style={{ color: 'var(--muted)' }}>No medications data</span>}
            </div>
          )}
        </div>

        {/* Related Sessions */}
        {session.related_sessions?.length > 0 && (
          <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, height: 'fit-content' }}>
            <span className="font-heading" style={{ fontSize: 14, color: 'var(--text)', display: 'block', marginBottom: 16 }}>Related Sessions</span>
            {session.related_sessions.map((rs: any) => (
              <div key={rs.id} data-cursor="hover" onClick={() => navigate(`/sessions/${rs.id}`)} style={{
                background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, cursor: 'pointer', marginBottom: 8
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="font-number" style={{ fontSize: 12, color: 'var(--dim)' }}>#{rs.id}</span>
                  <AgentBadge agent={rs.agent_type} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(rs.conditions_detected || []).slice(0, 2).map((c: string) => (
                    <span key={c} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-body)' }}>{c}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <UrgencyBadge urgency={rs.urgency_level} />
                  <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)' }}>{rs.created_at ? format(new Date(rs.created_at), 'MMM d') : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionDetail;
