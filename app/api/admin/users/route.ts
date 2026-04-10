import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/server/require-role'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

const GOTRUE_URL = process.env.SUPABASE_AUTH_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

/** Call GoTrue admin REST API */
async function gotrueAdmin(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${GOTRUE_URL}/admin${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      ...(options.headers ?? {}),
    },
  })
}

export async function GET() {
  try {
    const auth = await requireRole(['admin'])
    if ('error' in auth) return auth.error

    const admin = getSupabaseAdmin()

    // Fetch profiles and GoTrue users in parallel
    const [{ data: profiles, error: profilesError }, gotrue] = await Promise.all([
      admin
        .from('user_profiles')
        .select('id, display_name, role, teacher_id, grade, school, invite_code')
        .order('role', { ascending: true }),
      gotrueAdmin('/users?per_page=1000'),
    ])

    if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 })

    // Build email map from GoTrue response
    const emailMap = new Map<string, string>()
    if (gotrue.ok) {
      const body = await gotrue.json() as { users?: { id: string; email?: string }[] }
      for (const u of body.users ?? []) {
        emailMap.set(u.id, u.email ?? '')
      }
    }
    // If GoTrue list fails, emails will just be empty strings — non-fatal

    const users = (profiles ?? []).map(p => ({
      id: p.id,
      email: emailMap.get(p.id as string) ?? '',
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

    // Create user via GoTrue admin REST API
    const createRes = await gotrueAdmin('/users', {
      method: 'POST',
      body: JSON.stringify({
        email: body.email.trim(),
        password: body.password,
        email_confirm: true,
      }),
    })

    const newUser = await createRes.json() as { id?: string; email?: string; msg?: string; error?: string }
    if (!createRes.ok) {
      return NextResponse.json({ error: newUser.msg ?? newUser.error ?? 'Failed to create user' }, { status: 400 })
    }
    if (!newUser.id) return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })

    const admin = getSupabaseAdmin()
    const { error: profileError } = await admin.from('user_profiles').insert({
      id: newUser.id,
      display_name: body.displayName.trim(),
      role: 'teacher',
    })

    if (profileError) {
      // Cleanup the auth user if profile insert fails
      await gotrueAdmin(`/users/${newUser.id}`, { method: 'DELETE' })
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, user: { id: newUser.id, email: newUser.email } }, { status: 201 })
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

    // Delete via GoTrue admin REST API (cascades to user_profiles via DB trigger)
    const delRes = await gotrueAdmin(`/users/${userId}`, { method: 'DELETE' })
    if (!delRes.ok && delRes.status !== 404) {
      const errBody = await delRes.json().catch(() => ({})) as { msg?: string }
      return NextResponse.json({ error: errBody.msg ?? 'Failed to delete user' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
