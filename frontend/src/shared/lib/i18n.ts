import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import faCommon from '@/locales/fa/common.json';
import enCommon from '@/locales/en/common.json';
import faAuth from '@/locales/fa/auth.json';
import enAuth from '@/locales/en/auth.json';
import faGroups from '@/locales/fa/groups.json';
import enGroups from '@/locales/en/groups.json';

export const LANG_STORAGE_KEY = 'hampool.lang';

export const resources = {
  fa: {
    common: faCommon,
    auth: faAuth,
    groups: faGroups,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    groups: enGroups,
  },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fa',
    defaultNS: 'common',
    ns: ['common', 'auth', 'groups'],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANG_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
