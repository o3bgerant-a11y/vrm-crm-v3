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
export function Ventes() {
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
  }, []);

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
          <p className="muted">Ajout, modification et suivi des ventes connectées à Supabase.</p>
        </div>

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
      </div>

      {showForm && (
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
              <tr key={s.id} onClick={() => openEditSaleForm(s)} style={{ cursor: 'pointer' }} title="Cliquer pour modifier la vente">
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

export function Messages() {
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
    resetForm();
    setShowForm(true);
  }

  function openEditMessageForm(item: DirectionMessage) {
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
    if (!editingMessage) return;

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

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h3>Messages Direction</h3>
          <p className="muted">Publie des annonces visibles par les agents commerciaux.</p>
        </div>

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
      </div>

      {showForm && (
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
      {!loading && directionMessages.length === 0 && <p className="muted">Aucun message Direction pour le moment.</p>}

      {!loading && directionMessages.length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {directionMessages.map((item) => (
            <div className="item" key={item.id} onClick={() => openEditMessageForm(item)} style={{ cursor: 'pointer' }} title="Cliquer pour modifier le message">
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
  isResponsable = true,
}: {
  currentAgent?: CurrentAgentForPages | null;
  isResponsable?: boolean;
} = {}) {
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
  const [targetType, setTargetType] = useState('all');
  const [agencyId, setAgencyId] = useState<number | ''>('');
  const [agentId, setAgentId] = useState<number | ''>('');
  const [documentStatus, setDocumentStatus] = useState('nouveau');

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
      setDocumentsList(data || []);
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
    setTargetType(isResponsable ? 'all' : 'responsable');
    setAgencyId('');
    setAgentId('');
    setDocumentStatus('nouveau');
  }

  function openNewDocumentForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditDocumentForm(item: AgentDocument) {
    if (!isResponsable) return;

    setEditingDocument(item);
    setTitle(item.title || '');
    setCategory(item.category || 'Général');
    setDescription(item.description || '');
    setFileUrl(item.file_url || '');
    setSelectedFile(null);
    setTargetType(item.target_type || 'all');
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

    if (!isResponsable && !currentAgent) {
      alert("Impossible d'envoyer le document : compte agent non reconnu.");
      return;
    }

    setSaving(true);

    try {
      const finalFileUrl = await uploadSelectedFile();

      const payload = isResponsable
        ? {
            title: title.trim(),
            category: category.trim() || 'Général',
            description: description.trim() || null,
            file_url: finalFileUrl,
            target_type: targetType,
            agency_id: targetType === 'agency' ? Number(agencyId) || null : null,
            agent_id: targetType === 'agent' ? Number(agentId) || null : null,
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
            document_status: 'nouveau',
            sent_to_responsable: true,
          };

      const { error } = editingDocument && isResponsable
        ? await supabase.from('agent_documents').update(payload).eq('id', editingDocument.id)
        : await supabase.from('agent_documents').insert(payload);

      if (error) {
        console.error('Erreur sauvegarde document:', error);
        alert("Erreur pendant l'enregistrement du document.");
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
    if (!editingDocument || !isResponsable) return;

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
    if (!isResponsable) return;

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
    return agent ? agent.full_name : 'Agent';
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
    if (isResponsable) return true;
    if (!currentAgent) return false;

    if (Number(item.sender_agent_id) === Number(currentAgent.id)) return true;
    if (item.target_type === 'all') return true;
    if (item.target_type === 'agency') return Number(item.agency_id) === Number(currentAgent.agency_id);
    if (item.target_type === 'agent') return Number(item.agent_id) === Number(currentAgent.id);

    return false;
  });

  const newDocumentsCount = documentsList.filter((item) => (
    isResponsable &&
    Boolean(item.sent_to_responsable) &&
    (item.document_status || 'nouveau') === 'nouveau'
  )).length;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h3>{isResponsable ? 'Documents agents' : 'Mes documents'}</h3>
          <p className="muted">
            {isResponsable
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
            : isResponsable
              ? 'Ajouter un document'
              : 'Envoyer un document'}
        </button>
      </div>

      {isResponsable && newDocumentsCount > 0 && (
        <div className="item" style={{ marginTop: 14, border: '1px solid rgba(255,255,255,.25)' }}>
          <strong>🔔 {newDocumentsCount} nouveau(x) document(s) reçu(s)</strong>
          <p className="muted">Des agents t'ont envoyé des documents à traiter.</p>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginTop: 14, marginBottom: 14 }}>
          <h4>
            {editingDocument
              ? 'Modifier le document agent'
              : isResponsable
                ? 'Nouveau document agent'
                : 'Envoyer un document au Responsable'}
          </h4>

          <div style={{ display: 'grid', gap: 10 }}>
            <input
              placeholder={isResponsable ? 'Titre du document ex : Procédure garantie Opteven' : 'Titre ex : Carte grise Mercedes Classe A'}
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
              placeholder={isResponsable ? 'Description ou consigne liée au document...' : 'Message au Responsable...'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            {isResponsable && (
              <>
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

                  <select value={documentStatus} onChange={(e) => setDocumentStatus(e.target.value)}>
                    <option value="nouveau">Nouveau</option>
                    <option value="vu">Vu</option>
                    <option value="traite">Traité</option>
                  </select>
                </div>
              </>
            )}

            {!isResponsable && (
              <div className="item">
                <strong>Destinataire : Responsable</strong>
                <p className="muted">Le document sera visible par la Direction uniquement.</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={saveDocument} disabled={saving}>
                {saving
                  ? 'Enregistrement...'
                  : editingDocument
                    ? 'Modifier le document'
                    : isResponsable
                      ? 'Ajouter le document'
                      : 'Envoyer au Responsable'}
              </button>

              {editingDocument && isResponsable && <button onClick={deleteDocument} disabled={saving}>Supprimer</button>}

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
              style={{ cursor: isResponsable ? 'pointer' : 'default' }}
              title={isResponsable ? 'Cliquer pour modifier le document' : ''}
            >
              <strong>
                {item.sent_to_responsable && (item.document_status || 'nouveau') === 'nouveau' ? '🔔 ' : ''}
                {item.title}
              </strong>

              <p className="muted" style={{ marginTop: 4 }}>
                {item.category || 'Général'} — {targetLabel(item)} {item.created_at ? `— ${formatDate(item.created_at)}` : ''}
              </p>

              {isResponsable && item.sent_to_responsable && (
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
