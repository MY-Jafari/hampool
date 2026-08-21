import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, PlusCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
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
import { Textarea } from '@/shared/components/ui/textarea';
import { toastError } from '@/shared/lib/errors';

const schema = z.object({
  name: z.string().min(1, 'نام گروه را وارد کنید').max(200, 'نام خیلی طولانی است'),
  description: z.string().max(500, 'توضیح خیلی طولانی است').optional(),
  budget_limit: z
    .union([z.literal(''), z.string().regex(/^\d+$/, 'بودجه باید عدد باشد')])
    .optional(),
});

type FormValues = z.infer<typeof schema>;

interface GroupCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GroupCreateDialog({ open, onOpenChange }: GroupCreateDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', description: '', budget_limit: '' } });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createGroup({
        name: values.name,
        description: values.description ?? '',
        budget_limit: values.budget_limit ? Number(values.budget_limit) : 0,
      }),
    onSuccess: (group) => {
      toast.success(`گروه «${group.name}» ساخته شد.`);
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      reset();
      onOpenChange(false);
      navigate(`/groups/${group.id}`);
    },
    onError: (err) => toastError(err),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>ساخت گروه جدید</DialogTitle>
          <DialogDescription>
            برای مدیریت هزینه‌های مشترک، یک گروه بسازید و اعضا را دعوت کنید.
          </DialogDescription>
        </DialogHeader>
        <form
          id="create-group-form"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">نام گروه *</Label>
            <Input id="name" placeholder="مثلاً خونه‌ی دانشجویی" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">توضیحات</Label>
            <Textarea id="description" placeholder="اختیاری" {...register('description')} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget">بودجه‌ی ماهانه (تومان)</Label>
            <Input
              id="budget"
              inputMode="numeric"
              placeholder="۰ = بدون محدودیت"
              {...register('budget_limit')}
            />
            {errors.budget_limit && <p className="text-xs text-destructive">{errors.budget_limit.message}</p>}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button type="submit" form="create-group-form" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <PlusCircle className="size-4" />}
            ساخت گروه
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
