'use client';

import { useState, useMemo } from 'react';
import { DashboardAsset, MarketSummary, Profile, SortOption, FilterType, FilterSeverity } from '@/types';
import AssetCard from './AssetCard';
import AddAssetsModal from './AddAssetsModal';
import Topbar from './Topbar';
import SummaryStrip from './SummaryStrip';
import MarketSummaryBanner from './MarketSummaryBanner';

interface Props {
  initialAssets: DashboardAsset[];
  profile: Profile | null;
  lastUpdated: string | null;
  marketSummary: MarketSummary | null;
  userId: string;
}

export default function DashboardClient({
  initialAssets,
  profile,
  lastUpdated,
  marketSummary,
  userId,
}: Props) {
  const [assets, setAssets] = useState<DashboardAsset[]>(initialAssets);
  const [sortBy, setSortBy] = useState<SortOption>('score');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all');
  const [showAddModal, setShowAddModal] = useState(assets.length === 0);

  const sorted = useMemo(() => {
    let result = [...assets];

    // Filter by type
    if (filterType !== 'all') {
      result = result.filter((a) => a.asset.asset_type === filterType);
    }

    // Filter by severity
    if (filterSeverity !== 'all') {
      result = result.filter(
        (a) => (a.anomalyScore?.severity ?? 'normal') === filterSeverity
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return (b.anomalyScore?.combined_score ?? 0) - (a.anomalyScore?.combined_score ?? 0);
        case 'name':
          return a.asset.name.localeCompare(b.asset.name);
        case 'daily_change': {
          const aChange = getDailyChange(a);
          const bChange = getDailyChange(b);
          return Math.abs(bChange) - Math.abs(aChange);
        }
        case 'asset_type':
          return a.asset.asset_type.localeCompare(b.asset.asset_type);
        default:
          return 0;
      }
    });

    return result;
  }, [assets, sortBy, filterType, filterSeverity]);

  function getDailyChange(item: DashboardAsset): number {
    const prices = item.priceHistory;
    if (prices.length < 2) return 0;
    const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    if (!last?.close || !prev?.close) return 0;
    return ((last.close - prev.close) / prev.close) * 100;
  }

  function removeAsset(assetId: string) {
    setAssets((prev) => prev.filter((a) => a.asset.id !== assetId));
  }

  const counts = useMemo(() => ({
    total: assets.length,
    extreme: assets.filter((a) => a.anomalyScore?.severity === 'extreme').length,
    high: assets.filter((a) => a.anomalyScore?.severity === 'high').length,
    elevated: assets.filter((a) => a.anomalyScore?.severity === 'elevated').length,
    normal: assets.filter((a) => (a.anomalyScore?.severity ?? 'normal') === 'normal').length,
  }), [assets]);

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <Topbar
        profile={profile}
        lastUpdated={lastUpdated}
        onAddAssets={() => setShowAddModal(true)}
      />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <SummaryStrip counts={counts} />

        {marketSummary && <MarketSummaryBanner summary={marketSummary} />}

        {/* Sort/Filter controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-sm">Sort:</span>
            {(['score', 'name', 'daily_change', 'asset_type'] as SortOption[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  sortBy === opt
                    ? 'bg-blue-700/40 text-blue-300 border border-blue-600/50'
                    : 'bg-gray-800/60 text-slate-400 border border-gray-700/50 hover:text-slate-300'
                }`}
              >
                {opt === 'score' ? 'Score' : opt === 'name' ? 'Name' : opt === 'daily_change' ? 'Daily Chg' : 'Type'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-slate-500 text-sm">Filter:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className="bg-gray-800/60 border border-gray-700/50 text-slate-300 text-xs rounded px-2 py-1"
            >
              <option value="all">All Types</option>
              <option value="stock">Stocks</option>
              <option value="crypto">Crypto</option>
              <option value="metal">Metals</option>
              <option value="fx">FX</option>
              <option value="bond">Bonds</option>
            </select>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as FilterSeverity)}
              className="bg-gray-800/60 border border-gray-700/50 text-slate-300 text-xs rounded px-2 py-1"
            >
              <option value="all">All Severity</option>
              <option value="extreme">Extreme</option>
              <option value="high">High</option>
              <option value="elevated">Elevated</option>
              <option value="normal">Normal</option>
            </select>
          </div>
        </div>

        {/* Asset grid */}
        {sorted.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-white text-xl font-semibold mb-2">
              {assets.length === 0 ? 'No assets tracked yet' : 'No assets match your filters'}
            </h3>
            <p className="text-slate-400 mb-6">
              {assets.length === 0
                ? 'Add assets to your watchlist to start tracking anomalies and trends'
                : 'Try adjusting your filter settings'}
            </p>
            {assets.length === 0 && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
              >
                Add Assets
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map((item) => (
              <AssetCard
                key={item.asset.id}
                item={item}
                onRemove={removeAsset}
              />
            ))}
          </div>
        )}
      </main>

      {showAddModal && (
        <AddAssetsModal
          userId={userId}
          currentAssetIds={assets.map((a) => a.asset.id)}
          onClose={() => setShowAddModal(false)}
          onAssetsChange={(added, removed) => {
            // Refresh page to get new data
            if (added.length > 0 || removed.length > 0) {
              window.location.reload();
            }
          }}
        />
      )}
    </div>
  );
}
