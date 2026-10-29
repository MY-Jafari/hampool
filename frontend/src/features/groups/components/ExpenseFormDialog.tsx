import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Plus, Receipt, Trash2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { createExpense } from '@/features/groups/api';
import type { Membership, SplitType } from '@/shared/types/api';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { MoneyInput } from '@/shared/components/ui/money-input';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { UserAvatar } from '@/shared/components/ui/avatar';
import { Money } from '@/shared/components/ui/money';
import { toastError } from '@/shared/lib/errors';
import { formatMoney, formatNumber, normalizeDigits } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import {
  buildExpensePayload,
  calculateEqualSplit,
  calculateExactSplitSum,
  calculatePercentageSplitAmounts,
  validateEqualSplit,
  validateExactSplit,
  validateItemizedSplit,
  validatePercentageSplit,
  type ExactShare,
  type ItemizedItem,
  type PercentageShare,
} from '../lib/splitCalculations';
import {
  EqualSplitIcon,
  ExactSplitIcon,
  ItemizedSplitIcon,
  PercentageSplitIcon,
} from '@/assets/icons/DomainIcons';

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
  members: Membership[];
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  groupId,
  members,
}: ExpenseFormDialogProps) {
  const { t, i18n } = useTranslation(['groups', 'common']);
  const queryClient = useQueryClient();
  const lang = (i18n.language?.startsWith('fa') ? 'fa' : 'en') as 'fa' | 'en';

  // Form states
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  // Split-specific states
  const [exactShares, setExactShares] = useState<ExactShare[]>([]);
  const [percentageShares, setPercentageShares] = useState<PercentageShare[]>([]);
  const [itemizedItems, setItemizedItems] = useState<ItemizedItem[]>([]);

  // Initialize selected users with all members when dialog opens
  useEffect(() => {
    if (open) {
      const allIds = members.map((m) => m.user);
      setSelectedUserIds(allIds);
      setDescription('');
      setTotalAmount(0);
      setSplitType('equal');

      // Initialize exact shares
      setExactShares(allIds.map((uid) => ({ user: uid, amount: 0 })));

      // Initialize percentage shares equally if possible
      const defaultPct = allIds.length > 0 ? Number((100 / allIds.length).toFixed(1)) : 0;
      setPercentageShares(allIds.map((uid) => ({ user: uid, percentage: defaultPct })));

      // Initialize itemized items
      setItemizedItems([
        {
          name: '',
          total_amount: 0,
          shares: allIds.map((uid) => ({ user: uid, amount: 0 })),
        },
      ]);
    }
  }, [open, members]);

  // Handle member selection toggle for Equal/Exact/Percentage
  const toggleMemberSelection = (userId: number) => {
    setSelectedUserIds((prev) => {
      const exists = prev.includes(userId);
      const next = exists ? prev.filter((id) => id !== userId) : [...prev, userId];

      // Keep exact shares in sync
      setExactShares((curr) => {
        if (exists) return curr.filter((s) => s.user !== userId);
        return [...curr, { user: userId, amount: 0 }];
      });

      // Keep percentage shares in sync
      setPercentageShares((curr) => {
        if (exists) return curr.filter((s) => s.user !== userId);
        const newCount = next.length;
        const newPct = newCount > 0 ? Number((100 / newCount).toFixed(1)) : 0;
        return next.map((uid) => ({ user: uid, percentage: newPct }));
      });

      return next;
    });
  };

  const selectAllMembers = () => {
    const allIds = members.map((m) => m.user);
    setSelectedUserIds(allIds);
    setExactShares(allIds.map((uid) => ({ user: uid, amount: 0 })));
    const defaultPct = allIds.length > 0 ? Number((100 / allIds.length).toFixed(1)) : 0;
    setPercentageShares(allIds.map((uid) => ({ user: uid, percentage: defaultPct })));
  };

  // Calculations for Equal Split
  const equalPerPerson = useMemo(
    () => calculateEqualSplit(totalAmount, selectedUserIds.length),
    [totalAmount, selectedUserIds.length],
  );

  // Calculations for Exact Split
  const exactSum = useMemo(() => calculateExactSplitSum(exactShares), [exactShares]);
  const exactDiff = useMemo(() => totalAmount - exactSum, [totalAmount, exactSum]);

  // Calculations for Percentage Split
  const pctValidation = useMemo(
    () => validatePercentageSplit(percentageShares),
    [percentageShares],
  );
  const pctAmounts = useMemo(
    () => calculatePercentageSplitAmounts(totalAmount, percentageShares),
    [totalAmount, percentageShares],
  );

  // Calculations for Itemized Split
  const itemizedValidation = useMemo(
    () => validateItemizedSplit(itemizedItems),
    [itemizedItems],
  );

  // Validate whole form
  const isFormValid = useMemo(() => {
    if (!description.trim()) return false;

    if (splitType === 'equal') {
      return validateEqualSplit(totalAmount, selectedUserIds).valid;
    }
    if (splitType === 'exact') {
      return validateExactSplit(totalAmount, exactShares).valid;
    }
    if (splitType === 'percentage') {
      return totalAmount > 0 && pctValidation.valid;
    }
    if (splitType === 'itemized') {
      return itemizedValidation.valid;
    }
    return false;
  }, [
    description,
    splitType,
    totalAmount,
    selectedUserIds,
    exactShares,
    pctValidation,
    itemizedValidation,
  ]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = buildExpensePayload({
        description: description.trim(),
        total_amount: totalAmount,
        split_type: splitType,
        selectedUserIds,
        exactShares,
        percentageShares,
        itemizedItems,
      });
      return createExpense(groupId, payload);
    },
    onSuccess: () => {
      toast.success(t('expenseForm.success'));
      void queryClient.invalidateQueries({ queryKey: ['group-expenses', groupId] });
      void queryClient.invalidateQueries({ queryKey: ['group-balances', groupId] });
      void queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      onOpenChange(false);
    },
    onError: (err) => toastError(err),
  });

  const getMemberName = (userId: number) => {
    const m = members.find((x) => x.user === userId);
    return m ? m.user_name || m.user_phone : `کاربر ${userId}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Receipt className="size-5" />
            </div>
            <div>
              <DialogTitle>{t('expenseForm.createTitle')}</DialogTitle>
              <DialogDescription className="text-xs">
                {t('dashboard.subtitle')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          id="expense-create-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (isFormValid && !mutation.isPending) {
              mutation.mutate();
            }
          }}
          className="space-y-5 py-2"
        >
          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="expense-desc">{t('expenseForm.description')}</Label>
            <Input
              id="expense-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('expenseForm.descriptionPlaceholder')}
              autoFocus
            />
          </div>

          {/* Split Type Selector */}
          <div className="space-y-2">
            <Label>{t('expenseForm.splitType')}</Label>
            <Tabs
              value={splitType}
              onValueChange={(val) => setSplitType(val as SplitType)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-4 h-11">
                <TabsTrigger value="equal" className="gap-1.5 text-xs">
                  <EqualSplitIcon size={16} />
                  <span>{t('splits.equal')}</span>
                </TabsTrigger>
                <TabsTrigger value="exact" className="gap-1.5 text-xs">
                  <ExactSplitIcon size={16} />
                  <span>{t('splits.exact')}</span>
                </TabsTrigger>
                <TabsTrigger value="percentage" className="gap-1.5 text-xs">
                  <PercentageSplitIcon size={16} />
                  <span>{t('splits.percentage')}</span>
                </TabsTrigger>
                <TabsTrigger value="itemized" className="gap-1.5 text-xs">
                  <ItemizedSplitIcon size={16} />
                  <span>{t('splits.itemized')}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Total Amount (for equal, exact, percentage) */}
          {splitType !== 'itemized' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="expense-amount">{t('expenseForm.totalAmount')}</Label>
                {splitType === 'exact' && (
                  <button
                    type="button"
                    onClick={() => setTotalAmount(exactSum)}
                    className="text-xs text-primary hover:underline"
                  >
                    {t('common:actions.applySum', { defaultValue: 'تنظیم بر اساس جمع سهم‌ها' })}
                  </button>
                )}
              </div>
              <MoneyInput
                id="expense-amount"
                value={totalAmount || ''}
                onChange={(val) => setTotalAmount(val)}
                placeholder={t('expenseForm.totalAmountPlaceholder')}
              />
            </div>
          )}

          {/* ────────────────── SPLIT METHOD 1: EQUAL ────────────────── */}
          {splitType === 'equal' && (
            <div className="space-y-3 rounded-xl border border-border p-4 bg-card/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">
                    {t('expenseForm.selectMembers')} ({selectedUserIds.length}/{members.length})
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAllMembers}
                  className="text-xs h-7 px-2"
                >
                  {t('common:actions.selectAll', { defaultValue: 'انتخاب همه' })}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {members.map((m) => {
                  const isSelected = selectedUserIds.includes(m.user);
                  return (
                    <button
                      key={m.user}
                      type="button"
                      onClick={() => toggleMemberSelection(m.user)}
                      className={cn(
                        'flex items-center justify-between p-2.5 rounded-lg border text-start transition-all',
                        isSelected
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-card/60 text-muted-foreground hover:bg-accent/40',
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar name={m.user_name || m.user_phone} className="size-6" />
                        <span className="text-xs font-medium truncate">
                          {m.user_name || m.user_phone}
                        </span>
                      </div>
                      <div
                        className={cn(
                          'flex size-4 items-center justify-center rounded border transition-colors',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/40',
                        )}
                      >
                        {isSelected && <Check className="size-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedUserIds.length > 0 && totalAmount > 0 && (
                <div className="rounded-lg bg-secondary/60 p-3 text-xs flex items-center justify-between mt-2">
                  <span className="text-muted-foreground">{t('expenseForm.equalHelp')}</span>
                  <span className="font-bold text-foreground shrink-0">
                    {t('expenseForm.eachPersonShare', {
                      amount: formatMoney(equalPerPerson, { locale: lang }),
                    })}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ────────────────── SPLIT METHOD 2: EXACT ────────────────── */}
          {splitType === 'exact' && (
            <div className="space-y-3 rounded-xl border border-border p-4 bg-card/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  {t('expenseForm.selectMembers')}
                </span>
                <span
                  className={cn(
                    'text-xs font-medium',
                    exactDiff === 0
                      ? 'text-owed'
                      : exactDiff > 0
                        ? 'text-warning'
                        : 'text-destructive',
                  )}
                >
                  {exactDiff === 0
                    ? t('expenseForm.exactMatches')
                    : t('expenseForm.remainingToAllocate', {
                        amount: formatMoney(Math.abs(exactDiff), { locale: lang }),
                      })}
                </span>
              </div>

              <div className="space-y-2 pt-1">
                {exactShares.map((share, idx) => {
                  const name = getMemberName(share.user);
                  return (
                    <div
                      key={share.user}
                      className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card/60"
                    >
                      <UserAvatar name={name} className="size-7 shrink-0" />
                      <span className="text-xs font-medium truncate w-32 shrink-0">{name}</span>
                      <MoneyInput
                        value={share.amount || ''}
                        onChange={(val) => {
                          setExactShares((curr) =>
                            curr.map((s, i) => (i === idx ? { ...s, amount: val } : s)),
                          );
                        }}
                        placeholder="0"
                        className="h-8 text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ────────────────── SPLIT METHOD 3: PERCENTAGE ─────────────── */}
          {splitType === 'percentage' && (
            <div className="space-y-3 rounded-xl border border-border p-4 bg-card/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  {t('expenseForm.selectMembers')}
                </span>
                <span
                  className={cn(
                    'text-xs font-medium',
                    pctValidation.valid ? 'text-owed' : 'text-destructive font-bold',
                  )}
                >
                  {pctValidation.valid
                    ? t('expenseForm.percentageMatches')
                    : t('expenseForm.totalPercentage', {
                        percent: formatNumber(pctValidation.totalPercentage, lang),
                      })}
                </span>
              </div>

              <div className="space-y-2 pt-1">
                {percentageShares.map((share, idx) => {
                  const name = getMemberName(share.user);
                  const calcAmount = pctAmounts.find((a) => a.user === share.user)?.amount ?? 0;

                  return (
                    <div
                      key={share.user}
                      className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card/60"
                    >
                      <UserAvatar name={name} className="size-7 shrink-0" />
                      <span className="text-xs font-medium truncate w-28 shrink-0">{name}</span>
                      <div className="relative flex-1">
                        <Input
                          type="text"
                          dir="ltr"
                          inputMode="decimal"
                          value={share.percentage || ''}
                          onChange={(e) => {
                            const clean = normalizeDigits(e.target.value).replace(/[^\d.]/g, '');
                            const val = parseFloat(clean) || 0;
                            setPercentageShares((curr) =>
                              curr.map((s, i) => (i === idx ? { ...s, percentage: val } : s)),
                            );
                          }}
                          placeholder="0"
                          className="h-8 text-xs text-center pe-6 font-mono"
                        />
                        <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                          ٪
                        </span>
                      </div>
                      <div className="w-24 text-end shrink-0">
                        <Money amount={calcAmount} className="text-xs font-bold" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ────────────────── SPLIT METHOD 4: ITEMIZED ───────────────── */}
          {splitType === 'itemized' && (
            <div className="space-y-4 rounded-xl border border-border p-4 bg-card/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  {t('expenses.items')} ({itemizedItems.length})
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setItemizedItems((curr) => [
                      ...curr,
                      {
                        name: '',
                        total_amount: 0,
                        shares: members.map((m) => ({ user: m.user, amount: 0 })),
                      },
                    ]);
                  }}
                  className="gap-1 text-xs h-7 px-2"
                >
                  <Plus className="size-3.5" />
                  <span>{t('expenseForm.addItem')}</span>
                </Button>
              </div>

              <div className="space-y-4">
                {itemizedItems.map((item, itemIdx) => {
                  const sharesSum = item.shares.reduce(
                    (acc, s) => acc + (Number(s.amount) || 0),
                    0,
                  );
                  const itemDiff = item.total_amount - sharesSum;

                  return (
                    <div
                      key={itemIdx}
                      className="rounded-xl border border-border bg-card p-3 space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder={t('expenseForm.itemNamePlaceholder')}
                          value={item.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItemizedItems((curr) =>
                              curr.map((it, idx) => (idx === itemIdx ? { ...it, name: val } : it)),
                            );
                          }}
                          className="h-8 text-xs flex-1"
                        />
                        <div className="w-36">
                          <MoneyInput
                            value={item.total_amount || ''}
                            onChange={(val) => {
                              setItemizedItems((curr) =>
                                curr.map((it, idx) =>
                                  idx === itemIdx ? { ...it, total_amount: val } : it,
                                ),
                              );
                            }}
                            placeholder="مبلغ"
                            className="h-8 text-xs"
                          />
                        </div>
                        {itemizedItems.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setItemizedItems((curr) => curr.filter((_, idx) => idx !== itemIdx));
                            }}
                            className="size-8 text-muted-foreground hover:text-destructive"
                            aria-label={t('expenseForm.removeItem')}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>

                      {/* Shares per item */}
                      <div className="space-y-1.5 border-t border-border/60 pt-2">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{t('expenseForm.itemShares')}:</span>
                          <span
                            className={cn(
                              itemDiff === 0
                                ? 'text-owed'
                                : itemDiff > 0
                                  ? 'text-warning'
                                  : 'text-destructive',
                            )}
                          >
                            {itemDiff === 0
                              ? t('expenseForm.exactMatches')
                              : t('expenseForm.remainingToAllocate', {
                                  amount: formatMoney(Math.abs(itemDiff), { locale: lang }),
                                })}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {item.shares.map((sh, shareIdx) => {
                            const name = getMemberName(sh.user);
                            return (
                              <div
                                key={sh.user}
                                className="flex items-center gap-1.5 p-1.5 rounded-lg border border-border/70 bg-card/40"
                              >
                                <span className="text-[11px] font-medium truncate flex-1">
                                  {name}
                                </span>
                                <div className="w-24">
                                  <MoneyInput
                                    value={sh.amount || ''}
                                    onChange={(val) => {
                                      setItemizedItems((curr) =>
                                        curr.map((it, i) =>
                                          i === itemIdx
                                            ? {
                                                ...it,
                                                shares: it.shares.map((s, si) =>
                                                  si === shareIdx ? { ...s, amount: val } : s,
                                                ),
                                              }
                                            : it,
                                        ),
                                      );
                                    }}
                                    placeholder="0"
                                    className="h-7 text-[11px] px-2"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Itemized Summary */}
              <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-2.5 text-xs">
                <span className="font-medium text-muted-foreground">
                  {t('expenseForm.totalAmount')}
                </span>
                <Money
                  amount={itemizedValidation.totalExpense}
                  className="font-bold text-sm text-foreground"
                />
              </div>
            </div>
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
            form="expense-create-form"
            disabled={!isFormValid || mutation.isPending}
            className="gap-2"
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Receipt className="size-4" />
            )}
            {mutation.isPending ? t('expenseForm.submitting') : t('expenseForm.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
