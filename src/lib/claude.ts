import Anthropic from '@anthropic-ai/sdk';
import { Asset, AnomalyScore, NewsArticle, DailyPrice } from '@/types';
import { getNewsWindowDays } from './anomaly';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface AnalysisResult {
  analysis: string;
  key_drivers: string[];
  outlook: 'bullish_signal' | 'bearish_signal' | 'neutral' | 'uncertain';
}

function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'N/A';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function formatZscore(z: number | null | undefined): string {
  if (z === null || z === undefined) return 'N/A';
  return `${z >= 0 ? '+' : ''}${z.toFixed(2)}σ`;
}

export async function generateAnalysis(
  asset: Asset,
  scores: AnomalyScore,
  priceHistory: DailyPrice[],
  newsArticles: NewsArticle[]
): Promise<AnalysisResult | null> {
  const dominantTimescale = scores.dominant_timescale ?? 'daily';
  const signalType = scores.signal_type ?? 'anomaly';
  const newsWindowDays = getNewsWindowDays(dominantTimescale);

  const sorted = [...priceHistory].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];

  const dailyChange = (latest && prev && latest.close && prev.close)
    ? ((latest.close - prev.close) / prev.close) * 100
    : null;

  const signalContext =
    signalType === 'trend'
      ? `This asset has been flagged primarily for a SIGNIFICANT CUMULATIVE TREND, not a single-day spike. The daily moves may look moderate individually, but they compound to a noteworthy return. Focus your analysis on what has been driving this sustained move over the ${dominantTimescale} timescale.`
      : signalType === 'anomaly'
      ? `This asset has been flagged for ANOMALOUS BEHAVIOR — recent activity is statistically unusual compared to its own recent history. Focus on what changed to cause this deviation.`
      : `This asset shows BOTH anomalous behavior AND a significant cumulative trend. Analyze both the acute unusual activity and the broader trend.`;

  const newsContext = newsArticles
    .sort((a, b) => (a.published_at ?? '').localeCompare(b.published_at ?? ''))
    .map((n) => {
      const date = n.published_at ? new Date(n.published_at).toLocaleDateString() : 'Unknown date';
      return `- [${date}] [${n.source ?? 'Unknown'}] ${n.headline}`;
    })
    .join('\n');

  const prompt = `You are a senior financial market analyst providing a briefing to a portfolio manager who hasn't been watching this asset closely. Your job is to explain what's happening and why, connecting market data to news.

## Asset
- Name: ${asset.name} (${asset.id})
- Type: ${asset.asset_type}
- Sector: ${asset.sector ?? 'N/A'}

## Signal Type
${signalContext}

## Current Data
- Today's close: ${latest?.close ? `$${latest.close.toFixed(2)}` : 'N/A'}
- Daily change: ${formatPercent(dailyChange)}
- 1-week return: ${formatPercent(scores.return_1w)}
- 1-month return: ${formatPercent(scores.return_1m)}
- 3-month return: ${formatPercent(scores.return_3m)}

## Anomaly Scores (z-scores — standard deviations from normal)
Daily (vs 30-day window):
  Price: ${formatZscore(scores.price_move_zscore_daily)} | Volatility: ${formatZscore(scores.volatility_zscore_daily)} | Volume: ${formatZscore(scores.volume_zscore_daily)}
Weekly (vs 13-week window):
  Price: ${formatZscore(scores.price_move_zscore_weekly)} | Volatility: ${formatZscore(scores.volatility_zscore_weekly)} | Volume: ${formatZscore(scores.volume_zscore_weekly)}
Monthly (vs 12-month window):
  Price: ${formatZscore(scores.price_move_zscore_monthly)} | Volatility: ${formatZscore(scores.volatility_zscore_monthly)} | Volume: ${formatZscore(scores.volume_zscore_monthly)}

## Trend Significance (cumulative return z-scores)
1-week return: ${formatPercent(scores.return_1w)} (${formatZscore(scores.return_zscore_1w)} vs historical)
1-month return: ${formatPercent(scores.return_1m)} (${formatZscore(scores.return_zscore_1m)} vs historical)
3-month return: ${formatPercent(scores.return_3m)} (${formatZscore(scores.return_zscore_3m)} vs historical)

## Dominant Timescale: ${dominantTimescale}
## Combined Score: ${scores.combined_score?.toFixed(2) ?? 'N/A'} (${scores.severity ?? 'unknown'})

## News from the last ${newsWindowDays} days (chronological, oldest first)
${newsContext || 'No news articles available for this period.'}

## Instructions
1. Provide a concise analysis (2-4 paragraphs) explaining the market behavior.
2. CONNECT the data with the news — explain the causal chain. News often PRECEDES price moves by days, so look for earlier news that could explain current price action.
3. For TREND signals: narrate the story arc. What kicked off the trend? What sustained it? Is it accelerating or decelerating?
4. For ANOMALY signals: what changed? Is this a one-off event or the start of something?
5. Comment on which timescale is most noteworthy and what that implies.
6. If the news doesn't fully explain the movement, say so honestly — mention possible unlisted factors (sector rotation, macro shifts, technical levels) without fabricating.
7. Keep it practical and conversational — this is a briefing, not a research paper.

Respond in JSON format:
{
  "analysis": "Your 2-4 paragraph analysis here",
  "key_drivers": ["Driver 1", "Driver 2", "Driver 3"],
  "outlook": "bullish_signal" | "bearish_signal" | "neutral" | "uncertain"
}`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') return null;

    // Extract JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]) as AnalysisResult;

    // Validate
    if (!result.analysis || !Array.isArray(result.key_drivers)) return null;
    if (!['bullish_signal', 'bearish_signal', 'neutral', 'uncertain'].includes(result.outlook)) {
      result.outlook = 'uncertain';
    }

    return result;
  } catch (error) {
    console.error('Claude API error:', error);
    return null;
  }
}
