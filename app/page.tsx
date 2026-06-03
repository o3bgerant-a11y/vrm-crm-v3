'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import Planning from '@/components/Planning';
import Parametres from '@/components/Parametres';
import { supabase } from '@/lib/supabase';
import {
  Agences,
  Agents,
  Ventes,
  Garanties,
  Messages,
  Documents,
  Stats
} from '@/components/Pages';

type CurrentAgent = {
  id: number;
  full_name: string;
  email: string | null;
  role: string | null;
  account_type: string | null;
  agency_id: number | null;
  auth_user_id: string | null;
};

type ConnectedUser = {
  id: string;
  email?: string;
} | null;

const titles: Record<string, string> = {
  dashboard: 'Tableau de bord Responsable',
  planning: 'Planning Benoît',
  agences: 'Agences',
  agents: 'Agents commerciaux',
  ventes: 'Ventes véhicules',
  garanties: 'Garanties',
  messages: 'Messages Direction',
  documents: 'Documents',
  stats: 'Statistiques',
  parametres: 'Paramètres CRM',
};

export default function Home() {
  const [active, setActive] = useState('dashboard');
  const [currentAgent, setCurrentAgent] = useState<CurrentAgent | null>(null);
  const [connectedUser, setConnectedUser] = useState<ConnectedUser>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const isResponsable = currentAgent?.account_type === 'responsable';

  useEffect(() => {
    async function loadCurrentUser() {
      setLoadingUser(true);

      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        console.error('Utilisateur non connecté:', userError);
        setConnectedUser(null);
        setCurrentAgent(null);
        setLoadingUser(false);
        return;
      }

      setConnectedUser({
        id: userData.user.id,
        email: userData.user.email || '',
      });

      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .select('id, full_name, email, role, account_type, agency_id, auth_user_id')
        .eq('auth_user_id', userData.user.id)
        .maybeSingle();

      if (agentError) {
        console.error('Erreur recherche fiche agent:', agentError);
        setCurrentAgent(null);
      } else {
        setCurrentAgent((agentData as CurrentAgent) || null);
      }

      setLoadingUser(false);
    }

    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!currentAgent) return;

    if (!isResponsable && ['agences', 'agents', 'messages', 'documents', 'parametres'].includes(active)) {
      setActive('dashboard');
    }
  }, [currentAgent, isResponsable, active]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  if (loadingUser) {
    return (
      <div className="app">
        <main className="main">
          <div className="card">
            <h2>Chargement du compte...</h2>
            <p className="muted">Vérification du profil connecté.</p>
          </div>
        </main>
      </div>
    );
  }

  if (!currentAgent) {
    return (
      <div className="app">
        <main className="main">
          <div className="card">
            <h2>Compte non relié</h2>

            <p className="muted">
              Ton compte est bien connecté, mais il n'est pas encore relié à une fiche agent dans Supabase.
            </p>

            <div className="item" style={{ marginTop: 12, marginBottom: 12 }}>
              <p><strong>Email connecté :</strong> {connectedUser?.email || '-'}</p>
              <p><strong>ID connecté :</strong> {connectedUser?.id || '-'}</p>
            </div>

            <p>
              Vérifie la colonne <strong>auth_user_id</strong> dans la table <strong>agents</strong>.
            </p>

            <button className="btn" onClick={signOut}>
              Se déconnecter
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar active={active} setActive={setActive} />

      <main className="main">
        <div className="top">
          <div>
            <h2>{titles[active]}</h2>
            <p>
              CRM V3 Vroom Market — {currentAgent.full_name} — {isResponsable ? 'Responsable' : 'Agent commercial'}
            </p>
          </div>

          <div className="filters">
            <select><option>2026</option></select>
            <select><option>Mai</option></select>
            <select><option>S22</option></select>

            {isResponsable && (
              <>
                <select>
                  <option>Toutes les agences</option>
                  <option>Blois</option>
                  <option>Tours</option>
                  <option>Bourges</option>
                </select>

                <select>
                  <option>Tous les agents</option>
                  <option>Maveryk</option>
                </select>
              </>
            )}

            <button onClick={signOut}>
              Déconnexion
            </button>
          </div>
        </div>

        {active === 'dashboard' && <Dashboard />}
        {active === 'planning' && <Planning />}

        {isResponsable && active === 'agences' && <Agences />}
        {isResponsable && active === 'agents' && <Agents />}
        {active === 'ventes' && <Ventes />}
        {active === 'garanties' && <Garanties />}
        {isResponsable && active === 'messages' && <Messages />}
        {isResponsable && active === 'documents' && <Documents />}
        {active === 'stats' && <Stats />}
        {isResponsable && active === 'parametres' && <Parametres />}
      </main>
    </div>
  );
}
