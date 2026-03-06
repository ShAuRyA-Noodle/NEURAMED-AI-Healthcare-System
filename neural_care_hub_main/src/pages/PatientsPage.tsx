import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, Calendar, Activity, Search, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { usePatients } from '@/hooks/usePatients';
import { AgentBadge } from '@/components/shared/AgentBadge';
import { UrgencyBadge } from '@/components/shared/UrgencyBadge';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import type { AgentType } from '@/types';

const urgencyColor = (u: string) => {
  const l = u?.toUpperCase();
  return l === 'CRITICAL' ? 'var(--red)' : l === 'HIGH' ? 'var(--amber)' : l === 'MEDIUM' ? 'var(--cyan)' : 'var(--muted)';
};

// Deterministic geometric identicon
const Identicon = ({ id }: { id: string }) => {
  const sum = id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const hue = (sum * 137) % 360;
  const isCircle = sum % 2 === 0;
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%', background: `hsl(${hue}, 30%, 15%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid hsl(${hue}, 50%, 30%)`, flexShrink: 0
    }}>
      {isCircle ? (
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: `hsl(${hue}, 70%, 50%)` }} />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill={`hsl(${hue}, 70%, 50%)`}><polygon points="12 2 22 22 2 22" /></svg>
      )}
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, trend }: { label: string; value: number | string; icon: any; trend?: number }) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={20} style={{ color: 'var(--muted)' }} />
    </div>
    <div style={{ flex: 1 }}>
      <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="font-number" style={{ fontSize: 24, color: 'var(--text)' }}>{value}</span>
        {trend !== undefined && <span className="font-body" style={{ fontSize: 11, color: trend > 0 ? 'var(--green)' : 'var(--amber)' }}>{trend > 0 ? '+' : ''}{trend}%</span>}
      </div>
    </div>
  </div>
);

const PatientsPage = () => {
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState<AgentType | 'all'>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState('recent');
  const [expandedPatient, setExpandedPatient] = useState<number | null>(null);

  const { data: patients, isLoading } = usePatients();

  const filteredPatients = (patients || []).filter((p: any) => {
    const s = search.toLowerCase();
    const matchSearch = !s || p.patient_code.toLowerCase().includes(s) || (p.demographics?.gender || p.gender || '').toLowerCase().startsWith(s);
    const matchAgent = agentFilter === 'all' || p.last_session_agent === agentFilter;
    const matchGender = genderFilter === 'all' || (p.demographics?.gender || p.gender || '').toLowerCase() === genderFilter;
    const matchRisk = riskFilter === 'all' ||
      (riskFilter === 'high' && (p.risk_score ?? 0) >= 7) ||
      (riskFilter === 'medium' && (p.risk_score ?? 0) >= 4 && (p.risk_score ?? 0) < 7) ||
      (riskFilter === 'low' && (p.risk_score ?? 0) < 4);
    return matchSearch && matchAgent && matchGender && matchRisk;
  }).sort((a: any, b: any) => {
    if (sortBy === 'risk') return (b.risk_score ?? 0) - (a.risk_score ?? 0);
    if (sortBy === 'sessions') return (b.total_sessions ?? b.session_count ?? 0) - (a.total_sessions ?? a.session_count ?? 0);
    return 0; // default order from API
  });

  const highRiskCount = (patients || []).filter((p: any) => (p.risk_score ?? 0) >= 7).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>👥</div>
        <div>
          <h1 className="font-heading" style={{ fontSize: 24, color: 'var(--text)', margin: 0 }}>Patient Registry</h1>
          <p className="font-body" style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Manage and monitor patient records</p>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard label="TOTAL PATIENTS" value={patients?.length || 0} icon={Users} />
        <StatCard label="HIGH RISK" value={highRiskCount} icon={AlertTriangle} />
        <StatCard label="NEW THIS WEEK" value={patients?.filter((p: any) => {
          const d = new Date(p.created_at);
          const now = new Date();
          return (now.getTime() - d.getTime()) < 7 * 86400000;
        }).length || 0} icon={UserPlus} />
        <StatCard label="AVG SESSIONS" value={patients?.length ? Math.round((patients as any[]).reduce((s: number, p: any) => s + (p.total_sessions ?? p.session_count ?? 0), 0) / patients.length) : 0} icon={Activity} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient code..."
            data-cursor="hover"
            style={{
              width: 260, height: 36, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 20,
              padding: '0 16px 0 40px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {/* Gender pills */}
          {['all', 'male', 'female'].map(g => (
            <button key={g} data-cursor="hover" onClick={() => setGenderFilter(g)} style={{
              height: 30, padding: '0 12px', borderRadius: 16, fontFamily: 'var(--font-body)', fontSize: 11, textTransform: 'capitalize', cursor: 'pointer',
              border: `1px solid ${genderFilter === g ? 'var(--cyan)' : 'var(--border)'}`,
              background: genderFilter === g ? 'rgba(0,229,255,0.08)' : 'transparent',
              color: genderFilter === g ? 'var(--cyan)' : 'var(--muted)'
            }}>{g === 'all' ? 'All Gender' : g}</button>
          ))}
          {/* Risk pills */}
          {['all', 'high', 'medium', 'low'].map(r => (
            <button key={r} data-cursor="hover" onClick={() => setRiskFilter(r)} style={{
              height: 30, padding: '0 12px', borderRadius: 16, fontFamily: 'var(--font-body)', fontSize: 11, textTransform: 'capitalize', cursor: 'pointer',
              border: `1px solid ${riskFilter === r ? 'var(--amber)' : 'var(--border)'}`,
              background: riskFilter === r ? 'rgba(255,149,0,0.08)' : 'transparent',
              color: riskFilter === r ? 'var(--amber)' : 'var(--muted)'
            }}>{r === 'all' ? 'All Risk' : `${r} risk`}</button>
          ))}
          {/* Agent filter */}
          {['all', 'voice', 'imaging', 'ocr'].map(a => (
            <button key={a} data-cursor="hover" onClick={() => setAgentFilter(a as any)} style={{
              height: 30, padding: '0 12px', borderRadius: 16, fontFamily: 'var(--font-body)', fontSize: 11, textTransform: 'capitalize', cursor: 'pointer',
              border: `1px solid ${agentFilter === a ? 'var(--text)' : 'var(--border)'}`,
              background: agentFilter === a ? 'rgba(255,255,255,0.05)' : 'transparent',
              color: agentFilter === a ? 'var(--text)' : 'var(--muted)'
            }}>{a === 'all' ? 'All Agents' : a}</button>
          ))}
          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
            height: 30, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 16,
            padding: '0 10px', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text)', outline: 'none', cursor: 'pointer'
          }}>
            <option value="recent">Recent</option>
            <option value="risk">Risk Score</option>
            <option value="sessions">Sessions</option>
          </select>
        </div>
      </div>

      {/* Patient Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {isLoading ? (
          Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} height={200} />)
        ) : filteredPatients.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center' }}>
            <span className="font-body" style={{ color: 'var(--muted)', fontSize: 14 }}>No patients found matching criteria.</span>
          </div>
        ) : (
          filteredPatients.map((p: any, i: number) => {
            const uColor = urgencyColor(p.last_session_urgency || '');
            const riskScore = p.risk_score ?? 0;
            const riskColor = riskScore >= 7 ? 'var(--red)' : riskScore >= 4 ? 'var(--amber)' : 'var(--green)';
            const isExpanded = expandedPatient === p.id;

            return (
              <motion.div
                key={p.id || p.patient_code}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
                data-cursor="hover"
                onClick={() => setExpandedPatient(isExpanded ? null : p.id)}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${uColor}`, borderRadius: 12,
                  padding: 20, display: 'flex', flexDirection: 'column', gap: 14, transition: 'all 300ms ease', cursor: 'pointer'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Identicon id={p.patient_code} />
                  <div style={{ flex: 1 }}>
                    <span className="font-number" style={{ fontSize: 16, color: 'var(--cyan)' }}>{p.patient_code}</span>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 2 }}>
                      {p.demographics?.age || p.age}yo · {p.demographics?.gender || p.gender} {p.demographics?.blood_type ? `· ${p.demographics.blood_type}` : ''}
                    </span>
                  </div>
                  {/* Risk Score */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span className="font-number" style={{ fontSize: 18, color: riskColor }}>{riskScore}</span>
                    <span className="font-body" style={{ fontSize: 9, color: 'var(--muted)' }}>RISK</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--elevated)', padding: 12, borderRadius: 8 }}>
                  <div>
                    <span className="font-body" style={{ fontSize: 10, color: 'var(--dim)', display: 'block', marginBottom: 4 }}>LAST SESSION</span>
                    {p.last_session_agent ? <AgentBadge agent={p.last_session_agent} /> : <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>}
                  </div>
                  <div>
                    <span className="font-body" style={{ fontSize: 10, color: 'var(--dim)', display: 'block', marginBottom: 4 }}>TOTAL SESSIONS</span>
                    <span className="font-number" style={{ fontSize: 16, color: 'var(--text)' }}>{p.total_sessions ?? p.session_count ?? 0}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span className="font-body" style={{ fontSize: 10, color: 'var(--dim)', display: 'block', marginBottom: 4 }}>CONDITIONS</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(p.total_conditions_detected || []).slice(0, 3).map((c: string) => (
                        <span key={c} style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontFamily: 'var(--font-body)', background: 'rgba(0,229,255,0.05)', color: 'var(--cyan)', border: '1px solid rgba(0,229,255,0.15)' }}>{c}</span>
                      ))}
                      {(p.total_conditions_detected || []).length > 3 && (
                        <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)' }}>+{p.total_conditions_detected.length - 3}</span>
                      )}
                      {(!p.total_conditions_detected || p.total_conditions_detected.length === 0) && p.most_common_condition && (
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontFamily: 'var(--font-body)', background: 'rgba(0,229,255,0.05)', color: 'var(--cyan)', border: '1px solid rgba(0,229,255,0.15)' }}>{p.most_common_condition}</span>
                      )}
                    </div>
                  </div>
                  {p.last_session_urgency && <UrgencyBadge urgency={p.last_session_urgency.toLowerCase()} />}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {p.last_session_date && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>Last Session</span>
                        <span className="font-body" style={{ fontSize: 11, color: 'var(--text)' }}>{new Date(p.last_session_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>Created</span>
                      <span className="font-body" style={{ fontSize: 11, color: 'var(--text)' }}>{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  </motion.div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--muted)' }} />}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PatientsPage;
