'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, LogOut } from 'lucide-react'

interface Props {
  userEmail?: string
  displayName?: string
}

export default function TeacherDashboard({ userEmail, displayName }: Props) {
  const router = useRouter()
  const [studentCount, setStudentCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/user/stats').then(r => r.ok ? r.json() : {}).then((data: Record<string, unknown>) => {
      if (typeof data?.studentCount === 'number') setStudentCount(data.studentCount as number)
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
            <p className="text-sm text-muted-foreground">{displayName ?? userEmail ?? 'Teacher Dashboard'}</p>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16 text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl mb-4">
          <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold">Teacher Dashboard</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Full teacher tools are coming soon. You will be able to manage students, assign courses, and track progress.
        </p>
        {studentCount !== null && (
          <p className="text-sm text-muted-foreground">
            Students enrolled: <span className="font-semibold text-foreground">{studentCount}</span>
          </p>
        )}
        <div className="inline-block px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium">
          Coming Soon
        </div>
      </main>
    </div>
  )
}
