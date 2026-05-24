/**
 * Identity system constants — the single source of truth for the 16-color palette,
 * 64-icon library, and legacy hex→colorId migration mapping.
 *
 * The `Identity` type is the data model for every entity's visual fingerprint.
 * All color values stored in the DB are color IDs (e.g. "teal"), not hex values.
 */

/** A color + icon pair that visually identifies an entity. */
export interface Identity {
  /** One of the 16 IDENTITY_COLORS ids. */
  colorId: string;
  /**
   * Lucide icon id (kebab-case), OR one of the special name tokens:
   *   '__name_1__'     → first letter of entity name
   *   '__name_2__'     → first two letters
   *   '__name_words__' → first letter of each word
   *   '__none__'       → color only, no content
   */
  iconId: string;
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

export const DEFAULT_ACTIVITY_IDENTITY: Identity  = { colorId: 'teal', iconId: '__none__' };
export const DEFAULT_TIMELINE_IDENTITY: Identity  = { colorId: 'teal', iconId: '__none__' };
export const DEFAULT_TEAM_IDENTITY: Identity      = { colorId: 'teal', iconId: '__name_2__' };
export const DEFAULT_MEMBER_IDENTITY: Identity    = { colorId: 'teal', iconId: '__name_words__' };

// ── Color resolution ──────────────────────────────────────────────────────────

const COLOR_BY_ID: Record<string, string> = Object.fromEntries(
  IDENTITY_COLORS.map(c => [c.id, c.hex]),
);

/** Legacy hex values stored before migration 006. Maps to the nearest color ID. */
const LEGACY_HEX_TO_ID: Record<string, string> = {
  '#288C9B': 'teal',
  '#F29E4C': 'amber',
  '#5BC0DE': 'cyan',
  '#2ECC71': 'green',
  '#9B59B6': 'violet',
  '#E74C3C': 'rose',
  '#5C6BC0': 'indigo',
  '#8BC34A': 'lime',
  // lowercase variants
  '#288c9b': 'teal',
  '#f29e4c': 'amber',
  '#5bc0de': 'cyan',
  '#2ecc71': 'green',
  '#9b59b6': 'violet',
  '#e74c3c': 'rose',
  '#5c6bc0': 'indigo',
  '#8bc34a': 'lime',
};

/**
 * Resolves a color value (either a color ID like "teal" or a legacy hex like
 * "#288C9B") to its hex string for use as a CSS background-color.
 * Falls back to teal when the value is unrecognised or absent.
 */
export function resolveColorHex(colorOrId: string | null | undefined): string {
  if (!colorOrId) return COLOR_BY_ID['teal'];
  if (colorOrId.startsWith('#')) {
    const mappedId = LEGACY_HEX_TO_ID[colorOrId];
    return mappedId ? COLOR_BY_ID[mappedId] : colorOrId;
  }
  return COLOR_BY_ID[colorOrId] ?? COLOR_BY_ID['teal'];
}

/**
 * Maps a legacy hex color to its identity color ID.
 * Returns 'teal' when the hex is unrecognised.
 */
export function hexToColorId(hex: string): string {
  return LEGACY_HEX_TO_ID[hex] ?? LEGACY_HEX_TO_ID[hex.toLowerCase()] ?? 'teal';
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
export function getNameText(iconId: string, name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (iconId === '__name_1__') return (words[0]?.[0] ?? '').toUpperCase();
  if (iconId === '__name_2__') return name.slice(0, 2).toUpperCase();
  if (iconId === '__name_words__') {
    return words.map(w => w[0]).join('').toUpperCase().slice(0, 3);
  }
  return '';
}

// ── ACTIVITY_COLORS / MEMBER_COLORS re-exports ────────────────────────────────
// These replace the legacy hex arrays in types/index.ts.

/** Activity color palette as hex strings, in IDENTITY_COLORS order. */
export const ACTIVITY_COLORS: string[] = IDENTITY_COLORS.map(c => c.hex);

/** Member color palette as hex strings, in IDENTITY_COLORS order. */
export const MEMBER_COLORS: string[] = IDENTITY_COLORS.map(c => c.hex);
