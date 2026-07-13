import React from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';
import type { Citation } from '../../types';

/**
 * CitationList — surfaces the real sources behind a result.
 *
 * Each citation links out (new tab) to its `url`, showing title + journal +
 * year, or "PMID: xxx" when metadata is thin. Small and unobtrusive; renders
 * nothing when there are no citations.
 */
export const CitationList: React.FC<{ citations?: Citation[]; compact?: boolean }> = ({ citations, compact }) => {
  if (!citations || citations.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 6, marginTop: 8 }}>
      {!compact && (
        <span
          className="font-body"
          style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <BookOpen size={11} style={{ color: 'var(--green)' }} /> CITATIONS
        </span>
      )}
      {citations.map((c, i) => {
        const meta = [c.journal, c.year].filter(Boolean).join(' · ');
        const primary = c.title || (c.pmid ? `PMID: ${c.pmid}` : c.url) || 'Source';
        const inner = (
          <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 6, lineHeight: 1.4 }}>
            <ExternalLink size={compact ? 10 : 11} style={{ color: 'var(--cyan)', flexShrink: 0, marginTop: 2 }} />
            <span>
              <span className="font-body" style={{ fontSize: compact ? 10 : 11, color: 'var(--cyan)' }}>{primary}</span>
              {meta && (
                <span className="font-body" style={{ fontSize: compact ? 9 : 10, color: 'var(--muted)', marginLeft: 6 }}>{meta}</span>
              )}
              {c.title && c.pmid && (
                <span className="font-body" style={{ fontSize: compact ? 9 : 10, color: 'var(--dim)', marginLeft: 6 }}>PMID: {c.pmid}</span>
              )}
            </span>
          </span>
        );

        return c.url ? (
          <a
            key={c.pmid || c.url || i}
            href={c.url}
            target="_blank"
            rel="noreferrer"
            data-cursor="hover"
            style={{ textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {inner}
          </a>
        ) : (
          <div key={c.pmid || i}>{inner}</div>
        );
      })}
    </div>
  );
};

export default CitationList;
