import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, Activity, Target, FileText, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useRecentSessions } from '@/hooks/useRecentSessions';
import { useLiveWebSocket } from '@/hooks/useLiveWebSocket';
import { useSystemInfo } from '@/hooks/useSystemInfo';
import { useQuickStats, useAIInsights, useUrgencyHeatmap } from '@/hooks/useQuickStats';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { SparkLine } from '@/components/shared/SparkLine';
import { CountUpNumber } from '@/components/shared/CountUpNumber';
import { AgentBadge } from '@/components/shared/AgentBadge';
import { UrgencyBadge } from '@/components/shared/UrgencyBadge';
import { ConfidenceMeter } from '@/components/shared/ConfidenceMeter';

const PIE_COLORS = ['#00E5FF', '#00FF9D', '#FF9500', '#FF3B5C', '#8B5CF6', '#EC4899'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div style={{
      background: 'var(--elevated)', border: '1px solid var(--border-glow)',
      borderRadius: 8, padding: '12px 16px', fontFamily: 'var(--font-body)', fontSize: 12
    }}>
      <div style={{ color: 'var(--muted)', marginBottom: 8 }}>
        {format(new Date(label), 'MMM d, yyyy')}
      </div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
};

/* ── Uptime Counter ── */
const UptimeCounter = ({ seconds }: { seconds: number }) => {
  const [elapsed, setElapsed] = useState(seconds);
  useEffect(() => { setElapsed(seconds); }, [seconds]);
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const d = Math.floor(elapsed / 86400);
  const h = Math.floor((elapsed % 86400) / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return (
    <span className="font-number" style={{ fontSize: 11, color: 'var(--cyan)' }}>
      {d}d {String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
    </span>
  );
};

/* ── Stat Card (reusable) ── */
const StatCard = ({ label, value, icon, sparkData, trendColor }: {
  label: string; value: number; icon: React.ReactNode; sparkData?: number[]; trendColor?: string
}) => (
  <div style={{
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
    padding: 20, transition: 'all 300ms ease', cursor: 'default'
  }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--border-glow)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
      <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
      {icon}
    </div>
    <div className="font-number" style={{ fontSize: 32, color: 'var(--text)', lineHeight: 1 }}>
      <CountUpNumber value={value} />
    </div>
    {sparkData && (
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <SparkLine data={sparkData} color={trendColor || 'var(--cyan)'} width={60} height={20} />
      </div>
    )}
  </div>
);

/* ── Quick Action Card ── */
const QuickActionCard = ({ emoji, title, desc, stat, statLabel, cta, to, bgGrad }: {
  emoji: string; title: string; desc: string; stat: number; statLabel: string; cta: string; to: string; bgGrad: string
}) => {
  const navigate = useNavigate();
  return (
    <motion.div
      whileHover={{ y: -8, boxShadow: '0 16px 48px rgba(0,229,255,0.08)' }}
      style={{
        background: bgGrad, border: '1px solid var(--border)', borderRadius: 16,
        padding: 28, cursor: 'pointer', transition: 'border-color 300ms',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12
      }}
      onClick={() => navigate(to)}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-glow)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <motion.div style={{ fontSize: 56 }} whileHover={{ scale: 1.1, y: -4 }} transition={{ type: 'spring', stiffness: 400 }}>
        {emoji}
      </motion.div>
      <span className="font-heading" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
      <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{desc}</span>
      <span className="font-number" style={{ fontSize: 13, color: 'var(--cyan)' }}>
        <CountUpNumber value={stat} /> {statLabel}
      </span>
      <div style={{
        marginTop: 8, padding: '8px 24px', borderRadius: 8,
        background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.15)',
        color: 'var(--cyan)', fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 600
      }}>
        {cta}
      </div>
    </motion.div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isPatient } = useAuth();
  const { data: stats, isLoading } = useDashboardStats();
  const { data: recentSessions, isLoading: loadingSessions } = useRecentSessions();
  const { data: sysInfo } = useSystemInfo();
  const { data: quickStats } = useQuickStats();
  const { data: insightsData, refetch: refetchInsights, isFetching: insightsLoading } = useAIInsights();
  const { data: heatmapData } = useUrgencyHeatmap();
  const { isConnected } = useLiveWebSocket();

  const [activePie, setActivePie] = useState<number | null>(null);
  const [chartRange, setChartRange] = useState<7 | 14 | 30>(30);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (isLoading || !stats) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SkeletonCard height={200} />
        <div className="responsive-grid-4">{[1,2,3,4].map(i => <SkeletonCard key={i} height={220} />)}</div>
        <div className="responsive-grid-4">{[1,2,3,4,5].map(i => <SkeletonCard key={i} height={100} />)}</div>
      </div>
    );
  }

  const chartData = stats.diagnoses_last_30_days.slice(-chartRange);
  const last7 = stats.diagnoses_last_30_days.slice(-7).map(d => d.voice + d.imaging + d.ocr);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ═══════ 1A. HERO SECTION ═══════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
          padding: '32px 40px', minHeight: 180,
          backgroundImage: 'linear-gradient(rgba(0,229,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.03) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <span style={{ fontSize: 48 }}>{isPatient ? '👋' : '🏥'}</span>
            <span className="font-number" style={{ fontSize: 32, fontWeight: 700, color: 'var(--cyan)' }}>
              {isPatient ? `Welcome, ${user?.full_name?.split(' ')[0]}` : 'NEURAMED'}
            </span>
          </div>
          <div className="font-heading" style={{ fontSize: 16, color: 'var(--muted)', marginBottom: 16 }}>
            {isPatient ? 'Your AI health assistant is ready' : 'Clinical AI Diagnostic Intelligence Platform'}
          </div>
          {isPatient && user?.patient_code && (
            <span className="font-number" style={{ fontSize: 13, color: 'var(--cyan)', background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)', padding: '4px 12px', borderRadius: 20, marginBottom: 12, display: 'inline-block' }}>
              Your ID: {user.patient_code}
            </span>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['🎤 Voice Diagnosis', '🧠 Imaging AI', '📄 OCR Reports'].map(pill => (
              <span key={pill} className="font-body" style={{
                fontSize: 11, padding: '4px 12px', borderRadius: 20,
                background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)', color: 'var(--text)'
              }}>{pill}</span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse-dot 2s infinite' }} />
            <span className="font-body" style={{ fontSize: 12, color: 'var(--green)' }}>⚡ SYSTEM ONLINE</span>
          </div>
          <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)' }}>
            {format(now, 'MMM d, yyyy')} — {format(now, 'HH:mm:ss')}
          </span>
          <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>🤖 LLaMA 3 70B — ⚡ Groq Inference</span>
          {sysInfo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={12} style={{ color: 'var(--muted)' }} />
              <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>Uptime:</span>
              <UptimeCounter seconds={sysInfo.uptime_seconds} />
            </div>
          )}
        </div>
      </motion.div>

      {/* ═══════ 1B. QUICK ACTION CARDS ═══════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}
      >
        <QuickActionCard emoji="🎤" title="Voice Diagnosis" desc="Speak or type symptoms. Get AI differential diagnosis in seconds."
          stat={quickStats?.total_voice ?? 0} statLabel="diagnoses run" cta="Start Diagnosis →" to="/voice"
          bgGrad="linear-gradient(135deg, #020608 0%, rgba(0,229,255,0.04) 100%)" />
        <QuickActionCard emoji="🧠" title="Imaging AI" desc="Upload CT, MRI, X-Ray. OpenCV + LLaMA detects anomalies automatically."
          stat={quickStats?.total_imaging ?? 0} statLabel="scans analyzed" cta="Analyze Scan →" to="/imaging"
          bgGrad="linear-gradient(135deg, #020608 0%, rgba(0,255,157,0.04) 100%)" />
        <QuickActionCard emoji="📄" title="OCR Reports" desc="Upload any medical PDF. AI extracts findings, flags, medications instantly."
          stat={quickStats?.total_ocr ?? 0} statLabel="reports processed" cta="Process Report →" to="/ocr"
          bgGrad="linear-gradient(135deg, #020608 0%, rgba(255,149,0,0.04) 100%)" />
        <QuickActionCard emoji="📅" title="Appointments" desc="Manage patient appointments. Track status and upcoming schedules."
          stat={quickStats?.upcoming_appointments ?? 0} statLabel="upcoming" cta="View Schedule →" to="/appointments"
          bgGrad="linear-gradient(135deg, #020608 0%, rgba(139,92,246,0.04) 100%)" />
      </motion.div>

      {/* ═══════ 1C. METRICS ROW ═══════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}
      >
        <StatCard label="Total Diagnoses" value={stats.total_diagnoses} icon={<TrendingUp size={14} style={{ color: 'var(--muted)' }} />} sparkData={last7} trendColor="var(--cyan)" />
        <StatCard label="Patients" value={quickStats?.total_patients ?? 0} icon={<Activity size={14} style={{ color: 'var(--muted)' }} />} />
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>AVG CONFIDENCE</span>
          <ConfidenceMeter value={stats.avg_confidence} size={80} />
        </div>
        <StatCard label="Critical Today" value={quickStats?.critical_today ?? 0} icon={<AlertTriangle size={14} style={{ color: 'var(--red)' }} />} trendColor="var(--red)" />
        <StatCard label="Avg Speed (ms)" value={quickStats?.avg_processing_time_ms ?? 0} icon={<Target size={14} style={{ color: 'var(--muted)' }} />} trendColor="var(--amber)" />
      </motion.div>

      {/* ═══════ 1D. ACTIVITY CHART ═══════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600 }}>Diagnostic Activity</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {([7, 14, 30] as const).map(r => (
              <button key={r} onClick={() => setChartRange(r)} className="font-body" style={{
                fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: chartRange === r ? 'rgba(0,229,255,0.12)' : 'transparent',
                color: chartRange === r ? 'var(--cyan)' : 'var(--muted)',
              }}>{r}D</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gCyan" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00E5FF" stopOpacity={0.25}/><stop offset="95%" stopColor="#00E5FF" stopOpacity={0}/></linearGradient>
              <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00FF9D" stopOpacity={0.25}/><stop offset="95%" stopColor="#00FF9D" stopOpacity={0}/></linearGradient>
              <linearGradient id="gAmber" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#FF9500" stopOpacity={0.25}/><stop offset="95%" stopColor="#FF9500" stopOpacity={0}/></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontFamily: 'DM Mono', fontSize: 10, fill: '#445566' }} tickLine={false} axisLine={false} tickFormatter={d => format(new Date(d), 'MMM d')} />
            <YAxis tick={{ fontFamily: 'DM Mono', fontSize: 10, fill: '#445566' }} tickLine={false} axisLine={false} width={30} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" name="Voice" dataKey="voice" stroke="#00E5FF" strokeWidth={2} fill="url(#gCyan)" />
            <Area type="monotone" name="Imaging" dataKey="imaging" stroke="#00FF9D" strokeWidth={2} fill="url(#gGreen)" />
            <Area type="monotone" name="OCR" dataKey="ocr" stroke="#FF9500" strokeWidth={2} fill="url(#gAmber)" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* ═══════ 1E. SPLIT ROW: Recent Sessions + AI Insights ═══════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
        style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}
      >
        {/* Recent Sessions */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600 }}>Recent Sessions</span>
            <button onClick={() => navigate('/sessions')} className="font-body" style={{ fontSize: 12, color: 'var(--cyan)', background: 'none', border: 'none', cursor: 'pointer' }}>View All →</button>
          </div>
          {loadingSessions ? <SkeletonCard height={200} /> : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 600 }}>
              <thead>
                <tr>
                  {['PATIENT', 'AGENT', 'CONDITION', 'CONFIDENCE', 'URGENCY', 'TIME'].map(h => (
                    <th key={h} className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em', padding: '0 12px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentSessions?.slice(0, 8).map((s: any) => (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/sessions/${s.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="font-number" style={{ fontSize: 12, color: 'var(--cyan)', padding: '10px 12px' }}>{s.patient_code}</td>
                    <td style={{ padding: '10px 12px' }}><AgentBadge agent={s.agent_type} /></td>
                    <td className="font-body" style={{ fontSize: 11, color: 'var(--text)', padding: '10px 12px' }}>{(s.conditions_detected || [])[0] || '—'}</td>
                    <td className="font-number" style={{ fontSize: 12, color: s.confidence_score > 0.8 ? 'var(--green)' : 'var(--cyan)', padding: '10px 12px' }}>{Math.round(s.confidence_score * 100)}%</td>
                    <td style={{ padding: '10px 12px' }}><UrgencyBadge urgency={s.urgency_level} /></td>
                    <td className="font-body" style={{ fontSize: 11, color: 'var(--muted)', padding: '10px 12px' }}>{formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* AI Insights */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600 }}>AI Insights</span>
            <button onClick={() => refetchInsights()} className="font-body" style={{
              fontSize: 11, color: 'var(--cyan)', background: 'none', border: '1px solid var(--border)', borderRadius: 6,
              padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
            }}>
              <RefreshCw size={12} className={insightsLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {insightsData?.insights?.map((insight, i) => {
              const borderColors: Record<string, string> = { high: 'var(--red)', medium: 'var(--amber)', low: 'var(--cyan)' };
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  style={{
                    padding: '12px 16px', borderRadius: 8,
                    borderLeft: `3px solid ${borderColors[insight.severity] || 'var(--cyan)'}`,
                    background: 'rgba(255,255,255,0.02)'
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{insight.icon_emoji}</span>
                    <span className="font-heading" style={{ fontSize: 14, color: 'var(--text)' }}>{insight.title}</span>
                  </div>
                  <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{insight.description}</span>
                </motion.div>
              );
            })}
            {!insightsData?.insights?.length && (
              <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 24 }}>
                Run diagnoses to generate AI insights
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* ═══════ 1F. BOTTOM ROW ═══════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}
      >
        {/* Condition Distribution Donut */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600, display: 'block', marginBottom: 16 }}>Top Conditions</span>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <PieChart width={200} height={200}>
              <Pie data={stats.condition_distribution.slice(0, 6)} dataKey="count" nameKey="condition" cx={100} cy={100}
                innerRadius={60} outerRadius={85} onMouseEnter={(_, i) => setActivePie(i)} onMouseLeave={() => setActivePie(null)}>
                {stats.condition_distribution.slice(0, 6).map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
            </PieChart>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <div className="font-body" style={{ fontSize: 10, color: 'var(--muted)' }}>
                {activePie !== null ? stats.condition_distribution[activePie]?.condition : 'Total'}
              </div>
              <div className="font-number" style={{ fontSize: 22, color: 'var(--text)' }}>
                {activePie !== null ? stats.condition_distribution[activePie]?.count : stats.condition_distribution.reduce((s: number, c: any) => s + c.count, 0)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {stats.condition_distribution.slice(0, 6).map((c: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: PIE_COLORS[i] }} />
                <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>{c.condition}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Urgency Heatmap */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600, display: 'block', marginBottom: 16 }}>Urgency Heatmap</span>
          {heatmapData ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(7, 1fr)', gap: 4, alignItems: 'center' }}>
                <div />
                {heatmapData.days.map(d => <span key={d} className="font-body" style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>{d}</span>)}
                {heatmapData.urgencies.map(urg => {
                  const urgColors: Record<string, string> = { critical: '#FF3B5C', high: '#FF9500', medium: '#00E5FF', low: 'rgba(255,255,255,0.05)' };
                  const maxCount = Math.max(...heatmapData.heatmap.map(h => h.count), 1);
                  return [
                    <span key={`label-${urg}`} className="font-body" style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'capitalize' }}>{urg}</span>,
                    ...heatmapData.days.map(day => {
                      const cell = heatmapData.heatmap.find(h => h.day === day && h.urgency === urg);
                      const count = cell?.count || 0;
                      const opacity = count > 0 ? Math.max(0.2, count / maxCount) : 0.05;
                      return (
                        <div key={`${day}-${urg}`} title={`${count} ${urg} cases on ${day}`} style={{
                          width: '100%', aspectRatio: '1', borderRadius: 4,
                          background: urgColors[urg] || 'var(--muted)', opacity,
                          minWidth: 20, minHeight: 20
                        }} />
                      );
                    })
                  ];
                })}
              </div>
            </div>
          ) : <SkeletonCard height={120} />}
        </div>

        {/* System Health */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600, display: 'block', marginBottom: 20 }}>System Health</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'API Latency', value: stats.system_health.api_latency_ms, unit: 'ms', threshold1: 100, threshold2: 300 },
              { label: 'Model Uptime', value: stats.system_health.model_uptime_pct, unit: '%', threshold1: 99, threshold2: 95, invert: true },
              { label: 'Queue Depth', value: stats.system_health.queue_depth, unit: '', threshold1: 5, threshold2: 15 },
              { label: 'GPU Usage', value: stats.system_health.gpu_utilization_pct, unit: '%', threshold1: 70, threshold2: 90 },
              { label: 'Memory', value: stats.system_health.memory_pct, unit: '%', threshold1: 75, threshold2: 90 },
            ].map(m => {
              const pct = m.invert ? m.value : (m.value / (m.threshold2 * 1.5)) * 100;
              let color = 'var(--green)';
              if (m.invert) { color = m.value < m.threshold2 ? 'var(--red)' : m.value < m.threshold1 ? 'var(--amber)' : 'var(--green)'; }
              else { color = m.value > m.threshold2 ? 'var(--red)' : m.value > m.threshold1 ? 'var(--amber)' : 'var(--green)'; }
              return (
                <div key={m.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)' }}>{m.label}</span>
                    <span className="font-number" style={{ fontSize: 13, color: 'var(--text)' }}>{m.value}{m.unit}</span>
                  </div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(Math.max(pct, 5), 100)}%` }} transition={{ duration: 0.8 }}
                      style={{ height: '100%', background: color, borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
