import React from 'react';
import type { UrgencyLevel } from '../../types';

const URGENCY_TOKENS: Record<UrgencyLevel, { label: string; bg: string; border: string; color: string; dot: string }> = {
  critical: {
    label: 'Critical',
    bg: 'rgba(220, 77, 77, 0.10)',
    border: 'rgba(220, 77, 77, 0.30)',
    color: '#DC4D4D',
    dot: '#DC4D4D',
  },
  high: {
    label: 'High',
    bg: 'rgba(232, 155, 63, 0.10)',
    border: 'rgba(232, 155, 63, 0.28)',
    color: '#E89B3F',
    dot: '#E89B3F',
  },
  medium: {
    label: 'Medium',
    bg: 'rgba(255, 107, 91, 0.08)',
    border: 'rgba(255, 107, 91, 0.22)',
    color: '#FF6B5B',
    dot: '#FF6B5B',
  },
  low: {
    label: 'Low',
    bg: 'rgba(63, 168, 108, 0.08)',
    border: 'rgba(63, 168, 108, 0.22)',
    color: '#3FA86C',
    dot: '#3FA86C',
  },
};

export const UrgencyBadge: React.FC<{ urgency: UrgencyLevel }> = ({ urgency }) => {
  const t = URGENCY_TOKENS[urgency];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 22,
        padding: '0 10px',
        borderRadius: 999,
        fontFamily: 'inherit',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '-0.005em',
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: t.color,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: t.dot,
        }}
      />
      {t.label}
    </span>
  );
};
