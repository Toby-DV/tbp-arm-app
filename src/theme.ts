// Shared design tokens. Keeping colours here means one place to change them
// rather than hunting hex codes across every screen.

export const colors = {
  background: '#FFFFFF',
  border: '#E5E7EB',
  text: '#111827',
  muted: '#6B7280',
  accent: '#1D4ED8',
  disabled: '#D1D5DB',
  tile: '#F3F4F6',

  // Status colours. Reserved for device state and always paired with a text
  // label, never carrying meaning on their own.
  success: '#15803D',

  // Bar fills. One hue at two emphasis levels — colour encodes selection
  // state, not which setting it is (the icons carry identity). Both steps are
  // validated for chroma, colour-blind separation, and 3:1 contrast against
  // the white surface.
  barActive: '#1D4ED8',
  barIdle: '#6B87CC',
} as const;

export const spacing = {
  sm: 8,
  md: 16,
  lg: 24,
} as const;
