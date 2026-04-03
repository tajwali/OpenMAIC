import { createLogger } from '@/lib/logger';
import { generateClassroom, type GenerateClassroomInput } from '@/lib/server/classroom-generation';
import {
  markClassroomGenerationJobFailed,
  markClassroomGenerationJobRunning,
  markClassroomGenerationJobSucceeded,
  updateClassroomGenerationJobProgress,
} from '@/lib/server/classroom-job-store';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

const log = createLogger('ClassroomJob');
const runningJobs = new Map<string, Promise<void>>();

async function saveClassroomToDatabase(
  userId: string,
  classroomId: string,
  stageName: string,
  requirement: string,
  scenes: unknown,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const title = (stageName || requirement).slice(0, 100);
  const { error } = await admin.from('classrooms').insert({
    id: classroomId,
    user_id: userId,
    title,
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
