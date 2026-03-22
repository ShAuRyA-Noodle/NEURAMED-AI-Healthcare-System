import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, Calendar, Activity, Search, AlertTriangle, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { usePatients, useCreatePatient } from '@/hooks/usePatients';
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
  <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPatient, setNewPatient] = useState({ first_name: '', last_name: '', age: '', gender: '', phone: '', email: '', blood_type: '', emergency_contact: '', allergies: '', chronic_conditions: '' });

  const { data: patients, isLoading } = usePatients();
  const createPatient = useCreatePatient();

  const filteredPatients = (patients || []).filter((p: any) => {
    const s = search.toLowerCase();
    const matchSearch = !s || p.patient_code.toLowerCase().includes(s) ||
      (p.full_name || '').toLowerCase().includes(s) ||
      (p.phone || '').toLowerCase().includes(s) ||
      (p.demographics?.gender || p.gender || '').toLowerCase().startsWith(s);
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
        <div style={{ flex: 1 }}>
          <h1 className="font-heading" style={{ fontSize: 24, color: 'var(--text)', margin: 0 }}>Patient Registry</h1>
          <p className="font-body" style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Manage and monitor patient records</p>
        </div>
        <button data-cursor="hover" onClick={() => setShowAddModal(true)} style={{
          width: 44, height: 44, borderRadius: 12, border: '1px solid var(--cyan)', background: 'rgba(0,229,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 200ms ease'
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.18)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.08)'; }}
        >
          <Plus size={22} style={{ color: 'var(--cyan)' }} />
        </button>
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, code, or phone..."
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
                    <span className="font-number" style={{ fontSize: 16, color: 'var(--text)' }}>{p.full_name || p.patient_code}</span>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--cyan)', display: 'block', marginTop: 1 }}>{p.full_name ? p.patient_code : ''}</span>
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
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[
                        { label: 'Phone', value: p.phone },
                        { label: 'Email', value: p.email },
                        { label: 'Blood Type', value: p.demographics?.blood_type },
                        { label: 'Date of Birth', value: p.demographics?.date_of_birth ? new Date(p.demographics.date_of_birth).toLocaleDateString() : null },
                      ].filter(f => f.value).map(f => (
                        <div key={f.label}>
                          <span className="font-body" style={{ fontSize: 9, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 }}>{f.label}</span>
                          <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>{f.value}</span>
                        </div>
                      ))}
                    </div>
                    {p.address && (
                      <div>
                        <span className="font-body" style={{ fontSize: 9, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 }}>Address</span>
                        <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>{p.address}</span>
                      </div>
                    )}
                    {p.emergency_contact && (
                      <div>
                        <span className="font-body" style={{ fontSize: 9, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 }}>Emergency Contact</span>
                        <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>{p.emergency_contact}</span>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {p.allergies && (
                        <div>
                          <span className="font-body" style={{ fontSize: 9, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 }}>Allergies</span>
                          <span className="font-body" style={{ fontSize: 12, color: 'var(--amber)' }}>{p.allergies}</span>
                        </div>
                      )}
                      {p.chronic_conditions && (
                        <div>
                          <span className="font-body" style={{ fontSize: 9, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 }}>Chronic Conditions</span>
                          <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>{p.chronic_conditions}</span>
                        </div>
                      )}
                    </div>
                    {p.insurance_id && (
                      <div>
                        <span className="font-body" style={{ fontSize: 9, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 }}>Insurance ID</span>
                        <span className="font-number" style={{ fontSize: 12, color: 'var(--text)' }}>{p.insurance_id}</span>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      {p.last_session_date && (
                        <div>
                          <span className="font-body" style={{ fontSize: 9, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 }}>Last Session</span>
                          <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>{new Date(p.last_session_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div>
                        <span className="font-body" style={{ fontSize: 9, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 2 }}>Created</span>
                        <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>{new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
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

      {/* Add Patient Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowAddModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            style={{ position: 'relative', width: 520, maxHeight: '85vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 className="font-heading" style={{ fontSize: 20, color: 'var(--text)', margin: 0 }}>Add New Patient</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} style={{ color: 'var(--muted)' }} />
              </button>
            </div>

            <form onSubmit={e => {
              e.preventDefault();
              if (!newPatient.first_name || !newPatient.last_name || !newPatient.age || !newPatient.gender) return;
              createPatient.mutate({
                first_name: newPatient.first_name,
                last_name: newPatient.last_name,
                age: parseInt(newPatient.age),
                gender: newPatient.gender,
                phone: newPatient.phone || undefined,
                email: newPatient.email || undefined,
                blood_type: newPatient.blood_type || undefined,
                emergency_contact: newPatient.emergency_contact || undefined,
                allergies: newPatient.allergies || undefined,
                chronic_conditions: newPatient.chronic_conditions || undefined,
              }, {
                onSuccess: () => {
                  setShowAddModal(false);
                  setNewPatient({ first_name: '', last_name: '', age: '', gender: '', phone: '', email: '', blood_type: '', emergency_contact: '', allergies: '', chronic_conditions: '' });
                }
              });
            }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* First Name */}
                <div>
                  <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>First Name *</label>
                  <input required value={newPatient.first_name} onChange={e => setNewPatient(s => ({ ...s, first_name: e.target.value }))}
                    style={{ width: '100%', height: 36, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                {/* Last Name */}
                <div>
                  <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Last Name *</label>
                  <input required value={newPatient.last_name} onChange={e => setNewPatient(s => ({ ...s, last_name: e.target.value }))}
                    style={{ width: '100%', height: 36, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Age */}
                <div>
                  <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Age *</label>
                  <input required type="number" min={0} max={150} value={newPatient.age} onChange={e => setNewPatient(s => ({ ...s, age: e.target.value }))}
                    style={{ width: '100%', height: 36, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                {/* Gender */}
                <div>
                  <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Gender *</label>
                  <select required value={newPatient.gender} onChange={e => setNewPatient(s => ({ ...s, gender: e.target.value }))}
                    style={{ width: '100%', height: 36, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}
                  >
                    <option value="">Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Phone */}
                <div>
                  <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Phone</label>
                  <input value={newPatient.phone} onChange={e => setNewPatient(s => ({ ...s, phone: e.target.value }))}
                    style={{ width: '100%', height: 36, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                {/* Email */}
                <div>
                  <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Email</label>
                  <input type="email" value={newPatient.email} onChange={e => setNewPatient(s => ({ ...s, email: e.target.value }))}
                    style={{ width: '100%', height: 36, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Blood Type */}
              <div>
                <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Blood Type</label>
                <select value={newPatient.blood_type} onChange={e => setNewPatient(s => ({ ...s, blood_type: e.target.value }))}
                  style={{ width: '100%', height: 36, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}
                >
                  <option value="">Select...</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bt => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              </div>

              {/* Emergency Contact */}
              <div>
                <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Emergency Contact</label>
                <input value={newPatient.emergency_contact} onChange={e => setNewPatient(s => ({ ...s, emergency_contact: e.target.value }))}
                  style={{ width: '100%', height: 36, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Allergies */}
                <div>
                  <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Allergies</label>
                  <input value={newPatient.allergies} onChange={e => setNewPatient(s => ({ ...s, allergies: e.target.value }))}
                    style={{ width: '100%', height: 36, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                {/* Chronic Conditions */}
                <div>
                  <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Chronic Conditions</label>
                  <input value={newPatient.chronic_conditions} onChange={e => setNewPatient(s => ({ ...s, chronic_conditions: e.target.value }))}
                    style={{ width: '100%', height: 36, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {createPatient.isError && (
                <div className="font-body" style={{ fontSize: 12, color: 'var(--red)', padding: '8px 12px', background: 'rgba(255,59,48,0.08)', borderRadius: 8 }}>
                  Failed to create patient. Please try again.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{
                  height: 38, padding: '0 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent',
                  fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--muted)', cursor: 'pointer'
                }}>Cancel</button>
                <button type="submit" disabled={createPatient.isPending} style={{
                  height: 38, padding: '0 24px', borderRadius: 10, border: '1px solid var(--cyan)', background: 'rgba(0,229,255,0.12)',
                  fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--cyan)', cursor: 'pointer', opacity: createPatient.isPending ? 0.6 : 1
                }}>{createPatient.isPending ? 'Creating...' : 'Create Patient'}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PatientsPage;
