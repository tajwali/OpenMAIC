'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, LogOut, Plus, X, Users, BookOpen, Trash2, Pencil, Check, UserCircle, Settings } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Subject {
  id: string
  name: string
  icon: string
  is_default: boolean
}

interface UserRecord {
  id: string
  email: string
  display_name: string
  role: string
  teacher_id: string | null
  grade: string | null
  school: string | null
  disabled: boolean
  last_login_at: string | null
  created_at: string | null
}

type Tab = 'users' | 'subjects' | 'platform'

interface PlatformSettings {
  DEFAULT_MODEL: string
  DEFAULT_IMAGE_MODEL: string
  DEFAULT_TTS_VOICE: string
  MAX_SCENES: number
  ALLOW_MATURE_STUDENTS: boolean
}

interface PlatformSettingsResponse {
  settings: PlatformSettings
  overrides: string[]
  envDefaults: Record<string, string>
}

type UserRole = 'admin' | 'teacher' | 'school_student' | 'mature_student'

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  teacher: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  mature_student: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  school_student: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

interface Props {
  userEmail?: string
  displayName?: string
  userId?: string
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard({ userEmail, displayName, userId }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('users')
  const [userCount, setUserCount] = useState<number | null>(null)

  // Users tab state
  const [users, setUsers] = useState<UserRecord[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // Inline edit state
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Subjects tab state
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectsLoading, setSubjectsLoading] = useState(true)
  const [newIcon, setNewIcon] = useState('📚')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Platform tab state
  const [platformData, setPlatformData] = useState<PlatformSettingsResponse | null>(null)
  const [platformLoading, setPlatformLoading] = useState(true)
  const [platformSaving, setPlatformSaving] = useState(false)
  const [platformError, setPlatformError] = useState<string | null>(null)
  const [platformSuccess, setPlatformSuccess] = useState(false)
  const [editPlatform, setEditPlatform] = useState<Partial<PlatformSettings>>({})

  useEffect(() => {
    fetch('/api/user/stats').then(r => r.ok ? r.json() : {}).then((data: Record<string, unknown>) => {
      if (typeof data?.totalUsers === 'number') setUserCount(data.totalUsers as number)
    }).catch(() => {})
  }, [])

  // ─── Users ────────────────────────────────────────────────────────────────

  const loadUsers = useCallback(() => {
    setUsersLoading(true)
    setUsersError(null)
    fetch('/api/admin/users')
      .then(r => r.ok ? r.json() : r.json().then((e: { error: string }) => { throw new Error(e.error) }))
      .then((data: UserRecord[]) => setUsers(Array.isArray(data) ? data : []))
      .catch((e: Error) => setUsersError(e.message))
      .finally(() => setUsersLoading(false))
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const handleCreateTeacher = async () => {
    if (!createName.trim() || !createEmail.trim() || !createPassword) return
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: createEmail.trim(), password: createPassword, displayName: createName.trim() }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setCreateError(data.error ?? 'Failed'); return }
      setShowCreateForm(false)
      setCreateName(''); setCreateEmail(''); setCreatePassword('')
      loadUsers()
    } catch {
      setCreateError('Network error')
    } finally {
      setCreating(false)
    }
  }

  const handleChangeRole = async (targetId: string, newRole: UserRole) => {
    setActionError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: targetId, new_role: newRole }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setActionError(data.error ?? 'Failed to change role'); return }
      loadUsers()
    } catch {
      setActionError('Network error')
    }
  }

  const handleDeleteUser = async (targetId: string) => {
    if (!confirm('Delete this user? This cannot be undone.')) return
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/users?user_id=${targetId}`, { method: 'DELETE' })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setActionError(data.error ?? 'Failed to delete user'); return }
      loadUsers()
    } catch {
      setActionError('Network error')
    }
  }

  const openEditUser = (u: UserRecord) => {
    setEditingUserId(u.id)
    setEditName(u.display_name ?? '')
    setEditPassword('')
    setEditError(null)
  }

  const handleSaveEdit = async (targetId: string) => {
    if (!editName.trim() && !editPassword) return
    setEditSaving(true)
    setEditError(null)
    try {
      const patch: Record<string, unknown> = { user_id: targetId }
      if (editName.trim()) patch.display_name = editName.trim()
      if (editPassword) patch.new_password = editPassword
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setEditError(data.error ?? 'Failed'); return }
      setEditingUserId(null)
      loadUsers()
    } catch {
      setEditError('Network error')
    } finally {
      setEditSaving(false)
    }
  }

  const handleToggleDisable = async (targetId: string, currentlyDisabled: boolean) => {
    setActionError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: targetId, disabled: !currentlyDisabled }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setActionError(data.error ?? 'Failed'); return }
      loadUsers()
    } catch {
      setActionError('Network error')
    }
  }

  // ─── Subjects ─────────────────────────────────────────────────────────────

  const loadSubjects = useCallback(() => {
    setSubjectsLoading(true)
    fetch('/api/subjects')
      .then(r => r.ok ? r.json() : [])
      .then((data: Subject[]) => setSubjects(Array.isArray(data) ? data : []))
      .catch(() => setSubjects([]))
      .finally(() => setSubjectsLoading(false))
  }, [])

  const loadPlatformSettings = useCallback(() => {
    setPlatformLoading(true)
    setPlatformSuccess(false)
    fetch('/api/admin/settings')
      .then(r => r.ok ? r.json() : null)
      .then((data: PlatformSettingsResponse | null) => {
        if (data) {
          setPlatformData(data)
          setEditPlatform(data.settings)
        }
      })
      .catch(() => {})
      .finally(() => setPlatformLoading(false))
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])
  useEffect(() => { if (tab === 'subjects') loadSubjects() }, [tab, loadSubjects])
  useEffect(() => { if (tab === 'platform') loadPlatformSettings() }, [tab, loadPlatformSettings])

  const handleSavePlatform = async () => {
    setPlatformSaving(true)
    setPlatformError(null)
    setPlatformSuccess(false)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPlatform),
      })
      if (res.ok) {
        setPlatformSuccess(true)
        loadPlatformSettings()
      } else {
        const err = await res.json()
        setPlatformError(err.error || 'Failed to save settings')
      }
    } catch {
      setPlatformError('Network error')
    } finally {
      setPlatformSaving(false)
    }
  }

  const handleAddSubject = async () => {
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
        setNewName(''); setNewIcon('📚')
        loadSubjects()
      }
    } catch {
      setAddError('Network error')
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteSubject = async (id: string) => {
    try {
      const res = await fetch(`/api/subjects?id=${id}`, { method: 'DELETE' })
      if (res.ok) loadSubjects()
    } catch { /* ignore */ }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">OpenMAIC</h1>
            <p className="text-sm text-muted-foreground">{displayName ?? userEmail ?? 'Admin Dashboard'}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => router.push('/profile')}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              title="Profile settings"
            >
              <UserCircle className="w-4 h-4" />
            </button>
            <button onClick={handleLogout} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 flex gap-1">
          {([
            { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
            { id: 'subjects', label: 'Subjects', icon: <BookOpen className="w-4 h-4" /> },
            { id: 'platform', label: 'Platform Settings', icon: <Settings className="w-4 h-4" /> },
          ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
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

        {/* ── Users Tab ── */}
        {tab === 'users' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">All Users</h3>
              <button
                onClick={() => { setShowCreateForm(v => !v); setCreateError(null) }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Create Teacher
              </button>
            </div>

            {/* Create teacher form */}
            {showCreateForm && (
              <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <p className="text-sm font-medium text-foreground">New Teacher Account</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={createName}
                    onChange={e => setCreateName(e.target.value)}
                    placeholder="Display name"
                    className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <input
                    type="email"
                    value={createEmail}
                    onChange={e => setCreateEmail(e.target.value)}
                    placeholder="Email"
                    className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <input
                    type="password"
                    value={createPassword}
                    onChange={e => setCreatePassword(e.target.value)}
                    placeholder="Password (min 6 chars)"
                    className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                {createError && <p className="text-xs text-red-500">{createError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateTeacher}
                    disabled={creating || !createName.trim() || !createEmail.trim() || !createPassword}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {creating ? 'Creating…' : 'Create'}
                  </button>
                  <button
                    onClick={() => { setShowCreateForm(false); setCreateError(null) }}
                    className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {actionError && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-2">{actionError}</p>
            )}

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {usersLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : usersError ? (
                <div className="py-8 text-center text-sm text-red-500">{usersError}</div>
              ) : users.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No users found</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Created</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Last Login</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map(u => {
                      const isSelf = u.id === userId
                      const isEditing = editingUserId === u.id
                      const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : '—'
                      const formatTime = (d: string | null) => d ? new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''

                      return (
                        <React.Fragment key={u.id}>
                          <tr className={`hover:bg-muted/20 transition-colors ${u.disabled ? 'opacity-60' : ''}`}>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground flex items-center gap-2">
                                  {u.display_name || <span className="text-muted-foreground italic">—</span>}
                                  {u.disabled && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold uppercase">
                                      banned
                                    </span>
                                  )}
                                </span>
                                <span className="text-xs text-muted-foreground">{u.email}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[u.role] ?? 'bg-muted text-muted-foreground'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                              {formatDate(u.created_at)}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                              <div>{formatDate(u.last_login_at)}</div>
                              <div className="text-[10px] opacity-70">{formatTime(u.last_login_at)}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <select
                                  value={u.role}
                                  disabled={isSelf}
                                  onChange={e => handleChangeRole(u.id, e.target.value as UserRole)}
                                  className="text-xs px-2 py-1 border border-border rounded-lg bg-background text-foreground disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                  <option value="admin">admin</option>
                                  <option value="teacher">teacher</option>
                                  <option value="mature_student">mature_student</option>
                                  <option value="school_student">school_student</option>
                                </select>
                                <button
                                  onClick={() => isEditing ? setEditingUserId(null) : openEditUser(u)}
                                  className={`p-1.5 rounded-lg transition-colors ${isEditing ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                                  title="Edit name / Reset password"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleToggleDisable(u.id, u.disabled)}
                                  disabled={isSelf}
                                  className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${u.disabled ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-muted-foreground hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}
                                  title={u.disabled ? 'Enable account (unban)' : 'Disable account (ban)'}
                                >
                                  {u.disabled ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  disabled={isSelf}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                  title={isSelf ? 'Cannot delete your own account' : 'Delete user'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isEditing && (
                            <tr key={`${u.id}-edit`} className="bg-muted/20 border-b border-border">
                              <td colSpan={5} className="px-4 py-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-muted-foreground uppercase font-bold">Display Name</label>
                                    <input
                                      type="text"
                                      value={editName}
                                      onChange={e => setEditName(e.target.value)}
                                      placeholder="Display name"
                                      className="px-3 py-1.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-44"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-muted-foreground uppercase font-bold">Reset Password</label>
                                    <input
                                      type="password"
                                      value={editPassword}
                                      onChange={e => setEditPassword(e.target.value)}
                                      placeholder="New password (optional)"
                                      className="px-3 py-1.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-52"
                                    />
                                  </div>
                                  <div className="flex items-end gap-2 mt-4">
                                    <button
                                      onClick={() => handleSaveEdit(u.id)}
                                      disabled={editSaving || (!editName.trim() && !editPassword)}
                                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                                    >
                                      {editSaving ? 'Saving…' : 'Save Changes'}
                                    </button>
                                    <button
                                      onClick={() => setEditingUserId(null)}
                                      className="px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                  {editError && <div className="w-full text-xs text-red-500 mt-1 font-medium">{editError}</div>}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {/* ── Subjects Tab ── */}
        {tab === 'subjects' && (
          <section className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Manage Subjects</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Default subjects cannot be deleted. Custom subjects can be added and removed.</p>
            </div>

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
                        onClick={() => handleDeleteSubject(s.id)}
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
                  onKeyDown={e => { if (e.key === 'Enter') handleAddSubject() }}
                  placeholder="Subject name"
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  onClick={handleAddSubject}
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
        )}
        {/* ── Platform Settings Tab ── */}
        {tab === 'platform' && (
          <section className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Global Platform Settings</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Overrides for environment variables. Changes are cached for 5 minutes.</p>
            </div>

            {platformLoading ? (
              <div className="py-12 flex justify-center">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* DEFAULT_MODEL */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      Default LLM Model
                      {platformData?.overrides.includes('DEFAULT_MODEL') && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">DB OVERRIDE</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={editPlatform.DEFAULT_MODEL}
                      onChange={e => setEditPlatform({ ...editPlatform, DEFAULT_MODEL: e.target.value })}
                      placeholder={platformData?.envDefaults.DEFAULT_MODEL}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                    <p className="text-[10px] text-muted-foreground">Env default: {platformData?.envDefaults.DEFAULT_MODEL}</p>
                  </div>

                  {/* DEFAULT_IMAGE_MODEL */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      Default Image Model
                      {platformData?.overrides.includes('DEFAULT_IMAGE_MODEL') && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">DB OVERRIDE</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={editPlatform.DEFAULT_IMAGE_MODEL}
                      onChange={e => setEditPlatform({ ...editPlatform, DEFAULT_IMAGE_MODEL: e.target.value })}
                      placeholder={platformData?.envDefaults.DEFAULT_IMAGE_MODEL}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                    <p className="text-[10px] text-muted-foreground">Env default: {platformData?.envDefaults.DEFAULT_IMAGE_MODEL}</p>
                  </div>

                  {/* DEFAULT_TTS_VOICE */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      Default TTS Voice
                      {platformData?.overrides.includes('DEFAULT_TTS_VOICE') && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">DB OVERRIDE</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={editPlatform.DEFAULT_TTS_VOICE}
                      onChange={e => setEditPlatform({ ...editPlatform, DEFAULT_TTS_VOICE: e.target.value })}
                      placeholder={platformData?.envDefaults.DEFAULT_TTS_VOICE}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                    <p className="text-[10px] text-muted-foreground">Env default: {platformData?.envDefaults.DEFAULT_TTS_VOICE}</p>
                  </div>

                  {/* MAX_SCENES */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      Max Scenes per Course
                      {platformData?.overrides.includes('MAX_SCENES') && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">DB OVERRIDE</span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={editPlatform.MAX_SCENES}
                      onChange={e => setEditPlatform({ ...editPlatform, MAX_SCENES: parseInt(e.target.value) || 10 })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                    <p className="text-[10px] text-muted-foreground">Env default: {platformData?.envDefaults.MAX_SCENES}</p>
                  </div>

                  {/* ALLOW_MATURE_STUDENTS */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      Allow Direct Student Signup
                      {platformData?.overrides.includes('ALLOW_MATURE_STUDENTS') && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">DB OVERRIDE</span>
                      )}
                    </label>
                    <div className="flex items-center gap-4 py-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={editPlatform.ALLOW_MATURE_STUDENTS === true}
                          onChange={() => setEditPlatform({ ...editPlatform, ALLOW_MATURE_STUDENTS: true })}
                        />
                        <span className="text-sm">Enabled</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={editPlatform.ALLOW_MATURE_STUDENTS === false}
                          onChange={() => setEditPlatform({ ...editPlatform, ALLOW_MATURE_STUDENTS: false })}
                        />
                        <span className="text-sm">Disabled</span>
                      </label>
                    </div>
                    <p className="text-[10px] text-muted-foreground">If disabled, only school students with an invite code can register.</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSavePlatform}
                      disabled={platformSaving}
                      className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {platformSaving ? 'Saving…' : 'Save Platform Settings'}
                    </button>
                    {platformSuccess && <span className="text-sm text-green-600 font-medium">✓ Settings saved successfully</span>}
                    {platformError && <span className="text-sm text-red-500 font-medium">Error: {platformError}</span>}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
