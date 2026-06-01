'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import Planning from '@/components/Planning';
import { Agences, Agents, Ventes, Garanties, Messages, Documents, Stats } from '@/components/Pages';

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

          {active !== 'planning' && (
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
          )}
        </div>

        {active === 'dashboard' && (
          <div className="mobile-home">
            <Planning />
            <Dashboard />
          </div>
        )}

        {active === 'dashboard' && (
          <div className="desktop-home">
            <Dashboard />
          </div>
        )}

        {active === 'planning' && <Planning />}
        {active === 'agences' && <Agences />}
        {active === 'agents' && <Agents />}
        {active === 'ventes' && <Ventes />}
        {active === 'garanties' && <Garanties />}
        {active === 'messages' && <Messages />}
        {active === 'documents' && <Documents />}
        {active === 'stats' && <Stats />}
      </main>

      <nav className="mobile-nav">
        <button className={active === 'dashboard' ? 'active' : ''} onClick={() => setActive('dashboard')}>
          <span>🏠</span>
          Accueil
        </button>

        <button className={active === 'planning' ? 'active' : ''} onClick={() => setActive('planning')}>
          <span>📅</span>
          Planning
        </button>

        <button className={active === 'ventes' ? 'active' : ''} onClick={() => setActive('ventes')}>
          <span>🚗</span>
          Ventes
        </button>

        <button className={active === 'agents' ? 'active' : ''} onClick={() => setActive('agents')}>
          <span>👥</span>
          Agents
        </button>

        <button className={active === 'stats' ? 'active' : ''} onClick={() => setActive('stats')}>
          <span>📊</span>
          Stats
        </button>
      </nav>
    </div>
  );
}
