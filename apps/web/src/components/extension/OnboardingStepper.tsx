import React from 'react';
import { SupportedBrowser, BROWSER_CONFIGS } from './BrowserSelectorPills';

export interface OnboardingStepperProps {
  currentStep: number;
  totalSteps: number;
  onSetStep: (step: number) => void;
  browser: SupportedBrowser;
  isChecking: boolean;
  onManualCheck: () => void;
  copiedUrl: boolean;
  onCopyUrl: () => void;
  isConnected: boolean;
}

export const OnboardingStepper: React.FC<OnboardingStepperProps> = ({
  currentStep,
  totalSteps,
  onSetStep,
  browser,
  isChecking,
  onManualCheck,
  copiedUrl,
  onCopyUrl,
  isConnected
}) => {
  const browserConfig = BROWSER_CONFIGS[browser];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%'
      }}
    >
      {/* 1. Step Progress Indicators (Pill Track) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '4px'
        }}
      >
        {[
          { num: 1, label: 'Download' },
          { num: 2, label: 'Dev Mode' },
          { num: 3, label: 'Load Unpacked' },
          { num: 4, label: 'Connect' }
        ].map((item) => {
          const isActive = currentStep === item.num;
          const isPassed = currentStep > item.num || isConnected;
          return (
            <button
              key={item.num}
              type="button"
              onClick={() => onSetStep(item.num)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '9999px',
                border: isActive
                  ? '1px solid var(--md-sys-color-primary, #a8c7fa)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: isActive
                  ? 'rgba(168, 199, 250, 0.12)'
                  : isPassed
                  ? 'rgba(128, 203, 196, 0.1)'
                  : '#17191e',
                color: isActive
                  ? '#ffffff'
                  : isPassed
                  ? '#80cbc4'
                  : '#8e9099',
                fontSize: '12px',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 200ms ease',
                whiteSpace: 'nowrap'
              }}
            >
              <span
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 700,
                  backgroundColor: isActive
                    ? 'var(--md-sys-color-primary, #a8c7fa)'
                    : isPassed
                    ? '#80cbc4'
                    : 'rgba(255, 255, 255, 0.12)',
                  color: isActive
                    ? 'var(--md-sys-color-on-primary, #083063)'
                    : isPassed
                    ? '#003731'
                    : '#e2e2e6'
                }}
              >
                {isPassed && currentStep !== item.num ? '✓' : item.num}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Step Narrative & Action Deck */}
      <div
        style={{
          backgroundColor: '#16181d',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {/* STEP 1: Download & Extract */}
        {currentStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--md-sys-color-primary, #a8c7fa)',
                  marginBottom: '4px'
                }}
              >
                Step 01 &bull; Get the package
              </div>
              <h2
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '24px',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: '#ffffff',
                  margin: '0 0 8px 0'
                }}
              >
                Download the Companion Extension
              </h2>
              <p
                style={{
                  fontSize: '13px',
                  lineHeight: 1.6,
                  color: '#91909a',
                  margin: 0
                }}
              >
                The extension contains the local audio bridge and MV3 service worker. It runs 100% locally on your machine with zero remote tracking.
              </p>
            </div>

            {/* Big Tactile Download Button */}
            <a
              href="/downloads/ourtube-companion.zip"
              download="ourtube-companion.zip"
              onClick={() => {
                // Auto-advance prompt after short delay
                setTimeout(() => onSetStep(2), 1200);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderRadius: '14px',
                backgroundColor: 'var(--md-sys-color-primary, #a8c7fa)',
                color: 'var(--md-sys-color-on-primary, #083063)',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '14px',
                boxShadow: '0 8px 24px -4px rgba(168, 199, 250, 0.4)',
                transition: 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 180ms ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 12px 32px -4px rgba(168, 199, 250, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 8px 24px -4px rgba(168, 199, 250, 0.4)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '26px' }}>
                  download
                </span>
                <div>
                  <div>Download ourtube-companion.zip</div>
                  <div style={{ fontSize: '11px', opacity: 0.85, fontWeight: 500, marginTop: '2px' }}>
                    192 KB &bull; Pre-bundled Manifest V3 for {browserConfig.name}
                  </div>
                </div>
              </div>
              <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
                arrow_forward
              </span>
            </a>

            {/* Unzip Quick Tip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                backgroundColor: '#1b1d24',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '12px',
                color: '#c4c6cf'
              }}
            >
              <span
                className="material-symbols-rounded"
                style={{ fontSize: '18px', color: '#80cbc4', flexShrink: 0, marginTop: '1px' }}
              >
                info
              </span>
              <div>
                <strong>Remember to Extract:</strong> Unzip the file after downloading. You will need the extracted folder named <code style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '4px', color: '#ffffff' }}>ourtube-companion</code> in Step 3.
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Enable Developer Mode */}
        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--md-sys-color-primary, #a8c7fa)',
                  marginBottom: '4px'
                }}
              >
                Step 02 &bull; Browser configuration
              </div>
              <h2
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '24px',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: '#ffffff',
                  margin: '0 0 8px 0'
                }}
              >
                Turn On Developer Mode
              </h2>
              <p
                style={{
                  fontSize: '13px',
                  lineHeight: 1.6,
                  color: '#91909a',
                  margin: 0
                }}
              >
                Chromium browsers require Developer mode to be enabled before they allow loading unpacked local extensions.
              </p>
            </div>

            {/* Direct URL launcher card */}
            <div
              style={{
                backgroundColor: '#1b1d24',
                borderRadius: '12px',
                padding: '14px 16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ fontSize: '11px', color: '#8e9099', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                1. Open Extensions in a new tab
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#121418',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}
              >
                <code style={{ fontSize: '13px', color: '#a8c7fa', fontWeight: 600 }}>
                  {browserConfig.url}
                </code>
                <button
                  type="button"
                  onClick={onCopyUrl}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: copiedUrl ? 'rgba(128, 203, 196, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    color: copiedUrl ? '#80cbc4' : '#ffffff',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '13px' }}>
                    {copiedUrl ? 'check' : 'content_copy'}
                  </span>
                  {copiedUrl ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div style={{ fontSize: '11px', color: '#8e9099', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginTop: '6px' }}>
                2. Flip the switch
              </div>
              <div style={{ fontSize: '13px', color: '#e2e2e6', lineHeight: 1.5 }}>
                Look at the <strong>{browserConfig.devModeLocation}</strong> and toggle <strong>Developer mode</strong> to <span style={{ color: '#80cbc4', fontWeight: 600 }}>ON</span>.
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Load Unpacked */}
        {currentStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--md-sys-color-primary, #a8c7fa)',
                  marginBottom: '4px'
                }}
              >
                Step 03 &bull; Installation
              </div>
              <h2
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '24px',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: '#ffffff',
                  margin: '0 0 8px 0'
                }}
              >
                Click &ldquo;Load unpacked&rdquo;
              </h2>
              <p
                style={{
                  fontSize: '13px',
                  lineHeight: 1.6,
                  color: '#91909a',
                  margin: 0
                }}
              >
                With Developer mode active, a top action bar appears in your browser with three buttons.
              </p>
            </div>

            <ol
              style={{
                margin: 0,
                paddingLeft: '18px',
                fontSize: '13px',
                lineHeight: 1.7,
                color: '#c4c6cf',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <li>
                Click the <strong>Load unpacked</strong> button on the top-left of the Extensions tab.
              </li>
              <li>
                Navigate to your Downloads folder and select the extracted <code style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '2px 5px', borderRadius: '4px', color: '#ffffff' }}>ourtube-companion</code> directory.
              </li>
              <li>
                Click <strong>Select Folder</strong> (or Open). OurTube will immediately register in the extension roster!
              </li>
            </ol>
          </div>
        )}

        {/* STEP 4: Bridge Handshake */}
        {currentStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: isConnected ? '#80cbc4' : 'var(--md-sys-color-primary, #a8c7fa)',
                  marginBottom: '4px'
                }}
              >
                Step 04 &bull; Handshake
              </div>
              <h2
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '24px',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: '#ffffff',
                  margin: '0 0 8px 0'
                }}
              >
                {isConnected ? 'Companion Connected!' : 'Waiting for Bridge Handshake'}
              </h2>
              <p
                style={{
                  fontSize: '13px',
                  lineHeight: 1.6,
                  color: '#91909a',
                  margin: 0
                }}
              >
                {isConnected
                  ? 'The local extension bridge is verified. Unlocking your music player, search, and library now.'
                  : 'Return to this tab after loading the extension. The bridge pings automatically on focus!'}
              </p>
            </div>

            {/* Live Status Pill & Manual Trigger */}
            <div
              style={{
                backgroundColor: '#1b1d24',
                borderRadius: '12px',
                padding: '16px',
                border: isConnected
                  ? '1.5px solid #80cbc4'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: isConnected ? '#80cbc4' : '#8ab4f8',
                    animation: isConnected ? 'none' : 'm3RadarSpin 2s infinite'
                  }}
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                    {isConnected ? 'Bridge Ready' : 'Listening on tab focus...'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#8e9099' }}>
                    {isConnected ? 'All channels unlocked' : 'Switch between tabs or trigger manual check'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onManualCheck}
                disabled={isChecking || isConnected}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: isConnected
                    ? '#80cbc4'
                    : 'var(--md-sys-color-primary, #a8c7fa)',
                  color: isConnected
                    ? '#003731'
                    : 'var(--md-sys-color-on-primary, #083063)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: (isChecking || isConnected) ? 'default' : 'pointer',
                  opacity: isChecking ? 0.7 : 1,
                  transition: 'all 200ms ease'
                }}
              >
                <span
                  className="material-symbols-rounded"
                  style={{
                    fontSize: '16px',
                    animation: isChecking ? 'm3RadarSpin 1s linear infinite' : 'none'
                  }}
                >
                  {isConnected ? 'done_all' : isChecking ? 'sync' : 'refresh'}
                </span>
                {isConnected ? 'Connected' : isChecking ? 'Checking...' : 'Check now'}
              </button>
            </div>
          </div>
        )}

        {/* Navigation Actions (Previous / Next) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            marginTop: '8px'
          }}
        >
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => onSetStep(currentStep - 1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '9999px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'transparent',
              color: currentStep === 1 ? '#555861' : '#c4c6cf',
              fontSize: '12px',
              fontWeight: 600,
              cursor: currentStep === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
              arrow_back
            </span>
            Previous
          </button>

          <div style={{ fontSize: '12px', color: '#767882', fontWeight: 500 }}>
            Step {currentStep} of {totalSteps}
          </div>

          <button
            type="button"
            disabled={currentStep === totalSteps}
            onClick={() => onSetStep(currentStep + 1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 16px',
              borderRadius: '9999px',
              border: 'none',
              backgroundColor: currentStep === totalSteps
                ? '#2a2d36'
                : 'var(--md-sys-color-primary, #a8c7fa)',
              color: currentStep === totalSteps
                ? '#767882'
                : 'var(--md-sys-color-on-primary, #083063)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: currentStep === totalSteps ? 'default' : 'pointer'
            }}
          >
            Next
            <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
              arrow_forward
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
