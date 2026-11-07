import React, { useEffect, useRef, useState } from 'react';
import { VideoItem, TopicChip } from '../types';
import { innertubeService } from '../api/innertubeService';
import { VideoCard } from '../components/video/VideoCard';
import { VideoCardSkeleton } from '../components/video/VideoCardSkeleton';
import { bridgeClient } from '../api/bridgeClient';
import { M3LoadingIndicator } from '../components/common/M3LoadingIndicator';

interface VideoHomePageProps {
  onPlayVideo: (video: VideoItem) => void;
  mode?: 'home' | 'subscriptions';
}

export const VideoHomePage: React.FC<VideoHomePageProps> = ({
  onPlayVideo,
  mode = 'home'
}) => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [chips, setChips] = useState<TopicChip[]>(innertubeService.getDefaultTopicChips());
  const [selectedChipId, setSelectedChipId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [continuationToken, setContinuationToken] = useState<string | undefined>(undefined);

  // Chips horizontal scroll state
  const chipsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Bottom intersection observer sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);

  const isSubscriptions = mode === 'subscriptions';

  const checkScrollable = () => {
    const el = chipsScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  const scrollChips = (direction: 'left' | 'right') => {
    const el = chipsScrollRef.current;
    if (!el) return;
    const offset = direction === 'left' ? -280 : 280;
    el.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const loadFeed = (chip?: TopicChip) => {
    setLoading(true);
    setContinuationToken(undefined);

    if (isSubscriptions) {
      innertubeService
        .getVideoSubscriptionsFeed()
        .then((items) => {
          setVideos(items);
          setLoading(false);
        })
        .catch((err) => {
          console.warn('[VideoHome] Error fetching subscriptions feed:', err);
          setLoading(false);
        });
      return;
    }

    const targetParam = chip && chip.id !== 'all' ? (chip.params || chip.title) : undefined;
    innertubeService
      .getVideoHomeFeed(targetParam)
      .then((res) => {
        setVideos(res.videos);
        setContinuationToken(res.continuationToken);

        if (res.chips && res.chips.length > 0) {
          const hasAll = res.chips.some((c) => c.id === 'all' || c.title.toLowerCase() === 'all');
          const finalChips = hasAll ? res.chips : [{ id: 'all', title: 'All' }, ...res.chips];
          setChips(finalChips);
        }
        setLoading(false);
        setTimeout(checkScrollable, 200);
      })
      .catch((err) => {
        console.warn('[VideoHome] Error fetching home video feed:', err);
        setLoading(false);
      });
  };

  const handleLoadMore = async () => {
    if (!continuationToken || isLoadingMore || loading) return;
    setIsLoadingMore(true);

    try {
      const res = await innertubeService.getVideoContinuation(continuationToken);
      if (res.videos.length > 0) {
        setVideos((prev) => {
          const existingIds = new Set(prev.map((v) => v.id));
          const newVideos = res.videos.filter((v) => !existingIds.has(v.id));
          return [...prev, ...newVideos];
        });
      }
      setContinuationToken(res.continuationToken);
    } catch (err) {
      console.warn('[VideoHome] Failed to load continuation batch:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSelectChip = (chip: TopicChip) => {
    setSelectedChipId(chip.id);
    loadFeed(chip);
  };

  useEffect(() => {
    loadFeed();

    const unsubBridge = bridgeClient.onAvailabilityChange((available) => {
      if (available) {
        loadFeed();
      }
    });

    return () => {
      unsubBridge();
    };
  }, [mode]);

  useEffect(() => {
    const el = chipsScrollRef.current;
    if (!el) return;
    checkScrollable();
    el.addEventListener('scroll', checkScrollable, { passive: true });
    window.addEventListener('resize', checkScrollable);

    return () => {
      el.removeEventListener('scroll', checkScrollable);
      window.removeEventListener('resize', checkScrollable);
    };
  }, [chips]);

  // Infinite scroll intersection observer
  useEffect(() => {
    if (!continuationToken || loading || isLoadingMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { rootMargin: '600px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [continuationToken, loading, isLoadingMore]);

  return (
    <div
      style={{
        paddingBottom: '160px', // generous safe-area padding to prevent floating dock collision
        animation: 'kodaFadeIn 280ms cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Top Title & Refresh Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isSubscriptions ? '20px' : '14px',
          marginTop: '4px'
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--md-sys-color-on-surface, #e6e1e5)'
          }}
        >
          {isSubscriptions ? 'Subscriptions' : 'Recommended For You'}
        </h1>

        <button
          onClick={() => loadFeed(chips.find((c) => c.id === selectedChipId))}
          title="Refresh Feed"
          style={{
            background: 'none',
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--md-sys-color-on-surface-variant)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none',
            transition: 'transform 200ms ease, background-color 150ms ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
            refresh
          </span>
        </button>
      </div>

      {/* Topic Filter Chips Carousel (Shown on Home Feed, matching YouTube & Koda) */}
      {!isSubscriptions && chips.length > 0 && (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            marginBottom: '16px'
          }}
        >
          {/* Left Arrow with Fade Gradient Mask */}
          {canScrollLeft && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: '14px',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                paddingRight: '24px',
                background: 'linear-gradient(90deg, var(--md-sys-color-background, #121316) 65%, transparent 100%)'
              }}
            >
              <button
                type="button"
                onClick={() => scrollChips('left')}
                title="Scroll left"
                style={navArrowButtonStyle}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-highest, rgba(255,255,255,0.18))')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high, rgba(255,255,255,0.1))')}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                  chevron_left
                </span>
              </button>
            </div>
          )}

          {/* Chips Scrollable Container */}
          <div
            ref={chipsScrollRef}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '14px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              width: '100%',
              scrollBehavior: 'smooth'
            }}
          >
            {chips.map((chip) => {
              const isSelected = chip.id === selectedChipId;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => handleSelectChip(chip)}
                  style={{
                    padding: isSelected ? '7px 18px' : '7px 16px',
                    borderRadius: isSelected ? '14px' : '9999px',
                    fontSize: '13px',
                    fontWeight: isSelected ? 750 : 500,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    border: isSelected
                      ? '1px solid var(--md-sys-color-primary)'
                      : '1px solid var(--md-sys-color-outline-variant, rgba(255,255,255,0.12))',
                    backgroundColor: isSelected
                      ? 'var(--md-sys-color-secondary-container, #ffd8e4)'
                      : 'var(--md-sys-color-surface-container, rgba(255,255,255,0.06))',
                    color: isSelected
                      ? 'var(--md-sys-color-on-secondary-container, #381e72)'
                      : 'var(--md-sys-color-on-surface, #e6e1e5)',
                    boxShadow: isSelected
                      ? '0 2px 10px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.2))'
                      : 'none',
                    outline: 'none',
                    transition: 'border-radius 280ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 180ms ease, transform 150ms ease',
                    flexShrink: 0
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high, rgba(255,255,255,0.1))';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container, rgba(255,255,255,0.06))';
                    }
                  }}
                >
                  {chip.title}
                </button>
              );
            })}
          </div>

          {/* Right Arrow with Fade Gradient Mask */}
          {canScrollRight && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: '14px',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '24px',
                background: 'linear-gradient(270deg, var(--md-sys-color-background, #121316) 65%, transparent 100%)'
              }}
            >
              <button
                type="button"
                onClick={() => scrollChips('right')}
                title="Scroll right"
                style={navArrowButtonStyle}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-highest, rgba(255,255,255,0.18))')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high, rgba(255,255,255,0.1))')}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                  chevron_right
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        /* Material 3 Shimmer Skeleton Cards Grid */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '24px 20px'
          }}
        >
          <VideoCardSkeleton count={9} />
        </div>
      ) : videos.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: 'var(--md-sys-color-surface-container, rgba(255,255,255,0.03))',
            borderRadius: '24px'
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '48px', color: 'var(--md-sys-color-outline)' }}>
            smart_display
          </span>
          <p style={{ marginTop: '12px', fontSize: '16px', fontWeight: 600, color: 'var(--md-sys-color-on-surface)' }}>
            {isSubscriptions ? 'No subscription videos found' : 'No video recommendations found'}
          </p>
          <button
            onClick={() => loadFeed()}
            style={{
              marginTop: '12px',
              padding: '8px 20px',
              borderRadius: '9999px',
              backgroundColor: '#ffd8e4',
              color: '#381e72',
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* M3 Expressive Featured Video Spotlight Bento Banner (Shown on 'all' chip) */}
          {!isSubscriptions && selectedChipId === 'all' && videos.length > 0 && (
            <div
              onClick={() => onPlayVideo(videos[0])}
              style={{
                position: 'relative',
                borderRadius: '28px',
                backgroundColor: 'var(--md-sys-color-surface-container-low)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                padding: '22px 26px',
                marginBottom: '26px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '24px',
                overflow: 'hidden',
                cursor: 'pointer',
                boxShadow: '0 12px 36px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.22))',
                transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              {/* Ambient Blurred Backdrop */}
              <img
                src={videos[0].thumbnailUrl}
                alt=""
                referrerPolicy="no-referrer"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: 0.14,
                  filter: 'blur(40px) saturate(160%)',
                  pointerEvents: 'none'
                }}
              />

              {/* Left 16:9 Thumbnail Preview */}
              <div
                style={{
                  position: 'relative',
                  width: '320px',
                  maxWidth: '100%',
                  aspectRatio: '16 / 9',
                  borderRadius: '18px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--md-sys-color-surface-container-high)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.38)',
                  flexShrink: 0,
                  zIndex: 1
                }}
              >
                <img
                  src={videos[0].thumbnailUrl}
                  alt={videos[0].title}
                  referrerPolicy="no-referrer"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {videos[0].durationFormatted && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      padding: '3px 8px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(12, 14, 19, 0.82)',
                      color: '#ffffff',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums'
                    }}
                  >
                    {videos[0].durationFormatted}
                  </span>
                )}
              </div>

              {/* Right Spotlight Details & Action */}
              <div style={{ flex: 1, minWidth: '240px', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      backgroundColor: 'var(--md-sys-color-primary-container)',
                      color: 'var(--md-sys-color-on-primary-container)',
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase'
                    }}
                  >
                    <span className="material-symbols-rounded filled" style={{ fontSize: '14px' }}>
                      auto_awesome
                    </span>
                    Featured Pick
                  </span>
                  {videos[0].uploadedDate && (
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--md-sys-color-on-surface-variant)' }}>
                      {videos[0].uploadedDate}
                    </span>
                  )}
                </div>

                <h2
                  style={{
                    margin: 0,
                    fontSize: 'clamp(18px, 2vw, 22px)',
                    fontWeight: 800,
                    lineHeight: 1.25,
                    color: 'var(--md-sys-color-on-surface)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {videos[0].title}
                </h2>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--md-sys-color-on-surface-variant)', fontSize: '13px', fontWeight: 600 }}>
                  <span>{videos[0].channelName}</span>
                  {videos[0].viewCount && (
                    <>
                      <span>•</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{videos[0].viewCount}</span>
                    </>
                  )}
                </div>

                <div style={{ marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayVideo(videos[0]);
                    }}
                    style={{
                      height: '44px',
                      padding: '0 22px',
                      borderRadius: '9999px',
                      backgroundColor: 'var(--md-sys-color-primary)',
                      color: 'var(--md-sys-color-on-primary)',
                      border: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)'
                    }}
                  >
                    <span className="material-symbols-rounded filled" style={{ fontSize: '20px' }}>
                      play_arrow
                    </span>
                    <span>Watch Now</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Responsive Video Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '26px 20px'
            }}
          >
            {(!isSubscriptions && selectedChipId === 'all' ? videos.slice(1) : videos).map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onClick={onPlayVideo}
              />
            ))}
          </div>

          {/* Infinite Scroll Continuation Sentinel & Loading Indicator */}
          {continuationToken && (
            <div
              ref={sentinelRef}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 0 20px 0'
              }}
            >
              {isLoadingMore && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <M3LoadingIndicator size="sm" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--md-sys-color-on-surface-variant)' }}>
                    Loading more recommendations...
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes kodaFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

const navArrowButtonStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  backgroundColor: 'var(--md-sys-color-surface-container-high, rgba(255,255,255,0.1))',
  border: '1px solid var(--md-sys-color-outline-variant, rgba(255,255,255,0.12))',
  color: 'var(--md-sys-color-on-surface, #e6e1e5)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  outline: 'none',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  transition: 'background-color 150ms ease, transform 150ms ease'
};
