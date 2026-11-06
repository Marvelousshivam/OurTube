import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  VideoItem,
  SubscribedChannel,
  VideoPlaylist,
  VideoSearchCategory,
  VideoSearchSort,
  VideoSearchDateFilter
} from '../types';
import { innertubeService } from '../api/innertubeService';
import { VideoCard } from '../components/video/VideoCard';
import { VideoCardSkeleton } from '../components/video/VideoCardSkeleton';

export interface VideoSearchPageProps {
  onPlayVideo: (video: VideoItem) => void;
  onOpenPlaylist?: (playlist: { id: string; title: string; subtitle?: string; imageUrl?: string; author?: string }) => void;
  onOpenChannel?: (channelId: string) => void;
}

const RECENT_SEARCHES_KEY = 'ourtube_video_recent_searches_v1';

function getSavedRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  const clean = query.trim();
  if (!clean) return;
  const current = getSavedRecentSearches().filter((q) => q.toLowerCase() !== clean.toLowerCase());
  const updated = [clean, ...current].slice(0, 10);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

function removeRecentSearch(query: string) {
  const updated = getSavedRecentSearches().filter((q) => q !== query);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

function clearAllRecentSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Check youtu.be/ID
  const youtuBeMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (youtuBeMatch?.[1]) return youtuBeMatch[1];

  // 2. Check /watch?v=ID
  const watchMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/i);
  if (watchMatch?.[1]) return watchMatch[1];

  // 3. Check /shorts/ID
  const shortsMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i);
  if (shortsMatch?.[1]) return shortsMatch[1];

  // 4. Raw 11-char video ID if user pasted raw ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export const VideoSearchPage: React.FC<VideoSearchPageProps> = ({
  onPlayVideo,
  onOpenPlaylist,
  onOpenChannel
}) => {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [category, setCategory] = useState<VideoSearchCategory>('all');
  const [sort, setSort] = useState<VideoSearchSort>('relevance');
  const [dateFilter, setDateFilter] = useState<VideoSearchDateFilter>('any');

  // Results state
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [channels, setChannels] = useState<SubscribedChannel[]>([]);
  const [playlists, setPlaylists] = useState<VideoPlaylist[]>([]);
  const [continuationToken, setContinuationToken] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Explore / Trending state (Zero-query recommendations)
  const [exploreVideos, setExploreVideos] = useState<VideoItem[]>([]);
  const [isLoadingExplore, setIsLoadingExplore] = useState(true);

  // Recent searches
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Subscribed channels map (for subscribe toggle)
  const [subscribedChannelsMap, setSubscribedChannelsMap] = useState<Record<string, boolean>>({});

  // Input ref
  const inputRef = useRef<HTMLInputElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getSavedRecentSearches());
  }, []);

  // Fetch explore / trending videos on mount
  useEffect(() => {
    let isCancelled = false;
    const fetchExplore = async () => {
      try {
        setIsLoadingExplore(true);
        const feed = await innertubeService.getVideoHomeFeed();
        if (!isCancelled && feed?.videos) {
          setExploreVideos(feed.videos.slice(0, 16));
        }
      } catch (err) {
        console.warn('[VideoSearchPage] Explore feed load error:', err);
      } finally {
        if (!isCancelled) setIsLoadingExplore(false);
      }
    };
    fetchExplore();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Check detected YouTube link
  const detectedVideoId = extractYouTubeVideoId(query);

  // Execute search
  const performSearch = useCallback(
    async (
      q: string,
      cat: VideoSearchCategory = category,
      s: VideoSearchSort = sort,
      d: VideoSearchDateFilter = dateFilter
    ) => {
      const clean = q.trim();
      if (!clean) {
        setVideos([]);
        setChannels([]);
        setPlaylists([]);
        setContinuationToken(undefined);
        setHasSearched(false);
        setSubmittedQuery('');
        return;
      }

      saveRecentSearch(clean);
      setRecentSearches(getSavedRecentSearches());
      setSubmittedQuery(clean);
      setIsLoading(true);
      setHasSearched(true);

      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      const controller = new AbortController();
      searchAbortRef.current = controller;

      try {
        const result = await innertubeService.searchVideos(clean, {
          category: cat,
          sort: s,
          dateFilter: d
        });

        if (!controller.signal.aborted) {
          setVideos(result.videos || []);
          setChannels(result.channels || []);
          setPlaylists(result.playlists || []);
          setContinuationToken(result.continuationToken);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('[VideoSearchPage] Search failed:', err);
          setVideos([]);
          setChannels([]);
          setPlaylists([]);
          setContinuationToken(undefined);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [category, sort, dateFilter]
  );

  // Re-run search if category, sort, or dateFilter change while submittedQuery is active
  useEffect(() => {
    if (submittedQuery) {
      performSearch(submittedQuery, category, sort, dateFilter);
    }
  }, [category, sort, dateFilter]);

  // Load more / infinite scroll
  const handleLoadMore = useCallback(async () => {
    if (!continuationToken || isLoadingMore || isLoading) return;

    setIsLoadingMore(true);
    try {
      const nextResult = await innertubeService.getVideoSearchContinuation(
        continuationToken,
        category
      );

      if (nextResult?.videos?.length) {
        setVideos((prev) => {
          const existingIds = new Set(prev.map((v) => v.id));
          const uniqueNew = nextResult.videos.filter((v) => !existingIds.has(v.id));
          return [...prev, ...uniqueNew];
        });
      }

      if (nextResult?.channels?.length) {
        setChannels((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const uniqueNew = nextResult.channels.filter((c) => !existingIds.has(c.id));
          return [...prev, ...uniqueNew];
        });
      }

      if (nextResult?.playlists?.length) {
        setPlaylists((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const uniqueNew = nextResult.playlists.filter((p) => !existingIds.has(p.id));
          return [...prev, ...uniqueNew];
        });
      }

      setContinuationToken(nextResult.continuationToken);
    } catch (err) {
      console.warn('[VideoSearchPage] Load more error:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [continuationToken, isLoadingMore, isLoading, category]);

  // IntersectionObserver for infinite scroll sentinel
  useEffect(() => {
    if (!continuationToken || isLoadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleLoadMore();
        }
      },
      { rootMargin: '400px' }
    );

    const node = loadMoreSentinelRef.current;
    if (node) observer.observe(node);

    return () => {
      if (node) observer.unobserve(node);
      observer.disconnect();
    };
  }, [continuationToken, isLoadingMore, handleLoadMore]);

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      performSearch(query);
    }
  };

  const handleSelectRecent = (q: string) => {
    setQuery(q);
    performSearch(q);
  };

  const handleRemoveRecent = (e: React.MouseEvent, q: string) => {
    e.stopPropagation();
    removeRecentSearch(q);
    setRecentSearches(getSavedRecentSearches());
  };

  const handleClearAllRecent = () => {
    clearAllRecentSearches();
    setRecentSearches([]);
  };

  const handlePlayDetectedVideo = () => {
    if (!detectedVideoId) return;
    const directVideo: VideoItem = {
      id: detectedVideoId,
      title: `YouTube Video (${detectedVideoId})`,
      channelName: 'YouTube',
      thumbnailUrl: `https://i.ytimg.com/vi/${detectedVideoId}/hqdefault.jpg`,
      duration: 0,
      durationFormatted: 'Play',
      viewCount: 'Direct YouTube Link'
    };
    onPlayVideo(directVideo);
  };

  const toggleChannelSubscribe = (channelId: string) => {
    setSubscribedChannelsMap((prev) => ({
      ...prev,
      [channelId]: !prev[channelId]
    }));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        paddingBottom: '120px',
        color: 'var(--md-sys-color-on-surface, #e6e1e5)'
      }}
    >
      {/* Sticky Expressive Top Search Bar Area */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          backgroundColor: 'rgba(15, 13, 19, 0.88)',
          borderBottom: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))',
          padding: '16px 24px 12px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        {/* Search Input Bar */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            width: '100%',
            maxWidth: '820px',
            margin: '0 auto'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              height: '52px',
              borderRadius: '16px',
              backgroundColor: 'var(--md-sys-color-surface-container-high, #2b2930)',
              border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.12))',
              padding: '0 16px',
              gap: '12px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.22)',
              transition: 'border-color 180ms ease, box-shadow 180ms ease'
            }}
          >
            {/* Search Icon */}
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: '22px',
                color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
                flexShrink: 0
              }}
            >
              search
            </span>

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search videos, channels, or paste YouTube link..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--md-sys-color-on-surface, #e6e1e5)',
                fontSize: '15px',
                fontWeight: 500,
                letterSpacing: '0.1px'
              }}
            />

            {/* Clear Button */}
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                title="Clear query"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  padding: 0
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                  close
                </span>
              </button>
            )}

            {/* Search Submit Action Button */}
            <button
              type="submit"
              title="Search"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '36px',
                padding: '0 16px',
                borderRadius: '12px',
                backgroundColor: 'var(--md-sys-color-primary, #ffd8e4)',
                color: 'var(--md-sys-color-on-primary, #4a192c)',
                border: 'none',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'transform 140ms ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Search
            </button>
          </div>
        </form>

        {/* Filter Chips Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: '820px',
            width: '100%',
            margin: '0 auto',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          {/* Category Chips: All, Videos, Channels, Playlists */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
            {(
              [
                { id: 'all', label: 'All', icon: 'all_inclusive' },
                { id: 'videos', label: 'Videos', icon: 'smart_display' },
                { id: 'channels', label: 'Channels', icon: 'person_search' },
                { id: 'playlists', label: 'Playlists', icon: 'playlist_play' }
              ] as const
            ).map((cat) => {
              const isActive = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '12px',
                    border: isActive
                      ? '1px solid var(--md-sys-color-primary, #ffd8e4)'
                      : '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.12))',
                    backgroundColor: isActive
                      ? 'var(--md-sys-color-secondary-container, #4a4458)'
                      : 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.05))',
                    color: isActive
                      ? 'var(--md-sys-color-on-secondary-container, #e8def8)'
                      : 'var(--md-sys-color-on-surface-variant, #cac4d0)',
                    fontSize: '12.5px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 140ms ease',
                    flexShrink: 0
                  }}
                >
                  <span
                    className="material-symbols-rounded"
                    style={{
                      fontSize: '16px',
                      fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0"
                    }}
                  >
                    {cat.icon}
                  </span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sort & Date Controls */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Sort Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                className="material-symbols-rounded"
                style={{ fontSize: '15px', color: 'var(--md-sys-color-on-surface-variant, #cac4d0)' }}
              >
                swap_vert
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as VideoSearchSort)}
                style={{
                  background: 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.05))',
                  border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.12))',
                  borderRadius: '10px',
                  color: 'var(--md-sys-color-on-surface, #e6e1e5)',
                  fontSize: '12px',
                  padding: '5px 8px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="relevance">Sort: Relevance</option>
                <option value="newest">Sort: Newest</option>
                <option value="views">Sort: Most viewed</option>
                <option value="rating">Sort: Top rated</option>
              </select>
            </div>

            {/* Date Filter Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                className="material-symbols-rounded"
                style={{ fontSize: '15px', color: 'var(--md-sys-color-on-surface-variant, #cac4d0)' }}
              >
                calendar_today
              </span>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as VideoSearchDateFilter)}
                style={{
                  background: 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.05))',
                  border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.12))',
                  borderRadius: '10px',
                  color: 'var(--md-sys-color-on-surface, #e6e1e5)',
                  fontSize: '12px',
                  padding: '5px 8px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="any">Date: Any time</option>
                <option value="today">Date: Today</option>
                <option value="week">Date: This week</option>
                <option value="month">Date: This month</option>
                <option value="year">Date: This year</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '24px 24px 0 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '28px'
        }}
      >
        {/* Pasted YouTube URL Detected Card */}
        {detectedVideoId && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderRadius: '16px',
              backgroundColor: 'var(--md-sys-color-primary-container, #5e1133)',
              border: '1px solid var(--md-sys-color-primary, #ffd8e4)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.28)',
              gap: '16px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--md-sys-color-primary, #ffd8e4)',
                  color: 'var(--md-sys-color-on-primary, #4a192c)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '26px' }}>
                  link
                </span>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>
                  Direct YouTube Video Detected
                </div>
                <div
                  style={{
                    fontSize: '12.5px',
                    color: 'var(--md-sys-color-on-primary-container, #ffd8e4)',
                    opacity: 0.9
                  }}
                >
                  Video ID: <code style={{ fontWeight: 700 }}>{detectedVideoId}</code>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePlayDetectedVideo}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                borderRadius: '14px',
                backgroundColor: 'var(--md-sys-color-primary, #ffd8e4)',
                color: 'var(--md-sys-color-on-primary, #4a192c)',
                border: 'none',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
                transition: 'transform 140ms ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                play_arrow
              </span>
              <span>Watch Now</span>
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '20px'
            }}
          >
            <VideoCardSkeleton count={8} />
          </div>
        )}

        {/* RESULTS STATE */}
        {!isLoading && hasSearched && (
          <>
            {/* 1. Channel Shelf (if channels found) */}
            {channels.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    letterSpacing: '0.2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span
                    className="material-symbols-rounded"
                    style={{ fontSize: '20px', color: 'var(--md-sys-color-primary, #ffd8e4)' }}
                  >
                    person_search
                  </span>
                  <span>Channels</span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '14px'
                  }}
                >
                  {channels.map((channel) => {
                    const isSubscribed = Boolean(subscribedChannelsMap[channel.id]);
                    return (
                      <div
                        key={channel.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 18px',
                          borderRadius: '16px',
                          backgroundColor:
                            'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.05))',
                          border:
                            '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))',
                          gap: '14px'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            minWidth: 0,
                            cursor: onOpenChannel ? 'pointer' : 'default'
                          }}
                          onClick={() => onOpenChannel?.(channel.id)}
                        >
                          <img
                            src={
                              channel.avatarUrl ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                channel.name
                              )}&background=2b2930&color=fff`
                            }
                            alt={channel.name}
                            style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              flexShrink: 0
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: '14px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {channel.name}
                            </div>
                            <div
                              style={{
                                fontSize: '12px',
                                color: 'var(--md-sys-color-on-surface-variant, #cac4d0)'
                              }}
                            >
                              Channel
                            </div>
                          </div>
                        </div>

                        {/* Subscribe Button */}
                        <button
                          type="button"
                          onClick={() => toggleChannelSubscribe(channel.id)}
                          style={{
                            padding: '7px 16px',
                            borderRadius: '12px',
                            backgroundColor: isSubscribed
                              ? 'var(--md-sys-color-secondary-container, #4a4458)'
                              : 'var(--md-sys-color-primary, #ffd8e4)',
                            color: isSubscribed
                              ? 'var(--md-sys-color-on-secondary-container, #e8def8)'
                              : 'var(--md-sys-color-on-primary, #4a192c)',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer',
                            flexShrink: 0,
                            transition: 'all 140ms ease'
                          }}
                        >
                          {isSubscribed ? 'Subscribed' : 'Subscribe'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Playlist Shelf (if playlists found) */}
            {playlists.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    letterSpacing: '0.2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span
                    className="material-symbols-rounded"
                    style={{ fontSize: '20px', color: 'var(--md-sys-color-primary, #ffd8e4)' }}
                  >
                    playlist_play
                  </span>
                  <span>Playlists</span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: '16px'
                  }}
                >
                  {playlists.map((pl) => (
                    <div
                      key={pl.id}
                      onClick={() =>
                        onOpenPlaylist?.({
                          id: pl.id,
                          title: pl.title,
                          subtitle: pl.channelName,
                          imageUrl: pl.thumbnailUrl
                        })
                      }
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        backgroundColor:
                          'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.05))',
                        border:
                          '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))',
                        cursor: 'pointer',
                        transition: 'transform 180ms ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9' }}>
                        <img
                          src={pl.thumbnailUrl || 'https://via.placeholder.com/320x180'}
                          alt={pl.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {/* Playlist Overlay Badge */}
                        <div
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: '40%',
                            backgroundColor: 'rgba(0, 0, 0, 0.72)',
                            backdropFilter: 'blur(4px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            color: '#fff'
                          }}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: '24px' }}>
                            queue_music
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 700 }}>
                            {pl.videoCountText || 'Playlist'}
                          </span>
                        </div>
                      </div>

                      <div style={{ padding: '12px 14px' }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '13.5px',
                            lineHeight: 1.3,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {pl.title}
                        </div>
                        {pl.channelName && (
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
                              marginTop: '4px'
                            }}
                          >
                            {pl.channelName}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Videos Grid */}
            {videos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    letterSpacing: '0.2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span
                    className="material-symbols-rounded"
                    style={{ fontSize: '20px', color: 'var(--md-sys-color-primary, #ffd8e4)' }}
                  >
                    smart_display
                  </span>
                  <span>Videos</span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '20px'
                  }}
                >
                  {videos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      onClick={(v) => onPlayVideo(v)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {videos.length === 0 && channels.length === 0 && playlists.length === 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '64px 20px',
                  textAlign: 'center',
                  gap: '14px'
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '20px',
                    backgroundColor:
                      'var(--md-sys-color-surface-container-high, #2b2930)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--md-sys-color-on-surface-variant, #cac4d0)'
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '32px' }}>
                    search_off
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '18px' }}>
                  No video results found
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
                    maxWidth: '420px'
                  }}
                >
                  We couldn't find any videos, channels, or playlists for "{submittedQuery}". Try another keyword or change your filter settings.
                </div>
              </div>
            )}

            {/* Infinite Scroll Sentinel */}
            {continuationToken && (
              <div
                ref={loadMoreSentinelRef}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '32px 0'
                }}
              >
                {isLoadingMore && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
                      fontSize: '13px'
                    }}
                  >
                    <span
                      className="material-symbols-rounded"
                      style={{
                        animation: 'spin 1s linear infinite',
                        fontSize: '20px'
                      }}
                    >
                      progress_activity
                    </span>
                    <span>Loading more results...</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ZERO QUERY STATE (Explore & Recents) */}
        {!hasSearched && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Recent Searches Shelf */}
            {recentSearches.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span
                      className="material-symbols-rounded"
                      style={{ fontSize: '18px', color: 'var(--md-sys-color-primary, #ffd8e4)' }}
                    >
                      history
                    </span>
                    <span>Recent Searches</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearAllRecent}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: '8px'
                    }}
                  >
                    Clear all
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  {recentSearches.map((item) => (
                    <div
                      key={item}
                      onClick={() => handleSelectRecent(item)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '12px',
                        backgroundColor:
                          'var(--md-sys-color-surface-container-high, #2b2930)',
                        border:
                          '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.1))',
                        color: 'var(--md-sys-color-on-surface, #e6e1e5)',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'background-color 140ms ease'
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          'var(--md-sys-color-surface-container-highest, #36343b)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          'var(--md-sys-color-surface-container-high, #2b2930)')
                      }
                    >
                      <span
                        className="material-symbols-rounded"
                        style={{
                          fontSize: '16px',
                          color: 'var(--md-sys-color-on-surface-variant, #cac4d0)'
                        }}
                      >
                        history
                      </span>
                      <span>{item}</span>
                      <button
                        type="button"
                        onClick={(e) => handleRemoveRecent(e, item)}
                        title="Remove"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          marginLeft: '4px'
                        }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                          close
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trending & Recommended Explore Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  letterSpacing: '0.2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span
                  className="material-symbols-rounded"
                  style={{
                    fontSize: '22px',
                    color: 'var(--md-sys-color-primary, #ffd8e4)',
                    fontVariationSettings: "'FILL' 1"
                  }}
                >
                  local_fire_department
                </span>
                <span>Trending & Recommended</span>
              </div>

              {isLoadingExplore && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '20px'
                  }}
                >
                  <VideoCardSkeleton count={6} />
                </div>
              )}

              {!isLoadingExplore && exploreVideos.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '20px'
                  }}
                >
                  {exploreVideos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      onClick={(v) => onPlayVideo(v)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
