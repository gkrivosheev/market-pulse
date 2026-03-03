interface Props {
  counts: {
    total: number;
    extreme: number;
    high: number;
    elevated: number;
    normal: number;
  };
}

export default function SummaryStrip({ counts }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6 bg-[#0f1623] border border-gray-700/50 rounded-lg px-4 py-3">
      <span className="text-slate-400 text-sm">
        <span className="text-white font-semibold font-mono">{counts.total}</span> assets tracked
      </span>
      <span className="text-gray-700">·</span>
      {counts.extreme > 0 && (
        <span className="text-red-400 text-sm font-mono font-semibold">
          {counts.extreme} extreme
        </span>
      )}
      {counts.high > 0 && (
        <span className="text-orange-400 text-sm font-mono">
          {counts.high} high
        </span>
      )}
      {counts.elevated > 0 && (
        <span className="text-yellow-400 text-sm font-mono">
          {counts.elevated} elevated
        </span>
      )}
      <span className="text-green-400 text-sm font-mono">
        {counts.normal} normal
      </span>
    </div>
  );
}
