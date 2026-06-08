import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      full_name,
      email,
      password,
      agency_id,
      account_type = 'agent',
    } = body;

    const cleanAccountType = account_type === 'responsable' ? 'responsable' : 'agent';

    if (!full_name || !email || !password) {
      return NextResponse.json(
        { error: 'Nom, email et mot de passe obligatoires.' },
        { status: 400 }
      );
    }

    if (cleanAccountType === 'agent' && !agency_id) {
      return NextResponse.json(
        { error: "L'agence est obligatoire pour un agent commercial." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role: cleanAccountType,
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Erreur pendant la création de l'utilisateur." },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    if (cleanAccountType === 'responsable') {
      const { data: profileData, error: profileError } = await adminSupabase
        .from('profiles')
        .insert({
          user_id: userId,
          full_name,
          email: cleanEmail,
          role: 'responsable',
          agency_id: null,
          agent_id: null,
          status: 'active',
          must_change_password: true,
          is_admin: true,
        })
        .select('id')
        .single();

      if (profileError || !profileData) {
        await adminSupabase.auth.admin.deleteUser(userId);

        return NextResponse.json(
          { error: profileError?.message || "Erreur pendant la création du profil Responsable." },
          { status: 400 }
        );
      }

      await adminSupabase
        .from('user_accounts')
        .insert({
          profile_id: profileData.id,
          email: cleanEmail,
          status: 'active',
        });

      return NextResponse.json({
        success: true,
        profile_id: profileData.id,
        auth_user_id: userId,
        account_type: 'responsable',
        message: 'Responsable créé avec succès.',
      });
    }

    const { data: agentData, error: agentError } = await adminSupabase
      .from('agents')
      .insert({
        full_name,
        email: cleanEmail,
        agency_id: Number(agency_id),
        role: 'agent',
        account_type: 'agent',
        auth_user_id: userId,
      })
      .select('id')
      .single();

    if (agentError || !agentData) {
      await adminSupabase.auth.admin.deleteUser(userId);

      return NextResponse.json(
        { error: agentError?.message || "Erreur pendant la création de l'agent." },
        { status: 400 }
      );
    }

    const { data: profileData, error: profileError } = await adminSupabase
      .from('profiles')
      .insert({
        user_id: userId,
        full_name,
        email: cleanEmail,
        role: 'agent',
        agency_id: Number(agency_id),
        agent_id: agentData.id,
        status: 'active',
        must_change_password: true,
        is_admin: false,
      })
      .select('id')
      .single();

    if (profileError || !profileData) {
      await adminSupabase.auth.admin.deleteUser(userId);
      await adminSupabase.from('agents').delete().eq('id', agentData.id);

      return NextResponse.json(
        { error: profileError?.message || "Erreur pendant la création du profil." },
        { status: 400 }
      );
    }

    await adminSupabase
      .from('agents')
      .update({
        profile_id: profileData.id,
        auth_user_id: userId,
        email: cleanEmail,
        role: 'agent',
        account_type: 'agent',
      })
      .eq('id', agentData.id);

    await adminSupabase
      .from('user_accounts')
      .insert({
        profile_id: profileData.id,
        email: cleanEmail,
        status: 'active',
      });

    return NextResponse.json({
      success: true,
      agent_id: agentData.id,
      profile_id: profileData.id,
      auth_user_id: userId,
      account_type: 'agent',
      message: 'Agent créé avec succès.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erreur serveur.' },
      { status: 500 }
    );
  }
}
