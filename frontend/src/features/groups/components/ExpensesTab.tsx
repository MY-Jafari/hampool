import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, PlusCircle, Receipt, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { confirmExpense, deleteExpense, listExpenses } from '@/features/groups/api';
import { toastError } from '@/shared/lib/errors';
import { formatDateTime, formatToman, splitTypeLabel } from '@/shared/lib/formats';
import type { Expense, Group, Membership } from '@/shared/types/api';
import { ExpenseFormDialog } from './ExpenseFormDialog';

interface ExpensesTabProps {
  group: Group;
  myId: number;
  myRole: 'admin' | 'member' | undefined;
  members: Membership[];
}

export function ExpensesTab({ group, myId, myRole, members }: ExpensesTabProps) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Expense | null>(null);

  const expensesQuery = useQuery({
    queryKey: ['group-expenses', group.id],
    queryFn: () => listExpenses(group.id),
  });

  const nameOf = (userId: number): string => {
    const m = members.find((x) => x.user === userId);
    return m ? m.user_name || m.user_phone : `کاربر ${userId}`;
  };

  const canManage = (expense: Expense): boolean => expense.paid_by === myId || myRole === 'admin';

  const confirmMutation = useMutation({
    mutationFn: (expenseId: number) => confirmExpense(group.id, expenseId),
    onSuccess: () => {
      toast.success('هزینه تایید شد.');
      void queryClient.invalidateQueries({ queryKey: ['group-expenses', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['group-balances', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['group', group.id] });
    },
    onError: (err) => toastError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: (expenseId: number) => deleteExpense(group.id, expenseId),
    onSuccess: () => {
      toast.success('هزینه حذف شد.');
      setToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['group-expenses', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['group-balances', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['group', group.id] });
    },
    onError: (err) => toastError(err),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {expensesQuery.data?.length.toLocaleString('fa-IR') ?? '—'} هزینه ثبت شده
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusCircle className="size-4" />
          هزینه جدید
        </Button>
      </div>

      {expensesQuery.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}

      {expensesQuery.isError && (
        <ErrorState error={expensesQuery.error} onRetry={() => void expensesQuery.refetch()} />
      )}

      {!expensesQuery.isLoading && !expensesQuery.isError && (expensesQuery.data?.length ?? 0) === 0 && (
        <EmptyState
          icon={Receipt}
          title="هنوز هزینه‌ای ثبت نشده"
          description="اولین هزینه را برای این گروه ثبت کنید."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <PlusCircle className="size-4" />
              ثبت هزینه
            </Button>
          }
        />
      )}

      {!expensesQuery.isLoading && !expensesQuery.isError && (expensesQuery.data?.length ?? 0) > 0 && (
        <div className="space-y-2">
          {expensesQuery.data?.map((expense) => (
            <Card key={expense.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{expense.description}</p>
                    <Badge variant={expense.is_confirmed ? 'success' : 'warning'}>
                      {expense.is_confirmed ? 'تایید شده' : 'در انتظار تایید'}
                    </Badge>
                    <Badge variant="secondary">{splitTypeLabel[expense.split_type]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    پرداخت‌کننده: {nameOf(expense.paid_by)} · {formatDateTime(expense.date)}
                  </p>
                  {expense.splits.length > 0 && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      سهم‌ها: {expense.splits.map((s) => `${nameOf(s.user)}: ${formatToman(s.amount ?? 0)}`).join('، ')}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <p className="text-sm font-bold">{formatToman(expense.total_amount)}</p>
                  {canManage(expense) && (
                    <div className="flex gap-1">
                      {!expense.is_confirmed && (
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-8 text-success"
                          title="تایید هزینه"
                          onClick={() => confirmMutation.mutate(expense.id)}
                          disabled={confirmMutation.isPending}
                        >
                          <CheckCircle2 className="size-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8 text-destructive"
                        title="حذف هزینه"
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
          ))}
        </div>
      )}

      <ExpenseFormDialog open={createOpen} onOpenChange={setCreateOpen} groupId={group.id} members={members} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="حذف هزینه"
        description={
          toDelete
            ? `«${toDelete.description}» به مبلغ ${formatToman(toDelete.total_amount)} حذف شود؟ این عمل قابل بازگشت نیست.`
            : undefined
        }
        confirmLabel="حذف"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
      />
    </div>
  );
}
