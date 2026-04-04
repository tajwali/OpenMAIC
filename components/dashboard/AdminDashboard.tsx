'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, LogOut } from 'lucide-react'

interface Props {
  userEmail?: string
  displayName?: string
}

export default function AdminDashboard({ userEmail, displayName }: Props) {
  const router = useRouter()
  const [userCount, setUserCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/user/stats').then(r => r.ok ? r.json() : {}).then((data: Record<string, unknown>) => {
      if (typeof data?.totalUsers === 'number') setUserCount(data.totalUsers as number)
    })
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">OpenMAIC</h1>
            <p className="text-sm text-muted-foreground">{displayName ?? userEmail ?? 'Admin Dashboard'}</p>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16 text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl mb-4">
          <Shield className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Full admin tools are coming soon. You will be able to manage users, roles, and platform settings.
        </p>
        {userCount !== null && (
          <p className="text-sm text-muted-foreground">
            Total users: <span className="font-semibold text-foreground">{userCount}</span>
          </p>
        )}
        <div className="inline-block px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium">
          Coming Soon
        </div>
      </main>
    </div>
  )
}
