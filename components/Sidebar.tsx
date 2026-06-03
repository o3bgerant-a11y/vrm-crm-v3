'use client';

import {
  BarChart3,
  CalendarDays,
  Car,
  FileText,
  Gauge,
  Home,
  Megaphone,
  Settings,
  ShieldCheck,
  Store,
  Users
} from 'lucide-react';

const items = [
  ['dashboard', 'Tableau de bord', Home, 'all'],
  ['planning', 'Planning Benoît', CalendarDays, 'all'],
  ['agences', 'Agences', Store, 'responsable'],
  ['agents', 'Agents commerciaux', Users, 'responsable'],
  ['ventes', 'Ventes', Car, 'all'],
  ['garanties', 'Garanties', ShieldCheck, 'all'],
  ['messages', 'Messages Direction', Megaphone, 'responsable'],
  ['documents', 'Documents', FileText, 'all'],
  ['stats', 'Statistiques', BarChart3, 'all'],
  ['parametres', 'Paramètres', Settings, 'responsable'],
] as const;

export default function Sidebar({
  active,
  setActive,
  isResponsable = true
}: {
  active: string;
  setActive: (v: string) => void;
  isResponsable?: boolean;
}) {
  const visibleItems = items.filter(([, , , access]) => {
    if (access === 'all') return true;
    return isResponsable;
  });

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">
          <Gauge size={28} />
        </div>

        <div>
          <h1>Vroom Market</h1>
          <p>{isResponsable ? 'CRM Responsable' : 'CRM Agent'}</p>
        </div>
      </div>

      <div className="nav">
        {visibleItems.map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={active === id ? 'active' : ''}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>
    </aside>
  );
}
