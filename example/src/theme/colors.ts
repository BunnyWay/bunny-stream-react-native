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
} as const;
