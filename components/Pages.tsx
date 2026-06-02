'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

const euro = (n: number) => n.toLocaleString('fr-FR') + ' ‚Ç¨';

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
  created_at: string | null;
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
          <h3>{index === 0 ? 'üëë ' : ''}{agency.agency}</h3>

          <p className="muted">
            #{index + 1} au classement agences
          </p>

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
  const [loading, setLoading] = useState(true);

  async function loadAgentsPage() {
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
      console.error('Erreur chargement agents:', agentsError);
      setAgentsList([]);
    } else {
      setAgentsList(agentsData || []);
    }

    if (salesError) {
      console.error('Erreur chargement ventes agents:', salesError);
      setSales([]);
    } else {
      setSales(salesData || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAgentsPage();
  }, []);

  const agentRows = useMemo(() => {
    const rows = agentsList.map((agent) => {
      const agentSales = sales.filter(sale => Number(sale.agent_id) === Number(agent.id));

      return {
        id: agent.id,
        name: agent.full_name,
        agency: agencyName(agent.agency_id),
        sales: agentSales.length,
        ca: agentSales.reduce((total, sale) => total + Number(sale.sale_price || 0), 0),
        margin: agentSales.reduce((total, sale) => total + Number(sale.margin_amount || 0), 0),
        warranties: agentSales.filter(sale => sale.warranty_sold).length,
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

  return (
    <div className="card">
      <h3>Agents commerciaux</h3>
      <p className="muted">Donn√©es r√©elles calcul√©es depuis Supabase.</p>

      {loading && <p className="muted">Chargement des agents...</p>}

      {!loading && agentRows.length === 0 && (
        <p className="muted">Aucun agent trouv√© dans Supabase.</p>
      )}

      {!loading && agentRows.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Agence</th>
              <th>Ventes</th>
              <th>CA</th>
              <th>Marge</th>
              <th>Garanties</th>
              <th>Classement</th>
            </tr>
          </thead>

          <tbody>
            {agentRows.map(agent => (
              <tr key={agent.id}>
                <td><strong>{agent.rankGlobal === 1 ? 'üëë ' : ''}{agent.name}</strong></td>
                <td><span className="badge">{agent.agency}</span></td>
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
      alert('Il faut indiquer le v√©hicule vendu.');
      return;
    }

    if (!agentId) {
      alert('Il faut s√©lectionner un agent commercial.');
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
          <h3>Ventes v√©hicules</h3>
          <p className="muted">Ajout, modification et suivi des ventes connect√©es √† Supabase.</p>
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
          {showForm && !editingSale ? 'Fermer' : '‚ûï Nouvelle vente'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginTop: 14, marginBottom: 14 }}>
          <h4>{editingSale ? '‚úèÔ∏è Modifier la vente' : 'üöó Nouvelle vente'}</h4>

          <div style={{ display: 'grid', gap: 10 }}>
            <input
              placeholder="V√©hicule vendu ex : Mercedes Classe A 200 AMG"
              value={vehicleName}
              onChange={(e) => setVehicleName(e.target.value)}
            />

            <input
              placeholder="URL photo v√©hicule facultatif"
              value={vehiclePhotoUrl}
              onChange={(e) => setVehiclePhotoUrl(e.target.value)}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 10 }}>
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
              />

              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">S√©lectionner un agent</option>
                {agentOptions.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.full_name} ‚Äî {agencyName(agent.agency_id)}
                  </option>
                ))}
              </select>

              <input
                placeholder="Immatriculation"
                value={registration}
                onChange={(e) => setRegistration(e.target.value.toUpperCase())}
              />
            </div>

            <input
              placeholder="VIN facultatif"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))', gap: 10 }}>
              <input
                type="number"
                placeholder="Prix net vendeur"
                value={sellerPrice}
                onChange={(e) => setSellerPrice(e.target.value)}
              />

              <input
                type="number"
                placeholder="Prix de vente"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />

              <div className="item">
                <span className="muted">Marge calcul√©e</span>
                <div style={{ fontSize: 22, fontWeight: 800 }}>
                  {euro(calculatedMargin)}
                </div>
              </div>
            </div>

            <div className="item">
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={warrantySold}
                  onChange={(e) => setWarrantySold(e.target.checked)}
                />
                Garantie vendue
              </label>

              {warrantySold && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))', gap: 10, marginTop: 10 }}>
                  <input
                    placeholder="Type garantie ex : Opteven Premium"
                    value={warrantyType}
                    onChange={(e) => setWarrantyType(e.target.value)}
                  />

                  <input
                    type="number"
                    placeholder="Montant garantie"
                    value={warrantyAmount}
                    onChange={(e) => setWarrantyAmount(e.target.value)}
                  />
                </div>
              )}
            </div>

            <textarea
              placeholder="Commentaires"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={saveSale} disabled={saving}>
                {saving ? 'Enregistrement...' : editingSale ? 'üíæ Modifier la vente' : '‚úÖ Enregistrer la vente'}
              </button>

              {editingSale && (
                <button onClick={deleteSale} disabled={saving}>
                  üóë Supprimer
                </button>
              )}

              <button
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                disabled={saving}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        className="search"
        placeholder="Recherche marque, mod√®le, immatriculation, VIN, agent... ex : Mercedes"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading && <p className="muted">Chargement des ventes...</p>}

      {!loading && filteredSales.length === 0 && (
        <p className="muted">Aucune vente trouv√©e.</p>
      )}

      {!loading && filteredSales.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>V√©hicule</th>
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
                onClick={() => openEditSaleForm(s)}
                style={{ cursor: 'pointer' }}
                title="Cliquer pour modifier la vente"
              >
                <td>
                  <strong>{s.vehicle_name}</strong>
                  {(s.registration || s.vin) && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      {s.registration ? `Immat: ${s.registration}` : ''}
                      {s.registration && s.vin ? ' ‚Äî ' : ''}
                      {s.vin ? `VIN: ${s.vin}` : ''}
                    </div>
                  )}
                </td>

                <td>{s.agents?.full_name || '-'}</td>

                <td>
                  <span className="badge">
                    {agencyName(s.agents?.agency_id)}
                  </span>
                </td>

                <td>{euro(Number(s.sale_price || 0))}</td>

                <td>
                  <strong>{euro(Number(s.margin_amount || 0))}</strong>
                </td>

                <td>
                  {s.warranty_sold
                    ? `${s.warranty_type || 'Oui'}${s.warranty_amount ? ` ‚Äî ${euro(Number(s.warranty_amount))}` : ''}`
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
  return (
    <div className="grid cards3">
      <div className="card">
        <h3>Garanties vendues</h3>
        <div className="stat-value">3</div>
        <p className="muted">Objectif : augmenter le taux par agent</p>
      </div>

      <div className="card">
        <h3>Taux garantie</h3>
        <div className="stat-value">75%</div>
        <p className="stat-good">Tr√®s bon niveau</p>
      </div>

      <div className="card">
        <h3>Meilleur agent</h3>
        <div className="stat-value">Maveryk</div>
        <p>5 garanties</p>
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
      alert('Il faut √©crire un message.');
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
      return agent ? `Agent ${agent.full_name}` : 'Agent cibl√©';
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
          {showForm && !editingMessage ? 'Fermer' : '‚ûï Nouveau message'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginTop: 14, marginBottom: 14 }}>
          <h4>{editingMessage ? '‚úèÔ∏è Modifier le message' : 'üì¢ Nouveau message Direction'}</h4>

          <div style={{ display: 'grid', gap: 10 }}>
            <input
              placeholder="Titre du message ex : Objectif de la semaine"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <textarea
              placeholder="Message √† afficher aux agents..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 10 }}>
              <select
                value={targetType}
                onChange={(e) => {
                  setTargetType(e.target.value);
                  setAgencyId('');
                  setAgentId('');
                }}
              >
                <option value="all">Tous les agents</option>
                <option value="agency">Une agence</option>
                <option value="agent">Un agent pr√©cis</option>
              </select>

              {targetType === 'agency' && (
                <select
                  value={agencyId}
                  onChange={(e) => setAgencyId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">S√©lectionner une agence</option>
                  <option value={1}>Blois</option>
                  <option value={2}>Tours</option>
                  <option value={3}>Bourges</option>
                </select>
              )}

              {targetType === 'agent' && (
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">S√©lectionner un agent</option>
                  {agentsList.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.full_name} ‚Äî {agencyName(agent.agency_id)}
                    </option>
                  ))}
                </select>
              )}

              <label className="item" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                />
                √âpingler le message üìå
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={saveMessage} disabled={saving}>
                {saving ? 'Enregistrement...' : editingMessage ? 'üíæ Modifier le message' : '‚úÖ Publier le message'}
              </button>

              {editingMessage && (
                <button onClick={deleteMessage} disabled={saving}>
                  üóë Supprimer
                </button>
              )}

              <button
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                disabled={saving}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <p className="muted">Chargement des messages...</p>}

      {!loading && directionMessages.length === 0 && (
        <p className="muted">Aucun message Direction pour le moment.</p>
      )}

      {!loading && directionMessages.length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {directionMessages.map((item) => (
            <div
              className="item"
              key={item.id}
              onClick={() => openEditMessageForm(item)}
              style={{ cursor: 'pointer' }}
              title="Cliquer pour modifier le message"
            >
              <strong>{item.pinned ? 'üìå ' : ''}{item.title}</strong>

              <p className="muted" style={{ marginTop: 4 }}>
                {targetLabel(item)} {item.created_at ? `‚Äî ${formatDate(item.created_at)}` : ''}
              </p>

              <p style={{ whiteSpace: 'pre-wrap' }}>
                {item.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Documents() {
  const [agentDocuments, setAgentDocuments] = useState<AgentDocument[]>([]);
  const [agentsList, setAgentsList] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingDocument, setEditingDocument] = useState<AgentDocument | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('G√©n√©ral');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [targetType, setTargetType] = useState('all');
  const [agencyId, setAgencyId] = useState<number | ''>('');
  const [agentId, setAgentId] = useState<number | ''>('');

  async function loadDocuments() {
    setLoading(true);

    const { data, error } = await supabase
      .from('agent_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur chargement documents agents:', error);
      setAgentDocuments([]);
    } else {
      setAgentDocuments(data || []);
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
    setCategory('G√©n√©ral');
    setDescription('');
    setFileUrl('');
    setTargetType('all');
    setAgencyId('');
    setAgentId('');
  }

  function openNewDocumentForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditDocumentForm(item: AgentDocument) {
    setEditingDocument(item);
    setTitle(item.title || '');
    setCategory(item.category || 'G√©n√©ral');
    setDescription(item.description || '');
    setFileUrl(item.file_url || '');
    setTargetType(item.target_type || 'all');
    setAgencyId(item.agency_id || '');
    setAgentId(item.agent_id || '');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveDocument() {
    if (!title.trim()) {
      alert('Il faut indiquer un titre de document.');
      return;
    }

    setSaving(true);

    const payload = {
      title: title.trim(),
      category: category.trim() || 'G√©n√©ral',
      description: description.trim() || null,
      file_url: fileUrl.trim() || null,
      target_type: targetType,
      agency_id: targetType === 'agency' ? Number(agencyId) || null : null,
      agent_id: targetType === 'agent' ? Number(agentId) || null : null,
    };

    const { error } = editingDocument
      ? await supabase.from('agent_documents').update(payload).eq('id', editingDocument.id)
      : await supabase.from('agent_documents').insert(payload);

    if (error) {
      console.error('Erreur sauvegarde document agent:', error);
      alert("Erreur pendant l'enregistrement du document.");
    } else {
      resetForm();
      setShowForm(false);
      await loadDocuments();
    }

    setSaving(false);
  }

  async function deleteDocument() {
    if (!editingDocument) return;

    const ok = confirm(`Supprimer le document "${editingDocument.title}" ?`);
    if (!ok) return;

    setSaving(true);

    const { error } = await supabase
      .from('agent_documents')
      .delete()
      .eq('id', editingDocument.id);

    if (error) {
      console.error('Erreur suppression document agent:', error);
      alert('Erreur pendant la suppression du document.');
    } else {
      resetForm();
      setShowForm(false);
      await loadDocuments();
    }

    setSaving(false);
  }

  function targetLabel(item: AgentDocument) {
    if (item.target_type === 'agency') return `Agence ${agencyName(item.agency_id)}`;

    if (item.target_type === 'agent') {
      const agent = agentsList.find(a => Number(a.id) === Number(item.agent_id));
      return agent ? `Agent ${agent.full_name}` : 'Agent cibl√©';
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
          <h3>Documents agents</h3>
          <p className="muted">Ajoute des documents, proc√©dures, garanties ou supports commerciaux pour les agents.</p>
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
          {showForm && !editingDocument ? 'Fermer' : '‚ûï Nouveau document'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginTop: 14, marginBottom: 14 }}>
          <h4>{editingDocument ? '‚úèÔ∏è Modifier le document' : 'üìÑ Nouveau document agent'}</h4>

          <div style={{ display: 'grid', gap: 10 }}>
            <input
              placeholder="Titre du document ex : Proc√©dure garantie Opteven"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))', gap: 10 }}>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="G√©n√©ral">G√©n√©ral</option>
                <option value="Garantie">Garantie</option>
                <option value="Proc√©dure">Proc√©dure</option>
                <option value="Formation">Formation</option>
                <option value="Commercial">Commercial</option>
                <option value="Administratif">Administratif</option>
              </select>

              <input
                placeholder="Lien du fichier ou URL"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
              />
            </div>

            <textarea
              placeholder="Description ou consigne li√©e au document..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 10 }}>
              <select
                value={targetType}
                onChange={(e) => {
                  setTargetType(e.target.value);
                  setAgencyId('');
                  setAgentId('');
                }}
              >
                <option value="all">Tous les agents</option>
                <option value="agency">Une agence</option>
                <option value="agent">Un agent pr√©cis</option>
              </select>

              {targetType === 'agency' && (
                <select
                  value={agencyId}
                  onChange={(e) => setAgencyId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">S√©lectionner une agence</option>
                  <option value={1}>Blois</option>
                  <option value={2}>Tours</option>
                  <option value={3}>Bourges</option>
                </select>
              )}

              {targetType === 'agent' && (
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">S√©lectionner un agent</option>
                  {agentsList.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.full_name} ‚Äî {agencyName(agent.agency_id)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={saveDocument} disabled={saving}>
                {saving ? 'Enregistrement...' : editingDocument ? 'üíæ Modifier le document' : '‚úÖ Ajouter le document'}
              </button>

              {editingDocument && (
                <button onClick={deleteDocument} disabled={saving}>
                  üóë Supprimer
                </button>
              )}

              <button
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                disabled={saving}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <p className="muted">Chargement des documents...</p>}

      {!loading && agentDocuments.length === 0 && (
        <p className="muted">Aucun document agent pour le moment.</p>
      )}

      {!loading && agentDocuments.length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {agentDocuments.map((item) => (
            <div
              className="item"
              key={item.id}
              onClick={() => openEditDocumentForm(item)}
              style={{ cursor: 'pointer' }}
              title="Cliquer pour modifier le document"
            >
              <strong>üìÑ {item.title}</strong>

              <p className="muted" style={{ marginTop: 4 }}>
                {item.category || 'G√©n√©ral'} ‚Äî {targetLabel(item)} {item.created_at ? `‚Äî ${formatDate(item.created_at)}` : ''}
              </p>

              {item.description && (
                <p style={{ whiteSpace: 'pre-wrap' }}>{item.description}</p>
              )}

              {item.file_url && (
                <p>
                  <a
                    href={item.file_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Ouvrir le document
                  </a>
                </p>
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
      const name = sale.agents?.full_name || 'Agent non renseign√©';
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
        <h3>Statistiques r√©elles</h3>
        <p className="muted">
          Donn√©es calcul√©es automatiquement depuis les ventes enregistr√©es dans Supabase.
        </p>
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
          <h3>Cette ann√©e</h3>
          <div className="stat-value">{euro(year.ca)}</div>
          <p className="muted">{year.salesCount} vente(s)</p>
          <p>Marge : <strong>{euro(year.margin)}</strong></p>
          <p>Garanties : <strong>{year.warranties}</strong></p>
        </div>
      </div>

      <div className="grid cards3">
        <div className="card">
          <h3>Total g√©n√©ral</h3>
          <div className="stat-value">{euro(total.ca)}</div>
          <p className="muted">{total.salesCount} vente(s) au total</p>
        </div>

        <div className="card">
          <h3>Marge moyenne</h3>
          <div className="stat-value">{euro(Math.round(total.averageMargin))}</div>
          <p className="muted">Moyenne par v√©hicule vendu</p>
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
          <p className="muted">Aucun agent class√© ce mois-ci.</p>
        ) : (
          agentRanking.map((agent, i) => (
            <div className="rank" key={agent.name}>
              <span>
                {i === 0 ? 'üëë ' : ''}
                {i + 1}. {agent.name}
                <span className="muted"> ‚Äî {agent.agency} ‚Äî {agent.sales} vente(s)</span>
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
                <td>{i === 0 ? 'üëë ' : ''}{agency.agency}</td>
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
