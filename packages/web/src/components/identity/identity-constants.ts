/**
 * Identity system constants — the single source of truth for the 16-color palette,
 * 64-icon library, and color resolution helpers.
 *
 * Colors are stored as hex values (e.g. '#288C9B') in the DB and throughout the
 * system. The palette names are UI-only — swapping a palette color never requires
 * a DB migration, only a change here.
 */

/** A color + icon pair that visually identifies an entity. */
export interface Identity {
  /** Hex color string, e.g. '#288C9B'. */
  color: string;
  /**
   * Lucide icon id (kebab-case), OR one of the special name tokens:
   *   '__name_1__'     → first letter of entity name
   *   '__name_2__'     → first two letters
   *   '__name_words__' → first letter of each word
   *   '__none__'       → color only, no content
   */
  icon: string;
}

export interface IdentityColor {
  id: string;
  name: string;
  hex: string;
}

/** 16-color unified palette. All colors have ≥3:1 contrast against white. */
export const IDENTITY_COLORS: IdentityColor[] = [
  { id: 'teal',   name: 'Teal',   hex: '#288C9B' },
  { id: 'cyan',   name: 'Cyan',   hex: '#06B6D4' },
  { id: 'blue',   name: 'Blue',   hex: '#3B82F6' },
  { id: 'indigo', name: 'Indigo', hex: '#6366F1' },
  { id: 'violet', name: 'Violet', hex: '#8B5CF6' },
  { id: 'purple', name: 'Purple', hex: '#A855F7' },
  { id: 'pink',   name: 'Pink',   hex: '#EC4899' },
  { id: 'rose',   name: 'Rose',   hex: '#F43F5E' },
  { id: 'red',    name: 'Red',    hex: '#EF4444' },
  { id: 'orange', name: 'Orange', hex: '#F97316' },
  { id: 'amber',  name: 'Amber',  hex: '#F59E0B' },
  { id: 'yellow', name: 'Yellow', hex: '#EAB308' },
  { id: 'lime',   name: 'Lime',   hex: '#84CC16' },
  { id: 'green',  name: 'Green',  hex: '#22C55E' },
  { id: 'slate',  name: 'Slate',  hex: '#64748B' },
  { id: 'stone',  name: 'Stone',  hex: '#78716C' },
];

/** 64 Lucide icon IDs available in the identity picker. */
export const IDENTITY_ICONS: string[] = [
  'activity',    'archive',      'award',       'bar-chart',
  'bell',        'bookmark',     'briefcase',   'calendar',
  'check-circle','clipboard',    'clock',       'cloud',
  'code',        'coffee',       'compass',     'cpu',
  'database',    'download',     'edit',        'eye',
  'file-text',   'filter',       'flag',        'folder',
  'git-branch',  'globe',        'grid',        'heart',
  'help-circle', 'home',         'info',        'layers',
  'link',        'list',         'lock',        'mail',
  'map',         'message-circle','moon',       'package',
  'pencil',      'phone',        'pie-chart',   'plug',
  'refresh-cw',  'search',       'server',      'settings',
  'share',       'shield',       'star',        'sun',
  'tag',         'target',       'terminal',    'trash',
  'trending-up', 'upload',       'user',        'users',
  'wifi',        'zap',          'alert-circle','copy',
];

/** Special icon IDs that render name-derived text instead of a Lucide icon. */
export const SPECIAL_ICON_IDS = ['__none__', '__name_1__', '__name_2__', '__name_words__'] as const;
export type SpecialIconId = typeof SPECIAL_ICON_IDS[number];

// ── Default identities per entity type ────────────────────────────────────────

export const DEFAULT_ACTIVITY_IDENTITY: Identity  = { color: '#288C9B', icon: '__none__' };
export const DEFAULT_TIMELINE_IDENTITY: Identity  = { color: '#288C9B', icon: '__none__' };
export const DEFAULT_TEAM_IDENTITY: Identity      = { color: '#288C9B', icon: '__name_2__' };
export const DEFAULT_MEMBER_IDENTITY: Identity    = { color: '#288C9B', icon: '__name_words__' };

// ── Color resolution ──────────────────────────────────────────────────────────

/** Palette name → hex lookup for resolving legacy colorId strings. */
const COLOR_BY_ID: Record<string, string> = Object.fromEntries(
  IDENTITY_COLORS.map(c => [c.id, c.hex]),
);

/**
 * Resolves a color value to a hex string safe to use as CSS background-color.
 * Accepts hex values (pass-through), palette name IDs (backward compat for
 * any rows written before migration 007), and null/undefined (falls back to teal).
 */
export function resolveColorHex(colorOrId: string | null | undefined): string {
  const fallback = '#288C9B';
  if (!colorOrId) return fallback;
  if (colorOrId.startsWith('#')) return colorOrId;
  return COLOR_BY_ID[colorOrId] ?? fallback;
}

// ── Icon name helpers ─────────────────────────────────────────────────────────

/**
 * Converts a kebab-case Lucide icon ID to the PascalCase component name used
 * by lucide-react (e.g. "bar-chart" → "BarChart").
 */
export function iconIdToPascal(iconId: string): string {
  return iconId
    .split('-')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/**
 * Derives the text content that should appear inside a name-based badge.
 * Returns an empty string for Lucide icons or '__none__'.
 */
export function getNameText(icon: string, name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (icon === '__name_1__') return (words[0]?.[0] ?? '').toUpperCase();
  if (icon === '__name_2__') return name.slice(0, 2).toUpperCase();
  if (icon === '__name_words__') {
    return words.map(w => w[0]).join('').toUpperCase().slice(0, 3);
  }
  return '';
}

// ── ACTIVITY_COLORS / MEMBER_COLORS re-exports ────────────────────────────────

/** Activity color palette as hex strings, in IDENTITY_COLORS order. */
export const ACTIVITY_COLORS: string[] = IDENTITY_COLORS.map(c => c.hex);

/** Member color palette as hex strings, in IDENTITY_COLORS order. */
export const MEMBER_COLORS: string[] = IDENTITY_COLORS.map(c => c.hex);
