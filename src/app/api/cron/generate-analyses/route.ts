import { NextResponse } from 'next/server';
import { generateAnalysis } from '@/lib/claude';
import { getNewsWindowDays } from '@/lib/anomaly';
import { Asset, DailyPrice, NewsArticle, AnomalyScore } from '@/types';
import { createServiceClient, verifyCronAuth } from '@/lib/cron-helpers';

export const maxDuration = 300;

export async function POST(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];
  const results = {
    analysesGenerated: 0,
    errors: [] as string[],
  };

  console.log(`[generate-analyses] Starting for ${today}`);

  // Read today's flagged scores directly from DB (combined_score >= 1.5)
  const { data: flaggedScores } = await supabase
    .from('anomaly_scores')
    .select('*')
    .eq('date', today)
    .gte('combined_score', 1.5);

  if (!flaggedScores || flaggedScores.length === 0) {
    console.log('[generate-analyses] No flagged assets today');
    return NextResponse.json({ message: 'No flagged assets today', results });
  }

  const flaggedAssetIds = flaggedScores.map((s) => s.asset_id);

  const { data: assets } = await supabase
    .from('assets')
    .select('*')
    .in('id', flaggedAssetIds)
    .eq('is_active', true);

  if (!assets || assets.length === 0) {
    return NextResponse.json({ message: 'No active flagged assets', results });
  }

  console.log(`[generate-analyses] ${assets.length} assets flagged for AI analysis`);

  const scoreMap = new Map<string, AnomalyScore>(
    flaggedScores.map((s) => [s.asset_id, s as AnomalyScore])
  );

  for (const asset of assets as Asset[]) {
    try {
      const score = scoreMap.get(asset.id)!;
      const newsWindowDays = getNewsWindowDays(score.dominant_timescale ?? 'daily');
      const newsFromDate = new Date(Date.now() - newsWindowDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [{ data: prices }, { data: newsItems }] = await Promise.all([
        supabase
          .from('daily_prices')
          .select('*')
          .eq('asset_id', asset.id)
          .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('date', { ascending: true }),
        supabase
          .from('news')
          .select('*')
          .eq('asset_id', asset.id)
          .gte('published_at', newsFromDate)
          .order('published_at', { ascending: true }),
      ]);

      const analysis = await generateAnalysis(
        asset,
        score,
        (prices ?? []) as DailyPrice[],
        (newsItems ?? []) as NewsArticle[]
      );

      if (analysis) {
        await supabase
          .from('ai_analysis')
          .upsert({
            asset_id: asset.id,
            date: today,
            analysis: analysis.analysis,
            key_drivers: analysis.key_drivers,
            outlook: analysis.outlook,
            signal_type: score.signal_type,
            dominant_timescale: score.dominant_timescale,
            news_window_days: newsWindowDays,
            model_used: 'claude-sonnet-4-20250514',
          }, { onConflict: 'asset_id,date' });

        results.analysesGenerated++;
      }

      // Small delay between Claude calls
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[generate-analyses] Error for ${asset.id}:`, msg);
      results.errors.push(`${asset.id}: ${msg}`);
    }
  }

  console.log('[generate-analyses] Done:', results);
  return NextResponse.json({ success: true, date: today, results });
}

export async function GET(request: Request) {
  return POST(request);
}
