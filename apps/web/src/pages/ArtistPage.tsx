import React, { useEffect, useState } from 'react';
import { innertubeService, ArtistDetails } from '../api/innertubeService';
import { usePlayerStore } from '../store/playerStore';
import { useTasteStore } from '../store/tasteStore';
import { sizedArtwork, handleArtworkError } from '../api/artworkService';
import {
  COLOR_TOKENS,
  DSButton,
  DSTrackRow,
  MediaCard,
  DSAvatar,
  DSSectionHeader,
  M3LoadingIndicator
} from '../design-system';

export interface ArtistPageProps {
  artist: {
    id?: string;
    name: string;
    imageUrl?: string;
  };
  onBack: () => void;
  onOpenPlaylist?: (playlist: { id: string; title: string; subtitle?: string; imageUrl?: string; author?: string }) => void;
  onOpenArtist?: (artist: { id?: string; name: string; imageUrl?: string }) => void;
}

export const ArtistPage: React.FC<ArtistPageProps> = ({
  artist,
  onBack,
  onOpenPlaylist,
  onOpenArtist
}) => {
  const [details, setDetails] = useState<ArtistDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const { playTrack, currentTrack, isPlaying } = usePlayerStore();
  const { isLiked, toggleLikeTrack, isArtistFollowed, toggleFollowArtist } = useTasteStore();
  const artistName = details?.name || artist.name;
  const following = isArtistFollowed(artist.id || artistName);

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);

    const lookupKey = artist.id || artist.name;
    innertubeService
      .getArtistDetails(lookupKey)
      .then((data) => {
        if (!isCurrent) return;
        setDetails(data);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('[Koda ArtistPage] Failed to fetch artist details:', err);
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [artist.id, artist.name]);

  const handlePlayAll = () => {
    if (details && details.topSongs.length > 0) {
      playTrack(details.topSongs[0], details.topSongs);
    }
  };

  const handleShuffle = () => {
    if (details && details.topSongs.length > 0) {
      const shuffled = [...details.topSongs].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    }
  };

  const heroBanner = details?.heroImage || artist.imageUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80';
  const highResBanner = sizedArtwork(heroBanner, 1200);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        paddingBottom: '140px',
        color: COLOR_TOKENS.onSurface,
        position: 'relative'
      }}
    >
      {/* Loading State */}
      {loading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '360px'
          }}
        >
          <M3LoadingIndicator contained size="lg" message="Loading artist discography & top tracks..." />
        </div>
      )}

      {/* 3. Immersive Artist Hero (Koda ArtistHero) */}
      {!loading && (
        <>
          <div
            style={{
              position: 'relative',
              width: '100%',
              minHeight: '280px',
              maxHeight: '440px',
              aspectRatio: '16/7',
              borderRadius: '28px',
              overflow: 'hidden',
              marginBottom: '32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              padding: '32px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
              backgroundColor: COLOR_TOKENS.surfaceContainerHigh
            }}
          >
            {/* High-Res Hero Image */}
            <img
              src={highResBanner}
              alt={details?.name || artist.name}
              referrerPolicy="no-referrer"
              onError={(e) => handleArtworkError(e, heroBanner)}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'brightness(0.85)'
              }}
            />

            {/* Gradient Mask Over Banner */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.45) 50%, rgba(20,18,24,0.95) 100%)',
                pointerEvents: 'none'
              }}
            />

            {/* Hero Foreground Content */}
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: COLOR_TOKENS.primary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span className="material-symbols-rounded filled" style={{ fontSize: '16px' }}>
                    verified
                  </span>
                  OFFICIAL ARTIST
                </span>

                <h1
                  style={{
                    fontSize: 'clamp(2.2rem, 4vw, 3.6rem)',
                    fontWeight: 800,
                    lineHeight: 1.08,
                    margin: '6px 0 8px 0',
                    letterSpacing: '-0.02em',
                    color: '#ffffff',
                    textShadow: '0 2px 16px rgba(0,0,0,0.6)'
                  }}
                >
                  {details?.name || artist.name}
                </h1>

                {details?.subscribers && (
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                    {details.subscribers} Subscribers
                  </p>
                )}
              </div>

              {/* Action Buttons Deck */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {/* 56px Circular Play Button */}
                <button
                  onClick={handlePlayAll}
                  disabled={!details || details.topSongs.length === 0}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: COLOR_TOKENS.primary,
                    color: COLOR_TOKENS.onPrimary,
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4)',
                    transition: 'transform 150ms cubic-bezier(0.2, 0, 0, 1)'
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  title={`Play top songs by ${details?.name || artist.name}`}
                >
                  <span className="material-symbols-rounded filled" style={{ fontSize: '32px' }}>
                    play_arrow
                  </span>
                </button>

                {/* Shuffle Button */}
                <DSButton
                  variant="tonal"
                  size="md"
                  icon="shuffle"
                  onClick={handleShuffle}
                  disabled={!details || details.topSongs.length === 0}
                >
                  Shuffle
                </DSButton>

                {/* Radio Button */}
                <DSButton
                  variant="outlined"
                  size="md"
                  icon="radio"
                  onClick={handlePlayAll}
                  disabled={!details || details.topSongs.length === 0}
                >
                  Radio
                </DSButton>

                {/* Follow Button */}
                <DSButton
                  variant={following ? 'filled' : 'outlined'}
                  size="md"
                  icon={following ? 'check' : 'favorite_border'}
                  onClick={() =>
                    toggleFollowArtist({
                      id: artist.id || artistName,
                      name: artistName,
                      thumbnailUrl: highResBanner,
                      subscribersText: details?.subscribers
                    })
                  }
                >
                  {following ? 'Following' : 'Follow'}
                </DSButton>
              </div>
            </div>
          </div>

          {/* 4. Top Songs Section */}
          {details && details.topSongs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '36px' }}>
              <DSSectionHeader
                title="Top Songs"
                subtitle="Most popular tracks right now"
                icon="trending_up"
                actionLabel="Play All"
                onAction={handlePlayAll}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {details.topSongs.slice(0, 5).map((track, idx) => {
                  const isTrackPlaying = currentTrack?.id === track.id && isPlaying;
                  return (
                    <DSTrackRow
                      key={`${track.id}-${idx}`}
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
                      isLiked={isLiked(track.id)}
                      onPlay={() => playTrack(track, details.topSongs)}
                      onToggleLike={() => toggleLikeTrack(track)}
                      onArtistClick={() => onOpenArtist?.({ name: track.artist })}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Discography: Albums */}
          {details && details.albums.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '36px' }}>
              <DSSectionHeader
                title="Albums"
                subtitle="Complete album discography"
                icon="album"
              />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '16px'
                }}
              >
                {details.albums.map((album, aIdx) => (
                  <MediaCard
                    key={album.id}
                    id={album.id}
                    index={aIdx}
                    title={album.title}
                    subtitle={album.year ? `${album.year} • Album` : 'Album'}
                    imageUrl={album.imageUrl || ''}
                    isPlaylist={true}
                    onClick={() => {
                      if (onOpenPlaylist) {
                        onOpenPlaylist({
                          id: album.id,
                          title: album.title,
                          subtitle: `${details.name} • ${album.year || 'Album'}`,
                          imageUrl: album.imageUrl,
                          author: details.name
                        });
                      }
                    }}
                    onPlay={async () => {
                      const tracks = await innertubeService.resolvePlaylistTracks(album.id);
                      if (tracks.length > 0) playTrack(tracks[0], tracks);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 6. Singles & EPs */}
          {details && details.singles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '36px' }}>
              <DSSectionHeader
                title="Singles & EPs"
                icon="music_note"
              />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '16px'
                }}
              >
                {details.singles.map((single) => (
                  <MediaCard
                    key={single.id}
                    id={single.id}
                    title={single.title}
                    subtitle={single.year ? `${single.year} • Single` : 'Single'}
                    imageUrl={single.imageUrl || ''}
                    isPlaylist={true}
                    onClick={() => {
                      if (onOpenPlaylist) {
                        onOpenPlaylist({
                          id: single.id,
                          title: single.title,
                          subtitle: `${details.name} • ${single.year || 'Single'}`,
                          imageUrl: single.imageUrl,
                          author: details.name
                        });
                      }
                    }}
                    onPlay={async () => {
                      const tracks = await innertubeService.resolvePlaylistTracks(single.id);
                      if (tracks.length > 0) playTrack(tracks[0], tracks);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 7. Fans Also Like (Cookie9 Avatars) */}
          {details && details.relatedArtists.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '36px' }}>
              <DSSectionHeader
                title="Fans Might Also Like"
                subtitle="Similar artists based on listening habits"
                icon="people"
              />

              <div
                style={{
                  display: 'flex',
                  gap: '24px',
                  overflowX: 'auto',
                  paddingBottom: '8px',
                  scrollbarWidth: 'none'
                }}
              >
                {details.relatedArtists.map((rel) => (
                  <DSAvatar
                    key={rel.id}
                    name={rel.name}
                    imageUrl={rel.imageUrl}
                    subtext={rel.subscribers || 'Artist'}
                    variant="cookie9"
                    size="lg"
                    onClick={() => {
                      if (onOpenArtist) {
                        onOpenArtist({
                          id: rel.id,
                          name: rel.name,
                          imageUrl: rel.imageUrl
                        });
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 8. About Section */}
          {details && details.description && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '24px',
                borderRadius: '24px',
                backgroundColor: COLOR_TOKENS.surfaceContainer,
                border: `1px solid ${COLOR_TOKENS.outlineVariant}`,
                maxWidth: '800px'
              }}
            >
              <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>
                About {details.name}
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  lineHeight: 1.6,
                  color: COLOR_TOKENS.onSurfaceVariant,
                  margin: 0,
                  whiteSpace: 'pre-line'
                }}
              >
                {details.description}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
