import React, { useState, useEffect } from 'react';
import { useTasteStore } from '../store/tasteStore';
import { usePlayerStore } from '../store/playerStore';
import { bridgeClient } from '../api/bridgeClient';
import { innertubeService, UserPlaylist } from '../api/innertubeService';
import { AuthState, TrackMetadata } from '../types';
import {
  COLOR_TOKENS,
  DSButton,
  DSIconButton,
  DSTrackRow,
  DSAvatar,
  DSSegmentedGroup,
  MediaCard,
  LikedSongsTile
} from '../design-system';

export interface LibraryPageProps {
  onOpenPlaylist?: (playlist: { id: string; title: string; subtitle?: string; imageUrl?: string; author?: string }) => void;
  onOpenArtist?: (artist: { id?: string; name: string; imageUrl?: string }) => void;
}

type LibraryTab = 'playlists' | 'liked' | 'artists' | 'history' | 'extension';

export const LibraryPage: React.FC<LibraryPageProps> = ({ onOpenPlaylist, onOpenArtist }) => {
  const [activeTab, setActiveTab] = useState<LibraryTab>('playlists');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isBridgeConnected, setIsBridgeConnected] = useState(bridgeClient.getIsAvailable());
  const [authState, setAuthState] = useState<AuthState>(bridgeClient.getAuthState());
  const [isCheckingBridge, setIsCheckingBridge] = useState(false);

  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);

  const { likedTracks, history, toggleLikeTrack } = useTasteStore();
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
        console.warn('[Koda Library] Failed to load user playlists:', err);
        setLoadingPlaylists(false);
      });
  };

  useEffect(() => {
    loadPlaylists();

    const unsub = bridgeClient.onAvailabilityChange((available) => {
      setIsBridgeConnected(available);
      if (available) {
        bridgeClient.refreshAuth().then((auth) => {
          setAuthState(auth);
          loadPlaylists();
        });
      }
    });

    return () => unsub();
  }, []);

  const handleTestBridge = async () => {
    setIsCheckingBridge(true);
    try {
      await bridgeClient.refreshAuth();
      setIsBridgeConnected(bridgeClient.getIsAvailable());
      setAuthState(bridgeClient.getAuthState());
      loadPlaylists();
    } finally {
      setIsCheckingBridge(false);
    }
  };

  // Top artists from history
  const topArtists = React.useMemo(() => {
    const counts: Record<string, { plays: number }> = {};
    for (const h of history) {
      if (!counts[h.artist]) counts[h.artist] = { plays: 0 };
      counts[h.artist].plays += h.playCount || 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1].plays - a[1].plays)
      .map(([name, data]) => ({ name, plays: data.plays }));
  }, [history]);

  const libraryTabs = [
    { id: 'playlists' as LibraryTab, label: `Playlists (${userPlaylists.length})` },
    { id: 'liked' as LibraryTab, label: `Liked (${likedTracks.length})` },
    { id: 'artists' as LibraryTab, label: 'Artists' },
    { id: 'history' as LibraryTab, label: 'History' },
    { id: 'extension' as LibraryTab, label: 'Extension' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '120px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
          Library
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activeTab === 'playlists' && (
            <div style={{ display: 'flex', gap: '4px', backgroundColor: COLOR_TOKENS.surfaceContainer, borderRadius: '9999px', padding: '3px' }}>
              <DSIconButton
                icon="grid_view"
                variant={viewMode === 'grid' ? 'filled' : 'standard'}
                size="sm"
                onClick={() => setViewMode('grid')}
                title="Grid view"
              />
              <DSIconButton
                icon="format_list_bulleted"
                variant={viewMode === 'list' ? 'filled' : 'standard'}
                size="sm"
                onClick={() => setViewMode('list')}
                title="List view"
              />
            </div>
          )}

          <DSButton
            variant="tonal"
            size="sm"
            icon="refresh"
            onClick={loadPlaylists}
            disabled={loadingPlaylists}
            title="Refresh user playlists"
          >
            {loadingPlaylists ? 'Loading...' : 'Refresh'}
          </DSButton>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <DSSegmentedGroup
        options={libraryTabs}
        selectedId={activeTab}
        onChange={(id) => setActiveTab(id as LibraryTab)}
      />

      {/* TAB 1: PLAYLISTS */}
      {activeTab === 'playlists' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Pinned Liked Songs Hero Card */}
          <div style={{ maxWidth: '380px' }}>
            <LikedSongsTile
              count={likedTracks.length}
              onClick={() => {
                if (onOpenPlaylist) {
                  onOpenPlaylist({
                    id: 'playlist_LM',
                    title: 'Liked Songs',
                    subtitle: `${likedTracks.length} songs`,
                    author: authState.selectedChannel?.name || 'You'
                  });
                }
              }}
            />
          </div>

          {loadingPlaylists && userPlaylists.length === 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                gap: '12px',
                color: COLOR_TOKENS.onSurfaceVariant
              }}
            >
              <span className="material-symbols-rounded" style={{ animation: 'spin 1s linear infinite', fontSize: '32px' }}>
                progress_activity
              </span>
              <span>Loading YouTube Music playlists...</span>
            </div>
          )}

          {/* Grid / List of Playlists */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                viewMode === 'grid'
                  ? 'repeat(auto-fill, minmax(200px, 1fr))'
                  : '1fr',
              gap: '16px'
            }}
          >
            {userPlaylists.map((pl) => (
              <MediaCard
                key={pl.id}
                id={pl.id}
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

          {!loadingPlaylists && userPlaylists.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '240px',
                gap: '12px',
                color: COLOR_TOKENS.onSurfaceVariant
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '48px', color: COLOR_TOKENS.outline }}>
                queue_music
              </span>
              <p style={{ fontSize: '15px', fontWeight: 600 }}>No personal playlists found.</p>
              <span style={{ fontSize: '13px' }}>
                {isBridgeConnected
                  ? 'Ensure your YouTube Music account has created or saved playlists.'
                  : 'Connect the OurTube Companion Extension to sync your YouTube Music library.'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIKED SONGS */}
      {activeTab === 'liked' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {likedTracks.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '240px',
                gap: '12px',
                color: COLOR_TOKENS.onSurfaceVariant
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '48px', color: COLOR_TOKENS.outline }}>
                favorite_border
              </span>
              <p style={{ fontSize: '15px', fontWeight: 600 }}>No liked songs yet.</p>
              <span style={{ fontSize: '13px' }}>Tap the heart on any song to save it here.</span>
            </div>
          ) : (
            likedTracks.map((track, idx) => {
              const isTrackPlaying = currentTrack?.id === track.id && isPlaying;
              return (
                <DSTrackRow
                  key={track.id}
                  rank={idx + 1}
                  title={track.title}
                  artist={track.artist}
                  album={track.album}
                  duration={track.duration}
                  imageUrl={track.thumbnailUrl}
                  isPlaying={isTrackPlaying}
                  isLiked={true}
                  onPlay={() => playTrack(track, likedTracks)}
                  onToggleLike={() => toggleLikeTrack(track)}
                  onArtistClick={() => onOpenArtist?.({ name: track.artist })}
                />
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: ARTISTS */}
      {activeTab === 'artists' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          {topArtists.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '240px',
                width: '100%',
                gap: '12px',
                color: COLOR_TOKENS.onSurfaceVariant
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '48px', color: COLOR_TOKENS.outline }}>
                person
              </span>
              <p style={{ fontSize: '15px', fontWeight: 600 }}>No artist listening history yet.</p>
              <span style={{ fontSize: '13px' }}>Play songs to build your artist listening profile.</span>
            </div>
          ) : (
            topArtists.map((artist, idx) => (
              <DSAvatar
                key={idx}
                name={artist.name}
                subtext={`${artist.plays} plays`}
                variant="cookie9"
                size="lg"
                onClick={() => onOpenArtist?.({ name: artist.name })}
              />
            ))
          )}
        </div>
      )}

      {/* TAB 4: HISTORY */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {history.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '240px',
                gap: '12px',
                color: COLOR_TOKENS.onSurfaceVariant
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '48px', color: COLOR_TOKENS.outline }}>
                history
              </span>
              <p style={{ fontSize: '15px', fontWeight: 600 }}>Your history is empty.</p>
              <span style={{ fontSize: '13px' }}>Played tracks will show up here.</span>
            </div>
          ) : (
            history.map((entry) => (
              <div
                key={entry.trackId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '12px 16px',
                  borderRadius: '16px',
                  backgroundColor: COLOR_TOKENS.surfaceContainer,
                  cursor: 'pointer'
                }}
              >
                <span className="material-symbols-rounded" style={{ color: COLOR_TOKENS.primary }}>
                  history
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: COLOR_TOKENS.onSurface }}>
                    {entry.title}
                  </div>
                  <div style={{ fontSize: '12px', color: COLOR_TOKENS.onSurfaceVariant, marginTop: '2px' }}>
                    {entry.artist} • {entry.playCount} plays
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 5: EXTENSION STATUS */}
      {activeTab === 'extension' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '640px' }}>
          <div
            style={{
              padding: '24px',
              borderRadius: '24px',
              backgroundColor: COLOR_TOKENS.surfaceContainer,
              border: `1px solid ${COLOR_TOKENS.outlineVariant}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: isBridgeConnected ? '#4caf50' : '#ff9800',
                  boxShadow: isBridgeConnected ? '0 0 12px #4caf50' : 'none'
                }}
              />
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                {isBridgeConnected ? 'Extension Bridge Connected' : 'Extension Bridge Inactive'}
              </h3>
            </div>

            <p style={{ fontSize: '14px', color: COLOR_TOKENS.onSurfaceVariant, margin: 0, lineHeight: 1.5 }}>
              The OurTube Companion Extension bridges authentic Google account credentials and InnerTube API calls directly from your active browser session.
            </p>

            <DSButton
              variant="tonal"
              size="sm"
              icon="sync"
              onClick={handleTestBridge}
              disabled={isCheckingBridge}
            >
              {isCheckingBridge ? 'Checking Status...' : 'Test Connection'}
            </DSButton>
          </div>
        </div>
      )}
    </div>
  );
};
