import { NextResponse } from 'next/server';
import { computeAnomalyScores, computeTrendScores, classifyScores } from '@/lib/anomaly';
import { Asset } from '@/types';
import { createServiceClient, verifyCronAuth, fetchAndStorePrices, fetchAndStoreNews } from '@/lib/cron-helpers';

export const maxDuration = 300;

export async function POST(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];
  const results = {
    assetsProcessed: 0,
    pricesFetched: 0,
    newsFetched: 0,
    scoresComputed: 0,
    errors: [] as string[],
  };

  console.log(`[fetch-prices] Starting for ${today}`);

  const { data: watchlistItems } = await supabase
    .from('watchlist')
    .select('asset_id')
    .order('asset_id');

  const uniqueAssetIds = [...new Set(watchlistItems?.map((w) => w.asset_id) ?? [])];

  if (uniqueAssetIds.length === 0) {
    return NextResponse.json({ message: 'No assets to process', results });
  }

  const { data: assets } = await supabase
    .from('assets')
    .select('*')
    .in('id', uniqueAssetIds)
    .eq('is_active', true);

  if (!assets || assets.length === 0) {
    return NextResponse.json({ message: 'No active assets found', results });
  }

  console.log(`[fetch-prices] Processing ${assets.length} assets`);

  const newFromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newToDate = new Date();

  for (let i = 0; i < assets.length; i += 8) {
    const batch = assets.slice(i, i + 8) as Asset[];

    await Promise.allSettled(batch.map(async (asset) => {
      try {
        const prices = await fetchAndStorePrices(supabase, asset, today);
        if (prices.length > 0) results.pricesFetched++;

        await fetchAndStoreNews(supabase, asset, newFromDate, newToDate);
        results.newsFetched++;

        if (prices.length >= 5) {
          const anomaly = computeAnomalyScores(prices, asset.asset_type);
          const trend = computeTrendScores(prices);
          const combined = classifyScores(anomaly, trend);

          await supabase
            .from('anomaly_scores')
            .upsert({
              asset_id: asset.id,
              date: today,
              ...anomaly,
              ...trend,
              combined_score: combined.combined_score,
              severity: combined.severity,
              signal_type: combined.signal_type,
              dominant_timescale: combined.dominant_timescale,
            }, { onConflict: 'asset_id,date' });

          results.scoresComputed++;
        }

        results.assetsProcessed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[fetch-prices] Error for ${asset.id}:`, msg);
        results.errors.push(`${asset.id}: ${msg}`);
      }
    }));

    // Wait 60s between batches (Twelve Data rate limit: 8 req/min)
    if (i + 8 < assets.length) {
      await new Promise((resolve) => setTimeout(resolve, 61000));
    }
  }

  // Prune old news (>45 days)
  const cutoffDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  await supabase.from('news').delete().lt('fetched_date', cutoffDate);

  console.log('[fetch-prices] Done:', results);
  return NextResponse.json({ success: true, date: today, results });
}

export async function GET(request: Request) {
  return POST(request);
}
