'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import Planning from '@/components/Planning';
import {
  Agences,
  Agents,
  Ventes,
  Garanties,
  Messages,
  Documents,
  Stats
} from '@/components/Pages';

const Parametres = () => (
  <div className="card">
    <h3>⚙️ Paramètres CRM</h3>

    <p className="muted">
      Gestion des accès agents commerciaux.
    </p>

    <div style={{ marginTop: 20 }}>
      <button className="btn">
        ➕ Créer un agent
      </button>
    </div>

    <div style={{ marginTop: 20 }}>
      <p>
        La création automatique des comptes agents sera branchée à Supabase dans la prochaine étape.
      </p>
    </div>
  </div>
);

const titles: Record<string, string> = {
  dashboard: 'Tableau de bord Patron',
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

  return (
    <div className="app">
      <Sidebar active={active} setActive={setActive} />

      <main className="main">
        <div className="top">
          <div>
            <h2>{titles[active]}</h2>
            <p>CRM V3 Vroom Market — Blois, Tours, Bourges</p>
          </div>

          <div className="filters">
            <select><option>2026</option></select>
            <select><option>Mai</option></select>
            <select><option>S22</option></select>

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
          </div>
        </div>

        {active === 'dashboard' && <Dashboard />}
        {active === 'planning' && <Planning />}
        {active === 'agences' && <Agences />}
        {active === 'agents' && <Agents />}
        {active === 'ventes' && <Ventes />}
        {active === 'garanties' && <Garanties />}
        {active === 'messages' && <Messages />}
        {active === 'documents' && <Documents />}
        {active === 'stats' && <Stats />}
        {active === 'parametres' && <Parametres />}
      </main>
    </div>
  );
}
