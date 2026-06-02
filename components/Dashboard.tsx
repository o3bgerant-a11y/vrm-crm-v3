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

type Sale = {
  id: number;
  vehicle_name: string | null;
  sale_price: number | null;
  margin_amount: number | null;
  warranty_sold: boolean | null;
  warranty_amount: number | null;
  sale_date: string | null;
  agents?: {
    full_name: string | null;
    agency_id: number | null;
  } | null;
};

export default function Dashboard() {
  const [sales, setSales] = useState<Sale[]>([]);
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
      console.error('Erreur dashboard:', error);
      setSales([]);
    } else {
      setSales(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadSales();
  }, []);

  const stats = useMemo(() => {
    const ca = sales.reduce((total, sale) => total + Number(sale.sale_price || 0), 0);
    const margin = sales.reduce((total, sale) => total + Number(sale.margin_amount || 0), 0);
    const warranties = sales.filter(sale => sale.warranty_sold).length;
    const warrantyAmount = sales.reduce((total, sale) => total + Number(sale.warranty_amount || 0), 0);
    const averageMargin = sales.length > 0 ? margin / sales.length : 0;
    const warrantyRate = sales.length > 0 ? Math.round((warranties / sales.length) * 100) : 0;

    return {
      ca,
      margin,
      warranties,
      warrantyAmount,
      averageMargin,
      warrantyRate,
      salesCount: sales.length,
    };
  }, [sales]);

  const agentRanking = useMemo(() => {
    const map = new Map<string, {
      name: string;
      agency: string;
      sales: number;
      ca: number;
      margin: number;
      warranties: number;
    }>();

    sales.forEach((sale) => {
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
  }, [sales]);

  const agencyRanking = useMemo(() => {
    const base = [
      { agency: 'Blois', sales: 0, ca: 0, margin: 0, warranties: 0 },
      { agency: 'Tours', sales: 0, ca: 0, margin: 0, warranties: 0 },
      { agency: 'Bourges', sales: 0, ca: 0, margin: 0, warranties: 0 },
    ];

    sales.forEach((sale) => {
      const agency = agencyName(sale.agents?.agency_id);
      const row = base.find(item => item.agency === agency);

      if (!row) return;

      row.sales += 1;
      row.ca += Number(sale.sale_price || 0);
      row.margin += Number(sale.margin_amount || 0);
      row.warranties += sale.warranty_sold ? 1 : 0;
    });

    return base.sort((a, b) => b.margin - a.margin);
  }, [sales]);

  const latestSales = sales.slice(0, 6);

  if (loading) {
    return (
      <div className="card">
        <p className="muted">Chargement du tableau de bord...</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid stats">
        <div className="card">
          <div className="stat-title">Chiffre d'affaires</div>
          <div className="stat-value">{euro(stats.ca)}</div>
          <div className="stat-good">Total ventes Supabase</div>
        </div>

        <div className="card">
          <div className="stat-title">Marge totale</div>
          <div className="stat-value">{euro(stats.margin)}</div>
          <div className="stat-good">Marge réelle calculée</div>
        </div>

        <div className="card">
          <div className="stat-title">Véhicules vendus</div>
          <div className="stat-value">{stats.salesCount}</div>
          <div className="muted">Toutes agences</div>
        </div>

        <div className="card">
          <div className="stat-title">Garanties vendues</div>
          <div className="stat-value">{stats.warranties}</div>
          <div className="stat-good">{stats.warrantyRate}% des ventes</div>
        </div>
      </div>

      <div className="grid cards3" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="stat-title">Marge moyenne</div>
          <div className="stat-value">{euro(Math.round(stats.averageMargin))}</div>
          <div className="muted">Par véhicule vendu</div>
        </div>

        <div className="card">
          <div className="stat-title">Montant garanties</div>
          <div className="stat-value">{euro(stats.warrantyAmount)}</div>
          <div className="muted">Total garanties vendues</div>
        </div>

        <div className="card">
          <div className="stat-title">Meilleure agence</div>
          <div className="stat-value">{agencyRanking[0]?.agency || '-'}</div>
          <div className="stat-good">{euro(agencyRanking[0]?.margin || 0)} de marge</div>
        </div>
      </div>

      <div className="section">
        <div className="card">
          <h3>Dernières ventes</h3>

          {latestSales.length === 0 ? (
            <p className="muted">Aucune vente enregistrée.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Véhicule</th>
                  <th>Agent</th>
                  <th>Agence</th>
                  <th>Marge</th>
                </tr>
              </thead>

              <tbody>
                {latestSales.map(s => (
                  <tr key={s.id}>
                    <td>{s.vehicle_name}</td>
                    <td>{s.agents?.full_name || '-'}</td>
                    <td>
                      <span className="badge">
                        {agencyName(s.agents?.agency_id)}
                      </span>
                    </td>
                    <td>{euro(Number(s.margin_amount || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3>Classement agents</h3>

          {agentRanking.length === 0 ? (
            <p className="muted">Aucun agent classé pour le moment.</p>
          ) : (
            agentRanking.map((agent, i) => (
              <div className="rank" key={agent.name}>
                <span>
                  {i === 0 ? '👑 ' : ''}
                  {i + 1}. {agent.name}
                  <span className="muted"> — {agent.agency}</span>
                </span>
                <strong>{euro(agent.margin)}</strong>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Comparatif agences</h3>

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
    </>
  );
}
