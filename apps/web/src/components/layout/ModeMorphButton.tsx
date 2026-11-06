import React, { useState } from 'react';

interface ModeMorphButtonProps {
  videoMode: boolean;
  onToggle: (videoMode: boolean) => void;
  className?: string;
}

/**
 * ModeMorphButton matching Koda's exact ModeMorphButton.kt & M3 Expressive spec:
 * - NO white outer box: pure inline transparent reset, zero border, zero padding.
 * - In Video Mode: Soft Rose/Pink squircle container (#ffd8e4 in light / #ffd8e4 pastel accent)
 *   holding a deep plum play arrow (#381e72 / #4a154b).
 * - In Music Mode: Soft Lavender squircle container (#e8def8)
 *   holding a deep violet music note (#21005d).
 * - Morph animation: 90° smooth spring turn with border-radius morphing between 
 *   flower petals and cookie squircle.
 * - Press scale gives tactile spring feedback (0.88 -> 1.0).
 */
export const ModeMorphButton: React.FC<ModeMorphButtonProps> = ({
  videoMode,
  onToggle,
  className = ''
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const switchLabel = videoMode ? 'Switch to Music mode' : 'Switch to Video mode';

  // Koda exact pastel colors
  const videoBg = '#ffd8e4'; // Soft rose/pink container matching Koda screenshot
  const videoIcon = '#381e72'; // Deep plum/violet play icon
  const musicBg = '#e8def8'; // Soft lavender container
  const musicIcon = '#21005d'; // Deep violet music note

  return (
    <button
      type="button"
      onClick={() => onToggle(!videoMode)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      title={switchLabel}
      aria-label={switchLabel}
      className={className}
      style={{
        width: '42px',
        height: '42px',
        minWidth: '42px',
        minHeight: '42px',
        maxWidth: '42px',
        maxHeight: '42px',
        padding: 0,
        margin: 0,
        border: 'none',
        outline: 'none',
        background: 'transparent',
        backgroundColor: 'transparent',
        backgroundImage: 'none',
        boxShadow: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        appearance: 'none',
        WebkitAppearance: 'none',
        transform: `scale(${isPressed ? 0.88 : isHovered ? 1.05 : 1})`,
        transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}
    >
      {/* Morphing Background Container with 90° Turn */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          borderRadius: videoMode ? '14px' : '21px 11px 21px 11px',
          backgroundColor: videoMode ? videoBg : musicBg,
          boxShadow: videoMode
            ? '0 2px 10px rgba(244, 114, 182, 0.35)'
            : '0 2px 8px rgba(103, 80, 164, 0.22)',
          transform: `rotate(${videoMode ? 90 : 0}deg)`,
          transition:
            'border-radius 420ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 300ms ease, transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 300ms ease',
          pointerEvents: 'none'
        }}
      />

      {/* Upright Icon Layer with Bouncy Crossfade */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: videoMode ? videoIcon : musicIcon,
          transition: 'color 300ms ease',
          pointerEvents: 'none'
        }}
      >
        <span
          key={videoMode ? 'video' : 'music'}
          className="material-symbols-rounded"
          style={{
            fontSize: '22px',
            lineHeight: 1,
            animation: 'kodaIconPop 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
            fontVariationSettings: "'FILL' 1, 'wght' 600"
          }}
        >
          {videoMode ? 'play_arrow' : 'music_note'}
        </span>
      </div>

      <style>{`
        @keyframes kodaIconPop {
          0% {
            opacity: 0;
            transform: scale(0.4) rotate(-30deg);
          }
          70% {
            transform: scale(1.18) rotate(5deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
      `}</style>
    </button>
  );
};
