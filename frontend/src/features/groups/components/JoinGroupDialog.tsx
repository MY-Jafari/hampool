import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Ticket } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { joinGroup } from '@/features/groups/api';
import { Button } from '@/shared/components/ui/button';
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
import { toastError } from '@/shared/lib/errors';
import { normalizeDigits } from '@/shared/lib/format';

interface JoinGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCode?: string | null;
}

export function JoinGroupDialog({ open, onOpenChange, initialCode }: JoinGroupDialogProps) {
  const { t } = useTranslation(['groups', 'common']);
  const queryClient = useQueryClient();

  const schema = z.object({
    invite_code: z
      .string()
      .trim()
      .min(4, t('join.codeRequired', { defaultValue: 'کد دعوت را وارد کنید' }))
      .max(16, t('join.codeInvalid', { defaultValue: 'کد دعوت معتبر نیست' })),
  });

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { invite_code: '' },
  });

  // Prefill when opened with a code query parameter (?join=1&code=XYZ)
  useEffect(() => {
    if (open && initialCode) {
      setValue('invite_code', normalizeDigits(initialCode).toUpperCase().trim());
    }
  }, [open, initialCode, setValue]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      joinGroup(normalizeDigits(values.invite_code).toUpperCase().trim()),
    onSuccess: () => {
      toast.success(t('join.success', { defaultValue: 'با موفقیت به گروه پیوستید 🎉' }));
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      reset();
      onOpenChange(false);
    },
    onError: (err) => toastError(err),
  });

  const handleClose = () => {
    if (mutation.isPending) return;
    reset();
    onOpenChange(false);
  };

  const inviteCodeProps = register('invite_code', {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      e.target.value = normalizeDigits(e.target.value).toUpperCase();
    },
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('join.title')}</DialogTitle>
          <DialogDescription>{t('join.subtitle')}</DialogDescription>
        </DialogHeader>

        <form
          id="join-group-form"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="invite-code">{t('join.code')}</Label>
            <Input
              id="invite-code"
              dir="ltr"
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="text-center font-mono text-base font-bold tracking-[0.25em] uppercase"
              placeholder={t('join.codePlaceholder')}
              {...inviteCodeProps}
            />
            {errors.invite_code && (
              <p className="text-xs text-destructive">{errors.invite_code.message}</p>
            )}
          </div>
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" type="button" onClick={handleClose} disabled={mutation.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            type="submit"
            form="join-group-form"
            disabled={mutation.isPending}
            className="gap-2"
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Ticket className="size-4" />
            )}
            {mutation.isPending ? t('join.submitting') : t('join.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
