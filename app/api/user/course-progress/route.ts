import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = JSON.parse(await request.text()) as { classroom_id?: string }
    const { classroom_id } = body

    if (!classroom_id) {
      return NextResponse.json({ error: 'Missing classroom_id' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const { error } = await admin.from('course_progress').upsert(
      {
        user_id: user.id,
        classroom_id,
        last_accessed: new Date().toISOString(),
      },
      { onConflict: 'user_id,classroom_id' },
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
