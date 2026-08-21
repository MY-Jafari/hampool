import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Ticket } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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

const schema = z.object({
  invite_code: z
    .string()
    .trim()
    .min(4, 'کد دعوت را وارد کنید')
    .max(16, 'کد دعوت معتبر نیست'),
});

type FormValues = z.infer<typeof schema>;

interface JoinGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCode?: string | null;
}

export function JoinGroupDialog({ open, onOpenChange, initialCode }: JoinGroupDialogProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { invite_code: '' } });

  // Prefill the code when the dialog opens with an invite link (?join=1&code=...).
  useEffect(() => {
    if (open && initialCode) setValue('invite_code', initialCode);
  }, [open, initialCode, setValue]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => joinGroup(values.invite_code),
    onSuccess: () => {
      toast.success('با موفقیت به گروه پیوستید 🎉');
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      reset();
      onOpenChange(false);
    },
    onError: (err) => toastError(err),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>عضویت با کد دعوت</DialogTitle>
          <DialogDescription>
            کد ۸ کاراکتری که مدیر گروه به شما داده است را وارد کنید.
          </DialogDescription>
        </DialogHeader>
        <form
          id="join-group-form"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="code">کد دعوت</Label>
            <Input
              id="code"
              dir="ltr"
              className="text-center text-base font-bold tracking-[0.3em]"
              placeholder="ABCDEF12"
              {...register('invite_code')}
            />
            {errors.invite_code && <p className="text-xs text-destructive">{errors.invite_code.message}</p>}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button type="submit" form="join-group-form" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Ticket className="size-4" />}
            عضویت
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
