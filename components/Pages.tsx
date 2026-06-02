'use client';

import { useEffect, useMemo, useState } from 'react';
import { agencies, documents, messages } from '@/lib/data';
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
  return (
    <div className="grid cards3">
      {agencies.map((a, i) => (
        <div className="card" key={a}>
          <h3>{a}</h3>
          <p className="muted">Agents : {i === 0 ? 2 : 1}</p>
          <p>CA semaine : <strong>{euro([49300, 21400, 23600][i])}</strong></p>
          <p>Marge : <strong>{euro([5600, 2500, 2700][i])}</strong></p>
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
      <p className="muted">Données réelles calculées depuis Supabase.</p>

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
                <td><strong>{agent.rankGlobal === 1 ? '👑 ' : ''}{agent.name}</strong></td>
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
          {showForm && !editingSale ? 'Fermer' : '➕ Nouvelle vente'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginTop: 14, marginBottom: 14 }}>
          <h4>{editingSale ? '✏️ Modifier la vente' : '🚗 Nouvelle vente'}</h4>

          <div style={{ display: 'grid', gap: 10 }}>
            <input
              placeholder="Véhicule vendu ex : Mercedes Classe A 200 AMG"
              value={vehicleName}
              onChange={(e) => setVehicleName(e.target.value)}
            />

            <input
              placeholder="URL photo véhicule facultatif"
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
                <option value="">Sélectionner un agent</option>
                {agentOptions.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.full_name} — {agencyName(agent.agency_id)}
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
                <span className="muted">Marge calculée</span>
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
                {saving ? 'Enregistrement...' : editingSale ? '💾 Modifier la vente' : '✅ Enregistrer la vente'}
              </button>

              {editingSale && (
                <button onClick={deleteSale} disabled={saving}>
                  🗑 Supprimer
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
        placeholder="Recherche marque, modèle, immatriculation, VIN, agent... ex : Mercedes"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading && <p className="muted">Chargement des ventes...</p>}

      {!loading && filteredSales.length === 0 && (
        <p className="muted">Aucune vente trouvée.</p>
      )}

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
                onClick={() => openEditSaleForm(s)}
                style={{ cursor: 'pointer' }}
                title="Cliquer pour modifier la vente"
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
        <p className="stat-good">Très bon niveau</p>
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
  return (
    <div className="card">
      <h3>Messages Direction</h3>

      {messages.map(m => (
        <div className="item" key={m.title}>
          <strong>{m.pinned ? '📌 ' : ''}{m.title}</strong>
          <p className="muted">{m.text}</p>
        </div>
      ))}

      <button className="btn">Publier un message</button>
    </div>
  );
}

export function Documents() {
  return (
    <div className="card">
      <h3>Documents agents</h3>

      {documents.map(d => (
        <div className="item" key={d}>
          📄 {d}
        </div>
      ))}

      <button className="btn">Ajouter un document</button>
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
        <p className="muted">
          Données calculées automatiquement depuis les ventes enregistrées dans Supabase.
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
