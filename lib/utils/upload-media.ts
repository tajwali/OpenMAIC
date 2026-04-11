/**
 * Upload client-side media blobs to the server before saving to database.
 *
 * Client-generated images/videos are stored in IndexedDB as blobs keyed by
 * placeholder IDs (gen_img_*, gen_vid_*). TTS audio is stored under audioId.
 * These blobs only exist in the browser and are lost on other devices.
 *
 * This utility:
 *  1. Finds all placeholder IDs in the scenes canvas elements.
 *  2. Looks up each blob in IndexedDB.
 *  3. POSTs each blob to /api/user/classrooms/media.
 *  4. Returns deep-cloned scenes with placeholder IDs / audioId references
 *     replaced by the permanent server-side URLs.
 *
 * Failures are swallowed — the original placeholder values are kept as
 * fallbacks so that a network error never blocks saving the course.
 */

import { db, mediaFileKey } from '@/lib/utils/database';
import { isMediaPlaceholder } from '@/lib/store/media-generation';
import type { Scene } from '@/lib/types/stage';
import type { SpeechAction } from '@/lib/types/action';
import { createLogger } from '@/lib/logger';

const log = createLogger('UploadMedia');

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upload all client-side media blobs for `stageId` to the server and return
 * a deep-cloned copy of `scenes` with placeholder IDs replaced by server URLs.
 */
export async function uploadMediaAndReplace(
  scenes: Scene[],
  stageId: string,
): Promise<Scene[]> {
  // Deep-clone to avoid mutating the live Zustand store
  const cloned = JSON.parse(JSON.stringify(scenes)) as Scene[];

  // --- Images and videos ---------------------------------------------------

  // Collect unique placeholder IDs from slide canvas elements
  const placeholders = new Set<string>();
  for (const scene of cloned) {
    if (scene.type !== 'slide') continue;
    const canvas = (scene.content as { canvas?: { elements?: Array<{ type: string; src: string }> } }).canvas;
    if (!canvas?.elements) continue;
    for (const el of canvas.elements) {
      if ((el.type === 'image' || el.type === 'video') && isMediaPlaceholder(el.src)) {
        placeholders.add(el.src);
      }
    }
  }

  // Upload each unique placeholder blob
  const resolvedUrls = new Map<string, string>(); // elementId → server URL
  for (const elementId of placeholders) {
    const key = mediaFileKey(stageId, elementId);
    const rec = await db.mediaFiles.get(key).catch(() => undefined);
    if (!rec || rec.blob.size === 0 || rec.error) continue;

    const ext = extFromMime(rec.mimeType);
    const filename = `${elementId}.${ext}`;
    const form = new FormData();
    form.append('classroomId', stageId);
    form.append('subdir', 'media');
    form.append('filename', filename);
    form.append('file', rec.blob, filename);

    try {
      const res = await fetch('/api/user/classrooms/media', { method: 'POST', body: form });
      if (res.ok) {
        const { url } = (await res.json()) as { url: string };
        resolvedUrls.set(elementId, url);
        log.info(`Uploaded ${elementId} → ${url}`);
      } else {
        log.warn(`Upload failed for ${elementId}: HTTP ${res.status}`);
      }
    } catch (err) {
      log.warn(`Upload error for ${elementId}:`, err);
    }
  }

  // Replace placeholder IDs with server URLs in cloned scenes
  if (resolvedUrls.size > 0) {
    for (const scene of cloned) {
      if (scene.type !== 'slide') continue;
      const canvas = (scene.content as { canvas?: { elements?: Array<{ type: string; src: string }> } }).canvas;
      if (!canvas?.elements) continue;
      for (const el of canvas.elements) {
        if ((el.type === 'image' || el.type === 'video') && isMediaPlaceholder(el.src)) {
          const serverUrl = resolvedUrls.get(el.src);
          if (serverUrl) el.src = serverUrl;
        }
      }
    }
  }

  // --- Audio (TTS) ---------------------------------------------------------

  for (const scene of cloned) {
    if (!scene.actions?.length) continue;
    for (const action of scene.actions) {
      if (action.type !== 'speech') continue;
      const speech = action as SpeechAction;
      // Skip if server URL already set (e.g. server-generated TTS)
      if (!speech.audioId || speech.audioUrl) continue;

      const rec = await db.audioFiles.get(speech.audioId).catch(() => undefined);
      if (!rec || rec.blob.size === 0) continue;

      const ext = rec.format || 'mp3';
      const filename = `${speech.audioId}.${ext}`;
      const form = new FormData();
      form.append('classroomId', stageId);
      form.append('subdir', 'audio');
      form.append('filename', filename);
      form.append('file', rec.blob, filename);

      try {
        const res = await fetch('/api/user/classrooms/media', { method: 'POST', body: form });
        if (res.ok) {
          const { url } = (await res.json()) as { url: string };
          speech.audioUrl = url;
          log.info(`Uploaded audio ${speech.audioId} → ${url}`);
        } else {
          log.warn(`Audio upload failed for ${speech.audioId}: HTTP ${res.status}`);
        }
      } catch (err) {
        log.warn(`Audio upload error for ${speech.audioId}:`, err);
      }
    }
  }

  return cloned;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extFromMime(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('gif')) return 'gif';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('webm')) return 'webm';
  return 'bin';
}
