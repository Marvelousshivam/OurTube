import React, { useState } from 'react';
import { useTasteStore } from '../../store/tasteStore';

type TasteStep = 'ARTISTS' | 'GENRES' | 'DECK' | 'DONE';

interface TasteSetupFlowProps {
  onClose: () => void;
}

interface ArtistItem {
  id: string;
  name: string;
  photoUrl: string;
  genre: string;
}

const DEFAULT_ARTISTS: ArtistItem[] = [
  { id: '1', name: 'Arijit Singh', photoUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop', genre: 'Bollywood' },
  { id: '2', name: 'Kendrick Lamar', photoUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&h=200&fit=crop', genre: 'Hip-Hop' },
  { id: '3', name: 'Taylor Swift', photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop', genre: 'Pop' },
  { id: '4', name: 'The Weeknd', photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop', genre: 'R&B' },
  { id: '5', name: 'Billie Eilish', photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop', genre: 'Alt-Pop' },
  { id: '6', name: 'Diljit Dosanjh', photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop', genre: 'Punjabi' },
  { id: '7', name: 'Coldplay', photoUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=200&h=200&fit=crop', genre: 'Rock' },
  { id: '8', name: 'Dua Lipa', photoUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=200&fit=crop', genre: 'Pop' },
  { id: '9', name: 'Travis Scott', photoUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&h=200&fit=crop', genre: 'Hip-Hop' },
  { id: '10', name: 'SZA', photoUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop', genre: 'R&B' },
  { id: '11', name: 'Pritam', photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop', genre: 'Bollywood' },
  { id: '12', name: 'Post Malone', photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop', genre: 'Pop' }
];

const GENRES = [
  'Bollywood', 'Pop', 'Hip-Hop', 'Indie', 'Rock', 'R&B',
  'Lo-Fi', 'Electronic', 'Punjabi', 'Classical', 'Ghazal',
  'Ambient', 'Metal', 'Folk', 'Soul', 'Jazz', 'Latin'
];

interface DeckCardItem {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  reason: string;
}

const SAMPLE_DECK: DeckCardItem[] = [
  {
    id: 's1',
    title: 'Barkha',
    artist: 'Arijit Singh & Irshad Kamil',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&h=500&fit=crop',
    reason: 'Matches your taste for Arijit Singh'
  },
  {
    id: 's2',
    title: 'Starboy',
    artist: 'The Weeknd & Daft Punk',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&h=500&fit=crop',
    reason: 'Popular in R&B & Synth-Pop'
  },
  {
    id: 's3',
    title: 'Lover',
    artist: 'Diljit Dosanjh',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&h=500&fit=crop',
    reason: 'Trending in Punjabi Pop'
  },
  {
    id: 's4',
    title: 'All The Stars',
    artist: 'Kendrick Lamar & SZA',
    coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&h=500&fit=crop',
    reason: 'Award winning Hip-Hop collaboration'
  }
];

export const TasteSetupFlow: React.FC<TasteSetupFlowProps> = ({ onClose }) => {
  const [step, setStep] = useState<TasteStep>('ARTISTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [deckIndex, setDeckIndex] = useState(0);

  const {
    pickedArtists,
    pickedGenres,
    togglePickedArtist,
    togglePickedGenre,
    recordDeckVerdict,
    setTasteSetupCompleted
  } = useTasteStore();

  const handleNextStep = () => {
    if (step === 'ARTISTS') setStep('GENRES');
    else if (step === 'GENRES') setStep('DECK');
    else if (step === 'DECK') setStep('DONE');
  };

  const handleFinish = () => {
    setTasteSetupCompleted(true);
    onClose();
  };

  const handleVerdict = (verdict: 'YES' | 'NO' | 'LOVE') => {
    const card = SAMPLE_DECK[deckIndex];
    if (card) {
      recordDeckVerdict(card.id, verdict);
    }
    if (deckIndex + 1 < SAMPLE_DECK.length) {
      setDeckIndex(deckIndex + 1);
    } else {
      setStep('DONE');
    }
  };

  const filteredArtists = DEFAULT_ARTISTS.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        backgroundColor: 'var(--md-sys-color-background)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: 'var(--md-sys-color-on-background)'
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid var(--md-sys-color-surface-container-high)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {step !== 'ARTISTS' && step !== 'DONE' && (
            <button
              onClick={() => {
                if (step === 'GENRES') setStep('ARTISTS');
                if (step === 'DECK') setStep('GENRES');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <span className="material-symbols-rounded">arrow_back</span>
            </button>
          )}
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
              Taste Setup
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--md-sys-color-primary)', fontWeight: 600 }}>
              Step {step === 'ARTISTS' ? '1 of 3: Pick Artists' : step === 'GENRES' ? '2 of 3: Pick Genres' : step === 'DECK' ? '3 of 3: Swipe Songs' : 'Completed'}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--md-sys-color-outline)',
            cursor: 'pointer',
            padding: '8px',
            fontSize: '13px',
            fontWeight: 700
          }}
        >
          Skip
        </button>
      </div>

      {/* Step Viewport */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        {/* STEP 1: ARTISTS */}
        {step === 'ARTISTS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 6px 0' }}>
                Pick artists you love
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--md-sys-color-on-surface-variant)', margin: 0 }}>
                Koda uses your picks to tailor your personalized mix and radios.
              </p>
            </div>

            {/* Search Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 18px',
                borderRadius: '16px',
                backgroundColor: 'var(--md-sys-color-surface-container)',
                border: '1px solid var(--md-sys-color-outline-variant)'
              }}
            >
              <span className="material-symbols-rounded" style={{ color: 'var(--md-sys-color-outline)' }}>
                search
              </span>
              <input
                type="text"
                placeholder="Search artists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'inherit',
                  fontSize: '14px',
                  width: '100%'
                }}
              />
            </div>

            {/* Artists Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '16px',
                marginTop: '12px'
              }}
            >
              {filteredArtists.map((artist) => {
                const isSelected = pickedArtists.includes(artist.name);
                return (
                  <div
                    key={artist.id}
                    onClick={() => togglePickedArtist(artist.name)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      padding: '16px 8px',
                      borderRadius: '24px',
                      cursor: 'pointer',
                      backgroundColor: isSelected
                        ? 'var(--md-sys-color-primary-container)'
                        : 'var(--md-sys-color-surface-container)',
                      color: isSelected
                        ? 'var(--md-sys-color-on-primary-container)'
                        : 'var(--md-sys-color-on-surface)',
                      border: isSelected
                        ? '2px solid var(--md-sys-color-primary)'
                        : '2px solid transparent',
                      transition: 'transform 150ms ease, background-color 200ms ease'
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        width: '84px',
                        height: '84px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        marginBottom: '10px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                      }}
                    >
                      <img
                        src={artist.photoUrl}
                        alt={artist.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {isSelected && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <span className="material-symbols-rounded" style={{ color: '#ffffff', fontSize: '32px' }}>
                            check
                          </span>
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{artist.name}</span>
                    <span style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>{artist.genre}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: GENRES */}
        {step === 'GENRES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 6px 0' }}>
                Select your favorite genres
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--md-sys-color-on-surface-variant)', margin: 0 }}>
                Choose the musical styles you enjoy listening to.
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {GENRES.map((genre) => {
                const isSelected = pickedGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    onClick={() => togglePickedGenre(genre)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 22px',
                      borderRadius: '9999px',
                      border: isSelected
                        ? '1.5px solid var(--md-sys-color-primary)'
                        : '1.5px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: isSelected
                        ? 'var(--md-sys-color-primary)'
                        : 'var(--md-sys-color-surface-container)',
                      color: isSelected
                        ? 'var(--md-sys-color-on-primary)'
                        : 'var(--md-sys-color-on-surface)',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 200ms ease'
                    }}
                  >
                    {isSelected && (
                      <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                        check
                      </span>
                    )}
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: DECK */}
        {step === 'DECK' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px 0' }}>
                Tune your recommendation engine
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--md-sys-color-on-surface-variant)', margin: 0 }}>
                Card {deckIndex + 1} of {SAMPLE_DECK.length}
              </p>
            </div>

            {SAMPLE_DECK[deckIndex] && (
              <div
                style={{
                  width: '100%',
                  maxWidth: '380px',
                  borderRadius: '28px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--md-sys-color-surface-container-high)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ width: '100%', aspectRatio: '1/1', position: 'relative' }}>
                  <img
                    src={SAMPLE_DECK[deckIndex].coverUrl}
                    alt={SAMPLE_DECK[deckIndex].title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      padding: '6px 12px',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(0,0,0,0.65)',
                      backdropFilter: 'blur(8px)',
                      color: 'var(--md-sys-color-primary)',
                      fontSize: '11px',
                      fontWeight: 700
                    }}
                  >
                    {SAMPLE_DECK[deckIndex].reason}
                  </div>
                </div>

                <div style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px 0' }}>
                    {SAMPLE_DECK[deckIndex].title}
                  </h3>
                  <p style={{ fontSize: '15px', color: 'var(--md-sys-color-primary)', fontWeight: 600, margin: 0 }}>
                    {SAMPLE_DECK[deckIndex].artist}
                  </p>

                  {/* Verdict Buttons Row */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: '24px',
                      marginTop: '24px'
                    }}
                  >
                    <button
                      onClick={() => handleVerdict('NO')}
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--md-sys-color-surface-container)',
                        border: '1px solid var(--md-sys-color-outline-variant)',
                        color: '#ff5449',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title="Skip / Dislike"
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: '28px' }}>close</span>
                    </button>

                    <button
                      onClick={() => handleVerdict('LOVE')}
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--md-sys-color-surface-container)',
                        border: '1px solid var(--md-sys-color-outline-variant)',
                        color: '#ff2d95',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title="Love this track"
                    >
                      <span className="material-symbols-rounded filled" style={{ fontSize: '28px' }}>favorite</span>
                    </button>

                    <button
                      onClick={() => handleVerdict('YES')}
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--md-sys-color-primary)',
                        border: 'none',
                        color: 'var(--md-sys-color-on-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title="Add to Liked"
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: '28px' }}>check</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: DONE */}
        {step === 'DONE' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', padding: '36px 0' }}>
            <div
              style={{
                width: '84px',
                height: '84px',
                borderRadius: '50%',
                backgroundColor: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-on-primary-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '48px' }}>
                verified
              </span>
            </div>

            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0' }}>
                Taste Profile Ready!
              </h1>
              <p style={{ fontSize: '15px', color: 'var(--md-sys-color-on-surface-variant)', maxWidth: '440px', margin: '0 auto' }}>
                Your personal mix is calibrated with {pickedArtists.length} artists and {pickedGenres.length} genres.
              </p>
            </div>

            <button
              onClick={handleFinish}
              style={{
                padding: '16px 48px',
                borderRadius: '9999px',
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
                border: 'none',
                fontWeight: 800,
                fontSize: '16px',
                letterSpacing: '0.04em',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                marginTop: '16px'
              }}
            >
              Start Listening
            </button>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar for ARTISTS & GENRES */}
      {(step === 'ARTISTS' || step === 'GENRES') && (
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--md-sys-color-surface-container-high)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--md-sys-color-surface-container-lowest)'
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--md-sys-color-outline)' }}>
            {step === 'ARTISTS'
              ? `${pickedArtists.length} artists selected`
              : `${pickedGenres.length} genres selected`}
          </span>

          <button
            onClick={handleNextStep}
            style={{
              padding: '12px 32px',
              borderRadius: '9999px',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              border: 'none',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
};
