import React from 'react';

export type SupportedBrowser = 'Chrome' | 'Edge' | 'Brave' | 'Chromium';

export interface BrowserConfig {
  id: SupportedBrowser;
  name: string;
  url: string;
  iconName: string;
  devModeLocation: string;
}

export const BROWSER_CONFIGS: Record<SupportedBrowser, BrowserConfig> = {
  Chrome: {
    id: 'Chrome',
    name: 'Google Chrome',
    url: 'chrome://extensions',
    iconName: 'browse',
    devModeLocation: 'Top-right corner toggle'
  },
  Brave: {
    id: 'Brave',
    name: 'Brave Browser',
    url: 'brave://extensions',
    iconName: 'shield',
    devModeLocation: 'Top-right corner toggle'
  },
  Edge: {
    id: 'Edge',
    name: 'Microsoft Edge',
    url: 'edge://extensions',
    iconName: 'language',
    devModeLocation: 'Left sidebar or top-right toggle'
  },
  Chromium: {
    id: 'Chromium',
    name: 'Chromium / Opera / Vivaldi',
    url: 'chrome://extensions',
    iconName: 'web',
    devModeLocation: 'Top-right corner toggle'
  }
};

interface BrowserSelectorPillsProps {
  selectedBrowser: SupportedBrowser;
  onSelectBrowser: (browser: SupportedBrowser) => void;
}

export const BrowserSelectorPills: React.FC<BrowserSelectorPillsProps> = ({
  selectedBrowser,
  onSelectBrowser
}) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px',
        backgroundColor: 'var(--md-sys-color-surface-container, #1d2024)',
        borderRadius: '9999px',
        border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))',
        gap: '4px',
        maxWidth: '100%',
        overflowX: 'auto'
      }}
    >
      {(Object.keys(BROWSER_CONFIGS) as SupportedBrowser[]).map((key) => {
        const config = BROWSER_CONFIGS[key];
        const isSelected = selectedBrowser === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectBrowser(key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '9999px',
              border: 'none',
              backgroundColor: isSelected
                ? 'var(--md-sys-color-primary, #a8c7fa)'
                : 'transparent',
              color: isSelected
                ? 'var(--md-sys-color-on-primary, #083063)'
                : 'var(--md-sys-color-on-surface-variant, #91909a)',
              fontSize: '12px',
              fontWeight: isSelected ? 600 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <span
              className="material-symbols-rounded"
              style={{ fontSize: '15px' }}
            >
              {config.iconName}
            </span>
            <span>{key}</span>
          </button>
        );
      })}
    </div>
  );
};
