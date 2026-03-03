'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Profile } from '@/types';

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyDigest, setNotifyDigest] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/');
        return;
      }
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setProfile(data as Profile);
            setDisplayName(data.display_name ?? '');
            setNotifyEmail(data.notification_email ?? true);
            setNotifyDigest(data.notification_daily_digest ?? true);
          }
        });
    });
  }, []);

  async function handleSave() {
    setLoading(true);
    setSaved(false);

    const response = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: displayName,
        notification_email: notifyEmail,
        notification_daily_digest: notifyDigest,
      }),
    });

    if (response.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }

    setLoading(false);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  async function handleDeleteAccount() {
    if (!window.confirm('Are you sure? This will permanently delete your account and watchlist.')) return;
    // This requires service role - show message to contact support
    alert('Please contact support to delete your account.');
  }

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      {/* Header */}
      <header className="border-b border-gray-800/50 bg-[#0a0e17]/95 sticky top-0 z-30 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Dashboard</span>
          </Link>
          <div className="flex items-center gap-2 ml-2">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">M</span>
            </div>
            <span className="text-sm font-medium text-white">Settings</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Notifications */}
        <div className="bg-[#0f1623] border border-gray-700/50 rounded-xl p-6">
          <h2 className="text-white font-semibold text-lg mb-4">Notifications</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-200 text-sm font-medium">Daily Digest Email</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  Receive a daily summary after market close with notable assets
                </p>
              </div>
              <button
                onClick={() => setNotifyDigest(!notifyDigest)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  notifyDigest ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    notifyDigest ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-200 text-sm font-medium">Urgent Alerts</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  Get notified immediately for extreme anomalies (≥ 2.5σ)
                </p>
              </div>
              <button
                onClick={() => setNotifyEmail(!notifyEmail)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  notifyEmail ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    notifyEmail ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {profile?.email && (
              <div className="pt-3 border-t border-gray-700/50">
                <p className="text-slate-500 text-xs">Notifications sent to</p>
                <p className="text-slate-300 text-sm font-mono mt-0.5">{profile.email}</p>
              </div>
            )}
          </div>
        </div>

        {/* Account */}
        <div className="bg-[#0f1623] border border-gray-700/50 rounded-xl p-6">
          <h2 className="text-white font-semibold text-lg mb-4">Account</h2>

          <div className="space-y-4">
            <div>
              <label className="text-slate-400 text-sm block mb-1.5">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="text-slate-400 text-sm block mb-1.5">Email</label>
              <p className="text-slate-300 text-sm font-mono bg-gray-800/40 border border-gray-700/30 rounded-lg px-3 py-2">
                {profile?.email ?? 'Loading...'}
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={loading}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                saved
                  ? 'bg-green-700/40 text-green-400 border border-green-700/40'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              } ${loading ? 'opacity-50' : ''}`}
            >
              {loading ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-[#0f1623] border border-gray-700/50 rounded-xl p-6">
          <h2 className="text-white font-semibold text-lg mb-4">Account Actions</h2>

          <div className="space-y-3">
            <button
              onClick={handleSignOut}
              className="w-full py-2.5 bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50 text-slate-300 rounded-lg text-sm font-medium transition-colors"
            >
              Sign Out
            </button>

            <button
              onClick={handleDeleteAccount}
              className="w-full py-2.5 bg-red-900/20 hover:bg-red-900/30 border border-red-700/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
            >
              Delete Account
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
