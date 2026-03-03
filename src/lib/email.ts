import { Resend } from 'resend';
import { Asset, AnomalyScore, AIAnalysis } from '@/types';

const resend = new Resend(process.env.RESEND_API_KEY);

interface DigestParams {
  to: string;
  displayName: string;
  date: string;
  assets: Asset[];
  scores: AnomalyScore[];
  analyses: AIAnalysis[];
}

function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function getSeverityColor(severity: string | null): string {
  switch (severity) {
    case 'extreme': return '#ef4444';
    case 'high': return '#f97316';
    case 'elevated': return '#eab308';
    default: return '#22c55e';
  }
}

export async function sendDailyDigest({
  to,
  displayName,
  date,
  assets,
  scores,
  analyses,
}: DigestParams) {
  const scoreMap = new Map(scores.map((s) => [s.asset_id, s]));
  const analysisMap = new Map(analyses.map((a) => [a.asset_id, a]));

  const counts = {
    total: assets.length,
    extreme: scores.filter((s) => s.severity === 'extreme').length,
    high: scores.filter((s) => s.severity === 'high').length,
    elevated: scores.filter((s) => s.severity === 'elevated').length,
    normal: scores.filter((s) => s.severity === 'normal').length,
  };

  // Sort assets by combined score
  const sortedAssets = [...assets].sort((a, b) => {
    const aScore = scoreMap.get(a.id)?.combined_score ?? 0;
    const bScore = scoreMap.get(b.id)?.combined_score ?? 0;
    return bScore - aScore;
  });

  const notable = sortedAssets.filter((a) => {
    const s = scoreMap.get(a.id);
    return s && (s.severity === 'extreme' || s.severity === 'high');
  });

  const elevated = sortedAssets.filter((a) => {
    const s = scoreMap.get(a.id);
    return s?.severity === 'elevated';
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-app.vercel.app';
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Market Pulse Daily Digest</title>
</head>
<body style="margin:0;padding:0;background:#0a0e17;font-family:system-ui,-apple-system,sans-serif;color:#e2e8f0;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <!-- Header -->
    <div style="background:#0f1623;border:1px solid #1e2d42;border-radius:12px;padding:24px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="width:32px;height:32px;background:#2563eb;border-radius:6px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-weight:bold;font-size:16px;">M</span>
        </div>
        <span style="font-size:20px;font-weight:600;color:white;">Market Pulse</span>
      </div>
      <p style="margin:0;color:#64748b;font-size:14px;">Your Daily Market Intelligence</p>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">${formattedDate}</p>
    </div>

    <!-- Summary -->
    <div style="background:#0f1623;border:1px solid #1e2d42;border-radius:12px;padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 12px;color:#94a3b8;font-size:13px;">Tracking <strong style="color:white;font-family:monospace;">${counts.total}</strong> assets</p>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        ${counts.extreme > 0 ? `<span style="color:#ef4444;font-weight:600;font-family:monospace;font-size:13px;">${counts.extreme} extreme</span>` : ''}
        ${counts.high > 0 ? `<span style="color:#f97316;font-family:monospace;font-size:13px;">${counts.high} high</span>` : ''}
        ${counts.elevated > 0 ? `<span style="color:#eab308;font-family:monospace;font-size:13px;">${counts.elevated} elevated</span>` : ''}
        <span style="color:#22c55e;font-family:monospace;font-size:13px;">${counts.normal} normal</span>
      </div>
    </div>

    ${notable.length > 0 ? `
    <!-- Notable assets -->
    <h2 style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin:20px 0 10px;">Requires Attention</h2>
    ${notable.map((asset) => {
      const score = scoreMap.get(asset.id);
      const analysis = analysisMap.get(asset.id);
      const color = getSeverityColor(score?.severity ?? null);
      return `
      <div style="background:#0f1623;border:1px solid ${color}44;border-radius:12px;padding:20px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="font-weight:700;font-family:monospace;color:white;font-size:16px;">${asset.id}</span>
              <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:#1e2d42;color:#94a3b8;text-transform:capitalize;">${asset.asset_type}</span>
              <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:${color}22;color:${color};font-weight:600;text-transform:uppercase;">${score?.severity}</span>
            </div>
            <p style="margin:0;color:#64748b;font-size:13px;">${asset.name}</p>
          </div>
          <div style="text-align:right;">
            <p style="margin:0;font-family:monospace;font-size:13px;color:#94a3b8;">Score: <span style="color:${color};font-weight:600;">${score?.combined_score?.toFixed(2) ?? '—'}σ</span></p>
            <p style="margin:2px 0 0;font-family:monospace;font-size:12px;color:#64748b;">
              1M: ${formatPercent(score?.return_1m)} · 3M: ${formatPercent(score?.return_3m)}
            </p>
          </div>
        </div>
        ${analysis ? `
        <p style="margin:0 0 12px;color:#94a3b8;font-size:13px;line-height:1.6;border-left:2px solid ${color}44;padding-left:12px;">
          ${analysis.analysis.split('\n\n')[0].substring(0, 200)}${analysis.analysis.length > 200 ? '...' : ''}
        </p>
        ` : ''}
        <a href="${appUrl}/asset/${encodeURIComponent(asset.id)}" style="display:inline-block;background:#1e3a5f;color:#60a5fa;text-decoration:none;font-size:12px;padding:6px 12px;border-radius:6px;border:1px solid #2563eb44;">View Detail →</a>
      </div>
      `;
    }).join('')}
    ` : ''}

    ${elevated.length > 0 ? `
    <!-- Elevated -->
    <h2 style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin:20px 0 10px;">Elevated Activity</h2>
    <div style="background:#0f1623;border:1px solid #1e2d42;border-radius:12px;padding:16px;">
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${elevated.map((asset) => {
          const score = scoreMap.get(asset.id);
          return `<span style="font-family:monospace;font-size:13px;background:#1a2535;padding:4px 10px;border-radius:6px;border:1px solid #1e2d42;color:#eab308;">${asset.id} <span style="color:#64748b;">${score?.combined_score?.toFixed(1) ?? '?'}σ</span></span>`;
        }).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Footer -->
    <div style="text-align:center;padding:20px 0;border-top:1px solid #1e2d42;margin-top:24px;">
      <a href="${appUrl}/dashboard" style="color:#3b82f6;text-decoration:none;font-size:13px;margin-right:16px;">Open Dashboard</a>
      <a href="${appUrl}/settings" style="color:#64748b;text-decoration:none;font-size:13px;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`;

  const extreme = counts.extreme;
  const high = counts.high;
  const summaryParts = [];
  if (extreme > 0) summaryParts.push(`${extreme} extreme`);
  if (high > 0) summaryParts.push(`${high} high`);

  const subject = summaryParts.length > 0
    ? `Market Pulse — ${formattedDate}: ${summaryParts.join(', ')} ${summaryParts.length === 1 ? 'anomaly' : 'anomalies'} in your watchlist`
    : `Market Pulse — ${formattedDate}: All clear in your watchlist`;

  await resend.emails.send({
    from: 'Market Pulse <onboarding@resend.dev>',
    to,
    subject,
    html,
  });
}
