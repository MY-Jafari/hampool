import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { DateText } from '@/shared/components/ui/date-text';
import { listActivities } from '@/features/groups/api';

interface ActivitiesTabProps {
  groupId: number;
}

export function ActivitiesTab({ groupId }: ActivitiesTabProps) {
  const { t } = useTranslation(['groups', 'common']);

  const activitiesQuery = useQuery({
    queryKey: ['group-activities', groupId],
    queryFn: () => listActivities(groupId),
  });

  if (activitiesQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    );
  }

  if (activitiesQuery.isError) {
    return (
      <ErrorState
        error={activitiesQuery.error}
        onRetry={() => void activitiesQuery.refetch()}
        title={t('dashboard.loadFailed')}
      />
    );
  }

  if ((activitiesQuery.data?.length ?? 0) === 0) {
    return (
      <EmptyState
        icon={History}
        title={t('activities.emptyTitle')}
        description={t('activities.emptyDesc')}
      />
    );
  }

  return (
    <Card className="divide-y divide-border overflow-hidden">
      <ul className="divide-y divide-border">
        {activitiesQuery.data?.map((activity) => (
          <li
            key={activity.id}
            className="flex items-start justify-between gap-3 px-4 py-3.5 hover:bg-accent/30 transition-colors"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="font-semibold text-foreground" dir="ltr">
                    {activity.user_phone}
                  </span>
                  <Badge variant="secondary" className="text-[11px] py-0">
                    {t(`activities.actions.${activity.action}`, {
                      defaultValue: activity.action,
                    })}
                  </Badge>
                </div>
                {activity.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{activity.description}</p>
                )}
              </div>
            </div>
            <DateText
              date={activity.timestamp}
              withTime
              className="shrink-0 text-xs text-muted-foreground pt-0.5"
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
