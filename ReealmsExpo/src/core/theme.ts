export const palette = {
  background: '#04050A',
  backgroundSoft: '#0B1017',
  surface: '#0F141D',
  surfaceRaised: '#171E29',
  border: 'rgba(148, 163, 184, 0.16)',
  borderStrong: 'rgba(148, 163, 184, 0.3)',
  textPrimary: '#F7F8FB',
  textSecondary: '#D7DEE8',
  textMuted: '#96A2B4',
  accent: '#F46E57',
  accentStrong: '#FF9A68',
  accentCool: '#4AC6E5',
  accentGold: '#F0C26B',
  success: '#63D0A5',
  danger: '#FF7D7D',
  backdrop: 'rgba(3, 5, 10, 0.84)',
} as const;

export const gradients = {
  shellBackdrop: ['#251623', '#091017', '#04050A'] as const,
  cardGlow: ['rgba(244, 110, 87, 0.22)', 'rgba(74, 198, 229, 0.05)', 'rgba(4, 5, 10, 0.1)'] as const,
  posterFade: ['rgba(4, 5, 10, 0)', 'rgba(4, 5, 10, 0.84)', '#04050A'] as const,
  modalPanel: ['#1A2230', '#111721'] as const,
} as const;
