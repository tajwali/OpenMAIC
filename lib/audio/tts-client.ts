/**
 * Client-side TTS utilities
 *
 * Handles calling the TTS API, storing results in IndexedDB,
 * and uploading to the server for cross-device availability.
 */

import { db } from '@/lib/utils/database';
import { createLogger } from '@/lib/logger';
import type { TTSProviderId } from './types';

const log = createLogger('TTSClient');

export interface TTSOptions {
  ttsProviderId: TTSProviderId;
  ttsModelId?: string;
  ttsVoice: string;
  ttsSpeed?: number;
  ttsApiKey?: string;
  ttsBaseUrl?: string;
  signal?: AbortSignal;
}

/**
 * Generates TTS for a speech action, saves to IndexedDB, and uploads to server.
 * Returns the server-side audio URL.
 *
 * @param classroomId Classroom ID (stage.id)
 * @param actionId Action ID (speechAction.id)
 * @param text Text to speak
 * @param options TTS configuration options
 * @returns Server-side URL for the generated audio
 */
export async function generateAndUploadTTS(
  classroomId: string,
  actionId: string,
  text: string,
  options: TTSOptions,
): Promise<string> {
  const audioId = `tts_${actionId}`;

  // 1. Call TTS API
  const response = await fetch('/api/generate/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      audioId,
      ttsProviderId: options.ttsProviderId,
      ttsModelId: options.ttsModelId,
      ttsVoice: options.ttsVoice,
      ttsSpeed: options.ttsSpeed,
      ttsApiKey: options.ttsApiKey,
      ttsBaseUrl: options.ttsBaseUrl,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `TTS request failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.success || !data.base64 || !data.format) {
    throw new Error(data.error || 'Invalid TTS response');
  }

  // 2. Convert base64 to Blob
  const binary = atob(data.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: `audio/${data.format}` });

  // 3. Save to IndexedDB (as local cache/fallback)
  await db.audioFiles.put({
    id: audioId,
    blob,
    format: data.format,
    createdAt: Date.now(),
  });

  // 4. Determine extension and predictable URL
  const ext = data.format || 'mp3';
  const filename = `${audioId}.${ext}`;
  const audioUrl = `/api/classroom-media/${classroomId}/audio/${filename}`;

  // 5. Fire-and-forget upload to server
  // We use File object to wrap the blob for FormData
  const file = new File([blob], filename, { type: blob.type });
  const formData = new FormData();
  formData.append('classroomId', classroomId);
  formData.append('subdir', 'audio');
  formData.append('filename', filename);
  formData.append('file', file);

  void fetch('/api/user/classrooms/media', {
    method: 'POST',
    body: formData,
  }).catch((err) => {
    log.warn(`Background upload failed for ${audioId}:`, err);
  });

  return audioUrl;
}
