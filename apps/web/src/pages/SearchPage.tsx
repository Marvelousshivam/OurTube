import React, { useState, useEffect, useMemo } from 'react';
import { innertubeService } from '../api/innertubeService';
import { usePlayerStore } from '../store/playerStore';
import { useTasteStore } from '../store/tasteStore';
import { TrackMetadata, SearchFilter } from '../types';
import { sizedArtwork, handleArtworkError } from '../api/artworkService';
import { artistPhotoService } from '../api/artistPhotoService';
import { SHAPES } from '../design-system/tokens';
import {
  COLOR_TOKENS,
  DSTrackRow,
  M3LoadingIndicator
} from '../design-system';

export interface SearchPageProps {
  onOpenPlaylist?: (playlist: { id: string; title: string; subtitle?: string; imageUrl?: string; author?: string }) => void;
  onOpenArtist?: (artist: { id?: string; name: string; imageUrl?: string }) => void;
}

const SEARCH_FILTERS: { id: SearchFilter['id']; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: 'all_inclusive' },
  { id: 'songs', label: 'Songs', icon: 'music_note' },
  { id: 'videos', label: 'Videos', icon: 'videocam' },
  { id: 'albums', label: 'Albums', icon: 'album' },
  { id: 'artists', label: 'Artists', icon: 'person' },
  { id: 'playlists', label: 'Playlists', icon: 'queue_music' }
];

const RECENT_SEARCHES_KEY = 'ourtube_recent_searches_v1';

function getSavedSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSearchQuery(query: string) {
  if (!query.trim()) return;
  const clean = query.trim();
  const current = getSavedSearches().filter((q) => q.toLowerCase() !== clean.toLowerCase());
  const updated = [clean, ...current].slice(0, 8);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

function removeSavedSearchQuery(query: string) {
  const updated = getSavedSearches().filter((q) => q !== query);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

function clearAllSavedSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

interface BrowseCategory {
  id: string;
  title: string;
  subtitle: string;
  query: string;
  gradient: string;
  icon: string;
}

const BROWSE_CATEGORIES: BrowseCategory[] = [
  {
    id: 'bollywood',
    title: 'Bollywood & Desi Hits',
    subtitle: 'Chartbusters & Evergreen Melodies',
    query: 'Bollywood Hits',
    gradient: 'linear-gradient(135deg, #b45309 0%, #dc2626 100%)',
    icon: 'music_note'
  },
  {
    id: 'pop',
    title: 'Pop & Global Dance',
    subtitle: 'Worldwide viral anthems',
    query: 'Global Pop Hits',
    gradient: 'linear-gradient(135deg, #4f46e5 0%, #c026d3 100%)',
    icon: 'celebration'
  },
  {
    id: 'hiphop',
    title: 'Hip-Hop & Rap',
    subtitle: 'Beats, bars & heavy 808s',
    query: 'Hip Hop Rap Hits',
    gradient: 'linear-gradient(135deg, #27272a 0%, #854d0e 100%)',
    icon: 'speaker'
  },
  {
    id: 'lofi',
    title: 'Lo-Fi & Chill',
    subtitle: 'Late night beats & study vibes',
    query: 'Lo-Fi Chill Beats',
    gradient: 'linear-gradient(135deg, #0f766e 0%, #1e3a8a 100%)',
    icon: 'bedtime'
  },
  {
    id: 'indie',
    title: 'Indie & Acoustic',
    subtitle: 'Raw storytelling & acoustic sets',
    query: 'Indie Acoustic',
    gradient: 'linear-gradient(135deg, #c2410c 0%, #4d7c0f 100%)',
    icon: 'piano'
  },
  {
    id: 'rock',
    title: 'Rock & Alternative',
    subtitle: 'Anthems, distortion & overdrive',
    query: 'Rock Alternative Classics',
    gradient: 'linear-gradient(135deg, #374151 0%, #991b1b 100%)',
    icon: 'electric_bolt'
  },
  {
    id: 'focus',
    title: 'Deep Focus & Ambient',
    subtitle: 'Zero distraction soundscapes',
    query: 'Ambient Study Music',
    gradient: 'linear-gradient(135deg, #1e293b 0%, #047857 100%)',
    icon: 'spa'
  },
  {
    id: 'workout',
    title: 'Workout High Energy',
    subtitle: 'Pure adrenaline & BPM boost',
    query: 'Workout Motivation Music',
    gradient: 'linear-gradient(135deg, #65a30d 0%, #ea580c 100%)',
    icon: 'fitness_center'
  },
  {
    id: 'rnb',
    title: 'Late Night R&B',
    subtitle: 'Smooth vocals & mellow grooves',
    query: 'Chill R&B Soul',
    gradient: 'linear-gradient(135deg, #581c87 0%, #0891b2 100%)',
    icon: 'nightlife'
  },
  {
    id: 'punjabi',
    title: 'Punjabi Power',
    subtitle: 'Bhangra, dhol & folk fusion',
    query: 'Punjabi Top Hits',
    gradient: 'linear-gradient(135deg, #ca8a04 0%, #e11d48 100%)',
    icon: 'stars'
  }
];

export const SearchPage: React.FC<SearchPageProps> = ({ onOpenPlaylist, onOpenArtist }) => {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<SearchFilter['id']>('all');
  const [results, setResults] = useState<TrackMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(getSavedSearches());
  const [isFocused, setIsFocused] = useState(false);
  const [, setPhotoTick] = useState(0);

  const { playTrack, currentTrack, isPlaying } = usePlayerStore();
  const { history, likedTracks, isLiked, toggleLikeTrack } = useTasteStore();

  // Subscribe to photo cache updates
  useEffect(() => {
    return artistPhotoService.subscribe(() => setPhotoTick((t) => t + 1));
  }, []);

  // Compute top listened artists from history & likes
  const topArtists = useMemo(() => {
    const counts: Record<string, number> = {};
    history.forEach((h) => {
      if (h.artist) counts[h.artist] = (counts[h.artist] || 0) + (h.playCount || 1);
    });
    likedTracks.forEach((t) => {
      if (t.artist) counts[t.artist] = (counts[t.artist] || 0) + 2;
    });

    const sorted = Object.entries(counts)
      .map(([name, playCount]) => ({ name, playCount }))
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 8);

    // Queue photo resolution for any uncached artists
    sorted.forEach((a) => {
      if (!artistPhotoService.getCachedPhoto(a.name)) {
        artistPhotoService.resolveArtistPhoto(a.name);
      }
    });

    return sorted;
  }, [history, likedTracks]);

  // Execute search when query or activeFilter changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      innertubeService
        .search(query, activeFilter)
        .then((res) => {
          setResults(res);
          setLoading(false);
          saveSearchQuery(query);
          setRecentSearches(getSavedSearches());
        })
        .catch(() => {
          setResults([]);
          setLoading(false);
        });
    }, 280);

    return () => clearTimeout(timer);
  }, [query, activeFilter]);

  const handleSelectQuery = (q: string) => {
    setQuery(q);
    saveSearchQuery(q);
    setRecentSearches(getSavedSearches());
  };

  const handleRemoveRecent = (e: React.MouseEvent, q: string) => {
    e.stopPropagation();
    removeSavedSearchQuery(q);
    setRecentSearches(getSavedSearches());
  };

  const handleClearAllRecents = () => {
    clearAllSavedSearches();
    setRecentSearches([]);
  };

  const topResult = results.length > 0 ? results[0] : null;
  const songResults = results.length > 1 ? results.slice(1) : [];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        paddingBottom: '140px',
        maxWidth: '1280px',
        margin: '0 auto',
        width: '100%'
      }}
    >
      {/* 1. M3 Expressive SearchBar & Category Filter Deck */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '0 20px',
            height: '56px',
            borderRadius: '28px',
            backgroundColor: 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.05))',
            border: `1.5px solid ${isFocused ? 'var(--md-sys-color-primary)' : 'rgba(255, 255, 255, 0.08)'}`,
            boxShadow: isFocused
              ? '0 0 0 3px rgba(var(--md-sys-color-primary-rgb), 0.2), 0 8px 24px rgba(0, 0, 0, 0.35)'
              : '0 4px 16px rgba(0, 0, 0, 0.2)',
            transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)',
            maxWidth: '720px',
            width: '100%'
          }}
        >
          <span
            className="material-symbols-rounded"
            style={{
              color: isFocused ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
              fontSize: '24px',
              transition: 'color 200ms ease'
            }}
          >
            search
          </span>

          <input
            type="text"
            placeholder="Search songs, artists, albums, or moods..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                saveSearchQuery(query);
                setRecentSearches(getSavedSearches());
              }
            }}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--md-sys-color-on-surface)',
              fontSize: '16px',
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontWeight: 500
            }}
          />

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px' }}>
              <M3LoadingIndicator size="sm" />
            </div>
          )}

          {query && !loading && (
            <button
              onClick={() => setQuery('')}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '50%',
                color: 'var(--md-sys-color-on-surface-variant)',
                cursor: 'pointer',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 150ms ease'
              }}
              title="Clear search"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.16)';
                e.currentTarget.style.color = 'var(--md-sys-color-on-surface)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = 'var(--md-sys-color-on-surface-variant)';
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                close
              </span>
            </button>
          )}
        </div>

        {/* Filter Pills (Always active and visible) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
            scrollbarWidth: 'none'
          }}
        >
          {SEARCH_FILTERS.map((f) => {
            const isSelected = activeFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 16px',
                  borderRadius: '9999px',
                  border: isSelected ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                  backgroundColor: isSelected
                    ? 'var(--md-sys-color-primary)'
                    : 'rgba(255, 255, 255, 0.05)',
                  color: isSelected
                    ? 'var(--md-sys-color-on-primary)'
                    : 'var(--md-sys-color-on-surface)',
                  fontSize: '13px',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 150ms cubic-bezier(0.2, 0, 0, 1)'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                  {f.icon}
                </span>
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Empty State: Expressive Discovery & Explore Hub */}
      {!query && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
          {/* A. Recent Searches (if available) */}
          {recentSearches.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    color: 'var(--md-sys-color-on-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '20px', color: 'var(--md-sys-color-primary)' }}>
                    history
                  </span>
                  Recent Searches
                </span>
                <button
                  onClick={handleClearAllRecents}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--md-sys-color-outline)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--md-sys-color-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--md-sys-color-outline)')}
                >
                  Clear all
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {recentSearches.map((item) => (
                  <div
                    key={item}
                    onClick={() => handleSelectQuery(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 14px',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: 'var(--md-sys-color-on-surface)',
                      fontSize: '13px',
                      fontWeight: 550,
                      cursor: 'pointer',
                      transition: 'all 150ms ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)')}
                  >
                    <span>{item}</span>
                    <span
                      onClick={(e) => handleRemoveRecent(e, item)}
                      className="material-symbols-rounded"
                      style={{
                        fontSize: '16px',
                        color: 'var(--md-sys-color-on-surface-variant)',
                        borderRadius: '50%',
                        padding: '2px'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--md-sys-color-error)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--md-sys-color-on-surface-variant)')}
                      title="Remove"
                    >
                      close
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* B. Artists to Explore (Authentic User Listening & Scalloped Masks) */}
          {topArtists.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--md-sys-color-on-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '22px', color: 'var(--md-sys-color-primary)' }}>
                  stars
                </span>
                Artists You Listen To
              </span>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  overflowX: 'auto',
                  paddingBottom: '8px',
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
                        gap: '8px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        flexShrink: 0,
                        width: '96px',
                        transition: 'transform 200ms ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      <div
                        style={{
                          width: '84px',
                          height: '84px',
                          clipPath: SHAPES.cookie9Sided,
                          backgroundColor: 'var(--md-sys-color-primary-container)',
                          color: 'var(--md-sys-color-on-primary-container)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
                          overflow: 'hidden'
                        }}
                      >
                        {photo ? (
                          <img
                            src={photo}
                            alt={artist.name}
                            referrerPolicy="no-referrer"
                            onError={(e) => handleArtworkError(e, '')}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <span style={{ fontSize: '28px', fontWeight: 800 }}>
                            {artist.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 650,
                          color: 'var(--md-sys-color-on-surface)',
                          width: '100%',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {artist.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* C. Browse All Genres & Moods (Bento Grid) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <h2
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--md-sys-color-on-surface)',
                  margin: '0 0 4px 0'
                }}
              >
                Browse Genres & Moods
              </h2>
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--md-sys-color-on-surface-variant)',
                  margin: 0
                }}
              >
                Pick a vibe to explore curated soundscapes and top tracks
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '16px',
                width: '100%'
              }}
            >
              {BROWSE_CATEGORIES.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => handleSelectQuery(cat.query)}
                  style={{
                    position: 'relative',
                    height: '130px',
                    borderRadius: '24px',
                    background: cat.gradient,
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)',
                    transition: 'transform 180ms cubic-bezier(0.2, 0, 0, 1), box-shadow 180ms ease',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.45)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
                  }}
                >
                  {/* Subtle Background Watermark Icon */}
                  <span
                    className="material-symbols-rounded"
                    style={{
                      position: 'absolute',
                      right: '-10px',
                      bottom: '-14px',
                      fontSize: '92px',
                      opacity: 0.16,
                      color: '#ffffff',
                      pointerEvents: 'none',
                      transform: 'rotate(15deg)'
                    }}
                  >
                    {cat.icon}
                  </span>

                  {/* Foreground Content */}
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <h3
                      style={{
                        fontSize: '17px',
                        fontWeight: 800,
                        color: '#ffffff',
                        margin: '0 0 4px 0',
                        textShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
                      }}
                    >
                      {cat.title}
                    </h3>
                    <p
                      style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'rgba(255, 255, 255, 0.85)',
                        margin: 0,
                        textShadow: '0 1px 4px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      {cat.subtitle}
                    </p>
                  </div>

                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: '#ffffff',
                        backgroundColor: 'rgba(0, 0, 0, 0.25)',
                        padding: '3px 8px',
                        borderRadius: '9999px',
                        backdropFilter: 'blur(8px)'
                      }}
                    >
                      Explore
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Search Results State (When Query Is Present) */}
      {query && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Active Search Loading State */}
          {loading && results.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '260px' }}>
              <M3LoadingIndicator contained size="lg" message={`Searching for "${query}"...`} />
            </div>
          )}

          {/* Top Result Bento Card */}
          {topResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--md-sys-color-on-surface)'
                }}
              >
                Top Match
              </span>

              <div
                onClick={() => {
                  if (topResult.id.startsWith('UC') || topResult.id.startsWith('artist_')) {
                    onOpenArtist?.({
                      id: topResult.id,
                      name: topResult.title,
                      imageUrl: topResult.thumbnailUrl
                    });
                  } else if (topResult.id.startsWith('playlist_')) {
                    onOpenPlaylist?.({
                      id: topResult.id,
                      title: topResult.title,
                      subtitle: topResult.artist,
                      imageUrl: topResult.thumbnailUrl
                    });
                  } else {
                    playTrack(topResult);
                  }
                }}
                style={{
                  maxWidth: '560px',
                  padding: '24px',
                  borderRadius: '28px',
                  backgroundColor: 'var(--md-sys-color-primary-container)',
                  color: 'var(--md-sys-color-on-primary-container)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  cursor: 'pointer',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform 180ms ease, box-shadow 180ms ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 16px 40px rgba(0, 0, 0, 0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.35)';
                }}
              >
                <div
                  style={{
                    width: '108px',
                    height: '108px',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    flexShrink: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)'
                  }}
                >
                  <img
                    src={sizedArtwork(topResult.thumbnailUrl, 240)}
                    alt={topResult.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleArtworkError(e, topResult.thumbnailUrl)}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      opacity: 0.8
                    }}
                  >
                    Top Result
                  </span>
                  <h2
                    style={{
                      fontSize: '22px',
                      fontWeight: 850,
                      margin: 0,
                      letterSpacing: '-0.02em',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {topResult.title}
                  </h2>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      opacity: 0.85,
                      margin: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {topResult.artist}
                  </p>
                </div>

                {/* Tactile Play Disc */}
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.35)',
                    flexShrink: 0
                  }}
                >
                  <span className="material-symbols-rounded filled" style={{ fontSize: '28px' }}>
                    play_arrow
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Songs List */}
          {songResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--md-sys-color-on-surface)'
                }}
              >
                Songs & Tracks
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {songResults.map((track, idx) => {
                  const isTrackPlaying = currentTrack?.id === track.id && isPlaying;
                  return (
                    <DSTrackRow
                      key={`${track.id}-${idx}`}
                      title={track.title}
                      artist={track.artist}
                      album={track.album}
                      duration={track.duration}
                      imageUrl={track.thumbnailUrl}
                      isPlaying={isTrackPlaying}
                      isLiked={isLiked(track.id)}
                      onPlay={() => {
                        if (track.id.startsWith('playlist_')) {
                          onOpenPlaylist?.({
                            id: track.id,
                            title: track.title,
                            subtitle: track.artist,
                            imageUrl: track.thumbnailUrl
                          });
                        } else {
                          playTrack(track);
                        }
                      }}
                      onToggleLike={() => toggleLikeTrack(track)}
                      onArtistClick={() => onOpenArtist?.({ name: track.artist })}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* No Results Fallback */}
          {!loading && query && results.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '280px',
                gap: '12px',
                color: COLOR_TOKENS.onSurfaceVariant
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '56px', color: COLOR_TOKENS.outline }}>
                search_off
              </span>
              <p style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                No results found for "{query}"
              </p>
              <span style={{ fontSize: '13px', opacity: 0.8 }}>
                Try searching for a different song, artist, or browse the genre cards.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
