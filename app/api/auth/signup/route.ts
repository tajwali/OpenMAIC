import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { checkRateLimit } from '@/lib/server/rate-limit'

function makeAuthFetch() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const authUrl = process.env.SUPABASE_AUTH_URL
  if (!authUrl) return undefined
  return (url: RequestInfo | URL, options?: RequestInit) => {
    const urlStr = url.toString()
    if (urlStr.startsWith(supabaseUrl + '/auth/v1')) {
      return fetch(authUrl + urlStr.slice((supabaseUrl + '/auth/v1').length), options)
    }
    return fetch(url, options)
  }
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const rateCheck = checkRateLimit(`signup:${ip}`, 5, 60 * 60 * 1000)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Please try again in ${rateCheck.retryAfter} seconds.` },
      { status: 429 }
    )
  }

  const body = JSON.parse(await request.text()) as {
    email?: string
    password?: string
    displayName?: string
    role?: string
    inviteCode?: string
  }

  const { email, password, displayName, role = 'mature_student', inviteCode } = body
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: makeAuthFetch() },
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  // Validate role
  const validRoles = ['mature_student', 'school_student']
  const finalRole = validRoles.includes(role) ? role : 'mature_student'

  // If school_student, validate invite code and find teacher
  let teacherId: string | null = null
  if (finalRole === 'school_student') {
    if (!inviteCode?.trim()) {
      return NextResponse.json({ error: 'Invite code is required for school students' }, { status: 400 })
    }
    const admin = getSupabaseAdmin()
    const { data: teacher } = await admin
      .from('user_profiles')
      .select('id')
      .eq('invite_code', inviteCode.trim())
      .eq('role', 'teacher')
      .single()

    if (!teacher) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 })
    }
    teacherId = teacher.id
  }

  const { data, error } = await supabase.auth.signUp({ email: email!, password: password! })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (data.user) {
    const admin = getSupabaseAdmin()
    await admin.from('user_profiles').insert({
      id: data.user.id,
      display_name: displayName ?? '',
      role: finalRole,
      ...(teacherId ? { teacher_id: teacherId } : {}),
    })
  }

  return NextResponse.json({ success: true, user: data.user })
}
