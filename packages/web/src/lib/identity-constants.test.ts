import { describe, it, expect } from 'vitest';
import {
  resolveColorHex,
  iconIdToPascal,
  getNameText,
  IDENTITY_COLORS,
} from '@/components/identity/identity-constants';

describe('resolveColorHex', () => {
  it('passes hex values through unchanged', () => {
    expect(resolveColorHex('#288C9B')).toBe('#288C9B');
    expect(resolveColorHex('#3B82F6')).toBe('#3B82F6');
    expect(resolveColorHex('#000000')).toBe('#000000');
  });

  it('resolves palette name IDs to hex (backward compat)', () => {
    expect(resolveColorHex('teal')).toBe('#288C9B');
    expect(resolveColorHex('indigo')).toBe('#6366F1');
    expect(resolveColorHex('amber')).toBe('#F59E0B');
    expect(resolveColorHex('lime')).toBe('#84CC16');
  });

  it('falls back to teal for null, undefined, and unknown values', () => {
    expect(resolveColorHex(null)).toBe('#288C9B');
    expect(resolveColorHex(undefined)).toBe('#288C9B');
    expect(resolveColorHex('')).toBe('#288C9B');
    expect(resolveColorHex('not-a-color')).toBe('#288C9B');
  });
});

describe('iconIdToPascal', () => {
  it('converts single-word icon IDs', () => {
    expect(iconIdToPascal('star')).toBe('Star');
    expect(iconIdToPascal('moon')).toBe('Moon');
  });

  it('converts hyphenated icon IDs to PascalCase', () => {
    expect(iconIdToPascal('bar-chart')).toBe('BarChart');
    expect(iconIdToPascal('check-circle')).toBe('CheckCircle');
    expect(iconIdToPascal('alert-circle')).toBe('AlertCircle');
    expect(iconIdToPascal('message-circle')).toBe('MessageCircle');
    expect(iconIdToPascal('trending-up')).toBe('TrendingUp');
    expect(iconIdToPascal('file-text')).toBe('FileText');
  });
});

describe('getNameText', () => {
  it('returns empty string for __none__ and Lucide icon IDs', () => {
    expect(getNameText('__none__', 'Alice')).toBe('');
    expect(getNameText('star', 'Alice')).toBe('');
    expect(getNameText('bar-chart', 'Some Entity')).toBe('');
  });

  it('__name_1__: first letter of first word, uppercased', () => {
    expect(getNameText('__name_1__', 'Alice')).toBe('A');
    expect(getNameText('__name_1__', 'bob smith')).toBe('B');
    expect(getNameText('__name_1__', '')).toBe('');
  });

  it('__name_2__: first two characters of the name, uppercased', () => {
    expect(getNameText('__name_2__', 'Alice')).toBe('AL');
    expect(getNameText('__name_2__', 'Q1 Roadmap')).toBe('Q1');
    expect(getNameText('__name_2__', 'x')).toBe('X');
  });

  it('__name_words__: first letter of each word, up to 3, uppercased', () => {
    expect(getNameText('__name_words__', 'Alice')).toBe('A');
    expect(getNameText('__name_words__', 'Alice Bob')).toBe('AB');
    expect(getNameText('__name_words__', 'Alpha Beta Gamma')).toBe('ABG');
    expect(getNameText('__name_words__', 'Alpha Beta Gamma Delta')).toBe('ABG');
  });
});

describe('IDENTITY_COLORS', () => {
  it('contains exactly 16 colors', () => {
    expect(IDENTITY_COLORS).toHaveLength(16);
  });

  it('every entry has a non-empty id, name, and valid hex', () => {
    for (const c of IDENTITY_COLORS) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('resolveColorHex resolves every palette color by ID', () => {
    for (const c of IDENTITY_COLORS) {
      expect(resolveColorHex(c.id)).toBe(c.hex);
    }
  });
});
