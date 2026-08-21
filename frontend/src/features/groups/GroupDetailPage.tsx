import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, LogOut, MoreVertical, ShieldCheck, Sparkles, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/store';
import { deleteGroup, getGroup, removeMember } from '@/features/groups/api';
import { useGroupEvents } from '@/features/notifications/useGroupEvents';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { ErrorState } from '@/shared/components/ErrorState';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { toastError } from '@/shared/lib/errors';
import { roleLabel } from '@/shared/lib/formats';
import { ActivitiesTab } from './components/ActivitiesTab';
import { AiRenameDialog } from './components/AiRenameDialog';
import { ExpensesTab } from './components/ExpensesTab';
import { MembersTab } from './components/MembersTab';
import { OverviewTab } from './components/OverviewTab';
import { ReportsTab } from './components/ReportsTab';
import { SettlementsTab } from './components/SettlementsTab';

export function GroupDetailPage() {
  const { groupId: groupIdParam } = useParams<{ groupId: string }>();
  const groupId = Number(groupIdParam);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);

  const [aiOpen, setAiOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroup(groupId),
    enabled: Number.isFinite(groupId) && groupId > 0,
  });

  // Live group notifications → invalidates queries on every event.
  useGroupEvents(Number.isFinite(groupId) && groupId > 0 ? groupId : undefined);

  const group = groupQuery.data;
  const myMembership = group?.memberships.find((m) => m.user === me?.id);
  const myRole = myMembership?.role;
  const isOwner = group?.owner === me?.id;

  const leaveMutation = useMutation({
    mutationFn: () => removeMember(groupId, me?.id ?? -1),
    onSuccess: () => {
      toast.success('از گروه خارج شدید.');
      setLeaveOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      navigate('/groups', { replace: true });
    },
    onError: (err) => toastError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteGroup(groupId),
    onSuccess: () => {
      toast.success('گروه حذف شد.');
      setDeleteOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      navigate('/groups', { replace: true });
    },
    onError: (err) => toastError(err),
  });

  if (groupQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (groupQuery.isError || !group) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/groups">
            <ArrowRight className="size-4 rtl:rotate-180" />
            بازگشت به گروه‌ها
          </Link>
        </Button>
        <ErrorState
          error={groupQuery.error ?? new Error('گروه پیدا نشد')}
          onRetry={() => void groupQuery.refetch()}
          title="گروه پیدا نشد"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-mb-2" asChild>
        <Link to="/groups">
          <ArrowRight className="size-4 rtl:rotate-180" />
          همه‌ی گروه‌ها
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{group.name}</h1>
            {isOwner && (
              <Badge variant="ai">
                <ShieldCheck className="size-3.5" />
                مالک
              </Badge>
            )}
            {myRole && !isOwner && <Badge variant="secondary">{roleLabel[myRole]}</Badge>}
          </div>
          {group.description && <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>}
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="size-3.5" />
            {group.memberships.length.toLocaleString('fa-IR')} عضو
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ai" size="sm" onClick={() => setAiOpen(true)}>
            <Sparkles className="size-4" />
            پیشنهاد نام با AI
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="عملیات گروه">
                <MoreVertical className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setLeaveOpen(true)}>
                <LogOut className="size-4" />
                خروج از گروه
              </DropdownMenuItem>
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="size-4" />
                    حذف گروه
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start sm:w-auto">
          <TabsTrigger value="overview">نمای کلی</TabsTrigger>
          <TabsTrigger value="expenses">هزینه‌ها</TabsTrigger>
          <TabsTrigger value="settlements">تسویه‌ها</TabsTrigger>
          <TabsTrigger value="members">اعضا</TabsTrigger>
          <TabsTrigger value="activities">فعالیت‌ها</TabsTrigger>
          <TabsTrigger value="reports">گزارش‌ها</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab group={group} myPhone={me?.phone_number ?? ''} />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpensesTab group={group} myId={me?.id ?? -1} myRole={myRole} members={group.memberships} />
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

      <AiRenameDialog open={aiOpen} onOpenChange={setAiOpen} groupId={group.id} />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="خروج از گروه"
        description={isOwner ? 'شما مالک گروه هستید؛ با خروج، مالکیت به قدیمی‌ترین مدیر منتقل می‌شود.' : 'از این گروه خارج می‌شوید؟'}
        confirmLabel="خروج"
        loading={leaveMutation.isPending}
        onConfirm={() => leaveMutation.mutate()}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="حذف گروه"
        description={`گروه «${group.name}» و همه‌ی داده‌هایش (هزینه‌ها، تسویه‌ها، فعالیت‌ها) برای همیشه حذف شود؟`}
        confirmLabel="حذف گروه"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
