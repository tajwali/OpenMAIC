import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

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
  const { email, password, displayName } = JSON.parse(await request.text())
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

  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (data.user) {
    try {
      await supabase.from('user_profiles').insert({
        id: data.user.id,
        display_name: displayName,
        role: 'student',
      })
    } catch {
      // Will be created on first login
    }
  }

  return NextResponse.json({ success: true, user: data.user })
}
