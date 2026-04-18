'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Users, BookOpen, ClipboardList, LogOut, Copy, Check, RefreshCw, X, ChevronRight, FileText, BarChart2, ChevronDown, UserCircle, Pencil } from 'lucide-react'

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
  short_title: string | null
  topic: string
  status: string
  created_at: string
  grade: string | null
  subject_name: string | null
  subject_icon: string | null
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

type Tab = 'students' | 'courses' | 'assignments' | 'exam-results'

interface ExamResultRow {
  student_name: string
  score: number
  total_questions: number
  percentage: number
  completed_at: string | null
}

interface ExamWithResults {
  exam_id: string
  exam_title: string
  results: ExamResultRow[]
}

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
  const [examResults, setExamResults] = useState<ExamWithResults[]>([])
  const [examResultsLoading, setExamResultsLoading] = useState(false)
  const [expandedExams, setExpandedExams] = useState<Set<string>>(new Set())
  // Profile modal
  const [showProfile, setShowProfile] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileGender, setProfileGender] = useState('')
  const [profilePassword, setProfilePassword] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [unassigningId, setUnassigningId] = useState<string | null>(null)
  // Student edit modal
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [editStudentName, setEditStudentName] = useState('')
  const [editStudentGrade, setEditStudentGrade] = useState('')
  const [editStudentPassword, setEditStudentPassword] = useState('')
  const [editStudentSaving, setEditStudentSaving] = useState(false)
  const [editStudentError, setEditStudentError] = useState<string | null>(null)

  const loadAll = useCallback(() => {
    setLoading(true)
    const safeJson = (r: Response) => r.ok ? r.json().catch(() => null) : Promise.resolve(null)
    Promise.all([
      fetch('/api/teacher/invite-code').then(safeJson).catch(() => null),
      fetch('/api/teacher/students').then(safeJson).catch(() => null),
      fetch('/api/teacher/courses').then(safeJson).catch(() => null),
      fetch('/api/teacher/assign-course').then(safeJson).catch(() => null),
    ]).then(([ic, studs, crses, asns]) => {
      setInviteCode((ic as { invite_code?: string } | null)?.invite_code ?? null)
      setStudents(Array.isArray(studs) ? (studs as Student[]) : [])
      setCourses(Array.isArray(crses) ? (crses as Course[]) : [])
      setAssignments(Array.isArray(asns) ? (asns as Assignment[]) : [])
    }).catch(() => {
      // Never let a fetch failure crash the dashboard
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const unassignCourse = async (assignment: Assignment) => {
    setUnassigningId(assignment.id)
    try {
      const res = await fetch('/api/teacher/assign-course', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroom_id: assignment.classroom_id, student_id: assignment.student_id }),
      })
      if (res.ok) {
        setAssignments(prev => prev.filter(a => a.id !== assignment.id))
      }
    } finally {
      setUnassigningId(null)
    }
  }

  const loadExamResults = () => {
    setExamResultsLoading(true)
    fetch('/api/teacher/exam-results')
      .then(r => r.ok ? r.json() : [])
      .then((data: ExamWithResults[]) => setExamResults(Array.isArray(data) ? data : []))
      .catch(() => setExamResults([]))
      .finally(() => setExamResultsLoading(false))
  }

  useEffect(() => {
    if (tab === 'exam-results' && examResults.length === 0 && !examResultsLoading) {
      loadExamResults()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const openProfile = async () => {
    setProfileError(null)
    setProfileSuccess(false)
    setProfilePassword('')
    try {
      const res = await fetch('/api/user/profile')
      if (res.ok) {
        const data = await res.json() as { display_name?: string; gender?: string }
        setProfileName(data.display_name ?? '')
        setProfileGender(data.gender ?? '')
      }
    } catch { /* ignore */ }
    setShowProfile(true)
  }

  const handleSaveProfile = async () => {
    setProfileSaving(true)
    setProfileError(null)
    setProfileSuccess(false)
    try {
      const patch: Record<string, string> = {}
      if (profileName.trim()) patch.display_name = profileName.trim()
      if (profileGender) patch.gender = profileGender
      if (profilePassword) patch.new_password = profilePassword
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setProfileError(data.error ?? 'Failed to save'); return }
      setProfileSuccess(true)
      setProfilePassword('')
    } catch {
      setProfileError('Network error')
    } finally {
      setProfileSaving(false)
    }
  }

  const openEditStudent = (s: Student) => {
    setEditingStudent(s)
    setEditStudentName(s.display_name)
    setEditStudentGrade(s.grade ?? '')
    setEditStudentPassword('')
    setEditStudentError(null)
  }

  const handleSaveStudent = async () => {
    if (!editingStudent) return
    setEditStudentSaving(true)
    setEditStudentError(null)
    try {
      const patch: Record<string, string> = { student_id: editingStudent.id }
      if (editStudentName.trim()) patch.display_name = editStudentName.trim()
      patch.grade = editStudentGrade
      if (editStudentPassword) patch.new_password = editStudentPassword
      const res = await fetch('/api/teacher/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setEditStudentError(data.error ?? 'Failed'); return }
      setEditingStudent(null)
      loadAll()
    } catch {
      setEditStudentError('Network error')
    } finally {
      setEditStudentSaving(false)
    }
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
          <div className="flex items-center gap-1">
            <button onClick={openProfile} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Profile settings">
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
        <div className="max-w-6xl mx-auto px-6 flex gap-1">
          {([
            { id: 'students', label: 'My Students', icon: <Users className="w-4 h-4" /> },
            { id: 'courses', label: 'My Courses', icon: <BookOpen className="w-4 h-4" /> },
            { id: 'assignments', label: 'Assignments', icon: <ClipboardList className="w-4 h-4" /> },
            { id: 'exam-results', label: 'Exam Results', icon: <BarChart2 className="w-4 h-4" /> },
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
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditStudent(s)}
                                className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                                title="Edit student"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openStudentProgress(s.id)}
                                className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                                title="View progress"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
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
                {courses.map(c => {
                  const displayTitle = (c.short_title || c.title || '').slice(0, 60)
                  return (
                    <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <p className="font-medium text-foreground">{displayTitle}</p>
                          <span
                            className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-mono hover:bg-muted/80 transition-colors cursor-pointer shrink-0"
                            title="Click to copy full course ID"
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(c.id); }}
                          >
                            #{c.id.slice(-6)}
                          </span>
                        </div>
                        {c.short_title && c.title !== c.short_title && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mb-1" title={c.title}>
                            {c.title}
                          </p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          {c.grade && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                              {c.grade}
                            </span>
                          )}
                          {c.subject_name && (
                            <span className="text-xs text-muted-foreground">
                              {c.subject_icon} {c.subject_name}
                            </span>
                          )}
                        </div>
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
                  )
                })}
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
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Assigned</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map(a => (
                      <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-foreground truncate max-w-[200px]">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{a.classroom_title}</span>
                            <span
                              className="shrink-0 px-1 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-mono hover:bg-muted/80 transition-colors cursor-pointer"
                              title="Click to copy full ID"
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(a.classroom_id); }}
                            >
                              #{a.classroom_id.slice(-6)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{a.student_name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(a.assigned_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => unassignCourse(a)}
                            disabled={unassigningId === a.id}
                            className="px-3 py-1 rounded-md text-xs font-medium text-destructive border border-destructive/40 hover:bg-destructive/10 transition-colors disabled:opacity-50"
                          >
                            {unassigningId === a.id ? 'Removing…' : 'Unassign'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {/* ── Tab: Exam Results ── */}
        {tab === 'exam-results' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Exam Results</h2>
            {examResultsLoading ? (
              <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : examResults.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
                <BarChart2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No exams created yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {examResults.map(exam => {
                  const isExpanded = expandedExams.has(exam.exam_id)
                  const completed = exam.results.length
                  return (
                    <div key={exam.exam_id} className="bg-card border border-border rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedExams(prev => {
                          const next = new Set(prev)
                          next.has(exam.exam_id) ? next.delete(exam.exam_id) : next.add(exam.exam_id)
                          return next
                        })}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="text-left">
                          <p className="font-medium text-foreground">{exam.exam_title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {completed} student{completed !== 1 ? 's' : ''} completed
                          </p>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      {isExpanded && (
                        <div className="border-t border-border">
                          {exam.results.length === 0 ? (
                            <p className="px-5 py-4 text-sm text-muted-foreground">No students have completed this exam yet.</p>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border bg-muted/30">
                                  <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Student</th>
                                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Score</th>
                                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Result</th>
                                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {exam.results.map((r, i) => (
                                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="px-5 py-3 font-medium text-foreground">{r.student_name}</td>
                                    <td className="px-4 py-3 text-center text-muted-foreground">{r.score}/{r.total_questions}</td>
                                    <td className="px-4 py-3 text-center"><ScoreBadge pct={r.percentage} /></td>
                                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                                      {r.completed_at ? new Date(r.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
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

      {/* ── Profile Modal ── */}
      {showProfile && (
        <Modal onClose={() => setShowProfile(false)} title="Profile Settings">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Display Name</label>
              <input
                type="text"
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Gender</label>
              <select
                value={profileGender}
                onChange={e => setProfileGender(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">New Password <span className="font-normal">(leave blank to keep current)</span></label>
              <input
                type="password"
                value={profilePassword}
                onChange={e => setProfilePassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {profileError && <p className="text-xs text-red-500">{profileError}</p>}
            {profileSuccess && <p className="text-xs text-green-600">Saved successfully</p>}
            <button
              onClick={handleSaveProfile}
              disabled={profileSaving}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {profileSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit Student Modal ── */}
      {editingStudent && (
        <Modal onClose={() => setEditingStudent(null)} title={`Edit: ${editingStudent.display_name}`}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Display Name</label>
              <input
                type="text"
                value={editStudentName}
                onChange={e => setEditStudentName(e.target.value)}
                placeholder="Student name"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Grade</label>
              <select
                value={editStudentGrade}
                onChange={e => setEditStudentGrade(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">No Grade</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">New Password <span className="font-normal">(leave blank to keep current)</span></label>
              <input
                type="password"
                value={editStudentPassword}
                onChange={e => setEditStudentPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {editStudentError && <p className="text-xs text-red-500">{editStudentError}</p>}
            <button
              onClick={handleSaveStudent}
              disabled={editStudentSaving}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {editStudentSaving ? 'Saving…' : 'Save Changes'}
            </button>
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
