import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, PlusCircle, Receipt, Ticket, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';
import { ErrorState } from '@/shared/components/ErrorState';
import { PageHeader } from '@/shared/components/PageHeader';
import { StatCard } from '@/shared/components/StatCard';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  getBalances,
  listExpenses,
  listGroups,
} from '@/features/groups/api';
import { formatCompact, formatDateTime, formatToman, splitTypeLabel } from '@/shared/lib/formats';
import { cn } from '@/shared/lib/utils';

export function DashboardPage() {
  const navigate = useNavigate();
  const profilePhone = useAuthStore((s) => s.user)?.phone_number ?? '';

  const groupsQuery = useQuery({ queryKey: ['groups'], queryFn: listGroups });

  // Balances for every group (kept small — most users have a handful of groups).
  const balancesQueries = useQuery({
    queryKey: ['dashboard-balances', groupsQuery.data?.map((g) => g.id)],
    queryFn: async () => {
      const groups = groupsQuery.data ?? [];
      const results = await Promise.all(groups.map((g) => getBalances(g.id)));
      return results;
    },
    enabled: Boolean(groupsQuery.data?.length),
  });

  // Recent expenses from up to 3 groups.
  const recentExpensesQuery = useQuery({
    queryKey: ['dashboard-expenses', groupsQuery.data?.slice(0, 3).map((g) => g.id)],
    queryFn: async () => {
      const groups = (groupsQuery.data ?? []).slice(0, 3);
      const results = await Promise.all(groups.map((g) => listExpenses(g.id)));
      const groupNames = new Map(groups.map((g) => [g.id, g.name]));
      return results
        .flatMap((expenses, i) => expenses.map((e) => ({ ...e, groupName: groupNames.get(groups[i]?.id ?? 0) ?? '' })))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 6);
    },
    enabled: Boolean(groupsQuery.data?.length),
  });

  const loading = groupsQuery.isLoading;
  const error = groupsQuery.isError ? groupsQuery.error : balancesQueries.isError ? balancesQueries.error : null;

  // Only the signed-in user's balances count — never other members'.
  const myBalances = (balancesQueries.data ?? []).flat().filter((b) => b.phone_number === profilePhone);
  const myCredit = myBalances.filter((b) => b.net > 0).reduce((s, b) => s + b.net, 0);
  const myDebt = myBalances.filter((b) => b.net < 0).reduce((s, b) => s + Math.abs(b.net), 0);

  const findMyBalance = (groupId: number, phone: string): number | undefined => {
    const list = balancesQueries.data?.[groupsQuery.data?.findIndex((g) => g.id === groupId) ?? -1];
    if (!list) return undefined;
    const mine = list.find((b) => b.phone_number === phone);
    return mine?.net;
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="داشبورد"
        description="خلاصه‌ی وضعیت مالی شما در همه‌ی گروه‌ها"
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/groups?join=1')}>
              <Ticket className="size-4" />
              عضویت با کد
            </Button>
            <Button onClick={() => navigate('/groups?new=1')}>
              <PlusCircle className="size-4" />
              گروه جدید
            </Button>
          </>
        }
      />

      {error && !loading && (
        <ErrorState error={error} onRetry={() => void groupsQuery.refetch()} title="بارگیری داشبورد ناموفق بود" />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={ArrowUpRight}
          label="طلب من"
          value={formatToman(myCredit)}
          tone="success"
          loading={loading}
        />
        <StatCard icon={ArrowDownLeft} label="بدهی من" value={formatToman(myDebt)} tone="danger" loading={loading} />
        <StatCard
          icon={Users}
          label="گروه‌های من"
          value={(groupsQuery.data?.length ?? 0).toLocaleString('fa-IR')}
          loading={loading}
        />
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">گروه‌های من</h2>
          <Button variant="link" size="sm" asChild>
            <Link to="/groups">مشاهده همه</Link>
          </Button>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : (groupsQuery.data?.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="mb-3 text-sm text-muted-foreground">هنوز گروهی ندارید. اولین گروه را بسازید!</p>
              <Button onClick={() => navigate('/groups?new=1')}>
                <PlusCircle className="size-4" />
                ساخت گروه
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {groupsQuery.data?.map((group) => {
              const myNet = findMyBalance(group.id, profilePhone);
              return (
                <Link key={group.id} to={`/groups/${group.id}`} className="group">
                  <Card className="h-full transition-shadow group-hover:shadow-card-hover">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="truncate">{group.name}</CardTitle>
                        {myNet !== undefined && (
                          <Badge variant={myNet > 0 ? 'success' : myNet < 0 ? 'destructive' : 'secondary'}>
                            {myNet > 0 ? '+' : myNet < 0 ? '−' : ''}
                            {formatCompact(Math.abs(myNet))} ت
                          </Badge>
                        )}
                      </div>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {group.description || 'بدون توضیح'}
                      </p>
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-md bg-secondary px-2 py-1">
                        {group.memberships.length.toLocaleString('fa-IR')} عضو
                      </span>
                      <span className="rounded-md bg-secondary px-2 py-1">
                        {formatCompact(group.total_expenses)} ت هزینه
                      </span>
                      {group.budget_limit > 0 && (
                        <span className="rounded-md bg-secondary px-2 py-1">
                          {formatCompact(group.budget_limit)} ت بودجه
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">آخرین هزینه‌ها</h2>
        {recentExpensesQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : (recentExpensesQuery.data?.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <Receipt className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">هنوز هزینه‌ای ثبت نشده است.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {recentExpensesQuery.data?.map((expense) => (
              <Link
                key={expense.id}
                to={`/groups/${expense.group}`}
                className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{expense.description}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {expense.groupName} · {formatDateTime(expense.date)} · {splitTypeLabel[expense.split_type]}
                  </p>
                </div>
                <div className="shrink-0 text-left">
                  <p className={cn('text-sm font-bold', expense.is_confirmed ? 'text-foreground' : 'text-muted-foreground')}>
                    {formatToman(expense.total_amount)}
                  </p>
                  {!expense.is_confirmed && <Badge variant="warning" className="mt-1">در انتظار تایید</Badge>}
                </div>
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

