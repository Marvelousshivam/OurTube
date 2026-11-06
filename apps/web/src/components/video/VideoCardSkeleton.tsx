import React from 'react';

interface VideoCardSkeletonProps {
  count?: number;
}

export const VideoCardSkeleton: React.FC<VideoCardSkeletonProps> = ({ count = 6 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            flexDirection: 'column',
            userSelect: 'none',
            animation: 'm3SkeletonFade 300ms ease forwards',
            animationDelay: `${i * 40}ms`
          }}
        >
          {/* 16:9 Thumbnail Skeleton */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              borderRadius: '16px',
              backgroundColor: 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.05))',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
            }}
          >
            <div className="m3-shimmer" />
          </div>

          {/* Info Row Skeleton */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              paddingTop: '12px',
              paddingBottom: '8px',
              alignItems: 'flex-start'
            }}
          >
            {/* Avatar Circle Skeleton */}
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.06))',
                flexShrink: 0,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div className="m3-shimmer" />
            </div>

            {/* Title & Metadata Skeletons */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  height: '14px',
                  width: '90%',
                  borderRadius: '6px',
                  backgroundColor: 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.07))',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div className="m3-shimmer" />
              </div>

              <div
                style={{
                  height: '14px',
                  width: '60%',
                  borderRadius: '6px',
                  backgroundColor: 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.05))',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div className="m3-shimmer" />
              </div>

              <div
                style={{
                  height: '11px',
                  width: '45%',
                  marginTop: '2px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.04))',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div className="m3-shimmer" />
              </div>
            </div>
          </div>
        </div>
      ))}

      <style>{`
        .m3-shimmer {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          transform: translateX(-100%);
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.06) 50%,
            transparent 100%
          );
          animation: m3ShimmerWave 1.6s infinite ease-in-out;
        }

        @keyframes m3ShimmerWave {
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes m3SkeletonFade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};
