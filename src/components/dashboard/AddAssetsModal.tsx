'use client';

import { useState, useEffect, useMemo } from 'react';
import { Asset } from '@/types';
import { createClient } from '@/lib/supabase/client';

interface Props {
  userId: string;
  currentAssetIds: string[];
  onClose: () => void;
  onAssetsChange: (added: string[], removed: string[]) => void;
}

const TYPE_LABELS: Record<string, string> = {
  stock: 'Stocks',
  crypto: 'Crypto',
  metal: 'Metals',
  fx: 'FX',
  bond: 'Bonds',
  future: 'Futures',
};

export default function AddAssetsModal({
  userId,
  currentAssetIds,
  onClose,
  onAssetsChange,
}: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set(currentAssetIds));
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from('assets')
      .select('*')
      .eq('is_active', true)
      .order('asset_type')
      .order('id')
      .then(({ data }) => {
        setAssets(data ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!search) return assets;
    const q = search.toLowerCase();
    return assets.filter(
      (a) =>
        a.id.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.asset_type.toLowerCase().includes(q)
    );
  }, [assets, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, Asset[]> = {};
    filtered.forEach((a) => {
      if (!groups[a.asset_type]) groups[a.asset_type] = [];
      groups[a.asset_type].push(a);
    });
    return groups;
  }, [filtered]);

  async function toggleAsset(assetId: string) {
    setSaving(assetId);
    const isIn = watchlistIds.has(assetId);

    if (isIn) {
      await supabase
        .from('watchlist')
        .delete()
        .eq('user_id', userId)
        .eq('asset_id', assetId);
      setWatchlistIds((prev) => {
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
    } else {
      await supabase
        .from('watchlist')
        .insert({ user_id: userId, asset_id: assetId });
      setWatchlistIds((prev) => new Set([...prev, assetId]));
    }

    setSaving(null);
  }

  function handleDone() {
    const added = [...watchlistIds].filter((id) => !currentAssetIds.includes(id));
    const removed = currentAssetIds.filter((id) => !watchlistIds.has(id));
    onAssetsChange(added, removed);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f1623] border border-gray-700/50 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/50">
          <h2 className="text-white font-semibold text-lg">Add Assets</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-700/50">
          <input
            type="text"
            placeholder="Search by ticker or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            autoFocus
          />
        </div>

        {/* Asset list */}
        <div className="overflow-y-auto flex-1 px-5 py-3">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading assets...</div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="text-center py-8 text-slate-500">No assets found</div>
          ) : (
            Object.entries(grouped).map(([type, typeAssets]) => (
              <div key={type} className="mb-4">
                <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                  {TYPE_LABELS[type] ?? type} ({typeAssets.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {typeAssets.map((asset) => {
                    const isIn = watchlistIds.has(asset.id);
                    const isSaving = saving === asset.id;

                    return (
                      <button
                        key={asset.id}
                        onClick={() => toggleAsset(asset.id)}
                        disabled={isSaving}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left ${
                          isIn
                            ? 'bg-blue-900/30 border-blue-700/50 text-white'
                            : 'bg-gray-800/40 border-gray-700/40 text-slate-300 hover:border-gray-600/60 hover:bg-gray-800/60'
                        } ${isSaving ? 'opacity-50' : ''}`}
                      >
                        <div>
                          <span className="font-mono font-semibold text-sm">{asset.id}</span>
                          <p className="text-xs text-slate-500 truncate max-w-[150px]">
                            {asset.name}
                          </p>
                        </div>
                        <span className={`text-xs font-medium flex-shrink-0 ${isIn ? 'text-blue-400' : 'text-slate-500'}`}>
                          {isSaving ? '...' : isIn ? '✓ Added' : '+ Add'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-700/50 flex items-center justify-between">
          <span className="text-slate-500 text-sm">
            {watchlistIds.size} asset{watchlistIds.size !== 1 ? 's' : ''} in watchlist
          </span>
          <button
            onClick={handleDone}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
