import React, { useEffect, useState, useRef } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { LyricClock } from '../../lyrics/clock';
import { M3LoadingIndicator } from '../common/M3LoadingIndicator';

export interface LyricsSheetProps {
  isEmbedded?: boolean;
}

export const LyricsSheet: React.FC<LyricsSheetProps> = ({ isEmbedded = false }) => {
  const {
    currentTrack,
    currentTime,
    duration,
    isPlaying,
    seek,
    lyricsData,
    isLyricsLoading,
    loadLyricsForTrack,
    setLyricsOpen
  } = usePlayerStore();

  const [amLyricsSupported, setAmLyricsSupported] = useState(true);

  // Fallback line-by-line scroll refs
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // am-lyrics custom element refs
  const amContainerRef = useRef<HTMLDivElement | null>(null);
  const amElementRef = useRef<any>(null);

  // BitChord LyricClock refs
  const clockRef = useRef<LyricClock | null>(null);
  const lastTimeRef = useRef<number>(currentTime);
  const discontinuityRef = useRef<number>(0);

  // Ensure lyrics are loaded for current track
  useEffect(() => {
    if (currentTrack && !lyricsData && !isLyricsLoading) {
      loadLyricsForTrack(currentTrack);
    }
  }, [currentTrack, lyricsData, isLyricsLoading, loadLyricsForTrack]);

  // Mount & configure <am-lyrics> Web Component dynamically
  useEffect(() => {
    if (!lyricsData?.ttml || !amContainerRef.current) return;

    let mounted = true;

    import('@uimaxbai/am-lyrics/am-lyrics.js')
      .then(() => {
        if (!mounted || !amContainerRef.current) return;

        amContainerRef.current.innerHTML = '';

        const el = document.createElement('am-lyrics') as any;
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.display = 'block';

        // Apple Music typography & animation parameters
        el.autoScroll = true;
        el.interpolate = true;
        el.noAutoAlternates = true;
        el.lineMotion = 'staggered';
        el.highlightColor = '#ffffff';

        el.ttml = lyricsData.ttml;
        el.currentTime = currentTime * 1000;

        const handleLineClick = (e: any) => {
          const timestampMs = e?.detail?.timestamp;
          if (typeof timestampMs === 'number') {
            seek(timestampMs / 1000);
          }
        };

        el.addEventListener('line-click', handleLineClick);

        amContainerRef.current.appendChild(el);
        amElementRef.current = el;

        clockRef.current = new LyricClock(currentTime * 1000);
      })
      .catch((err) => {
        console.warn('[OurTube Lyrics] am-lyrics load error, fallback to lines:', err);
        setAmLyricsSupported(false);
      });

    return () => {
      mounted = false;
      if (amContainerRef.current) {
        amContainerRef.current.innerHTML = '';
      }
      amElementRef.current = null;
    };
  }, [lyricsData?.ttml]);

  // Keep LyricClock and am-lyrics in sync with seek / pause
  useEffect(() => {
    if (Math.abs(currentTime - lastTimeRef.current) > 1.2) {
      discontinuityRef.current++;
      clockRef.current?.hold(currentTime * 1000, performance.now());
    }
    lastTimeRef.current = currentTime;

    if (!isPlaying && amElementRef.current) {
      clockRef.current?.hold(currentTime * 1000, performance.now());
      amElementRef.current.currentTime = currentTime * 1000;
    }
  }, [currentTime, isPlaying]);

  // Frame interpolation loop for smooth word-by-word wipes
  useEffect(() => {
    let rafId: number;

    const tick = (now: number) => {
      if (isPlaying && amElementRef.current) {
        if (!clockRef.current) {
          clockRef.current = new LyricClock(currentTime * 1000);
        }
        const songMs = clockRef.current.frame(
          now,
          currentTime * 1000,
          now,
          discontinuityRef.current
        );
        amElementRef.current.currentTime = songMs;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, currentTime]);

  // Fallback line active index
  let activeIndex = -1;
  if (lyricsData?.lines && lyricsData.lines.length > 0) {
    for (let i = lyricsData.lines.length - 1; i >= 0; i--) {
      if (currentTime >= lyricsData.lines[i].time) {
        activeIndex = i;
        break;
      }
    }
  }

  // Smooth container-scoped scrolling for fallback line mode
  useEffect(() => {
    if (lyricsData?.ttml && amLyricsSupported) return;
    const container = scrollContainerRef.current;
    const activeEl = activeLineRef.current;
    if (container && activeEl) {
      const targetScroll =
        activeEl.offsetTop - container.clientHeight * 0.42 + activeEl.clientHeight / 2;
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    }
  }, [activeIndex, lyricsData?.ttml, amLyricsSupported]);

  const hasAmLyrics = Boolean(lyricsData?.ttml && amLyricsSupported);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        maxWidth: isEmbedded ? '100%' : '760px',
        margin: '0 auto',
        padding: isEmbedded ? '0' : '12px 20px',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Mobile sheet close button only (omitted when embedded in desktop companion panel) */}
      {!isEmbedded && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '4px 0 8px 0',
            flexShrink: 0
          }}
        >
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
            aria-label="Close lyrics"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
              close
            </span>
          </button>
        </div>
      )}

      {/* Main Viewport Container: Pure lyrics with top & bottom edge fade mask */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
          maskImage:
            'linear-gradient(to bottom, transparent 0%, black 5%, black 90%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 5%, black 90%, transparent 100%)'
        }}
      >
        {isLyricsLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '320px'
            }}
          >
            <M3LoadingIndicator contained size="md" message="Fetching word-synced lyrics..." />
          </div>
        )}

        {!isLyricsLoading && (!lyricsData || lyricsData.lines.length === 0) && (
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
            <span className="material-symbols-rounded" style={{ fontSize: '42px', opacity: 0.5 }}>
              music_off
            </span>
            <span style={{ fontSize: '15px', fontWeight: 600 }}>
              No synced lyrics found for this track.
            </span>
          </div>
        )}

        {/* Dynamic Apple Music word-by-word custom element mount */}
        {!isLyricsLoading && hasAmLyrics && (
          <div
            ref={amContainerRef}
            style={{
              width: '100%',
              height: '100%',
              overflow: 'hidden'
            }}
          />
        )}

        {/* Graceful fallback line-by-line renderer */}
        {!isLyricsLoading && !hasAmLyrics && lyricsData?.lines && lyricsData.lines.length > 0 && (
          <div
            ref={scrollContainerRef}
            style={{
              height: '100%',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              scrollBehavior: 'smooth',
              padding: isEmbedded ? '28px 8px 180px 8px' : '36px 12px 140px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: isEmbedded ? '30px' : '24px'
            }}
          >
            {lyricsData.lines.map((line, idx) => {
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
        )}
      </div>
    </div>
  );
};
