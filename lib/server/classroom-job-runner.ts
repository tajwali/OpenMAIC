import { createLogger } from '@/lib/logger';
import { generateClassroom, type GenerateClassroomInput } from '@/lib/server/classroom-generation';
import {
  markClassroomGenerationJobFailed,
  markClassroomGenerationJobRunning,
  markClassroomGenerationJobSucceeded,
  updateClassroomGenerationJobProgress,
} from '@/lib/server/classroom-job-store';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { callLLM } from '@/lib/ai/llm';
import { resolveModel } from '@/lib/server/resolve-model';

const log = createLogger('ClassroomJob');
const runningJobs = new Map<string, Promise<void>>();

async function classifySubject(title: string, requirement: string): Promise<string | null> {
  try {
    const admin = getSupabaseAdmin();
    const { data: subjects } = await admin
      .from('subjects')
      .select('id, name')
      .order('is_default', { ascending: false });

    if (!subjects?.length) return null;

    const subjectList = subjects.map(s => s.name as string).join(', ');
    const { model: languageModel } = resolveModel({});
    const result = await callLLM(
      {
        model: languageModel,
        system: 'You are a subject classifier. Respond with ONLY the subject name from the given list, nothing else.',
        prompt: `Course title: "${title}"\nCourse requirement: "${requirement.slice(0, 300)}"\n\nClassify into ONE of these subjects: ${subjectList}\n\nRespond with only the subject name.`,
      },
      'subject-classify',
    );

    const classified = result.text.trim();
    const match = subjects.find(s => (s.name as string).toLowerCase() === classified.toLowerCase());
    return match ? (match.id as string) : null;
  } catch {
    return null;
  }
}

async function saveClassroomToDatabase(
  userId: string,
  classroomId: string,
  stageName: string,
  requirement: string,
  scenes: unknown,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const title = (stageName || requirement).slice(0, 100);

  // Derive short_title from first scene title, fallback to requirement
  let shortTitle: string | null = null;
  if (Array.isArray(scenes) && scenes.length > 0) {
    const firstScene = scenes[0] as Record<string, unknown>;
    if (firstScene.title && typeof firstScene.title === 'string') {
      shortTitle = firstScene.title.slice(0, 60);
    }
  }
  if (!shortTitle) shortTitle = requirement.slice(0, 60);

  // Auto-classify subject (fire-and-forget safe — null on failure)
  const subjectId = await classifySubject(title, requirement);

  const { error } = await admin.from('classrooms').insert({
    id: classroomId,
    user_id: userId,
    title,
    short_title: shortTitle,
    subject_id: subjectId,
    topic: requirement.slice(0, 500),
    scenes,
    status: 'complete',
  });
  if (error) {
    log.error(`Failed to save classroom ${classroomId} to database:`, error.message);
  } else {
    log.info(`Classroom ${classroomId} saved to database for user ${userId}`);
  }
}

export function runClassroomGenerationJob(
  jobId: string,
  input: GenerateClassroomInput,
  baseUrl: string,
  userId?: string,
): Promise<void> {
  const existing = runningJobs.get(jobId);
  if (existing) {
    return existing;
  }

  const jobPromise = (async () => {
    try {
      await markClassroomGenerationJobRunning(jobId);

      const result = await generateClassroom(input, {
        baseUrl,
        onProgress: async (progress) => {
          await updateClassroomGenerationJobProgress(jobId, progress);
        },
      });

      await markClassroomGenerationJobSucceeded(jobId, result);

      log.info(`Job ${jobId} succeeded. userId=${userId ?? 'undefined'}, classroomId=${result.id}`);

      if (userId) {
        try {
          await saveClassroomToDatabase(
            userId,
            result.id,
            result.stage.name,
            input.requirement,
            result.scenes,
          );
        } catch (dbError) {
          log.error(`Database save failed for classroom ${result.id}:`, dbError);
          // Never fail the job due to DB errors — filesystem save already succeeded
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Classroom generation job ${jobId} failed:`, error);
      try {
        await markClassroomGenerationJobFailed(jobId, message);
      } catch (markFailedError) {
        log.error(`Failed to persist failed status for job ${jobId}:`, markFailedError);
      }
    } finally {
      runningJobs.delete(jobId);
    }
  })();

  runningJobs.set(jobId, jobPromise);
  return jobPromise;
}
