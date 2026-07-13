import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { UserX, FileX } from 'lucide-react';
import { getPatient } from '@/api/patients';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { EmptyState } from '@/components/shared/EmptyState';
import type { SessionListItem } from '@/types';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: patient, isLoading, isError } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => getPatient(Number(id)),
    enabled: Boolean(id),
  });

  if (isLoading) return <SkeletonCard height={200} />;
  if (isError || !patient) {
    return (
      <EmptyState
        icon={UserX}
        title="Patient not found"
        subtitle={`No patient with id ${id}.`}
      />
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>{patient.patient_code}</h1>
      <Link to={`/patients/${id}/timeline`} className="text-cyan-400 underline">
        View clinical timeline →
      </Link>
      <section className="mt-6">
        <h2 className="text-lg" style={{ color: 'var(--text)' }}>Sessions</h2>
        {patient.sessions?.length ? (
          patient.sessions.map((s: SessionListItem) => (
            <Link key={s.id} to={`/sessions/${s.id}`} className="block py-2 text-cyan-400">
              {s.agent_type} · {new Date(s.created_at).toLocaleDateString()}
            </Link>
          ))
        ) : (
          <EmptyState
            icon={FileX}
            title="No sessions yet"
            subtitle="This patient has no diagnosis sessions."
          />
        )}
      </section>
    </div>
  );
}
