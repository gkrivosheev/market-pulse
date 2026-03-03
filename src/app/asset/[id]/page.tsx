import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import AssetDetailClient from '@/components/asset/AssetDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AssetDetailPage({ params }: Props) {
  const { id } = await params;
  const assetId = decodeURIComponent(id);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/');

  // Fetch all data in parallel
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [
    { data: asset },
    { data: watchlistEntry },
    { data: prices },
    { data: anomalyScores },
    { data: latestAnalysis },
    { data: news },
  ] = await Promise.all([
    supabase.from('assets').select('*').eq('id', assetId).single(),
    supabase.from('watchlist').select('*').eq('user_id', user.id).eq('asset_id', assetId).single(),
    supabase.from('daily_prices').select('*').eq('asset_id', assetId).gte('date', oneYearAgo).order('date', { ascending: true }),
    supabase.from('anomaly_scores').select('*').eq('asset_id', assetId).gte('date', oneYearAgo).order('date', { ascending: true }),
    supabase.from('ai_analysis').select('*').eq('asset_id', assetId).eq('date', today).single(),
    supabase.from('news').select('*').eq('asset_id', assetId).gte('fetched_date', fortyFiveDaysAgo).order('published_at', { ascending: false }),
  ]);

  if (!asset) notFound();

  return (
    <AssetDetailClient
      asset={asset}
      isInWatchlist={!!watchlistEntry}
      watchlistEntry={watchlistEntry ?? null}
      prices={prices ?? []}
      anomalyScores={anomalyScores ?? []}
      latestAnalysis={latestAnalysis ?? null}
      news={news ?? []}
      userId={user.id}
    />
  );
}
