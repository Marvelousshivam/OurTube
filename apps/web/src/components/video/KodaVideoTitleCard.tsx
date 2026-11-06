import React, { useState } from 'react';
import { VideoItem, VideoWatchDetails } from '../../types';

interface KodaVideoTitleCardProps {
  video: VideoItem;
  details?: VideoWatchDetails | null;
  onSeekTo?: (seconds: number) => void;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Split stat text like "368K views" into figure ("368K") and word ("views")
 * or "6 years ago" into figure ("6 years") and word ("ago").
 */
function splitStat(text: string): [string, string] {
  const trimmed = text.trim();
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace <= 0) return [trimmed, ''];
  return [trimmed.slice(0, lastSpace), trimmed.slice(lastSpace + 1)];
}

/**
 * Parses timestamp string like "1:23" or "1:02:30" into seconds.
 */
function parseTimestampToSeconds(ts: string): number | null {
  const parts = ts.split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export const KodaVideoTitleCard: React.FC<KodaVideoTitleCardProps> = ({
  video,
  details,
  onSeekTo,
  style,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const displayTitle = details?.title || video.title || 'YouTube Video';
  const displayViews = details?.viewCount || video.viewCount || '';
  const displayDate = details?.publishedDate || video.uploadedDate || '';
  const description = (details?.description || video.description || '').trim();

  const [viewsFig, viewsWord] = displayViews ? splitStat(displayViews) : ['', ''];
  const [dateFig, dateWord] = displayDate ? splitStat(displayDate) : ['', ''];

  const hasStats = Boolean(viewsFig || dateFig);
  const canExpand = Boolean(description || hasStats);

  // Parse description text to make timestamps and links interactive
  const renderFormattedDescription = (text: string) => {
    if (!text) {
      return (
        <span style={{ color: 'var(--md-sys-color-on-surface-variant, #94a3b8)', fontStyle: 'italic', fontSize: '13px' }}>
          No description provided by creator.
        </span>
      );
    }

    const regex = /(https?:\/\/[^\s]+)|(\b\d{1,2}:\d{2}(?::\d{2})?\b)/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        elements.push(text.slice(lastIndex, match.index));
      }

      const [matchedString, urlMatch, timeMatch] = match;

      if (urlMatch) {
        elements.push(
          <a
            key={`url-${match.index}`}
            href={urlMatch}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              color: 'var(--md-sys-color-primary, #a8c7fa)',
              textDecoration: 'none',
              wordBreak: 'break-all',
              fontWeight: 600
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.textDecoration = 'none';
            }}
          >
            {urlMatch}
          </a>
        );
      } else if (timeMatch) {
        const seconds = parseTimestampToSeconds(timeMatch);
        elements.push(
          <button
            key={`ts-${match.index}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (seconds !== null && onSeekTo) {
                onSeekTo(seconds);
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              margin: '0 3px',
              borderRadius: '6px',
              backgroundColor: 'var(--md-sys-color-primary-container, #23477c)',
              color: 'var(--md-sys-color-on-primary-container, #d3e3fd)',
              fontFamily: 'monospace',
              fontSize: '12px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              verticalAlign: 'baseline',
              transition: 'background-color 150ms ease'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--md-sys-color-primary, #a8c7fa)';
              (e.currentTarget as HTMLElement).style.color = 'var(--md-sys-color-on-primary, #083063)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--md-sys-color-primary-container, #23477c)';
              (e.currentTarget as HTMLElement).style.color = 'var(--md-sys-color-on-primary-container, #d3e3fd)';
            }}
          >
            {timeMatch}
          </button>
        );
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      elements.push(text.slice(lastIndex));
    }

    return (
      <div
        style={{
          whiteSpace: 'pre-wrap',
          userSelect: 'text',
          fontSize: '13.5px',
          lineHeight: '1.6',
          color: 'var(--md-sys-color-on-surface-variant, #c4c6d0)',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)'
        }}
      >
        {elements}
      </div>
    );
  };

  return (
    <div
      className={className}
      style={{
        borderRadius: '20px',
        backgroundColor: 'var(--md-sys-color-surface-container, #1d2024)',
        border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))',
        overflow: 'hidden',
        transition: 'all 250ms var(--motion-easing-emphasized, cubic-bezier(0.2, 0, 0, 1))',
        ...style
      }}
    >
      {/* Header Bar */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (canExpand && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          cursor: canExpand ? 'pointer' : 'default',
          transition: 'background-color 150ms ease'
        }}
        onMouseEnter={(e) => {
          if (canExpand) {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 700,
              lineHeight: 1.35,
              color: 'var(--md-sys-color-on-surface, #e2e2e9)',
              letterSpacing: '-0.01em',
              display: isExpanded ? 'block' : '-webkit-box',
              WebkitLineClamp: isExpanded ? 'none' : 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {displayTitle}
          </h2>

          {/* Status Subtitle: shown when collapsed */}
          {!isExpanded && (
            <p
              style={{
                margin: '6px 0 0',
                fontSize: '13px',
                color: 'var(--md-sys-color-on-surface-variant, #94a3b8)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 500
              }}
            >
              {displayViews && <span>{displayViews}</span>}
              {displayViews && displayDate && <span>•</span>}
              {displayDate && <span>{displayDate}</span>}
            </p>
          )}
        </div>

        {canExpand && (
          <div style={{ flexShrink: 0, paddingTop: '2px' }}>
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: '24px',
                color: 'var(--md-sys-color-on-surface-variant, #94a3b8)',
                display: 'inline-block',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 300ms var(--motion-easing-spring, cubic-bezier(0.175, 0.885, 0.32, 1.275))'
              }}
            >
              expand_more
            </span>
          </div>
        )}
      </div>

      {/* Expanded Body: VideoStatTiles + Rich Description */}
      {isExpanded && (
        <div
          style={{
            padding: '0 16px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            animation: 'kodaWatchFadeIn 200ms ease'
          }}
        >
          {/* VideoStatTiles (Authentic Koda Layout: Stat figures over small words in surfaceContainerHigh) */}
          {hasStats && (
            <div style={{ display: 'flex', gap: '10px' }}>
              {viewsFig && (
                <div
                  style={{
                    flex: 1,
                    borderRadius: '14px',
                    backgroundColor: 'var(--md-sys-color-surface-container-high, #282a2f)',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center'
                  }}
                >
                  <span
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: 'var(--md-sys-color-on-surface, #e2e2e9)',
                      lineHeight: 1.2
                    }}
                  >
                    {viewsFig}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--md-sys-color-on-surface-variant, #94a3b8)',
                      marginTop: '2px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    {viewsWord || 'views'}
                  </span>
                </div>
              )}

              {dateFig && (
                <div
                  style={{
                    flex: 1,
                    borderRadius: '14px',
                    backgroundColor: 'var(--md-sys-color-surface-container-high, #282a2f)',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center'
                  }}
                >
                  <span
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: 'var(--md-sys-color-on-surface, #e2e2e9)',
                      lineHeight: 1.2
                    }}
                  >
                    {dateFig}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--md-sys-color-on-surface-variant, #94a3b8)',
                      marginTop: '2px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    {dateWord || 'ago'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Formatted Description */}
          <div
            style={{
              paddingTop: '8px',
              borderTop: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))'
            }}
          >
            {renderFormattedDescription(description)}
          </div>
        </div>
      )}
    </div>
  );
};
