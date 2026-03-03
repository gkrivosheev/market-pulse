'use client';

import Link from 'next/link';
import { Profile } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Props {
  profile: Profile | null;
  lastUpdated: string | null;
  onAddAssets: () => void;
}

export default function Topbar({ profile, lastUpdated, onAddAssets }: Props) {
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/');
  }

  const formattedDate = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <header className="border-b border-gray-800/50 bg-[#0a0e17]/95 sticky top-0 z-30 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-4">
          <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs">M</span>
          </div>
          <span className="font-semibold text-white tracking-tight hidden sm:block">Market Pulse</span>
        </div>

        {/* Last updated */}
        {formattedDate && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            <span>Data as of {formattedDate}</span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Add button */}
        <button
          onClick={onAddAssets}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition-colors"
        >
          <span>+</span>
          <span className="hidden sm:inline">Add Assets</span>
        </button>

        {/* Settings + avatar */}
        <Link
          href="/settings"
          className="text-slate-400 hover:text-white transition-colors text-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>

        <button
          onClick={signOut}
          className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-sm font-medium text-white transition-colors"
          title={`${profile?.display_name ?? 'User'} — Sign out`}
        >
          {(profile?.display_name ?? 'U')[0].toUpperCase()}
        </button>
      </div>
    </header>
  );
}
