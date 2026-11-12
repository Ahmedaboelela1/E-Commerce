import type {Locale} from './routing';

const OG_LOCALE_MAP: Record<Locale, string> = { en: 'en_US', ar: 'ar_EG' };
const INTL_LOCALE_MAP: Record<Locale, string> = { en: 'en-US', ar: 'ar-EG' };

export function toOgLocale(locale: string): string {
    return OG_LOCALE_MAP[locale as Locale] || 'en_US';
}

export function toIntlLocale(locale: string): string {
    return INTL_LOCALE_MAP[locale as Locale] || 'en-US';
}

export const localeDirection = (locale:string):'rtl'|'ltr' => locale==='ar'?'rtl':'ltr';
