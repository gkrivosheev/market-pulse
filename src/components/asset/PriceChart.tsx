'use client';

import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { DailyPrice, Asset } from '@/types';

interface Props {
  prices: DailyPrice[];
  asset: Asset;
}

type Period = '1M' | '3M' | '6M' | '1Y';

const PERIODS: { label: Period; days: number }[] = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-[#0f1623] border border-gray-700/50 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-slate-400 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span style={{ color: p.color }}>{p.name}:</span>
          <span className="font-mono text-white">
            {p.dataKey === 'volume'
              ? p.value?.toLocaleString()
              : `$${p.value?.toFixed(2)}`}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function PriceChart({ prices, asset }: Props) {
  const [period, setPeriod] = useState<Period>('3M');
  const hasVolume = !['fx', 'metal', 'bond'].includes(asset.asset_type);

  const data = useMemo(() => {
    const days = PERIODS.find((p) => p.label === period)?.days ?? 90;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return prices
      .filter((p) => p.date >= cutoff)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => ({
        date: formatDate(p.date),
        close: p.close,
        volume: p.volume,
      }));
  }, [prices, period]);

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        No price data available
      </div>
    );
  }

  const minPrice = Math.min(...data.map((d) => d.close ?? Infinity));
  const maxPrice = Math.max(...data.map((d) => d.close ?? -Infinity));
  const padding = (maxPrice - minPrice) * 0.05;

  return (
    <div>
      {/* Period selector */}
      <div className="flex gap-1 mb-4">
        {PERIODS.map(({ label }) => (
          <button
            key={label}
            onClick={() => setPeriod(label)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              period === label
                ? 'bg-blue-700/40 text-blue-300 border border-blue-600/50'
                : 'bg-gray-800/60 text-slate-400 border border-gray-700/50 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="price"
            domain={[minPrice - padding, maxPrice + padding]}
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
            width={55}
          />
          {hasVolume && (
            <YAxis
              yAxisId="volume"
              orientation="right"
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => {
                if (v >= 1e9) return `${(v / 1e9).toFixed(0)}B`;
                if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
                return `${(v / 1e3).toFixed(0)}K`;
              }}
              width={45}
            />
          )}
          <Tooltip content={<CustomTooltip />} />
          {hasVolume && (
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill="#1e3a5f"
              opacity={0.6}
              name="Volume"
              maxBarSize={8}
            />
          )}
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="close"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="Price"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
