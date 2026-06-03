'use client';

import { useEffect, useState } from 'react';
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
import { supabase } from '@/lib/supabase';

const items = [
  ['dashboard', 'Tableau de bord', Home, 'all'],
  ['planning', 'Planning Benoît', CalendarDays, 'all'],
  ['agences', 'Agences', Store, 'responsable'],
  ['agents', 'Agents commerciaux', Users, 'responsable'],
  ['ventes', 'Ventes', Car, 'all'],
  ['garanties', 'Garanties', ShieldCheck, 'all'],
  ['messages', 'Messages Direction', Megaphone, 'all'],
  ['documents', 'Documents', FileText, 'all'],
  ['stats', 'Statistiques', BarChart3, 'all'],
  ['parametres', 'Paramètres', Settings, 'responsable'],
] as const;

type CurrentAgentSidebar = {
  id: number;
  full_name: string;
  agency_id: number | null;
  account_type: string | null;
  auth_user_id: string | null;
};

export default function Sidebar({
  active,
  setActive,
  isResponsable = true
}: {
  active: string;
  setActive: (v: string) => void;
  isResponsable?: boolean;
}) {
  const [currentAgent, setCurrentAgent] = useState<CurrentAgentSidebar | null>(null);
  const [documentsCount, setDocumentsCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);

  const visibleItems = items.filter(([, , , access]) => {
    if (access === 'all') return true;
    return isResponsable;
  });

  async function loadCurrentAgentForSidebar() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setCurrentAgent(null);
      return null;
    }

    const { data, error } = await supabase
      .from('agents')
      .select('id, full_name, agency_id, account_type, auth_user_id')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle();

    if (error) {
      console.error('Erreur chargement agent sidebar:', error);
      setCurrentAgent(null);
      return null;
    }

    setCurrentAgent((data as CurrentAgentSidebar) || null);
    return (data as CurrentAgentSidebar) || null;
  }

  async function loadNotifications(agent: CurrentAgentSidebar | null) {
    if (!agent) {
      setDocumentsCount(0);
      setMessagesCount(0);
      return;
    }

    const responsableMode = agent.account_type === 'responsable';

    const { data: documentsData, error: documentsError } = await supabase
      .from('agent_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (documentsError) {
      console.error('Erreur notifications documents:', documentsError);
      setDocumentsCount(0);
    } else {
      const docs = documentsData || [];

      const count = docs.filter((doc: any) => {
        const isNew = (doc.document_status || 'nouveau') === 'nouveau';

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

      setDocumentsCount(count);
    }

    const { data: messagesData, error: messagesError } = await supabase
      .from('direction_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (messagesError) {
      console.error('Erreur notifications messages:', messagesError);
      setMessagesCount(0);
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

      setMessagesCount(count);
    }
  }

  useEffect(() => {
    async function init() {
      const agent = await loadCurrentAgentForSidebar();
      await loadNotifications(agent);
    }

    init();

    const interval = setInterval(async () => {
      const agent = currentAgent || await loadCurrentAgentForSidebar();
      await loadNotifications(agent);
    }, 30000);

    return () => clearInterval(interval);
  }, [isResponsable]);

  function notificationCount(id: string) {
    if (id === 'documents') return documentsCount;
    if (id === 'messages') return messagesCount;
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
              style={{ position: 'relative' }}
            >
              <Icon size={18} />
              <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>

              {count > 0 && (
                <span
                  style={{
                    minWidth: 20,
                    height: 20,
                    padding: '0 6px',
                    borderRadius: 999,
                    background: '#ef4444',
                    color: 'white',
                    fontSize: 12,
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
