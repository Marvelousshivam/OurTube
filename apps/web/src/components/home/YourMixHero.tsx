import React from 'react';
import { TrackMetadata } from '../../types';
import { sizedArtwork } from '../../api/artworkService';

interface YourMixHeroProps {
  tracks: TrackMetadata[];
  onPlayMix: (tracks: TrackMetadata[]) => void;
  onTrackClick?: (track: TrackMetadata) => void;
  isWideScreen?: boolean;
}

export const YourMixHero: React.FC<YourMixHeroProps> = ({
  tracks,
  onPlayMix,
  onTrackClick,
  isWideScreen = true
}) => {
  if (!tracks || tracks.length === 0) return null;

  // The 3 tracks that compose the organic collage
  const primaryTrack = tracks[0];
  const secondaryTrack = tracks[1] || tracks[0];
  const tertiaryTrack = tracks[2] || tracks[0];

  // Derive artist roster subtitle
  const artistRoster = Array.from(new Set(tracks.map((t) => t.artist)))
    .slice(0, 4)
    .join(', ');

  const handlePlayClick = () => {
    onPlayMix(tracks);
  };

  /* ================= ORGANIC COLLAGE DECK ================= */
  const CollageDeck = (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: isWideScreen ? '440px' : '340px',
        aspectRatio: '1 / 1',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {/* 1. Center Piece: Large Tilted Organic Pebble Artwork */}
      <div
        onClick={() => onTrackClick?.(primaryTrack)}
        style={{
          width: '78%',
          height: '78%',
          borderRadius: '46% 54% 60% 40% / 48% 42% 58% 52%',
          transform: 'rotate(-12deg)',
          overflow: 'hidden',
          backgroundColor: 'var(--md-sys-color-surface-container-high)',
          boxShadow: '0 20px 48px -8px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.2))',
          cursor: 'pointer',
          transition: 'transform 400ms cubic-bezier(0.2, 0.9, 0.3, 1)',
          position: 'relative',
          zIndex: 2
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'rotate(-8deg) scale(1.02)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'rotate(-12deg) scale(1)')}
        title={primaryTrack.title}
      >
        <img
          src={sizedArtwork(primaryTrack.highResThumbnailUrl || primaryTrack.thumbnailUrl, 800)}
          alt={primaryTrack.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* 2. Top-Left Floating Circular Satellite */}
      <div
        onClick={() => onTrackClick?.(secondaryTrack)}
        style={{
          position: 'absolute',
          top: '2%',
          left: '2%',
          width: isWideScreen ? '136px' : '108px',
          height: isWideScreen ? '136px' : '108px',
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: 'var(--md-sys-color-surface-container-high)',
          boxShadow: '0 12px 32px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.18))',
          border: '3px solid var(--md-sys-color-background)',
          cursor: 'pointer',
          zIndex: 3,
          transition: 'transform 300ms ease'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08) translateY(-4px)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        title={secondaryTrack.title}
      >
        <img
          src={sizedArtwork(secondaryTrack.highResThumbnailUrl || secondaryTrack.thumbnailUrl, 400)}
          alt={secondaryTrack.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* 3. Bottom-Right Floating Circular Satellite */}
      <div
        onClick={() => onTrackClick?.(tertiaryTrack)}
        style={{
          position: 'absolute',
          bottom: '4%',
          right: '4%',
          width: isWideScreen ? '124px' : '98px',
          height: isWideScreen ? '124px' : '98px',
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: 'var(--md-sys-color-surface-container-high)',
          boxShadow: '0 12px 32px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.18))',
          border: '3px solid var(--md-sys-color-background)',
          cursor: 'pointer',
          zIndex: 3,
          transition: 'transform 300ms ease'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08) translateY(4px)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        title={tertiaryTrack.title}
      >
        <img
          src={sizedArtwork(tertiaryTrack.highResThumbnailUrl || tertiaryTrack.thumbnailUrl, 400)}
          alt={tertiaryTrack.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    </div>
  );

  return (
    <section
      style={{
        width: '100%',
        margin: '0 auto 28px auto'
      }}
    >
      {isWideScreen ? (
        /* ================= WIDESCREEN MAGAZINE HERO SPREAD ================= */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(380px, 48%) 1fr',
            gap: 'clamp(40px, 5vw, 80px)',
            alignItems: 'center',
            padding: '24px 0'
          }}
        >
          {/* Left Column: Expressive Headline & Play Action */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <h1
                  style={{
                    fontFamily: "'Syne', -apple-system, sans-serif",
                    fontSize: 'clamp(44px, 5.2vw, 76px)',
                    fontWeight: 900,
                    lineHeight: 0.96,
                    letterSpacing: '-0.04em',
                    margin: 0,
                    color: 'var(--md-sys-color-on-surface)'
                  }}
                >
                  Your
                  <br />
                  Mix
                </h1>

                <p
                  style={{
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--md-sys-color-on-surface-variant)',
                    margin: '14px 0 0 0',
                    maxWidth: '480px',
                    lineHeight: 1.4
                  }}
                >
                  {artistRoster}
                </p>
              </div>

              {/* Big Tactile Play Button (Material 3 Expressive FAB) */}
              <div>
                <button
                  onClick={handlePlayClick}
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.2))',
                    transition: 'transform 150ms ease, box-shadow 150ms ease'
                  }}
                  title="Play Your Mix"
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <span
                    className="material-symbols-rounded"
                    style={{ fontSize: '36px', fontVariationSettings: "'FILL' 1", marginLeft: '4px' }}
                  >
                    play_arrow
                  </span>
                </button>
              </div>
            </div>

            {/* Quick-Picks Preview Chips from the Mix */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--md-sys-color-primary)',
                  opacity: 0.8
                }}
              >
                In this mix
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {tracks.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onTrackClick?.(t)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 14px 6px 6px',
                      borderRadius: '9999px',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: 'var(--md-sys-color-surface-container)',
                      color: 'var(--md-sys-color-on-surface)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      maxWidth: '240px',
                      transition: 'all 150ms ease'
                    }}
                    title={`${t.title} • ${t.artist}`}
                  >
                    <img
                      src={sizedArtwork(t.thumbnailUrl, 60)}
                      alt={t.title}
                      style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Organic Artwork Collage */}
          {CollageDeck}
        </div>
      ) : (
        /* ================= MOBILE / COMPACT STACK ================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Row: Title & Play Button */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h1
                style={{
                  fontFamily: "'Syne', -apple-system, sans-serif",
                  fontSize: 'clamp(36px, 9vw, 48px)',
                  fontWeight: 900,
                  lineHeight: 0.95,
                  letterSpacing: '-0.03em',
                  margin: 0,
                  color: 'var(--md-sys-color-on-surface)'
                }}
              >
                Your
                <br />
                Mix
              </h1>
              <p
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--md-sys-color-on-surface-variant)',
                  margin: '8px 0 0 0',
                  lineHeight: 1.3
                }}
              >
                {artistRoster}
              </p>
            </div>

            {/* Play Button */}
            <div>
              <button
                onClick={handlePlayClick}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 6px 18px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.2))'
                }}
              >
                <span
                  className="material-symbols-rounded"
                  style={{ fontSize: '32px', fontVariationSettings: "'FILL' 1", marginLeft: '3px' }}
                >
                  play_arrow
                </span>
              </button>
            </div>
          </div>

          {/* Collage */}
          {CollageDeck}
        </div>
      )}
    </section>
  );
};
