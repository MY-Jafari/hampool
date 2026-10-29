import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { applyOptimizedSettlements, optimizeSettlements } from '@/features/groups/api';
import type { Membership, OptimizeResult } from '@/shared/types/api';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { UserAvatar } from '@/shared/components/ui/avatar';
import { Money } from '@/shared/components/ui/money';
import { toastError } from '@/shared/lib/errors';
import { formatNumber } from '@/shared/lib/format';

interface OptimizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
  members: Membership[];
}

export function OptimizeDialog({ open, onOpenChange, groupId, members }: OptimizeDialogProps) {
  const { t, i18n } = useTranslation(['groups', 'common']);
  const lang = (i18n.language?.startsWith('fa') ? 'fa' : 'en') as 'fa' | 'en';
  const queryClient = useQueryClient();

  const [data, setData] = useState<OptimizeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const nameOf = useCallback(
    (userId: number): string => {
      const m = members.find((x) => x.user === userId);
      return m ? m.user_name || m.user_phone : `کاربر ${userId}`;
    },
    [members],
  );

  const calculate = useCallback(async () => {
    setLoading(true);
    setIsStale(false);
    setErrorMsg(null);
    try {
      const result = await optimizeSettlements(groupId);
      setData(result);
    } catch {
      setErrorMsg(t('dashboard.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [groupId, t]);

  // Automatically calculate on dialog open
  useEffect(() => {
    if (open) {
      void calculate();
    } else {
      setData(null);
      setIsStale(false);
      setErrorMsg(null);
    }
  }, [open, calculate]);

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error('No suggestions available');
      return applyOptimizedSettlements(groupId, {
        balance_version: data.balance_version,
        suggestions: data.suggestions,
      });
    },
    onSuccess: () => {
      toast.success(t('optimize.applySuccess'));
      void queryClient.invalidateQueries({ queryKey: ['group-settlements', groupId] });
      void queryClient.invalidateQueries({ queryKey: ['group-balances', groupId] });
      void queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-balances'] });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { status?: number; data?: { error?: string } } };
      if (errorObj?.response?.status === 409) {
        setIsStale(true);
        setErrorMsg(t('optimize.staleError'));
      } else {
        toastError(err);
      }
    },
  });

  const totalAmount = data?.suggestions.reduce((acc, s) => acc + s.amount, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ai/15 text-ai">
              <Sparkles className="size-5" />
            </div>
            <div>
              <DialogTitle>{t('optimize.title')}</DialogTitle>
              <DialogDescription className="text-xs">{t('optimize.subtitle')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-xs text-muted-foreground">
              <Loader2 className="size-7 animate-spin text-ai" />
              <span>{t('optimize.calculating')}</span>
            </div>
          )}

          {/* Stale Balance Conflict Banner (409) */}
          {isStale && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 space-y-3 text-center">
              <div className="flex items-center justify-center gap-2 text-destructive font-bold text-sm">
                <AlertTriangle className="size-5" />
                <span>{t('optimize.staleError')}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void calculate()}
                className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <RefreshCw className="size-3.5" />
                <span>{t('optimize.recalculate')}</span>
              </Button>
            </div>
          )}

          {/* General Error */}
          {!loading && !isStale && errorMsg && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center space-y-3">
              <p className="text-xs text-destructive font-medium">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={() => void calculate()} className="gap-2">
                <RefreshCw className="size-3.5" />
                <span>{t('common:actions.retry')}</span>
              </Button>
            </div>
          )}

          {/* All Settled State */}
          {!loading && !errorMsg && data && data.suggestions.length === 0 && (
            <div className="rounded-xl border border-border p-8 text-center bg-card/40 space-y-2">
              <div className="flex size-12 mx-auto items-center justify-center rounded-2xl bg-owed/15 text-owed mb-3">
                <Wallet className="size-6" />
              </div>
              <p className="text-sm font-bold text-foreground">{t('optimize.allSettled')}</p>
            </div>
          )}

          {/* Suggestions List */}
          {!loading && !isStale && data && data.suggestions.length > 0 && (
            <div className="space-y-3">
              {/* Summary Header */}
              <div className="flex items-center justify-between rounded-xl bg-secondary/60 p-3 text-xs">
                <span className="font-medium text-muted-foreground">
                  {t('optimize.planSummary', {
                    amount: '',
                    count: formatNumber(data.suggestions.length, lang),
                  })}
                </span>
                <Money amount={totalAmount} className="font-bold text-sm text-foreground" />
              </div>

              {/* Transactions List */}
              <div className="space-y-2">
                {data.suggestions.map((s, idx) => {
                  const fromName = nameOf(s.from_user_id);
                  const toName = nameOf(s.to_user_id);

                  return (
                    <div
                      key={`${s.from_user_id}-${s.to_user_id}-${idx}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/60 p-3 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <UserAvatar name={fromName} className="size-6 shrink-0" />
                          <span className="font-medium truncate max-w-[90px]">{fromName}</span>
                        </div>

                        <ArrowRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />

                        <div className="flex items-center gap-1.5 min-w-0">
                          <UserAvatar name={toName} className="size-6 shrink-0" />
                          <span className="font-medium truncate max-w-[90px]">{toName}</span>
                        </div>
                      </div>

                      <Money amount={s.amount} className="font-bold text-sm text-primary shrink-0" />
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-muted-foreground pt-1 leading-relaxed">
                {t('optimize.notice')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={applyMutation.isPending}
          >
            {t('common:actions.cancel')}
          </Button>

          {data && data.suggestions.length > 0 && !isStale && (
            <Button
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending}
              className="gap-2"
            >
              {applyMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {applyMutation.isPending ? t('optimize.applying') : t('optimize.apply')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
