'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const euro = (n: number) => n.toLocaleString('fr-FR') + ' €';

export default function Dashboard() {
  const [sales, setSales] = useState<any[]>([]);

  useEffect(() => {
    async function loadSales() {
      const { data, error } = await supabase
        .from('vehicle_sales')
        .select('id, vehicle_name, sale_price, margin_amount, warranty_sold, agents(full_name, agency_id, agencies(name))')
        .order('id', { ascending: false });

      if (!error && data) setSales(data);
    }

    loadSales();
  }, []);

  const ca = sales.reduce((a, s) => a + Number(s.sale_price || 0), 0);
  const margin = sales.reduce((a, s) => a + Number(s.margin_amount || 0), 0);
  const warranties = sales.filter(s => s.warranty_sold).length;

  return (
    <>
      <div className="grid stats">
        <div className="card"><div className="stat-title">Chiffre d'affaires</div><div className="stat-value">{euro(ca)}</div><div className="stat-good">Données Supabase</div></div>
        <div className="card"><div className="stat-title">Marge totale</div><div className="stat-value">{euro(margin)}</div><div className="stat-good">Données réelles</div></div>
        <div className="card"><div className="stat-title">Véhicules vendus</div><div className="stat-value">{sales.length}</div><div className="muted">Depuis Supabase</div></div>
        <div className="card"><div className="stat-title">Garanties vendues</div><div className="stat-value">{warranties}</div><div className="stat-good">Garanties réelles</div></div>
      </div>

      <div className="section">
        <div className="card">
          <h3>Dernières ventes</h3>
          <table className="table">
            <thead><tr><th>Véhicule</th><th>Agent</th><th>Agence</th><th>Marge</th></tr></thead>
            <tbody>
              {sales.map(s => (
                <tr key={s.id}>
                  <td>{s.vehicle_name}</td>
                  <td>{s.agents?.full_name || '-'}</td>
                  <td><span className="badge">{s.agents?.agencies?.name || '-'}</span></td>
                  <td>{euro(Number(s.margin_amount || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Classement agents</h3>
          {sales.map((s, i) => (
            <div className="rank" key={s.id}>
              <span>{i === 0 ? '👑 ' : ''}{i + 1}. {s.agents?.full_name || '-'}</span>
              <strong>{euro(Number(s.margin_amount || 0))}</strong>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
