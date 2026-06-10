'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

const euro = (n: number) => n.toLocaleString('fr-FR') + ' €';

const agencyName = (agencyId: any) => {
  const id = Number(agencyId);

  if (id === 1) return 'Blois';
  if (id === 2) return 'Tours';
  if (id === 3) return 'Bourges';

  return '-';
};

type AgentOption = {
  id: number;
  full_name: string;
  agency_id: number | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  birth_date?: string | null;
  entry_date?: string | null;
  status?: string | null;
  contract_type?: string | null;
  role?: string | null;
  notes?: string | null;
  objective_sales?: number | null;
  objective_margin?: number | null;
  objective_warranties?: number | null;
  vacation_notes?: string | null;
  absence_notes?: string | null;
};

type VehicleSale = {
  id: number;
  agent_id: number | null;
  weekly_report_id: number | null;
  sale_date: string | null;
  vehicle_name: string | null;
  vehicle_photo_url: string | null;
  seller_price: number | null;
  sale_price: number | null;
  margin_amount: number | null;
  warranty_sold: boolean | null;
  warranty_type: string | null;
  warranty_amount: number | null;
  registration: string | null;
  vin: string | null;
  comments: string | null;
  notes?: string | null;
  agents?: {
    full_name: string | null;
    agency_id: number | null;
  } | null;
};

type DirectionMessage = {
  id: number;
  title: string;
  message: string;
  target_type: string | null;
  agency_id: number | null;
  agent_id: number | null;
  pinned: boolean | null;
  created_at: string | null;
};

type AgentDocument = {
  id: number;
  title: string;
  category: string | null;
  description: string | null;
  file_url: string | null;
  target_type: string | null;
  agency_id: number | null;
  agent_id: number | null;
  sender_agent_id?: number | null;
  document_status?: string | null;
  sent_to_responsable?: boolean | null;
  created_at: string | null;
};

type CurrentAgentForPages = {
  id: number;
  full_name: string;
  agency_id: number | null;
  account_type: string | null;
};

type LeadItem = {
  id: number;
  year_number: number | null;
  month_number: number | null;
  week_number: number | null;
  agency_id: number | null;
  agent_id: number | null;
  source: string | null;
  status: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_registration: string | null;
  vehicle_year: number | null;
  vehicle_mileage: number | null;
  lead_date: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  seller_expected_price: number | null;
  seller_net_price: number | null;
  mandate_signed: boolean | null;
  vehicle_entered: boolean | null;
  sale_done: boolean | null;
  sale_price: number | null;
  margin_amount: number | null;
  warranty_sold: boolean | null;
  warranty_amount: number | null;
  comments: string | null;
  created_at: string | null;
  agents?: {
    full_name: string | null;
    agency_id: number | null;
  } | null;
};


type MonthlyObjective = {
  id: number;
  agent_id: number;
  agency_id: number;
  year_number: number;
  month_number: number;
  sales_target: number;
  margin_target: number;
  warranty_target: number;
  created_at: string | null;
  updated_at?: string | null;
  agents?: {
    full_name: string | null;
    agency_id: number | null;
  } | null;
};

type WeeklyReport = {
  id: number;
  agent_id: number | null;
  year?: number | null;
  month?: number | null;
  week?: string | number | null;
  contacts?: number | null;
  appointments?: number | null;
  mandates?: number | null;
  vehicles_in?: number | null;
  sales_count?: number | null;
  margin_amount?: number | null;
  warranties_count?: number | null;
  warranties_amount?: number | null;
  positive_points?: string | null;
  negative_points?: string | null;
  next_week_goals?: string | null;
  comments: string | null;
  created_at: string | null;
  year_number?: number | null;
  month_number?: number | null;
  week_number?: number | null;
  summary?: string | null;
  actions_done?: string | null;
  next_week_objectives?: string | null;
  updated_at?: string | null;
};



function saleDateToDate(value: string | null) {
  if (!value) return null;
  return new Date(value);
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function isAfterOrEqual(date: Date | null, start: Date) {
  if (!date) return false;
  return date.getTime() >= start.getTime();
}

function calculateStats(sales: VehicleSale[]) {
  const ca = sales.reduce((total, sale) => total + Number(sale.sale_price || 0), 0);
  const margin = sales.reduce((total, sale) => total + Number(sale.margin_amount || 0), 0);
  const warranties = sales.filter(sale => sale.warranty_sold).length;
  const warrantyAmount = sales.reduce((total, sale) => total + Number(sale.warranty_amount || 0), 0);
  const averageMargin = sales.length > 0 ? margin / sales.length : 0;
  const warrantyRate = sales.length > 0 ? Math.round((warranties / sales.length) * 100) : 0;

  return {
    ca,
    margin,
    salesCount: sales.length,
    warranties,
    warrantyAmount,
    averageMargin,
    warrantyRate,
  };
}

export function Agences() {
  const [agentsList, setAgentsList] = useState<AgentOption[]>([]);
  const [sales, setSales] = useState<VehicleSale[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAgenciesPage() {
    setLoading(true);

    const { data: agentsData, error: agentsError } = await supabase
      .from('agents')
      .select('id, full_name, agency_id')
      .order('full_name', { ascending: true });

    const { data: salesData, error: salesError } = await supabase
      .from('vehicle_sales')
      .select(`
        *,
        agents!vehicle_sales_agent_id_fkey (
          full_name,
          agency_id
        )
      `)
      .order('id', { ascending: false });

    if (agentsError) {
      console.error('Erreur chargement agences/agents:', agentsError);
      setAgentsList([]);
    } else {
      setAgentsList(agentsData || []);
    }

    if (salesError) {
      console.error('Erreur chargement agences/ventes:', salesError);
      setSales([]);
    } else {
      setSales(salesData || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAgenciesPage();
  }, []);

  const agencyRows = useMemo(() => {
    const base = [
      { id: 1, agency: 'Blois', agents: 0, sales: 0, ca: 0, margin: 0, warranties: 0 },
      { id: 2, agency: 'Tours', agents: 0, sales: 0, ca: 0, margin: 0, warranties: 0 },
      { id: 3, agency: 'Bourges', agents: 0, sales: 0, ca: 0, margin: 0, warranties: 0 },
    ];

    agentsList.forEach((agent) => {
      const row = base.find(item => item.id === Number(agent.agency_id));
      if (row) row.agents += 1;
    });

    sales.forEach((sale) => {
      const agencyId = Number(sale.agents?.agency_id);
      const row = base.find(item => item.id === agencyId);

      if (!row) return;

      row.sales += 1;
      row.ca += Number(sale.sale_price || 0);
      row.margin += Number(sale.margin_amount || 0);
      row.warranties += sale.warranty_sold ? 1 : 0;
    });

    return base
      .map((row) => ({
        ...row,
        warrantyRate: row.sales > 0 ? Math.round((row.warranties / row.sales) * 100) : 0,
      }))
      .sort((a, b) => b.margin - a.margin);
  }, [agentsList, sales]);

  if (loading) {
    return (
      <div className="card">
        <p className="muted">Chargement des agences...</p>
      </div>
    );
  }

  return (
    <div className="grid cards3">
      {agencyRows.map((agency, index) => (
        <div className="card" key={agency.agency}>
          <h3>{index === 0 ? '👑 ' : ''}{agency.agency}</h3>
          <p className="muted">#{index + 1} au classement agences</p>
          <p>Agents : <strong>{agency.agents}</strong></p>
          <p>Ventes : <strong>{agency.sales}</strong></p>
          <p>CA total : <strong>{euro(agency.ca)}</strong></p>
          <p>Marge : <strong>{euro(agency.margin)}</strong></p>
          <p>Garanties : <strong>{agency.warranties}</strong></p>
          <p>Taux garantie : <strong>{agency.warrantyRate}%</strong></p>
          <button className="btn">Voir comparatif</button>
        </div>
      ))}
    </div>
  );
}

export function Agents() {
  const [agentsList, setAgentsList] = useState<AgentOption[]>([]);
  const [sales, setSales] = useState<VehicleSale[]>([]);
  const [documentsList, setDocumentsList] = useState<AgentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentOption | null>(null);

  const [fullName, setFullName] = useState('');
  const [agencyId, setAgencyId] = useState<number | ''>('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [status, setStatus] = useState('Actif');
  const [contractType, setContractType] = useState('');
  const [role, setRole] = useState('Agent commercial');
  const [notes, setNotes] = useState('');
  const [objectiveSales, setObjectiveSales] = useState('');
  const [objectiveMargin, setObjectiveMargin] = useState('');
  const [objectiveWarranties, setObjectiveWarranties] = useState('');
  const [vacationNotes, setVacationNotes] = useState('');
  const [absenceNotes, setAbsenceNotes] = useState('');

  async function loadAgentsPage() {
    setLoading(true);

    const { data: agentsData, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .order('full_name', { ascending: true });

    const { data: salesData, error: salesError } = await supabase
      .from('vehicle_sales')
      .select(`
        *,
        agents!vehicle_sales_agent_id_fkey (
          full_name,
          agency_id
        )
      `)
      .order('id', { ascending: false });

    const { data: documentsData, error: documentsError } = await supabase
      .from('agent_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (agentsError) {
      console.error('Erreur chargement agents:', agentsError);
      setAgentsList([]);
    } else {
      setAgentsList((agentsData || []) as AgentOption[]);
    }

    if (salesError) {
      console.error('Erreur chargement ventes agents:', salesError);
      setSales([]);
    } else {
      setSales(salesData || []);
    }

    if (documentsError) {
      console.error('Erreur chargement documents agents dans fiche agent:', documentsError);
      setDocumentsList([]);
    } else {
      setDocumentsList(documentsData || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAgentsPage();
  }, []);

  function resetForm() {
    setEditingAgent(null);
    setFullName('');
    setAgencyId('');
    setPhone('');
    setEmail('');
    setAddress('');
    setPostalCode('');
    setCity('');
    setBirthDate('');
    setEntryDate('');
    setStatus('Actif');
    setContractType('');
    setRole('Agent commercial');
    setNotes('');
    setObjectiveSales('');
    setObjectiveMargin('');
    setObjectiveWarranties('');
    setVacationNotes('');
    setAbsenceNotes('');
  }

  function openNewAgentForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditAgentForm(agent: AgentOption) {
    setEditingAgent(agent);
    setFullName(agent.full_name || '');
    setAgencyId(agent.agency_id || '');
    setPhone(agent.phone || '');
    setEmail(agent.email || '');
    setAddress(agent.address || '');
    setPostalCode(agent.postal_code || '');
    setCity(agent.city || '');
    setBirthDate(agent.birth_date || '');
    setEntryDate(agent.entry_date || '');
    setStatus(agent.status || 'Actif');
    setContractType(agent.contract_type || '');
    setRole(agent.role || 'Agent commercial');
    setNotes(agent.notes || '');
    setObjectiveSales(String(agent.objective_sales ?? ''));
    setObjectiveMargin(String(agent.objective_margin ?? ''));
    setObjectiveWarranties(String(agent.objective_warranties ?? ''));
    setVacationNotes(agent.vacation_notes || '');
    setAbsenceNotes(agent.absence_notes || '');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveAgent() {
    if (!fullName.trim()) {
      alert("Il faut indiquer le nom de l'agent.");
      return;
    }

    if (!agencyId) {
      alert("Il faut sélectionner une agence.");
      return;
    }

    setSaving(true);

    const payload = {
      full_name: fullName.trim(),
      agency_id: Number(agencyId),
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      postal_code: postalCode.trim() || null,
      city: city.trim() || null,
      birth_date: birthDate || null,
      entry_date: entryDate || null,
      status: status.trim() || 'Actif',
      contract_type: contractType.trim() || null,
      role: role.trim() || 'Agent commercial',
      notes: notes.trim() || null,
      objective_sales: objectiveSales ? Number(objectiveSales) : 0,
      objective_margin: objectiveMargin ? Number(objectiveMargin) : 0,
      objective_warranties: objectiveWarranties ? Number(objectiveWarranties) : 0,
      vacation_notes: vacationNotes.trim() || null,
      absence_notes: absenceNotes.trim() || null,
    };

    const { error } = editingAgent
      ? await supabase.from('agents').update(payload).eq('id', editingAgent.id)
      : await supabase.from('agents').insert(payload);

    if (error) {
      console.error('Erreur sauvegarde agent:', error);
      alert("Erreur pendant l'enregistrement de l'agent. Vérifie que les colonnes objectifs, congés et absences existent bien dans la table agents.");
    } else {
      resetForm();
      setShowForm(false);
      await loadAgentsPage();
    }

    setSaving(false);
  }

  async function deleteAgent() {
    if (!editingAgent) return;

    const ok = confirm(`Supprimer l'agent "${editingAgent.full_name}" ? Attention : si des ventes sont rattachées à cet agent, Supabase peut refuser la suppression.`);
    if (!ok) return;

    setSaving(true);

    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', editingAgent.id);

    if (error) {
      console.error('Erreur suppression agent:', error);
      alert("Erreur pendant la suppression de l'agent. Il a peut-être déjà des ventes rattachées.");
    } else {
      resetForm();
      setShowForm(false);
      await loadAgentsPage();
    }

    setSaving(false);
  }

  function progressPercent(value: number, objective: number) {
    if (!objective || objective <= 0) return 0;
    return Math.min(100, Math.round((value / objective) * 100));
  }

  function formatDate(value: string | null) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('fr-FR');
  }

  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  const agentRows = useMemo(() => {
    const rows = agentsList.map((agent) => {
      const agentSales = sales.filter(sale => Number(sale.agent_id) === Number(agent.id));
      const weekSales = agentSales.filter(sale => isAfterOrEqual(saleDateToDate(sale.sale_date), weekStart));
      const monthSales = agentSales.filter(sale => isAfterOrEqual(saleDateToDate(sale.sale_date), monthStart));
      const yearSales = agentSales.filter(sale => isAfterOrEqual(saleDateToDate(sale.sale_date), yearStart));

      const totalStats = calculateStats(agentSales);
      const weekStats = calculateStats(weekSales);
      const monthStats = calculateStats(monthSales);
      const yearStats = calculateStats(yearSales);

      return {
        ...agent,
        id: agent.id,
        name: agent.full_name,
        agency: agencyName(agent.agency_id),
        agentSales,
        weekStats,
        monthStats,
        yearStats,
        sales: totalStats.salesCount,
        ca: totalStats.ca,
        margin: totalStats.margin,
        warranties: totalStats.warranties,
        warrantyRate: totalStats.warrantyRate,
      };
    });

    const globalSorted = [...rows].sort((a, b) => b.margin - a.margin);

    return rows
      .map((row) => {
        const rankGlobal = globalSorted.findIndex(item => item.id === row.id) + 1;

        const agencySorted = globalSorted
          .filter(item => item.agency === row.agency)
          .sort((a, b) => b.margin - a.margin);

        const rankAgency = agencySorted.findIndex(item => item.id === row.id) + 1;

        return {
          ...row,
          rankGlobal,
          rankAgency,
        };
      })
      .sort((a, b) => a.rankGlobal - b.rankGlobal);
  }, [agentsList, sales]);

  const selectedAgentStats = editingAgent
    ? agentRows.find(a => Number(a.id) === Number(editingAgent.id))
    : null;

  const selectedAgentDocuments = editingAgent
    ? documentsList.filter((doc) => {
        if (doc.target_type === 'all') return true;
        if (doc.target_type === 'agency') return Number(doc.agency_id) === Number(editingAgent.agency_id);
        if (doc.target_type === 'agent') return Number(doc.agent_id) === Number(editingAgent.id);
        return false;
      })
    : [];

  const selectedAgentSales = selectedAgentStats?.agentSales || [];
  const monthlyObjectiveSales = Number(objectiveSales || editingAgent?.objective_sales || 0);
  const monthlyObjectiveMargin = Number(objectiveMargin || editingAgent?.objective_margin || 0);
  const monthlyObjectiveWarranties = Number(objectiveWarranties || editingAgent?.objective_warranties || 0);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h3>Agents commerciaux</h3>
          <p className="muted">Clique sur un agent pour ouvrir sa fiche complète : RH, objectifs, ventes, documents et classements.</p>
        </div>

        <button
          className="btn"
          onClick={() => {
            if (showForm && !editingAgent) {
              setShowForm(false);
            } else {
              openNewAgentForm();
            }
          }}
        >
          {showForm && !editingAgent ? 'Fermer' : 'Nouvel agent'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginTop: 14, marginBottom: 14 }}>
          <h4>{editingAgent ? `Fiche agent : ${editingAgent.full_name}` : 'Nouvel agent commercial'}</h4>

          {editingAgent && selectedAgentStats && (
            <div className="grid cards3" style={{ marginBottom: 14 }}>
              <div className="card">
                <h3>{selectedAgentStats.rankGlobal === 1 ? '👑 ' : ''}Classement global</h3>
                <div className="stat-value">#{selectedAgentStats.rankGlobal}</div>
                <p className="muted">Tous agents confondus</p>
              </div>

              <div className="card">
                <h3>Classement agence</h3>
                <div className="stat-value">#{selectedAgentStats.rankAgency}</div>
                <p className="muted">Agence {selectedAgentStats.agency}</p>
              </div>

              <div className="card">
                <h3>Taux garantie</h3>
                <div className="stat-value">{selectedAgentStats.warrantyRate}%</div>
                <p className="muted">{selectedAgentStats.warranties} garantie(s) sur {selectedAgentStats.sales} vente(s)</p>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gap: 10 }}>
            <div className="item">
              <strong>Informations agent</strong>
              <p className="muted">Identité, coordonnées et situation interne.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', gap: 10 }}>
              <input placeholder="Nom complet ex : Maveryk Leveau" value={fullName} onChange={(e) => setFullName(e.target.value)} />

              <select value={agencyId} onChange={(e) => setAgencyId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Sélectionner une agence</option>
                <option value={1}>Blois</option>
                <option value={2}>Tours</option>
                <option value={3}>Bourges</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 10 }}>
              <input placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Actif">Actif</option>
                <option value="En pause">En pause</option>
                <option value="Sorti">Sorti</option>
              </select>
            </div>

            <input placeholder="Adresse" value={address} onChange={(e) => setAddress(e.target.value)} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 10 }}>
              <input placeholder="Code postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              <input placeholder="Ville" value={city} onChange={(e) => setCity(e.target.value)} />
              <input type="date" title="Date de naissance" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              <input type="date" title="Date d'entrée entreprise" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', gap: 10 }}>
              <input placeholder="Poste / rôle ex : Agent commercial" value={role} onChange={(e) => setRole(e.target.value)} />
              <input placeholder="Type de contrat / statut ex : Agent co indépendant" value={contractType} onChange={(e) => setContractType(e.target.value)} />
            </div>

            <div className="item">
              <strong>Objectifs mensuels</strong>
              <p className="muted">Ces objectifs servent à suivre automatiquement la progression de l'agent.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))', gap: 10 }}>
              <input type="number" placeholder="Objectif ventes / mois" value={objectiveSales} onChange={(e) => setObjectiveSales(e.target.value)} />
              <input type="number" placeholder="Objectif marge / mois" value={objectiveMargin} onChange={(e) => setObjectiveMargin(e.target.value)} />
              <input type="number" placeholder="Objectif garanties / mois" value={objectiveWarranties} onChange={(e) => setObjectiveWarranties(e.target.value)} />
            </div>

            {editingAgent && selectedAgentStats && (
              <div className="grid cards3">
                <div className="item">
                  <span className="muted">Objectif ventes</span>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{selectedAgentStats.monthStats.salesCount} / {monthlyObjectiveSales || 0}</div>
                  <p className="muted">Progression : {progressPercent(selectedAgentStats.monthStats.salesCount, monthlyObjectiveSales)}%</p>
                </div>

                <div className="item">
                  <span className="muted">Objectif marge</span>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{euro(selectedAgentStats.monthStats.margin)} / {euro(monthlyObjectiveMargin || 0)}</div>
                  <p className="muted">Progression : {progressPercent(selectedAgentStats.monthStats.margin, monthlyObjectiveMargin)}%</p>
                </div>

                <div className="item">
                  <span className="muted">Objectif garanties</span>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{selectedAgentStats.monthStats.warranties} / {monthlyObjectiveWarranties || 0}</div>
                  <p className="muted">Progression : {progressPercent(selectedAgentStats.monthStats.warranties, monthlyObjectiveWarranties)}%</p>
                </div>
              </div>
            )}

            <div className="item">
              <strong>Congés et absences</strong>
              <p className="muted">Suivi simple pour cette première version. Le calendrier congés détaillé pourra venir après.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', gap: 10 }}>
              <textarea placeholder="Congés prévus / vacances / indisponibilités..." value={vacationNotes} onChange={(e) => setVacationNotes(e.target.value)} />
              <textarea placeholder="Absences / retards / remarques RH..." value={absenceNotes} onChange={(e) => setAbsenceNotes(e.target.value)} />
            </div>

            <textarea placeholder="Notes internes : objectifs, points forts, points à travailler, infos utiles..." value={notes} onChange={(e) => setNotes(e.target.value)} />

            {editingAgent && selectedAgentStats && (
              <>
                <div className="item">
                  <strong>Performance commerciale</strong>
                  <p className="muted">Calcul automatique depuis les ventes de l'agent.</p>
                </div>

                <div className="grid cards3">
                  <div className="card">
                    <h3>Semaine</h3>
                    <div className="stat-value">{euro(selectedAgentStats.weekStats.ca)}</div>
                    <p className="muted">{selectedAgentStats.weekStats.salesCount} vente(s)</p>
                    <p>Marge : <strong>{euro(selectedAgentStats.weekStats.margin)}</strong></p>
                    <p>Garanties : <strong>{selectedAgentStats.weekStats.warranties}</strong></p>
                  </div>

                  <div className="card">
                    <h3>Mois</h3>
                    <div className="stat-value">{euro(selectedAgentStats.monthStats.ca)}</div>
                    <p className="muted">{selectedAgentStats.monthStats.salesCount} vente(s)</p>
                    <p>Marge : <strong>{euro(selectedAgentStats.monthStats.margin)}</strong></p>
                    <p>Garanties : <strong>{selectedAgentStats.monthStats.warranties}</strong></p>
                  </div>

                  <div className="card">
                    <h3>Année</h3>
                    <div className="stat-value">{euro(selectedAgentStats.yearStats.ca)}</div>
                    <p className="muted">{selectedAgentStats.yearStats.salesCount} vente(s)</p>
                    <p>Marge : <strong>{euro(selectedAgentStats.yearStats.margin)}</strong></p>
                    <p>Garanties : <strong>{selectedAgentStats.yearStats.warranties}</strong></p>
                  </div>
                </div>

                <div className="card">
                  <h3>Véhicules vendus par cet agent</h3>

                  {selectedAgentSales.length === 0 ? (
                    <p className="muted">Aucune vente rattachée à cet agent pour le moment.</p>
                  ) : (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Véhicule</th>
                          <th>Prix vente</th>
                          <th>Marge</th>
                          <th>Garantie</th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectedAgentSales.map((sale) => (
                          <tr key={sale.id}>
                            <td>{formatDate(sale.sale_date)}</td>
                            <td>
                              <strong>{sale.vehicle_name || '-'}</strong>
                              {(sale.registration || sale.vin) && (
                                <div className="muted" style={{ fontSize: 12 }}>
                                  {sale.registration ? `Immat: ${sale.registration}` : ''}
                                  {sale.registration && sale.vin ? ' — ' : ''}
                                  {sale.vin ? `VIN: ${sale.vin}` : ''}
                                </div>
                              )}
                            </td>
                            <td>{euro(Number(sale.sale_price || 0))}</td>
                            <td><strong>{euro(Number(sale.margin_amount || 0))}</strong></td>
                            <td>
                              {sale.warranty_sold
                                ? `${sale.warranty_type || 'Oui'}${sale.warranty_amount ? ` — ${euro(Number(sale.warranty_amount))}` : ''}`
                                : 'Non'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="card">
                  <h3>Documents visibles pour cet agent</h3>

                  {selectedAgentDocuments.length === 0 ? (
                    <p className="muted">Aucun document rattaché à cet agent, son agence ou tous les agents.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {selectedAgentDocuments.map((doc) => (
                        <div className="item" key={doc.id}>
                          <strong>{doc.title}</strong>
                          <p className="muted">{doc.category || 'Général'}</p>
                          {doc.description && <p style={{ whiteSpace: 'pre-wrap' }}>{doc.description}</p>}
                          {doc.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noreferrer">
                              Ouvrir le document
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={saveAgent} disabled={saving}>
                {saving ? 'Enregistrement...' : editingAgent ? 'Modifier la fiche agent' : "Créer l'agent"}
              </button>

              {editingAgent && <button onClick={deleteAgent} disabled={saving}>Supprimer</button>}

              <button onClick={() => { resetForm(); setShowForm(false); }} disabled={saving}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {loading && <p className="muted">Chargement des agents...</p>}

      {!loading && agentRows.length === 0 && (
        <p className="muted">Aucun agent trouvé dans Supabase.</p>
      )}

      {!loading && agentRows.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Agence</th>
              <th>Téléphone</th>
              <th>Email</th>
              <th>Ventes</th>
              <th>CA</th>
              <th>Marge</th>
              <th>Garanties</th>
              <th>Classement</th>
            </tr>
          </thead>

          <tbody>
            {agentRows.map(agent => (
              <tr key={agent.id} onClick={() => openEditAgentForm(agent)} style={{ cursor: 'pointer' }} title="Cliquer pour modifier la fiche agent">
                <td>
                  <strong>{agent.rankGlobal === 1 ? '👑 ' : ''}{agent.name}</strong>
                  {agent.role && <div className="muted" style={{ fontSize: 12 }}>{agent.role}</div>}
                  {agent.status && <div className="muted" style={{ fontSize: 12 }}>Statut : {agent.status}</div>}
                </td>
                <td><span className="badge">{agent.agency}</span></td>
                <td>{agent.phone || '-'}</td>
                <td>{agent.email || '-'}</td>
                <td>{agent.sales}</td>
                <td>{euro(agent.ca)}</td>
                <td><strong>{euro(agent.margin)}</strong></td>
                <td>{agent.warranties}</td>
                <td>#{agent.rankGlobal} global / #{agent.rankAgency} agence</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
export function ObjectifsMensuels() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const [agentsList, setAgentsList] = useState<AgentOption[]>([]);
  const [objectives, setObjectives] = useState<MonthlyObjective[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedAgencyId, setSelectedAgencyId] = useState<number | ''>('');
  const [selectedAgentId, setSelectedAgentId] = useState<number | ''>('');
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth));

  const [salesTarget, setSalesTarget] = useState('');
  const [marginTarget, setMarginTarget] = useState('');
  const [warrantyTarget, setWarrantyTarget] = useState('');

  async function loadObjectivesPage() {
    setLoading(true);

    const { data: agentsData, error: agentsError } = await supabase
      .from('agents')
      .select('id, full_name, agency_id')
      .order('full_name', { ascending: true });

    const { data: objectivesData, error: objectivesError } = await supabase
      .from('monthly_objectives')
      .select('*')
      .order('year_number', { ascending: false })
      .order('month_number', { ascending: false })
      .order('agency_id', { ascending: true })
      .order('agent_id', { ascending: true });

    if (agentsError) {
      console.error('Erreur chargement agents objectifs mensuels:', agentsError);
      setAgentsList([]);
    } else {
      setAgentsList((agentsData || []) as AgentOption[]);
    }

    if (objectivesError) {
      console.error('Erreur chargement objectifs mensuels:', objectivesError);
      setObjectives([]);
    } else {
      setObjectives((objectivesData || []) as MonthlyObjective[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadObjectivesPage();
  }, []);

  const filteredAgents = useMemo(() => {
    if (!selectedAgencyId) return agentsList;
    return agentsList.filter(agent => Number(agent.agency_id) === Number(selectedAgencyId));
  }, [agentsList, selectedAgencyId]);

  useEffect(() => {
    if (!selectedAgentId) return;

    const selectedAgent = agentsList.find(agent => Number(agent.id) === Number(selectedAgentId));

    if (selectedAgencyId && selectedAgent && Number(selectedAgent.agency_id) !== Number(selectedAgencyId)) {
      setSelectedAgentId('');
    }
  }, [selectedAgencyId, selectedAgentId, agentsList]);

  const selectedObjective = useMemo(() => {
    if (!selectedAgentId || !selectedYear || !selectedMonth) return null;

    return objectives.find(objective =>
      Number(objective.agent_id) === Number(selectedAgentId) &&
      Number(objective.year_number) === Number(selectedYear) &&
      Number(objective.month_number) === Number(selectedMonth)
    ) || null;
  }, [objectives, selectedAgentId, selectedYear, selectedMonth]);

  useEffect(() => {
    if (selectedObjective) {
      setSalesTarget(String(selectedObjective.sales_target ?? ''));
      setMarginTarget(String(selectedObjective.margin_target ?? ''));
      setWarrantyTarget(String(selectedObjective.warranty_target ?? ''));
    } else {
      setSalesTarget('');
      setMarginTarget('');
      setWarrantyTarget('');
    }
  }, [selectedObjective]);

  async function saveMonthlyObjective() {
    if (!selectedAgencyId) {
      alert('Il faut sélectionner une agence.');
      return;
    }

    if (!selectedAgentId) {
      alert('Il faut sélectionner un agent commercial.');
      return;
    }

    if (!selectedYear || !selectedMonth) {
      alert("Il faut sélectionner l'année et le mois.");
      return;
    }

    setSaving(true);

    const payload = {
      agent_id: Number(selectedAgentId),
      agency_id: Number(selectedAgencyId),
      year_number: Number(selectedYear),
      month_number: Number(selectedMonth),
      sales_target: Number(salesTarget || 0),
      margin_target: Number(marginTarget || 0),
      warranty_target: Number(warrantyTarget || 0),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('monthly_objectives')
      .upsert(payload, {
        onConflict: 'agent_id,year_number,month_number',
      });

    if (error) {
      console.error('Erreur sauvegarde objectif mensuel:', error);
      alert("Erreur pendant l'enregistrement de l'objectif mensuel. Vérifie que la table monthly_objectives existe bien et que la contrainte unique est créée.");
    } else {
      alert('Objectifs mensuels enregistrés.');
      await loadObjectivesPage();
    }

    setSaving(false);
  }

  const objectiveRows = useMemo(() => {
    return objectives
      .map((objective) => {
        const agent = agentsList.find(item => Number(item.id) === Number(objective.agent_id));

        return {
          ...objective,
          agentName: agent?.full_name || `Agent #${objective.agent_id}`,
          agencyName: agencyName(objective.agency_id || agent?.agency_id),
        };
      })
      .sort((a, b) => {
        if (Number(b.year_number) !== Number(a.year_number)) return Number(b.year_number) - Number(a.year_number);
        if (Number(b.month_number) !== Number(a.month_number)) return Number(b.month_number) - Number(a.month_number);
        return String(a.agentName).localeCompare(String(b.agentName));
      });
  }, [objectives, agentsList]);

  return (
    <div className="section">
      <div className="card">
        <h3>Objectifs mensuels</h3>
        <p className="muted">
          Définis des objectifs différents par agence, par agent commercial, par année et par mois.
          Ces objectifs serviront ensuite au tableau de bord agent avec la progression réelle du mois.
        </p>
      </div>

      <div className="card">
        <h3>Définir les objectifs d'un agent</h3>

        <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          <div className="item">
            <strong>Sélection</strong>
            <p className="muted" style={{ marginTop: 5 }}>
              Ordre conseillé : agence → agent commercial → année → mois.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: 10 }}>
            <select
              value={selectedAgencyId}
              onChange={(e) => setSelectedAgencyId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Sélectionner une agence</option>
              <option value={1}>Blois</option>
              <option value={2}>Tours</option>
              <option value={3}>Bourges</option>
            </select>

            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value ? Number(e.target.value) : '')}
              disabled={!selectedAgencyId}
            >
              <option value="">Sélectionner un agent</option>
              {filteredAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.full_name} — {agencyName(agent.agency_id)}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Année"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            />

            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              {monthNames.map((month, index) => (
                <option key={index + 1} value={String(index + 1)}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          <div className="item">
            <strong>Objectifs du mois</strong>
            <p className="muted" style={{ marginTop: 5 }}>
              Si un objectif existe déjà pour cet agent sur ce mois, il sera mis à jour au lieu de créer un doublon.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="muted">Objectif ventes</span>
              <input
                type="number"
                placeholder="Ex : 10"
                value={salesTarget}
                onChange={(e) => setSalesTarget(e.target.value)}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span className="muted">Objectif marge</span>
              <input
                type="number"
                placeholder="Ex : 15000"
                value={marginTarget}
                onChange={(e) => setMarginTarget(e.target.value)}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span className="muted">Objectif garanties</span>
              <input
                type="number"
                placeholder="Ex : 5"
                value={warrantyTarget}
                onChange={(e) => setWarrantyTarget(e.target.value)}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={saveMonthlyObjective} disabled={saving || loading}>
              {saving ? 'Enregistrement...' : selectedObjective ? 'Modifier les objectifs du mois' : 'Enregistrer les objectifs du mois'}
            </button>

            <button
              onClick={() => {
                setSalesTarget('');
                setMarginTarget('');
                setWarrantyTarget('');
              }}
              disabled={saving}
            >
              Effacer les champs
            </button>
          </div>
        </div>
      </div>

      <div className="grid cards3">
        <div className="card">
          <h3>Objectifs enregistrés</h3>
          <div className="stat-value">{objectiveRows.length}</div>
          <p className="muted">Toutes périodes confondues</p>
        </div>

        <div className="card">
          <h3>Année sélectionnée</h3>
          <div className="stat-value">{selectedYear}</div>
          <p className="muted">Objectifs consultés / modifiés</p>
        </div>

        <div className="card">
          <h3>Mois sélectionné</h3>
          <div className="stat-value">{monthNames[Number(selectedMonth || 1) - 1] || '-'}</div>
          <p className="muted">Période de travail</p>
        </div>
      </div>

      <div className="card">
        <h3>Historique des objectifs mensuels</h3>

        {loading && <p className="muted">Chargement des objectifs mensuels...</p>}

        {!loading && objectiveRows.length === 0 && (
          <p className="muted">Aucun objectif mensuel enregistré pour le moment.</p>
        )}

        {!loading && objectiveRows.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Période</th>
                <th>Agence</th>
                <th>Agent</th>
                <th>Objectif ventes</th>
                <th>Objectif marge</th>
                <th>Objectif garanties</th>
              </tr>
            </thead>

            <tbody>
              {objectiveRows.map((objective) => (
                <tr
                  key={objective.id}
                  onClick={() => {
                    setSelectedAgencyId(Number(objective.agency_id));
                    setSelectedAgentId(Number(objective.agent_id));
                    setSelectedYear(String(objective.year_number));
                    setSelectedMonth(String(objective.month_number));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  style={{ cursor: 'pointer' }}
                  title="Cliquer pour modifier cet objectif"
                >
                  <td>
                    <strong>{monthNames[Number(objective.month_number || 1) - 1]} {objective.year_number}</strong>
                  </td>
                  <td><span className="badge">{objective.agencyName}</span></td>
                  <td>{objective.agentName}</td>
                  <td>{objective.sales_target}</td>
                  <td><strong>{euro(Number(objective.margin_target || 0))}</strong></td>
                  <td>{objective.warranty_target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


export function Leads() {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  function getWeekNumberFromDate(date: Date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  function getMondayForWeekLabel(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatWeekDateLabel(date: Date) {
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
    });
  }

  function getWeekOptionsForMonth(year: number, month: number) {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    const firstMonday = getMondayForWeekLabel(firstDayOfMonth);
    const options: { value: string; label: string }[] = [];
    const seen = new Set<number>();

    for (let date = new Date(firstMonday); date <= lastDayOfMonth; date.setDate(date.getDate() + 7)) {
      const weekNumberValue = getWeekNumberFromDate(date);
      if (seen.has(weekNumberValue)) continue;
      seen.add(weekNumberValue);

      const weekStart = new Date(date);
      const weekEnd = new Date(date);
      weekEnd.setDate(weekEnd.getDate() + 6);

      options.push({
        value: String(weekNumberValue),
        label: `Semaine ${weekNumberValue} — du ${formatWeekDateLabel(weekStart)} au ${formatWeekDateLabel(weekEnd)}`,
      });
    }

    return options;
  }

  const currentWeek = getWeekNumberFromDate(now);

  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadItem | null>(null);

  const [yearNumber, setYearNumber] = useState(String(currentYear));
  const [monthNumber, setMonthNumber] = useState(String(currentMonth));
  const [weekNumber, setWeekNumber] = useState(String(currentWeek));
  const [agencyId, setAgencyId] = useState<number | ''>('');
  const [agentId, setAgentId] = useState<number | ''>('');
  const [source, setSource] = useState('Call Center');
  const [status, setStatus] = useState('Nouveau');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleRegistration, setVehicleRegistration] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleMileage, setVehicleMileage] = useState('');
  const [leadDate, setLeadDate] = useState(today);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [sellerExpectedPrice, setSellerExpectedPrice] = useState('');
  const [sellerNetPrice, setSellerNetPrice] = useState('');
  const [mandateSigned, setMandateSigned] = useState(false);
  const [vehicleEntered, setVehicleEntered] = useState(false);
  const [saleDone, setSaleDone] = useState(false);
  const [salePrice, setSalePrice] = useState('');
  const [saleRoadFees, setSaleRoadFees] = useState('');
  const [marginAmount, setMarginAmount] = useState('');
  const [warrantySold, setWarrantySold] = useState(false);
  const [warrantyType, setWarrantyType] = useState('');
  const [warrantyAmount, setWarrantyAmount] = useState('');
  const [comments, setComments] = useState('');

  const leadSources = ['Call Center', 'Démarchage Agent', 'Visite spontanée', 'Leboncoin', 'Facebook', 'Google', 'Recommandation', 'Passage agence', 'Autre'];
  const leadStatuses = ['Nouveau', 'RDV pris', 'RDV effectué', 'Véhicule rentré', 'Mandat signé', 'Véhicule vendu', 'À relancer', 'Perdu', 'Refusé'];
  const warrantyOptions = [
    { label: 'START - 6 mois - 0 €', value: 'START - 6 mois', amount: 0 },
    { label: 'MEDIUM - 12 mois - 799 €', value: 'MEDIUM - 12 mois', amount: 799 },
    { label: 'MEDIUM - 24 mois - 999 €', value: 'MEDIUM - 24 mois', amount: 999 },
    { label: 'PREMIUM - 12 mois - 1299 €', value: 'PREMIUM - 12 mois', amount: 1299 },
    { label: 'PREMIUM - 24 mois - 1799 €', value: 'PREMIUM - 24 mois', amount: 1799 },
    { label: 'PRESTIGE - 36 mois - 2499 €', value: 'PRESTIGE - 36 mois', amount: 2499 },
  ];

  const weekOptions = useMemo(() => {
    return getWeekOptionsForMonth(Number(yearNumber || currentYear), Number(monthNumber || currentMonth));
  }, [yearNumber, monthNumber]);

  useEffect(() => {
    if (weekOptions.length === 0) return;
    const weekExists = weekOptions.some(option => option.value === weekNumber);
    if (!weekExists) {
      setWeekNumber(weekOptions[0].value);
    }
  }, [weekOptions, weekNumber]);

  const calculatedLeadMargin = useMemo(() => {
    const sale = Number(salePrice || 0);
    const seller = Number(sellerNetPrice || 0);
    const roadFees = Number(saleRoadFees || 0);
    const warranty = warrantySold ? Number(warrantyAmount || 0) : 0;
    return sale + roadFees + warranty - seller;
  }, [salePrice, sellerNetPrice, saleRoadFees, warrantySold, warrantyAmount]);

  function handleWarrantyTypeChange(value: string) {
    setWarrantyType(value);

    if (!value) {
      setWarrantySold(false);
      setWarrantyAmount('');
      return;
    }

    const selectedWarranty = warrantyOptions.find(option => option.value === value);
    setWarrantySold(true);
    setWarrantyAmount(String(selectedWarranty?.amount ?? 0));
  }

  async function loadAgents() {
    const { data, error } = await supabase
      .from('agents')
      .select('id, full_name, agency_id')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Erreur chargement agents leads:', error);
      setAgentOptions([]);
    } else {
      setAgentOptions(data || []);
    }
  }

  async function loadLeads() {
    setLoading(true);

    const { data, error } = await supabase
      .from('leads')
      .select('*, agents (full_name, agency_id)')
      .order('id', { ascending: false });

    if (error) {
      console.error('Erreur chargement leads:', error);
      setLeads([]);
    } else {
      setLeads((data || []) as LeadItem[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAgents();
    loadLeads();
  }, []);

  function resetForm() {
    setEditingLead(null);
    setYearNumber(String(currentYear));
    setMonthNumber(String(currentMonth));
    setWeekNumber(String(currentWeek));
    setAgencyId('');
    setAgentId('');
    setSource('Call Center');
    setStatus('Nouveau');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setVehicleBrand('');
    setVehicleModel('');
    setVehicleRegistration('');
    setVehicleYear('');
    setVehicleMileage('');
    setLeadDate(today);
    setAppointmentDate('');
    setAppointmentTime('');
    setSellerExpectedPrice('');
    setSellerNetPrice('');
    setMandateSigned(false);
    setVehicleEntered(false);
    setSaleDone(false);
    setSalePrice('');
    setSaleRoadFees('');
    setMarginAmount('');
    setWarrantySold(false);
    setWarrantyType('');
    setWarrantyAmount('');
    setComments('');
  }

  function openNewLeadForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditLeadForm(lead: LeadItem) {
    setEditingLead(lead);
    setYearNumber(String(lead.year_number || currentYear));
    setMonthNumber(String(lead.month_number || currentMonth));
    setWeekNumber(String(lead.week_number || ''));
    setAgencyId(lead.agency_id || lead.agents?.agency_id || '');
    setAgentId(lead.agent_id || '');
    setSource(lead.source || 'Call Center');
    setStatus(lead.status || 'Nouveau');
    setCustomerName(lead.customer_name || '');
    setCustomerPhone(lead.customer_phone || '');
    setCustomerEmail(lead.customer_email || '');
    setVehicleBrand(lead.vehicle_brand || '');
    setVehicleModel(lead.vehicle_model || '');
    setVehicleRegistration(lead.vehicle_registration || '');
    setVehicleYear(String(lead.vehicle_year ?? ''));
    setVehicleMileage(String(lead.vehicle_mileage ?? ''));
    setLeadDate(lead.lead_date || today);
    setAppointmentDate(lead.appointment_date || '');
    setAppointmentTime(lead.appointment_time || '');
    setSellerExpectedPrice(String(lead.seller_expected_price ?? ''));
    setSellerNetPrice(String(lead.seller_net_price ?? ''));
    setMandateSigned(Boolean(lead.mandate_signed));
    setVehicleEntered(Boolean(lead.vehicle_entered));
    setSaleDone(Boolean(lead.sale_done));
    setSalePrice(String(lead.sale_price ?? ''));
    setSaleRoadFees('');
    setMarginAmount(String(lead.margin_amount ?? ''));
    setWarrantySold(Boolean(lead.warranty_sold));
    setWarrantyType(lead.warranty_sold ? 'Garantie déjà renseignée' : '');
    setWarrantyAmount(String(lead.warranty_amount ?? ''));
    setComments(lead.comments || '');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function createOrUpdateSaleFromLead(savedLead: LeadItem, finalAgencyId: number | null, finalMarginAmount: number) {
    if (!saleDone) return;

    const leadId = savedLead?.id || editingLead?.id;

    if (!leadId) {
      alert('Lead enregistré, mais la vente automatique n’a pas pu être créée car l’identifiant du lead est introuvable.');
      return;
    }

    const marker = `Lead #${leadId}`;
    const vehicleName = [vehicleBrand.trim(), vehicleModel.trim()].filter(Boolean).join(' ') || `Véhicule ${marker}`;
    const saleValue = Number(salePrice || 0);
    const sellerValue = Number(sellerNetPrice || 0);
    const warrantyValue = Number(warrantyAmount || 0);

    const saleComments = [
      comments.trim(),
      `Créée automatiquement depuis ${marker}`,
      customerName.trim() ? `Client lead : ${customerName.trim()}` : '',
      customerPhone.trim() ? `Téléphone lead : ${customerPhone.trim()}` : '',
      source ? `Source lead : ${source}` : '',
      saleRoadFees ? `Frais de mise à la route : ${saleRoadFees} €` : '',
      warrantySold && warrantyType ? `Garantie choisie : ${warrantyType}` : '',
    ].filter(Boolean).join('\n');

    const salePayload = {
      agent_id: Number(agentId),
      weekly_report_id: 1,
      sale_date: appointmentDate || leadDate || today,
      vehicle_name: vehicleName,
      vehicle_photo_url: null,
      seller_price: sellerValue,
      sale_price: saleValue,
      margin_amount: finalMarginAmount,
      warranty_sold: warrantySold,
      warranty_type: warrantySold ? warrantyType || 'Garantie vendue depuis lead' : null,
      warranty_amount: warrantySold ? warrantyValue : 0,
      registration: vehicleRegistration.trim() || null,
      vin: null,
      comments: saleComments,
    };

    const { data: existingSales, error: existingError } = await supabase
      .from('vehicle_sales')
      .select('id')
      .ilike('comments', `%${marker}%`)
      .limit(1);

    if (existingError) {
      console.error('Erreur recherche vente liée au lead:', existingError);
      alert('Lead enregistré, mais la vérification de vente liée a échoué. La vente n’a pas été créée pour éviter un doublon.');
      return;
    }

    if (existingSales && existingSales.length > 0) {
      const { error: updateSaleError } = await supabase
        .from('vehicle_sales')
        .update(salePayload)
        .eq('id', existingSales[0].id);

      if (updateSaleError) {
        console.error('Erreur mise à jour vente depuis lead:', updateSaleError);
        alert('Lead enregistré, mais erreur pendant la mise à jour de la vente liée.');
      }

      return;
    }

    const { error: insertSaleError } = await supabase
      .from('vehicle_sales')
      .insert(salePayload);

    if (insertSaleError) {
      console.error('Erreur création vente depuis lead:', insertSaleError);
      alert('Lead enregistré, mais erreur pendant la création automatique de la vente.');
    }
  }

  async function saveLead() {
    if (!customerName.trim()) {
      alert('Il faut indiquer le nom du client.');
      return;
    }

    if (!agentId) {
      alert('Il faut sélectionner un agent commercial.');
      return;
    }

    if (saleDone && (!sellerNetPrice || !salePrice)) {
      alert('Pour transformer le lead en vente, il faut indiquer le prix net vendeur et le prix de vente.');
      return;
    }

    const selectedAgent = agentOptions.find(agent => Number(agent.id) === Number(agentId));
    const finalAgencyId = agencyId || selectedAgent?.agency_id || null;
    const finalMarginAmount = saleDone
      ? calculatedLeadMargin
      : Number(marginAmount || 0);

    setSaving(true);

    const payload = {
      year_number: Number(yearNumber || currentYear),
      month_number: Number(monthNumber || currentMonth),
      week_number: weekNumber ? Number(weekNumber) : null,
      agency_id: finalAgencyId ? Number(finalAgencyId) : null,
      agent_id: Number(agentId),
      source,
      status: saleDone ? 'Véhicule vendu' : status,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim() || null,
      customer_email: customerEmail.trim() || null,
      vehicle_brand: vehicleBrand.trim() || null,
      vehicle_model: vehicleModel.trim() || null,
      vehicle_registration: vehicleRegistration.trim() || null,
      vehicle_year: vehicleYear ? Number(vehicleYear) : null,
      vehicle_mileage: vehicleMileage ? Number(vehicleMileage) : null,
      lead_date: leadDate || null,
      appointment_date: appointmentDate || null,
      appointment_time: appointmentTime.trim() || null,
      seller_expected_price: Number(sellerExpectedPrice || 0),
      seller_net_price: Number(sellerNetPrice || 0),
      mandate_signed: saleDone ? true : mandateSigned,
      vehicle_entered: saleDone ? true : vehicleEntered,
      sale_done: saleDone,
      sale_price: Number(salePrice || 0),
      margin_amount: finalMarginAmount,
      warranty_sold: warrantySold,
      warranty_amount: Number(warrantyAmount || 0),
      comments: comments.trim() || null,
    };

    const response = editingLead
      ? await supabase.from('leads').update(payload).eq('id', editingLead.id).select('*').single()
      : await supabase.from('leads').insert(payload).select('*').single();

    if (response.error) {
      console.error('Erreur sauvegarde lead:', response.error);
      alert("Erreur pendant l'enregistrement du lead.");
      setSaving(false);
      return;
    }

    await createOrUpdateSaleFromLead(response.data as LeadItem, finalAgencyId ? Number(finalAgencyId) : null, finalMarginAmount);

    resetForm();
    setShowForm(false);
    await loadLeads();
    setSaving(false);
  }

  async function deleteLead() {
    if (!editingLead) return;

    const ok = confirm(`Supprimer le lead "${editingLead.customer_name}" ?`);
    if (!ok) return;

    setSaving(true);

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', editingLead.id);

    if (error) {
      console.error('Erreur suppression lead:', error);
      alert('Erreur pendant la suppression du lead.');
    } else {
      resetForm();
      setShowForm(false);
      await loadLeads();
    }

    setSaving(false);
  }

  function formatDate(value: string | null) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('fr-FR');
  }

  const filteredLeads = leads.filter((lead) => {
    const q = search.toLowerCase().trim();

    if (!q) return true;

    const content = [
      lead.customer_name,
      lead.customer_phone,
      lead.customer_email,
      lead.vehicle_brand,
      lead.vehicle_model,
      lead.vehicle_registration,
      lead.source,
      lead.status,
      lead.agents?.full_name,
      agencyName(lead.agency_id || lead.agents?.agency_id),
      lead.comments,
    ].join(' ').toLowerCase();

    return content.includes(q);
  });

  const stats = useMemo(() => {
    const total = filteredLeads.length;
    const appointments = filteredLeads.filter(lead => ['RDV pris', 'RDV effectué', 'Véhicule rentré', 'Mandat signé', 'Véhicule vendu'].includes(lead.status || '')).length;
    const enteredVehicles = filteredLeads.filter(lead => lead.vehicle_entered || ['Véhicule rentré', 'Mandat signé', 'Véhicule vendu'].includes(lead.status || '')).length;
    const mandates = filteredLeads.filter(lead => lead.mandate_signed || ['Mandat signé', 'Véhicule vendu'].includes(lead.status || '')).length;
    const sales = filteredLeads.filter(lead => lead.sale_done || lead.status === 'Véhicule vendu').length;
    const warranties = filteredLeads.filter(lead => lead.warranty_sold).length;
    const margin = filteredLeads.reduce((totalMargin, lead) => totalMargin + Number(lead.margin_amount || 0), 0);
    const conversionRate = total > 0 ? Math.round((sales / total) * 100) : 0;

    return { total, appointments, enteredVehicles, mandates, sales, warranties, margin, conversionRate };
  }, [filteredLeads]);

  const sourceStats = useMemo(() => {
    const map = new Map<string, { source: string; total: number; appointments: number; vehicles: number; sales: number; margin: number; conversionRate: number; }>();

    filteredLeads.forEach((lead) => {
      const key = lead.source || 'Autre';
      const current = map.get(key) || { source: key, total: 0, appointments: 0, vehicles: 0, sales: 0, margin: 0, conversionRate: 0 };

      current.total += 1;

      if (['RDV pris', 'RDV effectué', 'Véhicule rentré', 'Mandat signé', 'Véhicule vendu'].includes(lead.status || '')) {
        current.appointments += 1;
      }

      if (lead.vehicle_entered || ['Véhicule rentré', 'Mandat signé', 'Véhicule vendu'].includes(lead.status || '')) {
        current.vehicles += 1;
      }

      if (lead.sale_done || lead.status === 'Véhicule vendu') {
        current.sales += 1;
      }

      current.margin += Number(lead.margin_amount || 0);
      current.conversionRate = current.total > 0 ? Math.round((current.sales / current.total) * 100) : 0;

      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) => b.sales - a.sales);
  }, [filteredLeads]);

  return (
    <div className="section">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h3>Leads et rendez-vous</h3>
            <p className="muted">Le lead devient la base de travail : recherche par plaque/modèle, puis transformation automatique en vente quand le véhicule est vendu.</p>
          </div>

          <button
            className="btn"
            onClick={() => {
              if (showForm && !editingLead) {
                setShowForm(false);
              } else {
                openNewLeadForm();
              }
            }}
          >
            {showForm && !editingLead ? 'Fermer' : 'Nouveau lead'}
          </button>
        </div>

        {showForm && (
          <div className="card" style={{ marginTop: 14, marginBottom: 14 }}>
            <h4>{editingLead ? 'Modifier le lead' : 'Nouveau lead / RDV'}</h4>

            <div style={{ display: 'grid', gap: 10 }}>
              <div className="item">
                <strong>1. Informations semaine</strong>
                <p className="muted">Ces informations permettront de ressortir automatiquement les leads dans le futur rapport de semaine.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))', gap: 10 }}>
                <input type="number" placeholder="Année" value={yearNumber} onChange={(e) => setYearNumber(e.target.value)} />
                <select value={monthNumber} onChange={(e) => setMonthNumber(e.target.value)}>
                  {Array.from({ length: 12 }, (_, index) => (
                    <option key={index + 1} value={String(index + 1)}>{index + 1}</option>
                  ))}
                </select>
                <select value={weekNumber} onChange={(e) => setWeekNumber(e.target.value)}>
                  <option value="">Sélectionner une semaine</option>
                  {weekOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="item">
                <strong>2. Source, agent et statut</strong>
                <p className="muted">Le statut passera automatiquement en Véhicule vendu si la case vente est cochée.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: 10 }}>
                <select value={source} onChange={(e) => setSource(e.target.value)}>
                  {leadSources.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>

                <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={saleDone}>
                  {leadStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>

                <select value={agentId} onChange={(e) => {
                  const value = e.target.value ? Number(e.target.value) : '';
                  setAgentId(value);
                  const selectedAgent = agentOptions.find(agent => Number(agent.id) === Number(value));
                  if (selectedAgent?.agency_id) setAgencyId(Number(selectedAgent.agency_id));
                }}>
                  <option value="">Sélectionner un agent</option>
                  {agentOptions.map((agent) => (
                    <option key={agent.id} value={agent.id}>{agent.full_name} — {agencyName(agent.agency_id)}</option>
                  ))}
                </select>

                <select value={agencyId} onChange={(e) => setAgencyId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Agence</option>
                  <option value={1}>Blois</option>
                  <option value={2}>Tours</option>
                  <option value={3}>Bourges</option>
                </select>
              </div>

              <div className="item">
                <strong>3. Client</strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 10 }}>
                <input placeholder="Nom client" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                <input placeholder="Téléphone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                <input placeholder="Email facultatif" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
              </div>

              <div className="item">
                <strong>4. Véhicule</strong>
                <p className="muted">Ces champs servent aussi à retrouver le lead rapidement par recherche : plaque, marque, modèle, client.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(130px, 1fr))', gap: 10 }}>
                <input placeholder="Marque" value={vehicleBrand} onChange={(e) => setVehicleBrand(e.target.value)} />
                <input placeholder="Modèle" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} />
                <input placeholder="Immatriculation" value={vehicleRegistration} onChange={(e) => setVehicleRegistration(e.target.value.toUpperCase())} />
                <input type="number" placeholder="Année" value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} />
                <input type="number" placeholder="Kilométrage" value={vehicleMileage} onChange={(e) => setVehicleMileage(e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))', gap: 10 }}>
                <input type="date" value={leadDate} onChange={(e) => setLeadDate(e.target.value)} />
                <input type="date" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} />
                <input placeholder="Heure RDV ex : 14:30" value={appointmentTime} onChange={(e) => setAppointmentTime(e.target.value)} />
              </div>

              <div className="item">
                <strong>5. Mandat / entrée véhicule</strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 10 }}>
                <input type="number" placeholder="Prix souhaité vendeur" value={sellerExpectedPrice} onChange={(e) => setSellerExpectedPrice(e.target.value)} />
                <input type="number" placeholder="Prix net vendeur / prix acheté" value={sellerNetPrice} onChange={(e) => setSellerNetPrice(e.target.value)} />
                <label className="item" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={vehicleEntered} onChange={(e) => setVehicleEntered(e.target.checked)} />
                  Véhicule rentré
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))', gap: 10 }}>
                <label className="item" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={mandateSigned} onChange={(e) => setMandateSigned(e.target.checked)} />
                  Mandat signé
                </label>

                <label className="item" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={saleDone} onChange={(e) => setSaleDone(e.target.checked)} />
                  Véhicule vendu — créer / mettre à jour automatiquement la vente
                </label>
              </div>

              {saleDone && (
                <div
                  className="card"
                  style={{
                    border: '1px solid rgba(34, 197, 94, 0.45)',
                    boxShadow: '0 0 0 1px rgba(34, 197, 94, 0.08), 0 18px 45px rgba(0, 0, 0, 0.22)',
                  }}
                >
                  <h4>✅ Transformation automatique en vente</h4>
                  <p className="muted">
                    En enregistrant ce lead, le CRM créera ou mettra à jour une vente dans l’onglet Ventes avec le même agent, véhicule, plaque, prix, marge et garantie.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 14, alignItems: 'start' }}>
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(150px, 1fr))', gap: 10 }}>
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span className="muted">Prix net vendeur</span>
                          <input type="number" placeholder="Ex : 12000" value={sellerNetPrice} onChange={(e) => setSellerNetPrice(e.target.value)} />
                        </label>

                        <label style={{ display: 'grid', gap: 6 }}>
                          <span className="muted">Prix de vente</span>
                          <input type="number" placeholder="Ex : 14500" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
                        </label>

                        <label style={{ display: 'grid', gap: 6 }}>
                          <span className="muted">Frais de mise à la route</span>
                          <input type="number" placeholder="Ex : 399" value={saleRoadFees} onChange={(e) => setSaleRoadFees(e.target.value)} />
                        </label>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1.2fr) minmax(180px, 0.8fr)', gap: 10, alignItems: 'start' }}>
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span className="muted">Garantie vendue</span>
                          <select value={warrantyType} onChange={(e) => handleWarrantyTypeChange(e.target.value)}>
                            <option value="">Aucune garantie</option>
                            {warrantyOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                            {warrantyType === 'Garantie déjà renseignée' && (
                              <option value="Garantie déjà renseignée">Garantie déjà renseignée</option>
                            )}
                          </select>
                          <span className="muted" style={{ fontSize: 12 }}>
                            Le prix de la garantie est pré-rempli selon la garantie sélectionnée mais reste modifiable.
                          </span>
                        </label>

                        <label style={{ display: 'grid', gap: 6 }}>
                          <span className="muted">Prix garantie (modifiable)</span>
                          <input
                            type="number"
                            placeholder="Prix garantie"
                            value={warrantyAmount}
                            onChange={(e) => {
                              setWarrantyAmount(e.target.value);
                              setWarrantySold(Number(e.target.value || 0) > 0 || Boolean(warrantyType));
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 12 }}>
                      <div className="item" style={{ minHeight: 88 }}>
                        <span className="muted">Marge calculée</span>
                        <div style={{ fontSize: 26, fontWeight: 900, color: '#4ade80', marginTop: 6 }}>{euro(calculatedLeadMargin)}</div>
                      </div>

                      <div className="item">
                        <strong>Détail du calcul de la marge</strong>
                        <div style={{ display: 'grid', gap: 5, marginTop: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <span className="muted">Prix de vente</span>
                            <strong>{euro(Number(salePrice || 0))}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <span className="muted">+ Frais de mise à la route</span>
                            <strong>{euro(Number(saleRoadFees || 0))}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <span className="muted">+ Garantie vendue</span>
                            <strong>{euro(warrantySold ? Number(warrantyAmount || 0) : 0)}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <span className="muted">- Prix net vendeur</span>
                            <strong>{euro(Number(sellerNetPrice || 0))}</strong>
                          </div>
                          <div style={{ height: 1, background: 'rgba(148, 163, 184, 0.28)', margin: '6px 0' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 16 }}>
                            <strong>= Marge</strong>
                            <strong style={{ color: '#4ade80' }}>{euro(calculatedLeadMargin)}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <textarea placeholder="Commentaires / suite à donner / raison du refus..." value={comments} onChange={(e) => setComments(e.target.value)} />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" onClick={saveLead} disabled={saving}>
                  {saving ? 'Enregistrement...' : editingLead ? 'Modifier le lead' : 'Enregistrer le lead'}
                </button>

                {editingLead && <button onClick={deleteLead} disabled={saving}>Supprimer</button>}

                <button onClick={() => { resetForm(); setShowForm(false); }} disabled={saving}>Annuler</button>
              </div>
            </div>
          </div>
        )}

        <input className="search" placeholder="Recherche plaque, modèle, marque, client, téléphone, agent, source..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginTop: 14 }} />
      </div>

      <div className="grid cards3">
        <div className="card">
          <h3>Leads</h3>
          <div className="stat-value">{stats.total}</div>
          <p className="muted">Total selon la recherche active</p>
        </div>

        <div className="card">
          <h3>RDV pris</h3>
          <div className="stat-value">{stats.appointments}</div>
          <p className="muted">{stats.enteredVehicles} véhicule(s) rentré(s)</p>
        </div>

        <div className="card">
          <h3>Ventes issues des leads</h3>
          <div className="stat-value">{stats.sales}</div>
          <p className="muted">Taux transformation : {stats.conversionRate}%</p>
        </div>
      </div>

      <div className="grid cards3">
        <div className="card">
          <h3>Mandats</h3>
          <div className="stat-value">{stats.mandates}</div>
          <p className="muted">Mandats signés depuis les leads</p>
        </div>

        <div className="card">
          <h3>Garanties</h3>
          <div className="stat-value">{stats.warranties}</div>
          <p className="muted">Garanties vendues depuis les leads</p>
        </div>

        <div className="card">
          <h3>Marge générée</h3>
          <div className="stat-value">{euro(stats.margin)}</div>
          <p className="muted">Marge totale renseignée</p>
        </div>
      </div>

      <div className="card">
        <h3>Performance par source</h3>

        {sourceStats.length === 0 ? (
          <p className="muted">Aucune source à afficher.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Leads</th>
                <th>RDV</th>
                <th>Véhicules rentrés</th>
                <th>Ventes</th>
                <th>Taux</th>
                <th>Marge</th>
              </tr>
            </thead>

            <tbody>
              {sourceStats.map((item) => (
                <tr key={item.source}>
                  <td><strong>{item.source}</strong></td>
                  <td>{item.total}</td>
                  <td>{item.appointments}</td>
                  <td>{item.vehicles}</td>
                  <td>{item.sales}</td>
                  <td>{item.conversionRate}%</td>
                  <td><strong>{euro(item.margin)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Liste des leads</h3>

        {loading && <p className="muted">Chargement des leads...</p>}
        {!loading && filteredLeads.length === 0 && <p className="muted">Aucun lead trouvé.</p>}

        {!loading && filteredLeads.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Source</th>
                <th>Agent</th>
                <th>Statut</th>
                <th>Véhicule</th>
                <th>RDV</th>
                <th>Résultat</th>
              </tr>
            </thead>

            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id} onClick={() => openEditLeadForm(lead)} style={{ cursor: 'pointer' }} title="Cliquer pour modifier le lead">
                  <td>
                    <strong>{lead.customer_name || '-'}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {lead.customer_phone || ''}
                      {lead.customer_phone && lead.customer_email ? ' — ' : ''}
                      {lead.customer_email || ''}
                    </div>
                  </td>
                  <td>{lead.source || '-'}</td>
                  <td>
                    {lead.agents?.full_name || '-'}
                    <div className="muted" style={{ fontSize: 12 }}>{agencyName(lead.agency_id || lead.agents?.agency_id)}</div>
                  </td>
                  <td><span className="badge">{lead.status || '-'}</span></td>
                  <td>
                    <strong>{[lead.vehicle_brand, lead.vehicle_model].filter(Boolean).join(' ') || '-'}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {lead.vehicle_registration || ''}
                      {lead.vehicle_mileage ? ` — ${lead.vehicle_mileage.toLocaleString('fr-FR')} km` : ''}
                    </div>
                  </td>
                  <td>
                    {formatDate(lead.appointment_date)}
                    {lead.appointment_time && <div className="muted" style={{ fontSize: 12 }}>{lead.appointment_time}</div>}
                  </td>
                  <td>
                    {lead.sale_done || lead.status === 'Véhicule vendu' ? 'Vendu' : lead.vehicle_entered ? 'Rentré' : lead.mandate_signed ? 'Mandat signé' : '-'}
                    {(lead.margin_amount || lead.warranty_sold) && (
                      <div className="muted" style={{ fontSize: 12 }}>
                        {lead.margin_amount ? `Marge ${euro(Number(lead.margin_amount))}` : ''}
                        {lead.margin_amount && lead.warranty_sold ? ' — ' : ''}
                        {lead.warranty_sold ? 'Garantie' : ''}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


export function RapportSemaine({
  currentAgent = null,
  isResponsable = true,
}: {
  currentAgent?: CurrentAgentForPages | null;
  isResponsable?: boolean;
} = {}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  function getWeekNumberFromDate(date: Date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  function getMondayForWeekLabel(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatWeekDateLabel(date: Date) {
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
    });
  }

  function getWeekOptionsForMonth(year: number, month: number) {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    const firstMonday = getMondayForWeekLabel(firstDayOfMonth);
    const options: { value: string; label: string }[] = [];
    const seen = new Set<number>();

    for (let date = new Date(firstMonday); date <= lastDayOfMonth; date.setDate(date.getDate() + 7)) {
      const weekNumber = getWeekNumberFromDate(date);
      if (seen.has(weekNumber)) continue;
      seen.add(weekNumber);

      const weekStart = new Date(date);
      const weekEnd = new Date(date);
      weekEnd.setDate(weekEnd.getDate() + 6);

      options.push({
        value: String(weekNumber),
        label: `Semaine ${weekNumber} — du ${formatWeekDateLabel(weekStart)} au ${formatWeekDateLabel(weekEnd)}`,
      });
    }

    return options;
  }

  const currentWeek = getWeekNumberFromDate(now);
  const responsableMode = isResponsable === true && currentAgent?.account_type === 'responsable';

  const [agentsList, setAgentsList] = useState<AgentOption[]>([]);
  const [leadsList, setLeadsList] = useState<LeadItem[]>([]);
  const [salesList, setSalesList] = useState<VehicleSale[]>([]);
  const [reportsList, setReportsList] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth));
  const [selectedWeek, setSelectedWeek] = useState(String(currentWeek));
  const [selectedAgency, setSelectedAgency] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  const weekOptions = useMemo(() => {
    return getWeekOptionsForMonth(Number(selectedYear || currentYear), Number(selectedMonth || currentMonth));
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    if (weekOptions.length === 0) return;
    const weekExists = weekOptions.some(option => option.value === selectedWeek);
    if (!weekExists) {
      setSelectedWeek(weekOptions[0].value);
    }
  }, [weekOptions, selectedWeek]);

  const [summary, setSummary] = useState('');
  const [actionsDone, setActionsDone] = useState<string[]>([]);
  const [nextWeekObjectives, setNextWeekObjectives] = useState('');
  const [comments, setComments] = useState('');

  const actionChoices = [
    'Démarchage téléphonique',
    'Relances clients',
    'Publications réseaux sociaux',
    'Visites / RDV clients',
    'Prospection terrain',
    'Suivi administratif',
  ];

  async function loadWeeklyPage() {
    setLoading(true);

    const { data: agentsData, error: agentsError } = await supabase
      .from('agents')
      .select('id, full_name, agency_id')
      .order('full_name', { ascending: true });

    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('*, agents (full_name, agency_id)')
      .order('id', { ascending: false });

    const { data: salesData, error: salesError } = await supabase
      .from('vehicle_sales')
      .select(`
        *,
        agents!vehicle_sales_agent_id_fkey (
          full_name,
          agency_id
        )
      `)
      .order('id', { ascending: false });

    const { data: reportsData, error: reportsError } = await supabase
      .from('weekly_reports')
      .select('*')
      .order('id', { ascending: false });

    if (agentsError) {
      console.error('Erreur chargement agents rapport semaine:', agentsError);
      setAgentsList([]);
    } else {
      setAgentsList((agentsData || []) as AgentOption[]);
    }

    if (leadsError) {
      console.error('Erreur chargement leads rapport semaine:', leadsError);
      setLeadsList([]);
    } else {
      setLeadsList((leadsData || []) as LeadItem[]);
    }

    if (salesError) {
      console.error('Erreur chargement ventes rapport semaine:', salesError);
      setSalesList([]);
    } else {
      setSalesList((salesData || []) as VehicleSale[]);
    }

    if (reportsError) {
      console.error('Erreur chargement rapports semaine:', reportsError);
      setReportsList([]);
    } else {
      setReportsList((reportsData || []) as WeeklyReport[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadWeeklyPage();
  }, []);

  useEffect(() => {
    if (!responsableMode && currentAgent?.id) {
      setSelectedAgent(String(currentAgent.id));
      if (currentAgent.agency_id) setSelectedAgency(String(currentAgent.agency_id));
    }
  }, [responsableMode, currentAgent?.id, currentAgent?.agency_id]);

  const availableAgents = useMemo(() => {
    if (selectedAgency === 'all') return agentsList;
    return agentsList.filter(agent => Number(agent.agency_id) === Number(selectedAgency));
  }, [agentsList, selectedAgency]);

  const selectedReport = useMemo(() => {
    if (selectedAgent === 'all') return null;

    return reportsList.find(report => (
      Number(report.agent_id) === Number(selectedAgent)
      && Number(report.year_number ?? report.year) === Number(selectedYear)
      && Number(report.month_number ?? report.month) === Number(selectedMonth)
      && Number(report.week_number ?? report.week) === Number(selectedWeek)
    )) || null;
  }, [reportsList, selectedAgent, selectedYear, selectedMonth, selectedWeek]);

  useEffect(() => {
    if (selectedReport) {
      setSummary(selectedReport.summary || selectedReport.positive_points || '');
      const actionText = selectedReport.actions_done || selectedReport.negative_points || '';
      setActionsDone(actionText ? actionText.split(' | ').filter(Boolean) : []);
      setNextWeekObjectives(selectedReport.next_week_objectives || selectedReport.next_week_goals || '');
      setComments(selectedReport.comments || '');
    } else {
      setSummary('');
      setActionsDone([]);
      setNextWeekObjectives('');
      setComments('');
    }
  }, [selectedReport?.id, selectedAgent, selectedYear, selectedMonth, selectedWeek]);

  function saleMatchesPeriod(sale: VehicleSale) {
    const date = saleDateToDate(sale.sale_date);
    if (!date) return false;

    return (
      date.getFullYear() === Number(selectedYear)
      && date.getMonth() + 1 === Number(selectedMonth)
      && getWeekNumberFromDate(date) === Number(selectedWeek)
    );
  }

  function leadMatchesFilters(lead: LeadItem) {
    const leadAgencyId = lead.agency_id || lead.agents?.agency_id || null;

    if (Number(lead.year_number || 0) !== Number(selectedYear)) return false;
    if (Number(lead.month_number || 0) !== Number(selectedMonth)) return false;
    if (Number(lead.week_number || 0) !== Number(selectedWeek)) return false;

    if (selectedAgency !== 'all' && Number(leadAgencyId) !== Number(selectedAgency)) return false;
    if (selectedAgent !== 'all' && Number(lead.agent_id) !== Number(selectedAgent)) return false;

    if (!responsableMode && currentAgent?.id && Number(lead.agent_id) !== Number(currentAgent.id)) return false;

    return true;
  }

  function saleMatchesFilters(sale: VehicleSale) {
    const saleAgencyId = sale.agents?.agency_id || null;

    if (!saleMatchesPeriod(sale)) return false;
    if (selectedAgency !== 'all' && Number(saleAgencyId) !== Number(selectedAgency)) return false;
    if (selectedAgent !== 'all' && Number(sale.agent_id) !== Number(selectedAgent)) return false;

    if (!responsableMode && currentAgent?.id && Number(sale.agent_id) !== Number(currentAgent.id)) return false;

    return true;
  }

  const filteredLeads = useMemo(() => leadsList.filter(leadMatchesFilters), [leadsList, selectedYear, selectedMonth, selectedWeek, selectedAgency, selectedAgent, responsableMode, currentAgent?.id]);
  const filteredSales = useMemo(() => salesList.filter(saleMatchesFilters), [salesList, selectedYear, selectedMonth, selectedWeek, selectedAgency, selectedAgent, responsableMode, currentAgent?.id]);

  const weeklyStats = useMemo(() => {
    const leads = filteredLeads.length;
    const rdv = filteredLeads.filter(lead => ['RDV pris', 'RDV effectué', 'Véhicule rentré', 'Mandat signé', 'Véhicule vendu'].includes(lead.status || '')).length;
    const vehicles = filteredLeads.filter(lead => lead.vehicle_entered || ['Véhicule rentré', 'Mandat signé', 'Véhicule vendu'].includes(lead.status || '')).length;
    const mandates = filteredLeads.filter(lead => lead.mandate_signed || ['Mandat signé', 'Véhicule vendu'].includes(lead.status || '')).length;
    const sales = filteredSales.length;
    const warranties = filteredSales.filter(sale => sale.warranty_sold).length;
    const ca = filteredSales.reduce((total, sale) => total + Number(sale.sale_price || 0), 0);
    const margin = filteredSales.reduce((total, sale) => total + Number(sale.margin_amount || 0), 0);
    const conversionRate = leads > 0 ? Math.round((sales / leads) * 100) : 0;

    return { leads, rdv, vehicles, mandates, sales, warranties, ca, margin, conversionRate };
  }, [filteredLeads, filteredSales]);

  const agentRows = useMemo(() => {
    return availableAgents.map((agent) => {
      const agentLeads = filteredLeads.filter(lead => Number(lead.agent_id) === Number(agent.id));
      const agentSales = filteredSales.filter(sale => Number(sale.agent_id) === Number(agent.id));
      const agentReport = reportsList.find(report => (
        Number(report.agent_id) === Number(agent.id)
        && Number(report.year_number ?? report.year) === Number(selectedYear)
        && Number(report.month_number ?? report.month) === Number(selectedMonth)
        && Number(report.week_number ?? report.week) === Number(selectedWeek)
      ));

      const ca = agentSales.reduce((total, sale) => total + Number(sale.sale_price || 0), 0);
      const margin = agentSales.reduce((total, sale) => total + Number(sale.margin_amount || 0), 0);
      const warranties = agentSales.filter(sale => sale.warranty_sold).length;
      const sales = agentSales.length;
      const conversionRate = agentLeads.length > 0 ? Math.round((sales / agentLeads.length) * 100) : 0;

      return {
        agent,
        leads: agentLeads.length,
        rdv: agentLeads.filter(lead => ['RDV pris', 'RDV effectué', 'Véhicule rentré', 'Mandat signé', 'Véhicule vendu'].includes(lead.status || '')).length,
        vehicles: agentLeads.filter(lead => lead.vehicle_entered || ['Véhicule rentré', 'Mandat signé', 'Véhicule vendu'].includes(lead.status || '')).length,
        mandates: agentLeads.filter(lead => lead.mandate_signed || ['Mandat signé', 'Véhicule vendu'].includes(lead.status || '')).length,
        sales,
        warranties,
        ca,
        margin,
        conversionRate,
        report: agentReport,
      };
    }).filter(row => selectedAgent === 'all' || Number(row.agent.id) === Number(selectedAgent));
  }, [availableAgents, filteredLeads, filteredSales, reportsList, selectedYear, selectedMonth, selectedWeek, selectedAgent]);

  function toggleAction(action: string) {
    setActionsDone((current) => (
      current.includes(action)
        ? current.filter(item => item !== action)
        : [...current, action]
    ));
  }

  async function saveWeeklyReport() {
    if (selectedAgent === 'all') {
      alert('Sélectionne un agent précis pour enregistrer son résumé de semaine.');
      return;
    }

    setSaving(true);

    const payload = {
      agent_id: Number(selectedAgent),
      year: Number(selectedYear),
      month: Number(selectedMonth),
      week: String(selectedWeek),
      contacts: weeklyStats.leads,
      appointments: weeklyStats.rdv,
      mandates: weeklyStats.mandates,
      vehicles_in: weeklyStats.vehicles,
      sales_count: weeklyStats.sales,
      margin_amount: weeklyStats.margin,
      warranties_count: weeklyStats.warranties,
      warranties_amount: filteredSales.reduce((total, sale) => total + Number(sale.warranty_amount || 0), 0),
      positive_points: summary.trim() || null,
      negative_points: actionsDone.join(' | ') || null,
      next_week_goals: nextWeekObjectives.trim() || null,
      comments: comments.trim() || null,
    };

    const { error } = selectedReport
      ? await supabase.from('weekly_reports').update(payload).eq('id', selectedReport.id)
      : await supabase.from('weekly_reports').insert(payload);

    if (error) {
      console.error('Erreur sauvegarde rapport semaine:', error);
      alert('Erreur pendant l’enregistrement du rapport semaine.');
    } else {
      await loadWeeklyPage();
      alert('Rapport semaine enregistré.');
    }

    setSaving(false);
  }

  return (
    <div className="section">
      <div className="card">
        <h3>Rapport semaine</h3>
        <p className="muted">
          Les chiffres sont calculés automatiquement depuis les leads et les ventes. L’agent ajoute seulement son résumé, ses actions et ses objectifs.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(140px, 1fr))', gap: 10, marginTop: 12 }}>
          <input type="number" placeholder="Année" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} />
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            <option value="1">Janvier</option>
            <option value="2">Février</option>
            <option value="3">Mars</option>
            <option value="4">Avril</option>
            <option value="5">Mai</option>
            <option value="6">Juin</option>
            <option value="7">Juillet</option>
            <option value="8">Août</option>
            <option value="9">Septembre</option>
            <option value="10">Octobre</option>
            <option value="11">Novembre</option>
            <option value="12">Décembre</option>
          </select>
          <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}>
            {weekOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          {responsableMode && (
            <select value={selectedAgency} onChange={(e) => {
              setSelectedAgency(e.target.value);
              setSelectedAgent('all');
            }}>
              <option value="all">Toutes les agences</option>
              <option value="1">Blois</option>
              <option value="2">Tours</option>
              <option value="3">Bourges</option>
            </select>
          )}

          <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} disabled={!responsableMode && Boolean(currentAgent?.id)}>
            {responsableMode && <option value="all">Tous les agents</option>}
            {availableAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.full_name} — {agencyName(agent.agency_id)}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="card"><p className="muted">Chargement du rapport semaine...</p></div>}

      {!loading && (
        <>
          <div className="grid cards3">
            <div className="card"><h3>Leads</h3><div className="stat-value">{weeklyStats.leads}</div><p className="muted">Créés sur la semaine</p></div>
            <div className="card"><h3>RDV</h3><div className="stat-value">{weeklyStats.rdv}</div><p className="muted">RDV pris ou effectués</p></div>
            <div className="card"><h3>Véhicules rentrés</h3><div className="stat-value">{weeklyStats.vehicles}</div><p className="muted">Depuis les leads</p></div>
          </div>

          <div className="grid cards3">
            <div className="card"><h3>Mandats</h3><div className="stat-value">{weeklyStats.mandates}</div><p className="muted">Mandats signés</p></div>
            <div className="card"><h3>Ventes</h3><div className="stat-value">{weeklyStats.sales}</div><p className="muted">CA : {euro(weeklyStats.ca)}</p></div>
            <div className="card"><h3>Marge</h3><div className="stat-value">{euro(weeklyStats.margin)}</div><p className="muted">Transformation : {weeklyStats.conversionRate}%</p></div>
          </div>

          <div className="card">
            <h3>Résumé agent</h3>
            <p className="muted">À remplir uniquement pour un agent précis. Les chiffres au-dessus restent automatiques.</p>

            <div style={{ display: 'grid', gap: 10 }}>
              <textarea placeholder="Résumé de la semaine..." value={summary} onChange={(e) => setSummary(e.target.value)} disabled={selectedAgent === 'all'} />

              <div className="item">
                <strong>Actions réalisées</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
                  {actionChoices.map((action) => (
                    <label key={action} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="checkbox" checked={actionsDone.includes(action)} onChange={() => toggleAction(action)} disabled={selectedAgent === 'all'} />
                      {action}
                    </label>
                  ))}
                </div>
              </div>

              <textarea placeholder="Objectifs de la semaine prochaine..." value={nextWeekObjectives} onChange={(e) => setNextWeekObjectives(e.target.value)} disabled={selectedAgent === 'all'} />
              <textarea placeholder="Commentaire Responsable / remarques internes..." value={comments} onChange={(e) => setComments(e.target.value)} disabled={selectedAgent === 'all'} />

              <button className="btn" onClick={saveWeeklyReport} disabled={saving || selectedAgent === 'all'}>
                {saving ? 'Enregistrement...' : selectedReport ? 'Modifier le rapport semaine' : 'Enregistrer le rapport semaine'}
              </button>
            </div>
          </div>

          {responsableMode && (
            <div className="card">
              <h3>Vue Responsable par agent</h3>
              <p className="muted">Trié selon les filtres année / mois / semaine / agence / agent.</p>

              {agentRows.length === 0 ? (
                <p className="muted">Aucun agent à afficher pour ces filtres.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Agence</th>
                      <th>Leads</th>
                      <th>RDV</th>
                      <th>Rentrées</th>
                      <th>Mandats</th>
                      <th>Ventes</th>
                      <th>Marge</th>
                      <th>Résumé</th>
                    </tr>
                  </thead>

                  <tbody>
                    {agentRows.map((row) => (
                      <tr key={row.agent.id}>
                        <td><strong>{row.agent.full_name}</strong></td>
                        <td><span className="badge">{agencyName(row.agent.agency_id)}</span></td>
                        <td>{row.leads}</td>
                        <td>{row.rdv}</td>
                        <td>{row.vehicles}</td>
                        <td>{row.mandates}</td>
                        <td>{row.sales}</td>
                        <td><strong>{euro(row.margin)}</strong></td>
                        <td>{row.report?.summary ? '✅ Rempli' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function Ventes({
  currentAgent = null,
  isResponsable = true,
}: {
  currentAgent?: CurrentAgentForPages | null;
  isResponsable?: boolean;
} = {}) {
  const today = new Date().toISOString().slice(0, 10);

  const [realSales, setRealSales] = useState<VehicleSale[]>([]);
  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([]);
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingSale, setEditingSale] = useState<VehicleSale | null>(null);

  const [vehicleName, setVehicleName] = useState('');
  const [vehiclePhotoUrl, setVehiclePhotoUrl] = useState('');
  const [saleDate, setSaleDate] = useState(today);
  const [agentId, setAgentId] = useState<number | ''>('');
  const [sellerPrice, setSellerPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [registration, setRegistration] = useState('');
  const [vin, setVin] = useState('');
  const [warrantySold, setWarrantySold] = useState(false);
  const [warrantyType, setWarrantyType] = useState('');
  const [warrantyAmount, setWarrantyAmount] = useState('');
  const [comments, setComments] = useState('');

  const calculatedMargin = useMemo(() => {
    const sale = Number(salePrice || 0);
    const seller = Number(sellerPrice || 0);
    return sale - seller;
  }, [salePrice, sellerPrice]);

  async function loadAgents() {
    const { data, error } = await supabase
      .from('agents')
      .select('id, full_name, agency_id')
      .order('full_name', { ascending: true });

    if (!error && data) {
      setAgentOptions(data);
    }
  }

  async function loadSales() {
    setLoading(true);

    let query = supabase
      .from('vehicle_sales')
      .select(`
        *,
        agents!vehicle_sales_agent_id_fkey (
          full_name,
          agency_id
        )
      `)
      .order('id', { ascending: false });

    if (!isResponsable && currentAgent?.id) {
      query = query.eq('agent_id', currentAgent.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erreur chargement ventes:', error);
      setRealSales([]);
    } else {
      setRealSales(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAgents();
    loadSales();
  }, [currentAgent?.id, isResponsable]);

  function resetForm() {
    setEditingSale(null);
    setVehicleName('');
    setVehiclePhotoUrl('');
    setSaleDate(today);
    setAgentId('');
    setSellerPrice('');
    setSalePrice('');
    setRegistration('');
    setVin('');
    setWarrantySold(false);
    setWarrantyType('');
    setWarrantyAmount('');
    setComments('');
  }

  function openNewSaleForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditSaleForm(sale: VehicleSale) {
    setEditingSale(sale);
    setVehicleName(sale.vehicle_name || '');
    setVehiclePhotoUrl(sale.vehicle_photo_url || '');
    setSaleDate(sale.sale_date || today);
    setAgentId(sale.agent_id || '');
    setSellerPrice(String(sale.seller_price ?? ''));
    setSalePrice(String(sale.sale_price ?? ''));
    setRegistration(sale.registration || '');
    setVin(sale.vin || '');
    setWarrantySold(Boolean(sale.warranty_sold));
    setWarrantyType(sale.warranty_type || '');
    setWarrantyAmount(String(sale.warranty_amount ?? ''));
    setComments(sale.comments || sale.notes || '');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveSale() {
    if (!vehicleName.trim()) {
      alert('Il faut indiquer le véhicule vendu.');
      return;
    }

    if (!agentId) {
      alert('Il faut sélectionner un agent commercial.');
      return;
    }

    if (!sellerPrice || !salePrice) {
      alert('Il faut indiquer le prix vendeur et le prix de vente.');
      return;
    }

    setSaving(true);

    const payload = {
      agent_id: Number(agentId),
      weekly_report_id: editingSale?.weekly_report_id || 1,
      sale_date: saleDate || null,
      vehicle_name: vehicleName.trim(),
      vehicle_photo_url: vehiclePhotoUrl.trim() || null,
      seller_price: Number(sellerPrice || 0),
      sale_price: Number(salePrice || 0),
      margin_amount: calculatedMargin,
      warranty_sold: warrantySold,
      warranty_type: warrantySold ? warrantyType.trim() || null : null,
      warranty_amount: warrantySold ? Number(warrantyAmount || 0) : 0,
      registration: registration.trim() || null,
      vin: vin.trim() || null,
      comments: comments.trim() || null,
    };

    const { error } = editingSale
      ? await supabase.from('vehicle_sales').update(payload).eq('id', editingSale.id)
      : await supabase.from('vehicle_sales').insert(payload);

    if (error) {
      console.error('Erreur sauvegarde vente:', error);
      alert("Erreur pendant l'enregistrement de la vente.");
    } else {
      resetForm();
      setShowForm(false);
      await loadSales();
    }

    setSaving(false);
  }

  async function deleteSale() {
    if (!editingSale) return;

    const ok = confirm(`Supprimer la vente "${editingSale.vehicle_name}" ?`);
    if (!ok) return;

    setSaving(true);

    const { error } = await supabase
      .from('vehicle_sales')
      .delete()
      .eq('id', editingSale.id);

    if (error) {
      console.error('Erreur suppression vente:', error);
      alert('Erreur pendant la suppression de la vente.');
    } else {
      resetForm();
      setShowForm(false);
      await loadSales();
    }

    setSaving(false);
  }

  const filteredSales = realSales.filter((sale) => {
    const q = search.toLowerCase().trim();

    if (!q) return true;

    const content = [
      sale.vehicle_name,
      sale.registration,
      sale.vin,
      sale.agents?.full_name,
      agencyName(sale.agents?.agency_id),
      sale.warranty_type,
      sale.comments,
      sale.notes,
    ]
      .join(' ')
      .toLowerCase();

    return content.includes(q);
  });

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h3>Ventes véhicules</h3>
          <p className="muted">
            {isResponsable
              ? 'Ajout, modification et suivi des ventes connectées à Supabase.'
              : 'Historique de tes ventes. Pour créer une vente, transforme un lead en véhicule vendu.'}
          </p>
        </div>

        {isResponsable && (
          <button
            className="btn"
            onClick={() => {
              if (showForm && !editingSale) {
                setShowForm(false);
              } else {
                openNewSaleForm();
              }
            }}
          >
            {showForm && !editingSale ? 'Fermer' : 'Nouvelle vente'}
          </button>
        )}
      </div>

      {isResponsable && showForm && (
        <div className="card" style={{ marginTop: 14, marginBottom: 14 }}>
          <h4>{editingSale ? 'Modifier la vente' : 'Nouvelle vente'}</h4>

          <div style={{ display: 'grid', gap: 10 }}>
            <input placeholder="Véhicule vendu ex : Mercedes Classe A 200 AMG" value={vehicleName} onChange={(e) => setVehicleName(e.target.value)} />
            <input placeholder="URL photo véhicule facultatif" value={vehiclePhotoUrl} onChange={(e) => setVehiclePhotoUrl(e.target.value)} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 10 }}>
              <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />

              <select value={agentId} onChange={(e) => setAgentId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Sélectionner un agent</option>
                {agentOptions.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.full_name} — {agencyName(agent.agency_id)}</option>
                ))}
              </select>

              <input placeholder="Immatriculation" value={registration} onChange={(e) => setRegistration(e.target.value.toUpperCase())} />
            </div>

            <input placeholder="VIN facultatif" value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))', gap: 10 }}>
              <input type="number" placeholder="Prix net vendeur" value={sellerPrice} onChange={(e) => setSellerPrice(e.target.value)} />
              <input type="number" placeholder="Prix de vente" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
              <div className="item">
                <span className="muted">Marge calculée</span>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{euro(calculatedMargin)}</div>
              </div>
            </div>

            <div className="item">
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={warrantySold} onChange={(e) => setWarrantySold(e.target.checked)} />
                Garantie vendue
              </label>

              {warrantySold && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))', gap: 10, marginTop: 10 }}>
                  <input placeholder="Type garantie ex : Opteven Premium" value={warrantyType} onChange={(e) => setWarrantyType(e.target.value)} />
                  <input type="number" placeholder="Montant garantie" value={warrantyAmount} onChange={(e) => setWarrantyAmount(e.target.value)} />
                </div>
              )}
            </div>

            <textarea placeholder="Commentaires" value={comments} onChange={(e) => setComments(e.target.value)} />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={saveSale} disabled={saving}>
                {saving ? 'Enregistrement...' : editingSale ? 'Modifier la vente' : 'Enregistrer la vente'}
              </button>

              {editingSale && <button onClick={deleteSale} disabled={saving}>Supprimer</button>}

              <button onClick={() => { resetForm(); setShowForm(false); }} disabled={saving}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      <input className="search" placeholder="Recherche marque, modèle, immatriculation, VIN, agent... ex : Mercedes" value={search} onChange={(e) => setSearch(e.target.value)} />

      {loading && <p className="muted">Chargement des ventes...</p>}
      {!loading && filteredSales.length === 0 && <p className="muted">Aucune vente trouvée.</p>}

      {!loading && filteredSales.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Véhicule</th>
              <th>Agent</th>
              <th>Agence</th>
              <th>Prix vente</th>
              <th>Marge</th>
              <th>Garantie</th>
            </tr>
          </thead>

          <tbody>
            {filteredSales.map(s => (
              <tr
                key={s.id}
                onClick={() => {
                  if (isResponsable) openEditSaleForm(s);
                }}
                style={{ cursor: isResponsable ? 'pointer' : 'default' }}
                title={isResponsable ? 'Cliquer pour modifier la vente' : 'Historique de vente'}
              >
                <td>
                  <strong>{s.vehicle_name}</strong>
                  {(s.registration || s.vin) && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      {s.registration ? `Immat: ${s.registration}` : ''}
                      {s.registration && s.vin ? ' — ' : ''}
                      {s.vin ? `VIN: ${s.vin}` : ''}
                    </div>
                  )}
                </td>
                <td>{s.agents?.full_name || '-'}</td>
                <td><span className="badge">{agencyName(s.agents?.agency_id)}</span></td>
                <td>{euro(Number(s.sale_price || 0))}</td>
                <td><strong>{euro(Number(s.margin_amount || 0))}</strong></td>
                <td>
                  {s.warranty_sold
                    ? `${s.warranty_type || 'Oui'}${s.warranty_amount ? ` — ${euro(Number(s.warranty_amount))}` : ''}`
                    : 'Non'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function Garanties() {
  const [sales, setSales] = useState<VehicleSale[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadWarrantySales() {
    setLoading(true);

    const { data, error } = await supabase
      .from('vehicle_sales')
      .select(`
        *,
        agents!vehicle_sales_agent_id_fkey (
          full_name,
          agency_id
        )
      `)
      .order('id', { ascending: false });

    if (error) {
      console.error('Erreur chargement garanties:', error);
      setSales([]);
    } else {
      setSales(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadWarrantySales();
  }, []);

  const totalSales = sales.length;
  const warrantySales = sales.filter(sale => sale.warranty_sold);
  const totalWarranties = warrantySales.length;
  const totalWarrantyAmount = warrantySales.reduce((total, sale) => total + Number(sale.warranty_amount || 0), 0);
  const warrantyRate = totalSales > 0 ? Math.round((totalWarranties / totalSales) * 100) : 0;

  const agentWarrantyRanking = useMemo(() => {
    const map = new Map<string, {
      name: string;
      agency: string;
      sales: number;
      warranties: number;
      warrantyAmount: number;
      warrantyRate: number;
    }>();

    sales.forEach((sale) => {
      const name = sale.agents?.full_name || 'Agent non renseigné';
      const agency = agencyName(sale.agents?.agency_id);

      const current = map.get(name) || {
        name,
        agency,
        sales: 0,
        warranties: 0,
        warrantyAmount: 0,
        warrantyRate: 0,
      };

      current.sales += 1;

      if (sale.warranty_sold) {
        current.warranties += 1;
        current.warrantyAmount += Number(sale.warranty_amount || 0);
      }

      current.warrantyRate = current.sales > 0 ? Math.round((current.warranties / current.sales) * 100) : 0;

      map.set(name, current);
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.warranties !== a.warranties) return b.warranties - a.warranties;
      return b.warrantyAmount - a.warrantyAmount;
    });
  }, [sales]);

  const agencyWarrantyRanking = useMemo(() => {
    const base = [
      { agency: 'Blois', sales: 0, warranties: 0, warrantyAmount: 0, warrantyRate: 0 },
      { agency: 'Tours', sales: 0, warranties: 0, warrantyAmount: 0, warrantyRate: 0 },
      { agency: 'Bourges', sales: 0, warranties: 0, warrantyAmount: 0, warrantyRate: 0 },
    ];

    sales.forEach((sale) => {
      const agency = agencyName(sale.agents?.agency_id);
      const row = base.find(item => item.agency === agency);

      if (!row) return;

      row.sales += 1;

      if (sale.warranty_sold) {
        row.warranties += 1;
        row.warrantyAmount += Number(sale.warranty_amount || 0);
      }
    });

    return base
      .map((row) => ({
        ...row,
        warrantyRate: row.sales > 0 ? Math.round((row.warranties / row.sales) * 100) : 0,
      }))
      .sort((a, b) => {
        if (b.warranties !== a.warranties) return b.warranties - a.warranties;
        return b.warrantyAmount - a.warrantyAmount;
      });
  }, [sales]);

  const bestAgent = agentWarrantyRanking.length > 0 ? agentWarrantyRanking[0] : null;
  const bestAgency = agencyWarrantyRanking.length > 0 ? agencyWarrantyRanking[0] : null;

  if (loading) {
    return (
      <div className="card">
        <p className="muted">Chargement des garanties...</p>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="card">
        <h3>Garanties</h3>
        <p className="muted">Données réelles calculées depuis les ventes enregistrées dans Supabase.</p>
      </div>

      <div className="grid cards3">
        <div className="card">
          <h3>Garanties vendues</h3>
          <div className="stat-value">{totalWarranties}</div>
          <p className="muted">Sur {totalSales} vente(s) enregistrée(s)</p>
        </div>

        <div className="card">
          <h3>Taux garantie</h3>
          <div className="stat-value">{warrantyRate}%</div>
          <p className={warrantyRate >= 50 ? 'stat-good' : 'muted'}>
            {warrantyRate >= 50 ? 'Bon niveau de vente garantie' : 'Objectif : augmenter le taux par agent'}
          </p>
        </div>

        <div className="card">
          <h3>Montant garanties</h3>
          <div className="stat-value">{euro(totalWarrantyAmount)}</div>
          <p className="muted">Montant total des garanties vendues</p>
        </div>
      </div>

      <div className="grid cards3">
        <div className="card">
          <h3>Meilleur agent</h3>
          <div className="stat-value">{bestAgent ? bestAgent.name : '-'}</div>
          <p className="muted">
            {bestAgent
              ? `${bestAgent.warranties} garantie(s) — ${euro(bestAgent.warrantyAmount)}`
              : 'Aucune garantie vendue pour le moment'}
          </p>
        </div>

        <div className="card">
          <h3>Meilleure agence</h3>
          <div className="stat-value">{bestAgency ? bestAgency.agency : '-'}</div>
          <p className="muted">
            {bestAgency
              ? `${bestAgency.warranties} garantie(s) — taux ${bestAgency.warrantyRate}%`
              : 'Aucune agence classée pour le moment'}
          </p>
        </div>

        <div className="card">
          <h3>Ventes sans garantie</h3>
          <div className="stat-value">{totalSales - totalWarranties}</div>
          <p className="muted">Potentiel de progression commerciale</p>
        </div>
      </div>

      <div className="card">
        <h3>Classement garanties par agent</h3>

        {agentWarrantyRanking.length === 0 ? (
          <p className="muted">Aucun agent à afficher pour le moment.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Agence</th>
                <th>Ventes</th>
                <th>Garanties</th>
                <th>Taux</th>
                <th>Montant</th>
              </tr>
            </thead>

            <tbody>
              {agentWarrantyRanking.map((agent, i) => (
                <tr key={agent.name}>
                  <td><strong>{i === 0 ? '👑 ' : ''}{agent.name}</strong></td>
                  <td><span className="badge">{agent.agency}</span></td>
                  <td>{agent.sales}</td>
                  <td>{agent.warranties}</td>
                  <td>{agent.warrantyRate}%</td>
                  <td><strong>{euro(agent.warrantyAmount)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Classement garanties par agence</h3>

        <table className="table">
          <thead>
            <tr>
              <th>Agence</th>
              <th>Ventes</th>
              <th>Garanties</th>
              <th>Taux</th>
              <th>Montant</th>
            </tr>
          </thead>

          <tbody>
            {agencyWarrantyRanking.map((agency, i) => (
              <tr key={agency.agency}>
                <td><strong>{i === 0 ? '👑 ' : ''}{agency.agency}</strong></td>
                <td>{agency.sales}</td>
                <td>{agency.warranties}</td>
                <td>{agency.warrantyRate}%</td>
                <td><strong>{euro(agency.warrantyAmount)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Détail des garanties vendues</h3>

        {warrantySales.length === 0 ? (
          <p className="muted">Aucune garantie vendue pour le moment.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Véhicule</th>
                <th>Agent</th>
                <th>Agence</th>
                <th>Type garantie</th>
                <th>Montant</th>
              </tr>
            </thead>

            <tbody>
              {warrantySales.map((sale) => (
                <tr key={sale.id}>
                  <td>
                    <strong>{sale.vehicle_name || '-'}</strong>
                    {(sale.registration || sale.vin) && (
                      <div className="muted" style={{ fontSize: 12 }}>
                        {sale.registration ? `Immat: ${sale.registration}` : ''}
                        {sale.registration && sale.vin ? ' — ' : ''}
                        {sale.vin ? `VIN: ${sale.vin}` : ''}
                      </div>
                    )}
                  </td>
                  <td>{sale.agents?.full_name || '-'}</td>
                  <td><span className="badge">{agencyName(sale.agents?.agency_id)}</span></td>
                  <td>{sale.warranty_type || 'Garantie vendue'}</td>
                  <td><strong>{euro(Number(sale.warranty_amount || 0))}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function Messages({
  currentAgent = null,
  isResponsable = false,
}: {
  currentAgent?: CurrentAgentForPages | null;
  isResponsable?: boolean;
} = {}) {
  const [directionMessages, setDirectionMessages] = useState<DirectionMessage[]>([]);
  const [agentsList, setAgentsList] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingMessage, setEditingMessage] = useState<DirectionMessage | null>(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState('all');
  const [agencyId, setAgencyId] = useState<number | ''>('');
  const [agentId, setAgentId] = useState<number | ''>('');
  const [pinned, setPinned] = useState(false);

  async function loadMessages() {
    setLoading(true);

    const { data, error } = await supabase
      .from('direction_messages')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur chargement messages direction:', error);
      setDirectionMessages([]);
    } else {
      setDirectionMessages(data || []);
    }

    setLoading(false);
  }

  async function loadAgents() {
    const { data, error } = await supabase
      .from('agents')
      .select('id, full_name, agency_id')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Erreur chargement agents pour messages:', error);
      setAgentsList([]);
    } else {
      setAgentsList(data || []);
    }
  }

  useEffect(() => {
    loadMessages();
    loadAgents();
  }, []);

  function resetForm() {
    setEditingMessage(null);
    setTitle('');
    setMessage('');
    setTargetType('all');
    setAgencyId('');
    setAgentId('');
    setPinned(false);
  }

  function openNewMessageForm() {
    if (!isResponsable) return;
    resetForm();
    setShowForm(true);
  }

  function openEditMessageForm(item: DirectionMessage) {
    if (!isResponsable) return;

    setEditingMessage(item);
    setTitle(item.title || '');
    setMessage(item.message || '');
    setTargetType(item.target_type || 'all');
    setAgencyId(item.agency_id || '');
    setAgentId(item.agent_id || '');
    setPinned(Boolean(item.pinned));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveMessage() {
    if (!isResponsable) return;

    if (!title.trim()) {
      alert('Il faut indiquer un titre.');
      return;
    }

    if (!message.trim()) {
      alert('Il faut écrire un message.');
      return;
    }

    setSaving(true);

    const payload = {
      title: title.trim(),
      message: message.trim(),
      target_type: targetType,
      agency_id: targetType === 'agency' ? Number(agencyId) || null : null,
      agent_id: targetType === 'agent' ? Number(agentId) || null : null,
      pinned,
    };

    const { error } = editingMessage
      ? await supabase.from('direction_messages').update(payload).eq('id', editingMessage.id)
      : await supabase.from('direction_messages').insert(payload);

    if (error) {
      console.error('Erreur sauvegarde message direction:', error);
      alert("Erreur pendant l'enregistrement du message.");
    } else {
      resetForm();
      setShowForm(false);
      await loadMessages();
    }

    setSaving(false);
  }

  async function deleteMessage() {
    if (!editingMessage || !isResponsable) return;

    const ok = confirm(`Supprimer le message "${editingMessage.title}" ?`);
    if (!ok) return;

    setSaving(true);

    const { error } = await supabase
      .from('direction_messages')
      .delete()
      .eq('id', editingMessage.id);

    if (error) {
      console.error('Erreur suppression message direction:', error);
      alert('Erreur pendant la suppression du message.');
    } else {
      resetForm();
      setShowForm(false);
      await loadMessages();
    }

    setSaving(false);
  }

  function targetLabel(item: DirectionMessage) {
    if (item.target_type === 'agency') return `Agence ${agencyName(item.agency_id)}`;

    if (item.target_type === 'agent') {
      const agent = agentsList.find(a => Number(a.id) === Number(item.agent_id));
      return agent ? `Agent ${agent.full_name}` : 'Agent ciblé';
    }

    return 'Tous les agents';
  }

  function formatDate(value: string | null) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const visibleMessages = directionMessages.filter((item) => {
    if (isResponsable) return true;
    if (!currentAgent) return false;

    if (item.target_type === 'all' || !item.target_type) return true;
    if (item.target_type === 'agency') return Number(item.agency_id) === Number(currentAgent.agency_id);
    if (item.target_type === 'agent') return Number(item.agent_id) === Number(currentAgent.id);

    return false;
  });

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h3>{isResponsable ? 'Messages Direction' : 'Messages de la Direction'}</h3>
          <p className="muted">
            {isResponsable
              ? 'Publie des annonces visibles par tous les agents, une agence ou un agent précis.'
              : 'Consulte les annonces et consignes envoyées par la Direction.'}
          </p>
        </div>

        {isResponsable && (
          <button
            className="btn"
            onClick={() => {
              if (showForm && !editingMessage) {
                setShowForm(false);
              } else {
                openNewMessageForm();
              }
            }}
          >
            {showForm && !editingMessage ? 'Fermer' : 'Nouveau message'}
          </button>
        )}
      </div>

      {showForm && isResponsable && (
        <div className="card" style={{ marginTop: 14, marginBottom: 14 }}>
          <h4>{editingMessage ? 'Modifier le message' : 'Nouveau message Direction'}</h4>

          <div style={{ display: 'grid', gap: 10 }}>
            <input placeholder="Titre du message ex : Objectif de la semaine" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea placeholder="Message à afficher aux agents..." value={message} onChange={(e) => setMessage(e.target.value)} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 10 }}>
              <select value={targetType} onChange={(e) => { setTargetType(e.target.value); setAgencyId(''); setAgentId(''); }}>
                <option value="all">Tous les agents</option>
                <option value="agency">Une agence</option>
                <option value="agent">Un agent précis</option>
              </select>

              {targetType === 'agency' && (
                <select value={agencyId} onChange={(e) => setAgencyId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Sélectionner une agence</option>
                  <option value={1}>Blois</option>
                  <option value={2}>Tours</option>
                  <option value={3}>Bourges</option>
                </select>
              )}

              {targetType === 'agent' && (
                <select value={agentId} onChange={(e) => setAgentId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Sélectionner un agent</option>
                  {agentsList.map((agent) => (
                    <option key={agent.id} value={agent.id}>{agent.full_name} — {agencyName(agent.agency_id)}</option>
                  ))}
                </select>
              )}

              <label className="item" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
                Épingler le message
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={saveMessage} disabled={saving}>
                {saving ? 'Enregistrement...' : editingMessage ? 'Modifier le message' : 'Publier le message'}
              </button>

              {editingMessage && <button onClick={deleteMessage} disabled={saving}>Supprimer</button>}

              <button onClick={() => { resetForm(); setShowForm(false); }} disabled={saving}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {loading && <p className="muted">Chargement des messages...</p>}
      {!loading && visibleMessages.length === 0 && <p className="muted">Aucun message Direction pour le moment.</p>}

      {!loading && visibleMessages.length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {visibleMessages.map((item) => (
            <div
              className="item"
              key={item.id}
              onClick={() => openEditMessageForm(item)}
              style={{ cursor: isResponsable ? 'pointer' : 'default' }}
              title={isResponsable ? 'Cliquer pour modifier le message' : ''}
            >
              <strong>{item.pinned ? '📌 ' : ''}{item.title}</strong>
              <p className="muted" style={{ marginTop: 4 }}>
                {targetLabel(item)} {item.created_at ? `— ${formatDate(item.created_at)}` : ''}
              </p>
              <p style={{ whiteSpace: 'pre-wrap' }}>{item.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


export function Documents({
  currentAgent = null,
  isResponsable = false,
}: {
  currentAgent?: CurrentAgentForPages | null;
  isResponsable?: boolean;
} = {}) {
  const responsableMode = isResponsable === true && currentAgent?.account_type === 'responsable';

  const [documentsList, setDocumentsList] = useState<AgentDocument[]>([]);
  const [agentsList, setAgentsList] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingDocument, setEditingDocument] = useState<AgentDocument | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Général');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetType, setTargetType] = useState(responsableMode ? 'all' : 'responsable');
  const [agencyId, setAgencyId] = useState<number | ''>('');
  const [agentId, setAgentId] = useState<number | ''>('');
  const [documentStatus, setDocumentStatus] = useState('nouveau');

  useEffect(() => {
    if (!responsableMode) {
      setTargetType('responsable');
      setAgencyId('');
      setAgentId('');
      setDocumentStatus('nouveau');
    } else if (!editingDocument && targetType === 'responsable') {
      setTargetType('all');
    }
  }, [responsableMode, currentAgent?.id]);

  async function loadDocuments() {
    setLoading(true);

    const { data, error } = await supabase
      .from('agent_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur chargement documents agents:', error);
      setDocumentsList([]);
    } else {
      setDocumentsList((data || []) as AgentDocument[]);
    }

    setLoading(false);
  }

  async function loadAgents() {
    const { data, error } = await supabase
      .from('agents')
      .select('id, full_name, agency_id')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Erreur chargement agents pour documents:', error);
      setAgentsList([]);
    } else {
      setAgentsList(data || []);
    }
  }

  useEffect(() => {
    loadDocuments();
    loadAgents();
  }, []);

  function resetForm() {
    setEditingDocument(null);
    setTitle('');
    setCategory('Général');
    setDescription('');
    setFileUrl('');
    setSelectedFile(null);
    setTargetType(responsableMode ? 'all' : 'responsable');
    setAgencyId('');
    setAgentId('');
    setDocumentStatus('nouveau');
  }

  function openNewDocumentForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditDocumentForm(item: AgentDocument) {
    if (!responsableMode) return;

    setEditingDocument(item);
    setTitle(item.title || '');
    setCategory(item.category || 'Général');
    setDescription(item.description || '');
    setFileUrl(item.file_url || '');
    setSelectedFile(null);
    setTargetType(item.sent_to_responsable || item.target_type === 'responsable' ? 'responsable' : item.target_type || 'all');
    setAgencyId(item.agency_id || '');
    setAgentId(item.agent_id || '');
    setDocumentStatus(item.document_status || 'nouveau');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function uploadSelectedFile() {
    if (!selectedFile) return fileUrl.trim() || null;

    const cleanName = selectedFile.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '-');

    const path = `${Date.now()}-${cleanName}`;

    const { error } = await supabase.storage
      .from('agent-documents')
      .upload(path, selectedFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Erreur upload document:', error);
      throw error;
    }

    const { data } = supabase.storage
      .from('agent-documents')
      .getPublicUrl(path);

    return data.publicUrl;
  }

  async function saveDocument() {
    if (!title.trim()) {
      alert('Il faut indiquer un titre.');
      return;
    }

    if (!responsableMode && !currentAgent) {
      alert("Impossible d'envoyer le document : compte agent non reconnu.");
      return;
    }

    if (responsableMode && targetType === 'agency' && !agencyId) {
      alert('Il faut sélectionner une agence.');
      return;
    }

    if (responsableMode && targetType === 'agent' && !agentId) {
      alert('Il faut sélectionner un agent.');
      return;
    }

    setSaving(true);

    try {
      const finalFileUrl = await uploadSelectedFile();

      const payload = responsableMode
        ? {
            title: title.trim(),
            category: category.trim() || 'Général',
            description: description.trim() || null,
            file_url: finalFileUrl,
            target_type: targetType,
            agency_id: targetType === 'agency' ? Number(agencyId) || null : null,
            agent_id: targetType === 'agent' ? Number(agentId) || null : null,
            sender_agent_id: null,
            sent_to_responsable: targetType === 'responsable',
            document_status: documentStatus || 'nouveau',
          }
        : {
            title: title.trim(),
            category: category.trim() || 'Document agent',
            description: description.trim() || null,
            file_url: finalFileUrl,
            target_type: 'responsable',
            agency_id: currentAgent?.agency_id || null,
            agent_id: null,
            sender_agent_id: currentAgent?.id || null,
            sent_to_responsable: true,
            document_status: 'nouveau',
          };

      const { error } = editingDocument && responsableMode
        ? await supabase.from('agent_documents').update(payload as any).eq('id', editingDocument.id)
        : await supabase.from('agent_documents').insert(payload as any);

      if (error) {
        console.error('Erreur sauvegarde document:', error);
        alert("Erreur pendant l'enregistrement du document. Vérifie que les colonnes sender_agent_id, sent_to_responsable et document_status existent dans Supabase.");
      } else {
        resetForm();
        setShowForm(false);
        await loadDocuments();
      }
    } catch (error) {
      console.error('Erreur envoi fichier document:', error);
      alert("Erreur pendant l'envoi du fichier.");
    }

    setSaving(false);
  }

  async function deleteDocument() {
    if (!editingDocument || !responsableMode) return;

    const ok = confirm(`Supprimer le document "${editingDocument.title}" ?`);
    if (!ok) return;

    setSaving(true);

    const { error } = await supabase
      .from('agent_documents')
      .delete()
      .eq('id', editingDocument.id);

    if (error) {
      console.error('Erreur suppression document:', error);
      alert('Erreur pendant la suppression du document.');
    } else {
      resetForm();
      setShowForm(false);
      await loadDocuments();
    }

    setSaving(false);
  }

  async function markDocumentStatus(item: AgentDocument, status: string) {
    if (!responsableMode) return;

    const { error } = await supabase
      .from('agent_documents')
      .update({ document_status: status })
      .eq('id', item.id);

    if (error) {
      console.error('Erreur changement statut document:', error);
      alert('Erreur pendant le changement de statut.');
    } else {
      await loadDocuments();
    }
  }

  function senderLabel(item: AgentDocument) {
    if (!item.sender_agent_id) return null;
    const agent = agentsList.find(a => Number(a.id) === Number(item.sender_agent_id));
    return agent ? agent.full_name : `Agent #${item.sender_agent_id}`;
  }

  function targetLabel(item: AgentDocument) {
    if (item.sent_to_responsable || item.target_type === 'responsable') {
      const sender = senderLabel(item);
      return sender ? `Envoyé au Responsable par ${sender}` : 'Envoyé au Responsable';
    }

    if (item.target_type === 'agency') return `Agence ${agencyName(item.agency_id)}`;

    if (item.target_type === 'agent') {
      const agent = agentsList.find(a => Number(a.id) === Number(item.agent_id));
      return agent ? `Agent ${agent.full_name}` : 'Agent ciblé';
    }

    return 'Tous les agents';
  }

  function formatDate(value: string | null) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  const visibleDocuments = documentsList.filter((item) => {
    if (responsableMode) return true;
    if (!currentAgent) return false;

    if (item.sent_to_responsable || item.target_type === 'responsable') {
      return Number(item.sender_agent_id) === Number(currentAgent.id);
    }

    if (item.target_type === 'all' || !item.target_type) return true;
    if (item.target_type === 'agency') return Number(item.agency_id) === Number(currentAgent.agency_id);
    if (item.target_type === 'agent') return Number(item.agent_id) === Number(currentAgent.id);

    return false;
  });

  const receivedDocuments = documentsList.filter((item) => (
    Boolean(item.sent_to_responsable) || item.target_type === 'responsable'
  ));

  const newDocumentsCount = receivedDocuments.filter((item) => (
    (item.document_status || 'nouveau') === 'nouveau'
  )).length;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h3>{responsableMode ? `Documents agents${newDocumentsCount > 0 ? ` 🔔 ${newDocumentsCount}` : ''}` : 'Mes documents'}</h3>
          <p className="muted">
            {responsableMode
              ? 'Documents partagés avec les agents et documents reçus des agents.'
              : 'Consulte les documents transmis par la Direction et envoie un document au Responsable.'}
          </p>
        </div>

        <button
          className="btn"
          onClick={() => {
            if (showForm && !editingDocument) {
              setShowForm(false);
            } else {
              openNewDocumentForm();
            }
          }}
        >
          {showForm && !editingDocument
            ? 'Fermer'
            : responsableMode
              ? 'Ajouter un document'
              : 'Envoyer au Responsable'}
        </button>
      </div>

      {responsableMode && newDocumentsCount > 0 && (
        <div className="item" style={{ marginTop: 14, border: '1px solid rgba(255,255,255,.25)' }}>
          <strong>🔔 {newDocumentsCount} nouveau(x) document(s) reçu(s)</strong>
          <p className="muted">Des agents t'ont envoyé des documents. Passe-les en “Vu” ou “Traité” après contrôle.</p>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginTop: 14, marginBottom: 14 }}>
          <h4>
            {editingDocument
              ? 'Modifier le document agent'
              : responsableMode
                ? 'Nouveau document agent'
                : 'Envoyer un document au Responsable'}
          </h4>

          <div style={{ display: 'grid', gap: 10 }}>
            <input
              placeholder={responsableMode ? 'Titre du document ex : Procédure garantie Opteven' : 'Titre ex : Carte grise Mercedes Classe A'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(220px, 2fr)', gap: 10 }}>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="Général">Général</option>
                <option value="Garantie">Garantie</option>
                <option value="Procédure">Procédure</option>
                <option value="Formation">Formation</option>
                <option value="Commercial">Commercial</option>
                <option value="Administratif">Administratif</option>
                <option value="Carte grise">Carte grise</option>
                <option value="Mandat">Mandat</option>
                <option value="Bon de commande">Bon de commande</option>
                <option value="Facture">Facture</option>
                <option value="Photo véhicule">Photo véhicule</option>
              </select>

              <input
                placeholder="Lien du fichier ou URL facultatif"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
              />
            </div>

            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />

            {selectedFile && (
              <p className="muted">Fichier sélectionné : {selectedFile.name}</p>
            )}

            <textarea
              placeholder={responsableMode ? 'Description ou consigne pour les agents...' : 'Message au Responsable, commentaire, information utile...'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            {responsableMode && (
              <>
                <div className="item">
                  <strong>Destination du document</strong>
                  <p className="muted">Choisis qui doit voir le document. “Envoyé au Responsable” sert uniquement aux documents remontés par les agents.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 10 }}>
                  <select value={targetType} onChange={(e) => { setTargetType(e.target.value); setAgencyId(''); setAgentId(''); }}>
                    <option value="all">Tous les agents</option>
                    <option value="agency">Une agence</option>
                    <option value="agent">Un agent précis</option>
                    <option value="responsable">Envoyé au Responsable</option>
                  </select>

                  {targetType === 'agency' && (
                    <select value={agencyId} onChange={(e) => setAgencyId(e.target.value ? Number(e.target.value) : '')}>
                      <option value="">Sélectionner une agence</option>
                      <option value={1}>Blois</option>
                      <option value={2}>Tours</option>
                      <option value={3}>Bourges</option>
                    </select>
                  )}

                  {targetType === 'agent' && (
                    <select value={agentId} onChange={(e) => setAgentId(e.target.value ? Number(e.target.value) : '')}>
                      <option value="">Sélectionner un agent</option>
                      {agentsList.map((agent) => (
                        <option key={agent.id} value={agent.id}>{agent.full_name} — {agencyName(agent.agency_id)}</option>
                      ))}
                    </select>
                  )}

                  <select value={documentStatus} onChange={(e) => setDocumentStatus(e.target.value)}>
                    <option value="nouveau">Nouveau</option>
                    <option value="vu">Vu</option>
                    <option value="traite">Traité</option>
                  </select>
                </div>
              </>
            )}

            {!responsableMode && (
              <div className="item" style={{ border: '1px solid rgba(255,255,255,.25)' }}>
                <strong>Destinataire : Responsable</strong>
                <p className="muted">Ce document sera privé : il sera visible uniquement par toi et par la Direction.</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={saveDocument} disabled={saving}>
                {saving
                  ? 'Enregistrement...'
                  : editingDocument
                    ? 'Modifier le document'
                    : responsableMode
                      ? 'Ajouter le document'
                      : 'Envoyer au Responsable'}
              </button>

              {editingDocument && responsableMode && <button onClick={deleteDocument} disabled={saving}>Supprimer</button>}

              <button onClick={() => { resetForm(); setShowForm(false); }} disabled={saving}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {loading && <p className="muted">Chargement des documents...</p>}
      {!loading && visibleDocuments.length === 0 && <p className="muted">Aucun document pour le moment.</p>}

      {!loading && visibleDocuments.length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {visibleDocuments.map((item) => (
            <div
              className="item"
              key={item.id}
              onClick={() => openEditDocumentForm(item)}
              style={{ cursor: responsableMode ? 'pointer' : 'default' }}
              title={responsableMode ? 'Cliquer pour modifier le document' : ''}
            >
              <strong>
                {(item.sent_to_responsable || item.target_type === 'responsable') && (item.document_status || 'nouveau') === 'nouveau' ? '🔔 ' : ''}
                {item.title}
              </strong>

              <p className="muted" style={{ marginTop: 4 }}>
                {item.category || 'Général'} — {targetLabel(item)} {item.created_at ? `— ${formatDate(item.created_at)}` : ''}
              </p>

              {responsableMode && (item.sent_to_responsable || item.target_type === 'responsable') && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, marginBottom: 8 }} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => markDocumentStatus(item, 'nouveau')} disabled={(item.document_status || 'nouveau') === 'nouveau'}>Nouveau</button>
                  <button onClick={() => markDocumentStatus(item, 'vu')} disabled={item.document_status === 'vu'}>Vu</button>
                  <button onClick={() => markDocumentStatus(item, 'traite')} disabled={item.document_status === 'traite'}>Traité</button>
                  <span className="badge">Statut : {item.document_status || 'nouveau'}</span>
                </div>
              )}

              {item.description && (
                <p style={{ whiteSpace: 'pre-wrap' }}>{item.description}</p>
              )}

              {item.file_url && (
                <a
                  href={item.file_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  Ouvrir le document
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export function Stats() {
  const [sales, setSales] = useState<VehicleSale[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadSales() {
    setLoading(true);

    const { data, error } = await supabase
      .from('vehicle_sales')
      .select(`
        *,
        agents!vehicle_sales_agent_id_fkey (
          full_name,
          agency_id
        )
      `)
      .order('id', { ascending: false });

    if (error) {
      console.error('Erreur stats:', error);
      setSales([]);
    } else {
      setSales(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadSales();
  }, []);

  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  const weekSales = sales.filter(sale => isAfterOrEqual(saleDateToDate(sale.sale_date), weekStart));
  const monthSales = sales.filter(sale => isAfterOrEqual(saleDateToDate(sale.sale_date), monthStart));
  const yearSales = sales.filter(sale => isAfterOrEqual(saleDateToDate(sale.sale_date), yearStart));

  const week = calculateStats(weekSales);
  const month = calculateStats(monthSales);
  const year = calculateStats(yearSales);
  const total = calculateStats(sales);

  const agentRanking = useMemo(() => {
    const map = new Map<string, {
      name: string;
      agency: string;
      sales: number;
      ca: number;
      margin: number;
      warranties: number;
    }>();

    monthSales.forEach((sale) => {
      const name = sale.agents?.full_name || 'Agent non renseigné';
      const agency = agencyName(sale.agents?.agency_id);

      const current = map.get(name) || {
        name,
        agency,
        sales: 0,
        ca: 0,
        margin: 0,
        warranties: 0,
      };

      current.sales += 1;
      current.ca += Number(sale.sale_price || 0);
      current.margin += Number(sale.margin_amount || 0);
      current.warranties += sale.warranty_sold ? 1 : 0;

      map.set(name, current);
    });

    return Array.from(map.values()).sort((a, b) => b.margin - a.margin);
  }, [monthSales]);

  const agencyRanking = useMemo(() => {
    const base = [
      { agency: 'Blois', sales: 0, ca: 0, margin: 0, warranties: 0 },
      { agency: 'Tours', sales: 0, ca: 0, margin: 0, warranties: 0 },
      { agency: 'Bourges', sales: 0, ca: 0, margin: 0, warranties: 0 },
    ];

    monthSales.forEach((sale) => {
      const agency = agencyName(sale.agents?.agency_id);
      const row = base.find(item => item.agency === agency);

      if (!row) return;

      row.sales += 1;
      row.ca += Number(sale.sale_price || 0);
      row.margin += Number(sale.margin_amount || 0);
      row.warranties += sale.warranty_sold ? 1 : 0;
    });

    return base.sort((a, b) => b.margin - a.margin);
  }, [monthSales]);

  if (loading) {
    return (
      <div className="card">
        <p className="muted">Chargement des statistiques...</p>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="card">
        <h3>Statistiques réelles</h3>
        <p className="muted">Données calculées automatiquement depuis les ventes enregistrées dans Supabase.</p>
      </div>

      <div className="grid cards3">
        <div className="card">
          <h3>Cette semaine</h3>
          <div className="stat-value">{euro(week.ca)}</div>
          <p className="muted">{week.salesCount} vente(s)</p>
          <p>Marge : <strong>{euro(week.margin)}</strong></p>
          <p>Garanties : <strong>{week.warranties}</strong></p>
        </div>

        <div className="card">
          <h3>Ce mois</h3>
          <div className="stat-value">{euro(month.ca)}</div>
          <p className="muted">{month.salesCount} vente(s)</p>
          <p>Marge : <strong>{euro(month.margin)}</strong></p>
          <p>Garanties : <strong>{month.warranties}</strong></p>
        </div>

        <div className="card">
          <h3>Cette année</h3>
          <div className="stat-value">{euro(year.ca)}</div>
          <p className="muted">{year.salesCount} vente(s)</p>
          <p>Marge : <strong>{euro(year.margin)}</strong></p>
          <p>Garanties : <strong>{year.warranties}</strong></p>
        </div>
      </div>

      <div className="grid cards3">
        <div className="card">
          <h3>Total général</h3>
          <div className="stat-value">{euro(total.ca)}</div>
          <p className="muted">{total.salesCount} vente(s) au total</p>
        </div>

        <div className="card">
          <h3>Marge moyenne</h3>
          <div className="stat-value">{euro(Math.round(total.averageMargin))}</div>
          <p className="muted">Moyenne par véhicule vendu</p>
        </div>

        <div className="card">
          <h3>Taux garantie</h3>
          <div className="stat-value">{total.warrantyRate}%</div>
          <p className="muted">{total.warranties} garantie(s) vendue(s)</p>
        </div>
      </div>

      <div className="card">
        <h3>Classement agents du mois</h3>

        {agentRanking.length === 0 ? (
          <p className="muted">Aucun agent classé ce mois-ci.</p>
        ) : (
          agentRanking.map((agent, i) => (
            <div className="rank" key={agent.name}>
              <span>
                {i === 0 ? '👑 ' : ''}
                {i + 1}. {agent.name}
                <span className="muted"> — {agent.agency} — {agent.sales} vente(s)</span>
              </span>
              <strong>{euro(agent.margin)}</strong>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h3>Comparatif agences du mois</h3>

        <table className="table">
          <thead>
            <tr>
              <th>Agence</th>
              <th>Ventes</th>
              <th>CA</th>
              <th>Marge</th>
              <th>Garanties</th>
            </tr>
          </thead>

          <tbody>
            {agencyRanking.map((agency, i) => (
              <tr key={agency.agency}>
                <td>{i === 0 ? '👑 ' : ''}{agency.agency}</td>
                <td>{agency.sales}</td>
                <td>{euro(agency.ca)}</td>
                <td><strong>{euro(agency.margin)}</strong></td>
                <td>{agency.warranties}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
