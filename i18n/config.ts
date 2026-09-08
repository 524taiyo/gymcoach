export const locales = ['en', 'fr', 'ru', 'ja'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ja';
export const localeCookieName = 'gymcoach.locale';
export const localeCookieMaxAge = 60 * 60 * 24 * 365;

export function isLocale(value: string | null | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  ru: 'Русский',
  ja: '日本語',
};
