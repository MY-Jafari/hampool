import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Loader2, UserCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { createSettlement, getBalances } from '@/features/groups/api';
import type { Membership } from '@/shared/types/api';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import { MoneyInput } from '@/shared/components/ui/money-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { UserAvatar } from '@/shared/components/ui/avatar';
import { toastError } from '@/shared/lib/errors';
import { formatMoney } from '@/shared/lib/format';

interface SettlementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
  members: Membership[];
}

export function SettlementFormDialog({
  open,
  onOpenChange,
  groupId,
  members,
}: SettlementFormDialogProps) {
  const { t, i18n } = useTranslation(['groups', 'common']);
  const lang = (i18n.language?.startsWith('fa') ? 'fa' : 'en') as 'fa' | 'en';
  const queryClient = useQueryClient();

  const [toUserId, setToUserId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const balancesQuery = useQuery({
    queryKey: ['group-balances', groupId],
    queryFn: () => getBalances(groupId),
    enabled: open,
  });

  const creditors = (balancesQuery.data ?? []).filter((b) => b.net > 0);
  const creditorOptions = creditors
    .map((b) => {
      const member = members.find((m) => m.user_phone === b.phone_number);
      return {
        userId: member?.user,
        label: b.full_name,
        phone: b.phone_number,
        net: b.net,
      };
    })
    .filter((c) => c.userId !== undefined) as {
    userId: number;
    label: string;
    phone: string;
    net: number;
  }[];

  useEffect(() => {
    if (open) {
      setToUserId('');
      setAmount(0);
      setValidationError(null);
    }
  }, [open]);

  const selectedCreditor = creditorOptions.find((c) => String(c.userId) === toUserId);

  const mutation = useMutation({
    mutationFn: () => {
      const uid = Number(toUserId);
      if (!uid) throw new Error(t('settlementForm.receiverRequired'));
      if (!amount || amount <= 0) throw new Error(t('settlementForm.amountRequired'));

      return createSettlement(groupId, {
        to_user_id: uid,
        amount,
      });
    },
    onSuccess: () => {
      toast.success(t('settlementForm.success'));
      void queryClient.invalidateQueries({ queryKey: ['group-settlements', groupId] });
      void queryClient.invalidateQueries({ queryKey: ['group-balances', groupId] });
      void queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      onOpenChange(false);
    },
    onError: (err) => toastError(err),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!toUserId) {
      setValidationError(t('settlementForm.receiverRequired'));
      return;
    }
    if (!amount || amount <= 0) {
      setValidationError(t('settlementForm.amountRequired'));
      return;
    }
    setValidationError(null);
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <ArrowLeftRight className="size-5" />
            </div>
            <div>
              <DialogTitle>{t('settlementForm.title')}</DialogTitle>
              <DialogDescription className="text-xs">
                {t('settlementForm.subtitle')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form id="settlement-create-form" onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Receiver Select */}
          <div className="space-y-1.5">
            <Label htmlFor="to-user-select">{t('settlementForm.receiver')}</Label>
            {creditorOptions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground bg-card/40">
                <p>{t('settlementForm.noCreditors')}</p>
              </div>
            ) : (
              <Select
                value={toUserId}
                onValueChange={(val) => {
                  setToUserId(val);
                  setValidationError(null);
                  const cred = creditorOptions.find((c) => String(c.userId) === val);
                  if (cred && amount === 0) {
                    setAmount(cred.net);
                  }
                }}
              >
                <SelectTrigger id="to-user-select" className="h-10 text-xs">
                  <SelectValue placeholder={t('settlementForm.receiverPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {creditorOptions.map((c) => (
                    <SelectItem key={c.userId} value={String(c.userId)} className="text-xs">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={c.label} className="size-5" />
                        <span>{c.label}</span>
                        <span className="text-muted-foreground text-[11px]">
                          ({formatMoney(c.net, { locale: lang })})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Amount Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="settlement-amount">{t('settlementForm.amount')}</Label>
              {selectedCreditor && (
                <button
                  type="button"
                  onClick={() => setAmount(selectedCreditor.net)}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  {t('settlementForm.maxAllowed', {
                    amount: formatMoney(selectedCreditor.net, { locale: lang }),
                  })}
                </button>
              )}
            </div>
            <MoneyInput
              id="settlement-amount"
              value={amount || ''}
              onChange={(val) => {
                setAmount(val);
                setValidationError(null);
              }}
              placeholder={t('settlementForm.amountPlaceholder')}
            />
          </div>

          {validationError && (
            <p className="text-xs text-destructive font-medium">{validationError}</p>
          )}
        </form>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            type="submit"
            form="settlement-create-form"
            disabled={mutation.isPending || creditorOptions.length === 0}
            className="gap-2"
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserCheck className="size-4" />
            )}
            {mutation.isPending ? t('settlementForm.submitting') : t('settlementForm.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
