import React from 'react';
import type { AgentType } from '../../types';

type Token = { label: string; bg: string; border: string; color: string };

const AGENT_TOKENS: Record<string, Token> = {
  voice: {
    label: 'Voice',
    bg: 'rgba(255, 107, 91, 0.10)',
    border: 'rgba(255, 107, 91, 0.28)',
    color: '#FF6B5B',
  },
  imaging: {
    label: 'Imaging',
    bg: 'rgba(63, 168, 108, 0.10)',
    border: 'rgba(63, 168, 108, 0.28)',
    color: '#3FA86C',
  },
  ocr: {
    label: 'OCR',
    bg: 'rgba(232, 155, 63, 0.10)',
    border: 'rgba(232, 155, 63, 0.28)',
    color: '#E89B3F',
  },
};

const FALLBACK: Token = {
  label: 'Agent',
  bg: 'rgba(255, 255, 255, 0.04)',
  border: 'rgba(255, 255, 255, 0.10)',
  color: '#A1A1A8',
};

export const AgentBadge: React.FC<{ agent: AgentType | string | null | undefined }> = ({ agent }) => {
  const key = (agent || '').toString().toLowerCase();
  const t = AGENT_TOKENS[key] || { ...FALLBACK, label: agent ? String(agent).toUpperCase() : 'AGENT' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 9px',
        borderRadius: 999,
        fontFamily: 'var(--font-mono, "Geist Mono"), monospace',
        fontSize: 10.5,
        fontWeight: 500,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: t.color,
      }}
    >
      {t.label}
    </span>
  );
};
