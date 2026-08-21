import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Check, Loader2, RefreshCw, Wallet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { applyOptimizedSettlements, optimizeSettlements } from '@/features/groups/api';
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
import { toastError } from '@/shared/lib/errors';
import { formatToman } from '@/shared/lib/formats';

interface OptimizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
  members: Membership[];
}

export function OptimizeDialog({ open, onOpenChange, groupId, members }: OptimizeDialogProps) {
  const queryClient = useQueryClient();
  const [suggestions, setSuggestions] = useState<Awaited<ReturnType<typeof optimizeSettlements>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOf = (userId: number): string => {
    const m = members.find((x) => x.user === userId);
    return m ? m.user_name || m.user_phone : `کاربر ${userId}`;
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    setSuggestions(null);
    try {
      const result = await optimizeSettlements(groupId);
      setSuggestions(result);
    } catch {
      setError('امکان دریافت پیشنهاد وجود ندارد؛ بعداً تلاش کنید.');
    } finally {
      setLoading(false);
    }
  };

  const applyMutation = useMutation({
    mutationFn: () => {
      if (!suggestions) throw new Error('no suggestions');
      return applyOptimizedSettlements(groupId, {
        balance_version: suggestions.balance_version,
        suggestions: suggestions.suggestions,
      });
    },
    onSuccess: () => {
      toast.success('تسویه‌های پیشنهادی ایجاد شدند. هر بدهکار باید تسویه‌ی خود را تایید کند.');
      onOpenChange(false);
      setSuggestions(null);
      void queryClient.invalidateQueries({ queryKey: ['group-settlements', groupId] });
      void queryClient.invalidateQueries({ queryKey: ['group-balances', groupId] });
    },
    onError: (err) => {
      // 409 → balances changed
      toastError(err);
      setSuggestions(null);
    },
  });

  const total = suggestions?.suggestions.reduce((acc, s) => acc + s.amount, 0) ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setSuggestions(null);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-5 text-ai" />
            پیشنهاد تسویه بهینه
          </DialogTitle>
          <DialogDescription>
            کمترین تعداد پرداخت برای تسویه‌ی کامل بدهی‌های گروه.
          </DialogDescription>
        </DialogHeader>

        {!suggestions && !loading && !error && (
          <div className="py-4 text-center">
            <Button variant="ai" onClick={() => void generate()}>
              <Wallet className="size-4" />
              محاسبه پیشنهاد
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-ai" />
            در حال محاسبه...
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void generate()}>
              <RefreshCw className="size-4" />
              تلاش مجدد
            </Button>
          </div>
        )}

        {suggestions && suggestions.suggestions.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            همه‌چیز تسویه است! بدهی‌ای برای پیشنهاد باقی نمانده. 🎉
          </p>
        )}

        {suggestions && suggestions.suggestions.length > 0 && (
          <div className="space-y-2">
            <ul className="space-y-2">
              {suggestions.suggestions.map((s, i) => (
                <li
                  key={`${s.from_user_id}-${s.to_user_id}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{nameOf(s.from_user_id)}</span>
                    <ArrowLeftRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
                    <span className="truncate font-medium">{nameOf(s.to_user_id)}</span>
                  </div>
                  <span className="shrink-0 font-bold text-primary">{formatToman(s.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="pt-1 text-xs text-muted-foreground">
              مجموع: <b>{formatToman(total)}</b> در {suggestions.suggestions.length.toLocaleString('fa-IR')} پرداخت.
            </p>
            <p className="text-xs text-muted-foreground">
              با ایجاد این تسویه‌ها، همه‌ی بدهی‌ها به حالت «در انتظار تایید» در می‌آیند.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            بستن
          </Button>
          {suggestions && suggestions.suggestions.length > 0 && (
            <Button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
              {applyMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              ایجاد تسویه‌ها
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
