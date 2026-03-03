'use client';

import { useState } from 'react';
import { NewsArticle } from '@/types';

const TOP_N = 3;

interface Props {
  news: NewsArticle[];
  keyDrivers: string[];
}

function groupNews(articles: NewsArticle[]): Record<string, NewsArticle[]> {
  const now = Date.now();
  const groups: Record<string, NewsArticle[]> = {
    Today: [],
    'This Week': [],
    'This Month': [],
    Older: [],
  };

  articles.forEach((article) => {
    if (!article.published_at) {
      groups['Older'].push(article);
      return;
    }

    const age = now - new Date(article.published_at).getTime();
    const days = age / (1000 * 60 * 60 * 24);

    if (days < 1) groups['Today'].push(article);
    else if (days < 7) groups['This Week'].push(article);
    else if (days < 30) groups['This Month'].push(article);
    else groups['Older'].push(article);
  });

  return groups;
}

function scoreArticle(article: NewsArticle, keyDrivers: string[]): number {
  if (keyDrivers.length === 0) return 0;
  const text = `${article.headline} ${article.summary ?? ''}`.toLowerCase();
  return keyDrivers.filter((d) => text.includes(d.toLowerCase())).length;
}

function rankArticles(articles: NewsArticle[], keyDrivers: string[]): NewsArticle[] {
  return [...articles].sort((a, b) => {
    const scoreDiff = scoreArticle(b, keyDrivers) - scoreArticle(a, keyDrivers);
    if (scoreDiff !== 0) return scoreDiff;
    // fallback: recency (already sorted desc from server, preserve that)
    const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
    const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
    return tb - ta;
  });
}

function isHighlighted(article: NewsArticle, keyDrivers: string[]): boolean {
  return scoreArticle(article, keyDrivers) > 0;
}

function SentimentBadge({ sentiment }: { sentiment: number | null | undefined }) {
  if (sentiment === null || sentiment === undefined) return null;

  const label = sentiment > 0.1 ? 'Positive' : sentiment < -0.1 ? 'Negative' : 'Neutral';
  const color =
    sentiment > 0.1 ? 'text-green-400 bg-green-900/20 border-green-700/30' :
    sentiment < -0.1 ? 'text-red-400 bg-red-900/20 border-red-700/30' :
    'text-slate-400 bg-gray-800/40 border-gray-700/30';

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border ${color}`}>{label}</span>
  );
}

function ArticleCard({ article, keyDrivers }: { article: NewsArticle; keyDrivers: string[] }) {
  const highlighted = isHighlighted(article, keyDrivers);
  return (
    <div
      className={`rounded-lg p-3 border transition-colors ${
        highlighted
          ? 'bg-blue-900/20 border-blue-700/40'
          : 'bg-gray-800/30 border-gray-700/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {highlighted && (
              <span className="text-xs text-blue-400 flex-shrink-0">🔗</span>
            )}
            {article.url ? (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-200 text-sm hover:text-blue-400 transition-colors leading-snug"
              >
                {article.headline}
              </a>
            ) : (
              <p className="text-slate-200 text-sm leading-snug">{article.headline}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {article.source && (
              <span className="text-slate-500 text-xs">{article.source}</span>
            )}
            {article.published_at && (
              <span className="text-slate-600 text-xs">
                {new Date(article.published_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
            <SentimentBadge sentiment={article.sentiment} />
          </div>
        </div>
      </div>
    </div>
  );
}

function NewsGroup({
  period,
  articles,
  keyDrivers,
}: {
  period: string;
  articles: NewsArticle[];
  keyDrivers: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const ranked = rankArticles(articles, keyDrivers);
  const top = ranked.slice(0, TOP_N);
  const rest = ranked.slice(TOP_N);

  return (
    <div>
      <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">
        {period} ({articles.length})
      </h3>
      <div className="space-y-2">
        {top.map((article) => (
          <ArticleCard key={article.id} article={article} keyDrivers={keyDrivers} />
        ))}

        {rest.length > 0 && (
          <>
            {expanded && rest.map((article) => (
              <ArticleCard key={article.id} article={article} keyDrivers={keyDrivers} />
            ))}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-1.5 border border-gray-700/40 rounded-lg bg-gray-800/20 hover:bg-gray-800/40"
            >
              {expanded ? 'Show fewer' : `Show ${rest.length} more article${rest.length === 1 ? '' : 's'}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function NewsSection({ news, keyDrivers }: Props) {
  const grouped = groupNews(news);
  const hasNews = news.length > 0;

  if (!hasNews) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        No news articles in the archive for this asset.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([period, articles]) => {
        if (articles.length === 0) return null;
        return (
          <NewsGroup
            key={period}
            period={period}
            articles={articles}
            keyDrivers={keyDrivers}
          />
        );
      })}
    </div>
  );
}
