import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('course_assignments')
      .select(`
        classroom_id,
        assigned_at,
        assigned_by,
        classrooms (
          id,
          title,
          topic,
          status
        )
      `)
      .eq('assigned_to', user.id)
      .order('assigned_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = (data ?? []).map((row: any) => ({
      id: row.classrooms?.id ?? row.classroom_id,
      title: row.classrooms?.title ?? '',
      topic: row.classrooms?.topic ?? '',
      status: row.classrooms?.status ?? '',
      assigned_at: row.assigned_at,
      assigned_by: row.assigned_by,
    }))

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
