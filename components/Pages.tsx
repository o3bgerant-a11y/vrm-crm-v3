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
      <p className="muted">
        Données réelles calculées depuis Supabase : agents, ventes, marges et garanties.
      </p>

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
                <td>
                  <strong>{agent.rankGlobal === 1 ? '👑 ' : ''}{agent.name}</strong>
                </td>
                <td>
                  <span className="badge">{agent.agency}</span>
                </td>
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
