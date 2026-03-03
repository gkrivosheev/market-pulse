import { DailyPrice, AnomalyScore } from '@/types';

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function std(values: number[], avg?: number): number {
  if (values.length < 2) return 0;
  const m = avg ?? mean(values);
  const variance = values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function zscore(value: number, values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const s = std(values, m);
  if (s === 0) return 0;
  return (value - m) / s;
}

function safeDiv(a: number, b: number): number {
  if (b === 0 || !isFinite(b)) return 0;
  return a / b;
}

interface AnomalyScores {
  price_move_zscore_daily: number | null;
  volatility_zscore_daily: number | null;
  volume_zscore_daily: number | null;
  price_move_zscore_weekly: number | null;
  volatility_zscore_weekly: number | null;
  volume_zscore_weekly: number | null;
  price_move_zscore_monthly: number | null;
  volatility_zscore_monthly: number | null;
  volume_zscore_monthly: number | null;
  composite_anomaly_score: number;
}

interface TrendScores {
  return_1w: number | null;
  return_1m: number | null;
  return_3m: number | null;
  return_zscore_1w: number | null;
  return_zscore_1m: number | null;
  return_zscore_3m: number | null;
  composite_trend_score: number;
}

export interface ComputedScores extends AnomalyScores, TrendScores {
  combined_score: number;
  severity: 'normal' | 'elevated' | 'high' | 'extreme';
  signal_type: 'anomaly' | 'trend' | 'both';
  dominant_timescale: 'daily' | 'weekly' | 'monthly';
}

// Assets without meaningful volume data
const NO_VOLUME_TYPES = ['fx', 'metal', 'bond'];

export function computeAnomalyScores(
  prices: DailyPrice[],
  assetType: string
): AnomalyScores {
  const hasVolume = !NO_VOLUME_TYPES.includes(assetType);

  if (prices.length < 2) {
    return {
      price_move_zscore_daily: null,
      volatility_zscore_daily: null,
      volume_zscore_daily: null,
      price_move_zscore_weekly: null,
      volatility_zscore_weekly: null,
      volume_zscore_weekly: null,
      price_move_zscore_monthly: null,
      volatility_zscore_monthly: null,
      volume_zscore_monthly: null,
      composite_anomaly_score: 0,
    };
  }

  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const today = sorted[sorted.length - 1];

  // ── DAILY (vs rolling 30-day window) ──────────────────────────────────────
  let price_move_zscore_daily: number | null = null;
  let volatility_zscore_daily: number | null = null;
  let volume_zscore_daily: number | null = null;

  if (sorted.length >= 5) {
    const window = sorted.slice(-31); // last 30 days + today
    const pastWindow = window.slice(0, -1); // exclude today

    // Daily price change %
    const priceMoves = pastWindow.slice(1).map((d, i) =>
      safeDiv((d.close ?? 0) - (pastWindow[i].close ?? 0), pastWindow[i].close ?? 1) * 100
    );
    const todayMove = safeDiv(
      (today.close ?? 0) - (sorted[sorted.length - 2].close ?? 0),
      sorted[sorted.length - 2].close ?? 1
    ) * 100;
    if (priceMoves.length >= 5) {
      price_move_zscore_daily = zscore(todayMove, priceMoves);
    }

    // Intraday volatility: (high - low) / close %
    const vols = pastWindow.map((d) =>
      safeDiv((d.high ?? 0) - (d.low ?? 0), d.close ?? 1) * 100
    );
    const todayVol = safeDiv((today.high ?? 0) - (today.low ?? 0), today.close ?? 1) * 100;
    if (vols.length >= 5) {
      volatility_zscore_daily = zscore(todayVol, vols);
    }

    // Volume
    if (hasVolume) {
      const volumes = pastWindow.map((d) => d.volume ?? 0).filter((v) => v > 0);
      const todayVol2 = today.volume ?? 0;
      if (volumes.length >= 5 && todayVol2 > 0) {
        volume_zscore_daily = zscore(todayVol2, volumes);
      }
    }
  }

  // ── WEEKLY (vs rolling 13-week window) ────────────────────────────────────
  let price_move_zscore_weekly: number | null = null;
  let volatility_zscore_weekly: number | null = null;
  let volume_zscore_weekly: number | null = null;

  if (sorted.length >= 70) { // ~13 weeks + 1 week current
    // Compute weekly aggregates for past 13 weeks
    const weeksData: { return: number; avgVol: number; totalVol: number }[] = [];

    for (let w = 0; w < 13; w++) {
      const endIdx = sorted.length - 1 - w * 5;
      const startIdx = endIdx - 5;
      if (startIdx < 0) break;

      const weekPrices = sorted.slice(startIdx, endIdx + 1);
      const firstClose = weekPrices[0].close ?? 0;
      const lastClose = weekPrices[weekPrices.length - 1].close ?? 0;
      const weekReturn = safeDiv(lastClose - firstClose, firstClose) * 100;
      const avgVolatility = mean(weekPrices.map((d) =>
        safeDiv((d.high ?? 0) - (d.low ?? 0), d.close ?? 1) * 100
      ));
      const totalVolume = weekPrices.reduce((sum, d) => sum + (d.volume ?? 0), 0);

      weeksData.push({ return: weekReturn, avgVol: avgVolatility, totalVol: totalVolume });
    }

    // Current week
    const currentWeek = sorted.slice(-5);
    const cwFirst = currentWeek[0].close ?? 0;
    const cwLast = currentWeek[currentWeek.length - 1].close ?? 0;
    const currentWeekReturn = safeDiv(cwLast - cwFirst, cwFirst) * 100;
    const currentWeekVol = mean(currentWeek.map((d) =>
      safeDiv((d.high ?? 0) - (d.low ?? 0), d.close ?? 1) * 100
    ));
    const currentWeekVolume = currentWeek.reduce((sum, d) => sum + (d.volume ?? 0), 0);

    if (weeksData.length >= 5) {
      price_move_zscore_weekly = zscore(currentWeekReturn, weeksData.map((w) => w.return));
      volatility_zscore_weekly = zscore(currentWeekVol, weeksData.map((w) => w.avgVol));
      if (hasVolume && currentWeekVolume > 0) {
        const weekVolumes = weeksData.map((w) => w.totalVol).filter((v) => v > 0);
        if (weekVolumes.length >= 5) {
          volume_zscore_weekly = zscore(currentWeekVolume, weekVolumes);
        }
      }
    }
  }

  // ── MONTHLY (vs rolling 12-month window) ──────────────────────────────────
  let price_move_zscore_monthly: number | null = null;
  let volatility_zscore_monthly: number | null = null;
  let volume_zscore_monthly: number | null = null;

  if (sorted.length >= 273) { // ~12 months + 1 month current
    const monthsData: { return: number; avgVol: number; totalVol: number }[] = [];

    for (let m = 0; m < 12; m++) {
      const endIdx = sorted.length - 1 - m * 21;
      const startIdx = endIdx - 21;
      if (startIdx < 0) break;

      const monthPrices = sorted.slice(startIdx, endIdx + 1);
      const firstClose = monthPrices[0].close ?? 0;
      const lastClose = monthPrices[monthPrices.length - 1].close ?? 0;
      const monthReturn = safeDiv(lastClose - firstClose, firstClose) * 100;
      const avgVolatility = mean(monthPrices.map((d) =>
        safeDiv((d.high ?? 0) - (d.low ?? 0), d.close ?? 1) * 100
      ));
      const totalVolume = monthPrices.reduce((sum, d) => sum + (d.volume ?? 0), 0);

      monthsData.push({ return: monthReturn, avgVol: avgVolatility, totalVol: totalVolume });
    }

    const currentMonth = sorted.slice(-21);
    const cmFirst = currentMonth[0].close ?? 0;
    const cmLast = currentMonth[currentMonth.length - 1].close ?? 0;
    const currentMonthReturn = safeDiv(cmLast - cmFirst, cmFirst) * 100;
    const currentMonthVol = mean(currentMonth.map((d) =>
      safeDiv((d.high ?? 0) - (d.low ?? 0), d.close ?? 1) * 100
    ));
    const currentMonthVolume = currentMonth.reduce((sum, d) => sum + (d.volume ?? 0), 0);

    if (monthsData.length >= 5) {
      price_move_zscore_monthly = zscore(currentMonthReturn, monthsData.map((m) => m.return));
      volatility_zscore_monthly = zscore(currentMonthVol, monthsData.map((m) => m.avgVol));
      if (hasVolume && currentMonthVolume > 0) {
        const monthVolumes = monthsData.map((m) => m.totalVol).filter((v) => v > 0);
        if (monthVolumes.length >= 5) {
          volume_zscore_monthly = zscore(currentMonthVolume, monthVolumes);
        }
      }
    }
  }

  // ── COMPOSITE ─────────────────────────────────────────────────────────────
  const allScores = [
    price_move_zscore_daily,
    volatility_zscore_daily,
    volume_zscore_daily,
    price_move_zscore_weekly,
    volatility_zscore_weekly,
    volume_zscore_weekly,
    price_move_zscore_monthly,
    volatility_zscore_monthly,
    volume_zscore_monthly,
  ].filter((s): s is number => s !== null);

  const composite_anomaly_score = allScores.length > 0
    ? Math.max(...allScores.map(Math.abs))
    : 0;

  return {
    price_move_zscore_daily,
    volatility_zscore_daily,
    volume_zscore_daily,
    price_move_zscore_weekly,
    volatility_zscore_weekly,
    volume_zscore_weekly,
    price_move_zscore_monthly,
    volatility_zscore_monthly,
    volume_zscore_monthly,
    composite_anomaly_score,
  };
}

export function computeTrendScores(prices: DailyPrice[]): TrendScores {
  if (prices.length < 10) {
    return {
      return_1w: null,
      return_1m: null,
      return_3m: null,
      return_zscore_1w: null,
      return_zscore_1m: null,
      return_zscore_3m: null,
      composite_trend_score: 0,
    };
  }

  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const lastClose = sorted[sorted.length - 1].close ?? 0;

  // ── RAW CUMULATIVE RETURNS ──────────────────────────────────────────────
  const return_1w = sorted.length >= 6
    ? safeDiv(lastClose - (sorted[sorted.length - 6].close ?? 0), sorted[sorted.length - 6].close ?? 1) * 100
    : null;

  const return_1m = sorted.length >= 22
    ? safeDiv(lastClose - (sorted[sorted.length - 22].close ?? 0), sorted[sorted.length - 22].close ?? 1) * 100
    : null;

  const return_3m = sorted.length >= 64
    ? safeDiv(lastClose - (sorted[sorted.length - 64].close ?? 0), sorted[sorted.length - 64].close ?? 1) * 100
    : null;

  // ── RETURN Z-SCORES ────────────────────────────────────────────────────
  // For 1W: compute all rolling 5-day returns over last 252 days
  let return_zscore_1w: number | null = null;
  if (return_1w !== null && sorted.length >= 257) {
    const window = sorted.slice(-252);
    const rollingReturns: number[] = [];
    for (let i = 0; i + 5 < window.length; i++) {
      const r = safeDiv(
        (window[i + 5].close ?? 0) - (window[i].close ?? 0),
        window[i].close ?? 1
      ) * 100;
      rollingReturns.push(r);
    }
    if (rollingReturns.length >= 20) {
      return_zscore_1w = zscore(return_1w, rollingReturns);
    }
  }

  let return_zscore_1m: number | null = null;
  if (return_1m !== null && sorted.length >= 273) {
    const window = sorted.slice(-252);
    const rollingReturns: number[] = [];
    for (let i = 0; i + 21 < window.length; i++) {
      const r = safeDiv(
        (window[i + 21].close ?? 0) - (window[i].close ?? 0),
        window[i].close ?? 1
      ) * 100;
      rollingReturns.push(r);
    }
    if (rollingReturns.length >= 10) {
      return_zscore_1m = zscore(return_1m, rollingReturns);
    }
  }

  let return_zscore_3m: number | null = null;
  if (return_3m !== null && sorted.length >= 315) {
    const window = sorted.slice(-252);
    const rollingReturns: number[] = [];
    for (let i = 0; i + 63 < window.length; i++) {
      const r = safeDiv(
        (window[i + 63].close ?? 0) - (window[i].close ?? 0),
        window[i].close ?? 1
      ) * 100;
      rollingReturns.push(r);
    }
    if (rollingReturns.length >= 5) {
      return_zscore_3m = zscore(return_3m, rollingReturns);
    }
  }

  const trendScores = [return_zscore_1w, return_zscore_1m, return_zscore_3m]
    .filter((s): s is number => s !== null);

  const composite_trend_score = trendScores.length > 0
    ? Math.max(...trendScores.map(Math.abs))
    : 0;

  return {
    return_1w,
    return_1m,
    return_3m,
    return_zscore_1w,
    return_zscore_1m,
    return_zscore_3m,
    composite_trend_score,
  };
}

export function classifyScores(
  anomaly: AnomalyScores,
  trend: TrendScores
): ComputedScores {
  const combined_score = Math.max(
    anomaly.composite_anomaly_score,
    trend.composite_trend_score
  );

  let severity: 'normal' | 'elevated' | 'high' | 'extreme';
  if (combined_score >= 2.5) severity = 'extreme';
  else if (combined_score >= 1.5) severity = 'high';
  else if (combined_score >= 1.0) severity = 'elevated';
  else severity = 'normal';

  let signal_type: 'anomaly' | 'trend' | 'both';
  const a = anomaly.composite_anomaly_score;
  const t = trend.composite_trend_score;
  if (a >= 1.5 && t >= 1.5) signal_type = 'both';
  else if (a > t) signal_type = 'anomaly';
  else signal_type = 'trend';

  // Find dominant timescale
  const dimensionScores: { timescale: 'daily' | 'weekly' | 'monthly'; abs: number }[] = [
    { timescale: 'daily', abs: Math.abs(anomaly.price_move_zscore_daily ?? 0) },
    { timescale: 'daily', abs: Math.abs(anomaly.volatility_zscore_daily ?? 0) },
    { timescale: 'daily', abs: Math.abs(anomaly.volume_zscore_daily ?? 0) },
    { timescale: 'weekly', abs: Math.abs(anomaly.price_move_zscore_weekly ?? 0) },
    { timescale: 'weekly', abs: Math.abs(anomaly.volatility_zscore_weekly ?? 0) },
    { timescale: 'weekly', abs: Math.abs(anomaly.volume_zscore_weekly ?? 0) },
    { timescale: 'weekly', abs: Math.abs(trend.return_zscore_1w ?? 0) },
    { timescale: 'monthly', abs: Math.abs(anomaly.price_move_zscore_monthly ?? 0) },
    { timescale: 'monthly', abs: Math.abs(anomaly.volatility_zscore_monthly ?? 0) },
    { timescale: 'monthly', abs: Math.abs(anomaly.volume_zscore_monthly ?? 0) },
    { timescale: 'monthly', abs: Math.abs(trend.return_zscore_1m ?? 0) },
    { timescale: 'monthly', abs: Math.abs(trend.return_zscore_3m ?? 0) },
  ];

  const dominant = dimensionScores.reduce((max, curr) =>
    curr.abs > max.abs ? curr : max
  );

  return {
    ...anomaly,
    ...trend,
    combined_score,
    severity,
    signal_type,
    dominant_timescale: dominant.timescale,
  };
}

export function getNewsWindowDays(dominantTimescale: string): number {
  switch (dominantTimescale) {
    case 'daily': return 7;
    case 'weekly': return 21;
    case 'monthly': return 45;
    default: return 7;
  }
}

export function formatZscore(z: number | null | undefined): string {
  if (z === null || z === undefined) return '—';
  return `${z >= 0 ? '+' : ''}${z.toFixed(1)}σ`;
}

export function getZscoreColor(z: number | null | undefined): string {
  if (z === null || z === undefined) return 'text-gray-500';
  const abs = Math.abs(z);
  if (abs >= 2.5) return 'text-red-400';
  if (abs >= 1.5) return 'text-orange-400';
  if (abs >= 1.0) return 'text-yellow-400';
  return 'text-green-400';
}

export function getZscoreBg(z: number | null | undefined): string {
  if (z === null || z === undefined) return 'bg-gray-800';
  const abs = Math.abs(z);
  if (abs >= 2.5) return 'bg-red-900/40 border border-red-700/50';
  if (abs >= 1.5) return 'bg-orange-900/40 border border-orange-700/50';
  if (abs >= 1.0) return 'bg-yellow-900/40 border border-yellow-700/50';
  return 'bg-green-900/20 border border-green-800/30';
}

export function getSeverityColor(severity: string | null | undefined): string {
  switch (severity) {
    case 'extreme': return 'text-red-400';
    case 'high': return 'text-orange-400';
    case 'elevated': return 'text-yellow-400';
    default: return 'text-green-400';
  }
}

export function getSeverityBorder(severity: string | null | undefined): string {
  switch (severity) {
    case 'extreme': return 'border-red-500/60 shadow-red-900/30 shadow-lg';
    case 'high': return 'border-orange-500/50 shadow-orange-900/20 shadow-md';
    case 'elevated': return 'border-yellow-500/40';
    default: return 'border-gray-700/50';
  }
}
