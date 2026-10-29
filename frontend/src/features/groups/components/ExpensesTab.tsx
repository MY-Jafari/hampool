import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, PlusCircle, Receipt, Search, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Money } from '@/shared/components/ui/money';
import { DateText } from '@/shared/components/ui/date-text';
import { StatusBadge } from '@/shared/components/ui/status-badge';
import {
  EqualSplitIcon,
  ExactSplitIcon,
  ItemizedSplitIcon,
  PercentageSplitIcon,
} from '@/assets/icons/DomainIcons';
import { confirmExpense, deleteExpense, listExpenses } from '@/features/groups/api';
import { toastError } from '@/shared/lib/errors';
import { formatNumber, normalizeDigits } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { Expense, Group, Membership, SplitType } from '@/shared/types/api';
import { ExpenseFormDialog } from './ExpenseFormDialog';
import { ExpenseDetailDrawer } from './ExpenseDetailDrawer';

interface ExpensesTabProps {
  group: Group;
  myId: number;
  myRole: 'admin' | 'member' | undefined;
  members: Membership[];
}

type FilterStatus = 'all' | 'confirmed' | 'pending';

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

export function ExpensesTab({ group, myId, myRole, members }: ExpensesTabProps) {
  const { t, i18n } = useTranslation(['groups', 'common']);
  const lang = (i18n.language?.startsWith('fa') ? 'fa' : 'en') as 'fa' | 'en';
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [toDelete, setToDelete] = useState<Expense | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  const expensesQuery = useQuery({
    queryKey: ['group-expenses', group.id],
    queryFn: () => listExpenses(group.id),
  });

  const nameOf = useCallback(
    (userId: number): string => {
      const m = members.find((x) => x.user === userId);
      return m ? m.user_name || m.user_phone : `کاربر ${userId}`;
    },
    [members],
  );

  const isGroupAdmin = myRole === 'admin' || group.owner === myId;
  const canManage = (expense: Expense): boolean => expense.paid_by === myId || isGroupAdmin;

  const confirmMutation = useMutation({
    mutationFn: (expenseId: number) => confirmExpense(group.id, expenseId),
    onSuccess: () => {
      toast.success(t('expenses.confirmSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['group-expenses', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['group-balances', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['group', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      if (selectedExpense) {
        setSelectedExpense((curr) => (curr ? { ...curr, is_confirmed: true } : null));
      }
    },
    onError: (err) => toastError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: (expenseId: number) => deleteExpense(group.id, expenseId),
    onSuccess: () => {
      toast.success(t('expenses.deleteSuccess'));
      setToDelete(null);
      setSelectedExpense(null);
      void queryClient.invalidateQueries({ queryKey: ['group-expenses', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['group-balances', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['group', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err) => toastError(err),
  });

  // Filter and search expenses
  const filteredExpenses = useMemo(() => {
    const list = expensesQuery.data ?? [];
    const query = normalizeDigits(searchTerm).toLowerCase().trim();

    return list.filter((exp) => {
      // Status filter
      if (statusFilter === 'confirmed' && !exp.is_confirmed) return false;
      if (statusFilter === 'pending' && exp.is_confirmed) return false;

      // Search query
      if (query) {
        const descMatch = normalizeDigits(exp.description).toLowerCase().includes(query);
        const payerMatch = normalizeDigits(nameOf(exp.paid_by)).toLowerCase().includes(query);
        return descMatch || payerMatch;
      }

      return true;
    });
  }, [expensesQuery.data, statusFilter, searchTerm, nameOf]);

  return (
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            {t('expenses.recordedCount', {
              count: formatNumber(expensesQuery.data?.length ?? 0, lang),
            })}
          </p>
        </div>

        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <PlusCircle className="size-4" />
          <span>{t('expenses.newExpense')}</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('expenses.filterSearchPlaceholder')}
            className="ps-9 pe-8 h-9 text-xs"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 self-start sm:self-auto rounded-lg bg-secondary/60 p-1">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={cn(
              'px-2.5 py-1 text-xs rounded-md font-medium transition-colors',
              statusFilter === 'all'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t('expenses.filterAll')}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('confirmed')}
            className={cn(
              'px-2.5 py-1 text-xs rounded-md font-medium transition-colors',
              statusFilter === 'confirmed'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t('expenses.filterConfirmed')}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={cn(
              'px-2.5 py-1 text-xs rounded-md font-medium transition-colors',
              statusFilter === 'pending'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t('expenses.filterPending')}
          </button>
        </div>
      </div>

      {/* Skeletons */}
      {expensesQuery.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      )}

      {/* Error State */}
      {expensesQuery.isError && (
        <ErrorState
          error={expensesQuery.error}
          onRetry={() => void expensesQuery.refetch()}
          title={t('dashboard.loadFailed')}
        />
      )}

      {/* Empty State: No expenses at all */}
      {!expensesQuery.isLoading &&
        !expensesQuery.isError &&
        (expensesQuery.data?.length ?? 0) === 0 && (
          <EmptyState
            icon={Receipt}
            title={t('expenses.emptyTitle')}
            description={t('expenses.emptyDesc')}
            action={
              <Button onClick={() => setCreateOpen(true)} className="gap-2">
                <PlusCircle className="size-4" />
                {t('expenses.newExpense')}
              </Button>
            }
          />
        )}

      {/* Empty State: Search/Filter yielded no results */}
      {!expensesQuery.isLoading &&
        !expensesQuery.isError &&
        (expensesQuery.data?.length ?? 0) > 0 &&
        filteredExpenses.length === 0 && (
          <EmptyState
            title={t('list.noSearchResults')}
            description={t('list.noSearchResultsDesc')}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
              >
                {t('list.clearSearch')}
              </Button>
            }
          />
        )}

      {/* Expenses List */}
      {!expensesQuery.isLoading && !expensesQuery.isError && filteredExpenses.length > 0 && (
        <div className="space-y-2.5">
          {filteredExpenses.map((expense) => {
            const SplitIcon = getSplitIcon(expense.split_type);
            const userCanManage = canManage(expense);
            const isConfirmed = expense.is_confirmed;

            return (
              <Card
                key={expense.id}
                onClick={() => setSelectedExpense(expense)}
                className="p-4 transition-all duration-150 border-border hover:border-primary/40 hover:shadow-card-hover cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                      <SplitIcon size={20} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="truncate text-sm font-bold text-foreground">
                          {expense.description}
                        </p>
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 shrink-0">
                          {t(`splits.${expense.split_type}`)}
                        </Badge>
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground truncate">
                        <span>{t('expenses.paidBy', { name: nameOf(expense.paid_by) })}</span>
                        {' · '}
                        <DateText date={expense.date} withTime />
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-end">
                      <Money amount={expense.total_amount} className="text-base font-bold" />
                      <div className="mt-1">
                        <StatusBadge
                          status={isConfirmed ? 'confirmed_expense' : 'unconfirmed_expense'}
                        />
                      </div>
                    </div>

                    {userCanManage && (
                      <div
                        className="flex items-center gap-1 ms-1 border-s border-border ps-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!isConfirmed && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-owed hover:bg-owed/10"
                            title={t('expenses.confirmExpense')}
                            onClick={() => confirmMutation.mutate(expense.id)}
                            disabled={confirmMutation.isPending}
                          >
                            <CheckCircle2 className="size-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title={t('expenses.deleteExpense')}
                          onClick={() => setToDelete(expense)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <ExpenseFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        groupId={group.id}
        members={members}
      />

      {/* Detail Drawer */}
      <ExpenseDetailDrawer
        expense={selectedExpense}
        open={Boolean(selectedExpense)}
        onOpenChange={(o) => !o && setSelectedExpense(null)}
        members={members}
        canManage={selectedExpense ? canManage(selectedExpense) : false}
        onConfirm={(id) => confirmMutation.mutate(id)}
        onDelete={(exp) => setToDelete(exp)}
        confirmLoading={confirmMutation.isPending}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t('expenses.deleteExpense')}
        description={
          toDelete
            ? t('expenses.deleteConfirmDesc', {
                description: toDelete.description,
                amount: `${toDelete.total_amount.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')} تومان`,
              })
            : undefined
        }
        confirmLabel={t('common:actions.delete')}
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
      />
    </div>
  );
}
