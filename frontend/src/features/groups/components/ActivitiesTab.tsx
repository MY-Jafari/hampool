import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { listActivities } from '@/features/groups/api';
import { activityLabel, formatDateTime } from '@/shared/lib/formats';

interface ActivitiesTabProps {
  groupId: number;
}

export function ActivitiesTab({ groupId }: ActivitiesTabProps) {
  const activitiesQuery = useQuery({
    queryKey: ['group-activities', groupId],
    queryFn: () => listActivities(groupId),
  });

  if (activitiesQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }

  if (activitiesQuery.isError) {
    return <ErrorState error={activitiesQuery.error} onRetry={() => void activitiesQuery.refetch()} />;
  }

  if ((activitiesQuery.data?.length ?? 0) === 0) {
    return (
      <EmptyState
        icon={History}
        title="هنوز فعالیتی ثبت نشده"
        description="فعالیت‌های گروه اینجا نمایش داده می‌شوند."
      />
    );
  }

  return (
    <Card>
      <ul className="divide-y divide-border">
        {activitiesQuery.data?.map((activity) => (
          <li key={activity.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60" />
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-semibold">{activity.user_phone}</span>
                  <span className="mx-1.5 text-muted-foreground">—</span>
                  <Badge variant="secondary">{activityLabel(activity.action)}</Badge>
                </p>
                {activity.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{activity.description}</p>
                )}
              </div>
            </div>
            <p className="shrink-0 text-xs text-muted-foreground">{formatDateTime(activity.timestamp)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
