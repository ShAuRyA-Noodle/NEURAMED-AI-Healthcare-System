import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, Activity, Target, FileText } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import { useRecentSessions } from '@/hooks/useRecentSessions';
import { useLiveWebSocket } from '@/hooks/useLiveWebSocket';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { SparkLine } from '@/components/shared/SparkLine';
import { CountUpNumber } from '@/components/shared/CountUpNumber';
import { AgentBadge } from '@/components/shared/AgentBadge';
import { UrgencyBadge } from '@/components/shared/UrgencyBadge';
import { ConfidenceMeter } from '@/components/shared/ConfidenceMeter';

/* PIE COLORS */
const PIE_COLORS = ['#00E5FF', '#00FF9D', '#FF9500', '#FF3B5C', '#8B5CF6', '#EC4899'];

/* ── Custom Tooltip for AreaChart ── */
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

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useDashboardStats();
  const { events, isConnected } = useLiveWebSocket();
  const { data: recentSessions, isLoading: loadingSessions } = useRecentSessions();

  const [activePie, setActivePie] = useState<number | null>(null);

  if (isLoading || !stats) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="responsive-grid-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} height={120} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 16 }}>
          <SkeletonCard height={280} />
          <SkeletonCard height={280} />
        </div>
      </div>
    );
  }

  // Derive simple sparkline data from last 7 days voice volume
  const last7daysVoice = stats.diagnoses_last_30_days.slice(-7).map((d: any) => d.voice);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ROW 1: 4 Stat Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="responsive-grid-4"
      >
        {/* Card 1: Total Diagnoses */}
        <div
          data-hover="true"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
            padding: 24, position: 'relative', overflow: 'hidden', transition: 'all 300ms ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'var(--border-glow)';
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,229,255,0.04)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>TOTAL DIAGNOSES</span>
            <TrendingUp size={16} style={{ color: 'var(--muted)' }} />
          </div>
          <div style={{ fontSize: 42, color: 'var(--text)', lineHeight: 1 }}>
            <CountUpNumber value={stats.total_diagnoses} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <span className="font-body" style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 4,
              color: 'var(--green)', background: 'rgba(0,255,157,0.08)',
            }}>
              +12.4%
            </span>
            <SparkLine data={last7daysVoice} color="var(--cyan)" width={50} height={20} />
          </div>
        </div>

        {/* Card 2: Active Sessions */}
        <div
          data-hover="true"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
            padding: 24, position: 'relative', overflow: 'hidden', transition: 'all 300ms ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'var(--border-glow)';
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,229,255,0.04)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>ACTIVE SESSIONS TODAY</span>
            <Activity size={16} style={{ color: 'var(--muted)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 42, color: 'var(--text)', lineHeight: 1 }}>
              <CountUpNumber value={stats.active_sessions_today} />
            </div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse-dot 2s infinite' }} />
          </div>
          <div style={{ marginTop: 16 }}>
            <span className="font-body" style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 4,
              color: 'var(--amber)', background: 'rgba(255,149,0,0.08)',
            }}>
              -2.1%
            </span>
          </div>
        </div>

        {/* Card 3: Avg Confidence */}
        <div
          data-hover="true"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
            padding: 24, position: 'relative', overflow: 'hidden', transition: 'all 300ms ease',
            display: 'flex', flexDirection: 'column'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'var(--border-glow)';
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,229,255,0.04)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>AVG CONFIDENCE</span>
            <Target size={16} style={{ color: 'var(--muted)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <ConfidenceMeter value={stats.avg_confidence} size={100} />
          </div>
        </div>

        {/* Card 4: Reports Today */}
        <div
          data-hover="true"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
            padding: 24, position: 'relative', overflow: 'hidden', transition: 'all 300ms ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'var(--border-glow)';
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,229,255,0.04)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>REPORTS TODAY</span>
            <FileText size={16} style={{ color: 'var(--muted)' }} />
          </div>
          <div style={{ fontSize: 42, color: 'var(--text)', lineHeight: 1 }}>
            <CountUpNumber value={stats.reports_today} />
          </div>
          <div style={{ marginTop: 16 }}>
            <span className="font-body" style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 4,
              color: 'var(--green)', background: 'rgba(0,255,157,0.08)',
            }}>
              +5.8%
            </span>
          </div>
        </div>
      </motion.div>

      {/* ROW 2: Charts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}
      >
        {/* Area Chart */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600 }}>Diagnostic Activity</span>
            <div style={{ display: 'flex', gap: 16 }}>
              {[{ name: 'Voice', color: 'var(--cyan)' }, { name: 'Imaging', color: 'var(--green)' }, { name: 'OCR', color: 'var(--amber)' }].map(x => (
                <div key={x.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: x.color }} />
                  <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>{x.name}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats.diagnoses_last_30_days}>
              <defs>
                <linearGradient id="gCyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00E5FF" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00FF9D" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00FF9D" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gAmber" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF9500" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#FF9500" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontFamily: 'DM Mono', fontSize: 10, fill: '#445566' }} tickLine={false} axisLine={false} tickFormatter={d => format(new Date(d), 'MMM d')} />
              <YAxis tick={{ fontFamily: 'DM Mono', fontSize: 10, fill: '#445566' }} tickLine={false} axisLine={false} width={30} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" name="Voice" dataKey="voice" stroke="#00E5FF" strokeWidth={2} fill="url(#gCyan)" animationDuration={1200} />
              <Area type="monotone" name="Imaging" dataKey="imaging" stroke="#00FF9D" strokeWidth={2} fill="url(#gGreen)" animationDuration={1200} />
              <Area type="monotone" name="OCR" dataKey="ocr" stroke="#FF9500" strokeWidth={2} fill="url(#gAmber)" animationDuration={1200} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600, display: 'block', marginBottom: 20 }}>Agent Performance</span>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart layout="vertical" data={stats.agent_performance}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontFamily: 'DM Mono', fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="agent" width={70} tick={{ fontFamily: 'DM Mono', fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Bar dataKey="accuracy" name="Accuracy" fill="#00E5FF" barSize={6} radius={[0, 3, 3, 0]} animationDuration={1000} />
              <Bar dataKey="confidence" name="Confidence" fill="#00FF9D" barSize={6} radius={[0, 3, 3, 0]} animationDuration={1000} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ROW 3 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}
      >
        {/* Pie */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600, display: 'block', marginBottom: 16 }}>Top Conditions</span>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <PieChart width={200} height={200}>
              <Pie
                data={stats.condition_distribution.slice(0, 6)} dataKey="count" nameKey="condition" cx={100} cy={100}
                innerRadius={60} outerRadius={85}
                onMouseEnter={(_, i) => setActivePie(i)}
                onMouseLeave={() => setActivePie(null)}
                animationDuration={800}
              >
                {stats.condition_distribution.slice(0, 6).map((_: any, i: number) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <div className="font-body" style={{ fontSize: 10, color: 'var(--muted)' }}>
                {activePie !== null ? stats.condition_distribution[activePie].condition : 'Total'}
              </div>
              <div className="font-number" style={{ fontSize: 22, color: 'var(--text)' }}>
                {activePie !== null
                  ? stats.condition_distribution[activePie].count
                  : stats.condition_distribution.reduce((s: number, c: any) => s + c.count, 0)}
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

        {/* Live Feed */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600 }}>LIVE FEED</span>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: isConnected ? 'var(--green)' : 'var(--red)', animation: isConnected ? 'pulse-dot 2s infinite' : 'none' }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 220 }}>
            <AnimatePresence initial={false}>
              {events.slice(0, 8).map(event => (
                <motion.div key={event.id}
                  initial={{ opacity: 0, x: -12, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  exit={{ opacity: 0, x: 12, height: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ borderBottom: '1px solid var(--border)', padding: '10px 0', display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <span className="font-body" style={{ fontSize: 10, color: 'var(--dim)', minWidth: 40 }}>
                    {format(new Date(event.timestamp), 'HH:mm')}
                  </span>
                  <div style={{ flex: 1 }}>
                    <span className="font-body" style={{ fontSize: 12, color: 'var(--text)', display: 'block' }}>{event.patient_code}</span>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>{event.condition}</span>
                  </div>
                  <AgentBadge agent={event.agent_type} />
                  <span className="font-number" style={{ fontSize: 12, color: event.confidence > 0.8 ? 'var(--green)' : 'var(--cyan)' }}>
                    {Math.round(event.confidence * 100)}%
                  </span>
                </motion.div>
              ))}
              {events.length === 0 && (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="font-body" style={{ color: 'var(--muted)', fontSize: 12 }}>Waiting for events...</span>
                </div>
              )}
            </AnimatePresence>
          </div>
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
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(Math.max(pct, 5), 100)}%` }} // ensure non-zero width for visibility
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      style={{ height: '100%', background: color, borderRadius: 2 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ROW 4: Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, overflowX: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600 }}>Recent Sessions</span>
          <span className="font-body" data-cursor="hover" style={{ fontSize: 12, color: 'var(--cyan)' }}>View All →</span>
        </div>

        {loadingSessions ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} height={40} />)}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 800 }}>
            <thead>
              <tr>
                {['PATIENT', 'AGENT', 'CONDITIONS', 'CONFIDENCE', 'URGENCY', 'TIME', 'ACTION'].map(h => (
                  <th key={h} className="font-body" style={{
                    fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', padding: '0 16px 12px',
                    textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 400, textTransform: 'uppercase'
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentSessions?.map((s: any) => {
                const conf = Math.round(s.confidence_score * 100);
                const confCol = conf > 80 ? 'var(--green)' : conf > 60 ? 'var(--cyan)' : 'var(--amber)';

                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 150ms' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="font-number" style={{ fontSize: 12, color: 'var(--cyan)', padding: '14px 16px' }}>{s.patient_code}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <AgentBadge agent={s.agent_type} />
                    </td>
                    <td style={{ padding: '14px 16px', display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {(s.conditions_detected || []).slice(0, 2).map((c: string) => (
                        <span key={c} className="font-body" style={{ fontSize: 11, padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }}>{c}</span>
                      ))}
                      {(s.conditions_detected || []).length > 2 && <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>+{(s.conditions_detected || []).length - 2}</span>}
                    </td>
                    <td className="font-number" style={{ fontSize: 13, padding: '14px 16px', color: confCol }}>{conf}%</td>
                    <td style={{ padding: '14px 16px' }}>
                      <UrgencyBadge urgency={s.urgency_level} />
                    </td>
                    <td className="font-body" style={{ fontSize: 11, color: 'var(--muted)', padding: '14px 16px' }}>
                      {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <button
                        data-cursor="hover"
                        onClick={() => navigate(`/sessions/${s.id}`)}
                        className="font-body"
                        style={{ fontSize: 12, color: 'var(--cyan)', background: 'transparent', border: 'none', padding: 0 }}
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  );
};

export default Dashboard;
