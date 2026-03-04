import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AgentBadge } from '@/components/shared/AgentBadge';
import { UrgencyBadge } from '@/components/shared/UrgencyBadge';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import api from '@/api/client';

const PAGE_SIZE = 20;

const Sessions = () => {
    const navigate = useNavigate();
    const [agentFilter, setAgentFilter] = useState<string>('');
    const [urgencyFilter, setUrgencyFilter] = useState<string>('');
    const [page, setPage] = useState(0);

    const { data, isLoading } = useQuery({
        queryKey: ['sessions-list', agentFilter, urgencyFilter, page],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (agentFilter) params.set('agent_type', agentFilter);
            if (urgencyFilter) params.set('urgency', urgencyFilter);
            params.set('limit', String(PAGE_SIZE));
            params.set('offset', String(page * PAGE_SIZE));
            const res = await api.get(`/api/sessions?${params.toString()}`);
            return res.data as { total: number; sessions: any[] };
        },
    });

    const sessions = data?.sessions || [];
    const total = data?.total || 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Activity size={24} style={{ color: 'var(--cyan)' }} />
                        <div>
                            <span className="font-heading" style={{ fontSize: 22, color: 'var(--text)', display: 'block' }}>Diagnosis Sessions</span>
                            <span className="font-body" style={{ fontSize: 13, color: 'var(--muted)' }}>{total} total sessions</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Filters */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
                style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Filter size={14} style={{ color: 'var(--muted)' }} />
                {/* Agent filter */}
                <select
                    value={agentFilter}
                    onChange={e => { setAgentFilter(e.target.value); setPage(0); }}
                    style={{
                        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                        padding: '8px 12px', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 13
                    }}
                >
                    <option value="">All Agents</option>
                    <option value="voice">Voice</option>
                    <option value="imaging">Imaging</option>
                    <option value="ocr">OCR</option>
                </select>
                {/* Urgency filter */}
                <select
                    value={urgencyFilter}
                    onChange={e => { setUrgencyFilter(e.target.value); setPage(0); }}
                    style={{
                        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                        padding: '8px 12px', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 13
                    }}
                >
                    <option value="">All Urgency</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                </select>
            </motion.div>

            {/* Table */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.2 }}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, overflowX: 'auto' }}>
                {isLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} height={44} />)}
                    </div>
                ) : sessions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
                        No sessions found.
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 800 }}>
                        <thead>
                            <tr>
                                {['ID', 'PATIENT', 'AGENT', 'CONDITIONS', 'CONFIDENCE', 'URGENCY', 'TIME'].map(h => (
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
                            <AnimatePresence>
                                {sessions.map((s: any) => {
                                    const conf = Math.round((s.confidence_score || 0) * 100);
                                    const confCol = conf > 80 ? 'var(--green)' : conf > 60 ? 'var(--cyan)' : 'var(--amber)';

                                    return (
                                        <motion.tr key={s.id}
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 150ms' }}
                                            onClick={() => navigate(`/sessions/${s.id}`)}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <td className="font-number" style={{ fontSize: 12, color: 'var(--dim)', padding: '14px 16px' }}>#{s.id}</td>
                                            <td className="font-number" style={{ fontSize: 12, color: 'var(--cyan)', padding: '14px 16px' }}>{s.patient_code}</td>
                                            <td style={{ padding: '14px 16px' }}><AgentBadge agent={s.agent_type} /></td>
                                            <td style={{ padding: '14px 16px' }}>
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                    {(s.conditions_detected || []).slice(0, 2).map((c: string) => (
                                                        <span key={c} className="font-body" style={{ fontSize: 11, padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }}>{c}</span>
                                                    ))}
                                                    {(s.conditions_detected || []).length > 2 && <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>+{(s.conditions_detected || []).length - 2}</span>}
                                                </div>
                                            </td>
                                            <td className="font-number" style={{ fontSize: 13, padding: '14px 16px', color: confCol }}>{conf}%</td>
                                            <td style={{ padding: '14px 16px' }}><UrgencyBadge urgency={s.urgency_level} /></td>
                                            <td className="font-body" style={{ fontSize: 11, color: 'var(--muted)', padding: '14px 16px' }}>
                                                {s.created_at ? formatDistanceToNow(new Date(s.created_at), { addSuffix: true }) : '—'}
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </AnimatePresence>
                        </tbody>
                    </table>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 }}>
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(p => p - 1)}
                            style={{
                                background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 6,
                                padding: '6px 12px', color: page === 0 ? 'var(--dim)' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 4
                            }}
                        >
                            <ChevronLeft size={14} /> Prev
                        </button>
                        <span className="font-number" style={{ fontSize: 13, color: 'var(--muted)' }}>
                            {page + 1} / {totalPages}
                        </span>
                        <button
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage(p => p + 1)}
                            style={{
                                background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 6,
                                padding: '6px 12px', color: page >= totalPages - 1 ? 'var(--dim)' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 4
                            }}
                        >
                            Next <ChevronRight size={14} />
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default Sessions;
