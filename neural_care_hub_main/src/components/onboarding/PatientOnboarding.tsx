import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Kannada', 'Malayalam', 'Punjabi'];

const inputStyle: React.CSSProperties = {
  width: '100%', height: 44, background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  fontFamily: '"DM Mono", monospace', fontSize: 13, padding: '0 14px', color: '#EEF2F7',
  outline: 'none', transition: 'all 200ms', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontFamily: '"DM Mono", monospace', fontSize: 11, color: '#445566', marginBottom: 5, display: 'block',
};

const PatientOnboarding = ({ onComplete }: { onComplete: () => void }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    date_of_birth: '',
    blood_type: '',
    height_cm: '',
    weight_kg: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    existing_conditions: '',
    current_medications: '',
    known_allergies: '',
    previous_surgeries: '',
    language_preference: 'English',
  });

  const update = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = { onboarding_completed: true };
      if (form.date_of_birth) payload.date_of_birth = form.date_of_birth;
      if (form.blood_type) payload.blood_type = form.blood_type;
      if (form.height_cm) payload.height_cm = parseFloat(form.height_cm);
      if (form.weight_kg) payload.weight_kg = parseFloat(form.weight_kg);
      if (form.emergency_contact_name) payload.emergency_contact_name = form.emergency_contact_name;
      if (form.emergency_contact_phone) payload.emergency_contact_phone = form.emergency_contact_phone;
      if (form.existing_conditions) payload.existing_conditions = form.existing_conditions;
      if (form.current_medications) payload.current_medications = form.current_medications;
      if (form.known_allergies) payload.known_allergies = form.known_allergies;
      if (form.previous_surgeries) payload.previous_surgeries = form.previous_surgeries;
      if (form.language_preference) payload.language_preference = form.language_preference;

      await api.patch('/api/auth/profile', payload);
      onComplete();
    } catch {
      onComplete(); // don't block user if update fails
    }
  };

  const steps = [
    // Step 1: Basic Info
    () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 32 }}>👤</div>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: '#EEF2F7', margin: '8px 0 2px' }}>Basic Information</h3>
          <p style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: '#445566' }}>Help us personalize your experience</p>
        </div>

        <div>
          <label htmlFor="ob-dob" style={labelStyle}>Date of Birth</label>
          <input id="ob-dob" type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)}
            style={{ ...inputStyle, colorScheme: 'dark' }} />
        </div>

        <div>
          <label style={labelStyle}>Blood Type</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {BLOOD_TYPES.map(bt => (
              <button key={bt} onClick={() => update('blood_type', bt)} style={{
                padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                fontFamily: '"DM Mono", monospace',
                background: form.blood_type === bt ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.03)',
                border: form.blood_type === bt ? '1px solid #00E5FF' : '1px solid rgba(255,255,255,0.06)',
                color: form.blood_type === bt ? '#00E5FF' : '#778899',
                transition: 'all 200ms',
              }}>{bt}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="ob-height" style={labelStyle}>Height (cm)</label>
            <input id="ob-height" type="number" value={form.height_cm} onChange={e => update('height_cm', e.target.value)}
              placeholder="170" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="ob-weight" style={labelStyle}>Weight (kg)</label>
            <input id="ob-weight" type="number" value={form.weight_kg} onChange={e => update('weight_kg', e.target.value)}
              placeholder="70" style={inputStyle} />
          </div>
        </div>

        <div>
          <label htmlFor="ob-ec-name" style={labelStyle}>Emergency Contact Name</label>
          <input id="ob-ec-name" value={form.emergency_contact_name} onChange={e => update('emergency_contact_name', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label htmlFor="ob-ec-phone" style={labelStyle}>Emergency Contact Phone</label>
          <input id="ob-ec-phone" type="tel" value={form.emergency_contact_phone} onChange={e => update('emergency_contact_phone', e.target.value)} style={inputStyle} />
        </div>
      </div>
    ),

    // Step 2: Medical History
    () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 32 }}>📋</div>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: '#EEF2F7', margin: '8px 0 2px' }}>Medical History</h3>
          <p style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: '#445566' }}>This helps AI provide better diagnostics</p>
        </div>

        <div>
          <label htmlFor="ob-conditions" style={labelStyle}>Existing Conditions</label>
          <textarea id="ob-conditions" value={form.existing_conditions} onChange={e => update('existing_conditions', e.target.value)}
            placeholder="e.g. Diabetes Type 2, Hypertension"
            style={{ ...inputStyle, height: 72, padding: '10px 14px', resize: 'vertical' }} />
        </div>

        <div>
          <label htmlFor="ob-medications" style={labelStyle}>Current Medications</label>
          <textarea id="ob-medications" value={form.current_medications} onChange={e => update('current_medications', e.target.value)}
            placeholder="e.g. Metformin 500mg, Amlodipine 5mg"
            style={{ ...inputStyle, height: 72, padding: '10px 14px', resize: 'vertical' }} />
        </div>

        <div>
          <label htmlFor="ob-allergies" style={labelStyle}>Known Allergies</label>
          <input id="ob-allergies" value={form.known_allergies} onChange={e => update('known_allergies', e.target.value)}
            placeholder="e.g. Penicillin, Peanuts" style={inputStyle} />
        </div>

        <div>
          <label htmlFor="ob-surgeries" style={labelStyle}>Previous Surgeries</label>
          <input id="ob-surgeries" value={form.previous_surgeries} onChange={e => update('previous_surgeries', e.target.value)}
            placeholder="e.g. Appendectomy (2019)" style={inputStyle} />
        </div>
      </div>
    ),

    // Step 3: Preferences
    () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 32 }}>⚙️</div>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: '#EEF2F7', margin: '8px 0 2px' }}>Preferences</h3>
          <p style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: '#445566' }}>Customize your NEURAMED experience</p>
        </div>

        <div>
          <label style={labelStyle}>Preferred Language</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {LANGUAGES.map(lang => (
              <button key={lang} onClick={() => update('language_preference', lang)} style={{
                padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 11,
                fontFamily: '"DM Mono", monospace',
                background: form.language_preference === lang ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.03)',
                border: form.language_preference === lang ? '1px solid #00E5FF' : '1px solid rgba(255,255,255,0.06)',
                color: form.language_preference === lang ? '#00E5FF' : '#778899',
                transition: 'all 200ms',
              }}>{lang}</button>
            ))}
          </div>
        </div>

        <div style={{
          marginTop: 12, padding: 16, borderRadius: 12,
          background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.12)',
        }}>
          <p style={{ fontFamily: '"DM Mono", monospace', fontSize: 12, color: '#778899', lineHeight: 1.8, margin: 0 }}>
            Your medical data is encrypted and stored securely. Only authorized healthcare professionals can access your records.
            You can update this information anytime from your profile settings.
          </p>
        </div>
      </div>
    ),
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(2,6,8,0.85)', backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        style={{
          width: 480, maxWidth: 'calc(100vw - 32px)', maxHeight: '90vh',
          background: 'rgba(11,16,21,0.95)', border: '1px solid rgba(0,229,255,0.15)',
          borderRadius: 20, padding: '28px 32px', overflowY: 'auto',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: i === step ? 24 : 8, height: 8, borderRadius: 4,
              background: i <= step ? '#00E5FF' : 'rgba(255,255,255,0.1)',
              transition: 'all 300ms',
              boxShadow: i === step ? '0 0 8px rgba(0,229,255,0.4)' : 'none',
            }} />
          ))}
        </div>

        {/* Step indicator */}
        <div style={{
          fontFamily: '"DM Mono", monospace', fontSize: 10, color: '#445566',
          textAlign: 'center', marginBottom: 16, letterSpacing: '0.15em',
        }}>STEP {step + 1} OF 3</div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            {steps[step]()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{
              flex: 1, height: 44, borderRadius: 10, cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: '#778899',
            }}>← Back</button>
          )}
          {step < 2 ? (
            <button onClick={() => setStep(s => s + 1)} style={{
              flex: 2, height: 44, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #00E5FF, #00FF9D)',
              fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: '#020608',
            }}>Continue →</button>
          ) : (
            <button onClick={handleSave} disabled={saving} style={{
              flex: 2, height: 44, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #00FF9D, #00E5FF)',
              fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: '#020608',
              opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Saving...' : 'Complete Setup'}</button>
          )}
        </div>

        {/* Skip */}
        <button onClick={onComplete} style={{
          width: '100%', marginTop: 10, padding: 8, background: 'transparent', border: 'none',
          fontFamily: '"DM Mono", monospace', fontSize: 11, color: '#445566', cursor: 'pointer',
          textAlign: 'center',
        }}>Skip for now →</button>
      </motion.div>
    </div>
  );
};

export default PatientOnboarding;
