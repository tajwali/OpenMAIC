import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
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
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateCheck = checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Please try again in ${rateCheck.retryAfter} seconds.` },
        { status: 429 }
      )
    }

    const { email, password } = JSON.parse(await request.text())
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

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json({ success: true, user: data.user })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
