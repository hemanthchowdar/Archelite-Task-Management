/**
 * Archelite Design System — colours, typography, spacing
 * Derived from the Figma mockups.
 */

export const Colors = {
  // ── Brand ───────────────────────────
  primary: '#E8A838', // Amber / Orange accent
  primaryDark: '#C4871E',
  primaryLight: '#FDF0D5',

  // ── Backgrounds ─────────────────────
  background: '#FFF8F0', // Warm off-white
  surface: '#FFFFFF',
  surfaceMuted: '#F5F0EA',

  // ── Text ────────────────────────────
  textPrimary: '#1E1E1E',
  textSecondary: '#6B6B6B',
  textMuted: '#9E9E9E',
  textOnPrimary: '#FFFFFF',

  // ── Header / Navigation bar ─────────
  header: '#2C2C2C',
  headerText: '#FFFFFF',

  // ── Status / Priority ───────────────
  urgent: '#D32F2F',
  critical: '#C62828',
  high: '#E8A838',
  medium: '#F9A825',
  low: '#757575',

  // ── Category badges ─────────────────
  bookkeeping: '#FFF3E0',
  bookkeepingText: '#E65100',
  construction: '#E8F5E9',
  constructionText: '#2E7D32',
  accounting: '#FFF8E1',
  accountingText: '#F57F17',
  invoice: '#E3F2FD',
  invoiceText: '#1565C0',

  // ── UI chrome ───────────────────────
  border: '#E8E0D8',
  borderLight: '#F0EBE5',
  divider: '#F0EBE5',
  cardShadow: 'rgba(0, 0, 0, 0.06)',

  // ── Semantic ────────────────────────
  success: '#2E7D32',
  error: '#D32F2F',
  warning: '#ED6C02',
  info: '#0288D1',

  // ── Misc ────────────────────────────
  fab: '#E8A838',
  unreadBadge: '#E8A838',
  closedStrikethrough: '#9E9E9E',
} as const;

export const Fonts = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  sizes: {
    xs: 11,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 22,
    title: 26,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const;

/** Avatar background colours keyed by first char of name (A-Z → looping palette) */
const AVATAR_PALETTE = [
  '#E8A838', '#D32F2F', '#1976D2', '#388E3C',
  '#7B1FA2', '#00796B', '#C2185B', '#F57C00',
  '#455A64', '#5D4037',
] as const;

export function avatarColor(name: string): string {
  const idx = (name.charCodeAt(0) - 65) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[Math.abs(idx)] ?? AVATAR_PALETTE[0];
}
