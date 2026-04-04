'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Plus, Trophy, BarChart2, LogOut } from 'lucide-react'

interface Classroom {
  id: string
  title: string
  topic: string
  status: string
  created_at: string
}

interface Stats {
  totalCourses: number
  quizzesTaken: number
  avgScore: number
  coursesCompleted: number
}

interface Props {
  userEmail?: string
  displayName?: string
}

export default function MatureStudentDashboard({ userEmail, displayName }: Props) {
  const router = useRouter()
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [stats, setStats] = useState<Stats>({ totalCourses: 0, quizzesTaken: 0, avgScore: 0, coursesCompleted: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/user/classrooms').then(r => r.ok ? r.json() : []),
      fetch('/api/user/stats').then(r => r.ok ? r.json() : null),
    ]).then(([courses, userStats]: [unknown, Stats | null]) => {
      setClassrooms(Array.isArray(courses) ? (courses as Classroom[]) : [])
      setStats(userStats ?? { totalCourses: 0, quizzesTaken: 0, avgScore: 0, coursesCompleted: 0 })
    }).finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">OpenMAIC</h1>
            <p className="text-sm text-muted-foreground">{displayName ?? userEmail ?? 'My Dashboard'}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/generate')}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Generate New Course
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={<BookOpen className="w-5 h-5 text-blue-500" />} label="Total Courses" value={stats.totalCourses} />
          <StatCard icon={<Trophy className="w-5 h-5 text-yellow-500" />} label="Quizzes Taken" value={stats.quizzesTaken} />
          <StatCard icon={<BarChart2 className="w-5 h-5 text-green-500" />} label="Avg Score" value={stats.quizzesTaken > 0 ? `${Math.round(stats.avgScore)}%` : '—'} />
          <StatCard icon={<BookOpen className="w-5 h-5 text-purple-500" />} label="Completed" value={stats.coursesCompleted} />
        </div>

        {/* Course Grid */}
        <section>
          <h2 className="text-lg font-semibold mb-4">My Courses</h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : classrooms.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
              <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No courses yet — generate your first!</p>
              <button
                onClick={() => router.push('/generate')}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Generate a Course
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {classrooms.map(c => (
                <CourseCard key={c.id} classroom={c} onClick={() => router.push(`/classroom/${c.id}`)} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function CourseCard({ classroom, onClick }: { classroom: Classroom; onClick: () => void }) {
  const date = new Date(classroom.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <button
      onClick={onClick}
      className="text-left bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
          {classroom.status}
        </span>
        <span className="text-xs text-muted-foreground">{date}</span>
      </div>
      <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors line-clamp-3">
        {classroom.title}
      </p>
    </button>
  )
}
