/**
 * GrubSwipe Theme — light & dark color palettes
 *
 * Accent colors (orange, green, red, gold) stay the same in both modes
 * because they serve semantic purposes (action, success, error, rating).
 */

export const lightColors = {
  background: '#FFFFFF',
  surface: '#F9FAFB',
  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  inputBg: '#F3F4F6',
  // Accent (identical in both modes)
  accent: '#FF6B35',
  success: '#10B981',
  error: '#EF4444',
  gold: '#FFD700',
  // Extras
  paleAccent: '#FFF7ED',
  overlay: 'rgba(255,255,255,0.9)',
};

export const darkColors = {
  background: '#121212',
  surface: '#1E1E2E',
  text: '#F9FAFB',
  textSecondary: '#A0A0B0',
  textTertiary: '#707080',
  border: '#2A2A3E',
  inputBg: '#2A2A3E',
  // Accent (identical in both modes)
  accent: '#FF6B35',
  success: '#10B981',
  error: '#EF4444',
  gold: '#FFD700',
  // Extras
  paleAccent: '#2A1A10',
  overlay: 'rgba(18,18,18,0.9)',
};

export function getColors(isDark) {
  return isDark ? darkColors : lightColors;
}
