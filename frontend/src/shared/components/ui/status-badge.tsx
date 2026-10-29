import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from './badge';
import { CheckCircle2, Clock, RotateCcw } from 'lucide-react';

export type SettlementStatus = 'pending' | 'confirmed' | 'reversed';

export interface StatusBadgeProps {
  status: SettlementStatus | 'confirmed_expense' | 'unconfirmed_expense';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const { t } = useTranslation('common');

  if (status === 'confirmed' || status === 'confirmed_expense') {
    return (
      <Badge variant="owed" className={className}>
        <CheckCircle2 className="size-3" />
        <span>{t('status.confirmed', 'تایید شده')}</span>
      </Badge>
    );
  }

  if (status === 'pending' || status === 'unconfirmed_expense') {
    return (
      <Badge variant="pending" className={className}>
        <Clock className="size-3" />
        <span>{t('status.pending', 'در انتظار')}</span>
      </Badge>
    );
  }

  if (status === 'reversed') {
    return (
      <Badge variant="secondary" className={className}>
        <RotateCcw className="size-3" />
        <span>{t('status.reversed', 'ابطال شده')}</span>
      </Badge>
    );
  }

  return null;
};
