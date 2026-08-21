import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, PlusCircle, Wallet } from 'lucide-react';
import { useState } from 'react';
import { ErrorState } from '@/shared/components/ErrorState';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { getBalances } from '@/features/groups/api';
import { formatToman } from '@/shared/lib/formats';
import { cn } from '@/shared/lib/utils';
import type { Group } from '@/shared/types/api';
import { ExpenseFormDialog } from './ExpenseFormDialog';
import { OptimizeDialog } from './OptimizeDialog';
import { SettlementFormDialog } from './SettlementFormDialog';

interface OverviewTabProps {
  group: Group;
  myPhone: string;
}

export function OverviewTab({ group, myPhone }: OverviewTabProps) {
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [optimizeOpen, setOptimizeOpen] = useState(false);

  const balancesQuery = useQuery({
    queryKey: ['group-balances', group.id],
    queryFn: () => getBalances(group.id),
  });

  const budgetUsed =
    group.budget_limit > 0 ? Math.min(100, Math.round((group.total_expenses / group.budget_limit) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setExpenseOpen(true)}>
          <PlusCircle className="size-4" />
          ثبت هزینه
        </Button>
        <Button variant="outline" onClick={() => setSettlementOpen(true)}>
          <ArrowLeftRight className="size-4" />
          تسویه جدید
        </Button>
        <Button variant="ai" onClick={() => setOptimizeOpen(true)}>
          <Wallet className="size-4" />
          پیشنهاد تسویه بهینه
        </Button>
      </div>

      {/* Budget */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">بودجه گروه</CardTitle>
        </CardHeader>
        <CardContent>
          {group.budget_limit > 0 ? (
            <>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">هزینه‌ی تاییدشده: {formatToman(group.total_expenses)}</span>
                <span className="font-semibold">{formatToman(group.budget_limit)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    budgetUsed > 90 ? 'bg-destructive' : budgetUsed > 70 ? 'bg-warning' : 'bg-primary',
                  )}
                  style={{ width: `${budgetUsed}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {budgetUsed.toLocaleString('fa-IR')}٪ استفاده شده ·{' '}
                {group.remaining_budget !== null
                  ? `باقی‌مانده: ${formatToman(group.remaining_budget)}`
                  : '—'}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              بدون محدودیت بودجه · مجموع هزینه‌ی تاییدشده: {formatToman(group.total_expenses)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Balances */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">موجودی اعضا</CardTitle>
        </CardHeader>
        <CardContent>
          {balancesQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : balancesQuery.isError ? (
            <ErrorState error={balancesQuery.error} onRetry={() => void balancesQuery.refetch()} />
          ) : (
            <ul className="divide-y divide-border">
              {balancesQuery.data?.map((balance) => {
                const isMe = balance.phone_number === myPhone;
                return (
                  <li key={balance.phone_number} className={cn('flex items-center justify-between gap-3 py-3', isMe && 'rounded-lg bg-primary/5 px-2')}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {balance.full_name}
                        {isMe && <span className="mr-1 text-xs text-muted-foreground">(من)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {balance.phone_number}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-sm font-bold',
                          balance.net > 0 ? 'text-success' : balance.net < 0 ? 'text-danger' : 'text-muted-foreground',
                        )}
                      >
                        {balance.net > 0 ? '+' : balance.net < 0 ? '−' : ''}
                        {formatToman(Math.abs(balance.net))}
                      </span>
                      <Badge variant={balance.net > 0 ? 'success' : balance.net < 0 ? 'destructive' : 'secondary'}>
                        {balance.net > 0 ? 'طلبکار' : balance.net < 0 ? 'بدهکار' : 'تسویه'}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <ExpenseFormDialog open={expenseOpen} onOpenChange={setExpenseOpen} groupId={group.id} members={group.memberships} />
      <SettlementFormDialog open={settlementOpen} onOpenChange={setSettlementOpen} groupId={group.id} members={group.memberships} />
      <OptimizeDialog open={optimizeOpen} onOpenChange={setOptimizeOpen} groupId={group.id} members={group.memberships} />
    </div>
  );
}

