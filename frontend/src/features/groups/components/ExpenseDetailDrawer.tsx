import { CheckCircle2, Receipt, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { StatusBadge } from '@/shared/components/ui/status-badge';
import { Money } from '@/shared/components/ui/money';
import { DateText } from '@/shared/components/ui/date-text';
import { UserAvatar } from '@/shared/components/ui/avatar';
import {
  EqualSplitIcon,
  ExactSplitIcon,
  ItemizedSplitIcon,
  PercentageSplitIcon,
} from '@/assets/icons/DomainIcons';
import type { Expense, Membership, SplitType } from '@/shared/types/api';

interface ExpenseDetailDrawerProps {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Membership[];
  canManage: boolean;
  onConfirm?: (expenseId: number) => void;
  onDelete?: (expense: Expense) => void;
  confirmLoading?: boolean;
}

function getSplitIcon(splitType: SplitType) {
  switch (splitType) {
    case 'equal':
      return EqualSplitIcon;
    case 'exact':
      return ExactSplitIcon;
    case 'percentage':
      return PercentageSplitIcon;
    case 'itemized':
      return ItemizedSplitIcon;
    default:
      return Receipt;
  }
}

export function ExpenseDetailDrawer({
  expense,
  open,
  onOpenChange,
  members,
  canManage,
  onConfirm,
  onDelete,
  confirmLoading,
}: ExpenseDetailDrawerProps) {
  const { t } = useTranslation(['groups', 'common']);

  if (!expense) return null;

  const payer = members.find((m) => m.user === expense.paid_by);
  const payerName = payer ? payer.user_name || payer.user_phone : `کاربر ${expense.paid_by}`;
  const SplitIcon = getSplitIcon(expense.split_type);

  const getMember = (userId: number) => members.find((m) => m.user === userId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
              <SplitIcon size={20} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">{expense.description}</DialogTitle>
              <DialogDescription className="text-xs">
                {t('expenses.detailTitle')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Amount and Status Cards */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/60 p-4">
            <div>
              <p className="text-xs text-muted-foreground">{t('expenseForm.totalAmount')}</p>
              <Money amount={expense.total_amount} className="text-xl font-bold sm:text-2xl mt-0.5" />
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <StatusBadge
                status={expense.is_confirmed ? 'confirmed_expense' : 'unconfirmed_expense'}
              />
              <Badge variant="secondary" className="text-[11px]">
                {t(`splits.${expense.split_type}`)}
              </Badge>
            </div>
          </div>

          {/* Metadata Row */}
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-secondary/40 p-3 text-xs">
            <div>
              <span className="text-muted-foreground block mb-1">{t('expenses.payer')}:</span>
              <div className="flex items-center gap-2">
                <UserAvatar name={payerName} className="size-6" />
                <span className="font-semibold text-foreground truncate">{payerName}</span>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">{t('common:date', { defaultValue: 'تاریخ ثبت' })}:</span>
              <DateText date={expense.date} withTime className="font-medium text-foreground" />
            </div>
          </div>

          {/* Immutability Notice if confirmed */}
          {expense.is_confirmed && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              {t('expenses.immutableNotice')}
            </div>
          )}

          {/* Splits Breakdown */}
          {expense.split_type !== 'itemized' && expense.splits.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {t('expenses.shares')} ({expense.splits.length})
              </h4>
              <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                {expense.splits.map((split) => {
                  const m = getMember(split.user);
                  const name = m ? m.user_name || m.user_phone : `کاربر ${split.user}`;

                  return (
                    <div
                      key={split.user}
                      className="flex items-center justify-between px-3.5 py-2.5 text-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar name={name} className="size-7" />
                        <span className="truncate font-medium">{name}</span>
                        {split.percentage !== undefined && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                            {split.percentage}٪
                          </Badge>
                        )}
                      </div>
                      <Money amount={split.amount ?? 0} className="font-bold text-sm" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Itemized Items Breakdown */}
          {expense.split_type === 'itemized' && expense.items.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {t('expenses.items')} ({expense.items.length})
              </h4>
              <div className="space-y-2">
                {expense.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-border p-3 space-y-2 bg-card/40"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-foreground">{item.name}</span>
                      <Money amount={item.total_amount} className="font-bold text-sm" />
                    </div>
                    {item.shares && item.shares.length > 0 && (
                      <div className="border-t border-border/50 pt-2 space-y-1">
                        {item.shares.map((sh) => {
                          const m = getMember(sh.user);
                          const name = m ? m.user_name || m.user_phone : `کاربر ${sh.user}`;
                          return (
                            <div
                              key={sh.user}
                              className="flex items-center justify-between text-xs text-muted-foreground"
                            >
                              <span>{name}</span>
                              <Money amount={sh.amount} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:actions.close', { defaultValue: 'بستن' })}
          </Button>

          {canManage && (
            <div className="flex items-center gap-2">
              {!expense.is_confirmed && onConfirm && (
                <Button
                  onClick={() => onConfirm(expense.id)}
                  disabled={confirmLoading}
                  className="gap-1.5"
                >
                  <CheckCircle2 className="size-4" />
                  <span>{t('expenses.confirmExpense')}</span>
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    onOpenChange(false);
                    onDelete(expense);
                  }}
                  className="gap-1.5"
                >
                  <Trash2 className="size-4" />
                  <span>{t('expenses.deleteExpense')}</span>
                </Button>
              )}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
