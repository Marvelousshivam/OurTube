import React, { useId } from 'react';

interface OurTubeLogoProps {
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * OurTube "Twin-Bud Loop" Brand Logo:
 * Continuous over/under infinity (∞) audio cord cradling two angled IEM earbuds.
 */
export const OurTubeLogo: React.FC<OurTubeLogoProps> = ({
  size = 40,
  style,
  className
}) => {
  const gradId = useId();

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      className={className}
      style={{
        display: 'block',
        flexShrink: 0,
        filter: 'drop-shadow(0 6px 18px rgba(229, 57, 53, 0.35))',
        ...style
      }}
      aria-label="OurTube Logo"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF2A4B" />
          <stop offset="100%" stopColor="#B80D2E" />
        </linearGradient>
      </defs>

      {/* Squircle Container */}
      <rect x="2" y="2" width="124" height="124" rx="34" fill={`url(#${gradId})`} />
      <rect
        x="4"
        y="4"
        width="120"
        height="120"
        rx="32"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.14"
        strokeWidth="2"
      />

      {/* 1. Full Infinity Wired Cord (Base Loop) */}
      <path
        d="M 16 64 C 16 32, 47 32, 64 64 C 81 96, 112 96, 112 64 C 112 32, 81 32, 64 64 C 47 96, 16 96, 16 64 Z"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 2. Over/Under Crossover Gap Mask */}
      <path
        d="M 54 49 C 58 54, 61 59, 64 64 C 67 69, 70 74, 74 79"
        fill="none"
        stroke="#D91E3E"
        strokeWidth="15.5"
        strokeLinecap="butt"
      />

      {/* 3. Seamless Over-Strand Bezier S-Curve */}
      <path
        d="M 16 64 C 16 32, 47 32, 64 64 C 81 96, 112 96, 112 64"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="9"
        strokeLinecap="round"
      />

      {/* 4. Left Angled Earbud inside Left Loop */}
      <g transform="translate(35, 64) rotate(-26)">
        <rect x="-7" y="-9.5" width="12" height="19" rx="6" fill="#FFD8E4" />
        <circle cx="7.5" cy="0" r="4.6" fill="#FFFFFF" />
        <rect x="-3" y="-4" width="2.2" height="8" rx="1.1" fill="#B80D2E" opacity="0.7" />
      </g>

      {/* 5. Right Angled Earbud inside Right Loop */}
      <g transform="translate(93, 64) rotate(-26)">
        <rect x="-5" y="-9.5" width="12" height="19" rx="6" fill="#FFD8E4" />
        <circle cx="-7.5" cy="0" r="4.6" fill="#FFFFFF" />
        <rect x="0.8" y="-4" width="2.2" height="8" rx="1.1" fill="#B80D2E" opacity="0.7" />
      </g>
    </svg>
  );
};
