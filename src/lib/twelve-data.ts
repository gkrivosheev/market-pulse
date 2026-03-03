import PQueue from 'p-queue';

const BASE_URL = 'https://api.twelvedata.com';

// Free tier: 8 requests/minute
const queue = new PQueue({
  concurrency: 1,
  interval: 60000,
  intervalCap: 8,
});

export interface TwelveDataOHLCV {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
}

export interface TwelveDataResponse {
  meta: {
    symbol: string;
    interval: string;
    currency: string;
    type: string;
  };
  values: TwelveDataOHLCV[];
  status: string;
}

export async function fetchTimeSeries(
  symbol: string,
  outputsize: number = 365
): Promise<TwelveDataOHLCV[] | null> {
  return queue.add(async () => {
    try {
      const params = new URLSearchParams({
        symbol,
        interval: '1day',
        outputsize: String(outputsize),
        apikey: process.env.TWELVE_DATA_API_KEY!,
      });

      const response = await fetch(`${BASE_URL}/time_series?${params}`, {
        next: { revalidate: 0 },
      });

      if (!response.ok) {
        console.error(`Twelve Data error for ${symbol}: HTTP ${response.status}`);
        return null;
      }

      const data: TwelveDataResponse = await response.json();

      if (data.status === 'error') {
        console.error(`Twelve Data API error for ${symbol}:`, data);
        return null;
      }

      return data.values ?? null;
    } catch (error) {
      console.error(`Failed to fetch Twelve Data for ${symbol}:`, error);
      return null;
    }
  });
}

export async function fetchLatestPrice(symbol: string): Promise<{
  close: number;
  change: number;
  change_percent: number;
} | null> {
  return queue.add(async () => {
    try {
      const params = new URLSearchParams({
        symbol,
        apikey: process.env.TWELVE_DATA_API_KEY!,
      });

      const response = await fetch(`${BASE_URL}/price?${params}`, {
        next: { revalidate: 0 },
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.price ? { close: parseFloat(data.price), change: 0, change_percent: 0 } : null;
    } catch {
      return null;
    }
  });
}
