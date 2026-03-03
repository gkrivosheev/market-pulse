import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardAsset, MarketSummary } from '@/types';
import DashboardClient from '@/components/dashboard/DashboardClient';

async function getDashboardData(userId: string): Promise<{
  assets: DashboardAsset[];
  lastUpdated: string | null;
  marketSummary: MarketSummary | null;
}> {
  const supabase = await createClient();

  // Get watchlist with asset details
  const { data: watchlist } = await supabase
    .from('watchlist')
    .select('*, asset:assets(*)')
    .eq('user_id', userId);

  if (!watchlist || watchlist.length === 0) {
    return { assets: [], lastUpdated: null, marketSummary: null };
  }

  const assetIds = watchlist.map((w) => w.asset_id);

  // Get today's date
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // Fetch latest anomaly scores, prices, AI analysis, and market summary in parallel
  const [{ data: anomalyScores }, { data: prices }, { data: aiAnalyses }, { data: marketSummaryRow }] =
    await Promise.all([
      supabase
        .from('anomaly_scores')
        .select('*')
        .in('asset_id', assetIds)
        .eq('date', today),
      supabase
        .from('daily_prices')
        .select('*')
        .in('asset_id', assetIds)
        .gte('date', thirtyDaysAgo)
        .order('date', { ascending: false }),
      supabase
        .from('ai_analysis')
        .select('*')
        .in('asset_id', assetIds)
        .eq('date', today),
      supabase
        .from('market_summary')
        .select('*')
        .eq('date', today)
        .single(),
    ]);

  // Build asset map for latest scores
  const scoreMap = new Map(anomalyScores?.map((s) => [s.asset_id, s]) ?? []);
  const analysisMap = new Map(aiAnalyses?.map((a) => [a.asset_id, a]) ?? []);

  // Group price history by asset
  const priceMap = new Map<string, typeof prices>();
  prices?.forEach((p) => {
    const existing = priceMap.get(p.asset_id) ?? [];
    priceMap.set(p.asset_id, [...existing, p]);
  });

  const assets: DashboardAsset[] = watchlist.map((w) => {
    const priceHistory = priceMap.get(w.asset_id) ?? [];
    const sortedPrices = [...priceHistory].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return {
      asset: w.asset,
      watchlist: w,
      latestPrice: sortedPrices[sortedPrices.length - 1] ?? null,
      anomalyScore: scoreMap.get(w.asset_id) ?? null,
      aiAnalysis: analysisMap.get(w.asset_id) ?? null,
      priceHistory: sortedPrices,
    };
  });

  // Find last updated date
  const lastUpdated = anomalyScores?.[0]?.computed_at ?? null;

  return { assets, lastUpdated, marketSummary: (marketSummaryRow as MarketSummary) ?? null };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { assets, lastUpdated, marketSummary } = await getDashboardData(user.id);

  return (
    <DashboardClient
      initialAssets={assets}
      profile={profile}
      lastUpdated={lastUpdated}
      marketSummary={marketSummary}
      userId={user.id}
    />
  );
}
