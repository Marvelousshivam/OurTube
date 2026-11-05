import React, { useEffect, useState, useMemo } from 'react';
import { innertubeService, HomeSection, UserPlaylist } from '../api/innertubeService';
import { usePlayerStore } from '../store/playerStore';
import { useTasteStore } from '../store/tasteStore';
import { bridgeClient } from '../api/bridgeClient';
import { TrackMetadata, AuthState } from '../types';
import { artistPhotoService } from '../api/artistPhotoService';
import { sizedArtwork } from '../api/artworkService';
import { YourMixHero } from '../components/home/YourMixHero';
import {
  COLOR_TOKENS,
  SHAPES,
  MediaCard,
  DSAvatar
} from '../design-system';

export interface HomePageProps {
  onOpenPlaylist?: (playlist: { id: string; title: string; subtitle?: string; imageUrl?: string; author?: string }) => void;
  onOpenArtist?: (artist: { id?: string; name: string; imageUrl?: string }) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onOpenPlaylist, onOpenArtist }) => {
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
  const [remoteHistory, setRemoteHistory] = useState<TrackMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWideScreen, setIsWideScreen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );
  const [, setPhotoVersion] = useState(0);

  const { playTrack, currentTrack, isPlaying } = usePlayerStore();
  const { history, likedTracks, isLiked, toggleLikeTrack } = useTasteStore();

  const loadFeed = () => {
    setLoading(true);
    innertubeService
      .getHomeFeed()
      .then((data) => {
        setSections(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    // Also load authentic user playlists
    innertubeService
      .getUserPlaylists()
      .then((pls) => setUserPlaylists(pls))
      .catch(() => {});

    // Also load authentic YouTube Music listening history
    innertubeService
      .getRecentlyPlayed()
      .then((items) => setRemoteHistory(items))
      .catch(() => {});
  };

  useEffect(() => {
    loadFeed();

    const handleResize = () => {
      setIsWideScreen(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);

    // Subscribe to artist photo resolution events
    const unsubPhotos = artistPhotoService.subscribe(() => {
      setPhotoVersion((v) => v + 1);
    });

    const unsubBridge = bridgeClient.onAvailabilityChange((available) => {
      if (available) {
        bridgeClient.refreshAuth().then(() => {
          loadFeed();
        });
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubPhotos();
      unsubBridge();
    };
  }, []);

  // Derive Top Artists from playback history (with fallback to quick-pick artists)
  const topArtists = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of history) {
      if (h.artist) {
        counts[h.artist] = (counts[h.artist] || 0) + (h.playCount || 1);
      }
    }

    let sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, plays]) => ({ name, plays }));

    // Fallback if history is fresh
    if (sorted.length === 0 && sections.length > 0) {
      const seen = new Set<string>();
      for (const item of sections[0].items) {
        if (item.artist && !seen.has(item.artist)) {
          seen.add(item.artist);
          sorted.push({ name: item.artist, plays: 2 });
          if (sorted.length >= 8) break;
        }
      }
    }

    return sorted;
  }, [history, sections]);

  // Batch resolve artist photos whenever top artists change
  useEffect(() => {
    if (topArtists.length > 0) {
      artistPhotoService.batchResolve(topArtists.map((a) => a.name));
    }
  }, [topArtists]);

  // Derive authentic personalized listening tracks for "Your Mix" from user's history, likes & personalized shelves
  const mixTracks = useMemo(() => {
    const personalTracks: TrackMetadata[] = [];
    const seenIds = new Set<string>();

    // 1. Tracks user has liked
    for (const track of likedTracks) {
      if (!seenIds.has(track.id)) {
        seenIds.add(track.id);
        personalTracks.push(track);
      }
    }

    // 2. Tracks user has played in history
    for (const h of history) {
      if (!seenIds.has(h.trackId)) {
        seenIds.add(h.trackId);
        const found =
          sections.flatMap((s) => s.items).find((i) => i.id === h.trackId) ||
          likedTracks.find((l) => l.id === h.trackId);
        if (found) {
          personalTracks.push(found);
        }
      }
    }

    // 3. Authentic personalized shelves from YouTube Music (e.g. Listen again, Mixed for you, Quick picks)
    const personalizedShelf = sections.find((s) =>
      /listen again|mixed for you|quick picks|my supermix|favorites|similar to|from your/i.test(s.title)
    );
    if (personalizedShelf) {
      for (const item of personalizedShelf.items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          personalTracks.push(item);
        }
      }
    }

    // If we have at least 3 tracks from the user's authentic listening, use them!
    if (personalTracks.length >= 3) {
      return personalTracks.slice(0, 12);
    }

    // Fallback if fresh account with no history yet
    if (sections.length > 0) {
      return sections[0].items.slice(0, 12);
    }

    return [];
  }, [likedTracks, history, sections]);

  // Derive authentic Recently Played songs (merging local playback history with remote YouTube history)
  const recentlyPlayed = useMemo(() => {
    const list: TrackMetadata[] = [];
    const seenIds = new Set<string>();

    // 1. Local playback history (newest first)
    for (const h of history) {
      if (!h.trackId || seenIds.has(h.trackId)) continue;
      seenIds.add(h.trackId);
      const thumb =
        h.thumbnailUrl || `https://i.ytimg.com/vi/${h.trackId}/hqdefault.jpg`;
      list.push({
        id: h.trackId,
        title: h.title,
        artist: h.artist,
        album: h.album,
        duration: h.duration || 210,
        thumbnailUrl: thumb,
        highResThumbnailUrl: sizedArtwork(thumb, 600)
      });
    }

    // 2. YouTube Music remote listening history
    for (const r of remoteHistory) {
      if (!r.id || seenIds.has(r.id)) continue;
      seenIds.add(r.id);
      list.push(r);
    }

    return list.slice(0, 24);
  }, [history, remoteHistory]);

  // Extract recent albums / collections from shelves (only if at least 3)
  const recentAlbums = useMemo(() => {
    for (const s of sections) {
      if (/album|release|record|collection/i.test(s.title)) {
        return s.items.length >= 3 ? s.items.slice(0, 10) : [];
      }
    }
    return sections.length > 1 && sections[1].items.length >= 3 ? sections[1].items.slice(0, 10) : [];
  }, [sections]);

  // Extract tracks for "Jump back in"
  const jumpBackInTracks = useMemo(() => {
    if (sections.length > 0) {
      const lastSection = sections[sections.length - 1];
      if (lastSection.items.length > 0) return lastSection.items.slice(0, 8);
    }
    return mixTracks.slice(0, 8);
  }, [sections, mixTracks]);

  const handleCardClick = async (track: TrackMetadata, currentSectionItems: TrackMetadata[]) => {
    if (track.id.startsWith('playlist_')) {
      if (onOpenPlaylist) {
        onOpenPlaylist({
          id: track.id,
          title: track.title,
          subtitle: track.artist,
          imageUrl: track.thumbnailUrl,
          author: track.artist
        });
      } else {
        const playlistTracks = await innertubeService.resolvePlaylistTracks(track.id);
        if (playlistTracks.length > 0) {
          playTrack(playlistTracks[0], playlistTracks);
        }
      }
    } else {
      playTrack(track, currentSectionItems);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '40px',
        paddingBottom: '140px',
        maxWidth: '1480px',
        margin: '0 auto',
        width: '100%'
      }}
    >
      {/* 1. Signature Koda "Your Mix" Organic Collage Hero */}
      {mixTracks.length > 0 && (
        <YourMixHero
          tracks={mixTracks}
          onPlayMix={(t) => playTrack(t[0], t)}
          onTrackClick={(t) => playTrack(t, mixTracks)}
          isWideScreen={isWideScreen}
        />
      )}

      {/* 2. Recently Played Songs Shelf (BitChord / YouTube Music / Apple Music standard) */}
      {recentlyPlayed.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <h2
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  margin: 0,
                  color: 'var(--md-sys-color-on-surface)'
                }}
              >
                Recently Played
              </h2>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--md-sys-color-outline)' }}>
                {recentlyPlayed.length} songs
              </span>
            </div>
          </div>

          {/* Smooth horizontal scroll deck with no empty voids */}
          <div
            style={{
              display: 'flex',
              gap: isWideScreen ? '18px' : '14px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              paddingBottom: '8px',
              margin: '0 -4px',
              padding: '0 4px 8px 4px'
            }}
          >
            {recentlyPlayed.map((track) => {
              const isThisPlaying = currentTrack?.id === track.id && isPlaying;
              return (
                <div
                  key={track.id}
                  onClick={() => playTrack(track)}
                  style={{
                    flex: '0 0 auto',
                    width: isWideScreen ? '170px' : '136px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'transform 180ms ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  {/* Artwork Container */}
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '1/1',
                      borderRadius: '18px',
                      overflow: 'hidden',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)'
                    }}
                  >
                    <img
                      src={track.highResThumbnailUrl || track.thumbnailUrl}
                      alt={track.title}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block'
                      }}
                    />

                    {/* Active playing indicator or play overlay */}
                    {isThisPlaying && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: 'rgba(0, 0, 0, 0.45)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <span
                          className="material-symbols-rounded"
                          style={{
                            fontSize: '32px',
                            color: 'var(--md-sys-color-primary, #ffffff)'
                          }}
                        >
                          equalizer
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span
                      style={{
                        fontSize: isWideScreen ? '14px' : '13px',
                        fontWeight: 700,
                        color: 'var(--md-sys-color-on-surface)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={track.title}
                    >
                      {track.title}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'var(--md-sys-color-outline)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={track.artist}
                    >
                      {track.artist}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Recent Albums Section (Only rendered if >= 3 albums exist to prevent empty voids) */}
      {recentAlbums.length >= 3 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2
              style={{
                fontSize: '22px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                margin: 0,
                color: 'var(--md-sys-color-on-surface)'
              }}
            >
              Recent Albums
            </h2>
          </div>

          <div
            style={{
              display: 'flex',
              gap: isWideScreen ? '18px' : '14px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              paddingBottom: '8px'
            }}
          >
            {recentAlbums.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                onClick={() => handleCardClick(item, recentAlbums)}
                style={{
                  flex: '0 0 auto',
                  width: isWideScreen ? '170px' : '136px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'transform 180ms ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    backgroundColor: 'var(--md-sys-color-surface-container-high)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)',
                    position: 'relative'
                  }}
                >
                  <img
                    src={sizedArtwork(item.highResThumbnailUrl || item.thumbnailUrl, 500)}
                    alt={item.title}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--md-sys-color-on-surface)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {item.title}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--md-sys-color-outline)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: '2px'
                    }}
                  >
                    {item.artist}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Your Playlists Section (Matching Koda Screenshot) */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2
            style={{
              fontSize: '22px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              margin: 0,
              color: 'var(--md-sys-color-on-surface)'
            }}
          >
            Your playlists
          </h2>
          <button
            onClick={() => onOpenPlaylist?.({ id: 'playlist_LM', title: 'Liked Songs' })}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--md-sys-color-on-surface)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="View all playlists"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              arrow_forward
            </span>
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isWideScreen
              ? 'repeat(auto-fill, minmax(200px, 1fr))'
              : 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: isWideScreen ? '20px' : '14px'
          }}
        >
          {/* Card 1: Liked Songs with Koda's Signature Scalloped Star Badge */}
          <div
            onClick={() => {
              if (onOpenPlaylist) {
                onOpenPlaylist({
                  id: 'playlist_LM',
                  title: 'Liked songs',
                  subtitle: `${likedTracks.length} songs`
                });
              }
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'transform 200ms ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <div
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                borderRadius: '26px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                position: 'relative'
              }}
            >
              {/* Die-Cut Softburst Star Cookie Badge */}
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
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '30px', fontVariationSettings: "'FILL' 1" }}>
                  favorite
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                Liked songs
              </span>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--md-sys-color-outline)', marginTop: '2px' }}>
                {likedTracks.length} songs
              </span>
            </div>
          </div>

          {/* Card 2: Your Likes / Radio */}
          <div
            onClick={() => {}}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'transform 200ms ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <div
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                borderRadius: '26px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '36px', color: 'var(--md-sys-color-outline)' }}>
                queue_music
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                Your Likes
              </span>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--md-sys-color-outline)', marginTop: '2px' }}>
                You
              </span>
            </div>
          </div>

          {/* User Playlists from YouTube Music (with 4-grid collages or cover art) */}
          {userPlaylists.slice(0, 6).map((pl) => (
            <div
              key={pl.id}
              onClick={() => onOpenPlaylist?.({ id: pl.id, title: pl.title, subtitle: pl.subtitle, imageUrl: pl.imageUrl })}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'transform 200ms ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  borderRadius: '26px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--md-sys-color-surface-container-high)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
                }}
              >
                <img
                  src={sizedArtwork(pl.imageUrl, 400)}
                  alt={pl.title}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--md-sys-color-on-surface)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {pl.title}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--md-sys-color-outline)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: '2px'
                  }}
                >
                  {pl.subtitle || 'Playlist'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Your Top Artists Rail WITH REAL ARTIST PHOTOS (Matching Koda Screenshot) */}
      {topArtists.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2
              style={{
                fontSize: '22px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                margin: 0,
                color: 'var(--md-sys-color-on-surface)'
              }}
            >
              Your top artists
            </h2>
          </div>

          <div
            style={{
              display: 'flex',
              gap: isWideScreen ? '32px' : '20px',
              overflowX: 'auto',
              paddingBottom: '12px',
              scrollbarWidth: 'none'
            }}
          >
            {topArtists.map((artist, idx) => {
              const photo = artistPhotoService.getCachedPhoto(artist.name);
              return (
                <div
                  key={`${artist.name}-${idx}`}
                  onClick={() => onOpenArtist?.({ name: artist.name, imageUrl: photo || undefined })}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    textAlign: 'center',
                    flexShrink: 0,
                    width: isWideScreen ? '110px' : '90px',
                    transition: 'transform 200ms ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {/* Organic Scalloped Flower / Cookie Shape Photo Mask (Matching Koda) */}
                  <div
                    style={{
                      width: isWideScreen ? '100px' : '82px',
                      height: isWideScreen ? '100px' : '82px',
                      clipPath: SHAPES.cookie9Sided,
                      backgroundColor: 'var(--md-sys-color-primary-container, rgba(255, 255, 255, 0.12))',
                      color: 'var(--md-sys-color-on-primary-container, var(--md-sys-color-on-surface))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                      overflow: 'hidden'
                    }}
                  >
                    {photo ? (
                      <img
                        src={photo}
                        alt={artist.name}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: isWideScreen ? '36px' : '28px', fontWeight: 900 }}>
                        {artist.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--md-sys-color-on-surface)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '100%'
                      }}
                    >
                      {artist.name}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        color: 'var(--md-sys-color-outline)',
                        marginTop: '2px'
                      }}
                    >
                      {artist.plays} {artist.plays === 1 ? 'play' : 'plays'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. Jump Back In Section */}
      {jumpBackInTracks.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2
              style={{
                fontSize: '22px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                margin: 0,
                color: 'var(--md-sys-color-on-surface)'
              }}
            >
              Jump back in
            </h2>
            <button
              onClick={() => playTrack(jumpBackInTracks[0], jumpBackInTracks)}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--md-sys-color-on-surface)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Play all"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                arrow_forward
              </span>
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isWideScreen
                ? 'repeat(auto-fill, minmax(200px, 1fr))'
                : 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: isWideScreen ? '20px' : '14px'
            }}
          >
            {jumpBackInTracks.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                onClick={() => playTrack(item, jumpBackInTracks)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'transform 200ms ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: '26px',
                    overflow: 'hidden',
                    backgroundColor: 'var(--md-sys-color-surface-container-high)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
                  }}
                >
                  <img
                    src={sizedArtwork(item.highResThumbnailUrl || item.thumbnailUrl, 500)}
                    alt={item.title}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--md-sys-color-on-surface)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {item.title}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--md-sys-color-outline)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: '2px'
                    }}
                  >
                    {item.artist}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Loading state indicator */}
      {loading && sections.length === 0 && (
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
          <span className="material-symbols-rounded" style={{ animation: 'spin 1s linear infinite', fontSize: '32px' }}>
            progress_activity
          </span>
          <span>Loading recommendations...</span>
        </div>
      )}

      {/* 7. Additional Personalized Shelves from YouTube Music */}
      {sections.slice(2).map((section, sIdx) => (
        <section key={sIdx} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2
              style={{
                fontSize: '22px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                margin: 0,
                color: 'var(--md-sys-color-on-surface)'
              }}
            >
              {section.title}
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isWideScreen
                ? 'repeat(auto-fill, minmax(200px, 1fr))'
                : 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: isWideScreen ? '20px' : '14px'
            }}
          >
            {section.items.map((item, tIdx) => (
              <MediaCard
                key={`${item.id}-${tIdx}`}
                id={item.id}
                title={item.title}
                subtitle={item.artist}
                imageUrl={item.thumbnailUrl}
                isPlaylist={item.id.startsWith('playlist_')}
                onClick={() => handleCardClick(item, section.items)}
                onPlay={() => handleCardClick(item, section.items)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
