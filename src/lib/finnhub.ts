const BASE_URL = 'https://finnhub.io/api/v1';

export interface FinnhubNewsArticle {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function fetchCompanyNews(
  symbol: string,
  fromDate: Date,
  toDate: Date
): Promise<FinnhubNewsArticle[]> {
  try {
    const params = new URLSearchParams({
      symbol,
      from: formatDate(fromDate),
      to: formatDate(toDate),
      token: process.env.FINNHUB_API_KEY!,
    });

    const response = await fetch(`${BASE_URL}/company-news?${params}`, {
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      console.error(`Finnhub company news error for ${symbol}: HTTP ${response.status}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Failed to fetch Finnhub news for ${symbol}:`, error);
    return [];
  }
}

export async function fetchCryptoNews(
  keywords: string[],
  fromDate: Date,
  toDate: Date
): Promise<FinnhubNewsArticle[]> {
  try {
    const params = new URLSearchParams({
      category: 'crypto',
      minId: '0',
      token: process.env.FINNHUB_API_KEY!,
    });

    const response = await fetch(`${BASE_URL}/news?${params}`, {
      next: { revalidate: 0 },
    });

    if (!response.ok) return [];

    const data: FinnhubNewsArticle[] = await response.json();
    if (!Array.isArray(data)) return [];

    // Filter by keyword and date range
    const fromTimestamp = fromDate.getTime() / 1000;
    const toTimestamp = toDate.getTime() / 1000;

    return data.filter((article) => {
      if (article.datetime < fromTimestamp || article.datetime > toTimestamp) return false;
      const lowerHeadline = (article.headline + ' ' + article.summary).toLowerCase();
      return keywords.some((kw) => lowerHeadline.includes(kw.toLowerCase()));
    });
  } catch (error) {
    console.error('Failed to fetch Finnhub crypto news:', error);
    return [];
  }
}

export async function fetchGeneralNews(
  keywords: string[],
  fromDate: Date,
  toDate: Date
): Promise<FinnhubNewsArticle[]> {
  try {
    const params = new URLSearchParams({
      category: 'general',
      token: process.env.FINNHUB_API_KEY!,
    });

    const response = await fetch(`${BASE_URL}/news?${params}`, {
      next: { revalidate: 0 },
    });

    if (!response.ok) return [];

    const data: FinnhubNewsArticle[] = await response.json();
    if (!Array.isArray(data)) return [];

    const fromTimestamp = fromDate.getTime() / 1000;
    const toTimestamp = toDate.getTime() / 1000;

    return data.filter((article) => {
      if (article.datetime < fromTimestamp || article.datetime > toTimestamp) return false;
      const lowerText = (article.headline + ' ' + article.summary).toLowerCase();
      return keywords.some((kw) => lowerText.includes(kw.toLowerCase()));
    });
  } catch (error) {
    console.error('Failed to fetch Finnhub general news:', error);
    return [];
  }
}

export function getKeywordsForAsset(assetId: string, assetName: string, assetType: string): string[] {
  if (assetType === 'stock') return [assetId, assetName];
  if (assetType === 'crypto') {
    const base = assetId.split('/')[0];
    return [base, assetName];
  }
  if (assetType === 'metal') {
    const metalMap: Record<string, string[]> = {
      'XAU/USD': ['gold', 'XAU'],
      'XAG/USD': ['silver', 'XAG'],
      'XPT/USD': ['platinum', 'XPT'],
    };
    return metalMap[assetId] ?? [assetName];
  }
  if (assetType === 'fx') {
    const [base, quote] = assetId.split('/');
    return [base, quote, assetId];
  }
  return [assetId, assetName];
}
