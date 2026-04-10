import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/server/require-role'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export async function GET() {
  try {
    const auth = await requireRole(['admin'])
    if ('error' in auth) return auth.error

    const admin = getSupabaseAdmin()

    const [{ data: profiles, error: profilesError }, { data: authData, error: authError }] =
      await Promise.all([
        admin
          .from('user_profiles')
          .select('id, display_name, role, teacher_id, grade, school, invite_code')
          .order('role', { ascending: true }),
        admin.auth.admin.listUsers(),
      ])

    if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

    const emailMap = new Map(
      (authData?.users ?? []).map(u => [u.id, u.email ?? ''])
    )

    const users = (profiles ?? []).map(p => ({
      id: p.id,
      email: emailMap.get(p.id) ?? '',
      display_name: p.display_name,
      role: p.role,
      teacher_id: p.teacher_id,
      grade: p.grade,
      school: p.school,
    }))

    return NextResponse.json(users)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(['admin'])
    if ('error' in auth) return auth.error

    const body = JSON.parse(await req.text()) as { email?: string; password?: string; displayName?: string }
    if (!body.email?.trim()) return NextResponse.json({ error: 'email is required' }, { status: 400 })
    if (!body.password || body.password.length < 6) return NextResponse.json({ error: 'password must be at least 6 characters' }, { status: 400 })
    if (!body.displayName?.trim()) return NextResponse.json({ error: 'displayName is required' }, { status: 400 })

    const admin = getSupabaseAdmin()

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: body.email.trim(),
      password: body.password,
      email_confirm: true,
    })

    if (createError) return NextResponse.json({ error: createError.message }, { status: 400 })
    if (!created.user) return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })

    const { error: profileError } = await admin.from('user_profiles').insert({
      id: created.user.id,
      display_name: body.displayName.trim(),
      role: 'teacher',
    })

    if (profileError) {
      // Cleanup the auth user if profile insert fails
      await admin.auth.admin.deleteUser(created.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, user: { id: created.user.id, email: created.user.email } }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireRole(['admin'])
    if ('error' in auth) return auth.error

    const body = JSON.parse(await req.text()) as { user_id?: string; new_role?: string }
    if (!body.user_id) return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    if (!body.new_role) return NextResponse.json({ error: 'new_role is required' }, { status: 400 })

    const validRoles = ['admin', 'teacher', 'school_student', 'mature_student']
    if (!validRoles.includes(body.new_role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    if (body.user_id === auth.user.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const { error } = await admin
      .from('user_profiles')
      .update({ role: body.new_role })
      .eq('id', body.user_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireRole(['admin'])
    if ('error' in auth) return auth.error

    const userId = new URL(req.url).searchParams.get('user_id')
    if (!userId) return NextResponse.json({ error: 'user_id is required' }, { status: 400 })

    if (userId === auth.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
