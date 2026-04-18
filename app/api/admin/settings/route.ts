import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/require-role';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { getPlatformSettings, clearPlatformSettingsCache } from '@/lib/server/platform-settings';

export async function GET() {
  try {
    const auth = await requireRole(['admin']);
    if ('error' in auth) return auth.error;

    const settings = await getPlatformSettings();
    
    // Also return which ones are from DB vs ENV for the UI
    const admin = getSupabaseAdmin();
    const { data: dbData } = await admin.from('platform_settings').select('key, value');
    const dbKeys = new Set((dbData || []).map(d => d.key));

    return NextResponse.json({
      settings,
      overrides: Array.from(dbKeys),
      envDefaults: {
        DEFAULT_MODEL: process.env.DEFAULT_MODEL || 'google:gemini-2.0-flash',
        DEFAULT_IMAGE_MODEL: process.env.DEFAULT_IMAGE_MODEL || 'seedream',
        DEFAULT_TTS_VOICE: process.env.DEFAULT_TTS_VOICE || 'alloy',
        MAX_SCENES: process.env.MAX_SCENES || '10',
        ALLOW_MATURE_STUDENTS: process.env.ALLOW_MATURE_STUDENTS || 'true',
      }
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireRole(['admin']);
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const admin = getSupabaseAdmin();

    const updates = Object.entries(body).map(([key, value]) => ({
      key,
      value: String(value),
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    }));

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No settings provided' }, { status: 400 });
    }

    // Upsert settings
    const { error } = await admin.from('platform_settings').upsert(updates);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Clear cache so changes take effect (mostly) immediately for this instance
    clearPlatformSettingsCache();

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
