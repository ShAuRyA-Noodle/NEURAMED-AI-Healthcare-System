import React from 'react'

export const SkeletonCard: React.FC<{ height?: string | number, className?: string }> = ({ height = '100px', className = '' }) => {
    return (
        <div
            className={`rounded-xl overflow-hidden relative ${className}`}
            style={{
                height,
                background: 'linear-gradient(90deg, #0B1015 25%, rgba(255,255,255,0.04) 50%, #0B1015 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite linear'
            }}
        >
            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}} />
        </div>
    )
}
