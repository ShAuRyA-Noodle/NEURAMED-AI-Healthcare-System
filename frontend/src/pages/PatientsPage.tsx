import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, Calendar, Activity, Search } from 'lucide-react';
import { usePatients } from '@/hooks/usePatients';
import { AgentType } from '@/types';
import { AgentBadge } from '@/components/shared/AgentBadge';
import { SkeletonCard } from '@/components/shared/SkeletonCard';

const agentColor = (a: string) => a === 'VOICE' ? 'var(--cyan)' : a === 'IMAGING' ? 'var(--green)' : 'var(--amber)';
const agentBg = (a: string) => a === 'VOICE' ? 'rgba(0,229,255,0.1)' : a === 'IMAGING' ? 'rgba(0,255,157,0.1)' : 'rgba(255,149,0,0.1)';
const urgencyColor = (u: string) => u === 'CRITICAL' ? 'var(--red)' : u === 'HIGH' ? 'var(--amber)' : u === 'MEDIUM' ? 'var(--cyan)' : 'var(--muted)';

// Deterministic geometric identicon generator from string
const Identicon = ({ id }: { id: string }) => {
  const sum = id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const hue = (sum * 137) % 360;
  const isCircle = sum % 2 === 0;

  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', background: `hsl(${hue}, 30%, 15%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid hsl(${hue}, 50%, 30%)`
    }}>
      {isCircle ? (
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: `hsl(${hue}, 70%, 50%)` }} />
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill={`hsl(${hue}, 70%, 50%)`}>
          <polygon points="12 2 22 22 2 22" />
        </svg>
      )}
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, trend }: any) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={20} style={{ color: 'var(--muted)' }} />
    </div>
    <div style={{ flex: 1 }}>
      <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="font-number" style={{ fontSize: 24, color: 'var(--text)' }}>{value}</span>
        {trend && <span className="font-body" style={{ fontSize: 11, color: trend > 0 ? 'var(--green)' : 'var(--amber)' }}>{trend > 0 ? '+' : ''}{trend}%</span>}
      </div>
    </div>
  </div>
);

const PatientsPage = () => {
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState<AgentType | 'all'>('all');

  // Note: we pass search to the query if the hook supports it
  const { data: patients, isLoading } = usePatients();

  const filteredPatients = patients?.filter((p: any) => {
    const s = search.toLowerCase();
    const matchSearch = p.patient_code.toLowerCase().includes(s) || (p.demographics?.gender || '').toLowerCase().startsWith(s);
    const matchAgent = agentFilter === 'all' || p.last_session_agent === agentFilter;
    return matchSearch && matchAgent;
  }) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard label="TOTAL PATIENTS" value={patients?.length || 0} icon={Users} trend={4.2} />
        <StatCard label="NEW THIS WEEK" value="128" icon={UserPlus} trend={12} />
        <StatCard label="ACTIVE APPOINTMENTS" value="45" icon={Calendar} trend={-2} />
        <StatCard label="CRITICAL CASES" value={patients?.filter((p: any) => p.last_session_urgency === 'CRITICAL').length || 0} icon={Activity} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patient code..."
            data-cursor="hover"
            style={{
              width: 320, height: 40, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 20,
              padding: '0 20px 0 44px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', transition: 'all 200ms'
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--cyan)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {['all', 'voice', 'imaging', 'ocr'].map((a) => (
            <button key={a} data-cursor="hover" onClick={() => setAgentFilter(a as any)} style={{
              height: 32, padding: '0 16px', borderRadius: 16, fontFamily: 'var(--font-body)', fontSize: 12, textTransform: 'capitalize',
              border: `1px solid ${agentFilter === a ? (a === 'all' ? 'var(--text)' : agentColor(a.toUpperCase())) : 'var(--border)'}`,
              background: agentFilter === a ? (a === 'all' ? 'rgba(255,255,255,0.05)' : agentBg(a.toUpperCase())) : 'transparent',
              color: agentFilter === a ? (a === 'all' ? 'var(--text)' : agentColor(a.toUpperCase())) : 'var(--muted)',
              transition: 'all 200ms'
            }}>
              {a === 'all' ? 'All Agents' : a}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {isLoading ? (
          Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} height={180} />)
        ) : filteredPatients.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center' }}>
            <span className="font-body" style={{ color: 'var(--muted)', fontSize: 14 }}>No patients found matching criteria.</span>
          </div>
        ) : (
          filteredPatients.map((p: any, i: number) => {
            const uColor = urgencyColor(p.last_session_urgency);
            return (
              <motion.div
                key={p.patient_code}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                data-cursor="hover"
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${uColor}`, borderRadius: 12,
                  padding: 20, display: 'flex', flexDirection: 'column', gap: 16, transition: 'all 300ms ease', position: 'relative', overflow: 'hidden'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                  const btn = e.currentTarget.querySelector('.view-btn') as HTMLElement;
                  if (btn) btn.style.maxHeight = '32px';
                  if (btn) btn.style.opacity = '1';
                  if (btn) btn.style.marginTop = '12px';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  const btn = e.currentTarget.querySelector('.view-btn') as HTMLElement;
                  if (btn) btn.style.maxHeight = '0px';
                  if (btn) btn.style.opacity = '0';
                  if (btn) btn.style.marginTop = '0px';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Identicon id={p.patient_code} />
                  <div style={{ flex: 1 }}>
                    <span className="font-number" style={{ fontSize: 16, color: 'var(--cyan)' }}>{p.patient_code}</span>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 2 }}>
                      {p.demographics?.age}yo • {p.demographics?.gender} • {p.demographics?.blood_type}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'var(--elevated)', padding: 12, borderRadius: 8 }}>
                  <div>
                    <span className="font-body" style={{ fontSize: 10, color: 'var(--dim)', display: 'block', marginBottom: 4 }}>LAST SESSION</span>
                    {p.last_session_agent ? <AgentBadge agent={p.last_session_agent} /> : <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)' }}>-</span>}
                  </div>
                  <div>
                    <span className="font-body" style={{ fontSize: 10, color: 'var(--dim)', display: 'block', marginBottom: 4 }}>TOTAL SESSIONS</span>
                    <span className="font-number" style={{ fontSize: 16, color: 'var(--text)' }}>{p.total_sessions}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="font-body" style={{ fontSize: 10, color: 'var(--dim)' }}>MOST COMMON CONDITION</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="font-body" style={{ fontSize: 13, color: 'var(--text)' }}>{p.most_common_condition || 'None'}</span>
                    <span className="font-body" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, border: `1px solid ${uColor}`, color: uColor }}>{p.last_session_urgency}</span>
                  </div>
                </div>

                <div className="view-btn" style={{
                  maxHeight: 0, opacity: 0, overflow: 'hidden', transition: 'all 300ms ease',
                  background: 'rgba(0,229,255,0.08)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <span className="font-body" style={{ fontSize: 12, color: 'var(--cyan)', padding: '8px 0', letterSpacing: '0.05em' }}>View Records →</span>
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
