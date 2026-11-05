import React, { useEffect, useState } from 'react';

export type NavTab = 'home' | 'search' | 'library' | 'settings';

export interface FloatingNavigationDockProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  isDockHidden?: boolean;
}

export const FloatingNavigationDock: React.FC<FloatingNavigationDockProps> = ({
  currentTab,
  onSelectTab,
  scrollContainerRef,
  isDockHidden: externalHidden
}) => {
  const [internalHidden, setInternalHidden] = useState(false);
  const isHidden = externalHidden !== undefined ? externalHidden : internalHidden;

  useEffect(() => {
    const el = scrollContainerRef?.current;
    if (!el) return;

    let lastScrollTop = el.scrollTop;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollTop = el.scrollTop;
          const delta = currentScrollTop - lastScrollTop;

          // Only trigger hide when scrolling down past a threshold
          if (delta > 8 && currentScrollTop > 60) {
            setInternalHidden(true);
          } else if (delta < -8 || currentScrollTop <= 20) {
            setInternalHidden(false);
          }

          lastScrollTop = Math.max(0, currentScrollTop);
          ticking = false;
        });
        ticking = true;
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
    };
  }, [scrollContainerRef]);

  const navItems: { id: NavTab; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'search', label: 'Search', icon: 'search' },
    { id: 'library', label: 'Library', icon: 'video_library' }
  ];

  return (
    <nav
      aria-label="Main Navigation"
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: `translateX(-50%) translateY(${isHidden ? 'calc(100% + 40px)' : '0'})`,
        transition: 'transform 300ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms ease',
        opacity: isHidden ? 0 : 1,
        pointerEvents: isHidden ? 'none' : 'auto',
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        padding: '6px',
        borderRadius: '9999px',
        backgroundColor: 'rgba(28, 27, 31, 0.88)',
        backdropFilter: 'blur(28px) saturate(160%)',
        WebkitBackdropFilter: 'blur(28px) saturate(160%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.3)',
        gap: '4px',
        userSelect: 'none'
      }}
    >
      {navItems.map((item) => {
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: isActive ? '8px 18px 8px 14px' : '8px 16px',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: isActive ? 'var(--md-sys-color-secondary-container)' : 'transparent',
              color: isActive
                ? 'var(--md-sys-color-on-secondary-container)'
                : 'var(--md-sys-color-on-surface-variant)',
              transition: 'background-color 220ms ease, color 220ms ease, transform 150ms ease, padding 200ms ease',
              outline: 'none'
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            title={item.label}
          >
            <span
              className={`material-symbols-rounded ${isActive ? 'filled' : ''}`}
              style={{
                fontSize: '22px',
                transition: 'transform 200ms ease',
                transform: isActive ? 'scale(1.08)' : 'scale(1)'
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
