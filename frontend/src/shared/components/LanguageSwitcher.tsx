import { Languages } from 'lucide-react';
import { useLanguage } from '@/shared/providers/LanguageProvider';
import { Button } from '@/shared/components/ui/button';

export function LanguageSwitcher({ variant = 'ghost' }: { variant?: 'ghost' | 'outline' }) {
  const { language, toggleLanguage } = useLanguage();

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={toggleLanguage}
      className="gap-1.5 px-2.5 font-medium select-none"
      aria-label="تغییر زبان / Switch Language"
    >
      <Languages className="size-4 opacity-75" />
      <span className="text-xs uppercase">{language === 'fa' ? 'EN' : 'فا'}</span>
    </Button>
  );
}
