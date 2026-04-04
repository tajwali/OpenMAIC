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

    const body = JSON.parse(await request.text()) as {
      classroom_id?: string
      scene_id?: string
      score?: number
      total?: number
      answers?: unknown
    }

    const { classroom_id, scene_id, score, total, answers } = body

    if (!classroom_id || !scene_id || score == null || total == null) {
      return NextResponse.json(
        { error: 'Missing required fields: classroom_id, scene_id, score, total' },
        { status: 400 },
      )
    }

    const percentage = total > 0 ? Math.round((score / total) * 10000) / 100 : 0

    const admin = getSupabaseAdmin()
    const { data, error } = await admin.from('quiz_results').insert({
      user_id: user.id,
      classroom_id,
      scene_id,
      score,
      total,
      percentage,
      answers: answers ?? [],
    }).select('id').single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data.id }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('quiz_results')
      .select('id, classroom_id, scene_id, score, total, percentage, taken_at')
      .eq('user_id', user.id)
      .order('taken_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
