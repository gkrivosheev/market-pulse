import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchTimeSeries } from '@/lib/twelve-data';
import { fetchCompanyNews, fetchCryptoNews, fetchGeneralNews, getKeywordsForAsset } from '@/lib/finnhub';
import { computeAnomalyScores, computeTrendScores, classifyScores, getNewsWindowDays } from '@/lib/anomaly';
import { generateAnalysis, generateMarketSummary } from '@/lib/claude';
import { sendDailyDigest } from '@/lib/email';
import { Asset, DailyPrice, NewsArticle, AnomalyScore } from '@/types';

export const maxDuration = 300; // 5 minutes

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function fetchAndStorePrices(
  supabase: ReturnType<typeof createServiceClient>,
  asset: Asset,
  today: string
): Promise<DailyPrice[]> {
  // Check if we already have recent data
  const { data: existing } = await supabase
    .from('daily_prices')
    .select('date')
    .eq('asset_id', asset.id)
    .order('date', { ascending: false })
    .limit(1);

  const latestExisting = existing?.[0]?.date;
  const needsFullHistory = !latestExisting || latestExisting < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Fetch from Twelve Data
  const outputsize = needsFullHistory ? 365 : 5;
  const values = await fetchTimeSeries(asset.twelve_data_symbol, outputsize);

  if (values && values.length > 0) {
    const rows = values.map((v) => ({
      asset_id: asset.id,
      date: v.datetime,
      open: parseFloat(v.open) || null,
      high: parseFloat(v.high) || null,
      low: parseFloat(v.low) || null,
      close: parseFloat(v.close) || null,
      volume: v.volume ? parseFloat(v.volume) || null : null,
    }));

    // Upsert in batches of 100
    for (let i = 0; i < rows.length; i += 100) {
      await supabase
        .from('daily_prices')
        .upsert(rows.slice(i, i + 100), { onConflict: 'asset_id,date' });
    }
  }

  // Return last 365 days of prices for anomaly calculation
  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: prices } = await supabase
    .from('daily_prices')
    .select('*')
    .eq('asset_id', asset.id)
    .gte('date', yearAgo)
    .order('date', { ascending: true });

  return (prices ?? []) as DailyPrice[];
}

async function fetchAndStoreNews(
  supabase: ReturnType<typeof createServiceClient>,
  asset: Asset,
  fromDate: Date,
  toDate: Date
): Promise<void> {
  let articles = [];

  try {
    if (asset.asset_type === 'stock' && asset.finnhub_symbol) {
      articles = await fetchCompanyNews(asset.finnhub_symbol, fromDate, toDate);
    } else if (asset.asset_type === 'crypto') {
      const keywords = getKeywordsForAsset(asset.id, asset.name, asset.asset_type);
      articles = await fetchCryptoNews(keywords, fromDate, toDate);
    } else {
      const keywords = getKeywordsForAsset(asset.id, asset.name, asset.asset_type);
      articles = await fetchGeneralNews(keywords, fromDate, toDate);
    }
  } catch (err) {
    console.error(`News fetch error for ${asset.id}:`, err);
    return;
  }

  if (articles.length === 0) return;

  const today = toDate.toISOString().split('T')[0];
  const rows = articles
    .filter((a) => a.url && a.headline)
    .map((a) => ({
      asset_id: asset.id,
      headline: a.headline,
      summary: a.summary || null,
      source: a.source || null,
      url: a.url,
      published_at: a.datetime ? new Date(a.datetime * 1000).toISOString() : null,
      sentiment: null,
      fetched_date: today,
    }));

  if (rows.length > 0) {
    await supabase
      .from('news')
      .upsert(rows, { onConflict: 'asset_id,url', ignoreDuplicates: true });
  }
}

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;
  if (authHeader !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];
  const results = {
    assetsProcessed: 0,
    pricesFetched: 0,
    newsFetched: 0,
    scoresComputed: 0,
    analysesGenerated: 0,
    marketSummaryGenerated: false,
    emailsSent: 0,
    errors: [] as string[],
  };

  console.log(`[Cron] Starting daily update for ${today}`);

  // Step 1: Get all unique assets tracked by any user
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

  console.log(`[Cron] Processing ${assets.length} assets`);

  // Step 2-4: Fetch prices, news, compute scores for each asset
  // Process in batches of 8 (Twelve Data rate limit)
  const newFromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newToDate = new Date();

  const assetScores: Map<string, AnomalyScore> = new Map();

  for (let i = 0; i < assets.length; i += 8) {
    const batch = assets.slice(i, i + 8) as Asset[];

    await Promise.allSettled(batch.map(async (asset) => {
      try {
        // Fetch and store prices
        const prices = await fetchAndStorePrices(supabase, asset, today);
        if (prices.length > 0) results.pricesFetched++;

        // Fetch and store news
        await fetchAndStoreNews(supabase, asset, newFromDate, newToDate);
        results.newsFetched++;

        // Compute anomaly + trend scores
        if (prices.length >= 5) {
          const anomaly = computeAnomalyScores(prices, asset.asset_type);
          const trend = computeTrendScores(prices);
          const combined = classifyScores(anomaly, trend);

          const scoreRow = {
            asset_id: asset.id,
            date: today,
            ...anomaly,
            ...trend,
            combined_score: combined.combined_score,
            severity: combined.severity,
            signal_type: combined.signal_type,
            dominant_timescale: combined.dominant_timescale,
          };

          await supabase
            .from('anomaly_scores')
            .upsert(scoreRow, { onConflict: 'asset_id,date' });

          // Store for AI analysis step
          const { data: stored } = await supabase
            .from('anomaly_scores')
            .select('*')
            .eq('asset_id', asset.id)
            .eq('date', today)
            .single();

          if (stored) assetScores.set(asset.id, stored as AnomalyScore);
          results.scoresComputed++;
        }

        results.assetsProcessed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Cron] Error processing ${asset.id}:`, msg);
        results.errors.push(`${asset.id}: ${msg}`);
      }
    }));

    // Wait 60s between batches (rate limit)
    if (i + 8 < assets.length) {
      await new Promise((resolve) => setTimeout(resolve, 61000));
    }
  }

  // Step 5: Prune old news (>45 days)
  const cutoffDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  await supabase.from('news').delete().lt('fetched_date', cutoffDate);

  // Step 6: Generate AI analysis for assets with combined_score >= 1.5
  const flaggedAssets = assets.filter((asset) => {
    const score = assetScores.get((asset as Asset).id);
    return score && (score.combined_score ?? 0) >= 1.5;
  }) as Asset[];

  console.log(`[Cron] ${flaggedAssets.length} assets flagged for AI analysis`);

  for (const asset of flaggedAssets) {
    try {
      const score = assetScores.get(asset.id)!;
      const newsWindowDays = getNewsWindowDays(score.dominant_timescale ?? 'daily');
      const newsFromDate = new Date(Date.now() - newsWindowDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Get price history and news
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
      console.error(`[Cron] AI analysis error for ${asset.id}:`, msg);
      results.errors.push(`AI:${asset.id}: ${msg}`);
    }
  }

  // Step 6.5: Generate executive market summary with web search
  if (flaggedAssets.length > 0) {
    try {
      // Gather the analyses we just generated
      const { data: freshAnalyses } = await supabase
        .from('ai_analysis')
        .select('*')
        .in('asset_id', flaggedAssets.map((a) => (a as Asset).id))
        .eq('date', today);

      const analysisMap = new Map<string, string>((freshAnalyses ?? []).map((a) => [a.asset_id, a.analysis as string]));

      const flaggedContexts = flaggedAssets
        .map((asset) => {
          const score = assetScores.get((asset as Asset).id);
          const analysis = analysisMap.get((asset as Asset).id);
          if (!score || !analysis) return null;
          return { asset: asset as Asset, score, analysis };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (flaggedContexts.length > 0) {
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
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Cron] Market summary error:', msg);
      results.errors.push(`MarketSummary: ${msg}`);
    }
  }

  // Step 7: Send daily digest emails
  try {
    const { data: optedInUsers } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .eq('notification_daily_digest', true)
      .not('email', 'is', null);

    if (optedInUsers && optedInUsers.length > 0) {
      const { data: allScores } = await supabase
        .from('anomaly_scores')
        .select('*')
        .in('asset_id', uniqueAssetIds)
        .eq('date', today);

      const { data: allAssets } = await supabase
        .from('assets')
        .select('*')
        .in('id', uniqueAssetIds);

      const { data: allAnalyses } = await supabase
        .from('ai_analysis')
        .select('*')
        .in('asset_id', uniqueAssetIds)
        .eq('date', today);

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
          console.error(`[Cron] Email error for ${user.email}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('[Cron] Email sending failed:', err);
  }

  console.log('[Cron] Done:', results);
  return NextResponse.json({ success: true, date: today, results });
}

// Allow Vercel cron to call via GET as well
export async function GET(request: Request) {
  return POST(request);
}
