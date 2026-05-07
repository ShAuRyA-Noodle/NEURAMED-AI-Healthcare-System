import React, { useEffect, useState } from 'react';

const colorFor = (v: number) => (v > 0.8 ? '#3FA86C' : v > 0.6 ? '#E89B3F' : '#DC4D4D');

export const ConfidenceMeter: React.FC<{ value: number; size?: number }> = ({ value, size = 100 }) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circumference);

  const stroke = colorFor(value);

  useEffect(() => {
    const target = circumference - value * circumference;
    const t = setTimeout(() => setOffset(target), 80);
    return () => clearTimeout(t);
  }, [value, circumference]);

  return (
    <div style={{ width: size, height: size, position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} stroke="rgba(255,255,255,0.07)" strokeWidth="8" fill="transparent" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke={stroke}
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.32, 0.72, 0, 1), stroke 600ms ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span
          className="font-mono"
          style={{
            fontSize: size * 0.26,
            fontWeight: 600,
            color: 'var(--text)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          }}
        >
          {Math.round(value * 100)}%
        </span>
      </div>
    </div>
  );
};
