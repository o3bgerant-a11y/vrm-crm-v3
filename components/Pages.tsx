'use client';

import { useEffect, useMemo, useState } from 'react';
import { agencies, agents as staticAgents, documents, messages } from '@/lib/data';
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
  return (
    <div className="card">
      <h3>Agents commerciaux</h3>

      <table className="table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Agence</th>
            <th>Ventes</th>
            <th>Garanties</th>
            <th>Classement</th>
          </tr>
        </thead>

        <tbody>
          {staticAgents.map(a => (
            <tr key={a.name}>
              <td>{a.rankGlobal === 1 ? '👑 ' : ''}{a.name}</td>
              <td>{a.agency}</td>
              <td>{a.sales}</td>
              <td>{a.warranties}</td>
              <td>#{a.rankGlobal} global / #{a.rankAgency} agence</td>
            </tr>
          ))}
        </tbody>
      </table>
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
      weekly_report_id: 1,
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

    const { error } = await supabase
      .from('vehicle_sales')
      .insert(payload);

    if (error) {
      console.error('Erreur ajout vente:', error);
      alert("Erreur pendant l'enregistrement de la vente.");
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
          <p className="muted">Ajout et suivi des ventes connectées à Supabase.</p>
        </div>

        <button
          className="btn"
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
        >
          {showForm ? 'Fermer' : '➕ Nouvelle vente'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginTop: 14, marginBottom: 14 }}>
          <h4>🚗 Nouvelle vente</h4>

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
                {saving ? 'Enregistrement...' : '✅ Enregistrer la vente'}
              </button>

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
              <tr key={s.id}>
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
  return (
    <div className="section">
      <div className="card">
        <h3>Statistiques semaine / mois / année</h3>
        <p className="muted">
          Graphiques et comparatifs à connecter aux données Supabase.
        </p>

        <div className="item">Classement global agents</div>
        <div className="item">Comparatif Blois / Tours / Bourges</div>
        <div className="item">Évolution marges et garanties</div>
      </div>

      <div className="card">
        <h3>Objectifs</h3>

        <div className="rank">
          <span>Ventes</span>
          <strong>82%</strong>
        </div>

        <div className="rank">
          <span>Marges</span>
          <strong>92%</strong>
        </div>

        <div className="rank">
          <span>Garanties</span>
          <strong>75%</strong>
        </div>
      </div>
    </div>
  );
}
