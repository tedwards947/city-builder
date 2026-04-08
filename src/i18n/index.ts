import { en } from './locales/en';
import type { TranslationSchema } from './types';

let currentLocale = 'en';
const translations: Record<string, TranslationSchema> = { en };

/**
 * Looks up a translation key and interpolates parameters.
 * Supports nested keys via dot notation (e.g. 'ui.tileInfo.residential').
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const parts = key.split('.');
  let current: any = translations[currentLocale];

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
  }

  if (typeof current !== 'string') {
    console.warn(`Translation key is not a string: ${key}`);
    return key;
  }

  let result = current;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return result;
}

/**
 * Looks up a translation key that is expected to be an array of strings.
 */
export function tArray(key: string): string[] {
  const parts = key.split('.');
  let current: any = translations[currentLocale];

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      console.warn(`Translation key not found: ${key}`);
      return [];
    }
  }

  if (!Array.isArray(current)) {
    console.warn(`Translation key is not an array: ${key}`);
    return [];
  }

  return current;
}

export function setLocale(locale: string): void {
  if (translations[locale]) {
    currentLocale = locale;
  } else {
    console.error(`Locale not supported: ${locale}`);
  }
}

/**
 * Searches the DOM for elements with data-i18n attribute and populates them.
 * For example: <span data-i18n="ui.hud.money"></span>
 * Also supports data-i18n-placeholder and data-i18n-title.
 */
export function localizeHTML(): void {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n')!;
    el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder')!;
    (el as HTMLInputElement).placeholder = t(key);
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title')!;
    (el as HTMLElement).title = t(key);
  });

  document.querySelectorAll('[data-i18n-desc]').forEach(el => {
    const key = el.getAttribute('data-i18n-desc')!;
    (el as HTMLElement).setAttribute('data-desc', t(key));
  });
}
