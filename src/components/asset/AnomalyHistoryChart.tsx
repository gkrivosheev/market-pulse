'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { AnomalyScore } from '@/types';

interface Props {
  scores: AnomalyScore[];
}

function getScoreColor(score: number): string {
  if (score >= 2.5) return '#ef4444';
  if (score >= 1.5) return '#f97316';
  if (score >= 1.0) return '#eab308';
  return '#22c55e';
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  const score = payload[0]?.value ?? 0;

  return (
    <div className="bg-[#0f1623] border border-gray-700/50 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p style={{ color: getScoreColor(score) }} className="font-mono font-semibold">
        {score.toFixed(2)}σ combined score
      </p>
    </div>
  );
};

export default function AnomalyHistoryChart({ scores }: Props) {
  const data = useMemo(() => {
    const last30 = [...scores]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    return last30.map((s) => ({
      date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: s.combined_score ?? 0,
      severity: s.severity,
    }));
  }, [scores]);

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d42" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: '#64748b', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={30}
        />
        <ReferenceLine y={2.5} stroke="#ef444466" strokeDasharray="4 4" label={{ value: 'extreme', fill: '#ef4444', fontSize: 10 }} />
        <ReferenceLine y={1.5} stroke="#f9731666" strokeDasharray="4 4" label={{ value: 'high', fill: '#f97316', fontSize: 10 }} />
        <ReferenceLine y={1.0} stroke="#eab30866" strokeDasharray="4 4" label={{ value: 'elevated', fill: '#eab308', fontSize: 10 }} />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={(props: any) => {
            const color = getScoreColor(props.payload.score);
            return <circle cx={props.cx} cy={props.cy} r={3} fill={color} stroke={color} />;
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
