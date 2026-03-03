'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Asset, DailyPrice, AnomalyScore, AIAnalysis, NewsArticle, WatchlistEntry } from '@/types';
import { formatZscore, getZscoreBg, getZscoreColor, getSeverityColor, getSeverityBorder } from '@/lib/anomaly';
import { createClient } from '@/lib/supabase/client';
import PriceChart from './PriceChart';
import AnomalyHistoryChart from './AnomalyHistoryChart';
import NewsSection from './NewsSection';

interface Props {
  asset: Asset;
  isInWatchlist: boolean;
  watchlistEntry: WatchlistEntry | null;
  prices: DailyPrice[];
  anomalyScores: AnomalyScore[];
  latestAnalysis: AIAnalysis | null;
  news: NewsArticle[];
  userId: string;
}

function formatPrice(price: number | null | undefined, assetType: string): string {
  if (!price) return '—';
  if (assetType === 'crypto' && price < 1) return `$${price.toFixed(4)}`;
  if (price >= 1000) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${price.toFixed(2)}`;
}

function formatReturn(r: number | null | undefined): string {
  if (r === null || r === undefined) return '—';
  return `${r >= 0 ? '+' : ''}${r.toFixed(2)}%`;
}

export default function AssetDetailClient({
  asset,
  isInWatchlist: initialIsInWatchlist,
  watchlistEntry,
  prices,
  anomalyScores,
  latestAnalysis,
  news,
  userId,
}: Props) {
  const [inWatchlist, setInWatchlist] = useState(initialIsInWatchlist);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const latest = prices[prices.length - 1];
  const prev = prices[prices.length - 2];
  const dailyChange = latest?.close && prev?.close
    ? ((latest.close - prev.close) / prev.close) * 100
    : null;

  const latestScore = anomalyScores[anomalyScores.length - 1];
  const severity = latestScore?.severity ?? 'normal';

  async function toggleWatchlist() {
    setLoading(true);
    if (inWatchlist) {
      await supabase.from('watchlist').delete().eq('user_id', userId).eq('asset_id', asset.id);
      setInWatchlist(false);
    } else {
      await supabase.from('watchlist').insert({ user_id: userId, asset_id: asset.id });
      setInWatchlist(true);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      {/* Header */}
      <header className="border-b border-gray-800/50 bg-[#0a0e17]/95 sticky top-0 z-30 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Dashboard</span>
          </Link>
          <div className="flex items-center gap-2 ml-2">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">M</span>
            </div>
            <span className="font-semibold text-white text-sm tracking-tight hidden sm:block">Market Pulse</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={toggleWatchlist}
            disabled={loading}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              inWatchlist
                ? 'bg-red-900/30 border border-red-700/40 text-red-400 hover:bg-red-900/50'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            } ${loading ? 'opacity-50' : ''}`}
          >
            {loading ? '...' : inWatchlist ? 'Remove from Watchlist' : '+ Add to Watchlist'}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Asset header */}
        <div className={`bg-[#0f1623] border rounded-xl p-6 mb-6 ${getSeverityBorder(severity)} ${severity === 'extreme' ? 'extreme-glow' : ''}`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-white font-bold font-mono text-2xl">{asset.id}</h1>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-slate-400 border border-gray-700/50 capitalize">
                  {asset.asset_type}
                </span>
                {asset.sector && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-800/60 text-slate-500 border border-gray-700/40">
                    {asset.sector}
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-lg">{asset.name}</p>
            </div>
            <div className="text-right">
              <p className="text-white font-mono text-2xl font-bold">
                {formatPrice(latest?.close, asset.asset_type)}
              </p>
              {dailyChange !== null && (
                <p className={`text-sm font-mono ${dailyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {dailyChange >= 0 ? '▲' : '▼'} {formatReturn(dailyChange)} today
                </p>
              )}
            </div>
          </div>

          {/* Cumulative returns */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: '1 Week', val: latestScore?.return_1w, zscore: latestScore?.return_zscore_1w },
              { label: '1 Month', val: latestScore?.return_1m, zscore: latestScore?.return_zscore_1m },
              { label: '3 Months', val: latestScore?.return_3m, zscore: latestScore?.return_zscore_3m },
            ].map(({ label, val, zscore }) => (
              <div key={label} className={`rounded-lg p-3 ${getZscoreBg(zscore)}`}>
                <p className="text-slate-500 text-xs mb-1">{label} Return</p>
                <p className={`font-mono font-semibold ${val === null || val === undefined ? 'text-slate-600' : val >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatReturn(val)}
                </p>
                {zscore !== null && zscore !== undefined && (
                  <p className={`text-xs font-mono ${getZscoreColor(zscore)}`}>
                    {formatZscore(zscore)} vs historical
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Combined score */}
          {latestScore && (
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-700/50">
              <span className={`text-xs font-semibold uppercase tracking-wider ${getSeverityColor(severity)}`}>
                {severity}
              </span>
              <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    severity === 'extreme' ? 'bg-red-500' :
                    severity === 'high' ? 'bg-orange-500' :
                    severity === 'elevated' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, ((latestScore.combined_score ?? 0) / 3) * 100)}%` }}
                />
              </div>
              <span className="text-slate-500 text-xs font-mono">
                {latestScore.combined_score?.toFixed(2) ?? '0.00'}σ combined score
              </span>
              {latestScore.signal_type && (
                <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                  latestScore.signal_type === 'both' ? 'bg-red-900/30 text-red-400 border border-red-700/30' :
                  latestScore.signal_type === 'anomaly' ? 'bg-orange-900/30 text-orange-400 border border-orange-700/30' :
                  'bg-blue-900/30 text-blue-400 border border-blue-700/30'
                }`}>
                  {latestScore.signal_type === 'both' ? 'ANOMALY + TREND' : latestScore.signal_type.toUpperCase()}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Anomaly Heatmap */}
        {latestScore && (
          <div className="bg-[#0f1623] border border-gray-700/50 rounded-xl p-6 mb-6">
            <h2 className="text-white font-semibold mb-4">Anomaly & Trend Breakdown</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-slate-500 text-left py-2 pr-4 font-normal text-xs">Metric</th>
                    <th className="text-slate-400 text-center py-2 px-3 font-medium text-xs">Daily<br /><span className="text-slate-600 font-normal">vs 30d</span></th>
                    <th className="text-slate-400 text-center py-2 px-3 font-medium text-xs">Weekly<br /><span className="text-slate-600 font-normal">vs 13wk</span></th>
                    <th className="text-slate-400 text-center py-2 px-3 font-medium text-xs">Monthly<br /><span className="text-slate-600 font-normal">vs 12mo</span></th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Price Move', d: latestScore.price_move_zscore_daily, w: latestScore.price_move_zscore_weekly, m: latestScore.price_move_zscore_monthly },
                    { label: 'Volatility', d: latestScore.volatility_zscore_daily, w: latestScore.volatility_zscore_weekly, m: latestScore.volatility_zscore_monthly },
                    ...(asset.asset_type !== 'fx' && asset.asset_type !== 'metal' ? [
                      { label: 'Volume', d: latestScore.volume_zscore_daily, w: latestScore.volume_zscore_weekly, m: latestScore.volume_zscore_monthly }
                    ] : []),
                  ].map(({ label, d, w, m }) => (
                    <tr key={label} className="border-t border-gray-800/50">
                      <td className="text-slate-400 py-2 pr-4 text-xs">{label}</td>
                      {[d, w, m].map((z, i) => (
                        <td key={i} className="py-1.5 px-3">
                          <div className={`rounded text-center py-1 px-2 font-mono text-xs ${getZscoreBg(z)}`}>
                            <span className={getZscoreColor(z)}>{formatZscore(z)}</span>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700/50">
              <p className="text-slate-500 text-xs mb-2">Trend Significance (cumulative return z-scores)</p>
              <div className="flex gap-4">
                {[
                  { label: '1-Week', ret: latestScore.return_1w, z: latestScore.return_zscore_1w },
                  { label: '1-Month', ret: latestScore.return_1m, z: latestScore.return_zscore_1m },
                  { label: '3-Month', ret: latestScore.return_3m, z: latestScore.return_zscore_3m },
                ].map(({ label, ret, z }) => (
                  <div key={label} className={`flex-1 rounded-lg p-3 ${getZscoreBg(z)}`}>
                    <p className="text-slate-500 text-xs">{label}</p>
                    <p className={`font-mono text-sm font-semibold ${ret === null || ret === undefined ? 'text-slate-600' : ret >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatReturn(ret)}
                    </p>
                    <p className={`font-mono text-xs ${getZscoreColor(z)}`}>{formatZscore(z)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="bg-[#0f1623] border border-gray-700/50 rounded-xl p-6 mb-6">
          <h2 className="text-white font-semibold mb-4">Price & Volume History</h2>
          <PriceChart prices={prices} asset={asset} />
        </div>

        {anomalyScores.length > 0 && (
          <div className="bg-[#0f1623] border border-gray-700/50 rounded-xl p-6 mb-6">
            <h2 className="text-white font-semibold mb-1">Anomaly Score History</h2>
            <p className="text-slate-500 text-xs mb-4">Combined score over last 30 days — shows if activity is building, sustained, or a one-day spike</p>
            <AnomalyHistoryChart scores={anomalyScores} />
          </div>
        )}

        {/* AI Analysis */}
        <div className="bg-[#0f1623] border border-gray-700/50 rounded-xl p-6 mb-6">
          <h2 className="text-white font-semibold mb-4">AI Analysis</h2>
          {latestAnalysis ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                {latestAnalysis.signal_type && (
                  <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded border ${
                    latestAnalysis.signal_type === 'both' ? 'bg-red-900/30 text-red-400 border-red-700/30' :
                    latestAnalysis.signal_type === 'anomaly' ? 'bg-orange-900/30 text-orange-400 border-orange-700/30' :
                    'bg-blue-900/30 text-blue-400 border-blue-700/30'
                  }`}>
                    {latestAnalysis.signal_type === 'both' ? 'ANOMALY + TREND' : latestAnalysis.signal_type.toUpperCase()}
                  </span>
                )}
                {latestAnalysis.dominant_timescale && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-slate-400 border border-gray-700/40 capitalize">
                    {latestAnalysis.dominant_timescale} signal dominant
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded border capitalize ${
                  latestAnalysis.outlook === 'bullish_signal' ? 'bg-green-900/30 text-green-400 border-green-700/30' :
                  latestAnalysis.outlook === 'bearish_signal' ? 'bg-red-900/30 text-red-400 border-red-700/30' :
                  'bg-gray-800 text-slate-400 border-gray-700/40'
                }`}>
                  {latestAnalysis.outlook?.replace('_', ' ')}
                </span>
              </div>

              <div className="prose prose-invert prose-sm max-w-none mb-4">
                {latestAnalysis.analysis.split('\n\n').map((para, i) => (
                  <p key={i} className="text-slate-300 leading-relaxed mb-3 text-sm">{para}</p>
                ))}
              </div>

              {latestAnalysis.key_drivers && latestAnalysis.key_drivers.length > 0 && (
                <div className="mb-4">
                  <p className="text-slate-500 text-xs mb-2">Key Drivers</p>
                  <div className="flex flex-wrap gap-2">
                    {latestAnalysis.key_drivers.map((driver) => (
                      <span key={driver} className="text-xs px-2 py-1 rounded-full bg-blue-900/30 text-blue-400 border border-blue-700/30">
                        {driver}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-slate-600 text-xs">
                Analysis generated {new Date(latestAnalysis.created_at).toLocaleDateString()} using{' '}
                {latestAnalysis.news_window_days} days of news context · {latestAnalysis.model_used}
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">
                No significant activity detected — no AI analysis generated for today.
              </p>
              <p className="text-slate-600 text-xs mt-1">
                Analysis is generated when combined score ≥ 1.5σ
              </p>
            </div>
          )}
        </div>

        {/* News */}
        <div className="bg-[#0f1623] border border-gray-700/50 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Recent News</h2>
          <NewsSection news={news} keyDrivers={latestAnalysis?.key_drivers ?? []} />
        </div>
      </main>
    </div>
  );
}
