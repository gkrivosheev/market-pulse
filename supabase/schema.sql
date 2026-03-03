-- Market Pulse Database Schema
-- Run this in your Supabase SQL editor

-- Users (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  notification_email BOOLEAN DEFAULT true,
  notification_daily_digest BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Master list of supported assets
CREATE TABLE public.assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'crypto', 'metal', 'bond', 'future', 'fx')),
  sector TEXT,
  twelve_data_symbol TEXT NOT NULL,
  finnhub_symbol TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User watchlists (many-to-many)
CREATE TABLE public.watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset_id TEXT REFERENCES public.assets(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  notify_urgent BOOLEAN DEFAULT true,
  UNIQUE(user_id, asset_id)
);

-- Daily OHLCV data (cached from Twelve Data)
CREATE TABLE public.daily_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT REFERENCES public.assets(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  open NUMERIC,
  high NUMERIC,
  low NUMERIC,
  close NUMERIC,
  volume NUMERIC,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, date)
);

-- Computed anomaly scores AND trend significance
CREATE TABLE public.anomaly_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT REFERENCES public.assets(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Anomaly z-scores
  price_move_zscore_daily NUMERIC,
  volatility_zscore_daily NUMERIC,
  volume_zscore_daily NUMERIC,
  price_move_zscore_weekly NUMERIC,
  volatility_zscore_weekly NUMERIC,
  volume_zscore_weekly NUMERIC,
  price_move_zscore_monthly NUMERIC,
  volatility_zscore_monthly NUMERIC,
  volume_zscore_monthly NUMERIC,
  composite_anomaly_score NUMERIC,

  -- Trend significance
  return_1w NUMERIC,
  return_1m NUMERIC,
  return_3m NUMERIC,
  return_zscore_1w NUMERIC,
  return_zscore_1m NUMERIC,
  return_zscore_3m NUMERIC,
  composite_trend_score NUMERIC,

  -- Combined
  combined_score NUMERIC,
  severity TEXT CHECK (severity IN ('normal', 'elevated', 'high', 'extreme')),
  signal_type TEXT CHECK (signal_type IN ('anomaly', 'trend', 'both')),
  dominant_timescale TEXT CHECK (dominant_timescale IN ('daily', 'weekly', 'monthly')),

  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, date)
);

-- News articles (cached from Finnhub, rolling 45-day archive)
CREATE TABLE public.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT REFERENCES public.assets(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  summary TEXT,
  source TEXT,
  url TEXT,
  published_at TIMESTAMPTZ,
  sentiment NUMERIC,
  fetched_date DATE NOT NULL,
  UNIQUE(asset_id, url)
);

-- AI analysis
CREATE TABLE public.ai_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT REFERENCES public.assets(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  analysis TEXT NOT NULL,
  key_drivers TEXT[],
  outlook TEXT CHECK (outlook IN ('bullish_signal', 'bearish_signal', 'neutral', 'uncertain')),
  signal_type TEXT CHECK (signal_type IN ('anomaly', 'trend', 'both')),
  dominant_timescale TEXT CHECK (dominant_timescale IN ('daily', 'weekly', 'monthly')),
  news_window_days INTEGER,
  model_used TEXT DEFAULT 'claude-sonnet-4-20250514',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, date)
);

-- Indexes for performance
CREATE INDEX idx_daily_prices_asset_date ON public.daily_prices(asset_id, date DESC);
CREATE INDEX idx_anomaly_scores_asset_date ON public.anomaly_scores(asset_id, date DESC);
CREATE INDEX idx_news_asset_published ON public.news(asset_id, published_at DESC);
CREATE INDEX idx_news_fetched_date ON public.news(fetched_date);
CREATE INDEX idx_watchlist_user ON public.watchlist(user_id);
CREATE INDEX idx_watchlist_asset ON public.watchlist(asset_id);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomaly_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own watchlist" ON public.watchlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own watchlist" ON public.watchlist FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view assets" ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view daily_prices" ON public.daily_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view anomaly_scores" ON public.anomaly_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view news" ON public.news FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view ai_analysis" ON public.ai_analysis FOR SELECT TO authenticated USING (true);

-- Auto-update profiles.updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Daily AI executive market summary (web-search powered)
CREATE TABLE public.market_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  market_regime TEXT CHECK (market_regime IN ('risk-on', 'risk-off', 'mixed', 'normal')),
  flagged_count INTEGER NOT NULL DEFAULT 0,
  sources JSONB DEFAULT '[]',
  model_used TEXT DEFAULT 'claude-sonnet-4-20250514',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.market_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view market_summary" ON public.market_summary FOR SELECT TO authenticated USING (true);
