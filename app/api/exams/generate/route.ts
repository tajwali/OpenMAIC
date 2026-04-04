import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { callLLM } from '@/lib/ai/llm'
import { resolveModelFromHeaders } from '@/lib/server/resolve-model'

function extractSceneText(scenes: unknown[]): string {
  return scenes
    .map((scene: unknown) => {
      const s = scene as Record<string, unknown>
      const parts: string[] = [`Scene: ${s.title ?? 'Untitled'}`]
      const content = s.content as Record<string, unknown> | undefined
      if (content?.type === 'quiz') {
        const questions = (content.questions as unknown[]) ?? []
        for (const rawQ of questions) {
          const q = rawQ as Record<string, unknown>
          parts.push(`Q: ${q.question}`)
          if (Array.isArray(q.options)) {
            for (const rawO of q.options) {
              const o = rawO as Record<string, string>
              parts.push(`  ${o.value}: ${o.label}`)
            }
          }
          if (Array.isArray(q.answer)) parts.push(`Answer: ${q.answer.join(', ')}`)
          if (q.analysis) parts.push(`Explanation: ${q.analysis}`)
        }
      } else if (content?.type === 'slide') {
        const canvas = content.canvas as Record<string, unknown> | undefined
        if (Array.isArray(canvas?.elements)) {
          for (const rawEl of canvas.elements as unknown[]) {
            const el = rawEl as Record<string, unknown>
            if (el.type === 'text') {
              const raw = String(el.content ?? '')
              const text = raw.replace(/<[^>]+>/g, '').trim()
              if (text) parts.push(text.slice(0, 200))
            }
          }
        }
      }
      return parts.join('\n')
    })
    .join('\n\n')
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = JSON.parse(await req.text()) as {
      classroom_ids?: string[]
      num_questions?: number
      difficulty?: string
      time_limit_minutes?: number
      title?: string
    }
    const {
      classroom_ids = [],
      num_questions = 10,
      difficulty = 'mixed',
      time_limit_minutes = 30,
      title,
    } = body

    if (!classroom_ids.length) {
      return NextResponse.json({ error: 'No classroom_ids provided' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const { data: classrooms } = await admin
      .from('classrooms')
      .select('id, title, scenes')
      .in('id', classroom_ids)

    if (!classrooms?.length) {
      return NextResponse.json({ error: 'No valid classrooms found' }, { status: 404 })
    }

    const allScenes: unknown[] = classrooms.flatMap(c => (c.scenes as unknown[]) ?? [])
    const courseContext = extractSceneText(allScenes)
    const courseTitles = classrooms.map(c => c.title as string).join(', ')
    const examTitle = title || `Exam: ${courseTitles}`

    const { model: languageModel } = resolveModelFromHeaders(req)

    const difficultyNote =
      difficulty === 'easy'
        ? 'use straightforward recall questions'
        : difficulty === 'hard'
          ? 'use analytical and application questions'
          : 'mix easy, medium, and hard questions'

    const systemPrompt = `You are an educational exam creator. Generate exam questions based on course content.
Return ONLY valid JSON matching this exact format:
{
  "questions": [
    {
      "id": "q1",
      "type": "single",
      "question": "Question text here",
      "options": [
        {"value": "A", "label": "Option A text"},
        {"value": "B", "label": "Option B text"},
        {"value": "C", "label": "Option C text"},
        {"value": "D", "label": "Option D text"}
      ],
      "answer": ["A"],
      "analysis": "Explanation of the correct answer",
      "points": 1
    }
  ]
}
Types allowed: "single" (one correct answer), "multiple" (multiple correct, answer array has 2+ values), "short_answer" (no options, no answer key, points=2).
For difficulty "${difficulty}": ${difficultyNote}.
Generate exactly ${num_questions} questions.`

    const userPrompt = `Create ${num_questions} exam questions from this course content:\n\n${courseContext.slice(0, 8000)}\n\nGenerate ${num_questions} questions covering the key concepts.`

    const result = await callLLM(
      { model: languageModel, system: systemPrompt, prompt: userPrompt },
      'exam-generate',
    )

    let questions: unknown[]
    try {
      const jsonMatch = result.text.trim().match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in response')
      const parsed = JSON.parse(jsonMatch[0]) as { questions?: unknown[] }
      questions = parsed.questions ?? []
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    if (!questions.length) {
      return NextResponse.json({ error: 'No questions generated' }, { status: 500 })
    }

    const { data: exam, error } = await admin
      .from('exams')
      .insert({
        created_by: user.id,
        title: examTitle.slice(0, 200),
        source_classroom_ids: classroom_ids,
        questions,
        time_limit_minutes,
        difficulty,
        is_self_exam: true,
      })
      .select('id, title')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ id: exam.id, title: exam.title, question_count: questions.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
