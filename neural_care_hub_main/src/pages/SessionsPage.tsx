import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Filter, ChevronLeft, ChevronRight, Search, Trash2, Download, BarChart3, Clock, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AgentBadge } from '@/components/shared/AgentBadge';
import { UrgencyBadge } from '@/components/shared/UrgencyBadge';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { useToast } from '@/hooks/useToast';
import api from '@/api/client';

const PAGE_SIZE = 20;

const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color?: string }) => (
  <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={18} style={{ color: color || 'var(--muted)' }} />
    </div>
    <div>
      <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block' }}>{label}</span>
      <span className="font-number" style={{ fontSize: 20, color: 'var(--text)' }}>{value}</span>
    </div>
  </div>
);

const Sessions = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: stats } = useQuery({
    queryKey: ['session-stats'],
    queryFn: () => api.get('/api/sessions/stats').then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['sessions-list', agentFilter, urgencyFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (agentFilter) params.set('agent_type', agentFilter);
      if (urgencyFilter) params.set('urgency', urgencyFilter);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));
      return api.get(`/api/sessions?${params.toString()}`).then(r => r.data as { total: number; sessions: any[] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions-list'] });
      queryClient.invalidateQueries({ queryKey: ['session-stats'] });
      addToast('success', 'Session deleted');
    },
    onError: () => addToast('error', 'Failed to delete session'),
  });

  const sessions = data?.sessions || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const filteredSessions = searchQuery
    ? sessions.filter((s: any) => {
      const q = searchQuery.toLowerCase();
      return s.patient_code?.toLowerCase().includes(q) || (s.conditions_detected || []).some((c: string) => c.toLowerCase().includes(q));
    })
    : sessions;

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredSessions.length) setSelected(new Set());
    else setSelected(new Set(filteredSessions.map((s: any) => s.id)));
  };

  const handleBulkDelete = () => {
    if (!confirm(`Delete ${selected.size} sessions?`)) return;
    selected.forEach(id => deleteMutation.mutate(id));
    setSelected(new Set());
  };

  const handleExportPdf = async (sessionId: number) => {
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const token = localStorage.getItem('neuramed_token');
    const response = await fetch(`${base}/api/sessions/${sessionId}/export-pdf`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
    if (!response.ok) { addToast('error', 'Export failed'); return; }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `neuramed-report-${sessionId}.pdf`; a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'PDF downloaded');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🔬</div>
        <div>
          <h1 className="font-heading" style={{ fontSize: 24, color: 'var(--text)', margin: 0 }}>Diagnosis Sessions</h1>
          <p className="font-body" style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{total} total sessions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-auto" style={{ gap: 12 }}>
        <StatCard label="TOTAL" value={stats?.total ?? total} icon={Activity} />
        <StatCard label="TODAY" value={stats?.today ?? 0} icon={Clock} color="var(--cyan)" />
        <StatCard label="THIS WEEK" value={stats?.this_week ?? 0} icon={BarChart3} color="var(--green)" />
        <StatCard label="AVG CONFIDENCE" value={stats ? `${Math.round((stats.avg_confidence ?? 0) * 100)}%` : '—'} icon={Activity} color="var(--cyan)" />
        <StatCard label="CRITICAL" value={stats?.by_urgency?.critical ?? 0} icon={AlertTriangle} color="var(--red)" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search sessions..."
            style={{ width: 220, height: 36, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px 0 32px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none' }} />
        </div>
        <Filter size={14} style={{ color: 'var(--muted)' }} />
        <select value={agentFilter} onChange={e => { setAgentFilter(e.target.value); setPage(0); }}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
          <option value="">All Agents</option>
          <option value="voice">Voice</option>
          <option value="imaging">Imaging</option>
          <option value="ocr">OCR</option>
        </select>
        <select value={urgencyFilter} onChange={e => { setUrgencyFilter(e.target.value); setPage(0); }}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
          <option value="">All Urgency</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        {selected.size > 0 && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <span className="font-body" style={{ fontSize: 12, color: 'var(--cyan)', alignSelf: 'center' }}>{selected.size} selected</span>
            <button data-cursor="hover" onClick={handleBulkDelete} style={{
              height: 32, padding: '0 12px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5', fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
            }}><Trash2 size={14} /> Delete</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, overflowX: 'auto' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} height={44} />)}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>No sessions found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ padding: '0 8px 12px', borderBottom: '1px solid var(--border)' }}>
                  <input type="checkbox" checked={selected.size === filteredSessions.length && filteredSessions.length > 0} onChange={toggleSelectAll} style={{ accentColor: 'var(--cyan)' }} />
                </th>
                {['ID', 'PATIENT', 'AGENT', 'CONDITIONS', 'CONFIDENCE', 'URGENCY', 'TIME', 'ACTIONS'].map(h => (
                  <th key={h} className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', padding: '0 12px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filteredSessions.map((s: any) => {
                  const conf = Math.round((s.confidence_score || 0) * 100);
                  const confCol = conf > 80 ? 'var(--green)' : conf > 60 ? 'var(--cyan)' : 'var(--amber)';
                  return (
                    <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ borderBottom: '1px solid var(--border)', transition: 'background 150ms' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 8px' }}>
                        <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} onClick={e => e.stopPropagation()} style={{ accentColor: 'var(--cyan)' }} />
                      </td>
                      <td className="font-number" style={{ fontSize: 12, color: 'var(--dim)', padding: '12px', cursor: 'pointer' }} onClick={() => navigate(`/sessions/${s.id}`)}>#{s.id}</td>
                      <td className="font-number" style={{ fontSize: 12, color: 'var(--cyan)', padding: '12px', cursor: 'pointer' }} onClick={() => navigate(`/sessions/${s.id}`)}>{s.patient_code}</td>
                      <td style={{ padding: '12px' }}><AgentBadge agent={s.agent_type} /></td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(s.conditions_detected || []).slice(0, 2).map((c: string) => (
                            <span key={c} className="font-body" style={{ fontSize: 11, padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }}>{c}</span>
                          ))}
                          {(s.conditions_detected || []).length > 2 && <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>+{s.conditions_detected.length - 2}</span>}
                        </div>
                      </td>
                      <td className="font-number" style={{ fontSize: 13, padding: '12px', color: confCol }}>{conf}%</td>
                      <td style={{ padding: '12px' }}><UrgencyBadge urgency={s.urgency_level} /></td>
                      <td className="font-body" style={{ fontSize: 11, color: 'var(--muted)', padding: '12px' }}>
                        {s.created_at ? formatDistanceToNow(new Date(s.created_at), { addSuffix: true }) : '—'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button data-cursor="hover" onClick={e => { e.stopPropagation(); handleExportPdf(s.id); }} style={{ background: 'transparent', border: 'none', color: 'var(--cyan)', padding: 0, cursor: 'pointer' }} title="Export PDF"><Download size={14} /></button>
                          <button data-cursor="hover" onClick={e => { e.stopPropagation(); if (confirm('Delete this session?')) deleteMutation.mutate(s.id); }} style={{ background: 'transparent', border: 'none', color: 'var(--red)', padding: 0, cursor: 'pointer' }} title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 }}>
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', color: page === 0 ? 'var(--dim)' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 4, cursor: page === 0 ? 'default' : 'pointer' }}>
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="font-number" style={{ fontSize: 13, color: 'var(--muted)' }}>{page + 1} / {totalPages}</span>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
              style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', color: page >= totalPages - 1 ? 'var(--dim)' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 4, cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sessions;
