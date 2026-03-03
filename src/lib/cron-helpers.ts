import { createClient } from '@supabase/supabase-js';
import { fetchTimeSeries } from '@/lib/twelve-data';
import { fetchCompanyNews, fetchCryptoNews, fetchGeneralNews, getKeywordsForAsset } from '@/lib/finnhub';
import { Asset, DailyPrice } from '@/types';

/**
 * Strip today's partial bar from a price series so anomaly scores are always
 * computed against complete trading days only.
 */
export function excludePartialDay(prices: DailyPrice[], today: string): DailyPrice[] {
  if (prices.length === 0) return prices;
  return prices[prices.length - 1].date === today ? prices.slice(0, -1) : prices;
}

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function fetchAndStorePrices(
  supabase: ReturnType<typeof createServiceClient>,
  asset: Asset,
  today: string
): Promise<DailyPrice[]> {
  const { data: existing } = await supabase
    .from('daily_prices')
    .select('date')
    .eq('asset_id', asset.id)
    .order('date', { ascending: false })
    .limit(1);

  const latestExisting = existing?.[0]?.date;
  const needsFullHistory = !latestExisting || latestExisting < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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

    for (let i = 0; i < rows.length; i += 100) {
      await supabase
        .from('daily_prices')
        .upsert(rows.slice(i, i + 100), { onConflict: 'asset_id,date' });
    }
  }

  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: prices } = await supabase
    .from('daily_prices')
    .select('*')
    .eq('asset_id', asset.id)
    .gte('date', yearAgo)
    .order('date', { ascending: true });

  return (prices ?? []) as DailyPrice[];
}

export async function fetchAndStoreNews(
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
