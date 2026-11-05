import React from 'react';

export type NavTab = 'home' | 'search' | 'library' | 'settings';

export interface FloatingNavigationDockProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  isDockHidden?: boolean;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'library', label: 'Library', icon: 'video_library' }
];

const SLOT_WIDTH = 104; // Each slot has identical width for architectural symmetry
const SLOT_GAP = 4;
const PADDING = 4;

export const FloatingNavigationDock: React.FC<FloatingNavigationDockProps> = ({
  currentTab,
  onSelectTab,
  isDockHidden = false
}) => {
  const activeIndex = NAV_ITEMS.findIndex((item) => item.id === currentTab);
  const isPillVisible = activeIndex !== -1;

  return (
    <nav
      aria-label="Main Navigation"
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: `translateX(-50%) translateY(${isDockHidden ? 'calc(100% + 40px)' : '0'})`,
        transition: 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms ease',
        opacity: isDockHidden ? 0 : 1,
        pointerEvents: isDockHidden ? 'none' : 'auto',
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        padding: `${PADDING}px`,
        borderRadius: '9999px',
        backgroundColor: 'var(--md-sys-color-surface-container-high)',
        backdropFilter: 'blur(28px) saturate(160%)',
        WebkitBackdropFilter: 'blur(28px) saturate(160%)',
        border: '1px solid var(--md-sys-color-outline-variant)',
        boxShadow:
          '0 12px 36px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.2)), 0 2px 8px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.1))',
        gap: `${SLOT_GAP}px`,
        userSelect: 'none'
      }}
    >
      {/* Precision Material 3 Symmetric Sliding Pill Indicator */}
      <div
        style={{
          position: 'absolute',
          top: `${PADDING}px`,
          bottom: `${PADDING}px`,
          left: `${PADDING}px`,
          width: `${SLOT_WIDTH}px`,
          transform: `translateX(${isPillVisible ? activeIndex * (SLOT_WIDTH + SLOT_GAP) : 0}px)`,
          borderRadius: '9999px',
          backgroundColor: 'var(--md-sys-color-secondary-container)',
          boxShadow: '0 1px 4px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.08))',
          opacity: isPillVisible ? 1 : 0,
          transition:
            'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {NAV_ITEMS.map((item) => {
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            style={{
              position: 'relative',
              zIndex: 1,
              width: `${SLOT_WIDTH}px`,
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: isActive
                ? 'var(--md-sys-color-on-secondary-container)'
                : 'var(--md-sys-color-on-surface-variant)',
              transition:
                'color 200ms ease, transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              outline: 'none',
              padding: 0
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              if (!isActive) e.currentTarget.style.color = 'var(--md-sys-color-on-surface-variant)';
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--md-sys-color-on-surface)';
            }}
            onTouchStart={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
            onTouchEnd={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            title={item.label}
          >
            <span
              className={`material-symbols-rounded ${isActive ? 'filled' : ''}`}
              style={{
                fontSize: '20px',
                transition: 'transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
                animation: isActive ? 'm3IconSpring 350ms var(--motion-spring-joyful)' : 'none'
              }}
            >
              {item.icon}
            </span>
            <span
              style={{
                fontSize: '13px',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '-0.01em',
                lineHeight: 1
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
