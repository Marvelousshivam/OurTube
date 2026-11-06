import React, { useEffect, useMemo, useState } from 'react';
import { VideoItem, VideoPlaylist } from '../../types';
import { innertubeService } from '../../api/innertubeService';
import { VideoCard } from '../video/VideoCard';
import { VideoCardSkeleton } from '../video/VideoCardSkeleton';
import { bridgeClient } from '../../api/bridgeClient';

export interface VideoLibraryViewProps {
  onPlayVideo: (video: VideoItem) => void;
  onOpenPlaylist?: (playlist: { id: string; title: string; subtitle?: string; imageUrl?: string; author?: string }) => void;
}

type VideoLibraryTab = 'all' | 'playlists' | 'history' | 'watchLater' | 'liked';
type VideoSortOption = 'recent' | 'az' | 'channel';

export const VideoLibraryView: React.FC<VideoLibraryViewProps> = ({ onPlayVideo, onOpenPlaylist }) => {
  const [activeTab, setActiveTab] = useState<VideoLibraryTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<VideoSortOption>('recent');

  const [historyVideos, setHistoryVideos] = useState<VideoItem[]>([]);
  const [watchLaterVideos, setWatchLaterVideos] = useState<VideoItem[]>([]);
  const [likedVideos, setLikedVideos] = useState<VideoItem[]>([]);
  const [playlists, setPlaylists] = useState<VideoPlaylist[]>([]);

  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingWatchLater, setLoadingWatchLater] = useState(false);
  const [loadingLiked, setLoadingLiked] = useState(false);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAllVideoData = async () => {
    setIsRefreshing(true);
    setLoadingHistory(true);
    setLoadingPlaylists(true);

    try {
      const historyPromise = innertubeService.getVideoHistory().then((vids) => {
        setHistoryVideos(vids);
        setLoadingHistory(false);
      });

      const watchLaterPromise = innertubeService.getVideoWatchLater().then((vids) => {
        setWatchLaterVideos(vids);
        setLoadingWatchLater(false);
      });

      const likedPromise = innertubeService.getVideoLikedVideos().then((vids) => {
        setLikedVideos(vids);
        setLoadingLiked(false);
      });

      const playlistsPromise = innertubeService.getVideoPlaylists().then((pls) => {
        setPlaylists(pls);
        setLoadingPlaylists(false);
      });

      await Promise.allSettled([historyPromise, watchLaterPromise, likedPromise, playlistsPromise]);
    } finally {
      setIsRefreshing(false);
      setLoadingHistory(false);
      setLoadingWatchLater(false);
      setLoadingLiked(false);
      setLoadingPlaylists(false);
    }
  };

  useEffect(() => {
    loadAllVideoData();

    const unsubBridge = bridgeClient.onAvailabilityChange((available) => {
      if (available) {
        loadAllVideoData();
      }
    });

    return () => unsubBridge();
  }, []);

  // Most recent partially-watched or top history video for "Continue Watching" hero
  const continueWatchingVideo = useMemo(() => {
    const inProgress = historyVideos.find(
      (v) => typeof v.watchedPercentage === 'number' && v.watchedPercentage > 0 && v.watchedPercentage < 95
    );
    return inProgress || historyVideos[0] || null;
  }, [historyVideos]);

  // Active collection based on tab
  const activeCollectionVideos = useMemo(() => {
    let source: VideoItem[] = [];
    if (activeTab === 'all') {
      const seen = new Set<string>();
      for (const v of [...historyVideos, ...watchLaterVideos, ...likedVideos]) {
        if (!seen.has(v.id)) {
          seen.add(v.id);
          source.push(v);
        }
      }
    } else if (activeTab === 'history') {
      source = historyVideos;
    } else if (activeTab === 'watchLater') {
      source = watchLaterVideos;
    } else if (activeTab === 'liked') {
      source = likedVideos;
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      source = source.filter(
        (v) => v.title.toLowerCase().includes(q) || v.channelName.toLowerCase().includes(q)
      );
    }

    // Apply sorting
    if (sortBy === 'az') {
      return [...source].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortBy === 'channel') {
      return [...source].sort((a, b) => a.channelName.localeCompare(b.channelName));
    }

    return source;
  }, [activeTab, searchQuery, sortBy, historyVideos, watchLaterVideos, likedVideos]);

  // Active playlist collection when activeTab === 'playlists'
  const filteredPlaylists = useMemo(() => {
    let list = playlists;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) => p.title.toLowerCase().includes(q) || (p.channelName && p.channelName.toLowerCase().includes(q))
      );
    }
    if (sortBy === 'az') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortBy === 'channel') {
      return [...list].sort((a, b) => (a.channelName || '').localeCompare(b.channelName || ''));
    }
    return list;
  }, [playlists, searchQuery, sortBy]);

  const isLoading = activeTab === 'playlists'
    ? loadingPlaylists && playlists.length === 0
    : loadingHistory && historyVideos.length === 0;

  return (
    <div
      style={{
        paddingBottom: '160px',
        animation: 'kodaFadeIn 280ms cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* 1. Header & Quick Metrics */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '26px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--md-sys-color-on-surface, #e6e1e5)'
            }}
          >
            Video Library
          </h1>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--md-sys-color-on-surface-variant, #cac4d0)'
            }}
          >
            {historyVideos.length} watched • {watchLaterVideos.length} watch later • {likedVideos.length} liked
          </p>
        </div>

        {/* Sync / Refresh Button */}
        <button
          type="button"
          onClick={loadAllVideoData}
          disabled={isRefreshing}
          title="Sync YouTube Video Library"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '9999px',
            backgroundColor: 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.06))',
            border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.12))',
            color: 'var(--md-sys-color-on-surface, #e6e1e5)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: isRefreshing ? 'default' : 'pointer',
            transition: 'all 160ms ease',
            outline: 'none'
          }}
          onMouseEnter={(e) => {
            if (!isRefreshing) e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high, rgba(255, 255, 255, 0.1))';
          }}
          onMouseLeave={(e) => {
            if (!isRefreshing) e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.06))';
          }}
        >
          <span
            className="material-symbols-rounded"
            style={{
              fontSize: '18px',
              animation: isRefreshing ? 'kodaSpin 1s linear infinite' : 'none'
            }}
          >
            sync
          </span>
          <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
        </button>
      </div>

      {/* 2. Filter Pills Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '14px',
          marginBottom: '18px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          style={filterPillStyle(activeTab === 'all')}
        >
          All
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('playlists')}
          style={filterPillStyle(activeTab === 'playlists')}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
            playlist_play
          </span>
          <span>Playlists ({playlists.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          style={filterPillStyle(activeTab === 'history')}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
            history
          </span>
          <span>History ({historyVideos.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('watchLater')}
          style={filterPillStyle(activeTab === 'watchLater')}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
            watch_later
          </span>
          <span>Watch Later ({watchLaterVideos.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('liked')}
          style={filterPillStyle(activeTab === 'liked')}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
            thumb_up
          </span>
          <span>Liked Videos ({likedVideos.length})</span>
        </button>
      </div>

      {/* 3. Continue Watching Spotlight Banner (Shown in 'all' or 'history' tab) */}
      {(activeTab === 'all' || activeTab === 'history') && continueWatchingVideo && !searchQuery && (
        <div
          style={{
            position: 'relative',
            borderRadius: '20px',
            backgroundColor: 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.05))',
            border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))',
            padding: '20px 24px',
            marginBottom: '26px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '24px',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
          }}
        >
          {/* Left: Thumbnail Preview with Red Progress Bar */}
          <div
            onClick={() => onPlayVideo(continueWatchingVideo)}
            style={{
              position: 'relative',
              width: '260px',
              minWidth: '220px',
              aspectRatio: '16 / 9',
              borderRadius: '14px',
              overflow: 'hidden',
              cursor: 'pointer',
              backgroundColor: '#1f1e24',
              flexShrink: 0
            }}
          >
            <img
              src={continueWatchingVideo.thumbnailUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />

            {/* Play Button Overlay */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: '#ffd8e4',
                  color: '#381e72',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '26px' }}>
                  play_arrow
                </span>
              </div>
            </div>

            {/* Red Progress Bar */}
            {typeof continueWatchingVideo.watchedPercentage === 'number' && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                  zIndex: 2
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(5, continueWatchingVideo.watchedPercentage))}%`,
                    backgroundColor: '#ff0000'
                  }}
                />
              </div>
            )}
          </div>

          {/* Right: Meta & Actions */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 10px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 216, 228, 0.15)',
                color: '#ffd8e4',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: '8px'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>
                play_circle
              </span>
              <span>Continue Watching</span>
            </div>

            <h2
              style={{
                margin: '0 0 6px',
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--md-sys-color-on-surface, #e6e1e5)',
                lineHeight: 1.3,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {continueWatchingVideo.title}
            </h2>

            <p
              style={{
                margin: '0 0 14px',
                fontSize: '13px',
                color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
                fontWeight: 500
              }}
            >
              {continueWatchingVideo.channelName} • {continueWatchingVideo.durationFormatted}
              {typeof continueWatchingVideo.watchedPercentage === 'number' && ` • ${continueWatchingVideo.watchedPercentage}% watched`}
            </p>

            <button
              type="button"
              onClick={() => onPlayVideo(continueWatchingVideo)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                borderRadius: '9999px',
                backgroundColor: '#ffd8e4',
                color: '#381e72',
                border: 'none',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(255, 216, 228, 0.3)',
                transition: 'transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                resume
              </span>
              <span>Resume Video</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Search & Sort Controls Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '20px'
        }}
      >
        {/* Search Input */}
        <div
          style={{
            flex: 1,
            maxWidth: '360px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <span
            className="material-symbols-rounded"
            style={{
              position: 'absolute',
              left: '12px',
              fontSize: '18px',
              color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
              pointerEvents: 'none'
            }}
          >
            search
          </span>
          <input
            type="text"
            placeholder="Filter video library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 38px',
              borderRadius: '9999px',
              border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.12))',
              backgroundColor: 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.05))',
              color: 'var(--md-sys-color-on-surface, #e6e1e5)',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>

        {/* Sort Select */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as VideoSortOption)}
          style={{
            padding: '8px 14px',
            borderRadius: '9999px',
            backgroundColor: 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.06))',
            border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.12))',
            color: 'var(--md-sys-color-on-surface, #e6e1e5)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          <option value="recent">Recently Watched</option>
          <option value="az">Title (A-Z)</option>
          <option value="channel">Channel Name</option>
        </select>
      </div>

      {/* 5. Video or Playlist Grid Content */}
      {isLoading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: activeTab === 'playlists' ? 'repeat(auto-fill, minmax(280px, 1fr))' : 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '24px 20px'
          }}
        >
          <VideoCardSkeleton count={6} />
        </div>
      ) : activeTab === 'playlists' ? (
        filteredPlaylists.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 20px',
              backgroundColor: 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.03))',
              borderRadius: '24px'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '48px', color: 'var(--md-sys-color-outline)' }}>
              playlist_play
            </span>
            <p style={{ marginTop: '14px', fontSize: '16px', fontWeight: 600, color: 'var(--md-sys-color-on-surface)' }}>
              {searchQuery ? 'No playlists matched your filter' : 'No video playlists found'}
            </p>
            <p style={{ margin: '4px 0 16px', fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Your YouTube playlists and saved mixes will appear here.
            </p>
            <button
              type="button"
              onClick={loadAllVideoData}
              style={{
                padding: '8px 20px',
                borderRadius: '9999px',
                backgroundColor: '#ffd8e4',
                color: '#381e72',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Refresh Library
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '24px 20px'
            }}
          >
            {filteredPlaylists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => {
                  if (onOpenPlaylist) {
                    onOpenPlaylist({
                      id: pl.id,
                      title: pl.title,
                      imageUrl: pl.thumbnailUrl,
                      author: pl.channelName
                    });
                  }
                }}
                role="button"
                tabIndex={0}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  borderRadius: '16px',
                  padding: '10px',
                  backgroundColor: 'var(--md-sys-color-surface-container-low, rgba(255, 255, 255, 0.02))',
                  border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.06))',
                  transition: 'transform 180ms ease, background-color 180ms ease',
                  outline: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.06))';
                  e.currentTarget.style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-low, rgba(255, 255, 255, 0.02))';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '16 / 9',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    backgroundColor: '#1b1b1f'
                  }}
                >
                  {pl.thumbnailUrl ? (
                    <img
                      src={pl.thumbnailUrl}
                      alt={pl.title}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--md-sys-color-outline)'
                      }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: '40px' }}>
                        playlist_play
                      </span>
                    </div>
                  )}

                  <div
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      backdropFilter: 'blur(6px)',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#fff'
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>
                      playlist_play
                    </span>
                    <span>{pl.videoCountText || 'Playlist'}</span>
                  </div>
                </div>

                <h3
                  style={{
                    margin: '10px 0 4px',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--md-sys-color-on-surface, #e6e1e5)',
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {pl.title}
                </h3>
                {pl.channelName && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: '12px',
                      color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
                      fontWeight: 500
                    }}
                  >
                    {pl.channelName}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      ) : activeCollectionVideos.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 20px',
            backgroundColor: 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.03))',
            borderRadius: '24px'
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '48px', color: 'var(--md-sys-color-outline)' }}>
            history
          </span>
          <p style={{ marginTop: '14px', fontSize: '16px', fontWeight: 600, color: 'var(--md-sys-color-on-surface)' }}>
            {searchQuery
              ? 'No videos matched your filter'
              : activeTab === 'watchLater'
              ? 'Your Watch Later list is empty'
              : activeTab === 'liked'
              ? 'No liked videos found'
              : 'No YouTube watch history found'}
          </p>
          <p style={{ margin: '4px 0 16px', fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)' }}>
            Videos you watch on YouTube or OurTube with your connected Google account will appear here.
          </p>
          <button
            type="button"
            onClick={loadAllVideoData}
            style={{
              padding: '8px 20px',
              borderRadius: '9999px',
              backgroundColor: '#ffd8e4',
              color: '#381e72',
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Refresh Library
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '26px 20px'
          }}
        >
          {activeCollectionVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onClick={onPlayVideo}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes kodaSpin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const filterPillStyle = (isSelected: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '7px 16px',
  borderRadius: '9999px',
  fontSize: '13px',
  fontWeight: isSelected ? 700 : 500,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  border: isSelected
    ? '1px solid transparent'
    : '1px solid var(--md-sys-color-outline-variant, rgba(255,255,255,0.12))',
  backgroundColor: isSelected
    ? '#ffd8e4' // Koda pastel rose
    : 'var(--md-sys-color-surface-container, rgba(255,255,255,0.06))',
  color: isSelected ? '#381e72' : 'var(--md-sys-color-on-surface, #e6e1e5)',
  boxShadow: isSelected ? '0 2px 8px rgba(244, 114, 182, 0.25)' : 'none',
  outline: 'none',
  transition: 'all 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  flexShrink: 0
});
