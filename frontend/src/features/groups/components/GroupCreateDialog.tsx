import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, PlusCircle } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { createGroup } from '@/features/groups/api';
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
import { MoneyInput } from '@/shared/components/ui/money-input';
import { Textarea } from '@/shared/components/ui/textarea';
import { toastError } from '@/shared/lib/errors';

interface GroupCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GroupCreateDialog({ open, onOpenChange }: GroupCreateDialogProps) {
  const { t } = useTranslation(['groups', 'common']);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const schema = z.object({
    name: z
      .string()
      .trim()
      .min(1, t('create.nameRequired', { defaultValue: 'نام گروه را وارد کنید' }))
      .max(200, t('create.nameTooLong', { defaultValue: 'نام گروه بیش از حد مجاز طولانی است' })),
    description: z
      .string()
      .max(500, t('create.descTooLong', { defaultValue: 'توضیح گروه بیش از حد مجاز طولانی است' }))
      .optional(),
    budget_limit: z.number().min(0).optional(),
  });

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', budget_limit: 0 },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createGroup({
        name: values.name,
        description: values.description?.trim() ?? '',
        budget_limit: values.budget_limit ?? 0,
      }),
    onSuccess: (group) => {
      toast.success(t('create.success', { name: group.name, defaultValue: `گروه «${group.name}» ساخته شد.` }));
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      reset();
      onOpenChange(false);
      navigate(`/groups/${group.id}`);
    },
    onError: (err) => toastError(err),
  });

  const handleClose = () => {
    if (mutation.isPending) return;
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('create.title')}</DialogTitle>
          <DialogDescription>{t('create.subtitle')}</DialogDescription>
        </DialogHeader>

        <form
          id="create-group-form"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="group-name">{t('create.name')}</Label>
            <Input
              id="group-name"
              placeholder={t('create.namePlaceholder')}
              autoFocus
              {...register('name')}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="group-description">{t('create.description')}</Label>
            <Textarea
              id="group-description"
              placeholder={t('create.descriptionPlaceholder')}
              rows={3}
              {...register('description')}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="group-budget">{t('create.budget')}</Label>
            <Controller
              control={control}
              name="budget_limit"
              render={({ field }) => (
                <MoneyInput
                  id="group-budget"
                  value={field.value ?? 0}
                  onChange={field.onChange}
                  placeholder={t('create.budgetPlaceholder')}
                />
              )}
            />
            {errors.budget_limit && (
              <p className="text-xs text-destructive">{errors.budget_limit.message}</p>
            )}
          </div>
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" type="button" onClick={handleClose} disabled={mutation.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            type="submit"
            form="create-group-form"
            disabled={mutation.isPending}
            className="gap-2"
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlusCircle className="size-4" />
            )}
            {mutation.isPending ? t('create.submitting') : t('create.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
