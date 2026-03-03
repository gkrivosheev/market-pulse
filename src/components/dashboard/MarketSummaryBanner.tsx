'use client';

import { useState } from 'react';
import { MarketSummary } from '@/types';

const REGIME_CONFIG = {
  'risk-on':  { label: 'Risk-On',  color: 'text-green-400',  bg: 'bg-green-900/20',  border: 'border-green-700/40' },
  'risk-off': { label: 'Risk-Off', color: 'text-red-400',    bg: 'bg-red-900/20',    border: 'border-red-700/40'   },
  'mixed':    { label: 'Mixed',    color: 'text-yellow-400', bg: 'bg-yellow-900/20', border: 'border-yellow-700/40' },
  'normal':   { label: 'Normal',   color: 'text-slate-400',  bg: 'bg-gray-800/30',   border: 'border-gray-700/40'  },
} as const;

// Show this many paragraphs before the "Show more" fold
const PREVIEW_PARAGRAPHS = 2;

interface Props {
  summary: MarketSummary;
}

export default function MarketSummaryBanner({ summary }: Props) {
  const [expanded, setExpanded] = useState(false);

  const regime = REGIME_CONFIG[summary.market_regime] ?? REGIME_CONFIG['mixed'];
  const paragraphs = summary.summary
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const preview = paragraphs.slice(0, PREVIEW_PARAGRAPHS);
  const rest = paragraphs.slice(PREVIEW_PARAGRAPHS);
  const hasMore = rest.length > 0;

  return (
    <div className={`rounded-xl border p-5 mb-6 ${regime.bg} ${regime.border}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            AI Executive Summary
          </span>
          <span className="text-slate-600 text-xs">·</span>
          <span className="text-slate-500 text-xs">
            {summary.flagged_count} signal{summary.flagged_count !== 1 ? 's' : ''} today
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${regime.color} ${regime.border} ${regime.bg}`}>
            {regime.label}
          </span>
        </div>
      </div>

      {/* Summary text */}
      <div className="space-y-2.5">
        {preview.map((para, i) => (
          <p key={i} className="text-slate-300 text-sm leading-relaxed">{para}</p>
        ))}
        {expanded && rest.map((para, i) => (
          <p key={i + PREVIEW_PARAGRAPHS} className="text-slate-300 text-sm leading-relaxed">{para}</p>
        ))}
      </div>

      {/* Expand / collapse */}
      {hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
        >
          {expanded ? 'Show less' : `Read more (${rest.length} more paragraph${rest.length !== 1 ? 's' : ''})`}
        </button>
      )}

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-slate-600 text-xs">
          Web-search powered · {summary.model_used} · {new Date(summary.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
        {summary.sources.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {summary.sources.slice(0, 5).map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-500 hover:text-blue-400 transition-colors truncate max-w-[180px]"
                title={s.title}
              >
                {s.title}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
