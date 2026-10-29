import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  LogOut,
  MoreVertical,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/store';
import { deleteGroup, getBalances, getGroup, removeMember } from '@/features/groups/api';
import { useGroupEvents } from '@/features/notifications/useGroupEvents';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { ErrorState } from '@/shared/components/ErrorState';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Money } from '@/shared/components/ui/money';
import { UserAvatar } from '@/shared/components/ui/avatar';
import { toastError } from '@/shared/lib/errors';
import { formatMoney, formatNumber } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { ActivitiesTab } from './components/ActivitiesTab';
import { AiRenameDialog } from './components/AiRenameDialog';
import { ExpensesTab } from './components/ExpensesTab';
import { MembersTab } from './components/MembersTab';
import { ReportsTab } from './components/ReportsTab';
import { SettlementsTab } from './components/SettlementsTab';

export function GroupDetailPage() {
  const { groupId: groupIdParam } = useParams<{ groupId: string }>();
  const groupId = Number(groupIdParam);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const { t, i18n } = useTranslation(['groups', 'common']);
  const lang = (i18n.language?.startsWith('fa') ? 'fa' : 'en') as 'fa' | 'en';

  const currentTab = searchParams.get('tab') || 'expenses';

  const handleTabChange = (val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val === 'expenses') next.delete('tab');
    else next.set('tab', val);
    setSearchParams(next, { replace: true });
  };

  const [aiOpen, setAiOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroup(groupId),
    enabled: Number.isFinite(groupId) && groupId > 0,
  });

  const balancesQuery = useQuery({
    queryKey: ['group-balances', groupId],
    queryFn: () => getBalances(groupId),
    enabled: Number.isFinite(groupId) && groupId > 0,
  });

  // Live WebSocket group notifications → invalidates queries on every event
  useGroupEvents(Number.isFinite(groupId) && groupId > 0 ? groupId : undefined);

  const group = groupQuery.data;
  const myMembership = group?.memberships.find((m) => m.user === me?.id);
  const myRole = myMembership?.role;
  const isOwner = group?.owner === me?.id;

  // Signed-in user's balance
  const myBalance = balancesQuery.data?.find((b) => b.phone_number === me?.phone_number);
  const myNet = myBalance?.net ?? 0;

  // Budget calculations
  const hasBudget = Boolean(group && group.budget_limit > 0);
  const budgetLimit = group?.budget_limit ?? 0;
  const totalExpenses = group?.total_expenses ?? 0;
  const remainingBudget = group?.remaining_budget ?? 0;
  const isOverBudget = hasBudget && remainingBudget < 0;
  const budgetUsedPct = hasBudget
    ? Math.min(100, Math.max(0, Math.round((totalExpenses / budgetLimit) * 100)))
    : 0;

  const leaveMutation = useMutation({
    mutationFn: () => removeMember(groupId, me?.id ?? -1),
    onSuccess: () => {
      toast.success(t('detail.leaveSuccess'));
      setLeaveOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      navigate('/groups', { replace: true });
    },
    onError: (err) => toastError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteGroup(groupId),
    onSuccess: () => {
      toast.success(t('detail.deleteSuccess'));
      setDeleteOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      navigate('/groups', { replace: true });
    },
    onError: (err) => toastError(err),
  });

  if (groupQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (groupQuery.isError || !group) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/groups" className="gap-2">
            <ArrowRight className="size-4 rtl:rotate-180" />
            <span>{t('detail.backToGroups')}</span>
          </Link>
        </Button>
        <ErrorState
          error={groupQuery.error ?? new Error(t('detail.notFound'))}
          onRetry={() => void groupQuery.refetch()}
          title={t('detail.notFound')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button */}
      <Button variant="ghost" size="sm" className="-mb-2 gap-2" asChild>
        <Link to="/groups">
          <ArrowRight className="size-4 rtl:rotate-180" />
          <span>{t('detail.backToGroups')}</span>
        </Link>
      </Button>

      {/* Group Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl text-foreground">
              {group.name}
            </h1>
            {isOwner && (
              <Badge variant="ai" className="gap-1">
                <ShieldCheck className="size-3.5" />
                <span>{t('detail.owner')}</span>
              </Badge>
            )}
            {myRole && !isOwner && (
              <Badge variant="secondary">
                {myRole === 'admin' ? t('detail.admin') : t('detail.member')}
              </Badge>
            )}
          </div>

          {group.description && (
            <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
          )}

          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="size-3.5" />
              <span>
                {t('list.membersCount', {
                  count: formatNumber(group.memberships.length, lang),
                })}
              </span>
            </div>
            {group.invite_code && (
              <span className="font-mono bg-secondary px-2 py-0.5 rounded text-[11px]">
                {group.invite_code}
              </span>
            )}
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAiOpen(true)} className="gap-1.5">
            <Sparkles className="size-4 text-ai" />
            <span className="hidden sm:inline">{t('detail.suggestName')}</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="عملیات گروه">
                <MoreVertical className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setLeaveOpen(true)} className="gap-2">
                <LogOut className="size-4" />
                <span>{t('detail.leaveGroup')}</span>
              </DropdownMenuItem>
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                    className="gap-2"
                  >
                    <Trash2 className="size-4" />
                    <span>{t('detail.deleteGroup')}</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Top Overview: Budget & User Balance Standing */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* User Balance Card */}
        <Card className="p-4 flex flex-col justify-between border-border bg-card/60">
          <div>
            <span className="text-xs font-semibold text-muted-foreground">
              {t('detail.yourBalance')}
            </span>
            <div className="mt-2 flex items-center justify-between">
              <Money
                amount={myNet}
                showUnit
                signDisplay={myNet > 0 ? 'always' : 'auto'}
                className={cn(
                  'text-lg font-bold sm:text-xl',
                  myNet > 0 ? 'text-owed' : myNet < 0 ? 'text-owing' : 'text-muted-foreground',
                )}
              />
              <Badge
                variant={myNet > 0 ? 'owed' : myNet < 0 ? 'owing' : 'settled'}
                className="shrink-0"
              >
                {myNet > 0
                  ? t('detail.youAreCreditor')
                  : myNet < 0
                    ? t('detail.youAreDebtor')
                    : t('detail.youAreSettled')}
              </Badge>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {myNet > 0
              ? t('common:financial.youAreOwed')
              : myNet < 0
                ? t('common:financial.youOwe')
                : t('dashboard.settled')}
          </p>
        </Card>

        {/* Budget Progress Card */}
        <Card className="p-4 md:col-span-2 flex flex-col justify-between border-border bg-card/60">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">{t('detail.budget')}</span>
              {hasBudget && (
                <span
                  className={cn(
                    'font-medium text-[11px]',
                    isOverBudget ? 'text-destructive font-semibold' : 'text-muted-foreground',
                  )}
                >
                  {isOverBudget
                    ? t('list.budgetExceeded')
                    : t('detail.budgetRemaining', {
                        amount: formatMoney(remainingBudget, { locale: lang }),
                      })}
                </span>
              )}
            </div>

            {hasBudget ? (
              <>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      isOverBudget
                        ? 'bg-destructive'
                        : budgetUsedPct > 85
                          ? 'bg-warning'
                          : 'bg-primary',
                    )}
                    style={{ width: `${budgetUsedPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {t('common:financial.totalExpenses', { defaultValue: 'مجموع هزینه' })}:{' '}
                    <Money amount={totalExpenses} />
                  </span>
                  <span>
                    {t('detail.budgetLimit')}: <Money amount={budgetLimit} />
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground pt-1">
                {t('detail.noBudgetLimit')} ·{' '}
                {t('common:financial.totalExpenses', { defaultValue: 'مجموع هزینه' })}:{' '}
                <Money amount={totalExpenses} />
              </p>
            )}
          </div>

          {/* Mini Member Balances Strip */}
          {balancesQuery.data && balancesQuery.data.length > 0 && (
            <div className="mt-3 pt-2 border-t border-border/50 flex items-center gap-3 overflow-x-auto text-[11px] no-scrollbar">
              <span className="shrink-0 text-muted-foreground">{t('detail.memberBalances')}:</span>
              {balancesQuery.data.map((b) => (
                <div key={b.phone_number} className="flex items-center gap-1.5 shrink-0">
                  <UserAvatar name={b.full_name} className="size-5" />
                  <span className="font-medium truncate max-w-[80px]">{b.full_name}</span>
                  <span
                    className={cn(
                      'font-bold',
                      b.net > 0 ? 'text-owed' : b.net < 0 ? 'text-owing' : 'text-muted-foreground',
                    )}
                  >
                    {b.net > 0 ? '+' : ''}
                    {formatNumber(b.net, lang)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 5-Tabs Shell */}
      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto h-11 border border-border bg-card/60">
          <TabsTrigger value="expenses" className="text-xs sm:text-sm">
            {t('detail.tabs.expenses')}
          </TabsTrigger>
          <TabsTrigger value="settlements" className="text-xs sm:text-sm">
            {t('detail.tabs.settlements')}
          </TabsTrigger>
          <TabsTrigger value="members" className="text-xs sm:text-sm">
            {t('detail.tabs.members')}
          </TabsTrigger>
          <TabsTrigger value="activities" className="text-xs sm:text-sm">
            {t('detail.tabs.activities')}
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs sm:text-sm">
            {t('detail.tabs.reports')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expenses">
          <ExpensesTab
            group={group}
            myId={me?.id ?? -1}
            myRole={myRole}
            members={group.memberships}
          />
        </TabsContent>

        <TabsContent value="settlements">
          <SettlementsTab group={group} myId={me?.id ?? -1} members={group.memberships} />
        </TabsContent>

        <TabsContent value="members">
          <MembersTab group={group} myId={me?.id ?? -1} myRole={myRole} />
        </TabsContent>

        <TabsContent value="activities">
          <ActivitiesTab groupId={group.id} />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsTab group={group} members={group.memberships} />
        </TabsContent>
      </Tabs>

      {/* AI Name Suggestion Dialog */}
      <AiRenameDialog open={aiOpen} onOpenChange={setAiOpen} groupId={group.id} />

      {/* Leave Group Dialog */}
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title={t('detail.leaveConfirmTitle')}
        description={isOwner ? t('detail.leaveConfirmOwnerDesc') : t('detail.leaveConfirmDesc')}
        confirmLabel={t('detail.leaveGroup')}
        loading={leaveMutation.isPending}
        onConfirm={() => leaveMutation.mutate()}
      />

      {/* Delete Group Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('detail.deleteConfirmTitle')}
        description={t('detail.deleteConfirmDesc', { name: group.name })}
        confirmLabel={t('detail.deleteGroup')}
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
