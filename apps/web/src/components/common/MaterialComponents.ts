// Register all Material Web Components
import '@material/web/all.js';

// Augment React's JSX namespace so custom elements are recognized by TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'md-filled-button': any;
      'md-filled-tonal-button': any;
      'md-outlined-button': any;
      'md-elevated-button': any;
      'md-text-button': any;
      'md-icon-button': any;
      'md-filled-icon-button': any;
      'md-filled-tonal-icon-button': any;
      'md-outlined-icon-button': any;
      'md-slider': any;
      'md-tabs': any;
      'md-primary-tab': any;
      'md-secondary-tab': any;
      'md-list': any;
      'md-list-item': any;
      'md-dialog': any;
      'md-menu': any;
      'md-menu-item': any;
      'md-circular-progress': any;
      'md-linear-progress': any;
      'md-chip-set': any;
      'md-filter-chip': any;
      'md-assist-chip': any;
      'md-divider': any;
      'md-ripple': any;
      'md-elevation': any;
      'md-switch': any;
      'md-checkbox': any;
      'md-radio': any;
    }
  }
}
