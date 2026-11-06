import React from 'react';
import { usePlayerStore } from '../../store/playerStore';

export const MiniVideoPlayer: React.FC = () => {
  const {
    currentVideo,
    isMiniVideoPlayerOpen,
    isPlaying,
    togglePlay,
    setVideoWatchOpen,
    setMiniVideoPlayerOpen,
    closeVideo
  } = usePlayerStore();

  if (!isMiniVideoPlayerOpen || !currentVideo) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '84px',
        right: '20px',
        zIndex: 88,
        width: '320px',
        maxWidth: 'calc(100vw - 40px)',
        backgroundColor: 'var(--md-sys-color-surface-container-high, #2b2930)',
        borderRadius: '16px',
        border: '1px solid var(--md-sys-color-outline-variant, rgba(255,255,255,0.12))',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        padding: '8px',
        gap: '10px',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        animation: 'kodaMiniPop 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: 'pointer'
      }}
      onClick={() => {
        setMiniVideoPlayerOpen(false);
        setVideoWatchOpen(true);
      }}
    >
      {/* 16:9 Thumbnail Frame */}
      <div
        style={{
          position: 'relative',
          width: '84px',
          aspectRatio: '16 / 9',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: '#000',
          flexShrink: 0
        }}
      >
        <img
          src={currentVideo.thumbnailUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* Title & Channel */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4
          style={{
            margin: '0 0 2px',
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--md-sys-color-on-surface, #e6e1e5)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {currentVideo.title}
        </h4>
        <p
          style={{
            margin: 0,
            fontSize: '11px',
            color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {currentVideo.channelName}
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: 'var(--md-sys-color-primary-container)',
            color: 'var(--md-sys-color-on-primary-container)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            closeVideo();
          }}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'transparent',
            color: 'var(--md-sys-color-on-surface-variant)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title="Close Video"
        >
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
            close
          </span>
        </button>
      </div>

      <style>{`
        @keyframes kodaMiniPop {
          from { transform: scale(0.85) translateY(20px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
