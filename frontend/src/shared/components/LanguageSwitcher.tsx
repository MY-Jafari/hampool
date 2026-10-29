import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/shared/providers/LanguageProvider';
import { Button } from '@/shared/components/ui/button';

export function LanguageSwitcher({ variant = 'ghost' }: { variant?: 'ghost' | 'outline' }) {
  const { t } = useTranslation('common');
  const { language, toggleLanguage } = useLanguage();

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={toggleLanguage}
      className="gap-1.5 px-2.5 font-medium select-none"
      aria-label={t('language.switch', 'تغییر زبان')}
    >
      <Languages className="size-4 opacity-75" />
      <span className="text-xs uppercase font-mono">{language === 'fa' ? 'EN' : 'FA'}</span>
    </Button>
  );
}
