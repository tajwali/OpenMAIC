import { getSupabaseAdmin } from './supabase-admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('PlatformSettings');

export interface PlatformSettings {
  DEFAULT_MODEL: string;
  DEFAULT_IMAGE_MODEL: string;
  DEFAULT_TTS_VOICE: string;
  MAX_SCENES: number;
  ALLOW_MATURE_STUDENTS: boolean;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cachedSettings: PlatformSettings | null = null;
let lastFetchTime = 0;

/**
 * Fetch platform settings from DB with a 5-minute cache.
 * DB values override environment variables.
 */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const now = Date.now();
  if (cachedSettings && now - lastFetchTime < CACHE_TTL) {
    return cachedSettings;
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('platform_settings').select('key, value');

    if (error) {
      log.error('Failed to fetch platform settings from DB:', error);
      // Fallback to env vars if DB fetch fails
    }

    const dbSettings = (data || []).reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    cachedSettings = {
      DEFAULT_MODEL: dbSettings.DEFAULT_MODEL || process.env.DEFAULT_MODEL || 'google:gemini-2.0-flash',
      DEFAULT_IMAGE_MODEL: dbSettings.DEFAULT_IMAGE_MODEL || process.env.DEFAULT_IMAGE_MODEL || 'seedream',
      DEFAULT_TTS_VOICE: dbSettings.DEFAULT_TTS_VOICE || process.env.DEFAULT_TTS_VOICE || 'alloy',
      MAX_SCENES: parseInt(dbSettings.MAX_SCENES || process.env.MAX_SCENES || '10', 10),
      ALLOW_MATURE_STUDENTS: (dbSettings.ALLOW_MATURE_STUDENTS ?? process.env.ALLOW_MATURE_STUDENTS ?? 'true') === 'true',
    };

    lastFetchTime = now;
    return cachedSettings;
  } catch (err) {
    log.error('Error in getPlatformSettings:', err);
    return {
      DEFAULT_MODEL: process.env.DEFAULT_MODEL || 'google:gemini-2.0-flash',
      DEFAULT_IMAGE_MODEL: process.env.DEFAULT_IMAGE_MODEL || 'seedream',
      DEFAULT_TTS_VOICE: process.env.DEFAULT_TTS_VOICE || 'alloy',
      MAX_SCENES: parseInt(process.env.MAX_SCENES || '10', 10),
      ALLOW_MATURE_STUDENTS: (process.env.ALLOW_MATURE_STUDENTS || 'true') === 'true',
    };
  }
}

/**
 * Force clear the settings cache.
 */
export function clearPlatformSettingsCache() {
  cachedSettings = null;
  lastFetchTime = 0;
}
