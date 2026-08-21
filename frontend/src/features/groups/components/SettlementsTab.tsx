import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, CheckCircle2, PlusCircle, Undo2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { confirmSettlement, listSettlements, reverseSettlement } from '@/features/groups/api';
import { toastError } from '@/shared/lib/errors';
import { formatDateTime, formatToman, settlementStatusLabel } from '@/shared/lib/formats';
import type { Group, Membership, Settlement } from '@/shared/types/api';
import { OptimizeDialog } from './OptimizeDialog';
import { SettlementFormDialog } from './SettlementFormDialog';

interface SettlementsTabProps {
  group: Group;
  myId: number;
  members: Membership[];
}

export function SettlementsTab({ group, myId, members }: SettlementsTabProps) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [toReverse, setToReverse] = useState<Settlement | null>(null);

  const settlementsQuery = useQuery({
    queryKey: ['group-settlements', group.id],
    queryFn: () => listSettlements(group.id),
  });

  const nameOf = (userId: number): string => {
    const m = members.find((x) => x.user === userId);
    return m ? m.user_name || m.user_phone : `کاربر ${userId}`;
  };

  const statusVariant = (status: Settlement['status']): 'warning' | 'success' | 'secondary' => {
    if (status === 'pending') return 'warning';
    if (status === 'confirmed') return 'success';
    return 'secondary';
  };

  const confirmMutation = useMutation({
    mutationFn: (id: number) => confirmSettlement(group.id, id),
    onSuccess: () => {
      toast.success('تسویه تایید شد. ✅');
      void queryClient.invalidateQueries({ queryKey: ['group-settlements', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['group-balances', group.id] });
    },
    onError: (err) => toastError(err),
  });

  const reverseMutation = useMutation({
    mutationFn: (id: number) => reverseSettlement(group.id, id),
    onSuccess: () => {
      toast.success('تسویه ابطال شد.');
      setToReverse(null);
      void queryClient.invalidateQueries({ queryKey: ['group-settlements', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['group-balances', group.id] });
    },
    onError: (err) => toastError(err),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {settlementsQuery.data?.length.toLocaleString('fa-IR') ?? '—'} تسویه
        </p>
        <div className="flex gap-2">
          <Button variant="ai" size="sm" onClick={() => setOptimizeOpen(true)}>
            <Wallet className="size-4" />
            پیشنهاد بهینه
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusCircle className="size-4" />
            تسویه جدید
          </Button>
        </div>
      </div>

      {settlementsQuery.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}

      {settlementsQuery.isError && (
        <ErrorState error={settlementsQuery.error} onRetry={() => void settlementsQuery.refetch()} />
      )}

      {!settlementsQuery.isLoading && !settlementsQuery.isError && (settlementsQuery.data?.length ?? 0) === 0 && (
        <EmptyState
          icon={ArrowLeftRight}
          title="تسویه‌ای ثبت نشده"
          description="پس از ثبت هزینه‌ها، بدهی‌ها را با تسویه جبران کنید — یا از پیشنهاد بهینه استفاده کنید."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <PlusCircle className="size-4" />
              تسویه جدید
            </Button>
          }
        />
      )}

      {!settlementsQuery.isLoading && !settlementsQuery.isError && (settlementsQuery.data?.length ?? 0) > 0 && (
        <div className="space-y-2">
          {settlementsQuery.data?.map((settlement) => {
            const iAmReceiver = settlement.to_user === myId;
            const iAmInvolved = settlement.from_user === myId || iAmReceiver;
            const canConfirm = iAmReceiver && settlement.status === 'pending';
            const canReverse = iAmInvolved && settlement.status === 'confirmed';
            return (
              <Card key={settlement.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {nameOf(settlement.from_user)}
                        <span className="mx-1.5 text-muted-foreground">←</span>
                        {nameOf(settlement.to_user)}
                      </p>
                      <Badge variant={statusVariant(settlement.status)}>
                        {settlementStatusLabel[settlement.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(settlement.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <p className="text-sm font-bold">{formatToman(settlement.amount)}</p>
                    {canConfirm && (
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8 text-success"
                        title="تایید دریافت"
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
                        className="size-8 text-destructive"
                        title="ابطال تسویه"
                        onClick={() => setToReverse(settlement)}
                        disabled={reverseMutation.isPending}
                      >
                        <Undo2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <SettlementFormDialog open={createOpen} onOpenChange={setCreateOpen} groupId={group.id} members={members} />
      <OptimizeDialog open={optimizeOpen} onOpenChange={setOptimizeOpen} groupId={group.id} members={members} />

      <ConfirmDialog
        open={Boolean(toReverse)}
        onOpenChange={(o) => !o && setToReverse(null)}
        title="ابطال تسویه"
        description={
          toReverse
            ? `تسویهٔ ${formatToman(toReverse.amount)} بین ${nameOf(toReverse.from_user)} و ${nameOf(toReverse.to_user)} ابطال شود؟`
            : undefined
        }
        confirmLabel="ابطال"
        destructive
        loading={reverseMutation.isPending}
        onConfirm={() => toReverse && reverseMutation.mutate(toReverse.id)}
      />
    </div>
  );
}
