import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Receipt, Trash2 } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { createExpense } from '@/features/groups/api';
import type { Membership, SplitType } from '@/shared/types/api';
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
import { formatNumber, splitTypeLabel } from '@/shared/lib/formats';
import { cn } from '@/shared/lib/utils';

const memberId = z.string().min(1, 'عضو را انتخاب کنید');
const splitRow = z.object({ user: memberId, amount: z.string().optional(), percentage: z.string().optional() });
const shareRow = z.object({ user: memberId, amount: z.string().min(1, 'مبلغ را وارد کنید') });
const itemRow = z.object({
  name: z.string().min(1, 'نام آیتم را وارد کنید'),
  total_amount: z.string().min(1, 'مبلغ آیتم را وارد کنید'),
  shares: z.array(shareRow).min(1, 'حداقل یک سهم اضافه کنید'),
});

const schema = z
  .object({
    description: z.string().min(1, 'توضیح هزینه را وارد کنید'),
    total_amount: z.string(),
    split_type: z.enum(['equal', 'exact', 'percentage', 'itemized']),
    splits: z.array(splitRow),
    items: z.array(itemRow),
  })
  .superRefine((val, ctx) => {
    if (val.split_type === 'equal') {
      if (!val.total_amount.trim()) {
        ctx.addIssue({ code: 'custom', path: ['total_amount'], message: 'مبلغ کل را وارد کنید' });
      }
      if (val.splits.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['splits'], message: 'حداقل یک عضو را انتخاب کنید' });
      }
    }
    if (val.split_type === 'exact') {
      if (val.splits.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['splits'], message: 'حداقل یک سهم اضافه کنید' });
      }
      val.splits.forEach((s, i) => {
        if (!s.amount || !s.amount.trim()) {
          ctx.addIssue({ code: 'custom', path: ['splits', i, 'amount'], message: 'مبلغ را وارد کنید' });
        }
      });
    }
    if (val.split_type === 'percentage') {
      if (val.splits.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['splits'], message: 'حداقل یک سهم اضافه کنید' });
      }
      const sum = val.splits.reduce((acc, s) => acc + (Number(s.percentage) || 0), 0);
      if (Math.abs(sum - 100) > 0.001) {
        ctx.addIssue({ code: 'custom', path: ['splits'], message: `درصدها باید مجموعاً ۱۰۰ باشند (الان ${formatNumber(sum)}).` });
      }
    }
    if (val.split_type === 'itemized' && val.items.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'حداقل یک آیتم اضافه کنید' });
    }
  });

type FormValues = z.infer<typeof schema>;

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
  members: Membership[];
}

function MemberSelect({
  value,
  onChange,
  members,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  members: Membership[];
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="انتخاب عضو" />
      </SelectTrigger>
      <SelectContent>
        {members.map((m) => (
          <SelectItem key={m.user} value={String(m.user)}>
            {m.user_name || m.user_phone}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ExpenseFormDialog({ open, onOpenChange, groupId, members }: ExpenseFormDialogProps) {
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { description: '', total_amount: '', split_type: 'equal', splits: [], items: [] },
  });

  const splitType = watch('split_type');
  const splits = watch('splits');
  const items = watch('items');

  const splitsField = useFieldArray({ control, name: 'splits' });
  const itemsField = useFieldArray({ control, name: 'items' });

  const close = () => {
    reset({ description: '', total_amount: '', split_type: 'equal', splits: [], items: [] });
    onOpenChange(false);
  };

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const splitsPayload = values.splits
        .filter((s) => s.user)
        .map((s) => ({ user: Number(s.user), amount: s.amount ? Number(s.amount) : undefined, percentage: s.percentage ? Number(s.percentage) : undefined }));

      let payload;
      if (values.split_type === 'equal') {
        payload = { description: values.description, total_amount: Number(values.total_amount), split_type: 'equal' as SplitType, splits: splitsPayload.map(({ user }) => ({ user })) };
      } else if (values.split_type === 'exact') {
        const exactSplits = splitsPayload.map((s) => ({ user: s.user, amount: s.amount as number }));
        payload = {
          description: values.description,
          total_amount: exactSplits.reduce((a, s) => a + s.amount, 0),
          split_type: 'exact' as SplitType,
          splits: exactSplits,
        };
      } else if (values.split_type === 'percentage') {
        payload = {
          description: values.description,
          total_amount: Number(values.total_amount),
          split_type: 'percentage' as SplitType,
          splits: splitsPayload.map((s) => ({ user: s.user, percentage: s.percentage as number })),
        };
      } else {
        payload = {
          description: values.description,
          total_amount: 0,
          split_type: 'itemized' as SplitType,
          items: values.items.map((item) => ({
            name: item.name,
            total_amount: Number(item.total_amount),
            shares: item.shares
              .filter((s) => s.user)
              .map((s) => ({ user: Number(s.user), amount: Number(s.amount) })),
          })),
        };
      }
      return createExpense(groupId, payload);
    },
    onSuccess: () => {
      toast.success('هزینه ثبت شد.');
      void queryClient.invalidateQueries({ queryKey: ['group-expenses', groupId] });
      void queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      close();
    },
    onError: (err) => toastError(err),
  });

  function splitsErrors(): string[] {
    if (!errors.splits) return [];
    const anySplits = errors.splits as unknown as {
      message?: string;
      [k: string]: { amount?: { message?: string }; percentage?: { message?: string } } | string | undefined;
    };
    const out: string[] = [];
    if (anySplits.message) out.push(anySplits.message);
    for (const key of Object.keys(anySplits)) {
      if (key === 'message') continue;
      const row = anySplits[key];
      if (row && typeof row === 'object') {
        const msg = row.amount?.message ?? row.percentage?.message;
        if (msg) out.push(msg);
      }
    }
    return out;
  }

  const toggleEqualMember = (userId: number) => {
    const current = splits.some((s) => Number(s.user) === userId);
    if (current) {
      setValue(
        'splits',
        splits.filter((s) => Number(s.user) !== userId),
        { shouldValidate: true },
      );
    } else {
      setValue('splits', [...splits, { user: String(userId) }], { shouldValidate: true });
    }
  };

  const exactTotal = splits.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  const pctTotal = splits.reduce((acc, s) => acc + (Number(s.percentage) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : close())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-5 text-primary" />
            ثبت هزینه جدید
          </DialogTitle>
          <DialogDescription>نحوه‌ی تقسیم هزینه بین اعضا را مشخص کنید.</DialogDescription>
        </DialogHeader>

        <form id="expense-form" onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="exp-desc">توضیح هزینه *</Label>
            <Input id="exp-desc" placeholder="مثلاً شام آخر هفته" {...register('description')} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>نوع تقسیم</Label>
              <Select value={splitType} onValueChange={(v) => setValue('split_type', v as SplitType, { shouldValidate: true })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(splitTypeLabel) as SplitType[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {splitTypeLabel[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(splitType === 'equal' || splitType === 'percentage') && (
              <div className="space-y-1.5">
                <Label htmlFor="exp-total">مبلغ کل (تومان) *</Label>
                <Input id="exp-total" inputMode="numeric" placeholder="مثلاً 250000" {...register('total_amount')} />
                {errors.total_amount && (
                  <p className="text-xs text-destructive">{errors.total_amount.message}</p>
                )}
              </div>
            )}
            {splitType === 'exact' && (
              <div className="space-y-1.5 rounded-lg bg-secondary/60 p-3">
                <p className="text-xs text-muted-foreground">مجموع سهم‌ها</p>
                <p className="text-lg font-bold text-primary">{formatNumber(exactTotal)} ت</p>
              </div>
            )}
            {splitType === 'itemized' && (
              <div className="space-y-1.5 rounded-lg bg-secondary/60 p-3">
                <p className="text-xs text-muted-foreground">مجموع آیتم‌ها</p>
                <p className="text-lg font-bold text-primary">
                  {formatNumber(items.reduce((a, i) => a + (Number(i.total_amount) || 0), 0))} ت
                </p>
              </div>
            )}
          </div>

          {splitType === 'equal' && (
            <div className="space-y-2">
              <Label>اعضای تقسیم (مساوی) *</Label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const selected = splits.some((s) => Number(s.user) === m.user);
                  return (
                    <button
                      key={m.user}
                      type="button"
                      onClick={() => toggleEqualMember(m.user)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-sm transition-colors',
                        selected
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {m.user_name || m.user_phone}
                    </button>
                  );
                })}
              </div>
              {errors.splits?.message && <p className="text-xs text-destructive">{errors.splits.message}</p>}
            </div>
          )}

          {(splitType === 'exact' || splitType === 'percentage') && (
            <div className="space-y-2">
              <Label>سهم‌ها *</Label>
              <div className="space-y-2">
                {splitsField.fields.map((field, index) => (
                  <div key={field.id} className="flex items-end gap-2">
                    <div className="flex-1">
                      <MemberSelect
                        value={splits[index]?.user ?? ''}
                        onChange={(v) => setValue(`splits.${index}.user`, v, { shouldValidate: true })}
                        members={members}
                      />
                    </div>
                    <div className="w-28">
                      {splitType === 'exact' ? (
                        <Input
                          inputMode="numeric"
                          placeholder="مبلغ"
                          {...register(`splits.${index}.amount`)}
                        />
                      ) : (
                        <Input
                          inputMode="numeric"
                          placeholder="درصد"
                          {...register(`splits.${index}.percentage`)}
                        />
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => splitsField.remove(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => splitsField.append({ user: '', amount: '', percentage: '' })}>
                <Plus className="size-4" />
                افزودن سهم
              </Button>
              {splitType === 'percentage' && pctTotal !== 0 && (
                <p className={cn('text-xs', Math.abs(pctTotal - 100) <= 0.001 ? 'text-success' : 'text-warning')}>
                  مجموع درصدها: {formatNumber(pctTotal)}٪
                </p>
              )}
              {splitsErrors().map((msg) => (
                <p key={msg} className="text-xs text-destructive">
                  {msg}
                </p>
              ))}
            </div>
          )}

          {splitType === 'itemized' && (
            <div className="space-y-3">
              <Label>آیتم‌ها *</Label>
              {itemsField.fields.map((field, index) => (
                <div key={field.id} className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="flex items-center gap-2">
                    <Input className="flex-1" placeholder="نام آیتم" {...register(`items.${index}.name`)} />
                    <Input
                      className="w-28"
                      inputMode="numeric"
                      placeholder="مبلغ کل"
                      {...register(`items.${index}.total_amount`)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => itemsField.remove(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    {items[index]?.shares.map((_share, shareIndex) => (
                      <div key={shareIndex} className="flex items-end gap-2">
                        <div className="flex-1">
                          <MemberSelect
                            value={items[index]?.shares[shareIndex]?.user ?? ''}
                            onChange={(v) => setValue(`items.${index}.shares.${shareIndex}.user`, v, { shouldValidate: true })}
                            members={members}
                          />
                        </div>
                        <div className="w-28">
                          <Input
                            inputMode="numeric"
                            placeholder="سهم"
                            {...register(`items.${index}.shares.${shareIndex}.amount`)}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setValue(
                              `items.${index}.shares`,
                              items[index]?.shares.filter((_, i) => i !== shareIndex) ?? [],
                              { shouldValidate: true },
                            )
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setValue(`items.${index}.shares`, [...(items[index]?.shares ?? []), { user: '', amount: '' }], {
                          shouldValidate: true,
                        })
                      }
                    >
                      <Plus className="size-3.5" />
                      افزودن سهم
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => itemsField.append({ name: '', total_amount: '', shares: [{ user: '', amount: '' }] })}>
                <Plus className="size-4" />
                افزودن آیتم
              </Button>
              {errors.items?.message && <p className="text-xs text-destructive">{errors.items.message}</p>}
            </div>
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            انصراف
          </Button>
          <Button type="submit" form="expense-form" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Receipt className="size-4" />}
            ثبت هزینه
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
