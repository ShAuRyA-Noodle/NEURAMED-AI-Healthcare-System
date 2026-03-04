import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, UserPlus, FileText, CheckCircle, Clock, XCircle, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { useAppointments, useCreateAppointment, useUpdateAppointmentStatus } from '@/hooks/useAppointments';
import { useToast } from '@/hooks/useToast';
import { AppointmentStatus } from '@/types';
import { SkeletonCard } from '@/components/shared/SkeletonCard';

const statusColor = (s: AppointmentStatus) => s === 'completed' ? 'var(--green)' : s === 'cancelled' ? 'var(--red)' : 'var(--cyan)';
const statusBg = (s: AppointmentStatus) => s === 'completed' ? 'rgba(0,255,157,0.1)' : s === 'cancelled' ? 'rgba(255,59,92,0.1)' : 'rgba(0,229,255,0.1)';

const StatCard = ({ label, value, icon: Icon }: any) => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={20} style={{ color: 'var(--muted)' }} />
        </div>
        <div style={{ flex: 1 }}>
            <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block' }}>{label}</span>
            <span className="font-number" style={{ fontSize: 24, color: 'var(--text)' }}>{value}</span>
        </div>
    </div>
);

const Appointments = () => {
    const [filter, setFilter] = useState<AppointmentStatus | 'all'>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { addToast } = useToast();

    const { data: appts, isLoading } = useAppointments();
    const { mutateAsync: createAppt, isPending: isCreating } = useCreateAppointment();
    const { mutateAsync: updateStatus } = useUpdateAppointmentStatus();

    const filteredAppts = appts?.filter(a => filter === 'all' || a.status === filter) || [];

    const [formData, setFormData] = useState({ patient_id: '', doctor_name: '', specialty: 'General', appointment_date: '', reason: '' });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.patient_id || !formData.appointment_date || !formData.doctor_name) return;

        try {
            await createAppt({
                patient_id: parseInt(formData.patient_id, 10),
                doctor_name: formData.doctor_name,
                specialty: formData.specialty,
                appointment_datetime: new Date(formData.appointment_date).toISOString(),
                reason: formData.reason,
                status: 'scheduled'
            });
            setIsModalOpen(false);
            setFormData({ patient_id: '', doctor_name: '', specialty: 'General', appointment_date: '', reason: '' });
            addToast('success', 'Appointment scheduled successfully');
        } catch {
            addToast('error', 'Failed to schedule appointment');
        }
    };

    const totals = {
        total: appts?.length || 0,
        scheduled: appts?.filter(a => a.status === 'scheduled').length || 0,
        completed: appts?.filter(a => a.status === 'completed').length || 0,
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Top Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <StatCard label="TOTAL APPOINTMENTS" value={totals.total} icon={Calendar} />
                <StatCard label="UPCOMING / SCHEDULED" value={totals.scheduled} icon={Clock} />
                <StatCard label="COMPLETED" value={totals.completed} icon={CheckCircle} />
                <StatCard label="NEW PATIENTS" value={14} icon={UserPlus} />
            </div>

            {/* Filters and Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    {['all', 'scheduled', 'completed', 'cancelled'].map((f) => (
                        <button key={f} data-cursor="hover" onClick={() => setFilter(f as any)} style={{
                            height: 32, padding: '0 16px', borderRadius: 16, fontFamily: 'var(--font-body)', fontSize: 12, textTransform: 'capitalize',
                            border: `1px solid ${filter === f ? (f === 'all' ? 'var(--text)' : statusColor(f as any)) : 'var(--border)'}`,
                            background: filter === f ? (f === 'all' ? 'rgba(255,255,255,0.05)' : statusBg(f as any)) : 'transparent',
                            color: filter === f ? (f === 'all' ? 'var(--text)' : statusColor(f as any)) : 'var(--muted)',
                            transition: 'all 200ms'
                        }}>
                            {f}
                        </button>
                    ))}
                </div>

                <button data-cursor="hover" onClick={() => setIsModalOpen(true)} style={{
                    height: 36, padding: '0 16px', borderRadius: 8, background: 'var(--cyan)', color: '#000', border: 'none',
                    fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
                }}>
                    <Plus size={16} strokeWidth={2.5} /> New Appointment
                </button>
            </div>

            {/* Table List View */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, overflowX: 'auto' }}>
                {isLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} height={40} />)}
                    </div>
                ) : filteredAppts.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <FileText size={32} style={{ color: 'var(--dim)' }} />
                        <span className="font-body" style={{ color: 'var(--muted)', fontSize: 14 }}>No appointments found.</span>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 800 }}>
                        <thead>
                            <tr>
                                {['PATIENT ID', 'DOCTOR', 'SPECIALTY', 'DATE & TIME', 'REASON', 'STATUS', 'ACTIONS'].map(h => (
                                    <th key={h} className="font-body" style={{
                                        fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', padding: '0 16px 12px',
                                        textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 400
                                    }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAppts.map((a: any) => (
                                <tr key={a.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 150ms' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    <td className="font-number" style={{ fontSize: 13, color: 'var(--cyan)', padding: '14px 16px' }}>{a.patient_code || `PT-${(a.patient_id || 0).toString().padStart(4, '0')}`}</td>
                                    <td className="font-body" style={{ fontSize: 13, color: 'var(--text)', padding: '14px 16px' }}>Dr. {a.doctor_name}</td>
                                    <td className="font-body" style={{ fontSize: 12, color: 'var(--muted)', padding: '14px 16px' }}>{a.specialty}</td>
                                    <td className="font-body" style={{ fontSize: 12, color: 'var(--text)', padding: '14px 16px' }}>
                                        {a.appointment_datetime ? format(new Date(a.appointment_datetime), 'MMM d, yyyy - HH:mm') : 'No Date Set'}
                                    </td>
                                    <td className="font-body" style={{ fontSize: 12, color: 'var(--muted)', padding: '14px 16px', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.reason}</td>
                                    <td style={{ padding: '14px 16px' }}>
                                        <span className="font-body" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: statusBg(a.status), color: statusColor(a.status), border: `1px solid ${statusColor(a.status)}40`, textTransform: 'capitalize' }}>
                                            {a.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 16px', display: 'flex', gap: 12 }}>
                                        {a.status === 'scheduled' && (
                                            <>
                                                <button data-cursor="hover" onClick={() => updateStatus({ id: a.id, status: 'completed' })} style={{ background: 'transparent', border: 'none', color: 'var(--green)', padding: 0 }} title="Mark Completed"><CheckCircle size={16} /></button>
                                                <button data-cursor="hover" onClick={() => updateStatus({ id: a.id, status: 'cancelled' })} style={{ background: 'transparent', border: 'none', color: 'var(--red)', padding: 0 }} title="Cancel"><XCircle size={16} /></button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, width: '100%', maxWidth: 480, position: 'relative' }}>

                            <button data-cursor="hover" onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', color: 'var(--muted)' }}>
                                <X size={20} />
                            </button>

                            <span className="font-heading" style={{ fontSize: 20, color: 'var(--text)', display: 'block', marginBottom: 24 }}>New Appointment</span>

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>PATIENT ID</label>
                                    <input required type="number" value={formData.patient_id} onChange={e => setFormData({ ...formData, patient_id: e.target.value })}
                                        style={{ width: '100%', height: 40, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 14px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none' }} />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div>
                                        <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>DOCTOR NAME</label>
                                        <input required value={formData.doctor_name} onChange={e => setFormData({ ...formData, doctor_name: e.target.value })}
                                            style={{ width: '100%', height: 40, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 14px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>SPECIALTY</label>
                                        <input required value={formData.specialty} onChange={e => setFormData({ ...formData, specialty: e.target.value })}
                                            style={{ width: '100%', height: 40, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 14px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none' }} />
                                    </div>
                                </div>

                                <div>
                                    <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>DATE & TIME</label>
                                    <input required type="datetime-local" value={formData.appointment_date} onChange={e => setFormData({ ...formData, appointment_date: e.target.value })}
                                        style={{ width: '100%', height: 40, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 14px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', colorScheme: 'dark' }} />
                                </div>

                                <div>
                                    <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>REASON FOR VISIT</label>
                                    <textarea required value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                        style={{ width: '100%', height: 80, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', resize: 'none' }} />
                                </div>

                                <button type="submit" disabled={isCreating} data-cursor="hover" style={{
                                    marginTop: 8, width: '100%', height: 44, background: 'var(--cyan)', color: '#000', border: 'none',
                                    borderRadius: 8, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, opacity: isCreating ? 0.5 : 1
                                }}>
                                    {isCreating ? 'Scheduling...' : 'Schedule Appointment'}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Appointments;
