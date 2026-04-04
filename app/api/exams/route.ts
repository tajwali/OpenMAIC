import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('exams')
      .select('id, title, time_limit_minutes, difficulty, created_at, source_classroom_ids, questions')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const examIds = (data ?? []).map(e => e.id as string)
    const { data: results } = examIds.length
      ? await admin
          .from('exam_results')
          .select('exam_id')
          .in('exam_id', examIds)
          .eq('student_id', user.id)
      : { data: [] }

    const attemptedSet = new Set((results ?? []).map(r => r.exam_id as string))

    return NextResponse.json(
      (data ?? []).map(e => ({
        id: e.id,
        title: e.title,
        time_limit_minutes: e.time_limit_minutes,
        difficulty: e.difficulty,
        created_at: e.created_at,
        source_classroom_ids: e.source_classroom_ids,
        question_count: Array.isArray(e.questions) ? e.questions.length : 0,
        attempted: attemptedSet.has(e.id as string),
      })),
    )
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
