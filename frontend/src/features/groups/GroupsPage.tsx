import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PlusCircle, Search, Ticket, Users, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/shared/providers/LanguageProvider';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { PageHeader } from '@/shared/components/PageHeader';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Money } from '@/shared/components/ui/money';
import { listGroups } from '@/features/groups/api';
import { formatMoney, formatNumber, normalizeDigits } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { GroupCreateDialog } from './components/GroupCreateDialog';
import { JoinGroupDialog } from './components/JoinGroupDialog';

type SortOption = 'recent' | 'name' | 'expenses';

export function GroupsPage() {
  const { t } = useTranslation(['groups', 'common']);
  const { language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  const newOpen = searchParams.get('new') === '1';
  const joinOpen = searchParams.get('join') === '1';
  const inviteCode = searchParams.get('code');

  const setOpen = (key: 'new' | 'join', open: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (open) next.set(key, '1');
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: listGroups,
  });

  const filteredAndSortedGroups = useMemo(() => {
    const rawList = groupsQuery.data ?? [];
    const query = normalizeDigits(searchTerm).toLowerCase().trim();

    const filtered = rawList.filter((g) => {
      if (!query) return true;
      const nameMatch = normalizeDigits(g.name).toLowerCase().includes(query);
      const descMatch = g.description
        ? normalizeDigits(g.description).toLowerCase().includes(query)
        : false;
      return nameMatch || descMatch;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, language === 'fa' ? 'fa' : 'en');
      }
      if (sortBy === 'expenses') {
        return (b.total_expenses ?? 0) - (a.total_expenses ?? 0);
      }
      // 'recent' by default (created_at desc or id desc)
      if (a.created_at && b.created_at) {
        return b.created_at.localeCompare(a.created_at);
      }
      return b.id - a.id;
    });
  }, [groupsQuery.data, searchTerm, sortBy, language]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('list.title')}
        description={t('list.subtitle')}
        actions={
          <>
            <Button variant="outline" onClick={() => setOpen('join', true)} className="gap-2">
              <Ticket className="size-4" />
              <span>{t('list.join')}</span>
            </Button>
            <Button onClick={() => setOpen('new', true)} className="gap-2">
              <PlusCircle className="size-4" />
              <span>{t('list.create')}</span>
            </Button>
          </>
        }
      />

      {groupsQuery.isError && (
        <ErrorState
          error={groupsQuery.error}
          onRetry={() => void groupsQuery.refetch()}
          title={t('dashboard.loadFailed')}
        />
      )}

      {/* Filter and Sort Toolbar */}
      {!groupsQuery.isError && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('list.searchPlaceholder')}
              className="ps-9 pe-9"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={t('list.clearSearch')}
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">{t('list.sortBy')}:</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">{t('list.sortRecent')}</SelectItem>
                <SelectItem value="name">{t('list.sortName')}</SelectItem>
                <SelectItem value="expenses">{t('list.sortExpenses')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Loading Skeletons */}
      {groupsQuery.isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      )}

      {/* Empty State: No groups at all */}
      {!groupsQuery.isLoading && !groupsQuery.isError && (groupsQuery.data?.length ?? 0) === 0 && (
        <EmptyState
          icon={Users}
          title={t('list.empty')}
          description={t('list.emptyDesc')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setOpen('new', true)} className="gap-2">
                <PlusCircle className="size-4" />
                {t('list.create')}
              </Button>
              <Button variant="outline" onClick={() => setOpen('join', true)} className="gap-2">
                <Ticket className="size-4" />
                {t('list.join')}
              </Button>
            </div>
          }
        />
      )}

      {/* Empty State: Search filter yielded zero matches */}
      {!groupsQuery.isLoading &&
        !groupsQuery.isError &&
        (groupsQuery.data?.length ?? 0) > 0 &&
        filteredAndSortedGroups.length === 0 && (
          <EmptyState
            title={t('list.noSearchResults')}
            description={t('list.noSearchResultsDesc')}
            action={
              <Button variant="outline" onClick={() => setSearchTerm('')}>
                {t('list.clearSearch')}
              </Button>
            }
          />
        )}

      {/* Groups Grid */}
      {!groupsQuery.isLoading && !groupsQuery.isError && filteredAndSortedGroups.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedGroups.map((group) => {
            const hasBudget = group.budget_limit > 0;
            const remaining = group.remaining_budget ?? 0;
            const overBudget = hasBudget && remaining < 0;
            const spentPct = hasBudget
              ? Math.min(100, Math.max(0, Math.round((group.total_expenses / group.budget_limit) * 100)))
              : 0;

            return (
              <Link key={group.id} to={`/groups/${group.id}`} className="group block focus:outline-none">
                <Card className="h-full flex flex-col justify-between transition-all duration-200 border-border group-hover:border-primary/40 group-hover:shadow-card-hover group-focus-visible:ring-2 group-focus-visible:ring-ring">
                  <CardHeader className="pb-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="truncate text-base font-bold text-foreground">
                        {group.name}
                      </CardTitle>
                      <Badge variant="secondary" className="shrink-0">
                        {t('list.membersCount', {
                          count: formatNumber(group.memberships.length, language),
                        })}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground min-h-[2rem]">
                      {group.description || '—'}
                    </p>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-md bg-secondary/80 px-2 py-1 font-medium text-muted-foreground">
                        {t('list.totalExpenses', {
                          amount: formatMoney(group.total_expenses, { locale: language }),
                        })}
                      </span>

                      {group.invite_code && (
                        <span className="rounded-md bg-secondary/50 px-2 py-1 font-mono text-[11px] text-muted-foreground">
                          {group.invite_code}
                        </span>
                      )}
                    </div>

                    {hasBudget && (
                      <div className="space-y-1.5 pt-1 border-t border-border/50">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>
                            {t('financial.budget', { defaultValue: 'بودجه' })}:{' '}
                            <Money amount={group.budget_limit} showUnit />
                          </span>
                          <span
                            className={cn(
                              'font-medium',
                              overBudget ? 'text-destructive font-semibold' : 'text-muted-foreground',
                            )}
                          >
                            {overBudget
                              ? t('list.budgetExceeded')
                              : t('list.budgetRemaining', {
                                  amount: formatMoney(remaining, { locale: language }),
                                })}
                          </span>
                        </div>

                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-300',
                              overBudget
                                ? 'bg-destructive'
                                : spentPct > 85
                                  ? 'bg-warning'
                                  : 'bg-primary',
                            )}
                            style={{ width: `${spentPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <GroupCreateDialog open={newOpen} onOpenChange={(o) => setOpen('new', o)} />
      <JoinGroupDialog
        open={joinOpen}
        onOpenChange={(o) => setOpen('join', o)}
        initialCode={inviteCode}
      />
    </div>
  );
}
