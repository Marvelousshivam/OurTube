import React, { useState } from 'react';

interface AppShowcasePreviewProps {
  onStartSetup: () => void;
}

export const AppShowcasePreview: React.FC<AppShowcasePreviewProps> = ({ onStartSetup }) => {
  const [activeTab, setActiveTab] = useState<'mix' | 'styles' | 'lyrics'>('mix');
  const [isPlayingDemo, setIsPlayingDemo] = useState(true);
  const [isLikedDemo, setIsLikedDemo] = useState(false);
  const [activeStyleDemo, setActiveStyleDemo] = useState<'editorial' | 'bento' | 'dial'>('editorial');

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        animation: 'm3FadeIn 350ms cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* 1. Header Banner & Value Proposition */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          backgroundColor: 'var(--md-sys-color-surface-container, #1d2024)',
          borderRadius: '24px',
          padding: '24px 28px',
          border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))',
          boxShadow: '0 20px 48px -12px rgba(0, 0, 0, 0.4)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '9999px',
              backgroundColor: 'var(--md-sys-color-primary-container, rgba(168, 199, 250, 0.15))',
              color: 'var(--md-sys-color-primary, #a8c7fa)',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>
              visibility
            </span>
            <span>Interactive App Preview</span>
          </div>

          <button
            type="button"
            onClick={onStartSetup}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              borderRadius: '9999px',
              border: 'none',
              backgroundColor: 'var(--md-sys-color-primary, #a8c7fa)',
              color: 'var(--md-sys-color-on-primary, #083063)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 8px 24px -4px rgba(168, 199, 250, 0.4)',
              transition: 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <span>Ready to Play? Start 60s Setup</span>
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
              arrow_forward
            </span>
          </button>
        </div>

        <h2
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(24px, 3.2vw, 36px)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--md-sys-color-on-surface, #ffffff)',
            margin: '4px 0 0 0'
          }}
        >
          This is OurTube. Personal, Expressive &amp; Unconstrained.
        </h2>

        <p
          style={{
            fontSize: '14px',
            lineHeight: 1.6,
            color: 'var(--md-sys-color-on-surface-variant, #91909a)',
            margin: 0,
            maxWidth: '820px'
          }}
        >
          Explore what awaits you inside. OurTube is built from the ground up for true music lovers &mdash; featuring organic vinyl collages, 8 bespoke player styles, synchronized flowing lyrics, and pure lossless 256kbps audio.
        </p>

        {/* Showcase Sub-tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '12px',
            overflowX: 'auto',
            paddingBottom: '2px'
          }}
        >
          {[
            { id: 'mix', label: '1. Your Mix & Living Deck', icon: 'album' },
            { id: 'styles', label: '2. 8 Bespoke Player Styles', icon: 'style' },
            { id: 'lyrics', label: '3. Apple-Style Flowing Lyrics', icon: 'lyrics' }
          ].map((tab) => {
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 16px',
                  borderRadius: '9999px',
                  border: isTabActive
                    ? '1px solid var(--md-sys-color-primary, #a8c7fa)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  backgroundColor: isTabActive
                    ? 'var(--md-sys-color-primary-container, rgba(168, 199, 250, 0.2))'
                    : 'rgba(255, 255, 255, 0.03)',
                  color: isTabActive
                    ? 'var(--md-sys-color-on-primary-container, #ffffff)'
                    : 'var(--md-sys-color-on-surface-variant, #91909a)',
                  fontSize: '12px',
                  fontWeight: isTabActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. THE MAIN SHOWCASE STAGE */}
      <div
        style={{
          width: '100%',
          backgroundColor: '#0c0d11',
          borderRadius: '28px',
          border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.09))',
          boxShadow: '0 28px 72px -16px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {/* Top App Bar Simulation */}
        <div
          style={{
            height: '52px',
            padding: '0 24px',
            backgroundColor: 'rgba(17, 19, 24, 0.8)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {/* User profile & greeting */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#37393e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                color: '#ffffff',
                position: 'relative'
              }}
            >
              S
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#80cbc4',
                  position: 'absolute',
                  bottom: '-1px',
                  right: '-1px',
                  border: '1.5px solid #0c0d11'
                }}
              />
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e2e6' }}>
              Good afternoon
            </span>
            <span className="material-symbols-rounded" style={{ fontSize: '16px', color: '#91909a' }}>
              expand_more
            </span>
          </div>

          {/* Action pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c4c6cf'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                palette
              </span>
            </div>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c4c6cf'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                settings
              </span>
            </div>
          </div>
        </div>

        {/* TAB 1: YOUR MIX & ORGANIC COLLAGE (Replicating exact user screenshot!) */}
        {activeTab === 'mix' && (
          <div
            style={{
              padding: 'clamp(20px, 4vw, 40px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '32px',
              position: 'relative',
              minHeight: '440px'
            }}
          >
            {/* The Mix Hero Content */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
                gap: '36px',
                alignItems: 'center'
              }}
            >
              {/* Left Column: Editorial Headline & Track Pills */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h1
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: 'clamp(38px, 5.5vw, 68px)',
                    fontWeight: 900,
                    lineHeight: 1.0,
                    letterSpacing: '-0.03em',
                    color: '#ffffff',
                    margin: 0
                  }}
                >
                  Your<br />Mix
                </h1>

                <div style={{ fontSize: '14px', color: '#c4c6cf', fontWeight: 500 }}>
                  She &amp; Him, Osho Jain, Mehdi Hassan, Tame Impala
                </div>

                {/* IN THIS MIX pill chips */}
                <div style={{ marginTop: '8px' }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: '#80cbc4',
                      marginBottom: '8px'
                    }}
                  >
                    IN THIS MIX
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {[
                      { title: 'I Thought I Saw Your Face Today', color: '#ffb74d' },
                      { title: 'Teri Marzi Hai', color: '#81c784' },
                      { title: 'Yun Zindagi Ki Raah Mein Takr...', color: '#ba68c8' }
                    ].map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '9999px',
                          backgroundColor: '#1b1d24',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          fontSize: '11px',
                          color: '#e2e2e6'
                        }}
                      >
                        <span
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: item.color
                          }}
                        />
                        <span>{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Organic Pebble & Satellite Collage Deck */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '380px',
                  aspectRatio: '1 / 1',
                  margin: '0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {/* 1. Large Center Organic Pebble Artwork with Gentle Drift */}
                <div
                  style={{
                    width: '82%',
                    height: '82%',
                    borderRadius: '46% 54% 60% 40% / 48% 42% 58% 52%',
                    transform: 'rotate(-10deg)',
                    overflow: 'hidden',
                    backgroundColor: '#ffe082',
                    boxShadow: '0 24px 60px -8px rgba(0, 0, 0, 0.5)',
                    animation: 'm3HeroPebbleDrift 10s ease-in-out infinite alternate',
                    position: 'relative',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'radial-gradient(circle at 60% 40%, #ffecb3 0%, #ffd54f 60%, #ffb300 100%)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: '20px',
                      color: '#4e342e'
                    }}
                  >
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: 800 }}>
                      She &amp; Him
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', marginTop: '4px' }}>
                      VOLUME ONE
                    </div>
                  </div>
                </div>

                {/* 2. Top-Left Satellite Circle */}
                <div
                  style={{
                    position: 'absolute',
                    top: '0%',
                    left: '2%',
                    width: '105px',
                    height: '105px',
                    borderRadius: '50%',
                    backgroundColor: '#2e7d32',
                    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
                    border: '3px solid #0c0d11',
                    zIndex: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    animation: 'm3SatelliteOrbit1 8s ease-in-out infinite alternate'
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '36px', color: '#ff8a80' }}>
                    local_florist
                  </span>
                </div>

                {/* 3. Bottom-Right Satellite Circle */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '2%',
                    right: '2%',
                    width: '95px',
                    height: '95px',
                    borderRadius: '50%',
                    backgroundColor: '#d84315',
                    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
                    border: '3px solid #0c0d11',
                    zIndex: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    animation: 'm3SatelliteOrbit2 9s ease-in-out infinite alternate'
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '32px' }}>
                    music_note
                  </span>
                </div>

                {/* 4. Floating Mint Play Button (Directly from user screenshot!) */}
                <button
                  type="button"
                  onClick={() => setIsPlayingDemo((prev) => !prev)}
                  title="Toggle playback demo"
                  style={{
                    position: 'absolute',
                    top: '38%',
                    left: '12%',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: '#80cbc4',
                    color: '#004d40',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 5,
                    boxShadow: '0 12px 28px rgba(128, 203, 196, 0.45)',
                    cursor: 'pointer',
                    transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.12)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '32px', marginLeft: isPlayingDemo ? '0' : '2px' }}>
                    {isPlayingDemo ? 'pause' : 'play_arrow'}
                  </span>
                </button>
              </div>
            </div>

            {/* THE FLOATING MINIPLAYER PILL (Exact match to screenshot!) */}
            <div
              style={{
                width: '100%',
                maxWidth: '560px',
                margin: '12px auto 0 auto',
                backgroundColor: '#1f2026',
                borderRadius: '9999px',
                padding: '8px 16px 8px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              {/* Sade Album Thumbnail */}
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: '#455a64',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '20px', color: '#cfd8dc' }}>
                  person
                </span>
              </div>

              {/* Title & Artist */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Smooth Operator (Single Version)
                </div>
                <div style={{ fontSize: '11px', color: '#91909a' }}>
                  Sade
                </div>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsLikedDemo((prev) => !prev)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isLikedDemo ? '#ff5252' : '#91909a',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                    {isLikedDemo ? 'favorite' : 'favorite_border'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPlayingDemo((prev) => !prev)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#80cbc4',
                    color: '#004d40',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                    {isPlayingDemo ? 'pause' : 'play_arrow'}
                  </span>
                </button>

                <span className="material-symbols-rounded" style={{ fontSize: '20px', color: '#91909a' }}>
                  skip_next
                </span>
                <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#91909a' }}>
                  volume_up
                </span>
              </div>
            </div>

            {/* FLOATING BOTTOM DOCK: Home / Search / Library */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                margin: '0 auto',
                backgroundColor: 'rgba(29, 32, 36, 0.9)',
                borderRadius: '9999px',
                padding: '4px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                gap: '4px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(168, 199, 250, 0.2)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>home</span>
                <span>Home</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  color: '#91909a',
                  fontSize: '12px',
                  fontWeight: 500
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>search</span>
                <span>Search</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  color: '#91909a',
                  fontSize: '12px',
                  fontWeight: 500
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>video_library</span>
                <span>Library</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 8 BESPOKE PLAYER STYLES */}
        {activeTab === 'styles' && (
          <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', margin: '0 0 6px 0' }}>
                Pick Your Stage: 8 Bespoke Player Styles
              </h3>
              <p style={{ fontSize: '13px', color: '#91909a', margin: 0 }}>
                Every track deserves its own atmosphere. Toggle between full magazine spreads, tactile physical dials, bento modules, or fluid canvas visuals.
              </p>
            </div>

            {/* Style Selector Chips */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { id: 'editorial', label: 'Editorial (Die-Cut Scallop)' },
                { id: 'bento', label: 'Bento Grid' },
                { id: 'dial', label: 'Physical Dial' }
              ].map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setActiveStyleDemo(style.id as any)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '9999px',
                    border: activeStyleDemo === style.id ? '1px solid #80cbc4' : '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: activeStyleDemo === style.id ? 'rgba(128, 203, 196, 0.15)' : 'transparent',
                    color: activeStyleDemo === style.id ? '#80cbc4' : '#c4c6cf',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {style.label}
                </button>
              ))}
            </div>

            {/* Visual Preview Box */}
            <div
              style={{
                backgroundColor: '#16181e',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '220px'
              }}
            >
              {activeStyleDemo === 'editorial' && (
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '120px',
                      height: '120px',
                      backgroundColor: '#e57373',
                      clipPath: 'polygon(50% 0%, 63% 4%, 75% 0%, 84% 9%, 93% 6%, 98% 18%, 100% 30%, 96% 41%, 100% 50%, 96% 59%, 100% 70%, 98% 82%, 93% 94%, 84% 91%, 75% 100%, 63% 96%, 50% 100%, 37% 96%, 25% 100%, 16% 91%, 7% 94%, 2% 82%, 0% 70%, 4% 59%, 0% 50%, 4% 41%, 0% 30%, 2% 18%, 7% 6%, 16% 9%, 25% 0%, 37% 4%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      boxShadow: '0 12px 32px rgba(229, 115, 115, 0.4)'
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '40px' }}>music_note</span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>12-Lobed Scallop Cookie Morph</div>
                  <div style={{ fontSize: '12px', color: '#91909a' }}>Morphs live into 5 organic shapes matching each album&apos;s mood</div>
                </div>
              )}

              {activeStyleDemo === 'bento' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 100px)', gap: '10px' }}>
                  <div style={{ backgroundColor: '#21242d', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                    <span className="material-symbols-rounded" style={{ color: '#80cbc4' }}>graphic_eq</span>
                    <div style={{ fontSize: '10px', color: '#91909a', marginTop: '4px' }}>Waveform</div>
                  </div>
                  <div style={{ backgroundColor: '#21242d', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                    <span className="material-symbols-rounded" style={{ color: '#a8c7fa' }}>analytics</span>
                    <div style={{ fontSize: '10px', color: '#91909a', marginTop: '4px' }}>Bitrate</div>
                  </div>
                  <div style={{ backgroundColor: '#21242d', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                    <span className="material-symbols-rounded" style={{ color: '#ff8a80' }}>queue_music</span>
                    <div style={{ fontSize: '10px', color: '#91909a', marginTop: '4px' }}>Queue</div>
                  </div>
                </div>
              )}

              {activeStyleDemo === 'dial' && (
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '90px',
                      height: '90px',
                      borderRadius: '50%',
                      border: '6px solid #80cbc4',
                      borderTopColor: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: 'rotate(45deg)'
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ transform: 'rotate(-45deg)', color: '#ffffff' }}>
                      rotate_right
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#e2e2e6' }}>Tactile Sonic Scrubber Wheel</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: APPLE-STYLE FLOWING LYRICS */}
        {activeTab === 'lyrics' && (
          <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', maxWidth: '600px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', margin: '0 0 6px 0' }}>
                Synchronized Live Karaoke Lyrics
              </h3>
              <p style={{ fontSize: '13px', color: '#91909a', margin: 0 }}>
                Powered by AM-Lyrics with Romanized translations and glowing vocal line highlights.
              </p>
            </div>

            <div
              style={{
                width: '100%',
                maxWidth: '480px',
                backgroundColor: '#16181e',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                textAlign: 'left'
              }}
            >
              <div style={{ fontSize: '14px', color: '#767882' }}>
                He moves in space with minimum waste and maximum joy
              </div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: '#ffffff',
                  textShadow: '0 0 24px rgba(128, 203, 196, 0.6)',
                  transform: 'scale(1.02)',
                  transition: 'all 200ms ease'
                }}
              >
                City lights and business nights
              </div>
              <div style={{ fontSize: '14px', color: '#767882' }}>
                When you require street life for fast living
              </div>
              <div style={{ fontSize: '14px', color: '#767882' }}>
                No place for beginners or sensitive hearts
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes m3HeroPebbleDrift {
          0% { transform: rotate(-12deg) translateY(0px); }
          100% { transform: rotate(-8deg) translateY(-8px); }
        }
        @keyframes m3SatelliteOrbit1 {
          0% { transform: translateY(0px) scale(1); }
          100% { transform: translateY(-8px) scale(1.04); }
        }
        @keyframes m3SatelliteOrbit2 {
          0% { transform: translateY(0px) scale(1); }
          100% { transform: translateY(8px) scale(1.04); }
        }
      `}</style>
    </div>
  );
};
