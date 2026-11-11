import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { LyricClock } from '../../lyrics/clock';
import { writeLrc, writeTtml } from '../../lyrics/ttml';
import { line } from '../../lyrics/model';
import { enabledSources, useLyricsSettings } from '../../lyrics/settings';
import { sourceById, type LyricsSourceId } from '../../lyrics/sources';
import { LyricsSettingsModal } from './LyricsSettingsModal';
import '@uimaxbai/am-lyrics/am-lyrics.js';

interface AmLyricsElement extends HTMLElement {
  currentTime: number;
  ttml: string;
  isLoading: boolean;
  autoScroll: boolean;
  interpolate: boolean;
  allowSkip: boolean;
}

/**
 * Shadow DOM Material Design 3 stylesheet adopted into <am-lyrics>:
 * 1. Fixes @uimaxbai/am-lyrics far-line opacity bug (lines 5+ around .active were jumping back to 0.8).
 * 2. Hides the broken internal <select> ("Auto") header and footer while keeping internal romanize/translate buttons clickable programmatically.
 * 3. Styles active/inactive lines, romanized lines, translated lines, and background vocals with M3 Expressive tokens.
 */
const AM_LYRICS_M3_SHADOW_CSS = `
  .lyrics-header {
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    overflow: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
    clip: rect(0 0 0 0) !important;
  }
  .lyrics-footer {
    visibility: hidden !important;
    pointer-events: none !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .lyrics-line:not(.active):not(.active + .lyrics-line):not(.active + .lyrics-line + .lyrics-line):not(.active + .lyrics-line + .lyrics-line + .lyrics-line):not(:has(+ .active)):not(:has(+ .lyrics-line + .active)):not(:has(+ .lyrics-line + .lyrics-line + .active)):not(:has(+ .lyrics-line + .lyrics-line + .lyrics-line + .active)) {
    opacity: 0.36 !important;
  }
  .lyrics-line {
    border-radius: 16px !important;
    transition: opacity 280ms cubic-bezier(0.2, 0.9, 0.3, 1), transform 320ms cubic-bezier(0.2, 0.9, 0.3, 1), filter 280ms ease !important;
  }
  .lyrics-line:hover {
    background-color: color-mix(in srgb, var(--md-sys-color-on-surface, #ffffff) 7%, transparent) !important;
  }
`;

let amLyricsShadowSheet: CSSStyleSheet | null = null;
function getAmLyricsShadowSheet(): CSSStyleSheet | null {
  if (typeof CSSStyleSheet === 'undefined') return null;
  if (!amLyricsShadowSheet) {
    try {
      amLyricsShadowSheet = new CSSStyleSheet();
      amLyricsShadowSheet.replaceSync(AM_LYRICS_M3_SHADOW_CSS);
    } catch {
      return null;
    }
  }
  return amLyricsShadowSheet;
}

interface LyricsSheetProps {
  isEmbedded?: boolean;
}

export const LyricsSheet: React.FC<LyricsSheetProps> = ({ isEmbedded = false }) => {
  const {
    currentTrack,
    isPlaying,
    playbackMode,
    seek,
    setLyricsOpen,
    lyricsData,
    isLyricsLoading,
    lyricsSourceStates,
    selectedLyricsSource,
    lyricsTimingOffsetMs,
    setSelectedLyricsSource,
    setLyricsTimingOffsetMs,
    loadLyricsForTrack
  } = usePlayerStore();

  // Subscribe to settings order/disabled so provider menu stays reactive
  useLyricsSettings((s) => s.order);
  useLyricsSettings((s) => s.disabled);

  const containerRef = useRef<HTMLDivElement>(null);
  const amElementRef = useRef<AmLyricsElement | null>(null);
  const clockRef = useRef<LyricClock>(new LyricClock(0));
  const discontinuityRef = useRef(0);
  const seekRef = useRef(seek);
  seekRef.current = seek;

  const offsetRef = useRef(lyricsTimingOffsetMs);
  offsetRef.current = lyricsTimingOffsetMs;

  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRomanized, setIsRomanized] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const providerMenuRef = useRef<HTMLDivElement>(null);

  // Close provider dropdown when clicking outside
  useEffect(() => {
    if (!isProviderMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!providerMenuRef.current?.contains(e.target as Node)) {
        setIsProviderMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsProviderMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isProviderMenuOpen]);

  // Reset romanize/translate UI toggles and ensure lyrics load when track changes
  useEffect(() => {
    setIsRomanized(false);
    setIsTranslated(false);
    discontinuityRef.current += 1;
    clockRef.current.hold(0, performance.now());
    if (currentTrack && !lyricsData && !isLyricsLoading) {
      void loadLyricsForTrack(currentTrack);
    }
  }, [currentTrack?.id]);

  // Trigger <am-lyrics> internal Romanize / Translate header buttons inside Shadow DOM
  const toggleAmLyricsHeaderControl = (kind: 'romanize' | 'translate') => {
    const el = amElementRef.current;
    const root = el?.shadowRoot;
    if (!root) return;

    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.lyrics-header button, .header-controls button, button')
    );

    const targetBtn =
      kind === 'romanize'
        ? buttons.find((b) => {
            const label = `${b.title || ''} ${b.getAttribute('aria-label') || ''} ${b.className || ''}`.toLowerCase();
            return label.includes('roman') || label.includes('pronun') || label.includes('voice');
          }) ?? buttons[0]
        : buttons.find((b) => {
            const label = `${b.title || ''} ${b.getAttribute('aria-label') || ''} ${b.className || ''}`.toLowerCase();
            return label.includes('translat');
          }) ?? buttons[1];

    if (targetBtn) {
      targetBtn.click();
      if (kind === 'romanize') setIsRomanized((v) => !v);
      else setIsTranslated((v) => !v);
    }
  };

  // Download active lyrics as .ttml (when word-synced) or .lrc
  const handleDownloadLyrics = () => {
    if (!currentTrack || !lyricsData || !lyricsData.lines.length) return;
    const isWordSynced = Boolean(lyricsData.wordSynced);
    const ext = isWordSynced ? 'ttml' : 'lrc';
    const content = isWordSynced
      ? lyricsData.ttml ||
        writeTtml(
          lyricsData.lines.map((l) => line(Math.round(l.time * 1000), l.text))
        )
      : writeLrc(
          lyricsData.lines.map((l) => line(Math.round(l.time * 1000), l.text))
        );

    const safeName = `${currentTrack.artist} - ${currentTrack.title}`
      .replace(/[\\/:*?"<>|]+/g, '_')
      .trim();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName || 'lyrics'}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Mount <am-lyrics> with el.ttml set BEFORE attaching to DOM (matching BitChord's LyricsPanel.tsx):
  // <am-lyrics> starts an internal provider fetch if attached without el.ttml or if song-title/song-artist
  // attributes are touched, which finishes with an empty query and overwrites our TTML with "No lyrics found."
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!lyricsData || !lyricsData.lines || lyricsData.lines.length === 0) {
      if (amElementRef.current) {
        amElementRef.current.remove();
        amElementRef.current = null;
      }
      container.innerHTML = '';
      return;
    }

    const ttmlString =
      lyricsData.ttml ||
      writeTtml(lyricsData.lines.map((l) => line(Math.round(l.time * 1000), l.text)));

    let el = amElementRef.current;
    if (!el) {
      el = document.createElement('am-lyrics') as AmLyricsElement;
      // CRITICAL: Set el.ttml BEFORE appending to the DOM so <am-lyrics> never fires its own empty fetch
      el.ttml = ttmlString;
      el.interpolate = Boolean(lyricsData.wordSynced);
      el.autoScroll = true;
      el.allowSkip = true;
      el.isLoading = false;
      el.style.display = 'block';
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.setProperty('--am-lyrics-highlight-color', 'var(--md-sys-color-on-surface)');
      el.style.setProperty('--light-highlight-color', 'var(--md-sys-color-on-surface)');
      el.style.setProperty('--dark-highlight-color', 'var(--md-sys-color-on-surface)');
      el.style.setProperty(
        '--hover-background-color',
        'color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent)'
      );
      el.style.setProperty(
        'font-family',
        'var(--md-sys-typescale-display-font, "Plus Jakarta Sans", system-ui, sans-serif)'
      );

      const handleLineClick = (e: Event) => {
        const customEvent = e as CustomEvent<{ timestamp?: number }>;
        if (customEvent.detail && typeof customEvent.detail.timestamp === 'number') {
          const targetMs = Math.max(0, customEvent.detail.timestamp - offsetRef.current);
          discontinuityRef.current += 1;
          clockRef.current.hold(customEvent.detail.timestamp, performance.now());
          if (amElementRef.current) {
            amElementRef.current.currentTime = customEvent.detail.timestamp;
          }
          seekRef.current(targetMs / 1000);
        }
      };

      el.addEventListener('line-click', handleLineClick);
      container.innerHTML = '';
      container.appendChild(el);
      amElementRef.current = el;
    } else {
      el.interpolate = Boolean(lyricsData.wordSynced);
      el.autoScroll = true;
      el.allowSkip = true;
      el.isLoading = false;
      if (el.ttml !== ttmlString) {
        el.ttml = ttmlString;
      }
    }

    const injectShadowStyles = () => {
      const sheet = getAmLyricsShadowSheet();
      const root = el?.shadowRoot;
      if (sheet && root && !root.adoptedStyleSheets.includes(sheet)) {
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      }
    };

    injectShadowStyles();
    void Promise.resolve((el as any).updateComplete).then(injectShadowStyles);
  }, [lyricsData]);

  useEffect(() => {
    return () => {
      amElementRef.current?.remove();
      amElementRef.current = null;
    };
  }, []);

  // Direct hardware <audio>/<video> playhead sync loop (runs rAF ONLY while playing!)
  useEffect(() => {
    const getActiveMediaElement = (): HTMLMediaElement | null => {
      if (playbackMode === 'video') {
        const videoEl = document.querySelector('video');
        if (videoEl) return videoEl;
      }
      return document.querySelector('audio') || document.querySelector('video');
    };

    const media = getActiveMediaElement();
    const clock = clockRef.current;
    let rafId = 0;

    const readPlayheadMs = () => {
      const activeMedia = getActiveMediaElement();
      const rawMs = activeMedia
        ? activeMedia.currentTime * 1000
        : usePlayerStore.getState().currentTime * 1000;
      return Math.max(0, rawMs + offsetRef.current);
    };

    const step = (frameNow: number) => {
      rafId = 0;
      const activeMedia = getActiveMediaElement();
      const playing = activeMedia ? !activeMedia.paused && !activeMedia.ended : isPlaying;
      const reportedMs = readPlayheadMs();
      if (playing) {
        const at = clock.frame(frameNow, reportedMs, frameNow, discontinuityRef.current);
        if (amElementRef.current) {
          amElementRef.current.currentTime = at;
        }
        rafId = requestAnimationFrame(step);
      } else {
        clock.hold(reportedMs, frameNow);
        if (amElementRef.current) {
          amElementRef.current.currentTime = reportedMs;
        }
      }
    };

    const start = () => {
      if (!rafId) rafId = requestAnimationFrame(step);
    };

    const stop = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      const reportedMs = readPlayheadMs();
      clock.hold(reportedMs, performance.now());
      if (amElementRef.current) {
        amElementRef.current.currentTime = reportedMs;
      }
    };

    const jump = () => {
      discontinuityRef.current += 1;
      const reportedMs = readPlayheadMs();
      clock.hold(reportedMs, performance.now());
      if (amElementRef.current) {
        amElementRef.current.currentTime = reportedMs;
      }
    };

    jump();
    if (isPlaying) start();

    if (media) {
      media.addEventListener('play', start);
      media.addEventListener('playing', start);
      media.addEventListener('pause', stop);
      media.addEventListener('ended', stop);
      media.addEventListener('seeking', jump);
      media.addEventListener('seeked', jump);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (media) {
        media.removeEventListener('play', start);
        media.removeEventListener('playing', start);
        media.removeEventListener('pause', stop);
        media.removeEventListener('ended', stop);
        media.removeEventListener('seeking', jump);
        media.removeEventListener('seeked', jump);
      }
    };
  }, [isPlaying, playbackMode, currentTrack?.id, lyricsTimingOffsetMs]);

  if (!currentTrack) return null;

  const sources = enabledSources();
  const activeSourceLabel = selectedLyricsSource
    ? sourceById(selectedLyricsSource)?.label ?? selectedLyricsSource
    : lyricsData?.label
      ? `Auto · ${lyricsData.label}`
      : 'Auto';

  const hasLyrics = Boolean(lyricsData && lyricsData.lines && lyricsData.lines.length > 0);
  const offsetSecondsText =
    lyricsTimingOffsetMs === 0
      ? '0.0s'
      : `${lyricsTimingOffsetMs > 0 ? '+' : ''}${(lyricsTimingOffsetMs / 1000).toFixed(2).replace(/0$/, '')}s`;

  const renderSourceStatusBadge = (id: LyricsSourceId) => {
    const state = lyricsSourceStates[id];
    if (state === 'pending') {
      return (
        <span
          className="material-symbols-rounded"
          style={{
            fontSize: '15px',
            color: 'var(--md-sys-color-primary)',
            animation: 'm3Spin 1s linear infinite'
          }}
        >
          progress_activity
        </span>
      );
    }
    if (state === 'found') {
      return (
        <span
          className="material-symbols-rounded"
          style={{ fontSize: '16px', color: 'var(--md-sys-color-primary)' }}
        >
          check_circle
        </span>
      );
    }
    if (state === 'missing') {
      return (
        <span
          className="material-symbols-rounded"
          style={{
            fontSize: '15px',
            color: 'var(--md-sys-color-on-surface-variant)',
            opacity: 0.55
          }}
        >
          remove
        </span>
      );
    }
    return null;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        maxWidth: isEmbedded ? 'none' : '920px',
        margin: '0 auto',
        padding: isEmbedded ? '10px 8px 16px 8px' : '20px 32px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <style>{`
        @keyframes m3Spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes m3MenuIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Non-Embedded Mobile / Sheet Header */}
      {!isEmbedded && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              className="material-symbols-rounded"
              style={{ fontSize: '26px', color: 'var(--md-sys-color-primary)' }}
            >
              lyrics
            </span>
            <div>
              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  margin: 0,
                  color: 'var(--md-sys-color-on-surface)'
                }}
              >
                Lyrics
              </h2>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--md-sys-color-on-surface-variant)'
                }}
              >
                {lyricsData
                  ? `Source: ${lyricsData.label || lyricsData.provider} (${
                      lyricsData.wordSynced
                        ? 'Syllable / Word Synced'
                        : lyricsData.synced
                          ? 'Line Synced'
                          : 'Plain Text'
                    })`
                  : 'Searching 15 lyric sources...'}
              </span>
            </div>
          </div>

          <button
            onClick={() => setLyricsOpen(false)}
            style={{
              background: 'var(--md-sys-color-surface-container-high)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              borderRadius: '9999px',
              padding: '8px 16px',
              color: 'var(--md-sys-color-on-surface)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 700
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
              close
            </span>
            Close
          </button>
        </div>
      )}

      {/* ================= MATERIAL DESIGN 3 EXPRESSIVE CONTROL BAR ================= */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 10px',
          marginBottom: '10px',
          borderRadius: '18px',
          backgroundColor: 'var(--md-sys-color-surface-container)',
          border: '1px solid var(--md-sys-color-outline-variant)',
          flexShrink: 0,
          position: 'relative',
          zIndex: 30
        }}
      >
        {/* Left Group: Pronunciation, Translation & Timing Offset Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {/* Pronunciation / Romanize M3 Filter Chip */}
          <button
            type="button"
            disabled={!hasLyrics}
            onClick={() => toggleAmLyricsHeaderControl('romanize')}
            title="Toggle Romanized Pronunciation"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '32px',
              padding: '0 12px',
              borderRadius: isRomanized ? '10px' : '9999px',
              border: '1px solid var(--md-sys-color-outline-variant)',
              backgroundColor: isRomanized
                ? 'var(--md-sys-color-secondary-container)'
                : 'var(--md-sys-color-surface-container-high)',
              color: isRomanized
                ? 'var(--md-sys-color-on-secondary-container)'
                : 'var(--md-sys-color-on-surface)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: hasLyrics ? 'pointer' : 'default',
              opacity: hasLyrics ? 1 : 0.45,
              transition: 'all 180ms cubic-bezier(0.2, 0.9, 0.3, 1)'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
              record_voice_over
            </span>
            <span>Pronounce</span>
          </button>

          {/* Translation M3 Filter Chip */}
          <button
            type="button"
            disabled={!hasLyrics}
            onClick={() => toggleAmLyricsHeaderControl('translate')}
            title="Toggle Lyrics Translation"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '32px',
              padding: '0 12px',
              borderRadius: isTranslated ? '10px' : '9999px',
              border: '1px solid var(--md-sys-color-outline-variant)',
              backgroundColor: isTranslated
                ? 'var(--md-sys-color-tertiary-container, var(--md-sys-color-secondary-container))'
                : 'var(--md-sys-color-surface-container-high)',
              color: isTranslated
                ? 'var(--md-sys-color-on-tertiary-container, var(--md-sys-color-on-secondary-container))'
                : 'var(--md-sys-color-on-surface)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: hasLyrics ? 'pointer' : 'default',
              opacity: hasLyrics ? 1 : 0.45,
              transition: 'all 180ms cubic-bezier(0.2, 0.9, 0.3, 1)'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
              translate
            </span>
            <span>Translate</span>
          </button>

          {/* Sync Offset Nudge Pill (-0.25s / 0.0s / +0.25s) */}
          {hasLyrics && lyricsData?.synced && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: '32px',
                borderRadius: '9999px',
                backgroundColor:
                  lyricsTimingOffsetMs !== 0
                    ? 'var(--md-sys-color-primary-container)'
                    : 'var(--md-sys-color-surface-container-high)',
                color:
                  lyricsTimingOffsetMs !== 0
                    ? 'var(--md-sys-color-on-primary-container)'
                    : 'var(--md-sys-color-on-surface)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                overflow: 'hidden'
              }}
              title="Nudge lyric sync timing (click center to reset)"
            >
              <button
                type="button"
                onClick={() => setLyricsTimingOffsetMs(lyricsTimingOffsetMs - 250)}
                aria-label="Delay lyrics by 0.25s"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  padding: '0 8px',
                  height: '100%',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 800
                }}
              >
                −
              </button>
              <button
                type="button"
                onClick={() => setLyricsTimingOffsetMs(0)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  padding: '0 6px',
                  height: '100%',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {offsetSecondsText}
              </button>
              <button
                type="button"
                onClick={() => setLyricsTimingOffsetMs(lyricsTimingOffsetMs + 250)}
                aria-label="Advance lyrics by 0.25s"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  padding: '0 8px',
                  height: '100%',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 800
                }}
              >
                +
              </button>
            </div>
          )}
        </div>

        {/* Right Group: M3 Provider Switcher Chip + Download + Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Provider Switcher Menu Container */}
          <div ref={providerMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsProviderMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={isProviderMenuOpen}
              title="Switch lyric provider"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '32px',
                padding: '0 10px 0 12px',
                borderRadius: isProviderMenuOpen ? '10px' : '9999px',
                border: '1px solid var(--md-sys-color-outline-variant)',
                backgroundColor:
                  selectedLyricsSource !== null
                    ? 'var(--md-sys-color-primary-container)'
                    : 'var(--md-sys-color-surface-container-high)',
                color:
                  selectedLyricsSource !== null
                    ? 'var(--md-sys-color-on-primary-container)'
                    : 'var(--md-sys-color-on-surface)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 180ms cubic-bezier(0.2, 0.9, 0.3, 1)'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>
                {lyricsData?.wordSynced
                  ? 'auto_awesome'
                  : lyricsData?.synced
                    ? 'schedule'
                    : 'subject'}
              </span>
              <span
                style={{
                  maxWidth: '140px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {activeSourceLabel}
              </span>
              <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                {isProviderMenuOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {/* M3 Provider Switcher Dropdown Menu */}
            {isProviderMenuOpen && (
              <div
                role="menu"
                aria-label="Lyric providers"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: '264px',
                  maxHeight: '380px',
                  overflowY: 'auto',
                  borderRadius: '18px',
                  backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.48)',
                  padding: '6px',
                  zIndex: 100,
                  animation: 'm3MenuIn 160ms cubic-bezier(0.2, 0.9, 0.3, 1)'
                }}
              >
                {/* Best Available (Auto) Option */}
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={selectedLyricsSource === null}
                  onClick={() => {
                    setIsProviderMenuOpen(false);
                    void setSelectedLyricsSource(null);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '9px 12px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor:
                      selectedLyricsSource === null
                        ? 'var(--md-sys-color-secondary-container)'
                        : 'transparent',
                    color:
                      selectedLyricsSource === null
                        ? 'var(--md-sys-color-on-secondary-container)'
                        : 'var(--md-sys-color-on-surface)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '17px' }}>
                      auto_awesome
                    </span>
                    <div>
                      <div>Best available (Auto)</div>
                      {lyricsData?.label && selectedLyricsSource === null && (
                        <div style={{ fontSize: '10.5px', opacity: 0.78 }}>
                          Active: {lyricsData.label}
                        </div>
                      )}
                    </div>
                  </div>
                  {selectedLyricsSource === null && (
                    <span className="material-symbols-rounded" style={{ fontSize: '17px' }}>
                      check
                    </span>
                  )}
                </button>

                <div
                  style={{
                    height: '1px',
                    backgroundColor: 'var(--md-sys-color-outline-variant)',
                    margin: '5px 6px'
                  }}
                />

                {/* All Enabled Sources with Live Status */}
                {sources.map((id) => {
                  const src = sourceById(id);
                  if (!src) return null;
                  const isSelected = selectedLyricsSource === id;
                  const isCurrentAutoWinner =
                    selectedLyricsSource === null && lyricsData?.sourceId === id;

                  return (
                    <button
                      key={id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setIsProviderMenuOpen(false);
                        void setSelectedLyricsSource(id);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        padding: '8px 12px',
                        borderRadius: '11px',
                        border: 'none',
                        backgroundColor: isSelected
                          ? 'var(--md-sys-color-secondary-container)'
                          : isCurrentAutoWinner
                            ? 'color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent)'
                            : 'transparent',
                        color: isSelected
                          ? 'var(--md-sys-color-on-secondary-container)'
                          : 'var(--md-sys-color-on-surface)',
                        fontSize: '12.5px',
                        fontWeight: isSelected || isCurrentAutoWinner ? 700 : 600,
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {src.label}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {renderSourceStatusBadge(id)}
                      </span>
                    </button>
                  );
                })}

                <div
                  style={{
                    height: '1px',
                    backgroundColor: 'var(--md-sys-color-outline-variant)',
                    margin: '5px 6px'
                  }}
                />

                {/* Open Lyric Settings Modal */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsProviderMenuOpen(false);
                    setIsSettingsOpen(true);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 12px',
                    borderRadius: '11px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--md-sys-color-primary)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '17px' }}>
                    tune
                  </span>
                  <span>Configure lyric sources…</span>
                </button>
              </div>
            )}
          </div>

          {/* Download Lyrics (.ttml / .lrc) Button */}
          <button
            type="button"
            disabled={!hasLyrics}
            onClick={handleDownloadLyrics}
            title={
              lyricsData?.wordSynced
                ? 'Download word-synced TTML lyrics'
                : 'Download LRC lyrics'
            }
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '1px solid var(--md-sys-color-outline-variant)',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              color: 'var(--md-sys-color-on-surface)',
              display: 'grid',
              placeItems: 'center',
              cursor: hasLyrics ? 'pointer' : 'default',
              opacity: hasLyrics ? 1 : 0.45
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '17px' }}>
              download
            </span>
          </button>

          {/* Lyric Settings Dialog Trigger */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            title="Lyric sources & priority settings"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '1px solid var(--md-sys-color-outline-variant)',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              color: 'var(--md-sys-color-on-surface)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '17px' }}>
              tune
            </span>
          </button>
        </div>
      </div>

      {/* ================= LYRICS VIEWPORT ================= */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '20px'
        }}
      >
        {/* Loading Overlay */}
        {isLyricsLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              backgroundColor:
                'color-mix(in srgb, var(--md-sys-color-background) 78%, transparent)',
              backdropFilter: 'blur(6px)',
              color: 'var(--md-sys-color-on-surface-variant)'
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '3px solid var(--md-sys-color-surface-container-highest)',
                borderTopColor: 'var(--md-sys-color-primary)',
                animation: 'm3Spin 0.85s linear infinite'
              }}
            />
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--md-sys-color-on-surface)'
                }}
              >
                {selectedLyricsSource
                  ? `Fetching from ${sourceById(selectedLyricsSource)?.label ?? selectedLyricsSource}...`
                  : 'Racing 15 lyric providers...'}
              </div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Matching syllable & word timings for "{currentTrack.title}"
              </div>
            </div>
          </div>
        )}

        {/* Empty / Not Found State */}
        {!isLyricsLoading && !hasLyrics && (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '14px',
              padding: '32px',
              color: 'var(--md-sys-color-on-surface-variant)'
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '20px',
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                color: 'var(--md-sys-color-primary)',
                display: 'grid',
                placeItems: 'center'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '28px' }}>
                music_off
              </span>
            </div>
            <div>
              <p
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  color: 'var(--md-sys-color-on-surface)',
                  margin: 0
                }}
              >
                {selectedLyricsSource
                  ? `No lyrics on ${sourceById(selectedLyricsSource)?.label ?? selectedLyricsSource}`
                  : 'No lyrics found for this track'}
              </p>
              <p style={{ fontSize: '13px', margin: '6px 0 0 0', maxWidth: '340px' }}>
                {selectedLyricsSource
                  ? 'Try switching back to Best available (Auto) or pick another source from the menu above.'
                  : 'We checked lrc.red, BiniLyrics, BetterLyrics, PaxSenix, LyricsPlus, Unison, YouTube, KuGou, LRCLIB, Musixmatch, and Genius.'}
              </p>
            </div>
            {selectedLyricsSource !== null && (
              <button
                type="button"
                onClick={() => void setSelectedLyricsSource(null)}
                style={{
                  marginTop: '4px',
                  padding: '9px 18px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Switch to Best available (Auto)
              </button>
            )}
          </div>
        )}

        {/* Persistent <am-lyrics> Host Container */}
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            visibility: hasLyrics && !isLyricsLoading ? 'visible' : 'hidden'
          }}
        />
      </div>

      {/* M3 Lyric Settings Modal */}
      <LyricsSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
