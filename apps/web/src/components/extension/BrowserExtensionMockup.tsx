import React, { useState } from 'react';
import { SupportedBrowser, BROWSER_CONFIGS } from './BrowserSelectorPills';

interface BrowserExtensionMockupProps {
  currentStep: number; // 1, 2, 3, or 4
  browser: SupportedBrowser;
  isDevModeActive?: boolean;
  onToggleDevMode?: () => void;
  isConnected?: boolean;
  copiedUrl?: boolean;
  onCopyUrl?: () => void;
}

export const BrowserExtensionMockup: React.FC<BrowserExtensionMockupProps> = ({
  currentStep,
  browser,
  isDevModeActive = false,
  onToggleDevMode,
  isConnected = false,
  copiedUrl = false,
  onCopyUrl
}) => {
  const [internalDevMode, setInternalDevMode] = useState(isDevModeActive || currentStep >= 3);
  const [copiedPill, setCopiedPill] = useState(false);

  const browserConfig = BROWSER_CONFIGS[browser];
  const devModeEnabled = onToggleDevMode ? isDevModeActive : internalDevMode;

  const handleToggle = () => {
    if (onToggleDevMode) {
      onToggleDevMode();
    } else {
      setInternalDevMode((prev) => !prev);
    }
  };

  const handleCopy = () => {
    if (onCopyUrl) {
      onCopyUrl();
    } else {
      navigator.clipboard.writeText(browserConfig.url);
      setCopiedPill(true);
      setTimeout(() => setCopiedPill(false), 2000);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        borderRadius: '16px',
        backgroundColor: '#16181d',
        border: '1px solid rgba(255, 255, 255, 0.09)',
        boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.56)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Roboto Flex', system-ui, -apple-system, sans-serif",
        position: 'relative'
      }}
    >
      {/* 1. Browser Window Chrome Header (Tabs + Controls) */}
      <div
        style={{
          height: '42px',
          backgroundColor: '#0e1013',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          gap: '12px'
        }}
      >
        {/* Window controls (traffic lights) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#ff5f56' }} />
          <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
          <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#27c93f' }} />
        </div>

        {/* Browser Tab */}
        <div
          style={{
            height: '30px',
            backgroundColor: '#1c1e24',
            borderRadius: '8px 8px 0 0',
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            fontWeight: 500,
            color: '#e2e2e6',
            maxWidth: '200px',
            borderTop: '2px solid var(--md-sys-color-primary, #a8c7fa)'
          }}
        >
          <span
            className="material-symbols-rounded"
            style={{ fontSize: '15px', color: 'var(--md-sys-color-primary, #a8c7fa)' }}
          >
            extension
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Extensions
          </span>
          <span style={{ fontSize: '11px', color: '#767882', marginLeft: 'auto' }}>&times;</span>
        </div>

        <div style={{ color: '#44474f', fontSize: '14px', cursor: 'default' }}>+</div>
      </div>

      {/* 2. Address / Navigation Bar */}
      <div
        style={{
          height: '44px',
          backgroundColor: '#131519',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: '10px'
        }}
      >
        {/* Nav arrows */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#686a73' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>arrow_back</span>
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>arrow_forward</span>
          <span className="material-symbols-rounded" style={{ fontSize: '17px' }}>refresh</span>
        </div>

        {/* URL Bar */}
        <div
          style={{
            flex: 1,
            height: '28px',
            backgroundColor: '#1f2229',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: '8px',
            border: currentStep === 2
              ? '1px solid var(--md-sys-color-primary, #a8c7fa)'
              : '1px solid rgba(255, 255, 255, 0.07)',
            transition: 'border-color 200ms ease'
          }}
        >
          <span
            className="material-symbols-rounded"
            style={{ fontSize: '14px', color: '#8e9099' }}
          >
            tune
          </span>
          <span
            style={{
              fontSize: '12px',
              color: '#d3e3fd',
              fontWeight: 500,
              letterSpacing: '0.01em',
              flex: 1
            }}
          >
            {browserConfig.url}
          </span>

          {/* Copy URL Pill */}
          <button
            type="button"
            onClick={handleCopy}
            title={`Copy ${browserConfig.url}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: (copiedUrl || copiedPill)
                ? 'rgba(128, 203, 196, 0.2)'
                : 'rgba(255, 255, 255, 0.08)',
              border: (copiedUrl || copiedPill)
                ? '1px solid #80cbc4'
                : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '9999px',
              color: (copiedUrl || copiedPill) ? '#80cbc4' : '#e2e2e6',
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              cursor: 'pointer',
              transition: 'all 180ms ease'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '12px' }}>
              {(copiedUrl || copiedPill) ? 'check' : 'content_copy'}
            </span>
            {(copiedUrl || copiedPill) ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* 3. Extension Management Top Bar (Extensions Branding + Dev Mode Toggle) */}
      <div
        style={{
          padding: '12px 18px',
          backgroundColor: '#16181d',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}
      >
        {/* Left: Extension branding & actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '20px', color: '#91909a' }}>
            menu
          </span>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
            Extensions
          </div>

          {/* Load Unpacked Button (Visible when dev mode is active or highlighted in step 3) */}
          <div
            style={{
              display: (devModeEnabled || currentStep >= 3) ? 'flex' : 'none',
              alignItems: 'center',
              gap: '6px',
              marginLeft: '8px'
            }}
          >
            <button
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '9999px',
                border: currentStep === 3
                  ? '1.5px solid var(--md-sys-color-primary, #a8c7fa)'
                  : '1px solid rgba(255, 255, 255, 0.12)',
                backgroundColor: currentStep === 3
                  ? 'var(--md-sys-color-primary, #a8c7fa)'
                  : 'rgba(255, 255, 255, 0.05)',
                color: currentStep === 3
                  ? 'var(--md-sys-color-on-primary, #083063)'
                  : '#e2e2e6',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: currentStep === 3
                  ? '0 0 20px rgba(168, 199, 250, 0.35)'
                  : 'none',
                transition: 'all 250ms cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>
                folder_open
              </span>
              Load unpacked
            </button>

            <span
              style={{
                fontSize: '11px',
                color: '#767882',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)'
              }}
            >
              Pack extension
            </span>
          </div>
        </div>

        {/* Right: Developer Mode Switch (Interactive!) */}
        <div
          onClick={handleToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '5px 10px',
            borderRadius: '9999px',
            backgroundColor: currentStep === 2
              ? 'rgba(168, 199, 250, 0.12)'
              : 'transparent',
            border: currentStep === 2
              ? '1px solid rgba(168, 199, 250, 0.4)'
              : '1px solid transparent',
            cursor: 'pointer',
            transition: 'all 200ms ease',
            position: 'relative'
          }}
          title="Click to toggle Developer mode"
        >
          {/* Highlight indicator in Step 2 */}
          {currentStep === 2 && (
            <span
              style={{
                position: 'absolute',
                top: '-8px',
                right: '4px',
                backgroundColor: 'var(--md-sys-color-primary, #a8c7fa)',
                color: 'var(--md-sys-color-on-primary, #083063)',
                fontSize: '10px',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '9999px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                animation: 'm3PulseGlow 2s infinite'
              }}
            >
              Toggle Here
            </span>
          )}

          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: devModeEnabled ? '#ffffff' : '#91909a'
            }}
          >
            Developer mode
          </span>

          {/* Material 3 Switch */}
          <div
            style={{
              width: '36px',
              height: '20px',
              borderRadius: '9999px',
              backgroundColor: devModeEnabled
                ? 'var(--md-sys-color-primary, #a8c7fa)'
                : '#33353a',
              position: 'relative',
              transition: 'background-color 200ms cubic-bezier(0.2, 0, 0, 1)'
            }}
          >
            <div
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: devModeEnabled
                  ? 'var(--md-sys-color-on-primary, #083063)'
                  : '#8e9099',
                position: 'absolute',
                top: '3px',
                left: devModeEnabled ? '19px' : '3px',
                transition: 'all 250ms cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            />
          </div>
        </div>
      </div>

      {/* 4. Main Stage Area (Content alters by Step) */}
      <div
        style={{
          padding: '24px 20px',
          minHeight: '260px',
          backgroundColor: '#121418',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative'
        }}
      >
        {/* STEP 1: Download & Extract Illustration */}
        {currentStep === 1 && (
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              animation: 'm3FadeIn 300ms ease'
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                gap: '12px',
                alignItems: 'center'
              }}
            >
              {/* Zip Archive Card */}
              <div
                style={{
                  backgroundColor: '#1a1c22',
                  borderRadius: '12px',
                  padding: '16px 14px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '8px'
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(242, 139, 130, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f28b82'
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '24px' }}>
                    folder_zip
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
                    ourtube-companion.zip
                  </div>
                  <div style={{ fontSize: '11px', color: '#8e9099', marginTop: '2px' }}>
                    192 KB &bull; MV3
                  </div>
                </div>
              </div>

              {/* Extraction Arrow */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  color: 'var(--md-sys-color-primary, #a8c7fa)',
                  gap: '4px'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
                  arrow_forward
                </span>
                <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Extract
                </span>
              </div>

              {/* Extracted Folder Card */}
              <div
                style={{
                  backgroundColor: 'rgba(168, 199, 250, 0.08)',
                  borderRadius: '12px',
                  padding: '16px 14px',
                  border: '1px solid rgba(168, 199, 250, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '8px'
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--md-sys-color-primary, #a8c7fa)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--md-sys-color-on-primary, #083063)'
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '24px' }}>
                    folder
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
                    ourtube-companion/
                  </div>
                  <div style={{ fontSize: '11px', color: '#a8c7fa', marginTop: '2px' }}>
                    Unpacked Directory
                  </div>
                </div>
              </div>
            </div>

            {/* Folder contents list */}
            <div
              style={{
                backgroundColor: '#16181e',
                borderRadius: '10px',
                padding: '10px 14px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#91909a'
              }}
            >
              <span>Contains: <code>manifest.json</code>, <code>bridge.js</code>, <code>serviceWorker.js</code></span>
              <span style={{ color: '#80cbc4', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>verified</span>
                Ready to load
              </span>
            </div>
          </div>
        )}

        {/* STEP 2: Dev Mode Spotlight & Guide */}
        {currentStep === 2 && (
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '16px',
              animation: 'm3FadeIn 300ms ease'
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: devModeEnabled
                  ? 'rgba(128, 203, 196, 0.15)'
                  : 'rgba(168, 199, 250, 0.15)',
                border: devModeEnabled
                  ? '2px solid #80cbc4'
                  : '2px dashed var(--md-sys-color-primary, #a8c7fa)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: devModeEnabled ? '#80cbc4' : 'var(--md-sys-color-primary, #a8c7fa)',
                transition: 'all 300ms ease'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '32px' }}>
                {devModeEnabled ? 'check_circle' : 'toggle_on'}
              </span>
            </div>

            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 6px 0' }}>
                {devModeEnabled ? 'Developer Mode Active!' : 'Turn On Developer Mode'}
              </h3>
              <p style={{ fontSize: '13px', color: '#91909a', lineHeight: 1.5, margin: 0 }}>
                {devModeEnabled
                  ? "Great! The 'Load unpacked' button is now revealed in your browser."
                  : `In ${browserConfig.name}, look at the top-right corner of the Extensions tab and toggle Developer mode ON.`}
              </p>
            </div>

            {/* Quick Interactive Prompt */}
            <button
              type="button"
              onClick={handleToggle}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: devModeEnabled
                  ? 'rgba(128, 203, 196, 0.2)'
                  : 'var(--md-sys-color-primary, #a8c7fa)',
                color: devModeEnabled
                  ? '#80cbc4'
                  : 'var(--md-sys-color-on-primary, #083063)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 200ms ease'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                {devModeEnabled ? 'done_all' : 'touch_app'}
              </span>
              {devModeEnabled ? 'Simulation: Toggled ON' : 'Try Clicking the Switch Above'}
            </button>
          </div>
        )}

        {/* STEP 3: Load Unpacked Visual Simulation */}
        {currentStep === 3 && (
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              animation: 'm3FadeIn 300ms ease'
            }}
          >
            {/* Folder selection dialog simulation */}
            <div
              style={{
                backgroundColor: '#1b1d24',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '16px',
                boxShadow: '0 16px 36px rgba(0,0,0,0.4)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '16px', color: '#a8c7fa' }}>
                    file_open
                  </span>
                  Select Extension Directory
                </div>
                <span style={{ fontSize: '11px', color: '#767882' }}>Downloads/</span>
              </div>

              {/* Selected Folder Highlight */}
              <div
                style={{
                  backgroundColor: 'rgba(168, 199, 250, 0.12)',
                  border: '1.5px solid var(--md-sys-color-primary, #a8c7fa)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '24px', color: 'var(--md-sys-color-primary, #a8c7fa)' }}>
                  folder
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                    ourtube-companion
                  </div>
                  <div style={{ fontSize: '11px', color: '#91909a' }}>
                    Unzipped directory containing manifest.json
                  </div>
                </div>
                <span
                  style={{
                    backgroundColor: 'var(--md-sys-color-primary, #a8c7fa)',
                    color: 'var(--md-sys-color-on-primary, #083063)',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '6px'
                  }}
                >
                  Select Folder
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '12px', color: '#91909a' }}>
              Click <strong>&ldquo;Load unpacked&rdquo;</strong> in your browser &rarr; select the <code>ourtube-companion</code> folder.
            </div>
          </div>
        )}

        {/* STEP 4: Handshake & Extension Card Simulation */}
        {currentStep === 4 && (
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              animation: 'm3FadeIn 300ms ease'
            }}
          >
            {/* Extension Tile in Chrome */}
            <div
              style={{
                backgroundColor: '#1b1d24',
                borderRadius: '12px',
                border: isConnected
                  ? '1.5px solid #80cbc4'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                padding: '16px',
                display: 'flex',
                gap: '14px',
                alignItems: 'flex-start',
                position: 'relative',
                boxShadow: isConnected
                  ? '0 0 32px rgba(128, 203, 196, 0.25)'
                  : 'none',
                transition: 'all 300ms ease'
              }}
            >
              {/* Extension Icon */}
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#e53935',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  flexShrink: 0
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '24px' }}>
                  play_arrow
                </span>
              </div>

              {/* Extension Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                    OurTube Companion
                  </span>
                  <span style={{ fontSize: '11px', color: '#8e9099' }}>1.0.0</span>
                </div>
                <div style={{ fontSize: '11px', color: '#91909a', marginTop: '3px', lineHeight: 1.4 }}>
                  Local CORS bypass bridge &amp; full fidelity audio stream resolver.
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', fontSize: '11px' }}>
                  <span style={{ color: '#8ab4f8' }}>Details</span>
                  <span style={{ color: '#8e9099' }}>&bull;</span>
                  <span style={{ color: isConnected ? '#80cbc4' : '#f28b82', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: isConnected ? '#80cbc4' : '#f28b82',
                        animation: isConnected ? 'm3PulseGlow 1.5s infinite' : 'none'
                      }}
                    />
                    {isConnected ? 'Bridge Active & Ready' : 'Listening on tab switch...'}
                  </span>
                </div>
              </div>

              {/* Active Toggle */}
              <div
                style={{
                  width: '32px',
                  height: '18px',
                  borderRadius: '9999px',
                  backgroundColor: isConnected ? '#80cbc4' : 'var(--md-sys-color-primary, #a8c7fa)',
                  position: 'relative'
                }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#083063',
                    position: 'absolute',
                    top: '3px',
                    right: '3px'
                  }}
                />
              </div>
            </div>

            {/* Radar status message */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '12px',
                color: isConnected ? '#80cbc4' : '#91909a'
              }}
            >
              <span
                className="material-symbols-rounded"
                style={{
                  fontSize: '16px',
                  animation: isConnected ? 'none' : 'm3RadarSpin 2s linear infinite'
                }}
              >
                {isConnected ? 'check_circle' : 'radar'}
              </span>
              <span>
                {isConnected
                  ? 'Companion handshake established! Unlocking player...'
                  : 'Switch to this tab after loading &bull; Auto-detects in real time'}
              </span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes m3PulseGlow {
          0% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 0.85; }
        }
        @keyframes m3FadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes m3RadarSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
