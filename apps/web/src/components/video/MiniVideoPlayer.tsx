import React, { useState } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { NativeVideoPlayerEngine } from './NativeVideoPlayerEngine';

const formatMiniTime = (sec: number) => {
  if (!sec || !Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export const MiniVideoPlayer: React.FC = () => {
  const {
    currentVideo,
    isMiniVideoPlayerOpen,
    isVideoWatchOpen,
    isPlaying,
    currentTime,
    duration,
    streamVideoUrl,
    togglePlay,
    seek,
    listenAsMusic,
    setVideoWatchOpen,
    setMiniVideoPlayerOpen,
    closeVideo
  } = usePlayerStore();

  const [isHovered, setIsHovered] = useState(false);

  if (!isMiniVideoPlayerOpen || isVideoWatchOpen || !currentVideo) return null;

  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const handleExpand = () => {
    setMiniVideoPlayerOpen(false);
    setVideoWatchOpen(true);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        bottom: '88px',
        right: '24px',
        zIndex: 88,
        width: '352px',
        maxWidth: 'calc(100vw - 32px)',
        backgroundColor: 'rgba(22, 23, 27, 0.94)',
        borderRadius: isHovered ? '26px' : '22px',
        border: isHovered
          ? '1px solid rgba(168, 199, 250, 0.28)'
          : '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: isHovered
          ? '0 26px 56px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(168, 199, 250, 0.18)'
          : '0 20px 48px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(168, 199, 250, 0.08)',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        transition:
          'border-radius 320ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1)), transform 260ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1)), box-shadow 260ms ease, border-color 200ms ease',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        animation: 'm3ModalSpringIn 360ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1)) both'
      }}
    >
      {/* Live 16:9 PiP Video Viewport */}
      <div
        onClick={handleExpand}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          backgroundColor: '#000',
          cursor: 'pointer',
          overflow: 'hidden'
        }}
      >
        {streamVideoUrl ? (
          <NativeVideoPlayerEngine />
        ) : (
          <img
            src={currentVideo.thumbnailUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}

        {/* Hover Controls Scrim Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.75) 100%)',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 180ms ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '10px 12px'
          }}
        >
          {/* Top Bar: Expand & Close */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExpand();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.16)',
                backgroundColor: 'rgba(15, 16, 20, 0.72)',
                color: '#F3F4F6',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                backdropFilter: 'blur(8px)'
              }}
              title="Expand to full player"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>
                open_in_full
              </span>
              Expand
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  listenAsMusic();
                }}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: '1px solid rgba(168, 199, 250, 0.28)',
                  backgroundColor: 'rgba(15, 16, 20, 0.72)',
                  color: '#A8C7FA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Listen as Music"
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                  headphones
                </span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeVideo();
                }}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.16)',
                  backgroundColor: 'rgba(15, 16, 20, 0.72)',
                  color: '#E3E3E3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Close Mini Player"
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                  close
                </span>
              </button>
            </div>
          </div>

          {/* Center Transport Controls (-10s, Play/Pause, +10s) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px'
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                seek(Math.max(0, currentTime - 10));
              }}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'rgba(0,0,0,0.55)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Rewind 10s"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                replay_10
              </span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: isPlaying ? '14px' : '50%',
                border: 'none',
                backgroundColor: '#A8C7FA',
                color: '#062E6F',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'border-radius 220ms cubic-bezier(0.22, 1, 0.36, 1), transform 150ms ease',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
              }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              <span
                className="material-symbols-rounded"
                style={{ fontSize: '26px', fontVariationSettings: "'FILL' 1" }}
              >
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                seek(Math.min(duration || currentTime + 10, currentTime + 10));
              }}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'rgba(0,0,0,0.55)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Forward 10s"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                forward_10
              </span>
            </button>
          </div>

          {/* Bottom Time Readout */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.88)',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            <span>
              {formatMiniTime(currentTime)} / {formatMiniTime(duration)}
            </span>
            <span style={{ color: '#A8C7FA', fontWeight: 700 }}>PiP Active</span>
          </div>
        </div>

        {/* Interactive Bottom Scrubber Bar */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (!duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            seek(ratio * duration);
          }}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: isHovered ? '6px' : '3px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            cursor: 'pointer',
            transition: 'height 150ms ease'
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              backgroundColor: '#A8C7FA',
              borderRadius: '0 999px 999px 0',
              transition: 'width 150ms linear'
            }}
          />
        </div>
      </div>

      {/* Metadata Footer Bar */}
      <div
        onClick={handleExpand}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: '10px 14px',
          cursor: 'pointer'
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4
            style={{
              margin: '0 0 2px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#F3F4F6',
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
              fontSize: '11.5px',
              color: '#9AA0A6',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {currentVideo.channelName}
          </p>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          style={{
            width: '34px',
            height: '34px',
            borderRadius: isPlaying ? '10px' : '50%',
            backgroundColor: 'rgba(168, 199, 250, 0.16)',
            color: '#A8C7FA',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'border-radius 200ms ease'
          }}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          <span
            className="material-symbols-rounded"
            style={{ fontSize: '20px', fontVariationSettings: "'FILL' 1" }}
          >
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>
      </div>

      <style>{`
        @keyframes kodaMiniPop {
          from { transform: scale(0.88) translateY(20px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
