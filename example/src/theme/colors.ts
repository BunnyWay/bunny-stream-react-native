// Bunny Stream brand colors — mirrored from Android `ui/theme/Color.kt`.

// Primary brand colors
export const Orange60 = '#FD8D32'; // Primary Orange
export const Blue60 = '#183D6D'; // Primary Blue

// Material Design inspired tones
export const Orange80 = '#FFCAA0'; // Lighter orange
export const Orange40 = '#CB670D'; // Darker orange
export const Blue80 = '#7DA6D4'; // Lighter blue
export const Blue40 = '#25588F'; // Darker blue

// Basic colors
export const Black = '#000000';
export const White = '#FFFFFF';
export const Clear = 'transparent';

// Colors with opacity
export const Black20 = 'rgba(0, 0, 0, 0.2)';
export const Black60 = 'rgba(0, 0, 0, 0.6)';
export const Gray40 = 'rgba(142, 142, 147, 0.4)';

// Semantic tokens (mapped from BunnyStreamTheme light scheme)
export const colors = {
  primary: Orange60,
  onPrimary: White,
  background: White,
  onSurface: Blue60,
  onSurfaceVariant: Blue40,
  surface: White,
  divider: 'rgba(24, 61, 109, 0.18)',
  disabled: Gray40,

  // Status colors
  error: '#D32F2F',
  errorTint: 'rgba(211, 47, 47, 0.1)',
  success: '#2E7D32',
  successTint: 'rgba(46, 125, 50, 0.1)',
  warning: '#F9A825',
  live: '#E53935',
  processing: '#7E57C2',
  processingTint: 'rgba(126, 87, 194, 0.12)',

  // Neutral grays — placeholder text, inactive/ended states, secondary text
  placeholder: '#999',
  neutral: '#888',
  neutralLight: '#AAA',
  neutralDark: '#666',

  // Dark / inset surfaces — thumbnail placeholders, copyable-value wells
  surfaceDark: '#1A1A2E',
  surfaceSunken: '#F5F5F5',

  // onSurface (Blue60) alpha variants — input borders, track fills, dividers
  onSurface10: 'rgba(24, 61, 109, 0.1)',
  onSurface15: 'rgba(24, 61, 109, 0.15)',
  onSurface20: 'rgba(24, 61, 109, 0.2)',
  onSurfaceVariant10: 'rgba(37, 88, 143, 0.1)',

  // Black scrims and hairlines
  scrim: 'rgba(0, 0, 0, 0.5)',
  scrimLight: 'rgba(0, 0, 0, 0.4)',
  scrimDark: 'rgba(0, 0, 0, 0.7)',
  scrimHeavy: 'rgba(0, 0, 0, 0.85)',
  hairline: 'rgba(0, 0, 0, 0.06)',
  hairlineStrong: 'rgba(0, 0, 0, 0.1)',

  // White alpha variants — text/controls over the dark player surface
  onPrimary15: 'rgba(255, 255, 255, 0.15)',
  onPrimary60: 'rgba(255, 255, 255, 0.6)',
  onPrimary80: 'rgba(255, 255, 255, 0.8)',
  onPrimary85: 'rgba(255, 255, 255, 0.85)',
} as const;
