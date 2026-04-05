'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, LogOut, Plus, X } from 'lucide-react'

interface Subject {
  id: string
  name: string
  icon: string
  is_default: boolean
}

interface Props {
  userEmail?: string
  displayName?: string
}

export default function AdminDashboard({ userEmail, displayName }: Props) {
  const router = useRouter()
  const [userCount, setUserCount] = useState<number | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectsLoading, setSubjectsLoading] = useState(true)
  const [newIcon, setNewIcon] = useState('📚')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/user/stats').then(r => r.ok ? r.json() : {}).then((data: Record<string, unknown>) => {
      if (typeof data?.totalUsers === 'number') setUserCount(data.totalUsers as number)
    }).catch(() => {})
  }, [])

  const loadSubjects = useCallback(() => {
    setSubjectsLoading(true)
    fetch('/api/subjects')
      .then(r => r.ok ? r.json() : [])
      .then((data: Subject[]) => setSubjects(Array.isArray(data) ? data : []))
      .catch(() => setSubjects([]))
      .finally(() => setSubjectsLoading(false))
  }, [])

  useEffect(() => { loadSubjects() }, [loadSubjects])

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), icon: newIcon }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' })) as { error: string }
        setAddError(err.error ?? 'Failed to add subject')
      } else {
        setNewName('')
        setNewIcon('📚')
        loadSubjects()
      }
    } catch {
      setAddError('Network error')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/subjects?id=${id}`, { method: 'DELETE' })
      if (res.ok) loadSubjects()
    } catch {
      // ignore
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">OpenMAIC</h1>
            <p className="text-sm text-muted-foreground">{displayName ?? userEmail ?? 'Admin Dashboard'}</p>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Admin header */}
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl">
            <Shield className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Admin Dashboard</h2>
            {userCount !== null && (
              <p className="text-sm text-muted-foreground">
                Total users: <span className="font-semibold text-foreground">{userCount}</span>
              </p>
            )}
          </div>
        </div>

        {/* Manage Subjects */}
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Manage Subjects</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Default subjects cannot be deleted. Custom subjects can be added and removed.</p>
          </div>

          {/* Subject list */}
          <div className="divide-y divide-border">
            {subjectsLoading ? (
              <div className="px-5 py-8 text-center">
                <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : subjects.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-muted-foreground">No subjects found</div>
            ) : (
              subjects.map(s => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{s.icon}</span>
                    <span className="text-sm font-medium text-foreground">{s.name}</span>
                    {s.is_default && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">default</span>
                    )}
                  </div>
                  {!s.is_default && (
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete subject"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add subject form */}
          <div className="px-5 py-4 border-t border-border bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-3">Add Subject</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newIcon}
                onChange={e => setNewIcon(e.target.value)}
                placeholder="📚"
                className="w-14 text-center px-2 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                maxLength={4}
              />
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                placeholder="Subject name"
                className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                onClick={handleAdd}
                disabled={adding || !newName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            {addError && <p className="text-xs text-red-500 mt-2">{addError}</p>}
          </div>
        </section>
      </main>
    </div>
  )
}
