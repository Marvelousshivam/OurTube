import React, { useState } from 'react';
import { TrackMetadata } from '../../types';
import { sizedArtwork, handleArtworkError } from '../../api/artworkService';
import { usePlayerStore } from '../../store/playerStore';
import { useTasteStore } from '../../store/tasteStore';

interface YourMixHeroProps {
  tracks: TrackMetadata[];
  onPlayMix: (tracks: TrackMetadata[]) => void;
  onTrackClick?: (track: TrackMetadata) => void;
  isWideScreen?: boolean;
  title?: string;
  activeMoodLabel?: string;
}

export const YourMixHero: React.FC<YourMixHeroProps> = ({
  tracks,
  onPlayMix,
  onTrackClick,
  isWideScreen = true,
  title,
  activeMoodLabel
}) => {
  const { currentTrack, isPlaying, addToQueue } = usePlayerStore();
  const { isLiked, toggleLikeTrack } = useTasteStore();

  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const [tilt, setTilt] = useState<{ rx: number; ry: number; dx: number; dy: number }>({
    rx: 0,
    ry: 0,
    dx: 0,
    dy: 0
  });
  const [isPlayBtnHovered, setIsPlayBtnHovered] = useState(false);
  const [isPlayBtnPressed, setIsPlayBtnPressed] = useState(false);
  const [isShuffleHovered, setIsShuffleHovered] = useState(false);
  const [queuedFeedback, setQueuedFeedback] = useState(false);

  if (!tracks || tracks.length === 0) return null;

  const safePreviewIdx = previewIndex < tracks.length ? previewIndex : 0;
  const primaryTrack = tracks[safePreviewIdx] || tracks[0];
  const secondaryIdx = safePreviewIdx === 1 ? 0 : 1;
  const tertiaryIdx = safePreviewIdx === 2 ? (tracks.length > 3 ? 3 : 0) : 2;
  const secondaryTrack = tracks[secondaryIdx] || tracks[0];
  const tertiaryTrack = tracks[tertiaryIdx] || tracks[0];

  const isMixTrackPlaying = isPlaying && tracks.some((t) => t.id === currentTrack?.id);

  // Derive artist roster subtitle
  const artistRoster = Array.from(new Set(tracks.map((t) => t.artist).filter(Boolean)))
    .slice(0, 5)
    .join(', ');

  const totalMixMins = Math.max(
    1,
    Math.round(tracks.reduce((acc, t) => acc + (t.duration || 210), 0) / 60)
  );

  const formatDuration = (secs?: number) => {
    const s = secs && secs > 0 ? Math.floor(secs) : 210;
    const mins = Math.floor(s / 60);
    const rem = String(s % 60).padStart(2, '0');
    return `${mins}:${rem}`;
  };

  const handlePlayClick = () => {
    onPlayMix(tracks);
  };

  const handleShuffleMix = () => {
    const shuffled = [...tracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    onPlayMix(shuffled);
  };

  const handleQueueMix = () => {
    tracks.slice(0, 8).forEach((t) => addToQueue(t));
    setQueuedFeedback(true);
    setTimeout(() => setQueuedFeedback(false), 1800);
  };

  const handleCollageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: -ny * 10,
      ry: nx * 10,
      dx: nx * 14,
      dy: ny * 14
    });
  };

  const handleCollageMouseLeave = () => {
    setTilt({ rx: 0, ry: 0, dx: 0, dy: 0 });
  };

  /* ================= INTERACTIVE 3D ORGANIC COLLAGE DECK ================= */
  const CollageDeck = (
    <div
      onMouseMove={handleCollageMouseMove}
      onMouseLeave={handleCollageMouseLeave}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: isWideScreen ? '430px' : '320px',
        aspectRatio: '1 / 1',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        perspective: '900px'
      }}
    >
      {/* Decorative Rotating M3 Tonal Orbit Ring */}
      <div
        style={{
          position: 'absolute',
          width: '88%',
          height: '88%',
          borderRadius: '50%',
          border: '1.5px dashed var(--md-sys-color-outline-variant)',
          opacity: isMixTrackPlaying ? 0.65 : 0.3,
          animation: 'm3HaloRotate 38s linear infinite',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />

      {/* Ambient Glow Behind Primary Pebble */}
      <div
        style={{
          position: 'absolute',
          width: '72%',
          height: '72%',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, var(--md-sys-color-primary) 0%, var(--md-sys-color-tertiary) 55%, transparent 75%)',
          opacity: isMixTrackPlaying ? 0.32 : 0.18,
          filter: 'blur(36px)',
          transform: `translate3d(${tilt.dx * 0.6}px, ${tilt.dy * 0.6}px, 0)`,
          transition: 'transform 220ms ease-out, opacity 350ms ease',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />

      {/* 1. Center Piece: Large Tilted Organic Pebble Artwork with 3D Parallax */}
      <div
        onClick={() => onTrackClick?.(primaryTrack)}
        style={{
          width: '78%',
          height: '78%',
          borderRadius:
            safePreviewIdx % 2 === 0
              ? '46% 54% 60% 40% / 48% 42% 58% 52%'
              : '54% 46% 42% 58% / 52% 58% 42% 48%',
          transform: `rotate(${safePreviewIdx % 2 === 0 ? -8 : -4}deg) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translate3d(${tilt.dx * 0.35}px, ${tilt.dy * 0.35}px, 0)`,
          overflow: 'hidden',
          backgroundColor: 'var(--md-sys-color-surface-container-high)',
          boxShadow: '0 24px 56px -8px rgba(0, 0, 0, 0.45)',
          border: '2px solid rgba(255, 255, 255, 0.12)',
          cursor: 'pointer',
          transition:
            'border-radius 500ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 300ms ease',
          position: 'relative',
          zIndex: 2
        }}
        title={`Play ${primaryTrack.title} • ${primaryTrack.artist}`}
      >
        <img
          key={primaryTrack.id}
          src={sizedArtwork(primaryTrack.thumbnailUrl || primaryTrack.highResThumbnailUrl, 544)}
          alt={primaryTrack.title}
          referrerPolicy="no-referrer"
          onError={(e) => handleArtworkError(e, primaryTrack.thumbnailUrl)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scale(1.06)',
            transition: 'transform 450ms cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        />

        {/* Subtle Bottom Scrim + Live Featured Track Pill Inside Center Pebble */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, transparent 48%, rgba(12, 14, 19, 0.82) 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '18px 22px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(20, 22, 28, 0.72)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              maxWidth: '90%',
              transform: `rotate(${safePreviewIdx % 2 === 0 ? 8 : 4}deg)`
            }}
          >
            <span
              className="material-symbols-rounded filled"
              style={{ fontSize: '14px', color: 'var(--md-sys-color-primary)', flexShrink: 0 }}
            >
              {currentTrack?.id === primaryTrack.id && isPlaying ? 'graphic_eq' : 'play_circle'}
            </span>
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#ffffff',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {primaryTrack.title}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Top-Left Floating Circular Satellite with Counter-Parallax */}
      <div
        onMouseEnter={() => setPreviewIndex(secondaryIdx)}
        onClick={() => onTrackClick?.(secondaryTrack)}
        style={{
          position: 'absolute',
          top: '2%',
          left: '2%',
          width: isWideScreen ? '132px' : '104px',
          height: isWideScreen ? '132px' : '104px',
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: 'var(--md-sys-color-surface-container-high)',
          boxShadow: '0 14px 34px rgba(0, 0, 0, 0.38)',
          border: '3px solid var(--md-sys-color-surface-container-low)',
          cursor: 'pointer',
          zIndex: 3,
          transform: `translate3d(${-tilt.dx * 0.65}px, ${-tilt.dy * 0.65}px, 20px)`,
          transition: 'transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 250ms ease'
        }}
        title={`${secondaryTrack.title} • ${secondaryTrack.artist}`}
      >
        <img
          src={sizedArtwork(secondaryTrack.thumbnailUrl || secondaryTrack.highResThumbnailUrl, 400)}
          alt={secondaryTrack.title}
          referrerPolicy="no-referrer"
          onError={(e) => handleArtworkError(e, secondaryTrack.thumbnailUrl)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* 3. Bottom-Right Floating Circular Satellite with Counter-Parallax */}
      <div
        onMouseEnter={() => setPreviewIndex(tertiaryIdx)}
        onClick={() => onTrackClick?.(tertiaryTrack)}
        style={{
          position: 'absolute',
          bottom: '3%',
          right: '3%',
          width: isWideScreen ? '122px' : '96px',
          height: isWideScreen ? '122px' : '96px',
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: 'var(--md-sys-color-surface-container-high)',
          boxShadow: '0 14px 34px rgba(0, 0, 0, 0.38)',
          border: '3px solid var(--md-sys-color-surface-container-low)',
          cursor: 'pointer',
          zIndex: 3,
          transform: `translate3d(${-tilt.dx * 0.5}px, ${-tilt.dy * 0.5}px, 16px)`,
          transition: 'transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 250ms ease'
        }}
        title={`${tertiaryTrack.title} • ${tertiaryTrack.artist}`}
      >
        <img
          src={sizedArtwork(tertiaryTrack.thumbnailUrl || tertiaryTrack.highResThumbnailUrl, 400)}
          alt={tertiaryTrack.title}
          referrerPolicy="no-referrer"
          onError={(e) => handleArtworkError(e, tertiaryTrack.thumbnailUrl)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    </div>
  );

  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: isWideScreen ? '36px' : '28px',
        backgroundColor: 'var(--md-sys-color-surface-container-low)',
        border: '1px solid var(--md-sys-color-outline-variant)',
        padding: isWideScreen ? '36px 44px' : '24px 20px',
        overflow: 'hidden',
        boxShadow: '0 16px 48px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.18))'
      }}
    >
      {/* Dynamic Ambient Radial Mesh Blobs */}
      <div
        style={{
          position: 'absolute',
          top: '-30%',
          left: '-10%',
          width: '55%',
          height: '130%',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, var(--md-sys-color-primary-container) 0%, transparent 70%)',
          opacity: 0.42,
          filter: 'blur(56px)',
          animation: 'm3AmbientMeshDrift 16s ease-in-out infinite alternate',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-35%',
          right: '-8%',
          width: '50%',
          height: '120%',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, var(--md-sys-color-tertiary-container) 0%, transparent 70%)',
          opacity: 0.36,
          filter: 'blur(64px)',
          animation: 'm3AmbientMeshDrift2 19s ease-in-out infinite alternate',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'grid',
          gridTemplateColumns: isWideScreen ? '1.15fr 0.85fr' : '1fr',
          gap: isWideScreen ? 'clamp(32px, 4vw, 64px)' : '28px',
          alignItems: 'center'
        }}
      >
        {/* Left Column: Expressive Metadata, Connected M3 Action Bar & Interactive 4-Track Bento Strip */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', minWidth: 0 }}>
          {/* Top Eyebrow Badge Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '9999px',
                backgroundColor: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-on-primary-container)',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase'
              }}
            >
              <span className="material-symbols-rounded filled" style={{ fontSize: '14px' }}>
                auto_awesome
              </span>
              {activeMoodLabel && activeMoodLabel !== 'All' ? `${activeMoodLabel} Mix` : 'Personalized Station'}
            </span>

            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--md-sys-color-on-surface-variant)',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {tracks.length} tracks • {totalMixMins} min
            </span>
          </div>

          {/* Expressive Headline & Artist Roster */}
          <div>
            <h1
              style={{
                fontFamily: "'Syne', -apple-system, sans-serif",
                fontSize: isWideScreen ? 'clamp(44px, 4.6vw, 68px)' : 'clamp(36px, 8.5vw, 46px)',
                fontWeight: 900,
                lineHeight: 0.96,
                letterSpacing: '-0.04em',
                margin: 0,
                color: 'var(--md-sys-color-on-surface)'
              }}
            >
              {title ? (
                title.split('\n').map((line, i, arr) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < arr.length - 1 && ' '}
                  </React.Fragment>
                ))
              ) : (
                'Your Mix'
              )}
            </h1>

            <p
              style={{
                fontSize: isWideScreen ? '14.5px' : '13.5px',
                fontWeight: 500,
                color: 'var(--md-sys-color-on-surface-variant)',
                margin: '12px 0 0 0',
                maxWidth: '540px',
                lineHeight: 1.45
              }}
            >
              Featuring <strong style={{ color: 'var(--md-sys-color-on-surface)', fontWeight: 700 }}>{artistRoster}</strong> and more tailored to your taste.
            </p>
          </div>

          {/* M3 Expressive Connected Action Group (Eliminates Empty Center Void) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Primary Extended Morphing FAB */}
            <button
              type="button"
              onClick={handlePlayClick}
              onMouseEnter={() => setIsPlayBtnHovered(true)}
              onMouseLeave={() => {
                setIsPlayBtnHovered(false);
                setIsPlayBtnPressed(false);
              }}
              onMouseDown={() => setIsPlayBtnPressed(true)}
              onMouseUp={() => setIsPlayBtnPressed(false)}
              style={{
                height: '54px',
                padding: '0 26px',
                borderRadius: isPlayBtnPressed ? '14px' : isPlayBtnHovered ? '18px' : '9999px',
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '15px',
                fontWeight: 800,
                letterSpacing: '-0.01em',
                cursor: 'pointer',
                boxShadow: isPlayBtnHovered
                  ? '0 12px 28px rgba(0, 0, 0, 0.32)'
                  : '0 6px 18px rgba(0, 0, 0, 0.2)',
                transform: isPlayBtnPressed
                  ? 'scale(0.95)'
                  : isPlayBtnHovered
                  ? 'scale(1.03) translateY(-1px)'
                  : 'scale(1)',
                transition:
                  'border-radius 320ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms ease'
              }}
              title="Play Your Mix"
            >
              {isMixTrackPlaying ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '2.5px',
                    height: '16px',
                    width: '18px'
                  }}
                >
                  <span style={{ width: '3px', height: '100%', backgroundColor: 'currentColor', borderRadius: '99px', animation: 'm3EqualizerBar1 0.7s ease-in-out infinite' }} />
                  <span style={{ width: '3px', height: '100%', backgroundColor: 'currentColor', borderRadius: '99px', animation: 'm3EqualizerBar2 0.55s ease-in-out infinite 0.1s' }} />
                  <span style={{ width: '3px', height: '100%', backgroundColor: 'currentColor', borderRadius: '99px', animation: 'm3EqualizerBar3 0.8s ease-in-out infinite 0.2s' }} />
                </div>
              ) : (
                <span className="material-symbols-rounded filled" style={{ fontSize: '24px' }}>
                  play_arrow
                </span>
              )}
              <span>{isMixTrackPlaying ? 'Playing Mix' : 'Play Mix'}</span>
            </button>

            {/* Secondary Tonal Shuffle Button */}
            <button
              type="button"
              onClick={handleShuffleMix}
              onMouseEnter={() => setIsShuffleHovered(true)}
              onMouseLeave={() => setIsShuffleHovered(false)}
              style={{
                height: '54px',
                padding: '0 22px',
                borderRadius: isShuffleHovered ? '9999px' : '18px',
                backgroundColor: 'var(--md-sys-color-secondary-container)',
                color: 'var(--md-sys-color-on-secondary-container)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                transform: isShuffleHovered ? 'scale(1.03) translateY(-1px)' : 'scale(1)',
                transition:
                  'border-radius 320ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 150ms ease'
              }}
              title="Shuffle Your Mix"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                shuffle
              </span>
              <span>Shuffle</span>
            </button>

            {/* Tonal Queue Mix Action */}
            <button
              type="button"
              onClick={handleQueueMix}
              style={{
                height: '54px',
                padding: queuedFeedback ? '0 18px' : '0 16px',
                borderRadius: '18px',
                backgroundColor: queuedFeedback
                  ? 'var(--md-sys-color-tertiary-container)'
                  : 'var(--md-sys-color-surface-container-high)',
                color: queuedFeedback
                  ? 'var(--md-sys-color-on-tertiary-container)'
                  : 'var(--md-sys-color-on-surface)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
              title="Add mix tracks to queue"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                {queuedFeedback ? 'check' : 'queue_music'}
              </span>
              {queuedFeedback && <span>Queued</span>}
            </button>
          </div>

          {/* Interactive 4-Track Bento Preview Strip ("IN THIS MIX") */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--md-sys-color-primary)'
                }}
              >
                In this mix • Hover to preview
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isWideScreen ? 'repeat(2, minmax(0, 1fr))' : '1fr',
                gap: '8px'
              }}
            >
              {tracks.slice(0, 4).map((t, idx) => {
                const isPreviewed = safePreviewIdx === idx;
                const isThisTrackPlaying = currentTrack?.id === t.id && isPlaying;
                const liked = isLiked(t.id);

                return (
                  <div
                    key={t.id}
                    onMouseEnter={() => setPreviewIndex(idx)}
                    onClick={() => onTrackClick?.(t)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '8px 12px 8px 8px',
                      borderRadius: isPreviewed ? '18px' : '14px',
                      backgroundColor: isPreviewed
                        ? 'var(--md-sys-color-surface-container-highest)'
                        : 'var(--md-sys-color-surface-container)',
                      border: isPreviewed
                        ? '1px solid var(--md-sys-color-primary)'
                        : '1px solid var(--md-sys-color-outline-variant)',
                      cursor: 'pointer',
                      transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          position: 'relative',
                          width: '38px',
                          height: '38px',
                          borderRadius: isPreviewed || isThisTrackPlaying ? '50%' : '10px',
                          overflow: 'hidden',
                          flexShrink: 0,
                          transition: 'border-radius 280ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                        }}
                      >
                        <img
                          src={sizedArtwork(t.thumbnailUrl, 120)}
                          alt={t.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleArtworkError(e, t.thumbnailUrl)}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 700,
                            color: isThisTrackPlaying
                              ? 'var(--md-sys-color-primary)'
                              : 'var(--md-sys-color-on-surface)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {t.title}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            color: 'var(--md-sys-color-on-surface-variant)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {t.artist}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--md-sys-color-outline)',
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        {formatDuration(t.duration)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLikeTrack(t);
                        }}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: liked ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0
                        }}
                        title={liked ? 'Unlike' : 'Like'}
                      >
                        <span
                          className={`material-symbols-rounded ${liked ? 'filled' : ''}`}
                          style={{ fontSize: '16px' }}
                        >
                          favorite
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive 3D Artwork Collage */}
        {CollageDeck}
      </div>
    </section>
  );
};
