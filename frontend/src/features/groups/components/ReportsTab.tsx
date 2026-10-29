import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
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
import { formatDate, formatMoney, formatNumber } from '@/shared/lib/format';
import type { Group, Membership } from '@/shared/types/api';

const CHART_PALETTE = [
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Orange
];

interface ReportsTabProps {
  group: Group;
  members: Membership[];
}

export function ReportsTab({ group, members }: ReportsTabProps) {
  const { t, i18n } = useTranslation(['groups', 'common']);
  const isEn = i18n.language?.startsWith('en');
  const queryClient = useQueryClient();

  const expensesQuery = useQuery({
    queryKey: ['group-expenses', group.id],
    queryFn: () => listExpenses(group.id),
  });

  const reportMutation = useMutation({
    mutationFn: () => requestReport(group.id),
    onSuccess: () => {
      toast.success(t('reports.pdfSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['group-activities', group.id] });
    },
    onError: (err: unknown) => {
      if (axios.isAxiosError(err) && (err.response?.status === 403 || err.response?.status === 429)) {
        toast.error(t('reports.pdfRateLimit'));
      } else {
        toastError(err);
      }
    },
  });

  const confirmedExpenses = useMemo(() => {
    return (expensesQuery.data ?? []).filter((e) => e.is_confirmed);
  }, [expensesQuery.data]);

  // ── 7-Day Expense Trend ──────────────────────────────────────────
  const dailyData = useMemo(() => {
    const days: { key: string; label: string; total: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const isoDay = d.toISOString().slice(0, 10);
      days.push({
        key: isoDay,
        label: formatDate(d, isEn ? 'en' : 'fa', { weekday: 'short' }),
        total: 0,
      });
    }

    for (const e of confirmedExpenses) {
      const d = new Date(e.date);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      const bucket = days.find((item) => item.key === key);
      if (bucket) {
        bucket.total += e.total_amount;
      }
    }
    return days;
  }, [confirmedExpenses, isEn]);

  // ── Split Type Breakdown ─────────────────────────────────────────
  const splitTypeData = useMemo(() => {
    const map = new Map<string, number>();
    const getSplitLabel = (type: string) => {
      switch (type) {
        case 'equal':
          return isEn ? 'Equal' : 'تساوی';
        case 'exact':
          return isEn ? 'Exact' : 'دقیق';
        case 'percentage':
          return isEn ? 'Percentage' : 'درصدی';
        case 'itemized':
          return isEn ? 'Itemized' : 'آیتمی';
        default:
          return type;
      }
    };
    for (const e of confirmedExpenses) {
      const label = getSplitLabel(e.split_type);
      map.set(label, (map.get(label) ?? 0) + e.total_amount);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [confirmedExpenses, isEn]);

  // ── Member Shares Breakdown ──────────────────────────────────────
  const memberData = useMemo(() => {
    const map = new Map<number, number>();
    for (const e of confirmedExpenses) {
      for (const s of e.splits) {
        map.set(s.user, (map.get(s.user) ?? 0) + (s.amount ?? 0));
      }
    }
    return Array.from(map.entries()).map(([userId, total]) => {
      const m = members.find((x) => x.user === userId);
      return {
        name: m ? m.user_name || m.user_phone : `${isEn ? 'User' : 'کاربر'} ${userId}`,
        total,
      };
    });
  }, [confirmedExpenses, members, isEn]);

  if (expensesQuery.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
      </div>
    );
  }

  if (expensesQuery.isError) {
    return (
      <ErrorState
        error={expensesQuery.error}
        onRetry={() => void expensesQuery.refetch()}
      />
    );
  }

  if (confirmedExpenses.length === 0) {
    return (
      <EmptyState
        title={t('reports.noData')}
        description={t('reports.noDataDesc')}
        action={
          <Button
            variant="outline"
            onClick={() => reportMutation.mutate()}
            disabled={reportMutation.isPending}
          >
            {reportMutation.isPending ? (
              <Loader2 className="me-1.5 size-4 animate-spin" />
            ) : (
              <FileDown className="me-1.5 size-4" />
            )}
            {t('reports.requestPdf')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header Bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t('reports.title')}</h2>
          <p className="text-xs text-muted-foreground">
            {t('reports.confirmedCount', {
              count: formatNumber(confirmedExpenses.length),
            })}
          </p>
        </div>
        <Button
          onClick={() => reportMutation.mutate()}
          disabled={reportMutation.isPending}
        >
          {reportMutation.isPending ? (
            <Loader2 className="me-1.5 size-4 animate-spin" />
          ) : (
            <FileDown className="me-1.5 size-4" />
          )}
          {t('reports.requestPdf')}
        </Button>
      </div>

      {/* ── Charts Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2" dir="ltr">
        {/* Daily Expenses Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {t('reports.dailyTrend')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    width={48}
                    tickFormatter={(v) => formatNumber(v)}
                  />
                  <Tooltip
                    formatter={(value) => [formatMoney(Number(value)), isEn ? 'Total' : 'مجموع']}
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      color: 'hsl(var(--popover-foreground))',
                    }}
                  />
                  <Bar dataKey="total" fill="#10B981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Split Type Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {t('reports.splitDistribution')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={splitTypeData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {splitTypeData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={CHART_PALETTE[index % CHART_PALETTE.length] ?? '#10B981'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatMoney(Number(value))}
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      color: 'hsl(var(--popover-foreground))',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Member Expense Shares */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              {t('reports.memberShares')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={memberData} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(v) => formatNumber(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value) => formatMoney(Number(value))}
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      color: 'hsl(var(--popover-foreground))',
                    }}
                  />
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
