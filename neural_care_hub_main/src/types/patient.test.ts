import { describe, it, expectTypeOf } from 'vitest';
import type { EnrichedPatient } from './index';

describe('EnrichedPatient contract', () => {
  it('matches the shape returned by GET /api/patients', () => {
    // Every key below is present on every patient object returned by the
    // get_patients handler in backend/routers/patients.py. The last-session
    // agent/urgency values are UPPERCASE because the backend calls .upper().
    const fromApi: EnrichedPatient = {
      id: 1,
      patient_code: 'PT-0001',
      first_name: 'Test',
      last_name: 'Patient',
      full_name: 'Test Patient',
      age: 45,
      gender: 'female',
      phone: '555-0100',
      email: 'test@example.com',
      address: '123 Main St',
      emergency_contact: 'Jane Doe · 555-0111',
      allergies: 'Penicillin',
      chronic_conditions: 'Hypertension',
      insurance_id: 'INS-123',
      created_at: '2026-07-13T00:00:00Z',
      demographics: { age: 45, gender: 'female', blood_type: 'N/A', date_of_birth: null },
      total_sessions: 3,
      session_count: 3,
      last_session_agent: 'VOICE',
      last_session_urgency: 'MEDIUM',
      last_session_date: '2026-07-12T00:00:00Z',
      most_common_condition: 'Hypertension',
      total_conditions_detected: ['Hypertension', 'Anemia'],
      risk_score: 0.42,
    };
    expectTypeOf(fromApi).toMatchTypeOf<EnrichedPatient>();
  });
});
