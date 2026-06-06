import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { profile_id, new_password } = body;

    if (!profile_id || !new_password) {
      return NextResponse.json(
        { error: 'Profil et nouveau mot de passe obligatoires.' },
        { status: 400 }
      );
    }

    if (String(new_password).length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit faire au moins 6 caractères.' },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, user_id, email, role, full_name')
      .eq('id', profile_id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profil introuvable.' },
        { status: 404 }
      );
    }

    if (profile.role === 'patron' || profile.role === 'responsable') {
      return NextResponse.json(
        { error: 'Le mot de passe du compte Responsable ne peut pas être modifié ici.' },
        { status: 403 }
      );
    }

    if (!profile.user_id) {
      return NextResponse.json(
        { error: "Ce profil n'est pas relié à un compte de connexion Supabase Auth." },
        { status: 400 }
      );
    }

    const { error: updateError } = await adminSupabase.auth.admin.updateUserById(
      profile.user_id,
      {
        password: new_password,
        user_metadata: {
          full_name: profile.full_name,
          role: profile.role,
        },
      }
    );

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Erreur pendant la réinitialisation du mot de passe.' },
        { status: 400 }
      );
    }

    await adminSupabase
      .from('profiles')
      .update({
        must_change_password: true,
      })
      .eq('id', profile_id);

    return NextResponse.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erreur serveur.' },
      { status: 500 }
    );
  }
}
