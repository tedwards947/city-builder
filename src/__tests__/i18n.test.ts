import { describe, it, expect } from 'vitest';
import { t, setLocale } from '../i18n';

describe('i18n', () => {
  it('should look up simple keys', () => {
    expect(t('common.cancel')).toBe('Cancel');
    expect(t('zones.residential')).toBe('Residential');
  });

  it('should look up nested keys', () => {
    expect(t('ui.tileInfo.coords', { tx: 1, ty: 2 })).toBe('(1, 2)');
  });

  it('should interpolate parameters', () => {
    expect(t('ui.tileInfo.distress', { distress: 10, threshold: 100 }))
      .toBe('Distress: 10/100 — conditions unmet, risk of abandonment');
  });

  it('should return the key if not found', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('should handle missing parameters gracefully', () => {
    expect(t('ui.tileInfo.coords', { tx: 1 })).toBe('(1, {ty})');
  });
});
