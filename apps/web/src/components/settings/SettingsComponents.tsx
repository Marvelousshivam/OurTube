import React from 'react';

// Section Header with uppercase tracking
export const SettingsSectionHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div style={{ marginBottom: '10px', marginTop: '22px', paddingLeft: '4px' }}>
    <h3
      style={{
        fontSize: '11px',
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--md-sys-color-primary)',
        margin: 0
      }}
    >
      {title}
    </h3>
    {subtitle && (
      <p style={{ fontSize: '12px', color: 'var(--md-sys-color-outline)', margin: '3px 0 0 0' }}>
        {subtitle}
      </p>
    )}
  </div>
);

// Segmented continuous Card
export const SettingsCard: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style
}) => (
  <div
    style={{
      backgroundColor: 'var(--md-sys-color-surface-container-low)',
      borderRadius: '24px',
      border: '1px solid var(--md-sys-color-outline-variant)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      ...style
    }}
  >
    {children}
  </div>
);

// Subtle Divider inside Card
export const SettingsDivider: React.FC = () => (
  <div
    style={{
      height: '1px',
      backgroundColor: 'var(--md-sys-color-outline-variant)',
      opacity: 0.4,
      margin: '0 20px'
    }}
  />
);

// Standard Settings Row with Squircle Icon, Title, Live Value, and optional Chevron or Action
export interface SettingsRowProps {
  icon?: string;
  iconBg?: string;
  iconColor?: string;
  title: string;
  value?: string | React.ReactNode;
  detail?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  iconBg,
  iconColor,
  title,
  value,
  detail,
  onClick,
  trailing,
  showChevron = false,
  destructive = false,
  disabled = false
}) => {
  const isClickable = Boolean(onClick) && !disabled;

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        cursor: isClickable ? 'pointer' : 'default',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 0.15s ease',
        userSelect: 'none'
      }}
      onMouseEnter={(e) => {
        if (isClickable) {
          e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high)';
        }
      }}
      onMouseLeave={(e) => {
        if (isClickable) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0, flex: 1 }}>
        {icon && (
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '14px',
              backgroundColor: iconBg || 'var(--md-sys-color-surface-container-highest)',
              color: iconColor || (destructive ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-primary)'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
              {icon}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <span
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: destructive ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-on-surface)',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {title}
          </span>
          {value && (
            <span
              style={{
                fontSize: '13px',
                color: 'var(--md-sys-color-outline)',
                marginTop: '2px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {value}
            </span>
          )}
          {detail && (
            <span
              style={{
                fontSize: '12px',
                color: 'var(--md-sys-color-outline)',
                marginTop: '3px',
                lineHeight: 1.3
              }}
            >
              {detail}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginLeft: '12px' }}>
        {trailing}
        {showChevron && (
          <span
            className="material-symbols-rounded"
            style={{ fontSize: '20px', color: 'var(--md-sys-color-outline)' }}
          >
            chevron_right
          </span>
        )}
      </div>
    </div>
  );
};

// Toggle Row with M3 Switch
export interface SettingsToggleRowProps {
  icon?: string;
  title: string;
  subtitle?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const SettingsToggleRow: React.FC<SettingsToggleRowProps> = ({
  icon,
  title,
  subtitle,
  checked,
  onChange,
  disabled = false
}) => {
  return (
    <div
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 0.15s ease',
        userSelect: 'none'
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high)';
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0, flex: 1 }}>
        {icon && (
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '14px',
              backgroundColor: 'var(--md-sys-color-surface-container-highest)',
              color: 'var(--md-sys-color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
              {icon}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            {title}
          </span>
          {subtitle && (
            <span style={{ fontSize: '13px', color: 'var(--md-sys-color-outline)', marginTop: '2px' }}>
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* M3 Expressive Pill Switch */}
      <div
        style={{
          width: '52px',
          height: '30px',
          borderRadius: '9999px',
          backgroundColor: checked
            ? 'var(--md-sys-color-primary)'
            : 'var(--md-sys-color-surface-container-highest)',
          border: `2px solid ${checked ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}`,
          position: 'relative',
          transition: 'all 0.25s cubic-bezier(0.2, 0.0, 0.0, 1.0)',
          flexShrink: 0,
          marginLeft: '12px'
        }}
      >
        <div
          style={{
            width: checked ? '22px' : '16px',
            height: checked ? '22px' : '16px',
            borderRadius: '50%',
            backgroundColor: checked
              ? 'var(--md-sys-color-on-primary)'
              : 'var(--md-sys-color-outline)',
            position: 'absolute',
            top: '50%',
            left: checked ? 'calc(100% - 24px)' : '4px',
            transform: 'translateY(-50%)',
            transition: 'all 0.25s cubic-bezier(0.2, 0.0, 0.0, 1.0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {checked && (
            <span
              className="material-symbols-rounded"
              style={{ fontSize: '14px', color: 'var(--md-sys-color-primary)', fontWeight: 800 }}
            >
              check
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// Segmented Choice Row (e.g. System | Light | Dark | AMOLED)
export interface ChoiceOption<T> {
  id: T;
  label: string;
  icon?: string;
}

export function SettingsChoiceRow<T extends string>({
  icon,
  title,
  subtitle,
  options,
  selected,
  onSelect
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  options: ChoiceOption<T>[];
  selected: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div
      style={{
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {icon && (
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '14px',
              backgroundColor: 'var(--md-sys-color-surface-container-highest)',
              color: 'var(--md-sys-color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
              {icon}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            {title}
          </span>
          {subtitle && (
            <span style={{ fontSize: '13px', color: 'var(--md-sys-color-outline)', marginTop: '2px' }}>
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Connected Segmented Buttons */}
      <div
        style={{
          display: 'flex',
          backgroundColor: 'var(--md-sys-color-surface-container)',
          borderRadius: '9999px',
          padding: '4px',
          border: '1px solid var(--md-sys-color-outline-variant)',
          gap: '2px'
        }}
      >
        {options.map((opt) => {
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onSelect(opt.id)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '9999px',
                backgroundColor: isSelected ? 'var(--md-sys-color-primary)' : 'transparent',
                color: isSelected ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
                border: 'none',
                fontWeight: isSelected ? 800 : 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s cubic-bezier(0.2, 0.0, 0, 1)'
              }}
            >
              {opt.icon && (
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                  {opt.icon}
                </span>
              )}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Slider Row for crossfade, intensity, etc.
export const SettingsSliderRow: React.FC<{
  icon?: string;
  title: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
}> = ({ icon, title, value, min, max, step = 1, unit = '', onChange }) => {
  return (
    <div
      style={{
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {icon && (
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '12px',
                backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                color: 'var(--md-sys-color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                {icon}
              </span>
            </div>
          )}
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            {title}
          </span>
        </div>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 800,
            color: 'var(--md-sys-color-primary)',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            padding: '3px 10px',
            borderRadius: '9999px',
            border: '1px solid var(--md-sys-color-outline-variant)'
          }}
        >
          {value}
          {unit}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          accentColor: 'var(--md-sys-color-primary)',
          cursor: 'pointer'
        }}
      />
    </div>
  );
};
