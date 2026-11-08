import React, { useEffect, useMemo, useRef, useState } from 'react';
import { VideoItem, TopicChip } from '../types';
import { innertubeService } from '../api/innertubeService';
import { VideoCard } from '../components/video/VideoCard';
import { VideoCardSkeleton } from '../components/video/VideoCardSkeleton';
import { VideoCinemaStage } from '../components/video/VideoCinemaStage';
import { bridgeClient } from '../api/bridgeClient';
import { M3LoadingIndicator } from '../components/common/M3LoadingIndicator';
import { useTasteStore } from '../store/tasteStore';
import { usePlayerStore } from '../store/playerStore';

type DurationFilter = 'any' | 'short' | 'mid' | 'long';

const DURATION_FILTERS: { id: DurationFilter; label: string }[] = [
  { id: 'any', label: 'Any length' },
  { id: 'short', label: '< 5 min' },
  { id: 'mid', label: '5–20 min' },
  { id: 'long', label: '20+ min' }
];

const matchesDuration = (v: VideoItem, f: DurationFilter) => {
  const d = v.duration || 0;
  if (f === 'short') return d > 0 && d < 300;
  if (f === 'mid') return d >= 300 && d <= 1200;
  if (f === 'long') return d > 1200;
  return true;
};

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
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('any');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { videoHistory, syncSubscribedChannels } = useTasteStore();
  const { openChannel } = usePlayerStore();

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

    // Pre-sync YouTube subscribed channels in the background so ChannelSheet knows subscription status
    innertubeService
      .getSubscriptionsFeed()
      .then((res) => {
        if (res.channels && res.channels.length > 0) {
          syncSubscribedChannels(res.channels);
        }
      })
      .catch(() => {});

    const chipFilter =
      chip && chip.id !== 'all'
        ? { params: chip.params, continuationToken: chip.continuationToken, title: chip.title }
        : undefined;
    innertubeService
      .getVideoHomeFeed(chipFilter)
      .then((res) => {
        setVideos(res.videos);
        setContinuationToken(res.continuationToken);

        // Keep the existing chip rail when filtering so the selection doesn't jump
        if (!chipFilter && res.chips && res.chips.length > 0) {
          const hasAll = res.chips.some((c) => c.id === 'all' || c.title.toLowerCase() === 'all');
          const finalChips = hasAll ? res.chips : [{ id: 'all', title: 'All' }, ...res.chips];
          setChips(finalChips);
        }
        setLoading(false);
        setIsRefreshing(false);
        setTimeout(checkScrollable, 200);
      })
      .catch((err) => {
        console.warn('[VideoHome] Error fetching home video feed:', err);
        setLoading(false);
        setIsRefreshing(false);
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

  // Local resume targets (partially watched, most recent first)
  const resumeItems = useMemo<VideoItem[]>(
    () =>
      videoHistory
        .filter((h) => (h.watchedPercentage || 0) > 3 && (h.watchedPercentage || 0) < 95 && (h.resumeTimeSeconds || 0) > 5)
        .slice(0, 4)
        .map((h) => {
          const d = h.duration || 0;
          return {
            id: h.id,
            title: h.title,
            channelName: h.channelName,
            channelId: h.channelId,
            channelIconUrl: h.channelIconUrl,
            thumbnailUrl: h.thumbnailUrl,
            duration: d,
            durationFormatted: d > 0 ? `${Math.floor(d / 60)}:${String(Math.floor(d % 60)).padStart(2, '0')}` : '',
            viewCount: h.viewCountText || '',
            watchedPercentage: h.watchedPercentage
          };
        }),
    [videoHistory]
  );

  const filteredVideos = useMemo(() => {
    const byDuration = videos.filter((v) => matchesDuration(v, durationFilter));
    const nonMembers = byDuration.filter((v) => !v.isMembersOnly);
    return nonMembers.length >= 4 ? nonMembers : byDuration;
  }, [videos, durationFilter]);

  // Unique creators in feed for quick channel discovery rail
  const activeCreators = useMemo(() => {
    const seen = new Set<string>();
    const list: { id?: string; name: string; avatarUrl?: string; isVerified?: boolean }[] = [];
    for (const v of filteredVideos) {
      const key = (v.channelName || '').toLowerCase().trim();
      if (!key || key === 'youtube creator' || seen.has(key)) continue;
      seen.add(key);
      list.push({
        id: v.channelId,
        name: v.channelName,
        avatarUrl: v.channelIconUrl,
        isVerified: v.isVerified
      });
      if (list.length >= 12) break;
    }
    return list;
  }, [filteredVideos]);

  const showStage = !isSubscriptions && selectedChipId === 'all' && filteredVideos.length > 0;
  const stageLead = showStage ? filteredVideos[0] : null;
  const stageUpNext = showStage ? filteredVideos.slice(1, 5) : [];
  const stageIds = new Set(
    showStage ? [stageLead!.id, ...stageUpNext.slice(0, Math.max(0, 3 - resumeItems.length)).map((v) => v.id)] : []
  );
  const gridVideos = showStage ? filteredVideos.filter((v) => !stageIds.has(v.id)) : filteredVideos;

  return (
    <div
      style={{
        paddingBottom: '160px', // generous safe-area padding to prevent floating dock collision
        animation: 'kodaFadeIn 280ms cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Unified Contained M3 Expressive Filter & Topic Bar (Zero uncontained black space) */}
      {isSubscriptions ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
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
            Subscriptions
          </h1>
          <button
            onClick={() => {
              setIsRefreshing(true);
              loadFeed();
            }}
            title="Refresh Feed"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'var(--md-sys-color-surface-container)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              color: 'var(--md-sys-color-on-surface-variant)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: '19px',
                animation: isRefreshing ? 'otSpin 800ms linear infinite' : 'none'
              }}
            >
              refresh
            </span>
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '7px 10px',
            borderRadius: '22px',
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            marginBottom: '16px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.22)'
          }}
        >
          {/* Left: Scrollable Topic Filter Chips */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              minWidth: 0
            }}
          >
            {canScrollLeft && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  paddingRight: '20px',
                  background:
                    'linear-gradient(90deg, var(--md-sys-color-surface-container-low) 65%, transparent 100%)'
                }}
              >
                <button
                  type="button"
                  onClick={() => scrollChips('left')}
                  title="Scroll left"
                  style={navArrowButtonStyle}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                    chevron_left
                  </span>
                </button>
              </div>
            )}

            <div
              ref={chipsScrollRef}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                overflowX: 'auto',
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
                      height: '32px',
                      padding: isSelected ? '0 16px' : '0 14px',
                      borderRadius: isSelected ? '12px' : '9999px',
                      fontSize: '12.5px',
                      fontWeight: isSelected ? 750 : 500,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      border: isSelected
                        ? '1px solid var(--md-sys-color-primary)'
                        : '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: isSelected
                        ? 'var(--md-sys-color-secondary-container)'
                        : 'var(--md-sys-color-surface-container)',
                      color: isSelected
                        ? 'var(--md-sys-color-on-secondary-container)'
                        : 'var(--md-sys-color-on-surface)',
                      outline: 'none',
                      transition:
                        'border-radius 260ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 180ms ease, transform 150ms ease',
                      flexShrink: 0
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
                    onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor =
                          'var(--md-sys-color-surface-container-high)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor =
                          'var(--md-sys-color-surface-container)';
                      }
                    }}
                  >
                    {chip.title}
                  </button>
                );
              })}
            </div>

            {canScrollRight && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: '20px',
                  background:
                    'linear-gradient(270deg, var(--md-sys-color-surface-container-low) 65%, transparent 100%)'
                }}
              >
                <button
                  type="button"
                  onClick={() => scrollChips('right')}
                  title="Scroll right"
                  style={navArrowButtonStyle}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                    chevron_right
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Subtle Divider */}
          <div
            style={{
              width: '1px',
              height: '22px',
              backgroundColor: 'var(--md-sys-color-outline-variant)',
              flexShrink: 0
            }}
          />

          {/* Right: Duration Quick-Filter + Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <div
              role="radiogroup"
              aria-label="Filter by length"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                padding: '3px',
                borderRadius: '999px',
                backgroundColor: 'var(--md-sys-color-surface-container)',
                border: '1px solid var(--md-sys-color-outline-variant)'
              }}
            >
              {DURATION_FILTERS.map((f) => {
                const active = durationFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setDurationFilter(f.id)}
                    style={{
                      height: '26px',
                      padding: '0 10px',
                      borderRadius: active ? '9px' : '999px',
                      border: 'none',
                      backgroundColor: active
                        ? 'var(--md-sys-color-primary)'
                        : 'transparent',
                      color: active
                        ? 'var(--md-sys-color-on-primary)'
                        : 'var(--md-sys-color-on-surface-variant)',
                      fontSize: '11.5px',
                      fontWeight: active ? 750 : 500,
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      transition:
                        'border-radius 240ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 160ms ease'
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                setIsRefreshing(true);
                loadFeed(chips.find((c) => c.id === selectedChipId));
              }}
              title="Refresh Feed"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--md-sys-color-surface-container)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                color: 'var(--md-sys-color-on-surface-variant)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                outline: 'none',
                transition: 'transform 200ms ease, background-color 150ms ease'
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  'var(--md-sys-color-surface-container-high)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor =
                  'var(--md-sys-color-surface-container)')
              }
            >
              <span
                className="material-symbols-rounded"
                style={{
                  fontSize: '18px',
                  animation: isRefreshing ? 'otSpin 800ms linear infinite' : 'none'
                }}
              >
                refresh
              </span>
            </button>
          </div>
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
          {/* Editorial cinema stage: lead frame + continue-watching / up-next stack */}
          {showStage && stageLead && (
            <VideoCinemaStage
              lead={stageLead}
              resumeItems={resumeItems}
              upNext={stageUpNext}
              onPlayVideo={onPlayVideo}
            />
          )}

          {/* M3 Expressive Creators Quick-Access Rail */}
          {!isSubscriptions && activeCreators.length >= 4 && (
            <section style={{ marginBottom: '28px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    className="material-symbols-rounded filled"
                    style={{ fontSize: '19px', color: 'var(--md-sys-color-primary)' }}
                  >
                    subscriptions
                  </span>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: '17px',
                      fontWeight: 800,
                      letterSpacing: '-0.015em',
                      color: 'var(--md-sys-color-on-surface)'
                    }}
                  >
                    Creators in Your Feed
                  </h2>
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--md-sys-color-on-surface-variant)'
                  }}
                >
                  Tap to open channel
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  overflowX: 'auto',
                  paddingBottom: '6px',
                  scrollbarWidth: 'none'
                }}
              >
                {activeCreators.map((creator) => (
                  <button
                    key={creator.name}
                    type="button"
                    onClick={() =>
                      openChannel({
                        id: creator.id,
                        name: creator.name,
                        avatarUrl: creator.avatarUrl
                      })
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '6px 14px 6px 6px',
                      borderRadius: '9999px',
                      backgroundColor: 'var(--md-sys-color-surface-container)',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      color: 'var(--md-sys-color-on-surface)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition:
                        'border-radius 260ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 180ms ease, transform 180ms ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'var(--md-sys-color-surface-container-high)';
                      e.currentTarget.style.borderRadius = '16px';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'var(--md-sys-color-surface-container)';
                      e.currentTarget.style.borderRadius = '9999px';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <span
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        backgroundColor: 'var(--md-sys-color-secondary-container)',
                        color: 'var(--md-sys-color-on-secondary-container)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 800,
                        flexShrink: 0
                      }}
                    >
                      {creator.avatarUrl ? (
                        <img
                          src={creator.avatarUrl}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        creator.name.slice(0, 2).toUpperCase()
                      )}
                    </span>

                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        maxWidth: '150px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {creator.name}
                    </span>

                    {creator.isVerified && (
                      <span
                        className="material-symbols-rounded filled"
                        style={{
                          fontSize: '14px',
                          color: 'var(--md-sys-color-primary)',
                          flexShrink: 0
                        }}
                      >
                        check_circle
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Section Header for Feed Grid */}
          {!isSubscriptions && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  className="material-symbols-rounded filled"
                  style={{ fontSize: '20px', color: 'var(--md-sys-color-primary)' }}
                >
                  smart_display
                </span>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: 800,
                    letterSpacing: '-0.015em',
                    color: 'var(--md-sys-color-on-surface)'
                  }}
                >
                  {selectedChipId === 'all'
                    ? 'More For You'
                    : chips.find((c) => c.id === selectedChipId)?.title || 'Videos'}
                </h2>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--md-sys-color-on-surface-variant)',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {gridVideos.length} videos
              </span>
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
            {gridVideos.map((video) => (
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
        @keyframes otSpin { to { transform: rotate(360deg); } }
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
