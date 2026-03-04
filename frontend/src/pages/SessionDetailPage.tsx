import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Activity, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { UrgencyBadge } from '@/components/shared/UrgencyBadge';
import { useToast } from '@/hooks/useToast';

const SessionDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.title = 'NEURAMED — Session Details';
        const fetchSession = async () => {
            try {
                const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
                const res = await fetch(`${base}/api/sessions/${id}`);
                if (!res.ok) throw new Error('Not found');
                const data = await res.json();
                setSession(data);
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
            const response = await fetch(`${base}/api/sessions/${id}/export-pdf`);
            if (!response.ok) throw new Error('Export failed');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `neuramed-report-${id}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            addToast('success', 'PDF downloaded successfully');
        } catch {
            addToast('error', 'Failed to generate PDF');
        }
    };

    if (loading) return <div style={{ padding: 40, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>Loading session...</div>;
    if (!session) return <div style={{ padding: 40, color: 'var(--red)', fontFamily: 'var(--font-body)' }}>Session not found.</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button data-cursor="hover" onClick={() => navigate(-1)} style={{
                        width: 40, height: 40, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)',
                        color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms'
                    }} onMouseEnter={e => e.currentTarget.style.background = 'var(--elevated)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <span className="font-heading" style={{ fontSize: 20, color: 'var(--text)', display: 'block' }}>Session Details</span>
                        <span className="font-body" style={{ fontSize: 13, color: 'var(--muted)' }}>#{id} · {format(new Date(session.created_at), 'MMM d, yyyy HH:mm')}</span>
                    </div>
                </div>

                <button data-cursor="hover" onClick={handleExportPdf} style={{
                    height: 40, padding: '0 16px', borderRadius: 8, background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.25)',
                    color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 700
                }}>
                    <Download size={16} /> Export PDF
                </button>
            </div>

            {/* Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>PATIENT</span>
                    <span className="font-number" style={{ fontSize: 20, color: 'var(--text)', display: 'block', marginTop: 8 }}>{session.patient_code}</span>
                </div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>AGENT TYPE</span>
                    <span className="font-body" style={{ fontSize: 20, color: 'var(--cyan)', display: 'block', marginTop: 8, textTransform: 'capitalize' }}>{session.agent_type} Analysis</span>
                </div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>CONFIDENCE</span>
                    <span className="font-number" style={{ fontSize: 20, color: 'var(--green)', display: 'block', marginTop: 8 }}>{Math.round((session.confidence_score || 0) * 100)}%</span>
                </div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: 8, display: 'block' }}>URGENCY</span>
                    <UrgencyBadge urgency={session.urgency_level || 'low'} />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Findings & Conditions */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                        <Activity size={18} style={{ color: 'var(--cyan)' }} />
                        <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)' }}>Conditions & Findings</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {session.conditions_detected?.map((c: string, i: number) => (
                            <div key={i} style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px' }}>
                                <span className="font-body" style={{ fontSize: 14, color: 'var(--text)' }}>{c}</span>
                            </div>
                        ))}
                        {(!session.conditions_detected || session.conditions_detected.length === 0) && (
                            <span className="font-body" style={{ fontSize: 13, color: 'var(--muted)' }}>No notable conditions recorded.</span>
                        )}
                    </div>
                </div>

                {/* Recommendations */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                        <FileText size={18} style={{ color: 'var(--green)' }} />
                        <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)' }}>Recommendations</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {session.recommendations?.map((r: string, i: number) => (
                            <div key={i} style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px' }}>
                                <span className="font-body" style={{ fontSize: 14, color: 'var(--text)' }}>{r}</span>
                            </div>
                        ))}
                        {(!session.recommendations || session.recommendations.length === 0) && (
                            <span className="font-body" style={{ fontSize: 13, color: 'var(--muted)' }}>No distinct recommendations recorded.</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Raw Transcript / Findings */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 16 }}>RAW TEXT / TRANSCRIPT</span>
                <div style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 24 }}>
                    <pre className="font-body" style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 }}>
                        {session.transcript_or_findings || JSON.stringify(session.result_json, null, 2) || "No raw text available."}
                    </pre>
                </div>
            </div>

        </div>
    );
};

export default SessionDetail;
