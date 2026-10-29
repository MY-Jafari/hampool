import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Copy,
  Download,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserMinus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { addMember, changeRole, generateInvite, getGroupQrUrl, removeMember } from '@/features/groups/api';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { UserAvatar } from '@/shared/components/ui/avatar';
import { toastError } from '@/shared/lib/errors';
import { formatDate, normalizeToNumericString } from '@/shared/lib/format';
import type { Group, Membership } from '@/shared/types/api';

interface MembersTabProps {
  group: Group;
  myId: number;
  myRole: 'admin' | 'member' | undefined;
}

export function MembersTab({ group, myId, myRole }: MembersTabProps) {
  const { t } = useTranslation(['groups', 'common']);
  const queryClient = useQueryClient();
  const isAdmin = myRole === 'admin';
  const isOwner = group.owner === myId;

  const [toRemove, setToRemove] = useState<Membership | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const memberPhoneSchema = useMemo(
    () =>
      z.object({
        phone_number: z
          .string()
          .min(1, t('members.phoneRequired'))
          .refine((val) => /^09\d{9}$/.test(normalizeToNumericString(val)), {
            message: t('members.phoneInvalid'),
          }),
      }),
    [t],
  );

  type FormValues = z.infer<typeof memberPhoneSchema>;

  // Clean up object URL on unmount or when qrUrl changes
  useEffect(() => {
    return () => {
      if (qrUrl) {
        URL.revokeObjectURL(qrUrl);
      }
    };
  }, [qrUrl]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(memberPhoneSchema),
    defaultValues: { phone_number: '' },
  });

  const addMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const normalized = normalizeToNumericString(values.phone_number);
      return addMember(group.id, normalized);
    },
    onSuccess: (membership) => {
      toast.success(
        t('members.addSuccess', {
          name: membership.user_name || membership.user_phone,
        }),
      );
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
      toast.success(t('members.roleUpdated'));
      void queryClient.invalidateQueries({ queryKey: ['group', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err) => toastError(err),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: number) => removeMember(group.id, userId),
    onSuccess: () => {
      toast.success(t('members.memberRemoved'));
      setToRemove(null);
      void queryClient.invalidateQueries({ queryKey: ['group', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err) => toastError(err),
  });

  const inviteMutation = useMutation({
    mutationFn: () => generateInvite(group.id),
    onSuccess: () => {
      toast.success(t('members.newCodeSuccess'));
      if (qrUrl) {
        URL.revokeObjectURL(qrUrl);
        setQrUrl(null);
      }
      void queryClient.invalidateQueries({ queryKey: ['group', group.id] });
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err) => toastError(err),
  });

  const handleOpenQr = async () => {
    setQrOpen(true);
    if (!qrUrl) {
      setQrLoading(true);
      try {
        const url = await getGroupQrUrl(group.id);
        setQrUrl(url);
      } catch (err) {
        toastError(err);
      } finally {
        setQrLoading(false);
      }
    }
  };

  const handleCopyCode = async () => {
    if (!group.invite_code) return;
    try {
      await navigator.clipboard.writeText(group.invite_code);
      toast.success(t('members.codeCopied'));
    } catch {
      toast.error(t('common:status.error'));
    }
  };

  const inviteLink = group.invite_code
    ? `${window.location.origin}/groups?join=1&code=${group.invite_code}`
    : null;

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success(t('members.linkCopied'));
    } catch {
      toast.error(t('common:status.error'));
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* ── Invite Card ──────────────────────────────────────────────── */}
      <Card className="h-fit lg:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">{t('members.inviteCardTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {group.invite_code ? (
            <>
              <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-center">
                <p className="text-xs font-medium text-muted-foreground">{t('members.inviteCode')}</p>
                <p className="mt-1.5 text-2xl font-bold tracking-[0.25em] text-primary" dir="ltr">
                  {group.invite_code}
                </p>
                {group.invite_code_expires_at && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t('members.inviteExpires', {
                      date: formatDate(group.invite_code_expires_at),
                    })}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void handleCopyCode()}>
                  <Copy className="me-1.5 size-4" />
                  {t('members.copyCode')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleOpenQr()}
                  disabled={qrLoading}
                >
                  <QrCode className="me-1.5 size-4" />
                  {t('members.showQr')}
                </Button>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => inviteMutation.mutate()}
                    disabled={inviteMutation.isPending}
                  >
                    {inviteMutation.isPending ? (
                      <Loader2 className="me-1.5 size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="me-1.5 size-4" />
                    )}
                    {t('members.newCode')}
                  </Button>
                )}
              </div>

              {inviteLink && (
                <div className="space-y-2">
                  <div
                    className="overflow-x-auto rounded-lg bg-secondary/50 p-2.5 text-xs text-muted-foreground select-all"
                    dir="ltr"
                  >
                    {inviteLink}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-xs"
                    onClick={() => void handleCopyLink()}
                  >
                    <Copy className="me-1.5 size-3.5" />
                    {t('members.copyLink')}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3 py-2 text-center">
              <p className="text-sm text-muted-foreground">{t('members.noInviteCode')}</p>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => inviteMutation.mutate()}
                  disabled={inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? (
                    <Loader2 className="me-1.5 size-4 animate-spin" />
                  ) : (
                    <Plus className="me-1.5 size-4" />
                  )}
                  {t('members.generateCode')}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Members List Column ──────────────────────────────────────── */}
      <div className="space-y-4 lg:col-span-2">
        {/* Add member (Admin only) */}
        {isAdmin && (
          <Card>
            <CardContent className="p-4">
              <form
                id="add-member-form"
                onSubmit={handleSubmit((v) => addMutation.mutate(v))}
                className="space-y-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="member-phone" className="text-sm font-medium">
                      {t('members.addMember')}
                    </Label>
                    <Input
                      id="member-phone"
                      inputMode="numeric"
                      dir="ltr"
                      className="text-start"
                      placeholder={t('members.phonePlaceholder')}
                      {...register('phone_number')}
                    />
                  </div>
                  <Button
                    type="submit"
                    form="add-member-form"
                    disabled={addMutation.isPending}
                    className="shrink-0"
                  >
                    {addMutation.isPending ? (
                      <Loader2 className="me-1.5 size-4 animate-spin" />
                    ) : (
                      <Plus className="me-1.5 size-4" />
                    )}
                    {t('members.add')}
                  </Button>
                </div>
                {errors.phone_number?.message && (
                  <p className="text-xs text-destructive">
                    {errors.phone_number.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{t('members.registeredNotice')}</p>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Members List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Users className="size-4 text-primary" />
              <span>{t('members.title')}</span>
              <span className="text-xs font-normal text-muted-foreground">
                ({group.memberships.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {group.memberships.map((m) => {
                const memberIsOwner = m.user === group.owner;
                const isMe = m.user === myId;
                const canChangeRole = isAdmin && !memberIsOwner && !isMe;
                const canRemove = isAdmin && !memberIsOwner && !isMe;
                const canLeave = isMe && !memberIsOwner;

                return (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30"
                  >
                    {/* User Info */}
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar
                        name={m.user_name}
                        phone={m.user_phone}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-medium">
                            {m.user_name || m.user_phone}
                          </p>
                          {isMe && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
                              {t('members.me')}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground" dir="ltr">
                          {m.user_phone}
                        </p>
                        {m.joined_at && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {t('members.joinedAt', { date: formatDate(m.joined_at) })}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Role & Actions */}
                    <div className="flex shrink-0 items-center gap-2">
                      {memberIsOwner ? (
                        <Badge variant="ai" className="gap-1">
                          <ShieldCheck className="size-3" />
                          <span>{t('members.roleOwner')}</span>
                        </Badge>
                      ) : (
                        <Badge variant={m.role === 'admin' ? 'default' : 'secondary'}>
                          {m.role === 'admin' ? t('members.roleAdmin') : t('members.roleMember')}
                        </Badge>
                      )}

                      {canChangeRole && (
                        <Select
                          value={m.role}
                          onValueChange={(val) =>
                            roleMutation.mutate({
                              userId: m.user,
                              role: val as 'admin' | 'member',
                            })
                          }
                          disabled={roleMutation.isPending}
                        >
                          <SelectTrigger className="h-8 w-24 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">{t('members.roleAdmin')}</SelectItem>
                            <SelectItem value="member">{t('members.roleMember')}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      {canRemove && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setToRemove(m)}
                          title={t('members.removeMember')}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}

                      {canLeave && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setToRemove(m)}
                          title={t('members.leaveGroup')}
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

      {/* ── QR Code Dialog ────────────────────────────────────────────── */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="size-5 text-primary" />
              {t('members.qrModalTitle')}
            </DialogTitle>
            <DialogDescription>{t('members.qrModalDesc')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center py-4">
            {qrLoading ? (
              <div className="flex h-52 w-52 items-center justify-center">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
            ) : qrUrl ? (
              <div className="rounded-2xl border-2 border-border bg-white p-4 shadow-sm">
                <img
                  src={qrUrl}
                  alt={t('members.qrModalTitle')}
                  className="size-48 object-contain"
                />
              </div>
            ) : (
              <p className="text-sm text-destructive">{t('common:status.error')}</p>
            )}

            {group.invite_code && (
              <p className="mt-3 font-mono text-lg font-bold tracking-widest text-primary" dir="ltr">
                {group.invite_code}
              </p>
            )}
          </div>

          <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
            {qrUrl && (
              <Button asChild variant="outline" size="sm">
                <a href={qrUrl} download={`hampool-group-${group.id}-qr.png`}>
                  <Download className="me-1.5 size-4" />
                  {t('members.downloadQr')}
                </a>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setQrOpen(false)}>
              {t('common:actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Remove / Leave Confirmation Dialog ────────────────────────── */}
      <ConfirmDialog
        open={Boolean(toRemove)}
        onOpenChange={(open) => !open && setToRemove(null)}
        title={
          toRemove?.user === myId
            ? t('members.leaveConfirmTitle')
            : t('members.removeConfirmTitle')
        }
        description={
          toRemove?.user === myId
            ? isOwner
              ? t('members.cannotLeaveOwner')
              : t('members.leaveConfirmDesc')
            : t('members.removeConfirmDesc', {
                name: toRemove?.user_name || toRemove?.user_phone,
              })
        }
        confirmLabel={toRemove?.user === myId ? t('members.leaveGroup') : t('common:actions.delete')}
        destructive
        loading={removeMutation.isPending}
        onConfirm={() => toRemove && removeMutation.mutate(toRemove.user)}
      />
    </div>
  );
}
