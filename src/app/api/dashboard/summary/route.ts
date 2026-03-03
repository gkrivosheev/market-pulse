import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().split('T')[0];

  const { data: watchlist } = await supabase
    .from('watchlist')
    .select('asset_id')
    .eq('user_id', user.id);

  const assetIds = watchlist?.map((w) => w.asset_id) ?? [];

  const { data: scores } = await supabase
    .from('anomaly_scores')
    .select('severity, computed_at')
    .in('asset_id', assetIds)
    .eq('date', today);

  const counts = {
    total: assetIds.length,
    extreme: scores?.filter((s) => s.severity === 'extreme').length ?? 0,
    high: scores?.filter((s) => s.severity === 'high').length ?? 0,
    elevated: scores?.filter((s) => s.severity === 'elevated').length ?? 0,
    normal: scores?.filter((s) => s.severity === 'normal').length ?? 0,
    lastUpdated: scores?.[0]?.computed_at ?? null,
  };

  return NextResponse.json(counts);
}
