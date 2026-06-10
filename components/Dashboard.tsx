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

type CurrentAgent = {
  id: number;
  full_name: string;
  email: string | null;
  role: string | null;
  account_type: string | null;
  agency_id: number | null;
  auth_user_id: string | null;
};

type Sale = {
  id: number;
  agent_id: number | null;
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

type MonthlyObjective = {
  id: number;
  agent_id: number;
  agency_id: number;
  year_number: number;
  month_number: number;
  sales_target: number;
  margin_target: number;
  warranty_target: number;
};

export default function Dashboard({
  currentAgent = null,
  isResponsable = true,
}: {
  currentAgent?: CurrentAgent | null;
  isResponsable?: boolean;
} = {}) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [objective, setObjective] = useState<MonthlyObjective | null>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  async function loadDashboard() {
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
      console.error('Erreur dashboard:', error);
      setSales([]);
    } else {
      setSales((data || []) as Sale[]);
    }

    if (!isResponsable && currentAgent?.id) {
      const { data: objectiveData, error: objectiveError } = await supabase
        .from('monthly_objectives')
        .select('*')
        .eq('agent_id', currentAgent.id)
        .eq('year_number', currentYear)
        .eq('month_number', currentMonth)
        .maybeSingle();

      if (objectiveError) {
        console.error('Erreur chargement objectif mensuel dashboard:', objectiveError);
        setObjective(null);
      } else {
        setObjective((objectiveData as MonthlyObjective) || null);
      }
    } else {
      setObjective(null);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, [currentAgent?.id, isResponsable]);

  function saleDateToDate(value: string | null) {
    if (!value) return null;
    return new Date(value);
  }

  function isCurrentMonth(value: string | null) {
    const date = saleDateToDate(value);
    if (!date) return false;

    return date.getFullYear() === currentYear && date.getMonth() + 1 === currentMonth;
  }

  function progressPercent(value: number, target: number) {
    if (!target || target <= 0) return 0;
    return Math.min(100, Math.round((value / target) * 100));
  }

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

  const monthlyStats = useMemo(() => {
    const monthSales = sales.filter(sale => isCurrentMonth(sale.sale_date));

    const margin = monthSales.reduce((total, sale) => total + Number(sale.margin_amount || 0), 0);
    const warranties = monthSales.filter(sale => sale.warranty_sold).length;

    return {
      salesCount: monthSales.length,
      margin,
      warranties,
    };
  }, [sales]);

  const agentRanking = useMemo(() => {
    const map = new Map<string, { name: string; agency: string; sales: number; ca: number; margin: number; warranties: number }>();

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

  if (!isResponsable) {
    return (
      <>
        <div className="card">
          <h3>Mes objectifs du mois</h3>
          <p className="muted">
            Objectifs personnels de {currentAgent?.full_name || 'l’agent'} pour {currentMonth.toString().padStart(2, '0')}/{currentYear}.
          </p>

          {!objective ? (
            <div className="item" style={{ marginTop: 14 }}>
              <strong>Aucun objectif défini pour ce mois.</strong>
              <p className="muted" style={{ marginTop: 5 }}>
                Le Responsable peut définir les objectifs dans l’onglet Objectifs mensuels.
              </p>
            </div>
          ) : (
            <div className="grid cards3" style={{ marginTop: 14 }}>
              <div className="card">
                <h3>Objectif ventes</h3>
                <div className="stat-value">{monthlyStats.salesCount} / {objective.sales_target}</div>
                <p className="muted">Progression : {progressPercent(monthlyStats.salesCount, objective.sales_target)}%</p>
              </div>

              <div className="card">
                <h3>Objectif marge</h3>
                <div className="stat-value">{euro(monthlyStats.margin)} / {euro(Number(objective.margin_target || 0))}</div>
                <p className="muted">Progression : {progressPercent(monthlyStats.margin, Number(objective.margin_target || 0))}%</p>
              </div>

              <div className="card">
                <h3>Objectif garanties</h3>
                <div className="stat-value">{monthlyStats.warranties} / {objective.warranty_target}</div>
                <p className="muted">Progression : {progressPercent(monthlyStats.warranties, objective.warranty_target)}%</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid cards3">
          <div className="card">
            <h3>Mon chiffre d'affaires</h3>
            <div className="stat-value">{euro(stats.ca)}</div>
            <p className="muted">Total de mes ventes</p>
          </div>

          <div className="card">
            <h3>Ma marge totale</h3>
            <div className="stat-value">{euro(stats.margin)}</div>
            <p className="muted">Marge réelle calculée</p>
          </div>

          <div className="card">
            <h3>Mes véhicules vendus</h3>
            <div className="stat-value">{stats.salesCount}</div>
            <p className="muted">Ventes rattachées à mon compte</p>
          </div>
        </div>

        <div className="card">
          <h3>Mes dernières ventes</h3>

          {latestSales.length === 0 ? (
            <p className="muted">Aucune vente enregistrée.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Véhicule</th>
                  <th>Marge</th>
                  <th>Garantie</th>
                </tr>
              </thead>

              <tbody>
                {latestSales.map(s => (
                  <tr key={s.id}>
                    <td>{s.vehicle_name}</td>
                    <td><strong>{euro(Number(s.margin_amount || 0))}</strong></td>
                    <td>{s.warranty_sold ? 'Oui' : 'Non'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="grid cards3">
        <div className="card">
          <h3>Chiffre d'affaires</h3>
          <div className="stat-value">{euro(stats.ca)}</div>
          <p className="muted">Total ventes Supabase</p>
        </div>

        <div className="card">
          <h3>Marge totale</h3>
          <div className="stat-value">{euro(stats.margin)}</div>
          <p className="muted">Marge réelle calculée</p>
        </div>

        <div className="card">
          <h3>Véhicules vendus</h3>
          <div className="stat-value">{stats.salesCount}</div>
          <p className="muted">Toutes agences</p>
        </div>
      </div>

      <div className="grid cards3">
        <div className="card">
          <h3>Garanties vendues</h3>
          <div className="stat-value">{stats.warranties}</div>
          <p className="muted">{stats.warrantyRate}% des ventes</p>
        </div>

        <div className="card">
          <h3>Marge moyenne</h3>
          <div className="stat-value">{euro(Math.round(stats.averageMargin))}</div>
          <p className="muted">Par véhicule vendu</p>
        </div>

        <div className="card">
          <h3>Montant garanties</h3>
          <div className="stat-value">{euro(stats.warrantyAmount)}</div>
          <p className="muted">Total garanties vendues</p>
        </div>
      </div>

      <div className="grid cards2">
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
                    <td>{agencyName(s.agents?.agency_id)}</td>
                    <td><strong>{euro(Number(s.margin_amount || 0))}</strong></td>
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
            <div style={{ display: 'grid', gap: 10 }}>
              {agentRanking.map((agent, i) => (
                <div className="item" key={agent.name}>
                  <strong>{i === 0 ? '👑 ' : ''}{i + 1}. {agent.name}</strong>
                  <p className="muted">
                    {agent.agency} — {agent.sales} vente(s) — {euro(agent.margin)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
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
                <td><strong>{i === 0 ? '👑 ' : ''}{agency.agency}</strong></td>
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
