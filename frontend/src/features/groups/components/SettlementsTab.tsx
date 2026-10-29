import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, ArrowRight, CheckCircle2, PlusCircle, RotateCcw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { StatusBadge } from '@/shared/components/ui/status-badge';
import { Money } from '@/shared/components/ui/money';
import { DateText } from '@/shared/components/ui/date-text';
import { UserAvatar } from '@/shared/components/ui/avatar';
import { confirmSettlement, listSettlements, reverseSettlement } from '@/features/groups/api';
import { toastError } from '@/shared/lib/errors';
import { formatNumber } from '@/shared/lib/format';
import type { Group, Membership, Settlement } from '@/shared/types/api';
import { OptimizeDialog } from './OptimizeDialog';
import { SettlementFormDialog } from './SettlementFormDialog';

interface SettlementsTabProps {
  group: Group;
  myId: number;
  members: Membership[];
}

export function SettlementsTab({ group, myId, members }: SettlementsTabProps) {
  const { t, i18n } = useTranslation(['groups', 'common']);
  const lang = (i18n.language?.startsWith('fa') ? 'fa' : 'en') as 'fa' | 'en';
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [toReverse, setToReverse] = useState<Settlement | null>(null);

  const settlementsQuery = useQuery({
    queryKey: ['group-settlements', group.id],
    queryFn: () => listSettlements(group.id),
  });

  const nameOf = useCallback(
    (userId: number): string => {
      const m = members.find((x) => x.user === userId);
      return m ? m.user_name || m.user_phone : `کاربر ${userId}`;
    },
    [members],
  );

  const confirmMutation = useMutation({
    mutationFn: (id: number) => confirmSettlement(group.id, id),
    onSuccess: () => {
      toast.success(t('settlements.confirmSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['group-settlements', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['group-balances', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-balances'] });
    },
    onError: (err) => toastError(err),
  });

  const reverseMutation = useMutation({
    mutationFn: (id: number) => reverseSettlement(group.id, id),
    onSuccess: () => {
      toast.success(t('settlements.reverseSuccess'));
      setToReverse(null);
      void queryClient.invalidateQueries({ queryKey: ['group-settlements', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['group-balances', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-balances'] });
    },
    onError: (err) => toastError(err),
  });

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {t('settlements.recordedCount', {
            count: formatNumber(settlementsQuery.data?.length ?? 0, lang),
          })}
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="ai"
            size="sm"
            onClick={() => setOptimizeOpen(true)}
            className="gap-1.5"
          >
            <Sparkles className="size-4" />
            <span>{t('settlements.optimize')}</span>
          </Button>

          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <PlusCircle className="size-4" />
            <span>{t('settlements.newSettlement')}</span>
          </Button>
        </div>
      </div>

      {/* Skeletons */}
      {settlementsQuery.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      )}

      {/* Error */}
      {settlementsQuery.isError && (
        <ErrorState
          error={settlementsQuery.error}
          onRetry={() => void settlementsQuery.refetch()}
          title={t('dashboard.loadFailed')}
        />
      )}

      {/* Empty State */}
      {!settlementsQuery.isLoading &&
        !settlementsQuery.isError &&
        (settlementsQuery.data?.length ?? 0) === 0 && (
          <EmptyState
            icon={ArrowLeftRight}
            title={t('settlements.emptyTitle')}
            description={t('settlements.emptyDesc')}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
                  <PlusCircle className="size-4" />
                  <span>{t('settlements.newSettlement')}</span>
                </Button>
                <Button
                  size="sm"
                  variant="ai"
                  onClick={() => setOptimizeOpen(true)}
                  className="gap-1.5"
                >
                  <Sparkles className="size-4" />
                  <span>{t('settlements.optimize')}</span>
                </Button>
              </div>
            }
          />
        )}

      {/* Settlements List */}
      {!settlementsQuery.isLoading &&
        !settlementsQuery.isError &&
        (settlementsQuery.data?.length ?? 0) > 0 && (
          <div className="space-y-2.5">
            {settlementsQuery.data?.map((settlement) => {
              const iAmReceiver = settlement.to_user === myId;
              const iAmInvolved = settlement.from_user === myId || iAmReceiver;
              const canConfirm = iAmReceiver && settlement.status === 'pending';
              const canReverse = iAmInvolved && settlement.status === 'confirmed';

              const fromName = nameOf(settlement.from_user);
              const toName = nameOf(settlement.to_user);

              return (
                <Card
                  key={settlement.id}
                  className="p-4 transition-all duration-150 border-border hover:border-primary/40 hover:shadow-card-hover"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0 text-sm font-semibold text-foreground">
                          <UserAvatar name={fromName} className="size-6 shrink-0" />
                          <span className="truncate">{fromName}</span>

                          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" />

                          <UserAvatar name={toName} className="size-6 shrink-0" />
                          <span className="truncate">{toName}</span>
                        </div>

                        <StatusBadge status={settlement.status} />
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        <DateText date={settlement.created_at} withTime />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <Money amount={settlement.amount} className="text-base font-bold" />

                      <div className="flex items-center gap-1">
                        {canConfirm && (
                          <Button
                            size="icon"
                            variant="outline"
                            className="size-8 text-owed border-owed/30 hover:bg-owed/10"
                            title={t('settlements.confirmSettlement')}
                            onClick={() => confirmMutation.mutate(settlement.id)}
                            disabled={confirmMutation.isPending}
                          >
                            <CheckCircle2 className="size-4" />
                          </Button>
                        )}

                        {canReverse && (
                          <Button
                            size="icon"
                            variant="outline"
                            className="size-8 text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/10"
                            title={t('settlements.reverseSettlement')}
                            onClick={() => setToReverse(settlement)}
                            disabled={reverseMutation.isPending}
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      {/* New Settlement Dialog */}
      <SettlementFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        groupId={group.id}
        members={members}
      />

      {/* Optimal Settlement Dialog */}
      <OptimizeDialog
        open={optimizeOpen}
        onOpenChange={setOptimizeOpen}
        groupId={group.id}
        members={members}
      />

      {/* Reverse Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(toReverse)}
        onOpenChange={(o) => !o && setToReverse(null)}
        title={t('settlements.reverseConfirmTitle')}
        description={
          toReverse
            ? t('settlements.reverseConfirmDesc', {
                amount: `${toReverse.amount.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')} تومان`,
                from: nameOf(toReverse.from_user),
                to: nameOf(toReverse.to_user),
              })
            : undefined
        }
        confirmLabel={t('settlements.reverseSettlement')}
        destructive
        loading={reverseMutation.isPending}
        onConfirm={() => toReverse && reverseMutation.mutate(toReverse.id)}
      />
    </div>
  );
}
