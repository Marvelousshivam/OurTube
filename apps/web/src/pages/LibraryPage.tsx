import React, { useState, useEffect, useMemo } from 'react';
import { useTasteStore, LocalPlaylistItem } from '../store/tasteStore';
import { usePlayerStore } from '../store/playerStore';
import { bridgeClient } from '../api/bridgeClient';
import { innertubeService, UserPlaylist, isLikelyNonMusicVideo } from '../api/innertubeService';
import { AuthState, TrackMetadata, VideoItem } from '../types';
import { sizedArtwork, handleArtworkError } from '../api/artworkService';
import { VideoLibraryView } from '../components/library/VideoLibraryView';
import { SHAPES } from '../design-system/tokens';
import {
  MediaCard,
  DSTrackRow,
  M3LoadingIndicator
} from '../design-system';
import {
  ListeningStatsView,
  computeListeningStats,
  formatListeningTime,
  M3_EXPRESSIVE_SHAPES
} from '../components/music/ListeningStatsView';
import { ListeningHistoryView } from '../components/music/ListeningHistoryView';

export interface LibraryPageProps {
  onOpenPlaylist?: (playlist: {
    id: string;
    title: string;
    subtitle?: string;
    imageUrl?: string;
    author?: string;
  }) => void;
  onOpenArtist?: (artist: { id?: string; name: string; imageUrl?: string }) => void;
  videoMode?: boolean;
  onPlayVideo?: (video: VideoItem) => void;
}

type LibraryTab = 'all' | 'playlists' | 'albums' | 'artists' | 'liked' | 'history' | 'insights';
type PlaylistSortOption = 'default' | 'az' | 'tracks';
type TrackSortOption = 'title' | 'artist' | 'album' | 'most_played' | 'recently_added';
type GroupSortOption = 'most_played' | 'name' | 'count';

function formatRelativeDate(timestampMs?: number): string {
  if (!timestampMs) return '';
  const days = Math.floor((Date.now() - timestampMs) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

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

  const [activeTab, setActiveTabState] = useState<LibraryTab>(() => {
    const saved = localStorage.getItem('koda_library_tab') as LibraryTab | null;
    if (
      saved &&
      ['all', 'playlists', 'albums', 'artists', 'liked', 'history', 'insights'].includes(saved)
    ) {
      return saved;
    }
    return 'all';
  });

  const setActiveTab = (tab: LibraryTab) => {
    setActiveTabState(tab);
    localStorage.setItem('koda_library_tab', tab);
    setSelectedAlbumName(null);
    setSelectedLocalPlaylistId(null);
  };

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [playlistSortBy, setPlaylistSortBy] = useState<PlaylistSortOption>('default');
  const [trackSortBy, setTrackSortBy] = useState<TrackSortOption>(() => {
    return (localStorage.getItem('koda_library_track_sort') as TrackSortOption) || 'most_played';
  });
  const [albumSortBy, setAlbumSortBy] = useState<GroupSortOption>('most_played');
  const [artistSortBy, setArtistSortBy] = useState<GroupSortOption>('most_played');

  const [selectedAlbumName, setSelectedAlbumName] = useState<string | null>(null);
  const [selectedLocalPlaylistId, setSelectedLocalPlaylistId] = useState<string | null>(null);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<LocalPlaylistItem | null>(null);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [showHiddenPlaylistsSheet, setShowHiddenPlaylistsSheet] = useState(false);
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState<TrackMetadata | null>(null);

  const [isBridgeConnected, setIsBridgeConnected] = useState(bridgeClient.getIsAvailable());
  const [authState, setAuthState] = useState<AuthState>(bridgeClient.getAuthState());
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);

  const [ytmHistory, setYtmHistory] = useState<TrackMetadata[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const {
    likedTracks,
    history,
    playLog,
    localPlaylists,
    hiddenPlaylists,
    saveMusicHistory,
    isLiked,
    toggleLikeTrack,
    savedPlaylists,
    followedArtists,
    removePlayHistoryEntry,
    clearMusicHistory,
    restoreMusicHistory,
    setSaveMusicHistory,
    createLocalPlaylist,
    updateLocalPlaylist,
    deleteLocalPlaylist,
    addTrackToLocalPlaylist,
    removeTrackFromLocalPlaylist,
    hidePlaylist,
    unhidePlaylist,
    toggleSavePlaylist
  } = useTasteStore();

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

  // Listening stats summary (matching temp_koda StatsRepository)
  const listeningStats = useMemo(
    () => computeListeningStats(playLog, history, likedTracks),
    [playLog, history, likedTracks]
  );

  // Play counts map by trackId
  const playCountsMap = useMemo(() => {
    const map = new Map<string, { count: number; lastPlayed: number }>();
    for (const h of history) {
      map.set(h.trackId, {
        count: h.playCount || 1,
        lastPlayed: h.playedAt || 0
      });
    }
    for (const p of playLog) {
      const existing = map.get(p.trackId);
      if (!existing) {
        map.set(p.trackId, { count: 1, lastPlayed: p.timestamp });
      }
    }
    return map;
  }, [history, playLog]);

  // Filter out duplicate Liked Music / LM auto-playlist items and merge localPlaylists + savedPlaylists
  const hiddenIds = useMemo(
    () => new Set(hiddenPlaylists.map((h) => h.id)),
    [hiddenPlaylists]
  );

  const deduplicatedPlaylists = useMemo(() => {
    const remoteFiltered = userPlaylists.filter((pl) => {
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
      if (hiddenIds.has(pl.id)) return false;
      return true;
    });

    const seenIds = new Set(remoteFiltered.map((p) => p.id.replace(/^playlist_/, '')));
    const merged: (UserPlaylist & { isLocal?: boolean; isSaved?: boolean; description?: string })[] =
      [...remoteFiltered];

    // Prepend savedPlaylists
    for (const sp of savedPlaylists) {
      if (hiddenIds.has(sp.id)) continue;
      const cleanId = sp.id.replace(/^playlist_/, '');
      if (!seenIds.has(cleanId)) {
        seenIds.add(cleanId);
        merged.unshift({
          id: sp.id,
          title: sp.title,
          subtitle: sp.subtitle || 'Saved Playlist',
          imageUrl: sp.thumbnailUrl || '',
          author: sp.subtitle || 'Saved',
          trackCount: sp.trackCount,
          isSaved: true
        });
      }
    }

    // Prepend localPlaylists
    for (const lp of localPlaylists) {
      if (hiddenIds.has(lp.id)) continue;
      merged.unshift({
        id: lp.id,
        title: lp.title,
        subtitle: `${lp.tracks.length} ${lp.tracks.length === 1 ? 'song' : 'songs'}`,
        imageUrl:
          lp.thumbnailUrl ||
          lp.tracks[0]?.highResThumbnailUrl ||
          lp.tracks[0]?.thumbnailUrl ||
          '',
        author: 'You • Local',
        trackCount: lp.tracks.length,
        isLocal: true,
        description: lp.description
      });
    }

    return merged;
  }, [userPlaylists, savedPlaylists, localPlaylists, hiddenIds]);

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
    return [...result].sort((a, b) => {
      if (playlistSortBy === 'az') return a.title.localeCompare(b.title);
      if (playlistSortBy === 'tracks') {
        const countA = a.trackCount ?? (parseInt(a.subtitle.replace(/\D/g, '')) || 0);
        const countB = b.trackCount ?? (parseInt(b.subtitle.replace(/\D/g, '')) || 0);
        return countB - countA;
      }
      return 0;
    });
  }, [deduplicatedPlaylists, searchQuery, playlistSortBy]);

  // Unified Library Songs (Liked songs + local playlists songs + played history songs)
  const allLibrarySongs = useMemo(() => {
    const songMap = new Map<string, TrackMetadata & { addedAt?: number }>();

    likedTracks.forEach((t, idx) => {
      songMap.set(t.id, {
        ...t,
        addedAt: Date.now() - idx * 60_000
      });
    });

    for (const lp of localPlaylists) {
      for (const t of lp.tracks) {
        if (!songMap.has(t.id)) {
          songMap.set(t.id, { ...t, addedAt: lp.updatedAt });
        }
      }
    }

    for (const h of history) {
      if (isLikelyNonMusicVideo(h)) continue;
      if (!songMap.has(h.trackId)) {
        const thumb =
          h.highResThumbnailUrl ||
          h.thumbnailUrl ||
          `https://i.ytimg.com/vi/${h.trackId}/hqdefault.jpg`;
        songMap.set(h.trackId, {
          id: h.trackId,
          title: h.title,
          artist: h.artist,
          artistId: h.artistId,
          album: h.album,
          duration: h.duration || 210,
          thumbnailUrl: thumb,
          highResThumbnailUrl: sizedArtwork(thumb, 600),
          addedAt: h.playedAt
        });
      }
    }

    let list = Array.from(songMap.values());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q) ||
          (s.album && s.album.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => {
      if (trackSortBy === 'title') return a.title.localeCompare(b.title);
      if (trackSortBy === 'artist') return a.artist.localeCompare(b.artist);
      if (trackSortBy === 'album') return (a.album || 'ZZZ').localeCompare(b.album || 'ZZZ');
      if (trackSortBy === 'most_played') {
        const playsA = playCountsMap.get(a.id)?.count || 0;
        const playsB = playCountsMap.get(b.id)?.count || 0;
        if (playsB !== playsA) return playsB - playsA;
        return a.title.localeCompare(b.title);
      }
      if (trackSortBy === 'recently_added') {
        return (b.addedAt || 0) - (a.addedAt || 0);
      }
      return 0;
    });
  }, [likedTracks, localPlaylists, history, searchQuery, trackSortBy, playCountsMap]);

  // Recently played rail (deduplicated 15 most recent songs, matching temp_koda recentlyPlayed rail)
  const recentlyPlayedRail = useMemo(() => {
    const seen = new Set<string>();
    const list: TrackMetadata[] = [];

    for (const entry of history) {
      if (!seen.has(entry.trackId) && !isLikelyNonMusicVideo(entry)) {
        seen.add(entry.trackId);
        const thumb =
          entry.highResThumbnailUrl ||
          entry.thumbnailUrl ||
          `https://i.ytimg.com/vi/${entry.trackId}/hqdefault.jpg`;
        list.push({
          id: entry.trackId,
          title: entry.title,
          artist: entry.artist,
          artistId: entry.artistId,
          album: entry.album,
          duration: entry.duration || 210,
          thumbnailUrl: thumb,
          highResThumbnailUrl: sizedArtwork(thumb, 600)
        });
      }
      if (list.length >= 15) break;
    }

    if (list.length < 15) {
      for (const yt of ytmHistory) {
        if (!seen.has(yt.id) && !isLikelyNonMusicVideo(yt)) {
          seen.add(yt.id);
          list.push(yt);
        }
        if (list.length >= 15) break;
      }
    }

    return list;
  }, [history, ytmHistory]);

  // Albums aggregation (matching temp_koda AlbumsGrid in LibraryScreen.kt)
  const libraryAlbums = useMemo(() => {
    const albumMap = new Map<
      string,
      {
        name: string;
        artistLabel: string;
        artists: Set<string>;
        tracks: TrackMetadata[];
        thumbnailUrl?: string;
        totalPlays: number;
      }
    >();

    const isUnknownAlbum = (album?: string, title?: string) => {
      if (!album) return true;
      const clean = album.trim().toLowerCase();
      if (
        !clean ||
        clean === 'unknown album' ||
        clean === 'unknown' ||
        clean === 'single' ||
        clean === 'youtube music'
      ) {
        return true;
      }
      return false;
    };

    const sourceTracks = [...likedTracks, ...allLibrarySongs, ...ytmHistory];
    const seenTrackInAlbum = new Set<string>();

    for (const t of sourceTracks) {
      const albumName =
        !isUnknownAlbum(t.album, t.title) && t.album ? t.album.trim() : `${t.title} — Single`;
      // Only include real albums or songs with explicit album metadata, or fallback if user has few albums
      if (isUnknownAlbum(t.album) && sourceTracks.some((st) => !isUnknownAlbum(st.album))) {
        continue;
      }
      const key = albumName.toLowerCase();
      const dedupKey = `${key}::${t.id}`;
      if (seenTrackInAlbum.has(dedupKey)) continue;
      seenTrackInAlbum.add(dedupKey);

      const plays = playCountsMap.get(t.id)?.count || 0;
      const existing = albumMap.get(key);
      if (existing) {
        existing.tracks.push(t);
        if (t.artist) existing.artists.add(t.artist);
        existing.totalPlays += plays;
        if (!existing.thumbnailUrl && (t.highResThumbnailUrl || t.thumbnailUrl)) {
          existing.thumbnailUrl = t.highResThumbnailUrl || t.thumbnailUrl;
        }
      } else {
        albumMap.set(key, {
          name: albumName,
          artistLabel: t.artist || 'Unknown Artist',
          artists: new Set(t.artist ? [t.artist] : []),
          tracks: [t],
          thumbnailUrl: t.highResThumbnailUrl || t.thumbnailUrl,
          totalPlays: plays
        });
      }
    }

    let albums = Array.from(albumMap.values()).map((a) => ({
      ...a,
      artistLabel: a.artists.size > 2 ? 'Various Artists' : Array.from(a.artists).join(', ')
    }));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      albums = albums.filter(
        (a) => a.name.toLowerCase().includes(q) || a.artistLabel.toLowerCase().includes(q)
      );
    }

    return albums.sort((a, b) => {
      if (albumSortBy === 'name') return a.name.localeCompare(b.name);
      if (albumSortBy === 'count') return b.tracks.length - a.tracks.length;
      return b.totalPlays - a.totalPlays || b.tracks.length - a.tracks.length;
    });
  }, [likedTracks, allLibrarySongs, ytmHistory, playCountsMap, searchQuery, albumSortBy]);

  // Deep Artist Aggregation: Combines followedArtists, likedTracks, history, and YTM history
  const libraryArtists = useMemo(() => {
    const artistMap = new Map<
      string,
      { name: string; trackCount: number; plays: number; imageUrl?: string; isFollowed?: boolean }
    >();

    for (const f of followedArtists) {
      if (!f.name) continue;
      artistMap.set(f.name.toLowerCase(), {
        name: f.name,
        trackCount: 0,
        plays: 0,
        imageUrl: f.thumbnailUrl,
        isFollowed: true
      });
    }

    for (const t of likedTracks) {
      if (!t.artist) continue;
      const key = t.artist.toLowerCase();
      const existing = artistMap.get(key);
      if (existing) {
        existing.trackCount += 1;
        if (!existing.imageUrl && t.thumbnailUrl) existing.imageUrl = t.thumbnailUrl;
      } else {
        artistMap.set(key, {
          name: t.artist,
          trackCount: 1,
          plays: 0,
          imageUrl: t.thumbnailUrl
        });
      }
    }

    for (const h of history) {
      if (!h.artist || isLikelyNonMusicVideo(h)) continue;
      const key = h.artist.toLowerCase();
      const existing = artistMap.get(key);
      if (existing) {
        existing.plays += h.playCount || 1;
        if (!existing.imageUrl && h.thumbnailUrl) existing.imageUrl = h.thumbnailUrl;
      } else {
        artistMap.set(key, {
          name: h.artist,
          trackCount: 0,
          plays: h.playCount || 1,
          imageUrl: h.thumbnailUrl
        });
      }
    }

    for (const y of ytmHistory) {
      if (!y.artist) continue;
      const key = y.artist.toLowerCase();
      const existing = artistMap.get(key);
      if (existing) {
        if (!existing.imageUrl && y.thumbnailUrl) existing.imageUrl = y.thumbnailUrl;
      } else {
        artistMap.set(key, {
          name: y.artist,
          trackCount: 0,
          plays: 1,
          imageUrl: y.thumbnailUrl
        });
      }
    }

    let list = Array.from(artistMap.values());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }

    return list.sort((a, b) => {
      if (artistSortBy === 'name') return a.name.localeCompare(b.name);
      if (artistSortBy === 'count') return b.trackCount - a.trackCount || b.plays - a.plays;
      return b.plays + b.trackCount * 2 - (a.plays + a.trackCount * 2);
    });
  }, [followedArtists, likedTracks, history, ytmHistory, searchQuery, artistSortBy]);

  // Filtered Liked Tracks
  const filteredLikedTracks = useMemo(() => {
    if (!searchQuery.trim()) return likedTracks;
    const q = searchQuery.toLowerCase().trim();
    return likedTracks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
    );
  }, [likedTracks, searchQuery]);

  // Total Liked Duration formatted
  const totalLikedDurationFormatted = useMemo(() => {
    const totalSec = likedTracks.reduce((sum, t) => sum + (t.duration || 210), 0);
    const mins = Math.floor(totalSec / 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) return `${hrs} hr ${remMins} min`;
    return `${mins} min`;
  }, [likedTracks]);

  const handleOpenLikedSongs = () => {
    setActiveTab('liked');
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

  const handleShuffleAllLibrary = () => {
    if (allLibrarySongs.length > 0) {
      const shuffled = [...allLibrarySongs].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    }
  };

  const NAV_TABS: { id: LibraryTab; label: string; count?: number; icon: string }[] = [
    { id: 'all', label: 'All', icon: 'library_music' },
    { id: 'playlists', label: 'Playlists', count: deduplicatedPlaylists.length, icon: 'queue_music' },
    { id: 'albums', label: 'Albums', count: libraryAlbums.length, icon: 'album' },
    { id: 'artists', label: 'Artists', count: libraryArtists.length, icon: 'person' },
    { id: 'liked', label: 'Liked', count: likedTracks.length, icon: 'favorite' },
    { id: 'history', label: 'History', count: listeningStats.totalPlays || undefined, icon: 'history' },
    { id: 'insights', label: 'Insights', icon: 'insights' }
  ];

  const selectedAlbum = useMemo(
    () => libraryAlbums.find((a) => a.name === selectedAlbumName) || null,
    [libraryAlbums, selectedAlbumName]
  );

  const selectedLocalPlaylist = useMemo(
    () => localPlaylists.find((p) => p.id === selectedLocalPlaylistId) || null,
    [localPlaylists, selectedLocalPlaylistId]
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '22px',
        paddingBottom: '160px',
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%'
      }}
    >
      {/* =========================================================================
          TOP HEADER BAR (Matching temp_koda LibraryMainScreen Header)
          ========================================================================= */}
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
              fontSize: 'clamp(32px, 4vw, 42px)',
              fontWeight: 850,
              margin: 0,
              letterSpacing: '-0.03em',
              color: 'var(--md-sys-color-on-surface)'
            }}
          >
            Library
          </h1>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 550,
              color: 'var(--md-sys-color-on-surface-variant)',
              marginTop: '4px',
              display: 'block'
            }}
          >
            {deduplicatedPlaylists.length} playlists • {likedTracks.length} liked •{' '}
            {listeningStats.totalPlays} plays ({formatListeningTime(listeningStats.totalListenTimeMs)})
          </span>
        </div>

        {/* Header Action Buttons: New Playlist, Insights, Sync & View Mode */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* New Playlist Tonal Button (temp_koda PlaylistAdd button) */}
          <button
            onClick={() => {
              setEditingPlaylist(null);
              setNewPlaylistTitle('');
              setNewPlaylistDesc('');
              setShowCreatePlaylistModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              height: '44px',
              padding: '0 18px',
              borderRadius: '9999px',
              backgroundColor: 'var(--md-sys-color-secondary-container)',
              color: 'var(--md-sys-color-on-secondary-container)',
              border: 'none',
              fontSize: '13px',
              fontWeight: 750,
              cursor: 'pointer',
              transition: 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            title="Create new local playlist"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              playlist_add
            </span>
            <span>New playlist</span>
          </button>

          {/* Listening Insights Button (temp_koda top-right Insights button in 05-library-music.png) */}
          <button
            onClick={() => setActiveTab(activeTab === 'insights' ? 'all' : 'insights')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              height: '44px',
              padding: '0 18px',
              borderRadius: '9999px',
              backgroundColor:
                activeTab === 'insights'
                  ? 'var(--md-sys-color-primary)'
                  : 'var(--md-sys-color-primary-container)',
              color:
                activeTab === 'insights'
                  ? 'var(--md-sys-color-on-primary)'
                  : 'var(--md-sys-color-on-primary-container)',
              border: 'none',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            title="Listening statistics & summary"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              insights
            </span>
            <span>Listening Summary</span>
          </button>

          {/* Sync Button */}
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
              height: '44px',
              padding: '0 16px',
              borderRadius: '9999px',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              color: 'var(--md-sys-color-on-surface)',
              fontSize: '13px',
              fontWeight: 650,
              cursor: 'pointer',
              transition: 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)'
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
                padding: '4px',
                border: '1px solid var(--md-sys-color-outline-variant)'
              }}
            >
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor:
                    viewMode === 'grid' ? 'var(--md-sys-color-secondary-container)' : 'transparent',
                  color:
                    viewMode === 'grid'
                      ? 'var(--md-sys-color-on-secondary-container)'
                      : 'var(--md-sys-color-outline)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
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
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor:
                    viewMode === 'list' ? 'var(--md-sys-color-secondary-container)' : 'transparent',
                  color:
                    viewMode === 'list'
                      ? 'var(--md-sys-color-on-secondary-container)'
                      : 'var(--md-sys-color-outline)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
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

      {/* =========================================================================
          M3 EXPRESSIVE CONNECTED BUTTON GROUP + SEARCH BAR
          ========================================================================= */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        {/* Connected Toggle Buttons (05-library-music.png) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            overflowX: 'auto',
            paddingBottom: '2px',
            flex: '1 1 auto'
          }}
        >
          {NAV_TABS.map((tab, idx) => {
            const isActive = activeTab === tab.id;
            const isFirst = idx === 0;
            const isLast = idx === NAV_TABS.length - 1;
            const borderRadius = isActive
              ? '999px'
              : isFirst
              ? '24px 8px 8px 24px'
              : isLast
              ? '8px 24px 24px 8px'
              : '8px';

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '7px',
                  height: '46px',
                  padding: '0 18px',
                  borderRadius,
                  border: 'none',
                  backgroundColor: isActive
                    ? 'var(--md-sys-color-primary)'
                    : 'var(--md-sys-color-surface-container-high)',
                  color: isActive
                    ? 'var(--md-sys-color-on-primary)'
                    : 'var(--md-sys-color-on-surface-variant)',
                  fontSize: '13px',
                  fontWeight: isActive ? 800 : 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 220ms cubic-bezier(0.22, 1, 0.36, 1)'
                }}
              >
                <span
                  className={`material-symbols-rounded ${isActive ? 'filled' : ''}`}
                  style={{ fontSize: '18px' }}
                >
                  {tab.icon}
                </span>
                <span>
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 ? ` · ${tab.count}` : ''}
                </span>
              </button>
            );
          })}
        </div>

        {/* Real-time Search Input */}
        {activeTab !== 'insights' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              borderRadius: '9999px',
              padding: '8px 16px',
              border: '1px solid var(--md-sys-color-outline-variant)',
              minWidth: '230px'
            }}
          >
            <span
              className="material-symbols-rounded"
              style={{ fontSize: '18px', color: 'var(--md-sys-color-outline)' }}
            >
              search
            </span>
            <input
              type="text"
              placeholder={`Search ${activeTab === 'all' ? 'library' : activeTab}...`}
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
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--md-sys-color-outline)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                  close
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          TAB CONTENT: ALL (Matching temp_koda AllSongsList & 05-library-music.png)
          ========================================================================= */}
      {activeTab === 'all' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Top Bento Grid: Liked Songs Hero Card + Listening Summary & History Shortcuts */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '16px'
            }}
          >
            {/* 1. Expressive Liked Songs Hero Card */}
            <div
              onClick={handleOpenLikedSongs}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '24px 26px',
                borderRadius: '28px',
                background:
                  'linear-gradient(135deg, var(--md-sys-color-primary-container) 0%, var(--md-sys-color-surface-container-high) 100%)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                boxShadow: '0 8px 24px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.12))',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                flexWrap: 'wrap',
                gap: '16px'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', minWidth: 0 }}>
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                    clipPath: SHAPES.softBurst,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <span className="material-symbols-rounded filled" style={{ fontSize: '30px' }}>
                    favorite
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'var(--md-sys-color-primary)'
                    }}
                  >
                    Favorite Collection
                  </span>
                  <h2
                    style={{
                      fontSize: '22px',
                      fontWeight: 850,
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

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={handleShuffleLiked}
                  disabled={likedTracks.length === 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 16px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--md-sys-color-surface-container)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    color: 'var(--md-sys-color-on-surface)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: likedTracks.length > 0 ? 'pointer' : 'default'
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                    shuffle
                  </span>
                  <span>Shuffle</span>
                </button>

                <button
                  onClick={handlePlayAllLiked}
                  disabled={likedTracks.length === 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 18px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: likedTracks.length > 0 ? 'pointer' : 'default'
                  }}
                >
                  <span className="material-symbols-rounded filled" style={{ fontSize: '18px' }}>
                    play_arrow
                  </span>
                  <span>Play</span>
                </button>
              </div>
            </div>

            {/* 2. temp_koda LibraryShortcutsCard + Listening Summary Banner (05-library-music.png) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* Top Segmented Row: Listening Summary & Insights */}
              <div
                onClick={() => setActiveTab('insights')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  padding: '14px 20px',
                  borderRadius: '24px 24px 8px 8px',
                  backgroundColor: 'var(--md-sys-color-secondary-container)',
                  color: 'var(--md-sys-color-on-secondary-container)',
                  cursor: 'pointer',
                  transition: 'transform 180ms ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateX(2px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateX(0)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--md-sys-color-secondary)',
                      color: 'var(--md-sys-color-on-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
                      insights
                    </span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 800 }}>
                      Listening summary
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        opacity: 0.84,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {listeningStats.totalPlays > 0
                        ? `${formatListeningTime(listeningStats.totalListenTimeMs)} listened • ${
                            listeningStats.uniqueSongs
                          } songs${
                            listeningStats.currentStreakDays > 0
                              ? ` • 🔥 ${listeningStats.currentStreakDays}d streak`
                              : ''
                          }`
                        : 'Your top songs, artists, and weekly chart'}
                    </div>
                  </div>
                </div>
                <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
                  chevron_right
                </span>
              </div>

              {/* Bottom Segmented Row: Listening History (05-library-music.png purple/tertiary card) */}
              <div
                onClick={() => setActiveTab('history')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  padding: '14px 20px',
                  borderRadius: '8px 8px 24px 24px',
                  backgroundColor: 'var(--md-sys-color-tertiary-container)',
                  color: 'var(--md-sys-color-on-tertiary-container)',
                  cursor: 'pointer',
                  transition: 'transform 180ms ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateX(2px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateX(0)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--md-sys-color-tertiary)',
                      color: 'var(--md-sys-color-on-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
                      history
                    </span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 800 }}>
                      Listening history
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.84 }}>
                      {listeningStats.totalPlays > 0
                        ? `${listeningStats.totalPlays} ${
                            listeningStats.totalPlays === 1 ? 'play' : 'plays'
                          } so far`
                        : 'Everything you play, in order'}
                    </div>
                  </div>
                </div>
                <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
                  chevron_right
                </span>
              </div>
            </div>
          </div>

          {/* Recently Played Rail (temp_koda RecentSongCard rail in 05-library-music.png) */}
          {recentlyPlayedRail.length > 0 && !searchQuery.trim() && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <h3
                  style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    margin: 0,
                    color: 'var(--md-sys-color-on-surface)'
                  }}
                >
                  Recently played
                </h3>
                <button
                  onClick={() => setActiveTab('history')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--md-sys-color-primary)',
                    fontSize: '13px',
                    fontWeight: 750,
                    cursor: 'pointer'
                  }}
                >
                  <span>See all</span>
                  <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                    arrow_forward
                  </span>
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '14px',
                  overflowX: 'auto',
                  paddingBottom: '6px'
                }}
              >
                {recentlyPlayedRail.map((song) => (
                  <div
                    key={`recent_${song.id}`}
                    onClick={() => playTrack(song, recentlyPlayedRail)}
                    style={{
                      width: '132px',
                      flexShrink: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <div
                      style={{
                        width: '132px',
                        height: '132px',
                        borderRadius: '20px',
                        overflow: 'hidden',
                        backgroundColor: 'var(--md-sys-color-surface-container-high)',
                        position: 'relative'
                      }}
                    >
                      <img
                        src={sizedArtwork(song.thumbnailUrl, 260)}
                        alt={song.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleArtworkError(e, song.thumbnailUrl)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                    </div>
                    <div style={{ padding: '0 4px' }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 750,
                          color: 'var(--md-sys-color-on-surface)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {song.title}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'var(--md-sys-color-on-surface-variant)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '2px'
                        }}
                      >
                        {song.artist}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Tracks Section (temp_koda AllSongsList "All tracks • N" with Shuffle & Sort) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  margin: 0,
                  color: 'var(--md-sys-color-on-surface)'
                }}
              >
                {allLibrarySongs.length === 0
                  ? 'All tracks'
                  : `All tracks • ${allLibrarySongs.length}`}
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {allLibrarySongs.length > 0 && (
                  <button
                    onClick={handleShuffleAllLibrary}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      height: '38px',
                      padding: '0 14px',
                      borderRadius: '999px',
                      border: 'none',
                      backgroundColor: 'var(--md-sys-color-primary)',
                      color: 'var(--md-sys-color-on-primary)',
                      fontSize: '12px',
                      fontWeight: 750,
                      cursor: 'pointer'
                    }}
                    title="Shuffle all library tracks"
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                      shuffle
                    </span>
                    <span>Shuffle all</span>
                  </button>
                )}

                <select
                  value={trackSortBy}
                  onChange={(e) => {
                    const next = e.target.value as TrackSortOption;
                    setTrackSortBy(next);
                    localStorage.setItem('koda_library_track_sort', next);
                  }}
                  style={{
                    height: '38px',
                    backgroundColor: 'var(--md-sys-color-surface-container-high)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    borderRadius: '9999px',
                    padding: '0 14px',
                    color: 'var(--md-sys-color-on-surface)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="most_played">Sort: Most played</option>
                  <option value="recently_added">Sort: Recently added</option>
                  <option value="title">Sort: Title (A–Z)</option>
                  <option value="artist">Sort: Artist</option>
                  <option value="album">Sort: Album</option>
                </select>
              </div>
            </div>

            {allLibrarySongs.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '48px 24px',
                  borderRadius: '24px',
                  backgroundColor: 'var(--md-sys-color-surface-container-low)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  gap: '10px',
                  color: 'var(--md-sys-color-on-surface-variant)'
                }}
              >
                <span
                  className="material-symbols-rounded"
                  style={{ fontSize: '48px', color: 'var(--md-sys-color-outline)' }}
                >
                  music_note
                </span>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>Your library is empty</div>
                <span style={{ fontSize: '13px' }}>
                  Songs you like or play will show up here.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {allLibrarySongs.slice(0, 80).map((track, idx) => {
                  const isTrackPlaying = currentTrack?.id === track.id && isPlaying;
                  const plays = playCountsMap.get(track.id)?.count || 0;
                  const sortBadge =
                    trackSortBy === 'most_played' && plays > 0
                      ? `${plays} ${plays === 1 ? 'play' : 'plays'}`
                      : trackSortBy === 'recently_added' && track.addedAt
                      ? formatRelativeDate(track.addedAt)
                      : undefined;

                  return (
                    <div
                      key={track.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <DSTrackRow
                          rank={idx + 1}
                          title={track.title}
                          artist={
                            sortBadge ? `${track.artist} • ${sortBadge}` : track.artist
                          }
                          album={track.album}
                          duration={track.duration}
                          imageUrl={track.thumbnailUrl}
                          isPlaying={isTrackPlaying}
                          isLiked={isLiked(track.id)}
                          onPlay={() => playTrack(track, allLibrarySongs)}
                          onToggleLike={() => toggleLikeTrack(track)}
                          onArtistClick={() => onOpenArtist?.({ name: track.artist })}
                        />
                      </div>
                      <button
                        onClick={() => setAddToPlaylistTrack(track)}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          border: 'none',
                          backgroundColor: 'var(--md-sys-color-surface-container)',
                          color: 'var(--md-sys-color-on-surface-variant)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                        title="Add to local playlist"
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                          playlist_add
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT: PLAYLISTS (With Local Playlist Studio & Hidden Playlists)
          ========================================================================= */}
      {activeTab === 'playlists' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {selectedLocalPlaylist ? (
            /* Inline Local Playlist Detail View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                  padding: '24px 28px',
                  borderRadius: '28px',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                  <button
                    onClick={() => setSelectedLocalPlaylistId(null)}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      border: 'none',
                      backgroundColor: 'var(--md-sys-color-surface-container-high)',
                      color: 'var(--md-sys-color-on-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <span className="material-symbols-rounded">arrow_back</span>
                  </button>
                  <div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'var(--md-sys-color-primary)'
                      }}
                    >
                      Local Playlist
                    </span>
                    <h2 style={{ fontSize: '24px', fontWeight: 850, margin: '2px 0' }}>
                      {selectedLocalPlaylist.title}
                    </h2>
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'var(--md-sys-color-on-surface-variant)'
                      }}
                    >
                      {selectedLocalPlaylist.tracks.length} tracks
                      {selectedLocalPlaylist.description
                        ? ` • ${selectedLocalPlaylist.description}`
                        : ''}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      setEditingPlaylist(selectedLocalPlaylist);
                      setNewPlaylistTitle(selectedLocalPlaylist.title);
                      setNewPlaylistDesc(selectedLocalPlaylist.description || '');
                      setShowCreatePlaylistModal(true);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '999px',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: 'var(--md-sys-color-surface-container-high)',
                      color: 'var(--md-sys-color-on-surface)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Edit details
                  </button>
                  <button
                    onClick={() => {
                      deleteLocalPlaylist(selectedLocalPlaylist.id);
                      setSelectedLocalPlaylistId(null);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '999px',
                      border: 'none',
                      backgroundColor: 'var(--md-sys-color-error-container)',
                      color: 'var(--md-sys-color-on-error-container)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                  {selectedLocalPlaylist.tracks.length > 0 && (
                    <button
                      onClick={() =>
                        playTrack(selectedLocalPlaylist.tracks[0], selectedLocalPlaylist.tracks)
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '9px 20px',
                        borderRadius: '999px',
                        border: 'none',
                        backgroundColor: 'var(--md-sys-color-primary)',
                        color: 'var(--md-sys-color-on-primary)',
                        fontSize: '13px',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      <span className="material-symbols-rounded filled" style={{ fontSize: '18px' }}>
                        play_arrow
                      </span>
                      <span>Play</span>
                    </button>
                  )}
                </div>
              </div>

              {selectedLocalPlaylist.tracks.length === 0 ? (
                <div
                  style={{
                    padding: '48px 24px',
                    borderRadius: '24px',
                    backgroundColor: 'var(--md-sys-color-surface-container-low)',
                    textAlign: 'center',
                    color: 'var(--md-sys-color-on-surface-variant)'
                  }}
                >
                  No tracks in this playlist yet. Click the + playlist button on any track in the All tab to add songs!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedLocalPlaylist.tracks.map((track, idx) => (
                    <div
                      key={track.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <DSTrackRow
                          rank={idx + 1}
                          title={track.title}
                          artist={track.artist}
                          album={track.album}
                          duration={track.duration}
                          imageUrl={track.thumbnailUrl}
                          isPlaying={currentTrack?.id === track.id && isPlaying}
                          isLiked={isLiked(track.id)}
                          onPlay={() => playTrack(track, selectedLocalPlaylist.tracks)}
                          onToggleLike={() => toggleLikeTrack(track)}
                        />
                      </div>
                      <button
                        onClick={() =>
                          removeTrackFromLocalPlaylist(selectedLocalPlaylist.id, track.id)
                        }
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          border: 'none',
                          backgroundColor: 'var(--md-sys-color-surface-container)',
                          color: 'var(--md-sys-color-error)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        title="Remove from playlist"
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                          remove_circle_outline
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Playlists Header + Sort + Hidden Count */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    color: 'var(--md-sys-color-on-surface)'
                  }}
                >
                  Your playlists • {filteredPlaylists.length}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {hiddenPlaylists.length > 0 && (
                    <button
                      onClick={() => setShowHiddenPlaylistsSheet(!showHiddenPlaylistsSheet)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 14px',
                        borderRadius: '999px',
                        border: '1px solid var(--md-sys-color-outline-variant)',
                        backgroundColor: 'var(--md-sys-color-surface-container)',
                        color: 'var(--md-sys-color-on-surface-variant)',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                        visibility_off
                      </span>
                      <span>{hiddenPlaylists.length} hidden</span>
                    </button>
                  )}

                  <select
                    value={playlistSortBy}
                    onChange={(e) => setPlaylistSortBy(e.target.value as PlaylistSortOption)}
                    style={{
                      backgroundColor: 'var(--md-sys-color-surface-container-high)',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      borderRadius: '9999px',
                      padding: '7px 14px',
                      color: 'var(--md-sys-color-on-surface)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="default">Default Order</option>
                    <option value="az">Alphabetical (A–Z)</option>
                    <option value="tracks">Most Tracks</option>
                  </select>
                </div>
              </div>

              {/* Hidden Playlists Sheet */}
              {showHiddenPlaylistsSheet && hiddenPlaylists.length > 0 && (
                <div
                  style={{
                    padding: '18px 22px',
                    borderRadius: '24px',
                    backgroundColor: 'var(--md-sys-color-surface-container-high)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span style={{ fontSize: '15px', fontWeight: 800 }}>Hidden playlists</span>
                    <button
                      onClick={() => setShowHiddenPlaylistsSheet(false)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--md-sys-color-on-surface-variant)',
                        cursor: 'pointer'
                      }}
                    >
                      <span className="material-symbols-rounded">close</span>
                    </button>
                  </div>
                  {hiddenPlaylists.map((hp) => (
                    <div
                      key={hp.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '14px',
                        backgroundColor: 'var(--md-sys-color-surface-container)'
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>{hp.title}</span>
                      <button
                        onClick={() => unhidePlaylist(hp.id)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '999px',
                          border: 'none',
                          backgroundColor: 'var(--md-sys-color-primary)',
                          color: 'var(--md-sys-color-on-primary)',
                          fontSize: '12px',
                          fontWeight: 750,
                          cursor: 'pointer'
                        }}
                      >
                        Unhide
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {loadingPlaylists && filteredPlaylists.length === 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '200px'
                  }}
                >
                  <M3LoadingIndicator
                    contained
                    size="lg"
                    message="Syncing YouTube Music playlists..."
                  />
                </div>
              )}

              {/* Grid View */}
              {viewMode === 'grid' && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                    gap: '18px'
                  }}
                >
                  {filteredPlaylists.map((pl, plIdx) => (
                    <div key={pl.id} style={{ position: 'relative' }}>
                      <MediaCard
                        id={pl.id}
                        index={plIdx}
                        title={pl.title}
                        subtitle={pl.subtitle}
                        imageUrl={pl.imageUrl}
                        isPlaylist={true}
                        onClick={() => {
                          if (pl.isLocal) {
                            setSelectedLocalPlaylistId(pl.id);
                          } else if (onOpenPlaylist) {
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
                          if (pl.isLocal) {
                            const found = localPlaylists.find((l) => l.id === pl.id);
                            if (found && found.tracks.length > 0) {
                              playTrack(found.tracks[0], found.tracks);
                            }
                            return;
                          }
                          const tracks = await innertubeService.resolvePlaylistTracks(pl.id);
                          if (tracks.length > 0) {
                            playTrack(tracks[0], tracks);
                          }
                        }}
                      />
                      {/* Hide / Remove Quick Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (pl.isSaved) {
                            toggleSavePlaylist({ id: pl.id, title: pl.title });
                          } else {
                            hidePlaylist({
                              id: pl.id,
                              title: pl.title,
                              author: pl.author,
                              thumbnailUrl: pl.imageUrl
                            });
                          }
                        }}
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          width: '30px',
                          height: '30px',
                          borderRadius: '50%',
                          border: 'none',
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          zIndex: 5
                        }}
                        title={pl.isSaved ? 'Remove saved playlist' : 'Hide playlist from library'}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                          {pl.isSaved ? 'bookmark_remove' : 'visibility_off'}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* List View */}
              {viewMode === 'list' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredPlaylists.map((pl) => (
                    <div
                      key={pl.id}
                      onClick={() => {
                        if (pl.isLocal) {
                          setSelectedLocalPlaylistId(pl.id);
                        } else if (onOpenPlaylist) {
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
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                        {pl.imageUrl ? (
                          <img
                            src={sizedArtwork(pl.imageUrl, 100)}
                            alt={pl.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => handleArtworkError(e, pl.imageUrl)}
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '10px',
                              objectFit: 'cover'
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '10px',
                              backgroundColor: 'var(--md-sys-color-surface-container-high)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <span className="material-symbols-rounded">queue_music</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: '14px',
                              fontWeight: 700,
                              color: 'var(--md-sys-color-on-surface)'
                            }}
                          >
                            {pl.title}
                          </span>
                          <span
                            style={{
                              fontSize: '12px',
                              color: 'var(--md-sys-color-on-surface-variant)',
                              marginTop: '2px'
                            }}
                          >
                            {pl.author || 'You'} • {pl.subtitle}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT: ALBUMS (Matching temp_koda AlbumsGrid in LibraryScreen.kt)
          ========================================================================= */}
      {activeTab === 'albums' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {selectedAlbum ? (
            /* Inline Album Detail View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '20px',
                  padding: '24px 28px',
                  borderRadius: '28px',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                  <button
                    onClick={() => setSelectedAlbumName(null)}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      border: 'none',
                      backgroundColor: 'var(--md-sys-color-surface-container-high)',
                      color: 'var(--md-sys-color-on-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <span className="material-symbols-rounded">arrow_back</span>
                  </button>
                  {selectedAlbum.thumbnailUrl && (
                    <img
                      src={sizedArtwork(selectedAlbum.thumbnailUrl, 160)}
                      alt={selectedAlbum.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => handleArtworkError(e, selectedAlbum.thumbnailUrl)}
                      style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '18px',
                        objectFit: 'cover'
                      }}
                    />
                  )}
                  <div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'var(--md-sys-color-primary)'
                      }}
                    >
                      Album
                    </span>
                    <h2 style={{ fontSize: '24px', fontWeight: 850, margin: '2px 0' }}>
                      {selectedAlbum.name}
                    </h2>
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'var(--md-sys-color-on-surface-variant)'
                      }}
                    >
                      {selectedAlbum.artistLabel} • {selectedAlbum.tracks.length}{' '}
                      {selectedAlbum.tracks.length === 1 ? 'song' : 'songs'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => {
                      const shuffled = [...selectedAlbum.tracks].sort(() => Math.random() - 0.5);
                      if (shuffled.length > 0) playTrack(shuffled[0], shuffled);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '9px 18px',
                      borderRadius: '999px',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: 'var(--md-sys-color-surface-container-high)',
                      color: 'var(--md-sys-color-on-surface)',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                      shuffle
                    </span>
                    <span>Shuffle</span>
                  </button>
                  <button
                    onClick={() => {
                      if (selectedAlbum.tracks.length > 0) {
                        playTrack(selectedAlbum.tracks[0], selectedAlbum.tracks);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '9px 20px',
                      borderRadius: '999px',
                      border: 'none',
                      backgroundColor: 'var(--md-sys-color-primary)',
                      color: 'var(--md-sys-color-on-primary)',
                      fontSize: '13px',
                      fontWeight: 800,
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedAlbum.tracks.map((track, idx) => (
                  <DSTrackRow
                    key={track.id}
                    rank={idx + 1}
                    title={track.title}
                    artist={track.artist}
                    album={track.album}
                    duration={track.duration}
                    imageUrl={track.thumbnailUrl}
                    isPlaying={currentTrack?.id === track.id && isPlaying}
                    isLiked={isLiked(track.id)}
                    onPlay={() => playTrack(track, selectedAlbum.tracks)}
                    onToggleLike={() => toggleLikeTrack(track)}
                    onArtistClick={() => onOpenArtist?.({ name: track.artist })}
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    color: 'var(--md-sys-color-on-surface)'
                  }}
                >
                  Albums • {libraryAlbums.length}
                </span>

                <select
                  value={albumSortBy}
                  onChange={(e) => setAlbumSortBy(e.target.value as GroupSortOption)}
                  style={{
                    backgroundColor: 'var(--md-sys-color-surface-container-high)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    borderRadius: '9999px',
                    padding: '7px 14px',
                    color: 'var(--md-sys-color-on-surface)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="most_played">Sort: Most played</option>
                  <option value="name">Sort: Name (A–Z)</option>
                  <option value="count">Sort: Song count</option>
                </select>
              </div>

              {libraryAlbums.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '220px',
                    gap: '12px',
                    color: 'var(--md-sys-color-on-surface-variant)'
                  }}
                >
                  <span
                    className="material-symbols-rounded"
                    style={{ fontSize: '48px', color: 'var(--md-sys-color-outline)' }}
                  >
                    album
                  </span>
                  <p style={{ fontSize: '15px', fontWeight: 650, margin: 0 }}>No albums yet</p>
                  <span style={{ fontSize: '13px' }}>
                    Albums from songs you like or listen to will appear here.
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                    gap: '18px'
                  }}
                >
                  {libraryAlbums.map((album, idx) => (
                    <MediaCard
                      key={album.name}
                      id={`album_${idx}`}
                      index={idx}
                      title={album.name}
                      subtitle={`${album.artistLabel} • ${album.tracks.length} ${
                        album.tracks.length === 1 ? 'song' : 'songs'
                      }`}
                      imageUrl={album.thumbnailUrl || ''}
                      isPlaylist={true}
                      onClick={() => setSelectedAlbumName(album.name)}
                      onPlay={() => {
                        if (album.tracks.length > 0) {
                          playTrack(album.tracks[0], album.tracks);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT: LIKED SONGS
          ========================================================================= */}
      {activeTab === 'liked' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
              <h2
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  margin: 0,
                  color: 'var(--md-sys-color-on-surface)'
                }}
              >
                Liked Songs ({filteredLikedTracks.length})
              </h2>
              <span
                style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)' }}
              >
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
              <span
                className="material-symbols-rounded"
                style={{ fontSize: '48px', color: 'var(--md-sys-color-outline)' }}
              >
                favorite_border
              </span>
              <p style={{ fontSize: '15px', fontWeight: 650 }}>No liked songs found</p>
              <span style={{ fontSize: '13px' }}>
                Heart tracks while listening to build your collection.
              </span>
            </div>
          ) : (
            filteredLikedTracks.map((track, idx) => {
              const isTrackPlaying = currentTrack?.id === track.id && isPlaying;
              return (
                <DSTrackRow
                  key={track.id}
                  style={{
                    animation: `m3CardCascade 320ms var(--m3-ease-emphasized-decelerate) ${Math.min(
                      idx * 25,
                      300
                    )}ms both`
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
          TAB CONTENT: ARTISTS (Matching temp_koda ArtistsGrid)
          ========================================================================= */}
      {activeTab === 'artists' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: 'var(--md-sys-color-on-surface)'
              }}
            >
              Artists • {libraryArtists.length}
            </span>

            <select
              value={artistSortBy}
              onChange={(e) => setArtistSortBy(e.target.value as GroupSortOption)}
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                borderRadius: '9999px',
                padding: '7px 14px',
                color: 'var(--md-sys-color-on-surface)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="most_played">Sort: Most played</option>
              <option value="name">Sort: Name (A–Z)</option>
              <option value="count">Sort: Saved songs</option>
            </select>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
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
                  e.currentTarget.style.boxShadow =
                    '0 10px 28px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.15))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
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
                      referrerPolicy="no-referrer"
                      onError={(e) => handleArtworkError(e, artist.imageUrl)}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                  ) : (
                    <span
                      className="material-symbols-rounded"
                      style={{ fontSize: '40px', color: 'var(--md-sys-color-primary)' }}
                    >
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
                    fontWeight: 600,
                    color: artist.isFollowed
                      ? 'var(--md-sys-color-primary)'
                      : 'var(--md-sys-color-on-surface-variant)',
                    marginTop: '4px'
                  }}
                >
                  {artist.isFollowed
                    ? `Following${artist.plays > 0 ? ` • ${artist.plays} plays` : ''}`
                    : artist.trackCount > 0
                    ? `${artist.trackCount} saved • ${artist.plays} plays`
                    : `${artist.plays} ${artist.plays === 1 ? 'play' : 'plays'}`}
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
              <span
                className="material-symbols-rounded"
                style={{ fontSize: '48px', color: 'var(--md-sys-color-outline)' }}
              >
                person
              </span>
              <p style={{ fontSize: '15px', fontWeight: 650 }}>No artists found</p>
              <span style={{ fontSize: '13px' }}>
                Artists will populate as you save and play music.
              </span>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT: CHRONOLOGICAL LISTENING HISTORY (temp_koda ListeningHistoryScreen)
          ========================================================================= */}
      {activeTab === 'history' && (
        <ListeningHistoryView
          playLog={playLog}
          history={history}
          ytmHistory={ytmHistory}
          searchQuery={searchQuery}
          streakDays={listeningStats.currentStreakDays}
          saveMusicHistory={saveMusicHistory}
          currentTrackId={currentTrack?.id}
          isPlaying={isPlaying}
          isLiked={isLiked}
          onToggleSaveHistory={setSaveMusicHistory}
          onPlayTrack={(track, queue) => playTrack(track, queue)}
          onToggleLike={(track) => toggleLikeTrack(track)}
          onOpenArtist={onOpenArtist}
          onRemoveEntry={removePlayHistoryEntry}
          onClearHistory={clearMusicHistory}
          onRestoreHistory={restoreMusicHistory}
          onOpenStats={() => setActiveTab('insights')}
        />
      )}

      {/* =========================================================================
          TAB CONTENT: LISTENING SUMMARY & STATS (temp_koda StatsScreen)
          ========================================================================= */}
      {activeTab === 'insights' && (
        <ListeningStatsView
          playLog={playLog}
          history={history}
          likedTracks={likedTracks}
          onPlaySong={(songStat) => {
            const thumb =
              songStat.thumbnailUrl ||
              `https://i.ytimg.com/vi/${songStat.songId}/hqdefault.jpg`;
            const track: TrackMetadata = {
              id: songStat.songId,
              title: songStat.title,
              artist: songStat.artist,
              album: songStat.album,
              duration: songStat.durationSec || 210,
              thumbnailUrl: thumb,
              highResThumbnailUrl: sizedArtwork(thumb, 600)
            };
            playTrack(track, allLibrarySongs.length > 0 ? allLibrarySongs : [track]);
          }}
          onOpenArtist={onOpenArtist}
          onOpenLikedSongs={() => setActiveTab('liked')}
          onOpenHistory={() => setActiveTab('history')}
        />
      )}

      {/* =========================================================================
          MODAL: CREATE / EDIT LOCAL PLAYLIST
          ========================================================================= */}
      {showCreatePlaylistModal && (
        <div
          onClick={() => setShowCreatePlaylistModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '420px',
              borderRadius: '32px',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '18px',
                  backgroundColor: 'var(--md-sys-color-primary-container)',
                  color: 'var(--md-sys-color-on-primary-container)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '26px' }}>
                  {editingPlaylist ? 'edit' : 'playlist_add'}
                </span>
              </div>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 850, margin: 0 }}>
                  {editingPlaylist ? 'Edit playlist' : 'New playlist'}
                </h3>
                <span
                  style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}
                >
                  Saved directly to your Koda library
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="Playlist name"
                value={newPlaylistTitle}
                onChange={(e) => setNewPlaylistTitle(e.target.value)}
                autoFocus
                style={{
                  padding: '12px 16px',
                  borderRadius: '16px',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  color: 'var(--md-sys-color-on-surface)',
                  fontSize: '14px',
                  fontWeight: 650,
                  outline: 'none'
                }}
              />
              <textarea
                placeholder="Description (optional)"
                value={newPlaylistDesc}
                onChange={(e) => setNewPlaylistDesc(e.target.value)}
                rows={2}
                style={{
                  padding: '12px 16px',
                  borderRadius: '16px',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  color: 'var(--md-sys-color-on-surface)',
                  fontSize: '13px',
                  fontWeight: 550,
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowCreatePlaylistModal(false)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '999px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--md-sys-color-on-surface-variant)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                disabled={!newPlaylistTitle.trim()}
                onClick={() => {
                  if (!newPlaylistTitle.trim()) return;
                  if (editingPlaylist) {
                    updateLocalPlaylist(editingPlaylist.id, newPlaylistTitle, newPlaylistDesc);
                  } else {
                    const created = createLocalPlaylist(
                      newPlaylistTitle,
                      newPlaylistDesc,
                      addToPlaylistTrack ? [addToPlaylistTrack] : []
                    );
                    if (addToPlaylistTrack) {
                      setAddToPlaylistTrack(null);
                    } else {
                      setActiveTab('playlists');
                      setSelectedLocalPlaylistId(created.id);
                    }
                  }
                  setShowCreatePlaylistModal(false);
                }}
                style={{
                  padding: '10px 22px',
                  borderRadius: '999px',
                  border: 'none',
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: newPlaylistTitle.trim() ? 'pointer' : 'not-allowed',
                  opacity: newPlaylistTitle.trim() ? 1 : 0.5
                }}
              >
                {editingPlaylist ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD TRACK TO LOCAL PLAYLIST
          ========================================================================= */}
      {addToPlaylistTrack && !showCreatePlaylistModal && (
        <div
          onClick={() => setAddToPlaylistTrack(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '400px',
              borderRadius: '28px',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
              Add "{addToPlaylistTrack.title}" to playlist
            </h3>

            {localPlaylists.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                You don't have any local playlists yet.
              </p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '220px',
                  overflowY: 'auto'
                }}
              >
                {localPlaylists.map((lp) => (
                  <button
                    key={lp.id}
                    onClick={() => {
                      addTrackToLocalPlaylist(lp.id, addToPlaylistTrack);
                      setAddToPlaylistTrack(null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: '16px',
                      border: 'none',
                      backgroundColor: 'var(--md-sys-color-surface-container)',
                      color: 'var(--md-sys-color-on-surface)',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <span>{lp.title}</span>
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--md-sys-color-on-surface-variant)'
                      }}
                    >
                      {lp.tracks.length} songs
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
              <button
                onClick={() => {
                  setEditingPlaylist(null);
                  setNewPlaylistTitle('');
                  setNewPlaylistDesc('');
                  setShowCreatePlaylistModal(true);
                }}
                style={{
                  padding: '9px 16px',
                  borderRadius: '999px',
                  border: 'none',
                  backgroundColor: 'var(--md-sys-color-primary-container)',
                  color: 'var(--md-sys-color-on-primary-container)',
                  fontSize: '12px',
                  fontWeight: 750,
                  cursor: 'pointer'
                }}
              >
                + New playlist
              </button>
              <button
                onClick={() => setAddToPlaylistTrack(null)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '999px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--md-sys-color-on-surface-variant)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
