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

const titles: Record<string, string> = {
  dashboard: 'Tableau de bord',
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
  const [loadingUser, setLoadingUser] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const isResponsable = currentAgent?.account_type === 'responsable';

  async function loadCurrentUser() {
    setLoadingUser(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setCurrentAgent(null);
      setLoadingUser(false);
      return;
    }

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

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!currentAgent) return;

    if (!isResponsable && ['agences', 'agents', 'messages', 'parametres'].includes(active)) {
      setActive('dashboard');
    }
  }, [currentAgent, isResponsable, active]);

  async function signIn() {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Indique ton email et ton mot de passe.');
      return;
    }

    setLoginLoading(true);
    setLoginError('');

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });

    if (error) {
      console.error('Erreur connexion:', error);
      setLoginError('Connexion impossible. Vérifie l’email et le mot de passe.');
    } else {
      await loadCurrentUser();
    }

    setLoginLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setCurrentAgent(null);
    setLoginEmail('');
    setLoginPassword('');
    setActive('dashboard');
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
          <div className="card" style={{ maxWidth: 520 }}>
            <h2>Connexion CRM</h2>
            <p className="muted">
              Connecte-toi avec ton compte Responsable ou Agent.
            </p>

            <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />

              <input
                type="password"
                placeholder="Mot de passe"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') signIn();
                }}
              />

              {loginError && (
                <p style={{ color: '#ff6b6b', fontWeight: 700 }}>
                  {loginError}
                </p>
              )}

              <button className="btn" onClick={signIn} disabled={loginLoading}>
                {loginLoading ? 'Connexion...' : 'Se connecter'}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        active={active}
        setActive={setActive}
        isResponsable={isResponsable}
      />

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
        {active === 'documents' && (
          <Documents
            currentAgent={currentAgent}
            isResponsable={isResponsable}
          />
        )}
        {active === 'stats' && <Stats />}
        {isResponsable && active === 'parametres' && <Parametres />}
      </main>
    </div>
  );
}
