import React, { useState } from 'react';

interface FaqItem {
  id: string;
  question: string;
  answer: React.ReactNode;
  icon: string;
}

const FAQS: FaqItem[] = [
  {
    id: 'why-extension',
    question: 'Why does OurTube need a companion extension?',
    icon: 'lock_open',
    answer: (
      <div>
        <p style={{ margin: '0 0 8px 0' }}>
          Standard web browsers block direct audio streaming and library access from YouTube Music due to strict Cross-Origin Resource Sharing (CORS) security rules.
        </p>
        <p style={{ margin: 0 }}>
          The companion extension acts as an ultra-fast, local on-device bridge. It allows OurTube to stream pristine 256kbps Opus/AAC audio, bypass CORS barriers, and sync your playlists without needing Google Cloud API keys or external proxy servers.
        </p>
      </div>
    )
  },
  {
    id: 'privacy',
    question: 'Is my account or data safe?',
    icon: 'verified_user',
    answer: (
      <div>
        <p style={{ margin: '0 0 8px 0' }}>
          <strong>100% yes.</strong> Everything stays inside your local browser.
        </p>
        <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <li>No credentials, passwords, or cookies are ever transmitted to any third-party server.</li>
          <li>All audio streams connect directly from your machine to official YouTube Music servers.</li>
          <li>The extension is open-source MV3 (Manifest V3) and inspectable in your download folder.</li>
        </ul>
      </div>
    )
  },
  {
    id: 'dev-mode-disabled',
    question: 'Developer mode toggle is greyed out or missing?',
    icon: 'admin_panel_settings',
    answer: (
      <div>
        <p style={{ margin: '0 0 8px 0' }}>
          If Developer Mode is disabled, your browser is likely managed by a school, university, or enterprise workplace organization policy.
        </p>
        <p style={{ margin: 0 }}>
          To resolve this, open your browser under a personal (unmanaged) profile, or use Brave / Chromium on your personal device where local extensions are permitted.
        </p>
      </div>
    )
  },
  {
    id: 'unzip-help',
    question: 'How do I extract the downloaded .zip correctly?',
    icon: 'folder_zip',
    answer: (
      <div>
        <p style={{ margin: '0 0 8px 0' }}>
          <strong>Windows:</strong> Open your Downloads folder, right-click <code>ourtube-companion.zip</code> &rarr; select <strong>Extract All...</strong> &rarr; click <strong>Extract</strong>.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Mac:</strong> Double-click <code>ourtube-companion.zip</code> in Downloads. It will instantly extract into a folder named <code>ourtube-companion</code>. Select that folder when clicking &ldquo;Load unpacked&rdquo;.
        </p>
      </div>
    )
  }
];

export const TroubleshootingSheet: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenFaq((prev) => (prev === id ? null : id));
  };

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: '#15171c',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '20px 24px',
        marginTop: '24px'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '16px'
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: 'rgba(168, 199, 250, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--md-sys-color-primary, #a8c7fa)'
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
            help_outline
          </span>
        </div>
        <h3
          style={{
            fontSize: '15px',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: '#ffffff',
            margin: 0
          }}
        >
          Frequently Asked Questions &amp; Architecture
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {FAQS.map((item) => {
          const isOpen = openFaq === item.id;
          return (
            <div
              key={item.id}
              style={{
                borderRadius: '10px',
                backgroundColor: isOpen ? '#1d2026' : '#181a20',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                overflow: 'hidden',
                transition: 'all 200ms ease'
              }}
            >
              <button
                type="button"
                onClick={() => toggle(item.id)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: 'none',
                  background: 'none',
                  color: '#e2e2e6',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    className="material-symbols-rounded"
                    style={{ fontSize: '18px', color: 'var(--md-sys-color-primary, #a8c7fa)' }}
                  >
                    {item.icon}
                  </span>
                  <span>{item.question}</span>
                </div>
                <span
                  className="material-symbols-rounded"
                  style={{
                    fontSize: '18px',
                    color: '#8e9099',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 200ms ease'
                  }}
                >
                  expand_more
                </span>
              </button>

              {isOpen && (
                <div
                  style={{
                    padding: '0 16px 14px 44px',
                    fontSize: '12px',
                    lineHeight: 1.6,
                    color: '#c4c6cf',
                    borderTop: '1px solid rgba(255, 255, 255, 0.04)'
                  }}
                >
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
