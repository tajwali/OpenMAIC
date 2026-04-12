import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

/**
 * PATCH /api/user/classrooms/:id
 * Incrementally updates the scenes column for an existing classroom.
 * Used by scene generators to persist scenes as they complete, so a
 * tab-close or server restart mid-generation doesn't lose progress.
 * Always returns success — if the row doesn't exist yet (init POST still
 * in-flight) the UPDATE silently affects 0 rows; the final POST creates it.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { scenes } = await req.json() as { scenes: unknown[] };

    const admin = getSupabaseAdmin();
    // Silent UPDATE — no error surfaced if row doesn't exist yet
    await admin
      .from('classrooms')
      .update({ scenes })
      .eq('id', id)
      .eq('user_id', session.user.id);

    return NextResponse.json({ success: true });
  } catch {
    // Always succeed from the caller's perspective — this is fire-and-forget
    return NextResponse.json({ success: true });
  }
}
