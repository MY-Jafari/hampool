import { useQuery } from '@tanstack/react-query';
import { PlusCircle, Ticket, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { PageHeader } from '@/shared/components/PageHeader';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { listGroups } from '@/features/groups/api';
import { formatCompact } from '@/shared/lib/formats';
import { GroupCreateDialog } from './components/GroupCreateDialog';
import { JoinGroupDialog } from './components/JoinGroupDialog';

export function GroupsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const newOpen = searchParams.get('new') === '1';
  const joinOpen = searchParams.get('join') === '1';
  const inviteCode = searchParams.get('code');

  const setOpen = (key: 'new' | 'join', open: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (open) next.set(key, '1');
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const groupsQuery = useQuery({ queryKey: ['groups'], queryFn: listGroups });

  return (
    <div className="space-y-6">
      <PageHeader
        title="گروه‌ها"
        description="همه‌ی گروه‌هایی که عضو آنها هستید"
        actions={
          <>
            <Button variant="outline" onClick={() => setOpen('join', true)}>
              <Ticket className="size-4" />
              عضویت با کد
            </Button>
            <Button onClick={() => setOpen('new', true)}>
              <PlusCircle className="size-4" />
              گروه جدید
            </Button>
          </>
        }
      />

      {groupsQuery.isError && (
        <ErrorState error={groupsQuery.error} onRetry={() => void groupsQuery.refetch()} />
      )}

      {groupsQuery.isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}

      {!groupsQuery.isLoading && !groupsQuery.isError && (groupsQuery.data?.length ?? 0) === 0 && (
        <EmptyState
          icon={Users}
          title="هنوز گروهی ندارید"
          description="اولین گروه را بسازید یا با کد دعوت به یک گروه بپیوندید."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setOpen('new', true)}>
                <PlusCircle className="size-4" />
                ساخت گروه
              </Button>
              <Button variant="outline" onClick={() => setOpen('join', true)}>
                <Ticket className="size-4" />
                عضویت با کد
              </Button>
            </div>
          }
        />
      )}

      {!groupsQuery.isLoading && !groupsQuery.isError && (groupsQuery.data?.length ?? 0) > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {groupsQuery.data?.map((group) => {
            const overBudget =
              group.budget_limit > 0 && group.remaining_budget !== null && group.remaining_budget < 0;
            return (
              <Link key={group.id} to={`/groups/${group.id}`} className="group">
                <Card className="h-full transition-shadow group-hover:shadow-card-hover">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="truncate">{group.name}</CardTitle>
                      <Badge variant={overBudget ? 'destructive' : 'secondary'}>
                        {group.memberships.length.toLocaleString('fa-IR')} عضو
                      </Badge>
                    </div>
                    {group.description && (
                      <p className="line-clamp-1 text-xs text-muted-foreground">{group.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md bg-secondary px-2 py-1">
                      مجموع هزینه: {formatCompact(group.total_expenses)} ت
                    </span>
                    {group.budget_limit > 0 && (
                      <span className="rounded-md bg-secondary px-2 py-1">
                        بودجه: {formatCompact(group.budget_limit)} ت
                      </span>
                    )}
                    <span className="rounded-md bg-secondary px-2 py-1">
                      {group.invite_code ? 'کد دعوت فعال' : 'بدون کد دعوت'}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <GroupCreateDialog open={newOpen} onOpenChange={(o) => setOpen('new', o)} />
      <JoinGroupDialog open={joinOpen} onOpenChange={(o) => setOpen('join', o)} initialCode={inviteCode} />
    </div>
  );
}
