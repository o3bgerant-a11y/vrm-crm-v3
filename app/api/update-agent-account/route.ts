import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminSupabase = createClient(
  supabaseUrl,
  serviceRoleKey
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      profile_id,
      action,
    } = body;

    if (!profile_id || !action) {
      return NextResponse.json(
        { error: 'Paramètres manquants.' },
        { status: 400 }
      );
    }

    if (action === 'block') {
      const { error } = await adminSupabase
        .from('profiles')
        .update({
          status: 'blocked',
        })
        .eq('id', profile_id);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
      });
    }

    if (action === 'activate') {
      const { error } = await adminSupabase
        .from('profiles')
        .update({
          status: 'active',
        })
        .eq('id', profile_id);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
      });
    }

    if (action === 'archive') {
      const { error } = await adminSupabase
        .from('profiles')
        .update({
          status: 'archived',
        })
        .eq('id', profile_id);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
      });
    }

    return NextResponse.json(
      { error: 'Action inconnue.' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          'Erreur serveur.',
      },
      { status: 500 }
    );
  }
}
