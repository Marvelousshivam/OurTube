import React, { useState, useEffect } from 'react';
import { bridgeClient } from '../../api/bridgeClient';

export const ExtensionRequiredGate: React.FC = () => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [checking, setChecking] = useState(false);
  const [browserName, setBrowserName] = useState('Chrome');
  const [extensionUrl, setExtensionUrl] = useState('chrome://extensions');

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('edg/')) {
        setBrowserName('Edge');
        setExtensionUrl('edge://extensions');
      } else if (ua.includes('brave') || (navigator as any).brave) {
        setBrowserName('Brave');
        setExtensionUrl('brave://extensions');
      } else {
        setBrowserName('Chrome');
        setExtensionUrl('chrome://extensions');
      }
    }
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(extensionUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleManualCheck = async () => {
    setChecking(true);
    await bridgeClient.checkNow();
    setTimeout(() => setChecking(false), 600);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#0f1013',
        color: '#e2e2e6',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        boxSizing: 'border-box',
        fontFamily: "'Roboto Flex', system-ui, -apple-system, sans-serif"
      }}
    >
      <div style={{ width: '100%', maxWidth: '560px' }}>
        {/* App Title & Subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#e53935',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <span
              className="material-symbols-rounded"
              style={{ fontSize: '20px', color: '#ffffff', marginLeft: '2px' }}
            >
              play_arrow
            </span>
          </div>
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              margin: 0,
              color: '#ffffff'
            }}
          >
            OurTube Companion
          </h1>
        </div>

        <p
          style={{
            fontSize: '13px',
            lineHeight: 1.5,
            color: '#91909a',
            margin: '0 0 24px 0'
          }}
        >
          OurTube relies on a companion extension to stream YouTube Music audio and sync your library without CORS restrictions or API keys. Playback cannot start until the extension is loaded.
        </p>

        {/* Status Section */}
        <div
          style={{
            backgroundColor: '#17181c',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            overflow: 'hidden',
            marginBottom: '20px'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              fontSize: '13px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}
          >
            <span style={{ color: '#91909a' }}>Status</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 500, color: '#f28b82' }}>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#f28b82'
                }}
              />
              Not installed
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              fontSize: '13px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}
          >
            <span style={{ color: '#91909a' }}>Latest build</span>
            <span style={{ color: '#c4c6cf' }}>v1.0.0 (Chromium MV3)</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              fontSize: '13px'
            }}
          >
            <span style={{ color: '#91909a' }}>Bridge listener</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#91909a' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#8ab4f8',
                  animation: 'pulse 1.8s infinite'
                }}
              />
              Listening on tab focus...
            </span>
          </div>
        </div>

        {/* Section Header */}
        <h2
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#8e9099',
            margin: '0 0 10px 4px'
          }}
        >
          Get the extension
        </h2>

        {/* Download Row */}
        <div
          style={{
            backgroundColor: '#17181c',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            overflow: 'hidden',
            marginBottom: '16px'
          }}
        >
          <a
            href="/downloads/ourtube-companion.zip"
            download="ourtube-companion.zip"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px 16px',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'background-color 150ms ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1f2025')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <span
              className="material-symbols-rounded"
              style={{ fontSize: '24px', color: '#e53935', flexShrink: 0 }}
            >
              download_for_offline
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
                Download for {browserName} (.zip)
              </div>
              <div style={{ fontSize: '12px', color: '#91909a', marginTop: '2px' }}>
                Chrome, Brave, Edge &amp; Chromium &middot; 192 KB
              </div>
            </div>
            <span
              className="material-symbols-rounded"
              style={{ fontSize: '20px', color: '#686a73' }}
            >
              chevron_right
            </span>
          </a>
        </div>

        {/* Installation Steps */}
        <div
          style={{
            backgroundColor: '#17181c',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            padding: '16px 20px',
            marginBottom: '20px'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#8e9099', marginBottom: '12px' }}>
            Installation Steps
          </div>

          <ol
            style={{
              margin: 0,
              paddingLeft: '18px',
              fontSize: '13px',
              lineHeight: 1.65,
              color: '#c4c6cf'
            }}
          >
            <li style={{ marginBottom: '8px' }}>
              Extract the downloaded <code style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '2px 5px', borderRadius: '4px', fontSize: '12px', color: '#ffffff' }}>ourtube-companion.zip</code> file. It contains a single folder: <code style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '2px 5px', borderRadius: '4px', fontSize: '12px', color: '#ffffff' }}>ourtube-companion/</code>.
            </li>
            <li style={{ marginBottom: '8px' }}>
              In a new tab, open{' '}
              <code style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '2px 5px', borderRadius: '4px', fontSize: '12px', color: '#ffffff' }}>
                {extensionUrl}
              </code>
              <button
                onClick={handleCopy}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '5px',
                  color: '#ffffff',
                  fontSize: '11px',
                  padding: '1px 6px',
                  marginLeft: '6px',
                  cursor: 'pointer',
                  verticalAlign: 'middle'
                }}
              >
                {copiedUrl ? 'Copied' : 'Copy'}
              </button>
              {' '}and turn on <strong>Developer mode</strong> (top-right toggle).
            </li>
            <li style={{ marginBottom: '8px' }}>
              Click <strong>Load unpacked</strong> (top-left) and select the extracted <code style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '2px 5px', borderRadius: '4px', fontSize: '12px', color: '#ffffff' }}>ourtube-companion</code> folder.
            </li>
            <li>
              Return to this tab: OurTube will detect the extension and unlock playback automatically.
            </li>
          </ol>
        </div>

        {/* Manual Check & Privacy Footnote */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#767882',
            padding: '0 4px'
          }}
        >
          <span>Sign-ins and streams stay on-device inside your browser.</span>
          <button
            onClick={handleManualCheck}
            disabled={checking}
            style={{
              background: 'none',
              border: 'none',
              color: checking ? '#767882' : '#8ab4f8',
              fontSize: '12px',
              fontWeight: 600,
              cursor: checking ? 'default' : 'pointer',
              padding: '4px 8px'
            }}
          >
            {checking ? 'Checking...' : 'Check now'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};
