import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as { id?: string; title?: string; topic?: string; scenes?: unknown };
    const { id, title, topic, scenes } = body;

    if (!id || !title) {
      return NextResponse.json({ error: 'Missing required fields: id, title' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin.from('classrooms').upsert({
      id,
      user_id: user.id,
      title: title.slice(0, 100),
      topic: (topic ?? '').slice(0, 500),
      scenes: scenes ?? [],
      status: 'complete',
    }, { onConflict: 'id' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('classrooms')
      .select('id, title, short_title, topic, status, created_at, subject_id, subjects(name, icon)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const mapped = (data ?? []).map((c: Record<string, unknown>) => {
      const subjectRow = c.subjects as { name: string; icon: string } | null
      return {
        id: c.id,
        title: c.title,
        short_title: c.short_title ?? null,
        topic: c.topic,
        status: c.status,
        created_at: c.created_at,
        subject_id: c.subject_id ?? null,
        subject_name: subjectRow?.name ?? null,
        subject_icon: subjectRow?.icon ?? null,
      }
    })

    return NextResponse.json(mapped);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: existing } = await admin
      .from('classrooms')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { error } = await admin.from('classrooms').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
