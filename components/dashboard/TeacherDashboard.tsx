'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Users, BookOpen, ClipboardList, LogOut, Copy, Check, RefreshCw, X, ChevronRight, FileText } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Student {
  id: string
  display_name: string
  grade: string | null
  school: string | null
  coursesAssigned: number
  lastQuizScore: number | null
  lastAccessed: string | null
}

interface Course {
  id: string
  title: string
  topic: string
  status: string
  created_at: string
}

interface Assignment {
  id: string
  classroom_id: string
  classroom_title: string
  student_id: string
  student_name: string
  assigned_at: string
}

interface StudentProgress {
  student: { id: string; display_name: string; grade: string | null; school: string | null }
  stats: { quizzesTaken: number; avgScore: number | null }
  assignments: { classroom_id: string; classroom_title: string; assigned_at: string; completed: boolean; last_accessed: string | null }[]
  recentQuizzes: { classroom_title: string; score: number; total: number; percentage: number; taken_at: string }[]
}

type Tab = 'students' | 'courses' | 'assignments'

interface Props {
  userEmail?: string
  displayName?: string
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TeacherDashboard({ userEmail, displayName }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('students')
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStudent, setSelectedStudent] = useState<StudentProgress | null>(null)
  const [assignModal, setAssignModal] = useState<Course | null>(null)
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set())
  const [assigning, setAssigning] = useState(false)
  const [assignResult, setAssignResult] = useState<string | null>(null)

  const loadAll = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/teacher/invite-code').then(r => r.ok ? r.json() : {}),
      fetch('/api/teacher/students').then(r => r.ok ? r.json() : []),
      fetch('/api/teacher/courses').then(r => r.ok ? r.json() : []),
      fetch('/api/teacher/assign-course').then(r => r.ok ? r.json() : []),
    ]).then(([ic, studs, crses, asns]: [{ invite_code?: string }, Student[], Course[], Assignment[]]) => {
      setInviteCode(ic.invite_code ?? null)
      setStudents(Array.isArray(studs) ? studs : [])
      setCourses(Array.isArray(crses) ? crses : [])
      setAssignments(Array.isArray(asns) ? asns : [])
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const copyInviteCode = () => {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const regenerateCode = async () => {
    const res = await fetch('/api/teacher/invite-code', { method: 'POST' })
    const data = await res.json()
    if (data.invite_code) setInviteCode(data.invite_code)
  }

  const openStudentProgress = async (studentId: string) => {
    const res = await fetch(`/api/teacher/student-progress?student_id=${studentId}`)
    if (res.ok) setSelectedStudent(await res.json())
  }

  const openAssignModal = (course: Course) => {
    setAssignModal(course)
    setSelectedStudentIds(new Set())
    setAssignResult(null)
  }

  const toggleStudent = (id: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const submitAssign = async () => {
    if (!assignModal || selectedStudentIds.size === 0) return
    setAssigning(true)
    setAssignResult(null)
    try {
      const res = await fetch('/api/teacher/assign-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroom_id: assignModal.id,
          student_ids: [...selectedStudentIds],
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setAssignResult(`✓ Assigned to ${data.assigned} student${data.assigned !== 1 ? 's' : ''}`)
        loadAll()
      } else {
        setAssignResult(`Error: ${data.error}`)
      }
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">OpenMAIC — Teacher</h1>
            <p className="text-sm text-muted-foreground">{displayName ?? userEmail}</p>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 flex gap-1">
          {([
            { id: 'students', label: 'My Students', icon: <Users className="w-4 h-4" /> },
            { id: 'courses', label: 'My Courses', icon: <BookOpen className="w-4 h-4" /> },
            { id: 'assignments', label: 'Assignments', icon: <ClipboardList className="w-4 h-4" /> },
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

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* ── Tab: Students ── */}
        {tab === 'students' && (
          <div className="space-y-6">
            {/* Invite Code */}
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-sm font-medium text-muted-foreground mb-2">Your Student Invite Code</p>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-mono font-bold tracking-widest text-foreground">
                  {inviteCode ?? '——————'}
                </span>
                <button
                  onClick={copyInviteCode}
                  className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                  title="Copy code"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={regenerateCode}
                  className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                  title="Regenerate code"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Share this code with students so they can sign up and join your class.</p>
            </div>

            {/* Student List */}
            <div>
              <h2 className="text-lg font-semibold mb-4">
                Students <span className="text-muted-foreground font-normal text-sm">({students.length})</span>
              </h2>
              {loading ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
              ) : students.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
                  <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">No students yet — share your invite code</p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Grade</th>
                        <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Courses</th>
                        <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Last Quiz</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Last Active</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(s => (
                        <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{s.display_name}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{s.grade ?? '—'}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{s.coursesAssigned}</td>
                          <td className="px-4 py-3 text-center">
                            {s.lastQuizScore !== null ? <ScoreBadge pct={s.lastQuizScore} /> : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                            {s.lastAccessed ? new Date(s.lastAccessed).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => openStudentProgress(s.id)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                              title="View progress"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Courses ── */}
        {tab === 'courses' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">My Courses</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/exam/create')}
                  className="flex items-center gap-1.5 px-3 py-2 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Create Exam
                </button>
                <button
                  onClick={() => router.push('/generate')}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  + Generate New Course
                </button>
              </div>
            </div>
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : courses.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
                <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No courses yet — generate your first course</p>
              </div>
            ) : (
              <div className="space-y-2">
                {courses.map(c => (
                  <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => router.push(`/classroom/${c.id}`)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors text-muted-foreground"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => openAssignModal(c)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Assignments ── */}
        {tab === 'assignments' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Course Assignments</h2>
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>
            ) : assignments.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
                <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No assignments yet — assign courses from the My Courses tab</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Course</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Student</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map(a => (
                      <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-foreground truncate max-w-[200px]">{a.classroom_title}</td>
                        <td className="px-4 py-3 text-muted-foreground">{a.student_name}</td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                          {new Date(a.assigned_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Student Progress Modal ── */}
      {selectedStudent && (
        <Modal onClose={() => setSelectedStudent(null)} title={`Progress — ${selectedStudent.student.display_name}`}>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold">{selectedStudent.stats.quizzesTaken}</p>
                <p className="text-xs text-muted-foreground">Quizzes Taken</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold">
                  {selectedStudent.stats.avgScore !== null ? `${selectedStudent.stats.avgScore}%` : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Avg Score</p>
              </div>
            </div>

            {selectedStudent.assignments.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Assigned Courses</p>
                <div className="space-y-1.5">
                  {selectedStudent.assignments.map(a => (
                    <div key={a.classroom_id} className="flex items-center justify-between text-sm rounded-lg bg-muted/30 px-3 py-2">
                      <span className="text-foreground truncate mr-2">{a.classroom_title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${a.completed ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                        {a.completed ? 'Completed' : 'In Progress'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedStudent.recentQuizzes.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Recent Quiz Results</p>
                <div className="space-y-1.5">
                  {selectedStudent.recentQuizzes.map((q, i) => (
                    <div key={i} className="flex items-center justify-between text-sm rounded-lg bg-muted/30 px-3 py-2">
                      <span className="text-foreground truncate mr-2">{q.classroom_title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-muted-foreground text-xs">{q.score}/{q.total}</span>
                        <ScoreBadge pct={q.percentage} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Assign Course Modal ── */}
      {assignModal && (
        <Modal onClose={() => setAssignModal(null)} title={`Assign: ${assignModal.title}`}>
          <div className="space-y-4">
            {students.length === 0 ? (
              <p className="text-muted-foreground text-sm">No students available. Share your invite code first.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Select students to assign this course:</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {students.map(s => (
                    <label key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm font-medium text-foreground">{s.display_name}</span>
                      {s.grade && <span className="text-xs text-muted-foreground">Grade {s.grade}</span>}
                    </label>
                  ))}
                </div>
                {assignResult && (
                  <p className={`text-sm ${assignResult.startsWith('✓') ? 'text-green-600' : 'text-destructive'}`}>
                    {assignResult}
                  </p>
                )}
                <button
                  onClick={submitAssign}
                  disabled={assigning || selectedStudentIds.size === 0}
                  className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {assigning ? 'Assigning…' : `Assign to ${selectedStudentIds.size} student${selectedStudentIds.size !== 1 ? 's' : ''}`}
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function ScoreBadge({ pct }: { pct: number }) {
  const rounded = Math.round(pct)
  const color = rounded >= 80
    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
    : rounded >= 60
      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {rounded}%
    </span>
  )
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  )
}
