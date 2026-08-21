import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { createSettlement, getBalances } from '@/features/groups/api';
import type { Membership } from '@/shared/types/api';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { toastError } from '@/shared/lib/errors';
import { formatToman } from '@/shared/lib/formats';

const schema = z.object({
  to_user_id: z.string().min(1, 'گیرنده را انتخاب کنید'),
  amount: z.string().min(1, 'مبلغ را وارد کنید').regex(/^\d+$/, 'مبلغ باید عدد باشد'),
});

type FormValues = z.infer<typeof schema>;

interface SettlementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
  members: Membership[];
}

export function SettlementFormDialog({ open, onOpenChange, groupId, members }: SettlementFormDialogProps) {
  const queryClient = useQueryClient();

  const balancesQuery = useQuery({
    queryKey: ['group-balances', groupId],
    queryFn: () => getBalances(groupId),
    enabled: open,
  });

  const creditors = (balancesQuery.data ?? []).filter((b) => b.net > 0);
  const creditorOptions = creditors.map((b) => {
    const member = members.find((m) => m.user_phone === b.phone_number);
    return { userId: member?.user, label: b.full_name, net: b.net };
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { to_user_id: '', amount: '' } });

  const selected = creditorOptions.find((c) => c.userId !== undefined && String(c.userId) === watch('to_user_id'));

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createSettlement(groupId, { to_user_id: Number(values.to_user_id), amount: Number(values.amount) }),
    onSuccess: () => {
      toast.success('تسویه ثبت شد؛ پس از پرداخت، گیرنده باید تایید کند.');
      reset();
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ['group-settlements', groupId] });
      void queryClient.invalidateQueries({ queryKey: ['group-balances', groupId] });
    },
    onError: (err) => toastError(err),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="size-5 text-primary" />
            تسویه جدید
          </DialogTitle>
          <DialogDescription>
            فقط به کسی که از شما طلب دارد می‌توانید پرداخت کنید (فقط بدهکار می‌تواند تسویه ثبت کند).
          </DialogDescription>
        </DialogHeader>
        <form id="settlement-form" onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="to_user">گیرنده (طلبکار)</Label>
            {creditorOptions.length === 0 ? (
              <p className="rounded-md bg-secondary/60 p-3 text-xs text-muted-foreground">
                فعلاً کسی از شما طلب ندارد.
              </p>
            ) : (
              <Select value={watch('to_user_id')} onValueChange={(v) => setValue('to_user_id', v, { shouldValidate: true })}>
                <SelectTrigger id="to_user">
                  <SelectValue placeholder="انتخاب گیرنده" />
                </SelectTrigger>
                <SelectContent>
                  {creditorOptions.map((c) => (
                    <SelectItem key={c.userId} value={String(c.userId)}>
                      {c.label} ({formatToman(c.net)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.to_user_id && <p className="text-xs text-destructive">{errors.to_user_id.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amount">مبلغ (تومان)</Label>
            <Input id="amount" inputMode="numeric" placeholder="مبلغ پرداختی" {...register('amount')} />
            {selected && <p className="text-xs text-muted-foreground">حداکثر: {formatToman(selected.net)}</p>}
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button
            type="submit"
            form="settlement-form"
            disabled={mutation.isPending || creditorOptions.length === 0}
          >
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowLeftRight className="size-4" />}
            ثبت تسویه
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
