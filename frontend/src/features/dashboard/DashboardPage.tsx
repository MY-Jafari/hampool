import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  PlusCircle,
  Receipt,
  Ticket,
  Users,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/features/auth/store';
import { useLanguage } from '@/shared/providers/LanguageProvider';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { PageHeader } from '@/shared/components/PageHeader';
import { StatCard } from '@/shared/components/StatCard';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Money } from '@/shared/components/ui/money';
import { DateText } from '@/shared/components/ui/date-text';
import {
  EqualSplitIcon,
  ExactSplitIcon,
  ItemizedSplitIcon,
  PercentageSplitIcon,
} from '@/assets/icons/DomainIcons';
import { getBalances, listExpenses, listGroups } from '@/features/groups/api';
import { formatNumber } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { SplitType } from '@/shared/types/api';

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

export function DashboardPage() {
  const { t } = useTranslation(['groups', 'common']);
  const { language } = useLanguage();
  const navigate = useNavigate();
  const profilePhone = useAuthStore((s) => s.user)?.phone_number ?? '';

  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: listGroups,
  });

  const groupIds = useMemo(
    () => (groupsQuery.data ?? []).map((g) => g.id),
    [groupsQuery.data],
  );

  const topGroups = useMemo(
    () => (groupsQuery.data ?? []).slice(0, 3),
    [groupsQuery.data],
  );

  const topGroupIds = useMemo(
    () => topGroups.map((g) => g.id),
    [topGroups],
  );

  // Balances for every group
  const balancesQueries = useQuery({
    queryKey: ['dashboard-balances', groupIds.join(',')],
    queryFn: async () => {
      const groups = groupsQuery.data ?? [];
      const results = await Promise.all(groups.map((g) => getBalances(g.id)));
      return results;
    },
    enabled: groupIds.length > 0,
  });

  // Recent expenses from up to 3 groups
  const recentExpensesQuery = useQuery({
    queryKey: ['dashboard-expenses', topGroupIds.join(',')],
    queryFn: async () => {
      const results = await Promise.all(topGroups.map((g) => listExpenses(g.id)));
      const groupNames = new Map(topGroups.map((g) => [g.id, g.name]));
      return results
        .flatMap((expenses, i) =>
          expenses.map((e) => ({
            ...e,
            groupName: groupNames.get(topGroups[i]?.id ?? 0) ?? '',
          })),
        )
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 6);
    },
    enabled: topGroupIds.length > 0,
  });

  const loading = groupsQuery.isLoading;
  const error = groupsQuery.isError
    ? groupsQuery.error
    : balancesQueries.isError
      ? balancesQueries.error
      : null;

  // Only the signed-in user's balances count
  const myBalances = (balancesQueries.data ?? [])
    .flat()
    .filter((b) => b.phone_number === profilePhone);
  const myCredit = myBalances.filter((b) => b.net > 0).reduce((s, b) => s + b.net, 0);
  const myDebt = myBalances.filter((b) => b.net < 0).reduce((s, b) => s + Math.abs(b.net), 0);

  const findMyBalance = (groupId: number, phone: string): number | undefined => {
    const list = balancesQueries.data?.[groupsQuery.data?.findIndex((g) => g.id === groupId) ?? -1];
    if (!list) return undefined;
    const mine = list.find((b) => b.phone_number === phone);
    return mine?.net;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.subtitle')}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/groups?join=1')} className="gap-2">
              <Ticket className="size-4" />
              <span>{t('list.join')}</span>
            </Button>
            <Button onClick={() => navigate('/groups?new=1')} className="gap-2">
              <PlusCircle className="size-4" />
              <span>{t('list.create')}</span>
            </Button>
          </>
        }
      />

      {error && !loading && (
        <ErrorState
          error={error}
          onRetry={() => void groupsQuery.refetch()}
          title={t('dashboard.loadFailed')}
        />
      )}

      {/* Financial Summary StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={ArrowDownLeft}
          label={t('dashboard.totalOwed')}
          value={<Money amount={myCredit} showUnit colored signDisplay="never" />}
          tone="owed"
          loading={loading}
        />
        <StatCard
          icon={ArrowUpRight}
          label={t('dashboard.totalOwing')}
          value={<Money amount={myDebt} showUnit colored signDisplay="never" />}
          tone="owing"
          loading={loading}
        />
        <StatCard
          icon={Users}
          label={t('dashboard.groupsCount')}
          value={formatNumber(groupsQuery.data?.length ?? 0, language)}
          tone="default"
          loading={loading}
        />
      </div>

      {/* My Groups Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{t('dashboard.myGroups')}</h2>
          <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
            <Link to="/groups">
              <span>{t('dashboard.viewAll')}</span>
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : (groupsQuery.data?.length ?? 0) === 0 ? (
          <EmptyState
            title={t('list.empty')}
            description={t('list.emptyDesc')}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => navigate('/groups?new=1')} className="gap-2">
                  <PlusCircle className="size-4" />
                  {t('list.create')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/groups?join=1')}
                  className="gap-2"
                >
                  <Ticket className="size-4" />
                  {t('list.join')}
                </Button>
              </div>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {groupsQuery.data?.slice(0, 4).map((group) => {
              const myNet = findMyBalance(group.id, profilePhone);

              return (
                <Link
                  key={group.id}
                  to={`/groups/${group.id}`}
                  className="group block focus:outline-none"
                >
                  <Card className="h-full transition-all duration-200 border-border group-hover:border-primary/40 group-hover:shadow-card-hover group-focus-visible:ring-2 group-focus-visible:ring-ring">
                    <CardHeader className="pb-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="truncate text-base font-bold text-foreground">
                          {group.name}
                        </CardTitle>
                        {myNet !== undefined && (
                          <Badge
                            variant={myNet > 0 ? 'owed' : myNet < 0 ? 'owing' : 'settled'}
                            className="shrink-0"
                          >
                            {myNet === 0 ? (
                              t('dashboard.settled')
                            ) : (
                              <Money amount={myNet} signDisplay={myNet > 0 ? 'always' : 'auto'} />
                            )}
                          </Badge>
                        )}
                      </div>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {group.description || '—'}
                      </p>
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-0">
                      <span className="rounded-md bg-secondary px-2.5 py-1">
                        {t('list.membersCount', {
                          count: formatNumber(group.memberships.length, language),
                        })}
                      </span>
                      <span className="rounded-md bg-secondary px-2.5 py-1">
                        {t('list.totalExpenses', {
                          amount: formatNumber(group.total_expenses, language),
                        })}{' '}
                        {t('financial.toman', { defaultValue: 'تومان' })}
                      </span>
                      {group.budget_limit > 0 && (
                        <span className="rounded-md bg-secondary px-2.5 py-1">
                          {t('financial.budget', { defaultValue: 'بودجه' })}:{' '}
                          <Money amount={group.budget_limit} />
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

      {/* Recent Expenses Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">{t('dashboard.recentExpenses')}</h2>

        {recentExpensesQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : (recentExpensesQuery.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Receipt}
            title={t('dashboard.noExpenses')}
            description=""
            className="py-8"
          />
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {recentExpensesQuery.data?.map((expense) => {
              const SplitIcon = getSplitIcon(expense.split_type);

              return (
                <Link
                  key={`${expense.group}-${expense.id}`}
                  to={`/groups/${expense.group}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-accent/40 focus:outline-none focus:bg-accent/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                      <SplitIcon size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {expense.description}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">{expense.groupName}</span>
                        {' · '}
                        <DateText date={expense.date} withTime />
                        {' · '}
                        <span>{t(`splits.${expense.split_type}`)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-end">
                    <Money
                      amount={expense.total_amount}
                      className={cn(
                        'text-sm font-bold',
                        expense.is_confirmed ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    />
                    <div className="mt-1">
                      {expense.is_confirmed ? (
                        <Badge variant="owed" className="text-[10px] py-0 px-1.5">
                          {t('common:status.confirmed', 'تایید شده')}
                        </Badge>
                      ) : (
                        <Badge variant="pending" className="text-[10px] py-0 px-1.5">
                          {t('dashboard.pendingConfirmation', 'در انتظار تایید')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}
