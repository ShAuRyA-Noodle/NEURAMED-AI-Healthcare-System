import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, Activity,
  Clock, Heart, Stethoscope, ChevronDown, ChevronUp, Minus,
  Mic, Brain, FileText, FlaskConical, type LucideIcon,
} from 'lucide-react';
import { getPatientTimeline } from '@/api/timeline';
import type { TimelineEntry, TrendAnalysis } from '@/types';

// ─── COLORS — coral palette aligned ───
const urgencyColor = (u: string) => {
  const l = u?.toLowerCase();
  return l === 'critical' ? '#DC4D4D' : l === 'high' ? '#E89B3F' : l === 'medium' ? '#FF6B5B' : '#6B6B70';
};

const trajectoryColor = (t: string) => {
  const l = t?.toLowerCase();
  return l === 'improving' ? '#3FA86C' : l === 'worsening' ? '#DC4D4D' : l === 'stable' ? '#FF6B5B' : '#6B6B70';
};

const agentIconComponent = (type: string): LucideIcon => {
  const l = type?.toLowerCase();
  if (l === 'voice') return Mic;
  if (l === 'imaging') return Brain;
  if (l === 'ocr') return FileText;
  return FlaskConical;
};

const agentIcon = (type: string) => {
  const Icon = agentIconComponent(type);
  return <Icon size={14} strokeWidth={1.75} style={{ display: 'inline-block', verticalAlign: '-2px' }} />;
};

// ─── MINI SPARKLINE SVG ───
const Sparkline = ({ data, color, height = 40 }: { data: { date: string; score: number }[]; color: string; height?: number }) => {
  if (!data || data.length < 2) return null;
  const w = 200;
  const maxY = 100;
  const minY = 0;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((d.score - minY) / (maxY - minY)) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${w},${height}`}
        fill="url(#spark-fill)"
      />
      <polyline
        points={points}
        fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
      />
      {data.length > 0 && (() => {
        const last = data[data.length - 1];
        const cx = w;
        const cy = height - ((last.score - minY) / (maxY - minY)) * height;
        return <circle cx={cx} cy={cy} r="3" fill={color} />;
      })()}
    </svg>
  );
};

// ─── HEALTH SCORE CHART (larger) ───
const HealthScoreChart = ({ data }: { data: { date: string; score: number }[] }) => {
  if (!data || data.length === 0) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#445566', fontFamily: '"DM Mono", monospace', fontSize: 12 }}>
      No health score data available
    </div>
  );

  const w = 600;
  const h = 180;
  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const points = data.map((d, i) => {
    const x = pad.left + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = pad.top + (1 - d.score / 100) * chartH;
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = `${pathD} L${points[points.length - 1].x},${pad.top + chartH} L${points[0].x},${pad.top + chartH} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map(v => {
        const y = pad.top + (1 - v / 100) * chartH;
        return (
          <g key={v}>
            <line x1={pad.left} y1={y} x2={w - pad.right} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={pad.left - 8} y={y + 3} textAnchor="end" fill="#445566" fontSize="9" fontFamily='"DM Mono", monospace'>{v}</text>
          </g>
        );
      })}
      {/* Area + Line */}
      <path d={areaD} fill="url(#chart-fill)" />
      <path d={pathD} fill="none" stroke="#00E5FF" strokeWidth="2" strokeLinejoin="round" />
      {/* Points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#0B1015" stroke="#00E5FF" strokeWidth="1.5" />
          {data.length <= 12 && (
            <text x={p.x} y={h - 6} textAnchor="middle" fill="#445566" fontSize="8" fontFamily='"DM Mono", monospace'>
              {new Date(p.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

// ─── TREND SECTION ───
const TrendSection = ({ trend }: { trend: TrendAnalysis }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Trajectory banner */}
      <div style={{
        padding: '16px 20px', borderRadius: 12,
        background: `${trajectoryColor(trend.overall_trajectory)}08`,
        border: `1px solid ${trajectoryColor(trend.overall_trajectory)}25`,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        {trend.overall_trajectory === 'improving' ? <TrendingUp size={24} color="#00FF9D" /> :
          trend.overall_trajectory === 'worsening' ? <TrendingDown size={24} color="#FF3B5C" /> :
            <Minus size={24} color="#00E5FF" />}
        <div style={{ flex: 1 }}>
          <span style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16,
            color: trajectoryColor(trend.overall_trajectory), textTransform: 'uppercase',
          }}>{trend.overall_trajectory}</span>
          <p style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: '#778899', marginTop: 4 }}>
            {trend.trajectory_summary}
          </p>
        </div>
        <div style={{
          fontFamily: 'Orbitron, sans-serif', fontSize: 20, fontWeight: 700,
          color: trajectoryColor(trend.overall_trajectory),
        }}>{Math.round(trend.trajectory_confidence * 100)}%</div>
      </div>

      {/* Condition groups */}
      {[
        { key: 'improving', label: 'Improving Conditions', items: trend.improving_conditions, icon: TrendingUp, color: '#00FF9D' },
        { key: 'worsening', label: 'Worsening Conditions', items: trend.worsening_conditions, icon: TrendingDown, color: '#FF3B5C' },
        { key: 'new', label: 'New Conditions', items: trend.new_conditions, icon: AlertTriangle, color: '#FF9500' },
        { key: 'recurring', label: 'Recurring Conditions', items: trend.recurring_conditions, icon: Activity, color: '#00E5FF' },
      ].map(group => {
        if (!group.items || group.items.length === 0) return null;
        const isOpen = expanded === group.key;
        const Icon = group.icon;
        return (
          <div key={group.key} style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12, overflow: 'hidden',
          }}>
            <button onClick={() => setExpanded(isOpen ? null : group.key)} style={{
              width: '100%', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              background: 'transparent', border: 'none', color: '#EEF2F7',
            }}>
              <Icon size={16} color={group.color} />
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, flex: 1, textAlign: 'left' }}>{group.label}</span>
              <span style={{
                fontFamily: '"DM Mono", monospace', fontSize: 11, color: group.color,
                background: `${group.color}15`, padding: '2px 8px', borderRadius: 8,
              }}>{group.items.length}</span>
              {isOpen ? <ChevronUp size={14} color="#445566" /> : <ChevronDown size={14} color="#445566" />}
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {group.items.map((item: any, i: number) => (
                      <div key={i} style={{
                        padding: '10px 14px', borderRadius: 8,
                        background: `${group.color}06`, borderLeft: `3px solid ${group.color}`,
                      }}>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: '#EEF2F7' }}>
                          {item.condition}
                        </div>
                        {item.evidence && (
                          <p style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: '#778899', marginTop: 4 }}>{item.evidence}</p>
                        )}
                        {item.timeline && (
                          <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: group.color, marginTop: 4, display: 'inline-block' }}>{item.timeline}</span>
                        )}
                        {item.pattern && (
                          <p style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: '#778899', marginTop: 4 }}>Pattern: {item.pattern}</p>
                        )}
                        {item.occurrences && (
                          <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: '#445566', marginTop: 2, display: 'inline-block' }}>{item.occurrences} occurrences</span>
                        )}
                        {item.current_status && (
                          <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: group.color, marginTop: 2, display: 'inline-block', marginLeft: 8 }}>Status: {item.current_status}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Specialist referrals */}
      {trend.specialist_referral_recommended && trend.specialist_referral_recommended.length > 0 && (
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: 'rgba(255,149,0,0.06)', border: '1px solid rgba(255,149,0,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Stethoscope size={16} color="#FF9500" />
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: '#FF9500' }}>Specialist Referrals Recommended</span>
          </div>
          {trend.specialist_referral_recommended.map((ref: any, i: number) => (
            <div key={i} style={{
              padding: '8px 12px', borderRadius: 8, background: 'rgba(255,149,0,0.04)',
              marginBottom: 6, fontFamily: '"DM Mono", monospace', fontSize: 12, color: '#EEF2F7',
            }}>
              <strong>{ref.specialty || ref}</strong>
              {ref.reason && <span style={{ color: '#778899' }}> — {ref.reason}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// TIMELINE PAGE
// ════════════════════════════════════════════════════════════════
const TimelinePage = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'timeline' | 'trends'>('timeline');
  const [filterAgent, setFilterAgent] = useState<string>('all');

  const pid = parseInt(patientId || '0');

  const { data, isLoading, error } = useQuery({
    queryKey: ['patient-timeline', pid],
    queryFn: () => getPatientTimeline(pid),
    enabled: pid > 0,
  });

  const filteredTimeline = useMemo(() => {
    if (!data?.timeline) return [];
    if (filterAgent === 'all') return data.timeline;
    return data.timeline.filter(e => e.agent_type === filterAgent);
  }, [data?.timeline, filterAgent]);

  const agentTypes = useMemo(() => {
    if (!data?.timeline) return [];
    return [...new Set(data.timeline.map(e => e.agent_type))];
  }, [data?.timeline]);

  if (!pid) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ fontFamily: '"DM Mono", monospace', fontSize: 14, color: '#445566' }}>No patient selected</p>
        <button onClick={() => navigate('/patients')} style={{
          marginTop: 16, padding: '10px 24px', borderRadius: 10, cursor: 'pointer',
          background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.3)',
          fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: '#00E5FF',
        }}>Go to Patients</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{
          width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#778899',
        }}><ArrowLeft size={16} /></button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: '#EEF2F7', margin: 0 }}>
            Patient Timeline
          </h1>
          {data && (
            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: '#445566' }}>
              {data.patient_code} — {data.total_sessions} sessions
              {data.date_range?.first && ` — ${new Date(data.date_range.first).toLocaleDateString()} to ${new Date(data.date_range.last || '').toLocaleDateString()}`}
            </span>
          )}
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              height: 80, borderRadius: 12, background: 'rgba(255,255,255,0.03)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      )}

      {error && (
        <div style={{
          padding: 20, borderRadius: 12, background: 'rgba(255,59,92,0.06)',
          border: '1px solid rgba(255,59,92,0.2)', textAlign: 'center',
          fontFamily: '"DM Mono", monospace', fontSize: 13, color: '#FF3B5C',
        }}>Failed to load timeline data</div>
      )}

      {data && (
        <>
          {/* Health Score Chart */}
          {data.health_score_series && data.health_score_series.length > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 14, padding: 20, marginBottom: 24,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Heart size={16} color="#00E5FF" />
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, color: '#EEF2F7' }}>Health Score Trend</span>
                <Sparkline data={data.health_score_series} color="#00E5FF" height={24} />
              </div>
              <HealthScoreChart data={data.health_score_series} />
            </div>
          )}

          {/* Tab Toggle */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
            {(['timeline', 'trends'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                padding: '8px 20px', borderRadius: 8, cursor: 'pointer', transition: 'all 200ms',
                fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13,
                color: activeTab === t ? '#020608' : '#445566',
                background: activeTab === t ? 'linear-gradient(135deg, #00E5FF, #00FF9D)' : 'rgba(255,255,255,0.04)',
                border: activeTab === t ? 'none' : '1px solid rgba(255,255,255,0.06)',
              }}>{t === 'timeline' ? 'Session Timeline' : 'Trend Analysis'}</button>
            ))}
          </div>

          {activeTab === 'timeline' && (
            <>
              {/* Agent filter pills */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                <button onClick={() => setFilterAgent('all')} style={{
                  padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 11,
                  fontFamily: '"DM Mono", monospace',
                  background: filterAgent === 'all' ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.03)',
                  border: filterAgent === 'all' ? '1px solid #00E5FF' : '1px solid rgba(255,255,255,0.06)',
                  color: filterAgent === 'all' ? '#00E5FF' : '#445566',
                }}>All</button>
                {agentTypes.map(t => (
                  <button key={t} onClick={() => setFilterAgent(t)} style={{
                    padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 11,
                    fontFamily: '"DM Mono", monospace',
                    background: filterAgent === t ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.03)',
                    border: filterAgent === t ? '1px solid #00E5FF' : '1px solid rgba(255,255,255,0.06)',
                    color: filterAgent === t ? '#00E5FF' : '#445566',
                  }}>{agentIcon(t)} {t}</button>
                ))}
              </div>

              {/* Timeline entries */}
              <div style={{ position: 'relative', paddingLeft: 28 }}>
                {/* Vertical timeline line */}
                <div style={{
                  position: 'absolute', left: 8, top: 0, bottom: 0, width: 2,
                  background: 'linear-gradient(180deg, rgba(0,229,255,0.3), rgba(0,229,255,0.05))',
                }} />

                {filteredTimeline.map((entry: TimelineEntry, i: number) => (
                  <motion.div key={entry.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    style={{ marginBottom: 16, position: 'relative' }}
                  >
                    {/* Timeline dot */}
                    <div style={{
                      position: 'absolute', left: -24, top: 18, width: 12, height: 12, borderRadius: '50%',
                      background: '#0B1015', border: `2px solid ${urgencyColor(entry.urgency)}`,
                      boxShadow: `0 0 8px ${urgencyColor(entry.urgency)}40`,
                    }} />

                    <div style={{
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 12, padding: '14px 18px', cursor: 'pointer',
                      transition: 'all 200ms',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,229,255,0.2)'; e.currentTarget.style.background = 'rgba(0,229,255,0.03)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                      onClick={() => navigate(`/sessions/${entry.id}`)}
                    >
                      {/* Header row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 16 }}>{agentIcon(entry.agent_type)}</span>
                        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: '#EEF2F7', flex: 1 }}>
                          {entry.agent_type.charAt(0).toUpperCase() + entry.agent_type.slice(1)} Session
                        </span>
                        <span style={{
                          fontFamily: '"DM Mono", monospace', fontSize: 10, padding: '2px 8px', borderRadius: 8,
                          background: `${urgencyColor(entry.urgency)}15`,
                          color: urgencyColor(entry.urgency),
                          border: `1px solid ${urgencyColor(entry.urgency)}30`,
                        }}>{entry.urgency}</span>
                        {entry.health_score !== null && entry.health_score !== undefined && (
                          <span style={{
                            fontFamily: 'Orbitron, sans-serif', fontSize: 12, fontWeight: 700,
                            color: entry.health_score > 70 ? '#00FF9D' : entry.health_score > 40 ? '#FF9500' : '#FF3B5C',
                          }}>{entry.health_score}</span>
                        )}
                      </div>

                      {/* Date */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Clock size={11} color="#445566" />
                        <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: '#445566' }}>
                          {new Date(entry.date).toLocaleDateString('en', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      {/* Summary */}
                      <p style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: '#778899', margin: 0, lineHeight: 1.6 }}>
                        {entry.summary}
                      </p>

                      {/* Conditions pills */}
                      {entry.primary_conditions && entry.primary_conditions.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {entry.primary_conditions.map((c, j) => (
                            <span key={j} style={{
                              fontFamily: '"DM Mono", monospace', fontSize: 10, padding: '2px 10px', borderRadius: 12,
                              background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.15)', color: '#00E5FF',
                            }}>{c}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {filteredTimeline.length === 0 && (
                  <div style={{
                    padding: 32, textAlign: 'center',
                    fontFamily: '"DM Mono", monospace', fontSize: 13, color: '#445566',
                  }}>No sessions found</div>
                )}
              </div>
            </>
          )}

          {activeTab === 'trends' && (
            <>
              {data.trend_analysis ? (
                <TrendSection trend={data.trend_analysis} />
              ) : (
                <div style={{
                  padding: 40, textAlign: 'center', borderRadius: 14,
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <Activity size={32} color="#445566" style={{ marginBottom: 12 }} />
                  <p style={{ fontFamily: '"DM Mono", monospace', fontSize: 13, color: '#445566' }}>
                    Not enough data for trend analysis. At least 2 sessions are needed.
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 0.8; } }
      `}</style>
    </div>
  );
};

export default TimelinePage;
