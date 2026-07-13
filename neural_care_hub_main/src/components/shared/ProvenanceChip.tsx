import React from 'react';
import { Cpu, AlertTriangle, Link2 } from 'lucide-react';
import type { Provenance } from '../../types';

/**
 * ProvenanceChip — surfaces WHAT produced a result.
 *
 * Every AI output in NeuraMed carries a provenance envelope. When the
 * inference ran cleanly we show the real `model · vendor`; when it did not we
 * show the honest failure reason in a warning colour. `grounded_in` (citation
 * / source URLs) is surfaced as a subtle "N sources" count.
 */
export const ProvenanceChip: React.FC<{ provenance?: Provenance }> = ({ provenance }) => {
  if (!provenance) return null;

  const ok = provenance.status === 'ok';
  const label = [provenance.model, provenance.vendor].filter(Boolean).join(' · ');
  const sourceCount = provenance.grounded_in?.length ?? 0;

  const accent = ok ? 'var(--cyan)' : 'var(--amber)';
  const bg = ok ? 'rgba(0,229,255,0.08)' : 'rgba(255,149,0,0.1)';
  const border = ok ? 'rgba(0,229,255,0.2)' : 'rgba(255,149,0,0.3)';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span
        title={ok ? `Real inference · ${provenance.source}` : provenance.reason || provenance.status}
        style={{
          fontFamily: 'var(--font-body)', fontSize: 10, padding: '4px 10px', borderRadius: 12,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: bg, color: accent, border: `1px solid ${border}`,
        }}
      >
        {ok ? <Cpu size={11} /> : <AlertTriangle size={11} />}
        {ok ? (label || 'real model') : (
          <>Inference {provenance.status}{provenance.reason ? ` — ${provenance.reason}` : ''}</>
        )}
      </span>
      {sourceCount > 0 && (
        <span
          title="Grounded in real sources"
          style={{
            fontFamily: 'var(--font-body)', fontSize: 10, padding: '4px 10px', borderRadius: 12,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'rgba(0,255,157,0.06)', color: 'var(--green)', border: '1px solid rgba(0,255,157,0.15)',
          }}
        >
          <Link2 size={10} />
          {sourceCount} source{sourceCount === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
};

export default ProvenanceChip;
