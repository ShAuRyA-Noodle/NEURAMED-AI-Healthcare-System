import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, UserPlus, FileText, CheckCircle, Clock, XCircle, Plus, X, TrendingUp, Loader2, StickyNote } from 'lucide-react';
import { format } from 'date-fns';
import { useAppointments, useCreateAppointment, useUpdateAppointmentStatus, useAppointmentStats, useAddAppointmentNotes } from '@/hooks/useAppointments';
import { usePatients } from '@/hooks/usePatients';
import { useToast } from '@/hooks/useToast';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import type { AppointmentStatus } from '@/types';

const statusColor = (s: AppointmentStatus) => s === 'completed' ? 'var(--green)' : s === 'cancelled' ? 'var(--red)' : 'var(--cyan)';
const statusBg = (s: AppointmentStatus) => s === 'completed' ? 'rgba(0,255,157,0.1)' : s === 'cancelled' ? 'rgba(255,59,92,0.1)' : 'rgba(0,229,255,0.1)';

const SPECIALTIES = ['General', 'Cardiology', 'Pulmonology', 'Neurology', 'Orthopedics', 'Radiology', 'Dermatology', 'Oncology', 'Pediatrics', 'Psychiatry'];

const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color?: string }) => (
  <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={20} style={{ color: color || 'var(--muted)' }} />
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
  const [modalStep, setModalStep] = useState(1);
  const [notesId, setNotesId] = useState<number | null>(null);
  const [notesText, setNotesText] = useState('');
  const { addToast } = useToast();

  const [patientSearch, setPatientSearch] = useState('');

  const { data: appts, isLoading } = useAppointments();
  const { data: stats } = useAppointmentStats();
  const { data: allPatients } = usePatients();
  const { mutateAsync: createAppt, isPending: isCreating } = useCreateAppointment();
  const { mutateAsync: updateStatus } = useUpdateAppointmentStatus();
  const { mutateAsync: saveNotes, isPending: isSavingNotes } = useAddAppointmentNotes();

  // Filter patients for the create modal search
  const matchedPatients = (allPatients || []).filter((p: any) => {
    if (!patientSearch) return false;
    const s = patientSearch.toLowerCase();
    return (p.full_name || '').toLowerCase().includes(s) ||
      p.patient_code.toLowerCase().includes(s) ||
      (p.phone || '').includes(s);
  }).slice(0, 5);

  const filteredAppts = appts?.filter(a => filter === 'all' || a.status === filter) || [];

  // Group today's appointments
  const today = new Date().toDateString();
  const todayAppts = filteredAppts.filter(a => a.appointment_datetime && new Date(a.appointment_datetime).toDateString() === today);
  const otherAppts = filteredAppts.filter(a => !a.appointment_datetime || new Date(a.appointment_datetime).toDateString() !== today);

  const [formData, setFormData] = useState({
    patient_id: '', doctor_name: '', specialty: 'General', appointment_date: '', reason: '',
    appointment_type: 'initial', duration_minutes: '30', location: ''
  });

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
        status: 'scheduled',
        appointment_type: formData.appointment_type,
        duration_minutes: parseInt(formData.duration_minutes, 10) || 30,
        location: formData.location || undefined,
      } as any);
      setIsModalOpen(false);
      setModalStep(1);
      setFormData({ patient_id: '', doctor_name: '', specialty: 'General', appointment_date: '', reason: '', appointment_type: 'initial', duration_minutes: '30', location: '' });
      addToast('success', 'Appointment scheduled successfully');
    } catch {
      addToast('error', 'Failed to schedule appointment');
    }
  };

  const inputStyle = {
    width: '100%', height: 40, background: 'var(--elevated)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '0 14px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>📅</div>
          <div>
            <h1 className="font-heading" style={{ fontSize: 24, color: 'var(--text)', margin: 0 }}>Appointments</h1>
            <p className="font-body" style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Manage patient appointments and schedules</p>
          </div>
        </div>
        <button data-cursor="hover" onClick={() => setIsModalOpen(true)} style={{
          height: 40, padding: '0 20px', borderRadius: 8, background: 'var(--cyan)', color: '#000', border: 'none',
          fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'
        }}>
          <Plus size={16} strokeWidth={2.5} /> New Appointment
        </button>
      </div>

      {/* Stats from API */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard label="TOTAL" value={stats?.total ?? appts?.length ?? 0} icon={Calendar} />
        <StatCard label="SCHEDULED" value={stats?.scheduled ?? appts?.filter(a => a.status === 'scheduled').length ?? 0} icon={Clock} color="var(--cyan)" />
        <StatCard label="COMPLETED" value={stats?.completed ?? appts?.filter(a => a.status === 'completed').length ?? 0} icon={CheckCircle} color="var(--green)" />
        <StatCard label="COMPLETION RATE" value={stats ? `${Math.round(stats.completion_rate)}%` : '—'} icon={TrendingUp} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all', 'scheduled', 'completed', 'cancelled'].map((f) => (
            <button key={f} data-cursor="hover" onClick={() => setFilter(f as any)} style={{
              height: 32, padding: '0 16px', borderRadius: 16, fontFamily: 'var(--font-body)', fontSize: 12, textTransform: 'capitalize', cursor: 'pointer',
              border: `1px solid ${filter === f ? (f === 'all' ? 'var(--text)' : statusColor(f as any)) : 'var(--border)'}`,
              background: filter === f ? (f === 'all' ? 'rgba(255,255,255,0.05)' : statusBg(f as any)) : 'transparent',
              color: filter === f ? (f === 'all' ? 'var(--text)' : statusColor(f as any)) : 'var(--muted)', transition: 'all 200ms'
            }}>
              {f}
            </button>
          ))}
        </div>
        <span className="font-body" style={{ fontSize: 12, color: 'var(--muted)' }}>{filteredAppts.length} appointments</span>
      </div>

      {/* Today's section */}
      {todayAppts.length > 0 && (
        <div>
          <span className="font-heading" style={{ fontSize: 14, color: 'var(--cyan)', display: 'block', marginBottom: 12 }}>Today ({todayAppts.length})</span>
          <div style={{ background: 'rgba(0,229,255,0.03)', border: '1px solid rgba(0,229,255,0.1)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayAppts.map((a: any) => (
                <div key={a.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div>
                      <span className="font-body" style={{ fontSize: 13, color: 'var(--text)' }}>{a.patient_name || a.patient_code}</span>
                      {a.patient_name && <span className="font-number" style={{ fontSize: 10, color: 'var(--cyan)', marginLeft: 8 }}>{a.patient_code}</span>}
                    </div>
                    <span className="font-body" style={{ fontSize: 12, color: 'var(--text)' }}>Dr. {a.doctor_name}</span>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>{format(new Date(a.appointment_datetime), 'HH:mm')}</span>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--muted)' }}>{a.reason}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: statusBg(a.status), color: statusColor(a.status), border: `1px solid ${statusColor(a.status)}40`, fontFamily: 'var(--font-body)', textTransform: 'capitalize' }}>{a.status}</span>
                    {a.status === 'scheduled' && (
                      <>
                        <button data-cursor="hover" onClick={() => updateStatus({ id: a.id, status: 'completed' })} style={{ background: 'transparent', border: 'none', color: 'var(--green)', padding: 0, cursor: 'pointer' }} title="Complete"><CheckCircle size={16} /></button>
                        <button data-cursor="hover" onClick={() => updateStatus({ id: a.id, status: 'cancelled' })} style={{ background: 'transparent', border: 'none', color: 'var(--red)', padding: 0, cursor: 'pointer' }} title="Cancel"><XCircle size={16} /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, overflowX: 'auto' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} height={44} />)}
          </div>
        ) : otherAppts.length === 0 && todayAppts.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <FileText size={32} style={{ color: 'var(--dim)' }} />
            <span className="font-body" style={{ color: 'var(--muted)', fontSize: 14 }}>No appointments found.</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 900 }}>
            <thead>
              <tr>
                {['PATIENT', 'DOCTOR', 'SPECIALTY', 'DATE & TIME', 'TYPE', 'REASON', 'STATUS', 'ACTIONS'].map(h => (
                  <th key={h} className="font-body" style={{
                    fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', padding: '0 14px 12px',
                    textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 400
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {otherAppts.map((a: any) => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 150ms' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '14px' }}>
                    <span className="font-body" style={{ fontSize: 13, color: 'var(--text)', display: 'block' }}>{a.patient_name || a.patient_code}</span>
                    {a.patient_name && <span className="font-number" style={{ fontSize: 10, color: 'var(--cyan)' }}>{a.patient_code}</span>}
                  </td>
                  <td className="font-body" style={{ fontSize: 13, color: 'var(--text)', padding: '14px' }}>Dr. {a.doctor_name}</td>
                  <td className="font-body" style={{ fontSize: 12, color: 'var(--muted)', padding: '14px' }}>{a.specialty}</td>
                  <td className="font-body" style={{ fontSize: 12, color: 'var(--text)', padding: '14px' }}>
                    {a.appointment_datetime ? format(new Date(a.appointment_datetime), 'MMM d, yyyy - HH:mm') : '—'}
                  </td>
                  <td className="font-body" style={{ fontSize: 11, color: 'var(--muted)', padding: '14px', textTransform: 'capitalize' }}>{(a.appointment_type || 'initial').replace('_', ' ')}</td>
                  <td className="font-body" style={{ fontSize: 12, color: 'var(--muted)', padding: '14px', maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.reason}</td>
                  <td style={{ padding: '14px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: statusBg(a.status), color: statusColor(a.status), border: `1px solid ${statusColor(a.status)}40`, fontFamily: 'var(--font-body)', textTransform: 'capitalize' }}>{a.status}</span>
                  </td>
                  <td style={{ padding: '14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                    {a.status === 'scheduled' && (
                      <>
                        <button data-cursor="hover" onClick={() => updateStatus({ id: a.id, status: 'completed' })} style={{ background: 'transparent', border: 'none', color: 'var(--green)', padding: 0, cursor: 'pointer' }} title="Complete"><CheckCircle size={16} /></button>
                        <button data-cursor="hover" onClick={() => updateStatus({ id: a.id, status: 'cancelled' })} style={{ background: 'transparent', border: 'none', color: 'var(--red)', padding: 0, cursor: 'pointer' }} title="Cancel"><XCircle size={16} /></button>
                      </>
                    )}
                    <button data-cursor="hover" onClick={() => { setNotesId(a.id); setNotesText(a.notes || ''); }} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', padding: 0, cursor: 'pointer' }} title="Notes"><StickyNote size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal — 3 steps */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 32, width: '100%', maxWidth: 500, position: 'relative' }}>

              <button data-cursor="hover" onClick={() => { setIsModalOpen(false); setModalStep(1); }} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>

              {/* Step indicator */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {[1, 2, 3].map(s => (
                  <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= modalStep ? 'var(--cyan)' : 'var(--border)', transition: 'all 300ms' }} />
                ))}
              </div>

              <span className="font-heading" style={{ fontSize: 20, color: 'var(--text)', display: 'block', marginBottom: 20 }}>
                {modalStep === 1 ? 'Patient' : modalStep === 2 ? 'Appointment Details' : 'Confirm'}
              </span>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {modalStep === 1 && (
                  <>
                    <div style={{ position: 'relative' }}>
                      <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>SEARCH PATIENT</label>
                      <input
                        placeholder="Type name, code, or phone..."
                        value={patientSearch}
                        onChange={e => { setPatientSearch(e.target.value); setFormData({ ...formData, patient_id: '' }); }}
                        style={inputStyle}
                      />
                      {formData.patient_id && (
                        <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className="font-body" style={{ fontSize: 12, color: 'var(--cyan)' }}>
                            {(allPatients || []).find((p: any) => String(p.id) === formData.patient_id)?.full_name || ''}{' '}
                            <span style={{ color: 'var(--muted)', fontSize: 10 }}>{(allPatients || []).find((p: any) => String(p.id) === formData.patient_id)?.patient_code}</span>
                          </span>
                          <button type="button" onClick={() => { setFormData({ ...formData, patient_id: '' }); setPatientSearch(''); }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
                        </div>
                      )}
                      {!formData.patient_id && matchedPatients.length > 0 && (
                        <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 10, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 200, overflow: 'auto' }}>
                          {matchedPatients.map((p: any) => (
                            <div key={p.id} data-cursor="hover" onClick={() => { setFormData({ ...formData, patient_id: String(p.id) }); setPatientSearch(''); }}
                              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background 150ms' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                              <span className="font-body" style={{ fontSize: 13, color: 'var(--text)' }}>{p.full_name || p.patient_code}</span>
                              <span className="font-number" style={{ fontSize: 10, color: 'var(--cyan)', marginLeft: 8 }}>{p.patient_code}</span>
                              <span className="font-body" style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 8 }}>{p.phone || ''}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>REASON FOR VISIT</label>
                      <textarea required value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })}
                        style={{ ...inputStyle, height: 80, padding: '12px 14px', resize: 'none' as const }} />
                    </div>
                    <button type="button" onClick={() => setModalStep(2)} disabled={!formData.patient_id || !formData.reason}
                      style={{ marginTop: 8, width: '100%', height: 44, background: 'var(--cyan)', color: '#000', border: 'none', borderRadius: 8, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: (!formData.patient_id || !formData.reason) ? 0.5 : 1 }}>
                      Next →
                    </button>
                  </>
                )}

                {modalStep === 2 && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>DOCTOR NAME</label>
                        <input required value={formData.doctor_name} onChange={e => setFormData({ ...formData, doctor_name: e.target.value })} style={inputStyle} />
                      </div>
                      <div>
                        <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>SPECIALTY</label>
                        <select value={formData.specialty} onChange={e => setFormData({ ...formData, specialty: e.target.value })}
                          style={{ ...inputStyle, cursor: 'pointer' }}>
                          {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>DATE & TIME</label>
                      <input required type="datetime-local" value={formData.appointment_date} onChange={e => setFormData({ ...formData, appointment_date: e.target.value })}
                        style={{ ...inputStyle, colorScheme: 'dark' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                      <div>
                        <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>TYPE</label>
                        <select value={formData.appointment_type} onChange={e => setFormData({ ...formData, appointment_type: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                          <option value="initial">Initial Visit</option>
                          <option value="follow_up">Follow-up</option>
                          <option value="emergency">Emergency</option>
                          <option value="teleconsult">Teleconsult</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>DURATION (MIN)</label>
                        <input type="number" value={formData.duration_minutes} onChange={e => setFormData({ ...formData, duration_minutes: e.target.value })} style={inputStyle} />
                      </div>
                      <div>
                        <label className="font-body" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>LOCATION</label>
                        <input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="Room / Building" style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button type="button" onClick={() => setModalStep(1)} style={{ flex: 1, height: 44, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 14, cursor: 'pointer' }}>← Back</button>
                      <button type="button" onClick={() => setModalStep(3)} disabled={!formData.doctor_name || !formData.appointment_date}
                        style={{ flex: 1, height: 44, background: 'var(--cyan)', color: '#000', border: 'none', borderRadius: 8, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: (!formData.doctor_name || !formData.appointment_date) ? 0.5 : 1 }}>Next →</button>
                    </div>
                  </>
                )}

                {modalStep === 3 && (
                  <>
                    <div style={{ background: 'var(--elevated)', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="font-body" style={{ color: 'var(--muted)', fontSize: 12 }}>Patient</span>
                        <span className="font-body" style={{ color: 'var(--text)', fontSize: 13 }}>
                          {(allPatients || []).find((p: any) => String(p.id) === formData.patient_id)?.full_name || `Patient #${formData.patient_id}`}
                          <span className="font-number" style={{ color: 'var(--cyan)', fontSize: 10, marginLeft: 8 }}>
                            {(allPatients || []).find((p: any) => String(p.id) === formData.patient_id)?.patient_code || ''}
                          </span>
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="font-body" style={{ color: 'var(--muted)', fontSize: 12 }}>Doctor</span>
                        <span className="font-body" style={{ color: 'var(--text)', fontSize: 13 }}>Dr. {formData.doctor_name}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="font-body" style={{ color: 'var(--muted)', fontSize: 12 }}>Specialty</span>
                        <span className="font-body" style={{ color: 'var(--text)', fontSize: 13 }}>{formData.specialty}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="font-body" style={{ color: 'var(--muted)', fontSize: 12 }}>Date</span>
                        <span className="font-body" style={{ color: 'var(--text)', fontSize: 13 }}>{formData.appointment_date ? format(new Date(formData.appointment_date), 'MMM d, yyyy HH:mm') : '—'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="font-body" style={{ color: 'var(--muted)', fontSize: 12 }}>Reason</span>
                        <span className="font-body" style={{ color: 'var(--text)', fontSize: 13, maxWidth: 200, textAlign: 'right' }}>{formData.reason}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button type="button" onClick={() => setModalStep(2)} style={{ flex: 1, height: 44, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 14, cursor: 'pointer' }}>← Back</button>
                      <button type="submit" disabled={isCreating} style={{
                        flex: 1, height: 44, background: 'var(--cyan)', color: '#000', border: 'none', borderRadius: 8,
                        fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: isCreating ? 0.5 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                      }}>
                        {isCreating ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Scheduling...</> : 'Confirm & Schedule'}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes Modal */}
      <AnimatePresence>
        {notesId !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setNotesId(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, width: 400 }}>
              <span className="font-heading" style={{ fontSize: 16, color: 'var(--text)', display: 'block', marginBottom: 16 }}>Appointment Notes</span>
              <textarea value={notesText} onChange={e => setNotesText(e.target.value)} placeholder="Add clinical notes..."
                style={{ width: '100%', height: 120, background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', outline: 'none', resize: 'none' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => setNotesId(null)} style={{ flex: 1, height: 36, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button disabled={isSavingNotes} onClick={async () => {
                  try {
                    await saveNotes({ id: notesId!, notes: notesText });
                    addToast('success', 'Notes saved');
                    setNotesId(null);
                  } catch { addToast('error', 'Failed to save notes'); }
                }} style={{ flex: 1, height: 36, background: 'var(--cyan)', border: 'none', borderRadius: 8, color: '#000', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: isSavingNotes ? 0.5 : 1 }}>{isSavingNotes ? 'Saving...' : 'Save'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Appointments;
