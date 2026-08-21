import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Loader2, Plus, QrCode, RefreshCw, ShieldCheck, Trash2, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { addMember, changeRole, generateInvite, getGroupQrUrl, removeMember } from '@/features/groups/api';
import { toastError } from '@/shared/lib/errors';
import { formatDate, isValidPhone, roleLabel } from '@/shared/lib/formats';
import type { Group, Membership } from '@/shared/types/api';

const schema = z.object({
  phone_number: z
    .string()
    .min(1, 'شماره موبایل را وارد کنید')
    .refine(isValidPhone, 'شماره باید با ۰۹ شروع شود و ۱۱ رقم باشد'),
});

type FormValues = z.infer<typeof schema>;

interface MembersTabProps {
  group: Group;
  myId: number;
  myRole: 'admin' | 'member' | undefined;
}

export function MembersTab({ group, myId, myRole }: MembersTabProps) {
  const queryClient = useQueryClient();
  const isAdmin = myRole === 'admin';
  const [toRemove, setToRemove] = useState<Membership | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { phone_number: '' } });

  const addMutation = useMutation({
    mutationFn: (values: FormValues) => addMember(group.id, values.phone_number),
    onSuccess: (membership) => {
      toast.success(`${membership.user_name || membership.user_phone} به گروه اضافه شد.`);
      reset();
      void queryClient.invalidateQueries({ queryKey: ['group', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err) => toastError(err),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: 'admin' | 'member' }) =>
      changeRole(group.id, userId, role),
    onSuccess: () => {
      toast.success('نقش عضو به‌روزرسانی شد.');
      void queryClient.invalidateQueries({ queryKey: ['group', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err) => toastError(err),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: number) => removeMember(group.id, userId),
    onSuccess: () => {
      toast.success('عضو حذف شد.');
      setToRemove(null);
      void queryClient.invalidateQueries({ queryKey: ['group', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err) => toastError(err),
  });

  const inviteMutation = useMutation({
    mutationFn: () => generateInvite(group.id),
    onSuccess: () => {
      toast.success('کد دعوت جدید ساخته شد.');
      setQrUrl(null);
      void queryClient.invalidateQueries({ queryKey: ['group', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err) => toastError(err),
  });

  const showQr = async () => {
    if (qrUrl) return;
    setQrLoading(true);
    try {
      const url = await getGroupQrUrl(group.id);
      setQrUrl(url);
    } catch (err) {
      toastError(err);
    } finally {
      setQrLoading(false);
    }
  };

  const copyInvite = async () => {
    if (!group.invite_code) return;
    try {
      await navigator.clipboard.writeText(group.invite_code);
      toast.success('کد دعوت کپی شد.');
    } catch {
      toast.error('کپی ناموفق بود.');
    }
  };

  const inviteLink = group.invite_code
    ? `${window.location.origin}/groups?join=1&code=${group.invite_code}`
    : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Invite card */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">دعوت به گروه</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {group.invite_code ? (
            <>
              <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-center">
                <p className="text-xs text-muted-foreground">کد دعوت</p>
                <p className="mt-1 text-lg font-bold tracking-[0.3em] text-primary" dir="ltr">
                  {group.invite_code}
                </p>
                {group.invite_code_expires_at && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    اعتبار تا {formatDate(group.invite_code_expires_at)}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void copyInvite()}>
                  <Copy className="size-4" />
                  کپی کد
                </Button>
                <Button size="sm" variant="outline" onClick={() => void showQr()} disabled={qrLoading}>
                  {qrLoading ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
                  نمایش QR
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending}>
                    <RefreshCw className="size-4" />
                    کد جدید
                  </Button>
                )}
              </div>
              {qrUrl && (
                <div className="flex justify-center rounded-lg bg-white p-3">
                  <img src={qrUrl} alt="QR کد دعوت گروه" className="size-40" />
                </div>
              )}
              {inviteLink && (
                <p className="break-all rounded-md bg-secondary/50 p-2 text-xs text-muted-foreground" dir="ltr">
                  {inviteLink}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">این گروه هنوز کد دعوت ندارد.</p>
          )}
          {inviteLink && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(inviteLink);
                  toast.success('لینک دعوت کپی شد.');
                } catch {
                  toast.error('کپی ناموفق بود.');
                }
              }}
            >
              <Copy className="size-4" />
              کپی لینک دعوت
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Members list */}
      <div className="space-y-4 lg:col-span-2">
        {isAdmin && (
          <Card>
            <CardContent className="p-4">
              <form
                id="add-member-form"
                onSubmit={handleSubmit((v) => addMutation.mutate(v))}
                className="flex items-end gap-2"
              >
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="member-phone">افزودن عضو با شماره موبایل</Label>
                  <Input
                    id="member-phone"
                    inputMode="numeric"
                    dir="ltr"
                    className="text-left"
                    placeholder="09xxxxxxxxx"
                    {...register('phone_number')}
                  />
                  {errors.phone_number && (
                    <p className="text-xs text-destructive">{errors.phone_number.message}</p>
                  )}
                </div>
                <Button type="submit" form="add-member-form" disabled={addMutation.isPending}>
                  {addMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  افزودن
                </Button>
              </form>
              <p className="mt-2 text-xs text-muted-foreground">
                فقط کاربرانی که قبلاً در هم‌پول ثبت‌نام کرده‌اند قابل افزودن هستند.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
            <CardContent className="p-2">
              <ul className="divide-y divide-border">
                {group.memberships.map((m) => {
                  const isOwner = m.user === group.owner;
                  const isMe = m.user === myId;
                  const canChangeRole = isAdmin && !isOwner && !isMe;
                  const canRemove = isAdmin && !isOwner && !isMe;
                  return (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold">
                          {(m.user_name || m.user_phone).slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {m.user_name || m.user_phone}
                            {isMe && <span className="mr-1 text-xs text-muted-foreground">(من)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground" dir="ltr">
                            {m.user_phone}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {isOwner ? (
                          <Badge variant="ai">
                            <ShieldCheck className="size-3.5" />
                            مالک
                          </Badge>
                        ) : (
                          <Badge variant={m.role === 'admin' ? 'default' : 'secondary'}>
                            {roleLabel[m.role]}
                          </Badge>
                        )}
                        {canChangeRole && (
                          <Select
                            value={m.role}
                            onValueChange={(v) => roleMutation.mutate({ userId: m.user, role: v as 'admin' | 'member' })}
                          >
                            <SelectTrigger className="h-8 w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">مدیر</SelectItem>
                              <SelectItem value="member">عضو</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {canRemove && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setToRemove(m)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                        {isMe && isAdmin && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setToRemove(m)}
                            title="خروج از گروه"
                          >
                            <UserMinus className="size-4" />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
      </div>

      <ConfirmDialog
        open={Boolean(toRemove)}
        onOpenChange={(o) => !o && setToRemove(null)}
        title={toRemove?.user === myId ? 'خروج از گروه' : 'حذف عضو'}
        description={
          toRemove
            ? toRemove.user === myId
              ? 'از این گروه خارج می‌شوید؟'
              : `${toRemove.user_name || toRemove.user_phone} از گروه حذف شود؟`
            : undefined
        }
        confirmLabel={toRemove?.user === myId ? 'خروج' : 'حذف'}
        destructive
        loading={removeMutation.isPending}
        onConfirm={() => toRemove && removeMutation.mutate(toRemove.user)}
      />
    </div>
  );
}
