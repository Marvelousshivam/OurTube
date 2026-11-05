import React, { useEffect, useState, useRef } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { lyricsService } from '../../api/lyricsService';
import { LyricsData } from '../../types';

export interface LyricsSheetProps {
  isEmbedded?: boolean;
}

export const LyricsSheet: React.FC<LyricsSheetProps> = ({ isEmbedded = false }) => {
  const { currentTrack, currentTime, duration, seek, setLyricsOpen } = usePlayerStore();
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!currentTrack) {
      setLyricsData(null);
      return;
    }

    setLoading(true);
    lyricsService
      .getLyrics(currentTrack.title, currentTrack.artist, currentTrack.duration || duration)
      .then((data) => {
        setLyricsData(data);
        setLoading(false);
      })
      .catch(() => {
        setLyricsData(null);
        setLoading(false);
      });
  }, [currentTrack]);

  // Find active line index based on current playback time
  let activeIndex = -1;
  if (lyricsData?.lines && lyricsData.lines.length > 0) {
    for (let i = lyricsData.lines.length - 1; i >= 0; i--) {
      if (currentTime >= lyricsData.lines[i].time) {
        activeIndex = i;
        break;
      }
    }
  }

  // Strictly container-scoped smooth scrolling: NEVER call element.scrollIntoView!
  // scrollIntoView() scrolls all ancestor elements including the window/page, which pushes the top bar out of view.
  useEffect(() => {
    const container = scrollContainerRef.current;
    const activeEl = activeLineRef.current;
    if (container && activeEl) {
      // Calculate active element offset relative to the scrolling container
      const targetScroll =
        activeEl.offsetTop - (container.clientHeight * 0.42) + (activeEl.clientHeight / 2);

      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    }
  }, [activeIndex]);

  const handleCopyLyrics = async () => {
    if (!lyricsData || lyricsData.lines.length === 0) return;
    const fullText = lyricsData.lines.map((l) => l.text).join('\n');
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        maxWidth: isEmbedded ? '100%' : '760px',
        margin: '0 auto',
        padding: isEmbedded ? '0 12px' : '20px 24px',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Standalone Header (Only shown when opened as modal sheet in mobile, omitted when embedded in widescreen) */}
      {!isEmbedded && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              className="material-symbols-rounded"
              style={{ color: 'var(--md-sys-color-primary)', fontSize: '22px' }}
            >
              lyrics
            </span>
            <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.01em' }}>Lyrics</h2>
            {lyricsData?.synced && (
              <span
                className="glass-pill"
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  color: 'var(--md-sys-color-primary)'
                }}
              >
                SYNCED
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleCopyLyrics}
              disabled={!lyricsData || lyricsData.lines.length === 0}
              className="glass-pill"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '9999px',
                border: 'none',
                color: copied ? '#4caf50' : 'var(--md-sys-color-primary)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: lyricsData && lyricsData.lines.length > 0 ? 'pointer' : 'default',
                opacity: lyricsData && lyricsData.lines.length > 0 ? 1 : 0.5,
                transition: 'all 200ms ease'
              }}
              title="Copy lyrics"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={() => setLyricsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--md-sys-color-on-surface)',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '50%'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
                close
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Lyrics Scroll Canvas: Apple Music / BitChord caliber smooth flowing typography */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          scrollBehavior: 'smooth',
          padding: isEmbedded ? '32px 8px 180px 8px' : '40px 12px 140px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: isEmbedded ? '32px' : '26px',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 88%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 88%, transparent 100%)'
        }}
      >
        {loading && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '320px',
              gap: '16px',
              color: 'var(--md-sys-color-outline)'
            }}
          >
            <span
              className="material-symbols-rounded"
              style={{ fontSize: '36px', animation: 'spin 1.5s linear infinite' }}
            >
              progress_activity
            </span>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Syncing lyrics stream...</span>
          </div>
        )}

        {!loading && (!lyricsData || lyricsData.lines.length === 0) && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '320px',
              gap: '16px',
              color: 'var(--md-sys-color-outline)'
            }}
          >
            <span
              className="material-symbols-rounded"
              style={{ fontSize: '42px', opacity: 0.6 }}
            >
              music_off
            </span>
            <span style={{ fontSize: '15px', fontWeight: 600 }}>
              No synced lyrics found for this track.
            </span>
          </div>
        )}

        {!loading &&
          lyricsData?.lines.map((line, idx) => {
            const isActive = idx === activeIndex;
            return (
              <div
                key={idx}
                ref={isActive ? activeLineRef : null}
                onClick={() => seek(line.time)}
                style={{
                  fontSize: isEmbedded
                    ? 'clamp(26px, 2.6vw, 38px)'
                    : 'clamp(20px, 4vw, 28px)',
                  fontWeight: isActive ? 800 : 700,
                  lineHeight: '1.45',
                  letterSpacing: '-0.02em',
                  color: isActive ? '#ffffff' : 'var(--md-sys-color-on-surface)',
                  opacity: isActive ? 1 : 0.28,
                  filter: isActive ? 'none' : 'blur(0.2px)',
                  transform: isActive ? 'scale(1.025)' : 'scale(1)',
                  transformOrigin: 'left center',
                  cursor: 'pointer',
                  transition: 'all 320ms cubic-bezier(0.2, 0, 0, 1)',
                  textShadow: isActive ? '0 4px 24px rgba(255, 255, 255, 0.35)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.opacity = '0.7';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.opacity = '0.28';
                }}
              >
                {line.text}
              </div>
            );
          })}
      </div>
    </div>
  );
};
