import React, { useEffect, useState, useMemo, useRef } from 'react';
import { innertubeService, HomeSection, UserPlaylist, isLikelyNonMusicVideo } from '../api/innertubeService';
import { usePlayerStore } from '../store/playerStore';
import { useTasteStore } from '../store/tasteStore';
import { useSettingsStore } from '../store/settingsStore';
import { bridgeClient } from '../api/bridgeClient';
import { TrackMetadata } from '../types';
import { artistPhotoService } from '../api/artistPhotoService';
import { sizedArtwork, handleArtworkError } from '../api/artworkService';
import { YourMixHero } from '../components/home/YourMixHero';
import {
  SHAPES,
  MediaCard,
  M3LoadingIndicator
} from '../design-system';

export interface HomePageProps {
  onOpenPlaylist?: (playlist: { id: string; title: string; subtitle?: string; imageUrl?: string; author?: string }) => void;
  onOpenArtist?: (artist: { id?: string; name: string; imageUrl?: string }) => void;
}

const ScrollNavButtons: React.FC<{
  scrollRef: React.RefObject<HTMLDivElement | null>;
  extraAction?: React.ReactNode;
}> = ({ scrollRef, extraAction }) => {
  const scrollByAmount = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const offset = Math.max(300, Math.round(el.clientWidth * 0.72));
    el.scrollBy({ left: dir === 'left' ? -offset : offset, behavior: 'smooth' });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {extraAction}
      <button
        type="button"
        onClick={() => scrollByAmount('left')}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: 'var(--md-sys-color-surface-container)',
          color: 'var(--md-sys-color-on-surface)',
          border: '1px solid var(--md-sys-color-outline-variant)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 150ms ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high)';
          e.currentTarget.style.transform = 'scale(1.06)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Scroll left"
      >
        <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
          chevron_left
        </span>
      </button>
      <button
        type="button"
        onClick={() => scrollByAmount('right')}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: 'var(--md-sys-color-surface-container)',
          color: 'var(--md-sys-color-on-surface)',
          border: '1px solid var(--md-sys-color-outline-variant)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 150ms ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high)';
          e.currentTarget.style.transform = 'scale(1.06)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Scroll right"
      >
        <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
          chevron_right
        </span>
      </button>
    </div>
  );
};

export const HomePage: React.FC<HomePageProps> = ({ onOpenPlaylist, onOpenArtist }) => {
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [remoteHistory, setRemoteHistory] = useState<TrackMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredQuickId, setHoveredQuickId] = useState<string | null>(null);
  const [hoveredRecentId, setHoveredRecentId] = useState<string | null>(null);
  const [hoveredAlbumId, setHoveredAlbumId] = useState<string | null>(null);
  const [hoveredArtistIdx, setHoveredArtistIdx] = useState<number | null>(null);

  const [isWideScreen, setIsWideScreen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );
  const [, setPhotoVersion] = useState(0);

  const recentRailRef = useRef<HTMLDivElement>(null);
  const albumsRailRef = useRef<HTMLDivElement>(null);
  const artistsRailRef = useRef<HTMLDivElement>(null);

  const { playTrack, currentTrack, isPlaying, togglePlay, addToQueue } = usePlayerStore();
  const { history, likedTracks, isLiked, toggleLikeTrack, savedPlaylists } = useTasteStore();
  const { homeLayoutMode, filterExplicit } = useSettingsStore();

  const rawSections = sections;
  const filteredSections = useMemo(() => {
    if (!filterExplicit) return rawSections;
    return rawSections
      .map((s) => ({
        ...s,
        items: s.items.filter((item) => !item.isExplicit)
      }))
      .filter((s) => s.items.length > 0);
  }, [rawSections, filterExplicit]);

  const loadFeed = () => {
    setLoading(true);
    setLoadingPlaylists(true);
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
      .then((pls) => {
        setUserPlaylists(pls);
        setLoadingPlaylists(false);
      })
      .catch(() => {
        setLoadingPlaylists(false);
      });

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

    const unsubAccount = bridgeClient.onAccountChange(() => {
      loadFeed();
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubPhotos();
      unsubBridge();
      unsubAccount();
    };
  }, []);

  // Derive Top Artists from playback history (with fallback to quick-pick artists)
  const topArtists = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of history) {
      if (isLikelyNonMusicVideo(h)) continue;
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
  const { mixTracks, isPersonalMix } = useMemo(() => {
    const personalTracks: TrackMetadata[] = [];
    const seenIds = new Set<string>();

    // 1. YouTube Music authentic server-personalized mix / shelf
    const supermixShelf = filteredSections.find((s) =>
      /mixed for you|my supermix|your mix/i.test(s.title)
    );
    const listenAgainShelf = filteredSections.find((s) =>
      /listen again|quick picks|favorites|similar to|from your/i.test(s.title)
    );
    const personalizedShelf = supermixShelf || listenAgainShelf;
    if (personalizedShelf) {
      for (const item of personalizedShelf.items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          personalTracks.push(item);
        }
      }
    }

    // 2. Tracks user has liked on this active account
    for (const track of likedTracks) {
      if (!seenIds.has(track.id)) {
        seenIds.add(track.id);
        personalTracks.push(track);
      }
    }

    // 3. Tracks user has played in history on this active account
    for (const h of history) {
      if (!seenIds.has(h.trackId)) {
        seenIds.add(h.trackId);
        const found =
          filteredSections.flatMap((s) => s.items).find((i) => i.id === h.trackId) ||
          likedTracks.find((l) => l.id === h.trackId);
        if (found) {
          personalTracks.push(found);
        }
      }
    }

    if (personalTracks.length >= 3) {
      return { mixTracks: personalTracks.slice(0, 12), isPersonalMix: true };
    }

    if (filteredSections.length > 0) {
      return { mixTracks: filteredSections[0].items.slice(0, 12), isPersonalMix: false };
    }

    return { mixTracks: [], isPersonalMix: false };
  }, [likedTracks, history, filteredSections]);

  // Derive authentic Recently Played songs (merging local playback history with remote YouTube history)
  const recentlyPlayed = useMemo(() => {
    const list: TrackMetadata[] = [];
    const seenIds = new Set<string>();

    // 1. Local playback history (newest first, strictly music tracks)
    for (const h of history) {
      if (!h.trackId || seenIds.has(h.trackId) || isLikelyNonMusicVideo(h)) continue;
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
        highResThumbnailUrl: sizedArtwork(thumb, 544)
      });
    }

    // 2. YouTube Music remote listening history (strictly music tracks)
    for (const r of remoteHistory) {
      if (!r.id || seenIds.has(r.id) || isLikelyNonMusicVideo(r)) continue;
      seenIds.add(r.id);
      list.push(r);
    }

    return list.slice(0, 24);
  }, [history, remoteHistory]);

  // Derive 6-Tile Quick Dial Bento Grid items (combining recent favorites, liked tracks & top recommendations)
  const quickDialItems = useMemo(() => {
    const items: TrackMetadata[] = [];
    const seen = new Set<string>();

    for (const r of recentlyPlayed) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        items.push(r);
        if (items.length >= 3) break;
      }
    }

    for (const l of likedTracks) {
      if (!seen.has(l.id)) {
        seen.add(l.id);
        items.push(l);
        if (items.length >= 6) break;
      }
    }

    for (const m of mixTracks) {
      if (items.length >= 6) break;
      if (!seen.has(m.id)) {
        seen.add(m.id);
        items.push(m);
      }
    }

    return items.slice(0, 6);
  }, [recentlyPlayed, likedTracks, mixTracks]);

  // Merge userPlaylists + savedPlaylists from tasteStore
  const combinedPlaylists = useMemo(() => {
    const seen = new Set(userPlaylists.map((p) => p.id.replace(/^playlist_/, '')));
    const merged: UserPlaylist[] = [...userPlaylists];
    for (const sp of savedPlaylists) {
      const cleanId = sp.id.replace(/^playlist_/, '');
      if (!seen.has(cleanId)) {
        seen.add(cleanId);
        merged.unshift({
          id: sp.id,
          title: sp.title,
          subtitle: sp.subtitle || 'Saved Playlist',
          imageUrl: sp.thumbnailUrl || '',
          author: sp.subtitle || 'Saved',
          trackCount: sp.trackCount
        });
      }
    }
    return merged;
  }, [userPlaylists, savedPlaylists]);

  // Extract recent albums / collections from shelves (only authentic album/collection shelves or square-artwork items)
  const recentAlbums = useMemo(() => {
    for (const s of filteredSections) {
      if (/album|release|record|collection|single/i.test(s.title)) {
        const musicOnly = s.items.filter((i) => !isLikelyNonMusicVideo(i));
        if (musicOnly.length >= 3) return musicOnly.slice(0, 10);
      }
    }
    // Fallback: gather tracks across shelves that have square album artwork (googleusercontent.com)
    const squareAlbumItems = filteredSections
      .flatMap((s) => s.items)
      .filter(
        (item, idx, arr) =>
          !isLikelyNonMusicVideo(item) &&
          (item.thumbnailUrl || '').includes('googleusercontent.com') &&
          arr.findIndex((x) => x.id === item.id) === idx
      );
    return squareAlbumItems.length >= 3 ? squareAlbumItems.slice(0, 10) : [];
  }, [filteredSections]);

  // Extract tracks for "Jump back in"
  const jumpBackInTracks = useMemo(() => {
    if (filteredSections.length > 0) {
      const lastSection = filteredSections[filteredSections.length - 1];
      if (lastSection.items.length > 0) return lastSection.items.slice(0, 8);
    }
    return filterExplicit ? mixTracks.filter((t) => !t.isExplicit).slice(0, 8) : mixTracks.slice(0, 8);
  }, [filteredSections, mixTracks, filterExplicit]);

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

  // Top 3 covers for the Fanned Liked Songs Bento Card
  const fanCovers = useMemo(() => {
    const pool = likedTracks.length > 0 ? likedTracks : recentlyPlayed;
    return pool.slice(0, 3).map((t) => sizedArtwork(t.thumbnailUrl, 226));
  }, [likedTracks, recentlyPlayed]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '34px',
        paddingBottom: '140px',
        maxWidth: '1480px',
        margin: '0 auto',
        width: '100%'
      }}
    >
      {/* 1. Signature M3 Expressive "Your Mix" Contained Ambient Stage (Spotlight Mode) */}
      {mixTracks.length > 0 && homeLayoutMode === 'spotlight' && (
        <YourMixHero
          tracks={filterExplicit ? mixTracks.filter((t) => !t.isExplicit) : mixTracks}
          title={isPersonalMix ? 'Your\nMix' : 'Discover\nMix'}
          onPlayMix={(t) => playTrack(t[0], t)}
          onTrackClick={(t) => playTrack(t, mixTracks)}
          isWideScreen={isWideScreen}
        />
      )}

      {/* 1B. Quick Dial 6-Tile Speed-Dial Bento Grid */}
      {quickDialItems.length >= 3 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className="material-symbols-rounded filled"
                style={{ fontSize: '20px', color: 'var(--md-sys-color-primary)' }}
              >
                bolt
              </span>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  letterSpacing: '-0.015em',
                  margin: 0,
                  color: 'var(--md-sys-color-on-surface)'
                }}
              >
                Quick Dial
              </h2>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--md-sys-color-on-surface-variant)' }}>
              Instant 1-tap playback
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isWideScreen
                ? 'repeat(3, minmax(0, 1fr))'
                : 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '12px'
            }}
          >
            {quickDialItems.map((item, qIdx) => {
              const isItemPlaying = currentTrack?.id === item.id && isPlaying;
              const isHovered = hoveredQuickId === item.id;
              const liked = isLiked(item.id);

              return (
                <div
                  key={`quick-${item.id}-${qIdx}`}
                  onMouseEnter={() => setHoveredQuickId(item.id)}
                  onMouseLeave={() => setHoveredQuickId(null)}
                  onClick={() => {
                    if (currentTrack?.id === item.id) {
                      togglePlay();
                    } else {
                      playTrack(item, quickDialItems);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '8px 14px 8px 8px',
                    borderRadius: isHovered || isItemPlaying ? '22px' : '16px',
                    backgroundColor: isItemPlaying
                      ? 'var(--md-sys-color-secondary-container)'
                      : isHovered
                      ? 'var(--md-sys-color-surface-container-high)'
                      : 'var(--md-sys-color-surface-container)',
                    border: isItemPlaying
                      ? '1px solid var(--md-sys-color-primary)'
                      : '1px solid var(--md-sys-color-outline-variant)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                    transition:
                      'border-radius 280ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 180ms ease, transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                    animation: `m3CardCascade 300ms var(--m3-ease-emphasized-decelerate) ${qIdx * 35}ms both`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        position: 'relative',
                        width: '52px',
                        height: '52px',
                        clipPath: isHovered || isItemPlaying ? SHAPES.scallop12 : undefined,
                        borderRadius: isHovered || isItemPlaying ? '50%' : '12px',
                        overflow: 'hidden',
                        flexShrink: 0,
                        backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                        transition: 'border-radius 300ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                      }}
                    >
                      <img
                        src={sizedArtwork(item.thumbnailUrl, 120)}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleArtworkError(e, item.thumbnailUrl)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 750,
                          color: isItemPlaying
                            ? 'var(--md-sys-color-on-secondary-container)'
                            : 'var(--md-sys-color-on-surface)',
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
                          color: 'var(--md-sys-color-on-surface-variant)',
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

                  {/* Right Quick Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {(isHovered || liked) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLikeTrack(item);
                        }}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: liked
                            ? 'var(--md-sys-color-primary)'
                            : 'var(--md-sys-color-on-surface-variant)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        title={liked ? 'Unlike' : 'Like'}
                      >
                        <span
                          className={`material-symbols-rounded ${liked ? 'filled' : ''}`}
                          style={{
                            fontSize: '18px',
                            animation: liked ? 'm3HeartBurst 380ms cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
                          }}
                        >
                          favorite
                        </span>
                      </button>
                    )}

                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor:
                          isItemPlaying || isHovered
                            ? 'var(--md-sys-color-primary)'
                            : 'var(--md-sys-color-surface-container-highest)',
                        color:
                          isItemPlaying || isHovered
                            ? 'var(--md-sys-color-on-primary)'
                            : 'var(--md-sys-color-on-surface-variant)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                        transform: isHovered ? 'scale(1.06)' : 'scale(1)'
                      }}
                    >
                      <span className="material-symbols-rounded filled" style={{ fontSize: '20px' }}>
                        {isItemPlaying ? 'pause' : 'play_arrow'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 2. Recently Played Songs Shelf with Carousel Chevrons & Hover Micro-Actions */}
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
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--md-sys-color-on-surface-variant)',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {recentlyPlayed.length} songs
              </span>
            </div>

            <ScrollNavButtons scrollRef={recentRailRef} />
          </div>

          <div
            ref={recentRailRef}
            style={{
              display: 'flex',
              gap: isWideScreen ? '18px' : '14px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              margin: '0 -4px',
              padding: '4px 4px 10px 4px'
            }}
          >
            {recentlyPlayed.map((track, rIdx) => {
              const isThisPlaying = currentTrack?.id === track.id && isPlaying;
              const isHovered = hoveredRecentId === track.id;
              const liked = isLiked(track.id);

              return (
                <div
                  key={track.id}
                  onMouseEnter={() => setHoveredRecentId(track.id)}
                  onMouseLeave={() => setHoveredRecentId(null)}
                  onClick={() => playTrack(track, recentlyPlayed)}
                  style={{
                    flex: '0 0 auto',
                    width: isWideScreen ? '174px' : '140px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    animation: `m3CardCascade 340ms var(--m3-ease-emphasized-decelerate) ${Math.min(rIdx * 35, 350)}ms both`,
                    transform: isHovered ? 'translateY(-5px)' : 'translateY(0)',
                    transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  {/* Artwork Container with M3 Shape Morph */}
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '1/1',
                      borderRadius: isHovered || isThisPlaying ? '28px' : '18px',
                      overflow: 'hidden',
                      backgroundColor: 'var(--md-sys-color-surface-container)',
                      boxShadow: isHovered
                        ? '0 12px 28px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.25))'
                        : '0 4px 16px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.12))',
                      transition:
                        'border-radius 320ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 220ms ease'
                    }}
                  >
                    <img
                      src={sizedArtwork(track.thumbnailUrl || track.highResThumbnailUrl, 300)}
                      alt={track.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => handleArtworkError(e, track.thumbnailUrl)}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        transform: isHovered ? 'scale(1.06)' : 'scale(1)',
                        transition: 'transform 380ms cubic-bezier(0.2, 0, 0, 1)'
                      }}
                    />

                    {/* Top-Right Hover Heart & Queue Buttons */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        display: 'flex',
                        gap: '6px',
                        opacity: isHovered || liked ? 1 : 0,
                        transform: isHovered || liked ? 'translateY(0)' : 'translateY(-4px)',
                        transition: 'all 180ms ease',
                        zIndex: 3
                      }}
                    >
                      {isHovered && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToQueue(track);
                          }}
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(17, 19, 24, 0.72)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255,255,255,0.14)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          title="Add to queue"
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                            queue_music
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLikeTrack(track);
                        }}
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(17, 19, 24, 0.72)',
                          backdropFilter: 'blur(8px)',
                          border: '1px solid rgba(255,255,255,0.14)',
                          color: liked ? 'var(--md-sys-color-primary)' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        title={liked ? 'Unlike' : 'Like'}
                      >
                        <span
                          className={`material-symbols-rounded ${liked ? 'filled' : ''}`}
                          style={{
                            fontSize: '16px',
                            animation: liked ? 'm3HeartBurst 380ms cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
                          }}
                        >
                          favorite
                        </span>
                      </button>
                    </div>

                    {/* Bottom-Right Hover Play FAB */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '10px',
                        right: '10px',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--md-sys-color-primary)',
                        color: 'var(--md-sys-color-on-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4)',
                        opacity: isHovered || isThisPlaying ? 1 : 0,
                        transform: isHovered || isThisPlaying ? 'scale(1)' : 'scale(0.75) translateY(6px)',
                        transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                        zIndex: 3
                      }}
                    >
                      <span className="material-symbols-rounded filled" style={{ fontSize: '22px' }}>
                        {isThisPlaying ? 'graphic_eq' : 'play_arrow'}
                      </span>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span
                      style={{
                        fontSize: isWideScreen ? '14px' : '13px',
                        fontWeight: 700,
                        color: isThisPlaying
                          ? 'var(--md-sys-color-primary)'
                          : 'var(--md-sys-color-on-surface)',
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
                        color: 'var(--md-sys-color-on-surface-variant)',
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

      {/* 3. Recent Albums Section with Carousel Chevrons & Hover Play FAB */}
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
            <ScrollNavButtons scrollRef={albumsRailRef} />
          </div>

          <div
            ref={albumsRailRef}
            style={{
              display: 'flex',
              gap: isWideScreen ? '18px' : '14px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              padding: '4px 0 10px 0'
            }}
          >
            {recentAlbums.map((item, idx) => {
              const isHovered = hoveredAlbumId === `${item.id}-${idx}`;
              return (
                <div
                  key={`${item.id}-${idx}`}
                  onMouseEnter={() => setHoveredAlbumId(`${item.id}-${idx}`)}
                  onMouseLeave={() => setHoveredAlbumId(null)}
                  onClick={() => handleCardClick(item, recentAlbums)}
                  style={{
                    flex: '0 0 auto',
                    width: isWideScreen ? '174px' : '140px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transform: isHovered ? 'translateY(-5px)' : 'translateY(0)',
                    transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      borderRadius: isHovered ? '28px' : '20px',
                      overflow: 'hidden',
                      backgroundColor: 'var(--md-sys-color-surface-container-high)',
                      boxShadow: isHovered
                        ? '0 14px 30px rgba(0, 0, 0, 0.36)'
                        : '0 8px 24px rgba(0, 0, 0, 0.25)',
                      position: 'relative',
                      transition: 'border-radius 320ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 220ms ease'
                    }}
                  >
                    <img
                      src={sizedArtwork(item.thumbnailUrl || item.highResThumbnailUrl, 300)}
                      alt={item.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => handleArtworkError(e, item.thumbnailUrl)}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: isHovered ? 'scale(1.06)' : 'scale(1)',
                        transition: 'transform 380ms cubic-bezier(0.2, 0, 0, 1)'
                      }}
                    />

                    {/* Hover Play FAB */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '10px',
                        right: '10px',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--md-sys-color-primary)',
                        color: 'var(--md-sys-color-on-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.45)',
                        opacity: isHovered ? 1 : 0,
                        transform: isHovered ? 'scale(1)' : 'scale(0.75) translateY(6px)',
                        transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                      }}
                    >
                      <span className="material-symbols-rounded filled" style={{ fontSize: '22px' }}>
                        play_arrow
                      </span>
                    </div>
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
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Your Playlists Section (With 3-Cover Fanned Bento Cards) */}
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
              backgroundColor: 'var(--md-sys-color-surface-container)',
              color: 'var(--md-sys-color-on-surface)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 150ms ease'
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
              : 'repeat(auto-fill, minmax(145px, 1fr))',
            gap: isWideScreen ? '20px' : '14px'
          }}
        >
          {/* Card 1: Liked Songs with 3-Cover Fanned Artwork Stack & Softburst Star Badge */}
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
              transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-5px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <div
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                borderRadius: '26px',
                background:
                  'linear-gradient(145deg, var(--md-sys-color-primary-container) 0%, var(--md-sys-color-surface-container-high) 100%)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.14))',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Fanned 3-Cover Artwork Stack Behind Badge */}
              {fanCovers.map((cover, cIdx) => {
                const angles = [-14, 0, 14];
                const offsets = [-22, 0, 22];
                return (
                  <img
                    key={cIdx}
                    src={cover}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={(e) => handleArtworkError(e, cover)}
                    style={{
                      position: 'absolute',
                      width: '52%',
                      height: '52%',
                      borderRadius: '14px',
                      objectFit: 'cover',
                      opacity: 0.42,
                      boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
                      transform: `translateX(${offsets[cIdx] || 0}px) rotate(${angles[cIdx] || 0}deg)`
                    }}
                  />
                );
              })}

              {/* Die-Cut Softburst Star Cookie Badge */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  width: '66px',
                  height: '66px',
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  clipPath: SHAPES.softBurst,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                }}
              >
                <span className="material-symbols-rounded filled" style={{ fontSize: '30px' }}>
                  favorite
                </span>
              </div>

              {/* Count Badge */}
              <span
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '12px',
                  zIndex: 2,
                  padding: '3px 9px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(17, 19, 24, 0.68)',
                  backdropFilter: 'blur(8px)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#ffffff',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {likedTracks.length} songs
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                Liked songs
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--md-sys-color-on-surface-variant)',
                  marginTop: '2px',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {likedTracks.length} songs • Auto-synced
              </span>
            </div>
          </div>

          {/* Card 2: Instant Personal Radio / Mix */}
          <div
            onClick={() => {
              if (mixTracks.length > 0) {
                playTrack(mixTracks[0], mixTracks);
              } else if (onOpenPlaylist) {
                onOpenPlaylist({
                  id: 'playlist_LM',
                  title: 'Your Likes',
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
              transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-5px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <div
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                borderRadius: '26px',
                background:
                  'linear-gradient(145deg, var(--md-sys-color-tertiary-container) 0%, var(--md-sys-color-surface-container-high) 100%)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.14))',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: '66px',
                  height: '66px',
                  backgroundColor: 'var(--md-sys-color-tertiary)',
                  color: 'var(--md-sys-color-on-tertiary)',
                  clipPath: SHAPES.scallop12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span className="material-symbols-rounded filled" style={{ fontSize: '30px' }}>
                  radio
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                My Supermix Radio
              </span>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--md-sys-color-on-surface-variant)', marginTop: '2px' }}>
                Continuous station
              </span>
            </div>
          </div>

          {/* Skeletons while loading playlists */}
          {loadingPlaylists && combinedPlaylists.length === 0 && (
            <>
              {[0, 1].map((idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      borderRadius: '26px',
                      backgroundColor: 'var(--md-sys-color-surface-container-high, rgba(255, 255, 255, 0.05))',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div className="m3-shimmer" />
                  </div>
                  <div
                    style={{
                      width: '70%',
                      height: '14px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--md-sys-color-surface-container-high, rgba(255, 255, 255, 0.05))'
                    }}
                  />
                </div>
              ))}
            </>
          )}

          {/* User Playlists from YouTube Music + Saved Playlists */}
          {combinedPlaylists.slice(0, 6).map((pl, plIdx) => (
            <MediaCard
              key={pl.id}
              id={pl.id}
              index={plIdx}
              title={pl.title}
              subtitle={pl.subtitle || 'Playlist'}
              imageUrl={pl.imageUrl}
              isPlaylist={true}
              onClick={() =>
                onOpenPlaylist?.({
                  id: pl.id,
                  title: pl.title,
                  subtitle: pl.subtitle,
                  imageUrl: pl.imageUrl,
                  author: pl.author
                })
              }
              onPlay={async () => {
                const tracks = await innertubeService.resolvePlaylistTracks(pl.id);
                if (tracks.length > 0) {
                  playTrack(tracks[0], tracks);
                }
              }}
            />
          ))}
        </div>
      </section>

      {/* 5. Your Top Artists Rail WITH REAL ARTIST PHOTOS, RANK BADGES & HOVER PLAY MIX */}
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
            <ScrollNavButtons scrollRef={artistsRailRef} />
          </div>

          <div
            ref={artistsRailRef}
            style={{
              display: 'flex',
              gap: isWideScreen ? '28px' : '18px',
              overflowX: 'auto',
              padding: '6px 4px 12px 4px',
              scrollbarWidth: 'none'
            }}
          >
            {topArtists.map((artist, idx) => {
              const photo = artistPhotoService.getCachedPhoto(artist.name);
              const isHovered = hoveredArtistIdx === idx;
              return (
                <div
                  key={`${artist.name}-${idx}`}
                  onMouseEnter={() => setHoveredArtistIdx(idx)}
                  onMouseLeave={() => setHoveredArtistIdx(null)}
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
                    width: isWideScreen ? '114px' : '92px',
                    transform: isHovered ? 'translateY(-4px) scale(1.04)' : 'scale(1)',
                    transition: 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                    position: 'relative'
                  }}
                >
                  {/* Rank Badge for Top 3 */}
                  {idx < 3 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '0px',
                        left: '6px',
                        zIndex: 4,
                        padding: '2px 7px',
                        borderRadius: '9999px',
                        backgroundColor: 'var(--md-sys-color-tertiary-container)',
                        color: 'var(--md-sys-color-on-tertiary-container)',
                        fontSize: '10px',
                        fontWeight: 800,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      #{idx + 1}
                    </span>
                  )}

                  {/* Organic Scalloped 9-Sided Cookie Shape Photo Mask */}
                  <div
                    style={{
                      width: isWideScreen ? '102px' : '84px',
                      height: isWideScreen ? '102px' : '84px',
                      clipPath: isHovered ? SHAPES.scallop12 : SHAPES.cookie9Sided,
                      backgroundColor: 'var(--md-sys-color-primary-container)',
                      color: 'var(--md-sys-color-on-primary-container)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                      overflow: 'hidden',
                      position: 'relative',
                      transition: 'clip-path 300ms ease'
                    }}
                  >
                    {photo ? (
                      <img
                        src={photo}
                        alt={artist.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => handleArtworkError(e, photo)}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                          transition: 'transform 320ms ease'
                        }}
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
                        color: isHovered ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '100%',
                        transition: 'color 160ms ease'
                      }}
                    >
                      {artist.name}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        color: 'var(--md-sys-color-outline)',
                        marginTop: '2px',
                        fontVariantNumeric: 'tabular-nums'
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '9999px',
                backgroundColor: 'var(--md-sys-color-surface-container)',
                color: 'var(--md-sys-color-on-surface)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 160ms ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container)')}
              title="Play all"
            >
              <span className="material-symbols-rounded filled" style={{ fontSize: '16px', color: 'var(--md-sys-color-primary)' }}>
                play_arrow
              </span>
              <span>Play All</span>
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isWideScreen
                ? 'repeat(auto-fill, minmax(200px, 1fr))'
                : 'repeat(auto-fill, minmax(145px, 1fr))',
              gap: isWideScreen ? '20px' : '14px'
            }}
          >
            {jumpBackInTracks.map((item, idx) => (
              <MediaCard
                key={`${item.id}-${idx}`}
                id={item.id}
                index={idx}
                title={item.title}
                subtitle={item.artist}
                imageUrl={item.thumbnailUrl || item.highResThumbnailUrl || ''}
                isPlaying={currentTrack?.id === item.id && isPlaying}
                isLiked={isLiked(item.id)}
                onClick={() => playTrack(item, jumpBackInTracks)}
                onPlay={() => playTrack(item, jumpBackInTracks)}
                onToggleLike={() => toggleLikeTrack(item)}
                onQueue={() => addToQueue(item)}
              />
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
            minHeight: '340px'
          }}
        >
          <M3LoadingIndicator contained size="lg" message="Curating your personal mix & recommendations..." />
        </div>
      )}

      {/* 7. Additional Personalized Shelves from YouTube Music (plus first 2 shelves if in Classic Mode) */}
      {(homeLayoutMode === 'classic' ? filteredSections : filteredSections.slice(2)).map((section, sIdx) => (
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
                index={tIdx}
                title={item.title}
                subtitle={item.artist}
                imageUrl={item.thumbnailUrl}
                isPlaylist={item.id.startsWith('playlist_')}
                isPlaying={currentTrack?.id === item.id && isPlaying}
                isLiked={!item.id.startsWith('playlist_') ? isLiked(item.id) : undefined}
                onClick={() => handleCardClick(item, section.items)}
                onPlay={() => handleCardClick(item, section.items)}
                onToggleLike={!item.id.startsWith('playlist_') ? () => toggleLikeTrack(item) : undefined}
                onQueue={!item.id.startsWith('playlist_') ? () => addToQueue(item) : undefined}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
