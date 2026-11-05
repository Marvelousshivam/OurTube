import React, { useEffect, useState } from 'react';
import { TrackMetadata } from '../types';
import { innertubeService } from '../api/innertubeService';
import { usePlayerStore } from '../store/playerStore';
import { useTasteStore } from '../store/tasteStore';
import { sizedArtwork, handleArtworkError } from '../api/artworkService';
import {
  COLOR_TOKENS,
  DSButton,
  DSIconButton,
  DSTrackRow
} from '../design-system';

export interface PlaylistPageProps {
  playlist: {
    id: string;
    title: string;
    subtitle?: string;
    imageUrl?: string;
    author?: string;
    itemCount?: number;
  };
  onBack: () => void;
  onOpenArtist?: (artist: { id?: string; name: string; imageUrl?: string }) => void;
}

export const PlaylistPage: React.FC<PlaylistPageProps> = ({ playlist, onBack, onOpenArtist }) => {
  const [tracks, setTracks] = useState<TrackMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const { playTrack, currentTrack, isPlaying } = usePlayerStore();
  const { isLiked, toggleLikeTrack } = useTasteStore();

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);

    innertubeService
      .resolvePlaylistTracks(playlist.id)
      .then((items) => {
        if (!isCurrent) return;
        setTracks(items);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('[Koda Playlist] Failed to resolve tracks:', err);
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [playlist.id]);

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  const handleShuffle = () => {
    if (tracks.length > 0) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    }
  };

  const rawCoverUrl =
    playlist.imageUrl ||
    (tracks.length > 0 ? tracks[0].thumbnailUrl : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop');
  const coverUrl = sizedArtwork(rawCoverUrl, 544);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        paddingBottom: '120px',
        color: COLOR_TOKENS.onSurface,
        position: 'relative'
      }}
    >
      {/* Cover-Led Hero Section (Koda PlaylistPageStyle) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 280px) 1fr',
          gap: '32px',
          alignItems: 'flex-end',
          padding: '24px',
          borderRadius: '28px',
          backgroundColor: COLOR_TOKENS.primaryContainer,
          color: COLOR_TOKENS.onPrimaryContainer,
          marginBottom: '32px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}
      >
        {/* Artwork */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1/1',
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
            backgroundColor: COLOR_TOKENS.surfaceContainerHigh
          }}
        >
          <img
            src={coverUrl}
            alt={playlist.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            referrerPolicy="no-referrer"
            onError={(e) => handleArtworkError(e, rawCoverUrl)}
          />
        </div>

        {/* Facts & Title Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                opacity: 0.8
              }}
            >
              PLAYLIST
            </span>
            <h1
              style={{
                fontSize: 'clamp(2rem, 3.5vw, 3rem)',
                fontWeight: 800,
                lineHeight: 1.1,
                margin: '6px 0 10px 0',
                letterSpacing: '-0.02em',
                textWrap: 'balance'
              }}
            >
              {playlist.title}
            </h1>
            <p
              style={{
                fontSize: '14px',
                fontWeight: 600,
                opacity: 0.9,
                margin: 0
              }}
            >
              {playlist.author || 'YouTube Music'} • {tracks.length} tracks
            </p>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <DSButton
              variant="filled"
              size="lg"
              icon="play_arrow"
              onClick={handlePlayAll}
              disabled={tracks.length === 0}
            >
              Play All
            </DSButton>

            <DSButton
              variant="tonal"
              size="lg"
              icon="shuffle"
              onClick={handleShuffle}
              disabled={tracks.length === 0}
            >
              Shuffle
            </DSButton>

            <DSIconButton
              icon="favorite"
              variant="tonal"
              size="lg"
              filledIcon={isSaved}
              onClick={() => setIsSaved(!isSaved)}
              title={isSaved ? 'Remove from Library' : 'Save to Library'}
            />
          </div>
        </div>
      </div>

      {/* Track List Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {loading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '240px',
              gap: '12px',
              color: COLOR_TOKENS.onSurfaceVariant
            }}
          >
            <span className="material-symbols-rounded" style={{ animation: 'spin 1s linear infinite', fontSize: '28px' }}>
              progress_activity
            </span>
            <span>Loading playlist tracks...</span>
          </div>
        )}

        {!loading && tracks.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              gap: '8px',
              color: COLOR_TOKENS.onSurfaceVariant
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '36px' }}>
              queue_music
            </span>
            <span>No tracks found in this playlist.</span>
          </div>
        )}

        {!loading &&
          tracks.map((track, idx) => {
            const isTrackPlaying = currentTrack?.id === track.id && isPlaying;
            const liked = isLiked(track.id);
            return (
              <DSTrackRow
                key={`${track.id}-${idx}`}
                rank={idx + 1}
                title={track.title}
                artist={track.artist}
                album={track.album}
                duration={track.duration}
                imageUrl={track.thumbnailUrl}
                isPlaying={isTrackPlaying}
                isLiked={liked}
                onPlay={() => playTrack(track, tracks)}
                onToggleLike={() => toggleLikeTrack(track)}
                onArtistClick={() => onOpenArtist?.({ name: track.artist })}
              />
            );
          })}
      </div>
    </div>
  );
};
