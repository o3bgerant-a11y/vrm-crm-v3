'use client';

import {
  BarChart3,
  CalendarDays,
  Car,
  ClipboardList,
  FileText,
  Gauge,
  Home,
  Megaphone,
  Settings,
  ShieldCheck,
  Store,
  Users,
  PhoneCall,
  Target,
  DollarSign
} from 'lucide-react';

const items = [
  ['dashboard', 'Tableau de bord', Home, 'all'],
  ['planning', 'Planning', CalendarDays, 'all'],
  ['agences', 'Agences', Store, 'responsable'],
  ['agents', 'Agents commerciaux', Users, 'responsable'],
  ['objectifs-mensuels', 'Objectifs mensuels', Target, 'responsable'],
  ['remuneration', 'Rémunération', DollarSign, 'responsable'],
  ['leads', 'Leads', PhoneCall, 'all'],
  ['rapport-semaine', 'Rapport semaine', ClipboardList, 'all'],
  ['ventes', 'Ventes', Car, 'all'],
  ['garanties', 'Garanties', ShieldCheck, 'all'],
  ['messages', 'Messages Direction', Megaphone, 'all'],
  ['documents', 'Documents', FileText, 'all'],
  ['stats', 'Statistiques', BarChart3, 'all'],
  ['parametres', 'Paramètres', Settings, 'all'],
] as const;

export default function Sidebar({
  active,
  setActive,
  isResponsable = true,
  documentsNotificationCount = 0,
  messagesNotificationCount = 0,
}: {
  active: string;
  setActive: (v: string) => void;
  isResponsable?: boolean;
  documentsNotificationCount?: number;
  messagesNotificationCount?: number;
}) {
  const visibleItems = items.filter(([, , , access]) => {
    if (access === 'all') return true;
    return isResponsable;
  });

  function notificationCount(id: string) {
    if (id === 'documents') return documentsNotificationCount;
    if (id === 'messages') return messagesNotificationCount;
    return 0;
  }

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
        {visibleItems.map(([id, label, Icon]) => {
          const count = notificationCount(id);

          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={active === id ? 'active' : ''}
            >
              <Icon size={18} />

              <span style={{ flex: 1, textAlign: 'left' }}>
                {label}
              </span>

              {count > 0 && (
                <span
                  style={{
                    minWidth: 20,
                    height: 20,
                    padding: '0 6px',
                    borderRadius: 999,
                    background: '#ef4444',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 6,
                  }}
                >
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
