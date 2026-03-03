import { createClient } from '@supabase/supabase-js';
import { fetchTimeSeries } from '@/lib/twelve-data';
import { fetchCompanyNews, fetchCryptoNews, fetchGeneralNews, getKeywordsForAsset } from '@/lib/finnhub';
import { Asset, DailyPrice } from '@/types';

// Asset types that have no meaningful volume data (mirrors anomaly.ts)
const NO_VOLUME_TYPES = ['fx', 'metal', 'bond'];

/**
 * Returns a multiplier to scale today's partial volume to a projected full-day
 * volume, or null if the market session is complete (no adjustment needed) or the
 * session is too young to project reliably (< 10% elapsed).
 *
 * Crypto: 24h UTC-day session.
 * Equities / everything else: US market hours 9:30–16:00 ET.
 */
export function getVolumeProjectionFactor(assetType: string): number | null {
  if (NO_VOLUME_TYPES.includes(assetType)) return null;

  const now = new Date();

  if (assetType === 'crypto') {
    const secondsElapsed =
      now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
    const fraction = secondsElapsed / (24 * 3600);
    if (fraction < 0.1) return null; // Too early, projection too uncertain
    return 1 / fraction;
  }

  // Equity / other: US market hours 9:30–16:00 ET
  const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const etMinutes = etNow.getHours() * 60 + etNow.getMinutes();
  const marketOpen  = 9 * 60 + 30; // 570 min
  const marketClose = 16 * 60;     // 960 min

  if (etMinutes >= marketClose) return null; // Session complete, full day volume
  if (etMinutes <  marketOpen)  return null; // Pre-market, no reliable volume yet

  const fraction = (etMinutes - marketOpen) / (marketClose - marketOpen);
  if (fraction < 0.1) return null; // First ~39 min, projection too noisy
  return 1 / fraction;
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
