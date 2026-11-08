import React, { useState, useEffect, useCallback, useRef } from 'react';
import { bridgeClient, ExtensionConnectionState } from '../../api/bridgeClient';
import { SupportedBrowser, BrowserSelectorPills } from './BrowserSelectorPills';
import { BrowserExtensionMockup } from './BrowserExtensionMockup';
import { OnboardingStepper } from './OnboardingStepper';
import { TroubleshootingSheet } from './TroubleshootingSheet';
import { MaterialYouPaletteBar } from './MaterialYouPaletteBar';
import { AppShowcasePreview } from './AppShowcasePreview';
import { OurTubeLogo } from '../common/OurTubeLogo';

type OnboardingViewMode = 'showcase' | 'setup' | 'both';

export const ExtensionRequiredGate: React.FC = () => {
  const [viewMode, setViewMode] = useState<OnboardingViewMode>('both');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [browser, setBrowser] = useState<SupportedBrowser>('Chrome');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isDevModeToggled, setIsDevModeToggled] = useState(false);
  const [connectionState, setConnectionState] = useState<ExtensionConnectionState>(
    bridgeClient.getConnectionState()
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const setupSectionRef = useRef<HTMLDivElement>(null);

  // Auto-detect browser from user agent
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('edg/')) {
        setBrowser('Edge');
      } else if (ua.includes('brave') || (navigator as any).brave) {
        setBrowser('Brave');
      } else if (ua.includes('opr/') || ua.includes('opera') || ua.includes('vivaldi')) {
        setBrowser('Chromium');
      } else {
        setBrowser('Chrome');
      }
    }
  }, []);

  // Listen to bridge state changes
  useEffect(() => {
    const unsubState = bridgeClient.onStateChange((state) => {
      setConnectionState(state);
      if (state === 'connected') {
        setCurrentStep(4);
      }
    });

    const unsubAvail = bridgeClient.onAvailabilityChange((available) => {
      if (available) {
        setConnectionState('connected');
        setCurrentStep(4);
      }
    });

    return () => {
      unsubState();
      unsubAvail();
    };
  }, []);

  const handleCopyUrl = useCallback(() => {
    let url = 'chrome://extensions';
    if (browser === 'Edge') url = 'edge://extensions';
    else if (browser === 'Brave') url = 'brave://extensions';

    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2200);
  }, [browser]);

  const handleManualCheck = async () => {
    setChecking(true);
    await bridgeClient.checkNow();
    setTimeout(() => {
      setChecking(false);
    }, 700);
  };

  const handleSetStep = (step: number) => {
    if (step >= 1 && step <= 4) {
      setCurrentStep(step);
    }
  };

  const handleScrollToSetup = () => {
    if (viewMode === 'showcase') {
      setViewMode('setup');
    } else if (setupSectionRef.current) {
      setupSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Keyboard navigation for steps
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowRight' && currentStep < 4) {
        setCurrentStep((prev) => prev + 1);
      } else if (e.key === 'ArrowLeft' && currentStep > 1) {
        setCurrentStep((prev) => prev - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep]);

  const isConnected = connectionState === 'connected';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        height: '100vh',
        width: '100vw',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        backgroundColor: 'var(--md-sys-color-background, #111318)',
        color: 'var(--md-sys-color-on-background, #e2e2e9)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 20px 100px 20px',
        boxSizing: 'border-box',
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        zIndex: 9999
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1240px',
          display: 'flex',
          flexDirection: 'column',
          gap: '28px'
        }}
      >
        {/* ================= 1. TOP APP BAR & BRAND HEADER ================= */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))'
          }}
        >
          {/* Brand Logo & Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <OurTubeLogo size={42} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: 'var(--md-sys-color-on-surface, #ffffff)'
                  }}
                >
                  OurTube
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    backgroundColor: 'var(--md-sys-color-primary-container, rgba(168, 199, 250, 0.15))',
                    color: 'var(--md-sys-color-primary, #a8c7fa)',
                    padding: '2px 8px',
                    borderRadius: '9999px'
                  }}
                >
                  Onboarding
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant, #91909a)' }}>
                Material 3 Expressive &bull; Personal Audio Player
              </div>
            </div>
          </div>

          {/* Right Header: Material You Palette Switcher & Live Radar Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <MaterialYouPaletteBar />

            {/* Live Radar Pill */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '9999px',
                backgroundColor: isConnected
                  ? 'rgba(128, 203, 196, 0.15)'
                  : 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.05))',
                border: isConnected
                  ? '1px solid #80cbc4'
                  : '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))',
                fontSize: '12px',
                fontWeight: 600,
                color: isConnected ? '#80cbc4' : 'var(--md-sys-color-on-surface, #c4c6cf)'
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isConnected ? '#80cbc4' : '#8ab4f8',
                  boxShadow: isConnected ? '0 0 10px #80cbc4' : '0 0 8px #8ab4f8',
                  animation: isConnected ? 'none' : 'm3RadarPulse 2s infinite'
                }}
              />
              <span>
                {isConnected ? 'Bridge Active & Ready' : 'Listening on tab focus...'}
              </span>
            </div>
          </div>
        </header>

        {/* ================= 2. VIEW MODE TOGGLE PILL DOCK ================= */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          {/* View switcher buttons */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px',
              backgroundColor: 'var(--md-sys-color-surface-container, #1d2024)',
              borderRadius: '9999px',
              border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))',
              gap: '4px'
            }}
          >
            {[
              { id: 'both', label: 'All-in-One (Showcase + Setup)', icon: 'auto_awesome' },
              { id: 'showcase', label: '✨ Peek Inside App', icon: 'visibility' },
              { id: 'setup', label: '⚡ 4-Step Quick Setup', icon: 'install_desktop' }
            ].map((mode) => {
              const isSelected = viewMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setViewMode(mode.id as any)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 16px',
                    borderRadius: '9999px',
                    border: 'none',
                    backgroundColor: isSelected
                      ? 'var(--md-sys-color-primary, #a8c7fa)'
                      : 'transparent',
                    color: isSelected
                      ? 'var(--md-sys-color-on-primary, #083063)'
                      : 'var(--md-sys-color-on-surface-variant, #91909a)',
                    fontSize: '12px',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                    {mode.icon}
                  </span>
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>

          {/* Browser Selector Pills */}
          <BrowserSelectorPills
            selectedBrowser={browser}
            onSelectBrowser={setBrowser}
          />
        </div>

        {/* ================= 3. SECTION: PEEK INSIDE APP SHOWCASE ================= */}
        {(viewMode === 'showcase' || viewMode === 'both') && (
          <section>
            <AppShowcasePreview onStartSetup={handleScrollToSetup} />
          </section>
        )}

        {/* ================= 4. SECTION: 4-STEP EXTENSION SETUP WALKTHROUGH ================= */}
        {(viewMode === 'setup' || viewMode === 'both') && (
          <section
            ref={setupSectionRef}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              paddingTop: viewMode === 'both' ? '24px' : '0',
              borderTop: viewMode === 'both'
                ? '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))'
                : 'none'
            }}
          >
            {/* Editorial Title for Setup */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--md-sys-color-primary, #a8c7fa)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>
                  flash_on
                </span>
                60-Second Companion Setup
              </div>

              <h2
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 'clamp(26px, 3.5vw, 42px)',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--md-sys-color-on-surface, #ffffff)',
                  margin: 0
                }}
              >
                Unlock Your Experience in {browser}
              </h2>

              <p
                style={{
                  fontSize: '14px',
                  lineHeight: 1.6,
                  color: 'var(--md-sys-color-on-surface-variant, #91909a)',
                  margin: 0,
                  maxWidth: '740px'
                }}
              >
                Follow these 4 simple steps to connect the local audio bridge. The extension runs entirely on your device with zero cloud tracking.
              </p>
            </div>

            {/* Expansive Two-Column Spread */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
                gap: '32px',
                alignItems: 'start'
              }}
            >
              {/* Left Column: Interactive Stepper & Action Deck */}
              <div>
                <OnboardingStepper
                  currentStep={currentStep}
                  totalSteps={4}
                  onSetStep={handleSetStep}
                  browser={browser}
                  isChecking={checking}
                  onManualCheck={handleManualCheck}
                  copiedUrl={copiedUrl}
                  onCopyUrl={handleCopyUrl}
                  isConnected={isConnected}
                />
              </div>

              {/* Right Column: Interactive Browser Extension Mockup */}
              <div style={{ position: 'sticky', top: '24px' }}>
                <BrowserExtensionMockup
                  currentStep={currentStep}
                  browser={browser}
                  isDevModeActive={isDevModeToggled}
                  onToggleDevMode={() => setIsDevModeToggled((prev) => !prev)}
                  isConnected={isConnected}
                  copiedUrl={copiedUrl}
                  onCopyUrl={handleCopyUrl}
                />

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 8px 0 8px',
                    fontSize: '11px',
                    color: '#767882'
                  }}
                >
                  <span>Use &larr; / &rarr; keys to switch steps</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '13px' }}>
                      verified_user
                    </span>
                    100% Client-Side Private Bridge
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ================= 5. COLLAPSIBLE FAQ & PRIVACY DRAWER ================= */}
        <TroubleshootingSheet />
      </div>

      <style>{`
        @keyframes m3RadarPulse {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};
