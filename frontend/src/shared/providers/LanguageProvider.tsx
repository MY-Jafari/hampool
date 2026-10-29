import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DirectionProvider } from '@radix-ui/react-direction';
import { LANG_STORAGE_KEY } from '@/shared/lib/i18n';
import type { AppLocale } from '@/shared/lib/format';

interface LanguageContextType {
  language: AppLocale;
  direction: 'rtl' | 'ltr';
  setLanguage: (lang: AppLocale) => void;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [language, setLanguageState] = useState<AppLocale>(() => {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === 'en' || stored === 'fa') return stored;
    return i18n.language?.startsWith('fa') ? 'fa' : 'en';
  });

  const direction: 'rtl' | 'ltr' = language === 'fa' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    try {
      localStorage.setItem(LANG_STORAGE_KEY, language);
    } catch {
      // storage unavailable
    }
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [language, direction, i18n]);

  const setLanguage = (lang: AppLocale) => {
    setLanguageState(lang);
  };

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === 'fa' ? 'en' : 'fa'));
  };

  return (
    <LanguageContext.Provider value={{ language, direction, setLanguage, toggleLanguage }}>
      <DirectionProvider dir={direction}>
        {children}
      </DirectionProvider>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
