import React, { useState, useEffect } from 'react';
import { bridgeClient, ExtensionConnectionState } from '../../api/bridgeClient';

export const ExtensionRequiredGate: React.FC = () => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [checking, setChecking] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [browserType, setBrowserType] = useState<'chrome' | 'edge' | 'brave'>('chrome');

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('edg/')) {
        setBrowserType('edge');
      } else if (ua.includes('brave') || (navigator as any).brave) {
        setBrowserType('brave');
      } else {
        setBrowserType('chrome');
      }
    }
  }, []);

  const getExtensionsUrl = () => {
    switch (browserType) {
      case 'edge':
        return 'edge://extensions';
      case 'brave':
        return 'brave://extensions';
      default:
        return 'chrome://extensions';
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(getExtensionsUrl());
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleManualCheck = async () => {
    setChecking(true);
    await bridgeClient.checkNow();
    setTimeout(() => setChecking(false), 800);
  };

  const handleDownload = () => {
    setDownloadStarted(true);
    const link = document.createElement('a');
    link.href = '/downloads/ourtube-companion.zip';
    link.download = 'ourtube-companion.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloadStarted(false), 3000);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--md-sys-color-surface, #121316)',
        color: 'var(--md-sys-color-on-surface, #e2e2e6)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px 64px',
        boxSizing: 'border-box',
        position: 'relative',
        overflowX: 'hidden',
        fontFamily: "'Roboto Flex', system-ui, -apple-system, sans-serif"
      }}
    >
      {/* Subtle Ambient Radial Tonal Glow */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '700px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(229, 57, 53, 0.12) 0%, rgba(18, 19, 22, 0) 70%)',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* Main Content Container */}
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '820px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '32px'
        }}
      >
        {/* Header Branding */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '14px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 16px',
              borderRadius: '9999px',
              backgroundColor: 'var(--md-sys-color-surface-container-high, #24252a)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: 'var(--md-sys-color-primary, #ff897d)'
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--md-sys-color-primary, #ff897d)',
                display: 'inline-block',
                boxShadow: '0 0 8px var(--md-sys-color-primary, #ff897d)'
              }}
            />
            Companion Bridge Required
          </div>

          <h1
            style={{
              fontSize: 'clamp(32px, 5vw, 48px)',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              margin: '8px 0 0',
              fontFamily: "'Playfair Display', Georgia, serif",
              color: '#ffffff',
              maxWidth: '680px'
            }}
          >
            Play YouTube Music with the OurTube Companion.
          </h1>

          <p
            style={{
              fontSize: '16px',
              lineHeight: 1.6,
              color: 'var(--md-sys-color-on-surface-variant, #c4c6d0)',
              maxWidth: '620px',
              margin: 0
            }}
          >
            Because modern browsers restrict cross-origin YouTube InnerTube endpoints, OurTube runs a local companion extension to stream direct high-bitrate audio and sync your library securely with <strong>zero API keys</strong>.
          </p>
        </div>

        {/* Primary Action Button & Status Pill */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
            <button
              onClick={handleDownload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                height: '54px',
                padding: '0 28px',
                borderRadius: '9999px',
                backgroundColor: '#e53935',
                color: '#ffffff',
                border: 'none',
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(229, 57, 53, 0.35)',
                transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#d32f2f';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 28px rgba(229, 57, 53, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#e53935';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(229, 57, 53, 0.35)';
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '24px' }}>
                download
              </span>
              <span>{downloadStarted ? 'Downloading...' : 'Download Companion (.zip)'}</span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  opacity: 0.85,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)'
                }}
              >
                192 KB
              </span>
            </button>

            <button
              onClick={handleManualCheck}
              disabled={checking}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                height: '54px',
                padding: '0 24px',
                borderRadius: '9999px',
                backgroundColor: 'var(--md-sys-color-surface-container-high, #24252a)',
                color: 'var(--md-sys-color-on-surface, #e2e2e6)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                fontSize: '15px',
                fontWeight: 600,
                cursor: checking ? 'default' : 'pointer',
                transition: 'all 200ms ease'
              }}
              onMouseEnter={(e) => {
                if (!checking) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
              }}
              onMouseLeave={(e) => {
                if (!checking) e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high, #24252a)';
              }}
            >
              <span
                className="material-symbols-rounded"
                style={{
                  fontSize: '20px',
                  animation: checking ? 'spin 1s linear infinite' : 'none'
                }}
              >
                refresh
              </span>
              <span>{checking ? 'Checking Bridge...' : 'Check Connection'}</span>
            </button>
          </div>

          {/* Active Listening Radar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13px',
              color: 'var(--md-sys-color-on-surface-variant, #91909a)'
            }}
          >
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#ffb4ab',
                animation: 'pulse 2s infinite ease-in-out'
              }}
            />
            <span>Listening for Companion... Unlocks automatically the moment you load the unpacked folder.</span>
          </div>
        </div>

        {/* Step-by-Step Installation Tutorial */}
        <section
          style={{
            width: '100%',
            backgroundColor: 'var(--md-sys-color-surface-container-low, #1b1c20)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '32px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '24px', color: 'var(--md-sys-color-primary, #ff897d)' }}>
                extension
              </span>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
                4-Step Installation Guide
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {(['chrome', 'edge', 'brave'] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBrowserType(b)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: browserType === b ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                    color: browserType === b ? '#ffffff' : 'var(--md-sys-color-on-surface-variant, #91909a)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px'
            }}
          >
            {/* Step 1 */}
            <div
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container, #202126)',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(229, 57, 53, 0.2)',
                    color: '#ff897d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 800
                  }}
                >
                  1
                </span>
                <span style={{ fontSize: '15px', fontWeight: 700 }}>Extract the Zip</span>
              </div>
              <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--md-sys-color-on-surface-variant, #91909a)', margin: 0 }}>
                Extract <code style={{ color: '#ffffff', backgroundColor: 'rgba(255, 255, 255, 0.08)', padding: '2px 6px', borderRadius: '4px' }}>ourtube-companion.zip</code> somewhere you will keep it. It contains a single tidy folder: <code style={{ color: '#ffffff', backgroundColor: 'rgba(255, 255, 255, 0.08)', padding: '2px 6px', borderRadius: '4px' }}>ourtube-companion/</code>.
              </p>
            </div>

            {/* Step 2 */}
            <div
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container, #202126)',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(229, 57, 53, 0.2)',
                      color: '#ff897d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 800
                    }}
                  >
                    2
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 700 }}>Open Extensions</span>
                </div>

                <button
                  onClick={handleCopyUrl}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '4px 8px',
                    cursor: 'pointer'
                  }}
                  title="Copy URL"
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>
                    {copiedUrl ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--md-sys-color-on-surface-variant, #91909a)', margin: 0 }}>
                Paste <code style={{ color: '#ffffff', backgroundColor: 'rgba(255, 255, 255, 0.08)', padding: '2px 6px', borderRadius: '4px' }}>{getExtensionsUrl()}</code> into a new browser tab.
              </p>
            </div>

            {/* Step 3 */}
            <div
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container, #202126)',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(229, 57, 53, 0.2)',
                    color: '#ff897d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 800
                  }}
                >
                  3
                </span>
                <span style={{ fontSize: '15px', fontWeight: 700 }}>Enable Developer Mode</span>
              </div>
              <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--md-sys-color-on-surface-variant, #91909a)', margin: 0 }}>
                In the top-right corner of the Extensions page, turn on the <strong>Developer mode</strong> toggle switch.
              </p>
            </div>

            {/* Step 4 */}
            <div
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container, #202126)',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(229, 57, 53, 0.2)',
                    color: '#ff897d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 800
                  }}
                >
                  4
                </span>
                <span style={{ fontSize: '15px', fontWeight: 700 }}>Load Unpacked</span>
              </div>
              <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--md-sys-color-on-surface-variant, #91909a)', margin: 0 }}>
                Click <strong>Load unpacked</strong> on the top-left and select the extracted <code style={{ color: '#ffffff', backgroundColor: 'rgba(255, 255, 255, 0.08)', padding: '2px 6px', borderRadius: '4px' }}>ourtube-companion</code> folder. Come right back: OurTube unlocks automatically!
              </p>
            </div>
          </div>

          {/* Privacy Note */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '12px',
              color: 'var(--md-sys-color-on-surface-variant, #91909a)'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#ffb4ab' }}>
              security
            </span>
            <span>
              <strong>100% Private &amp; On-Device</strong>: The companion extension operates entirely inside your local browser. It never connects to any external analytics, trackers, or middleman servers.
            </span>
          </div>
        </section>
      </main>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.6; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
