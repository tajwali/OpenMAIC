import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = getSupabaseAdmin()
    const { data: profile } = await admin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all students under this teacher
    const { data: students } = await admin
      .from('user_profiles')
      .select('id, display_name, grade, school')
      .eq('teacher_id', user.id)

    if (!students || students.length === 0) {
      return NextResponse.json([])
    }

    const studentIds = students.map(s => s.id)

    // Get assignment counts per student
    const { data: assignments } = await admin
      .from('course_assignments')
      .select('assigned_to')
      .eq('assigned_by', user.id)
      .in('assigned_to', studentIds)

    const assignmentCounts: Record<string, number> = {}
    for (const a of assignments ?? []) {
      assignmentCounts[a.assigned_to] = (assignmentCounts[a.assigned_to] ?? 0) + 1
    }

    // Get last quiz score per student
    const { data: quizRows } = await admin
      .from('quiz_results')
      .select('user_id, percentage, taken_at')
      .in('user_id', studentIds)
      .order('taken_at', { ascending: false })

    const lastQuiz: Record<string, { percentage: number; taken_at: string }> = {}
    for (const q of quizRows ?? []) {
      if (!lastQuiz[q.user_id]) lastQuiz[q.user_id] = { percentage: q.percentage, taken_at: q.taken_at }
    }

    // Get last accessed per student
    const { data: progressRows } = await admin
      .from('course_progress')
      .select('user_id, last_accessed')
      .in('user_id', studentIds)
      .order('last_accessed', { ascending: false })

    const lastAccessed: Record<string, string> = {}
    for (const p of progressRows ?? []) {
      if (!lastAccessed[p.user_id]) lastAccessed[p.user_id] = p.last_accessed
    }

    const result = students.map(s => ({
      id: s.id,
      display_name: s.display_name,
      grade: s.grade,
      school: s.school,
      coursesAssigned: assignmentCounts[s.id] ?? 0,
      lastQuizScore: lastQuiz[s.id]?.percentage ?? null,
      lastAccessed: lastAccessed[s.id] ?? null,
    }))

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
