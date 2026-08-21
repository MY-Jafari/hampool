import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, Loader2, PieChart as PieIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { listExpenses, requestReport } from '@/features/groups/api';
import { toastError } from '@/shared/lib/errors';
import { formatNumber, formatToman, splitTypeLabel } from '@/shared/lib/formats';
import type { Group, Membership } from '@/shared/types/api';

const PALETTE = ['#10B981', '#8B5CF6', '#F59E0B', '#3B82F6', '#EC4899', '#14B8A6', '#F97316'];

interface ReportsTabProps {
  group: Group;
  members: Membership[];
}

export function ReportsTab({ group, members }: ReportsTabProps) {
  const queryClient = useQueryClient();

  const expensesQuery = useQuery({
    queryKey: ['group-expenses', group.id],
    queryFn: () => listExpenses(group.id),
  });

  const reportMutation = useMutation({
    mutationFn: () => requestReport(group.id),
    onSuccess: () => {
      toast.success('تولید گزارش شروع شد؛ به ایمیل شما ارسال می‌شود. 📧');
      void queryClient.invalidateQueries({ queryKey: ['group-activities', group.id] });
    },
    onError: (err) => toastError(err),
  });

  if (expensesQuery.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (expensesQuery.isError) {
    return <ErrorState error={expensesQuery.error} onRetry={() => void expensesQuery.refetch()} />;
  }

  const confirmed = (expensesQuery.data ?? []).filter((e) => e.is_confirmed);

  if (confirmed.length === 0) {
    return (
      <EmptyState
        icon={PieIcon}
        title="داده‌ای برای گزارش نیست"
        description="پس از تایید اولین هزینه، نمودارها و گزارش اینجا نمایش داده می‌شوند."
        action={
          <Button variant="outline" onClick={() => reportMutation.mutate()} disabled={reportMutation.isPending}>
            {reportMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
            درخواست گزارش PDF
          </Button>
        }
      />
    );
  }

  // Daily totals (last 7 days)
  const dailyData = (() => {
    const days: { key: string; label: string; total: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('fa-IR', { weekday: 'short' }), total: 0 });
    }
    for (const e of confirmed) {
      const day = new Date(e.date);
      day.setHours(0, 0, 0, 0);
      const key = day.toISOString().slice(0, 10);
      const bucket = days.find((d) => d.key === key);
      if (bucket) bucket.total += e.total_amount;
    }
    return days;
  })();

  // Split-type distribution
  const typeData = (() => {
    const map = new Map<string, number>();
    for (const e of confirmed) {
      const label = splitTypeLabel[e.split_type] ?? e.split_type;
      map.set(label, (map.get(label) ?? 0) + e.total_amount);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  })();

  // Per-member totals from splits
  const memberData = (() => {
    const map = new Map<number, number>();
    for (const e of confirmed) {
      for (const s of e.splits) {
        map.set(s.user, (map.get(s.user) ?? 0) + (s.amount ?? 0));
      }
    }
    return Array.from(map.entries()).map(([userId, total]) => {
      const m = members.find((x) => x.user === userId);
      return { name: m ? m.user_name || m.user_phone : `کاربر ${userId}`, total };
    });
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          نمودارها از {confirmed.length.toLocaleString('fa-IR')} هزینه‌ی تاییدشده ساخته شده‌اند.
        </p>
        <Button onClick={() => reportMutation.mutate()} disabled={reportMutation.isPending}>
          {reportMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
          درخواست گزارش PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" dir="ltr">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">هزینه‌ی ۷ روز اخیر</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} width={45} />
                  <Tooltip
                    formatter={(value) => [formatToman(Number(value)), 'هزینه']}
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                  />
                  <Bar dataKey="total" fill="#10B981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">ترکیب هزینه‌ها بر اساس نوع تقسیم</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                    {typeData.map((entry, index) => (
                      <Cell key={entry.name} fill={PALETTE[index % PALETTE.length] ?? '#10B981'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatToman(Number(value))} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">سهم اعضا از هزینه‌ها (تومان)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={memberData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatNumber(Number(value))} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  <Bar dataKey="total" fill="#8B5CF6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
