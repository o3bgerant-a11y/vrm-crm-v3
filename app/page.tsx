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
  ObjectifsMensuels,
  Remuneration,
  Leads,
  RapportSemaine,
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
  'objectifs-mensuels': 'Objectifs mensuels',
  remuneration: 'Rémunération',
  leads: 'Leads',
  'rapport-semaine': 'Rapport semaine',
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

  const [documentsNotificationCount, setDocumentsNotificationCount] = useState(0);
  const [messagesNotificationCount, setMessagesNotificationCount] = useState(0);

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

  async function loadNotifications(agent: CurrentAgent | null) {
    if (!agent) {
      setDocumentsNotificationCount(0);
      setMessagesNotificationCount(0);
      return;
    }

    const responsableMode = agent.account_type === 'responsable';

    const { data: documentsData, error: documentsError } = await supabase
      .from('agent_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (documentsError) {
      console.error('Erreur chargement notifications documents:', documentsError);
      setDocumentsNotificationCount(0);
    } else {
      const documents = documentsData || [];

      const count = documents.filter((doc: any) => {
        const status = doc.document_status || 'nouveau';
        const isNew = status === 'nouveau';

        if (!isNew) return false;

        if (responsableMode) {
          return doc.sent_to_responsable === true || doc.target_type === 'responsable';
        }

        if (doc.sent_to_responsable === true || doc.target_type === 'responsable') {
          return false;
        }

        if (doc.target_type === 'all' || !doc.target_type) return true;
        if (doc.target_type === 'agency') return Number(doc.agency_id) === Number(agent.agency_id);
        if (doc.target_type === 'agent') return Number(doc.agent_id) === Number(agent.id);

        return false;
      }).length;

      setDocumentsNotificationCount(count);
    }

    const { data: messagesData, error: messagesError } = await supabase
      .from('direction_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (messagesError) {
      console.error('Erreur chargement notifications messages:', messagesError);
      setMessagesNotificationCount(0);
    } else {
      const messages = messagesData || [];

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const count = messages.filter((message: any) => {
        if (responsableMode) return false;

        const createdAt = message.created_at ? new Date(message.created_at) : null;
        const isRecent = createdAt ? createdAt >= sevenDaysAgo : true;

        if (!isRecent) return false;

        if (message.target_type === 'all' || !message.target_type) return true;
        if (message.target_type === 'agency') return Number(message.agency_id) === Number(agent.agency_id);
        if (message.target_type === 'agent') return Number(message.agent_id) === Number(agent.id);

        return false;
      }).length;

      setMessagesNotificationCount(count);
    }
  }

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!currentAgent) return;

    loadNotifications(currentAgent);

    const interval = setInterval(() => {
      loadNotifications(currentAgent);
    }, 30000);

    return () => clearInterval(interval);
  }, [currentAgent]);

  useEffect(() => {
    if (!currentAgent) return;

    if (!isResponsable && ['agences', 'agents', 'objectifs-mensuels', 'remuneration'].includes(active)) {
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
    setDocumentsNotificationCount(0);
    setMessagesNotificationCount(0);
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
        documentsNotificationCount={documentsNotificationCount}
        messagesNotificationCount={messagesNotificationCount}
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

        {active === 'dashboard' && (
          <Dashboard
            currentAgent={currentAgent}
            isResponsable={isResponsable}
          />
        )}

        {active === 'planning' && (
          <Planning
            currentAgent={currentAgent}
            isResponsable={isResponsable}
          />
        )}
        {isResponsable && active === 'agences' && <Agences />}
        {isResponsable && active === 'agents' && <Agents />}
        {isResponsable && active === 'objectifs-mensuels' && <ObjectifsMensuels />}

        {isResponsable && active === 'remuneration' && <Remuneration />}

        {active === 'leads' && <Leads />}
        {active === 'rapport-semaine' && (
          <RapportSemaine
            currentAgent={currentAgent}
            isResponsable={isResponsable}
          />
        )}
        {active === 'ventes' && <Ventes currentAgent={currentAgent} isResponsable={isResponsable} />}
        {active === 'garanties' && <Garanties />}
        {active === 'messages' && (
          <Messages
            currentAgent={currentAgent}
            isResponsable={isResponsable}
          />
        )}
        {active === 'documents' && (
          <Documents
            key={`documents-${currentAgent.id}-${isResponsable ? 'responsable' : 'agent'}`}
            currentAgent={currentAgent}
            isResponsable={isResponsable}
          />
        )}
        {active === 'stats' && <Stats />}
        {active === 'parametres' && <Parametres />}
      </main>
    </div>
  );
}
