'use client';

import { useEffect, useState } from 'react';
import { agencies, agents, documents, messages } from '@/lib/data';
import { supabase } from '@/lib/supabase';

const euro = (n: number) => n.toLocaleString('fr-FR') + ' €';

const agencyName = (agencyId: any) => {
  const id = Number(agencyId);

  if (id === 1) return 'Blois';
  if (id === 2) return 'Tours';
  if (id === 3) return 'Bourges';

  return '-';
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
          {agents.map(a => (
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
  const [realSales, setRealSales] = useState<any[]>([]);

  useEffect(() => {
    async function loadSales() {
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

      if (!error && data) {
        setRealSales(data);
      }
    }

    loadSales();
  }, []);

  return (
    <div className="card">
      <h3>Ventes véhicules</h3>

      <input
        className="search"
        placeholder="Recherche marque, modèle, agent... ex : Mercedes"
      />

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
          {realSales.map(s => (
            <tr key={s.id}>
              <td>{s.vehicle_name}</td>
              <td>{s.agents?.full_name || '-'}</td>
              <td>
                <span className="badge">
                  {agencyName(s.agents?.agency_id)}
                </span>
              </td>
              <td>{euro(Number(s.sale_price || 0))}</td>
              <td>{euro(Number(s.margin_amount || 0))}</td>
              <td>{s.warranty_sold ? s.warranty_type || 'Oui' : 'Non'}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
