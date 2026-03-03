import { NextResponse } from 'next/server';
import { generateMarketSummary } from '@/lib/claude';
import { sendDailyDigest } from '@/lib/email';
import { Asset, AnomalyScore } from '@/types';
import { createServiceClient, verifyCronAuth } from '@/lib/cron-helpers';

export const maxDuration = 300;

export async function POST(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];
  const results = {
    marketSummaryGenerated: false,
    emailsSent: 0,
    errors: [] as string[],
  };

  console.log(`[generate-summary] Starting for ${today}`);

  // Get all watched asset IDs (needed for per-user email digest)
  const { data: watchlistItems } = await supabase
    .from('watchlist')
    .select('asset_id');

  const uniqueAssetIds = [...new Set(watchlistItems?.map((w) => w.asset_id) ?? [])];

  // Generate market summary from today's analyses
  const { data: todayAnalyses } = await supabase
    .from('ai_analysis')
    .select('*')
    .eq('date', today);

  if (todayAnalyses && todayAnalyses.length > 0) {
    const analysedAssetIds = todayAnalyses.map((a) => a.asset_id);

    const [{ data: flaggedScores }, { data: flaggedAssets }] = await Promise.all([
      supabase.from('anomaly_scores').select('*').in('asset_id', analysedAssetIds).eq('date', today),
      supabase.from('assets').select('*').in('id', analysedAssetIds).eq('is_active', true),
    ]);

    const scoreMap = new Map<string, AnomalyScore>(
      (flaggedScores ?? []).map((s) => [s.asset_id, s as AnomalyScore])
    );
    const analysisMap = new Map<string, string>(
      todayAnalyses.map((a) => [a.asset_id, a.analysis as string])
    );

    const flaggedContexts = (flaggedAssets ?? [])
      .map((asset) => {
        const score = scoreMap.get(asset.id);
        const analysis = analysisMap.get(asset.id);
        if (!score || !analysis) return null;
        return { asset: asset as Asset, score, analysis };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (flaggedContexts.length > 0) {
      try {
        const summary = await generateMarketSummary(flaggedContexts, today);
        if (summary) {
          await supabase.from('market_summary').upsert({
            date: today,
            summary: summary.summary,
            market_regime: summary.market_regime,
            flagged_count: flaggedContexts.length,
            sources: summary.sources,
            model_used: 'claude-sonnet-4-20250514',
          }, { onConflict: 'date' });
          results.marketSummaryGenerated = true;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[generate-summary] Market summary error:', msg);
        results.errors.push(`MarketSummary: ${msg}`);
      }
    }
  }

  // Send daily digest emails
  if (uniqueAssetIds.length > 0) {
    try {
      const { data: optedInUsers } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .eq('notification_daily_digest', true)
        .not('email', 'is', null);

      if (optedInUsers && optedInUsers.length > 0) {
        const [{ data: allScores }, { data: allAssets }, { data: allAnalyses }] = await Promise.all([
          supabase.from('anomaly_scores').select('*').in('asset_id', uniqueAssetIds).eq('date', today),
          supabase.from('assets').select('*').in('id', uniqueAssetIds),
          supabase.from('ai_analysis').select('*').in('asset_id', uniqueAssetIds).eq('date', today),
        ]);

        for (const user of optedInUsers) {
          try {
            const { data: userWatchlist } = await supabase
              .from('watchlist')
              .select('asset_id')
              .eq('user_id', user.id);

            const userAssetIds = userWatchlist?.map((w) => w.asset_id) ?? [];
            const userScores = allScores?.filter((s) => userAssetIds.includes(s.asset_id)) ?? [];
            const userAssets = allAssets?.filter((a) => userAssetIds.includes(a.id)) ?? [];
            const userAnalyses = allAnalyses?.filter((a) => userAssetIds.includes(a.asset_id)) ?? [];

            await sendDailyDigest({
              to: user.email!,
              displayName: user.display_name ?? 'there',
              date: today,
              assets: userAssets as Asset[],
              scores: userScores as AnomalyScore[],
              analyses: userAnalyses,
            });

            results.emailsSent++;
          } catch (err) {
            console.error(`[generate-summary] Email error for ${user.email}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('[generate-summary] Email sending failed:', err);
    }
  }

  console.log('[generate-summary] Done:', results);
  return NextResponse.json({ success: true, date: today, results });
}

export async function GET(request: Request) {
  return POST(request);
}
