'use client';

import Link from 'next/link';
import { DashboardAsset } from '@/types';
import {
  formatZscore,
  getZscoreBg,
  getZscoreColor,
  getSeverityColor,
  getSeverityBorder,
} from '@/lib/anomaly';
import { createClient } from '@/lib/supabase/client';

interface Props {
  item: DashboardAsset;
  onRemove: (assetId: string) => void;
}

function formatPrice(price: number | null | undefined, assetType: string): string {
  if (price === null || price === undefined) return '—';
  if (assetType === 'crypto' && price < 1) {
    return `$${price.toFixed(4)}`;
  }
  if (price >= 1000) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${price.toFixed(2)}`;
}

function formatReturn(r: number | null | undefined): string {
  if (r === null || r === undefined) return '—';
  return `${r >= 0 ? '+' : ''}${r.toFixed(1)}%`;
}

function getReturnColor(r: number | null | undefined): string {
  if (r === null || r === undefined) return 'text-slate-500';
  return r >= 0 ? 'text-green-400' : 'text-red-400';
}

function getReturnBg(r: number | null | undefined, zscore: number | null | undefined): string {
  if (zscore === null || zscore === undefined) return 'bg-gray-800/40';
  return getZscoreBg(zscore);
}

export default function AssetCard({ item, onRemove }: Props) {
  const { asset, anomalyScore, aiAnalysis, priceHistory } = item;
  const supabase = createClient();

  // Calculate daily change
  const sorted = [...priceHistory].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const dailyChange =
    latest?.close && prev?.close
      ? ((latest.close - prev.close) / prev.close) * 100
      : null;

  const severity = anomalyScore?.severity ?? 'normal';
  const borderClass = getSeverityBorder(severity);

  async function handleRemove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await supabase
      .from('watchlist')
      .delete()
      .eq('asset_id', asset.id);
    onRemove(asset.id);
  }

  return (
    <Link
      href={`/asset/${encodeURIComponent(asset.id)}`}
      className={`block bg-[#0f1623] border rounded-xl p-4 transition-all hover:bg-[#131d2e] cursor-pointer ${borderClass} ${severity === 'extreme' ? 'extreme-glow' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-white font-bold font-mono text-base">{asset.id}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-slate-400 border border-gray-700/50 capitalize">
              {asset.asset_type}
            </span>
            {severity !== 'normal' && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-semibold uppercase ${getSeverityColor(severity)} border ${
                  severity === 'extreme' ? 'bg-red-900/30 border-red-700/40' :
                  severity === 'high' ? 'bg-orange-900/30 border-orange-700/40' :
                  'bg-yellow-900/30 border-yellow-700/40'
                }`}
              >
                {severity}
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs truncate max-w-[180px]">{asset.name}</p>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-white font-mono text-sm font-semibold">
            {formatPrice(latest?.close, asset.asset_type)}
          </p>
          {dailyChange !== null && (
            <p className={`text-xs font-mono ${dailyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {dailyChange >= 0 ? '▲' : '▼'} {formatReturn(dailyChange)}
            </p>
          )}
        </div>
      </div>

      {/* Returns row */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {[
          { label: '1W', val: anomalyScore?.return_1w, zscore: anomalyScore?.return_zscore_1w },
          { label: '1M', val: anomalyScore?.return_1m, zscore: anomalyScore?.return_zscore_1m },
          { label: '3M', val: anomalyScore?.return_3m, zscore: anomalyScore?.return_zscore_3m },
        ].map(({ label, val, zscore }) => (
          <div
            key={label}
            className={`rounded px-2 py-1 text-center ${getReturnBg(val, zscore)}`}
          >
            <span className="text-slate-500 text-xs block">{label}</span>
            <span className={`text-xs font-mono font-semibold ${getReturnColor(val)}`}>
              {formatReturn(val)}
            </span>
          </div>
        ))}
      </div>

      {/* Anomaly heatmap */}
      {anomalyScore && (
        <div className="mb-3">
          <p className="text-slate-600 text-xs mb-1.5">Anomaly Heatmap</p>
          <div className="grid grid-cols-4 gap-1 text-xs font-mono">
            <div className="text-slate-600 py-0.5"></div>
            <div className="text-slate-500 text-center py-0.5">Daily</div>
            <div className="text-slate-500 text-center py-0.5">Weekly</div>
            <div className="text-slate-500 text-center py-0.5">Monthly</div>

            {[
              { label: 'Price', d: anomalyScore.price_move_zscore_daily, w: anomalyScore.price_move_zscore_weekly, m: anomalyScore.price_move_zscore_monthly },
              { label: 'Vol', d: anomalyScore.volatility_zscore_daily, w: anomalyScore.volatility_zscore_weekly, m: anomalyScore.volatility_zscore_monthly },
              ...(asset.asset_type !== 'fx' && asset.asset_type !== 'metal' ? [
                { label: 'Vol₂', d: anomalyScore.volume_zscore_daily, w: anomalyScore.volume_zscore_weekly, m: anomalyScore.volume_zscore_monthly }
              ] : []),
            ].map(({ label, d, w, m }) => (
              <>
                <div key={`${label}-l`} className="text-slate-500 py-0.5 flex items-center">{label}</div>
                {[d, w, m].map((z, i) => (
                  <div
                    key={`${label}-${i}`}
                    className={`rounded text-center py-0.5 ${getZscoreBg(z)}`}
                  >
                    <span className={getZscoreColor(z)}>{formatZscore(z)}</span>
                  </div>
                ))}
              </>
            ))}
          </div>
        </div>
      )}

      {/* Signal type */}
      {anomalyScore?.signal_type && anomalyScore.combined_score !== null && (
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs font-semibold uppercase tracking-wider ${
            anomalyScore.signal_type === 'both' ? 'text-red-400' :
            anomalyScore.signal_type === 'anomaly' ? 'text-orange-400' :
            'text-blue-400'
          }`}>
            {anomalyScore.signal_type === 'both' ? 'ANOMALY + TREND' :
             anomalyScore.signal_type.toUpperCase()}
          </span>
          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                severity === 'extreme' ? 'bg-red-500' :
                severity === 'high' ? 'bg-orange-500' :
                severity === 'elevated' ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, (anomalyScore.combined_score / 3) * 100)}%` }}
            />
          </div>
          <span className={`text-xs font-semibold uppercase ${getSeverityColor(severity)}`}>
            {severity}
          </span>
        </div>
      )}

      {/* AI preview */}
      {aiAnalysis && (
        <div className="border-t border-gray-700/50 pt-2.5 mt-2.5">
          <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">
            <span className="text-blue-400 mr-1">🤖</span>
            {aiAnalysis.analysis.split('\n')[0]}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-800/50">
        <button
          onClick={handleRemove}
          className="text-slate-600 hover:text-red-400 text-xs transition-colors"
        >
          Remove
        </button>
        <span className="text-slate-600 text-xs">View detail →</span>
      </div>
    </Link>
  );
}
