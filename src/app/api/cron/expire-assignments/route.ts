import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

// GET /api/cron/expire-assignments
// This endpoint should be called by a cron job (e.g., Vercel cron) every 30 minutes
// to expire old assignments and reassign posts to new reviewers.
export async function GET(request: NextRequest) {
  // Verify cron secret if configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = getServiceClient();

  try {
    // Call the DB function
    const { data, error } = await supabase.rpc('expire_and_reassign_assignments');

    if (error) {
      console.error('Expire/reassign error:', error);
      return NextResponse.json(
        { error: 'Failed to process assignments', details: error.message },
        { status: 500 }
      );
    }

    const result = data?.[0] || { expired_count: 0, reassigned_count: 0 };

    return NextResponse.json({
      success: true,
      expired_count: result.expired_count,
      reassigned_count: result.reassigned_count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
