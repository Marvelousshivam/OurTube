import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { VideoItem, SubscribedChannel } from '../types';
import { innertubeService } from '../api/innertubeService';
import { useTasteStore } from '../store/tasteStore';
import { VideoCard } from '../components/video/VideoCard';
import { VideoCardSkeleton } from '../components/video/VideoCardSkeleton';
import { CreatorAvatarRail } from '../components/subscriptions/CreatorAvatarRail';
import { SubscriptionListRow } from '../components/subscriptions/SubscriptionListRow';
import { M3LoadingIndicator } from '../components/common/M3LoadingIndicator';

interface SubscriptionsPageProps {
  onPlayVideo: (video: VideoItem) => void;
}

type TimeFilter = 'all' | 'today' | 'week' | 'unwatched';
type ViewMode = 'grid' | 'list';

export const SubscriptionsPage: React.FC<SubscriptionsPageProps> = ({ onPlayVideo }) => {
  const { subscribedChannels: localSubscribedChannels, syncSubscribedChannels } = useTasteStore();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [remoteChannels, setChannels] = useState<SubscribedChannel[]>([]);
  const channels = useMemo(() => {
    const seen = new Set(remoteChannels.map((c) => c.id.toLowerCase()));
    const merged: SubscribedChannel[] = [...remoteChannels];
    for (const lc of localSubscribedChannels) {
      if (!seen.has(lc.id.toLowerCase()) && !seen.has(lc.name.toLowerCase())) {
        seen.add(lc.id.toLowerCase());
        merged.unshift({
          id: lc.id,
          name: lc.name,
          avatarUrl: lc.avatarUrl || ''
        });
      }
    }
    return merged;
  }, [remoteChannels, localSubscribedChannels]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ourtube_subscriptions_view_mode');
      if (saved === 'grid' || saved === 'list') return saved;
    }
    return 'grid';
  });

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [continuationToken, setContinuationToken] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleToggleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('ourtube_subscriptions_view_mode', mode);
    } catch {}
  };

  const loadSubscriptions = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await innertubeService.getSubscriptionsFeed();
      setVideos(result.videos);
      setChannels(result.channels);
      setContinuationToken(result.continuationToken);
      if (result.channels.length > 0) {
        syncSubscribedChannels(result.channels);
      }
    } catch (err: any) {
      console.error('[SubscriptionsPage] Failed to load subscriptions feed:', err);
      setError(err?.message || 'Failed to load subscriptions feed');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  // Infinite Scroll continuation
  const loadMore = useCallback(async () => {
    if (!continuationToken || isLoadingMore) return;
    setIsLoadingMore(true);

    try {
      const continuation = await innertubeService.getVideoContinuation(continuationToken);
      if (continuation.videos.length > 0) {
        setVideos((prev) => {
          const existingIds = new Set(prev.map((v) => v.id));
          const newVideos = continuation.videos.filter((v) => !existingIds.has(v.id));
          return [...prev, ...newVideos];
        });
      }
      setContinuationToken(continuation.continuationToken);
    } catch (err) {
      console.warn('[SubscriptionsPage] Continuation error:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [continuationToken, isLoadingMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // Filter videos by selected creator channel and time filter
  const filteredVideos = useMemo(() => {
    let list = videos;

    // Filter by selected channel
    if (selectedChannelId) {
      const selectedChannel = channels.find((c) => c.id === selectedChannelId);
      list = list.filter((v) => {
        if (v.channelId && v.channelId === selectedChannelId) return true;
        if (
          selectedChannel &&
          v.channelName.trim().toLowerCase() === selectedChannel.name.trim().toLowerCase()
        ) {
          return true;
        }
        return false;
      });
    }

    // Filter by time or watch status
    if (activeTimeFilter === 'today') {
      list = list.filter((v) => {
        const d = (v.uploadedDate || '').toLowerCase();
        return (
          d.includes('hour') ||
          d.includes('minute') ||
          d.includes('moment') ||
          d.includes('today') ||
          d.includes('streamed') ||
          d.includes('1 day ago')
        );
      });
    } else if (activeTimeFilter === 'week') {
      list = list.filter((v) => {
        const d = (v.uploadedDate || '').toLowerCase();
        return (
          d.includes('hour') ||
          d.includes('minute') ||
          d.includes('moment') ||
          d.includes('today') ||
          d.includes('day') ||
          d.includes('1 week ago')
        );
      });
    } else if (activeTimeFilter === 'unwatched') {
      list = list.filter((v) => {
        return typeof v.watchedPercentage !== 'number' || v.watchedPercentage < 85;
      });
    }

    return list;
  }, [videos, channels, selectedChannelId, activeTimeFilter]);

  const selectedChannelName = useMemo(() => {
    if (!selectedChannelId) return null;
    return channels.find((c) => c.id === selectedChannelId)?.name || 'Selected Channel';
  }, [channels, selectedChannelId]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        paddingBottom: '160px',
        animation: 'm3FadeIn 260ms ease-out both'
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--md-sys-color-on-surface, #e6e0e9)',
              margin: '0 0 4px 0'
            }}
          >
            Subscriptions
          </h1>
          <p
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
              margin: 0
            }}
          >
            {loading ? (
              'Checking for new uploads...'
            ) : selectedChannelName ? (
              <span>
                Showing uploads from <strong>{selectedChannelName}</strong> ({filteredVideos.length}{' '}
                videos)
              </span>
            ) : (
              `${channels.length} channels • ${filteredVideos.length} recent uploads`
            )}
          </p>
        </div>

        {/* View Mode Segmented Controls & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* M3 Segmented Button: Grid vs List */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--md-sys-color-surface-container, #211f26)',
              borderRadius: '9999px',
              padding: '3px',
              border: '1px solid var(--md-sys-color-outline-variant, rgba(255,255,255,0.08))'
            }}
          >
            <button
              onClick={() => handleToggleViewMode('grid')}
              aria-label="Grid view"
              title="Grid view"
              style={{
                width: '36px',
                height: '32px',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor:
                  viewMode === 'grid'
                    ? 'var(--md-sys-color-primary, #ffd8e4)'
                    : 'transparent',
                color:
                  viewMode === 'grid'
                    ? 'var(--md-sys-color-on-primary, #4a192c)'
                    : 'var(--md-sys-color-on-surface-variant, #cac4d0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 160ms cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '19px' }}>
                grid_view
              </span>
            </button>

            <button
              onClick={() => handleToggleViewMode('list')}
              aria-label="List view"
              title="Compact list view"
              style={{
                width: '36px',
                height: '32px',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor:
                  viewMode === 'list'
                    ? 'var(--md-sys-color-primary, #ffd8e4)'
                    : 'transparent',
                color:
                  viewMode === 'list'
                    ? 'var(--md-sys-color-on-primary, #4a192c)'
                    : 'var(--md-sys-color-on-surface-variant, #cac4d0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 160ms cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '19px' }}>
                view_agenda
              </span>
            </button>
          </div>

          {/* Refresh Feed Button */}
          <button
            onClick={() => loadSubscriptions(true)}
            disabled={isRefreshing}
            aria-label="Refresh subscriptions feed"
            title="Refresh subscriptions feed"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'var(--md-sys-color-surface-container, #211f26)',
              border: '1px solid var(--md-sys-color-outline-variant, rgba(255,255,255,0.08))',
              color: 'var(--md-sys-color-on-surface, #e6e0e9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isRefreshing ? 'default' : 'pointer',
              transition: 'transform 180ms ease, background-color 150ms ease'
            }}
            onMouseEnter={(e) => {
              if (!isRefreshing) e.currentTarget.style.transform = 'scale(1.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: '20px',
                animation: isRefreshing ? 'm3Spin 1s linear infinite' : 'none'
              }}
            >
              refresh
            </span>
          </button>
        </div>
      </div>

      {/* Creator Avatar Stories Rail */}
      <CreatorAvatarRail
        channels={channels}
        selectedChannelId={selectedChannelId}
        onSelectChannel={setSelectedChannelId}
        isLoading={loading}
      />

      {/* Time & Status Filter Pills */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '24px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingBottom: '2px'
        }}
      >
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'This Week' },
            { id: 'unwatched', label: 'Unwatched' }
          ] as const
        ).map((filter) => {
          const isActive = activeTimeFilter === filter.id;
          return (
            <button
              key={filter.id}
              onClick={() => setActiveTimeFilter(filter.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '12.5px',
                fontWeight: isActive ? 700 : 500,
                border: 'none',
                backgroundColor: isActive
                  ? 'var(--md-sys-color-primary, #ffd8e4)'
                  : 'var(--md-sys-color-surface-container, #211f26)',
                color: isActive
                  ? 'var(--md-sys-color-on-primary, #4a192c)'
                  : 'var(--md-sys-color-on-surface-variant, #cac4d0)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 160ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor =
                    'var(--md-sys-color-surface-container-high, #2b2930)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor =
                    'var(--md-sys-color-surface-container, #211f26)';
                }
              }}
            >
              {filter.label}
            </button>
          );
        })}

        {/* Clear Creator Filter Pill (when a channel is selected) */}
        {selectedChannelId && (
          <button
            onClick={() => setSelectedChannelId(null)}
            style={{
              padding: '6px 12px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              border: '1px solid var(--md-sys-color-outline-variant, rgba(255,255,255,0.12))',
              backgroundColor: 'transparent',
              color: 'var(--md-sys-color-primary, #ffd8e4)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0
            }}
          >
            <span>Clear Creator Filter</span>
            <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>
              close
            </span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        viewMode === 'grid' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '24px 18px',
              width: '100%'
            }}
          >
            <VideoCardSkeleton count={8} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: '100px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--md-sys-color-surface-container, #211f26)',
                  animation: 'm3ShimmerPulse 1.6s ease-in-out infinite'
                }}
              />
            ))}
          </div>
        )
      ) : error ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            textAlign: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--md-sys-color-error-container, #8c1d18)',
              color: 'var(--md-sys-color-on-error-container, #f9dedc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '28px' }}>
              error_outline
            </span>
          </div>
          <span style={{ fontSize: '16px', fontWeight: 600 }}>{error}</span>
          <button
            onClick={() => loadSubscriptions()}
            style={{
              padding: '8px 20px',
              borderRadius: '9999px',
              backgroundColor: 'var(--md-sys-color-primary, #ffd8e4)',
              color: 'var(--md-sys-color-on-primary, #4a192c)',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 20px',
            textAlign: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--md-sys-color-surface-container-high, #2b2930)',
              color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '32px' }}>
              subscriptions
            </span>
          </div>
          <span
            style={{
              fontSize: '17px',
              fontWeight: 700,
              color: 'var(--md-sys-color-on-surface, #e6e0e9)'
            }}
          >
            No uploads found
          </span>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
              maxWidth: '380px',
              margin: 0
            }}
          >
            {selectedChannelId
              ? "This creator hasn't published uploads matching the active filter."
              : 'No videos match the selected filter. Try changing your time filter or check back later.'}
          </p>
          {(selectedChannelId || activeTimeFilter !== 'all') && (
            <button
              onClick={() => {
                setSelectedChannelId(null);
                setActiveTimeFilter('all');
              }}
              style={{
                marginTop: '12px',
                padding: '8px 20px',
                borderRadius: '9999px',
                backgroundColor: 'var(--md-sys-color-surface-container-high, #2b2930)',
                color: 'var(--md-sys-color-primary, #ffd8e4)',
                border: '1px solid var(--md-sys-color-outline-variant, rgba(255,255,255,0.12))',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '24px 18px',
            width: '100%'
          }}
        >
          {filteredVideos.map((video) => (
            <VideoCard key={video.id} video={video} onClick={onPlayVideo} />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            width: '100%'
          }}
        >
          {filteredVideos.map((video) => (
            <SubscriptionListRow key={video.id} video={video} onClick={onPlayVideo} />
          ))}
        </div>
      )}

      {/* Infinite Scroll Sentinel */}
      <div
        ref={sentinelRef}
        style={{
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '20px'
        }}
      >
        {isLoadingMore && (
          <M3LoadingIndicator size="md" message="Loading more subscriptions..." />
        )}
      </div>
    </div>
  );
};
