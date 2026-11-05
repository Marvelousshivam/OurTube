import React from 'react';

export type M3LoaderSize = 'sm' | 'md' | 'lg' | 'xl';

export interface M3LoadingIndicatorProps {
  size?: M3LoaderSize;
  contained?: boolean;
  message?: string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

const SIZE_MAP: Record<M3LoaderSize, { outer: number; inner: number; aura: number }> = {
  sm: { outer: 24, inner: 16, aura: 24 },
  md: { outer: 44, inner: 30, aura: 44 },
  lg: { outer: 68, inner: 48, aura: 68 },
  xl: { outer: 92, inner: 64, aura: 92 }
};

export const M3LoadingIndicator: React.FC<M3LoadingIndicatorProps> = ({
  size = 'md',
  contained = false,
  message,
  color,
  className = '',
  style
}) => {
  const dims = SIZE_MAP[size];
  const primaryColor = color || 'var(--md-sys-color-primary)';

  const loaderVisual = (
    <div
      className="m3-expressive-loader"
      style={{
        position: 'relative',
        width: `${dims.outer}px`,
        height: `${dims.outer}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
      aria-label={message || 'Loading content'}
      role="progressbar"
    >
      <style>{`
        @keyframes m3MorphCore {
          0% {
            border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%;
            transform: rotate(0deg) scale(0.94);
          }
          25% {
            border-radius: 50% 50% 25% 75% / 55% 35% 65% 45%;
            transform: rotate(90deg) scale(1.06);
          }
          50% {
            border-radius: 65% 35% 40% 60% / 40% 60% 40% 60%;
            transform: rotate(180deg) scale(0.92);
          }
          75% {
            border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
            transform: rotate(270deg) scale(1.04);
          }
          100% {
            border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%;
            transform: rotate(360deg) scale(0.94);
          }
        }

        @keyframes m3MorphAura {
          0% {
            border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
            transform: rotate(0deg) scale(0.98);
            opacity: 0.35;
          }
          33% {
            border-radius: 35% 65% 60% 40% / 50% 40% 60% 50%;
            transform: rotate(-120deg) scale(1.12);
            opacity: 0.55;
          }
          66% {
            border-radius: 50% 50% 40% 60% / 40% 50% 50% 60%;
            transform: rotate(-240deg) scale(0.92);
            opacity: 0.3;
          }
          100% {
            border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
            transform: rotate(-360deg) scale(0.98);
            opacity: 0.35;
          }
        }
      `}</style>

      {/* Layer 1: Outer Translucent Aura (Counter-rotating organic halo) */}
      <div
        style={{
          position: 'absolute',
          width: `${dims.aura}px`,
          height: `${dims.aura}px`,
          backgroundColor: 'var(--md-sys-color-primary-container, var(--md-sys-color-secondary-container))',
          animation: 'm3MorphAura 4.2s cubic-bezier(0.34, 1.56, 0.64, 1) infinite',
          filter: 'blur(2px)',
          pointerEvents: 'none'
        }}
      />

      {/* Layer 2: Main Morphing Asymmetric Core (Expressive Material 3 polygon) */}
      <div
        style={{
          width: `${dims.inner}px`,
          height: `${dims.inner}px`,
          backgroundColor: primaryColor,
          animation: 'm3MorphCore 2.8s cubic-bezier(0.2, 0.9, 0.3, 1) infinite',
          boxShadow: '0 4px 16px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.2))',
          transition: 'background-color 200ms ease'
        }}
      />
    </div>
  );

  if (contained) {
    return (
      <div
        className={`m3-contained-loader ${className}`}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: message ? '16px' : '0',
          padding: '24px 32px',
          borderRadius: '28px',
          backgroundColor: 'var(--md-sys-color-surface-container-high)',
          border: '1px solid var(--md-sys-color-outline-variant)',
          boxShadow: '0 8px 32px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.12))',
          userSelect: 'none',
          animation: 'm3FadeIn 240ms ease-out',
          ...style
        }}
      >
        <style>{`
          @keyframes m3FadeIn {
            from { opacity: 0; transform: scale(0.96) translateY(6px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
        {loaderVisual}
        {message && (
          <span
            style={{
              fontSize: '13px',
              fontWeight: 650,
              letterSpacing: '-0.01em',
              color: 'var(--md-sys-color-on-surface-variant)',
              textAlign: 'center',
              maxWidth: '320px',
              lineHeight: 1.4
            }}
          >
            {message}
          </span>
        )}
      </div>
    );
  }

  if (message) {
    return (
      <div
        className={`m3-loader-stack ${className}`}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          userSelect: 'none',
          ...style
        }}
      >
        {loaderVisual}
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'var(--md-sys-color-on-surface-variant)',
            textAlign: 'center',
            maxWidth: '280px',
            lineHeight: 1.4
          }}
        >
          {message}
        </span>
      </div>
    );
  }

  return loaderVisual;
};
