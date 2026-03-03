export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  notification_email: boolean;
  notification_daily_digest: boolean;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  name: string;
  asset_type: 'stock' | 'crypto' | 'metal' | 'bond' | 'future' | 'fx';
  sector: string | null;
  twelve_data_symbol: string;
  finnhub_symbol: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WatchlistEntry {
  id: string;
  user_id: string;
  asset_id: string;
  added_at: string;
  notify_urgent: boolean;
  asset?: Asset;
}

export interface DailyPrice {
  id: string;
  asset_id: string;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  fetched_at: string;
}

export interface AnomalyScore {
  id: string;
  asset_id: string;
  date: string;

  // Anomaly z-scores
  price_move_zscore_daily: number | null;
  volatility_zscore_daily: number | null;
  volume_zscore_daily: number | null;
  price_move_zscore_weekly: number | null;
  volatility_zscore_weekly: number | null;
  volume_zscore_weekly: number | null;
  price_move_zscore_monthly: number | null;
  volatility_zscore_monthly: number | null;
  volume_zscore_monthly: number | null;
  composite_anomaly_score: number | null;

  // Trend scores
  return_1w: number | null;
  return_1m: number | null;
  return_3m: number | null;
  return_zscore_1w: number | null;
  return_zscore_1m: number | null;
  return_zscore_3m: number | null;
  composite_trend_score: number | null;

  // Combined
  combined_score: number | null;
  severity: 'normal' | 'elevated' | 'high' | 'extreme' | null;
  signal_type: 'anomaly' | 'trend' | 'both' | null;
  dominant_timescale: 'daily' | 'weekly' | 'monthly' | null;

  computed_at: string;
}

export interface NewsArticle {
  id: string;
  asset_id: string;
  headline: string;
  summary: string | null;
  source: string | null;
  url: string | null;
  published_at: string | null;
  sentiment: number | null;
  fetched_date: string;
}

export interface AIAnalysis {
  id: string;
  asset_id: string;
  date: string;
  analysis: string;
  key_drivers: string[];
  outlook: 'bullish_signal' | 'bearish_signal' | 'neutral' | 'uncertain';
  signal_type: 'anomaly' | 'trend' | 'both';
  dominant_timescale: 'daily' | 'weekly' | 'monthly';
  news_window_days: number;
  model_used: string;
  created_at: string;
}

export interface DashboardAsset {
  asset: Asset;
  watchlist: WatchlistEntry;
  latestPrice: DailyPrice | null;
  anomalyScore: AnomalyScore | null;
  aiAnalysis: AIAnalysis | null;
  priceHistory: DailyPrice[];
}

export interface DashboardSummary {
  total: number;
  extreme: number;
  high: number;
  elevated: number;
  normal: number;
  lastUpdated: string | null;
}

export interface MarketSummary {
  id: string;
  date: string;
  summary: string;
  market_regime: 'risk-on' | 'risk-off' | 'mixed' | 'normal';
  flagged_count: number;
  sources: { title: string; url: string }[];
  model_used: string;
  created_at: string;
}

export type SortOption = 'score' | 'name' | 'daily_change' | 'asset_type';
export type FilterType = 'all' | 'stock' | 'crypto' | 'metal' | 'bond' | 'future' | 'fx';
export type FilterSeverity = 'all' | 'extreme' | 'high' | 'elevated' | 'normal';
