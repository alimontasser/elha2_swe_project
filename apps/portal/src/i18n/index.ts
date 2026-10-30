import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from './ar.json'
import en from './en.json'

export type Language = 'ar' | 'en'
const LANG_KEY = 'elha2-portal-lang'

function storedLanguage(): Language {
  try {
    return window.localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ar'
  } catch {
    return 'ar'
  }
}

// Arabic is the default (NFR-16); the document direction follows the language (US-1.02).
export function applyDirection(lng: string) {
  document.documentElement.lang = lng
  document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr'
}

export function setLanguage(lng: Language) {
  try {
    window.localStorage.setItem(LANG_KEY, lng)
  } catch {
    /* ignore */
  }
  void i18n.changeLanguage(lng)
}

i18n.on('languageChanged', applyDirection)

void i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: storedLanguage(),
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
})
applyDirection(i18n.language)

export function formatDate(iso: string, lng: string) {
  return new Intl.DateTimeFormat(lng === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Cairo',
  }).format(new Date(iso))
}

export default i18n
