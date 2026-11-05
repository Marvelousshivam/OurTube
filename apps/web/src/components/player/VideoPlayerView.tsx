import React, { useRef, useState, useEffect } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { VideoQuality } from '../../types';

export const VideoPlayerView: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    currentTrack,
    streamVideoUrl,
    isPlaying,
    volume,
    isMuted,
    currentTime,
    videoQuality,
    togglePlay,
    seek,
    setVideoQuality,
    updatePlaybackProgress,
    setBuffering
  } = usePlayerStore();

  const [aspectRatio, setAspectRatio] = useState<'fit' | 'fill' | 'cover'>('fit');
  const [showControls, setShowControls] = useState(true);
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync video source
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (streamVideoUrl) {
      video.src = streamVideoUrl;
      video.load();
      if (isPlaying) {
        video.play().catch((err) => console.warn('[Koda Video] Autoplay error:', err));
      }
    }
  }, [streamVideoUrl]);

  // Sync playback state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying]);

  // Sync volume & mute
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Sync seek
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (Math.abs(video.currentTime - currentTime) > 1.5) {
      video.currentTime = currentTime;
    }
  }, [currentTime]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setIsQualityMenuOpen(false);
      }
    }, 3000);
  };

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('[Koda Video] PiP failed:', err);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (containerRef.current) {
        await containerRef.current.requestFullscreen();
      }
    } catch (err) {
      console.warn('[Koda Video] Fullscreen failed:', err);
    }
  };

  const qualities: VideoQuality[] = ['auto', '1080p', '720p', '480p', '360p'];

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '1080px',
        margin: '0 auto',
        aspectRatio: '16/9',
        backgroundColor: '#000',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.6)'
      }}
    >
      {streamVideoUrl ? (
        <video
          ref={videoRef}
          onClick={togglePlay}
          onTimeUpdate={() => {
            if (videoRef.current) {
              updatePlaybackProgress(videoRef.current.currentTime, videoRef.current.duration);
            }
          }}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: aspectRatio === 'fit' ? 'contain' : aspectRatio === 'cover' ? 'cover' : 'fill',
            cursor: 'pointer'
          }}
        />
      ) : (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${currentTrack?.id}?autoplay=1&enablejsapi=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block'
          }}
        />
      )}

      {/* Video Overlay Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px 20px',
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0) 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? 'auto' : 'none',
          transition: 'opacity 250ms ease'
        }}
      >
        {/* Scrubber slider */}
        <input
          type="range"
          min={0}
          max={videoRef.current?.duration || 100}
          value={currentTime}
          onChange={(e) => seek(parseFloat(e.target.value))}
          style={{
            width: '100%',
            accentColor: 'var(--md-sys-color-primary)',
            cursor: 'pointer'
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Left Controls: Play, Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={togglePlay}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <span className="material-symbols-rounded filled" style={{ fontSize: '28px' }}>
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>
            <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)' }}>
              {Math.floor(currentTime / 60)}:
              {Math.floor(currentTime % 60).toString().padStart(2, '0')} /{' '}
              {Math.floor((videoRef.current?.duration || 0) / 60)}:
              {Math.floor((videoRef.current?.duration || 0) % 60).toString().padStart(2, '0')}
            </div>
          </div>

          {/* Right Controls: Quality, Aspect Ratio, PiP, Fullscreen */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
            {/* Quality Selector */}
            <button
              onClick={() => setIsQualityMenuOpen(!isQualityMenuOpen)}
              className="glass-pill"
              style={{
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {videoQuality.toUpperCase()}
            </button>

            {isQualityMenuOpen && (
              <div
                className="glass-panel"
                style={{
                  position: 'absolute',
                  bottom: '40px',
                  right: '90px',
                  borderRadius: '12px',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  zIndex: 20
                }}
              >
                {qualities.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setVideoQuality(q);
                      setIsQualityMenuOpen(false);
                    }}
                    style={{
                      background: videoQuality === q ? 'var(--md-sys-color-primary)' : 'transparent',
                      color: videoQuality === q ? 'var(--md-sys-color-on-primary)' : '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    {q.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            {/* Aspect Ratio Toggle */}
            <button
              onClick={() =>
                setAspectRatio((prev) => (prev === 'fit' ? 'cover' : prev === 'cover' ? 'fill' : 'fit'))
              }
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title={`Aspect Ratio: ${aspectRatio}`}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                aspect_ratio
              </span>
            </button>

            {/* Picture in Picture */}
            <button
              onClick={togglePiP}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Picture in Picture"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                picture_in_picture_alt
              </span>
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Toggle Fullscreen"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                fullscreen
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
