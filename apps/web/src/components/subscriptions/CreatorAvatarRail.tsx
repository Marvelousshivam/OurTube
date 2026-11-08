import React, { useRef, useState, useEffect } from 'react';
import { SubscribedChannel } from '../../types';

export interface CreatorAvatarRailProps {
  channels: SubscribedChannel[];
  selectedChannelId: string | null;
  onSelectChannel: (channelId: string | null) => void;
  isLoading?: boolean;
}

export const CreatorAvatarRail: React.FC<CreatorAvatarRailProps> = ({
  channels,
  selectedChannelId,
  onSelectChannel,
  isLoading = false
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [avatarErrors, setAvatarErrors] = useState<Record<string, boolean>>({});

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [channels]);

  const scrollBy = (offset: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'YT';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  if (isLoading && channels.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '4px 0 16px 0',
          overflowX: 'hidden'
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              minWidth: '64px'
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--md-sys-color-surface-container-high, #2b2930)',
                animation: 'm3ShimmerPulse 1.6s ease-in-out infinite'
              }}
            />
            <div
              style={{
                width: '40px',
                height: '10px',
                borderRadius: '5px',
                backgroundColor: 'var(--md-sys-color-surface-container-high, #2b2930)',
                animation: 'm3ShimmerPulse 1.6s ease-in-out infinite'
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (channels.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        marginBottom: '16px',
        userSelect: 'none'
      }}
    >
      {/* Scroll Left Button */}
      {canScrollLeft && (
        <button
          onClick={() => scrollBy(-220)}
          aria-label="Scroll creators left"
          style={{
            position: 'absolute',
            left: '0px',
            top: '24px',
            transform: 'translateY(-50%)',
            zIndex: 10,
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--md-sys-color-surface-container-highest, #36343b)',
            border: '1px solid var(--md-sys-color-outline-variant, rgba(255,255,255,0.12))',
            color: 'var(--md-sys-color-on-surface, #e6e0e9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            transition: 'transform 150ms ease, background-color 150ms ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
            chevron_left
          </span>
        </button>
      )}

      {/* Scroll Right Button */}
      {canScrollRight && (
        <button
          onClick={() => scrollBy(220)}
          aria-label="Scroll creators right"
          style={{
            position: 'absolute',
            right: '0px',
            top: '24px',
            transform: 'translateY(-50%)',
            zIndex: 10,
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--md-sys-color-surface-container-highest, #36343b)',
            border: '1px solid var(--md-sys-color-outline-variant, rgba(255,255,255,0.12))',
            color: 'var(--md-sys-color-on-surface, #e6e0e9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            transition: 'transform 150ms ease, background-color 150ms ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
            chevron_right
          </span>
        </button>
      )}

      {/* Horizontal Creator Scroll Track */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          padding: '6px 4px 8px 4px',
          scrollBehavior: 'smooth'
        }}
      >
        {/* "All" Item */}
        <button
          onClick={() => onSelectChannel(null)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            minWidth: '60px',
            maxWidth: '68px',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor:
                selectedChannelId === null
                  ? 'var(--md-sys-color-primary, #ffd8e4)'
                  : 'var(--md-sys-color-surface-container-high, #2b2930)',
              color:
                selectedChannelId === null
                  ? 'var(--md-sys-color-on-primary, #4a192c)'
                  : 'var(--md-sys-color-on-surface, #e6e0e9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow:
                selectedChannelId === null
                  ? '0 0 0 2px var(--md-sys-color-background, #141218), 0 0 0 4px var(--md-sys-color-primary, #ffd8e4)'
                  : 'none',
              transition: 'transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 160ms ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
              subscriptions
            </span>
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: selectedChannelId === null ? 700 : 500,
              color:
                selectedChannelId === null
                  ? 'var(--md-sys-color-primary, #ffd8e4)'
                  : 'var(--md-sys-color-on-surface-variant, #cac4d0)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '68px',
              textAlign: 'center'
            }}
          >
            All
          </span>
        </button>

        {/* Creator Channel Circles */}
        {channels.map((channel) => {
          const isSelected = selectedChannelId === channel.id;
          const hasError = avatarErrors[channel.id];

          return (
            <button
              key={channel.id}
              onClick={() => onSelectChannel(isSelected ? null : channel.id)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                minWidth: '60px',
                maxWidth: '68px',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  transition: 'transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {/* Avatar Image or Initials */}
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    backgroundColor: 'var(--md-sys-color-surface-container-high, #2b2930)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isSelected
                      ? '0 0 0 2px var(--md-sys-color-background, #141218), 0 0 0 4px var(--md-sys-color-primary, #ffd8e4)'
                      : '0 1px 3px rgba(0,0,0,0.2)'
                  }}
                >
                  {channel.avatarUrl && !hasError ? (
                    <img
                      src={channel.avatarUrl}
                      alt={channel.name}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setAvatarErrors((prev) => ({ ...prev, [channel.id]: true }))
                      }
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--md-sys-color-primary, #ffd8e4)'
                      }}
                    >
                      {getInitials(channel.name)}
                    </span>
                  )}
                </div>

                {/* New Video Indicator Dot */}
                {channel.hasNewVideos && !isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '1px',
                      right: '1px',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--md-sys-color-primary, #ffd8e4)',
                      border: '2px solid var(--md-sys-color-background, #141218)'
                    }}
                  />
                )}
              </div>

              {/* Creator Name Label */}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected
                    ? 'var(--md-sys-color-primary, #ffd8e4)'
                    : 'var(--md-sys-color-on-surface-variant, #cac4d0)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '68px',
                  textAlign: 'center',
                  lineHeight: '13px'
                }}
              >
                {channel.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
