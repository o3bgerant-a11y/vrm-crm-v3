import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { profile_id, action } = body;

    if (!profile_id || !action) {
      return NextResponse.json(
        { error: 'Paramètres manquants.' },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('id', profile_id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: profileError?.message || 'Profil introuvable.' },
        { status: 404 }
      );
    }

    if (profile.role === 'patron' || profile.role === 'responsable' || profile.is_admin === true) {
      return NextResponse.json(
        { error: 'Impossible de modifier ou supprimer un compte Responsable.' },
        { status: 403 }
      );
    }

    if (action === 'block') {
      const { error } = await adminSupabase
        .from('profiles')
        .update({ status: 'blocked' })
        .eq('id', profile_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'activate') {
      const { error } = await adminSupabase
        .from('profiles')
        .update({ status: 'active' })
        .eq('id', profile_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'archive') {
      const { error } = await adminSupabase
        .from('profiles')
        .update({ status: 'archived' })
        .eq('id', profile_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      const agentId = profile.agent_id || null;
      const userId = profile.user_id || profile.auth_user_id || null;

      if (agentId) {
        await adminSupabase.from('vehicle_sales').update({ agent_id: null }).eq('agent_id', agentId);
        await adminSupabase.from('leads').update({ agent_id: null }).eq('agent_id', agentId);
        await adminSupabase.from('weekly_reports').update({ agent_id: null }).eq('agent_id', agentId);
        await adminSupabase.from('agent_documents').update({ agent_id: null }).eq('agent_id', agentId);
        await adminSupabase.from('agent_documents').update({ sender_agent_id: null }).eq('sender_agent_id', agentId);
      }

      await adminSupabase.from('user_accounts').delete().eq('profile_id', profile_id);

      const { error: deleteProfileError } = await adminSupabase
        .from('profiles')
        .delete()
        .eq('id', profile_id);

      if (deleteProfileError) {
        return NextResponse.json(
          { error: deleteProfileError.message },
          { status: 400 }
        );
      }

      if (agentId) {
        const { error: deleteAgentError } = await adminSupabase
          .from('agents')
          .delete()
          .eq('id', agentId);

        if (deleteAgentError) {
          return NextResponse.json(
            { error: deleteAgentError.message },
            { status: 400 }
          );
        }
      }

      if (userId) {
        const { error: deleteUserError } = await adminSupabase.auth.admin.deleteUser(userId);

        if (deleteUserError) {
          return NextResponse.json(
            { error: deleteUserError.message },
            { status: 400 }
          );
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Action inconnue.' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erreur serveur.' },
      { status: 500 }
    );
  }
}
