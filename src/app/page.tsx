'use client';

import { createClient } from '@/lib/supabase/client';

export default function LandingPage() {
  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="min-h-screen bg-[#0a0e17] flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-800/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="font-semibold text-white text-lg tracking-tight">Market Pulse</span>
        </div>
        <button
          onClick={signInWithGoogle}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition-colors"
        >
          Sign In
        </button>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/30 border border-blue-700/40 text-blue-400 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
            AI-Powered Market Intelligence
          </div>

          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
            Know what&apos;s noteworthy
            <br />
            <span className="text-blue-400">in your markets</span>
          </h1>

          <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Market Pulse tracks your watchlist and flags unusual activity — anomalies, significant
            trends, and sustained moves — with AI-generated explanations so you always know
            what&apos;s happening and why.
          </p>

          <button
            onClick={signInWithGoogle}
            className="inline-flex items-center gap-3 px-6 py-3 bg-white hover:bg-gray-100 text-gray-900 rounded-lg font-medium text-base transition-colors shadow-lg"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Feature grid */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto text-left">
          {[
            { icon: '⚡', color: 'red', title: 'Anomaly Detection', desc: 'Z-score analysis across daily, weekly, and monthly timescales flags statistically unusual price moves, volatility, and volume.' },
            { icon: '📈', color: 'orange', title: 'Trend Intelligence', desc: 'Catches slow drifts that compound into significant returns — assets moving 1% daily for 3 weeks are spotted and explained.' },
            { icon: '🤖', color: 'blue', title: 'AI-Powered Analysis', desc: "Claude connects market data with timescale-matched news to explain what's driving unusual behavior — causal, not just correlational." },
          ].map(({ icon, color, title, desc }) => (
            <div key={title} className="bg-[#0f1623] border border-gray-700/50 rounded-xl p-6">
              <div className={`w-10 h-10 rounded-lg bg-${color}-900/30 border border-${color}-700/30 flex items-center justify-center mb-4`}>
                <span className="text-lg">{icon}</span>
              </div>
              <h3 className="text-white font-semibold mb-2">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Preview card */}
        <div className="mt-16 max-w-2xl mx-auto w-full">
          <p className="text-slate-500 text-sm mb-4 text-center">Sample asset card</p>
          <div className="bg-[#0f1623] border border-red-500/50 rounded-xl p-5 shadow-lg shadow-red-900/20 text-left extreme-glow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-bold text-lg font-mono">NVDA</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400 border border-blue-700/30">Stock</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-700/30 font-semibold">EXTREME</span>
                </div>
                <p className="text-slate-400 text-sm">NVIDIA Corp.</p>
              </div>
              <div className="text-right">
                <p className="text-white font-mono font-semibold">$142.56</p>
                <p className="text-green-400 text-sm font-mono">▲ +4.32%</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3 text-xs font-mono">
              <div className="bg-gray-800/50 rounded px-2 py-1 text-center">
                <span className="text-slate-500 block">1W</span>
                <p className="text-green-400">+8.1%</p>
              </div>
              <div className="bg-orange-900/20 border border-orange-700/30 rounded px-2 py-1 text-center">
                <span className="text-slate-500 block">1M</span>
                <p className="text-orange-400">+22.4%</p>
              </div>
              <div className="bg-red-900/20 border border-red-700/30 rounded px-2 py-1 text-center">
                <span className="text-slate-500 block">3M</span>
                <p className="text-red-400">+41.7%</p>
              </div>
            </div>
            <div className="text-xs text-slate-400 italic border-t border-gray-700/50 pt-3">
              🤖 &ldquo;Surge driven by new AI chip announcement; 3-month rally reflects broader AI infrastructure spending cycle...&rdquo;
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-800/50 px-6 py-6 text-center text-slate-500 text-sm">
        Market Pulse — Daily intelligence for your watchlist
      </footer>
    </div>
  );
}
