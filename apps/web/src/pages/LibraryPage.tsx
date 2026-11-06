import React, { useState, useEffect, useMemo } from 'react';
import { useTasteStore } from '../store/tasteStore';
import { usePlayerStore } from '../store/playerStore';
import { bridgeClient } from '../api/bridgeClient';
import { innertubeService, UserPlaylist } from '../api/innertubeService';
import { AuthState, TrackMetadata, VideoItem } from '../types';
import { sizedArtwork } from '../api/artworkService';
import { VideoLibraryView } from '../components/library/VideoLibraryView';
import { SHAPES } from '../design-system/tokens';
import {
  MediaCard,
  DSTrackRow,
  M3LoadingIndicator
} from '../design-system';

export interface LibraryPageProps {
  onOpenPlaylist?: (playlist: { id: string; title: string; subtitle?: string; imageUrl?: string; author?: string }) => void;
  onOpenArtist?: (artist: { id?: string; name: string; imageUrl?: string }) => void;
  videoMode?: boolean;
  onPlayVideo?: (video: VideoItem) => void;
}

type LibraryTab = 'all' | 'playlists' | 'liked' | 'artists' | 'history';
type SortOption = 'default' | 'az' | 'tracks';

export const LibraryPage: React.FC<LibraryPageProps> = ({
  onOpenPlaylist,
  onOpenArtist,
  videoMode = false,
  onPlayVideo
}) => {
  if (videoMode) {
    return (
      <VideoLibraryView
        onPlayVideo={onPlayVideo || (() => {})}
        onOpenPlaylist={onOpenPlaylist}
      />
    );
  }

  const [activeTab, setActiveTab] = useState<LibraryTab>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('default');

  const [isBridgeConnected, setIsBridgeConnected] = useState(bridgeClient.getIsAvailable());
  const [authState, setAuthState] = useState<AuthState>(bridgeClient.getAuthState());
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);

  const [ytmHistory, setYtmHistory] = useState<TrackMetadata[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const { likedTracks, history, isLiked, toggleLikeTrack } = useTasteStore();
  const { playTrack, currentTrack, isPlaying } = usePlayerStore();

  const loadPlaylists = () => {
    setLoadingPlaylists(true);
    innertubeService
      .getUserPlaylists()
      .then((items) => {
        setUserPlaylists(items);
        setLoadingPlaylists(false);
      })
      .catch((err) => {
        console.warn('[LibraryPage] Failed to load playlists:', err);
        setLoadingPlaylists(false);
      });
  };

  const loadHistory = () => {
    setLoadingHistory(true);
    innertubeService
      .getRecentlyPlayed()
      .then((tracks) => {
        setYtmHistory(tracks);
        setLoadingHistory(false);
      })
      .catch((err) => {
        console.warn('[LibraryPage] Failed to load YTM history:', err);
        setLoadingHistory(false);
      });
  };

  useEffect(() => {
    loadPlaylists();
    loadHistory();

    const unsub = bridgeClient.onAvailabilityChange((available) => {
      setIsBridgeConnected(available);
      if (available) {
        bridgeClient.refreshAuth().then((auth) => {
          setAuthState(auth);
          loadPlaylists();
          loadHistory();
        });
      }
    });

    const unsubAccount = bridgeClient.onAccountChange((auth) => {
      setAuthState(auth);
      loadPlaylists();
      loadHistory();
    });

    return () => {
      unsub();
      unsubAccount();
    };
  }, []);

  // Filter out duplicate Liked Music / LM auto-playlist items from secondary grid
  const deduplicatedPlaylists = useMemo(() => {
    return userPlaylists.filter((pl) => {
      const idLower = pl.id.toLowerCase();
      const titleLower = pl.title.toLowerCase();
      if (
        idLower === 'vllm' ||
        idLower === 'lm' ||
        idLower.startsWith('playlist_lm') ||
        titleLower === 'liked music' ||
        titleLower === 'liked songs'
      ) {
        return false;
      }
      return true;
    });
  }, [userPlaylists]);

  // Search filtered playlists
  const filteredPlaylists = useMemo(() => {
    let result = deduplicatedPlaylists;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (pl) =>
          pl.title.toLowerCase().includes(q) ||
          (pl.subtitle && pl.subtitle.toLowerCase().includes(q)) ||
          (pl.author && pl.author.toLowerCase().includes(q))
      );
    }
    // Sorting
    return [...result].sort((a, b) => {
      if (sortBy === 'az') return a.title.localeCompare(b.title);
      if (sortBy === 'tracks') {
        const countA = parseInt(a.subtitle.replace(/\D/g, '')) || 0;
        const countB = parseInt(b.subtitle.replace(/\D/g, '')) || 0;
        return countB - countA;
      }
      return 0;
    });
  }, [deduplicatedPlaylists, searchQuery, sortBy]);

  // Deep Artist Aggregation: Combines likedTracks, history, and YTM history
  const libraryArtists = useMemo(() => {
    const artistMap = new Map<string, { name: string; trackCount: number; plays: number; imageUrl?: string }>();

    // Liked songs
    for (const t of likedTracks) {
      if (!t.artist) continue;
      const existing = artistMap.get(t.artist);
      if (existing) {
        existing.trackCount += 1;
        if (!existing.imageUrl && t.thumbnailUrl) existing.imageUrl = t.thumbnailUrl;
      } else {
        artistMap.set(t.artist, { name: t.artist, trackCount: 1, plays: 0, imageUrl: t.thumbnailUrl });
      }
    }

    // Local History
    for (const h of history) {
      if (!h.artist) continue;
      const existing = artistMap.get(h.artist);
      if (existing) {
        existing.plays += h.playCount || 1;
        if (!existing.imageUrl && h.thumbnailUrl) existing.imageUrl = h.thumbnailUrl;
      } else {
        artistMap.set(h.artist, { name: h.artist, trackCount: 0, plays: h.playCount || 1, imageUrl: h.thumbnailUrl });
      }
    }

    // YTM History
    for (const y of ytmHistory) {
      if (!y.artist) continue;
      const existing = artistMap.get(y.artist);
      if (existing) {
        if (!existing.imageUrl && y.thumbnailUrl) existing.imageUrl = y.thumbnailUrl;
      } else {
        artistMap.set(y.artist, { name: y.artist, trackCount: 0, plays: 1, imageUrl: y.thumbnailUrl });
      }
    }

    let list = Array.from(artistMap.values()).sort(
      (a, b) => b.trackCount * 2 + b.plays - (a.trackCount * 2 + a.plays)
    );

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }

    return list;
  }, [likedTracks, history, ytmHistory, searchQuery]);

  // Combined History (YTM authentic history + local playback history)
  const combinedHistory = useMemo(() => {
    const seenIds = new Set<string>();
    const list: TrackMetadata[] = [];

    // Prioritize YTM authentic history
    for (const track of ytmHistory) {
      if (!seenIds.has(track.id)) {
        seenIds.add(track.id);
        list.push(track);
      }
    }

    // Append local history
    for (const entry of history) {
      if (!seenIds.has(entry.trackId)) {
        seenIds.add(entry.trackId);
        list.push({
          id: entry.trackId,
          title: entry.title,
          artist: entry.artist,
          album: entry.album,
          duration: entry.duration || 210,
          thumbnailUrl: entry.thumbnailUrl || `https://i.ytimg.com/vi/${entry.trackId}/hqdefault.jpg`,
          highResThumbnailUrl: sizedArtwork(entry.thumbnailUrl || `https://i.ytimg.com/vi/${entry.trackId}/hqdefault.jpg`, 600)
        });
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return list.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
    }
    return list;
  }, [ytmHistory, history, searchQuery]);

  // Filtered Liked Tracks
  const filteredLikedTracks = useMemo(() => {
    if (!searchQuery.trim()) return likedTracks;
    const q = searchQuery.toLowerCase().trim();
    return likedTracks.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
  }, [likedTracks, searchQuery]);

  // Total Liked Duration formatted (e.g. "1 hr 12 min")
  const totalLikedDurationFormatted = useMemo(() => {
    const totalSec = likedTracks.reduce((sum, t) => sum + (t.duration || 210), 0);
    const mins = Math.floor(totalSec / 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) return `${hrs} hr ${remMins} min`;
    return `${mins} min`;
  }, [likedTracks]);

  const handleOpenLikedSongs = () => {
    if (onOpenPlaylist) {
      onOpenPlaylist({
        id: 'playlist_LM',
        title: 'Liked Songs',
        subtitle: `${likedTracks.length} songs`,
        author: authState.selectedChannel?.name || 'You'
      });
    }
  };

  const handlePlayAllLiked = () => {
    if (likedTracks.length > 0) {
      playTrack(likedTracks[0], likedTracks);
    }
  };

  const handleShuffleLiked = () => {
    if (likedTracks.length > 0) {
      const shuffled = [...likedTracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    }
  };

  const NAV_TABS: { id: LibraryTab; label: string; count?: number; icon: string }[] = [
    { id: 'all', label: 'All', icon: 'interests' },
    { id: 'playlists', label: 'Playlists', count: deduplicatedPlaylists.length, icon: 'queue_music' },
    { id: 'liked', label: 'Liked Songs', count: likedTracks.length, icon: 'favorite' },
    { id: 'artists', label: 'Artists', count: libraryArtists.length, icon: 'person' },
    { id: 'history', label: 'History', count: combinedHistory.length, icon: 'history' }
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        paddingBottom: '160px',
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%'
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 800,
              margin: 0,
              letterSpacing: '-0.025em',
              color: 'var(--md-sys-color-on-surface)'
            }}
          >
            Library
          </h1>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--md-sys-color-on-surface-variant)',
              marginTop: '4px',
              display: 'block'
            }}
          >
            {deduplicatedPlaylists.length} playlists • {likedTracks.length} liked tracks • {libraryArtists.length} artists
          </span>
        </div>

        {/* Action Controls: Refresh & View Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Refresh Button */}
          <button
            onClick={() => {
              loadPlaylists();
              loadHistory();
            }}
            disabled={loadingPlaylists || loadingHistory}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '9999px',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              color: 'var(--md-sys-color-on-surface)',
              fontSize: '13px',
              fontWeight: 650,
              cursor: 'pointer',
              transition: 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 150ms ease'
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.93)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-highest)';
              e.currentTarget.style.transform = 'scale(1.03)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Refresh library from YouTube Music"
          >
            <span
              className={`material-symbols-rounded ${loadingPlaylists || loadingHistory ? 'spin' : ''}`}
              style={{ fontSize: '18px', color: 'var(--md-sys-color-primary)' }}
            >
              sync
            </span>
            <span>{loadingPlaylists || loadingHistory ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* Grid vs List View Mode Toggle */}
          {(activeTab === 'all' || activeTab === 'playlists') && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                borderRadius: '9999px',
                padding: '3px',
                border: '1px solid var(--md-sys-color-outline-variant)'
              }}
            >
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: viewMode === 'grid' ? 'var(--md-sys-color-secondary-container)' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-outline)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 150ms ease'
                }}
                title="Grid View"
              >
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                  grid_view
                </span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: viewMode === 'list' ? 'var(--md-sys-color-secondary-container)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-outline)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 150ms ease'
                }}
                title="List View"
              >
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                  format_list_bulleted
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Chips Bar & Inline Search / Sort Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        {/* Material 3 Expressive Filter Chips Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 18px',
                  borderRadius: '9999px',
                  border: isActive
                    ? '1px solid var(--md-sys-color-primary)'
                    : '1px solid var(--md-sys-color-outline-variant)',
                  backgroundColor: isActive
                    ? 'var(--md-sys-color-secondary-container)'
                    : 'var(--md-sys-color-surface-container)',
                  color: isActive
                    ? 'var(--md-sys-color-on-secondary-container)'
                    : 'var(--md-sys-color-on-surface-variant)',
                  fontSize: '13px',
                  fontWeight: isActive ? 750 : 550,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 180ms cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                  {tab.icon}
                </span>
                <span>
                  {tab.label} {tab.count !== undefined ? `(${tab.count})` : ''}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Search Input & Sort Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Real-time Search Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              borderRadius: '9999px',
              padding: '6px 14px',
              border: '1px solid var(--md-sys-color-outline-variant)',
              width: '220px'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--md-sys-color-outline)' }}>
              search
            </span>
            <input
              type="text"
              placeholder="Filter library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--md-sys-color-on-surface)',
                fontSize: '13px',
                width: '100%',
                fontWeight: 600
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'transparent', border: 'none', color: 'var(--md-sys-color-outline)', cursor: 'pointer', padding: 0 }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                  close
                </span>
              </button>
            )}
          </div>

          {/* Sort By Dropdown */}
          {(activeTab === 'all' || activeTab === 'playlists') && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                borderRadius: '9999px',
                padding: '7px 14px',
                color: 'var(--md-sys-color-on-surface)',
                fontSize: '12px',
                fontWeight: 650,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="default">Default Order</option>
              <option value="az">Alphabetical (A - Z)</option>
              <option value="tracks">Most Tracks</option>
            </select>
          )}
        </div>
      </div>

      {/* =========================================================================
          TAB CONTENT: ALL & PLAYLISTS
          ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'playlists') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Expressive Liked Songs Bento Hero Card */}
          <div
            onClick={handleOpenLikedSongs}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '24px 28px',
              borderRadius: '28px',
              background:
                'linear-gradient(135deg, var(--md-sys-color-primary-container) 0%, var(--md-sys-color-surface-container-high) 100%)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              boxShadow: '0 8px 24px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.12))',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 240ms ease',
              flexWrap: 'wrap',
              gap: '20px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px) scale(1.008)';
              e.currentTarget.style.boxShadow = '0 16px 40px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.22))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 24px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.12))';
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(-4px) scale(1.008)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', minWidth: 0 }}>
              {/* 12-Lobed Softburst Heart Badge */}
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  clipPath: SHAPES.softBurst,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
              >
                <span className="material-symbols-rounded filled" style={{ fontSize: '32px' }}>
                  favorite
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--md-sys-color-primary)'
                  }}
                >
                  Favorite Collection
                </span>
                <h2
                  style={{
                    fontSize: '24px',
                    fontWeight: 800,
                    margin: '2px 0 4px 0',
                    color: 'var(--md-sys-color-on-surface)'
                  }}
                >
                  Liked Songs
                </h2>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 550,
                    color: 'var(--md-sys-color-on-surface-variant)'
                  }}
                >
                  {likedTracks.length} tracks • {totalLikedDurationFormatted}
                </span>
              </div>
            </div>

            {/* Quick Actions Deck */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Shuffle Button */}
              <button
                onClick={handleShuffleLiked}
                disabled={likedTracks.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  color: 'var(--md-sys-color-on-surface)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: likedTracks.length > 0 ? 'pointer' : 'default',
                  transition: 'all 150ms ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-highest)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container)')}
                title="Shuffle liked tracks"
              >
                <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                  shuffle
                </span>
                <span>Shuffle</span>
              </button>

              {/* Play All FAB */}
              <button
                onClick={handlePlayAllLiked}
                disabled={likedTracks.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 22px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: likedTracks.length > 0 ? 'pointer' : 'default',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                  transition: 'transform 150ms ease'
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                title="Play all liked tracks"
              >
                <span className="material-symbols-rounded filled" style={{ fontSize: '20px' }}>
                  play_arrow
                </span>
                <span>Play All</span>
              </button>
            </div>
          </div>

          {/* Loading Indicator */}
          {loadingPlaylists && filteredPlaylists.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
              <M3LoadingIndicator contained size="lg" message="Syncing YouTube Music playlists..." />
            </div>
          )}

          {/* Playlists: Grid View */}
          {viewMode === 'grid' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gap: '18px'
              }}
            >
              {filteredPlaylists.map((pl, plIdx) => (
                <MediaCard
                  key={pl.id}
                  id={pl.id}
                  index={plIdx}
                  title={pl.title}
                  subtitle={pl.subtitle}
                  imageUrl={pl.imageUrl}
                  isPlaylist={true}
                  onClick={() => {
                    if (onOpenPlaylist) {
                      onOpenPlaylist({
                        id: pl.id,
                        title: pl.title,
                        subtitle: pl.subtitle,
                        imageUrl: pl.imageUrl,
                        author: pl.author
                      });
                    }
                  }}
                  onPlay={async () => {
                    const tracks = await innertubeService.resolvePlaylistTracks(pl.id);
                    if (tracks.length > 0) {
                      playTrack(tracks[0], tracks);
                    }
                  }}
                />
              ))}
            </div>
          )}

          {/* Playlists: Compact List View */}
          {viewMode === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredPlaylists.map((pl) => (
                <div
                  key={pl.id}
                  onClick={() => {
                    if (onOpenPlaylist) {
                      onOpenPlaylist({
                        id: pl.id,
                        title: pl.title,
                        subtitle: pl.subtitle,
                        imageUrl: pl.imageUrl,
                        author: pl.author
                      });
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    borderRadius: '16px',
                    backgroundColor: 'var(--md-sys-color-surface-container)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    cursor: 'pointer',
                    transition: 'all 150ms ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                    <img
                      src={sizedArtwork(pl.imageUrl, 100)}
                      alt={pl.title}
                      style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                        {pl.title}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '2px' }}>
                        Playlist • {pl.author || 'You'} • {pl.subtitle}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const tracks = await innertubeService.resolvePlaylistTracks(pl.id);
                      if (tracks.length > 0) playTrack(tracks[0], tracks);
                    }}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--md-sys-color-primary)',
                      color: 'var(--md-sys-color-on-primary)',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    title="Play playlist"
                  >
                    <span className="material-symbols-rounded filled" style={{ fontSize: '20px' }}>
                      play_arrow
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Empty Playlist Fallback */}
          {!loadingPlaylists && filteredPlaylists.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                gap: '12px',
                color: 'var(--md-sys-color-on-surface-variant)'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '48px', color: 'var(--md-sys-color-outline)' }}>
                queue_music
              </span>
              <p style={{ fontSize: '15px', fontWeight: 650 }}>No playlists found</p>
              <span style={{ fontSize: '13px' }}>
                {searchQuery ? `No playlists matching "${searchQuery}"` : 'Your saved YouTube Music playlists will appear here.'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT: LIKED SONGS
          ========================================================================= */}
      {activeTab === 'liked' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Summary Card */}
          <div
            style={{
              padding: '24px 28px',
              borderRadius: '24px',
              backgroundColor: 'var(--md-sys-color-surface-container)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--md-sys-color-on-surface)' }}>
                Liked Songs ({filteredLikedTracks.length})
              </h2>
              <span style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                Total duration: {totalLikedDurationFormatted}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={handleShuffleLiked}
                disabled={filteredLikedTracks.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 18px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--md-sys-color-surface-container-high)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  color: 'var(--md-sys-color-on-surface)',
                  fontSize: '13px',
                  fontWeight: 650,
                  cursor: 'pointer'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                  shuffle
                </span>
                <span>Shuffle</span>
              </button>

              <button
                onClick={handlePlayAllLiked}
                disabled={filteredLikedTracks.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 20px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 750,
                  cursor: 'pointer'
                }}
              >
                <span className="material-symbols-rounded filled" style={{ fontSize: '18px' }}>
                  play_arrow
                </span>
                <span>Play</span>
              </button>
            </div>
          </div>

          {/* Liked Track Rows */}
          {filteredLikedTracks.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                gap: '12px',
                color: 'var(--md-sys-color-on-surface-variant)'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '48px', color: 'var(--md-sys-color-outline)' }}>
                favorite_border
              </span>
              <p style={{ fontSize: '15px', fontWeight: 650 }}>No liked songs found</p>
              <span style={{ fontSize: '13px' }}>Heart tracks while listening to build your collection.</span>
            </div>
          ) : (
            filteredLikedTracks.map((track, idx) => {
              const isTrackPlaying = currentTrack?.id === track.id && isPlaying;
              return (
                <DSTrackRow
                  key={track.id}
                  style={{
                    animation: `m3CardCascade 320ms var(--m3-ease-emphasized-decelerate) ${Math.min(idx * 25, 300)}ms both`
                  }}
                  rank={idx + 1}
                  title={track.title}
                  artist={track.artist}
                  album={track.album}
                  duration={track.duration}
                  imageUrl={track.thumbnailUrl}
                  isPlaying={isTrackPlaying}
                  isLiked={true}
                  onPlay={() => playTrack(track, filteredLikedTracks)}
                  onToggleLike={() => toggleLikeTrack(track)}
                  onArtistClick={() => onOpenArtist?.({ name: track.artist })}
                />
              );
            })
          )}
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT: ARTISTS
          ========================================================================= */}
      {activeTab === 'artists' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '18px'
            }}
          >
            {libraryArtists.map((artist, idx) => (
              <div
                key={idx}
                onClick={() => onOpenArtist?.({ name: artist.name, imageUrl: artist.imageUrl })}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  padding: '20px 16px',
                  borderRadius: '24px',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'transform 180ms ease, box-shadow 180ms ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 10px 28px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.15))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* 12-Lobed Scallop / Circle Avatar */}
                <div
                  style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    backgroundColor: 'var(--md-sys-color-surface-container-high)',
                    marginBottom: '14px',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {artist.imageUrl ? (
                    <img
                      src={sizedArtwork(artist.imageUrl, 200)}
                      alt={artist.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                  ) : (
                    <span className="material-symbols-rounded" style={{ fontSize: '40px', color: 'var(--md-sys-color-primary)' }}>
                      person
                    </span>
                  )}
                </div>

                <span
                  style={{
                    fontSize: '15px',
                    fontWeight: 750,
                    color: 'var(--md-sys-color-on-surface)',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={artist.name}
                >
                  {artist.name}
                </span>

                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--md-sys-color-on-surface-variant)',
                    marginTop: '4px'
                  }}
                >
                  {artist.trackCount > 0
                    ? `${artist.trackCount} saved track${artist.trackCount > 1 ? 's' : ''}`
                    : `${artist.plays} play${artist.plays > 1 ? 's' : ''}`}
                </span>
              </div>
            ))}
          </div>

          {libraryArtists.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                gap: '12px',
                color: 'var(--md-sys-color-on-surface-variant)'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '48px', color: 'var(--md-sys-color-outline)' }}>
                person
              </span>
              <p style={{ fontSize: '15px', fontWeight: 650 }}>No artists found</p>
              <span style={{ fontSize: '13px' }}>Artists will populate as you save and play music.</span>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT: AUTHENTIC YOUTUBE MUSIC HISTORY
          ========================================================================= */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loadingHistory && combinedHistory.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
              <M3LoadingIndicator contained size="lg" message="Fetching YouTube Music listening history..." />
            </div>
          )}

          {combinedHistory.length === 0 && !loadingHistory ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                gap: '12px',
                color: 'var(--md-sys-color-on-surface-variant)'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '48px', color: 'var(--md-sys-color-outline)' }}>
                history
              </span>
              <p style={{ fontSize: '15px', fontWeight: 650 }}>No listening history found</p>
              <span style={{ fontSize: '13px' }}>Tracks you play on OurTube or YouTube Music will appear here.</span>
            </div>
          ) : (
            combinedHistory.map((track, idx) => {
              const isThisPlaying = currentTrack?.id === track.id && isPlaying;
              return (
                <DSTrackRow
                  key={`${track.id}-${idx}`}
                  style={{
                    animation: `m3CardCascade 320ms var(--m3-ease-emphasized-decelerate) ${Math.min(idx * 25, 300)}ms both`
                  }}
                  title={track.title}
                  artist={track.artist}
                  album={track.album}
                  duration={track.duration}
                  imageUrl={track.thumbnailUrl}
                  isPlaying={isThisPlaying}
                  isLiked={isLiked(track.id)}
                  onPlay={() => playTrack(track, combinedHistory)}
                  onToggleLike={(e) => {
                    e.stopPropagation();
                    toggleLikeTrack(track);
                  }}
                  onArtistClick={() => onOpenArtist?.({ name: track.artist })}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
