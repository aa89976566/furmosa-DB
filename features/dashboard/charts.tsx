'use client';

import {
  Area,
  AreaChart,
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
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/format';
import { orderSourceLabel } from '@/lib/labels';

const sourceColors: Record<string, string> = {
  website: '#3b82f6',
  line: '#10b981',
  consignment: '#f59e0b',
  manual: '#94a3b8',
};

export function RevenueTrendChart({
  data,
}: {
  data: { date: string; total: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--info))" stopOpacity={0.4} />
            <stop offset="100%" stopColor="hsl(var(--info))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickFormatter={(v: string) => format(new Date(v), 'M/d')}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickFormatter={(v: number) => `${v / 1000}k`}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number) => [formatCurrency(v), '營收']}
          labelFormatter={(v: string) => format(new Date(v), 'yyyy/MM/dd')}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="hsl(var(--info))"
          strokeWidth={2}
          fill="url(#revGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SourcePieChart({
  data,
}: {
  data: { source: string; total: number; count: number }[];
}) {
  const filtered = data.filter((d) => d.total > 0);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={filtered}
          dataKey="total"
          nameKey="source"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
        >
          {filtered.map((d) => (
            <Cell key={d.source} fill={sourceColors[d.source] ?? '#94a3b8'} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number, n: string) => [formatCurrency(v), orderSourceLabel[n] ?? n]}
        />
        <Legend
          verticalAlign="bottom"
          height={28}
          formatter={(value) => orderSourceLabel[value as string] ?? value}
          wrapperStyle={{ fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TopProductsChart({
  data,
}: {
  data: { name: string; subtotal: number }[];
}) {
  const truncated = data.map((d) => ({
    ...d,
    short: d.name.length > 12 ? d.name.slice(0, 12) + '…' : d.name,
  }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(260, truncated.length * 28)}>
      <BarChart data={truncated} layout="vertical" margin={{ top: 5, right: 16, left: 16, bottom: 5 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickFormatter={(v: number) => `${v / 1000}k`}
        />
        <YAxis
          dataKey="short"
          type="category"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          width={120}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number) => [formatCurrency(v), '銷售額']}
        />
        <Bar dataKey="subtotal" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
